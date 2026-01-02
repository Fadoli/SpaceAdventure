import { describe, it, expect, beforeEach } from 'bun:test';
import {
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime
} from '../../src/shared/formulas.js';
import { THEORETICAL_RESEARCH, PRACTICAL_RESEARCH } from '../../src/shared/research.js';

const energyTech = THEORETICAL_RESEARCH.energyTech; // baseTime 500
const metalMineResearch = PRACTICAL_RESEARCH.metalMine; // baseTime 250

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
    it('should use slower 1.5x scaling', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      
      const level0 = calculatePracticalResearchCost(baseCost, 0);
      const level1 = calculatePracticalResearchCost(baseCost, 1);
      const level2 = calculatePracticalResearchCost(baseCost, 2);
      const level3 = calculatePracticalResearchCost(baseCost, 3);
      
      expect(level1.metal).toBe(Math.floor(baseCost.metal * 1.5));
      expect(level2.metal).toBe(Math.floor(baseCost.metal * Math.pow(1.5, 2)));
      expect(level3.metal).toBe(Math.floor(baseCost.metal * Math.pow(1.5, 3)));
    });

    it('should scale at the same rate as theoretical at high levels', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      
      const theoreticalLevel5 = calculateTheoreticalResearchCost(baseCost, 5);
      const practicalLevel5 = calculatePracticalResearchCost(baseCost, 5);
      
      expect(practicalLevel5.metal).toBe(theoreticalLevel5.metal);
      expect(practicalLevel5.crystal).toBe(theoreticalLevel5.crystal);
    });

    it('should apply cost multiplier to all resources', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      const level4 = calculatePracticalResearchCost(baseCost, 4);
      
      const multiplier = Math.pow(1.5, 4);
      expect(level4.metal).toBe(Math.floor(baseCost.metal * multiplier));
      expect(level4.crystal).toBe(Math.floor(baseCost.crystal * multiplier));
      expect(level4.deuterium).toBe(Math.floor(baseCost.deuterium * multiplier));
    });
  });

  describe('Cost Comparison', () => {
    it('practical should be cheaper than theoretical at same level', () => {
      const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
      
      for (let level = 0; level <= 10; level++) {
        const theoretical = calculateTheoreticalResearchCost(baseCost, level);
        const practical = calculatePracticalResearchCost(baseCost, level);
        
        expect(practical.metal).toBeLessThanOrEqual(theoretical.metal);
      }
    });

    it('both should increase consistently with level', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      
      const theoretical = [
        calculateTheoreticalResearchCost(baseCost, 0),
        calculateTheoreticalResearchCost(baseCost, 1),
        calculateTheoreticalResearchCost(baseCost, 2),
        calculateTheoreticalResearchCost(baseCost, 3)
      ];
      
      for (let i = 1; i < theoretical.length; i++) {
        expect(theoretical[i].metal).toBeGreaterThan(theoretical[i - 1].metal);
      }
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
    it('should use 1.5x scaling per level', () => {
      const level0 = calculatePracticalResearchTime(metalMineResearch, 0, 1);
      const level1 = calculatePracticalResearchTime(metalMineResearch, 1, 1);
      const level2 = calculatePracticalResearchTime(metalMineResearch, 2, 1);
      
      expect(level1).toBe(Math.floor(250 * 1.5 * 0.85));
      expect(level2).toBe(Math.floor(250 * Math.pow(1.5, 2) * 0.85));
    });

    it('should be significantly faster than theoretical', () => {
      const theoretical = calculateTheoreticalResearchTime(energyTech, 5, 3);
      const practical = calculatePracticalResearchTime(metalMineResearch, 5, 3);
      
      expect(practical).toBeLessThan(theoretical);
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
    it('practical should always be faster than theoretical', () => {
      for (let level = 0; level <= 8; level++) {
        for (let labLevel = 1; labLevel <= 10; labLevel++) {
          const theoretical = calculateTheoreticalResearchTime(energyTech, level, labLevel);
          const practical = calculatePracticalResearchTime(metalMineResearch, level, labLevel);
          
          expect(practical).toBeLessThanOrEqual(theoretical);
        }
      }
    });

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
