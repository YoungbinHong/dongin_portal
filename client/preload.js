const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
    goToUpdate: () => ipcRenderer.invoke('go-to-update'),
    goToLogin: () => ipcRenderer.invoke('go-to-login'),
    quitApp: () => ipcRenderer.invoke('quit-app'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    checkUpdate: (baseUrl, version) => ipcRenderer.invoke('check-update', baseUrl, version),
    downloadAndInstall: (fullUrl) => ipcRenderer.invoke('download-and-install', fullUrl),
    onUpdateInstalling: (callback) => ipcRenderer.on('update-installing', callback),
    onUpdateProgress: (callback) => ipcRenderer.on('update-progress', (_, progress) => callback(progress)),

    // ===== 윈도우 컨트롤 =====
    windowMinimize: () => ipcRenderer.invoke('window-minimize'),
    windowMaximize: () => ipcRenderer.invoke('window-maximize'),
    windowClose: () => ipcRenderer.invoke('window-close'),
    windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),

    // ===== 경로 관련 =====
    getHomePath: () => ipcRenderer.invoke('get-home-path'),
    getPlatform: () => ipcRenderer.invoke('get-platform'),
    getPathSep: () => ipcRenderer.invoke('get-path-sep'),
    joinPath: (...args) => ipcRenderer.invoke('join-path', ...args),
    getBasename: (filePath, ext) => ipcRenderer.invoke('get-basename', filePath, ext),
    getExtname: (filePath) => ipcRenderer.invoke('get-extname', filePath),

    // ===== 파일 시스템 =====
    readDirectory: async (dirPath) => {
        try {
            return await ipcRenderer.invoke('read-directory', dirPath);
        } catch (error) {
            console.error(`Error invoking read-directory for ${dirPath}:`, error);
            // 오류 발생 시, 호출하는 쪽에서 처리할 수 있도록 오류 정보 포함하여 반환
            return { success: false, error: error.message, files: [] };
        }
    },
    getFileStat: (filePath) => ipcRenderer.invoke('get-file-stat', filePath),
    fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
    checkAccess: (filePath) => ipcRenderer.invoke('check-access', filePath),
    readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
    writeFile: (filePath, data) => ipcRenderer.invoke('write-file', filePath, data),
    deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
    moveToTrash: (filePath) => ipcRenderer.invoke('move-to-trash', filePath),

    // ===== 파일 실행 =====
    openFile: (filePath) => ipcRenderer.invoke('open-file', filePath),

    // ===== 자동 시작 =====
    checkAutoStart: () => ipcRenderer.invoke('check-auto-start'),
    setAutoStart: (enabled) => ipcRenderer.invoke('set-auto-start', enabled),

    // ===== 암호화/복호화 =====
    encryptFile: (filePath) => ipcRenderer.invoke('encrypt-file', filePath),
    decryptFile: (filePath) => ipcRenderer.invoke('decrypt-file', filePath),

    // ===== PDF 편집 =====
    getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    getPdfPageCount: (pdfPath) => ipcRenderer.invoke('get-pdf-page-count', pdfPath),
    getPdfPreview: (pdfPath) => ipcRenderer.invoke('get-pdf-preview', pdfPath),
    saveCompressedPdf: (outputPath, base64Data) => ipcRenderer.invoke('save-compressed-pdf', outputPath, base64Data),
    splitPdf: (inputPath, outputDir, ranges) => ipcRenderer.invoke('split-pdf', inputPath, outputDir, ranges),
    splitPdfEach: (inputPath, outputDir) => ipcRenderer.invoke('split-pdf-each', inputPath, outputDir),
    mergePdfs: (inputPaths, outputPath) => ipcRenderer.invoke('merge-pdfs', inputPaths, outputPath),
    unlockPdfBruteforce: (inputPath, outputPath, options) => ipcRenderer.invoke('unlock-pdf-bruteforce', inputPath, outputPath, options),
    onBruteforceProgress: (callback) => ipcRenderer.on('bruteforce-progress', (_, data) => callback(data))

    // ===== AI Agent =====
    // (AI Agent 관련 API가 있다면 여기에 추가)
});
