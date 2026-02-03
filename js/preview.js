/* === 미리보기 기능 === */
function togglePreview() {
    const previewPane = document.getElementById('previewPane');
    const previewBtn = document.getElementById('previewToggleBtn');
    const previewResizer = document.getElementById('previewResizer');

    previewEnabled = !previewEnabled;

    if (previewEnabled) {
        previewPane.style.width = DEFAULT_PREVIEW_WIDTH + 'px';
        previewPane.classList.add('active');
        previewBtn.classList.add('active');
        previewResizer.classList.add('active');
        localStorage.setItem('preview-enabled', 'true');
        updatePreview();
    } else {
        previewPane.classList.remove('active');
        previewBtn.classList.remove('active');
        previewResizer.classList.remove('active');
        previewPane.style.width = '';
        localStorage.setItem('preview-enabled', 'false');
    }
}

function loadSavedPreviewState() {
    const saved = localStorage.getItem('preview-enabled');
    const previewPane = document.getElementById('previewPane');
    const previewBtn = document.getElementById('previewToggleBtn');
    const previewResizer = document.getElementById('previewResizer');

    if (saved === 'true') {
        previewEnabled = true;
        previewPane.style.width = DEFAULT_PREVIEW_WIDTH + 'px';
        previewPane.classList.add('active');
        previewBtn.classList.add('active');
        previewResizer.classList.add('active');
    }

    initPreviewResizer();
}

function initPreviewResizer() {
    const resizer = document.getElementById('previewResizer');
    const previewPane = document.getElementById('previewPane');
    const contentWrapper = document.getElementById('contentWrapper');

    if (!resizer || !previewPane || !contentWrapper) return;

    let isResizing = false;
    let startX = 0;
    let startWidth = 0;

    resizer.addEventListener('mousedown', (e) => {
        if (!previewEnabled) return;

        isResizing = true;
        startX = e.clientX;
        startWidth = previewPane.offsetWidth;

        resizer.classList.add('dragging');
        previewPane.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const deltaX = startX - e.clientX;
        let newWidth = startWidth + deltaX;

        const maxWidth = contentWrapper.offsetWidth / 2;
        newWidth = Math.max(MIN_PREVIEW_WIDTH, Math.min(newWidth, maxWidth));

        previewPane.style.width = newWidth + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;

        isResizing = false;
        resizer.classList.remove('dragging');
        previewPane.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    });
}

function isPreviewableImage(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return previewableImageExtensions.includes(ext);
}

function isPreviewablePdf(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    return previewablePdfExtensions.includes(ext);
}

function isPreviewable(fileName) {
    return isPreviewableImage(fileName) || isPreviewablePdf(fileName);
}

async function updatePreview() {
    if (!previewEnabled) return;

    const previewContent = document.getElementById('previewContent');
    if (!previewContent) return;

    let selectedFiles;
    if (viewMode === 'grid') {
        selectedFiles = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedFiles = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedFiles = document.querySelectorAll('.file-list-item.selected');
    }

    if (selectedFiles.length === 0) {
        showPreviewPlaceholder();
        return;
    }

    if (selectedFiles.length > 1) {
        showMultipleSelection(selectedFiles.length);
        return;
    }

    const selectedItem = selectedFiles[0];
    const filePath = selectedItem.dataset.path;
    const isDir = selectedItem.dataset.isDir === 'true';

    let fileName;
    if (selectedItem.classList.contains('file-card') || selectedItem.classList.contains('file-card-small')) {
        fileName = selectedItem.querySelector('div:last-child').innerText;
    } else {
        fileName = selectedItem.querySelector('.file-name span:last-child').innerText;
    }

    if (isDir) {
        showFolderPreview(fileName);
        return;
    }

    if (isPreviewableImage(fileName)) {
        showImagePreview(fileName, filePath);
        return;
    }

    if (isPreviewablePdf(fileName)) {
        showPdfPreview(fileName, filePath);
        return;
    }

    showFileInfo(fileName, filePath);
}

function showPreviewPlaceholder() {
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `
        <div class="preview-placeholder">
            <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-7-2h5v-5h-5v5z"/>
            </svg>
            <p>파일을 선택하면<br>미리 보기가 표시됩니다.</p>
            <p class="preview-supported">지원: 이미지, PDF</p>
        </div>
    `;
}

function showMultipleSelection(count) {
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `
        <div class="preview-placeholder">
            <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
            </svg>
            <p>${count}개 항목 선택됨</p>
        </div>
    `;
}

function showFolderPreview(folderName) {
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `
        <div class="preview-file-info">
            <div class="preview-file-icon">📁</div>
            <div class="preview-file-name">${folderName}</div>
            <div class="preview-file-details">폴더</div>
        </div>
    `;
}

async function showImagePreview(fileName, filePath) {
    const previewContent = document.getElementById('previewContent');

    previewContent.innerHTML = `
        <div class="preview-placeholder">
            <svg viewBox="0 0 24 24" width="48" height="48" class="loading-spinner">
                <path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
            </svg>
            <p>로딩 중...</p>
        </div>
    `;

    try {
        const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

        previewContent.innerHTML = `
            <img class="preview-image" src="${fileUrl}" alt="${fileName}"
                 onerror="showImageError('${fileName.replace(/'/g, "\\'")}')"/>
        `;
    } catch (err) {
        console.error('이미지 미리보기 오류:', err);
        showFileInfo(fileName, filePath);
    }
}

function showImageError(fileName) {
    const previewContent = document.getElementById('previewContent');
    previewContent.innerHTML = `
        <div class="preview-unsupported">
            <svg viewBox="0 0 24 24" width="48" height="48">
                <path fill="currentColor" d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
            </svg>
            <p>이미지를 불러올 수 없습니다.</p>
            <p style="font-size: 12px; margin-top: 5px; opacity: 0.7;">${fileName}</p>
        </div>
    `;
}

async function showPdfPreview(fileName, filePath) {
    const previewContent = document.getElementById('previewContent');

    try {
        const fileUrl = 'file:///' + filePath.replace(/\\/g, '/');

        previewContent.innerHTML = `
            <iframe class="preview-pdf" src="${fileUrl}" title="${fileName}"></iframe>
        `;
    } catch (err) {
        console.error('PDF 미리보기 오류:', err);
        showFileInfo(fileName, filePath);
    }
}

async function showFileInfo(fileName, filePath) {
    const previewContent = document.getElementById('previewContent');

    let fileInfo = null;
    for (const file of originalFiles) {
        if (file.fullPath === filePath) {
            fileInfo = file;
            break;
        }
    }

    let icon = '📄';
    if (fileName.endsWith('.dongin')) icon = '🔒';
    else if (fileName.endsWith('.txt')) icon = '📝';
    else if (fileName.endsWith('.doc') || fileName.endsWith('.docx')) icon = '📘';
    else if (fileName.endsWith('.xls') || fileName.endsWith('.xlsx')) icon = '📗';
    else if (fileName.endsWith('.ppt') || fileName.endsWith('.pptx')) icon = '📙';
    else if (fileName.endsWith('.zip') || fileName.endsWith('.rar')) icon = '📦';
    else if (fileName.endsWith('.mp3') || fileName.endsWith('.wav')) icon = '🎵';
    else if (fileName.endsWith('.mp4') || fileName.endsWith('.avi')) icon = '🎬';
    else if (fileName.endsWith('.exe')) icon = '⚙️';

    const fileType = getFileType(fileName, false);
    const fileSize = fileInfo ? formatFileSize(fileInfo.size) : '-';
    const modifiedDate = fileInfo ? formatDate(fileInfo.modifiedTime) : '-';

    previewContent.innerHTML = `
        <div class="preview-file-info">
            <div class="preview-file-icon">${icon}</div>
            <div class="preview-file-name">${fileName}</div>
            <div class="preview-file-details">
                유형: ${fileType}<br>
                크기: ${fileSize}<br>
                수정한 날짜: ${modifiedDate}
            </div>
        </div>
    `;
}