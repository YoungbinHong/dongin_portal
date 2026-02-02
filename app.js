/* --- 필수 모듈 가져오기 --- */
const fs = require('fs');
const fsPromises = require('fs').promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { exec } = require('child_process');

// 암호화 키 설정
const ALGORITHM = 'aes-256-cbc';
const SECRET_KEY = crypto.scryptSync('dongin-password', 'salt', 32);
const IV = Buffer.alloc(16, 0);

// 기본 경로: 바탕화면
let currentPath = path.join(os.homedir(), 'Desktop');

// 경로 히스토리 관리
let pathHistory = [];

// 작업 취소 플래그
let isCanceled = false;

// 완료 모달 타임아웃 ID
let completeTimeoutId = null;

/* --- 경로 관리 함수들 --- */
// 경로 변경 (히스토리에 추가)
function navigateTo(newPath, displayName = null) {
    if (currentPath !== newPath) {
        pathHistory.push(currentPath);
    }
    currentPath = newPath;

    // 뒤로가기 버튼 상태 업데이트
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        if (pathHistory.length > 0) {
            backBtn.classList.remove('disabled');
        } else {
            backBtn.classList.add('disabled');
        }
    }

    updateBreadcrumb(displayName);
    loadRealFiles(currentPath);
}

// 뒤로가기
function goBack() {
    if (pathHistory.length === 0) return;

    const previousPath = pathHistory.pop();
    currentPath = previousPath;

    // 뒤로가기 버튼 상태 업데이트
    const backBtn = document.getElementById('backBtn');
    if (pathHistory.length === 0) {
        backBtn.classList.add('disabled');
    }

    updateBreadcrumb();
    loadRealFiles(currentPath);
}

// Breadcrumb 업데이트
function updateBreadcrumb(displayName = null) {
    const pathBar = document.getElementById('pathBar');
    const headerTitle = document.getElementById('headerTitle');
    if (!pathBar || !headerTitle) return;

    const home = os.homedir();
    let pathParts = [];
    let currentDisplayPath = currentPath;

    // 특수 경로 처리
    if (currentPath.startsWith(home)) {
        const relativePath = currentPath.substring(home.length).replace(/^[\\\/]/, '');

        if (relativePath === 'Desktop') {
            pathParts = [{ name: '내 PC', path: home }, { name: '바탕 화면', path: currentPath }];
            headerTitle.innerText = '바탕 화면';
        } else if (relativePath === 'Downloads') {
            pathParts = [{ name: '내 PC', path: home }, { name: '다운로드', path: currentPath }];
            headerTitle.innerText = '다운로드';
        } else if (relativePath === 'Documents') {
            pathParts = [{ name: '내 PC', path: home }, { name: '문서', path: currentPath }];
            headerTitle.innerText = '문서';
        } else if (relativePath === 'Pictures') {
            pathParts = [{ name: '내 PC', path: home }, { name: '사진', path: currentPath }];
            headerTitle.innerText = '사진';
        } else if (relativePath === 'Videos') {
            pathParts = [{ name: '내 PC', path: home }, { name: '동영상', path: currentPath }];
            headerTitle.innerText = '동영상';
        } else if (relativePath === 'Music') {
            pathParts = [{ name: '내 PC', path: home }, { name: '음악', path: currentPath }];
            headerTitle.innerText = '음악';
        } else if (relativePath.startsWith('OneDrive')) {
            const oneDriveName = relativePath.split(path.sep)[0];
            const subPath = relativePath.substring(oneDriveName.length).replace(/^[\\\/]/, '');

            if (subPath) {
                // OneDrive 하위 폴더
                const subParts = subPath.split(path.sep);
                pathParts = [{ name: '내 PC', path: home }, { name: oneDriveName, path: path.join(home, oneDriveName) }];

                let accumulatedPath = path.join(home, oneDriveName);
                subParts.forEach(part => {
                    accumulatedPath = path.join(accumulatedPath, part);
                    pathParts.push({ name: part, path: accumulatedPath });
                });

                headerTitle.innerText = subParts[subParts.length - 1];
            } else {
                // OneDrive 루트
                pathParts = [{ name: '내 PC', path: home }, { name: oneDriveName, path: currentPath }];
                headerTitle.innerText = oneDriveName;
            }
        } else {
            // 기타 홈 하위 경로
            const parts = relativePath.split(path.sep).filter(p => p);
            pathParts = [{ name: '내 PC', path: home }];

            let accumulatedPath = home;
            parts.forEach(part => {
                accumulatedPath = path.join(accumulatedPath, part);
                pathParts.push({ name: part, path: accumulatedPath });
            });

            headerTitle.innerText = parts[parts.length - 1] || '내 PC';
        }
    } else if (currentPath.match(/^[A-Z]:\\/i)) {
        // C:\ 같은 드라이브
        const parts = currentPath.split(path.sep).filter(p => p);
        const driveLetter = parts[0];

        if (parts.length === 1) {
            pathParts = [{ name: '내 PC', path: home }, { name: `로컬 디스크 (${driveLetter})`, path: currentPath }];
            headerTitle.innerText = `로컬 디스크 (${driveLetter})`;
        } else {
            pathParts = [{ name: '내 PC', path: home }, { name: `로컬 디스크 (${driveLetter})`, path: driveLetter + path.sep }];

            let accumulatedPath = driveLetter + path.sep;
            for (let i = 1; i < parts.length; i++) {
                accumulatedPath = path.join(accumulatedPath, parts[i]);
                pathParts.push({ name: parts[i], path: accumulatedPath });
            }

            headerTitle.innerText = parts[parts.length - 1];
        }
    } else {
        pathParts = [{ name: currentPath, path: currentPath }];
        headerTitle.innerText = displayName || path.basename(currentPath);
    }

    // Breadcrumb HTML 생성
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

/* --- 1. 프로그램 시작 시 실행되는 곳 --- */
document.addEventListener('DOMContentLoaded', () => {
    console.log("프로그램 시작됨");
    loadSavedTheme();           // 0. 저장된 테마 불러오기
    loadNoticeSettings();       // 0-1. 저장된 알림 설정 불러오기
    initSidebar();              // 1. 사이드바 그려라!
    updateBreadcrumb();         // 2. 초기 경로 표시
    loadRealFiles(currentPath); // 3. 파일 목록 가져와라!
});

/* --- 알림 설정 관리 --- */
function loadNoticeSettings() {
    // 완료 알림 설정 (기본값: true)
    const noticeCompletion = localStorage.getItem('notice-completion') !== 'false';
    const notice1 = document.getElementById('notice1');
    if (notice1) {
        notice1.checked = noticeCompletion;
    }

    // 보안 알림 설정 (기본값: true)
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

/* --- 2. 사이드바 자동 생성 함수 (디자인 복구) --- */
function initSidebar() {
    const sidebar = document.getElementById('sidebarMenu');
    if (!sidebar) {
        console.error("에러: sidebarMenu라는 ID를 가진 태그를 못 찾겠습니다.");
        return;
    }

    const home = os.homedir();
    sidebar.innerHTML = ''; // 초기화

    // OneDrive 폴더들 자동 검색 (실제 사용 중인 폴더만)
    const oneDriveFolders = [];
    try {
        const homeFiles = fs.readdirSync(home);
        homeFiles.forEach(fileName => {
            // "OneDrive"로 시작하지만, 정확히 "OneDrive"만 있는 경우는 제외 (회사/학교 OneDrive만 추가)
            if (fileName.startsWith('OneDrive') && fileName !== 'OneDrive') {
                const fullPath = path.join(home, fileName);
                try {
                    if (fs.statSync(fullPath).isDirectory()) {
                        // 폴더가 실제로 접근 가능한지 확인
                        fs.accessSync(fullPath, fs.constants.R_OK);
                        oneDriveFolders.push({ name: fileName, path: fullPath, icon: '☁️' });
                    }
                } catch (accessErr) {
                    console.log(`OneDrive 폴더 접근 불가: ${fileName}`);
                }
            }
        });
    } catch (err) {
        console.error('OneDrive 폴더 검색 실패:', err);
    }

    // 메뉴 그룹 정의
    const groups = [
        {
            title: '즐겨찾기',
            items: [
                { name: '바탕 화면', path: path.join(home, 'Desktop'), icon: '🖥️' },
                { name: '다운로드', path: path.join(home, 'Downloads'), icon: '⬇️' },
                { name: '문서', path: path.join(home, 'Documents'), icon: '📄' },
                { name: '사진', path: path.join(home, 'Pictures'), icon: '🖼️' },
                { name: '동영상', path: path.join(home, 'Videos'), icon: '🎬' },
                { name: '음악', path: path.join(home, 'Music'), icon: '🎵' },
                ...oneDriveFolders  // OneDrive 폴더들 자동 추가
            ]
        },
        {
            title: '내 PC',
            items: [
                { name: '로컬 디스크 (C:)', path: 'C:\\', icon: '💾' }
            ]
        }
    ];

    groups.forEach(group => {
        // 섹션 제목 만들기
        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'sidebar-section';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'sidebar-title';
        titleDiv.innerText = group.title;
        sectionDiv.appendChild(titleDiv);

        let hasItem = false;

        // 아이템 만들기
        group.items.forEach(item => {
            if (fs.existsSync(item.path)) { // ★ 진짜 있는 폴더만 추가
                hasItem = true;
                const itemDiv = document.createElement('div');
                itemDiv.className = 'nav-item';
                if (item.name === '바탕 화면') itemDiv.classList.add('active');

                itemDiv.innerHTML = `<i>${item.icon}</i>${item.name}`;

                // 클릭 이벤트
                itemDiv.onclick = () => {
                    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                    itemDiv.classList.add('active');

                    navigateTo(item.path, item.name);
                };

                sectionDiv.appendChild(itemDiv);
            }
        });

        // 아이템이 하나라도 있으면 화면에 붙이기
        if (hasItem) {
            sidebar.appendChild(sectionDiv);
        }
    });
}

/* --- 3. 실제 파일 목록 불러오기 --- */
function loadRealFiles(targetPath) {
    const grid = document.getElementById('fileGrid');
    if(!grid) return;

    fs.readdir(targetPath, (err, files) => {
        if (err) {
            grid.innerHTML = '<div style="padding:20px; color:#999;">폴더를 열 수 없습니다.</div>';
            return;
        }

        grid.innerHTML = '';

        files.forEach(fileName => {
            // 숨김파일, 시스템파일, 임시파일 제외
            if (fileName.startsWith('.') ||           // 숨김 파일 (예: .git, .DS_Store)
                fileName.startsWith('$') ||           // 시스템 파일 (예: $RECYCLE.BIN)
                fileName.startsWith('~$') ||          // 오피스 임시파일 (예: ~$file.xlsx)
                fileName === 'desktop.ini' ||         // Windows 바탕화면 설정
                fileName === 'Thumbs.db' ||           // Windows 썸네일 캐시
                fileName.endsWith('.lnk')) return;    // 바로가기 파일

            const fullPath = path.join(targetPath, fileName);
            let isDir = false;
            try { isDir = fs.statSync(fullPath).isDirectory(); } catch(e) {}

            let icon = '📄';
            if (isDir) icon = '📁';
            else if (fileName.endsWith('.png') || fileName.endsWith('.jpg')) icon = '🖼️';
            else if (fileName.endsWith('.pdf')) icon = '📕';
            else if (fileName.endsWith('.dongin')) icon = '🔒';

            const div = document.createElement('div');
            div.className = 'file-card';

            div.onclick = function() { toggleSelect(this); };
            div.ondblclick = function() {
                if (isDir) {
                    navigateTo(fullPath, fileName);
                } else {
                    openFile(fullPath);
                }
            };

            div.innerHTML = `
                <div style="font-size: 40px; margin-bottom: 10px;">${icon}</div>
                <div style="font-size: 14px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${fileName}</div>
            `;
            grid.appendChild(div);
        });
    });
}

/* --- 4. 기능: 파일 열기 --- */
function openFile(filePath) {
    if (!fs.existsSync(filePath)) {
        alert('파일을 찾을 수 없습니다.');
        return;
    }

    // 암호화된 파일은 열지 않음
    if (filePath.toLowerCase().endsWith('.dongin')) {
        alert('암호화된 파일은 먼저 복호화해주세요.');
        return;
    }

    // OS별로 기본 프로그램으로 파일 열기
    const platform = os.platform();
    let command;

    if (platform === 'win32') {
        // Windows: start 명령어 사용
        command = `start "" "${filePath}"`;
    } else if (platform === 'darwin') {
        // macOS: open 명령어 사용
        command = `open "${filePath}"`;
    } else {
        // Linux: xdg-open 명령어 사용
        command = `xdg-open "${filePath}"`;
    }

    exec(command, (error) => {
        if (error) {
            console.error('파일 열기 오류:', error);
            alert('파일을 열 수 없습니다.');
        }
    });
}

// 선택된 파일/폴더 열기
function openSelectedFiles() {
    const selectedFiles = document.querySelectorAll('.file-card.selected');
    if (selectedFiles.length === 0) {
        alert('파일을 선택해주세요.');
        return;
    }

    // 1개만 선택했을 때만 실행 (버튼 비활성화로 제어되지만 추가 안전장치)
    if (selectedFiles.length > 1) {
        alert('한 번에 하나의 항목만 열 수 있습니다.');
        return;
    }

    const card = selectedFiles[0];
    const fileName = card.querySelector('div:last-child').innerText;
    const fullPath = path.join(currentPath, fileName);

    try {
        if (fs.statSync(fullPath).isDirectory()) {
            // 폴더인 경우: 폴더 안으로 진입
            navigateTo(fullPath, fileName);
        } else {
            // 파일인 경우: 기본 프로그램으로 열기
            openFile(fullPath);
        }
    } catch (err) {
        console.error('열기 오류:', err);
        alert('항목을 열 수 없습니다.');
    }
}

/* --- 5. 프로그레스바 제어 --- */
function showProgress(title, status) {
    const modal = document.getElementById('modalOverlay');
    const progressContent = document.getElementById('progressContent');

    // 다른 모달 숨기기
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
        alert('작업이 취소되었습니다.');
        loadRealFiles(currentPath);
        updateBar();
    }, 100);
}

/* --- 6. 기능: 암호화/복호화 실행 (비동기) --- */
async function handleExecution() {
    const selectedFiles = document.querySelectorAll('.file-card.selected');
    if (selectedFiles.length === 0) return alert('파일을 선택해주세요.');

    // 파일 목록 추출
    const fileList = Array.from(selectedFiles).map(card => {
        const fileName = card.querySelector('div:last-child').innerText;
        return {
            name: fileName,
            path: path.join(currentPath, fileName)
        };
    });

    const totalFiles = fileList.length;
    const isEncrypting = !fileList[0].name.endsWith('.dongin');

    // 프로그레스바 표시
    isCanceled = false;
    showProgress(
        isEncrypting ? '파일 암호화 중' : '파일 복호화 중',
        `${totalFiles}개 파일 처리 중...`
    );

    let processedCount = 0;

    // 파일을 하나씩 순차 처리
    for (const file of fileList) {
        if (isCanceled) {
            console.log('작업이 취소되었습니다.');
            break;
        }

        try {
            if (file.name.endsWith('.dongin')) {
                // 복호화
                const encryptedData = await fsPromises.readFile(file.path);
                const decipher = crypto.createDecipheriv(ALGORITHM, SECRET_KEY, IV);
                let decrypted = decipher.update(encryptedData);
                decrypted = Buffer.concat([decrypted, decipher.final()]);

                // 헤더에서 원래 확장자 추출 (처음 2바이트: 확장자 길이, 그 다음: 확장자)
                const extLength = decrypted.readUInt16LE(0);
                const originalExt = decrypted.slice(2, 2 + extLength).toString('utf8');
                const originalData = decrypted.slice(2 + extLength);

                // 원래 파일명 복원: test.dongin → test.pdf
                const baseName = file.name.replace('.dongin', '');
                const originalName = baseName + originalExt;
                const outputPath = path.join(currentPath, originalName);
                await fsPromises.writeFile(outputPath, originalData);
                await fsPromises.unlink(file.path);
            } else {
                // 암호화
                const data = await fsPromises.readFile(file.path);

                // 원래 확장자 추출 및 헤더 생성
                const ext = path.extname(file.name); // 예: ".pdf"
                const extBuffer = Buffer.from(ext, 'utf8');
                const extLengthBuffer = Buffer.alloc(2);
                extLengthBuffer.writeUInt16LE(extBuffer.length, 0);

                // 헤더(확장자 길이 + 확장자) + 원본 데이터를 함께 암호화
                const dataWithHeader = Buffer.concat([extLengthBuffer, extBuffer, data]);

                const cipher = crypto.createCipheriv(ALGORITHM, SECRET_KEY, IV);
                let encrypted = cipher.update(dataWithHeader);
                encrypted = Buffer.concat([encrypted, cipher.final()]);

                // 새 파일명: test.pdf → test.dongin (확장자만 .dongin으로 교체)
                const baseName = path.basename(file.name, ext); // 확장자 제외한 이름
                const newFileName = baseName + '.dongin';
                const outputPath = path.join(currentPath, newFileName);

                await fsPromises.writeFile(outputPath, encrypted);
                await fsPromises.unlink(file.path);
            }

            processedCount++;
            const progress = (processedCount / totalFiles) * 100;
            updateProgress(progress);

            // UI 업데이트를 위한 짧은 대기
            await new Promise(resolve => setTimeout(resolve, 50));

        } catch (err) {
            console.error(`오류: ${file.name} 처리 실패`, err);
            hideProgress();
            alert(`오류: ${file.name} 처리 실패\n${err.message}`);
            break;
        }
    }

    // 완료 처리
    if (!isCanceled) {
        updateProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
        hideProgress();
        showCompletionModal(`${processedCount}개 파일이 처리되었습니다.`);
    }

    // 파일 목록 새로고침
    loadRealFiles(currentPath);
    updateBar();
}

/* --- 7. UI 보조 함수들 --- */
function toggleSelect(element) {
    // 1. 현재 클릭한 파일이 암호화된 파일(.dongin)인지 확인
    const currentName = element.querySelector('div:last-child').innerText.toLowerCase();
    const isTargetEncrypted = currentName.endsWith('.dongin');

    // 2. 이미 선택된 파일들을 검사하여 충돌되는 파일 해제
    const selectedFiles = document.querySelectorAll('.file-card.selected');

    selectedFiles.forEach(file => {
        const fileName = file.querySelector('div:last-child').innerText.toLowerCase();
        const isFileEncrypted = fileName.endsWith('.dongin');

        // 클릭한 것과 성격이 다르면(암호화 vs 일반) 기존 선택을 해제
        if (isTargetEncrypted !== isFileEncrypted) {
            file.classList.remove('selected');
        }
    });

    // 3. 현재 클릭한 파일의 선택 상태 토글
    element.classList.toggle('selected');
    updateBar();
}

function updateBar() {
    const selectedFiles = document.querySelectorAll('.file-card.selected');
    const count = selectedFiles.length;
    const actionBar = document.getElementById('actionBar');
    const executeBtn = document.getElementById('executeBtn');
    const openBtn = document.getElementById('openBtn');

    if (actionBar && executeBtn && openBtn) {
        if (count > 0) {
            actionBar.classList.add('show');
            document.getElementById('count').innerText = count;

            // 선택된 파일 중 .dongin 파일이 있는지 확인
            const hasEncrypted = Array.from(selectedFiles).some(card =>
                card.querySelector('div:last-child').innerText.toLowerCase().endsWith('.dongin')
            );

            // 버튼 텍스트 변경
            executeBtn.innerText = hasEncrypted ? "복호화 실행" : "암호화 실행";

            // "열기" 버튼: 암호화되지 않은 파일 1개만 선택했을 때만 활성화
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

// 에러 방지용 빈 함수들
function deleteFiles() { alert("삭제 기능은 안전을 위해 비활성화됨"); }
function openSettings() {
    const modal = document.getElementById('modalOverlay');
    const settingsContent = document.getElementById('settingsContent');

    // 다른 모달 숨기기
    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');

    // 설정 모달 보이기
    modal.style.display = 'flex';
    settingsContent.style.display = 'flex';
}

// 설정 탭 전환
function switchTab(event, tabName) {
    // 모든 탭 숨기기
    document.querySelectorAll('.settings-tab').forEach(tab => {
        tab.classList.remove('active');
    });

    // 모든 메뉴 항목 비활성화
    document.querySelectorAll('.settings-menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // 선택한 탭 표시
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // 선택한 메뉴 항목 활성화
    event.currentTarget.classList.add('active');
}
function logout() {
    const modal = document.getElementById('modalOverlay');
    const logoutContent = document.getElementById('logoutContent');

    // 다른 모달 숨기기
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    // 로그아웃 모달 보이기
    modal.style.display = 'flex';
    logoutContent.style.display = 'block';
}

// 파일 처리 완료 모달 표시
function showCompletionModal(message) {
    // 알림 설정 확인 - 비활성화되어 있으면 표시하지 않음
    const noticeEnabled = localStorage.getItem('notice-completion') !== 'false';
    if (!noticeEnabled) {
        console.log('완료 알림이 비활성화되어 있습니다:', message);
        return;
    }

    // 타임아웃 취소 (이전이 있으면)
    if (completeTimeoutId) {
        clearTimeout(completeTimeoutId);
        completeTimeoutId = null;
    }

    const modal = document.getElementById('modalOverlay');
    const completeContent = document.getElementById('completeContent');

    // 다른 모달 숨기기
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');

    // 완료 모달 보이기
    modal.style.display = 'flex';
    completeContent.style.display = 'block';
    document.getElementById('completeMsg').innerText = message;

    // 3초 후 자동으로 닫기
    completeTimeoutId = setTimeout(() => {
        if (completeContent.style.display !== 'none') {
            closeModal();
        }
    }, 3000);
}

function closeModal() {
    // 완료 모달 타임아웃 취소
    if (completeTimeoutId) {
        clearTimeout(completeTimeoutId);
        completeTimeoutId = null;
    }
    document.getElementById('modalOverlay').style.display = 'none';
}

/* --- 서버 연결 상태 관리 --- */
let serverConnected = true;

function updateServerStatus() {
    // 나중에 실제 서버 통신 코드로 변경
    // 현재는 항상 연결됨으로 표시
    serverConnected = true;

    const statusElement = document.getElementById('serverStatus');
    const container = document.getElementById('serverStatusContainer');

    if (statusElement && container) {
        if (serverConnected) {
            statusElement.textContent = '📶';
            container.style.opacity = '1';
            document.getElementById('serverTooltip').textContent = '서버와 연결되었습니다.';
        } else {
            statusElement.textContent = '📡';
            container.style.opacity = '0.6';
            document.getElementById('serverTooltip').textContent = '서버 연결이 끊어졌습니다.';
        }
    }
}

function showServerTooltip() {
    const tooltip = document.getElementById('serverTooltip');
    if (tooltip) {
        tooltip.style.display = 'block';
    }
}

function hideServerTooltip() {
    const tooltip = document.getElementById('serverTooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
}

// 페이지 로드 후 1초마다 서버 상태 갱신
document.addEventListener('DOMContentLoaded', () => {
    updateServerStatus(); // 초기 상태 설정
    setInterval(updateServerStatus, 1000); // 1초마다 갱신
    checkAutoStartStatus(); // 자동 실행 상태 확인
});

/* --- 윈도우 시작 시 자동 실행 관리 --- */
const APP_NAME = 'DonginSecure';
const REG_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

// 현재 자동 실행 상태 확인
function checkAutoStartStatus() {
    const checkbox = document.getElementById('autoStartCheckbox');
    if (!checkbox) return;

    exec(`reg query "${REG_KEY}" /v "${APP_NAME}"`, (error, stdout) => {
        if (error) {
            // 레지스트리에 없음 = 자동 실행 비활성화
            checkbox.checked = false;
        } else {
            // 레지스트리에 있음 = 자동 실행 활성화
            checkbox.checked = true;
        }
    });
}

// 자동 실행 토글
function toggleAutoStart(enabled) {
    const exePath = process.execPath;

    if (enabled) {
        // 레지스트리에 추가
        exec(`reg add "${REG_KEY}" /v "${APP_NAME}" /t REG_SZ /d "${exePath}" /f`, (error) => {
            if (error) {
                console.error('자동 실행 등록 실패:', error);
                alert('자동 실행 등록에 실패했습니다.');
                document.getElementById('autoStartCheckbox').checked = false;
            } else {
                console.log('자동 실행 등록 완료');
            }
        });
    } else {
        // 레지스트리에서 삭제
        exec(`reg delete "${REG_KEY}" /v "${APP_NAME}" /f`, (error) => {
            if (error) {
                console.error('자동 실행 해제 실패:', error);
            } else {
                console.log('자동 실행 해제 완료');
            }
        });
    }
}
