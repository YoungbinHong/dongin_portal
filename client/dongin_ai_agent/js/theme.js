function loadSavedTheme() {
    const savedTheme = localStorage.getItem('donginTheme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
    localStorage.setItem('donginTheme', theme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = theme;
}

document.addEventListener('DOMContentLoaded', loadSavedTheme);
