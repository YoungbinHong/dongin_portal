/* === 테마 관리 === */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('donginTheme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('donginTheme', 'light');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('donginTheme') || 'light';
    const themeSelect = document.getElementById('themeSelect');

    applyTheme(savedTheme);
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}