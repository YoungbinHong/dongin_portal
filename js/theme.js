/* === 테마 관리 === */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('app-theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('app-theme', 'light');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const themeSelect = document.getElementById('themeSelect');

    applyTheme(savedTheme);
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}