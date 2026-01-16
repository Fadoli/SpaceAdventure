// Ship definitions and stats

import { BUILDING_SPEED_MULTIPLIER, CONFIG, SCALING } from './constants.js';
import { calculateBaseTime } from './time.js';
import { getResearchBonus, THEORETICAL_RESEARCH } from './research.js';
import { BUILDINGS } from './buildings.js';
import { calculateFuelConsumption } from './formulas.js';

export const SHIPS = {
  // Civilian Ships
  smallCargo: {
    name: 'SC-12 Logistics Shuttle',
    icon: '📦',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Basic transport ship for small cargo operations.',
    detailedDescription: 'The SC-12 Logistics Shuttle is the workhorse of any developing colony.\n\nDesigned for reliability and ease of maintenance, its simple combustion engines and modular cargo hold make it ideal for transporting resources between nearby planets.\n\nWhile it lacks significant defensive capabilities, its low cost allows for the rapid assembly of a substantial logistics network.',
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
    },
    engineSwaps: [
      { techKey: 'impulseDrive', requiredLevel: 5, driveType: 'impulse', speed: 10000 }
    ]
  },

  largeCargo: {
    name: 'LC-45 Heavy Transporter',
    icon: '📫',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Heavy transport ship for large cargo operations.',
    detailedDescription: 'When an empire grows beyond its home system, the LC-45 Heavy Transporter becomes indispensable.\n\nThis massive vessel features a reinforced hull and advanced stabilization systems to safely carry enormous quantities of raw materials and refined goods.\n\nIts improved combustion array allows it to maintain a steady sub-light speed despite its immense mass, making it the primary choice for deep-space resource distribution and trade routes.',
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
    name: 'Vanguard Colonizer',
    icon: '🏗️',
    type: 'civilian',
    driveType: 'impulse',
    description: 'Colonizes new planets. Single-use, one-way trip.',
    detailedDescription: 'The Vanguard Colonizer is a marvel of engineering, essentially a pre-fabricated planetary outpost equipped with powerful impulse engines. It carries everything necessary to establish a foothold on a new world: modular housing, basic atmospheric scrubbers, and enough supplies to sustain the first wave of pioneers. Upon reaching its destination, the ship disassembles itself to provide the foundation for the new colony\'s initial infrastructure.',
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
    name: 'Harvester-Utility Vessel',
    icon: '♻️',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Collects debris from destroyed ships in battle.',
    detailedDescription: 'The Harvester-Utility Vessel is a specialized industrial vessel equipped with massive tractor beams and high-capacity processing bays. Its primary purpose is to harvest the wreckage of destroyed fleets, reclaiming valuable metal and crystal from the void of space. While slow and vulnerable, a fleet accompanied by recyclers can effectively turn a battlefield into a secondary resource mine, significantly accelerating an empire\'s recovery after a major engagement.',
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
    },
    engineSwaps: [
      { techKey: 'impulseDrive', requiredLevel: 17, driveType: 'impulse', speed: 4000 },
      { techKey: 'hyperspaceDrive', requiredLevel: 15, driveType: 'hyperspace', speed: 6000 }
    ]
  },

  espionageProbe: {
    name: 'Vector-Class Recon Probe',
    icon: '🛸',
    type: 'civilian',
    driveType: 'combustion',
    description: 'Gathers intelligence on target planets.',
    detailedDescription: 'Small, unmanned, and incredibly fast, the Vector-Class Recon Probe is designed to slip past planetary sensors and transmit detailed telemetry back to its origin. Equipped with advanced scanning arrays and high-gain communication arrays, it can reveal everything from resource stockpiles to the exact composition of enemy fleets. However, their light frames and lack of shielding make them easy targets if detected by planetary defense systems.',
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
    name: 'Swift-Strike Fighter',
    icon: '🛩️',
    type: 'military',
    driveType: 'combustion',
    description: 'Fast, cheap attack ship with low hull strength.',
    detailedDescription: 'The Swift-Strike Fighter is the fundamental unit of any space-faring military.\n\nBy prioritizing speed and firepower over armor, it provides a highly mobile and cost-effective solution for escorting cargo fleets or overwhelming slower targets through superior numbers.\n\nWhile a single fighter is easily dispatched, a coordinated swarm can bypass the tracking systems of much larger capital ships.',
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
    name: 'Aegis-Class Fighter',
    icon: '🛡️',
    type: 'military',
    driveType: 'impulse',
    description: 'Stronger fighter with better armor and shield.',
    detailedDescription: 'Representing a significant advancement in small-craft design, the Aegis-Class Fighter incorporates localized shielding and multi-layered alloy plating.\n\nIts impulse drive provides better sub-light maneuverability and high-speed acceleration compared to its lighter counterpart.\n\nDesigned to survive long-duration engagements, the Aegis-Class is the preferred choice for front-line combat and aggressive reconnaissance.',
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
    name: 'Strider-Class Cruiser',
    icon: '🚢',
    type: 'military',
    driveType: 'impulse',
    description: 'Medium combat ship, good against fighters.',
    detailedDescription: 'The Strider-Class Cruiser is a versatile medium-tonnage vessel specialized in anti-fighter operations.\n\nEquipped with advanced tracking computers and rapid-cycle laser arrays, it can engage and neutralize swarms of smaller craft with devastating efficiency.\n\nIts reinforced hull and balanced shielding allow it to serve as a reliable line ship in fleet engagements or as a powerful enforcer for trade lane security.',
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
    name: 'Eclipse Siege Bomber',
    icon: '💣',
    type: 'military',
    driveType: 'impulse',
    description: 'Specialized for destroying planetary defenses.',
    detailedDescription: 'Designed with a single purpose in mind, the Eclipse Siege Bomber carries a massive payload of high-energy ordinance designed to penetrate planetary shield domes and bypass reinforced bunkers.\n\nWhile slower and more specialized than other combat craft, its ability to quickly dismantle static defensive positions makes it an essential component of any successful planetary invasion force.',
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
    },
    engineSwaps: [
      { techKey: 'hyperspaceDrive', requiredLevel: 8, driveType: 'hyperspace', speed: 5000 }
    ]
  },

  // Heavy Ships
  battleship: {
    name: 'Leviathan Battleship',
    icon: '⚓',
    type: 'military',
    driveType: 'hyperspace',
    description: 'Heavy combat ship with high damage and durability.',
    detailedDescription: 'The Leviathan Battleship is the pride of any intergalactic fleet.\n\nThis massive vessel is a mobile fortress, boasting heavy armor plating, extensive shield arrays, and a primary armament capable of vaporizing smaller ships in a single volley.\n\nIts hyperspace drive allows it to project power across entire systems, making it the definitive symbol of an empire\'s military might.',
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
    name: 'Obsidian-Class Destroyer',
    icon: '⚡',
    type: 'military',
    driveType: 'hyperspace',
    description: 'Anti-capital ship specialized against large vessels.',
    detailedDescription: 'The Obsidian-Class Destroyer is an advanced heavy combatant designed to counter the largest capital ships and planetary defense installations.\n\nUtilizing focused antimatter projectors and high-frequency shielding, it can withstand enormous punishment while delivering concentrated damage to critical enemy systems.\n\nIt is often deployed at the vanguard of major offensives to neutralize the enemy\'s most powerful assets.',
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
  },

  carrier: {
    name: 'Nova-Class Stellar Carrier',
    icon: '🚢',
    type: 'military',
    driveType: 'hyperspace',
    description: 'Mobile base capable of deploying and supporting fighter wings.',
    detailedDescription: 'The Nova-Class Stellar Carrier is a specialized heavy vessel that serves as a mobile base of operations. It is equipped with massive automated launch bays and advanced field-repair systems for smaller craft.\n\nWhile its own offensive armament is secondary to its complement of fighters, its ability to project a massive fighter screen makes it the ultimate force multiplier in large-scale fleet engagements.',
    baseCost: {
      metal: 2000000,
      crystal: 1500000,
      deuterium: 500000
    },
    cargoCapacity: 50000,
    fuel: 5000,
    speed: 2500,
    attack: 5000,
    shield: 10000,
    hull: 200000,
    populationRequired: 2000,
    rapidFire: {
      lightFighter: 20,
      heavyFighter: 20,
      espionageProbe: 10
    }
  },

  dreadnought: {
    name: 'Void-Class Dreadnought',
    icon: '🌌',
    type: 'military',
    driveType: 'hyperspace',
    description: 'Ultimate end-game capital ship. Destroys everything in its path.',
    detailedDescription: 'The Void-Class Dreadnought is the pinnacle of naval architecture. More a moon than a ship, it generates a localized singularity to power its main battery, which can penetrate any known shielding.\n\nA single Dreadnought can hold an entire system in terror, its sheer presence being enough to force surrender from lesser civilizations.\n\nBuilding one requires an astronomical amount of resources and the most advanced technological facilities in the galaxy.',
    baseCost: {
      metal: 5000000,
      crystal: 2500000,
      deuterium: 1000000
    },
    cargoCapacity: 100000,
    fuel: 10000,
    speed: 1500,
    attack: 50000,
    shield: 50000,
    hull: 500000,
    populationRequired: 5000,
    rapidFire: {
      battleship: 10,
      destroyer: 5,
      cruiser: 20,
      smallCargo: 50,
      largeCargo: 50,
      lightFighter: 100,
      heavyFighter: 100,
      gaussCannon: 10,
      ionCannon: 20,
      laserCannon: 50
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
 * Get the effective drive type for a ship based on research
 */
export function getEffectiveDriveType(shipKey, playerResearch = {}) {
  const ship = getShip(shipKey);
  if (!ship) return null;

  let driveType = ship.driveType;

  if (ship.engineSwaps) {
    for (const swap of ship.engineSwaps) {
      const techLevel = typeof playerResearch[swap.techKey] === 'object' ? (playerResearch[swap.techKey].level ?? 0) : (playerResearch[swap.techKey] ?? 0);
      if (techLevel >= swap.requiredLevel) {
        driveType = swap.driveType;
      }
    }
  }

  return driveType;
}

/**
 * Calculate effective speed for a ship type based on research
 */
export function calculateShipSpeed(shipKey, playerResearch = {}) {
  const ship = getShip(shipKey);
  if (!ship) return 0;

  const driveType = getEffectiveDriveType(shipKey, playerResearch);
  let baseSpeed = ship.speed;

  // If engine was swapped, use the new base speed
  if (ship.engineSwaps) {
    for (const swap of ship.engineSwaps) {
      const techLevel = typeof playerResearch[swap.techKey] === 'object' ? (playerResearch[swap.techKey].level ?? 0) : (playerResearch[swap.techKey] ?? 0);
      if (techLevel >= swap.requiredLevel) {
        baseSpeed = swap.speed;
      }
    }
  }

  let bonusKey = '';
  switch (driveType) {
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
      return baseSpeed;
  }

  const speedBonus = getResearchBonus(playerResearch, bonusKey);
  return Math.floor(baseSpeed * (1 + speedBonus));
}

/**
 * Calculate total combat stats for a fleet
 */
export function calculateFleetStats(ships, weaponsTech = 0, shieldingTech = 0, armorTech = 0, hullBonusTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  // Tech multipliers: data-driven from THEORETICAL_RESEARCH
  const attackBonus = THEORETICAL_RESEARCH.weaponsTech.bonuses.unitAttackPower || 0.1;
  const shieldBonus = THEORETICAL_RESEARCH.shieldingTech.bonuses.unitShieldStrength || 0.1;
  const armorBonus = THEORETICAL_RESEARCH.armorTech.bonuses.unitHullStrength || 0.1;
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
  return calculateFuelConsumption(distance, ships, SHIPS);
}