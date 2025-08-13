/**
 * 画像処理クラス
 */
class ImageProcessor {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.originalImageData = null;
        this.currentImage = null;
        
        debugLog('ImageProcessor initialized');
    }
    
    /**
     * 画像を読み込んでキャンバスに表示
     * @param {HTMLImageElement} img - 画像要素
     * @returns {Promise<boolean>}
     */
    async loadImage(img) {
        try {
            this.currentImage = img;
            
            // 最適なサイズを計算
            const { width, height } = calculateOptimalSize(
                img.width, 
                img.height, 
                CONFIG.canvas.maxWidth, 
                CONFIG.canvas.maxHeight
            );
            
            // キャンバスサイズを設定
            this.canvas.width = width;
            this.canvas.height = height;
            
            // 画像を描画
            this.ctx.drawImage(img, 0, 0, width, height);
            
            // 元画像データを保存
            this.originalImageData = this.ctx.getImageData(0, 0, width, height);
            
            debugLog('Image loaded successfully', { width, height });
            return true;
            
        } catch (error) {
            errorLog('Failed to load image', error);
            return false;
        }
    }
    
    /**
     * モザイク処理を適用（段階的処理対応）
     * @param {number} blockSize - モザイクブロックサイズ
     * @param {ImageData} selectionMask - 選択範囲マスク（オプション）
     * @param {boolean} useCurrentState - 現在の状態をベースにするか（デフォルト: true）
     * @returns {Promise<boolean>}
     */
    async applyMosaic(blockSize = CONFIG.mosaic.defaultBlockSize, selectionMask = null, useCurrentState = true) {
        if (!this.originalImageData) {
            throw new Error('No image data available');
        }
        
        try {
            let sourceImageData;
            
            if (useCurrentState) {
                // 現在のキャンバス状態を取得（段階的処理用）
                sourceImageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
                debugLog('Using current canvas state for mosaic processing');
            } else {
                // 元画像データを使用（従来の動作）
                sourceImageData = this.originalImageData;
                debugLog('Using original image data for mosaic processing');
            }
            
            // ソースデータのコピーを作成
            const imageData = new ImageData(
                new Uint8ClampedArray(sourceImageData.data),
                sourceImageData.width,
                sourceImageData.height
            );
            
            // モザイク処理を実行
            if (selectionMask) {
                this._processMosaicWithMask(imageData, blockSize, selectionMask);
            } else {
                this._processMosaic(imageData, blockSize);
            }
            
            // 処理結果をキャンバスに描画
            this.ctx.putImageData(imageData, 0, 0);
            
            debugLog('Mosaic applied successfully', { 
                blockSize, 
                hasMask: !!selectionMask, 
                useCurrentState 
            });
            return true;
            
        } catch (error) {
            errorLog('Failed to apply mosaic', error);
            return false;
        }
    }
    
    /**
     * モザイク処理の実装
     * @private
     * @param {ImageData} imageData - 画像データ
     * @param {number} blockSize - ブロックサイズ
     */
    _processMosaic(imageData, blockSize) {
        const { data, width, height } = imageData;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                // ブロック内の平均色を計算
                const avgColor = this._calculateAverageColor(data, x, y, blockSize, width, height);
                
                // ブロック全体を平均色で塗りつぶし
                this._fillBlock(data, x, y, blockSize, width, height, avgColor);
            }
        }
    }
    
    /**
     * ブロック内の平均色を計算
     * @private
     * @param {Uint8ClampedArray} data - 画像データ
     * @param {number} startX - 開始X座標
     * @param {number} startY - 開始Y座標
     * @param {number} blockSize - ブロックサイズ
     * @param {number} width - 画像幅
     * @param {number} height - 画像高さ
     * @returns {Object} {r, g, b}
     */
    _calculateAverageColor(data, startX, startY, blockSize, width, height) {
        let r = 0, g = 0, b = 0, count = 0;
        
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * width + x) * 4;
                r += data[index];
                g += data[index + 1];
                b += data[index + 2];
                count++;
            }
        }
        
        return {
            r: Math.round(r / count),
            g: Math.round(g / count),
            b: Math.round(b / count)
        };
    }
    
    /**
     * ブロックを指定色で塗りつぶし
     * @private
     * @param {Uint8ClampedArray} data - 画像データ
     * @param {number} startX - 開始X座標
     * @param {number} startY - 開始Y座標
     * @param {number} blockSize - ブロックサイズ
     * @param {number} width - 画像幅
     * @param {number} height - 画像高さ
     * @param {Object} color - 色 {r, g, b}
     */
    _fillBlock(data, startX, startY, blockSize, width, height, color) {
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * width + x) * 4;
                data[index] = color.r;
                data[index + 1] = color.g;
                data[index + 2] = color.b;
                // アルファ値は変更しない
            }
        }
    }
    
    /**
     * 元画像を復元
     * @returns {boolean} - 復元が成功したか
     */
    restoreOriginal() {
        if (this.originalImageData) {
            this.ctx.putImageData(this.originalImageData, 0, 0);
            debugLog('Original image restored');
            return true;
        }
        return false;
    }
    
    /**
     * 現在の画像をダウンロード用のBlobとして取得
     * @param {string} format - 画像フォーマット
     * @param {number} quality - 品質（0-1）
     * @returns {Promise<Blob>}
     */
    async getImageBlob(format = CONFIG.file.downloadFormat, quality = 0.9) {
        return new Promise((resolve) => {
            this.canvas.toBlob(resolve, format, quality);
        });
    }
    
    /**
     * マスクを使ったモザイク処理の実装
     * @private
     * @param {ImageData} imageData - 画像データ
     * @param {number} blockSize - ブロックサイズ
     * @param {ImageData} selectionMask - 選択範囲マスク
     */
    _processMosaicWithMask(imageData, blockSize, selectionMask) {
        const { data, width, height } = imageData;
        const maskData = selectionMask.data;
        
        for (let y = 0; y < height; y += blockSize) {
            for (let x = 0; x < width; x += blockSize) {
                // ブロック内にマスクされたピクセルがあるかチェック
                if (this._hasSelectedPixels(maskData, x, y, blockSize, width, height)) {
                    // ブロック内の平均色を計算
                    const avgColor = this._calculateAverageColor(data, x, y, blockSize, width, height);
                    
                    // マスクされたピクセルのみモザイク処理
                    this._fillBlockWithMask(data, maskData, x, y, blockSize, width, height, avgColor);
                }
            }
        }
    }
    
    /**
     * ブロック内に選択されたピクセルがあるかチェック
     * @private
     * @param {Uint8ClampedArray} maskData - マスクデータ
     * @param {number} startX - 開始X座標
     * @param {number} startY - 開始Y座標
     * @param {number} blockSize - ブロックサイズ
     * @param {number} width - 画像幅
     * @param {number} height - 画像高さ
     * @returns {boolean}
     */
    _hasSelectedPixels(maskData, startX, startY, blockSize, width, height) {
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * width + x) * 4;
                if (maskData[index] > 127) { // 白い部分（選択範囲）
                    return true;
                }
            }
        }
        return false;
    }
    
    /**
     * マスクを使ってブロックを塗りつぶし
     * @private
     * @param {Uint8ClampedArray} data - 画像データ
     * @param {Uint8ClampedArray} maskData - マスクデータ
     * @param {number} startX - 開始X座標
     * @param {number} startY - 開始Y座標
     * @param {number} blockSize - ブロックサイズ
     * @param {number} width - 画像幅
     * @param {number} height - 画像高さ
     * @param {Object} color - 色 {r, g, b}
     */
    _fillBlockWithMask(data, maskData, startX, startY, blockSize, width, height, color) {
        const endX = Math.min(startX + blockSize, width);
        const endY = Math.min(startY + blockSize, height);
        
        for (let y = startY; y < endY; y++) {
            for (let x = startX; x < endX; x++) {
                const index = (y * width + x) * 4;
                if (maskData[index] > 127) { // 選択範囲のみ処理
                    data[index] = color.r;
                    data[index + 1] = color.g;
                    data[index + 2] = color.b;
                }
            }
        }
    }
    
    /**
     * キャンバスをクリア
     */
    clear() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.originalImageData = null;
        this.currentImage = null;
        debugLog('Canvas cleared');
    }
    
    /**
     * 現在の画像があるかチェック
     * @returns {boolean}
     */
    hasImage() {
        return this.originalImageData !== null;
    }
    
    /**
     * 画像の情報を取得
     * @returns {Object|null}
     */
    getImageInfo() {
        if (!this.hasImage()) return null;
        
        return {
            width: this.canvas.width,
            height: this.canvas.height,
            originalWidth: this.currentImage?.width || 0,
            originalHeight: this.currentImage?.height || 0
        };
    }
}