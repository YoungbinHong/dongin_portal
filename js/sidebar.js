/* === 사이드바 자동 생성 === */
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