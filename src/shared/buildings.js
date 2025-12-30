// Building definitions and configurations

export const BUILDING_TYPES = {
  METAL_MINE: 'metalMine',
  CRYSTAL_MINE: 'crystalMine',
  DEUTERIUM_SYNTHESIZER: 'deuteriumSynthesizer',
  SOLAR_PLANT: 'solarPlant',
  FUSION_REACTOR: 'fusionReactor',
  ROBOTICS_FACTORY: 'roboticsFactory',
  SHIPYARD: 'shipyard',
  RESEARCH_LAB: 'researchLab',
  METAL_STORAGE: 'metalStorage',
  CRYSTAL_STORAGE: 'crystalStorage',
  DEUTERIUM_TANK: 'deuteriumTank',
  NANITE_FACTORY: 'naniteFactory',
  WATER_EXTRACTOR: 'waterExtractor',
  FARM: 'farm',
  HOUSING: 'housing',
  WATER_STORAGE: 'waterStorage',
  FOOD_SILO: 'foodSilo'
};

// Building definitions
export const BUILDINGS = {
  metalMine: {
    name: 'Metal Mine',
    icon: '⚙️',
    description: 'Extracts metal from the planet. Each level increases production.',
    baseCost: {
      metal: 60,
      crystal: 15,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      metal: 30 // Base production per hour at level 1
    },
    energyConsumption: 10, // Base energy consumption
    populationRequired: 3, // Base population requirement
    requirements: {}
  },
  
  crystalMine: {
    name: 'Crystal Mine',
    icon: '💎',
    description: 'Mines crystal from the planet. Each level increases production.',
    baseCost: {
      metal: 48,
      crystal: 24,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      crystal: 20 // Base production per hour at level 1
    },
    energyConsumption: 10,
    populationRequired: 3, // Base population requirement
    requirements: {}
  },
  
  deuteriumSynthesizer: {
    name: 'Deuterium Synthesizer',
    icon: '🛢️',
    description: 'Synthesizes deuterium from heavy water. Each level increases production.',
    baseCost: {
      metal: 225,
      crystal: 75,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      deuterium: 10 // Base production per hour at level 1
    },
    energyConsumption: 15, // Reduced from 20 to 15 for better early-game viability
    populationRequired: 4, // Base population requirement
    requirements: {}
  },
  
  solarPlant: {
    name: 'Solar Plant',
    icon: '⚡',
    description: 'Provides energy through solar panels. Required to power other buildings.',
    baseCost: {
      metal: 75,
      crystal: 30,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      energy: 20 // Base energy production at level 1
    },
    populationRequired: 2, // Population required to maintain
    requirements: {}
  },
  
  fusionReactor: {
    name: 'Fusion Reactor',
    icon: '⚛️',
    description: 'Advanced energy production through nuclear fusion. Consumes deuterium.',
    baseCost: {
      metal: 900,
      crystal: 360,
      deuterium: 180
    },
    maxLevel: 50,
    production: {
      energy: 50 // Base energy production at level 1
    },
    deuteriumConsumption: 5, // Reduced from 10 to 5 for early levels, can scale with level
    requirements: {
      deuteriumSynthesizer: 5,
      energyTech: 3
    }
  },
  
  roboticsFactory: {
    name: 'Robotics Factory',
    icon: '🤖',
    description: 'Produces construction robots that speed up building construction. Each level reduces construction time by 20%.',
    baseCost: {
      metal: 400,
      crystal: 120,
      deuterium: 200
    },
    maxLevel: 50,
    energyConsumption: 25, // Energy required to operate
    populationRequired: 30, // Reduced from 50 to 30 for better balance
    requirements: {}
  },
  
  shipyard: {
    name: 'Shipyard',
    icon: '🚀',
    description: 'Constructs ships and defenses for your empire.',
    baseCost: {
      metal: 400,
      crystal: 200,
      deuterium: 100
    },
    maxLevel: 50,
    requirements: {
      roboticsFactory: 2
    }
  },
  
  researchLab: {
    name: 'Research Lab',
    icon: '🔬',
    description: 'Enables research of new technologies. Higher levels unlock advanced research.',
    baseCost: {
      metal: 200,
      crystal: 400,
      deuterium: 200
    },
    maxLevel: 50,
    energyConsumption: 15, // Energy required to operate
    populationRequired: 30, // Population required to maintain
    requirements: {}
  },
  
  metalStorage: {
    name: 'Metal Storage',
    icon: '📦',
    description: 'Increases metal storage capacity.',
    baseCost: {
      metal: 1000,
      crystal: 0,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      metal: 5000 // Additional storage per level
    },
    requirements: {}
  },
  
  crystalStorage: {
    name: 'Crystal Storage',
    icon: '📦',
    description: 'Increases crystal storage capacity.',
    baseCost: {
      metal: 1000,
      crystal: 500,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      crystal: 5000 // Additional storage per level
    },
    requirements: {}
  },
  
  deuteriumTank: {
    name: 'Deuterium Tank',
    icon: '🛢️',
    description: 'Increases deuterium storage capacity.',
    baseCost: {
      metal: 1000,
      crystal: 1000,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      deuterium: 5000 // Additional storage per level
    },
    requirements: {}
  },
  
  naniteFactory: {
    name: 'Nanite Factory',
    icon: '🔧',
    description: 'Produces nanomachines that dramatically speed up construction.',
    baseCost: {
      metal: 1000000,
      crystal: 500000,
      deuterium: 100000
    },
    maxLevel: 50,
    requirements: {
      roboticsFactory: 10,
      computerTech: 10
    }
  },
  
  waterExtractor: {
    name: 'Water Extractor',
    icon: '💦',
    description: 'Extracts water from the planet. More effective on planets farther from the sun.',
    baseCost: {
      metal: 50,
      crystal: 25,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      water: 40 // Base production per hour at level 1
    },
    energyConsumption: 8,
    populationRequired: 5, // Base population requirement
    requirements: {}
  },
  
  farm: {
    name: 'Farm',
    icon: '🍞',
    description: 'Grows food for your population. Requires water. More effective closer to the sun.',
    baseCost: {
      metal: 40,
      crystal: 10,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      food: 30 // Base production per hour at level 1
    },
    waterConsumption: 10, // Water consumed per hour
    energyConsumption: 5,
    populationRequired: 8, // Base population requirement
    requirements: {
      waterExtractor: 1
    }
  },
  
  housing: {
    name: 'Housing',
    icon: '🏘️',
    description: 'Provides housing for population. Each level houses more people.',
    baseCost: {
      metal: 30,
      crystal: 20,
      deuterium: 0
    },
    maxLevel: 50,
    housingCapacity: 10, // Base population capacity per level
    energyConsumption: 3,
    requirements: {}
  },
  
  waterStorage: {
    name: 'Water Storage',
    icon: '💦',
    description: 'Increases water storage capacity.',
    baseCost: {
      metal: 800,
      crystal: 400,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      water: 5000 // Additional storage per level
    },
    requirements: {
      waterExtractor: 1
    }
  },
  
  foodSilo: {
    name: 'Food Silo',
    icon: '🍞',
    description: 'Increases food storage capacity.',
    baseCost: {
      metal: 600,
      crystal: 300,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      food: 5000 // Additional storage per level
    },
    requirements: {
      farm: 1
    }
  }
};

/**
 * Check if building requirements are met
 */
export function checkRequirements(buildingType, buildings, research = {}) {
  const building = BUILDINGS[buildingType];
  if (!building || !building.requirements) return true;
  
  for (const requirement in building.requirements) {
    const requiredLevel = building.requirements[requirement];
    // Check if it's a building requirement
    if (buildings[requirement] !== undefined) {
      if ((buildings[requirement] || 0) < requiredLevel) {
        return false;
      }
    }
    // Check if it's a research requirement
    else if (research[requirement] !== undefined) {
      if ((research[requirement] || 0) < requiredLevel) {
        return false;
      }
    }
  }
  
  return true;
}

/**
 * Get all requirements for a building as a readable list
 */
export function getRequirementsList(buildingType) {
  const building = BUILDINGS[buildingType];
  if (!building || !building.requirements) return [];
  
  const results = [];
  for (const req in building.requirements) {
    const level = building.requirements[req];
    const reqBuilding = BUILDINGS[req];
    const name = reqBuilding ? reqBuilding.name : req;
    results.push({ name, level });
  }
  return results;
}
