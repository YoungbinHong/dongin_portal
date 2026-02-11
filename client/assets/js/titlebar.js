function initTitleBar() {
    if (document.querySelector('.titlebar')) {
        return;
    }

    const pathname = window.location.pathname;
    const isSubdir = /\/client\/dongin_[^\/]+\//.test(pathname);
    const logoPath = isSubdir ? '../assets/images/logo.png' : 'assets/images/logo.png';
    console.log('Titlebar - pathname:', pathname, 'isSubdir:', isSubdir, 'logoPath:', logoPath);

    const titlebar = document.createElement('div');
    titlebar.className = 'titlebar';
    titlebar.innerHTML = `
        <div class="titlebar-left">
            <div class="titlebar-logo">
                <img src="${logoPath}" alt="Logo">
                <span>DONGIN PORTAL v0.1.1</span>
            </div>
            <div class="titlebar-title" id="titlebarTitle"></div>
        </div>
        <div class="titlebar-controls">
            <button class="titlebar-button minimize" id="btnMinimize" title="최소화">
                <svg viewBox="0 0 12 12">
                    <rect x="1" y="5.5" width="10" height="1"/>
                </svg>
            </button>
            <button class="titlebar-button maximize" id="btnMaximize" title="최대화">
                <svg viewBox="0 0 12 12">
                    <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none"/>
                </svg>
            </button>
            <button class="titlebar-button close" id="btnClose" title="닫기">
                <svg viewBox="0 0 12 12">
                    <path d="M2 2 L10 10 M10 2 L2 10" stroke="currentColor" stroke-width="1"/>
                </svg>
            </button>
        </div>
    `;

    document.body.insertBefore(titlebar, document.body.firstChild);

    document.getElementById('btnMinimize').addEventListener('click', () => {
        if (window.api && window.api.windowMinimize) {
            window.api.windowMinimize();
        }
    });

    document.getElementById('btnMaximize').addEventListener('click', async () => {
        if (window.api && window.api.windowMaximize) {
            window.api.windowMaximize();
            updateMaximizeButton();
        }
    });

    document.getElementById('btnClose').addEventListener('click', () => {
        if (window.api && window.api.windowClose) {
            window.api.windowClose();
        }
    });

    updateMaximizeButton();
}

async function updateMaximizeButton() {
    if (!window.api || !window.api.windowIsMaximized) return;

    const isMaximized = await window.api.windowIsMaximized();
    const btn = document.getElementById('btnMaximize');

    if (isMaximized) {
        btn.innerHTML = `
            <svg viewBox="0 0 12 12">
                <rect x="3" y="1.5" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/>
                <rect x="1.5" y="3" width="7" height="7" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
        `;
        btn.title = '원래 크기로';
    } else {
        btn.innerHTML = `
            <svg viewBox="0 0 12 12">
                <rect x="1.5" y="1.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none"/>
            </svg>
        `;
        btn.title = '최대화';
    }
}

function setTitleBarTitle(title) {
    const titleElement = document.getElementById('titlebarTitle');
    if (titleElement) {
        titleElement.textContent = title;
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTitleBar);
} else {
    initTitleBar();
}
