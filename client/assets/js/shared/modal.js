function openSettings() {
    hideAllModals();
    const settingsContent = document.getElementById('settingsContent');
    if (settingsContent) {
        settingsContent.style.display = 'flex';
        document.getElementById('modalOverlay').style.display = 'flex';
        const themeSelect = document.getElementById('themeSelect');
        if (themeSelect) themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    }
}

function logout() {
    hideAllModals();
    const logoutContent = document.getElementById('logoutContent');
    if (logoutContent) {
        logoutContent.style.display = 'block';
        document.getElementById('modalOverlay').style.display = 'flex';
    }
}

function showHomeConfirm() {
    hideAllModals();
    const homeContent = document.getElementById('homeContent');
    if (homeContent) {
        homeContent.style.display = 'block';
        document.getElementById('modalOverlay').style.display = 'flex';
    }
}

function hideAllModals() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
}

function closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.style.display = 'none';
    hideAllModals();
}

function confirmLogout() {
    closeModal();
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = '../login.html?from=logout';
    }, 600);
}

function confirmGoToMenu() {
    closeModal();
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = '../menu.html';
    }, 600);
}

function switchTab(event, tabId) {
    document.querySelectorAll('.settings-menu-item').forEach(item => item.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
    event.target.classList.add('active');
    const tab = document.getElementById(tabId);
    if (tab) tab.classList.add('active');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        if (modal && modal.style.display === 'flex') {
            closeModal();
        }
    }
});
