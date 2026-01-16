import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { processFleets } from '../../src/server/game/fleet.js';
import { MISSION_TYPES, CONFIG } from '../../src/shared/constants.js';
import { savePlayers } from '../../src/server/game/player.js';
import { getGalaxyData, saveGalaxyData } from '../../src/server/game/galaxyData.js';
import { SHIPS } from '../../src/shared/ships.js';

// Mocks
const mockAttacker = {
  userId: 'attacker',
  username: 'Attacker',
  research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 },
  planets: [
    {
      id: 'ap1',
      coordinates: [1, 1, 1],
      ships: {},
      resources: { metal: 10000, crystal: 10000, deuterium: 10000, food: 10000, water: 10000, population: 1000 }
    }
  ],
  fleets: []
};

const mockDefender = {
  userId: 'defender',
  username: 'Defender',
  research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 },
  planets: [
    {
      id: 'dp1',
      coordinates: [1, 1, 2],
      ships: { lightFighter: 10 },
      defenses: {},
      resources: { metal: 1000, crystal: 1000, deuterium: 1000, food: 1000, water: 1000, population: 100 }
    }
  ],
  fleets: []
};

// Mock dependencies
let storage = {};
mock.module('../../src/server/storage/storage.js', () => ({
  readJsonFile: async (filename) => { return storage[filename] || null; },
  writeJsonFile: async (filename, data) => { storage[filename] = data; return true; }
}));

export const mockAddMessage = mock(() => Promise.resolve());
mock.module('../../src/server/game/messages.js', () => ({
  addMessage: mockAddMessage
}));

mock.module('../../src/server/config.js', () => ({
  getFleetSpeedMultiplier: () => 1
}));

describe('Fleet Missions', () => {
  beforeEach(async () => {
    storage = {};
    mockAttacker.fleets = [];
    // Reset planets to initial state (1 planet)
    mockAttacker.planets = [
      {
        id: 'ap1',
        coordinates: [1, 1, 1],
        ships: {},
        resources: { metal: 10000, crystal: 10000, deuterium: 10000, food: 10000, water: 10000, population: 1000 }
      }
    ];
    mockDefender.planets[0].ships = { lightFighter: 10 };
    mockDefender.planets[0].defenses = {};
    
    await savePlayers([mockAttacker, mockDefender]);
    await saveGalaxyData({ debrisFields: {}, playerRegistry: {} });
  });

  it('should generate debris field after combat', async () => {
    const now = Date.now();
    // Attacker sends 10 light fighters
    const fleet = {
      id: 'f_combat',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.ATTACK,
      ships: { lightFighter: 10 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 2],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false,
      resources: {}
    };
    
    mockAttacker.fleets = [fleet];
    
    // Process fleets to trigger combat
    await processFleets(mockAttacker, [mockAttacker, mockDefender]);
    
    // Calculate expected debris
    // Light fighter cost: 3000 metal, 1000 crystal (usually, let's check)
    const lfDef = SHIPS.lightFighter;
    const metalCost = lfDef.baseCost.metal;
    const crystalCost = lfDef.baseCost.crystal;
    
    // Combat: 10 LF vs 10 LF should result in some losses
    // Let's see how many were lost
    const attackerLosses = 10 - (mockAttacker.fleets[0]?.ships?.lightFighter || 0);
    const defenderLosses = 10 - (mockDefender.planets[0].ships.lightFighter || 0);
    
    const totalLostLF = attackerLosses + defenderLosses;
    const expectedMetalDebris = Math.floor(totalLostLF * metalCost * CONFIG.DEBRIS_PERCENTAGE);
    const expectedCrystalDebris = Math.floor(totalLostLF * crystalCost * CONFIG.DEBRIS_PERCENTAGE);
    
    const galaxy = await getGalaxyData();
    const debris = galaxy.debrisFields['1:1:2'];
    
    console.log(`Attacker lost: ${attackerLosses}, Defender lost: ${defenderLosses}`);
    console.log(`Expected Metal Debris: ${expectedMetalDebris}, Found: ${debris?.metal}`);
    console.log(`Expected Crystal Debris: ${expectedCrystalDebris}, Found: ${debris?.crystal}`);
    
    expect(debris).toBeDefined();
    expect(debris.metal).toBeGreaterThan(0);
    expect(debris.crystal).toBeGreaterThan(0);
    
    // The exact values might differ slightly due to Math.floor in simulateCombat
    // simulateCombat: debris.metal += Math.floor((def.baseCost.metal || 0) * losses[key] * ratio);
    // So my manual calculation should be correct.
    expect(debris.metal).toBe(expectedMetalDebris);
    expect(debris.crystal).toBe(expectedCrystalDebris);
  });

  it('should accumulate debris if a field already exists', async () => {
    const coordKey = '1:1:2';
    await saveGalaxyData({
      debrisFields: {
        [coordKey]: { metal: 500, crystal: 200 }
      }
    });

    const now = Date.now();
    const fleet = {
      id: 'f_combat_2',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.ATTACK,
      ships: { lightFighter: 10 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 2],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false,
      resources: {}
    };
    
    mockAttacker.fleets = [fleet];
    
    await processFleets(mockAttacker, [mockAttacker, mockDefender]);
    
    const galaxy = await getGalaxyData();
    const debris = galaxy.debrisFields[coordKey];
    
    expect(debris.metal).toBeGreaterThan(500);
    expect(debris.crystal).toBeGreaterThan(200);
  });

  it('should harvest debris with recyclers', async () => {
    // 1. Setup debris field
    const coordKey = '1:1:2';
    await saveGalaxyData({
      debrisFields: {
        [coordKey]: { metal: 50000, crystal: 50000 }
      }
    });

    const now = Date.now();
    // 2. Send 2 recyclers (Capacity: 2 * 20000 = 40000)
    const fleet = {
      id: 'f_harvest',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.HARVEST,
      ships: { recycler: 2 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 2],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false,
      resources: {}
    };
    
    mockAttacker.fleets = [fleet];
    
    // 3. Process
    await processFleets(mockAttacker, [mockAttacker]);
    
    // 4. Verify debris updated
    const galaxy = await getGalaxyData();
    const debris = galaxy.debrisFields[coordKey];
    
    // Capacity 40k. Metal 50k. Metal harvested = 40k. Remaining Metal 10k. Crystal 50k. Remaining Crystal 50k.
    expect(debris.metal).toBe(10000);
    expect(debris.crystal).toBe(50000);
    
    // 5. Verify fleet resources
    const processedFleet = mockAttacker.fleets[0];
    expect(processedFleet.resources.metal).toBe(40000);
    expect(processedFleet.resources.crystal).toBe(0);
    expect(processedFleet.returning).toBe(true);
  });

  it('should loot resources after successful attack', async () => {
    // 1. Setup defender resources
    mockDefender.planets[0].resources = {
      metal: 10000,
      crystal: 10000,
      deuterium: 10000,
      water: 0,
      food: 0
    };
    mockDefender.planets[0].ships = {}; // Defenseless
    
    await savePlayers([mockAttacker, mockDefender]);

    const now = Date.now();
    // 2. Attacker sends 10 Large Cargo (Capacity: 250000 - wait, LC cargo is 25000)
    // 10 * 25000 = 250,000 capacity.
    const fleet = {
      id: 'f_loot',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.ATTACK,
      ships: { largeCargo: 10 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 2],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false,
      resources: {}
    };
    
    mockAttacker.fleets = [fleet];
    
    // 3. Process
    await processFleets(mockAttacker, [mockAttacker, mockDefender]);
    
    // 4. Verify loot (should take 50% of each)
    // metal: 10000 -> 5000 looted
    // crystal: 10000 -> 5000 looted
    // deuterium: 10000 -> 5000 looted
    // Total loot: 15000 (fits in 250k capacity)
    
    const processedFleet = mockAttacker.fleets[0];
    expect(processedFleet.resources.metal).toBe(5000);
    expect(processedFleet.resources.crystal).toBe(5000);
    expect(processedFleet.resources.deuterium).toBe(5000);
    
    expect(mockDefender.planets[0].resources.metal).toBe(5000);
    expect(mockDefender.planets[0].resources.crystal).toBe(5000);
    expect(mockDefender.planets[0].resources.deuterium).toBe(5000);
  });

  it('should transport resources to another planet', async () => {
    // 1. Setup target planet with some space
    mockDefender.planets[0].resources = { metal: 100, crystal: 100, deuterium: 100 };
    mockDefender.planets[0].storage = { metal: 100000, crystal: 100000, deuterium: 100000 };
    
    await savePlayers([mockAttacker, mockDefender]);

    const now = Date.now();
    // 2. Attacker sends transport with 5000 metal
    const fleet = {
      id: 'f_transport',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.TRANSPORT,
      ships: { smallCargo: 2 },
      resources: { metal: 5000, crystal: 0, deuterium: 0 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 2],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false
    };
    
    mockAttacker.fleets = [fleet];
    
    // 3. Process
    await processFleets(mockAttacker, [mockAttacker, mockDefender]);
    
    // 4. Verify delivery
    // Target should have 100 + 5000 = 5100 metal
    expect(mockDefender.planets[0].resources.metal).toBe(5100);
    
    // Fleet should have 0 resources left
    const processedFleet = mockAttacker.fleets[0];
    expect(processedFleet.resources.metal).toBe(0);
    expect(processedFleet.returning).toBe(true);
  });

  it('should deploy ships and resources to another of player\'s own planets', async () => {
    // 1. Setup second planet for attacker
    const secondPlanet = {
      id: 'ap2',
      coordinates: [1, 1, 3],
      ships: { lightFighter: 0 },
      resources: { metal: 0, crystal: 0, deuterium: 0 }
    };
    mockAttacker.planets.push(secondPlanet);
    
    await savePlayers([mockAttacker]);

    const now = Date.now();
    // 2. Attacker sends deployment to own second planet
    const fleet = {
      id: 'f_deploy',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.DEPLOY,
      ships: { lightFighter: 5 },
      resources: { metal: 2000 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 3],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false
    };
    
    mockAttacker.fleets = [fleet];
    
    // 3. Process
    await processFleets(mockAttacker, [mockAttacker]);
    
    // 4. Verify deployment
    // Ships and resources should be moved to ap2, and fleet removed
    expect(mockAttacker.fleets.length).toBe(0);
    expect(secondPlanet.ships.lightFighter).toBe(5);
    expect(secondPlanet.resources.metal).toBe(2000);
  });

  it('should colonize an empty position', async () => {
    mockAttacker.research.astrophysics = 1;
    const now = Date.now();
    // Attacker sends colony ship to empty [1, 1, 10]
    const fleet = {
      id: 'f_colonize',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.COLONIZE,
      ships: { colonyShip: 1, lightFighter: 2 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 10],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false,
      resources: { metal: 1000 }
    };
    
    mockAttacker.fleets = [fleet];
    
    // Process
    await processFleets(mockAttacker, [mockAttacker, mockDefender]);
    
    // Verify new planet
    expect(mockAttacker.fleets.length).toBe(0); // Fleet removed
    expect(mockAttacker.planets.length).toBe(2); // ap1 and new colony
    
    const colony = mockAttacker.planets.find(p => p.coordinates[2] === 10);
    expect(colony).toBeDefined();
    expect(colony.name).toBe('Colony');
    // Colony ship consumed, light fighters stayed
    expect(colony.ships.lightFighter).toBe(2);
    expect(colony.ships.colonyShip || 0).toBe(0);
  });

  it('should perform espionage and reveal resources', async () => {
    mockAddMessage.mockClear();
    const now = Date.now();
    // Attacker sends 1 probe
    const fleet = {
      id: 'f_spy',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.ESPIONAGE,
      ships: { espionageProbe: 1 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 1, 2],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false
    };
    
    mockAttacker.fleets = [fleet];
    
    // Set random to 1 to avoid detection
    const spyRandom = spyOn(Math, 'random').mockReturnValue(1);
    
    await processFleets(mockAttacker, [mockAttacker, mockDefender]);
    
    expect(mockAddMessage).toHaveBeenCalled();
    const reportCall = mockAddMessage.mock.calls.find(call => call[1].type === 'espionage');
    expect(reportCall).toBeDefined();
    expect(reportCall[1].data.resources).toBeDefined();
    expect(reportCall[1].data.resources.metal).toBe(mockDefender.planets[0].resources.metal);
    
    expect(mockAttacker.fleets[0].returning).toBe(true);
    spyRandom.mockRestore();
  });

  it('should handle expedition finding resources', async () => {
    mockAddMessage.mockClear();
    const now = Date.now();
    const fleet = {
      id: 'f_exp',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.EXPEDITION,
      ships: { smallCargo: 1 },
      originCoords: [1, 1, 1],
      targetCoords: [1, 2, 1], // Different system
      startTime: now - 5000,
      arrivalTime: now - 4000,
      returning: false,
      waiting: false,
      stayTime: 1,
      resources: { metal: 0 }
    };
    
    mockAttacker.fleets = [fleet];
    
    // 1. Arrive at expedition site
    await processFleets(mockAttacker, [mockAttacker]);
    expect(fleet.waiting).toBe(true);
    expect(fleet.returning).toBe(false);

    // 2. Finish stay
    fleet.arrivalTime = now - 100;
    fleet.processedAt = 0; // ALLOW PROCESSING AGAIN
    // Mock random to 0.2 (Resources found)
    const spyRandom = spyOn(Math, 'random').mockReturnValue(0.2);
    
    await processFleets(mockAttacker, [mockAttacker]);
    
    expect(fleet.returning).toBe(true);
    expect(fleet.resources.metal).toBeGreaterThan(0);
    expect(mockAddMessage).toHaveBeenCalled();
    const expMsg = mockAddMessage.mock.calls.find(c => c[1].type === 'expedition');
    expect(expMsg).toBeDefined();
    expect(expMsg[1].data.resultType).toBe('resources');
    
    spyRandom.mockRestore();
  });

  it('should execute market trade', async () => {
    mockAddMessage.mockClear();
    const now = Date.now();
    const fleet = {
      id: 'f_market',
      ownerId: 'attacker',
      missionType: MISSION_TYPES.MARKET_TRADE,
      ships: { largeCargo: 1 },
      resources: { metal: 3000 }, // Selling 3000 metal
      buyResources: { crystal: 2000 }, // Wanting 2000 crystal (Rates: M:1, C:1.5 -> 2000*1.5 = 3000. Perfect match.)
      originCoords: [1, 1, 1],
      targetCoords: [1, 250, 1],
      startTime: now - 1000,
      arrivalTime: now - 100,
      returning: false
    };
    
    mockAttacker.fleets = [fleet];
    
    await processFleets(mockAttacker, [mockAttacker]);
    
    expect(fleet.returning).toBe(true);
    expect(fleet.resources.metal).toBe(0);
    expect(fleet.resources.crystal).toBe(2000);
    
    const marketMsg = mockAddMessage.mock.calls.find(c => c[1].type === 'market');
    expect(marketMsg).toBeDefined();
    expect(marketMsg[1].subject).toContain('TRADE CONFIRMED');
  });
});
