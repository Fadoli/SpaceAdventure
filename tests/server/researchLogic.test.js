import { describe, it, expect } from 'bun:test';
import { completePracticalResearch, startPracticalResearchWithAllocation } from '../../src/server/game/researchLogic.js';

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
