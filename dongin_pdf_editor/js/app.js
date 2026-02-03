let currentTool = 'compress';
let selectedFiles = [];

const toolConfig = {
    compress: {
        title: 'PDF 압축',
        desc: 'PDF 파일 용량을 줄여 저장 공간을 절약하세요',
        btnText: 'PDF 압축하기',
        multiFile: false
    },
    split: {
        title: 'PDF 분할',
        desc: '하나의 PDF를 여러 개의 파일로 나눕니다',
        btnText: 'PDF 분할하기',
        multiFile: false
    },
    merge: {
        title: 'PDF 병합',
        desc: '여러 PDF 파일을 하나로 합칩니다',
        btnText: 'PDF 병합하기',
        multiFile: true
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('donginTheme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
    }

    setTimeout(() => {
        document.querySelector('.sidebar').classList.add('show');
        document.querySelector('.main-container').classList.add('show');
    }, 100);

    setupDropZone();
    setupOptionCards();
    setupSplitModeToggle();
    setupFileDragSort();
});

function selectTool(tool) {
    if (tool === 'unlock') return;

    currentTool = tool;
    selectedFiles = [];

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    const config = toolConfig[tool];
    document.getElementById('toolTitle').textContent = config.title;
    document.getElementById('toolDesc').textContent = config.desc;
    document.getElementById('executeBtnText').textContent = config.btnText;

    if (config.multiFile) {
        document.getElementById('fileInput').setAttribute('multiple', '');
    } else {
        document.getElementById('fileInput').removeAttribute('multiple');
    }

    document.getElementById('dropZone').style.display = 'flex';
    document.getElementById('fileListContainer').style.display = 'none';
    document.getElementById('optionsPanel').style.display = 'none';
    document.getElementById('executeBtn').style.display = 'none';

    document.querySelectorAll('.tool-options').forEach(opt => {
        opt.style.display = 'none';
    });

    const optionsEl = document.getElementById(`${tool}Options`);
    if (optionsEl) {
        optionsEl.style.display = 'block';
    }

    updateFileList();
}

function setupDropZone() {
    const dropZone = document.getElementById('dropZone');

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.add('dragover');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => {
            dropZone.classList.remove('dragover');
        }, false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = [...dt.files].filter(f => f.type === 'application/pdf');
        handleFiles(files);
    }, false);

    dropZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') {
            document.getElementById('fileInput').click();
        }
    });
}

function handleFileSelect(event) {
    const files = [...event.target.files].filter(f => f.type === 'application/pdf');
    handleFiles(files);
    event.target.value = '';
}

function handleFiles(files) {
    if (files.length === 0) {
        showAlert('알림', 'PDF 파일만 업로드할 수 있습니다.');
        return;
    }

    const config = toolConfig[currentTool];

    if (config.multiFile) {
        selectedFiles = [...selectedFiles, ...files];
    } else {
        selectedFiles = [files[0]];
    }

    updateFileList();
}

function updateFileList() {
    const fileListContainer = document.getElementById('fileListContainer');
    const fileList = document.getElementById('fileList');
    const dropZone = document.getElementById('dropZone');
    const optionsPanel = document.getElementById('optionsPanel');
    const executeBtn = document.getElementById('executeBtn');

    if (selectedFiles.length === 0) {
        dropZone.style.display = 'flex';
        fileListContainer.style.display = 'none';
        optionsPanel.style.display = 'none';
        executeBtn.style.display = 'none';
        return;
    }

    dropZone.style.display = 'none';
    fileListContainer.style.display = 'block';
    optionsPanel.style.display = 'block';
    executeBtn.style.display = 'block';

    document.getElementById('fileCount').textContent = `${selectedFiles.length}개의 파일`;

    fileList.innerHTML = selectedFiles.map((file, index) => `
        <div class="file-item" draggable="${currentTool === 'merge'}" data-index="${index}">
            <div class="file-item-icon">
                <svg viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>
            </div>
            <div class="file-item-info">
                <div class="file-item-name">${file.name}</div>
                <div class="file-item-size">${formatFileSize(file.size)}</div>
            </div>
            <div class="file-item-remove" onclick="removeFile(${index})">
                <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
            </div>
        </div>
    `).join('');

    if (currentTool === 'merge') {
        setupFileDragSort();
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateFileList();
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function setupOptionCards() {
    document.querySelectorAll('.option-card').forEach(card => {
        card.addEventListener('click', () => {
            const group = card.closest('.option-group');
            group.querySelectorAll('.option-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            card.querySelector('input').checked = true;
        });
    });
}

function setupSplitModeToggle() {
    document.querySelectorAll('input[name="splitMode"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const rangeGroup = document.getElementById('rangeInputGroup');
            rangeGroup.style.display = e.target.value === 'range' ? 'block' : 'none';
        });
    });
}

function setupFileDragSort() {
    const fileList = document.getElementById('fileList');
    let draggedItem = null;

    fileList.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('dragstart', (e) => {
            draggedItem = item;
            setTimeout(() => item.classList.add('dragging'), 0);
        });

        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            draggedItem = null;
            updateFileOrder();
        });

        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (draggedItem && draggedItem !== item) {
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    item.parentNode.insertBefore(draggedItem, item);
                } else {
                    item.parentNode.insertBefore(draggedItem, item.nextSibling);
                }
            }
        });
    });
}

function updateFileOrder() {
    const newOrder = [];
    document.querySelectorAll('.file-item').forEach(item => {
        const index = parseInt(item.dataset.index);
        newOrder.push(selectedFiles[index]);
    });
    selectedFiles = newOrder;
    updateFileList();
}

function executeTask() {
    if (selectedFiles.length === 0) {
        showAlert('알림', '파일을 먼저 선택해주세요.');
        return;
    }

    showProgress();

    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            setTimeout(() => {
                closeModal();
                showComplete();
            }, 500);
        }
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressPercent').textContent = Math.floor(progress);
    }, 200);
}

function showProgress() {
    const config = toolConfig[currentTool];
    document.getElementById('progressTitle').textContent = config.title + ' 중...';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0';

    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('progressContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function showComplete() {
    const messages = {
        compress: `${selectedFiles.length}개의 PDF 파일이 압축되었습니다.`,
        split: 'PDF 파일이 분할되었습니다.',
        merge: `${selectedFiles.length}개의 PDF 파일이 병합되었습니다.`
    };

    document.getElementById('completeMsg').textContent = messages[currentTool];
    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('completeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function downloadResult() {
    closeModal();
    showAlert('알림', '다운로드 기능은 백엔드 연동 후 사용 가능합니다.');
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertBody').textContent = message;
    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('alertContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
}

function logout() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('logoutContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmLogout() {
    closeModal();
    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = '../login.html?from=logout';
    }, 600);
}

function goToMenu() {
    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = '../menu.html';
    }, 400);
}

function openSettings() {
    const modal = document.getElementById('modalOverlay');
    const settingsContent = document.getElementById('settingsContent');
    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');
    modal.style.display = 'flex';
    settingsContent.style.display = 'flex';
    loadSettingsState();
}

function switchTab(event, tabName) {
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.settings-menu-item').forEach(item => item.classList.remove('active'));
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) selectedTab.classList.add('active');
    event.currentTarget.classList.add('active');
}

function applyTheme(theme) {
    localStorage.setItem('donginTheme', theme);
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
    } else {
        document.body.classList.remove('dark-theme');
    }
}

function loadSettingsState() {
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    }
    checkAutoStartStatus();
}

async function checkAutoStartStatus() {
    const checkbox = document.getElementById('autoStartCheckbox');
    if (!checkbox || !window.api) return;
    const isEnabled = await window.api.checkAutoStart();
    checkbox.checked = isEnabled;
}

async function toggleAutoStart(enabled) {
    if (!window.api) return;
    const result = await window.api.setAutoStart(enabled);
    if (!result.success) {
        showAlert('오류', '자동 실행 설정에 실패했습니다.');
        document.getElementById('autoStartCheckbox').checked = !enabled;
    }
}
