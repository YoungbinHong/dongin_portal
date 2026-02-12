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

    const fileBtn = document.querySelector('.input-btn[title="파일 첨부"]');
    const fileInput = document.getElementById('fileInput');
    if (fileBtn && fileInput) {
        fileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileSelect);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeSettings();
        }
    });
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

function openNewChatModal() {
    document.getElementById('newChatModal').style.display = 'flex';
    document.getElementById('userSearchInput').value = '';
    document.getElementById('userSearchResults').innerHTML = '';
    document.getElementById('userSearchInput').focus();

    const searchInput = document.getElementById('userSearchInput');
    if (searchInput && !searchInput.dataset.listenerAttached) {
        searchInput.dataset.listenerAttached = 'true';
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();

            if (searchTimeout) clearTimeout(searchTimeout);

            if (query.length < 2) {
                document.getElementById('userSearchResults').innerHTML = '';
                return;
            }

            searchTimeout = setTimeout(() => searchUsers(query), 300);
        });
    }
}

function closeNewChatModal() {
    document.getElementById('newChatModal').style.display = 'none';
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
        renderUserSearchResults(users);
    } catch (err) {
        console.error('Failed to search users:', err);
        document.getElementById('userSearchResults').innerHTML =
            '<div class="search-error">검색 중 오류가 발생했습니다.</div>';
    }
}

function renderUserSearchResults(users) {
    const resultsEl = document.getElementById('userSearchResults');

    if (users.length === 0) {
        resultsEl.innerHTML = '<div class="search-empty">검색 결과가 없습니다.</div>';
        return;
    }

    resultsEl.innerHTML = users.map(user => `
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
