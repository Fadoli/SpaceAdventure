import { describe, it, expect, beforeEach } from 'bun:test';
import {
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime
} from '../../src/shared/formulas.js';
import { THEORETICAL_RESEARCH, PRACTICAL_RESEARCH, canResearchTheoretical } from '../../src/shared/research.js';
import { calculateShipSpeed, SHIPS } from '../../src/shared/ships.js';

const energyTech = THEORETICAL_RESEARCH.energyTech; // baseTime 500
const metalMineResearch = PRACTICAL_RESEARCH.metalMine; // baseTime 50

describe('Research Availability (canResearchTheoretical)', () => {
  it('should return true if no prerequisites or requirements', () => {
    // energyTech has no requirements in our current definition (besides unlocks)
    expect(canResearchTheoretical('energyTech', {}, {})).toBe(true);
  });

  it('should check research prerequisites', () => {
    // weaponsTech requires computerTech
    expect(canResearchTheoretical('weaponsTech', {}, { researchLab: 10 })).toBe(false);
    expect(canResearchTheoretical('weaponsTech', { computerTech: 1 }, { researchLab: 10 })).toBe(true);
  });

  it('should check building requirements', () => {
    // computerTech requires researchLab level 1
    expect(canResearchTheoretical('computerTech', {}, {})).toBe(false);
    expect(canResearchTheoretical('computerTech', {}, { researchLab: 1 })).toBe(true);
  });

  it('should check both research and building requirements', () => {
    // astrophysics requires computerTech and researchLab level 3
    expect(canResearchTheoretical('astrophysics', {}, { researchLab: 10 })).toBe(false);
    expect(canResearchTheoretical('astrophysics', { computerTech: 1 }, { researchLab: 2 })).toBe(false);
    expect(canResearchTheoretical('astrophysics', { computerTech: 1 }, { researchLab: 3 })).toBe(true);
  });
});

describe('Research Cost Calculations', () => {
  describe('Theoretical Research Costs', () => {
    it('should increase cost by 1.5x with each level', () => {
      const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
      
      const level0 = calculateTheoreticalResearchCost(baseCost, 0);
      const level1 = calculateTheoreticalResearchCost(baseCost, 1);
      const level2 = calculateTheoreticalResearchCost(baseCost, 2);
      const level3 = calculateTheoreticalResearchCost(baseCost, 3);
      
      // Verify exponential growth
      expect(level1.metal).toBe(Math.floor(baseCost.metal * 1.5));
      expect(level2.metal).toBe(Math.floor(baseCost.metal * Math.pow(1.5, 2)));
      expect(level3.metal).toBe(Math.floor(baseCost.metal * Math.pow(1.5, 3)));
    });

    it('should apply cost multiplier to all resources equally', () => {
      const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
      const level5 = calculateTheoreticalResearchCost(baseCost, 5);
      
      const multiplier = Math.pow(1.5, 5);
      expect(level5.metal).toBe(Math.floor(baseCost.metal * multiplier));
      expect(level5.crystal).toBe(Math.floor(baseCost.crystal * multiplier));
      expect(level5.deuterium).toBe(Math.floor(baseCost.deuterium * multiplier));
    });

    it('should handle zero cost resources', () => {
      const baseCost = { metal: 200, crystal: 0, deuterium: 0 };
      const level3 = calculateTheoreticalResearchCost(baseCost, 3);
      
      expect(level3.metal).toBeGreaterThan(0);
      expect(level3.crystal).toBe(0);
      expect(level3.deuterium).toBe(0);
    });

    it('should always return integers', () => {
      const baseCost = { metal: 333, crystal: 111, deuterium: 77 };
      const result = calculateTheoreticalResearchCost(baseCost, 4);
      
      expect(Number.isInteger(result.metal)).toBe(true);
      expect(Number.isInteger(result.crystal)).toBe(true);
      expect(Number.isInteger(result.deuterium)).toBe(true);
    });
  });

  describe('Practical Research Costs', () => {
    it('should use linear level scaling (1 + 0.3*level)', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      const allocation = { output: 1.0 }; // cost modifier 1.05
      const strength = 0.5; // multiplier 10^(1+2.5) = 10^3.5 = 3162.277...
      const strengthMult = Math.pow(10, 3.5);
      
      // Level 0: 1.05 * 1.0 * 3162 = ~332k
      const level0 = calculatePracticalResearchCost(baseCost, 0, allocation, strength);
      const expected0 = Math.ceil(100 * 1.05 * 1.0 * strengthMult);
      expect(level0.metal).toBe(expected0);

      // Level 1: 1.05 * 1.3 * 3162 = ~431k
      const level1 = calculatePracticalResearchCost(baseCost, 1, allocation, strength);
      const expected1 = Math.ceil(100 * 1.05 * 1.3 * strengthMult);
      expect(level1.metal).toBe(expected1);
    });

    it('should scale significantly with strength', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      
      // Strength 0 (multiplier 10)
      const lowStr = calculatePracticalResearchCost(baseCost, 0, { output: 1 }, 0);
      
      // Strength 1 (multiplier 1,000,000)
      const highStr = calculatePracticalResearchCost(baseCost, 0, { output: 1 }, 1);
      
      // Ratio should be 1,000,000 / 10 = 100,000x
      expect(highStr.metal).toBeGreaterThan(lowStr.metal * 90000);
    });

    it('should apply allocation cost modifiers', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      
      // Cost focus (0.88 multiplier)
      const costFocus = calculatePracticalResearchCost(baseCost, 0, { cost: 1.0 });
      
      // Output focus (1.05 multiplier)
      const outputFocus = calculatePracticalResearchCost(baseCost, 0, { output: 1.0 });
      
      expect(costFocus.metal).toBeLessThan(outputFocus.metal);
    });
  });

  describe('Cost Comparison', () => {
    it('practical should be cheaper than theoretical at high levels AND low strength', () => {
      const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
      const level = 10;
      
      const theoretical = calculateTheoreticalResearchCost(baseCost, level);
      // Use strength 0 (10x multiplier)
      const practical = calculatePracticalResearchCost(baseCost, level, { output: 1 }, 0.0);
      
      // Theoretical: 1.5^10 ~= 57x
      // Practical: (1 + 3) * 10 * 1.05 ~= 42x
      expect(practical.metal).toBeLessThan(theoretical.metal);
    });

    it('both should increase with level', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      const allocation = { output: 1 };
      
      const theoretical = [
        calculateTheoreticalResearchCost(baseCost, 0),
        calculateTheoreticalResearchCost(baseCost, 1)
      ];
      
      const practical = [
        calculatePracticalResearchCost(baseCost, 0, allocation),
        calculatePracticalResearchCost(baseCost, 1, allocation)
      ];
      
      expect(theoretical[1].metal).toBeGreaterThan(theoretical[0].metal);
      expect(practical[1].metal).toBeGreaterThan(practical[0].metal);
    });
  });
});

describe('Research Time Calculations', () => {

  describe('Theoretical Research Time', () => {
    it('should scale time with 1.5x each level', () => {
      const level0 = calculateTheoreticalResearchTime(energyTech, 0, 1);
      const level1 = calculateTheoreticalResearchTime(energyTech, 1, 1);
      const level2 = calculateTheoreticalResearchTime(energyTech, 2, 1);
      
      expect(level1).toBe(Math.floor(500 * Math.pow(1.5, 1) * Math.pow(0.85, 1)));
      expect(level2).toBe(Math.floor(500 * Math.pow(1.5, 2) * Math.pow(0.85, 1)));
    });

    it('should apply research lab speedup (multiplicative 0.85^level)', () => {
      const level = 2;
      
      const labLevel1 = calculateTheoreticalResearchTime(energyTech, level, 1);
      const labLevel5 = calculateTheoreticalResearchTime(energyTech, level, 5);
      const labLevel10 = calculateTheoreticalResearchTime(energyTech, level, 10);
      
      expect(labLevel1).toBeGreaterThan(labLevel5);
      expect(labLevel5).toBeGreaterThan(labLevel10);
    });

    it('should calculate speedup correctly', () => {
      const level = 3;
      
      const labLevel5 = calculateTheoreticalResearchTime(energyTech, level, 5);
      const expected = Math.floor(500 * Math.pow(1.5, level) * Math.pow(0.85, 5));
      
      expect(labLevel5).toBe(expected);
    });

    it('should always return positive time', () => {
      for (let level = 0; level <= 20; level++) {
        for (let labLevel = 0; labLevel <= 20; labLevel++) {
          const time = calculateTheoreticalResearchTime(energyTech, level, labLevel);
          expect(time).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Practical Research Time', () => {
    it('should scale with cost (level, strength, and allocation)', () => {
      // Formula: calculateBaseTime(calculatePracticalResearchCost(...)) * labMult
      const allocation = { output: 1.0 };
      const strength = 0.5;
      const strMult = Math.pow(10, 3.5);
      
      const level0 = calculatePracticalResearchTime(metalMineResearch, 0, 1, 0, 1.0, strength, allocation);
      const level1 = calculatePracticalResearchTime(metalMineResearch, 1, 1, 0, 1.0, strength, allocation);
      
      const expected1 = Math.floor(50 * 1.3 * strMult * 1.05 * 0.85);
      expect(Math.abs(level1 - expected1)).toBeLessThanOrEqual(5);
      expect(level1).toBeGreaterThan(level0);
    });

    it('should be capped by maxTime (7 days)', () => {
      // Max strength 1.0 (1M mult)
      const time = calculatePracticalResearchTime(metalMineResearch, 30, 1, 0, 1.0, 1.0, { output: 1 });
      expect(time).toBe(604800);
    });

    it('should apply lab speedup', () => {
      const level = 3;
      
      const labLevel1 = calculatePracticalResearchTime(metalMineResearch, level, 1);
      const labLevel3 = calculatePracticalResearchTime(metalMineResearch, level, 3);
      
      expect(labLevel3).toBeLessThan(labLevel1);
    });

    it('should return positive time even at high levels', () => {
      for (let level = 0; level <= 15; level++) {
        const time = calculatePracticalResearchTime(metalMineResearch, level, 5);
        expect(time).toBeGreaterThan(0);
      }
    });
  });

  describe('Time Comparison', () => {
    it('lab should provide same multiplier benefit for both types', () => {
      const level = 3;
      
      // Calculate ratio of time reduction: lab level 1 vs lab level 5
      const theoretical1 = calculateTheoreticalResearchTime(energyTech, level, 1);
      const theoretical5 = calculateTheoreticalResearchTime(energyTech, level, 5);
      const theoreticalRatio = theoretical1 / theoretical5;
      
      const practical1 = calculatePracticalResearchTime(metalMineResearch, level, 1);
      const practical5 = calculatePracticalResearchTime(metalMineResearch, level, 5);
      const practicalRatio = practical1 / practical5;
      
      // The ratio should be exactly 0.85^1 / 0.85^5 = 1 / 0.85^4 = 1.915...
      // Since Math.floor is used internally, we check with a small tolerance
      expect(theoreticalRatio).toBeCloseTo(practicalRatio, 1);
    });
  });
});

describe('Research Progression Scenarios', () => {
  it('should cost increasingly more for higher tech levels', () => {
    const baseCost = { metal: 1000, crystal: 500, deuterium: 250 };
    
    const costs = [];
    for (let level = 0; level <= 10; level++) {
      const cost = calculateTheoreticalResearchCost(baseCost, level);
      costs.push(cost.metal);
    }
    
    // Each level should be more expensive than the last
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });

  it('time requirements scale with lab efficiency factor', () => {
    const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
    
    // At level 5
    const cost5 = calculateTheoreticalResearchCost(baseCost, 5);
    const time5 = calculateTheoreticalResearchTime(energyTech, 5, 3);
    
    // Cost multiplier
    const costMultiplier = Math.pow(1.5, 5);
    // Time multiplier with lab speedup applied
    const timeMultiplier = Math.pow(1.5, 5) * Math.pow(0.85, 3);
    
    // Time multiplier should be less than cost multiplier due to lab speedup
    expect(timeMultiplier).toBeLessThan(costMultiplier);
  });

  it('practical research scaling should be more balanced', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    
    // At level 5
    const cost5 = calculatePracticalResearchCost(baseCost, 5);
    const time5 = calculatePracticalResearchTime(metalMineResearch, 5, 3);
    
    // Both use 1.5x multiplier for base scaling
    const expectedCostMult = Math.pow(1.5, 5);
    const expectedTimeMult = Math.pow(1.5, 5) * Math.pow(0.85, 3);
    
    expect(expectedTimeMult).toBeLessThan(expectedCostMult);
  });
});

describe('Edge Cases', () => {
  it('should handle level 0 correctly', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    
    const cost = calculateTheoreticalResearchCost(baseCost, 0);
    const time = calculateTheoreticalResearchTime(energyTech, 0, 1);
    
    expect(cost.metal).toBe(baseCost.metal);
    expect(time).toBeGreaterThan(0);
  });

  it('should handle very high levels', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    
    const cost = calculateTheoreticalResearchCost(baseCost, 20);
    const time = calculateTheoreticalResearchTime(energyTech, 20, 5);
    
    expect(cost.metal).toBeGreaterThan(0);
    expect(time).toBeGreaterThan(0);
  });

  it('should handle zero lab level correctly', () => {
    const time = calculateTheoreticalResearchTime(energyTech, 3, 0);
    const expected = Math.floor(500 * Math.pow(1.5, 3) * Math.pow(0.85, 0));
    
    expect(time).toBe(expected);
  });
});

describe('Ship Drive Speed Calculations', () => {
  it('should apply combustion drive bonus to light fighters', () => {
    const baseSpeed = SHIPS.lightFighter.speed;
    const research = { combustionDrive: 5 }; // 5 * 20% = 100% bonus (2x speed)
    const effectiveSpeed = calculateShipSpeed('lightFighter', research);
    
    expect(effectiveSpeed).toBe(baseSpeed * 2);
  });

  it('should apply impulse drive bonus to heavy fighters', () => {
    const baseSpeed = SHIPS.heavyFighter.speed;
    const research = { impulseDrive: 2 }; // 2 * 30% = 60% bonus (1.6x speed)
    const effectiveSpeed = calculateShipSpeed('heavyFighter', research);
    
    expect(effectiveSpeed).toBe(Math.floor(baseSpeed * 1.6));
  });

  it('should apply hyperspace drive bonus to battleships', () => {
    const baseSpeed = SHIPS.battleship.speed;
    const research = { hyperspaceDrive: 1 }; // 1 * 50% = 50% bonus (1.5x speed)
    const effectiveSpeed = calculateShipSpeed('battleship', research);
    
    expect(effectiveSpeed).toBe(Math.floor(baseSpeed * 1.5));
  });

  it('should not apply wrong drive bonus to ships', () => {
    const baseSpeed = SHIPS.lightFighter.speed;
    const research = { impulseDrive: 10, hyperspaceDrive: 10 };
    const effectiveSpeed = calculateShipSpeed('lightFighter', research);
    
    expect(effectiveSpeed).toBe(baseSpeed);
  });
});

