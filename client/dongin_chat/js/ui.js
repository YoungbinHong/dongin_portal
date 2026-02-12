class ChatUI {
    constructor() {
        this.roomListEl = document.getElementById('roomList');
        this.chatMessagesEl = document.getElementById('chatMessages');
        this.chatTitleEl = document.querySelector('.chat-title');
        this.chatMembersEl = document.querySelector('.chat-members');
        this.searchInputEl = document.getElementById('searchInput');
    }

    renderRoomList(rooms, currentUser) {
        if (!this.roomListEl) return;

        if (rooms.length === 0) {
            this.roomListEl.innerHTML = `
                <div class="empty-room-list">
                    <p>채팅방이 없습니다</p>
                    <p style="font-size: 12px; color: var(--text-secondary);">새 채팅을 시작해보세요</p>
                </div>
            `;
            return;
        }

        this.roomListEl.innerHTML = rooms
            .filter(room => !room.hidden)
            .map(room => {
                const unreadBadge = room.unread_count > 0
                    ? `<div class="room-badge">${room.unread_count}</div>`
                    : '';

                let displayName = room.name;
                if (room.type === 'direct' && room.members && currentUser) {
                    const otherMember = room.members.find(m => m.id !== currentUser.id);
                    if (otherMember) {
                        displayName = otherMember.name;
                    }
                }

                return `
                    <div class="room-item ${room.active ? 'active' : ''}" data-id="${room.id}">
                        <div class="room-avatar">
                            <svg viewBox="0 0 24 24">
                                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                            </svg>
                        </div>
                        <div class="room-info">
                            <div class="room-name">${this.escapeHtml(displayName)}</div>
                            <div class="room-last">${this.escapeHtml(room.last_message || '')}</div>
                        </div>
                        ${unreadBadge}
                        <button class="room-hide-btn" onclick="event.stopPropagation(); hideRoom('${room.id}')" title="채팅방 숨기기">
                            <svg viewBox="0 0 24 24" width="16" height="16">
                                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                            </svg>
                        </button>
                    </div>
                `;
            }).join('');
    }

    renderMessages(messages, currentUserId, room) {
        if (!this.chatMessagesEl) return;

        console.log('[DEBUG] renderMessages called:', {
            messageCount: messages.length,
            currentUserId,
            room: room,
            roomMembers: room?.members
        });

        let currentDate = null;
        const html = messages.map(msg => {
            let dateHTML = '';
            const msgDate = new Date(msg.created_at).toLocaleDateString('ko-KR');

            if (msgDate !== currentDate) {
                currentDate = msgDate;
                dateHTML = `<div class="message-date">${msgDate}</div>`;
            }

            const isSent = msg.user_id === currentUserId;
            const timeStr = new Date(msg.created_at).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit'
            });

            let contentHTML = '';
            if (msg.type === 'file') {
                contentHTML = this.renderFileMessage(msg);
            } else {
                contentHTML = `<div class="message-text">${this.escapeHtml(msg.content)}</div>`;
            }

            let unreadBadge = '';
            if (isSent && room && room.members) {
                const totalMembers = room.members.length;
                const readByCount = msg.read_by ? msg.read_by.length : 1;
                const unreadCount = totalMembers - readByCount;
                console.log('[DEBUG] Unread count:', {
                    msgId: msg.id,
                    totalMembers,
                    readBy: msg.read_by,
                    readByCount,
                    unreadCount
                });
                if (unreadCount > 0) {
                    unreadBadge = `<div class="message-unread-count">${unreadCount}</div>`;
                }
            }

            if (isSent) {
                return `
                    ${dateHTML}
                    <div class="message sent" data-id="${msg.id}">
                        <div class="message-content">
                            ${contentHTML}
                            <div class="message-time">${timeStr}</div>
                            ${unreadBadge}
                        </div>
                    </div>
                `;
            } else {
                return `
                    ${dateHTML}
                    <div class="message received" data-id="${msg.id}">
                        <div class="message-avatar">
                            <svg viewBox="0 0 24 24">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                        </div>
                        <div class="message-content">
                            <div class="message-sender">${this.escapeHtml(msg.user_name)}</div>
                            ${contentHTML}
                            <div class="message-time">${timeStr}</div>
                        </div>
                    </div>
                `;
            }
        }).join('');

        this.chatMessagesEl.innerHTML = html;
        this.scrollToBottom();
    }

    renderFileMessage(msg) {
        const metadata = msg.metadata || {};
        const isImage = metadata.mime_type && metadata.mime_type.startsWith('image/');

        if (isImage && metadata.thumbnail_url) {
            return `
                <div class="message-file message-image">
                    <img src="${metadata.thumbnail_url}" alt="${this.escapeHtml(metadata.name || 'image')}" />
                    <div class="file-name">${this.escapeHtml(metadata.name || 'image.png')}</div>
                </div>
            `;
        } else {
            return `
                <div class="message-file">
                    <svg viewBox="0 0 24 24" class="file-icon">
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                    </svg>
                    <div class="file-info">
                        <div class="file-name">${this.escapeHtml(metadata.name || 'file')}</div>
                        <div class="file-size">${this.formatFileSize(metadata.size || 0)}</div>
                    </div>
                </div>
            `;
        }
    }

    renderTypingIndicator(users) {
        const typingEl = document.getElementById('typingIndicator');
        if (!typingEl) return;

        if (users.length === 0) {
            typingEl.style.display = 'none';
            return;
        }

        const names = users.map(u => u.name).join(', ');
        typingEl.textContent = `${names}님이 입력 중...`;
        typingEl.style.display = 'block';
    }

    updateUnreadBadge(roomId, count) {
        const roomEl = this.roomListEl?.querySelector(`.room-item[data-id="${roomId}"]`);
        if (!roomEl) return;

        let badge = roomEl.querySelector('.room-badge');

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('div');
                badge.className = 'room-badge';
                roomEl.appendChild(badge);
            }
            badge.textContent = count;
        } else if (badge) {
            badge.remove();
        }
    }

    setActiveRoom(roomId) {
        if (!this.roomListEl) return;

        this.roomListEl.querySelectorAll('.room-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === roomId);
        });
    }

    updateChatHeader(room, currentUser) {
        if (this.chatTitleEl) {
            let displayName = room ? room.name : '';
            if (room && room.type === 'direct' && room.members && currentUser) {
                const otherMember = room.members.find(m => m.id !== currentUser.id);
                if (otherMember) {
                    displayName = otherMember.name;
                }
            }
            this.chatTitleEl.textContent = displayName;
        }

        if (this.chatMembersEl) {
            if (room) {
                const memberCount = room.members ? room.members.length : 0;
                if (room.type === 'direct') {
                    this.chatMembersEl.textContent = '';
                } else {
                    this.chatMembersEl.textContent = memberCount > 0 ? `${memberCount}명` : '';
                }
            } else {
                this.chatMembersEl.textContent = '';
            }
        }
    }

    scrollToBottom() {
        if (this.chatMessagesEl) {
            this.chatMessagesEl.scrollTop = this.chatMessagesEl.scrollHeight;
        }
    }

    showConnectionStatus(connected) {
        const statusEl = document.getElementById('connectionStatus');
        if (!statusEl) return;

        if (connected) {
            statusEl.style.display = 'none';
        } else {
            statusEl.style.display = 'block';
            statusEl.textContent = '연결 끊김 - 재연결 중...';
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/\n/g, '<br>');
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    filterRooms(query) {
        if (!this.roomListEl) return;

        const items = this.roomListEl.querySelectorAll('.room-item');
        const lowerQuery = query.toLowerCase();

        items.forEach(item => {
            const name = item.querySelector('.room-name')?.textContent?.toLowerCase() || '';
            const match = name.includes(lowerQuery);
            item.style.display = match ? '' : 'none';
        });
    }

    showEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'flex';
        }
    }

    hideEmptyState() {
        const emptyState = document.getElementById('emptyState');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }
}
