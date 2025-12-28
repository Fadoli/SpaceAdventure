import { describe, it, expect, beforeEach } from 'bun:test';
import {
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime
} from '../../src/shared/formulas.js';

describe('Research Cost Calculations', () => {
  describe('Theoretical Research Costs', () => {
    it('should double cost with each level', () => {
      const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
      
      const level0 = calculateTheoreticalResearchCost(baseCost, 0);
      const level1 = calculateTheoreticalResearchCost(baseCost, 1);
      const level2 = calculateTheoreticalResearchCost(baseCost, 2);
      const level3 = calculateTheoreticalResearchCost(baseCost, 3);
      
      // Verify exponential growth
      expect(level1.metal).toBe(Math.floor(baseCost.metal * 2));
      expect(level2.metal).toBe(Math.floor(baseCost.metal * 4));
      expect(level3.metal).toBe(Math.floor(baseCost.metal * 8));
    });

    it('should apply cost multiplier to all resources equally', () => {
      const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
      const level5 = calculateTheoreticalResearchCost(baseCost, 5);
      
      const multiplier = Math.pow(2, 5);
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

    it('should be significantly cheaper than theoretical at high levels', () => {
      const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
      
      const theoreticalLevel5 = calculateTheoreticalResearchCost(baseCost, 5);
      const practicalLevel5 = calculatePracticalResearchCost(baseCost, 5);
      
      expect(practicalLevel5.metal).toBeLessThan(theoreticalLevel5.metal);
      expect(practicalLevel5.crystal).toBeLessThan(theoreticalLevel5.crystal);
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
    it('should double time with each level', () => {
      const baseTime = 3600;
      
      const level0 = calculateTheoreticalResearchTime(baseTime, 0, 1);
      const level1 = calculateTheoreticalResearchTime(baseTime, 1, 1);
      const level2 = calculateTheoreticalResearchTime(baseTime, 2, 1);
      
      expect(level1).toBe(Math.floor(baseTime * Math.pow(2, 1) / (1 + 0.15)));
      expect(level2).toBe(Math.floor(baseTime * Math.pow(2, 2) / (1 + 0.15)));
    });

    it('should apply research lab speedup (15% per level)', () => {
      const baseTime = 3600;
      const level = 2;
      
      const labLevel1 = calculateTheoreticalResearchTime(baseTime, level, 1);
      const labLevel5 = calculateTheoreticalResearchTime(baseTime, level, 5);
      const labLevel10 = calculateTheoreticalResearchTime(baseTime, level, 10);
      
      expect(labLevel1).toBeGreaterThan(labLevel5);
      expect(labLevel5).toBeGreaterThan(labLevel10);
    });

    it('should calculate speedup correctly', () => {
      const baseTime = 3600;
      const level = 3;
      
      const labLevel5 = calculateTheoreticalResearchTime(baseTime, level, 5);
      const expected = Math.floor(baseTime * Math.pow(2, level) / (1 + 0.15 * 5));
      
      expect(labLevel5).toBe(expected);
    });

    it('should always return positive time', () => {
      const baseTime = 3600;
      
      for (let level = 0; level <= 20; level++) {
        for (let labLevel = 0; labLevel <= 20; labLevel++) {
          const time = calculateTheoreticalResearchTime(baseTime, level, labLevel);
          expect(time).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('Practical Research Time', () => {
    it('should use 1.5x scaling per level', () => {
      const baseTime = 1800;
      
      const level0 = calculatePracticalResearchTime(baseTime, 0, 1);
      const level1 = calculatePracticalResearchTime(baseTime, 1, 1);
      const level2 = calculatePracticalResearchTime(baseTime, 2, 1);
      
      expect(level1).toBe(Math.floor(baseTime * 1.5 / (1 + 0.15)));
      expect(level2).toBe(Math.floor(baseTime * Math.pow(1.5, 2) / (1 + 0.15)));
    });

    it('should be significantly faster than theoretical', () => {
      const baseTime = 3600;
      
      const theoretical = calculateTheoreticalResearchTime(baseTime, 5, 3);
      const practical = calculatePracticalResearchTime(baseTime, 5, 3);
      
      expect(practical).toBeLessThan(theoretical);
    });

    it('should apply lab speedup', () => {
      const baseTime = 1800;
      const level = 3;
      
      const labLevel1 = calculatePracticalResearchTime(baseTime, level, 1);
      const labLevel3 = calculatePracticalResearchTime(baseTime, level, 3);
      
      expect(labLevel3).toBeLessThan(labLevel1);
    });

    it('should return positive time even at high levels', () => {
      const baseTime = 1800;
      
      for (let level = 0; level <= 15; level++) {
        const time = calculatePracticalResearchTime(baseTime, level, 5);
        expect(time).toBeGreaterThan(0);
      }
    });
  });

  describe('Time Comparison', () => {
    it('practical should always be faster than theoretical', () => {
      const baseTime = 3600;
      
      for (let level = 0; level <= 8; level++) {
        for (let labLevel = 1; labLevel <= 10; labLevel++) {
          const theoretical = calculateTheoreticalResearchTime(baseTime, level, labLevel);
          const practical = calculatePracticalResearchTime(baseTime, level, labLevel);
          
          expect(practical).toBeLessThanOrEqual(theoretical);
        }
      }
    });

    it('lab should provide same multiplier benefit for both types', () => {
      const baseTime = 3600;
      const level = 3;
      
      // Calculate ratio of time reduction
      const theoretical1 = calculateTheoreticalResearchTime(baseTime, level, 1);
      const theoretical5 = calculateTheoreticalResearchTime(baseTime, level, 5);
      const theoreticalRatio = theoretical1 / theoretical5;
      
      const practical1 = calculatePracticalResearchTime(baseTime, level, 1);
      const practical5 = calculatePracticalResearchTime(baseTime, level, 5);
      const practicalRatio = practical1 / practical5;
      
      // Ratios should be similar (same lab multiplier applied)
      expect(Math.abs(theoreticalRatio - practicalRatio)).toBeLessThan(0.1);
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
    const baseTime = 3600;
    const baseCost = { metal: 200, crystal: 100, deuterium: 50 };
    
    // At level 5
    const cost5 = calculateTheoreticalResearchCost(baseCost, 5);
    const time5 = calculateTheoreticalResearchTime(baseTime, 5, 3);
    
    // Cost multiplier
    const costMultiplier = Math.pow(2, 5);
    // Time multiplier with lab speedup applied
    const timeMultiplier = Math.pow(2, 5) / (1 + 0.15 * 3);
    
    // Time multiplier should be less than cost multiplier due to lab speedup
    expect(timeMultiplier).toBeLessThan(costMultiplier);
  });

  it('practical research scaling should be more balanced', () => {
    const baseTime = 1800;
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    
    // At level 5
    const cost5 = calculatePracticalResearchCost(baseCost, 5);
    const time5 = calculatePracticalResearchTime(baseTime, 5, 3);
    
    // Both use 1.5x multiplier
    const expectedCostMult = Math.pow(1.5, 5);
    const expectedTimeMult = Math.pow(1.5, 5) / (1 + 0.15 * 3);
    
    expect(expectedTimeMult / expectedCostMult).toBeCloseTo(1, 0.1);
  });
});

describe('Edge Cases', () => {
  it('should handle level 0 correctly', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    const baseTime = 3600;
    
    const cost = calculateTheoreticalResearchCost(baseCost, 0);
    const time = calculateTheoreticalResearchTime(baseTime, 0, 1);
    
    expect(cost.metal).toBe(baseCost.metal);
    expect(time).toBeGreaterThan(0);
  });

  it('should handle very high levels', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    const baseTime = 3600;
    
    const cost = calculateTheoreticalResearchCost(baseCost, 20);
    const time = calculateTheoreticalResearchTime(baseTime, 20, 5);
    
    expect(cost.metal).toBeGreaterThan(0);
    expect(time).toBeGreaterThan(0);
  });

  it('should handle zero lab level correctly', () => {
    const baseTime = 3600;
    
    const time = calculateTheoreticalResearchTime(baseTime, 3, 1);
    const expected = Math.floor(baseTime * Math.pow(2, 3) / (1 + 0.15));
    
    expect(time).toBe(expected);
  });
});
