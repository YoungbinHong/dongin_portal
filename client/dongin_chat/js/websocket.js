const WS_URL = 'ws://192.168.0.254:8000/ws/chat';
const RECONNECT_INTERVAL = 3000;
const HEARTBEAT_INTERVAL = 30000;

class ChatWebSocket {
    constructor() {
        this.ws = null;
        this.handlers = {};
        this.reconnectTimer = null;
        this.heartbeatTimer = null;
        this.isIntentionalClose = false;
    }

    connect(token) {
        this.isIntentionalClose = false;

        try {
            this.ws = new WebSocket(WS_URL);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                this.send({ type: 'auth', token });
                this.startHeartbeat();
                this.emit('connected');
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (err) {
                    console.error('Failed to parse message:', err);
                }
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };

            this.ws.onclose = () => {
                console.log('WebSocket closed');
                this.stopHeartbeat();
                this.emit('disconnected');

                if (!this.isIntentionalClose) {
                    this.reconnect(token);
                }
            };
        } catch (err) {
            console.error('Failed to create WebSocket:', err);
            this.reconnect(token);
        }
    }

    reconnect(token) {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => {
            console.log('Reconnecting...');
            this.connect(token);
        }, RECONNECT_INTERVAL);
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.send({ type: 'ping' });
            }
        }, HEARTBEAT_INTERVAL);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    handleMessage(data) {
        const handler = this.handlers[data.type];
        if (handler) {
            handler(data.data || data);
        }
    }

    on(type, handler) {
        this.handlers[type] = handler;
    }

    emit(event, data) {
        const handler = this.handlers[event];
        if (handler) {
            handler(data);
        }
    }

    close() {
        this.isIntentionalClose = true;

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        this.stopHeartbeat();

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    isConnected() {
        return this.ws && this.ws.readyState === WebSocket.OPEN;
    }
}
