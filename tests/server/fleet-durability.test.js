import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { sendFleet, processFleets } from '../../src/server/game/fleet.js';
import { MISSION_TYPES } from '../../src/shared/constants.js';
import { savePlayers, getPlayerByUserId } from '../../src/server/game/player.js';
import { saveGalaxyData } from '../../src/server/game/galaxyData.js';

// --- Mocks and Setup ---
let storage = {};
mock.module('../../src/server/storage/storage.js', () => ({
  readJsonFile: async (filename) => storage[filename] || null,
  writeJsonFile: async (filename, data) => { storage[filename] = JSON.parse(JSON.stringify(data)); return true; }
}));

mock.module('../../src/server/game/messages.js', () => ({
  addMessage: async () => {}
}));

mock.module('../../src/server/config.js', () => ({
  getFleetSpeedMultiplier: () => 1
}));

const PLAYER_ID = 'test-player';
const mockPlayer = {
  userId: PLAYER_ID,
  username: 'FleetCommander',
  research: {},
  planets: [
    {
      id: 'p1',
      coordinates: [1, 1, 1],
      ships: { lightFighter: 100, smallCargo: 50, colonyShip: 1 },
      resources: { metal: 1000000, crystal: 1000000, deuterium: 1000000, food: 1000000, water: 1000000, population: 10000 },
      buildings: { shipyard: 10, researchLab: 10 },
      buildQueue: []
    }
  ],
  fleets: []
};

describe('Fleet Durability and Integrity', () => {
  beforeEach(async () => {
    storage = {};
    const playerClone = JSON.parse(JSON.stringify(mockPlayer));
    await savePlayers([playerClone]);
    await saveGalaxyData({ debrisFields: {}, playerRegistry: {} });
  });

  it('should never lose ships when a mission is launched', async () => {
    const initialShips = { ...mockPlayer.planets[0].ships };
    const shipsToSend = { lightFighter: 10 };
    
    const fleet = await sendFleet(PLAYER_ID, 'p1', [1, 1, 2], MISSION_TYPES.ATTACK, shipsToSend);
    
    const player = await getPlayerByUserId(PLAYER_ID);
    const planet = player.planets[0];
    
    // Ships must be either in the fleet OR on the planet, never gone
    expect(planet.ships.lightFighter).toBe(initialShips.lightFighter - 10);
    expect(player.fleets.length).toBe(1);
    expect(player.fleets[0].ships.lightFighter).toBe(10);
  });

  it('should never duplicate or lose ships during arrival and return journey', async () => {
    const shipsToSend = { smallCargo: 5 };
    const fleet = await sendFleet(PLAYER_ID, 'p1', [1, 1, 2], MISSION_TYPES.TRANSPORT, shipsToSend);
    
    const player = await getPlayerByUserId(PLAYER_ID);
    const now = Date.now();
    
    // 1. Force Arrival
    player.fleets[0].arrivalTime = now - 1000;
    await processFleets(player, [player], now);
    
    // Fleet should now be returning
    expect(player.fleets[0].returning).toBe(true);
    expect(player.fleets[0].ships.smallCargo).toBe(5);
    
    // 2. Force Return
    player.fleets[0].arrivalTime = now - 500;
    await processFleets(player, [player], now + 100);
    
    // Fleet should be gone from active fleets and ships back on planet
    expect(player.fleets.length).toBe(0);
    expect(player.planets[0].ships.smallCargo).toBe(50); // Back to original 50
  });

  it('should survive concurrent state updates without fleet loss', async () => {
    // Launch 3 different fleets
    await sendFleet(PLAYER_ID, 'p1', [1, 1, 2], MISSION_TYPES.ATTACK, { lightFighter: 1 });
    await sendFleet(PLAYER_ID, 'p1', [1, 1, 3], MISSION_TYPES.ATTACK, { lightFighter: 1 });
    await sendFleet(PLAYER_ID, 'p1', [1, 1, 4], MISSION_TYPES.ATTACK, { lightFighter: 1 });
    
    let player = await getPlayerByUserId(PLAYER_ID);
    expect(player.fleets.length).toBe(3);
    
    // Simulate multiple ticks where only some arrive
    const now = Date.now();
    player.fleets[0].arrivalTime = now - 1000; // Arrived
    player.fleets[1].arrivalTime = now + 10000; // Still flying
    player.fleets[2].arrivalTime = now - 500;  // Arrived
    
    await processFleets(player, [player]);
    
    // 2 fleets should be returning, 1 still en route
    expect(player.fleets.length).toBe(3);
    expect(player.fleets.filter(f => f.returning).length).toBe(2);
    expect(player.fleets.filter(f => !f.returning).length).toBe(1);
  });

  it('should maintain total ship count during high-volume operations', async () => {
    const now = Date.now();
    // Stress test: launch 20 small missions
    for (let i = 0; i < 20; i++) {
      await sendFleet(PLAYER_ID, 'p1', [1, 1, i + 5], MISSION_TYPES.ESPIONAGE, { lightFighter: 1 });
    }
    
    let player = await getPlayerByUserId(PLAYER_ID);
    expect(player.fleets.length).toBe(20);
    
    // Calculate total ships in existence
    const getShipSum = (p) => {
      let sum = p.planets[0].ships.lightFighter;
      p.fleets.forEach(f => sum += f.ships.lightFighter);
      return sum;
    };
    
    expect(getShipSum(player)).toBe(100); // 100 initial fighters
    
    // Arrive all
    player.fleets.forEach(f => f.arrivalTime = now - 1000);
    await processFleets(player, [player], now);
    
    expect(player.fleets.every(f => f.returning)).toBe(true);
    expect(getShipSum(player)).toBe(100);
    
    // Return all
    player.fleets.forEach(f => f.arrivalTime = now - 500);
    await processFleets(player, [player], now + 1000);
    
    expect(player.fleets.length).toBe(0);
    expect(player.planets[0].ships.lightFighter).toBe(100);
  });

  it('should handle mission types that consume ships (Colonize) correctly', async () => {
    // Research astrophysics to allow 2nd planet
    const player = await getPlayerByUserId(PLAYER_ID);
    player.research.astrophysics = 1;
    await savePlayers([player]);

    await sendFleet(PLAYER_ID, 'p1', [1, 1, 10], MISSION_TYPES.COLONIZE, { colonyShip: 1, lightFighter: 5 });
    
    const pAfterSend = await getPlayerByUserId(PLAYER_ID);
    expect(pAfterSend.planets[0].ships.colonyShip).toBe(0);
    expect(pAfterSend.fleets[0].ships.colonyShip).toBe(1);
    
    // Process Arrival (Success)
    pAfterSend.fleets[0].arrivalTime = Date.now() - 1000;
    await processFleets(pAfterSend, [pAfterSend]);
    
    // Fleet should be gone (Colony successful)
    expect(pAfterSend.fleets.length).toBe(0);
    expect(pAfterSend.planets.length).toBe(2);
    
    // Colony ship consumed, light fighters at new planet
    const colony = pAfterSend.planets.find(p => p.coordinates[2] === 10);
    expect(colony.ships.colonyShip || 0).toBe(0);
    expect(colony.ships.lightFighter).toBe(5);
  });
});
