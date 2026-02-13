const API_BASE = 'http://192.168.0.254:8000';

let currentDocType = 'employment';

const docTypeNames = {
    employment: '재직증명서',
    career: '경력증명서',
    salary: '급여명세서',
    income: '소득증명서'
};

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('show');
        document.querySelector('.main-container').classList.add('show');
    }, 100);
    initDocTypes();
    initFormActions();
});

function initDocTypes() {
    const docTypeItems = document.querySelectorAll('.doc-type-item');
    docTypeItems.forEach(item => {
        item.addEventListener('click', () => {
            const docType = item.dataset.type;
            selectDocType(docType);
        });
    });
}

function selectDocType(docType) {
    currentDocType = docType;

    document.querySelectorAll('.doc-type-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedDocType = document.querySelector(`.doc-type-item[data-type="${docType}"]`);
    if (selectedDocType) {
        selectedDocType.classList.add('active');

        const docTypeName = docTypeNames[docType] || '서류';
        document.querySelector('.header-title').textContent = docTypeName + ' 발급';
        document.querySelector('.preview-doc h2').textContent = docTypeName;
    }
}

function initFormActions() {
    const previewBtn = document.querySelector('.preview-btn');
    const submitBtn = document.querySelector('.submit-btn');

    if (previewBtn) {
        previewBtn.addEventListener('click', () => {
            alert('미리보기 기능은 준비중입니다.');
        });
    }

    if (submitBtn) {
        submitBtn.addEventListener('click', () => {
            alert('발급 신청 기능은 준비중입니다.');
        });
    }
}

function showHistory() {
    alert('발급 내역 기능은 준비중입니다.');
}

function showHomeConfirm() {
    hideAllModals();
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = '../menu.html?from=cert';
        }, 400);
    } else {
        window.location.href = '../menu.html?from=cert';
    }
}

function hideAllModals() {
    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');
}

function closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.style.display = 'none';
    hideAllModals();
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('active');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSettings();
    }
});
