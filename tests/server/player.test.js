import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

let mockStorage = {};
export const _resetStorage = () => { mockStorage = {}; };

// Mock dependencies BEFORE importing the module under test
mock.module('../../src/server/storage/storage.js', () => {
  return {
    readJsonFile: async (filename) => {
      return mockStorage[filename] || null;
    },
    writeJsonFile: async (filename, data) => {
      mockStorage[filename] = data;
      return true;
    }
  };
});

let mockGalaxy = { debrisFields: {}, playerRegistry: {} };

// Mock galaxyData
mock.module('../../src/server/game/galaxyData.js', () => {
  return {
    getGalaxyData: async () => mockGalaxy,
    saveGalaxyData: async (data) => { mockGalaxy = data; return true; },
    registerPlayer: async (userId, username, homeworld) => {
      mockGalaxy.playerRegistry[userId] = { username, homeworld };
    }
  };
});

// Now import the module under test
import * as playerModule from '../../src/server/game/player.js';

describe('Player Management', () => {
  
  beforeEach(async () => {
    // Reset internal cache/mocks
    _resetStorage();
    mockGalaxy = { debrisFields: {}, playerRegistry: {} };
  });

  it('should create a new player with default values', async () => {
    const player = await playerModule.createPlayer('user123', 'TestUser');
    
    expect(player).toBeDefined();
    expect(player.userId).toBe('user123');
    expect(player.username).toBe('TestUser');
    expect(player.planets.length).toBe(1);
    expect(player.planets[0].name).toBe('Homeworld');
    expect(player.resources).toBeUndefined(); // Resources are on planets now
    expect(player.research).toBeDefined();
  });

  it('should assign unique coordinates to new players', async () => {
    const p1 = await playerModule.createPlayer('u1', 'Player1');
    const p2 = await playerModule.createPlayer('u2', 'Player2');
    const p3 = await playerModule.createPlayer('u3', 'Player3');
    
    const c1 = p1.planets[0].coordinates.join(':');
    const c2 = p2.planets[0].coordinates.join(':');
    const c3 = p3.planets[0].coordinates.join(':');
    
    expect(c1).not.toBe(c2);
    expect(c1).not.toBe(c3);
    expect(c2).not.toBe(c3);
    
    // Coordinates should be within valid ranges [1-10, 1-499, 4-12]
    p1.planets[0].coordinates.forEach((val, i) => {
        if (i === 0) expect(val).toBeGreaterThanOrEqual(1);
        if (i === 0) expect(val).toBeLessThanOrEqual(10);
        if (i === 1) expect(val).toBeGreaterThanOrEqual(1);
        if (i === 1) expect(val).toBeLessThanOrEqual(499);
        if (i === 2) expect(val).toBeGreaterThanOrEqual(4);
        if (i === 2) expect(val).toBeLessThanOrEqual(12);
    });
  });

  it('should not create duplicate players for same userId', async () => {
    const p1 = await playerModule.createPlayer('user123', 'TestUser');
    const p2 = await playerModule.createPlayer('user123', 'TestUser');
    
    // In the new system, it loads from file, so they might not be same reference
    // but should have same ID
    expect(p1.userId).toBe(p2.userId); 
    
    const players = await playerModule.getPlayers();
    expect(players.length).toBe(1);
  });

  it('should retrieve player by userId', async () => {
    await playerModule.createPlayer('user1', 'UserOne');
    await playerModule.createPlayer('user2', 'UserTwo');
    
    const p1 = await playerModule.getPlayerByUserId('user1');
    expect(p1.username).toBe('UserOne');
    
    const p2 = await playerModule.getPlayerByUserId('user2');
    expect(p2.username).toBe('UserTwo');
    
    const p3 = await playerModule.getPlayerByUserId('unknown');
    expect(p3).toBeNull();
  });

  it('should update player data', async () => {
    const player = await playerModule.createPlayer('userUpdate', 'UpdateMe');
    player.username = 'UpdatedName';
    
    await playerModule.updatePlayer('userUpdate', player);
    
    const fetched = await playerModule.getPlayerByUserId('userUpdate');
    expect(fetched.username).toBe('UpdatedName');
  });

  it('should get planet by ID', async () => {
    const player = await playerModule.createPlayer('userPlanet', 'PlanetOwner');
    const planetId = player.planets[0].id;
    
    const planet = await playerModule.getPlanetById('userPlanet', planetId);
    expect(planet).toBeDefined();
    expect(planet.id).toBe(planetId);
  });

  it('should update planet resources', async () => {
    const player = await playerModule.createPlayer('userRes', 'ResOwner');
    const planetId = player.planets[0].id;
    
    const newRes = { metal: 500, crystal: 500, deuterium: 500 };
    await playerModule.updatePlanetResources('userRes', planetId, newRes);
    
    const planet = await playerModule.getPlanetById('userRes', planetId);
    expect(planet.resources).toEqual(newRes);
  });

  it('should rename planet', async () => {
    const player = await playerModule.createPlayer('userRename', 'Renamer');
    const planetId = player.planets[0].id;
    
    await playerModule.renamePlanet('userRename', planetId, 'NewName');
    
    const planet = await playerModule.getPlanetById('userRename', planetId);
    expect(planet.name).toBe('NewName');
  });

  it('should validate planet name', async () => {
    const player = await playerModule.createPlayer('userBadName', 'BadNamer');
    const planetId = player.planets[0].id;
    
    // Too short
    expect(playerModule.renamePlanet('userBadName', planetId, 'No')).rejects.toThrow();
    
    // Invalid chars
    expect(playerModule.renamePlanet('userBadName', planetId, 'Bad@Name')).rejects.toThrow();
  });
});
