/* --- 전역 변수 --- */
let currentPath = '';
let pathHistory = [];
let isCanceled = false;
let completeTimeoutId = null;
let autoLogoutTimerId = null;
let lastActivityTime = Date.now();
let homePath = '';
let pathSep = '\\';
let viewMode = 'list'; // 'grid', 'small-grid', 'list' (기본: 자세히)
let previewEnabled = false; // 미리보기 패널 활성화 상태
const DEFAULT_PREVIEW_WIDTH = 350; // 미리보기 패널 기본 너비
const MIN_PREVIEW_WIDTH = 200; // 미리보기 패널 최소 너비
let currentSort = null; // 'name', 'date', 'type', 'size' 또는 null
let sortDirection = null; // 'asc', 'desc' 또는 null
let originalFiles = []; // 정렬 전 원본 파일 목록
let lastSelectedPath = null; // Shift 범위 선택을 위한 마지막 선택 경로

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
    loadSavedPreviewState();
    loadNoticeSettings();
    loadAutoLogoutSetting();
    await initSidebar();
    updateBreadcrumb();
    loadRealFiles(currentPath);
    initAutoLogout();
    initDragSelection();
});

/* --- 드래그 선택 기능 --- */
let isDragPending = false;  // 마우스 다운 후 드래그 대기 상태
let isDragging = false;     // 실제 드래그 중인 상태
let dragStartX = 0;
let dragStartY = 0;
const DRAG_THRESHOLD = 5;   // 드래그 시작 임계값 (픽셀)

function initDragSelection() {
    const selectionBox = document.getElementById('selectionBox');
    const mainContainer = document.querySelector('.main-container');
    if (!mainContainer || !selectionBox) return;

    // 메인 컨테이너(오른쪽 페인) 전체에서 드래그 시작 가능
    mainContainer.addEventListener('mousedown', (e) => {
        // 버튼, 액션바, 헤더, 스크롤바, 미리보기 페인, 리사이저 클릭 시 무시
        if (e.target.closest('.action-bar') ||
            e.target.closest('button') ||
            e.target.closest('.file-list-header') ||
            e.target.closest('input') ||
            e.target.closest('select') ||
            e.target.closest('.preview-pane') ||
            e.target.closest('.preview-resizer')) {
            return;
        }

        // 드래그 대기 상태로 전환 (아직 실제 드래그는 아님)
        isDragPending = true;
        isDragging = false;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        // 선택 박스 초기 위치 설정
        selectionBox.style.left = dragStartX + 'px';
        selectionBox.style.top = dragStartY + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragPending && !isDragging) return;

        const currentX = e.clientX;
        const currentY = e.clientY;
        const deltaX = Math.abs(currentX - dragStartX);
        const deltaY = Math.abs(currentY - dragStartY);

        // 임계값을 넘어야 드래그 시작 (클릭과 드래그 구분)
        if (isDragPending && !isDragging) {
            if (deltaX > DRAG_THRESHOLD || deltaY > DRAG_THRESHOLD) {
                isDragging = true;
                isDragPending = false;

                // Ctrl 키가 눌려있지 않으면 기존 선택 해제
                if (!e.ctrlKey) {
                    clearAllSelections();
                }
            } else {
                return; // 아직 임계값 미만이면 대기
            }
        }

        const left = Math.min(dragStartX, currentX);
        const top = Math.min(dragStartY, currentY);
        const width = Math.abs(currentX - dragStartX);
        const height = Math.abs(currentY - dragStartY);

        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        selectionBox.classList.add('active');

        // 선택 박스와 겹치는 아이템 선택
        selectItemsInBox(left, top, width, height, e.ctrlKey);
    });

    document.addEventListener('mouseup', (e) => {
        const wasDragging = isDragging;

        if (isDragging) {
            isDragging = false;
            selectionBox.classList.remove('active');
            selectionBox.style.width = '0';
            selectionBox.style.height = '0';
            updateBar();
        }

        // 드래그 없이 클릭만 한 경우 (파일 아이템이 아닌 빈 공간 클릭)
        if (isDragPending && !wasDragging) {
            const target = e.target;
            if (!target.closest('.file-card') &&
                !target.closest('.file-list-item') &&
                !target.closest('.action-bar') &&
                !target.closest('button')) {
                // Ctrl 키가 눌려있지 않으면 선택 해제
                if (!e.ctrlKey) {
                    clearAllSelections();
                }
            }
        }

        isDragPending = false;
    });
}

function selectItemsInBox(boxLeft, boxTop, boxWidth, boxHeight, addToSelection) {
    const boxRight = boxLeft + boxWidth;
    const boxBottom = boxTop + boxHeight;

    // 큰 아이콘 그리드 뷰 아이템
    const gridItems = document.querySelectorAll('.file-card');
    gridItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const intersects = !(rect.right < boxLeft ||
                            rect.left > boxRight ||
                            rect.bottom < boxTop ||
                            rect.top > boxBottom);

        if (intersects) {
            item.classList.add('selected');
        } else if (!addToSelection) {
            item.classList.remove('selected');
        }
    });

    // 작은 아이콘 그리드 뷰 아이템
    const smallGridItems = document.querySelectorAll('.file-card-small');
    smallGridItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const intersects = !(rect.right < boxLeft ||
                            rect.left > boxRight ||
                            rect.bottom < boxTop ||
                            rect.top > boxBottom);

        if (intersects) {
            item.classList.add('selected');
        } else if (!addToSelection) {
            item.classList.remove('selected');
        }
    });

    // 리스트 뷰 아이템
    const listItems = document.querySelectorAll('.file-list-item');
    listItems.forEach(item => {
        const rect = item.getBoundingClientRect();
        const intersects = !(rect.right < boxLeft ||
                            rect.left > boxRight ||
                            rect.bottom < boxTop ||
                            rect.top > boxBottom);

        if (intersects) {
            item.classList.add('selected');
        } else if (!addToSelection) {
            item.classList.remove('selected');
        }
    });
}

function clearAllSelections() {
    document.querySelectorAll('.file-card.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.file-card-small.selected').forEach(el => el.classList.remove('selected'));
    document.querySelectorAll('.file-list-item.selected').forEach(el => el.classList.remove('selected'));
    updateBar();
}

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
    const smallGrid = document.getElementById('fileSmallGrid');
    const list = document.getElementById('fileList');
    const iconGrid = document.getElementById('viewIconGrid');
    const iconSmallGrid = document.getElementById('viewIconSmallGrid');
    const iconList = document.getElementById('viewIconList');

    // 모든 뷰와 아이콘 숨기기
    grid.classList.add('hidden');
    smallGrid.classList.add('hidden');
    list.classList.remove('active');
    iconGrid.style.display = 'none';
    iconSmallGrid.style.display = 'none';
    iconList.style.display = 'none';

    // 순환: list → grid → small-grid → list
    if (viewMode === 'list') {
        viewMode = 'grid';
        grid.classList.remove('hidden');
        iconSmallGrid.style.display = 'block'; // 다음 모드 아이콘 표시
    } else if (viewMode === 'grid') {
        viewMode = 'small-grid';
        smallGrid.classList.remove('hidden');
        iconList.style.display = 'block'; // 다음 모드 아이콘 표시
    } else {
        viewMode = 'list';
        list.classList.add('active');
        iconGrid.style.display = 'block'; // 다음 모드 아이콘 표시
    }

    localStorage.setItem('view-mode', viewMode);
}

function loadSavedViewMode() {
    const saved = localStorage.getItem('view-mode');
    const grid = document.getElementById('fileGrid');
    const smallGrid = document.getElementById('fileSmallGrid');
    const list = document.getElementById('fileList');
    const iconGrid = document.getElementById('viewIconGrid');
    const iconSmallGrid = document.getElementById('viewIconSmallGrid');
    const iconList = document.getElementById('viewIconList');

    // 모든 뷰��� 아이콘 숨기기
    grid.classList.add('hidden');
    smallGrid.classList.add('hidden');
    list.classList.remove('active');
    iconGrid.style.display = 'none';
    iconSmallGrid.style.display = 'none';
    iconList.style.display = 'none';

    if (saved === 'grid') {
        viewMode = 'grid';
        grid.classList.remove('hidden');
        iconSmallGrid.style.display = 'block';
    } else if (saved === 'small-grid') {
        viewMode = 'small-grid';
        smallGrid.classList.remove('hidden');
        iconList.style.display = 'block';
    } else {
        viewMode = 'list';
        list.classList.add('active');
        iconGrid.style.display = 'block';
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

        // 큰 아이콘 그리드 뷰 아이템
        const gridItem = document.createElement('div');
        gridItem.className = 'file-card';
        gridItem.dataset.path = fullPath;
        gridItem.dataset.isDir = isDir;

        gridItem.onclick = function (e) { toggleSelect(this, e); };
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

        // 작은 아이콘 그리드 뷰 아이템
        const smallGridItem = document.createElement('div');
        smallGridItem.className = 'file-card-small';
        smallGridItem.dataset.path = fullPath;
        smallGridItem.dataset.isDir = isDir;

        smallGridItem.onclick = function (e) { toggleSelectSmall(this, e); };
        smallGridItem.ondblclick = function () {
            if (isDir) {
                navigateTo(fullPath, fileName);
            } else {
                openFile(fullPath);
            }
        };

        smallGridItem.innerHTML = `
            <div style="font-size: 24px; margin-bottom: 6px;">${icon}</div>
            <div style="font-size: 11px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</div>
        `;
        smallGrid.appendChild(smallGridItem);

        // 리스트 뷰 아이템
        const listItem = document.createElement('div');
        listItem.className = 'file-list-item';
        listItem.dataset.path = fullPath;
        listItem.dataset.isDir = isDir;

        listItem.onclick = function (e) { toggleSelectList(this, e); };
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

/* --- 폴더 내 모든 파일 재귀적으로 수집 --- */
async function collectFilesFromFolder(folderPath) {
    const files = [];

    const result = await window.api.readDirectory(folderPath);
    if (!result.success) {
        return files;
    }

    for (const file of result.files) {
        const fileName = file.name;

        // 숨김파일, 시스템파일, 임시파일 제외
        if (fileName.startsWith('.') ||
            fileName.startsWith('$') ||
            fileName.startsWith('~$') ||
            fileName === 'desktop.ini' ||
            fileName === 'Thumbs.db' ||
            fileName.endsWith('.lnk')) continue;

        const fullPath = await window.api.joinPath(folderPath, fileName);

        if (file.isDirectory) {
            // 하위 폴더의 파일들도 재귀적으로 수집
            const subFiles = await collectFilesFromFolder(fullPath);
            files.push(...subFiles);
        } else {
            files.push({ name: fileName, path: fullPath });
        }
    }

    return files;
}

/* --- 기능: 암호화/복호화 실행 --- */
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

    // 선택된 항목들에서 파일 목록 수집 (폴더인 경우 하위 파일 포함)
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
            // 폴더인 경우 하위 파일들을 재귀적으로 수집
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

    // 암호화/복호화 방향 결정 (첫 번째 파일 기준)
    const isEncrypting = !fileList[0].name.endsWith('.dongin');

    // 혼합된 파일 유형 체크 (암호화 파일과 일반 파일이 섞여있는지)
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

/* --- UI 보조 함수들 --- */
function syncSelection(path, selected) {
    // 같은 경로를 가진 모든 요소의 선택 상태 동기화
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
    // 암호화/일반 파일 혼합 선택 방지
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

function toggleSelect(element, event) {
    const currentName = element.querySelector('div:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');
    const path = element.dataset.path;

    if (event && event.shiftKey && lastSelectedPath) {
        // Shift + 클릭: 범위 선택
        selectRange(lastSelectedPath, path, 'grid');
    } else if (event && event.ctrlKey) {
        // Ctrl + 클릭: 토글 (기존 선택 유지)
        clearConflictingSelections(isTargetEncrypted);
        const isSelected = element.classList.contains('selected');
        syncSelection(path, !isSelected);
        if (!isSelected) {
            lastSelectedPath = path;
        }
    } else {
        // 일반 클릭: 단일 선택 (기존 선택 해제)
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
        // Shift + 클릭: 범위 선택
        selectRange(lastSelectedPath, path, 'list');
    } else if (event && event.ctrlKey) {
        // Ctrl + 클릭: 토글 (기존 선택 유지)
        clearConflictingSelections(isTargetEncrypted);
        const isSelected = element.classList.contains('selected');
        syncSelection(path, !isSelected);
        if (!isSelected) {
            lastSelectedPath = path;
        }
    } else {
        // 일반 클릭: 단일 선택 (기존 선택 해제)
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
        // Shift + 클릭: 범위 선택
        selectRange(lastSelectedPath, path, 'small-grid');
    } else if (event && event.ctrlKey) {
        // Ctrl + 클릭: 토글 (기존 선택 유지)
        clearConflictingSelections(isTargetEncrypted);
        const isSelected = element.classList.contains('selected');
        syncSelection(path, !isSelected);
        if (!isSelected) {
            lastSelectedPath = path;
        }
    } else {
        // 일반 클릭: 단일 선택 (기존 선택 해제)
        clearAllSelections();
        clearConflictingSelections(isTargetEncrypted);
        syncSelection(path, true);
        lastSelectedPath = path;
    }

    updateBar();
}

function selectRange(startPath, endPath, viewType) {
    // 현재 뷰의 모든 아이템 가져오기
    let items;
    if (viewType === 'grid') {
        items = Array.from(document.querySelectorAll('.file-card'));
    } else if (viewType === 'small-grid') {
        items = Array.from(document.querySelectorAll('.file-card-small'));
    } else {
        items = Array.from(document.querySelectorAll('.file-list-item'));
    }

    // 시작과 끝 인덱스 찾기
    let startIndex = items.findIndex(item => item.dataset.path === startPath);
    let endIndex = items.findIndex(item => item.dataset.path === endPath);

    if (startIndex === -1 || endIndex === -1) return;

    // 인덱스 정렬 (작은 것부터 큰 것으로)
    if (startIndex > endIndex) {
        [startIndex, endIndex] = [endIndex, startIndex];
    }

    // 범위 내 첫 번째 아이템의 암호화 상태 확인
    const firstItem = items[startIndex];
    let firstName;
    if (viewType === 'grid' || viewType === 'small-grid') {
        firstName = firstItem.querySelector('div:last-child').innerText.toLowerCase();
    } else {
        firstName = firstItem.querySelector('.file-name span:last-child').innerText.toLowerCase();
    }
    const isTargetEncrypted = firstName.endsWith('.dongin');

    // 기존 선택 해제 후 범위 선택
    clearAllSelections();
    clearConflictingSelections(isTargetEncrypted);

    // 범위 내 모든 아이템 선택
    for (let i = startIndex; i <= endIndex; i++) {
        const item = items[i];
        let itemName;
        if (viewType === 'grid' || viewType === 'small-grid') {
            itemName = item.querySelector('div:last-child').innerText.toLowerCase();
        } else {
            itemName = item.querySelector('.file-name span:last-child').innerText.toLowerCase();
        }
        const isItemEncrypted = itemName.endsWith('.dongin');

        // 암호화 상태가 같은 파일만 선택
        if (isItemEncrypted === isTargetEncrypted) {
            syncSelection(item.dataset.path, true);
        }
    }

    lastSelectedPath = endPath;
}

function updateBar() {
    // 현재 보기 모드에 따라 선택된 파일 확인
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

    // 미리보기 업데이트
    updatePreview();
}

/* --- 삭제 기능 --- */
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

/* --- 미리보기 패널 기능 --- */
function togglePreview() {
    const previewPane = document.getElementById('previewPane');
    const previewBtn = document.getElementById('previewToggleBtn');
    const previewResizer = document.getElementById('previewResizer');

    previewEnabled = !previewEnabled;

    if (previewEnabled) {
        // 버튼으로 켜면 항상 기본 크기로 복원
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

    // 리사이저 드래그 초기화
    initPreviewResizer();
}

/* --- 미리보기 리사이저 드래그 기능 --- */
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

        // 최소/최대 너비 제한
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

// 지원되는 미리보기 확장자
const previewableImageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'ico', 'svg'];
const previewablePdfExtensions = ['pdf'];

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

    // 현재 선택된 파일 가져오기
    let selectedFiles;
    if (viewMode === 'grid') {
        selectedFiles = document.querySelectorAll('.file-card.selected');
    } else if (viewMode === 'small-grid') {
        selectedFiles = document.querySelectorAll('.file-card-small.selected');
    } else {
        selectedFiles = document.querySelectorAll('.file-list-item.selected');
    }

    // 선택된 파일이 없거나 여러 개인 경우
    if (selectedFiles.length === 0) {
        showPreviewPlaceholder();
        return;
    }

    if (selectedFiles.length > 1) {
        showMultipleSelection(selectedFiles.length);
        return;
    }

    // 단일 파일 선택
    const selectedItem = selectedFiles[0];
    const filePath = selectedItem.dataset.path;
    const isDir = selectedItem.dataset.isDir === 'true';

    // 파일 이름 가져오기
    let fileName;
    if (selectedItem.classList.contains('file-card') || selectedItem.classList.contains('file-card-small')) {
        fileName = selectedItem.querySelector('div:last-child').innerText;
    } else {
        fileName = selectedItem.querySelector('.file-name span:last-child').innerText;
    }

    // 폴더인 경우
    if (isDir) {
        showFolderPreview(fileName);
        return;
    }

    // 이미지 파일인 경우
    if (isPreviewableImage(fileName)) {
        showImagePreview(fileName, filePath);
        return;
    }

    // PDF 파일인 경우
    if (isPreviewablePdf(fileName)) {
        showPdfPreview(fileName, filePath);
        return;
    }

    // 미리보기가 지원되지 않는 파일
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
            <div class="preview-file-details">
                폴더
            </div>
        </div>
    `;
}

async function showImagePreview(fileName, filePath) {
    const previewContent = document.getElementById('previewContent');

    // 로딩 표시
    previewContent.innerHTML = `
        <div class="preview-placeholder">
            <svg viewBox="0 0 24 24" width="48" height="48" class="loading-spinner">
                <path fill="currentColor" d="M12 4V2A10 10 0 0 0 2 12h2a8 8 0 0 1 8-8z"/>
            </svg>
            <p>로딩 중...</p>
        </div>
    `;

    try {
        // 파일 경로를 file:// URL로 변환
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
        // 파일 경로를 file:// URL로 변환
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

    // 파일 정보 가져오기
    let fileInfo = null;
    for (const file of originalFiles) {
        if (file.fullPath === filePath) {
            fileInfo = file;
            break;
        }
    }

    // 아이콘 결정
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

/* --- 튜토리얼 기능 --- */
let tutorialStep = 0;
let currentHighlightedElement = null;

const tutorialSteps = [
    {
        type: 'intro'
    },
    {
        target: '#sidebarMenu',
        message: '이 곳에서 원하는 경로를 선택할 수 있습니다.',
        position: 'right',
        highlightClass: 'tutorial-highlight-area'
    },
    {
        target: '.footer-icon[onclick="openSettings()"]',
        message: '프로그램의 설정을 관리합니다.',
        position: 'right'
    },
    {
        target: '.footer-icon[onclick="logout()"]',
        message: '이 버튼으로 로그아웃 할 수 있습니다.',
        position: 'right'
    },
    {
        target: '#backBtn',
        message: '이전 경로로 되돌아갑니다.',
        position: 'bottom'
    },
    {
        target: '.header-content',
        message: '현재 경로를 표시합니다.',
        position: 'bottom'
    },
    {
        target: '#previewToggleBtn',
        message: 'PDF와 이미지 파일의 미리보기를 사용할 수 있습니다.',
        position: 'bottom'
    },
    {
        target: '#viewToggleBtn',
        message: '보기 모드를 전환할 수 있습니다.',
        position: 'bottom'
    }
];

function startTutorial() {
    tutorialStep = 0;
    const overlay = document.getElementById('tutorialOverlay');
    const introModal = document.getElementById('tutorialIntroModal');
    const tooltip = document.getElementById('tutorialTooltip');

    overlay.classList.add('active');
    introModal.style.display = 'block';
    tooltip.classList.remove('active');
}

function nextTutorialStep() {
    tutorialStep++;

    // 이전 하이라이트 제거
    if (currentHighlightedElement) {
        currentHighlightedElement.classList.remove('tutorial-highlight', 'tutorial-highlight-area');
        currentHighlightedElement = null;
    }

    // 튜토리얼 종료
    if (tutorialStep >= tutorialSteps.length) {
        endTutorial();
        return;
    }

    const step = tutorialSteps[tutorialStep];
    const introModal = document.getElementById('tutorialIntroModal');
    const tooltip = document.getElementById('tutorialTooltip');
    const tooltipContent = document.getElementById('tutorialTooltipContent');
    const tooltipArrow = document.getElementById('tutorialTooltipArrow');

    // 초기 모달 숨기기
    introModal.style.display = 'none';

    // 타겟 요소 찾기
    const targetElement = document.querySelector(step.target);
    if (!targetElement) {
        nextTutorialStep();
        return;
    }

    // 하이라이트 적용
    const highlightClass = step.highlightClass || 'tutorial-highlight';
    targetElement.classList.add(highlightClass);
    currentHighlightedElement = targetElement;

    // 툴팁 내용 설정
    tooltipContent.innerText = step.message;

    // 툴팁 위치 계산
    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 280;
    const tooltipPadding = 15;

    // 화살표 방향 초기화
    tooltipArrow.className = 'tutorial-tooltip-arrow';

    let tooltipLeft, tooltipTop;

    switch (step.position) {
        case 'right':
            tooltipLeft = rect.right + tooltipPadding;
            tooltipTop = rect.top + (rect.height / 2) - 60;
            tooltipArrow.classList.add('left');
            break;
        case 'left':
            tooltipLeft = rect.left - tooltipWidth - tooltipPadding;
            tooltipTop = rect.top + (rect.height / 2) - 60;
            tooltipArrow.classList.add('right');
            break;
        case 'bottom':
            tooltipLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            tooltipTop = rect.bottom + tooltipPadding;
            tooltipArrow.classList.add('top');
            break;
        case 'top':
            tooltipLeft = rect.left + (rect.width / 2) - (tooltipWidth / 2);
            tooltipTop = rect.top - 120 - tooltipPadding;
            tooltipArrow.classList.add('bottom');
            break;
    }

    // 화면 밖으로 나가지 않도록 조정
    if (tooltipLeft < 10) tooltipLeft = 10;
    if (tooltipLeft + tooltipWidth > window.innerWidth - 10) {
        tooltipLeft = window.innerWidth - tooltipWidth - 10;
    }
    if (tooltipTop < 10) tooltipTop = 10;

    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = tooltipTop + 'px';
    tooltip.classList.add('active');
}

function endTutorial() {
    const overlay = document.getElementById('tutorialOverlay');
    const introModal = document.getElementById('tutorialIntroModal');
    const tooltip = document.getElementById('tutorialTooltip');

    // 하이라이트 제거
    if (currentHighlightedElement) {
        currentHighlightedElement.classList.remove('tutorial-highlight', 'tutorial-highlight-area');
        currentHighlightedElement = null;
    }

    overlay.classList.remove('active');
    introModal.style.display = 'none';
    tooltip.classList.remove('active');
    tutorialStep = 0;
}
