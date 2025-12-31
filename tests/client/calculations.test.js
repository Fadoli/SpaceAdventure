import { describe, it, expect } from 'bun:test';
import {
  calculateAllocationEffectiveness,
  calculatePositionMultiplier,
  getBuildingEnergyConsumption,
  getBuildingPopulationRequired
} from '../../src/shared/formulas.js';
import { BUILDINGS } from '../../src/shared/buildings.js';

describe('Client-Side Calculations - Allocation Effectiveness', () => {
  it('should provide non-linear effectiveness feedback', () => {
    const allocations = [25, 50, 75, 100, 150, 200];
    const effectivenesses = allocations.map(a => calculateAllocationEffectiveness(a));
    
    // Verify values are increasing
    for (let i = 1; i < effectivenesses.length; i++) {
      expect(effectivenesses[i]).toBeGreaterThan(effectivenesses[i - 1]);
    }
  });

  it('should demonstrate diminishing returns above 100%', () => {
    const eff100 = calculateAllocationEffectiveness(100);
    const eff200 = calculateAllocationEffectiveness(200);
    const eff300 = calculateAllocationEffectiveness(300);
    
    const gain100_200 = eff200 - eff100;
    const gain200_300 = eff300 - eff200;
    
    // Each 100% increment should give diminishing gains
    expect(gain100_200).toBeLessThan(eff100);
    expect(gain200_300).toBeLessThan(gain100_200);
  });

  it('should match expected square root values', () => {
    const testValues = [
      { input: 50, expected: Math.sqrt(50) * 10 },
      { input: 100, expected: 100 }, // sqrt(100) * 10 = 10 * 10 = 100
      { input: 200, expected: Math.sqrt(200) * 10 },
      { input: 400, expected: 200 } // sqrt(400) * 10 = 20 * 10 = 200
    ];
    
    testValues.forEach(test => {
      const result = calculateAllocationEffectiveness(test.input);
      expect(result).toBe(test.expected);
    });
  });

  it('should handle allocation sliders (0-200%)', () => {
    const sliderPositions = [0, 20, 40, 60, 80, 100, 120, 140, 160, 180, 200];
    const results = sliderPositions.map(pos => calculateAllocationEffectiveness(pos));
    
    // All should be non-negative
    results.forEach(result => {
      expect(result).toBeGreaterThanOrEqual(0);
    });
    
    // Should be monotonically increasing
    for (let i = 1; i < results.length; i++) {
      expect(results[i]).toBeGreaterThanOrEqual(results[i - 1]);
    }
  });
});

describe('Client-Side Calculations - Position Multipliers', () => {
  it('should provide planet position-based bonuses', () => {
    // Test all positions 1-15
    const positions = Array.from({ length: 15 }, (_, i) => i + 1);
    
    positions.forEach(pos => {
      const water = calculatePositionMultiplier(pos, 'water');
      const farm = calculatePositionMultiplier(pos, 'farm');
      const deut = calculatePositionMultiplier(pos, 'deuterium');
      const metal = calculatePositionMultiplier(pos, 'metal');
      
      expect(water).toBeGreaterThan(0);
      expect(farm).toBeGreaterThan(0);
      expect(deut).toBeGreaterThan(0);
      expect(metal).toBe(1.0);
    });
  });

  it('should show trade-offs between different resources', () => {
    // Position 1 (closest to sun)
    const pos1Water = calculatePositionMultiplier(1, 'water');
    const pos1Farm = calculatePositionMultiplier(1, 'farm');
    
    // Position 15 (farthest from sun)
    const pos15Water = calculatePositionMultiplier(15, 'water');
    const pos15Farm = calculatePositionMultiplier(15, 'farm');
    
    // Close to sun: better for farms
    expect(pos1Farm).toBeGreaterThan(pos1Water);
    
    // Far from sun: better for water
    expect(pos15Water).toBeGreaterThan(pos15Farm);
  });

  it('should have deuterium peak at mid-distance', () => {
    const deutValues = [];
    for (let pos = 1; pos <= 15; pos++) {
      deutValues.push({
        position: pos,
        multiplier: calculatePositionMultiplier(pos, 'deuterium')
      });
    }
    
    // Find maximum
    const maxPos = deutValues.reduce((max, curr) => 
      curr.multiplier > max.multiplier ? curr : max
    );
    
    // Should be around position 8
    expect(maxPos.position).toBeLessThanOrEqual(9);
    expect(maxPos.position).toBeGreaterThanOrEqual(7);
  });

  it('should show consistent metal/crystal across all positions', () => {
    for (let pos = 1; pos <= 15; pos++) {
      expect(calculatePositionMultiplier(pos, 'metal')).toBe(1.0);
      expect(calculatePositionMultiplier(pos, 'crystal')).toBe(1.0);
    }
  });
});

describe('Client-Side Calculations - Building Requirements', () => {
  it('should calculate energy consumption for buildings', () => {
    // Test some common buildings
    const buildings = ['metalMine', 'crystalMine', 'roboticsFactory', 'researchLab'];
    
    buildings.forEach(building => {
      const consumption1 = getBuildingEnergyConsumption(building, 1, BUILDINGS);
      const consumption5 = getBuildingEnergyConsumption(building, 5, BUILDINGS);
      
      // Higher level = higher consumption
      if (consumption1 > 0) {
        expect(consumption5).toBeGreaterThanOrEqual(consumption1);
      }
    });
  });

  it('should show exponential energy scaling', () => {
    const consumption1 = getBuildingEnergyConsumption('metalMine', 1, BUILDINGS);
    const consumption2 = getBuildingEnergyConsumption('metalMine', 2, BUILDINGS);
    const consumption3 = getBuildingEnergyConsumption('metalMine', 3, BUILDINGS);
    
    if (consumption1 > 0 && consumption2 > 0 && consumption3 > 0) {
      // Verify exponential pattern
      const ratio1to2 = consumption2 / consumption1;
      const ratio2to3 = consumption3 / consumption2;
      
      // Both ratios should be similar (exponential scaling)
      expect(Math.abs(ratio1to2 - ratio2to3)).toBeLessThan(1);
    }
  });

  it('should calculate population requirements for buildings', () => {
    const buildings = ['metalMine', 'crystalMine', 'farm', 'researchLab'];
    
    buildings.forEach(building => {
      const pop1 = getBuildingPopulationRequired(building, 1, BUILDINGS);
      const pop5 = getBuildingPopulationRequired(building, 5, BUILDINGS);
      
      // Higher level = higher population needed
      if (pop1 > 0) {
        expect(pop5).toBeGreaterThanOrEqual(pop1);
      }
    });
  });

  it('should show consistency between energy and population scaling', () => {
    // Both should scale with level, but at different rates
    const energyConsumption = [];
    const populationRequired = [];
    
    for (let level = 1; level <= 5; level++) {
      energyConsumption.push(getBuildingEnergyConsumption('metalMine', level, BUILDINGS));
      populationRequired.push(getBuildingPopulationRequired('metalMine', level, BUILDINGS));
    }
    
    // Both should be monotonically increasing
    for (let i = 1; i < energyConsumption.length; i++) {
      expect(energyConsumption[i]).toBeGreaterThanOrEqual(energyConsumption[i - 1]);
      expect(populationRequired[i]).toBeGreaterThanOrEqual(populationRequired[i - 1]);
    }
  });
});

describe('UI Display Calculations - Effectiveness Display', () => {
  it('should provide clear feedback for user allocation changes', () => {
    // User increases allocation from 50% to 100%
    const eff50 = calculateAllocationEffectiveness(50);
    const eff100 = calculateAllocationEffectiveness(100);
    
    const percentGain = ((eff100 - eff50) / eff50) * 100;
    
    // Should be a noticeable improvement
    expect(percentGain).toBeGreaterThan(20);
  });

  it('should show diminishing returns for over-allocation', () => {
    const eff100 = calculateAllocationEffectiveness(100);
    const eff150 = calculateAllocationEffectiveness(150);
    const eff200 = calculateAllocationEffectiveness(200);
    
    const gain100to150 = eff150 - eff100;
    const gain150to200 = eff200 - eff150;
    
    // Second gain should be less than first
    expect(gain150to200).toBeLessThan(gain100to150);
  });

  it('should display consistent percentages for UI bars', () => {
    // For a resource bar showing utilization
    const percentages = [0, 25, 50, 75, 100, 125, 150];
    const validations = percentages.map(p => {
      const eff = calculateAllocationEffectiveness(p);
      // Check it's a valid percentage for display
      return eff >= 0 && Number.isFinite(eff);
    });
    
    validations.forEach(valid => {
      expect(valid).toBe(true);
    });
  });
});

describe('Resource Planning Calculations', () => {
  it('should help players understand position-based strategy', () => {
    // A player comparing two planets
    const planet1Position = 3;  // Close to sun
    const planet2Position = 12; // Far from sun
    
    const farm1 = calculatePositionMultiplier(planet1Position, 'farm');
    const farm2 = calculatePositionMultiplier(planet2Position, 'farm');
    const water1 = calculatePositionMultiplier(planet1Position, 'water');
    const water2 = calculatePositionMultiplier(planet2Position, 'water');
    
    // Planet 1 better for farms
    expect(farm1).toBeGreaterThan(farm2);
    // Planet 2 better for water
    expect(water2).toBeGreaterThan(water1);
  });

  it('should inform allocation slider optimization', () => {
    // Test common allocation percentages
    const allocations = {
      minimal: 25,
      half: 50,
      full: 100,
      extra: 150,
      double: 200
    };
    
    const results = {};
    for (const [name, value] of Object.entries(allocations)) {
      results[name] = calculateAllocationEffectiveness(value);
    }
    
    // Verify relationships
    expect(results.half).toBeGreaterThan(results.minimal);
    expect(results.full).toBeGreaterThan(results.half);
    expect(results.extra).toBeGreaterThan(results.full);
    expect(results.double).toBeGreaterThan(results.extra);
  });
});

describe('Comparative Analysis', () => {
  it('should allow building comparison', () => {
    const level = 5;
    
    const metalMineEnergy = getBuildingEnergyConsumption('metalMine', level, BUILDINGS);
    const roboticsEnergy = getBuildingEnergyConsumption('roboticsFactory', level, BUILDINGS);
    
    // Both values should be computable and comparable
    expect(metalMineEnergy).toBeGreaterThanOrEqual(0);
    expect(roboticsEnergy).toBeGreaterThanOrEqual(0);
  });

  it('should support resource allocation optimization', () => {
    // Client can use effectiveness calculations to optimize
    const allocationPercentages = [0, 20, 40, 60, 80, 100];
    const effectivenesses = allocationPercentages.map(p => 
      calculateAllocationEffectiveness(p)
    );
    
    // Should be able to identify optimal points
    const optimal = effectivenesses.indexOf(Math.max(...effectivenesses));
    expect(optimal).toBe(effectivenesses.length - 1); // 100% is optimal in this test
  });
});
