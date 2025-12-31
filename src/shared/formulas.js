// Game formulas and calculations
import { BUILDINGS } from './buildings.js';
import { calculateBaseTime } from './time.js';

/**
 * Calculate building cost based on level
 */
export function calculateBuildingCost(baseCost, level) {
  return {
    metal: Math.floor(baseCost.metal * Math.pow(1.5, level)),
    crystal: Math.floor(baseCost.crystal * Math.pow(1.5, level)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(1.5, level))
  };
}

/**
 * Calculate building construction time
 */
export function calculateBuildTime(building, level, roboticsLevel = 0, naniteLevel = 0) {
  const baseTime = calculateBaseTime(building);
  const time = baseTime * Math.pow(1.5, level);
  const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(0.8, roboticsLevel) : 1;
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  
  return Math.floor((time * roboticsMultiplier) / naniteMultiplier);
}

/**
 * Calculate resource production per hour
 * Formula: baseProduction * level * 1.1^level
 * Optionally applies variant modifier (e.g., custom building variant with +49% production)
 * @param {number} baseProduction - Base production amount
 * @param {number} level - Building level
 * @param {number} variantMultiplier - Optional variant modifier (default 1.0)
 */
export function calculateProduction(baseProduction, level, variantMultiplier = 1.0) {
  return Math.floor(baseProduction * level * Math.pow(1.1, level) * variantMultiplier);
}

/**
 * Calculate research cost
 */
export function calculateResearchCost(baseCost, level) {
  return {
    metal: Math.floor(baseCost.metal * Math.pow(2, level)),
    crystal: Math.floor(baseCost.crystal * Math.pow(2, level)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(2, level))
  };
}

/**
 * Calculate research time
 */
export function calculateResearchTime(research, level, labLevel = 1, researchSpeedBonus = 0) {
  const baseTime = calculateBaseTime(research);
  const time = baseTime * Math.pow(2, level);
  const labMultiplier = Math.pow(0.8, labLevel);
  const techMultiplier = 1 / (1 + researchSpeedBonus);
  
  return Math.max(1, Math.floor(time * labMultiplier * techMultiplier));
}

/**
 * Calculate storage capacity
 */
export function calculateStorage(baseStorage, level) {
  return Math.floor(baseStorage * Math.pow(1.5, level));
}

/**
 * Calculate fleet fuel consumption
 */
export function calculateFuelConsumption(distance, ships) {
  // Simplified calculation
  let totalMass = 0;
  for (const key in ships) {
    totalMass += ships[key];
  }
  return Math.floor(distance * totalMass * 0.1);
}

/**
 * Calculate fleet travel time
 */
export function calculateTravelTime(distance, speed) {
  // Simplified: distance in systems, speed is base speed
  return Math.floor((distance * 3600) / speed); // Returns seconds
}

/**
 * Calculate combat power
 */
export function calculateCombatPower(ships, weaponsTech = 0, shieldingTech = 0, armorTech = 0) {
  // Simplified combat calculation
  const weaponsMultiplier = 1 + (weaponsTech * 0.1);
  const shieldMultiplier = 1 + (shieldingTech * 0.1);
  const armorMultiplier = 1 + (armorTech * 0.1);
  
  return {
    attack: Math.floor(ships * weaponsMultiplier * 100),
    shield: Math.floor(ships * shieldMultiplier * 50),
    armor: Math.floor(ships * armorMultiplier * 75)
  };
}
/**
 * Calculate effectiveness based on allocation percentage
 * Non-linear: 50% = 70.7%, 100% = 100%, 200% = 141.4%
 * Formula: effectiveness = sqrt(allocation%) * 10
 */
export function calculateAllocationEffectiveness(allocationPercent) {
  if (allocationPercent <= 0) return 0;
  return Math.sqrt(allocationPercent) * 10;
}

/**
 * Calculate power effectiveness (same non-linear curve)
 */
export function calculatePowerEffectiveness(powerPercent) {
  return calculateAllocationEffectiveness(powerPercent);
}

/**
 * Calculate population effectiveness
 */
export function calculatePopulationEffectiveness(populationPercent) {
  return calculateAllocationEffectiveness(populationPercent);
}

/**
 * Calculate population growth/decay based on food availability
 * Growth: max(1% per hour, 60 per hour) when food available and under max population
 * Decay: 2% per hour when food unavailable
 * Minimum: 10 population (never goes to 0)
 * Maximum: maxPopulation
 */
export function calculatePopulationChange(currentPopulation, maxPopulation, foodAvailable, hoursElapsed, productionMultiplier = 1.0) {
  const minPopulation = 10;
  const minGrowthPerHour = 60;
  
  if (foodAvailable && currentPopulation < maxPopulation) {
    // Grow population (take max of 1% per hour or 60 per hour)
    const percentGrowth = currentPopulation * 0.01 * hoursElapsed * productionMultiplier;
    const flatGrowth = minGrowthPerHour * hoursElapsed * productionMultiplier;
    const totalGrowth = Math.max(percentGrowth, flatGrowth);
    
    return Math.min(
      maxPopulation,
      currentPopulation + totalGrowth
    );
  } else if (!foodAvailable && currentPopulation > minPopulation) {
    // Lose population when no food (2% per hour)
    const decayRate = 0.02;
    return Math.max(
      minPopulation,
      currentPopulation - (currentPopulation * decayRate * hoursElapsed)
    );
  }
  
  return currentPopulation;
}

/**
 * Calculate production bonus from planet position relative to sun
 * Position 1 = closest to sun (0.9x deut, 1.0x water, 1.3x farms)
 * Position 8 = mid distance (1.3x deut, 0.8x water, 0.9x farms)
 * Position 15 = farthest (0.6x deut, 1.5x water, 0.6x farms)
 */
export function calculatePositionMultiplier(position, resourceType) {
  // Position ranges from 1-15
  const normalized = (position - 1) / 14; // 0 to 1
  
  switch (resourceType) {
    case 'water':
      // Best far from sun
      return 0.9 + (normalized * 0.6); // 0.9 to 1.5
    
    case 'farm':
    case 'food':
      // Best close to sun
      return 1.3 - (normalized * 0.7); // 1.3 to 0.6
    
    case 'deuterium':
      // Best at mid-distance (peaks around position 8)
      const midPoint = 7 / 14; // Position 8 normalized
      const distanceFromMid = Math.abs(normalized - midPoint);
      return 1.3 - (distanceFromMid * 2 * 0.7); // Peaks at 1.3, drops to ~0.6 at edges
    
    default:
      return 1.0; // Metal and crystal are equal everywhere
  }
}

/**
 * Get building energy consumption at a given level
 * @param {string} buildingType - The building type key
 * @param {number} level - The building level
 * @param {object} buildings - Optional: The BUILDINGS object from shared/buildings.js. If not provided, uses imported BUILDINGS.
 */
export function getBuildingEnergyConsumption(buildingType, level, buildingsObj = BUILDINGS) {
  const building = buildingsObj[buildingType];
  if (!building || !building.energyConsumption) return 0;
  
  // Energy consumption scales exponentially: base * level * (1.1 ^ level) * 10
  // This matches the buildings view calculation
  const energyMultiplier = 10.0;
  return Math.floor(building.energyConsumption * level * Math.pow(1.1, level) * energyMultiplier);
}

/**
 * Get building population requirement at a given level
 * @param {string} buildingType - The building type key
 * @param {number} level - The building level
 * @param {object} buildings - Optional: The BUILDINGS object from shared/buildings.js. If not provided, uses imported BUILDINGS.
 */
export function getBuildingPopulationRequired(buildingType, level, buildingsObj = BUILDINGS) {
  const building = buildingsObj[buildingType];
  if (!building || !building.populationRequired) return 0;
  
  // Population requirement scales exponentially: base * level * (1.05 ^ level)
  // This matches the buildings view calculation
  const populationMultiplier = 1.05;
  return Math.floor(building.populationRequired * level * Math.pow(populationMultiplier, level));
}

/**
 * Calculate theoretical research cost at a given level
 * Doubles with each level (exponential growth)
 */
export function calculateTheoreticalResearchCost(baseCost, level) {
  return {
    metal: Math.floor(baseCost.metal * Math.pow(2, level)),
    crystal: Math.floor(baseCost.crystal * Math.pow(2, level)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(2, level))
  };
}

/**
 * Calculate theoretical research time at a given level
 * Time doubles with each level, affected by research lab level
 */
export function calculateTheoreticalResearchTime(research, level, labLevel = 1, researchSpeedBonus = 0) {
  const baseTime = calculateBaseTime(research);
  const time = baseTime * Math.pow(2, level);
  const labMultiplier = Math.pow(0.8, labLevel);
  const techMultiplier = 1 / (1 + researchSpeedBonus);
  
  return Math.max(1, Math.floor(time * labMultiplier * techMultiplier));
}

/**
 * Calculate practical research (customization) cost at a given level
 * Slower scaling than theoretical: 1.5x per level
 */
export function calculatePracticalResearchCost(baseCost, level) {
  return {
    metal: Math.floor(baseCost.metal * Math.pow(1.5, level)),
    crystal: Math.floor(baseCost.crystal * Math.pow(1.5, level)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(1.5, level))
  };
}

/**
 * Calculate practical research (customization) time at a given level
 * Slower scaling than theoretical: 1.5x per level
 */
export function calculatePracticalResearchTime(research, level, labLevel = 1, researchSpeedBonus = 0) {
  const baseTime = calculateBaseTime(research);
  const time = baseTime * Math.pow(1.5, level);
  const labMultiplier = Math.pow(0.8, labLevel);
  const techMultiplier = 1 / (1 + researchSpeedBonus);
  
  return Math.max(1, Math.floor(time * labMultiplier * techMultiplier));
}

/**
 * Apply theoretical research bonuses to a stat
 * Each level grants an incremental bonus
 */
export function applyTheoreticalBonus(baseValue, techLevel, bonusPerLevel) {
  return baseValue * (1 + (techLevel * bonusPerLevel));
}

/**
 * Calculate combined modifiers from all practical research focuses
 * Used when retrieving a specific customized building/ship variant
 */
export function calculatePracticalModifiers(baseDefinition, focusLevels, researchConfig) {
  const modifiers = {
    productionMultiplier: 0,
    costMultiplier: 0,
    energyMultiplier: 0,
    populationMultiplier: 0,
    cargoMultiplier: 0,
    fuelMultiplier: 0,
    speedMultiplier: 0,
    attackMultiplier: 0,
    hullMultiplier: 0,
    shieldMultiplier: 0
  };
  
  // Sum modifiers from each focus
  for (const [focus, level] of Object.entries(focusLevels)) {
    if (level > 0 && researchConfig.focusModifiers && researchConfig.focusModifiers[focus]) {
      const focusModifiers = researchConfig.focusModifiers[focus];
      for (const [stat, modifier] of Object.entries(focusModifiers)) {
        if (modifiers.hasOwnProperty(stat)) {
          modifiers[stat] += modifier * level;
        }
      }
    }
  }
  
  return modifiers;
}