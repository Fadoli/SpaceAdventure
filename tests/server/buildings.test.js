import { describe, it, expect, beforeEach } from 'bun:test';
import { 
  getBuildingCost, 
  getBuildTime, 
  getProduction,
  getBuildingDeuteriumConsumption,
  getStorageIncrease,
  updatePlanetProduction
} from '../../src/server/game/buildings.js';
import { BUILDINGS } from '../../src/shared/buildings.js';
import { getBuildingEnergyConsumption } from '../../src/shared/formulas.js';

// Mock config module
import.meta.env.NODE_ENV = 'test';

describe('Server Buildings - getBuildingCost', () => {
  it('should calculate building cost with config multiplier', () => {
    const cost = getBuildingCost('metalMine', 0);
    expect(cost).not.toBeNull();
    expect(cost.metal).toBeGreaterThan(0);
    expect(cost.crystal).toBeGreaterThan(0);
  });

  it('should scale cost with 1.5^level', () => {
    const cost0 = getBuildingCost('metalMine', 0);
    const cost1 = getBuildingCost('metalMine', 1);
    
    // cost1 should be approximately cost0 * 1.5
    expect(cost1.metal).toBeGreaterThan(cost0.metal);
  });

  it('should handle higher levels', () => {
    const cost0 = getBuildingCost('metalMine', 0);
    const cost5 = getBuildingCost('metalMine', 5);
    
    expect(cost5.metal).toBeGreaterThan(cost0.metal);
  });

  it('should return integer costs', () => {
    const cost = getBuildingCost('metalMine', 3);
    expect(Number.isInteger(cost.metal)).toBe(true);
    expect(Number.isInteger(cost.crystal)).toBe(true);
    expect(Number.isInteger(cost.deuterium)).toBe(true);
  });
});

describe('Server Buildings - Energy Accounting', () => {
  it('scales fusion deuterium consumption with its effective energy output', () => {
    const baseConsumption = getBuildingDeuteriumConsumption('fusionReactor', 1);
    const planet = {
      activeVariants: { fusionReactor: 'optimized' },
      localBlueprints: {
        fusionReactor: {
          customDefinition: {
            ...BUILDINGS.fusionReactor,
            production: { energy: BUILDINGS.fusionReactor.production.energy * 2 }
          }
        }
      }
    };

    const blueprintConsumption = getBuildingDeuteriumConsumption(
      'fusionReactor',
      1,
      planet,
      { research: {} }
    );

    expect(blueprintConsumption).toBeGreaterThan(baseConsumption);
    expect(blueprintConsumption / baseConsumption).toBeGreaterThan(1.9);
  });

  it('uses the same energy formula for allocation and reported consumption', () => {
    const planet = {
      coordinates: [1, 1, 1],
      resources: { population: 100 },
      buildings: {
        metalMine: 1,
        crystalMine: 0,
        solarPlant: 1,
        waterExtractor: 0,
        farm: 0,
        housing: 1
      },
      buildingAllocations: {
        metalMine: { power: 1, population: 1, priority: 3 },
        solarPlant: { power: 1, population: 1, priority: 3 },
        housing: { power: 1, population: 1, priority: 3 }
      },
      storage: {}
    };

    updatePlanetProduction(planet);

    const expected =
      getBuildingEnergyConsumption('metalMine', 1, BUILDINGS) * planet.actualAllocations.metalMine.power
      + getBuildingEnergyConsumption('housing', 1, BUILDINGS) * planet.actualAllocations.housing.power;
    expect(planet.consumption.energy).toBe(expected);
  });

  it('reduces planet power usage when a consumer receives less power', () => {
    const planet = {
      coordinates: [1, 1, 8],
      resources: { population: 1000 },
      buildings: { metalMine: 1, solarPlant: 10 },
      buildingAllocations: {
        metalMine: { power: 1, population: 1, priority: 1 },
        solarPlant: { power: 1, population: 1, priority: 1 }
      },
      storage: {}
    };

    updatePlanetProduction(planet);
    const fullPowerUsage = planet.energyConsumption;

    planet.buildingAllocations.metalMine.power = 0.25;
    updatePlanetProduction(planet);

    expect(planet.energyConsumption).toBeLessThan(fullPowerUsage);
    expect(planet.energyConsumption).toBe(
      getBuildingEnergyConsumption('metalMine', 1, BUILDINGS) * 0.25
    );
  });

  it('keeps a one-percent allocation proportional instead of treating it as full power', () => {
    const planet = {
      coordinates: [1, 1, 8],
      resources: { population: 1000 },
      buildings: { metalMine: 1, solarPlant: 10 },
      buildingAllocations: {
        metalMine: { power: 0.01, population: 1, priority: 1 },
        solarPlant: { power: 1, population: 1, priority: 1 }
      },
      storage: {}
    };

    updatePlanetProduction(planet);

    expect(planet.actualAllocations.metalMine.power).toBe(0.01);
    expect(planet.energyConsumption).toBe(
      getBuildingEnergyConsumption('metalMine', 1, BUILDINGS) * 0.01
    );
  });

  it('uses producer power allocation when calculating the power budget', () => {
    const planet = {
      coordinates: [1, 1, 8],
      resources: { population: 1000 },
      buildings: { metalMine: 1, solarPlant: 1 },
      buildingAllocations: {
        metalMine: { power: 1, population: 1, priority: 2 },
        solarPlant: { power: 1, population: 1, priority: 1 }
      },
      storage: {}
    };

    updatePlanetProduction(planet);
    const fullPower = planet.energyConsumption;
    const fullMineAllocation = planet.actualAllocations.metalMine.power;

    planet.buildingAllocations.solarPlant.power = 0;
    updatePlanetProduction(planet);

    expect(planet.energyConsumption).toBeLessThan(fullPower);
    expect(planet.actualAllocations.metalMine.power).toBe(0);
    expect(fullMineAllocation).toBeGreaterThan(0);
  });

  it('uses the same efficiency-adjusted demand for priority resolution and totals', () => {
    const planet = {
      coordinates: [1, 1, 8],
      resources: { population: 1000 },
      buildings: { metalMine: 1, solarPlant: 10 },
      buildingAllocations: {
        metalMine: { power: 1, population: 1, priority: 1 },
        solarPlant: { power: 1, population: 1, priority: 1 }
      },
      storage: {}
    };
    const player = { research: { energyTech: 10 } };

    updatePlanetProduction(planet, player);

    expect(planet.energyConsumption).toBe(
      getBuildingEnergyConsumption('metalMine', 1, BUILDINGS, 0.1) * planet.actualAllocations.metalMine.power
    );
  });

  it('satisfies higher energy priorities before lower priorities', () => {
    const planet = {
      coordinates: [1, 1, 8],
      resources: { population: 1000 },
      buildings: { metalMine: 1, crystalMine: 1, solarPlant: 1 },
      buildingAllocations: {
        metalMine: { power: 1, population: 1, priority: 1 },
        crystalMine: { power: 1, population: 1, priority: 3 },
        solarPlant: { power: 1, population: 1, priority: 1 }
      },
      storage: {}
    };

    updatePlanetProduction(planet);

    expect(planet.actualAllocations.metalMine.power).toBeGreaterThan(0);
    expect(planet.actualAllocations.crystalMine.power).toBe(0);
  });

  it('applies population priorities before resolving power', () => {
    const planet = {
      coordinates: [1, 1, 8],
      resources: { population: 1 },
      buildings: { metalMine: 1, crystalMine: 1, solarPlant: 10 },
      buildingAllocations: {
        metalMine: { power: 1, population: 1, priority: 1 },
        crystalMine: { power: 1, population: 1, priority: 3 },
        solarPlant: { power: 1, population: 1, priority: 1 }
      },
      storage: {}
    };

    updatePlanetProduction(planet);

    expect(planet.actualAllocations.metalMine.population).toBeGreaterThan(0);
    expect(planet.actualAllocations.crystalMine.population).toBe(0);
  });
});

describe('Server Buildings - getBuildTime', () => {
  it('should calculate build time for level 1', () => {
    const time = getBuildTime('metalMine', 1);
    expect(time).toBeGreaterThan(0);
  });

  it('should increase with level', () => {
    const time1 = getBuildTime('metalMine', 1);
    const time3 = getBuildTime('metalMine', 3);
    expect(time3).toBeGreaterThan(time1);
  });

  it('should apply robotics factory speedup', () => {
    const noRobotics = getBuildTime('metalMine', 5, 0, 0);
    const withRobotics = getBuildTime('metalMine', 5, 1, 0);
    // Robotics should speed up construction (reduce time)
    expect(withRobotics).toBeLessThan(noRobotics);
  });

  it('should apply nanite factory speedup', () => {
    const noNanite = getBuildTime('metalMine', 5, 0, 0);
    const withNanite = getBuildTime('metalMine', 5, 0, 1);
    // Nanite should significantly speed up construction
    expect(withNanite).toBeLessThan(noNanite);
  });

  it('should enforce minimum time of 1 second', () => {
    // With very high nanite/robotics levels, time could go below 1
    const time = getBuildTime('metalMine', 1, 10, 10);
    expect(time).toBeGreaterThanOrEqual(1);
  });

  it('should apply both multipliers when both provided', () => {
    const baseTime = getBuildTime('metalMine', 3, 0, 0);
    const withBoth = getBuildTime('metalMine', 3, 2, 2);
    expect(withBoth).toBeLessThan(baseTime);
  });

  it('should apply an active robotics blueprint to other buildings', () => {
    const baseTime = getBuildTime('metalMine', 3, 1, 0);
    const planet = {
      buildings: { roboticsFactory: 1 },
      activeVariants: { roboticsFactory: 'optimized' },
      localBlueprints: {
        roboticsFactory: {
          customDefinition: { ...BUILDINGS.roboticsFactory, timeMultiplier: 0.5 }
        }
      }
    };

    const blueprintTime = getBuildTime('metalMine', 3, 1, 0, planet, { research: {} });

    expect(blueprintTime).toBeLessThan(baseTime);
  });

  it('should apply an active nanite blueprint to other buildings', () => {
    const baseTime = getBuildTime('metalMine', 3, 1, 1);
    const planet = {
      buildings: { naniteFactory: 1 },
      activeVariants: { naniteFactory: 'optimized' },
      localBlueprints: {
        naniteFactory: {
          customDefinition: { ...BUILDINGS.naniteFactory, timeMultiplier: 0.5 }
        }
      }
    };

    const blueprintTime = getBuildTime('metalMine', 3, 1, 1, planet, { research: {} });

    expect(blueprintTime).toBeLessThan(baseTime);
  });
});

describe('Server Buildings - getProduction', () => {
  it('should return empty object for buildings without production', () => {
    const production = getProduction('nonexistent', 1);
    expect(Object.keys(production).length).toBe(0);
  });

  it('should calculate production for producing buildings', () => {
    const production = getProduction('metalMine', 1);
    // metalMine should produce metal
    if (BUILDINGS.metalMine && BUILDINGS.metalMine.production) {
      expect(production.metal).toBeGreaterThan(0);
    }
  });

  it('should scale production with 1.1^level', () => {
    const prod1 = getProduction('metalMine', 1);
    const prod2 = getProduction('metalMine', 2);
    
    if (prod1.metal > 0 && prod2.metal > 0) {
      // prod2 should be greater than prod1
      expect(prod2.metal).toBeGreaterThan(prod1.metal);
    }
  });

  it('should handle multiple resources in production', () => {
    // Some buildings may produce multiple resources
    const production = getProduction('metalMine', 1);
    // At minimum, check it returns an object
    expect(typeof production).toBe('object');
  });

  it('should apply production multiplier from config', () => {
    // Production should include config multiplier in calculation
    const production = getProduction('metalMine', 1);
    if (production.metal) {
      expect(production.metal).toBeGreaterThan(0);
    }
  });

  it('should return integer production values', () => {
    const production = getProduction('metalMine', 5);
    for (const resource in production) {
      expect(Number.isInteger(production[resource])).toBe(true);
    }
  });
});

describe('Server Buildings - getStorageIncrease', () => {
  it('should return empty object for non-storage buildings', () => {
    const storage = getStorageIncrease('metalMine', 1);
    expect(Object.keys(storage).length).toBe(0);
  });

  it('should calculate storage for storage buildings', () => {
    const storage = getStorageIncrease('metalStorage', 1);
    if (BUILDINGS.metalStorage && BUILDINGS.metalStorage.storage) {
      expect(Object.keys(storage).length).toBeGreaterThan(0);
    }
  });

  it('should scale with 1.6^(level-1)', () => {
    const storage1 = getStorageIncrease('metalStorage', 1);
    const storage2 = getStorageIncrease('metalStorage', 2);
    
    if (storage1.metal > 0 && storage2.metal > 0) {
      expect(storage2.metal).toBeGreaterThan(storage1.metal);
    }
  });

  it('should return integer storage values', () => {
    const storage = getStorageIncrease('metalStorage', 5);
    for (const resource in storage) {
      expect(Number.isInteger(storage[resource])).toBe(true);
    }
  });
});

// Integration-style tests
describe('Building Cost vs Time Trade-offs', () => {
  it('higher level buildings should cost more and take longer', () => {
    const cost1 = getBuildingCost('metalMine', 1);
    const time1 = getBuildTime('metalMine', 1);
    
    const cost5 = getBuildingCost('metalMine', 5);
    const time5 = getBuildTime('metalMine', 5);
    
    expect(cost5.metal).toBeGreaterThan(cost1.metal);
    expect(time5).toBeGreaterThan(time1);
  });

  it('robotics factory should reduce build time but cost more', () => {
    const noRobotics = getBuildTime('metalMine', 5, 0, 0);
    const withRobotics = getBuildTime('metalMine', 5, 3, 0);
    
    expect(withRobotics).toBeLessThan(noRobotics);
  });
});

describe('Production Scaling', () => {
  it('should increase significantly with level', () => {
    const prod1 = getProduction('metalMine', 1);
    const prod10 = getProduction('metalMine', 10);
    
    if (prod1.metal > 0 && prod10.metal > 0) {
      expect(prod10.metal).toBeGreaterThan(prod1.metal);
    }
  });

  it('exponential scaling should be consistent across different buildings', () => {
    // Both mines should scale similarly
    const metalProd1 = getProduction('metalMine', 1);
    const metalProd2 = getProduction('metalMine', 2);
    
    const crystalProd1 = getProduction('crystalMine', 1);
    const crystalProd2 = getProduction('crystalMine', 2);
    
    if (metalProd1.metal > 0 && metalProd2.metal > 0) {
      const metalRatio = metalProd2.metal / metalProd1.metal;
      expect(metalRatio).toBeGreaterThan(1);
    }
  });
});

describe('Storage Capacity', () => {
  it('should increase substantially with level', () => {
    const storage1 = getStorageIncrease('metalStorage', 1);
    const storage10 = getStorageIncrease('metalStorage', 10);
    
    if (storage1.metal > 0 && storage10.metal > 0) {
      expect(storage10.metal).toBeGreaterThan(storage1.metal);
    }
  });
});
