// Ship definitions and stats

import { BUILDING_SPEED_MULTIPLIER, CONFIG, SCALING } from './constants.js';
import { calculateBaseTime } from './time.js';
import { getResearchBonus, THEORETICAL_RESEARCH } from './research.js';
import { BUILDINGS } from './buildings.js';

export const SHIPS = {
  // Civilian Ships
  smallCargo: {
    name: 'Small Cargo',
    icon: '📦',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Basic transport ship for small cargo operations.',
    baseCost: {
      metal: 2000,
      crystal: 2000,
      deuterium: 0
    },
    cargoCapacity: 5000,
    fuel: 50,
    speed: 5000, // Units per hour
    attack: 5,
    shield: 10,
    hull: 400,
    populationRequired: 2,
    rapidFire: {
      espionageProbe: 5
    }
  },

  largeCargo: {
    name: 'Large Cargo',
    icon: '📫',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Heavy transport ship for large cargo operations.',
    baseCost: {
      metal: 6000,
      crystal: 6000,
      deuterium: 0
    },
    cargoCapacity: 25000,
    fuel: 300,
    speed: 4000, // Units per hour
    attack: 5,
    shield: 20,
    hull: 1200,
    populationRequired: 5,
    rapidFire: {
      espionageProbe: 5
    }
  },

  colonyShip: {
    name: 'Colony Ship',
    icon: '🏗️',
    type: 'civilian',
    driveType: 'impulse',
    description: 'Colonizes new planets. Single-use, one-way trip.',
    baseCost: {
      metal: 10000,
      crystal: 20000,
      deuterium: 10000
    },
    cargoCapacity: 0,
    fuel: 1000,
    speed: 2500, // Units per hour
    attack: 50,
    shield: 100,
    hull: 3000,
    populationRequired: 100, // Large crew for colonization
    rapidFire: {
      espionageProbe: 5
    }
  },

  recycler: {
    name: 'Recycler',
    icon: '♻️',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Collects debris from destroyed ships in battle.',
    baseCost: {
      metal: 10000,
      crystal: 6000,
      deuterium: 2000
    },
    cargoCapacity: 20000,
    fuel: 300,
    speed: 2000, // Units per hour
    attack: 1,
    shield: 10,
    hull: 1600,
    populationRequired: 15,
    rapidFire: {
      espionageProbe: 5
    }
  },

  espionageProbe: {
    name: 'Espionage Probe',
    icon: '🛸',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Gathers intelligence on target planets.',
    baseCost: {
      metal: 0,
      crystal: 1000,
      deuterium: 0
    },
    cargoCapacity: 5,
    fuel: 1,
    speed: 100000000, // Crazy fast!
    attack: 0,
    shield: 1,
    hull: 10,
    populationRequired: 0 // Unmanned
  },

  // Military Ships - Fighters
  lightFighter: {
    name: 'Light Fighter',
    icon: '🛩️',
    type: 'military',
    driveType: 'combustion',
    description: 'Fast, cheap attack ship with low hull strength.',
    baseCost: {
      metal: 3000,
      crystal: 1000,
      deuterium: 0
    },
    cargoCapacity: 50,
    fuel: 100,
    speed: 7500, // Units per hour
    attack: 50,
    shield: 10,
    hull: 400,
    populationRequired: 1,
    rapidFire: {
      espionageProbe: 5
    }
  },

  heavyFighter: {
    name: 'Heavy Fighter',
    icon: '🛡️',
    type: 'military',
    driveType: 'impulse',
    description: 'Stronger fighter with better armor and shield.',
    baseCost: {
      metal: 6000,
      crystal: 4000,
      deuterium: 0
    },
    cargoCapacity: 100,
    fuel: 200,
    speed: 6000, // Units per hour
    attack: 150,
    shield: 25,
    hull: 1000,
    populationRequired: 1,
    rapidFire: {
      smallCargo: 3,
      espionageProbe: 5
    }
  },

  // Medium Ships
  cruiser: {
    name: 'Cruiser',
    icon: '🚢',
    type: 'military',
    driveType: 'impulse',
    description: 'Medium combat ship, good against fighters.',
    baseCost: {
      metal: 20000,
      crystal: 7000,
      deuterium: 2000
    },
    cargoCapacity: 800,
    fuel: 500,
    speed: 4000, // Units per hour
    attack: 400,
    shield: 50,
    hull: 2700,
    populationRequired: 15,
    rapidFire: {
      lightFighter: 6,
      espionageProbe: 5,
      rocketLauncher: 10
    }
  },

  bomber: {
    name: 'Bomber',
    icon: '💣',
    type: 'military',
    driveType: 'impulse',
    description: 'Specialized for destroying planetary defenses.',
    baseCost: {
      metal: 50000,
      crystal: 25000,
      deuterium: 15000
    },
    cargoCapacity: 500,
    fuel: 1000,
    speed: 3000, // Units per hour
    attack: 1000,
    shield: 25,
    hull: 7500,
    populationRequired: 20,
    rapidFire: {
      rocketLauncher: 20,
      laserCannon: 20,
      particleBeam: 10,
      ionCannon: 10
    }
  },

  // Heavy Ships
  battleship: {
    name: 'Battleship',
    icon: '⚓',
    type: 'military',
    driveType: 'hyperspace',
    description: 'Heavy combat ship with high damage and durability.',
    baseCost: {
      metal: 45000,
      crystal: 15000,
      deuterium: 0
    },
    cargoCapacity: 1500,
    fuel: 1000,
    speed: 2000, // Units per hour
    attack: 1000,
    shield: 200,
    hull: 6000,
    populationRequired: 60,
    rapidFire: {
      largeCargo: 5,
      cruiser: 3
    }
  },

  destroyer: {
    name: 'Destroyer',
    icon: '⚡',
    type: 'military',
    driveType: 'hyperspace',
    description: 'Anti-capital ship specialized against large vessels.',
    baseCost: {
      metal: 60000,
      crystal: 50000,
      deuterium: 15000
    },
    cargoCapacity: 2000,
    fuel: 1500,
    speed: 3500, // Units per hour
    attack: 2000,
    shield: 500,
    hull: 11000,
    populationRequired: 120,
    rapidFire: {
      battleship: 2,
      lightFighter: 10,
      plasmaTurret: 5,
      espionageProbe: 5
    }
  }
};

/**
 * Get ship data by key
 */
export function getShip(shipKey) {
  return SHIPS[shipKey];
}

/**
 * Get all ships by type
 */
export function getShipsByType(type) {
  const result = {};
  for (const key in SHIPS) {
    const ship = SHIPS[key];
    if (ship.type === type) {
      result[key] = ship;
    }
  }
  return result;
}

/**
 * Calculate ship build cost based on quantity
 */
export function calculateShipCost(shipKey, quantity = 1, costReductionBonus = 0) {
  const ship = getShip(shipKey);
  if (!ship) return null;

  const reduction = 1 - costReductionBonus;
  return {
    metal: Math.floor(ship.baseCost.metal * quantity * reduction),
    crystal: Math.floor(ship.baseCost.crystal * quantity * reduction),
    deuterium: Math.floor(ship.baseCost.deuterium * quantity * reduction)
  };
}

/**
 * Calculate build time for ships
 */
export function calculateShipBuildTime(shipKey, quantity = 1, shipyardLevel = 1, naniteLevel = 0, timeReductionBonus = 0) {
  const ship = getShip(shipKey);
  if (!ship) return 0;

  // Base time related to cost
  const baseTime = calculateBaseTime(ship) * quantity;
  
  // Apply build speed factor (converting cost units to seconds)
  const speedFactor = CONFIG.SHIP_BUILD_SPEED || 2500;
  const timeInSeconds = (baseTime / speedFactor) * 3600;

  // Shipyard level speeds up construction
  const shipyardDef = BUILDINGS.shipyard;
  const shipyardSpeedMultiplier = shipyardDef.speedMultiplier || 0.85;
  const shipyardMultiplier = Math.pow(shipyardSpeedMultiplier, shipyardLevel);

  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;

  const reduction = 1 - timeReductionBonus;
  const totalTime = (timeInSeconds * shipyardMultiplier * reduction) / naniteMultiplier;

  return Math.max(1, Math.floor(totalTime));
}

/**
 * Calculate effective speed for a ship type based on research
 */
export function calculateShipSpeed(shipKey, playerResearch = {}) {
  const ship = getShip(shipKey);
  if (!ship) return 0;

  let bonusKey = '';
  switch (ship.driveType) {
    case 'combustion':
      bonusKey = 'shipCombustionSpeed';
      break;
    case 'impulse':
      bonusKey = 'shipImpulseSpeed';
      break;
    case 'hyperspace':
      bonusKey = 'shipHyperSpeed';
      break;
    default:
      return ship.speed;
  }

  const speedBonus = getResearchBonus(playerResearch, bonusKey);
  return Math.floor(ship.speed * (1 + speedBonus));
}

/**
 * Calculate total combat stats for a fleet
 */
export function calculateFleetStats(ships, weaponsTech = 0, shieldingTech = 0, armorTech = 0, hullBonusTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  // Tech multipliers: data-driven
  const attackBonus = THEORETICAL_RESEARCH.weaponsTech.bonuses.unitAttackPower || 0.2;
  const shieldBonus = THEORETICAL_RESEARCH.shieldingTech.bonuses.unitShieldStrength || 0.2;
  const armorBonus = THEORETICAL_RESEARCH.armorTech.bonuses.unitHullStrength || 0.15;
  const hullBonus = THEORETICAL_RESEARCH.advancedMaterials.bonuses.unitHullBonus || 0.05;

  const attackMultiplier = 1 + (weaponsTech * attackBonus);
  const shieldMultiplier = 1 + (shieldingTech * shieldBonus);
  const armorMultiplier = 1 + (armorTech * armorBonus) + (hullBonusTech * hullBonus);

  for (const shipKey in ships) {
    const count = ships[shipKey];
    if (count <= 0) continue;

    const ship = getShip(shipKey);
    if (!ship) continue;

    totalAttack += ship.attack * count * attackMultiplier;
    totalShield += ship.shield * count * shieldMultiplier;
    totalHull += ship.hull * count * armorMultiplier;
  }

  return {
    attack: Math.floor(totalAttack),
    shield: Math.floor(totalShield),
    hull: Math.floor(totalHull)
  };
}

/**
 * Calculate total cargo capacity
 */
export function calculateCargoCapacity(ships) {
  let totalCapacity = 0;

  for (const shipKey in ships) {
    const count = ships[shipKey];
    const ship = getShip(shipKey);
    if (ship) {
      totalCapacity += ship.cargoCapacity * count;
    }
  }

  return totalCapacity;
}

/**
 * Calculate total crew required for a fleet
 */
export function calculateFleetCrew(ships) {
  let totalCrew = 0;
  for (const shipKey in ships) {
    const count = ships[shipKey];
    const ship = getShip(shipKey);
    if (ship && ship.populationRequired) {
      totalCrew += ship.populationRequired * count;
    }
  }
  return totalCrew;
}

/**
 * Calculate food and water needed for a fleet based on crew and travel time
 * Formula: crew * timeInHours * consumptionRate
 */
export function calculateFleetSurvivalNeeds(crew, travelTimeInSeconds) {
  const hours = travelTimeInSeconds / 3600;
  const foodRate = CONFIG.FOOD_CONSUMPTION_PER_POPULATION || 0.1;
  const waterRate = 0.2; // Standard water consumption
  
  const foodFactor = SCALING.MISSION_FOOD_COST_FACTOR || 1.0;
  const waterFactor = SCALING.MISSION_WATER_COST_FACTOR || 1.0;
  
  return {
    food: Math.ceil(crew * hours * foodRate * foodFactor),
    water: Math.ceil(crew * hours * waterRate * waterFactor)
  };
}

/**
 * Calculate total fleet fuel cost
 */
export function calculateFleetFuelCost(ships, distance) {
  let totalFuelCost = 0;

  for (const shipKey in ships) {
    const count = ships[shipKey];
    const ship = getShip(shipKey);
    if (ship) {
      // Fuel cost per unit per distance
      totalFuelCost += (ship.fuel * count * distance) / 35000; // 35000 is reference distance
    }
  }

  return Math.ceil(totalFuelCost);
}
