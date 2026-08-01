import { describe, expect, it } from 'bun:test';

globalThis.window = globalThis.window || {};

const { linkifyCoords, renderCombatReport } = await import('../../src/client/js/views/messages.js');

describe('message rendering', () => {
  it('escapes stored HTML while preserving coordinate links', () => {
    const html = linkifyCoords('<img src=x onerror=alert(1)> at [2:42:7]');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('window.navigateToCoords(2, 42, 7)');
  });

  it('renders turn-by-turn combat unit counts', () => {
    const html = renderCombatReport({
      winner: 'attacker',
      isAttacker: true,
      targetCoords: [1, 2, 3],
      rounds: [{
        round: 1,
        attackerShotCount: 10,
        defenderShotCount: 8,
        attackerDamage: 100,
        defenderDamage: 80,
        attackerRemaining: 9,
        defenderRemaining: 7,
        attackerDestroyed: 1,
        defenderDestroyed: 3
      }],
      attackerLosses: {},
      defenderLosses: { ships: {}, defenses: {} }
    });

    expect(html).toContain('ATTACKERS');
    expect(html).toContain('9 left');
    expect(html).toContain('-3');
    expect(html).toContain('100 dmg');
    expect(html).toContain('BATTLE SUMMARY');
    expect(html).toContain('VIEW ROUND-BY-ROUND UNIT COUNTS');
    expect(html).toContain('UNIT DETAIL UNAVAILABLE');
  });
});
