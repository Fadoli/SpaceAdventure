// Research system definitions
// Two types of research: Theoretical (unlocks) and Practical (customization)

export const THEORETICAL_RESEARCH = {
  // Energy Technologies
  energyTech: {
    name: 'Energy Technology',
    category: 'Energy',
    icon: '⚡',
    description: 'Improves energy production and efficiency across all buildings.',
    detailedDescription: 'Energy Technology is the cornerstone of all advanced planetary infrastructure. It covers the mastery of high-density power generation, superconducting transmission, and localized grid optimization. As scientists delve deeper into quantum energetics and zero-point fluctuations, they unlock the ability to construct Fusion Reactors, which harness the power of artificial suns. Higher levels of this research not only unlock new energy structures but also improve the efficiency of existing ones, making it easier to power a rapidly growing colony without constant blackouts.',
    baseCost: {
      metal: 200,
      crystal: 100,
      deuterium: 50
    },
    unlocks: ['fusionReactor', 'energyTech'],
    bonuses: {
      buildingEnergyProduction: 0.1, // 10% per level
      buildingEnergyEfficiency: 0.01 // 1% per level
    }
  },

  computerTech: {
    name: 'Computer Technology',
    category: 'Computing',
    icon: '💻',
    description: 'Accelerates research and improves fleet efficiency.',
    detailedDescription: 'From localized AI sub-routines to massive planet-wide neural networks, Computer Technology governs the processing power available to your empire. Advanced computing allows for more efficient management of complex research simulations and the coordination of vast robotic workforces. Strategically, this is one of the most critical technologies to advance early, as its "research speed" bonus applies to every other technological field. It is also a fundamental requirement for advanced defensive systems and the sophisticated navigation computers required for deep-space combat vessels.',
    baseCost: {
      metal: 400,
      crystal: 600,
      deuterium: 200
    },
    unlocks: ['researchLab', 'weaponsTech', 'shieldingTech'],
    bonuses: {
      globalResearchSpeed: 0.1, // 10% per level
      globalFleetCommand: 0.05
    },
    requirements: {
      researchLab: 1
    }
  },

  weaponsTech: {
    name: 'Weapons Technology',
    category: 'Military',
    icon: '⚔️',
    description: 'Increases attack power of all units.',
    detailedDescription: 'In a galaxy full of potential threats, superior firepower is the ultimate deterrent. Weapons Technology encompasses research into high-energy laser focal points, railgun acceleration, and focused antimatter warheads. By refining the destructive potential of your fleet\'s primary armaments, this technology increases the damage output of every ship and planetary defense turret in your arsenal. Commanders who neglect Weapons Tech often find their fleets outmatched by smaller, more specialized forces that hit harder and more precisely.',
    baseCost: {
      metal: 800,
      crystal: 200,
      deuterium: 100
    },
    prerequisites: ['computerTech'],
    unlocks: ['heavyFighter', 'cruiser', 'battleship'],
    bonuses: {
      unitAttackPower: 0.2 // 20% per level
    },
    requirements: {
      researchLab: 4
    }
  },

  shieldingTech: {
    name: 'Shielding Technology',
    category: 'Military',
    icon: '🛡️',
    description: 'Improves shield strength and defense.',
    detailedDescription: 'Shielding Technology focuses on the generation and stabilization of high-frequency gravitic and electromagnetic barriers. These shields are designed to absorb and redistribute the energy from incoming attacks, protecting the underlying hull from damage. As this research progresses, shield generators become more resilient and faster to cycle, significantly increasing the survivability of your ships. High levels of shielding are also required to construct the massive planetary shield domes that can withstand prolonged orbital bombardments.',
    baseCost: {
      metal: 200,
      crystal: 600,
      deuterium: 0
    },
    prerequisites: ['computerTech'],
    unlocks: ['defenses'],
    bonuses: {
      unitShieldStrength: 0.2 // 20% per level
    },
    requirements: {
      researchLab: 6
    }
  },

  armorTech: {
    name: 'Armor Technology',
    category: 'Military',
    icon: '🔒',
    description: 'Strengthens hull armor of ships.',
    detailedDescription: 'When shields fail, only the cold, hard metal of the hull stands between your crew and the vacuum of space. Armor Technology focuses on the development of multi-layered composite alloys and structural reinforcement techniques that can withstand extreme heat and kinetic impacts. This research directly increases the maximum hull integrity of all units, allowing them to remain in the fight long after their counterparts would have been reduced to space dust. It is essential for the construction of massive Battleships and heavily armored planetary bunkers.',
    baseCost: {
      metal: 1000,
      crystal: 0,
      deuterium: 500
    },
    unlocks: ['battleship'],
    bonuses: {
      unitHullStrength: 0.15 // 15% per level
    },
    requirements: {
      researchLab: 2
    }
  },

  combustionDrive: {
    name: 'Combustion Drive',
    category: 'Propulsion',
    icon: '🚀',
    description: 'Enables basic spaceship travel.',
    detailedDescription: 'The fundamental propulsion system for any interstellar civilization. Combustion Drives utilize high-efficiency chemical reactions to generate the massive thrust needed to exit a planet\'s gravity well and travel between nearby celestial bodies. While lacking the sheer speed of advanced fusion or hyperspace drives, the Combustion Drive is reliable, cost-effective, and forms the backbone of early transport and trade fleets. Mastering this tech is the first step toward exploring the stars and establishing your first colonies.',
    baseCost: {
      metal: 400,
      crystal: 150,
      deuterium: 100
    },
    unlocks: ['smallCargo', 'largeCargo'],
    bonuses: {
      shipCombustionSpeed: 0.2 // 20% per level
    },
    requirements: {
      researchLab: 1
    }
  },

  impulseDrive: {
    name: 'Impulse Drive',
    category: 'Propulsion',
    icon: '🌠',
    description: 'Faster interplanetary travel.',
    detailedDescription: 'Impulse Drives represent a significant leap over basic chemical rockets. By utilizing localized fusion reactions to accelerate plasma to relativistic speeds, these drives provide a massive increase in sub-light velocity and maneuverability. Ships equipped with Impulse Drives can cross entire solar systems in a fraction of the time required by combustion-based vessels. This technology is vital for rapid response fleets and is a prerequisite for the construction of agile Light Fighters and more capable combat vessels.',
    baseCost: {
      metal: 2000,
      crystal: 4000,
      deuterium: 600
    },
    prerequisites: ['combustionDrive'],
    unlocks: ['lightFighter', 'heavyFighter'],
    bonuses: {
      shipImpulseSpeed: 0.3 // 30% per level
    },
    requirements: {
      researchLab: 2
    }
  },

  hyperspaceDrive: {
    name: 'Hyperspace Drive',
    category: 'Propulsion',
    icon: '🌌',
    description: 'Enables intergalactic travel.',
    detailedDescription: 'The pinnacle of propulsion technology. Hyperspace Drives function by creating a localized tear in the fabric of space-time, allowing a ship to enter a "sub-space" dimension where the speed of light is not a barrier. This allows for near-instantaneous travel across vast distances that would otherwise take centuries to cross. The Hyperspace Drive is the lifeblood of a sprawling intergalactic empire, enabling the rapid deployment of massive battle-fleets and the efficient coordination of far-flung colonies. It is required for the construction of the most powerful capital ships.',
    baseCost: {
      metal: 10000,
      crystal: 20000,
      deuterium: 6000
    },
    prerequisites: ['impulseDrive', 'computerTech'],
    unlocks: ['cruiser', 'battleship'],
    bonuses: {
      shipHyperSpeed: 0.5 // 50% per level
    },
    requirements: {
      researchLab: 7
    }
  },

  espionageTech: {
    name: 'Espionage Technology',
    category: 'Espionage',
    icon: '🕵️',
    description: 'Enables espionage missions and improves intelligence gathering.',
    detailedDescription: 'In the dark reaches of space, information is often more valuable than gold. Espionage Technology focuses on the development of ultra-sensitive long-range scanners, advanced encryption algorithms, and stealth-coatings for probes. Advancing this tech allows your empire to gain detailed insights into enemy planet infrastructure and fleet movements while simultaneously making your own systems much harder to penetrate. High-level espionage is essential for planning successful attacks and avoiding costly ambushes.',
    baseCost: {
      metal: 1000,
      crystal: 1000,
      deuterium: 600
    },
    prerequisites: ['computerTech'],
    unlocks: ['espionageProbe'],
    bonuses: {
      unitEspionageAbility: 0.1 // 10% per level
    },
    requirements: {
      researchLab: 3
    }
  },

  astrophysics: {
    name: 'Astrophysics',
    category: 'Science',
    icon: '🔭',
    description: 'Unlocks additional galaxy slots and colony expansion.',
    detailedDescription: 'The study of the cosmos and the formation of star systems. Advanced knowledge of Astrophysics is required to identify and exploit habitable worlds across the galaxy. This research directly determines the maximum number of planets your empire can colonize and manage effectively. It also covers the logistical challenges of maintaining distant outposts, ensuring your colonists have the life-support and communications systems needed to survive in the most remote corners of the universe. Every level expands your reach and your influence.',
    baseCost: {
      metal: 4000,
      crystal: 8000,
      deuterium: 4000
    },
    prerequisites: ['computerTech'],
    unlocks: ['colonyShip'],
    bonuses: {
      playerGalaxySlots: 1, // Adds 1 galaxy slot per level
      unitColonistCapacity: 0.2 // 20% more colonists per level
    },
    requirements: {
      researchLab: 3
    }
  },

  resourceEfficiency: {
    name: 'Resource Efficiency',
    category: 'Engineering',
    icon: '♻️',
    description: 'Reduces the construction cost of buildings, defenses, and ships.',
    detailedDescription: 'Resource Efficiency focus on minimizing waste and optimizing the use of raw materials during construction. By implementing advanced recycling protocols and structural optimization algorithms, your engineers can build larger structures and more complex vessels with fewer resources. Each level reduces the Metal, Crystal, and Deuterium cost of all buildings, ships, and defenses by 0.5%.',
    baseCost: {
      metal: 2000,
      crystal: 4000,
      deuterium: 1000
    },
    prerequisites: ['energyTech'],
    bonuses: {
      globalCostReduction: 0.005 // 0.5% per level
    }
  },

  modularConstruction: {
    name: 'Modular Construction',
    category: 'Engineering',
    icon: '🏗️',
    description: 'Reduces the construction time of all structures and units.',
    detailedDescription: 'Modular Construction utilizes standardized structural components and pre-fabricated modules to streamline the assembly process. Instead of building from scratch, your robotics and shipyard crews can simply snap together tested and verified sections. Each level of this research reduces the base time required to build buildings, ships, and defenses by 1%.',
    baseCost: {
      metal: 5000,
      crystal: 2000,
      deuterium: 500
    },
    prerequisites: ['computerTech', 'energyTech'],
    bonuses: {
      globalTimeReduction: 0.01 // 1% per level
    }
  },

  advancedMaterials: {
    name: 'Advanced Materials',
    category: 'Military',
    icon: '💎',
    description: 'Increases the hull integrity of all ships and defenses.',
    detailedDescription: 'Research into carbon-nanotube weaving and self-healing polymers allows for the creation of incredibly resilient hulls. Advanced Materials go beyond simple armor plating, reinforcing the very skeleton of your vessels and defensive structures. Each level of this research increases the base hull strength (HP) of all ships and planetary defenses by 5%.',
    baseCost: {
      metal: 1000,
      crystal: 5000,
      deuterium: 2500
    },
    prerequisites: ['armorTech'],
    bonuses: {
      unitHullBonus: 0.05 // 5% per level
    }
  }
};

/**
 * Practical research focuses - modifiers for customized buildings/ships
 */
export const PRACTICAL_FOCUS_TYPES = {
  OUTPUT: 'output',          // Increases production/efficiency
  AUTOMATION: 'automation',  // Reduces workforce requirement through automation
  ENERGY: 'energy',          // Improves energy efficiency
  COST: 'cost'               // Reduces construction cost
};

/**
 * Shared focus modifier templates for buildings and ships
 */
const PRODUCTION_BUILDING_MODIFIERS = {
  output: {
    productionMultiplier: 1.025,     // 1.025^level: +2.5% per focus level
    costMultiplier: 1.02,            // 1.02^level: +2% cost per focus level
    energyMultiplier: 1.025,         // 1.025^level: +2.5% energy per focus level
    populationMultiplier: 1.01      // 1.01^level: +1% population
  },
  automation: {
    populationMultiplier: 0.975,     // 0.975^level: -2.5% workforce per focus level
    costMultiplier: 1.02,            // 1.02^level: +2% cost per focus level
    energyMultiplier: 1.025,         // 1.025^level: +2.5% energy per focus level
    productionMultiplier: 0.998      // 0.998^level: -0.2% production (reduced penalty)
  },
  energy: {
    energyMultiplier: 0.975,         // 0.975^level: -2.5% energy consumption per focus level
    costMultiplier: 1.015,           // 1.015^level: +1.5% cost
    productionMultiplier: 0.999,      // 1.01^level: -0.1% production
    populationMultiplier: 1.01      // 1.01^level: +1% workforce
  },
  cost: {
    costMultiplier: 0.98,           // 0.98^level: -2% cost per focus level
    productionMultiplier: 0.995,     // 0.995^level: -0.5% production (reduced penalty)
    energyMultiplier: 1.002,         // 1.002^level: minimal energy change
    populationMultiplier: 1.001      // 1.001^level: minimal population change
  }
};

const SHIP_MODIFIERS = {
  output: {
    cargoMultiplier: 1.03,           // +3% capacity
    costMultiplier: 1.01,
    fuelMultiplier: 1.015,
    speedMultiplier: 0.995           // reduced penalty
  },
  automation: {
    crewRequirement: 0.975,          // -2.5%
    costMultiplier: 1.02,
    fuelMultiplier: 1.025,
    cargoMultiplier: 0.998           // reduced penalty
  },
  energy: {
    fuelMultiplier: 0.975,           // -2.5%
    costMultiplier: 1.015,
    speedMultiplier: 1.015,          // +1.5% speed
    cargoMultiplier: 1.01            // +1% capacity
  },
  cost: {
    costMultiplier: 0.975,           // -2.5%
    cargoMultiplier: 0.998,          // reduced penalty
    fuelMultiplier: 1.002,
    speedMultiplier: 1.005
  }
};

const MILITARY_SHIP_MODIFIERS = {
  output: {
    attackMultiplier: 1.03,          // +3%
    hullMultiplier: 1.015,           // +1.5%
    costMultiplier: 1.015,
    speedMultiplier: 0.995           // reduced penalty
  },
  automation: {
    crewRequirement: 0.975,
    costMultiplier: 1.02,
    fuelMultiplier: 1.02,
    attackMultiplier: 0.998          // reduced penalty
  },
  energy: {
    fuelMultiplier: 0.975,
    shieldMultiplier: 1.025,         // +2.5%
    costMultiplier: 1.01,
    speedMultiplier: 1.015           // +1.5%
  },
  cost: {
    costMultiplier: 0.975,
    hullMultiplier: 0.998,           // reduced penalty
    attackMultiplier: 0.998,         // reduced penalty
    speedMultiplier: 1.005
  }
};

const CIVILIAN_SHIP_MODIFIERS = {
  output: {
    cargoCapacityMultiplier: 1.03,   // +3%
    fuelMultiplier: 1.01,
    costMultiplier: 1.01,
    speedMultiplier: 0.995           // reduced penalty
  },
  automation: {
    crewRequirement: 0.975,
    costMultiplier: 1.02,
    fuelMultiplier: 1.025,
    cargoCapacityMultiplier: 0.998   // reduced penalty
  },
  energy: {
    fuelMultiplier: 0.975,
    speedMultiplier: 1.02,           // +2%
    costMultiplier: 1.01,
    cargoCapacityMultiplier: 1.01    // +1%
  },
  cost: {
    costMultiplier: 0.975,
    cargoCapacityMultiplier: 0.998,  // reduced penalty
    fuelMultiplier: 1.002,
    speedMultiplier: 1.005
  }
};

/**
 * Practical research definitions - one per base building/ship type
 * Each tracks which focuses a player has invested in
 */
export const PRACTICAL_RESEARCH = {
  // Building customizations
  metalMine: {
    name: 'Metal Mine Specialization',
    baseType: 'metalMine',
    type: 'building',
    category: 'Mining',
    icon: '⚙️',
    description: 'Customize metal mine extraction through practical research.',
    baseCost: {
      metal: 20,
      crystal: 10,
      deuterium: 5
    },
    maxLevels: 30,
    focusModifiers: PRODUCTION_BUILDING_MODIFIERS
  },

  crystalMine: {
    name: 'Crystal Mine Specialization',
    baseType: 'crystalMine',
    type: 'building',
    category: 'Mining',
    icon: '💎',
    description: 'Customize crystal mine extraction through practical research.',
    baseCost: {
      metal: 20,
      crystal: 10,
      deuterium: 5
    },
    maxLevels: 30,
    focusModifiers: PRODUCTION_BUILDING_MODIFIERS
  },

  deuteriumSynthesizer: {
    name: 'Deuterium Synthesizer Specialization',
    baseType: 'deuteriumSynthesizer',
    type: 'building',
    category: 'Mining',
    icon: '🛢️',
    description: 'Customize deuterium synthesizer extraction through practical research.',
    baseCost: {
      metal: 30,
      crystal: 20,
      deuterium: 10
    },
    maxLevels: 30,
    focusModifiers: PRODUCTION_BUILDING_MODIFIERS
  },

  solarPlant: {
    name: 'Solar Plant Enhancement',
    baseType: 'solarPlant',
    type: 'building',
    category: 'Energy',
    icon: '☀️',
    description: 'Customize solar energy production through practical research.',
    baseCost: {
      metal: 30,
      crystal: 20,
      deuterium: 10
    },
    maxLevels: 30,
    focusModifiers: PRODUCTION_BUILDING_MODIFIERS
  },

  // Ship customizations
  smallCargo: {
    name: 'Small Cargo Customization',
    baseType: 'smallCargo',
    type: 'ship',
    category: 'Civilian',
    icon: '📦',
    description: 'Optimize small cargo ship logistics and efficiency.',
    baseCost: {
      metal: 20,
      crystal: 10,
      deuterium: 5
    },
    maxLevels: 30,
    focusModifiers: CIVILIAN_SHIP_MODIFIERS
  },

  lightFighter: {
    name: 'Light Fighter Customization',
    baseType: 'lightFighter',
    type: 'ship',
    category: 'Military',
    icon: '🛩️',
    description: 'Enhance light fighter combat performance.',
    baseCost: {
      metal: 20,
      crystal: 10,
      deuterium: 5
    },
    maxLevels: 30,
    focusModifiers: MILITARY_SHIP_MODIFIERS
  }
};

/**
 * Calculate total bonus from all researched technologies for a given bonus type
 * @param {Object} playerResearch - Player's research levels { techKey: level }
 * @param {string} bonusKey - The bonus type to sum (e.g., 'costReduction', 'timeReduction')
 */
export function getResearchBonus(playerResearch, bonusKey) {
  if (!playerResearch) return 0;
  
  let totalBonus = 0;
  for (const techKey in playerResearch) {
    const techLevel = playerResearch[techKey];
    // Handle both old structure (number) and new structure (object with level)
    const level = typeof techLevel === 'object' ? (techLevel.level ?? 0) : (techLevel ?? 0);
    
    const tech = THEORETICAL_RESEARCH[techKey];
    if (tech && tech.bonuses && tech.bonuses[bonusKey]) {
      totalBonus += level * tech.bonuses[bonusKey];
    }
  }
  return totalBonus;
}

/**
 * Get all theoretical research techs
 */
export function getTheoreticalResearch() {
  return THEORETICAL_RESEARCH;
}

/**
 * Get all practical research options
 */
export function getPracticalResearch() {
  return PRACTICAL_RESEARCH;
}

/**
 * Check if a theoretical technology is available based on prerequisites
 */
export function canResearchTheoretical(techKey, playerResearch, planetBuildings = {}) {
  const tech = THEORETICAL_RESEARCH[techKey];
  if (!tech) return false;

  // Check prerequisites (other research)
  if (tech.prerequisites && Array.isArray(tech.prerequisites)) {
    const met = tech.prerequisites.every(prereq => {
      const researchEntry = playerResearch[prereq];
      const level = typeof researchEntry === 'object' ? (researchEntry.level ?? 0) : (researchEntry ?? 0);
      return level > 0;
    });
    if (!met) return false;
  }

  // Check building requirements
  if (tech.requirements) {
    for (const building in tech.requirements) {
      const requiredLevel = tech.requirements[building];
      if ((planetBuildings[building] || 0) < requiredLevel) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Get available practical research for a player based on building/ship availability
 */
export function getAvailablePracticalResearch(playerBuildings, playerShips) {
  const available = {};

  // Check which buildings exist
  for (const key in PRACTICAL_RESEARCH) {
    const research = PRACTICAL_RESEARCH[key];
    if (research.type === 'building' && playerBuildings[research.baseType]) {
      available[key] = research;
    } else if (research.type === 'ship' && playerShips[research.baseType]) {
      available[key] = research;
    }
  }

  return available;
}

/**
 * Get a custom variant of a building/ship based on practical research focus
 * Returns modified stats based on the focus levels
 */
export function getCustomVariant(baseType, type, focusLevels) {
  // focusLevels = { output: 5, automation: 3, energy: 2, cost: 0 }
  let research = null;
  for (const key in PRACTICAL_RESEARCH) {
    const r = PRACTICAL_RESEARCH[key];
    if (r.baseType === baseType && r.type === type) {
      research = r;
      break;
    }
  }

  if (!research) return null;

  return {
    baseType,
    type,
    focusLevels,
    modifiers: calculateFocusModifiers(research, focusLevels)
  };
}

/**
 * Calculate the aggregated modifiers from all focus levels using exponential scaling
 * Result is multiplier: (baseMultiplier^level)
 */
export function calculateFocusModifiers(research, focusLevels) {
  const modifiers = {
    productionMultiplier: 1,
    costMultiplier: 1,
    energyMultiplier: 1,
    populationMultiplier: 1,
    cargoCapacityMultiplier: 1,
    fuelMultiplier: 1,
    speedMultiplier: 1,
    attackMultiplier: 1,
    hullMultiplier: 1,
    shieldMultiplier: 1,
    cargoMultiplier: 1,
    crewRequirement: 1
  };

  // Apply exponential modifiers from each focus
  for (const focus in focusLevels) {
    const level = focusLevels[focus];
    
    if (level > 0 && research.focusModifiers[focus]) {
      const focusModifiers = research.focusModifiers[focus];
      for (const stat in focusModifiers) {
        const baseMultiplier = focusModifiers[stat];
        if (modifiers.hasOwnProperty(stat)) {
          const multipliedValue = Math.pow(baseMultiplier, level);
          modifiers[stat] *= multipliedValue;
        }
      }
    }
  }

  return modifiers;
}

/**
 * Apply practical research modifiers to a building/ship definition
 */
export function applyCustomization(baseDefinition, modifiers) {
  // Deep clone the definition to avoid modifying the original constants
  const customized = JSON.parse(JSON.stringify(baseDefinition));

  // Apply production modifier
  if (modifiers.productionMultiplier !== 1 && customized.production) {
    for (const resource in customized.production) {
      customized.production[resource] *= modifiers.productionMultiplier;
    }
  }

  // Apply cost modifier
  if (modifiers.costMultiplier !== 1 && customized.baseCost) {
    for (const resource in customized.baseCost) {
      customized.baseCost[resource] *= modifiers.costMultiplier;
    }
  }

  // Apply energy modifier
  if (modifiers.energyMultiplier !== 1 && customized.energyConsumption !== undefined) {
    customized.energyConsumption *= modifiers.energyMultiplier;
  }

  // Apply population modifier
  if (modifiers.populationMultiplier !== 1 && customized.populationRequired !== undefined) {
    customized.populationRequired *= modifiers.populationMultiplier;
  }

  // Apply ship-specific modifiers
  if (modifiers.cargoMultiplier !== 1 && customized.cargoCapacity !== undefined) {
    customized.cargoCapacity *= modifiers.cargoMultiplier;
  }

  if (modifiers.fuelMultiplier !== 1 && customized.fuel !== undefined) {
    customized.fuel *= modifiers.fuelMultiplier;
  }

  if (modifiers.speedMultiplier !== 1 && customized.speed !== undefined) {
    customized.speed *= modifiers.speedMultiplier;
  }

  if (modifiers.attackMultiplier !== 1 && customized.attack !== undefined) {
    customized.attack *= modifiers.attackMultiplier;
  }

  if (modifiers.hullMultiplier !== 1 && customized.hull !== undefined) {
    customized.hull *= modifiers.hullMultiplier;
  }

  if (modifiers.shieldMultiplier !== 1 && customized.shield !== undefined) {
    customized.shield *= modifiers.shieldMultiplier;
  }

  return customized;
}
