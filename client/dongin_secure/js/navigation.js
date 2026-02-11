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

function showHomeConfirm() {
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(m => m.style.display = 'none');
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();

    const pathname = window.location.pathname;
    const appMatch = pathname.match(/client[\/\\]dongin_([^\/\\]+)/);
    let targetUrl = '../menu.html';

    if (appMatch) {
        const appName = appMatch[1];
        targetUrl = `../menu.html?from=${appName}`;
    }

    const overlay = document.getElementById('logoutOverlay');
    overlay.classList.add('active');
    setTimeout(() => {
        window.location.href = targetUrl;
    }, 400);
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