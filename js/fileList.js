/* === 파일 목록 관리 === */

/* 헬퍼 함수: 파일 크기 포맷 */
function formatFileSize(bytes) {
    if (bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let unitIndex = 0;
    let size = bytes;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex++;
    }

    return size.toFixed(unitIndex === 0 ? 0 : 1) + ' ' + units[unitIndex];
}

/* 헬퍼 함수: 날짜 포맷 */
function formatDate(timestamp) {
    if (!timestamp) return '-';
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

/* 헬퍼 함수: 파일 유형 */
function getFileType(fileName, isDir) {
    if (isDir) return '파일 폴더';

    const ext = fileName.split('.').pop().toLowerCase();
    const types = {
        'txt': '텍스트 문서',
        'pdf': 'PDF 문서',
        'doc': 'Word 문서',
        'docx': 'Word 문서',
        'xls': 'Excel 스프레드시트',
        'xlsx': 'Excel 스프레드시트',
        'ppt': 'PowerPoint 프레젠테이션',
        'pptx': 'PowerPoint 프레젠테이션',
        'png': 'PNG 이미지',
        'jpg': 'JPEG 이미지',
        'jpeg': 'JPEG 이미지',
        'gif': 'GIF 이미지',
        'mp3': 'MP3 오디오',
        'mp4': 'MP4 비디오',
        'zip': 'ZIP 압축 파일',
        'exe': '응용 프로그램',
        'dongin': '암호화된 파일'
    };

    return types[ext] || ext.toUpperCase() + ' 파일';
}

/* 실제 파일 목록 불러오기 */
async function loadRealFiles(targetPath) {
    const grid = document.getElementById('fileGrid');
    const listBody = document.getElementById('fileListBody');
    if (!grid || !listBody) return;

    const result = await window.api.readDirectory(targetPath);

    if (!result.success) {
        grid.innerHTML = '<div style="padding:20px; color:#999;">폴더를 열 수 없습니다.</div>';
        listBody.innerHTML = '<div style="padding:20px; color:#999;">폴더를 열 수 없습니다.</div>';
        originalFiles = [];
        return;
    }

    originalFiles = [];
    for (const file of result.files) {
        const fileName = file.name;

        if (fileName.startsWith('.') ||
            fileName.startsWith('$') ||
            fileName.startsWith('~$') ||
            fileName === 'desktop.ini' ||
            fileName === 'Thumbs.db' ||
            fileName.endsWith('.lnk')) continue;

        const fullPath = await window.api.joinPath(targetPath, fileName);

        originalFiles.push({
            ...file,
            fullPath: fullPath
        });
    }

    renderFileList();
}

/* 파일 목록 렌더링 */
async function renderFileList() {
    const grid = document.getElementById('fileGrid');
    const smallGrid = document.getElementById('fileSmallGrid');
    const listBody = document.getElementById('fileListBody');
    if (!grid || !smallGrid || !listBody) return;

    grid.innerHTML = '';
    smallGrid.innerHTML = '';
    listBody.innerHTML = '';

    const sortedFiles = sortFiles(originalFiles);

    for (const file of sortedFiles) {
        const fileName = file.name;
        const fullPath = file.fullPath;
        const isDir = file.isDirectory;

        let icon = '📄';
        if (isDir) icon = '📁';
        else if (fileName.endsWith('.png') || fileName.endsWith('.jpg')) icon = '🖼️';
        else if (fileName.endsWith('.pdf')) icon = '📕';
        else if (fileName.endsWith('.dongin')) icon = '🔒';

        // 큰 아이콘 그리드 뷰
        const gridItem = document.createElement('div');
        gridItem.className = 'file-card';
        gridItem.dataset.path = fullPath;
        gridItem.dataset.isDir = isDir;

        gridItem.onclick = function (e) { toggleSelect(this, e); };
        gridItem.ondblclick = function () {
            if (isDir) navigateTo(fullPath, fileName);
            else openFile(fullPath);
        };

        gridItem.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 10px;">${icon}</div>
            <div style="font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</div>
        `;
        grid.appendChild(gridItem);

        // 작은 아이콘 그리드 뷰
        const smallGridItem = document.createElement('div');
        smallGridItem.className = 'file-card-small';
        smallGridItem.dataset.path = fullPath;
        smallGridItem.dataset.isDir = isDir;

        smallGridItem.onclick = function (e) { toggleSelectSmall(this, e); };
        smallGridItem.ondblclick = function () {
            if (isDir) navigateTo(fullPath, fileName);
            else openFile(fullPath);
        };

        smallGridItem.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 6px;">${icon}</div>
            <div style="font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</div>
        `;
        smallGrid.appendChild(smallGridItem);

        // 리스트 뷰
        const listItem = document.createElement('div');
        listItem.className = 'file-list-item';
        listItem.dataset.path = fullPath;
        listItem.dataset.isDir = isDir;

        listItem.onclick = function (e) { toggleSelectList(this, e); };
        listItem.ondblclick = function () {
            if (isDir) navigateTo(fullPath, fileName);
            else openFile(fullPath);
        };

        listItem.innerHTML = `
            <div class="file-name">
                <span class="file-icon">${icon}</span>
                <span>${fileName}</span>
            </div>
            <div class="file-date">${formatDate(file.modifiedTime)}</div>
            <div class="file-type">${getFileType(fileName, isDir)}</div>
            <div class="file-size">${isDir ? '-' : formatFileSize(file.size)}</div>
        `;
        listBody.appendChild(listItem);
    }
}

/* 파일 열기 */
async function openFile(filePath) {
    const exists = await window.api.fileExists(filePath);
    if (!exists) {
        showAlertModal('알림', '파일을 찾을 수 없습니다.');
        return;
    }

    if (filePath.toLowerCase().endsWith('.dongin')) {
        showAlertModal('알림', '암호화된 파일은 먼저 복호화해주세요.');
        return;
    }

    await window.api.openFile(filePath);
}

async function openSelectedFiles() {
    let selectedFiles;
    if (viewMode === 'grid') {
        selectedFiles = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedFiles = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedFiles = document.querySelectorAll('.file-list-item.selected');
    }

    if (selectedFiles.length === 0) {
        showAlertModal('알림', '파일을 선택해주세요.');
        return;
    }

    if (selectedFiles.length > 1) {
        showAlertModal('알림', '한 번에 하나의 항목만 열 수 있습니다.');
        return;
    }

    const item = selectedFiles[0];
    const fullPath = item.dataset.path;
    const isDir = item.dataset.isDir === 'true';

    if (isDir) {
        let fileName;
        if (item.classList.contains('file-card') || item.classList.contains('file-card-small')) {
            fileName = item.querySelector('div:last-child').innerText;
        } else {
            fileName = item.querySelector('.file-name span:last-child').innerText;
        }
        navigateTo(fullPath, fileName);
    } else {
        await openFile(fullPath);
    }
}