/**
 * アプリケーション設定
 */
const CONFIG = {
    // キャンバス設定
    canvas: {
        maxWidth: 800,
        maxHeight: 600,
        defaultWidth: 800,
        defaultHeight: 600
    },

    // モザイク設定
    mosaic: {
        defaultBlockSize: 10,
        minBlockSize: 5,
        maxBlockSize: 50
    },

    // ファイル設定
    file: {
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        downloadFormat: 'image/png',
        downloadFileName: 'mosaic-image.png'
    },

    // UI設定
    ui: {
        fadeAnimationDuration: 300,
        processingDelay: 100, // UIをブロックしないための遅延
        showProgressBar: true
    },

    // 履歴設定
    history: {
        maxStates: 10, // 最大履歴数
        autoSave: true // 自動保存
    },

    // メッセージ
    messages: {
        selectImage: '画像を選択してください',
        imageLoaded: '画像を読み込みました',
        processing: 'モザイク処理中...',
        processingComplete: 'モザイク処理完了',
        downloading: 'ダウンロード中...',
        error: {
            invalidFile: '対応している画像ファイルを選択してください',
            fileTooLarge: 'ファイルサイズが大きすぎます（最大10MB）',
            processingFailed: 'モザイク処理でエラーが発生しました',
            downloadFailed: 'ダウンロードでエラーが発生しました',
            unsupportedBrowser: 'お使いのブラウザでは一部機能が利用できません'
        }
    }
};