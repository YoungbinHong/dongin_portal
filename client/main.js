const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const fsPromises = require('fs').promises;
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

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
        width: 1280,
        height: 800,
        minWidth: 1280,
        minHeight: 800,
        icon: path.join(__dirname, 'assets', 'images', 'logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        },
        autoHideMenuBar: true
    });

    mainWindow.loadFile('update.html');
}

ipcMain.handle('go-to-login', () => {
    if (mainWindow) {
        mainWindow.loadFile('login.html');
    }
});

ipcMain.handle('quit-app', () => {
    app.quit();
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
    const destPath = path.join(os.tmpdir(), path.basename(url.pathname) || 'DONGIN_PORTAL_Setup.exe');
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
                file.close();
                shell.openPath(destPath);
                setTimeout(() => app.quit(), 500);
                resolve({ success: true });
            });
        }).on('error', (err) => {
            file.close();
            fs.unlink(destPath, () => {});
            reject(err);
        });
    });
});

// 앱 시작
app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
