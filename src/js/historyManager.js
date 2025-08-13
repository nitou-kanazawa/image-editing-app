/**
 * 履歴管理クラス - Undo/Redo機能を提供
 */
class HistoryManager {
    constructor(maxHistorySize = 10) {
        this.history = []; // 履歴スタック
        this.currentIndex = -1; // 現在の位置
        this.maxHistorySize = maxHistorySize; // 最大履歴数
        
        debugLog('HistoryManager initialized', { maxHistorySize });
    }
    
    /**
     * 新しい状態を履歴に追加
     * @param {ImageData} imageData - 画像データ
     * @param {string} actionName - アクション名
     */
    saveState(imageData, actionName = 'Unknown Action') {
        try {
            // 現在位置より後の履歴を削除（分岐した履歴をクリア）
            if (this.currentIndex < this.history.length - 1) {
                this.history = this.history.slice(0, this.currentIndex + 1);
            }
            
            // 新しい状態を作成
            const state = {
                imageData: this.cloneImageData(imageData),
                actionName,
                timestamp: Date.now()
            };
            
            // 履歴に追加
            this.history.push(state);
            this.currentIndex = this.history.length - 1;
            
            // 履歴サイズ制限
            if (this.history.length > this.maxHistorySize) {
                this.history.shift(); // 最古の履歴を削除
                this.currentIndex--;
            }
            
            debugLog('State saved', { 
                actionName, 
                historyLength: this.history.length, 
                currentIndex: this.currentIndex 
            });
            
        } catch (error) {
            errorLog('Failed to save state', error);
        }
    }
    
    /**
     * Undo（元に戻す）
     * @returns {ImageData|null} - 前の状態の画像データ
     */
    undo() {
        if (!this.canUndo()) {
            return null;
        }
        
        this.currentIndex--;
        const state = this.history[this.currentIndex];
        
        debugLog('Undo executed', { 
            actionName: state.actionName, 
            currentIndex: this.currentIndex 
        });
        
        return this.cloneImageData(state.imageData);
    }
    
    /**
     * Redo（やり直し）
     * @returns {ImageData|null} - 次の状態の画像データ
     */
    redo() {
        if (!this.canRedo()) {
            return null;
        }
        
        this.currentIndex++;
        const state = this.history[this.currentIndex];
        
        debugLog('Redo executed', { 
            actionName: state.actionName, 
            currentIndex: this.currentIndex 
        });
        
        return this.cloneImageData(state.imageData);
    }
    
    /**
     * Undoが可能かチェック
     * @returns {boolean}
     */
    canUndo() {
        return this.currentIndex > 0;
    }
    
    /**
     * Redoが可能かチェック
     * @returns {boolean}
     */
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    /**
     * 現在のアクション名を取得
     * @returns {string|null}
     */
    getCurrentActionName() {
        if (this.currentIndex >= 0 && this.currentIndex < this.history.length) {
            return this.history[this.currentIndex].actionName;
        }
        return null;
    }
    
    /**
     * 前のアクション名を取得（Undo対象）
     * @returns {string|null}
     */
    getPreviousActionName() {
        if (this.canUndo()) {
            return this.history[this.currentIndex - 1].actionName;
        }
        return null;
    }
    
    /**
     * 次のアクション名を取得（Redo対象）
     * @returns {string|null}
     */
    getNextActionName() {
        if (this.canRedo()) {
            return this.history[this.currentIndex + 1].actionName;
        }
        return null;
    }
    
    /**
     * ImageDataをクローン
     * @param {ImageData} imageData - 元の画像データ
     * @returns {ImageData} - クローンされた画像データ
     */
    cloneImageData(imageData) {
        const cloned = new ImageData(
            new Uint8ClampedArray(imageData.data),
            imageData.width,
            imageData.height
        );
        return cloned;
    }
    
    /**
     * 履歴をクリア
     */
    clear() {
        this.history = [];
        this.currentIndex = -1;
        debugLog('History cleared');
    }
    
    /**
     * 履歴情報を取得
     * @returns {Object}
     */
    getHistoryInfo() {
        return {
            totalStates: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            currentAction: this.getCurrentActionName(),
            previousAction: this.getPreviousActionName(),
            nextAction: this.getNextActionName(),
            memoryUsage: this.calculateMemoryUsage()
        };
    }
    
    /**
     * 概算メモリ使用量を計算
     * @returns {string}
     */
    calculateMemoryUsage() {
        let totalBytes = 0;
        this.history.forEach(state => {
            totalBytes += state.imageData.data.length * 4; // RGBA = 4 bytes per pixel
        });
        
        if (totalBytes < 1024 * 1024) {
            return Math.round(totalBytes / 1024) + ' KB';
        } else {
            return Math.round(totalBytes / (1024 * 1024)) + ' MB';
        }
    }
    
    /**
     * 履歴の最適化（古い履歴を削除してメモリを節約）
     * @param {number} keepCount - 保持する履歴数
     */
    optimize(keepCount = 5) {
        if (this.history.length > keepCount) {
            const removeCount = this.history.length - keepCount;
            this.history.splice(0, removeCount);
            this.currentIndex -= removeCount;
            if (this.currentIndex < 0) this.currentIndex = 0;
            
            debugLog('History optimized', { 
                removedCount: removeCount, 
                remaining: this.history.length 
            });
        }
    }
}