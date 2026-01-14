import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';

// Mock storage
let mockStorage = {};
mock.module('../../src/server/storage/storage.js', () => ({
  readJsonFile: async (filename) => mockStorage[filename] || null,
  writeJsonFile: async (filename, data) => { mockStorage[filename] = data; return true; }
}));

// Mock galaxyData
let mockGalaxy = { playerRegistry: {} };
mock.module('../../src/server/game/galaxyData.js', () => ({
  getGalaxyData: async () => mockGalaxy,
  registerPlayer: async (userId, username, homeworld) => {
    mockGalaxy.playerRegistry[userId] = { username, homeworld };
  }
}));

import { createPlayer, getRankings, takeRankingSnapshot, recomputePlayerScores } from '../../src/server/game/player.js';

describe('Rankings System', () => {
  beforeEach(() => {
    mockStorage = {};
    mockGalaxy = { playerRegistry: {} };
  });

  afterEach(() => {
    mock.restore();
  });

  describe('Score Recomputation', () => {
    it('should calculate scores based on current buildings', async () => {
      const player = await createPlayer('u1', 'TestUser');
      player.planets[0].buildings.metalMine = 5;
      await recomputePlayerScores(player);
      expect(player.statistics.economySpent).toBeGreaterThan(0);
    });

    it('should reflect lost ships', async () => {
      const player = await createPlayer('u1', 'FleetOwner');
      player.planets[0].ships.lightFighter = 10;
      await recomputePlayerScores(player);
      const initial = player.statistics.fleetSpent;
      expect(initial).toBe(40000);
      player.planets[0].ships.lightFighter = 5;
      await recomputePlayerScores(player);
      expect(player.statistics.fleetSpent).toBe(20000);
    });
  });

  describe('Categorized Rankings', () => {
    it('should return correct order for economy', async () => {
      const p1 = await createPlayer('u1', 'Eco1');
      const p2 = await createPlayer('u2', 'Eco2');
      p1.planets[0].buildings.metalMine = 10;
      p2.planets[0].buildings.metalMine = 5;
      await recomputePlayerScores(p1);
      await recomputePlayerScores(p2);
      
      const rank = await getRankings(0, 10, {}, 'economy');
      expect(rank.rankings[0].username).toBe('Eco1');
    });
  });

  describe('Historical Changes', () => {
    it('should calculate delta since last snapshot', async () => {
      const p1 = await createPlayer('u1', 'Player1');
      p1.planets[0].buildings.metalMine = 5;
      await takeRankingSnapshot();
      
      p1.planets[0].buildings.metalMine = 10;
      await recomputePlayerScores(p1);
      
      const rank = await getRankings(0, 10, {}, 'economy');
      expect(rank.rankings[0].scoreChange).toBeGreaterThan(0);
    });
  });
});
