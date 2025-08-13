/**
 * 選択範囲管理クラス
 */
class SelectionManager {
    constructor(canvas, overlayCanvas) {
        this.canvas = canvas;
        this.overlayCanvas = overlayCanvas;
        this.overlayCtx = overlayCanvas.getContext('2d');

        // 選択状態
        this.isSelecting = false;
        this.selectionMode = 'rectangle'; // 'rectangle', 'freehand', 'full'
        this.selectionPath = [];
        this.rectangleSelection = null;
        this.isConfirmed = false;

        // マウス状態
        this.startPoint = null;
        this.currentPoint = null;

        // コールバック
        this.onSelectionChange = null;

        this.initEventListeners();
        debugLog('SelectionManager initialized');
    }

    /**
     * イベントリスナーを初期化
     */
    initEventListeners() {
        // マウスイベント
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));

        // タッチイベント（モバイル対応）
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    /**
     * 選択モードを設定
     * @param {string} mode - 選択モード
     */
    setSelectionMode(mode) {
        const previousMode = this.selectionMode;
        this.selectionMode = mode;
        this.clearSelection();

        // 全体モードの場合は自動的に確定状態にする（モード変更時のみ）
        if (mode === 'full' && previousMode !== 'full') {
            this.isConfirmed = true;
        } else if (mode !== 'full') {
            // 全体モード以外では確定状態をクリア
            this.isConfirmed = false;
        }

        debugLog('Selection mode changed', { previousMode, newMode: mode, isConfirmed: this.isConfirmed });

        // 状態変更を通知
        this.notifySelectionComplete();
    }

    /**
     * マウスダウンイベント
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        if (event.button !== 0) return; // 左クリックのみ

        event.preventDefault();
        const point = this.getCanvasPoint(event);

        this.startPoint = point;
        this.currentPoint = point;
        this.isSelecting = true;
        this.isConfirmed = false;

        if (this.selectionMode === 'freehand') {
            this.selectionPath = [point];
        }

        this.canvas.style.cursor = 'crosshair';
    }

    /**
     * マウス移動イベント
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (!this.isSelecting) return;

        event.preventDefault();
        this.currentPoint = this.getCanvasPoint(event);

        if (this.selectionMode === 'rectangle') {
            this.drawRectanglePreview();
        } else if (this.selectionMode === 'freehand') {
            this.selectionPath.push(this.currentPoint);
            this.drawFreehandPreview();
        }
    }

    /**
     * マウスアップイベント
     * @param {MouseEvent} event
     */
    handleMouseUp(event) {
        if (event.button !== 0 || !this.isSelecting) return;

        event.preventDefault();
        this.isSelecting = false;
        this.canvas.style.cursor = 'default';

        if (this.selectionMode === 'rectangle') {
            this.finalizeRectangleSelection();
        } else if (this.selectionMode === 'freehand') {
            this.finalizeFreehandSelection();
        }
    }

    /**
     * 右クリックイベント（選択クリア）
     * @param {MouseEvent} event
     */
    handleRightClick(event) {
        event.preventDefault();

        // 確定された選択範囲がある場合のみクリア
        if (this.hasSelection() && this.isConfirmed) {
            this.clearSelection();
            this.notifySelectionComplete(); // 状態変更を通知
        }
    }

    /**
     * タッチイベント対応
     */
    handleTouchStart(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY,
            button: 0
        });
        this.handleMouseDown(mouseEvent);
    }

    handleTouchMove(event) {
        event.preventDefault();
        const touch = event.touches[0];
        const mouseEvent = new MouseEvent('mousemove', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        this.handleMouseMove(mouseEvent);
    }

    handleTouchEnd(event) {
        event.preventDefault();
        const mouseEvent = new MouseEvent('mouseup', {
            button: 0
        });
        this.handleMouseUp(mouseEvent);
    }

    /**
     * キャンバス上の座標を取得
     * @param {MouseEvent} event
     * @returns {Object} {x, y}
     */
    getCanvasPoint(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // キャンバス範囲内に制限
        return {
            x: Math.max(0, Math.min(x, this.canvas.width)),
            y: Math.max(0, Math.min(y, this.canvas.height))
        };
    }

    /**
     * 矩形選択のプレビューを描画
     */
    drawRectanglePreview() {
        this.clearOverlay();

        const { x: startX, y: startY } = this.startPoint;
        const { x: currentX, y: currentY } = this.currentPoint;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        this.overlayCtx.strokeStyle = '#4299e1';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.strokeRect(x, y, width, height);

        this.overlayCtx.fillStyle = 'rgba(66, 153, 225, 0.1)';
        this.overlayCtx.fillRect(x, y, width, height);
    }

    /**
     * フリーハンド選択のプレビューを描画
     */
    drawFreehandPreview() {
        this.clearOverlay();

        if (this.selectionPath.length < 2) return;

        this.overlayCtx.strokeStyle = '#4299e1';
        this.overlayCtx.lineWidth = 2;
        this.overlayCtx.setLineDash([5, 5]);
        this.overlayCtx.beginPath();

        this.overlayCtx.moveTo(this.selectionPath[0].x, this.selectionPath[0].y);
        for (let i = 1; i < this.selectionPath.length; i++) {
            this.overlayCtx.lineTo(this.selectionPath[i].x, this.selectionPath[i].y);
        }

        this.overlayCtx.stroke();
    }

    /**
     * 矩形選択を確定
     */
    finalizeRectangleSelection() {
        const { x: startX, y: startY } = this.startPoint;
        const { x: currentX, y: currentY } = this.currentPoint;

        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);

        if (width < 5 || height < 5) {
            this.clearSelection();
            return;
        }

        this.rectangleSelection = { x, y, width, height };
        this.isConfirmed = true; // ドラッグ終了時に自動確定
        this.drawFinalSelection();

        debugLog('Rectangle selection finalized', {
            rectangle: this.rectangleSelection,
            isConfirmed: this.isConfirmed,
            hasSelection: this.hasSelection()
        });

        // 選択完了を通知
        this.notifySelectionComplete();
    }

    /**
     * フリーハンド選択を確定
     */
    finalizeFreehandSelection() {
        if (this.selectionPath.length < 10) {
            this.clearSelection();
            return;
        }

        // パスを閉じる
        if (this.selectionPath.length > 0) {
            this.selectionPath.push(this.selectionPath[0]);
        }

        this.isConfirmed = true; // ドラッグ終了時に自動確定
        this.drawFinalSelection();

        debugLog('Freehand selection finalized', {
            pathLength: this.selectionPath.length,
            isConfirmed: this.isConfirmed,
            hasSelection: this.hasSelection()
        });

        // 選択完了を通知
        this.notifySelectionComplete();
    }

    /**
     * 確定した選択範囲を描画
     */
    drawFinalSelection() {
        this.clearOverlay();

        if (this.selectionMode === 'rectangle' && this.rectangleSelection) {
            const { x, y, width, height } = this.rectangleSelection;

            this.overlayCtx.strokeStyle = '#3182ce';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.setLineDash([]);
            this.overlayCtx.strokeRect(x, y, width, height);

            this.overlayCtx.fillStyle = 'rgba(49, 130, 206, 0.15)';
            this.overlayCtx.fillRect(x, y, width, height);

        } else if (this.selectionMode === 'freehand' && this.selectionPath.length > 0) {
            this.overlayCtx.strokeStyle = '#3182ce';
            this.overlayCtx.lineWidth = 2;
            this.overlayCtx.setLineDash([]);
            this.overlayCtx.fillStyle = 'rgba(49, 130, 206, 0.15)';

            this.overlayCtx.beginPath();
            this.overlayCtx.moveTo(this.selectionPath[0].x, this.selectionPath[0].y);
            for (let i = 1; i < this.selectionPath.length; i++) {
                this.overlayCtx.lineTo(this.selectionPath[i].x, this.selectionPath[i].y);
            }
            this.overlayCtx.closePath();
            this.overlayCtx.fill();
            this.overlayCtx.stroke();
        }
    }

    /**
     * 選択を確定
     */
    confirmSelection() {
        this.isConfirmed = true;
        debugLog('Selection confirmed', {
            mode: this.selectionMode,
            rectangle: this.rectangleSelection,
            pathLength: this.selectionPath.length
        });
    }

    /**
     * 選択をクリア
     * @param {boolean} resetToDefault - デフォルト状態にリセットするか（デフォルト: false）
     */
    clearSelection(resetToDefault = false) {
        this.isSelecting = false;
        this.selectionPath = [];
        this.rectangleSelection = null;
        this.startPoint = null;
        this.currentPoint = null;

        // デフォルト状態にリセット（バウンディングボックスモード、選択なし）
        if (resetToDefault) {
            this.selectionMode = 'rectangle';
            this.isConfirmed = false;
        } else {
            // 全体モード以外では確定状態をクリア
            if (this.selectionMode !== 'full') {
                this.isConfirmed = false;
            }
        }

        this.clearOverlay();

        // 選択変更を通知してボタン状態を更新
        this.notifySelectionComplete();

        debugLog('Selection cleared', {
            mode: this.selectionMode,
            isConfirmed: this.isConfirmed,
            resetToDefault
        });
    }

    /**
     * オーバーレイキャンバスをクリア
     */
    clearOverlay() {
        // キャンバス全体をクリア
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);

        // 描画状態を完全にリセット
        this.overlayCtx.beginPath();
        this.overlayCtx.closePath();

        // スタイル設定もリセット
        this.overlayCtx.strokeStyle = 'black';
        this.overlayCtx.fillStyle = 'black';
        this.overlayCtx.lineWidth = 1;
        this.overlayCtx.setLineDash([]);

        // グローバル透明度もリセット
        this.overlayCtx.globalAlpha = 1;

        debugLog('Overlay completely cleared and reset', {
            width: this.overlayCanvas.width,
            height: this.overlayCanvas.height
        });
    }

    /**
     * 選択範囲があるかチェック
     * @returns {boolean}
     */
    hasSelection() {
        if (this.selectionMode === 'full') return this.isConfirmed;
        if (this.selectionMode === 'rectangle') return this.rectangleSelection !== null && this.isConfirmed;
        if (this.selectionMode === 'freehand') return this.selectionPath.length > 0 && this.isConfirmed;
        return false;
    }

    /**
     * 選択範囲が確定されているかチェック
     * @returns {boolean}
     */
    isSelectionConfirmed() {
        // 全体モードの場合は常に確定済み
        if (this.selectionMode === 'full') return true;
        return this.isConfirmed;
    }

    /**
     * 選択範囲のマスクを作成
     * @param {number} width - キャンバス幅
     * @param {number} height - キャンバス高さ
     * @returns {ImageData}
     */
    createSelectionMask(width, height) {
        const maskCanvas = document.createElement('canvas');
        maskCanvas.width = width;
        maskCanvas.height = height;
        const maskCtx = maskCanvas.getContext('2d');

        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, width, height);

        maskCtx.fillStyle = 'white';

        if (this.selectionMode === 'full') {
            maskCtx.fillRect(0, 0, width, height);
        } else if (this.selectionMode === 'rectangle' && this.rectangleSelection) {
            const { x, y, width: w, height: h } = this.rectangleSelection;
            maskCtx.fillRect(x, y, w, h);
        } else if (this.selectionMode === 'freehand' && this.selectionPath.length > 0) {
            maskCtx.beginPath();
            maskCtx.moveTo(this.selectionPath[0].x, this.selectionPath[0].y);
            for (let i = 1; i < this.selectionPath.length; i++) {
                maskCtx.lineTo(this.selectionPath[i].x, this.selectionPath[i].y);
            }
            maskCtx.closePath();
            maskCtx.fill();
        }

        return maskCtx.getImageData(0, 0, width, height);
    }

    /**
     * オーバーレイキャンバスのサイズを設定
     * @param {number} width 
     * @param {number} height 
     */
    setOverlaySize(width, height) {
        this.overlayCanvas.width = width;
        this.overlayCanvas.height = height;
    }

    /**
     * 選択変更コールバックを設定
     * @param {Function} callback - コールバック関数
     */
    setSelectionChangeCallback(callback) {
        this.onSelectionChange = callback;
    }

    /**
     * 現在のモードを保持しながら選択状態のみクリア
     */
    clearSelectionKeepMode() {
        this.isSelecting = false;
        this.selectionPath = [];
        this.rectangleSelection = null;
        this.startPoint = null;
        this.currentPoint = null;

        // 全体モード以外では確定状態をクリア
        if (this.selectionMode !== 'full') {
            this.isConfirmed = false;
        } else {
            // 全体モードでも処理後は一度確定状態をクリア
            this.isConfirmed = false;
        }

        this.clearOverlay();

        // 選択変更を通知してボタン状態を更新
        this.notifySelectionComplete();

        debugLog('Selection cleared while keeping mode', {
            mode: this.selectionMode,
            isConfirmed: this.isConfirmed
        });
    }

    /**
     * 選択完了を通知
     */
    notifySelectionComplete() {
        debugLog('Selection complete notification', {
            hasSelection: this.hasSelection(),
            isConfirmed: this.isConfirmed,
            mode: this.selectionMode
        });

        if (this.onSelectionChange) {
            this.onSelectionChange();
        }
    }
}