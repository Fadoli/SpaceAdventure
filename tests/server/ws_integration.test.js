import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock storage
let mockStorage = {};
mock.module('../../src/server/storage/storage.js', () => ({
  readJsonFile: async (filename) => mockStorage[filename] || null,
  writeJsonFile: async (filename, data) => { mockStorage[filename] = data; return true; }
}));

// Mock wsManager
const callbackOrder = [];
const mockSendToUser = mock(() => {
  callbackOrder.push('event');
  return true;
});
const mockUpdatePlayer = mock(async () => {
  callbackOrder.push('update');
  return true;
});
mock.module('../../src/server/game/wsManager.js', () => ({
  wsManager: {
    sendToUser: mockSendToUser
  }
}));

import { addMessage } from '../../src/server/game/messages.js';

// We need to mock more things for building tests
mock.module('../../src/server/game/player.js', () => ({
  getPlayerByUserId: async (id) => ({
    userId: id,
    planets: [{ id: 'p1', coordinates: [1, 1, 1], buildings: {}, resources: { metal: 10000, crystal: 10000, deuterium: 10000 } }]
  }),
  updatePlayer: mockUpdatePlayer
}));

import { upgradeBuilding } from '../../src/server/game/buildings.js';

describe('WebSocket Integration', () => {
  beforeEach(() => {
    mockStorage = {};
    callbackOrder.length = 0;
    mockSendToUser.mockClear();
    mockUpdatePlayer.mockClear();
  });

  /*
  it('should trigger WebSocket event when a new message is added', async () => {
    const userId = 'user123';
    const msgData = {
      from: 'System',
      subject: 'Test',
      body: 'Test body',
      type: 'info'
    };

    // Clear any calls from potential initialization logic
    mockSendToUser.mockClear();

    await addMessage(userId, msgData);

    expect(mockSendToUser).toHaveBeenCalled();
    const calls = mockSendToUser.mock.calls;
    expect(calls[0][0]).toBe(userId);
    expect(calls[0][1]).toBe('NEW_MESSAGE');
    expect(calls[0][2]).toBeDefined();
    expect(calls[0][2].count).toBe(1); // 1 unread message
  });
  */

  it('should trigger WebSocket events when a building is upgraded', async () => {
    const userId = 'user123';
    const planetId = 'p1';
    const buildingType = 'metalMine';

    await upgradeBuilding(userId, planetId, buildingType);

    // One queue event is enough; the canonical state sync carries resources.
    expect(mockSendToUser).toHaveBeenCalledTimes(1);
    
    const types = mockSendToUser.mock.calls.map(c => c[1]);
    expect(types).toContain('QUEUE_UPDATED');
    expect(mockUpdatePlayer).toHaveBeenCalledTimes(1);
    expect(callbackOrder).toEqual(['update', 'event']);
  });
});
