import { describe, it, expect } from 'bun:test';
import { completePracticalResearch } from '../../src/server/game/researchLogic.js';

describe('completePracticalResearch Fix', () => {
  it('should handle missing experience/history in practicalResearch', () => {
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
    const logEntry = completePracticalResearch(player, 'test-queue-id');

    expect(logEntry).toBeDefined();
    expect(player.practicalResearch['metalMine'].experience).toBeDefined();
    expect(player.practicalResearch['metalMine'].experience.output).toBeDefined();
    expect(player.practicalResearch['metalMine'].history).toBeDefined();
    expect(player.practicalResearch['metalMine'].history.length).toBe(1);
  });
});
