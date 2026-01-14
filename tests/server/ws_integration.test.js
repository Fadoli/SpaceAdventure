import { describe, it, expect, mock, beforeEach } from 'bun:test';

// Mock storage
let mockStorage = {};
mock.module('../../src/server/storage/storage.js', () => ({
  readJsonFile: async (filename) => mockStorage[filename] || null,
  writeJsonFile: async (filename, data) => { mockStorage[filename] = data; return true; }
}));

// Mock wsManager
const mockSendToUser = mock(() => true);
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
  updatePlayer: async () => true
}));

import { upgradeBuilding } from '../../src/server/game/buildings.js';

describe('WebSocket Integration', () => {
  beforeEach(() => {
    mockStorage = {};
    mockSendToUser.mockClear();
  });

  it('should trigger WebSocket event when a new message is added', async () => {
    const userId = 'user123';
    const msgData = {
      from: 'System',
      subject: 'Test',
      body: 'Test body',
      type: 'info'
    };

    await addMessage(userId, msgData);

    expect(mockSendToUser).toHaveBeenCalled();
    const calls = mockSendToUser.mock.calls;
    expect(calls[0][0]).toBe(userId);
    expect(calls[0][1]).toBe('NEW_MESSAGE');
  });

  it('should trigger WebSocket events when a building is upgraded', async () => {
    const userId = 'user123';
    const planetId = 'p1';
    const buildingType = 'metalMine';

    await upgradeBuilding(userId, planetId, buildingType);

    // Should call sendToUser twice: RESOURCES_UPDATED and QUEUE_UPDATED
    expect(mockSendToUser).toHaveBeenCalledTimes(2);
    
    const types = mockSendToUser.mock.calls.map(c => c[1]);
    expect(types).toContain('RESOURCES_UPDATED');
    expect(types).toContain('QUEUE_UPDATED');
  });
});
