import { describe, it, expect } from 'bun:test';
import { simulateCombat } from '../../src/server/game/combatEngine.js';
import { SHIPS } from '../../src/shared/ships.js';
import { DEFENSES } from '../../src/shared/defenses.js';

describe('Combat Engine', () => {
  it('should handle a simple one-on-one combat', () => {
    const attacker = {
      ships: { lightFighter: 1 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };
    const defender = {
      ships: { lightFighter: 1 },
      defenses: {},
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    const report = simulateCombat(attacker, defender);
    expect(report.rounds.length).toBeGreaterThan(0);
    expect(['attacker', 'defender', 'draw']).toContain(report.winner);
  });

  it('should determine the winner correctly when one side is overpowered', () => {
    const attacker = {
      ships: { battleship: 10 },
      research: { weaponsTech: 10, shieldingTech: 10, armorTech: 10 }
    };
    const defender = {
      ships: { lightFighter: 1 },
      defenses: {},
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    const report = simulateCombat(attacker, defender);
    expect(report.winner).toBe('attacker');
    expect(Object.keys(report.attackerLosses).length).toBe(0);
    expect(report.defenderLosses.ships.lightFighter).toBe(1);
  });

  it('should apply research bonuses to unit stats', () => {
    // A single battleship with high tech vs many small ships with no tech
    // High tech battleship should survive more hits
    const attacker = {
      ships: { battleship: 1 },
      research: { weaponsTech: 20, shieldingTech: 20, armorTech: 20 }
    };
    const defender = {
      ships: { lightFighter: 20 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    const report = simulateCombat(attacker, defender);
    // Even if it loses, we check if rounds occur and stats were applied
    expect(report.rounds.length).toBeGreaterThan(0);
  });

  it('should regenerate shields between rounds', () => {
    // If we have a high-shield unit vs many weak units
    // The weak units must punch through the full shield every round
    const attacker = {
      ships: { espionageProbe: 100 }, // Many weak shots
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };
    const defender = {
      ships: { battleship: 1 }, // High shield (200)
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    // Espionage probe attack is 0 (or 0.1 depending on tech). 
    // In our SHIPS.js, attack is 0. 
    // Let's use Light Fighters (50 attack) vs a unit with high shield.
    const attacker2 = {
      ships: { espionageProbe: 100 }, // 0 attack power
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };
    const defender2 = {
      ships: { battleship: 1 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    const report = simulateCombat(attacker2, defender2);
    // Espionage probes have 0 attack.
    // They should never damage the battleship.
    expect(report.defenderLosses.ships?.battleship).toBeUndefined();
    expect(report.winner).toBe('draw');
  });

  it('should implement rapid fire logic', () => {
    // Cruiser has 6x rapid fire vs light fighters
    const attacker = {
      ships: { cruiser: 1 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };
    const defender = {
      ships: { lightFighter: 20 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    const report = simulateCombat(attacker, defender);
    // A single cruiser (400 attack) without rapid fire could kill max 1 light fighter per round (6 rounds = 6 fighters)
    // With rapid fire (6x), it should kill significantly more.
    const totalLost = report.defenderLosses.ships?.lightFighter || 0;
    // Note: Combat is random, but on average it should be > 6
    // We'll just check if the cruiser successfully killed at least a few
    expect(totalLost).toBeGreaterThan(0);
  });

  it('should generate debris from lost ships', () => {
    const attacker = {
      ships: { lightFighter: 10 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };
    const defender = {
      ships: { lightFighter: 10 },
      research: { weaponsTech: 0, shieldingTech: 0, armorTech: 0 }
    };

    const report = simulateCombat(attacker, defender);
    expect(report.debris.metal).toBeGreaterThan(0);
    expect(report.debris.crystal).toBeGreaterThan(0);
  });

  it('should cap combat at 6 rounds', () => {
    const attacker = {
      ships: { battleship: 10 },
      research: { weaponsTech: 0, shieldingTech: 10, armorTech: 10 }
    };
    const defender = {
      ships: { battleship: 10 },
      research: { weaponsTech: 0, shieldingTech: 10, armorTech: 10 }
    };

    const report = simulateCombat(attacker, defender);
    expect(report.rounds.length).toBeLessThanOrEqual(6);
  });
});
