// Research system definitions
// Two types of research: Theoretical (unlocks) and Practical (customization)

export const THEORETICAL_RESEARCH = {
  // Energy Technologies
  energyTech: {
    name: 'Energy Technology',
    category: 'Energy',
    icon: '⚡',
    description: 'Improves energy production and efficiency across all buildings.',
    baseCost: {
      metal: 200,
      crystal: 100,
      deuterium: 50
    },
    unlocks: ['fusionReactor', 'energyTech'],
    bonuses: {
      energyProduction: 0.1, // 10% per level
      energyEfficiency: 0.01 // 1% per level
    }
  },

  computerTech: {
    name: 'Computer Technology',
    category: 'Computing',
    icon: '💻',
    description: 'Accelerates research and improves fleet efficiency.',
    baseCost: {
      metal: 400,
      crystal: 600,
      deuterium: 200
    },
    unlocks: ['researchLab', 'weaponsTech', 'shieldingTech'],
    bonuses: {
      researchSpeed: 0.1, // 10% per level
      computerScience: 0.05
    }
  },

  weaponsTech: {
    name: 'Weapons Technology',
    category: 'Military',
    icon: '⚔️',
    description: 'Increases attack power of all units.',
    baseCost: {
      metal: 800,
      crystal: 200,
      deuterium: 100
    },
    prerequisites: ['computerTech'],
    unlocks: ['heavyFighter', 'cruiser', 'battleship'],
    bonuses: {
      attackPower: 0.2 // 20% per level
    }
  },

  shieldingTech: {
    name: 'Shielding Technology',
    category: 'Military',
    icon: '🛡️',
    description: 'Improves shield strength and defense.',
    baseCost: {
      metal: 200,
      crystal: 600,
      deuterium: 0
    },
    prerequisites: ['computerTech'],
    unlocks: ['defenses'],
    bonuses: {
      shieldStrength: 0.2 // 20% per level
    }
  },

  armorTech: {
    name: 'Armor Technology',
    category: 'Military',
    icon: '🔒',
    description: 'Strengthens hull armor of ships.',
    baseCost: {
      metal: 1000,
      crystal: 0,
      deuterium: 500
    },
    unlocks: ['battleship'],
    bonuses: {
      hullStrength: 0.15 // 15% per level
    }
  },

  combustionDrive: {
    name: 'Combustion Drive',
    category: 'Propulsion',
    icon: '🚀',
    description: 'Enables basic spaceship travel.',
    baseCost: {
      metal: 400,
      crystal: 150,
      deuterium: 100
    },
    unlocks: ['smallCargo', 'largeCargo'],
    bonuses: {
      shipSpeed: 0.2 // 20% per level
    }
  },

  impulseDrive: {
    name: 'Impulse Drive',
    category: 'Propulsion',
    icon: '🌠',
    description: 'Faster interplanetary travel.',
    baseCost: {
      metal: 2000,
      crystal: 4000,
      deuterium: 600
    },
    prerequisites: ['combustionDrive'],
    unlocks: ['lightFighter', 'heavyFighter'],
    bonuses: {
      shipSpeed: 0.3 // 30% per level
    }
  },

  hyperspaceDrive: {
    name: 'Hyperspace Drive',
    category: 'Propulsion',
    icon: '🌌',
    description: 'Enables intergalactic travel.',
    baseCost: {
      metal: 10000,
      crystal: 20000,
      deuterium: 6000
    },
    prerequisites: ['impulseDrive', 'computerTech'],
    unlocks: ['cruiser', 'battleship'],
    bonuses: {
      shipSpeed: 0.5 // 50% per level
    }
  },

  espionageTech: {
    name: 'Espionage Technology',
    category: 'Espionage',
    icon: '🕵️',
    description: 'Enables espionage missions and improves intelligence gathering.',
    baseCost: {
      metal: 1000,
      crystal: 1000,
      deuterium: 600
    },
    prerequisites: ['computerTech'],
    unlocks: ['espionageProbe'],
    bonuses: {
      espionageAbility: 0.1 // 10% per level
    }
  },

  astrophysics: {
    name: 'Astrophysics',
    category: 'Science',
    icon: '🔭',
    description: 'Unlocks additional galaxy slots and colony expansion.',
    baseCost: {
      metal: 4000,
      crystal: 8000,
      deuterium: 4000
    },
    prerequisites: ['computerTech'],
    unlocks: ['colonyShip'],
    bonuses: {
      galaxySlots: 1, // Adds 1 galaxy slot per level
      colonistCapacity: 0.2 // 20% more colonists per level
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
    productionMultiplier: 1.02,      // 1.02^level: +2% per focus level
    costMultiplier: 1.01,            // 1.01^level: +1% cost per focus level
    energyMultiplier: 1.015,         // 1.015^level: +1.5% energy per focus level
    populationMultiplier: 1.005      // 1.005^level: +0.5% population (more workers needed for output)
  },
  automation: {
    populationMultiplier: 0.98,      // 0.98^level: -2% workforce per focus level
    costMultiplier: 1.02,            // 1.02^level: +2% cost per focus level (machinery)
    energyMultiplier: 1.025,         // 1.025^level: +2.5% energy per focus level
    productionMultiplier: 0.99       // 0.99^level: -1% production (less efficient)
  },
  energy: {
    energyMultiplier: 0.98,          // 0.98^level: -2% energy consumption per focus level
    costMultiplier: 1.015,           // 1.015^level: +1.5% cost for efficiency tech
    productionMultiplier: 1.005,     // 1.005^level: +0.5% production (better power = better output)
    populationMultiplier: 1.008      // 1.008^level: +0.8% workforce needed for complex tech
  },
  cost: {
    costMultiplier: 0.98,            // 0.98^level: -2% cost per focus level
    productionMultiplier: 0.99,      // 0.99^level: -1% production (simpler = less effective)
    energyMultiplier: 1.002,         // 1.002^level: minimal energy change
    populationMultiplier: 1.001      // 1.001^level: minimal population change
  }
};

const SHIP_MODIFIERS = {
  output: {
    cargoMultiplier: 1.02,           // 1.02^level: +2% capacity per level (or attack for military)
    costMultiplier: 1.01,
    fuelMultiplier: 1.015,
    speedMultiplier: 0.99            // 0.99^level: -1% speed (tradeoff)
  },
  automation: {
    crewRequirement: 0.98,
    costMultiplier: 1.02,
    fuelMultiplier: 1.025,
    cargoMultiplier: 0.99            // or attackMultiplier for military
  },
  energy: {
    fuelMultiplier: 0.98,            // 0.98^level: Better fuel efficiency
    costMultiplier: 1.015,
    speedMultiplier: 1.01,
    cargoMultiplier: 1.005           // or attackMultiplier for military
  },
  cost: {
    costMultiplier: 0.98,
    cargoMultiplier: 0.99,           // or attackMultiplier for military
    fuelMultiplier: 1.002,
    speedMultiplier: 1.001
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
      metal: 100,
      crystal: 50,
      deuterium: 25
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
      metal: 100,
      crystal: 50,
      deuterium: 25
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
      metal: 150,
      crystal: 100,
      deuterium: 50
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
    description: 'Customize small cargo ship through practical research.',
    baseCost: {
      metal: 100,
      crystal: 50,
      deuterium: 25
    },
    maxLevels: 30,
    focusModifiers: SHIP_MODIFIERS
  },

  lightFighter: {
    name: 'Light Fighter Customization',
    baseType: 'lightFighter',
    type: 'ship',
    category: 'Military',
    icon: '🛩️',
    description: 'Customize light fighter ship through practical research.',
    baseCost: {
      metal: 100,
      crystal: 50,
      deuterium: 25
    },
    maxLevels: 30,
    focusModifiers: {
      output: {
        attackMultiplier: 1.02,          // Military variant: attack instead of cargo
        hullMultiplier: 1.015,
        costMultiplier: 1.01,
        speedMultiplier: 0.99
      },
      automation: {
        crewRequirement: 0.98,
        costMultiplier: 1.02,
        fuelMultiplier: 1.025,
        attackMultiplier: 0.99
      },
      energy: {
        fuelMultiplier: 0.98,
        costMultiplier: 1.015,
        speedMultiplier: 1.015,
        attackMultiplier: 1.005
      },
      cost: {
        costMultiplier: 0.98,
        attackMultiplier: 0.99,
        hullMultiplier: 0.99,
        speedMultiplier: 1.001
      }
    }
  }
};

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
export function canResearchTheoretical(techKey, playerResearch) {
  const tech = THEORETICAL_RESEARCH[techKey];
  if (!tech) return false;

  // Check prerequisites
  if (tech.prerequisites && Array.isArray(tech.prerequisites)) {
    return tech.prerequisites.every(prereq =>
      playerResearch[prereq] && playerResearch[prereq] > 0
    );
  }

  return true;
}

/**
 * Get available practical research for a player based on building/ship availability
 */
export function getAvailablePracticalResearch(playerBuildings, playerShips) {
  const available = {};

  // Check which buildings exist
  for (const [key, research] of Object.entries(PRACTICAL_RESEARCH)) {
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
  const research = Object.values(PRACTICAL_RESEARCH).find(
    r => r.baseType === baseType && r.type === type
  );

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
 * Modifiers are base multipliers: 1.02 = 2% per level, 0.98 = 2% reduction per level
 * Result is multiplier - 1: (1.02^level) - 1 = multiplicative bonus
 */
export function calculateFocusModifiers(research, focusLevels) {
  const modifiers = {
    productionMultiplier: 1,
    costMultiplier: 1,
    energyMultiplier: 1,
    populationMultiplier: 1,
    cargoMultiplier: 1,
    fuelMultiplier: 1,
    speedMultiplier: 1,
    attackMultiplier: 1,
    hullMultiplier: 1,
    shieldMultiplier: 1,
    crewRequirement: 1
  };

  // Apply exponential modifiers from each focus
  for (const [focus, level] of Object.entries(focusLevels)) {
    if (level > 0 && research.focusModifiers[focus]) {
      const focusModifiers = research.focusModifiers[focus];
      for (const [stat, baseMultiplier] of Object.entries(focusModifiers)) {
        if (modifiers.hasOwnProperty(stat)) {
          // baseMultiplier is the base (e.g., 1.02 for +2% per level)
          // Result is the multiplicative value: (1.02^level)
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
