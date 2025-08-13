/**
 * メインアプリケーションクラス
 */
class MosaicApp {
    constructor() {
        this.elements = {};
        this.imageProcessor = null;
        this.selectionManager = null;
        this.isProcessing = false;
        
        this.init();
    }
    
    /**
     * アプリケーションを初期化
     */
    async init() {
        try {
            // ブラウザサポートをチェック
            const support = checkBrowserSupport();
            if (!support.allSupported) {
                this.showError(CONFIG.messages.error.unsupportedBrowser);
                return;
            }
            
            // DOM要素を取得
            this.initElements();
            
            // イベントリスナーを設定
            this.initEventListeners();
            
            // 画像プロセッサーを初期化
            this.imageProcessor = new ImageProcessor(this.elements.canvas);
            
            // 選択マネージャーを初期化
            this.selectionManager = new SelectionManager(this.elements.canvas, this.elements.overlayCanvas);
            
            // 選択変更コールバックを設定
            this.selectionManager.setSelectionChangeCallback(() => {
                debugLog('Selection change callback triggered');
                this.updateSelectionButtons();
                this.updateProcessButton();
            });
            
            debugLog('App initialized successfully');
            
        } catch (error) {
            errorLog('Failed to initialize app', error);
            this.showError('アプリケーションの初期化に失敗しました');
        }
    }
    
    /**
     * DOM要素を取得して保存
     */
    initElements() {
        this.elements = {
            imageInput: $('#imageInput'),
            canvas: $('#canvas'),
            overlayCanvas: $('#overlayCanvas'),
            processBtn: $('#processBtn'),
            downloadBtn: $('#downloadBtn'),
            status: $('#status'),
            error: $('#error'),
            toolSelection: $('#toolSelection'),
            selectionModeRadios: $$('input[name="selectionMode"]')
        };
        
        // 必要な要素が存在するかチェック（配列は除外）
        for (const [name, element] of Object.entries(this.elements)) {
            if (!element && name !== 'selectionModeRadios') {
                throw new Error(`Required element not found: ${name}`);
            }
        }
    }
    
    /**
     * イベントリスナーを設定
     */
    initEventListeners() {
        // ファイル選択
        this.elements.imageInput.addEventListener('change', (e) => this.handleImageUpload(e));
        
        // モザイク処理ボタン
        this.elements.processBtn.addEventListener('click', () => this.processImage());
        
        // ダウンロードボタン
        this.elements.downloadBtn.addEventListener('click', () => this.downloadImage());
        
        // 選択モード変更
        this.elements.selectionModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.changeSelectionMode(e.target.value));
        });
        
        // ドラッグ&ドロップ対応
        this.initDragAndDrop();
        
        debugLog('Event listeners initialized');
    }
    
    /**
     * ドラッグ&ドロップ機能を初期化
     */
    initDragAndDrop() {
        const dropZone = this.elements.imageInput;
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.add('drag-over');
            });
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => {
                dropZone.classList.remove('drag-over');
            });
        });
        
        dropZone.addEventListener('drop', (e) => {
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleFile(files[0]);
            }
        });
    }
    
    /**
     * 画像アップロードを処理
     * @param {Event} event - ファイル選択イベント
     */
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        await this.handleFile(file);
    }
    
    /**
     * ファイルを処理
     * @param {File} file - ファイルオブジェクト
     */
    async handleFile(file) {
        try {
            // ファイルを検証
            const validation = validateFile(file);
            if (!validation.valid) {
                this.showError(validation.error);
                return;
            }
            
            this.showStatus('画像を読み込み中...');
            this.hideError();
            
            // ファイルを読み込み
            const img = await this.loadImageFromFile(file);
            
            // 画像プロセッサーに読み込み
            const success = await this.imageProcessor.loadImage(img);
            
            if (success) {
                this.onImageLoaded();
            } else {
                this.showError('画像の読み込みに失敗しました');
            }
            
        } catch (error) {
            errorLog('Failed to handle file', error);
            this.showError('ファイルの処理中にエラーが発生しました');
        }
    }
    
    /**
     * ファイルから画像を読み込み
     * @param {File} file - ファイルオブジェクト
     * @returns {Promise<HTMLImageElement>}
     */
    loadImageFromFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error('Failed to load image'));
                img.src = e.target.result;
            };
            
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * 画像読み込み完了時の処理
     */
    onImageLoaded() {
        this.showCanvas();
        this.showToolSelection();
        this.hideDownloadButton();
        this.showStatus(CONFIG.messages.imageLoaded);
        
        // オーバーレイキャンバスのサイズと位置を設定
        const info = this.imageProcessor.getImageInfo();
        this.selectionManager.setOverlaySize(info.width, info.height);
        this.alignOverlayCanvas();
        
        // 初期状態のボタンを更新
        this.updateSelectionButtons();
        this.updateProcessButton();
        
        debugLog('Image loaded', info);
    }
    
    /**
     * モザイク処理を実行
     */
    async processImage() {
        if (this.isProcessing || !this.imageProcessor.hasImage()) return;
        
        const mode = this.selectionManager.selectionMode;
        const hasSelection = this.selectionManager.hasSelection();
        const isConfirmed = this.selectionManager.isSelectionConfirmed();
        
        debugLog('Processing image', { mode, hasSelection, isConfirmed });
        
        // 全体モード以外で選択範囲が未確定の場合はエラー
        if (mode !== 'full' && hasSelection && !isConfirmed) {
            this.showError('選択範囲を確定してください');
            return;
        }
        
        try {
            this.isProcessing = true;
            this.setProcessingState(true);
            this.showStatus(CONFIG.messages.processing);
            
            // UIをブロックしないための短い遅延
            await delay(CONFIG.ui.processingDelay);
            
            // 選択範囲のマスクを取得
            let selectionMask = null;
            if (this.selectionManager.hasSelection() && this.selectionManager.selectionMode !== 'full') {
                const info = this.imageProcessor.getImageInfo();
                selectionMask = this.selectionManager.createSelectionMask(info.width, info.height);
            }
            
            // モザイク処理を実行
            const success = await this.imageProcessor.applyMosaic(CONFIG.mosaic.defaultBlockSize, selectionMask);
            
            if (success) {
                this.onProcessingComplete();
                // モザイク処理後に選択をクリア
                this.selectionManager.clearSelection();
                this.updateProcessButton();
            } else {
                this.showError(CONFIG.messages.error.processingFailed);
            }
            
        } catch (error) {
            errorLog('Failed to process image', error);
            this.showError(CONFIG.messages.error.processingFailed);
        } finally {
            this.isProcessing = false;
            this.setProcessingState(false);
        }
    }
    
    /**
     * モザイク処理完了時の処理
     */
    onProcessingComplete() {
        this.showStatus(CONFIG.messages.processingComplete);
        this.showDownloadButton();
        debugLog('Processing completed');
    }
    
    /**
     * 画像をダウンロード
     */
    async downloadImage() {
        try {
            this.showStatus(CONFIG.messages.downloading);
            
            // Blobを取得
            const blob = await this.imageProcessor.getImageBlob();
            
            if (!blob) {
                this.showError(CONFIG.messages.error.downloadFailed);
                return;
            }
            
            // ダウンロードを実行
            this.downloadBlob(blob, CONFIG.file.downloadFileName);
            
            this.showStatus(CONFIG.messages.processingComplete);
            debugLog('Image downloaded');
            
        } catch (error) {
            errorLog('Failed to download image', error);
            this.showError(CONFIG.messages.error.downloadFailed);
        }
    }
    
    /**
     * Blobをダウンロード
     * @param {Blob} blob - ダウンロードするBlob
     * @param {string} filename - ファイル名
     */
    downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * ステータスメッセージを表示
     * @param {string} message - メッセージ
     */
    showStatus(message) {
        this.elements.status.textContent = message;
    }
    
    /**
     * エラーメッセージを表示
     * @param {string} message - エラーメッセージ
     */
    showError(message) {
        this.elements.error.textContent = message;
        toggleDisplay(this.elements.error, true);
    }
    
    /**
     * エラーメッセージを隠す
     */
    hideError() {
        toggleDisplay(this.elements.error, false);
    }
    
    
    /**
     * 処理ボタンの状態を更新
     */
    updateProcessButton() {
        if (!this.imageProcessor.hasImage()) {
            this.elements.processBtn.disabled = true;
            return;
        }
        
        const mode = this.selectionManager.selectionMode;
        const hasSelection = this.selectionManager.hasSelection();
        const isConfirmed = this.selectionManager.isSelectionConfirmed();
        
        debugLog('Updating process button', { mode, hasSelection, isConfirmed });
        
        // 全体モードの場合は常に有効
        if (mode === 'full') {
            this.elements.processBtn.disabled = false;
            return;
        }
        
        // 選択モードの場合は選択範囲が確定されている場合のみ有効
        if (hasSelection && isConfirmed) {
            this.elements.processBtn.disabled = false;
        } else {
            this.elements.processBtn.disabled = true;
        }
    }
    
    /**
     * ダウンロードボタンを表示
     */
    showDownloadButton() {
        toggleDisplay(this.elements.downloadBtn, true);
    }
    
    /**
     * ダウンロードボタンを隠す
     */
    hideDownloadButton() {
        toggleDisplay(this.elements.downloadBtn, false);
    }
    
    /**
     * 選択モードを変更
     * @param {string} mode - 選択モード
     */
    changeSelectionMode(mode) {
        this.selectionManager.setSelectionMode(mode);
        this.updateSelectionButtons();
        this.updateProcessButton();
    }
    
    
    /**
     * ツール選択セクションを表示
     */
    showToolSelection() {
        toggleDisplay(this.elements.toolSelection, true);
    }
    
    /**
     * 選択ボタンの状態を更新（現在は不要だが、将来の拡張用に残す）
     */
    updateSelectionButtons() {
        // ボタンが削除されたため、現在は何もしない
        // 将来的に追加のUIがある場合はここで更新
    }
    
    /**
     * キャンバスを表示
     */
    showCanvas() {
        toggleClass(this.elements.canvas, 'visible', true);
        toggleClass(this.elements.overlayCanvas, 'visible', true);
        this.elements.canvas.style.display = 'block';
        this.elements.overlayCanvas.style.display = 'block';
    }
    
    /**
     * オーバーレイキャンバスをメインキャンバスに正確に合わせる
     */
    alignOverlayCanvas() {
        const mainCanvasRect = this.elements.canvas.getBoundingClientRect();
        const containerRect = this.elements.canvas.parentElement.getBoundingClientRect();
        
        // メインキャンバスの位置を取得
        const left = mainCanvasRect.left - containerRect.left;
        const top = mainCanvasRect.top - containerRect.top;
        
        // オーバーレイキャンバスを同じ位置に配置
        this.elements.overlayCanvas.style.left = left + 'px';
        this.elements.overlayCanvas.style.top = top + 'px';
        this.elements.overlayCanvas.style.width = mainCanvasRect.width + 'px';
        this.elements.overlayCanvas.style.height = mainCanvasRect.height + 'px';
        
        debugLog('Canvas alignment', { 
            left, 
            top, 
            width: mainCanvasRect.width, 
            height: mainCanvasRect.height 
        });
    }
    
    /**
     * 処理中の状態を設定
     * @param {boolean} processing - 処理中かどうか
     */
    setProcessingState(processing) {
        this.elements.processBtn.disabled = processing;
        toggleClass(this.elements.processBtn, 'loading', processing);
        
        if (processing) {
            this.elements.processBtn.textContent = CONFIG.messages.processing;
        } else {
            this.elements.processBtn.textContent = 'モザイク処理実行';
        }
    }
}

// アプリケーション開始
document.addEventListener('DOMContentLoaded', () => {
    window.mosaicApp = new MosaicApp();
});