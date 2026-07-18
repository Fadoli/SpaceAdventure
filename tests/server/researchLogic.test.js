import { describe, it, expect } from 'bun:test';
import { cancelPracticalResearch, cancelTheoreticalResearch, completePracticalResearch, startPracticalResearchWithAllocation } from '../../src/server/game/researchLogic.js';

describe('completePracticalResearch Fix', () => {
  it('should handle missing experience/history in practicalResearch', async () => {
    const player = {
      practicalResearch: {
        'metalMine': {
            // Missing experience
            // Missing history
            treeBonus: 1.0
        }
      },
      practicalResearchQueue: [
        {
          id: 'test-queue-id',
          baseType: 'metalMine',
          strength: 0.5,
          allocation: { output: 1.0 }
        }
      ]
    };

    // Should not throw
    const logEntry = await completePracticalResearch(player, 'test-queue-id');

    expect(logEntry).toBeDefined();
    expect(player.practicalResearch['metalMine'].experience).toBeDefined();
    expect(player.practicalResearch['metalMine'].experience.output).toBeDefined();
    expect(player.practicalResearch['metalMine'].lastResult).toBeDefined();
    expect(player.practicalResearch['metalMine'].lastResult.id).toBe(logEntry.id);
  });
});

describe('practical research input validation', () => {
  const makePlayer = () => ({
    userId: 'user-1',
    research: {},
    planets: [{
      id: 'planet-1',
      buildings: { researchLab: 1 },
      resources: { metal: 1e9, crystal: 1e9, deuterium: 1e9 }
    }]
  });

  it('rejects malformed payloads before changing player state', () => {
    const player = makePlayer();
    const before = structuredClone(player);
    const invalid = [
      ['__proto__', { output: 1 }, 0.5],
      ['metalMine', { output: '1' }, 0.5],
      ['metalMine', { output: 1, exploit: 0 }, 0.5],
      ['metalMine', { output: 1 }, -0.1]
    ];

    for (const [key, allocation, strength] of invalid) {
      expect(() => startPracticalResearchWithAllocation(player, key, allocation, 'planet-1', strength)).toThrow();
    }
    expect(player).toEqual(before);
  });

  it('accepts zero strength', () => {
    const player = makePlayer();
    const item = startPracticalResearchWithAllocation(player, 'metalMine', { output: 1 }, 'planet-1', 0);

    expect(item.strength).toBe(0);
  });
});

describe('research queue cancellation', () => {
  const makeQueue = () => {
    const start = Date.now();
    return [
      { id: 'first', startTime: start, endTime: start + 1_000, duration: 1_000, cost: { metal: 0 } },
      { id: 'second', startTime: start + 1_000, endTime: start + 3_000, duration: 2_000, cost: { metal: 0 } }
    ];
  };

  it('moves theoretical research forward after cancellation', () => {
    const player = { userId: 'user-1', planets: [{ id: 'planet-1', resources: { metal: 0 } }], researchQueue: makeQueue() };
    const originalStart = player.researchQueue[1].startTime;

    cancelTheoreticalResearch(player, 'first', 'planet-1');

    expect(player.researchQueue[0].startTime).toBeLessThan(originalStart);
    expect(player.researchQueue[0].endTime - player.researchQueue[0].startTime).toBe(2_000);
  });

  it('moves practical research forward after cancellation', () => {
    const player = { userId: 'user-1', planets: [{ id: 'planet-1', resources: { metal: 0 } }], practicalResearchQueue: makeQueue() };
    const originalStart = player.practicalResearchQueue[1].startTime;

    cancelPracticalResearch(player, 'first', 'planet-1');

    expect(player.practicalResearchQueue[0].startTime).toBeLessThan(originalStart);
    expect(player.practicalResearchQueue[0].endTime - player.practicalResearchQueue[0].startTime).toBe(2_000);
  });
});
