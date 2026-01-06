import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// Mock dependencies BEFORE importing the module under test
mock.module('../../src/server/storage/storage.js', () => {
  // Simple in-memory storage for tests
  let storage = {};
  return {
    readJsonFile: async (filename) => {
      return storage[filename] || null;
    },
    writeJsonFile: async (filename, data) => {
      storage[filename] = data;
      return true;
    },
    _reset: () => { storage = {}; } // Helper for tests
  };
});

// Now import the module under test
import * as playerModule from '../../src/server/game/player.js';

describe('Player Management', () => {
  // We need to reset the internal cache of playerModule. 
  // Since we can't access it directly, we can use savePlayers to reset it.
  
  beforeEach(async () => {
    // Reset internal cache to empty array
    await playerModule.savePlayers([]);
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

  it('should not create duplicate players for same userId', async () => {
    const p1 = await playerModule.createPlayer('user123', 'TestUser');
    const p2 = await playerModule.createPlayer('user123', 'TestUser');
    
    expect(p1).toBe(p2); // Should be same reference or at least same ID
    
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
    expect(p3).toBeUndefined();
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
