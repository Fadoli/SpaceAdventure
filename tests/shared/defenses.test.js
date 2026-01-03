import { describe, it, expect } from 'bun:test';
import {
  DEFENSES,
  getDefense,
  calculateDefenseCost,
  calculateDefenseBuildTime,
  calculateDefenseStats
} from '../../src/shared/defenses.js';
import { calculateBaseTime } from '../../src/shared/time.js';
import { CONFIG } from '../../src/shared/constants.js';

describe('Defenses - Data Structure', () => {
  it('should have all defense types defined', () => {
    expect(DEFENSES).toHaveProperty('rocketLauncher');
    expect(DEFENSES).toHaveProperty('laserCannon');
    expect(DEFENSES).toHaveProperty('particleBeam');
    expect(DEFENSES).toHaveProperty('shield');
    expect(DEFENSES).toHaveProperty('ionCannon');
  });

  it('should have required properties for each defense', () => {
    const requiredProps = ['name', 'icon', 'description', 'baseCost', 'attack', 'shield', 'hull'];
    
    for (const defenseKey in DEFENSES) {
      const defense = DEFENSES[defenseKey];
      requiredProps.forEach(prop => {
        expect(defense).toHaveProperty(prop);
      });
      
      // Verify cost structure
      expect(defense.baseCost).toHaveProperty('metal');
      expect(defense.baseCost).toHaveProperty('crystal');
      expect(defense.baseCost).toHaveProperty('deuterium');
    }
  });

  it('should have positive costs and stats', () => {
    for (const defenseKey in DEFENSES) {
      const defense = DEFENSES[defenseKey];
      expect(defense.baseCost.metal).toBeGreaterThanOrEqual(0);
      expect(defense.baseCost.crystal).toBeGreaterThanOrEqual(0);
      expect(defense.baseCost.deuterium).toBeGreaterThanOrEqual(0);
      expect(defense.attack).toBeGreaterThanOrEqual(0);
      expect(defense.shield).toBeGreaterThanOrEqual(0);
      expect(defense.hull).toBeGreaterThan(0);
    }
  });

  it('should have descriptive names and icons', () => {
    for (const defenseKey in DEFENSES) {
      const defense = DEFENSES[defenseKey];
      expect(defense.name.length).toBeGreaterThan(0);
      expect(defense.icon.length).toBeGreaterThan(0);
      expect(defense.description.length).toBeGreaterThan(0);
    }
  });
});

describe('Defenses - getDefense Function', () => {
  it('should retrieve defense by key', () => {
    const rocketLauncher = getDefense('rocketLauncher');
    expect(rocketLauncher).not.toBeNull();
    expect(rocketLauncher.name).toBe('Rocket Launcher');
  });

  it('should return undefined for unknown defense', () => {
    const unknown = getDefense('unknownDefense');
    expect(unknown).toBeUndefined();
  });

  it('should return same object reference', () => {
    const def1 = getDefense('laserCannon');
    const def2 = getDefense('laserCannon');
    expect(def1).toBe(def2);
  });

  it('should retrieve all types of defenses', () => {
    const testDefenses = ['rocketLauncher', 'laserCannon', 'particleBeam', 'shield', 'ionCannon', 'plasmaTurret'];
    
    testDefenses.forEach(key => {
      const defense = getDefense(key);
      expect(defense).not.toBeUndefined();
    });
  });
});

describe('Defenses - calculateDefenseCost Function', () => {
  it('should calculate cost for single defense', () => {
    const cost = calculateDefenseCost('rocketLauncher', 1);
    
    expect(cost).not.toBeNull();
    expect(cost.metal).toBeGreaterThan(0);
    expect(cost.crystal).toBeGreaterThanOrEqual(0);
    expect(cost.deuterium).toBeGreaterThanOrEqual(0);
  });

  it('should scale cost linearly with quantity', () => {
    const cost1 = calculateDefenseCost('laserCannon', 1);
    const cost10 = calculateDefenseCost('laserCannon', 10);
    
    expect(cost10.metal).toBe(cost1.metal * 10);
    expect(cost10.crystal).toBe(cost1.crystal * 10);
    expect(cost10.deuterium).toBe(cost1.deuterium * 10);
  });

  it('should not increase cost with level (unlike ships)', () => {
    // Defenses don't have a level multiplier like ships do
    const cost1 = calculateDefenseCost('particleBeam', 1);
    const cost5 = calculateDefenseCost('particleBeam', 5);
    
    // Should scale only by quantity
    expect(cost5.metal).toBe(cost1.metal * 5);
  });

  it('should handle multiple quantities correctly', () => {
    const quantities = [1, 5, 10, 50, 100];
    const baseCost = calculateDefenseCost('shield', 1);
    
    quantities.forEach(qty => {
      const cost = calculateDefenseCost('shield', qty);
      expect(cost.metal).toBe(baseCost.metal * qty);
      expect(cost.crystal).toBe(baseCost.crystal * qty);
      expect(cost.deuterium).toBe(baseCost.deuterium * qty);
    });
  });

  it('should return null for unknown defense', () => {
    const cost = calculateDefenseCost('unknownDefense', 1);
    expect(cost).toBeNull();
  });

  it('should return integer costs', () => {
    const cost = calculateDefenseCost('ionCannon', 7);
    
    expect(Number.isInteger(cost.metal)).toBe(true);
    expect(Number.isInteger(cost.crystal)).toBe(true);
    expect(Number.isInteger(cost.deuterium)).toBe(true);
  });

  it('should handle zero quantity', () => {
    const cost = calculateDefenseCost('rocketLauncher', 0);
    
    expect(cost.metal).toBe(0);
    expect(cost.crystal).toBe(0);
    expect(cost.deuterium).toBe(0);
  });

  it('should show cost differences between defense types', () => {
    const rocketCost = calculateDefenseCost('rocketLauncher', 1);
    const plasmaCost = calculateDefenseCost('plasmaTurret', 1);
    
    // Plasma turret is more advanced and expensive
    expect(plasmaCost.metal).toBeGreaterThan(rocketCost.metal);
  });
});

describe('Defenses - calculateDefenseBuildTime Function', () => {
  it('should calculate build time for single defense', () => {
    const time = calculateDefenseBuildTime('rocketLauncher', 1, 1, 0, 0);
    
    expect(time).toBeGreaterThan(0);
    expect(Number.isInteger(time)).toBe(true);
  });

  it('should increase build time with quantity', () => {
    const time1 = calculateDefenseBuildTime('laserCannon', 1, 1, 0, 0);
    const time5 = calculateDefenseBuildTime('laserCannon', 5, 1, 0, 0);

    // Should scale linearly: 5 defenses = 5x time (within rounding error)
    expect(time5).toBeGreaterThanOrEqual(time1 * 5);
    expect(time5).toBeLessThanOrEqual(time1 * 5 + 1);
  });

  it('should scale linearly with quantity', () => {
    const time1 = calculateDefenseBuildTime('shield', 1, 1, 0, 0);
    const time2 = calculateDefenseBuildTime('shield', 2, 1, 0, 0);
    const time3 = calculateDefenseBuildTime('shield', 3, 1, 0, 0);
    
    expect(time2).toBeGreaterThanOrEqual(time1 * 2);
    expect(time3).toBeGreaterThanOrEqual(time1 * 3);
  });

  it('should decrease build time with robotics level', () => {
    const timeNoRobotics = calculateDefenseBuildTime('particleBeam', 1, 1, 0, 0);
    const timeWithRobotics = calculateDefenseBuildTime('particleBeam', 1, 1, 5, 0);
    
    // Robotics: 0.85^level multiplier
    expect(timeWithRobotics).toBeLessThan(timeNoRobotics);
  });

  it('should dramatically decrease build time with nanite level', () => {
    const timeNoNanites = calculateDefenseBuildTime('ionCannon', 1, 1, 0, 0);
    const timeNanites1 = calculateDefenseBuildTime('ionCannon', 1, 1, 0, 1);
    const timeNanites2 = calculateDefenseBuildTime('ionCannon', 1, 1, 0, 2);
    
    // Nanites: 2^level multiplier (divides time)
    expect(timeNanites1).toBeLessThan(timeNoNanites);
    expect(timeNanites2).toBeLessThan(timeNanites1);
  });

  it('should combine robotics and nanite bonuses', () => {
    const timeBase = calculateDefenseBuildTime('rocketLauncher', 1, 1, 0, 0);
    const timeBoth = calculateDefenseBuildTime('rocketLauncher', 1, 1, 5, 2);
    
    expect(timeBoth).toBeLessThan(timeBase);
  });

  it('should return minimum 1 second', () => {
    const time = calculateDefenseBuildTime('rocketLauncher', 1, 999, 999, 999);
    expect(time).toBeGreaterThanOrEqual(1);
  });

  it('should handle zero robotics and nanites', () => {
    const time = calculateDefenseBuildTime('plasmaTurret', 1, 1, 0, 0);
    expect(time).toBeGreaterThan(0);
  });

  it('should return integer time values', () => {
    const time = calculateDefenseBuildTime('ionCannon', 3, 1, 2, 1);
    expect(Number.isInteger(time)).toBe(true);
  });

  it('should show different build times for different defense types', () => {
    const rocketTime = calculateDefenseBuildTime('rocketLauncher', 1, 1, 0, 0);
    const plasmaTime = calculateDefenseBuildTime('plasmaTurret', 1, 1, 0, 0);
    
    // More advanced defenses take longer
    expect(plasmaTime).toBeGreaterThan(rocketTime);
  });
});

describe('Defenses - calculateDefenseStats Function', () => {
  it('should calculate zero stats for empty defenses', () => {
    const stats = calculateDefenseStats({});
    
    expect(stats.attack).toBe(0);
    expect(stats.shield).toBe(0);
    expect(stats.hull).toBe(0);
  });

  it('should sum attack from defenses', () => {
    const defenses = { rocketLauncher: 10 };
    const stats = calculateDefenseStats(defenses);
    
    const rocket = getDefense('rocketLauncher');
    expect(stats.attack).toBe(rocket.attack * 10);
  });

  it('should sum shield from defenses', () => {
    const defenses = { shield: 5 };
    const stats = calculateDefenseStats(defenses);
    
    const shieldDef = getDefense('shield');
    expect(stats.shield).toBe(shieldDef.shield * 5);
  });

  it('should sum hull from defenses', () => {
    const defenses = { laserCannon: 8 };
    const stats = calculateDefenseStats(defenses);
    
    const laser = getDefense('laserCannon');
    expect(stats.hull).toBe(laser.hull * 8);
  });

  it('should handle mixed defense types', () => {
    const defenses = {
      rocketLauncher: 10,
      laserCannon: 5,
      shield: 3
    };
    
    const stats = calculateDefenseStats(defenses);
    
    const rocket = getDefense('rocketLauncher');
    const laser = getDefense('laserCannon');
    const shieldDef = getDefense('shield');
    
    const expectedAttack = (rocket.attack * 10) + (laser.attack * 5) + (shieldDef.attack * 3);
    expect(stats.attack).toBe(expectedAttack);
  });

  it('should apply weapons technology multiplier', () => {
    const defenses = { rocketLauncher: 10 };
    
    const statsNoTech = calculateDefenseStats(defenses, 0, 0, 0);
    const statsWithTech = calculateDefenseStats(defenses, 5, 0, 0);
    
    // 5 levels = 1 + (5 * 0.1) = 1.5x
    expect(statsWithTech.attack).toBe(Math.floor(statsNoTech.attack * 1.5));
  });

  it('should apply shielding technology multiplier', () => {
    const defenses = { shield: 5 };
    
    const statsNoTech = calculateDefenseStats(defenses, 0, 0, 0);
    const statsWithTech = calculateDefenseStats(defenses, 0, 3, 0);
    
    // 3 levels = 1 + (3 * 0.1) = 1.3x
    expect(statsWithTech.shield).toBe(Math.floor(statsNoTech.shield * 1.3));
  });

  it('should apply armor technology multiplier', () => {
    const defenses = { plasmaTurret: 2 };
    
    const statsNoTech = calculateDefenseStats(defenses, 0, 0, 0);
    const statsWithTech = calculateDefenseStats(defenses, 0, 0, 4);
    
    // 4 levels = 1 + (4 * 0.1) = 1.4x
    expect(statsWithTech.hull).toBe(Math.floor(statsNoTech.hull * 1.4));
  });

  it('should combine all technologies', () => {
    const defenses = {
      laserCannon: 5,
      particleBeam: 3,
      shield: 2
    };
    
    const stats = calculateDefenseStats(defenses, 5, 5, 5);
    
    expect(stats.attack).toBeGreaterThan(0);
    expect(stats.shield).toBeGreaterThan(0);
    expect(stats.hull).toBeGreaterThan(0);
  });

  it('should ignore zero/negative quantities', () => {
    const defenses = {
      rocketLauncher: 10,
      laserCannon: 0,
      shield: -3
    };
    
    const stats = calculateDefenseStats(defenses);
    const rocket = getDefense('rocketLauncher');
    
    expect(stats.attack).toBe(rocket.attack * 10);
  });

  it('should return integer stats', () => {
    const defenses = {
      laserCannon: 7,
      ionCannon: 3
    };
    const stats = calculateDefenseStats(defenses, 2, 3, 1);
    
    expect(Number.isInteger(stats.attack)).toBe(true);
    expect(Number.isInteger(stats.shield)).toBe(true);
    expect(Number.isInteger(stats.hull)).toBe(true);
  });

  it('should show shield-focused defense strategy', () => {
    const shieldFocused = { shield: 20 };
    const attackFocused = { laserCannon: 20 };
    
    const shieldStats = calculateDefenseStats(shieldFocused);
    const attackStats = calculateDefenseStats(attackFocused);
    
    // Shield buildings provide more shield value
    expect(shieldStats.shield).toBeGreaterThan(attackStats.shield);
    // Attack buildings provide more attack power
    expect(attackStats.attack).toBeGreaterThan(shieldStats.attack);
  });

  it('should support mixed defensive strategy', () => {
    const balanced = {
      rocketLauncher: 5,
      laserCannon: 5,
      shield: 5
    };
    
    const stats = calculateDefenseStats(balanced);
    
    // Should have decent values across all stats
    expect(stats.attack).toBeGreaterThan(0);
    expect(stats.shield).toBeGreaterThan(0);
    expect(stats.hull).toBeGreaterThan(0);
  });
});

describe('Defenses - Integration Tests', () => {
  it('should scale costs proportionally to build times', () => {
    const expensive = calculateDefenseCost('plasmaTurret', 1);
    const cheap = calculateDefenseCost('rocketLauncher', 1);
    const timeExpensive = calculateDefenseBuildTime('plasmaTurret', 1, 0, 0);
    const timeCheap = calculateDefenseBuildTime('rocketLauncher', 1, 0, 0);
    
    // More expensive should take longer
    expect(timeExpensive).toBeGreaterThan(timeCheap);
    expect(expensive.metal).toBeGreaterThan(cheap.metal);
  });

  it('should show defense upgrade progression', () => {
    const tier1 = getDefense('rocketLauncher');
    const tier2 = getDefense('particleBeam');
    const tier3 = getDefense('plasmaTurret');
    
    // Each tier should be stronger and more expensive
    expect(tier2.attack).toBeGreaterThan(tier1.attack);
    expect(tier3.attack).toBeGreaterThan(tier2.attack);
    
    const totalCost1 = tier1.baseCost.metal + tier1.baseCost.crystal + tier1.baseCost.deuterium;
    const totalCost2 = tier2.baseCost.metal + tier2.baseCost.crystal + tier2.baseCost.deuterium;
    const totalCost3 = tier3.baseCost.metal + tier3.baseCost.crystal + tier3.baseCost.deuterium;

    expect(totalCost2).toBeGreaterThan(totalCost1);
    expect(totalCost3).toBeGreaterThan(totalCost2);
  });

  it('should allow defense composition analysis', () => {
    const planet = {
      rocketLauncher: 50,
      laserCannon: 30,
      shield: 20,
      particleBeam: 5
    };
    
    const totalCost = {
      metal: 0,
      crystal: 0,
      deuterium: 0
    };
    
    for (const defenseKey in planet) {
      const cost = calculateDefenseCost(defenseKey, planet[defenseKey]);
      totalCost.metal += cost.metal;
      totalCost.crystal += cost.crystal;
      totalCost.deuterium += cost.deuterium;
    }
    
    expect(totalCost.metal).toBeGreaterThan(0);
    const stats = calculateDefenseStats(planet);
    expect(stats.attack).toBeGreaterThan(0);
  });
});
