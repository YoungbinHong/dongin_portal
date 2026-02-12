class ChatStore {
    constructor() {
        this.rooms = [];
        this.currentRoomId = null;
        this.messages = {};
        this.typingUsers = {};
        this.listeners = [];
        this.currentUser = null;
    }

    setCurrentUser(user) {
        this.currentUser = user;
        this.notify('user_updated', user);
    }

    setRooms(rooms) {
        this.rooms = rooms.sort((a, b) => {
            const aTime = new Date(a.updated_at || a.created_at).getTime();
            const bTime = new Date(b.updated_at || b.created_at).getTime();
            return bTime - aTime;
        });
        this.notify('rooms_updated', this.rooms);
    }

    addRoom(room) {
        const existing = this.rooms.findIndex(r => r.id === room.id);
        if (existing >= 0) {
            this.rooms[existing] = room;
        } else {
            this.rooms.unshift(room);
        }
        this.setRooms(this.rooms);
    }

    updateRoom(roomId, updates) {
        const room = this.rooms.find(r => r.id === roomId);
        if (room) {
            Object.assign(room, updates);
            this.setRooms(this.rooms);
        }
    }

    setCurrentRoom(roomId) {
        this.currentRoomId = roomId;
        this.notify('room_selected', roomId);
    }

    getCurrentRoom() {
        return this.rooms.find(r => r.id === this.currentRoomId);
    }

    setMessages(roomId, messages) {
        this.messages[roomId] = messages;
        this.notify('messages_updated', { roomId, messages });
    }

    addMessage(roomId, message) {
        if (!this.messages[roomId]) {
            this.messages[roomId] = [];
        }

        const existing = this.messages[roomId].findIndex(m => m.id === message.id);
        if (existing >= 0) {
            this.messages[roomId][existing] = message;
        } else {
            if (!message.pending) {
                const tempIdx = this.messages[roomId].findIndex(
                    m => m.pending && m.content === message.content && m.user_id === message.user_id
                );
                if (tempIdx >= 0) {
                    this.messages[roomId].splice(tempIdx, 1);
                }
            }

            this.messages[roomId].push(message);
        }

        this.updateRoom(roomId, {
            last_message: message.content || '[파일]',
            updated_at: message.created_at
        });

        this.notify('message_added', { roomId, message });
    }

    updateMessage(roomId, messageId, updates) {
        if (!this.messages[roomId]) return;

        const message = this.messages[roomId].find(m => m.id === messageId);
        if (message) {
            Object.assign(message, updates);
            this.notify('message_updated', { roomId, messageId, updates });
        }
    }

    getMessages(roomId) {
        return this.messages[roomId] || [];
    }

    setTypingUsers(roomId, users) {
        this.typingUsers[roomId] = users;
        this.notify('typing_updated', { roomId, users });
    }

    addTypingUser(roomId, userId, userName) {
        if (!this.typingUsers[roomId]) {
            this.typingUsers[roomId] = [];
        }

        const existing = this.typingUsers[roomId].find(u => u.id === userId);
        if (!existing) {
            this.typingUsers[roomId].push({ id: userId, name: userName });
            this.notify('typing_updated', { roomId, users: this.typingUsers[roomId] });
        }
    }

    removeTypingUser(roomId, userId) {
        if (!this.typingUsers[roomId]) return;

        this.typingUsers[roomId] = this.typingUsers[roomId].filter(u => u.id !== userId);
        this.notify('typing_updated', { roomId, users: this.typingUsers[roomId] });
    }

    getTypingUsers(roomId) {
        return this.typingUsers[roomId] || [];
    }

    incrementUnreadCount(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        if (room && roomId !== this.currentRoomId) {
            room.unread_count = (room.unread_count || 0) + 1;
            this.notify('unread_updated', { roomId, count: room.unread_count });
        }
    }

    clearUnreadCount(roomId) {
        const room = this.rooms.find(r => r.id === roomId);
        if (room) {
            room.unread_count = 0;
            this.notify('unread_updated', { roomId, count: 0 });
        }
    }

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    notify(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (err) {
                console.error('Listener error:', err);
            }
        });
    }

    clear() {
        this.rooms = [];
        this.currentRoomId = null;
        this.messages = {};
        this.typingUsers = {};
        this.currentUser = null;
        this.notify('store_cleared');
    }
}
