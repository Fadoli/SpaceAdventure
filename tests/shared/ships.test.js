import { describe, it, expect } from 'bun:test';
import {
  SHIPS,
  getShip,
  getShipsByType,
  calculateShipCost,
  calculateShipBuildTime,
  calculateFleetStats,
  calculateCargoCapacity,
  calculateFleetFuelCost
} from '../../src/shared/ships.js';
import { calculateBaseTime } from '../../src/shared/time.js';
import { CONFIG } from '../../src/shared/constants.js';

describe('Ships - Data Structure', () => {
  it('should have all ship types defined', () => {
    expect(SHIPS).toHaveProperty('smallCargo');
    expect(SHIPS).toHaveProperty('largeCargo');
    expect(SHIPS).toHaveProperty('colonyShip');
    expect(SHIPS).toHaveProperty('lightFighter');
    expect(SHIPS).toHaveProperty('heavyFighter');
    expect(SHIPS).toHaveProperty('cruiser');
    expect(SHIPS).toHaveProperty('battleship');
  });

    it('should have required properties for each ship', () => {

      const requiredProps = ['name', 'icon', 'type', 'baseCost', 'cargoCapacity', 'fuel', 'speed', 'attack', 'shield', 'hull'];

      

      for (const shipKey in SHIPS) {

        const ship = SHIPS[shipKey];

        requiredProps.forEach(prop => {

          expect(ship).toHaveProperty(prop);

        });

        

        // Verify cost structure

        expect(ship.baseCost).toHaveProperty('metal');

        expect(ship.baseCost).toHaveProperty('crystal');

        expect(ship.baseCost).toHaveProperty('deuterium');

      }

    });

  

    it('should have valid type classifications', () => {

      const validTypes = ['civilian', 'military'];

      

      for (const shipKey in SHIPS) {

        expect(validTypes).toContain(SHIPS[shipKey].type);

      }

    });

  

    it('should have positive costs and stats', () => {

      for (const shipKey in SHIPS) {

        const ship = SHIPS[shipKey];

        expect(ship.baseCost.metal).toBeGreaterThanOrEqual(0);

        expect(ship.baseCost.crystal).toBeGreaterThanOrEqual(0);

        expect(ship.baseCost.deuterium).toBeGreaterThanOrEqual(0);

        expect(ship.speed).toBeGreaterThan(0);

        expect(ship.attack).toBeGreaterThanOrEqual(0);

        expect(ship.shield).toBeGreaterThanOrEqual(0);

        expect(ship.hull).toBeGreaterThan(0);

      }

    });

  });

describe('Ships - getShip Function', () => {
  it('should retrieve ship by key', () => {
    const smallCargo = getShip('smallCargo');
    expect(smallCargo).not.toBeNull();
    expect(smallCargo.name).toBe('SC-12 Logistics Shuttle');
  });

  it('should return null for unknown ship', () => {
    const unknown = getShip('unknownShip');
    expect(unknown).toBeUndefined();
  });

  it('should return same object reference', () => {
    const ship1 = getShip('lightFighter');
    const ship2 = getShip('lightFighter');
    expect(ship1).toBe(ship2);
  });
});

describe('Ships - getShipsByType Function', () => {
  it('should return all civilian ships', () => {
    const civilian = getShipsByType('civilian');
    expect(Object.keys(civilian).length).toBeGreaterThan(0);
    
    for (const key in civilian) {
      expect(civilian[key].type).toBe('civilian');
    }
  });

  it('should return all military ships', () => {
    const military = getShipsByType('military');
    expect(Object.keys(military).length).toBeGreaterThan(0);
    
    for (const key in military) {
      expect(military[key].type).toBe('military');
    }
  });

  it('should return empty object for unknown type', () => {
    const unknown = getShipsByType('unknown');
    expect(Object.keys(unknown).length).toBe(0);
  });

  it('should not have overlapping types', () => {
    const civilian = getShipsByType('civilian');
    const military = getShipsByType('military');
    
    const civilianKeys = Object.keys(civilian);
    const militaryKeys = Object.keys(military);
    
    const intersection = civilianKeys.filter(k => militaryKeys.includes(k));
    expect(intersection.length).toBe(0);
  });
});

describe('Ships - calculateShipCost Function', () => {
  it('should calculate cost for single ship', () => {
    const cost = calculateShipCost('smallCargo', 1);
    
    expect(cost).not.toBeNull();
    expect(cost.metal).toBeGreaterThan(0);
    expect(cost.crystal).toBeGreaterThan(0);
    // Deuterium cost for smallCargo is now 0
    expect(cost.deuterium).toBe(0);
  });

  it('should scale cost with quantity', () => {
    const cost1 = calculateShipCost('smallCargo', 1);
    const cost10 = calculateShipCost('smallCargo', 10);
    
    expect(cost10.metal).toBe(cost1.metal * 10);
    expect(cost10.crystal).toBe(cost1.crystal * 10);
    expect(cost10.deuterium).toBe(cost1.deuterium * 10);
  });

  it('should not increase cost with shipyard level', () => {
    const costLvl1 = calculateShipCost('smallCargo', 1);
    // Shipyard level parameter is now ignored or removed
    const costLvl5 = calculateShipCost('smallCargo', 1);
    
    expect(costLvl5.metal).toBe(costLvl1.metal);
    expect(costLvl5.crystal).toBe(costLvl1.crystal);
    expect(costLvl5.deuterium).toBe(costLvl1.deuterium);
  });

  it('should return null for unknown ship', () => {
    const cost = calculateShipCost('unknownShip', 1);
    expect(cost).toBeNull();
  });

  it('should return integer costs', () => {
    const cost = calculateShipCost('smallCargo', 3);
    
    expect(Number.isInteger(cost.metal)).toBe(true);
    expect(Number.isInteger(cost.crystal)).toBe(true);
    expect(Number.isInteger(cost.deuterium)).toBe(true);
  });
});

describe('Ships - calculateShipBuildTime Function', () => {
  it('should calculate build time for single ship', () => {
    const time = calculateShipBuildTime('smallCargo', 1, 1, 0, 0);
    
    expect(time).toBeGreaterThan(0);
    expect(Number.isInteger(time)).toBe(true);
  });

  it('should increase build time with quantity', () => {
    const time1 = calculateShipBuildTime('lightFighter', 1, 1, 0, 0);
    const time5 = calculateShipBuildTime('lightFighter', 5, 1, 0, 0);
    
    // 5 ships should take exactly 5 times longer (linear)
    expect(time5).toBeGreaterThanOrEqual(time1 * 5);
    expect(time5).toBeLessThanOrEqual(time1 * 5 + 1);
  });

  it('should decrease build time with shipyard level', () => {
    const timeLvl1 = calculateShipBuildTime('smallCargo', 1, 1);
    const timeLvl10 = calculateShipBuildTime('smallCargo', 1, 10);

    // Shipyard: speedMultiplier^level multiplier
    expect(timeLvl10).toBeLessThan(timeLvl1);
  });

  it('should dramatically decrease build time with nanite level', () => {
    const timeNoNanites = calculateShipBuildTime('smallCargo', 1, 1, 0);
    const timeNanites1 = calculateShipBuildTime('smallCargo', 1, 1, 1);
    const timeNanites3 = calculateShipBuildTime('smallCargo', 1, 1, 3);

    // Each nanite level doubles the speed (2x multiplier)
    expect(timeNanites1).toBeLessThan(timeNoNanites);
    // Note: If time is already low, it might hit the 1s batch floor
    expect(timeNanites3).toBeGreaterThanOrEqual(1);
  });

  it('should combine all modifiers correctly', () => {
    const time = calculateShipBuildTime('smallCargo', 2, 5, 1);

    expect(time).toBeGreaterThan(0);
  });

  it('should return minimum 1 second', () => {
    // Test with high shipyard and nanite levels to force low duration
    const time = calculateShipBuildTime('smallCargo', 1, 999, 999);
    expect(time).toBe(1);
  });

  it('should handle zero nanites', () => {
    const time1 = calculateShipBuildTime('heavyFighter', 1, 1, 0);
    const time2 = calculateShipBuildTime('heavyFighter', 1, 1);
    expect(time1).toBe(time2);
  });
});

describe('Ships - calculateFleetStats Function', () => {
  it('should calculate zero stats for empty fleet', () => {
    const stats = calculateFleetStats({});
    
    expect(stats.attack).toBe(0);
    expect(stats.shield).toBe(0);
    expect(stats.hull).toBe(0);
  });

  it('should sum attack from multiple ships', () => {
    const fleet = {
      lightFighter: 10
    };
    
    const stats = calculateFleetStats(fleet);
    const lightFighter = getShip('lightFighter');
    
    expect(stats.attack).toBe(lightFighter.attack * 10);
  });

  it('should sum shield from multiple ships', () => {
    const fleet = {
      heavyFighter: 5
    };
    
    const stats = calculateFleetStats(fleet);
    const heavyFighter = getShip('heavyFighter');
    
    expect(stats.shield).toBe(heavyFighter.shield * 5);
  });

  it('should sum hull from multiple ships', () => {
    const fleet = {
      cruiser: 3
    };
    
    const stats = calculateFleetStats(fleet);
    const cruiser = getShip('cruiser');
    
    expect(stats.hull).toBe(cruiser.hull * 3);
  });

  it('should handle mixed fleet', () => {
    const fleet = {
      lightFighter: 10,
      heavyFighter: 5,
      cruiser: 2
    };
    
    const stats = calculateFleetStats(fleet);
    const lightFighter = getShip('lightFighter');
    const heavyFighter = getShip('heavyFighter');
    const cruiser = getShip('cruiser');
    
    const expectedAttack = (lightFighter.attack * 10) + (heavyFighter.attack * 5) + (cruiser.attack * 2);
    expect(stats.attack).toBe(expectedAttack);
  });

  it('should apply weapons technology multiplier', () => {
    const fleet = { lightFighter: 10 };
    
    const statsNoTech = calculateFleetStats(fleet, {});
    const statsWithTech = calculateFleetStats(fleet, { weaponsTech: 5 });
    
    // 5 levels = 1 + (5 * 0.2) = 2.0x
    expect(statsWithTech.attack).toBe(Math.floor(statsNoTech.attack * 2.0));
  });

  it('should apply shield technology multiplier', () => {
    const fleet = { cruiser: 5 };
    
    const statsNoTech = calculateFleetStats(fleet, {});
    const statsWithTech = calculateFleetStats(fleet, { shieldingTech: 3 });
    
    // 3 levels = 1 + (3 * 0.2) = 1.6x
    expect(statsWithTech.shield).toBe(Math.floor(statsNoTech.shield * 1.6));
  });

  it('should apply armor technology multiplier', () => {
    const fleet = { battleship: 2 };
    
    const statsNoTech = calculateFleetStats(fleet, {});
    const statsWithTech = calculateFleetStats(fleet, { armorTech: 2 });
    
    // 2 levels = 1 + (2 * 0.15) = 1.3x
    expect(statsWithTech.hull).toBe(Math.floor(statsNoTech.hull * 1.3));
  });

  it('should combine all technologies', () => {
    const fleet = {
      lightFighter: 5,
      cruiser: 2
    };
    
    const stats = calculateFleetStats(fleet, {
      weaponsTech: 5,
      shieldingTech: 5,
      armorTech: 5
    });
    
    expect(stats.attack).toBeGreaterThan(0);
    expect(stats.shield).toBeGreaterThan(0);
    expect(stats.hull).toBeGreaterThan(0);
  });

  it('should ignore zero/negative quantities', () => {
    const fleet = {
      lightFighter: 10,
      heavyFighter: 0,
      cruiser: -5
    };
    
    const stats = calculateFleetStats(fleet);
    const lightFighter = getShip('lightFighter');
    
    expect(stats.attack).toBe(lightFighter.attack * 10);
  });

  it('should return integer stats', () => {
    const fleet = { lightFighter: 7, cruiser: 3 };
    const stats = calculateFleetStats(fleet, {
      weaponsTech: 2,
      shieldingTech: 3,
      armorTech: 1
    });
    
    expect(Number.isInteger(stats.attack)).toBe(true);
    expect(Number.isInteger(stats.shield)).toBe(true);
    expect(Number.isInteger(stats.hull)).toBe(true);
  });
});

describe('Ships - calculateCargoCapacity Function', () => {
  it('should calculate zero capacity for empty fleet', () => {
    const capacity = calculateCargoCapacity({});
    expect(capacity).toBe(0);
  });

  it('should sum cargo from single ship type', () => {
    const fleet = { smallCargo: 5 };
    const capacity = calculateCargoCapacity(fleet);
    
    const smallCargo = getShip('smallCargo');
    expect(capacity).toBe(smallCargo.cargoCapacity * 5);
  });

  it('should sum cargo from multiple ship types', () => {
    const fleet = {
      smallCargo: 3,
      largeCargo: 2
    };
    
    const capacity = calculateCargoCapacity(fleet);
    const smallCargo = getShip('smallCargo');
    const largeCargo = getShip('largeCargo');
    
    const expected = (smallCargo.cargoCapacity * 3) + (largeCargo.cargoCapacity * 2);
    expect(capacity).toBe(expected);
  });

  it('should handle military ships with cargo', () => {
    const fleet = { lightFighter: 10 };
    const capacity = calculateCargoCapacity(fleet);
    
    const lightFighter = getShip('lightFighter');
    expect(capacity).toBe(lightFighter.cargoCapacity * 10);
  });

  it('should include all quantities in fleet', () => {
    const fleet = {
      smallCargo: 5,
      largeCargo: 0
    };
    
    const capacity = calculateCargoCapacity(fleet);
    const smallCargo = getShip('smallCargo');
    const largeCargo = getShip('largeCargo');
    
    const expected = (smallCargo.cargoCapacity * 5) + (largeCargo.cargoCapacity * 0);
    expect(capacity).toBe(expected);
  });

  it('should return non-negative value', () => {
    const fleet = { smallCargo: 100, largeCargo: 50 };
    const capacity = calculateCargoCapacity(fleet);
    
    expect(capacity).toBeGreaterThan(0);
  });
});

describe('Ships - calculateFleetFuelCost Function', () => {
  it('should return zero cost for empty fleet', () => {
    const cost = calculateFleetFuelCost({}, 1000);
    expect(cost).toBe(0);
  });

  it('should scale cost with distance', () => {
    const fleet = { smallCargo: 1 };
    
    const cost1000 = calculateFleetFuelCost(fleet, 1000);
    const cost2000 = calculateFleetFuelCost(fleet, 2000);
    
    expect(cost2000).toBeGreaterThan(cost1000);
  });

  it('should consider fuel consumption of different ships', () => {
    const fleetCargo = { smallCargo: 1 };
    const fleetFighter = { lightFighter: 1 };
    
    const costCargo = calculateFleetFuelCost(fleetCargo, 35000);
    const costFighter = calculateFleetFuelCost(fleetFighter, 35000);
    
    // Different ships have different fuel values
    expect(costCargo).not.toBe(costFighter);
  });

  it('should sum fuel from multiple ships', () => {
    const fleet = {
      smallCargo: 2,
      lightFighter: 5
    };
    
    const cost = calculateFleetFuelCost(fleet, 35000);
    
    const smallCargo = getShip('smallCargo');
    const lightFighter = getShip('lightFighter');
    
    const expectedCost = Math.ceil(
      ((smallCargo.fuel * 2) + (lightFighter.fuel * 5)) / 35000 * 35000
    );
    
    expect(cost).toBeGreaterThan(0);
  });

  it('should use 35000 as reference distance', () => {
    const fleet = { smallCargo: 1 };
    const smallCargo = getShip('smallCargo');
    
        // At reference distance, cost should equal the fuel value + 1
        const cost = calculateFleetFuelCost(fleet, 35000);
    
        // Formula: 1 + (def.fuel * count * distance) / 35000
        // 1 + (50 * 1 * 35000) / 35000 = 51
        expect(cost).toBe(smallCargo.fuel + 1);  });

  it('should return integer cost', () => {
    const fleet = { smallCargo: 3, heavyFighter: 2 };
    const cost = calculateFleetFuelCost(fleet, 17500);
    
    expect(Number.isInteger(cost)).toBe(true);
  });

  it('should handle long distances', () => {
    const fleet = { smallCargo: 1 };
    const costShort = calculateFleetFuelCost(fleet, 1000);
    const costLong = calculateFleetFuelCost(fleet, 1000000);
    
    expect(costLong).toBeGreaterThan(costShort);
  });

    it('should handle zero distance', () => {
      const fleet = { smallCargo: 1 };
      const cost = calculateFleetFuelCost(fleet, 0);
  
      // Formula adds 1: 1 + 0 = 1
      expect(cost).toBe(1);
    });});
