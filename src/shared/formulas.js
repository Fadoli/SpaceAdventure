// Game formulas and calculations
import { BUILDINGS } from './buildings.js';
import { calculateBaseTime } from './time.js';
import { BUILDING_SPEED_MULTIPLIER, SCALING, CONFIG } from './constants.js';
import { getResearchBonus } from './research.js';

/**
 * Calculate building cost based on level
 */
export function calculateBuildingCost(baseCost, level, costReductionBonus = 0, costScaling = null) {
  const scaling = costScaling || SCALING.BUILDING_COST;
  const multiplier = Math.pow(scaling, level);
  const reduction = 1 - costReductionBonus;
  return {
    metal: Math.floor(baseCost.metal * multiplier * reduction),
    crystal: Math.floor(baseCost.crystal * multiplier * reduction),
    deuterium: Math.floor(baseCost.deuterium * multiplier * reduction)
  };
}

/**
 * Calculate building construction time
 */
export function calculateBuildTime(building, level, roboticsLevel = 0, naniteLevel = 0, configMultiplier = 1.0, timeReductionBonus = 0) {
  const baseTime = calculateBaseTime(building);
  const time = baseTime * Math.pow(SCALING.BUILDING_TIME, level - 1);
  
  const roboticsDef = BUILDINGS.roboticsFactory;
  const roboticsSpeedMultiplier = roboticsDef.speedMultiplier || 0.85;
  const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(roboticsSpeedMultiplier, roboticsLevel) : 1;
  
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  const reduction = 1 - timeReductionBonus;
  
  return Math.max(1, Math.floor((time * roboticsMultiplier / naniteMultiplier) * configMultiplier * reduction));
}

/**
 * Calculate resource production per hour
 * Formula: baseProduction * level * productionScaling^level
 * Optionally applies variant modifier (e.g., custom building variant with +49% production)
 * @param {number} baseProduction - Base production amount
 * @param {number} level - Building level
 * @param {number} variantMultiplier - Optional variant modifier (default 1.0)
 */
export function calculateProduction(baseProduction, level, variantMultiplier = 1.0) {
  return Math.floor(baseProduction * level * Math.pow(SCALING.BUILDING_PRODUCTION, level) * variantMultiplier);
}

/**
 * Calculate research cost
 */
export function calculateResearchCost(baseCost, level) {
  return {
    metal: Math.floor(baseCost.metal * Math.pow(SCALING.RESEARCH_COST, level)),
    crystal: Math.floor(baseCost.crystal * Math.pow(SCALING.RESEARCH_COST, level)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(SCALING.RESEARCH_COST, level))
  };
}

/**
 * Calculate research time
 */
export function calculateResearchTime(research, level, labLevel = 1, researchSpeedBonus = 0, configMultiplier = 1.0) {
  return calculateTheoreticalResearchTime(research, level, labLevel, researchSpeedBonus, configMultiplier);
}

/**
 * Calculate storage capacity
 */
export function calculateStorage(baseStorage, level) {
  return Math.floor(baseStorage * Math.pow(SCALING.BUILDING_STORAGE, level));
}

/**
 * Calculate distance between two sets of coordinates [G, S, P]
 */
export function calculateDistance(coord1, coord2) {
  // 1. Galaxy difference (Inter-galactic)
  if (coord1[0] !== coord2[0]) {
    return Math.abs(coord1[0] - coord2[0]) * 5000;
  }
  
  // 2. System difference (Intra-galactic, Linear)
  if (coord1[1] !== coord2[1]) {
    const diff = Math.abs(coord1[1] - coord2[1]);
    return diff * 30 + 1000;
  }
  
  // 3. Planet difference (Intra-system)
  if (coord1[2] !== coord2[2]) {
    const diff = Math.abs(coord1[2] - coord2[2]);
    return diff * 20 + 200;
  }
  
  return 5; // Same planet
}

/**
 * Calculate fleet fuel consumption
 */
export function calculateFuelConsumption(distance, ships, definitions, speedPercent = 1.0) {
  let totalFuel = 0;
  // Limit speedPercent between 0.1 and 1.0
  const speedFactor = Math.max(0.1, Math.min(1.0, speedPercent));
  
  for (const shipKey in ships) {
    const count = ships[shipKey];
    if (count <= 0) continue;
    
    const def = definitions[shipKey];
    if (!def) continue;

    // OGame-like fuel formula: cost scales with (speedFactor + 1)^2
    // Higher speed = significantly higher fuel consumption
    const consumptionFactor = Math.pow(speedFactor + 1, 2) / 4;
    const shipFuel = 1 + (def.fuel * count * distance * consumptionFactor) / 35000;
    totalFuel += shipFuel;
  }
  return Math.ceil(totalFuel);
}

/**
 * Calculate fleet travel time
 */
export function calculateTravelTime(distance, speed, configMultiplier = 1.0, speedPercent = 1.0) {
  const speedFactor = Math.max(0.1, Math.min(1.0, speedPercent));
  const effectiveSpeed = speed * speedFactor;
  
  // Power-Law Hybrid formula: (10 + (3500 * (distance^0.7 / sqrt(speed)))) / globalSpeed
  const time = (5 + (1500 * (Math.pow(distance, 0.7) / Math.sqrt(effectiveSpeed)))) / configMultiplier;
  return Math.max(1, Math.floor(time));
}

/**
 * Calculate combat power
 */
export function calculateCombatPower(ships, weaponsTech = 0, shieldingTech = 0, armorTech = 0, hullBonusTech = 0) {
  const weaponsMultiplier = 1 + getResearchBonus({ weaponsTech }, 'unitAttackPower');
  const shieldMultiplier = 1 + getResearchBonus({ shieldingTech }, 'unitShieldStrength');
  const armorMultiplier = 1 + getResearchBonus({ armorTech }, 'unitHullStrength');
  
  return {
    attack: Math.floor(ships * weaponsMultiplier * 100),
    shield: Math.floor(ships * shieldMultiplier * 50),
    armor: Math.floor(ships * armorMultiplier * 75)
  };
}
/**
 * Calculate total food consumption based on population
 */
export function calculateFoodConsumption(population, consumptionRate) {
  return population * consumptionRate;
}

/**
 * Calculate total water consumption based on population
 */
export function calculateWaterConsumption(population, consumptionRate) {
  return population * consumptionRate;
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
 * Calculate population growth/decay based on resource availability
 * Growth: max(1% per hour, 60 per hour) when food and water available and under max population
 * Decay: 2% per hour when food or water unavailable
 * Minimum: 10 population (never goes to 0)
 * Maximum: maxPopulation
 */
export function calculatePopulationChange(currentPopulation, maxPopulation, foodAvailable, waterAvailable, hoursElapsed, productionMultiplier = 1.0) {
  const minPopulation = 10;
  const minGrowthPerHour = CONFIG.MIN_POPULATION_GROWTH || 60;
  
  if (foodAvailable && waterAvailable && currentPopulation < maxPopulation) {
    // Grow population (take max of 1% per hour or 60 per hour)
    const percentGrowth = currentPopulation * 0.01 * hoursElapsed * productionMultiplier;
    const flatGrowth = minGrowthPerHour * hoursElapsed * productionMultiplier;
    const totalGrowth = Math.max(percentGrowth, flatGrowth);
    
    return Math.min(
      maxPopulation,
      currentPopulation + totalGrowth
    );
  } else if ((!foodAvailable || !waterAvailable) && currentPopulation > minPopulation) {
    // Lose population when no food or water (2% per hour)
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
 * @param {object} buildingsObj - Optional: The BUILDINGS object
 * @param {number} efficiencyBonus - Optional: Efficiency bonus from research (0.0 to 1.0)
 */
export function getBuildingEnergyConsumption(buildingType, level, buildingsObj = BUILDINGS, efficiencyBonus = 0) {
  const building = buildingsObj[buildingType];
  if (!building || !building.energyConsumption) return 0;
  
  // Energy consumption scales exponentially: base * level * (energyScaling ^ level) * 10
  const energyMultiplier = 10.0;
  let consumption = Math.floor(building.energyConsumption * level * Math.pow(SCALING.BUILDING_ENERGY, level) * energyMultiplier);
  
  // Apply efficiency bonus (never reduce below 50% of base consumption)
  const reduction = 1 - efficiencyBonus;
  consumption = Math.floor(consumption * Math.max(0.5, reduction));
  
  return consumption;
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
  
  // Population requirement scales exponentially: base * level * (popScaling ^ level)
  // This matches the buildings view calculation
  return Math.floor(building.populationRequired * level * Math.pow(SCALING.BUILDING_POPULATION, level));
}

/**
 * Calculate the maximum number of planets a player can have based on research levels
 * Formula: 1 (Homeworld) + total bonuses from research
 */
export function calculateMaxPlanets(research = {}) {
  const astroBonus = getResearchBonus(research, 'playerGalaxySlots');
  return 1 + astroBonus;
}

/**
 * Calculate theoretical research cost at a given level
 * Increases with each level (exponential growth)
 */
export function calculateTheoreticalResearchCost(baseCost, level, costScaling = null) {
  const scaling = costScaling || SCALING.RESEARCH_COST || 2.0;
  return {
    metal: Math.floor(baseCost.metal * Math.pow(scaling, level)),
    crystal: Math.floor(baseCost.crystal * Math.pow(scaling, level)),
    deuterium: Math.floor(baseCost.deuterium * Math.pow(scaling, level))
  };
}

/**
 * Calculate theoretical research time at a given level
 * Time increases with each level, affected by research lab level
 */
export function calculateTheoreticalResearchTime(research, level, labLevel = 1, researchSpeedBonus = 0, configMultiplier = 1.0, speedMultiplier = null) {
  const baseTime = calculateBaseTime(research);
  const time = baseTime * Math.pow(SCALING.RESEARCH_TIME, level);
  const scaling = speedMultiplier || BUILDING_SPEED_MULTIPLIER;
  const labMultiplier = Math.pow(scaling, labLevel);
  const techMultiplier = 1 / (1 + researchSpeedBonus);
  
  return Math.max(1, Math.floor(time * labMultiplier * techMultiplier * configMultiplier));
}

/**
 * Calculate practical research (customization) cost at a given level
 * Applies allocation modifiers, level scaling, and strength multiplier
 */
export function calculatePracticalResearchCost(baseCost, level, allocation = { output: 1.0 }, strength = 0.5) {
  const costModifiers = { output: 1.05, automation: 1.12, energy: 1.08, cost: 0.88 };
  
  let totalCostMultiplier = 0;
  // Ensure allocation sums to approx 1, but we just sum the weighted parts
  for (const focus in allocation) {
    totalCostMultiplier += (costModifiers[focus] || 1) * (allocation[focus] || 0);
  }
  if (totalCostMultiplier === 0) totalCostMultiplier = 1;

  // Strength multiplier: Logarithmic scaling 10x to 1,000,000x
  // strength is 0-1. logValue is 1-6.
  const actualStrength = Math.pow(10, 1 + strength * 5);
  const strengthMultiplier = actualStrength;
  
  const finalMultiplier = totalCostMultiplier * strengthMultiplier;
  
  return {
    metal: Math.ceil(baseCost.metal * finalMultiplier),
    crystal: Math.ceil(baseCost.crystal * finalMultiplier),
    deuterium: Math.ceil(baseCost.deuterium * finalMultiplier)
  };
}

/**
 * Calculate practical research (customization) time at a given level
 * Derived directly from the calculated resource cost
 */
export function calculatePracticalResearchTime(research, level, labLevel = 1, researchSpeedBonus = 0, configMultiplier = 1.0, strength = 0.5, allocation = { output: 1.0 }, speedMultiplier = null) {
  // Derive duration from actual cost
  const actualCost = calculatePracticalResearchCost(research.baseCost, level, allocation, strength);
  const rawDuration = calculateBaseTime({ baseCost: actualCost });
  
  const scaling = speedMultiplier || BUILDING_SPEED_MULTIPLIER;
  const labMultiplier = Math.pow(scaling, labLevel);
  const techMultiplier = 1 / (1 + researchSpeedBonus);
  
  const totalTime = Math.floor(rawDuration * labMultiplier * techMultiplier * configMultiplier);
  
  // Apply same constraints as server
  const minTime = 1; // 1 second minimum
  const maxTime = 604800; // 7 days maximum
  
  return Math.max(minTime, Math.min(maxTime, totalTime));
}

/**
 * Apply theoretical research bonuses to a stat
 * Each level grants an incremental bonus
 */
export function applyTheoreticalBonus(baseValue, techLevel, bonusPerLevel) {
  return baseValue * (1 + (techLevel * bonusPerLevel));
}

/**
 * Calculate the outcome of a research run
 * @returns {Object} { type: 'failure'|'success'|'breakthrough', multiplier: number }
 */
export function rollResearchOutcome() {
  const roll = Math.random();
  if (roll < 0.1) return { type: 'breakthrough', multiplier: 5.5 }; // 10% chance
  if (roll < 0.6) return { type: 'failure', multiplier: 0.1 };    // 50% chance
  return { type: 'success', multiplier: 1.0 };                     // 40% chance
}

/**
 * Convert raw experience points to a functional level using a non-linear scale
 * level = sqrt(xp / 100)
 */
export function calculateFocusLevel(xp) {
  if (!xp || xp <= 0) return 0;
  return Math.floor(Math.sqrt(xp / 100));
}

/**
 * Calculate combined modifiers from all practical research focuses
 */
export function calculatePracticalModifiers(baseDefinition, focusLevels, researchConfig) {
  const modifiers = {
    productionMultiplier: 0,
    costMultiplier: 0,
    energyMultiplier: 0,
    populationMultiplier: 0
  };
  
  // Sum modifiers from each focus
  for (const focus in focusLevels) {
    const level = focusLevels[focus];
    if (level > 0 && researchConfig.focusModifiers && researchConfig.focusModifiers[focus]) {
      const focusModifiers = researchConfig.focusModifiers[focus];
      for (const stat in focusModifiers) {
        const modifier = focusModifiers[stat];
        if (modifiers.hasOwnProperty(stat)) {
          modifiers[stat] += modifier * level;
        }
      }
    }
  }
  
  return modifiers;
}