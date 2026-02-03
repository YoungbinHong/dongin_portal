/* === 암호화/복호화 기능 === */

/* 폴더 내 모든 파일 재귀적으로 수집 */
async function collectFilesFromFolder(folderPath) {
    const files = [];

    const result = await window.api.readDirectory(folderPath);
    if (!result.success) {
        return files;
    }

    for (const file of result.files) {
        const fileName = file.name;

        if (fileName.startsWith('.') ||
            fileName.startsWith('$') ||
            fileName.startsWith('~$') ||
            fileName === 'desktop.ini' ||
            fileName === 'Thumbs.db' ||
            fileName.endsWith('.lnk')) continue;

        const fullPath = await window.api.joinPath(folderPath, fileName);

        if (file.isDirectory) {
            const subFiles = await collectFilesFromFolder(fullPath);
            files.push(...subFiles);
        } else {
            files.push({ name: fileName, path: fullPath });
        }
    }

    return files;
}

/* 프로그레스바 제어 */
function showProgress(title, status) {
    const modal = document.getElementById('modalOverlay');
    const progressContent = document.getElementById('progressContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    progressContent.style.display = 'block';

    document.getElementById('progressTitle').innerText = title;
    document.getElementById('progressStatus').innerHTML = `${status} <span id="progressPercent">0</span>%`;
    updateProgress(0);
}

function updateProgress(percent) {
    const bar = document.getElementById('progressBar');
    const percentSpan = document.getElementById('progressPercent');

    if (bar && percentSpan) {
        bar.style.width = percent + '%';
        percentSpan.innerText = Math.floor(percent);
    }
}

function hideProgress() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('progressContent').style.display = 'none';
}

function cancelTask() {
    isCanceled = true;
    hideProgress();
    setTimeout(() => {
        showAlertModal('알림', '작업이 취소되었습니다.');
        loadRealFiles(currentPath);
        updateBar();
    }, 100);
}

/* 암호화/복호화 실행 */
async function handleExecution() {
    let selectedItems;
    if (viewMode === 'grid') {
        selectedItems = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedItems = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedItems = document.querySelectorAll('.file-list-item.selected');
    }

    if (selectedItems.length === 0) {
        showAlertModal('알림', '파일 또는 폴더를 선택해주세요.');
        return;
    }

    const fileList = [];
    let hasFolder = false;

    for (const item of selectedItems) {
        let name;
        if (item.classList.contains('file-card') || item.classList.contains('file-card-small')) {
            name = item.querySelector('div:last-child').innerText;
        } else {
            name = item.querySelector('.file-name span:last-child').innerText;
        }

        const path = item.dataset.path;
        const isDir = item.dataset.isDir === 'true';

        if (isDir) {
            hasFolder = true;
            const folderFiles = await collectFilesFromFolder(path);
            fileList.push(...folderFiles);
        } else {
            fileList.push({ name, path });
        }
    }

    if (fileList.length === 0) {
        showAlertModal('알림', hasFolder ? '선택한 폴더에 파일이 없습니다.' : '파일을 선택해주세요.');
        return;
    }

    const isEncrypting = !fileList[0].name.endsWith('.dongin');

    const hasMixedTypes = fileList.some(f => f.name.endsWith('.dongin')) &&
                          fileList.some(f => !f.name.endsWith('.dongin'));

    if (hasMixedTypes) {
        showAlertModal('알림', '암호화된 파일과 일반 파일을 동시에 처리할 수 없습니다.');
        return;
    }

    const totalFiles = fileList.length;

    isCanceled = false;
    showProgress(
        isEncrypting ? '파일 암호화 중' : '파일 복호화 중',
        `${totalFiles}개 파일 처리 중...`
    );

    let processedCount = 0;
    let errorOccurred = false;

    for (const file of fileList) {
        if (isCanceled) {
            console.log('작업이 취소되었습니다.');
            break;
        }

        try {
            let result;
            if (file.name.endsWith('.dongin')) {
                result = await window.api.decryptFile(file.path);
            } else {
                result = await window.api.encryptFile(file.path);
            }

            if (!result.success) {
                throw new Error(result.error);
            }

            processedCount++;
            const progress = (processedCount / totalFiles) * 100;
            updateProgress(progress);

            await new Promise(resolve => setTimeout(resolve, 50));

        } catch (err) {
            console.error(`오류: ${file.name} 처리 실패`, err);
            hideProgress();
            showAlertModal('오류', `${file.name} 처리 실패\n${err.message}`);
            errorOccurred = true;
            break;
        }
    }

    if (!isCanceled && !errorOccurred) {
        updateProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
        hideProgress();
        showCompletionModal(`${processedCount}개 파일이 처리되었습니다.`);
    }

    loadRealFiles(currentPath);
    updateBar();
}

/* 삭제 기능 */
function deleteFiles() {
    let selectedFiles;
    if (viewMode === 'grid') {
        selectedFiles = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedFiles = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedFiles = document.querySelectorAll('.file-list-item.selected');
    }

    if (selectedFiles.length === 0) {
        showAlertModal('알림', '삭제할 파일을 선택해주세요.');
        return;
    }

    const modal = document.getElementById('modalOverlay');
    const deleteContent = document.getElementById('deleteContent');
    const deleteMsg = document.getElementById('deleteMsg');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    deleteMsg.innerText = `선택한 ${selectedFiles.length}개 항목을 휴지통으로 이동하시겠습니까?`;

    modal.style.display = 'flex';
    deleteContent.style.display = 'block';
}

async function executeDelete() {
    let selectedFiles;
    if (viewMode === 'grid') {
        selectedFiles = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedFiles = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedFiles = document.querySelectorAll('.file-list-item.selected');
    }

    const fileList = Array.from(selectedFiles).map(item => item.dataset.path);

    closeModal();

    let successCount = 0;
    let failCount = 0;

    for (const filePath of fileList) {
        const result = await window.api.moveToTrash(filePath);
        if (result.success) {
            successCount++;
        } else {
            console.error(`삭제 실패: ${filePath}`, result.error);
            failCount++;
        }
    }

    loadRealFiles(currentPath);
    updateBar();

    if (failCount === 0) {
        showCompletionModal(`${successCount}개 항목이 휴지통으로 이동되었습니다.`);
    } else {
        showAlertModal('삭제 결과', `${successCount}개 삭제 성공, ${failCount}개 삭제 실패`);
    }
}