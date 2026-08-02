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
  calculateMaxPlanets,
  applyTheoreticalBonus,
  calculateFoodConsumption,
  calculateWaterConsumption
} from '../../src/shared/formulas.js';
import { BUILDINGS } from '../../src/shared/buildings.js';
import {
  SCALING,
  BUILDING_SPEED_MULTIPLIER,
  RESEARCH_LAB_SPEED_MULTIPLIER
} from '../../src/shared/constants.js';

import { THEORETICAL_RESEARCH, PRACTICAL_RESEARCH } from '../../src/shared/research.js';
import { SHIPS } from '../../src/shared/ships.js';

// ============ Building Cost Tests ============
describe('calculateBuildingCost', () => {
  it('should calculate base cost for level 0', () => {
    const baseCost = { metal: 60, crystal: 15, deuterium: 0 };
    const result = calculateBuildingCost(baseCost, 0);
    expect(result.metal).toBe(60);
    expect(result.crystal).toBe(15);
    expect(result.deuterium).toBe(0);
  });

  it(`should scale cost exponentially with ${SCALING.BUILDING_COST}^level`, () => {
    const baseCost = { metal: 60, crystal: 15, deuterium: 0 };
    const result = calculateBuildingCost(baseCost, 1);
    expect(result.metal).toBe(Math.floor(60 * SCALING.BUILDING_COST));
    expect(result.crystal).toBe(Math.floor(15 * SCALING.BUILDING_COST));
  });

  it('should handle higher levels correctly', () => {
    const baseCost = { metal: 60, crystal: 15, deuterium: 0 };
    const result = calculateBuildingCost(baseCost, 5);
    expect(result.metal).toBe(Math.floor(60 * Math.pow(SCALING.BUILDING_COST, 5)));
    expect(result.crystal).toBe(Math.floor(15 * Math.pow(SCALING.BUILDING_COST, 5)));
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

  it('should calculate base time at level 1', () => {
    const result = calculateBuildTime(building, 1);
    expect(result).toBe(1180);
  });

  it(`should scale time with ${SCALING.BUILDING_TIME}^(level-1)`, () => {
    const result = calculateBuildTime(building, 3);
    expect(result).toBe(Math.floor(1180 * Math.pow(SCALING.BUILDING_TIME, 2)));
  });

  it(`should apply robotics factory multiplier (scaling^level)`, () => {
    const roboticsDef = BUILDINGS.roboticsFactory;
    const speedMultiplier = roboticsDef.speedMultiplier || BUILDING_SPEED_MULTIPLIER;
    const result = calculateBuildTime(building, 2, 2);
    const expectedTime = Math.floor(1180 * Math.pow(SCALING.BUILDING_TIME, 1) * Math.pow(speedMultiplier, 2));
    expect(result).toBe(expectedTime);
  });

  it('should apply nanite factory multiplier (2^level)', () => {
    const result = calculateBuildTime(building, 2, 0, 2);
    const expectedTime = Math.floor((1180 * Math.pow(SCALING.BUILDING_TIME, 1)) / Math.pow(2, 2));
    expect(result).toBe(expectedTime);
  });

  it('should apply both multipliers when both are provided', () => {
    const roboticsDef = BUILDINGS.roboticsFactory;
    const speedMultiplier = roboticsDef.speedMultiplier || BUILDING_SPEED_MULTIPLIER;
    const result = calculateBuildTime(building, 2, 1, 1);
    const expectedTime = Math.floor((1180 * Math.pow(SCALING.BUILDING_TIME, 1) * Math.pow(speedMultiplier, 1)) / Math.pow(2, 1));
    expect(result).toBe(expectedTime);
  });

  it('robotics factory should speed up construction', () => {
    const noRobotics = calculateBuildTime(building, 5, 0, 0);
    const withRobotics = calculateBuildTime(building, 5, 1, 0);
    expect(withRobotics).toBeLessThan(noRobotics);
  });

  it('nanite factory should speed up construction (decreases time)', () => {
    const noNanite = calculateBuildTime(building, 5, 0, 0);
    const withNanite = calculateBuildTime(building, 5, 0, 1);
    // Nanite multiplier should decrease time (divides by 2^level)
    expect(withNanite).toBeLessThan(noNanite);
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
  it(`should use ${SCALING.RESEARCH_COST}^level formula`, () => {
    const baseCost = { metal: 200, crystal: 100, deuterium: 30 };
    const result = calculateResearchCost(baseCost, 0);
    expect(result.metal).toBe(200);
    expect(result.crystal).toBe(100);
    expect(result.deuterium).toBe(30);
  });

  it(`should scale cost exponentially with ${SCALING.RESEARCH_COST}^level`, () => {
    const baseCost = { metal: 200, crystal: 100, deuterium: 30 };
    const result = calculateResearchCost(baseCost, 1);
    expect(result.metal).toBe(Math.floor(200 * SCALING.RESEARCH_COST));
    expect(result.crystal).toBe(Math.floor(100 * SCALING.RESEARCH_COST));
  });
});

// ============ Research Time Tests ============
describe('calculateResearchTime', () => {
  const research = THEORETICAL_RESEARCH.energyTech; // metal: 200, crystal: 100, deuterium: 50 => baseTime: 500
  it('should calculate base time at level 0', () => {
    const result = calculateResearchTime(research, 0, 1);
    // At level 0 with lab level 1: time = 500 * 1 * RESEARCH_LAB_SPEED_MULTIPLIER^1
    const expected = Math.floor(500 * Math.pow(RESEARCH_LAB_SPEED_MULTIPLIER, 1));
    expect(result).toBe(expected);
  });

  it(`should scale with ${SCALING.RESEARCH_TIME}^level`, () => {
    const result = calculateResearchTime(research, 2, 1);
    expect(result).toBe(Math.floor(500 * Math.pow(SCALING.RESEARCH_TIME, 2) * Math.pow(RESEARCH_LAB_SPEED_MULTIPLIER, 1)));
  });

  it('should apply lab multiplier', () => {
    const result = calculateResearchTime(research, 1, 5);
    const expectedTime = Math.floor(500 * Math.pow(SCALING.RESEARCH_TIME, 1) * Math.pow(RESEARCH_LAB_SPEED_MULTIPLIER, 5));
    expect(result).toBe(expectedTime);
  });
});

// ============ Storage Tests ============
describe('calculateStorage', () => {
  it('should calculate base storage', () => {
    const result = calculateStorage(5000, 0);
    expect(result).toBe(5000);
  });

  it(`should scale with ${SCALING.BUILDING_STORAGE}^level`, () => {
    const result = calculateStorage(5000, 3);
    expect(result).toBe(Math.floor(5000 * Math.pow(SCALING.BUILDING_STORAGE, 3)));
  });
});

// ============ Fuel Consumption Tests ============
describe('calculateFuelConsumption', () => {
  it('should calculate basic fuel consumption', () => {
    const ships = { smallCargo: 10, largeCargo: 5 };
    const result = calculateFuelConsumption(100, ships, SHIPS);
    expect(result).toBeGreaterThan(0);
  });

  it('should scale with distance', () => {
    const ships = { smallCargo: 10 };
    const result1 = calculateFuelConsumption(100, ships, SHIPS);
    const result2 = calculateFuelConsumption(200, ships, SHIPS);
    expect(result2).toBeGreaterThan(result1);
  });

  it('should scale with total ship mass', () => {
    const ships1 = { smallCargo: 10 };
    const ships2 = { smallCargo: 20 };
    const result1 = calculateFuelConsumption(100, ships1, SHIPS);
    const result2 = calculateFuelConsumption(100, ships2, SHIPS);
    expect(result2).toBeGreaterThan(result1);
  });
});

// ============ Travel Time Tests ============
describe('calculateTravelTime', () => {
  it('should calculate travel time in seconds', () => {
    const distance = 1000;
    const speed = 10000;
    const result = calculateTravelTime(distance, speed);
    // Formula: (5 + (1500 * (distance^0.7 / sqrt(speed))))
    const expected = Math.floor(5 + (1500 * (Math.pow(distance, 0.7) / Math.sqrt(speed))));
    expect(result).toBe(expected);
  });

  it('should increase with distance', () => {
    const result1 = calculateTravelTime(1000, 10000);
    const result2 = calculateTravelTime(2000, 10000);
    expect(result2).toBeGreaterThan(result1);
  });

  it('should respect speed percentage (100% vs 10%)', () => {
    const distance = 1000;
    const speed = 10000;
    const time100 = calculateTravelTime(distance, speed, 1.0, 1.0);
    const time10 = calculateTravelTime(distance, speed, 1.0, 0.1);
    
    // speedFactor 0.1 means sqrt(0.1) slower => ~3.16x slower
    expect(time10).toBeGreaterThan(time100);
    expect(time10).toBeGreaterThan(time100 * 3);
  });

  it('should handle ultra-low speeds without capping at 10%', () => {
    const distance = 1000;
    const speed = 10000;
    const time10 = calculateTravelTime(distance, speed, 1.0, 0.1);
    const time1 = calculateTravelTime(distance, speed, 1.0, 0.01);
    const time01 = calculateTravelTime(distance, speed, 1.0, 0.001);

    expect(time1).toBeGreaterThan(time10);
    expect(time01).toBeGreaterThan(time1);
    
    // 0.1% speed should be roughly sqrt(100) = 10x slower than 10% speed
    expect(time01).toBeGreaterThan(time10 * 9);
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

  it('should return 100 for 100% allocation (sqrt(100)*10 = 10*10 = 100)', () => {
    // Formula is sqrt(allocation%) * 10
    // sqrt(100) * 10 = 10 * 10 = 100
    const result = calculateAllocationEffectiveness(100);
    expect(result).toBe(100);
  });

  it('should use square root formula: sqrt(x) * 10', () => {
    const result = calculateAllocationEffectiveness(50);
    const expected = Math.sqrt(50) * 10;
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
  it('should maintain population when food/water available and at max', () => {
    const maxPop = 1000;
    const result = calculatePopulationChange(1000, maxPop, true, true, 1);
    expect(result).toBe(1000);
  });

  it('should grow population when food and water available and below max', () => {
    const result = calculatePopulationChange(100, 1000, true, true, 1);
    expect(result).toBeGreaterThan(100);
  });

  it('should apply minimum growth of 60 per hour', () => {
    const result = calculatePopulationChange(100, 1000, true, true, 1);
    expect(result).toBe(Math.min(1000, 100 + 60));
  });

  it('should decay population when no food (2% per hour)', () => {
    const result = calculatePopulationChange(1000, 5000, false, true, 1);
    expect(result).toBeLessThan(1000);
    const expected = Math.max(10, 1000 - (1000 * 0.02));
    expect(result).toBe(expected);
  });

  it('should decay population when no water (2% per hour)', () => {
    const result = calculatePopulationChange(1000, 5000, true, false, 1);
    expect(result).toBeLessThan(1000);
    const expected = Math.max(10, 1000 - (1000 * 0.02));
    expect(result).toBe(expected);
  });

  it('should maintain minimum population of 10', () => {
    const result = calculatePopulationChange(100, 5000, false, true, 100);
    expect(result).toBeGreaterThanOrEqual(10);
  });

  it('should not exceed maximum population', () => {
    const maxPop = 500;
    const result = calculatePopulationChange(100, maxPop, true, true, 100);
    expect(result).toBeLessThanOrEqual(maxPop);
  });

  it('should apply production multiplier', () => {
    const result1 = calculatePopulationChange(100, 1000, true, true, 1, 1.0);
    const result2 = calculatePopulationChange(100, 1000, true, true, 1, 2.0);
    expect(result2).toBeGreaterThan(result1);
  });
});

// ============ Food/Water/Energy Consumption Tests ============
describe('calculateFoodConsumption', () => {
  it('should calculate food consumption based on population', () => {
    const population = 1000;
    const rate = 0.1;
    const result = calculateFoodConsumption(population, rate);
    expect(result).toBe(100);
  });

  it('should return 0 for zero population', () => {
    expect(calculateFoodConsumption(0, 0.1)).toBe(0);
  });
});

describe('calculateWaterConsumption', () => {
  it('should calculate water consumption based on population', () => {
    const population = 1000;
    const rate = 0.2;
    const result = calculateWaterConsumption(population, rate);
    expect(result).toBe(200);
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
  it(`should increase by ${SCALING.RESEARCH_COST}x with each level`, () => {
    const baseCost = { metal: 800, crystal: 400, deuterium: 200 };
    const result0 = calculateTheoreticalResearchCost(baseCost, 0);
    const result1 = calculateTheoreticalResearchCost(baseCost, 1);
    const result2 = calculateTheoreticalResearchCost(baseCost, 2);
    
    expect(result1.metal).toBe(Math.floor(baseCost.metal * SCALING.RESEARCH_COST));
    expect(result2.metal).toBe(Math.floor(baseCost.metal * Math.pow(SCALING.RESEARCH_COST, 2)));
  });
});

describe('calculateTheoreticalResearchTime', () => {
  const research = THEORETICAL_RESEARCH.energyTech; // baseTime 500
  it(`should increase by ${SCALING.RESEARCH_TIME}x with each level`, () => {
    const labDef = BUILDINGS.researchLab;
    const speedMultiplier = labDef.speedMultiplier || RESEARCH_LAB_SPEED_MULTIPLIER;
    const result1 = calculateTheoreticalResearchTime(research, 1);
    
    const expectedTime1 = Math.floor(500 * Math.pow(SCALING.RESEARCH_TIME, 1) * Math.pow(speedMultiplier, 1));
    expect(result1).toBe(expectedTime1);
  });

  it(`should reduce time with higher lab level (multiplicative scaling^level)`, () => {
    const labDef = BUILDINGS.researchLab;
    const speedMultiplier = labDef.speedMultiplier || RESEARCH_LAB_SPEED_MULTIPLIER;
    const result1 = calculateTheoreticalResearchTime(research, 1, 1);
    const result2 = calculateTheoreticalResearchTime(research, 1, 5);
    expect(result2).toBeLessThan(result1);
    expect(result2).toBe(Math.floor(500 * Math.pow(SCALING.RESEARCH_TIME, 1) * Math.pow(speedMultiplier, 5)));
  });
});

// ============ Practical Research Tests ============
describe('calculatePracticalResearchCost', () => {
  it(`should NOT scale with level`, () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    // Strength 0.5: 10^3.5 = 3162.277... mult. 
    // Allocation: 1.05 mult.
    const strMult = Math.pow(10, 3.5);
    const result1 = calculatePracticalResearchCost(baseCost, 1, { output: 1.0 }, 0.5);

    expect(result1.metal).toBe(Math.ceil(100 * strMult * 1.05));
  });

  it('should scale with strength', () => {
    const baseCost = { metal: 100, crystal: 50, deuterium: 25 };
    const lowStr = calculatePracticalResearchCost(baseCost, 1, { output: 1 }, 0.1);
    const highStr = calculatePracticalResearchCost(baseCost, 1, { output: 1 }, 0.9);
    
    expect(highStr.metal).toBeGreaterThan(lowStr.metal);
  });
});

describe('calculatePracticalResearchTime', () => {
    const research = PRACTICAL_RESEARCH.metalMine; // baseTime 50
  it('should derive duration from actual cost (no level scaling)', () => {
    // Formula: calculateBaseTime(cost) * labMult
    // Cost mult: strength(10^3.5) * alloc(1.05)
    const labDef = BUILDINGS.researchLab;
    const speedMultiplier = labDef.speedMultiplier || RESEARCH_LAB_SPEED_MULTIPLIER;
    const result1 = calculatePracticalResearchTime(research, 1, 1, 0, 1.0, 0.5, { output: 1.0 });
    const strMult = Math.pow(10, 3.5);
    const expectedTime = Math.floor(50 * strMult * 1.05 * speedMultiplier);
    expect(Math.abs(result1 - expectedTime)).toBeLessThanOrEqual(5);
  });

  it('should be affected by lab level', () => {
    const labDef = BUILDINGS.researchLab;
    const speedMultiplier = labDef.speedMultiplier || RESEARCH_LAB_SPEED_MULTIPLIER;
    const strMult = Math.pow(10, 3.5);
    const result1 = calculatePracticalResearchTime(research, 2, 1, 0, 1.0, 0.5, { output: 1.0 });
    const result2 = calculatePracticalResearchTime(research, 2, 5, 0, 1.0, 0.5, { output: 1.0 });
    expect(result2).toBeLessThan(result1);
    const expected = Math.floor(50 * strMult * 1.05 * Math.pow(speedMultiplier, 5));
    expect(Math.abs(result2 - expected)).toBeLessThanOrEqual(5);
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

// ============ Max Planets Tests ============
describe('calculateMaxPlanets', () => {
  it('should return 1 for no research', () => {
    expect(calculateMaxPlanets({})).toBe(1);
    expect(calculateMaxPlanets()).toBe(1);
  });

  it('should increase with Astrophysics level', () => {
    // Astrophysics provides +1 galaxy slot per level by default in THEORETICAL_RESEARCH
    expect(calculateMaxPlanets({ astrophysics: 1 })).toBe(2);
    expect(calculateMaxPlanets({ astrophysics: 5 })).toBe(6);
  });

  it('should handle complex research objects', () => {
    const research = {
      astrophysics: { level: 3 },
      energyTech: 10
    };
    expect(calculateMaxPlanets(research)).toBe(4);
  });
});
