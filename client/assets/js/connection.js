(function () {
    const API_BASE = 'http://localhost:8000';
    const HEALTH_URL = API_BASE + '/health';
    const HEARTBEAT_URL = API_BASE + '/api/heartbeat';
    const CHECK_INTERVAL = 5000;
    const MAX_FAIL_TIME = 20000;
    const FETCH_TIMEOUT = 4000;

    const path = location.pathname.replace(/\\/g, '/');
    const IS_LOGIN_PAGE = path.endsWith('login.html');

    let failStartTime = null;
    let alreadyRedirecting = false;
    let loginServerDown = false;
    let loginNextCheck = 0;

    (function injectStyles() {
        if (document.querySelector('#connectionModalStyles')) return;
        var style = document.createElement('style');
        style.id = 'connectionModalStyles';
        style.textContent =
            '.connection-modal-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;z-index:99999}' +
            '.connection-modal{background:rgba(255,255,255,0.95);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-radius:20px;padding:40px 50px;display:flex;flex-direction:column;align-items:center;gap:20px;box-shadow:0 20px 60px rgba(0,0,0,0.15);border:1px solid rgba(255,255,255,0.3)}' +
            '.connection-spinner{width:40px;height:40px;border:3px solid rgba(162,155,254,0.2);border-top-color:#a29bfe;border-radius:50%;animation:connection-spin 0.8s linear infinite}' +
            '.connection-modal-text{font-size:15px;font-weight:600;color:#2d3436}' +
            '@keyframes connection-spin{to{transform:rotate(360deg)}}' +
            'body.dark-theme .connection-modal{background:rgba(40,40,60,0.95);border-color:rgba(255,255,255,0.1)}' +
            'body.dark-theme .connection-modal-text{color:#e0e0e0}' +
            '.server-status-dot.disconnected{background:#ff6b6b!important;box-shadow:0 0 8px rgba(255,107,107,0.6)!important;animation:none!important}';
        document.head.appendChild(style);
    })();

    function getToken() {
        return localStorage.getItem('access_token');
    }

    function getLoginPath() {
        if (IS_LOGIN_PAGE) return null;
        if (path.includes('/dongin_')) {
            const parts = path.split('/');
            const idx = parts.findIndex(p => p.startsWith('dongin_'));
            if (idx >= 0) {
                return parts.slice(0, idx).join('/') + '/login.html';
            }
        }
        return 'login.html';
    }

    function updateStatusIcon(connected) {
        const dot = document.querySelector('.server-status-dot');
        const text = document.querySelector('.server-status-text');
        const tooltip = document.querySelector('.server-tooltip');
        if (!dot) return;

        if (connected) {
            dot.classList.remove('disconnected');
            dot.style.background = '';
            dot.style.boxShadow = '';
            if (text) text.textContent = '연결됨';
            if (tooltip) tooltip.textContent = '서버와 연결되었습니다.';
        } else {
            dot.classList.add('disconnected');
            dot.style.background = '#ff6b6b';
            dot.style.boxShadow = '0 0 8px rgba(255,107,107,0.6)';
            if (text) text.textContent = '연결 끊김';
            if (tooltip) tooltip.textContent = '서버 연결이 끊어졌습니다.';
        }
    }

    function showConnectionModal(message) {
        const modal = document.getElementById('connectionModal');
        if (!modal) return;
        const msgEl = modal.querySelector('.connection-modal-text');
        if (msgEl) msgEl.textContent = message;
        modal.style.display = 'flex';

        if (IS_LOGIN_PAGE) {
            const btn = document.querySelector('.login-form button');
            if (btn) {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
            }
        }
    }

    function hideConnectionModal() {
        const modal = document.getElementById('connectionModal');
        if (!modal) return;
        modal.style.display = 'none';

        if (IS_LOGIN_PAGE && !loginServerDown) {
            const btn = document.querySelector('.login-form button');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        }
    }

    function forceLogout() {
        if (alreadyRedirecting) return;
        alreadyRedirecting = true;
        localStorage.removeItem('access_token');
        localStorage.setItem('fromLogout', '1');
        setTimeout(function () {
            if (window.api && window.api.goToLogin) {
                window.api.goToLogin();
            } else {
                var loginPath = getLoginPath();
                if (loginPath) window.location.href = loginPath;
            }
        }, 800);
    }

    async function onConnected() {
        failStartTime = null;

        if (IS_LOGIN_PAGE && loginServerDown) {
            loginServerDown = false;
            var btn = document.querySelector('.login-form button');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '';
                btn.style.pointerEvents = '';
            }
        }

        if (!IS_LOGIN_PAGE) {
            var token = getToken();
            if (token) {
                try {
                    var res = await fetch(API_BASE + '/api/users/me', {
                        headers: { 'Authorization': 'Bearer ' + token }
                    });
                    if (!res.ok) {
                        forceLogout();
                        return;
                    }
                } catch (e) {
                    return;
                }
            }
        }

        updateStatusIcon(true);
        hideConnectionModal();
    }

    function onDisconnected() {
        updateStatusIcon(false);

        if (!failStartTime) {
            failStartTime = Date.now();
            showConnectionModal('서버에 다시 접속중...');
        } else if (Date.now() - failStartTime >= MAX_FAIL_TIME) {
            if (IS_LOGIN_PAGE) {
                if (!loginServerDown) {
                    loginServerDown = true;
                    var modal = document.getElementById('connectionModal');
                    if (modal) modal.style.display = 'none';
                }
                loginNextCheck = Date.now() + 30000;
            } else {
                showConnectionModal('서버와의 연결이 끊어졌습니다.');
            }
        }
    }

    async function checkConnection() {
        if (alreadyRedirecting) return;
        if (IS_LOGIN_PAGE && loginServerDown && Date.now() < loginNextCheck) return;
        try {
            var controller = new AbortController();
            var timeoutId = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT);
            var res = await fetch(HEALTH_URL, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) throw new Error();

            var token = getToken();
            if (token && !IS_LOGIN_PAGE) {
                fetch(HEARTBEAT_URL, {
                    method: 'POST',
                    headers: { 'Authorization': 'Bearer ' + token }
                }).catch(function () {});
            }

            onConnected();
        } catch (e) {
            onDisconnected();
        }
    }

    document.addEventListener('DOMContentLoaded', function () {
        checkConnection();
        setInterval(checkConnection, CHECK_INTERVAL);
    });
})();
