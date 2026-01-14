// WebSocket client for real-time updates
import { Notifications } from './notifications.js';

class GameSocket {
    constructor() {
        this.socket = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectInterval = 3000;
        this.handlers = new Set();
    }

    /**
     * Connect to the WebSocket server
     */
    connect() {
        if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws`;
        
        console.log(`[WS] Connecting to ${wsUrl}...`);
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('[WS] Connected to server');
            this.reconnectAttempts = 0;
        };

        this.socket.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);
                console.log('[WS] Received:', message.type, message.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('[WS] Failed to parse message:', error);
            }
        };

        this.socket.onclose = (event) => {
            console.log('[WS] Connection closed:', event.code, event.reason);
            this.attemptReconnect();
        };

        this.socket.onerror = (error) => {
            console.error('[WS] Socket error:', error);
        };
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectInterval * Math.pow(1.5, this.reconnectAttempts - 1);
            console.log(`[WS] Reconnecting in ${Math.round(delay)}ms... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
            setTimeout(() => this.connect(), delay);
        } else {
            console.log('[WS] Max reconnect attempts reached');
        }
    }

    /**
     * Register an event handler
     */
    addHandler(handler) {
        this.handlers.add(handler);
    }

    /**
     * Remove an event handler
     */
    removeHandler(handler) {
        this.handlers.delete(handler);
    }

    /**
     * Handle incoming messages and dispatch to registered handlers
     */
    handleMessage(message) {
        const { type, data } = message;

        // Show generic notifications for important events if not handled specifically
        this.showNotification(type, data);

        // Dispatch to all registered handlers
        this.handlers.forEach(handler => {
            try {
                handler(type, data);
            } catch (error) {
                console.error('[WS] Handler error:', error);
            }
        });
    }

    /**
     * Show UI notifications for specific events
     */
    showNotification(type, data) {
        switch (type) {
            case 'BUILDING_COMPLETE':
                Notifications.showSuccess('Construction project completed!');
                break;
            case 'RESEARCH_COMPLETE':
                Notifications.showSuccess('Scientific breakthrough achieved!');
                break;
            case 'PRODUCTION_COMPLETE':
                Notifications.showSuccess('Shipyard production cycle complete!');
                break;
            case 'FLEET_ARRIVED':
                Notifications.showInfo('A fleet has reached its destination.');
                break;
            case 'FLEET_RETURNED':
                Notifications.showInfo('A fleet has returned to base.');
                break;
            case 'VARIANT_SWITCH_COMPLETE':
                Notifications.showSuccess('Building reconfiguration complete!');
                break;
        }
    }

    /**
     * Close the connection
     */
    disconnect() {
        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }
    }
}

export const gameSocket = new GameSocket();
