async function setAppTitle() {
    try {
        const version = await window.api.getAppVersion();
        document.title = `DONGIN PORTAL v${version}`;
    } catch (error) {
        console.error('Failed to set app title:', error);
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('donginTheme') || 'light';
    applyTheme(savedTheme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('donginTheme', theme);
}

setAppTitle();
