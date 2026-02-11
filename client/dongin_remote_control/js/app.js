let currentSection = 'devices';

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('donginTheme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');

    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('show');
        document.querySelector('.main-container').classList.add('show');
    }, 100);
});

function selectSection(section) {
    currentSection = section;
    document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`${section}Section`).classList.add('active');
}

function connectDevice(btn) {
    btn.textContent = '연결 중...';
    btn.disabled = true;
    setTimeout(() => {
        showAlert('연결 실패', '백엔드 서버와 연결 후 사용 가능한 기능입니다.');
        btn.textContent = '연결';
        btn.disabled = false;
    }, 1200);
}

function addDevice() {
    const name = document.getElementById('deviceName').value.trim();
    const ip = document.getElementById('deviceIp').value.trim();
    if (!name || !ip) {
        showAlert('입력 오류', '장치 이름과 IP 주소를 입력해주세요.');
        return;
    }
    showAlert('장치 등록', '백엔드 서버와 연결 후 사용 가능한 기능입니다.');
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertBody').textContent = message;
    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('alertContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        if (modal && modal.style.display === 'flex') closeModal();
    }
});

function logout() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('logoutContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmLogout() {
    closeModal();
    document.getElementById('logoutOverlay').classList.add('active');
    setTimeout(() => { window.location.href = '../login.html?from=logout'; }, 600);
}

function showHomeConfirm() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();

    const pathname = window.location.pathname;
    const appMatch = pathname.match(/client[\/\\]dongin_([^\/\\]+)/);
    let targetUrl = '../menu.html';

    if (appMatch) {
        const appName = appMatch[1];
        targetUrl = `../menu.html?from=${appName}`;
    }

    document.getElementById('logoutOverlay').classList.add('active');
    setTimeout(() => { window.location.href = targetUrl; }, 400);
}

function openSettings() {
    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');
    document.getElementById('modalOverlay').style.display = 'flex';
    document.getElementById('settingsContent').style.display = 'flex';
    loadSettingsState();
}

function switchTab(event, tabName) {
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.settings-menu-item').forEach(item => item.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    event.currentTarget.classList.add('active');
}

function applyTheme(theme) {
    localStorage.setItem('donginTheme', theme);
    if (theme === 'dark') document.body.classList.add('dark-theme');
    else document.body.classList.remove('dark-theme');
}

function loadSettingsState() {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    checkAutoStartStatus();
}

async function checkAutoStartStatus() {
    const checkbox = document.getElementById('autoStartCheckbox');
    if (!checkbox || !window.api) return;
    checkbox.checked = await window.api.checkAutoStart();
}

async function toggleAutoStart(enabled) {
    if (!window.api) return;
    const result = await window.api.setAutoStart(enabled);
    if (!result.success) {
        showAlert('오류', '자동 실행 설정에 실패했습니다.');
        document.getElementById('autoStartCheckbox').checked = !enabled;
    }
}
