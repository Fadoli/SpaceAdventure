// Game formulas and calculations

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
export function calculateBuildTime(baseTime, level, roboticsLevel = 0, naniteLevel = 0) {
  const time = baseTime * Math.pow(1.5, level);
  const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(0.8, roboticsLevel) : 1;
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  
  return Math.floor(time * roboticsMultiplier * naniteMultiplier);
}

/**
 * Calculate resource production per hour
 */
export function calculateProduction(baseProduction, level) {
  return Math.floor(baseProduction * Math.pow(1.05, level));
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
export function calculateResearchTime(baseTime, level, labLevel = 1) {
  const time = baseTime * Math.pow(2, level);
  const labMultiplier = 1 + (labLevel * 0.1);
  
  return Math.floor(time / labMultiplier);
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
  const totalMass = Object.values(ships).reduce((sum, count) => sum + count, 0);
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
 * Non-linear: 50% = 66%, 100% = 100%, 200% = 150%
 * Formula: effectiveness = sqrt(allocation%) * 100%
 */
export function calculateAllocationEffectiveness(allocationPercent) {
  if (allocationPercent <= 0) return 0;
  return Math.sqrt(allocationPercent) * 100;
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
 * @param {object} buildings - Optional: The BUILDINGS object from shared/buildings.js. If not provided, will import it.
 */
export async function getBuildingEnergyConsumption(buildingType, level, buildings) {
  // If buildings not provided, import it
  if (!buildings) {
    const module = await import('./buildings.js');
    buildings = module.BUILDINGS;
  }
  
  const building = buildings[buildingType];
  if (!building || !building.energyConsumption) return 0;
  
  // Energy consumption typically scales linearly with level
  // Base energy * level
  return building.energyConsumption * level;
}

/**
 * Get building population requirement at a given level
 * @param {string} buildingType - The building type key
 * @param {number} level - The building level
 * @param {object} buildings - Optional: The BUILDINGS object from shared/buildings.js. If not provided, will import it.
 */
export async function getBuildingPopulationRequired(buildingType, level, buildings) {
  // If buildings not provided, import it
  if (!buildings) {
    const module = await import('./buildings.js');
    buildings = module.BUILDINGS;
  }
  
  const building = buildings[buildingType];
  if (!building || !building.populationRequired) return 0;
  
  // Population requirement typically scales linearly with level
  // Base population * level
  return building.populationRequired * level;
}