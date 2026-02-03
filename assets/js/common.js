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
