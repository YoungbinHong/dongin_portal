/* === 설정 관리 === */

/* 알림 설정 */
function loadNoticeSettings() {
    const noticeCompletion = localStorage.getItem('notice-completion') !== 'false';
    const notice1 = document.getElementById('notice1');
    if (notice1) {
        notice1.checked = noticeCompletion;
    }

    const noticeSecurity = localStorage.getItem('notice-security') !== 'false';
    const notice2 = document.getElementById('notice2');
    if (notice2) {
        notice2.checked = noticeSecurity;
    }
}

function toggleNoticeCompletion(enabled) {
    localStorage.setItem('notice-completion', enabled ? 'true' : 'false');
    console.log('완료 알림 설정:', enabled);
}

function toggleNoticeSecurity(enabled) {
    localStorage.setItem('notice-security', enabled ? 'true' : 'false');
    console.log('보안 알림 설정:', enabled);
}

/* 자동 로그아웃 */
function loadAutoLogoutSetting() {
    const savedTime = localStorage.getItem('auto-logout-time') || '10';
    const select = document.getElementById('autoLogoutSelect');
    if (select) {
        select.value = savedTime;
    }
}

function setAutoLogoutTime(minutes) {
    localStorage.setItem('auto-logout-time', minutes);
    console.log('자동 로그아웃 시간 설정:', minutes === '0' ? '사용 안 함' : minutes + '분');
    initAutoLogout();
}

function initAutoLogout() {
    if (autoLogoutTimerId) {
        clearInterval(autoLogoutTimerId);
        autoLogoutTimerId = null;
    }

    const minutes = parseInt(localStorage.getItem('auto-logout-time') || '10');

    if (minutes === 0) {
        console.log('자동 로그아웃 비활성화');
        return;
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });

    lastActivityTime = Date.now();

    autoLogoutTimerId = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastActivityTime) / 1000 / 60;

        if (elapsed >= minutes) {
            console.log('자동 로그아웃 실행');
            clearInterval(autoLogoutTimerId);
            window.location.href = 'login.html';
        }
    }, 60000);

    console.log('자동 로그아웃 타이머 시작:', minutes + '분');
}

function resetActivityTimer() {
    lastActivityTime = Date.now();
}

/* 자동 시작 */
async function checkAutoStartStatus() {
    const checkbox = document.getElementById('autoStartCheckbox');
    if (!checkbox) return;

    const isEnabled = await window.api.checkAutoStart();
    checkbox.checked = isEnabled;
}

async function toggleAutoStart(enabled) {
    const result = await window.api.setAutoStart(enabled);

    if (!result.success) {
        console.error('자동 실행 설정 실패:', result.error);
        showAlertModal('오류', '자동 실행 설정에 실패했습니다.');
        document.getElementById('autoStartCheckbox').checked = !enabled;
    } else {
        console.log(enabled ? '자동 실행 등록 완료' : '자동 실행 해제 완료');
    }
}

/* 설정 모달 */
function openSettings() {
    const modal = document.getElementById('modalOverlay');
    const settingsContent = document.getElementById('settingsContent');

    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    settingsContent.style.display = 'flex';
}

function switchTab(event, tabName) {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.settings-menu-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    event.currentTarget.classList.add('active');
}

/* 로그아웃 */
function logout() {
    const modal = document.getElementById('modalOverlay');
    const logoutContent = document.getElementById('logoutContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    logoutContent.style.display = 'block';
}

function confirmLogout() {
    closeModal();

    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');

    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1800);
}