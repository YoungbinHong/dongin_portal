/* === 선택 관리 === */
function syncSelection(path, selected) {
    document.querySelectorAll('.file-card, .file-card-small, .file-list-item').forEach(el => {
        if (el.dataset.path === path) {
            if (selected) {
                el.classList.add('selected');
            } else {
                el.classList.remove('selected');
            }
        }
    });
}

function clearConflictingSelections(isTargetEncrypted) {
    document.querySelectorAll('.file-card.selected, .file-card-small.selected, .file-list-item.selected').forEach(file => {
        let fileName;
        if (file.classList.contains('file-card') || file.classList.contains('file-card-small')) {
            fileName = file.querySelector('div:last-child').innerText.toLowerCase();
        } else {
            fileName = file.querySelector('.file-name span:last-child').innerText.toLowerCase();
        }
        const isFileEncrypted = fileName.endsWith('.dongin');

        if (isTargetEncrypted !== isFileEncrypted) {
            file.classList.remove('selected');
        }
    });
}

function clearAllSelections() {
    document.querySelectorAll('.file-card.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.file-card-small.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.file-list-item.selected').forEach(el => el.classList.remove('selected'));
    updateBar();
}

function toggleSelect(element, event) {
    const currentName = element.querySelector('div:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');
    const path = element.dataset.path;

    if (event && event.shiftKey && lastSelectedPath) {
        selectRange(lastSelectedPath, path, 'grid');
    } else if (event && event.ctrlKey) {
        clearConflictingSelections(isTargetEncrypted);
        const isSelected = element.classList.contains('selected');
        syncSelection(path, !isSelected);
        if (!isSelected) {
            lastSelectedPath = path;
        }
    } else {
        clearAllSelections();
        clearConflictingSelections(isTargetEncrypted);
        syncSelection(path, true);
        lastSelectedPath = path;
    }

    updateBar();
}

function toggleSelectList(element, event) {
    const currentName = element.querySelector('.file-name span:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');
    const path = element.dataset.path;

    if (event && event.shiftKey && lastSelectedPath) {
        selectRange(lastSelectedPath, path, 'list');
    } else if (event && event.ctrlKey) {
        clearConflictingSelections(isTargetEncrypted);
        const isSelected = element.classList.contains('selected');
        syncSelection(path, !isSelected);
        if (!isSelected) {
            lastSelectedPath = path;
        }
    } else {
        clearAllSelections();
        clearConflictingSelections(isTargetEncrypted);
        syncSelection(path, true);
        lastSelectedPath = path;
    }

    updateBar();
}

function toggleSelectSmall(element, event) {
    const currentName = element.querySelector('div:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');
    const path = element.dataset.path;

    if (event && event.shiftKey && lastSelectedPath) {
        selectRange(lastSelectedPath, path, 'small-grid');
    } else if (event && event.ctrlKey) {
        clearConflictingSelections(isTargetEncrypted);
        const isSelected = element.classList.contains('selected');
        syncSelection(path, !isSelected);
        if (!isSelected) {
            lastSelectedPath = path;
        }
    } else {
        clearAllSelections();
        clearConflictingSelections(isTargetEncrypted);
        syncSelection(path, true);
        lastSelectedPath = path;
    }

    updateBar();
}

function selectRange(startPath, endPath, viewType) {
    let items;
    if (viewType === 'grid') {
        items = Array.from(document.querySelectorAll('.file-card'));
    } else if (viewType === 'small-grid') {
        items = Array.from(document.querySelectorAll('.file-card-small'));
    } else {
        items = Array.from(document.querySelectorAll('.file-list-item'));
    }

    let startIndex = items.findIndex(item => item.dataset.path === startPath);
    let endIndex = items.findIndex(item => item.dataset.path === endPath);

    if (startIndex === -1 || endIndex === -1) return;

    if (startIndex > endIndex) {
        [startIndex, endIndex] = [endIndex, startIndex];
    }

    const firstItem = items[startIndex];
    let firstName;
    if (viewType === 'grid' || viewType === 'small-grid') {
        firstName = firstItem.querySelector('div:last-child').innerText.toLowerCase();
    } else {
        firstName = firstItem.querySelector('.file-name span:last-child').innerText.toLowerCase();
    }
    const isTargetEncrypted = firstName.endsWith('.dongin');

    clearAllSelections();
    clearConflictingSelections(isTargetEncrypted);

    for (let i = startIndex; i <= endIndex; i++) {
        const item = items[i];
        let itemName;
        if (viewType === 'grid' || viewType === 'small-grid') {
            itemName = item.querySelector('div:last-child').innerText.toLowerCase();
        } else {
            itemName = item.querySelector('.file-name span:last-child').innerText.toLowerCase();
        }
        const isItemEncrypted = itemName.endsWith('.dongin');

        if (isItemEncrypted === isTargetEncrypted) {
            syncSelection(item.dataset.path, true);
        }
    }

    lastSelectedPath = endPath;
}

function updateBar() {
    let selectedFiles;
    if (viewMode === 'grid') {
        selectedFiles = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedFiles = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedFiles = document.querySelectorAll('.file-list-item.selected');
    }
    const count = selectedFiles.length;
    const actionBar = document.getElementById('actionBar');
    const executeBtn = document.getElementById('executeBtn');
    const openBtn = document.getElementById('openBtn');

    if (actionBar && executeBtn && openBtn) {
        if (count > 0) {
            actionBar.classList.add('show');
            document.getElementById('count').innerText = count;

            const hasEncrypted = Array.from(selectedFiles).some(item => {
                let fileName;
                if (item.classList.contains('file-card') || item.classList.contains('file-card-small')) {
                    fileName = item.querySelector('div:last-child').innerText.toLowerCase();
                } else {
                    fileName = item.querySelector('.file-name span:last-child').innerText.toLowerCase();
                }
                return fileName.endsWith('.dongin');
            });

            executeBtn.innerText = hasEncrypted ? "복호화 실행" : "암호화 실행";

            if (hasEncrypted || count > 1) {
                openBtn.disabled = true;
            } else {
                openBtn.disabled = false;
            }
        } else {
            actionBar.classList.remove('show');
        }
    }

    updatePreview();
}