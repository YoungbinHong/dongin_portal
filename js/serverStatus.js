/* === 서버 연결 상태 관리 === */
function updateServerStatus() {
    serverConnected = true;

    const dot = document.getElementById('serverStatusDot');
    const container = document.getElementById('serverStatusContainer');
    const textEl = container?.querySelector('.server-status-text');
    const tooltip = document.getElementById('serverTooltip');

    if (dot && container) {
        if (serverConnected) {
            dot.classList.remove('disconnected');
            if (textEl) textEl.textContent = '연결됨';
            if (tooltip) tooltip.textContent = '서버와 연결되었습니다.';
        } else {
            dot.classList.add('disconnected');
            if (textEl) textEl.textContent = '연결 끊김';
            if (tooltip) tooltip.textContent = '서버 연결이 끊어졌습니다.';
        }
    }
}