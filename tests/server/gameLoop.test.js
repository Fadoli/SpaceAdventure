import { describe, it, expect } from 'bun:test';
import { getCatchUpTimes } from '../../src/server/game/gameLoop.js';

describe('Game loop catch-up', () => {
  it('collapses long downtime into one delta-based tick', () => {
    const day = 24 * 60 * 60 * 1000;
    const target = 200 * day;
    expect(getCatchUpTimes(0, target)).toEqual([target]);
  });

  it('does not replay when time has not advanced', () => {
    expect(getCatchUpTimes(1000, 1000)).toEqual([]);
  });

  it('publishes building completion after the canonical player update', async () => {
    const source = await Bun.file(new URL('../../src/server/game/gameLoop.js', import.meta.url)).text();
    expect(source.indexOf('if (stateChanged) await updatePlayer')).toBeLessThan(
      source.indexOf('for (const event of pendingEvents)')
    );
  });
});
