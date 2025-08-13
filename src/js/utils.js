/**
 * ユーティリティ関数集
 */

/**
 * DOM要素を取得する
 * @param {string} selector - セレクタ
 * @returns {Element|null}
 */
function $(selector) {
    return document.querySelector(selector);
}

/**
 * 複数のDOM要素を取得する
 * @param {string} selector - セレクタ
 * @returns {NodeList}
 */
function $$(selector) {
    return document.querySelectorAll(selector);
}

/**
 * ファイルサイズを人間が読める形式に変換
 * @param {number} bytes - バイト数
 * @returns {string}
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 画像の最適なサイズを計算する
 * @param {number} originalWidth - 元の幅
 * @param {number} originalHeight - 元の高さ
 * @param {number} maxWidth - 最大幅
 * @param {number} maxHeight - 最大高さ
 * @returns {Object} {width, height}
 */
function calculateOptimalSize(originalWidth, originalHeight, maxWidth, maxHeight) {
    let { width, height } = { width: originalWidth, height: originalHeight };

    if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
    }

    return { width, height };
}

/**
 * ファイルタイプを検証する
 * @param {File} file - ファイルオブジェクト
 * @returns {boolean}
 */
function validateFileType(file) {
    return CONFIG.file.allowedTypes.includes(file.type);
}

/**
 * ファイルサイズを検証する
 * @param {File} file - ファイルオブジェクト
 * @returns {boolean}
 */
function validateFileSize(file) {
    return file.size <= CONFIG.file.maxSize;
}

/**
 * ファイルを検証する
 * @param {File} file - ファイルオブジェクト
 * @returns {Object} {valid, error}
 */
function validateFile(file) {
    if (!validateFileType(file)) {
        return {
            valid: false,
            error: CONFIG.messages.error.invalidFile
        };
    }

    if (!validateFileSize(file)) {
        return {
            valid: false,
            error: `${CONFIG.messages.error.fileTooLarge} (現在: ${formatFileSize(file.size)})`
        };
    }

    return { valid: true, error: null };
}

/**
 * 要素にクラスを追加/削除する
 * @param {Element} element - DOM要素
 * @param {string} className - クラス名
 * @param {boolean} add - 追加するかどうか
 */
function toggleClass(element, className, add) {
    if (add) {
        element.classList.add(className);
    } else {
        element.classList.remove(className);
    }
}

/**
 * 要素の表示/非表示を切り替える
 * @param {Element} element - DOM要素
 * @param {boolean} show - 表示するかどうか
 */
function toggleDisplay(element, show) {
    element.style.display = show ? 'block' : 'none';
}

/**
 * 非同期でsetTimeoutを実行する
 * @param {number} ms - 待機時間（ミリ秒）
 * @returns {Promise}
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ブラウザの機能サポートを確認する
 * @returns {Object}
 */
function checkBrowserSupport() {
    const support = {
        canvas: !!document.createElement('canvas').getContext,
        fileApi: !!(window.File && window.FileReader && window.FileList),
        downloadApi: 'download' in document.createElement('a')
    };

    support.allSupported = Object.values(support).every(Boolean);

    return support;
}

/**
 * デバッグログを出力する
 * @param {string} message - メッセージ
 * @param {any} data - データ
 */
function debugLog(message, data = null) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log(`[DEBUG] ${message}`, data || '');
    }
}

/**
 * エラーログを出力する
 * @param {string} message - メッセージ
 * @param {Error} error - エラーオブジェクト
 */
function errorLog(message, error = null) {
    console.error(`[ERROR] ${message}`, error || '');
}