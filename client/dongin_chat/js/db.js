const DB_NAME = 'dongin_chat';
const DB_VERSION = 1;

class ChatDB {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('rooms')) {
                    db.createObjectStore('rooms', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('messages')) {
                    const msgStore = db.createObjectStore('messages', { keyPath: 'id' });
                    msgStore.createIndex('room_id', 'room_id', { unique: false });
                    msgStore.createIndex('created_at', 'created_at', { unique: false });
                }

                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('offline_queue')) {
                    const queueStore = db.createObjectStore('offline_queue', { keyPath: 'temp_id' });
                    queueStore.createIndex('created_at', 'created_at', { unique: false });
                }
            };
        });
    }

    async saveRoom(room) {
        const tx = this.db.transaction(['rooms'], 'readwrite');
        const store = tx.objectStore('rooms');
        await store.put(room);
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async getRooms() {
        const tx = this.db.transaction(['rooms'], 'readonly');
        const store = tx.objectStore('rooms');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async saveMessage(message) {
        const tx = this.db.transaction(['messages'], 'readwrite');
        const store = tx.objectStore('messages');
        await store.put(message);
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async getMessages(roomId, limit = 50) {
        const tx = this.db.transaction(['messages'], 'readonly');
        const store = tx.objectStore('messages');
        const index = store.index('room_id');
        const messages = [];

        return new Promise((resolve, reject) => {
            const request = index.openCursor(IDBKeyRange.only(roomId), 'prev');

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor && messages.length < limit) {
                    messages.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(messages.reverse());
                }
            };

            request.onerror = () => reject(request.error);
        });
    }

    async getLastMessageId() {
        const tx = this.db.transaction(['messages'], 'readonly');
        const store = tx.objectStore('messages');
        const request = store.openCursor(null, 'prev');

        return new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                resolve(cursor ? cursor.value.id : null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async saveToOfflineQueue(message) {
        const tx = this.db.transaction(['offline_queue'], 'readwrite');
        const store = tx.objectStore('offline_queue');
        await store.put({
            ...message,
            temp_id: `temp_${Date.now()}_${Math.random()}`,
            created_at: new Date().toISOString()
        });
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async getOfflineQueue() {
        const tx = this.db.transaction(['offline_queue'], 'readonly');
        const store = tx.objectStore('offline_queue');
        const request = store.getAll();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }

    async removeFromOfflineQueue(tempId) {
        const tx = this.db.transaction(['offline_queue'], 'readwrite');
        const store = tx.objectStore('offline_queue');
        await store.delete(tempId);
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async clearOfflineQueue() {
        const tx = this.db.transaction(['offline_queue'], 'readwrite');
        const store = tx.objectStore('offline_queue');
        await store.clear();
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async saveFile(file) {
        const tx = this.db.transaction(['files'], 'readwrite');
        const store = tx.objectStore('files');
        await store.put(file);
        return new Promise((resolve, reject) => {
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
        });
    }

    async getFile(fileId) {
        const tx = this.db.transaction(['files'], 'readonly');
        const store = tx.objectStore('files');
        const request = store.get(fileId);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
