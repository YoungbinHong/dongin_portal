/* === 초기화 === */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("프로그램 시작됨");

    // 초기화: 홈 경로와 경로 구분자 가져오기
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

    // 서버 상태 업데이트
    updateServerStatus();
    setInterval(updateServerStatus, 1000);
    checkAutoStartStatus();
});