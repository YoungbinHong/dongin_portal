const API_BASE = 'http://192.168.0.254:8000';

const db = new ChatDB();
const store = new ChatStore();
const ws = new ChatWebSocket();
const ui = new ChatUI();

let typingTimeout = null;
let currentUserId = null;

document.addEventListener('DOMContentLoaded', async () => {
    loadSavedTheme();

    try {
        await initializeApp();
    } catch (err) {
        console.error('Failed to initialize:', err);
        showErrorModal('초기화 실패', err.message);
    }
});

async function initializeApp() {
    await db.init();

    const token = localStorage.getItem('access_token');
    if (!token) {
        showErrorModal('인증 필요', '로그인이 필요합니다.');
        setTimeout(() => window.location.href = '../login.html', 2000);
        return;
    }

    try {
        const userRes = await fetch(`${API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!userRes.ok) {
            throw new Error('사용자 정보를 가져올 수 없습니다.');
        }

        const userInfo = await userRes.json();
        currentUserId = userInfo.id;
        store.setCurrentUser(userInfo);
    } catch (err) {
        console.error('Failed to get user info:', err);
        showErrorModal('인증 실패', err.message);
        setTimeout(() => window.location.href = '../login.html', 2000);
        return;
    }

    initStoreListeners();

    await loadRoomsFromDB();
    await loadRoomsFromServer();

    initWebSocket(token);
    initEventListeners();

    setTimeout(() => {
        document.querySelector('.sidebar')?.classList.add('show');
        document.querySelector('.main')?.classList.add('show');
    }, 100);
}

async function loadRoomsFromDB() {
    const rooms = await db.getRooms();
    if (rooms.length > 0) {
        store.setRooms(rooms);
    }
}

async function loadRoomsFromServer() {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE}/api/chat/rooms`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) throw new Error('Failed to load rooms');

        const rooms = await response.json();
        store.setRooms(rooms);

        for (const room of rooms) {
            await db.saveRoom(room);
        }
    } catch (err) {
        console.error('Failed to load rooms from server:', err);
    }
}

function initWebSocket(token) {
    ws.connect(token);

    ws.on('connected', () => {
        console.log('Connected to chat server');
        ui.showConnectionStatus(true);
        syncOfflineMessages();
    });

    ws.on('disconnected', () => {
        console.log('Disconnected from chat server');
        ui.showConnectionStatus(false);
    });

    ws.on('message', async (data) => {
        const message = data;

        const room = store.rooms.find(r => r.id === message.room_id);
        if (room && room.hidden) {
            room.hidden = false;
            store.updateRoom(message.room_id, { hidden: false });
            await db.saveRoom(room);
        }

        store.addMessage(message.room_id, message);
        await db.saveMessage(message);

        if (message.room_id !== store.currentRoomId) {
            store.incrementUnreadCount(message.room_id);
        }

        if (message.user_id !== currentUserId && window.api?.showNotification) {
            const currentRoom = store.getCurrentRoom();
            if (currentRoom && document.hidden) {
                window.api.showNotification(currentRoom.name, message.content, message.room_id);
            }
        }
    });

    ws.on('typing', (data) => {
        if (data.status === 'start') {
            store.addTypingUser(data.room_id, data.user_id, data.user_name);
        } else {
            store.removeTypingUser(data.room_id, data.user_id);
        }
    });

    ws.on('read', (data) => {
        const messages = store.getMessages(data.room_id);
        const message = messages.find(m => m.id === data.message_id);
        if (message) {
            if (!message.read_by) message.read_by = [];
            if (!message.read_by.includes(data.user_id)) {
                message.read_by.push(data.user_id);
                store.updateMessage(data.room_id, data.message_id, { read_by: message.read_by });
            }
        }
    });

    ws.on('room_created', async (data) => {
        await db.saveRoom(data);
        store.addRoom(data);
    });

    ws.on('ping', () => {});

    ws.on('error', (data) => {
        console.error('WebSocket error:', JSON.stringify(data, null, 2));
    });
}

async function syncOfflineMessages() {
    const queue = await db.getOfflineQueue();

    for (const queuedMsg of queue) {
        const sent = ws.send({
            type: 'message',
            room_id: queuedMsg.room_id,
            content: queuedMsg.content
        });

        if (sent) {
            await db.removeFromOfflineQueue(queuedMsg.temp_id);
        }
    }

    const lastId = await db.getLastMessageId();
    if (lastId) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE}/api/chat/sync?last_id=${lastId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const newMessages = await response.json();
                for (const msg of newMessages) {
                    store.addMessage(msg.room_id, msg);
                    await db.saveMessage(msg);
                }
            }
        } catch (err) {
            console.error('Failed to sync messages:', err);
        }
    }
}

function initEventListeners() {
    const roomItems = document.querySelectorAll('.room-item');
    roomItems.forEach(item => {
        item.addEventListener('click', () => selectRoom(item.dataset.id));
    });

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            ui.filterRooms(e.target.value);
        });
    }

    const messageInput = document.getElementById('messageInput');
    if (messageInput) {
        messageInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = this.scrollHeight + 'px';

            handleTyping();
        });

        messageInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }

    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettings();
            closeModal();
        }
    });

    const fileBtn = document.querySelector('.input-btn[title="파일 첨부"]');
    if (fileBtn) {
        fileBtn.onclick = async () => {
            if (!store.currentRoomId) return;
            const result = await openFileBrowser({ mode: 'file', multiSelect: true });
            if (!result.success) return;
            for (const file of result.files) {
                await uploadFileByPath(file.path, file.name, file.size);
            }
        };
    }
}

function initStoreListeners() {
    store.subscribe((event, data) => {
        switch (event) {
            case 'rooms_updated':
                ui.renderRoomList(data, store.currentUser);
                attachRoomClickListeners();
                break;

            case 'room_selected':
                ui.hideEmptyState();
                loadRoomMessages(data);
                break;

            case 'messages_updated':
                if (data.roomId === store.currentRoomId) {
                    ui.hideEmptyState();
                    const room1 = store.getCurrentRoom();
                    ui.renderMessages(data.messages, currentUserId, room1);
                }
                break;

            case 'message_added':
                if (data.roomId === store.currentRoomId) {
                    ui.hideEmptyState();
                    const messages = store.getMessages(data.roomId);
                    const room2 = store.getCurrentRoom();
                    ui.renderMessages(messages, currentUserId, room2);
                }
                break;

            case 'typing_updated':
                if (data.roomId === store.currentRoomId) {
                    const filtered = data.users.filter(u => u.id !== currentUserId);
                    ui.renderTypingIndicator(filtered);
                }
                break;

            case 'unread_updated':
                ui.updateUnreadBadge(data.roomId, data.count);
                break;
        }
    });
}

function attachRoomClickListeners() {
    const roomItems = document.querySelectorAll('.room-item');
    roomItems.forEach(item => {
        item.addEventListener('click', () => selectRoom(item.dataset.id));
    });
}

async function selectRoom(roomId) {
    store.setCurrentRoom(roomId);
    ui.setActiveRoom(roomId);

    const room = store.getCurrentRoom();
    ui.updateChatHeader(room, store.currentUser);

    store.clearUnreadCount(roomId);

    ws.send({
        type: 'join_room',
        room_id: roomId
    });
}

async function loadRoomMessages(roomId) {
    let messages = await db.getMessages(roomId);

    if (messages.length === 0) {
        try {
            const token = localStorage.getItem('access_token');
            const response = await fetch(`${API_BASE}/api/chat/rooms/${roomId}/messages?limit=50`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                messages = await response.json();
                for (const msg of messages) {
                    await db.saveMessage(msg);
                }
            }
        } catch (err) {
            console.error('Failed to load messages:', err);
        }
    }

    store.setMessages(roomId, messages);

    const messageIds = messages.map(m => m.id);
    if (messageIds.length > 0) {
        markAsRead(roomId, messageIds);
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content || !store.currentRoomId) return;

    const tempMessage = {
        id: `temp_${Date.now()}`,
        room_id: store.currentRoomId,
        user_id: currentUserId,
        user_name: store.currentUser?.name || 'You',
        content,
        type: 'text',
        created_at: new Date().toISOString(),
        pending: true
    };

    store.addMessage(store.currentRoomId, tempMessage);

    const sent = ws.send({
        type: 'message',
        room_id: store.currentRoomId,
        content
    });

    if (!sent) {
        await db.saveToOfflineQueue({
            room_id: store.currentRoomId,
            content
        });
    }

    input.value = '';
    input.style.height = 'auto';

    stopTyping();
}

function handleTyping() {
    if (!store.currentRoomId) return;

    ws.send({
        type: 'typing',
        room_id: store.currentRoomId,
        status: 'start'
    });

    if (typingTimeout) {
        clearTimeout(typingTimeout);
    }

    typingTimeout = setTimeout(() => {
        stopTyping();
    }, 3000);
}

function stopTyping() {
    if (!store.currentRoomId) return;

    ws.send({
        type: 'typing',
        room_id: store.currentRoomId,
        status: 'stop'
    });

    if (typingTimeout) {
        clearTimeout(typingTimeout);
        typingTimeout = null;
    }
}

async function markAsRead(roomId, messageIds) {
    try {
        const token = localStorage.getItem('access_token');
        await fetch(`${API_BASE}/api/chat/read`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ room_id: roomId, message_ids: messageIds })
        });
    } catch (err) {
        console.error('Failed to mark as read:', err);
    }
}

async function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0 || !store.currentRoomId) return;

    for (const file of files) {
        if (file.size > 5 * 1024 * 1024) {
            showErrorModal('파일 크기 초과', '파일 크기는 5MB 이하여야 합니다.');
            continue;
        }

        await uploadFile(file);
    }

    e.target.value = '';
}

async function uploadFile(file) {
    try {
        const token = localStorage.getItem('access_token');
        const formData = new FormData();
        formData.append('file', file);
        formData.append('room_id', store.currentRoomId);

        const response = await fetch(`${API_BASE}/api/chat/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();

        ws.send({
            type: 'file',
            room_id: store.currentRoomId,
            file_id: result.file_id,
            metadata: {
                name: file.name,
                size: file.size,
                mime_type: file.type,
                url: result.url,
                thumbnail_url: result.thumbnail_url
            }
        });
    } catch (err) {
        console.error('Failed to upload file:', err);
        showErrorModal('파일 업로드 실패', err.message);
    }
}

function showHomeConfirm() {
    hideAllModals();
    document.getElementById('homeContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

function confirmGoToMenu() {
    closeModal();
    ws.close();
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = '../menu.html?from=chat';
        }, 400);
    } else {
        window.location.href = '../menu.html?from=chat';
    }
}

function hideAllModals() {
    document.querySelectorAll('.alert-modal').forEach(el => el.style.display = 'none');
}

function closeModal() {
    const modalOverlay = document.getElementById('modalOverlay');
    if (modalOverlay) modalOverlay.style.display = 'none';
    hideAllModals();
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.add('active');

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    if (modal) modal.classList.remove('active');
}

function showErrorModal(title, message) {
    const modalHTML = `
        <div class="alert-modal" id="errorModal">
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 15px; color: var(--text);">${title}</div>
            <div style="font-size: 14px; color: #636e72; line-height: 1.6; margin-bottom: 25px;">${message}</div>
            <button style="width: 100%; background: var(--accent); color: white; border: none; padding: 12px; border-radius: 14px; cursor: pointer; font-weight: 600;" onclick="closeModal()">확인</button>
        </div>
    `;

    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        hideAllModals();
        overlay.innerHTML += modalHTML;
        overlay.style.display = 'flex';
    }
}

let newChatEscHandler = null;
let userSearchKeyIndex = -1;

function openNewChatModal() {
    document.getElementById('newChatModal').style.display = 'flex';
    document.getElementById('userSearchInput').value = '';
    document.getElementById('userSearchResults').innerHTML = '';
    userSearchKeyIndex = -1;
    document.getElementById('userSearchInput').focus();
    searchUsers('');

    if (newChatEscHandler) document.removeEventListener('keydown', newChatEscHandler);
    newChatEscHandler = (e) => {
        if (e.key === 'Escape') closeNewChatModal();
    };
    document.addEventListener('keydown', newChatEscHandler);

    const searchInput = document.getElementById('userSearchInput');
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.dataset.listenerAttached = 'true';
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            userSearchKeyIndex = -1;
            if (searchTimeout) clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => searchUsers(query), 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            const items = document.querySelectorAll('#userSearchResults .user-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                userSearchKeyIndex = Math.min(userSearchKeyIndex + 1, items.length - 1);
                updateUserSearchKeySelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                userSearchKeyIndex = Math.max(userSearchKeyIndex - 1, 0);
                updateUserSearchKeySelection(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (userSearchKeyIndex >= 0 && items[userSearchKeyIndex]) {
                    items[userSearchKeyIndex].click();
                }
            }
        });
    }
}

function updateUserSearchKeySelection(items) {
    items.forEach((item, i) => {
        item.classList.toggle('keyboard-selected', i === userSearchKeyIndex);
    });
    if (items[userSearchKeyIndex]) {
        items[userSearchKeyIndex].scrollIntoView({ block: 'nearest' });
    }
}

function closeNewChatModal() {
    document.getElementById('newChatModal').style.display = 'none';
    if (newChatEscHandler) {
        document.removeEventListener('keydown', newChatEscHandler);
        newChatEscHandler = null;
    }
    userSearchKeyIndex = -1;
}

let searchTimeout = null;

async function searchUsers(query) {
    try {
        const token = localStorage.getItem('access_token');
        const response = await fetch(`${API_BASE}/api/users/search?q=${encodeURIComponent(query)}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('검색 실패');

        const users = await response.json();
        renderUserSearchResults(users, query === '');
    } catch (err) {
        console.error('Failed to search users:', err);
        document.getElementById('userSearchResults').innerHTML =
            '<div class="search-error">검색 중 오류가 발생했습니다.</div>';
    }
}

function renderUserSearchResults(users, limitToFour = false) {
    const resultsEl = document.getElementById('userSearchResults');

    if (users.length === 0) {
        resultsEl.innerHTML = '<div class="search-empty">검색 결과가 없습니다.</div>';
        return;
    }

    const displayUsers = limitToFour ? users.slice(0, 4) : users;
    resultsEl.innerHTML = displayUsers.map(user => `
        <div class="user-item" onclick="createDirectChat('${user.id}')">
            <div class="user-avatar">
                <svg viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
            </div>
            <div class="user-info">
                <div class="user-name">${ui.escapeHtml(user.name)}</div>
                <div class="user-email">${ui.escapeHtml(user.email)}</div>
            </div>
        </div>
    `).join('');
}

async function createDirectChat(targetUserId) {
    try {
        const token = localStorage.getItem('access_token');

        const response = await fetch(`${API_BASE}/api/chat/rooms`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: 'direct',
                member_ids: [targetUserId]
            })
        });

        if (!response.ok) throw new Error('대화 생성 실패');

        const room = await response.json();

        await loadRoomsFromServer();

        selectRoom(room.id);

        closeNewChatModal();

    } catch (err) {
        console.error('Failed to create direct chat:', err);
        showErrorModal('대화 생성 실패', err.message);
    }
}

async function hideRoom(roomId) {
    const room = store.rooms.find(r => r.id === roomId);
    if (!room) return;

    room.hidden = true;
    store.updateRoom(roomId, { hidden: true });
    await db.saveRoom(room);

    if (store.currentRoomId === roomId) {
        store.setCurrentRoom(null);
        ui.updateChatHeader(null, store.currentUser);
        ui.renderMessages([], currentUserId, null);
        ui.showEmptyState();
    }
}

function logout() {
    hideAllModals();
    document.getElementById('logoutContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function confirmLogout() {
    closeModal();
    const token = localStorage.getItem('access_token');
    if (token) {
        try {
            await fetch(`${API_BASE}/api/auth/logout`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch {}
    }
    localStorage.removeItem('access_token');
    ws.close();
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => { window.location.href = '../login.html?from=logout'; }, 600);
    } else {
        window.location.href = '../login.html?from=logout';
    }
}

async function uploadFileByPath(filePath, fileName, fileSize) {
    try {
        const token = localStorage.getItem('access_token');
        const bytes = await window.api.readFile(filePath);
        const blob = new Blob([bytes]);
        const file = new File([blob], fileName);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('room_id', store.currentRoomId);

        const response = await fetch(`${API_BASE}/api/chat/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (!response.ok) throw new Error('Upload failed');

        const result = await response.json();

        ws.send({
            type: 'file',
            room_id: store.currentRoomId,
            file_id: result.file_id,
            metadata: {
                name: fileName,
                size: fileSize,
                mime_type: result.mime_type || 'application/octet-stream',
                url: result.url,
                thumbnail_url: result.thumbnail_url
            }
        });
    } catch (err) {
        console.error('Failed to upload file:', err);
        showErrorModal('파일 업로드 실패', err.message);
    }
}

let fileBrowserState = {
    currentPath: '',
    history: [],
    historyIndex: -1,
    selectedFiles: [],
    mode: 'file',
    multiSelect: false,
    filters: [],
    resolve: null,
    reject: null,
    driveWatcherInterval: null,
    currentDrives: []
};

async function openFileBrowser(options = {}) {
    const { mode = 'file', multiSelect = false, filters = [], title = '파일 선택' } = options;

    fileBrowserState.mode = mode;
    fileBrowserState.multiSelect = multiSelect;
    fileBrowserState.filters = filters;
    fileBrowserState.selectedFiles = [];
    fileBrowserState.history = [];
    fileBrowserState.historyIndex = -1;

    document.getElementById('fileBrowserTitle').textContent = title;
    document.getElementById('fileBrowserSelection').textContent = '선택된 파일 없음';
    document.getElementById('fileBrowserConfirmBtn').disabled = true;

    const specialFolders = await window.api.getSpecialFolders();
    await chatNavigateToPath(specialFolders.desktop);
    await chatInitFileBrowserToolbar();
    chatStartDriveWatcher();

    document.getElementById('fileBrowserOverlay').style.display = 'flex';

    return new Promise((resolve, reject) => {
        fileBrowserState.resolve = resolve;
        fileBrowserState.reject = reject;
    });
}

function closeFileBrowser() {
    chatStopDriveWatcher();
    document.getElementById('fileBrowserOverlay').style.display = 'none';
    if (fileBrowserState.resolve) {
        fileBrowserState.resolve({ success: false, canceled: true });
        fileBrowserState.resolve = null;
        fileBrowserState.reject = null;
    }
}

async function chatNavigateToPath(path, addToHistory = true) {
    const loading = document.getElementById('fileBrowserLoading');
    const list = document.getElementById('fileBrowserList');
    loading.style.display = 'flex';
    list.style.display = 'none';

    try {
        const result = await window.api.readDirectory(path);
        if (!result.success) {
            loading.style.display = 'none';
            list.style.display = 'flex';
            return;
        }
        fileBrowserState.currentPath = path;
        if (addToHistory) {
            fileBrowserState.history = fileBrowserState.history.slice(0, fileBrowserState.historyIndex + 1);
            fileBrowserState.history.push(path);
            fileBrowserState.historyIndex = fileBrowserState.history.length - 1;
        }
        chatUpdateBreadcrumb();
        chatUpdateNavigationButtons();
        chatRenderFileList(result.files);
    } catch (e) {
    } finally {
        loading.style.display = 'none';
        list.style.display = 'flex';
    }
}

function chatRenderFileList(files) {
    const list = document.getElementById('fileBrowserList');
    list.innerHTML = '';
    const sorted = [...files].sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
    });
    for (const file of sorted) {
        const item = chatCreateFileItem(file);
        list.appendChild(item);
    }
}

function chatCreateFileItem(file) {
    const item = document.createElement('div');
    item.className = 'file-browser-item';

    const selectable = chatIsFileSelectable(file);
    if (!selectable && !file.isDirectory) item.classList.add('disabled');

    const icon = document.createElement('div');
    icon.className = 'file-browser-icon';
    if (file.isDirectory) {
        icon.classList.add('folder');
        icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>';
    } else {
        const ext = file.name.toLowerCase();
        if (ext.endsWith('.pdf')) {
            icon.classList.add('pdf');
            icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M20 2H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8.5 7.5c0 .83-.67 1.5-1.5 1.5H9v2H7.5V7H10c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V7H15c.83 0 1.5.67 1.5 1.5v3zm4-3H19v1h1.5V11H19v2h-1.5V7h3v1.5zM9 9.5h1v-1H9v1zM4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm10 5.5h1v-3h-1v3z"/></svg>';
        } else if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.gif') || ext.endsWith('.webp')) {
            icon.classList.add('image');
            icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>';
        } else {
            icon.innerHTML = '<svg viewBox="0 0 24 24"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>';
        }
    }

    const info = document.createElement('div');
    info.className = 'file-browser-info';
    const name = document.createElement('div');
    name.className = 'file-browser-name';
    name.textContent = file.name;
    const meta = document.createElement('div');
    meta.className = 'file-browser-meta';
    if (file.isDirectory) {
        meta.textContent = '폴더';
    } else {
        meta.textContent = chatFormatFileSize(file.size);
    }
    info.appendChild(name);
    info.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(info);

    if (file.isDirectory) {
        item.addEventListener('click', async () => {
            const fullPath = await window.api.joinPath(fileBrowserState.currentPath, file.name);
            await chatNavigateToPath(fullPath);
        });
    } else if (selectable) {
        item.addEventListener('click', () => chatHandleFileSelection(item, file));
    }
    return item;
}

function chatIsFileSelectable(file) {
    if (file.isDirectory) return false;
    if (fileBrowserState.filters.length === 0) return true;
    const ext = file.name.toLowerCase();
    return fileBrowserState.filters.some(f => ext.endsWith(`.${f}`));
}

function chatHandleFileSelection(itemElement, file) {
    if (fileBrowserState.multiSelect) {
        const index = fileBrowserState.selectedFiles.findIndex(
            f => f.name === file.name && f.dirPath === fileBrowserState.currentPath
        );
        if (index >= 0) {
            fileBrowserState.selectedFiles.splice(index, 1);
            itemElement.classList.remove('selected');
        } else {
            fileBrowserState.selectedFiles.push({ ...file, dirPath: fileBrowserState.currentPath });
            itemElement.classList.add('selected');
        }
    } else {
        document.querySelectorAll('#fileBrowserList .file-browser-item').forEach(el => el.classList.remove('selected'));
        fileBrowserState.selectedFiles = [{ ...file, dirPath: fileBrowserState.currentPath }];
        itemElement.classList.add('selected');
    }
    chatUpdateSelectionDisplay();
}

function chatUpdateSelectionDisplay() {
    const display = document.getElementById('fileBrowserSelection');
    const confirmBtn = document.getElementById('fileBrowserConfirmBtn');
    const count = fileBrowserState.selectedFiles.length;
    if (count === 0) {
        display.textContent = '선택된 파일 없음';
        confirmBtn.disabled = true;
    } else if (count === 1) {
        display.textContent = fileBrowserState.selectedFiles[0].name;
        confirmBtn.disabled = false;
    } else {
        display.textContent = `${count}개 파일 선택됨`;
        confirmBtn.disabled = false;
    }
}

async function chatUpdateBreadcrumb() {
    const breadcrumb = document.getElementById('fileBrowserBreadcrumb');
    const sep = await window.api.getPathSep();
    const parts = fileBrowserState.currentPath.split(sep).filter(p => p);
    breadcrumb.innerHTML = '';
    for (let i = 0; i < parts.length; i++) {
        if (i > 0) {
            const separator = document.createElement('span');
            separator.className = 'breadcrumb-separator';
            separator.textContent = '›';
            breadcrumb.appendChild(separator);
        }
        const item = document.createElement('div');
        item.className = 'breadcrumb-item';
        item.textContent = parts[i];
        let targetPath = parts.slice(0, i + 1).join(sep);
        if (sep === '\\' && i === 0) targetPath = targetPath + '\\';
        else if (sep === '/') targetPath = '/' + targetPath;
        const clickPath = targetPath;
        item.addEventListener('click', async () => { await chatNavigateToPath(clickPath); });
        breadcrumb.appendChild(item);
    }
}

function chatUpdateNavigationButtons() {
    const backBtn = document.getElementById('fileBrowserBackBtn');
    const upBtn = document.getElementById('fileBrowserUpBtn');
    backBtn.disabled = fileBrowserState.historyIndex <= 0;
    const isRoot = fileBrowserState.currentPath === '/' || /^[A-Z]:\\?$/i.test(fileBrowserState.currentPath);
    upBtn.disabled = isRoot;
}

async function fileBrowserGoBack() {
    if (fileBrowserState.historyIndex > 0) {
        fileBrowserState.historyIndex--;
        await chatNavigateToPath(fileBrowserState.history[fileBrowserState.historyIndex], false);
    }
}

async function fileBrowserGoUp() {
    const sep = await window.api.getPathSep();
    const parts = fileBrowserState.currentPath.split(sep).filter(p => p);
    if (parts.length > 1) {
        const parentPath = parts.slice(0, -1).join(sep);
        await chatNavigateToPath(sep === '\\' ? parentPath : '/' + parentPath);
    } else if (parts.length === 1 && sep === '\\') {
        await chatNavigateToPath(parts[0] + '\\');
    }
}

async function confirmFileBrowserSelection() {
    if (fileBrowserState.selectedFiles.length === 0) return;
    const result = { success: true, files: [] };
    for (const file of fileBrowserState.selectedFiles) {
        const fullPath = await window.api.joinPath(file.dirPath || fileBrowserState.currentPath, file.name);
        result.files.push({ path: fullPath, name: file.name, size: file.size });
    }
    if (fileBrowserState.resolve) {
        fileBrowserState.resolve(result);
        fileBrowserState.resolve = null;
        fileBrowserState.reject = null;
    }
    chatStopDriveWatcher();
    document.getElementById('fileBrowserOverlay').style.display = 'none';
}

async function chatInitFileBrowserToolbar() {
    const result = await window.api.getDrives();
    if (result.success && result.drives) {
        fileBrowserState.currentDrives = result.drives;
        chatUpdateDriveButtons(result.drives);
    }
}

function chatUpdateDriveButtons(drives) {
    const container = document.getElementById('fileBrowserDrives');
    container.innerHTML = '';
    if (drives && drives.length > 0) {
        for (const drive of drives) {
            const btn = document.createElement('button');
            btn.className = 'drive-btn';
            btn.textContent = drive;
            btn.onclick = () => fileBrowserGoToDrive(drive);
            container.appendChild(btn);
        }
    }
}

function chatStartDriveWatcher() {
    if (fileBrowserState.driveWatcherInterval) clearInterval(fileBrowserState.driveWatcherInterval);
    const checkDrives = async () => {
        const result = await window.api.getDrives();
        if (!result.success || !result.drives) return;
        if (JSON.stringify(result.drives) !== JSON.stringify(fileBrowserState.currentDrives)) {
            fileBrowserState.currentDrives = result.drives;
            chatUpdateDriveButtons(result.drives);
        }
    };
    checkDrives();
    fileBrowserState.driveWatcherInterval = setInterval(checkDrives, 1000);
}

function chatStopDriveWatcher() {
    if (fileBrowserState.driveWatcherInterval) {
        clearInterval(fileBrowserState.driveWatcherInterval);
        fileBrowserState.driveWatcherInterval = null;
    }
}

async function fileBrowserGoToSpecialFolder(name) {
    const specialFolders = await window.api.getSpecialFolders();
    const path = specialFolders[name];
    if (path) await chatNavigateToPath(path);
}

async function fileBrowserGoToDrive(drive) {
    await chatNavigateToPath(drive);
}

function chatFormatFileSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}
