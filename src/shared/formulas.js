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
  const roboticsMultiplier = 1 + (roboticsLevel * 0.05);
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  
  return Math.floor(time / (roboticsMultiplier * naniteMultiplier));
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
