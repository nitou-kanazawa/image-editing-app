/**
 * メインアプリケーションクラス
 */
class MosaicApp {
    constructor() {
        this.elements = {};
        this.imageProcessor = null;
        this.selectionManager = null;
        this.historyManager = null;
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
            
            // 履歴マネージャーを初期化
            this.historyManager = new HistoryManager(CONFIG.history?.maxStates || 10);
            
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
            undoBtn: $('#undoBtn'),
            redoBtn: $('#redoBtn'),
            resetBtn: $('#resetBtn'),
            downloadBtn: $('#downloadBtn'),
            status: $('#status'),
            error: $('#error'),
            toolSelection: $('#toolSelection'),
            selectionModeRadios: $$('input[name="selectionMode"]'),
            mosaicSizeSlider: $('#mosaicSizeSlider'),
            mosaicSizeValue: $('#mosaicSizeValue')
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
        
        // Undo/Redoボタン
        this.elements.undoBtn.addEventListener('click', () => this.undo());
        this.elements.redoBtn.addEventListener('click', () => this.redo());
        
        // リセットボタン
        this.elements.resetBtn.addEventListener('click', () => this.resetToOriginal());
        
        // ダウンロードボタン
        this.elements.downloadBtn.addEventListener('click', () => this.downloadImage());
        
        // 選択モード変更
        this.elements.selectionModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => this.changeSelectionMode(e.target.value));
        });
        
        // モザイクサイズ変更
        this.elements.mosaicSizeSlider.addEventListener('input', (e) => this.updateMosaicSize(e.target.value));
        
        // ドラッグ&ドロップ対応
        this.initDragAndDrop();
        
        // キーボードショートカット
        this.initKeyboardShortcuts();
        
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
        this.showResetButton();
        this.showStatus(CONFIG.messages.imageLoaded);
        
        // オーバーレイキャンバスのサイズと位置を設定
        const info = this.imageProcessor.getImageInfo();
        this.selectionManager.setOverlaySize(info.width, info.height);
        this.alignOverlayCanvas();
        
        // 初期状態のボタンを更新
        this.updateSelectionButtons();
        this.updateProcessButton();
        
        // 初期状態を履歴に保存
        this.saveCurrentState('Initial Image Load');
        
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
            
            // スライダーで設定されたブロックサイズを取得
            const blockSize = parseInt(this.elements.mosaicSizeSlider.value);
            
            // モザイク処理を実行（現在の状態をベースに段階的処理）
            const success = await this.imageProcessor.applyMosaic(blockSize, selectionMask, true);
            
            if (success) {
                this.onProcessingComplete();
                
                // 処理後の状態を履歴に保存
                this.saveCurrentState('Mosaic Applied');
                
                // モザイク処理後に選択をクリア（現在のモードを保持）
                this.selectionManager.clearSelectionKeepMode();
                
                // オーバーレイキャンバスを強制的にクリア
                this.selectionManager.clearOverlay();
                
                // 即座にボタンを無効化（最優先）
                this.elements.processBtn.disabled = true;
                
                // ボタン状態を複数回更新して確実に非アクティブ化
                this.updateProcessButton();
                this.updateHistoryButtons();
                this.updateSelectionModeUI();
                
                // オーバーレイキャンバスを一度非表示にして再表示（強制リセット）
                this.elements.overlayCanvas.style.display = 'none';
                setTimeout(() => {
                    this.elements.overlayCanvas.style.display = 'block';
                    // setTimeout後もボタンを再度無効化
                    this.elements.processBtn.disabled = true;
                }, 10);
                
                // さらに確実にするため、少し遅延させてもう一度無効化
                setTimeout(() => {
                    this.elements.processBtn.disabled = true;
                    debugLog('Final button disable check', { 
                        disabled: this.elements.processBtn.disabled,
                        hasSelection: this.selectionManager.hasSelection(),
                        mode: this.selectionManager.selectionMode
                    });
                }, 50);
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
        
        debugLog('Updating process button', { 
            mode, 
            hasSelection, 
            isConfirmed,
            rectangleSelection: this.selectionManager.rectangleSelection,
            selectionPathLength: this.selectionManager.selectionPath.length,
            currentButtonState: this.elements.processBtn.disabled
        });
        
        // 全体モードの場合は常に有効
        if (mode === 'full') {
            this.elements.processBtn.disabled = false;
            return;
        }
        
        // 選択モードの場合は選択範囲が確定されている場合のみ有効
        // 厳密チェック: hasSelection と isConfirmed の両方が true の場合のみ
        if (hasSelection && isConfirmed && (
            (mode === 'rectangle' && this.selectionManager.rectangleSelection !== null) ||
            (mode === 'freehand' && this.selectionManager.selectionPath.length > 0)
        )) {
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
     * リセットボタンを表示
     */
    showResetButton() {
        toggleDisplay(this.elements.resetBtn, true);
    }
    
    /**
     * リセットボタンを隠す
     */
    hideResetButton() {
        toggleDisplay(this.elements.resetBtn, false);
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
     * キーボードショートカットを初期化
     */
    initKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl+Z: Undo
            if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                this.undo();
            }
            // Ctrl+Y or Ctrl+Shift+Z: Redo
            else if (e.ctrlKey && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
                e.preventDefault();
                this.redo();
            }
        });
    }
    
    /**
     * 現在の状態を履歴に保存
     * @param {string} actionName - アクション名
     */
    saveCurrentState(actionName) {
        if (this.imageProcessor.hasImage()) {
            const currentImageData = this.imageProcessor.ctx.getImageData(
                0, 0, 
                this.imageProcessor.canvas.width, 
                this.imageProcessor.canvas.height
            );
            this.historyManager.saveState(currentImageData, actionName);
            this.updateHistoryButtons();
        }
    }
    
    /**
     * Undo実行
     */
    undo() {
        const previousState = this.historyManager.undo();
        if (previousState) {
            this.imageProcessor.ctx.putImageData(previousState, 0, 0);
            this.updateHistoryButtons();
            this.selectionManager.clearSelection();
            this.updateProcessButton();
            this.updateSelectionModeUI();
            this.showStatus(`元に戻しました: ${this.historyManager.getCurrentActionName()}`);
            debugLog('Undo executed');
        }
    }
    
    /**
     * Redo実行
     */
    redo() {
        const nextState = this.historyManager.redo();
        if (nextState) {
            this.imageProcessor.ctx.putImageData(nextState, 0, 0);
            this.updateHistoryButtons();
            this.selectionManager.clearSelection();
            this.updateProcessButton();
            this.updateSelectionModeUI();
            this.showStatus(`やり直しました: ${this.historyManager.getCurrentActionName()}`);
            debugLog('Redo executed');
        }
    }
    
    /**
     * 履歴ボタンの状態を更新
     */
    updateHistoryButtons() {
        this.elements.undoBtn.disabled = !this.historyManager.canUndo();
        this.elements.redoBtn.disabled = !this.historyManager.canRedo();
        
        // ツールチップを更新
        const previousAction = this.historyManager.getPreviousActionName();
        const nextAction = this.historyManager.getNextActionName();
        
        this.elements.undoBtn.title = previousAction ? 
            `元に戻す: ${previousAction} (Ctrl+Z)` : 
            '元に戻す (Ctrl+Z)';
            
        this.elements.redoBtn.title = nextAction ? 
            `やり直し: ${nextAction} (Ctrl+Y)` : 
            'やり直し (Ctrl+Y)';
    }
    
    /**
     * 元画像に戻す
     */
    resetToOriginal() {
        const success = this.imageProcessor.restoreOriginal();
        if (success) {
            // リセット後の状態を履歴に保存
            this.saveCurrentState('Reset to Original');
            
            this.selectionManager.clearSelection();
            this.updateProcessButton();
            this.updateHistoryButtons();
            this.updateSelectionModeUI();
            this.showStatus('元画像に戻しました');
            debugLog('Reset to original image');
        }
    }
    
    /**
     * 選択モードUIを更新
     */
    updateSelectionModeUI() {
        const currentMode = this.selectionManager.selectionMode;
        
        // ラジオボタンを現在のモードに合わせる
        this.elements.selectionModeRadios.forEach(radio => {
            radio.checked = radio.value === currentMode;
        });
        
        // モードUI更新後にボタン状態も再確認
        this.updateProcessButton();
        
        debugLog('Selection mode UI updated', { currentMode });
    }
    
    /**
     * モザイクサイズを更新
     * @param {string} value - スライダーの値
     */
    updateMosaicSize(value) {
        const size = parseInt(value);
        this.elements.mosaicSizeValue.textContent = `${size}px`;
        debugLog('Mosaic size updated', { size });
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