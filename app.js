/* --- 전역 변수 --- */
let currentPath = '';
let pathHistory = [];
let isCanceled = false;
let completeTimeoutId = null;
let autoLogoutTimerId = null;
let lastActivityTime = Date.now();
let homePath = '';
let pathSep = '\\';
let viewMode = 'list'; // 'grid' 또는 'list' (기본: 자세히)
let currentSort = null; // 'name', 'date', 'type', 'size' 또는 null
let sortDirection = null; // 'asc', 'desc' 또는 null
let originalFiles = []; // 정렬 전 원본 파일 목록

/* --- 경로 관리 함수들 --- */
function navigateTo(newPath, displayName = null) {
    if (currentPath !== newPath) {
        pathHistory.push(currentPath);
    }
    currentPath = newPath;

    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (pathHistory.length > 0) {
            backBtn.classList.remove('disabled');
        } else {
            backBtn.classList.add('disabled');
        }
    }

    updateBreadcrumb(displayName);
    updateSidebarActive();
    loadRealFiles(currentPath);
}

function goBack() {
    if (pathHistory.length === 0) return;

    const previousPath = pathHistory.pop();
    currentPath = previousPath;

    const backBtn = document.getElementById('backBtn');
    if (pathHistory.length === 0) {
        backBtn.classList.add('disabled');
    }

    updateBreadcrumb();
    loadRealFiles(currentPath);
    updateSidebarActive();
}

function updateSidebarActive() {
    const navItems = document.querySelectorAll('.nav-item');
    let found = false;

    navItems.forEach(item => {
        item.classList.remove('active');
        const itemPath = item.dataset.path;
        if (itemPath && currentPath.toLowerCase() === itemPath.toLowerCase()) {
            item.classList.add('active');
            found = true;
        }
    });

    // 현재 경로가 즐겨찾기 항목의 하위 폴더인 경우 부모 항목 활성화
    if (!found) {
        navItems.forEach(item => {
            const itemPath = item.dataset.path;
            if (itemPath && currentPath.toLowerCase().startsWith(itemPath.toLowerCase() + '\\')) {
                item.classList.add('active');
            }
        });
    }
}

async function updateBreadcrumb(displayName = null) {
    const pathBar = document.getElementById('pathBar');
    const headerTitle = document.getElementById('headerTitle');
    if (!pathBar || !headerTitle) return;

    let pathParts = [];

    if (currentPath.startsWith(homePath)) {
        const relativePath = currentPath.substring(homePath.length).replace(/^[\\\/]/, '');

        if (relativePath === 'Desktop') {
            pathParts = [{ name: '내 PC', path: homePath }, { name: '바탕 화면', path: currentPath }];
            headerTitle.innerText = '바탕 화면';
        } else if (relativePath === 'Downloads') {
            pathParts = [{ name: '내 PC', path: homePath }, { name: '다운로드', path: currentPath }];
            headerTitle.innerText = '다운로드';
        } else if (relativePath === 'Documents') {
            pathParts = [{ name: '내 PC', path: homePath }, { name: '문서', path: currentPath }];
            headerTitle.innerText = '문서';
        } else if (relativePath === 'Pictures') {
            pathParts = [{ name: '내 PC', path: homePath }, { name: '사진', path: currentPath }];
            headerTitle.innerText = '사진';
        } else if (relativePath === 'Videos') {
            pathParts = [{ name: '내 PC', path: homePath }, { name: '동영상', path: currentPath }];
            headerTitle.innerText = '동영상';
        } else if (relativePath === 'Music') {
            pathParts = [{ name: '내 PC', path: homePath }, { name: '음악', path: currentPath }];
            headerTitle.innerText = '음악';
        } else if (relativePath.startsWith('OneDrive')) {
            const oneDriveName = relativePath.split(pathSep)[0];
            const subPath = relativePath.substring(oneDriveName.length).replace(/^[\\\/]/, '');

            if (subPath) {
                const subParts = subPath.split(pathSep);
                pathParts = [{ name: '내 PC', path: homePath }, { name: oneDriveName, path: await window.api.joinPath(homePath, oneDriveName) }];

                let accumulatedPath = await window.api.joinPath(homePath, oneDriveName);
                for (const part of subParts) {
                    accumulatedPath = await window.api.joinPath(accumulatedPath, part);
                    pathParts.push({ name: part, path: accumulatedPath });
                }

                headerTitle.innerText = subParts[subParts.length - 1];
            } else {
                pathParts = [{ name: '내 PC', path: homePath }, { name: oneDriveName, path: currentPath }];
                headerTitle.innerText = oneDriveName;
            }
        } else {
            const parts = relativePath.split(pathSep).filter(p => p);
            pathParts = [{ name: '내 PC', path: homePath }];

            let accumulatedPath = homePath;
            for (const part of parts) {
                accumulatedPath = await window.api.joinPath(accumulatedPath, part);
                pathParts.push({ name: part, path: accumulatedPath });
            }

            headerTitle.innerText = parts[parts.length - 1] || '내 PC';
        }
    } else if (currentPath.match(/^[A-Z]:\\/i)) {
        const parts = currentPath.split(pathSep).filter(p => p);
        const driveLetter = parts[0];

        if (parts.length === 1) {
            pathParts = [{ name: '내 PC', path: homePath }, { name: `로컬 디스크 (${driveLetter})`, path: currentPath }];
            headerTitle.innerText = `로컬 디스크 (${driveLetter})`;
        } else {
            pathParts = [{ name: '내 PC', path: homePath }, { name: `로컬 디스크 (${driveLetter})`, path: driveLetter + pathSep }];

            let accumulatedPath = driveLetter + pathSep;
            for (let i = 1; i < parts.length; i++) {
                accumulatedPath = await window.api.joinPath(accumulatedPath, parts[i]);
                pathParts.push({ name: parts[i], path: accumulatedPath });
            }

            headerTitle.innerText = parts[parts.length - 1];
        }
    } else {
        const baseName = await window.api.getBasename(currentPath);
        pathParts = [{ name: currentPath, path: currentPath }];
        headerTitle.innerText = displayName || baseName;
    }

    pathBar.innerHTML = '';
    pathParts.forEach((part, index) => {
        const span = document.createElement('span');
        span.className = 'path-item';
        span.innerText = part.name;
        span.onclick = () => {
            if (part.path !== currentPath) {
                navigateTo(part.path, part.name);
            }
        };
        pathBar.appendChild(span);

        if (index < pathParts.length - 1) {
            const separator = document.createElement('span');
            separator.className = 'path-separator';
            separator.innerText = '>';
            pathBar.appendChild(separator);
        }
    });
}

/* --- 테마 관리 함수 --- */
function applyTheme(theme) {
    if (theme === 'dark') {
        document.body.classList.add('dark-theme');
        localStorage.setItem('app-theme', 'dark');
    } else {
        document.body.classList.remove('dark-theme');
        localStorage.setItem('app-theme', 'light');
    }
}

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('app-theme') || 'light';
    const themeSelect = document.getElementById('themeSelect');

    applyTheme(savedTheme);
    if (themeSelect) {
        themeSelect.value = savedTheme;
    }
}

/* --- 프로그램 시작 시 실행 --- */
document.addEventListener('DOMContentLoaded', async () => {
    console.log("프로그램 시작됨");

    // 초기화: 홈 경로와 경로 구분자 가져오기
    homePath = await window.api.getHomePath();
    pathSep = await window.api.getPathSep();
    currentPath = await window.api.joinPath(homePath, 'Desktop');

    loadSavedTheme();
    loadSavedViewMode();
    loadNoticeSettings();
    loadAutoLogoutSetting();
    await initSidebar();
    updateBreadcrumb();
    loadRealFiles(currentPath);
    initAutoLogout();
});

/* --- 알림 설정 관리 --- */
function loadNoticeSettings() {
    const noticeCompletion = localStorage.getItem('notice-completion') !== 'false';
    const notice1 = document.getElementById('notice1');
    if (notice1) {
        notice1.checked = noticeCompletion;
    }

    const noticeSecurity = localStorage.getItem('notice-security') !== 'false';
    const notice2 = document.getElementById('notice2');
    if (notice2) {
        notice2.checked = noticeSecurity;
    }
}

function toggleNoticeCompletion(enabled) {
    localStorage.setItem('notice-completion', enabled ? 'true' : 'false');
    console.log('완료 알림 설정:', enabled);
}

function toggleNoticeSecurity(enabled) {
    localStorage.setItem('notice-security', enabled ? 'true' : 'false');
    console.log('보안 알림 설정:', enabled);
}

/* --- 자동 로그아웃 관리 --- */
function loadAutoLogoutSetting() {
    const savedTime = localStorage.getItem('auto-logout-time') || '10';
    const select = document.getElementById('autoLogoutSelect');
    if (select) {
        select.value = savedTime;
    }
}

function setAutoLogoutTime(minutes) {
    localStorage.setItem('auto-logout-time', minutes);
    console.log('자동 로그아웃 시간 설정:', minutes === '0' ? '사용 안 함' : minutes + '분');
    initAutoLogout();
}

function initAutoLogout() {
    if (autoLogoutTimerId) {
        clearInterval(autoLogoutTimerId);
        autoLogoutTimerId = null;
    }

    const minutes = parseInt(localStorage.getItem('auto-logout-time') || '10');

    if (minutes === 0) {
        console.log('자동 로그아웃 비활성화');
        return;
    }

    const activityEvents = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach(event => {
        document.addEventListener(event, resetActivityTimer, { passive: true });
    });

    lastActivityTime = Date.now();

    autoLogoutTimerId = setInterval(() => {
        const now = Date.now();
        const elapsed = (now - lastActivityTime) / 1000 / 60;

        if (elapsed >= minutes) {
            console.log('자동 로그아웃 실행');
            clearInterval(autoLogoutTimerId);
            window.location.href = 'login.html';
        }
    }, 60000);

    console.log('자동 로그아웃 타이머 시작:', minutes + '분');
}

function resetActivityTimer() {
    lastActivityTime = Date.now();
}

/* --- 사이드바 자동 생성 함수 --- */
async function initSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    if (!sidebar) {
        console.error("에러: sidebarMenu라는 ID를 가진 태그를 못 찾겠습니다.");
        return;
    }

    sidebar.innerHTML = '';

    // OneDrive 폴더들 자동 검색
    const oneDriveFolders = [];
    try {
        const result = await window.api.readDirectory(homePath);
        if (result.success) {
            for (const file of result.files) {
                if (file.name.startsWith('OneDrive') && file.name !== 'OneDrive' && file.isDirectory) {
                    const fullPath = await window.api.joinPath(homePath, file.name);
                    const hasAccess = await window.api.checkAccess(fullPath);
                    if (hasAccess) {
                        oneDriveFolders.push({ name: file.name, path: fullPath, icon: '☁️' });
                    }
                }
            }
        }
    } catch (err) {
        console.error('OneDrive 폴더 검색 실패:', err);
    }

    const groups = [
        {
            title: '즐겨찾기',
            items: [
                { name: '바탕 화면', path: await window.api.joinPath(homePath, 'Desktop'), icon: '🖥️' },
                { name: '다운로드', path: await window.api.joinPath(homePath, 'Downloads'), icon: '⬇️' },
                { name: '문서', path: await window.api.joinPath(homePath, 'Documents'), icon: '📄' },
                { name: '사진', path: await window.api.joinPath(homePath, 'Pictures'), icon: '🖼️' },
                { name: '동영상', path: await window.api.joinPath(homePath, 'Videos'), icon: '🎬' },
                { name: '음악', path: await window.api.joinPath(homePath, 'Music'), icon: '🎵' },
                ...oneDriveFolders
            ]
        },
        {
            title: '내 PC',
            items: [
                { name: '로컬 디스크 (C:)', path: 'C:\\', icon: '💾' }
            ]
        }
    ];

    for (const group of groups) {
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'sidebar-section';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'sidebar-title';
        titleDiv.innerText = group.title;
        sectionDiv.appendChild(titleDiv);

        let hasItem = false;

        for (const item of group.items) {
            const exists = await window.api.fileExists(item.path);
            if (exists) {
                hasItem = true;
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nav-item';
                itemDiv.dataset.path = item.path;
                if (item.name === '바탕 화면') itemDiv.classList.add('active');

                itemDiv.innerHTML = `<i>${item.icon}</i>${item.name}`;

                itemDiv.onclick = () => {
                    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                    itemDiv.classList.add('active');
                    navigateTo(item.path, item.name);
                };

                sectionDiv.appendChild(itemDiv);
            }
        }

        if (hasItem) {
            sidebar.appendChild(sectionDiv);
        }
    }
}

/* --- 보기 모드 전환 --- */
function toggleViewMode() {
    const grid = document.getElementById('fileGrid');
    const list = document.getElementById('fileList');
    const iconGrid = document.getElementById('viewIconGrid');
    const iconList = document.getElementById('viewIconList');

    if (viewMode === 'grid') {
        viewMode = 'list';
        grid.classList.add('hidden');
        list.classList.add('active');
        iconGrid.style.display = 'block';
        iconList.style.display = 'none';
    } else {
        viewMode = 'grid';
        grid.classList.remove('hidden');
        list.classList.remove('active');
        iconGrid.style.display = 'none';
        iconList.style.display = 'block';
    }

    localStorage.setItem('view-mode', viewMode);
}

function loadSavedViewMode() {
    const saved = localStorage.getItem('view-mode');
    const grid = document.getElementById('fileGrid');
    const list = document.getElementById('fileList');
    const iconGrid = document.getElementById('viewIconGrid');
    const iconList = document.getElementById('viewIconList');

    if (saved === 'grid') {
        // 저장된 값이 grid면 grid로 설정
        viewMode = 'grid';
        grid.classList.remove('hidden');
        list.classList.remove('active');
        iconGrid.style.display = 'none';
        iconList.style.display = 'block';
    } else {
        // 기본값 또는 저장된 값이 list면 list로 설정
        viewMode = 'list';
        grid.classList.add('hidden');
        list.classList.add('active');
        iconGrid.style.display = 'block';
        iconList.style.display = 'none';
    }
}

/* --- 정렬 기능 --- */
function toggleSort(column) {
    const headers = document.querySelectorAll('.file-list-header .sortable');

    if (currentSort === column) {
        // 같은 컬럼 클릭: asc → desc → null 순환
        if (sortDirection === 'asc') {
            sortDirection = 'desc';
        } else if (sortDirection === 'desc') {
            sortDirection = null;
            currentSort = null;
        }
    } else {
        // 다른 컬럼 클릭: 해당 컬럼으로 오름차순 시작
        currentSort = column;
        sortDirection = 'asc';
    }

    // 헤더 UI 업데이트
    headers.forEach(header => {
        header.classList.remove('asc', 'desc', 'active');
        if (header.dataset.sort === currentSort) {
            header.classList.add('active');
            if (sortDirection) {
                header.classList.add(sortDirection);
            }
        }
    });

    // 파일 목록 다시 렌더링
    renderFileList();
}

function sortFiles(files) {
    if (!currentSort || !sortDirection) {
        return [...files]; // 원본 순서 유지
    }

    const sorted = [...files];
    const dir = sortDirection === 'asc' ? 1 : -1;

    sorted.sort((a, b) => {
        // 폴더를 항상 먼저 표시
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;

        let comparison = 0;

        switch (currentSort) {
            case 'name':
                comparison = a.name.localeCompare(b.name, 'ko');
                break;
            case 'date':
                comparison = (a.modifiedTime || 0) - (b.modifiedTime || 0);
                break;
            case 'type':
                const typeA = getFileType(a.name, a.isDirectory);
                const typeB = getFileType(b.name, b.isDirectory);
                comparison = typeA.localeCompare(typeB, 'ko');
                break;
            case 'size':
                comparison = (a.size || 0) - (b.size || 0);
                break;
        }

        return comparison * dir;
    });

    return sorted;
}

async function renderFileList() {
    const grid = document.getElementById('fileGrid');
    const listBody = document.getElementById('fileListBody');
    if (!grid || !listBody) return;

    grid.innerHTML = '';
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

        // 그리드 뷰 아이템
        const gridItem = document.createElement('div');
        gridItem.className = 'file-card';
        gridItem.dataset.path = fullPath;
        gridItem.dataset.isDir = isDir;

        gridItem.onclick = function () { toggleSelect(this); };
        gridItem.ondblclick = function () {
            if (isDir) {
                navigateTo(fullPath, fileName);
            } else {
                openFile(fullPath);
            }
        };

        gridItem.innerHTML = `
            <div style="font-size: 40px; margin-bottom: 10px;">${icon}</div>
            <div style="font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</div>
        `;
        grid.appendChild(gridItem);

        // 리스트 뷰 아이템
        const listItem = document.createElement('div');
        listItem.className = 'file-list-item';
        listItem.dataset.path = fullPath;
        listItem.dataset.isDir = isDir;

        listItem.onclick = function () { toggleSelectList(this); };
        listItem.ondblclick = function () {
            if (isDir) {
                navigateTo(fullPath, fileName);
            } else {
                openFile(fullPath);
            }
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

/* --- 헬퍼 함수: 파일 크기 포맷 --- */
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

/* --- 헬퍼 함수: 날짜 포맷 --- */
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

/* --- 헬퍼 함수: 파일 유형 --- */
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

/* --- 실제 파일 목록 불러오기 --- */
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

    // 파일 목록 필터링 및 저장
    originalFiles = [];
    for (const file of result.files) {
        const fileName = file.name;

        // 숨김파일, 시스템파일, 임시파일 제외
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

    // 파일 목록 렌더링
    renderFileList();
}

/* --- 기능: 파일 열기 --- */
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
    const selectedFiles = viewMode === 'grid'
        ? document.querySelectorAll('.file-card.selected')
        : document.querySelectorAll('.file-list-item.selected');

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
        if (item.classList.contains('file-card')) {
            fileName = item.querySelector('div:last-child').innerText;
        } else {
            fileName = item.querySelector('.file-name span:last-child').innerText;
        }
        navigateTo(fullPath, fileName);
    } else {
        await openFile(fullPath);
    }
}

/* --- 프로그레스바 제어 --- */
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

/* --- 기능: 암호화/복호화 실행 --- */
async function handleExecution() {
    const selectedFiles = viewMode === 'grid'
        ? document.querySelectorAll('.file-card.selected')
        : document.querySelectorAll('.file-list-item.selected');

    if (selectedFiles.length === 0) {
        showAlertModal('알림', '파일을 선택해주세요.');
        return;
    }

    const fileList = Array.from(selectedFiles).map(item => {
        let name;
        if (item.classList.contains('file-card')) {
            name = item.querySelector('div:last-child').innerText;
        } else {
            name = item.querySelector('.file-name span:last-child').innerText;
        }
        return { name, path: item.dataset.path };
    });

    const totalFiles = fileList.length;
    const isEncrypting = !fileList[0].name.endsWith('.dongin');

    isCanceled = false;
    showProgress(
        isEncrypting ? '파일 암호화 중' : '파일 복호화 중',
        `${totalFiles}개 파일 처리 중...`
    );

    let processedCount = 0;

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
            break;
        }
    }

    if (!isCanceled) {
        updateProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
        hideProgress();
        showCompletionModal(`${processedCount}개 파일이 처리되었습니다.`);
    }

    loadRealFiles(currentPath);
    updateBar();
}

/* --- UI 보조 함수들 --- */
function syncSelection(path, selected) {
    // 같은 경로를 가진 모든 요소의 선택 상태 동기화
    document.querySelectorAll('.file-card, .file-list-item').forEach(el => {
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
    // 암호화/일반 파일 혼합 선택 방지
    document.querySelectorAll('.file-card.selected, .file-list-item.selected').forEach(file => {
        let fileName;
        if (file.classList.contains('file-card')) {
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

function toggleSelect(element) {
    const currentName = element.querySelector('div:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');

    clearConflictingSelections(isTargetEncrypted);

    const path = element.dataset.path;
    const isSelected = element.classList.contains('selected');
    syncSelection(path, !isSelected);

    updateBar();
}

function toggleSelectList(element) {
    const currentName = element.querySelector('.file-name span:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');

    clearConflictingSelections(isTargetEncrypted);

    const path = element.dataset.path;
    const isSelected = element.classList.contains('selected');
    syncSelection(path, !isSelected);

    updateBar();
}

function updateBar() {
    // 현재 보기 모드에 따라 선택된 파일 확인
    const selectedFiles = viewMode === 'grid'
        ? document.querySelectorAll('.file-card.selected')
        : document.querySelectorAll('.file-list-item.selected');
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
                if (item.classList.contains('file-card')) {
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
}

/* --- 삭제 기능 --- */
function deleteFiles() {
    const selectedFiles = viewMode === 'grid'
        ? document.querySelectorAll('.file-card.selected')
        : document.querySelectorAll('.file-list-item.selected');

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
    const selectedFiles = viewMode === 'grid'
        ? document.querySelectorAll('.file-card.selected')
        : document.querySelectorAll('.file-list-item.selected');

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

/* --- 설정 관련 --- */
function openSettings() {
    const modal = document.getElementById('modalOverlay');
    const settingsContent = document.getElementById('settingsContent');

    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    settingsContent.style.display = 'flex';
}

function switchTab(event, tabName) {
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    document.querySelectorAll('.settings-menu-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    event.currentTarget.classList.add('active');
}

function logout() {
    const modal = document.getElementById('modalOverlay');
    const logoutContent = document.getElementById('logoutContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    logoutContent.style.display = 'block';
}

function confirmLogout() {
    closeModal();

    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');

    setTimeout(() => {
        window.location.href = 'login.html';
    }, 1800);
}

/* --- 모달 관련 --- */
function showCompletionModal(message) {
    const noticeEnabled = localStorage.getItem('notice-completion') !== 'false';
    if (!noticeEnabled) {
        console.log('완료 알림이 비활성화되어 있습니다:', message);
        return;
    }

    if (completeTimeoutId) {
        clearTimeout(completeTimeoutId);
        completeTimeoutId = null;
    }

    const modal = document.getElementById('modalOverlay');
    const completeContent = document.getElementById('completeContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    modal.style.display = 'flex';
    completeContent.style.display = 'block';
    document.getElementById('completeMsg').innerText = message;

    completeTimeoutId = setTimeout(() => {
        if (completeContent.style.display !== 'none') {
            closeModal();
        }
    }, 3000);
}

function showAlertModal(title, message) {
    const modal = document.getElementById('modalOverlay');
    const alertContent = document.getElementById('alertContent');

    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    document.getElementById('alertTitle').innerText = title;
    document.getElementById('alertBody').innerText = message;

    modal.style.display = 'flex';
    alertContent.style.display = 'block';
}

function closeModal() {
    if (completeTimeoutId) {
        clearTimeout(completeTimeoutId);
        completeTimeoutId = null;
    }
    document.getElementById('modalOverlay').style.display = 'none';
}

/* --- 서버 연결 상태 관리 --- */
let serverConnected = true;

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

document.addEventListener('DOMContentLoaded', () => {
    updateServerStatus();
    setInterval(updateServerStatus, 1000);
    checkAutoStartStatus();
});

/* --- 윈도우 시작 시 자동 실행 관리 --- */
async function checkAutoStartStatus() {
    const checkbox = document.getElementById('autoStartCheckbox');
    if (!checkbox) return;

    const isEnabled = await window.api.checkAutoStart();
    checkbox.checked = isEnabled;
}

async function toggleAutoStart(enabled) {
    const result = await window.api.setAutoStart(enabled);

    if (!result.success) {
        console.error('자동 실행 설정 실패:', result.error);
        showAlertModal('오류', '자동 실행 설정에 실패했습니다.');
        document.getElementById('autoStartCheckbox').checked = !enabled;
    } else {
        console.log(enabled ? '자동 실행 등록 완료' : '자동 실행 해제 완료');
    }
}
