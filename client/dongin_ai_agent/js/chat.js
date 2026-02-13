const API_BASE = 'http://192.168.0.254:8000';

let chatIdCounter = 0;
let currentChatId = 'local_1';
let chats = {
    'local_1': { title: '새 대화', messages: [] }
};
let currentUser = null;

function createNewChat() {
    chatIdCounter++;
    const newId = `local_${chatIdCounter}`;
    chats[newId] = { title: '새 대화', messages: [] };
    currentChatId = newId;
    renderChatHistory();
    clearMessages();
    const ws = document.getElementById('welcomeScreen');
    ws.classList.remove('hidden');
    ws.style.animation = 'none';
    ws.offsetHeight;
    ws.style.animation = '';
    document.getElementById('messageInput').focus();
    saveChats();
}

function selectChat(chatId) {
    currentChatId = chatId;
    renderChatHistory();
    renderMessages();
}

let pendingDeleteChatId = null;

function deleteChat(event, chatId) {
    event.stopPropagation();
    if (chatId.startsWith('local_')) {
        delete chats[chatId];
        if (currentChatId === chatId) {
            const remaining = Object.keys(chats);
            if (remaining.length > 0) {
                currentChatId = remaining[0];
            } else {
                chatIdCounter++;
                currentChatId = `local_${chatIdCounter}`;
                chats[currentChatId] = { title: '새 대화', messages: [] };
            }
        }
        renderChatHistory();
        renderMessages();
        return;
    }
    pendingDeleteChatId = chatId;
    document.querySelectorAll('.alert-modal, .settings-modal').forEach(el => el.style.display = 'none');
    document.getElementById('deleteChatContent').style.display = 'block';
    document.getElementById('modalOverlay').style.display = 'flex';
}

async function confirmDeleteChat() {
    const chatId = pendingDeleteChatId;
    pendingDeleteChatId = null;
    closeModal();
    try {
        const token = localStorage.getItem('access_token');
        await fetch(`${API_BASE}/api/ai/chat/history/${chatId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
        });
    } catch (e) {
        console.error('대화 삭제 실패:', e);
    }
    delete chats[chatId];
    if (currentChatId === chatId) {
        const remaining = Object.keys(chats);
        currentChatId = remaining.length > 0 ? remaining[0] : null;
        if (!currentChatId) {
            chatIdCounter++;
            currentChatId = `local_${chatIdCounter}`;
            chats[currentChatId] = { title: '새 대화', messages: [] };
        }
    }
    renderChatHistory();
    renderMessages();
}

function renderChatHistory() {
    const container = document.getElementById('chatHistory');
    const ids = Object.keys(chats);
    let html = '<div class="history-section"><div class="history-label">대화 목록</div>';
    ids.forEach(id => {
        const chat = chats[id];
        const activeClass = id === currentChatId ? 'active' : '';
        html += `
            <div class="history-item ${activeClass}" data-id="${id}" onclick="selectChat('${id}')">
                <span class="history-title">${chat.title}</span>
                <button class="history-delete" onclick="deleteChat(event, '${id}')">×</button>
            </div>
        `;
    });
    html += '</div>';
    container.innerHTML = html;
}

function clearMessages() {
    document.getElementById('messagesContainer').innerHTML = '';
}

function renderMessages() {
    const container = document.getElementById('messagesContainer');
    const welcome = document.getElementById('welcomeScreen');
    const messages = chats[currentChatId]?.messages || [];

    if (messages.length === 0) {
        welcome.classList.remove('hidden');
        container.innerHTML = '';
        return;
    }

    welcome.classList.add('hidden');
    let html = '';
    messages.forEach(msg => {
        html += createMessageHTML(msg.role, msg.content);
    });
    container.innerHTML = html;
    scrollToBottom();
}

function createMessageHTML(role, content) {
    const isUser = role === 'user';
    const avatarIcon = isUser
        ? '<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>';

    return `
        <div class="message ${role}">
            <div class="message-avatar">${avatarIcon}</div>
            <div class="message-content">${escapeHtml(content)}</div>
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML.replace(/\n/g, '<br>');
}

function addMessage(role, content) {
    chats[currentChatId].messages.push({ role, content });
    if (role === 'user' && chats[currentChatId].messages.length === 1) {
        chats[currentChatId].title = content.substring(0, 30) + (content.length > 30 ? '...' : '');
        renderChatHistory();
    }
    saveChats();
}

function showTypingIndicator() {
    const container = document.getElementById('messagesContainer');
    const html = `
        <div class="message ai" id="typingIndicator">
            <div class="message-avatar">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            </div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.remove();
}

function scrollToBottom() {
    const container = document.getElementById('chatContainer');
    container.scrollTop = container.scrollHeight;
}

let isStreaming = false;
let abortController = null;

function buildHistory() {
    const msgs = chats[currentChatId]?.messages || [];
    return msgs.map(m => ({ role: m.role === 'ai' ? 'assistant' : m.role, content: m.content }));
}

function createStreamingMessageEl() {
    const container = document.getElementById('messagesContainer');
    const html = `
        <div class="message ai" id="streamingMessage">
            <div class="message-avatar">
                <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            </div>
            <div class="message-content" id="streamingContent">
                <div class="typing-indicator"><span></span><span></span><span></span></div>
            </div>
        </div>
    `;
    container.insertAdjacentHTML('beforeend', html);
    scrollToBottom();
}

function showQueueStatus(position) {
    const streamEl = document.getElementById('streamingContent');
    if (!streamEl) return;
    const posEl = streamEl.querySelector('.queue-position');
    if (posEl) {
        posEl.textContent = position;
        return;
    }
    streamEl.innerHTML = `
        <div class="queue-indicator">
            <div class="queue-spinner"></div>
            <div class="queue-text">대기열 <span class="queue-position">${position}</span>번째</div>
            <div class="queue-sub">다른 사용자의 요청을 처리중입니다. 잠시만 기다려주세요.</div>
        </div>
    `;
    scrollToBottom();
}

function showProcessingStatus() {
    const streamEl = document.getElementById('streamingContent');
    if (!streamEl) return;
    streamEl.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
    scrollToBottom();
}

function toggleSendButton(isStop) {
    const btn = document.getElementById('sendBtn');
    const input = document.getElementById('messageInput');

    if (isStop) {
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M6 6h12v12H6z"/>
            </svg>
        `;
        btn.classList.add('stop-btn');
        btn.onclick = stopStreaming;
        input.disabled = true;
    } else {
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="20" height="20">
                <path fill="currentColor" d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
        `;
        btn.classList.remove('stop-btn');
        btn.onclick = sendMessage;
        input.disabled = false;
    }
}

function stopStreaming() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
    isStreaming = false;
    toggleSendButton(false);

    const streamEl = document.getElementById('streamingContent');
    if (streamEl && !streamEl.textContent.trim()) {
        const streamMsg = document.getElementById('streamingMessage');
        if (streamMsg) streamMsg.remove();
    }
}

async function sendMessage() {
    const input = document.getElementById('messageInput');
    const content = input.value.trim();
    if (!content || isStreaming) {
        console.log('[AI] blocked:', { content: !!content, isStreaming });
        return;
    }
    console.log('[AI] sendMessage 시작');

    document.getElementById('welcomeScreen').classList.add('hidden');

    addMessage('user', content);
    const container = document.getElementById('messagesContainer');
    container.insertAdjacentHTML('beforeend', createMessageHTML('user', content));
    scrollToBottom();

    input.value = '';
    input.style.height = 'auto';

    const history = buildHistory();

    isStreaming = true;
    toggleSendButton(true);
    createStreamingMessageEl();

    let fullResponse = '';
    const streamEl = document.getElementById('streamingContent');

    try {
        const token = localStorage.getItem('access_token');
        console.log('[AI] fetch 시작, token:', token ? '있음' : '없음');

        abortController = new AbortController();
        const sessionId = currentChatId.startsWith('local_') ? null : currentChatId;
        const res = await fetch(`${API_BASE}/api/ai/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ message: content, history, session_id: sessionId }),
            signal: abortController.signal
        });

        console.log('[AI] 응답 상태:', res.status, res.headers.get('content-type'));
        if (!res.ok) throw new Error(`API 요청 실패: ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            console.log('[AI] chunk:', JSON.stringify(chunk));
            buffer += chunk;
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;
                const jsonStr = line.slice(6).trim();
                if (!jsonStr) continue;

                try {
                    const data = JSON.parse(jsonStr);
                    if (data.type === 'queue') {
                        showQueueStatus(data.position);
                        continue;
                    }
                    if (data.type === 'processing') {
                        showProcessingStatus();
                        continue;
                    }
                    if (data.session_id && currentChatId.startsWith('local_')) {
                        const oldId = currentChatId;
                        currentChatId = data.session_id;
                        chats[currentChatId] = chats[oldId];
                        delete chats[oldId];
                    }
                    if (data.content) {
                        fullResponse += data.content;
                        streamEl.innerHTML = escapeHtml(fullResponse);
                        scrollToBottom();
                    }
                    if (data.done) break;
                } catch {}
            }
        }
    } catch (e) {
        console.error('[AI Chat Error]', e);
        if (e.name === 'AbortError') {
            console.log('[AI] 사용자가 중단함');
            if (!fullResponse) {
                const streamMsg = document.getElementById('streamingMessage');
                if (streamMsg) streamMsg.remove();
            } else {
                if (streamEl) {
                    streamEl.innerHTML = escapeHtml(fullResponse) + '<br><em style="color: #999; font-size: 12px;">(중단됨)</em>';
                }
            }
        } else if (!fullResponse) {
            fullResponse = '서버 연결에 실패했습니다. 잠시 후 다시 시도해주세요.';
            if (streamEl) streamEl.innerHTML = escapeHtml(fullResponse);
        }
    }

    const streamMsg = document.getElementById('streamingMessage');
    if (streamMsg) streamMsg.removeAttribute('id');
    if (streamEl) streamEl.removeAttribute('id');

    if (fullResponse) {
        addMessage('ai', fullResponse);
    }
    isStreaming = false;
    abortController = null;
    toggleSendButton(false);
    await loadChats();
    renderChatHistory();
}

function useSuggestion(text) {
    document.getElementById('messageInput').value = text;
    sendMessage();
}

function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

const messageInput = document.getElementById('messageInput');
messageInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 150) + 'px';
});

async function loadUser() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) {
            window.location.href = '../login.html';
            return;
        }

        const res = await fetch(`${API_BASE}/api/users/me`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!res.ok) {
            window.location.href = '../login.html';
            return;
        }

        currentUser = await res.json();
        await loadChats();
        renderChatHistory();
        renderMessages();
        messageInput.focus();
    } catch (e) {
        console.error('사용자 정보 로드 실패:', e);
        window.location.href = '../login.html';
    }
}

function saveChats() {
}

async function loadChats() {
    if (!currentUser) return;
    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch(`${API_BASE}/api/ai/chat/history`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error(`${res.status}`);
        const list = await res.json();
        if (!list || list.length === 0) {
            chatIdCounter++;
            currentChatId = `local_${chatIdCounter}`;
            chats = { [currentChatId]: { title: '새 대화', messages: [] } };
            return;
        }
        const localOnly = {};
        Object.entries(chats).forEach(([id, chat]) => {
            if (id.startsWith('local_') && chat.messages.length > 0) localOnly[id] = chat;
        });
        chats = {};
        list.forEach(session => {
            chats[session.session_id] = {
                title: session.title || '새 대화',
                messages: session.messages.map(m => ({
                    role: m.role === 'assistant' ? 'ai' : m.role,
                    content: m.content
                }))
            };
        });
        Object.assign(chats, localOnly);
        if (!chats[currentChatId]) {
            currentChatId = list[0].session_id;
        }
    } catch (e) {
        console.error('대화 기록 로드 실패:', e);
        chatIdCounter++;
        currentChatId = `local_${chatIdCounter}`;
        chats = { [currentChatId]: { title: '새 대화', messages: [] } };
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadUser();
});
