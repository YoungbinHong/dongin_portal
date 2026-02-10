const API_BASE = 'http://192.168.0.254:8000';
const TOTAL_TIMEOUT_MS = 10000;
const RETRY_INTERVAL_MS = 1500;
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');

async function setAppTitle() {
    try {
        const version = await window.api.getAppVersion();
        document.title = `DONGIN PORTAL v${version}`;
    } catch (error) {
        console.error('Failed to set app title:', error);
    }
}

setAppTitle();

function showTimeoutModal() {
    document.getElementById('timeoutModal').classList.add('show');
}

document.getElementById('timeoutModalBtn').addEventListener('click', () => {
    window.api.quitApp();
});

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkUpdate() {
    const startTime = Date.now();

    statusText.textContent = '업데이트 확인중...';
    progressBar.classList.remove('determinate');
    progressBar.style.width = '';
    progressText.textContent = '';

    let version = '0.0.0';
    try {
        version = await window.api.getAppVersion();
    } catch (_) {}

    let data = null;

    while (Date.now() - startTime < TOTAL_TIMEOUT_MS) {
        try {
            data = await window.api.checkUpdate(API_BASE, version);
            if (!data.serverDown) break;
        } catch (_) {}
        data = null;
        const remaining = TOTAL_TIMEOUT_MS - (Date.now() - startTime);
        if (remaining <= 0) break;
        await delay(Math.min(RETRY_INTERVAL_MS, remaining));
    }

    if (!data) {
        showTimeoutModal();
        return;
    }

    const elapsed = Date.now() - startTime;
    if (elapsed < 2500) {
        await delay(2500 - elapsed);
    }

    if (!data.updateAvailable) {
        document.querySelector('.update-wrapper').classList.add('success');
        await delay(800);
        document.getElementById('latestModal').classList.add('show');
        return;
    }

    if (data.updateAvailable && data.downloadUrl) {
        statusText.textContent = `새 버전 ${data.version || ''} 다운로드중...`;
        progressBar.classList.add('determinate');
        progressBar.style.width = '100%';
        progressText.textContent = '설치 파일 받는 중...';
        await window.api.downloadAndInstall(API_BASE + data.downloadUrl);
        return;
    }

    statusText.textContent = '업데이트 확인 실패';
    progressBar.classList.add('determinate');
    progressBar.style.width = '100%';
    setTimeout(() => window.api.goToLogin(), 2000);
}

document.getElementById('latestModalBtn').addEventListener('click', () => {
    const modal = document.getElementById('latestModal');
    modal.classList.add('hide');
    modal.addEventListener('animationend', () => {
        window.api.goToLogin();
    }, { once: true });
});

checkUpdate();
