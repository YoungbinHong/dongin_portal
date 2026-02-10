const API_BASE = 'http://192.168.0.254:8000';

let currentRoom = '1';

document.addEventListener('DOMContentLoaded', () => {
    loadSavedTheme();
    initRoomList();
    initMessageInput();
    initSendButton();
});

function initRoomList() {
    const roomItems = document.querySelectorAll('.room-item');
    roomItems.forEach(item => {
        item.addEventListener('click', () => {
            const roomId = item.dataset.id;
            selectRoom(roomId);
        });
    });
}

function selectRoom(roomId) {
    currentRoom = roomId;

    document.querySelectorAll('.room-item').forEach(item => {
        item.classList.remove('active');
    });

    const selectedRoom = document.querySelector(`.room-item[data-id="${roomId}"]`);
    if (selectedRoom) {
        selectedRoom.classList.add('active');

        const roomName = selectedRoom.querySelector('.room-name').textContent;
        document.querySelector('.chat-title').textContent = roomName;

        const badge = selectedRoom.querySelector('.room-badge');
        if (badge) badge.remove();
    }
}

function initMessageInput() {
    const input = document.getElementById('messageInput');

    input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });

    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
}

function initSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    sendBtn.addEventListener('click', sendMessage);
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();

    if (!content) return;

    const messagesContainer = document.getElementById('chatMessages');
    const messageHTML = `
        <div class="message sent">
            <div class="message-content">
                <div class="message-text">${escapeHtml(content)}</div>
                <div class="message-time">방금 전</div>
            </div>
        </div>
    `;

    messagesContainer.insertAdjacentHTML('beforeend', messageHTML);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    input.value = '';
    input.style.height = 'auto';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function goHome() {
    localStorage.setItem('returnFromApp', 'card-chat');
    const overlay = document.getElementById('logoutOverlay');
    if (overlay) {
        overlay.classList.add('active');
        setTimeout(() => {
            window.location.href = '../menu.html';
        }, 400);
    } else {
        window.location.href = '../menu.html';
    }
}

function openSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('active');

    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) {
        themeSelect.value = localStorage.getItem('donginTheme') || 'light';
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.remove('active');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSettings();
    }
});
