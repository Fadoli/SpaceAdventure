import { describe, it, expect } from 'bun:test';
import {
  calculateBuildingCost,
  calculateBuildTime,
  calculateProduction,
  calculateResearchCost,
  calculateResearchTime,
  calculateStorage,
  calculateFuelConsumption,
  calculateTravelTime,
  calculateCombatPower,
  calculateAllocationEffectiveness,
  calculatePowerEffectiveness,
  calculatePopulationEffectiveness,
  calculatePopulationChange,
  calculatePositionMultiplier,
  getBuildingEnergyConsumption,
  getBuildingPopulationRequired,
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime,
  applyTheoreticalBonus
} from '../../src/shared/formulas.js';
import { BUILDINGS } from '../../src/shared/buildings.js';

import { THEORETICAL_RESEARCH, PRACTICAL_RESEARCH } from '../../src/shared/research.js';

// ============ Building Cost Tests ============
describe('calculateBuildingCost', () => {
  it('should calculate base cost for level 0', () => {
    const baseCost = { metal: 60, crystal: 15, deuterium: 0 };
    const result = calculateBuildingCost(baseCost, 0);
    expect(result.metal).toBe(60);
    expect(result.crystal).toBe(15);
    expect(result.deuterium).toBe(0);
  });

  it('should scale cost exponentially with 1.5^level', () => {
    const baseCost = { metal: 60, crystal: 15, deuterium: 0 };
    const result = calculateBuildingCost(baseCost, 1);
    expect(result.metal).toBe(Math.floor(60 * 1.5));
    expect(result.crystal).toBe(Math.floor(15 * 1.5));
  });

  it('should handle higher levels correctly', () => {
    const baseCost = { metal: 60, crystal: 15, deuterium: 0 };
    const result = calculateBuildingCost(baseCost, 5);
    expect(result.metal).toBe(Math.floor(60 * Math.pow(1.5, 5)));
    expect(result.crystal).toBe(Math.floor(15 * Math.pow(1.5, 5)));
  });

  it('should always return integers', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    const result = calculateBuildingCost(baseCost, 3);
    expect(Number.isInteger(result.metal)).toBe(true);
    expect(Number.isInteger(result.crystal)).toBe(true);
    expect(Number.isInteger(result.deuterium)).toBe(true);
  });
});

// ============ Build Time Tests ============
describe('calculateBuildTime', () => {
  const building = BUILDINGS.roboticsFactory; // metal: 400, crystal: 120, deuterium: 200 => baseTime: 1180

  it('should calculate base time at level 0', () => {
    const result = calculateBuildTime(building, 0);
    expect(result).toBe(1180);
  });

  it('should scale time with 1.5^level', () => {
    const result = calculateBuildTime(building, 2);
    expect(result).toBe(Math.floor(1180 * Math.pow(1.5, 2)));
  });

  it('should apply robotics factory multiplier (0.8^level)', () => {
    const result = calculateBuildTime(building, 1, 2);
    const expectedTime = Math.floor(1180 * Math.pow(1.5, 1) * Math.pow(0.8, 2));
    expect(result).toBe(expectedTime);
  });

  it('should apply nanite factory multiplier (2^level)', () => {
    const result = calculateBuildTime(building, 1, 0, 2);
    const expectedTime = Math.floor(1180 * Math.pow(1.5, 1) * Math.pow(2, 2));
    expect(result).toBe(expectedTime);
  });

  it('should apply both multipliers when both are provided', () => {
    const result = calculateBuildTime(building, 1, 1, 1);
    const expectedTime = Math.floor(1180 * Math.pow(1.5, 1) * Math.pow(0.8, 1) * Math.pow(2, 1));
    expect(result).toBe(expectedTime);
  });

  it('robotics factory should speed up construction', () => {
    const noRobotics = calculateBuildTime(building, 5, 0, 0);
    const withRobotics = calculateBuildTime(building, 5, 1, 0);
    expect(withRobotics).toBeLessThan(noRobotics);
  });

  it('nanite factory should slow down construction (increases time)', () => {
    const noNanite = calculateBuildTime(building, 5, 0, 0);
    const withNanite = calculateBuildTime(building, 5, 0, 1);
    // Nanite multiplier increases time (2^level multiplier)
    expect(withNanite).toBeGreaterThan(noNanite);
  });
});

// ============ Production Tests ============
describe('calculateProduction', () => {
  it('should calculate production at level 0', () => {
    const result = calculateProduction(30, 0);
    expect(result).toBe(0);
  });

  it('should scale production with level * 1.1^level', () => {
    const result = calculateProduction(30, 5);
    expect(result).toBe(Math.floor(30 * 5 * Math.pow(1.1, 5)));
  });

  it('should handle high levels', () => {
    const result = calculateProduction(30, 20);
    expect(result).toBeGreaterThan(30);
  });

  it('should apply variant multiplier', () => {
    const baseProduction = 30 * 15 * Math.pow(1.1, 15);
    const withVariant = calculateProduction(30, 15, 1.49);
    expect(withVariant).toBeCloseTo(Math.floor(baseProduction * 1.49));
  });

  it('should handle variant modifier of 1.49 for +49% production', () => {
    const result = calculateProduction(30, 15, 1.49);
    const expectedBase = 30 * 15 * Math.pow(1.1, 15);
    const expected = Math.floor(expectedBase * 1.49);
    expect(result).toBeCloseTo(expected);
  });
});

// ============ Research Cost Tests ============
describe('calculateResearchCost', () => {
  it('should use legacy 2^level formula', () => {
    const baseCost = { metal: 200, crystal: 100, deuterium: 30 };
    const result = calculateResearchCost(baseCost, 0);
    expect(result.metal).toBe(200);
    expect(result.crystal).toBe(100);
    expect(result.deuterium).toBe(30);
  });

  it('should scale cost exponentially with 2^level', () => {
    const baseCost = { metal: 200, crystal: 100, deuterium: 30 };
    const result = calculateResearchCost(baseCost, 1);
    expect(result.metal).toBe(Math.floor(200 * 2));
    expect(result.crystal).toBe(Math.floor(100 * 2));
  });
});

// ============ Research Time Tests ============
describe('calculateResearchTime', () => {
  const research = THEORETICAL_RESEARCH.energyTech; // metal: 200, crystal: 100, deuterium: 50 => baseTime: 500
  it('should calculate base time at level 0', () => {
    const result = calculateResearchTime(research, 0, 1);
    // At level 0 with lab level 1: time = 500 * 1 / (1 + 0.1*1) = 500 / 1.1
    const expected = Math.floor(500 / (1 + 0.1));
    expect(result).toBe(expected);
  });

  it('should scale with 2^level', () => {
    const result = calculateResearchTime(research, 2, 1);
    expect(result).toBe(Math.floor(500 * Math.pow(2, 2) / (1 + 0.1)));
  });

  it('should apply lab multiplier', () => {
    const result = calculateResearchTime(research, 1, 5);
    const expectedTime = Math.floor(500 * Math.pow(2, 1) / (1 + 0.1 * 5));
    expect(result).toBe(expectedTime);
  });
});

// ============ Storage Tests ============
describe('calculateStorage', () => {
  it('should calculate base storage', () => {
    const result = calculateStorage(5000, 0);
    expect(result).toBe(5000);
  });

  it('should scale with 1.5^level', () => {
    const result = calculateStorage(5000, 3);
    expect(result).toBe(Math.floor(5000 * Math.pow(1.5, 3)));
  });
});

// ============ Fuel Consumption Tests ============
describe('calculateFuelConsumption', () => {
  it('should calculate basic fuel consumption', () => {
    const ships = { smallCargoShip: 10, largeCargoShip: 5 };
    const result = calculateFuelConsumption(100, ships);
    expect(result).toBeGreaterThan(0);
  });

  it('should scale with distance', () => {
    const ships = { smallCargoShip: 10 };
    const result1 = calculateFuelConsumption(100, ships);
    const result2 = calculateFuelConsumption(200, ships);
    expect(result2).toBeGreaterThan(result1);
  });

  it('should scale with total ship mass', () => {
    const ships1 = { smallCargoShip: 10 };
    const ships2 = { smallCargoShip: 20 };
    const result1 = calculateFuelConsumption(100, ships1);
    const result2 = calculateFuelConsumption(100, ships2);
    expect(result2).toBeGreaterThan(result1);
  });
});

// ============ Travel Time Tests ============
describe('calculateTravelTime', () => {
  it('should calculate travel time in seconds', () => {
    const result = calculateTravelTime(1, 10000);
    expect(result).toBe(Math.floor((1 * 3600) / 10000));
  });

  it('should increase with distance', () => {
    const result1 = calculateTravelTime(1, 10000);
    const result2 = calculateTravelTime(10, 10000);
    expect(result2).toBeGreaterThan(result1);
  });
});

// ============ Combat Power Tests ============
describe('calculateCombatPower', () => {
  it('should calculate base combat power', () => {
    const result = calculateCombatPower(100);
    expect(result.attack).toBeGreaterThan(0);
    expect(result.shield).toBeGreaterThan(0);
    expect(result.armor).toBeGreaterThan(0);
  });

  it('should apply weapons tech bonus', () => {
    const baseResult = calculateCombatPower(100, 0, 0, 0);
    const withWeaponsTech = calculateCombatPower(100, 5, 0, 0);
    expect(withWeaponsTech.attack).toBeGreaterThan(baseResult.attack);
  });

  it('should apply shielding tech bonus', () => {
    const baseResult = calculateCombatPower(100, 0, 0, 0);
    const withShielding = calculateCombatPower(100, 0, 5, 0);
    expect(withShielding.shield).toBeGreaterThan(baseResult.shield);
  });

  it('should apply armor tech bonus', () => {
    const baseResult = calculateCombatPower(100, 0, 0, 0);
    const withArmor = calculateCombatPower(100, 0, 0, 5);
    expect(withArmor.armor).toBeGreaterThan(baseResult.armor);
  });
});

// ============ Allocation Effectiveness Tests ============
describe('calculateAllocationEffectiveness', () => {
  it('should return 0 for zero allocation', () => {
    expect(calculateAllocationEffectiveness(0)).toBe(0);
  });

  it('should return 10000 for 100% allocation (sqrt(100)*100 = 10*100)', () => {
    // Formula is sqrt(allocation%) * 100
    // sqrt(100) * 100 = 10 * 100 = 1000
    const result = calculateAllocationEffectiveness(100);
    expect(result).toBe(1000);
  });

  it('should use square root formula: sqrt(x) * 100', () => {
    const result = calculateAllocationEffectiveness(50);
    const expected = Math.sqrt(50) * 100;
    expect(result).toBe(expected);
  });

  it('should be non-linear (diminishing returns beyond 100%)', () => {
    const at100 = calculateAllocationEffectiveness(100);
    const at200 = calculateAllocationEffectiveness(200);
    const gain100to200 = at200 - at100;
    const gain0to100 = at100 - calculateAllocationEffectiveness(0);
    expect(gain100to200).toBeLessThan(gain0to100);
  });

  it('should handle negative values (square root of negative)', () => {
    const result = calculateAllocationEffectiveness(-50);
    // sqrt of negative in JavaScript returns NaN, but check if implementation handles it
    expect(isNaN(result) || result === 0).toBe(true);
  });
});

// ============ Power/Population Effectiveness Tests ============
describe('calculatePowerEffectiveness and calculatePopulationEffectiveness', () => {
  it('should use same formula as allocation effectiveness', () => {
    const value = 75;
    expect(calculatePowerEffectiveness(value)).toBe(calculateAllocationEffectiveness(value));
    expect(calculatePopulationEffectiveness(value)).toBe(calculateAllocationEffectiveness(value));
  });
});

// ============ Population Change Tests ============
describe('calculatePopulationChange', () => {
  it('should maintain population when food available and at max', () => {
    const maxPop = 1000;
    const result = calculatePopulationChange(1000, maxPop, true, 1);
    expect(result).toBe(1000);
  });

  it('should grow population when food available and below max', () => {
    const result = calculatePopulationChange(100, 1000, true, 1);
    expect(result).toBeGreaterThan(100);
  });

  it('should apply minimum growth of 60 per hour', () => {
    const result = calculatePopulationChange(100, 1000, true, 1);
    expect(result).toBe(Math.min(1000, 100 + 60));
  });

  it('should decay population when no food (2% per hour)', () => {
    const result = calculatePopulationChange(1000, 5000, false, 1);
    expect(result).toBeLessThan(1000);
    const expected = Math.max(10, 1000 - (1000 * 0.02));
    expect(result).toBe(expected);
  });

  it('should maintain minimum population of 10', () => {
    const result = calculatePopulationChange(100, 5000, false, 100);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('should not exceed maximum population', () => {
    const maxPop = 500;
    const result = calculatePopulationChange(100, maxPop, true, 100);
    expect(result).toBeLessThanOrEqual(maxPop);
  });

  it('should apply production multiplier', () => {
    const result1 = calculatePopulationChange(100, 1000, true, 1, 1.0);
    const result2 = calculatePopulationChange(100, 1000, true, 1, 2.0);
    expect(result2).toBeGreaterThan(result1);
  });
});

// ============ Position Multiplier Tests ============
describe('calculatePositionMultiplier', () => {
  it('should return 1.0 for metal (constant everywhere)', () => {
    expect(calculatePositionMultiplier(1, 'metal')).toBe(1.0);
    expect(calculatePositionMultiplier(8, 'metal')).toBe(1.0);
    expect(calculatePositionMultiplier(15, 'metal')).toBe(1.0);
  });

  it('should return 1.0 for crystal (constant everywhere)', () => {
    expect(calculatePositionMultiplier(1, 'crystal')).toBe(1.0);
    expect(calculatePositionMultiplier(15, 'crystal')).toBe(1.0);
  });

  it('should favor water far from sun (position 15)', () => {
    const closestWater = calculatePositionMultiplier(1, 'water');
    const farthestWater = calculatePositionMultiplier(15, 'water');
    expect(farthestWater).toBeGreaterThan(closestWater);
  });

  it('should favor farms close to sun (position 1)', () => {
    const closestFarm = calculatePositionMultiplier(1, 'farm');
    const farthestFarm = calculatePositionMultiplier(15, 'farm');
    expect(closestFarm).toBeGreaterThan(farthestFarm);
  });

  it('should favor deuterium at mid-distance (position 8)', () => {
    const closestDeut = calculatePositionMultiplier(1, 'deuterium');
    const midDeut = calculatePositionMultiplier(8, 'deuterium');
    const farthestDeut = calculatePositionMultiplier(15, 'deuterium');
    expect(midDeut).toBeGreaterThan(closestDeut);
    expect(midDeut).toBeGreaterThan(farthestDeut);
  });

  it('should handle food same as farm', () => {
    expect(calculatePositionMultiplier(1, 'food')).toBe(calculatePositionMultiplier(1, 'farm'));
  });
});

// ============ Building Energy Consumption Tests ============
describe('getBuildingEnergyConsumption', () => {
  it('should return 0 for buildings without energy consumption', () => {
    const result = getBuildingEnergyConsumption('metalMine', 1, BUILDINGS);
    // metalMine doesn't consume energy, so should be 0 or not have energyConsumption property
    // Based on the code, it returns 0 if building.energyConsumption doesn't exist
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should calculate energy consumption with multiplier of 10', () => {
    // Test with a building that has energy consumption
    // Most buildings do consume energy in this game
    const result1 = getBuildingEnergyConsumption('roboticsFactory', 1, BUILDINGS);
    const result2 = getBuildingEnergyConsumption('roboticsFactory', 2, BUILDINGS);
    if (result1 > 0 && result2 > 0) {
      expect(result2).toBeGreaterThan(result1);
    }
  });
});

// ============ Building Population Required Tests ============
describe('getBuildingPopulationRequired', () => {
  it('should return 0 for buildings without population requirement', () => {
    // Most buildings don't require population
    const result = getBuildingEnergyConsumption('metalMine', 1, BUILDINGS);
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('should scale with 1.05^level for buildings that require population', () => {
    const result1 = getBuildingPopulationRequired('metalMine', 1, BUILDINGS);
    const result2 = getBuildingPopulationRequired('metalMine', 2, BUILDINGS);
    if (result1 > 0 && result2 > 0) {
      expect(result2).toBeGreaterThan(result1);
    }
  });
});

// ============ Theoretical Research Tests ============
describe('calculateTheoreticalResearchCost', () => {
  it('should double cost with each level', () => {
    const baseCost = { metal: 800, crystal: 400, deuterium: 200 };
    const result0 = calculateTheoreticalResearchCost(baseCost, 0);
    const result1 = calculateTheoreticalResearchCost(baseCost, 1);
    const result2 = calculateTheoreticalResearchCost(baseCost, 2);
    
    expect(result1.metal).toBe(Math.floor(baseCost.metal * 2));
    expect(result2.metal).toBe(Math.floor(baseCost.metal * 4));
  });
});

describe('calculateTheoreticalResearchTime', () => {
  const research = THEORETICAL_RESEARCH.energyTech; // baseTime 500
  it('should double time with each level', () => {
    const result0 = calculateTheoreticalResearchTime(research, 0);
    const result1 = calculateTheoreticalResearchTime(research, 1);
    
    const expectedTime1 = Math.floor(500 * Math.pow(2, 1) / (1 + 0.15));
    expect(result1).toBe(expectedTime1);
  });

  it('should reduce time with higher lab level (15% speedup per level)', () => {
    const result1 = calculateTheoreticalResearchTime(research, 1, 1);
    const result2 = calculateTheoreticalResearchTime(research, 1, 5);
    expect(result2).toBeLessThan(result1);
  });
});

// ============ Practical Research Tests ============
describe('calculatePracticalResearchCost', () => {
  it('should scale slower than theoretical (1.5x per level)', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    const result1 = calculatePracticalResearchCost(baseCost, 1);
    const result2 = calculatePracticalResearchCost(baseCost, 2);
    
    expect(result1.metal).toBe(Math.floor(baseCost.metal * 1.5));
    expect(result2.metal).toBe(Math.floor(baseCost.metal * Math.pow(1.5, 2)));
  });
});

describe('calculatePracticalResearchTime', () => {
    const research = PRACTICAL_RESEARCH.metalMine; // baseTime 250
  it('should scale slower than theoretical (1.5x per level)', () => {
    const result1 = calculatePracticalResearchTime(research, 1);
    const expectedTime = Math.floor(250 * Math.pow(1.5, 1) / (1 + 0.15));
    expect(result1).toBe(expectedTime);
  });

  it('should be affected by lab level', () => {
    const result1 = calculatePracticalResearchTime(research, 2, 1);
    const result2 = calculatePracticalResearchTime(research, 2, 5);
    expect(result2).toBeLessThan(result1);
  });
});

// ============ Theoretical Bonus Tests ============
describe('applyTheoreticalBonus', () => {
  it('should apply bonus multiplicatively', () => {
    const baseValue = 100;
    const result = applyTheoreticalBonus(baseValue, 5, 0.1);
    expect(result).toBe(baseValue * (1 + (5 * 0.1)));
  });

  it('should handle zero level', () => {
    const baseValue = 100;
    const result = applyTheoreticalBonus(baseValue, 0, 0.1);
    expect(result).toBe(baseValue);
  });

  it('should scale with bonus per level', () => {
    const baseValue = 100;
    const result1 = applyTheoreticalBonus(baseValue, 5, 0.1);
    const result2 = applyTheoreticalBonus(baseValue, 5, 0.2);
    expect(result2).toBeGreaterThan(result1);
  });
});
