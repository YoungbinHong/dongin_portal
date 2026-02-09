document.addEventListener('DOMContentLoaded', async () => {
    console.log("프로그램 시작됨");

    const sidebar = document.querySelector('.sidebar');
    const mainContainer = document.querySelector('.main-container');

    requestAnimationFrame(() => {
        if (sidebar) sidebar.classList.add('show');
        if (mainContainer) mainContainer.classList.add('show');
    });

    homePath = await window.api.getHomePath();
    pathSep = await window.api.getPathSep();
    currentPath = await window.api.joinPath(homePath, 'Desktop');

    loadSavedTheme();
    loadSavedViewMode();
    loadSavedPreviewState();
    loadNoticeSettings();
    loadAutoLogoutSetting();
    await initSidebar();
    updateBreadcrumb();
    loadRealFiles(currentPath);
    initAutoLogout();
    initDragSelection();

    checkAutoStartStatus();
});