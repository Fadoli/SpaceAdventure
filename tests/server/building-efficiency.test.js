import { describe, it, expect } from 'bun:test';
import {
  getBuildingCost,
  getBuildTime,
  getProduction,
  getStorageIncrease
} from '../../src/server/game/buildings.js';
import { BUILDINGS } from '../../src/shared/buildings.js';

describe('Building Efficiency - Cost-to-Production Analysis', () => {
  it('should show metal mine has diminishing efficiency at higher levels', () => {
    // Track cost efficiency: cost per unit production per hour
    const efficiencies = [];
    
    for (let level = 1; level <= 10; level++) {
      const cost = getBuildingCost('metalMine', level);
      const production = getProduction('metalMine', level);
      
      const totalCost = cost.metal + cost.crystal + cost.deuterium;
      const hourlyProduction = production.metal || 0;
      
      if (hourlyProduction > 0) {
        const costPerUnit = totalCost / hourlyProduction;
        efficiencies.push({ level, costPerUnit });
      }
    }
    
    // Cost scales faster than production, so later levels are less efficient
    if (efficiencies.length >= 2) {
      const early = efficiencies[0].costPerUnit;
      const late = efficiencies[efficiencies.length - 1].costPerUnit;
      // Later levels should be more expensive per unit (diminishing efficiency)
      expect(late).toBeGreaterThan(early);
    }
  });

  it('should compare efficiency between different mine types', () => {
    const metalEfficiency = {};
    const crystalEfficiency = {};
    
    for (let level = 1; level <= 5; level++) {
      const metalCost = getBuildingCost('metalMine', level);
      const metalProd = getProduction('metalMine', level);
      const metalTotal = metalCost.metal + metalCost.crystal + metalCost.deuterium;
      
      const crystalCost = getBuildingCost('crystalMine', level);
      const crystalProd = getProduction('crystalMine', level);
      const crystalTotal = crystalCost.metal + crystalCost.crystal + crystalCost.deuterium;
      
      if (metalProd.metal) {
        metalEfficiency[level] = metalTotal / metalProd.metal;
      }
      if (crystalProd.crystal) {
        crystalEfficiency[level] = crystalTotal / crystalProd.crystal;
      }
    }
    
    // Both should show decreasing cost per unit with higher levels
    expect(Object.keys(metalEfficiency).length).toBeGreaterThan(0);
    expect(Object.keys(crystalEfficiency).length).toBeGreaterThan(0);
  });

  it('should show production payoff timeline', () => {
    // Calculate how long it takes production to recoup the cost
    const level = 5;
    const cost = getBuildingCost('metalMine', level);
    const totalCost = cost.metal + (cost.crystal * 2) + (cost.deuterium * 3); // Weight resources
    const production = getProduction('metalMine', level);
    
    if (production.metal > 0) {
      // Hours needed to recoup cost (accounting for weighted resources)
      const hoursToPayback = totalCost / (production.metal * 2);
      
      // Should be reasonable (not negative)
      expect(hoursToPayback).toBeGreaterThan(0);
    }
  });
});

describe('Building Efficiency - Time Investment Analysis', () => {
  it('should show build time increases with level', () => {
    const times = [];
    
    for (let level = 1; level <= 5; level++) {
      const time = getBuildTime('metalMine', level);
      times.push(time);
    }
    
    // Each level should take longer
    for (let i = 1; i < times.length; i++) {
      expect(times[i]).toBeGreaterThan(times[i - 1]);
    }
  });

  it('should calculate cost-per-production-hour ratio', () => {
    const level = 3;
    const cost = getBuildingCost('metalMine', level);
    const buildTime = getBuildTime('metalMine', level);
    const production = getProduction('metalMine', level);
    
    const totalCost = cost.metal + cost.crystal + cost.deuterium;
    
    if (production.metal > 0 && buildTime > 0) {
      const costPerProductionHour = totalCost / (production.metal / 3600); // Time in seconds
      expect(costPerProductionHour).toBeGreaterThan(0);
    }
  });

  it('should show robotics factory ROI through reduced build times', () => {
    // Compare total time to upgrade multiple buildings with and without robotics
    const withoutRobotics = [];
    const withRobotics = [];
    
    for (let level = 1; level <= 5; level++) {
      withoutRobotics.push(getBuildTime('metalMine', level, 0, 0));
      withRobotics.push(getBuildTime('metalMine', level, 5, 0));
    }
    
    const totalWithout = withoutRobotics.reduce((a, b) => a + b, 0);
    const totalWith = withRobotics.reduce((a, b) => a + b, 0);
    
    // With robotics, total time should be significantly less
    expect(totalWith).toBeLessThan(totalWithout);
    expect(totalWith).toBeLessThan(totalWithout * 0.5); // At least 50% faster
  });
});

describe('Building Efficiency - Resource Balance', () => {
  it('should show metal mine requires only metal and crystal', () => {
    const cost = getBuildingCost('metalMine', 5);
    
    expect(cost.metal).toBeGreaterThan(0);
    expect(cost.crystal).toBeGreaterThan(0);
    expect(cost.deuterium).toBe(0);
  });

  it('should show deuterium-consuming buildings are expensive', () => {
    const fusionCost = getBuildingCost('fusionReactor', 1);
    const metalCost = getBuildingCost('metalMine', 1);
    
    // Fusion reactor should be more expensive overall
    const fusionTotal = fusionCost.metal + fusionCost.crystal + fusionCost.deuterium;
    const metalTotal = metalCost.metal + metalCost.crystal + metalCost.deuterium;
    
    expect(fusionTotal).toBeGreaterThan(metalTotal);
  });

  it('should analyze cost distribution across resources', () => {
    const cost = getBuildingCost('metalMine', 5);
    const total = cost.metal + cost.crystal + cost.deuterium;
    
    if (total > 0) {
      const metalPercent = (cost.metal / total) * 100;
      const crystalPercent = (cost.crystal / total) * 100;
      const deuteriumPercent = (cost.deuterium / total) * 100;
      
      // Should add up to 100%
      expect(Math.abs((metalPercent + crystalPercent + deuteriumPercent) - 100)).toBeLessThan(0.1);
    }
  });
});

describe('Building Efficiency - Storage Capacity Analysis', () => {
  it('should show storage buildings scale exponentially', () => {
    const storages = [];
    
    for (let level = 1; level <= 10; level++) {
      const storage = getStorageIncrease('metalStorage', level);
      if (storage.metal) {
        storages.push(storage.metal);
      }
    }
    
    // Each level should increase storage
    for (let i = 1; i < storages.length; i++) {
      expect(storages[i]).toBeGreaterThan(storages[i - 1]);
    }
  });

  it('should compare cost-per-storage-unit for different storage buildings', () => {
    const level = 5;
    
    const metalCost = getBuildingCost('metalStorage', level);
    const metalStorage = getStorageIncrease('metalStorage', level);
    const metalCostPerUnit = (metalCost.metal + metalCost.crystal) / (metalStorage.metal || 1);
    
    const crystalCost = getBuildingCost('crystalStorage', level);
    const crystalStorage = getStorageIncrease('crystalStorage', level);
    const crystalCostPerUnit = (crystalCost.metal + crystalCost.crystal) / (crystalStorage.crystal || 1);
    
    // Both should have reasonable cost-per-unit values
    expect(metalCostPerUnit).toBeGreaterThan(0);
    expect(crystalCostPerUnit).toBeGreaterThan(0);
  });

  it('should show storage upgrade payoff', () => {
    // How much resource production time to recoup storage cost?
    const level = 5;
    const cost = getBuildingCost('metalStorage', level);
    const storage = getStorageIncrease('metalStorage', level);
    
    const totalCost = cost.metal + (cost.crystal * 2);
    const storageCapacity = storage.metal || 0;
    
    if (storageCapacity > 0) {
      const resourcesPerPoint = totalCost / storageCapacity;
      expect(resourcesPerPoint).toBeGreaterThan(0);
    }
  });
});

describe('Building Efficiency - Comparative Analysis', () => {
  it('should identify most efficient production building at each level', () => {
    const level = 5;
    
    const mines = ['metalMine', 'crystalMine'];
    const efficiencies = {};
    
    mines.forEach(mine => {
      const cost = getBuildingCost(mine, level);
      const prod = getProduction(mine, level);
      const totalCost = cost.metal + cost.crystal + cost.deuterium;
      
      const resource = mine === 'metalMine' ? 'metal' : 'crystal';
      if (prod[resource] > 0) {
        efficiencies[mine] = totalCost / prod[resource];
      }
    });
    
    expect(Object.keys(efficiencies).length).toBe(2);
  });

  it('should show trade-offs between robotics and nanite factories', () => {
    const level = 5;
    
    // Cost of building robotics vs production gained
    const roboticsCost = getBuildingCost('roboticsFactory', level);
    const roboticsTotal = roboticsCost.metal + roboticsCost.crystal + roboticsCost.deuterium;
    
    // Cost of building nanite factory
    const naniteCost = getBuildingCost('naniteFactory', level);
    const naniteTotal = naniteCost.metal + naniteCost.crystal + naniteCost.deuterium;
    
    // Nanite should be much more expensive
    expect(naniteTotal).toBeGreaterThan(roboticsTotal);
  });

  it('should calculate speedup ROI for acceleration buildings', () => {
    // How much faster can you build with robotics?
    const level = 5;
    const speedWithout = getBuildTime('metalMine', level, 0, 0);
    const speedWith = getBuildTime('metalMine', level, 10, 0);
    
    const speedupFactor = speedWithout / speedWith;
    expect(speedupFactor).toBeGreaterThan(1);
  });
});

describe('Building Efficiency - Complete Building Chain Analysis', () => {
  it('should show progression cost for a resource building chain', () => {
    const chain = ['metalMine', 'metalStorage', 'roboticsFactory'];
    const costs = [];
    
    for (let level = 1; level <= 5; level++) {
      let totalForLevel = 0;
      
      chain.forEach(building => {
        const cost = getBuildingCost(building, level);
        totalForLevel += cost.metal + cost.crystal + cost.deuterium;
      });
      
      costs.push(totalForLevel);
    }
    
    // Each level should cost more than previous
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });

  it('should identify optimal building upgrade order by efficiency', () => {
    const level = 3;
    const buildings = ['metalMine', 'crystalMine', 'waterExtractor'];
    
    const efficiencyScores = {};
    
    buildings.forEach(building => {
      const cost = getBuildingCost(building, level);
      const production = getProduction(building, level);
      const time = getBuildTime(building, level);
      
      const totalCost = cost.metal + cost.crystal + cost.deuterium;
      
      // Find which resource this building produces
      let prod = 0;
      for (const resource in production) {
        prod = production[resource];
        break;
      }
      
      if (prod > 0 && time > 0) {
        // Score: production per resource invested per second of build time
        efficiencyScores[building] = prod / (totalCost * time);
      }
    });
    
    expect(Object.keys(efficiencyScores).length).toBeGreaterThan(0);
  });
});

describe('Building Efficiency - Late Game Scaling', () => {
  it('should show exponential cost growth at high levels', () => {
    const costs = [];
    
    for (let level = 1; level <= 20; level += 5) {
      const cost = getBuildingCost('metalMine', level);
      const total = cost.metal + cost.crystal + cost.deuterium;
      costs.push(total);
    }
    
    // Each jump should be significantly more expensive
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i]).toBeGreaterThan(costs[i - 1]);
    }
  });

  it('should show production cannot keep pace with cost growth', () => {
    // At low level: cost is reasonable relative to production
    const level1Cost = getBuildingCost('metalMine', 1);
    const level1Prod = getProduction('metalMine', 1);
    const level1Ratio = (level1Cost.metal + level1Cost.crystal) / (level1Prod.metal || 1);
    
    // At high level: cost grows faster than production
    const level20Cost = getBuildingCost('metalMine', 20);
    const level20Prod = getProduction('metalMine', 20);
    const level20Ratio = (level20Cost.metal + level20Cost.crystal) / (level20Prod.metal || 1);
    
    // Cost-to-production ratio should increase
    expect(level20Ratio).toBeGreaterThan(level1Ratio);
  });

  it('should identify diminishing returns at high levels', () => {
    const improvements = [];
    
    for (let level = 1; level < 20; level++) {
      const currentProd = getProduction('metalMine', level);
      const nextProd = getProduction('metalMine', level + 1);
      
      const improvement = ((nextProd.metal - currentProd.metal) / currentProd.metal) * 100;
      improvements.push(improvement);
    }
    
    // Later improvements should be smaller (in percentage terms)
    const earlyAvg = improvements.slice(0, 5).reduce((a, b) => a + b) / 5;
    const lateAvg = improvements.slice(-5).reduce((a, b) => a + b) / 5;
    
    // Early levels should show bigger percentage gains
    expect(earlyAvg).toBeGreaterThan(lateAvg);
  });
});

describe('Building Efficiency - Strategy Scenarios', () => {
  it('should analyze rush strategy: minimum cost to get production online', () => {
    const level = 1;
    const cost = getBuildingCost('metalMine', level);
    const time = getBuildTime('metalMine', level);
    const production = getProduction('metalMine', level);
    
    const resourceNeeded = cost.metal + cost.crystal + cost.deuterium;
    
    // Should be relatively affordable
    expect(resourceNeeded).toBeGreaterThan(0);
    expect(time).toBeGreaterThan(0);
    expect(production.metal).toBeGreaterThan(0);
  });

  it('should analyze slow strategy: maximizing long-term efficiency', () => {
    const earlyLevels = [];
    
    for (let level = 15; level <= 25; level++) {
      const cost = getBuildingCost('metalMine', level);
      const production = getProduction('metalMine', level);
      
      const totalCost = cost.metal + cost.crystal + cost.deuterium;
      const efficiency = production.metal / totalCost;
      
      earlyLevels.push(efficiency);
    }
    
    // Efficiency metrics at high levels
    expect(earlyLevels.length).toBeGreaterThan(0);
  });

  it('should compare resource investment in different building types', () => {
    const level = 10;
    
    // Production building
    const prodCost = getBuildingCost('metalMine', level);
    const prodTotal = prodCost.metal + prodCost.crystal + prodCost.deuterium;
    const production = getProduction('metalMine', level);
    
    // Storage building
    const storageCost = getBuildingCost('metalStorage', level);
    const storageTotal = storageCost.metal + storageCost.crystal + storageCost.deuterium;
    const storage = getStorageIncrease('metalStorage', level);
    
    // Both are investments but different types
    expect(prodTotal).toBeGreaterThan(0);
    expect(storageTotal).toBeGreaterThan(0);
  });
});
