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
    baseTime: 1800, // seconds
    unlocks: ['fusionReactor', 'energyTech'],
    bonuses: {
      energyProduction: 0.1, // 10% per level
      energyEfficiency: 0.05 // 5% per level
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
    baseTime: 2400,
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
    baseTime: 2400,
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
    baseTime: 2400,
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
    baseTime: 2400,
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
    baseTime: 1800,
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
    baseTime: 3600,
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
    baseTime: 7200,
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
    baseTime: 3600,
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
    baseTime: 5400,
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
  MANPOWER: 'manpower',      // Reduces workforce requirement
  ENERGY: 'energy',          // Improves energy efficiency
  COST: 'cost'               // Reduces construction cost
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
    baseTime: 900,
    maxLevels: 30,
    focusModifiers: {
      output: {
        productionMultiplier: 0.15,      // +15% per focus level
        costMultiplier: 0.05,            // +5% cost per focus level
        energyMultiplier: 0.08,          // +8% energy per focus level
        populationMultiplier: -0.03      // -3% population requirement (improvement)
      },
      manpower: {
        populationMultiplier: -0.15,     // -15% workforce per focus level
        costMultiplier: 0.12,            // +12% cost per focus level (machinery)
        energyMultiplier: 0.15,          // +15% energy per focus level
        productionMultiplier: -0.05      // -5% production (less efficient)
      },
      energy: {
        energyMultiplier: -0.15,         // -15% energy consumption per focus level
        costMultiplier: 0.08,            // +8% cost for efficiency tech
        productionMultiplier: 0.02,      // +2% production (better power = better output)
        populationMultiplier: 0.05       // +5% workforce needed for complex tech
      },
      cost: {
        costMultiplier: -0.12,           // -12% cost per focus level
        productionMultiplier: -0.08,     // -8% production (simpler = less effective)
        energyMultiplier: 0.05,          // +5% energy (older tech less efficient)
        populationMultiplier: 0.03       // +3% workforce (lower tech needs more workers)
      }
    }
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
    baseTime: 900,
    maxLevels: 30,
    focusModifiers: {
      output: {
        productionMultiplier: 0.15,
        costMultiplier: 0.05,
        energyMultiplier: 0.08,
        populationMultiplier: -0.03
      },
      manpower: {
        populationMultiplier: -0.15,
        costMultiplier: 0.12,
        energyMultiplier: 0.15,
        productionMultiplier: -0.05
      },
      energy: {
        energyMultiplier: -0.15,
        costMultiplier: 0.08,
        productionMultiplier: 0.02,
        populationMultiplier: 0.05
      },
      cost: {
        costMultiplier: -0.12,
        productionMultiplier: -0.08,
        energyMultiplier: 0.05,
        populationMultiplier: 0.03
      }
    }
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
    baseTime: 900,
    maxLevels: 30,
    focusModifiers: {
      output: {
        productionMultiplier: 0.15,
        costMultiplier: 0.05,
        energyMultiplier: 0.03,
        populationMultiplier: -0.02
      },
      manpower: {
        populationMultiplier: -0.12,
        costMultiplier: 0.1,
        energyMultiplier: 0.08,
        productionMultiplier: -0.03
      },
      energy: {
        energyMultiplier: -0.2,          // Energy production itself
        costMultiplier: 0.1,
        productionMultiplier: 0.05,
        populationMultiplier: 0.04
      },
      cost: {
        costMultiplier: -0.15,
        productionMultiplier: -0.05,
        energyMultiplier: 0.03,
        populationMultiplier: 0.02
      }
    }
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
    baseTime: 900,
    maxLevels: 30,
    focusModifiers: {
      output: {
        cargoMultiplier: 0.15,           // +15% cargo capacity
        costMultiplier: 0.08,
        fuelMultiplier: 0.1,
        speedMultiplier: -0.05           // -5% speed
      },
      manpower: {
        crewRequirement: -0.15,          // Not applicable to ships in same way
        costMultiplier: 0.12,
        fuelMultiplier: 0.15,
        cargoMultiplier: -0.05
      },
      energy: {
        fuelMultiplier: -0.15,           // Better fuel efficiency
        costMultiplier: 0.1,
        speedMultiplier: 0.05,
        cargoMultiplier: 0.02
      },
      cost: {
        costMultiplier: -0.15,
        cargoMultiplier: -0.08,
        fuelMultiplier: 0.05,
        speedMultiplier: 0.03
      }
    }
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
    baseTime: 900,
    maxLevels: 30,
    focusModifiers: {
      output: {
        attackMultiplier: 0.15,          // +15% attack power
        hullMultiplier: 0.1,
        costMultiplier: 0.08,
        speedMultiplier: -0.08
      },
      manpower: {
        crewRequirement: -0.1,
        costMultiplier: 0.1,
        fuelMultiplier: 0.12,
        attackMultiplier: -0.05
      },
      energy: {
        fuelMultiplier: -0.12,
        costMultiplier: 0.1,
        speedMultiplier: 0.08,
        attackMultiplier: 0.03
      },
      cost: {
        costMultiplier: -0.12,
        attackMultiplier: -0.06,
        hullMultiplier: -0.05,
        speedMultiplier: 0.04
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
  // focusLevels = { output: 5, manpower: 3, energy: 2, cost: 0 }
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
 * Calculate the aggregated modifiers from all focus levels
 */
export function calculateFocusModifiers(research, focusLevels) {
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
    shieldMultiplier: 0,
    crewRequirement: 0
  };
  
  // Sum modifiers from each focus
  for (const [focus, level] of Object.entries(focusLevels)) {
    if (level > 0 && research.focusModifiers[focus]) {
      const focusModifiers = research.focusModifiers[focus];
      for (const [stat, modifier] of Object.entries(focusModifiers)) {
        if (modifiers.hasOwnProperty(stat)) {
          modifiers[stat] += modifier * level;
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
  const customized = { ...baseDefinition };
  
  // Apply production modifier
  if (modifiers.productionMultiplier !== 0 && customized.production) {
    for (const resource in customized.production) {
      customized.production[resource] *= (1 + modifiers.productionMultiplier);
    }
  }
  
  // Apply cost modifier
  if (modifiers.costMultiplier !== 0 && customized.baseCost) {
    for (const resource in customized.baseCost) {
      customized.baseCost[resource] *= (1 + modifiers.costMultiplier);
    }
  }
  
  // Apply energy modifier
  if (modifiers.energyMultiplier !== 0 && customized.energyConsumption !== undefined) {
    customized.energyConsumption *= (1 + modifiers.energyMultiplier);
  }
  
  // Apply population modifier
  if (modifiers.populationMultiplier !== 0 && customized.populationRequired !== undefined) {
    customized.populationRequired *= (1 + modifiers.populationMultiplier);
  }
  
  // Apply ship-specific modifiers
  if (modifiers.cargoMultiplier !== 0 && customized.cargoCapacity !== undefined) {
    customized.cargoCapacity *= (1 + modifiers.cargoMultiplier);
  }
  
  if (modifiers.fuelMultiplier !== 0 && customized.fuel !== undefined) {
    customized.fuel *= (1 + modifiers.fuelMultiplier);
  }
  
  if (modifiers.speedMultiplier !== 0 && customized.speed !== undefined) {
    customized.speed *= (1 + modifiers.speedMultiplier);
  }
  
  if (modifiers.attackMultiplier !== 0 && customized.attack !== undefined) {
    customized.attack *= (1 + modifiers.attackMultiplier);
  }
  
  if (modifiers.hullMultiplier !== 0 && customized.hull !== undefined) {
    customized.hull *= (1 + modifiers.hullMultiplier);
  }
  
  if (modifiers.shieldMultiplier !== 0 && customized.shield !== undefined) {
    customized.shield *= (1 + modifiers.shieldMultiplier);
  }
  
  return customized;
}
