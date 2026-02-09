import * as pdfjsLib from '../../node_modules/pdfjs-dist/build/pdf.mjs';
import { PDFDocument } from '../../node_modules/pdf-lib/dist/pdf-lib.esm.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;

let currentTool = 'compress';
let selectedFiles = [];
let previewDebounceTimer = null;

let compressPdfDoc = null;
let compressCurrentPage = 1;
let compressTotalPages = 0;
let compressArrayBuffer = null;
let compressBaseScale = 1;
let compressZoomLevel = 1;
let isRenderingCompress = false;
let progressInterval = null;

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
    },
    unlock: {
        title: '비밀번호 해제',
        desc: '암호화된 PDF의 비밀번호를 해제합니다 (6자리까지)',
        btnText: '비밀번호 해제',
        multiFile: false
    }
};

window.selectTool = selectTool;
window.handleFileSelect = handleFileSelect;
window.removeFile = removeFile;
window.removeCompressFile = removeCompressFile;
window.executeTask = executeTask;
window.showHomeConfirm = showHomeConfirm;
window.openSettings = openSettings;
window.logout = logout;
window.confirmLogout = confirmLogout;
window.confirmGoToMenu = confirmGoToMenu;
window.closeModal = closeModal;
window.downloadResult = downloadResult;
window.switchTab = switchTab;
window.applyTheme = applyTheme;
window.toggleAutoStart = toggleAutoStart;
window.compressPrevPage = compressPrevPage;
window.compressNextPage = compressNextPage;
window.dismissZoomTip = dismissZoomTip;

document.addEventListener('DOMContentLoaded', async () => {
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
    setupCompressSlider();

    const previewArea = document.getElementById('compressPreviewArea');
    previewArea.addEventListener('wheel', (e) => {
        if (!e.ctrlKey || !compressPdfDoc) return;
        e.preventDefault();
        applyCompressZoom(e.deltaY < 0 ? 0.2 : -0.2);
    }, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (!compressPdfDoc) return;
        if (document.querySelector('.modal-overlay[style*="flex"]')) return;
        if (e.key === '+' || e.key === '=') { e.preventDefault(); applyCompressZoom(0.2); }
        if (e.key === '-' || e.key === '_') { e.preventDefault(); applyCompressZoom(-0.2); }
    });
});

function selectTool(tool) {
    currentTool = tool;
    selectedFiles = [];
    resetCompressState();

    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

    const config = toolConfig[tool];
    document.getElementById('toolTitle').textContent = config.title;
    document.getElementById('toolDesc').textContent = config.desc;

    if (config.multiFile) {
        document.getElementById('fileInput').setAttribute('multiple', '');
    } else {
        document.getElementById('fileInput').removeAttribute('multiple');
    }

    document.getElementById('dropZone').style.display = 'flex';
    document.getElementById('fileListContainer').style.display = 'none';
    document.getElementById('optionsPanel').style.display = 'none';
    document.getElementById('executeBtn').style.display = 'none';
    document.getElementById('compressWorkspace').style.display = 'none';

    document.querySelectorAll('.tool-options').forEach(opt => {
        opt.style.display = 'none';
    });

    const optionsEl = document.getElementById(`${tool}Options`);
    if (optionsEl) {
        optionsEl.style.display = 'block';
    }

    if (tool !== 'compress') {
        updateFileList();
    }
}

function resetCompressState() {
    compressPdfDoc = null;
    compressCurrentPage = 1;
    compressTotalPages = 0;
    compressArrayBuffer = null;
    compressBaseScale = 1;
    compressZoomLevel = 1;
    isRenderingCompress = false;
    document.getElementById('compressWarning').classList.remove('show');
    const canvas = document.getElementById('compressPreviewCanvas');
    if (canvas) {
        canvas.style.transform = '';
        canvas.style.width = '';
        canvas.style.height = '';
        canvas.style.margin = '';
    }
}

function applyCompressZoom(delta) {
    compressZoomLevel = Math.min(5, Math.max(1, compressZoomLevel + delta));
    const canvas = document.getElementById('compressPreviewCanvas');
    canvas.style.transform = `scale(${compressZoomLevel})`;

    if (compressZoomLevel === 1) {
        canvas.style.margin = '';
    } else {
        const currentWidth = parseFloat(canvas.style.width);
        const currentHeight = parseFloat(canvas.style.height);
        const extraWidth = (currentWidth * (compressZoomLevel - 1)) / 2;
        const extraHeight = (currentHeight * (compressZoomLevel - 1)) / 2;
        canvas.style.margin = `${extraHeight}px ${extraWidth}px`;

        const container = canvas.parentElement;
        setTimeout(() => {
            container.scrollTo({
                top: (container.scrollHeight - container.clientHeight) / 2,
                left: (container.scrollWidth - container.clientWidth) / 2,
                behavior: 'smooth'
            });
        }, 50);
    }
}

function dismissZoomTip() {
    document.getElementById('zoomTip').style.display = 'none';
    localStorage.setItem('donginZoomTipDismissed', '1');
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

    if (currentTool === 'compress' && selectedFiles.length > 0) {
        showCompressWorkspace();
    } else {
        updateFileList();
    }
}

function showCompressWorkspace() {
    const file = selectedFiles[0];
    document.getElementById('dropZone').style.display = 'none';
    document.getElementById('fileListContainer').style.display = 'none';
    document.getElementById('optionsPanel').style.display = 'none';
    document.getElementById('executeBtn').style.display = 'none';
    document.getElementById('compressWorkspace').style.display = 'flex';

    document.getElementById('compressFileName').textContent = file.name;
    document.getElementById('compressFileSize').textContent = formatFileSize(file.size);

    const slider = document.getElementById('compressSlider');
    slider.value = 80;
    document.getElementById('compressQualityValue').textContent = '80%';
    document.getElementById('compressWarning').classList.remove('show');
    document.getElementById('compressEstSize').textContent = '-';
    document.getElementById('compressSaveRate').textContent = '-';

    compressBaseScale = 1;
    compressZoomLevel = 1;
    const canvas = document.getElementById('compressPreviewCanvas');
    canvas.style.transform = '';
    canvas.style.width = '';
    canvas.style.height = '';
    canvas.style.margin = '';

    if (!localStorage.getItem('donginZoomTipDismissed')) {
        document.getElementById('zoomTip').style.display = 'flex';
    }

    loadCompressPdf(file);
}

function removeCompressFile() {
    selectedFiles = [];
    resetCompressState();
    document.getElementById('compressWorkspace').style.display = 'none';
    document.getElementById('dropZone').style.display = 'flex';
}

async function loadCompressPdf(file) {
    const loading = document.getElementById('compressPreviewLoading');
    loading.style.display = 'flex';

    try {
        compressArrayBuffer = await file.arrayBuffer();
        compressPdfDoc = await pdfjsLib.getDocument({ data: compressArrayBuffer.slice(0) }).promise;
        compressTotalPages = compressPdfDoc.numPages;
        compressCurrentPage = 1;
        document.getElementById('compressPageInfo').textContent = `1 / ${compressTotalPages}`;
        await new Promise(r => requestAnimationFrame(r));
        await renderCompressPreview();
    } catch (e) {
        console.error('PDF load error:', e);
        loading.style.display = 'none';
        showAlert('PDF 로드 오류', e.message || String(e));
    }
}

async function renderCompressPreview() {
    if (!compressPdfDoc || isRenderingCompress) return;

    isRenderingCompress = true;
    const loading = document.getElementById('compressPreviewLoading');
    loading.style.display = 'flex';

    try {
        const page = await compressPdfDoc.getPage(compressCurrentPage);
        const canvas = document.getElementById('compressPreviewCanvas');
        const ctx = canvas.getContext('2d');

        const slider = document.getElementById('compressSlider');
        const quality = 0.65 + (parseInt(slider.value) / 100) * 0.27;
        const actualScale = 0.7 + (quality - 0.65) * 4.8;

        const viewport = page.getViewport({ scale: actualScale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!jpegBlob) {
            loading.style.display = 'none';
            return;
        }

        await new Promise((resolve) => {
            const jpegUrl = URL.createObjectURL(jpegBlob);
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(jpegUrl);
                resolve();
            };
            img.onerror = () => {
                URL.revokeObjectURL(jpegUrl);
                resolve();
            };
            img.src = jpegUrl;
        });

        const containerWidth = Math.max(canvas.parentElement.clientWidth - 20, 200);
        const containerHeight = Math.max(canvas.parentElement.clientHeight - 20, 200);
        const scaleW = containerWidth / canvas.width;
        const scaleH = containerHeight / canvas.height;
        const displayScale = Math.min(scaleW, scaleH, 2.0);

        const baseWidth = canvas.width * displayScale;
        const baseHeight = canvas.height * displayScale;
        canvas.style.width = baseWidth + 'px';
        canvas.style.height = baseHeight + 'px';
        canvas.style.transformOrigin = 'center';
        canvas.style.transform = `scale(${compressZoomLevel})`;

        if (compressZoomLevel === 1) {
            canvas.style.margin = '';
        } else {
            const extraWidth = (baseWidth * (compressZoomLevel - 1)) / 2;
            const extraHeight = (baseHeight * (compressZoomLevel - 1)) / 2;
            canvas.style.margin = `${extraHeight}px ${extraWidth}px`;

            const container = canvas.parentElement;
            setTimeout(() => {
                container.scrollTo({
                    top: (container.scrollHeight - container.clientHeight) / 2,
                    left: (container.scrollWidth - container.clientWidth) / 2,
                    behavior: 'smooth'
                });
            }, 50);
        }

        const file = selectedFiles[0];
        const estimatedSinglePage = jpegBlob.size;
        const estimatedTotal = estimatedSinglePage * compressTotalPages;
        document.getElementById('compressEstSize').textContent = formatFileSize(estimatedTotal);

        if (file.size > 0) {
            const diff = estimatedTotal - file.size;
            if (diff > 0) {
                const increaseRate = ((diff / file.size) * 100).toFixed(1);
                document.getElementById('compressSaveRate').textContent = increaseRate + '% 증가';
            } else {
                const saveRate = ((1 - estimatedTotal / file.size) * 100).toFixed(1);
                document.getElementById('compressSaveRate').textContent = saveRate + '% 절감';
            }
        }
    } catch (e) {
        console.error('Preview render error:', e);
        showAlert('미리보기 오류', e.message || String(e));
    } finally {
        loading.style.display = 'none';
        isRenderingCompress = false;
    }
}

function compressPrevPage() {
    if (compressCurrentPage <= 1) return;
    compressCurrentPage--;
    document.getElementById('compressPageInfo').textContent = `${compressCurrentPage} / ${compressTotalPages}`;
    renderCompressPreview();
}

function compressNextPage() {
    if (compressCurrentPage >= compressTotalPages) return;
    compressCurrentPage++;
    document.getElementById('compressPageInfo').textContent = `${compressCurrentPage} / ${compressTotalPages}`;
    renderCompressPreview();
}

function setupCompressSlider() {
    const slider = document.getElementById('compressSlider');
    const qualityValue = document.getElementById('compressQualityValue');
    const warning = document.getElementById('compressWarning');

    slider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value);
        qualityValue.textContent = val + '%';

        if (val <= 30) {
            warning.classList.add('show');
        } else {
            warning.classList.remove('show');
        }

        if (previewDebounceTimer) clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(() => {
            if (selectedFiles.length > 0 && currentTool === 'compress' && compressPdfDoc) {
                renderCompressPreview();
            }
        }, 300);
    });
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
    document.getElementById('executeBtnText').textContent = toolConfig[currentTool].btnText;

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

async function compressPdfToImages(pdfArrayBuffer, jpegQuality) {
    const pdf = await pdfjsLib.getDocument({ data: pdfArrayBuffer }).promise;
    const newPdf = await PDFDocument.create();
    const scale = 0.7 + (jpegQuality - 0.65) * 4.8;
    console.log('Compress - jpegQuality:', jpegQuality, 'scale:', scale);

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');

        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
        const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
        const jpegImage = await newPdf.embedJpg(jpegBytes);

        const newPage = newPdf.addPage([viewport.width, viewport.height]);
        newPage.drawImage(jpegImage, { x: 0, y: 0, width: viewport.width, height: viewport.height });
    }

    return await newPdf.save();
}

async function executeTask() {
    if (selectedFiles.length === 0) {
        showAlert('알림', '파일을 먼저 선택해주세요.');
        return;
    }

    try {
        if (currentTool === 'compress') {
            await executeCompress();
        } else if (currentTool === 'split') {
            await executeSplit();
        } else if (currentTool === 'merge') {
            await executeMerge();
        } else if (currentTool === 'unlock') {
            await executeUnlock();
        }
    } catch (e) {
        closeModal();
        showAlert('오류', e.message);
    }
}

async function executeCompress() {
    const file = selectedFiles[0];
    const slider = document.getElementById('compressSlider');
    const jpegQuality = 0.65 + (parseInt(slider.value) / 100) * 0.27;

    const { filePath, canceled } = await window.api.showSaveDialog({
        defaultPath: file.name.replace('.pdf', '_compressed.pdf'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (canceled) return;

    showProgress();

    try {
        const arrayBuffer = compressArrayBuffer ? compressArrayBuffer.slice(0) : await file.arrayBuffer();
        const compressedBytes = await compressPdfToImages(arrayBuffer, jpegQuality);

        let binaryString = '';
        const chunkSize = 8192;
        for (let i = 0; i < compressedBytes.length; i += chunkSize) {
            const chunk = compressedBytes.slice(i, i + chunkSize);
            binaryString += String.fromCharCode(...chunk);
        }
        const base64 = btoa(binaryString);
        const result = await window.api.saveCompressedPdf(filePath, base64);
        await completeProgress();

        if (result.success) {
            showAlert('완료', '압축 완료');
        } else {
            showAlert('오류', result.error);
        }
    } catch (e) {
        await completeProgress();
        showAlert('오류', e.message);
    }
}

async function executeSplit() {
    const file = selectedFiles[0];
    const mode = document.querySelector('input[name="splitMode"]:checked').value;

    const { filePaths, canceled } = await window.api.showOpenDialog({
        properties: ['openDirectory'],
        title: '분할된 파일을 저장할 폴더 선택'
    });

    if (canceled || !filePaths || filePaths.length === 0) return;

    showProgress();

    try {
        let result;
        if (mode === 'each') {
            result = await window.api.splitPdfEach(file.path, filePaths[0]);
        } else {
            const rangeStr = document.getElementById('pageRange').value;
            if (!rangeStr.trim()) {
                closeModal();
                showAlert('알림', '페이지 범위를 입력해주세요.');
                return;
            }
            const ranges = parsePageRanges(rangeStr);
            result = await window.api.splitPdf(file.path, filePaths[0], ranges);
        }

        closeModal();
        showAlert('완료', `${result.files.length}개의 파일로 분할되었습니다.`);
    } catch (e) {
        closeModal();
        showAlert('오류', e.message);
    }
}

async function executeMerge() {
    const paths = selectedFiles.map(f => f.path);

    const { filePath, canceled } = await window.api.showSaveDialog({
        defaultPath: 'merged.pdf',
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (canceled) return;

    showProgress();

    try {
        await window.api.mergePdfs(paths, filePath);
        closeModal();
        showAlert('완료', `${selectedFiles.length}개의 PDF가 병합되었습니다.`);
    } catch (e) {
        closeModal();
        showAlert('오류', e.message);
    }
}

async function executeUnlock() {
    const file = selectedFiles[0];
    const charset = document.querySelector('input[name="charset"]:checked').value;

    const { filePath, canceled } = await window.api.showSaveDialog({
        defaultPath: file.name.replace('.pdf', '_unlocked.pdf'),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
    });

    if (canceled) return;

    const bruteforceProgress = document.getElementById('bruteforceProgress');
    bruteforceProgress.style.display = 'block';

    window.api.onBruteforceProgress((data) => {
        const percent = (data.tried / data.total * 100).toFixed(2);
        document.getElementById('bruteforceBar').style.width = percent + '%';
        document.getElementById('bruteforceText').textContent = `시도 중: ${data.tried.toLocaleString()} / ${data.total.toLocaleString()}`;
    });

    showProgress();
    document.getElementById('progressTitle').textContent = '비밀번호 해제 중...';

    try {
        const result = await window.api.unlockPdfBruteforce(file.path, filePath, { maxLength: 6, charset });

        closeModal();
        bruteforceProgress.style.display = 'none';

        if (result.success) {
            showAlert('성공', `비밀번호를 찾았습니다: ${result.password}`);
        } else {
            showAlert('실패', result.error);
        }
    } catch (e) {
        closeModal();
        bruteforceProgress.style.display = 'none';
        showAlert('오류', e.message);
    }
}

function parsePageRanges(str) {
    const ranges = [];
    const parts = str.split(',').map(s => s.trim());

    for (const part of parts) {
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(Number);
            const pages = [];
            for (let i = start; i <= end; i++) pages.push(i);
            ranges.push({ name: part, pages });
        } else {
            ranges.push({ name: part, pages: [Number(part)] });
        }
    }
    return ranges;
}

function showProgress() {
    const config = toolConfig[currentTool];
    document.getElementById('progressTitle').textContent = config.title + ' 중...';
    document.getElementById('progressBar').style.width = '0%';
    document.getElementById('progressPercent').textContent = '0';

    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('progressContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';

    if (progressInterval) clearInterval(progressInterval);
    let progress = 0;
    progressInterval = setInterval(() => {
        progress += 5;
        if (progress >= 95) {
            clearInterval(progressInterval);
            progressInterval = null;
        }
        document.getElementById('progressBar').style.width = progress + '%';
        document.getElementById('progressPercent').textContent = Math.floor(progress);
    }, 100);
}

function showComplete() {
    const messages = {
        compress: `${selectedFiles.length}개의 PDF 파일이 압축되었습니다.`,
        split: 'PDF 파일이 분할되었습니다.',
        merge: `${selectedFiles.length}개의 PDF 파일이 병합되었습니다.`,
        unlock: 'PDF 비밀번호가 해제되었습니다.'
    };

    document.getElementById('completeMsg').textContent = messages[currentTool];
    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('completeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function downloadResult() {
    closeModal();
}

function showAlert(title, message) {
    document.getElementById('alertTitle').textContent = title;
    document.getElementById('alertBody').textContent = message;
    document.querySelectorAll('.alert-modal').forEach(m => m.style.display = 'none');
    document.getElementById('alertContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function completeProgress() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    document.getElementById('progressBar').style.width = '100%';
    document.getElementById('progressPercent').textContent = '100';

    await new Promise(resolve => setTimeout(resolve, 400));
    document.getElementById('progressContent').style.display = 'none';
}

function closeModal() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('modalOverlay');
        if (modal && modal.style.display === 'flex') {
            closeModal();
        }
    }
});

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

function showHomeConfirm() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();
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
