const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

let win;
let config = {};

const configPath = process.argv.find(a => a.endsWith('.json'));
if (configPath && fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch {}
}

const logPath = path.join(require('os').tmpdir(), 'dongin-updater.log');
function log(msg) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(logPath, line);
}

log(`Started. config=${JSON.stringify(config)}`);
log(`argv=${JSON.stringify(process.argv)}`);

app.whenReady().then(() => {
    win = new BrowserWindow({
        width: 400,
        height: 240,
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        transparent: true,
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true
        }
    });

    win.loadFile('install.html');

    ipcMain.handle('get-version', () => config.version || '');

    win.webContents.on('did-finish-load', () => {
        log('Page loaded. Waiting for app exit...');
        waitForAppExit().then(() => {
            log('App exited. Starting installer...');
            runInstaller();
        });
    });
});

function isProcessRunning(pid) {
    try {
        const output = execSync(`tasklist /FI "PID eq ${pid}" /NH`, { stdio: 'pipe' }).toString();
        return output.includes(String(pid));
    } catch {
        return false;
    }
}

function waitForAppExit() {
    return new Promise(resolve => {
        if (!config.appPid) return resolve();
        const check = setInterval(() => {
            if (!isProcessRunning(config.appPid)) {
                clearInterval(check);
                resolve();
            }
        }, 300);
        setTimeout(() => { clearInterval(check); resolve(); }, 10000);
    });
}

function runInstaller() {
    if (!config.setupPath || !fs.existsSync(config.setupPath)) {
        log(`Setup file not found: ${config.setupPath}`);
        win.webContents.send('error', `설치 파일을 찾을 수 없습니다.`);
        setTimeout(() => app.quit(), 5000);
        return;
    }

    const installDir = path.join(
        process.env.LOCALAPPDATA || process.env.PROGRAMFILES,
        'dongin-portal'
    );

    log(`Running installer: ${config.setupPath} /S`);
    const installer = spawn(config.setupPath, ['/S'], { stdio: 'ignore' });

    let progress = 0;
    const interval = setInterval(() => {
        try {
            if (fs.existsSync(installDir)) {
                const files = fs.readdirSync(installDir, { recursive: true });
                progress = Math.min(files.length * 2, 90);
                win.webContents.send('progress', progress);
            }
        } catch {}
    }, 500);

    installer.on('close', (code) => {
        clearInterval(interval);
        log(`Installer exited with code: ${code}`);
        if (code === 0) {
            win.webContents.send('progress', 100);
            win.webContents.send('status', '설치 완료! 앱을 실행합니다...');
            setTimeout(() => {
                log(`Launching app: ${config.appExePath}`);
                spawn(config.appExePath, [], { detached: true, stdio: 'ignore' }).unref();
                app.quit();
            }, 1500);
        } else {
            win.webContents.send('error', `설치 실패 (오류 코드: ${code})`);
            setTimeout(() => app.quit(), 5000);
        }
    });

    installer.on('error', (err) => {
        clearInterval(interval);
        log(`Installer error: ${err.message}`);
        win.webContents.send('error', err.message);
        setTimeout(() => app.quit(), 5000);
    });
}

app.on('window-all-closed', () => app.quit());