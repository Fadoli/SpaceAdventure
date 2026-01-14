import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { wsManager } from '../../src/server/game/wsManager.js';

// Mock getUserFromSession for handleUpgrade tests
mock.module('../../src/server/auth/auth.js', () => ({
  getUserFromSession: async (token) => {
    if (token === 'valid-token') return { id: 'user123', username: 'TestUser' };
    return null;
  }
}));

describe('WebSocket Manager', () => {
  beforeEach(() => {
    // Clear connections before each test
    wsManager.userConnections.clear();
  });

  it('should track user connections', () => {
    const userId = 'user123';
    const mockWs = { send: mock(() => {}) };
    
    wsManager.addConnection(userId, mockWs);
    expect(wsManager.userConnections.has(userId)).toBe(true);
    expect(wsManager.userConnections.get(userId).size).toBe(1);
    
    wsManager.removeConnection(userId, mockWs);
    expect(wsManager.userConnections.has(userId)).toBe(false);
  });

  it('should handle multiple connections for the same user', () => {
    const userId = 'user123';
    const ws1 = { send: mock(() => {}) };
    const ws2 = { send: mock(() => {}) };
    
    wsManager.addConnection(userId, ws1);
    wsManager.addConnection(userId, ws2);
    
    expect(wsManager.userConnections.get(userId).size).toBe(2);
    
    // Sending to user should hit all connections
    wsManager.sendToUser(userId, 'EVENT', {});
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
    
    wsManager.removeConnection(userId, ws1);
    expect(wsManager.userConnections.get(userId).size).toBe(1);
    
    wsManager.removeConnection(userId, ws2);
    expect(wsManager.userConnections.has(userId)).toBe(false);
  });

  it('should send messages to specific users', () => {
    const userId = 'user456';
    const mockWs = { send: mock((msg) => {
        const parsed = JSON.parse(msg);
        expect(parsed.type).toBe('TEST_EVENT');
        expect(parsed.data.foo).toBe('bar');
    }) };
    
    wsManager.addConnection(userId, mockWs);
    const sent = wsManager.sendToUser(userId, 'TEST_EVENT', { foo: 'bar' });
    
    expect(sent).toBe(true);
    expect(mockWs.send).toHaveBeenCalled();
  });

  it('should broadcast messages to all connected users', () => {
    const u1 = 'user1';
    const u2 = 'user2';
    const ws1 = { send: mock(() => {}) };
    const ws2 = { send: mock(() => {}) };
    
    wsManager.addConnection(u1, ws1);
    wsManager.addConnection(u2, ws2);
    
    wsManager.broadcast('GLOBAL_EVENT', { msg: 'hello' });
    
    expect(ws1.send).toHaveBeenCalled();
    expect(ws2.send).toHaveBeenCalled();
    
    const call1 = JSON.parse(ws1.send.mock.calls[0][0]);
    expect(call1.type).toBe('GLOBAL_EVENT');
    expect(call1.data.msg).toBe('hello');
  });

  it('should return false when sending to offline user', () => {
    const sent = wsManager.sendToUser('offline_user', 'TEST', {});
    expect(sent).toBe(false);
  });

  describe('handleUpgrade', () => {
    const mockServer = {
      upgrade: mock(() => true)
    };

    it('should reject non-/ws paths', async () => {
      const req = new Request('http://localhost/api/test');
      const result = await wsManager.handleUpgrade(req, mockServer);
      expect(result).toBeNull();
    });

    it('should reject missing session cookie', async () => {
      const req = new Request('http://localhost/ws');
      const result = await wsManager.handleUpgrade(req, mockServer);
      expect(result instanceof Response).toBe(true);
      expect(result.status).toBe(401);
    });

    it('should reject invalid session token', async () => {
      const req = new Request('http://localhost/ws', {
        headers: { 'cookie': 'session=invalid-token' }
      });
      const result = await wsManager.handleUpgrade(req, mockServer);
      expect(result.status).toBe(401);
    });

    it('should approve valid session token and return undefined', async () => {
      const req = new Request('http://localhost/ws', {
        headers: { 'cookie': 'session=valid-token' }
      });
      const result = await wsManager.handleUpgrade(req, mockServer);
      expect(result).toBeUndefined();
      expect(mockServer.upgrade).toHaveBeenCalled();
      
      // Verify data passed to upgrade
      const upgradeOptions = mockServer.upgrade.mock.calls[0][1];
      expect(upgradeOptions.data.userId).toBe('user123');
    });
  });
});
