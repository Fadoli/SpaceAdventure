import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { 
  updatePlanetProduction,
  processCompletedVariantSwitches,
  ensurePlanetState
} from '../../src/server/game/buildings.js';
import { selectCustomBuildingVariant } from '../../src/server/game/researchLogic.js';
import { BUILDINGS } from '../../src/shared/buildings.js';
import { PRACTICAL_RESEARCH, calculateFocusModifiers } from '../../src/shared/research.js';

describe('Building Variants System', () => {
  let player;
  let planet;

  beforeEach(() => {
    // Reset any mocks that might have leaked
    mock.restore();

    // Create a test player
    player = {
      userId: 'test-user',
      username: 'testplayer',
      planets: [],
      customBuildingVariants: {},
      practicalResearch: {
        metalMine: {
          experience: {
            output: 2500,      // sqrt(2500/100) = 5
            automation: 900,   // sqrt(900/100) = 3
            energy: 400,       // sqrt(400/100) = 2
            cost: 0
          }
        },
        crystalMine: {
          experience: {
            output: 2500,
            automation: 900,
            energy: 400,
            cost: 0
          }
        }
      }
    };

    // Create a test planet with buildings
    planet = {
      id: 'test-planet',
      coordinates: [1, 2, 8],
      buildings: {
        solarPlant: 20,    // Plenty of power
        metalMine: 5,
        crystalMine: 3,
        housing: 10
      },
      resources: {
        metal: 1000,
        crystal: 500,
        deuterium: 200,
        water: 1000,
        food: 1000,
        population: 500    // Plenty of people
      },
      production: { metal: 0, crystal: 0, deuterium: 0, energy: 0, water: 0, food: 0 },
      consumption: { energy: 0, water: 0, food: 0, population: 0 },
      storage: {
        metal: 10000,
        crystal: 10000,
        deuterium: 10000,
        water: 10000,
        food: 10000
      },
      buildingAllocations: {},
      activeVariants: {},
      variantSwitchQueue: [],
      lastUpdate: Date.now(),
      lastActivity: Date.now()
    };

    ensurePlanetState(planet);
    player.planets.push(planet);
  });

  it('rejects malformed focus levels before changing variants', () => {
    const before = structuredClone(player.customBuildingVariants);
    const invalid = [
      { output: -1 },
      { output: 1.5 },
      { output: '1' },
      { exploit: 0 }
    ];

    for (const focusLevels of invalid) {
      expect(() => selectCustomBuildingVariant(player, planet.id, 'metalMine', focusLevels)).toThrow();
    }
    expect(player.customBuildingVariants).toEqual(before);
  });

  it('applies exponential effects to square-root-scaled focus levels', () => {
    const research = PRACTICAL_RESEARCH.metalMine;
    const levels = [1, 10, 50, 100, 500, 1000, 5000];
    const outputMultipliers = levels.map(level =>
      calculateFocusModifiers(research, { output: level }).productionMultiplier
    );
    const level30 = calculateFocusModifiers(research, { output: 30 }).productionMultiplier;

    expect(level30).toBeCloseTo(Math.pow(1.02, 30));
    expect(outputMultipliers.every((value, index) => index === 0 || value > outputMultipliers[index - 1])).toBe(true);
    expect(outputMultipliers[0]).toBeCloseTo(1.02);
    expect(outputMultipliers[1]).toBeCloseTo(Math.pow(1.02, 10));
    expect(outputMultipliers[6]).toBeGreaterThan(5);
    expect(outputMultipliers[6]).toBeCloseTo(Math.pow(1.02, 5000));

    player.practicalResearch.metalMine.experience.output = 96100; // sqrt(96100 / 100) = 31
    expect(() => selectCustomBuildingVariant(player, planet.id, 'metalMine', {
      output: 31,
      automation: 0,
      energy: 0
    })).not.toThrow();
  });

  it('rejects inherited building keys without changing variant state', () => {
    const before = structuredClone(player.customBuildingVariants);
    const prototype = Object.getPrototypeOf(player.customBuildingVariants);

    expect(() => selectCustomBuildingVariant(player, planet.id, '__proto__', { output: 0 })).toThrow('Invalid building type');
    expect(player.customBuildingVariants).toEqual(before);
    expect(Object.getPrototypeOf(player.customBuildingVariants)).toBe(prototype);
  });

  afterEach(() => {
    mock.restore();
  });

  describe('updatePlanetProduction with variants', () => {
    it('should calculate production without variants', () => {
      updatePlanetProduction(planet, player);
      
      expect(planet.production).toBeDefined();
      expect(planet.production.metal).toBeGreaterThan(0);
      expect(planet.production.crystal).toBeGreaterThan(0);
    });

    it('should apply custom variant modifiers to production', () => {
      // Get base production without variant
      updatePlanetProduction(planet, player);
      const baseMetalProduction = planet.production.metal;

      // Create a custom variant with a significant production bonus
      const variant = selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 5,  // Use higher focus level for more noticeable effect
        automation: 0,
        energy: 0
      });

      expect(variant).toBeDefined();
      expect(variant.modifiers).toBeDefined();
      expect(variant.modifiers.productionMultiplier).toBeGreaterThan(1);

      // Switch to custom variant
      planet.activeVariants.metalMine = 'custom';

      // Recalculate production with variant active
      updatePlanetProduction(planet, player);
      const variantMetalProduction = planet.production.metal;

      // Production should be higher with the efficiency bonus
      expect(variantMetalProduction).toBeGreaterThan(baseMetalProduction);
    });

    it('should not apply variant modifiers if variant is not active', () => {
      // Create custom variant
      const variant = selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 5,
        automation: 0,
        energy: 0
      });

      // Verify variant has modifiers
      expect(variant.modifiers.productionMultiplier).toBeGreaterThan(1);

      // When not activated, activeVariants.metalMine should be undefined or 'base'
      planet.activeVariants.metalMine = 'base';

      updatePlanetProduction(planet, player);
      const baseProduction = planet.production.metal;

      // When we activate the custom variant
      planet.activeVariants.metalMine = 'custom';
      updatePlanetProduction(planet, player);
      const customProduction = planet.production.metal;
      
      // Verify that the variant modifiers are being applied by checking they're different
      // (Using loose comparison due to flooring effects in production calculations)
      // The custom variant should have higher production due to the productionMultiplier
      const ratio = customProduction / baseProduction;
      expect(ratio).toBeGreaterThanOrEqual(1.0);
      expect(ratio).toBeCloseTo(variant.modifiers.productionMultiplier, 1);
    });

    it('should handle multiple building variants on same planet', () => {
      // Create variants for multiple buildings
      selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 2,
        automation: 0,
        energy: 0
      });

      selectCustomBuildingVariant(player, planet.id, 'crystalMine', {
        output: 3,
        automation: 0,
        energy: 0
      });

      // Activate both variants
      planet.activeVariants.metalMine = 'custom';
      planet.activeVariants.crystalMine = 'custom';

      updatePlanetProduction(planet, player);

      expect(planet.production.metal).toBeGreaterThan(0);
      expect(planet.production.crystal).toBeGreaterThan(0);
    });

    it('should use base variant if player doesnt have custom definition', () => {
      // Set variant as active but don't create the definition
      planet.activeVariants.metalMine = 'custom';
      
      // This should not crash and should use base production
      updatePlanetProduction(planet, player);

      expect(planet.production.metal).toBeGreaterThan(0);
    });

    it('should apply consumption modifiers from variants', () => {
      // Create variant with energy multiplier
      const variant = selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 0,
        automation: 0,
        energy: 2
      });

      expect(variant.modifiers.energyMultiplier).toBeDefined();

      planet.activeVariants.metalMine = 'custom';
      updatePlanetProduction(planet, player);

      expect(planet.energyConsumption).toBeGreaterThan(0);
    });
  });

  describe('processCompletedVariantSwitches', () => {
    it('drops malformed persisted switch items without changing prototypes', async () => {
      const prototype = Object.getPrototypeOf(planet.activeVariants);
      planet.variantSwitchQueue.push({ buildingType: '__proto__', toCustom: true, finishTime: 0 });

      expect(await processCompletedVariantSwitches(player)).toBe(true);
      expect(planet.variantSwitchQueue).toEqual([]);
      expect(Object.getPrototypeOf(planet.activeVariants)).toBe(prototype);
    });

    it('should switch variant and recalculate production', async () => {
      // Create custom variant
      selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 5,
        automation: 0,
        energy: 0
      });

      // Set initial variant to base
      planet.activeVariants.metalMine = 'base';
      updatePlanetProduction(planet, player);
      const baseProduction = planet.production.metal;

      // Queue a variant switch that's already complete
      const now = Date.now();
      planet.variantSwitchQueue.push({
        buildingType: 'metalMine',
        toCustom: true,
        finishTime: now - 1000,
        queuePosition: 1
      });

      // Process the switch
      const updated = await processCompletedVariantSwitches(player);

      expect(updated).toBe(true);
      expect(planet.variantSwitchQueue.length).toBe(0);
      expect(planet.activeVariants.metalMine).toBe('custom');

      // Production should be recalculated with variant active
      const ratio = planet.production.metal / baseProduction;
      expect(ratio).toBeGreaterThanOrEqual(1.0);
    });

    it('should process multiple variant switches in queue', async () => {
      // Create custom variants
      selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 3,
        automation: 0,
        energy: 0
      });

      selectCustomBuildingVariant(player, planet.id, 'crystalMine', {
        output: 2,
        automation: 0,
        energy: 0
      });

      const now = Date.now();
      
      // Add first completed switch
      planet.variantSwitchQueue.push({
        buildingType: 'metalMine',
        toCustom: true,
        finishTime: now - 1000,
        queuePosition: 1
      });

      // Add second switch that's not yet complete
      planet.variantSwitchQueue.push({
        buildingType: 'crystalMine',
        toCustom: true,
        finishTime: now + 10000, // Not yet complete
        queuePosition: 2
      });

      const updated = await processCompletedVariantSwitches(player);

      expect(updated).toBe(true);
      expect(planet.variantSwitchQueue.length).toBe(1);
      expect(planet.activeVariants.metalMine).toBe('custom');
      expect(planet.activeVariants.crystalMine).toBe('base');
    });

    it('should switch back to base variant', async () => {
      // Create custom variant
      selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 5,
        automation: 0,
        energy: 0
      });

      // Start with custom variant active
      planet.activeVariants.metalMine = 'custom';
      updatePlanetProduction(planet, player);
      const customProduction = planet.production.metal;

      // Queue switch back to base that's already complete
      const now = Date.now();
      planet.variantSwitchQueue.push({
        buildingType: 'metalMine',
        toCustom: false,
        finishTime: now - 1000,
        queuePosition: 1
      });

      const updated = await processCompletedVariantSwitches(player);

      expect(updated).toBe(true);
      expect(planet.activeVariants.metalMine).toBe('base');
      
      // Production should be recalculated without variant
      const ratio = planet.production.metal / customProduction;
      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThanOrEqual(1.0); // Should be reduced or equal
    });
  });

  describe('Variant integration with different planets', () => {
    it('should allow different variants on different planets', () => {
      // Create second planet
      const planet2 = {
        id: 'test-planet-2',
        coordinates: [1, 2, 8],
        buildings: { 
          solarPlant: 20, // Give planet2 more power to ensure it's not throttled
          metalMine: 5 
        },
        resources: { metal: 0, crystal: 0, deuterium: 0, water: 1000, food: 1000, population: 100 },
        production: {},
        consumption: {},
        storage: {
          metal: 10000,
          crystal: 10000,
          deuterium: 10000,
          water: 10000,
          food: 10000
        },
        buildingAllocations: {},
        activeVariants: {},
        variantSwitchQueue: [],
        lastUpdate: Date.now()
      };
      ensurePlanetState(planet2);
      player.planets.push(planet2);

      // Create custom variant (applies to player level)
      // First ensure player has experience for focus level 10
      player.practicalResearch.metalMine.experience.output = 10000; // sqrt(10000/100) = 10

      const variant = selectCustomBuildingVariant(player, planet.id, 'metalMine', {
        output: 10, // Max possible output for clear difference
        automation: 0,
        energy: 0
      });

      // Activate on planet1 only
      planet.activeVariants.metalMine = 'custom';
      planet2.activeVariants.metalMine = 'base';

      // Ensure planet1 has enough energy too
      planet.buildings.solarPlant = 20;

      updatePlanetProduction(planet, player);
      updatePlanetProduction(planet2, player);

      // Production should differ based on variant selection
      expect(planet.production.metal).toBeGreaterThan(planet2.production.metal);
    });
  });
});
