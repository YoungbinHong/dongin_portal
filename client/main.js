const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const fsPromises = require('fs').promises;
const os = require('os');
const crypto = require('crypto');
const { exec, spawn } = require('child_process');
const { PDFDocument } = require('pdf-lib');

// 멀티 인스턴스 지원: 각 인스턴스에 다른 userData 경로 사용
const instanceId = process.argv.find(arg => arg.startsWith('--instance='));
if (instanceId) {
    const id = instanceId.split('=')[1];
    const userDataPath = path.join(app.getPath('userData'), `instance-${id}`);
    app.setPath('userData', userDataPath);
}

// 암호화 설정
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.scryptSync('dongin-password', 'salt', 32);
const IV = Buffer.alloc(16, 0);

// 자동 실행 레지스트리 설정
const APP_NAME = 'DonginSecure';
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 300,
        resizable: false,
        transparent: true,
        icon: path.join(__dirname, 'assets', 'images', 'logo.png'),
        title: `DONGIN PORTAL v${app.getVersion()}`,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true,
        frame: false,
        titleBarStyle: 'hidden'
    });

    mainWindow.webContents.setWindowOpenHandler(() => {
        return { action: 'deny' };
    });

    mainWindow.loadFile('splash.html');
}

ipcMain.handle('go-to-update', () => {
    if (mainWindow) {
        mainWindow.close();
        mainWindow = new BrowserWindow({
            width: 1280,
            height: 800,
            resizable: true,
            icon: path.join(__dirname, 'assets', 'images', 'logo.png'),
            title: `DONGIN PORTAL v${app.getVersion()}`,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            },
            autoHideMenuBar: true,
            frame: false,
            titleBarStyle: 'hidden',
            backgroundColor: '#f8faff'
        });
        mainWindow.setMinimumSize(1280, 800);
        mainWindow.center();
        mainWindow.webContents.setWindowOpenHandler(() => {
            return { action: 'deny' };
        });
        mainWindow.loadFile('update.html');
    }
});

ipcMain.handle('go-to-login', () => {
    if (mainWindow) {
        mainWindow.loadFile('login.html');
    }
});

ipcMain.handle('quit-app', () => {
    app.quit();
});

ipcMain.handle('window-minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.handle('window-maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.handle('window-close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('window-is-maximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// ===== IPC 핸들러: 경로 관련 =====
ipcMain.handle('get-home-path', () => {
    return os.homedir();
});

ipcMain.handle('get-platform', () => {
    return os.platform();
});

ipcMain.handle('get-path-sep', () => {
    return path.sep;
});

ipcMain.handle('join-path', (event, ...args) => {
    return path.join(...args);
});

ipcMain.handle('get-basename', (event, filePath, ext) => {
    return ext ? path.basename(filePath, ext) : path.basename(filePath);
});

ipcMain.handle('get-extname', (event, filePath) => {
    return path.extname(filePath);
});

// ===== IPC 핸들러: 파일 시스템 =====
ipcMain.handle('read-directory', async (event, dirPath) => {
    try {
        const files = await fsPromises.readdir(dirPath);
        // 각 파일의 정보도 함께 반환
        const fileInfos = await Promise.all(files.map(async (fileName) => {
            const fullPath = path.join(dirPath, fileName);
            try {
                const stat = await fsPromises.stat(fullPath);
                return {
                    name: fileName,
                    isDirectory: stat.isDirectory(),
                    size: stat.size,
                    modifiedTime: stat.mtime.getTime()
                };
            } catch (e) {
                return {
                    name: fileName,
                    isDirectory: false,
                    size: 0,
                    modifiedTime: 0,
                    error: true
                };
            }
        }));
        return { success: true, files: fileInfos };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-file-stat', async (event, filePath) => {
    try {
        const stat = await fsPromises.stat(filePath);
        return {
            success: true,
            isDirectory: stat.isDirectory(),
            isFile: stat.isFile(),
            size: stat.size
        };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('file-exists', (event, filePath) => {
    return fs.existsSync(filePath);
});

ipcMain.handle('check-access', (event, filePath) => {
    try {
        fs.accessSync(filePath, fs.constants.R_OK);
        return true;
    } catch {
        return false;
    }
});

ipcMain.handle('read-file', async (event, filePath) => {
    try {
        const data = await fsPromises.readFile(filePath);
        // Buffer를 base64로 변환하여 전송
        return { success: true, data: data.toString('base64') };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('write-file', async (event, filePath, base64Data) => {
    try {
        const data = Buffer.from(base64Data, 'base64');
        await fsPromises.writeFile(filePath, data);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('delete-file', async (event, filePath) => {
    try {
        await fsPromises.unlink(filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('move-to-trash', async (event, filePath) => {
    try {
        await shell.trashItem(filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// ===== IPC 핸들러: 암호화/복호화 =====
ipcMain.handle('encrypt-file', async (event, filePath) => {
    try {
        const data = await fsPromises.readFile(filePath);
        const ext = path.extname(filePath);
        const extBuffer = Buffer.from(ext, 'utf8');
        const extLengthBuffer = Buffer.alloc(2);
        extLengthBuffer.writeUInt16LE(extBuffer.length, 0);

        const dataWithHeader = Buffer.concat([extLengthBuffer, extBuffer, data]);

        const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
        let encrypted = cipher.update(dataWithHeader);
        encrypted = Buffer.concat([encrypted, cipher.final()]);

        const baseName = path.basename(filePath, ext);
        const dirPath = path.dirname(filePath);
        const newFileName = baseName + '.dongin';
        const outputPath = path.join(dirPath, newFileName);

        await fsPromises.writeFile(outputPath, encrypted);
        await fsPromises.unlink(filePath);

        return { success: true, newPath: outputPath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('decrypt-file', async (event, filePath) => {
    try {
        const encryptedData = await fsPromises.readFile(filePath);
        const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
        let decrypted = decipher.update(encryptedData);
        decrypted = Buffer.concat([decrypted, decipher.final()]);

        const extLength = decrypted.readUInt16LE(0);
        const originalExt = decrypted.slice(2, 2 + extLength).toString('utf8');
        const originalData = decrypted.slice(2 + extLength);

        const baseName = path.basename(filePath, '.dongin');
        const dirPath = path.dirname(filePath);
        const originalName = baseName + originalExt;
        const outputPath = path.join(dirPath, originalName);

        await fsPromises.writeFile(outputPath, originalData);
        await fsPromises.unlink(filePath);

        return { success: true, newPath: outputPath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// ===== IPC 핸들러: 시스템 =====
ipcMain.handle('open-file', async (event, filePath) => {
    try {
        await shell.openPath(filePath);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('check-auto-start', () => {
    return new Promise((resolve) => {
        exec(`reg query "${REG_KEY}" /v "${APP_NAME}"`, (error) => {
            resolve(!error);
        });
    });
});

ipcMain.handle('set-auto-start', (event, enabled) => {
    return new Promise((resolve) => {
        const exePath = process.execPath;

        if (enabled) {
            exec(`reg add "${REG_KEY}" /v "${APP_NAME}" /t REG_SZ /d "${exePath}" /f`, (error) => {
                resolve({ success: !error, error: error?.message });
            });
        } else {
            exec(`reg delete "${REG_KEY}" /v "${APP_NAME}" /f`, (error) => {
                resolve({ success: !error, error: error?.message });
            });
        }
    });
});

ipcMain.handle('get-app-version', () => app.getVersion());

ipcMain.handle('get-resource-path', (_, filename) => {
    if (!app.isPackaged) {
        return null;
    }
    return path.join(process.resourcesPath, filename);
});

ipcMain.handle('check-update', (event, baseUrl, version) => {
    const url = (baseUrl || '').replace(/\/$/, '') + '/api/update/check?version=' + encodeURIComponent(version || '0.0.0');
    const protocol = url.startsWith('https') ? https : http;
    return new Promise((resolve, reject) => {
        const req = protocol.get(url, { timeout: 12000 }, (res) => {
            let data = '';
            res.on('data', (ch) => { data += ch; });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', (err) => {
            if (err.code === 'ECONNREFUSED') {
                resolve({ serverDown: true });
            } else {
                reject(err);
            }
        });
        req.setTimeout(10000, () => {
            req.destroy();
            reject(new Error('timeout'));
        });
    });
});

ipcMain.handle('download-and-install', async (event, fullUrl) => {
    const url = new URL(fullUrl);
    const protocol = url.protocol === 'https:' ? https : http;
    const destPath = path.join(os.tmpdir(), decodeURIComponent(path.basename(url.pathname)) || 'DONGIN_PORTAL_Setup.exe');
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(destPath);
        protocol.get(fullUrl, { timeout: 120000 }, (res) => {
            if (res.statusCode === 301 || res.statusCode === 302) {
                file.close();
                fs.unlink(destPath, () => {});
                return reject(new Error('Redirect'));
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close(() => {
                    const updaterSrc = path.join(process.resourcesPath, 'updater.exe');

                    if (!fs.existsSync(updaterSrc)) {
                        const installer = spawn(destPath, ['/S'], { detached: true, stdio: 'ignore' });
                        installer.unref();
                        setTimeout(() => app.quit(), 1000);
                        return resolve({ success: true });
                    }

                    const updaterPath = path.join(os.tmpdir(), 'dongin-updater.exe');
                    fs.copyFileSync(updaterSrc, updaterPath);

                    const configPath = path.join(os.tmpdir(), 'dongin-updater-config.json');
                    fs.writeFileSync(configPath, JSON.stringify({
                        setupPath: destPath,
                        version: app.getVersion(),
                        appExePath: process.execPath,
                        appPid: process.pid
                    }));

                    spawn(updaterPath, [configPath], { detached: true, stdio: 'ignore' }).unref();

                    setTimeout(() => app.quit(), 500);
                    resolve({ success: true });
                });
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
});

// ===== IPC 핸들러: PDF 편집 =====
ipcMain.handle('get-temp-dir', () => os.tmpdir());

ipcMain.handle('show-save-dialog', async (event, options) => {
    return await dialog.showSaveDialog(mainWindow, options);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    return await dialog.showOpenDialog(mainWindow, options);
});

ipcMain.handle('get-pdf-page-count', async (event, pdfPath) => {
    try {
        const pdfBytes = await fsPromises.readFile(pdfPath);
        const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
        return { success: true, pageCount: pdfDoc.getPageCount() };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('get-pdf-preview', async (event, pdfPath) => {
    try {
        const data = await fsPromises.readFile(pdfPath);
        return { success: true, data: data.toString('base64') };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('save-compressed-pdf', async (event, outputPath, base64Data) => {
    try {
        const data = Buffer.from(base64Data, 'base64');
        await fsPromises.writeFile(outputPath, data);
        const stat = await fsPromises.stat(outputPath);
        return { success: true, outputPath, size: stat.size };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('split-pdf', async (event, inputPath, outputDir, ranges) => {
    try {
        const pdfBytes = await fsPromises.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const results = [];
        const baseName = path.basename(inputPath, '.pdf');

        for (let i = 0; i < ranges.length; i++) {
            const range = ranges[i];
            const newPdf = await PDFDocument.create();
            const pages = await newPdf.copyPages(pdfDoc, range.pages.map(p => p - 1));
            pages.forEach(page => newPdf.addPage(page));

            const newBytes = await newPdf.save();
            const outPath = ranges.length === 1
                ? path.join(outputDir, `${baseName}_splited.pdf`)
                : path.join(outputDir, `${baseName}_splited_${i + 1}.pdf`);
            await fsPromises.writeFile(outPath, newBytes);
            results.push(outPath);
        }
        return { success: true, files: results };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('split-pdf-each', async (event, inputPath, outputDir) => {
    try {
        const pdfBytes = await fsPromises.readFile(inputPath);
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const totalPages = pdfDoc.getPageCount();
        const results = [];

        for (let i = 0; i < totalPages; i++) {
            const newPdf = await PDFDocument.create();
            const [page] = await newPdf.copyPages(pdfDoc, [i]);
            newPdf.addPage(page);

            const outPath = path.join(outputDir, `page_${i + 1}.pdf`);
            await fsPromises.writeFile(outPath, await newPdf.save());
            results.push(outPath);
        }
        return { success: true, files: results, totalPages };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('merge-pdfs', async (event, inputPaths, outputPath) => {
    try {
        const mergedPdf = await PDFDocument.create();

        for (const pdfPath of inputPaths) {
            const pdfBytes = await fsPromises.readFile(pdfPath);
            const pdf = await PDFDocument.load(pdfBytes);
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(page => mergedPdf.addPage(page));
        }

        await fsPromises.writeFile(outputPath, await mergedPdf.save());
        return { success: true, outputPath };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('unlock-pdf-bruteforce', async (event, inputPath, outputPath, options) => {
    try {
        const pdfBytes = await fsPromises.readFile(inputPath);
        const charsets = {
            numeric: '0123456789',
            alpha: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
            alphanumeric: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
        };
        const chars = charsets[options.charset] || charsets.alphanumeric;
        const maxLen = Math.min(options.maxLength || 6, 6);

        let totalCombinations = 0;
        for (let len = 1; len <= maxLen; len++) {
            totalCombinations += Math.pow(chars.length, len);
        }

        let tried = 0;

        function* generatePasswords() {
            for (let len = 1; len <= maxLen; len++) {
                yield* generateOfLength(len, '');
            }
        }

        function* generateOfLength(len, prefix) {
            if (prefix.length === len) { yield prefix; return; }
            for (const c of chars) yield* generateOfLength(len, prefix + c);
        }

        for (const password of generatePasswords()) {
            tried++;
            if (tried % 500 === 0) {
                mainWindow.webContents.send('bruteforce-progress', { tried, total: totalCombinations });
            }
            try {
                const pdf = await PDFDocument.load(pdfBytes, { password });
                await fsPromises.writeFile(outputPath, await pdf.save());
                return { success: true, password, outputPath };
            } catch (e) {
                // 비밀번호 틀림
            }
        }
        return { success: false, error: '비밀번호를 찾지 못했습니다.' };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('show-notification', (event, { title, body, roomId }) => {
    const { Notification } = require('electron');

    if (!Notification.isSupported()) {
        return { success: false, error: 'Notifications not supported' };
    }

    const notification = new Notification({
        title,
        body,
        icon: path.join(__dirname, 'assets', 'images', 'logo.png')
    });

    notification.on('click', () => {
        if (mainWindow) {
            mainWindow.focus();
            mainWindow.webContents.send('select-room', roomId);
        }
    });

    notification.show();
    return { success: true };
});

ipcMain.handle('upload-file', async (event, { roomId, filePath }) => {
    try {
        const fileData = await fsPromises.readFile(filePath);
        const base64 = fileData.toString('base64');
        const CHUNK_SIZE = 500 * 1024;
        const chunks = [];

        for (let i = 0; i < base64.length; i += CHUNK_SIZE) {
            chunks.push(base64.slice(i, i + CHUNK_SIZE));
        }

        return { success: true, chunks, filename: path.basename(filePath) };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

ipcMain.handle('download-file', async (event, { url, savePath }) => {
    try {
        const file = fs.createWriteStream(savePath);
        const protocol = url.startsWith('https') ? https : http;

        return new Promise((resolve, reject) => {
            protocol.get(url, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve({ success: true, savePath });
                });
            }).on('error', (err) => {
                fs.unlink(savePath, () => {});
                reject({ success: false, error: err.message });
            });
        });
    } catch (err) {
        return { success: false, error: err.message };
    }
});

// 앱 시작
app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
