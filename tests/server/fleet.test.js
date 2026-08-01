import { describe, it, expect, beforeEach, mock, spyOn } from 'bun:test';
import { sendFleet, processFleets } from '../../src/server/game/fleet.js';
import { calculateDistance } from '../../src/shared/formulas.js';
import { MISSION_TYPES } from '../../src/shared/constants.js';
import { savePlayers } from '../../src/server/game/player.js';

// Mocks
const mockPlayer = {
  userId: 'user1',
  username: 'Tester',
  research: { combustionDrive: 0, espionageTech: 0 },
  planets: [
    {
      id: 'p1',
      name: 'Origin',
      coordinates: [1, 1, 1],
      ships: { lightFighter: 10, colonyShip: 1, espionageProbe: 5 },
      resources: { metal: 10000, crystal: 10000, deuterium: 10000, food: 10000, water: 10000, population: 1000 },
      buildings: {},
      production: {},
      storage: {},
      buildingAllocations: {},
      defenses: {},
      buildQueue: [],
      shipQueue: [],
      defenseQueue: []
    }
  ],
  fleets: [],
  researchQueue: [],
  practicalResearch: {},
  practicalResearchQueue: [],
  customBuildingVariants: {},
};

// Mock dependencies
mock.module('../../src/server/storage/storage.js', () => {
  let storage = {};
  return {
    readJsonFile: async (filename) => { return storage[filename] || null; },
    writeJsonFile: async (filename, data) => { storage[filename] = data; return true; }
  };
});

mock.module('../../src/server/game/messages.js', () => ({
  addMessage: async () => {}
}));

mock.module('../../src/server/config.js', () => ({
  getFleetSpeedMultiplier: () => 1
}));


describe('Fleet Management', () => {
  beforeEach(async () => {
    // Reset mock player state
    mockPlayer.planets[0].ships = { lightFighter: 10, colonyShip: 1, espionageProbe: 5 };
    mockPlayer.fleets = [];
    mockPlayer.research = { combustionDrive: 0, espionageTech: 0 };
    mockPlayer.planets.length = 1; // Remove any extra planets from previous tests
    
    // Seed the player into the mocked storage/cache via the real player module
    await savePlayers([mockPlayer]);
  });

  describe('calculateDistance', () => {
    it('should calculate distance within same system (planet diff)', () => {
      // 200 + 20 * diff
      expect(calculateDistance([1, 1, 1], [1, 1, 5])).toBe(200 + 20 * 4);
    });

    it('should calculate distance within same galaxy (system diff)', () => {
      // 1000 + 30 * diff
      expect(calculateDistance([1, 1, 1], [1, 5, 1])).toBe(1000 + 30 * 4);
    });

    it('should calculate distance between galaxies', () => {
      // 5000 * diff
      expect(calculateDistance([1, 1, 1], [2, 1, 1])).toBe(5000 * 1);
    });

    it('should return 5 for same coordinates', () => {
      expect(calculateDistance([1, 1, 1], [1, 1, 1])).toBe(5);
    });
  });

  describe('sendFleet', () => {
    it('should successfully send a fleet', async () => {
      const fleet = await sendFleet(
        'user1',
        'p1',
        [1, 1, 2],
        MISSION_TYPES.ATTACK,
        { lightFighter: 5 }
      );

      expect(fleet).toBeDefined();
      expect(fleet.ships.lightFighter).toBe(5);
      expect(mockPlayer.fleets.length).toBe(1);
      
      // Check ships removed from planet
      expect(mockPlayer.planets[0].ships.lightFighter).toBe(5); // 10 - 5
    });

    it('should handle ultra-slow speed (0.1%)', async () => {
      const slowFleet = await sendFleet(
        'user1',
        'p1',
        [1, 1, 2],
        MISSION_TYPES.ATTACK,
        { lightFighter: 1 },
        {},
        0,
        null,
        0.001 // 0.1% speed
      );

      const fastFleet = await sendFleet(
        'user1',
        'p1',
        [1, 1, 2],
        MISSION_TYPES.ATTACK,
        { lightFighter: 1 },
        {},
        0,
        null,
        1.0 // 100% speed
      );

      expect(slowFleet.speedPercent).toBe(0.001);
      expect(slowFleet.travelTime).toBeGreaterThan(fastFleet.travelTime * 10);
    });

    it('allows recyclers to harvest expedition debris at position 16', async () => {
      mockPlayer.planets[0].ships.recycler = 1;

      const fleet = await sendFleet(
        'user1',
        'p1',
        [1, 1, 16],
        MISSION_TYPES.HARVEST,
        { recycler: 1 }
      );

      expect(fleet.targetCoords).toEqual([1, 1, 16]);
    });

    it('should throw if insufficient ships', async () => {
      expect(sendFleet(
        'user1',
        'p1',
        [1, 1, 2],
        MISSION_TYPES.ATTACK,
        { lightFighter: 20 }
      )).rejects.toThrow('Insufficient ships');
    });

    it('should throw if no ships selected', async () => {
      expect(sendFleet(
        'user1',
        'p1',
        [1, 1, 2],
        MISSION_TYPES.ATTACK,
        { lightFighter: 0 }
      )).rejects.toThrow('ships quantity must be a positive integer');
    });

    it('rejects malformed payloads before changing the origin planet', async () => {
      const origin = mockPlayer.planets[0];
      const before = structuredClone(origin);

      await expect(sendFleet('user1', 'p1', [1, 1, 2], MISSION_TYPES.ATTACK, { lightFighter: 1.5 }))
        .rejects.toThrow('ships quantity must be a positive integer');
      await expect(sendFleet('user1', 'p1', [1, 1, 2], MISSION_TYPES.TRANSPORT, { lightFighter: 1 }, { metal: -1 }))
        .rejects.toThrow('resources quantity must be a positive integer');
      await expect(sendFleet('user1', 'p1', [1, 1, 2], MISSION_TYPES.ATTACK, JSON.parse('{"__proto__":1}')))
        .rejects.toThrow('Unknown ships');
      await expect(sendFleet('user1', 'p1', [1, 500, 2], MISSION_TYPES.ATTACK, { lightFighter: 1 }))
        .rejects.toThrow('Invalid target coordinates');

      expect(origin).toEqual(before);
    });
  });

  describe('processFleets', () => {
    it('should process fleet return', async () => {
      const now = Date.now();
      // For returning fleet, coordinates are swapped: target is Home
      const fleet = {
        id: 'f1',
        ownerId: 'user1',
        originCoords: [1, 1, 2], // Market/Target
        targetCoords: [1, 1, 1], // Home
        missionType: MISSION_TYPES.ATTACK,
        ships: { lightFighter: 5 },
        resources: { metal: 100 },
        startTime: now - 2000,
        arrivalTime: now - 1000, // Arrived in past
        returning: true
      };
      
      mockPlayer.fleets = [fleet];
      
      // Process
      await processFleets(mockPlayer, [mockPlayer]);
      
      expect(mockPlayer.fleets.length).toBe(0);
      // Ships should be back: 10 original + 5 from fleet = 15
      expect(mockPlayer.planets[0].ships.lightFighter).toBe(15);
      expect(mockPlayer.planets[0].resources.metal).toBe(10100);
    });

    it('should process fleet arrival and turn back (Attack)', async () => {
      const now = Date.now();
      const fleet = {
        id: 'f2',
        ownerId: 'user1',
        originCoords: [1, 1, 1],
        targetCoords: [1, 1, 2],
        missionType: MISSION_TYPES.ATTACK,
        ships: { lightFighter: 5 },
        startTime: now - 1000,
        arrivalTime: now - 100,
        returning: false
      };
      
      mockPlayer.fleets = [fleet];
      
      await processFleets(mockPlayer, [mockPlayer]);
      
      expect(mockPlayer.fleets.length).toBe(1);
      expect(mockPlayer.fleets[0].returning).toBe(true);
      expect(mockPlayer.fleets[0].arrivalTime).toBeGreaterThan(now);
    });

    it('preserves historical timing during catch-up', async () => {
      const now = Date.now();
      const fleet = {
        id: 'f-catch-up',
        ownerId: 'user1',
        originCoords: [1, 1, 1],
        targetCoords: [1, 1, 2],
        missionType: MISSION_TYPES.ATTACK,
        ships: { lightFighter: 5 },
        resources: {},
        startTime: now - 86_410_000,
        arrivalTime: now - 86_400_000,
        returning: false
      };
      mockPlayer.fleets = [fleet];

      await processFleets(mockPlayer, [mockPlayer], now, true);

      expect(fleet.startTime).toBe(now - 86_400_000);
      expect(fleet.arrivalTime).toBeLessThan(now);

      await processFleets(mockPlayer, [mockPlayer], now, true);
      await processFleets(mockPlayer, [mockPlayer], now, true);
      expect(mockPlayer.fleets).toHaveLength(0);
    });

    it('should process colonization success', async () => {
      mockPlayer.research.astrophysics = 1;
      const now = Date.now();
      const fleet = {
        id: 'f3',
        ownerId: 'user1',
        originCoords: [1, 1, 1],
        targetCoords: [1, 1, 10], // Empty slot
        missionType: MISSION_TYPES.COLONIZE,
        ships: { colonyShip: 1 },
        startTime: now - 1000,
        arrivalTime: now - 100,
        returning: false
      };
      
      mockPlayer.fleets = [fleet];
      
      await processFleets(mockPlayer, [mockPlayer]);
      
      expect(mockPlayer.fleets.length).toBe(0); // Mission complete
      expect(mockPlayer.planets.length).toBe(2);
      expect(mockPlayer.planets[1].name).toBe('Colony');
    });

    it('should fail colonization if occupied', async () => {
      // Create another player occupying the target
      const otherPlayer = {
        userId: 'user2',
        planets: [{ coordinates: [1, 1, 10] }]
      };
      
      const now = Date.now();
      const fleet = {
        id: 'f4',
        ownerId: 'user1',
        originCoords: [1, 1, 1],
        targetCoords: [1, 1, 10], // Occupied
        missionType: MISSION_TYPES.COLONIZE,
        ships: { colonyShip: 1 },
        startTime: now - 1000,
        arrivalTime: now - 100,
        returning: false
      };
      
      mockPlayer.fleets = [fleet];
      
      await processFleets(mockPlayer, [mockPlayer, otherPlayer]);
      
      expect(mockPlayer.fleets.length).toBe(1);
      expect(mockPlayer.fleets[0].returning).toBe(true); // Returns
      expect(mockPlayer.planets.length).toBe(1); // No new planet
    });
  });
});
