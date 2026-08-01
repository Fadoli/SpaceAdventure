// WebSocket Manager - Handles real-time communication with clients
import { getUserFromSession } from '../auth/auth.js';

class WebSocketManager {
  constructor() {
    this.userConnections = new Map(); // userId -> Set of WebSocket instances
  }

  /**
   * Register a new connection for a user
   */
  addConnection(userId, ws) {
    if (!this.userConnections.has(userId)) {
      this.userConnections.set(userId, new Set());
    }
    this.userConnections.get(userId).add(ws);
    // console.log(`[WS] User ${userId} connected. Total connections for user: ${this.userConnections.get(userId).size}`);
  }

  /**
   * Remove a connection
   */
  removeConnection(userId, ws) {
    if (this.userConnections.has(userId)) {
      const connections = this.userConnections.get(userId);
      connections.delete(ws);
      if (connections.size === 0) {
        this.userConnections.delete(userId);
      }
      // console.log(`[WS] User ${userId} disconnected. Remaining for user: ${connections.size}`);
    }
  }

  /**
   * Send a message to all active connections of a specific user
   */
  sendToUser(userId, type, data) {
    const connections = this.userConnections.get(userId);
    if (connections) {
      const message = JSON.stringify({ type, data, timestamp: Date.now() });
      connections.forEach(ws => {
        try {
          ws.send(message);
        } catch (error) {
          console.error(`[WS] Failed to send message to user ${userId}:`, error);
        }
      });
      return true;
    }
    return false;
  }

  sendStateSync(userId, state, stateVersion, force = false) {
    return this.sendToUser(userId, 'STATE_SYNC', { state, stateVersion, force });
  }

  handleClientMessage(ws, message) {
    let payload;
    try {
      payload = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    } catch {
      return false;
    }

    if (payload?.type !== 'PING') return false;
    const timestamp = Date.now();
    try {
      ws.send(JSON.stringify({ type: 'PONG', data: { timestamp }, timestamp }));
    } catch {
      return false;
    }
    return true;
  }

  /**
   * Broadcast a message to all connected users
   */
  broadcast(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    this.userConnections.forEach((connections, userId) => {
      connections.forEach(ws => {
        try {
          ws.send(message);
        } catch (error) {
          // Ignore
        }
      });
    });
  }

  /**
   * Handle WebSocket upgrade and authentication
   * Returns a Response if upgrade should fail, or undefined if successful
   */
  async handleUpgrade(req, server) {
    const url = new URL(req.url);
    if (url.pathname !== '/ws') return null; // Not a WS request, proceed to other routes

    const origin = req.headers.get('origin');
    const forwardedProtocol = req.headers.get('x-forwarded-proto')?.split(',')[0].trim();
    const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0].trim();
    const expectedOrigin = `${forwardedProtocol || url.protocol.slice(0, -1)}://${forwardedHost || url.host}`;
    if (origin && origin !== expectedOrigin) return new Response('Forbidden', { status: 403 });

    // Get session token from cookie
    const cookies = req.headers.get('cookie');
    if (!cookies) return new Response('Unauthorized', { status: 401 });
    
    const sessionToken = cookies.split(';').find(c => c.trim().startsWith('session='))?.split('=')[1];
    if (!sessionToken) return new Response('Unauthorized', { status: 401 });

    const user = await getUserFromSession(sessionToken);
    if (!user) return new Response('Unauthorized', { status: 401 });

    const upgraded = server.upgrade(req, {
      data: {
        userId: user.id,
        username: user.username
      }
    });

    if (upgraded) return undefined; // Return undefined to tell Bun the request was handled by upgrade()
    return new Response('Upgrade failed', { status: 500 });
  }
}

export const wsManager = new WebSocketManager();
