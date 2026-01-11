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
    detailedDescription: 'The Metal Mine uses advanced drilling and excavation technology to extract raw ores from the planet\'s crust. As the mine deepens, higher concentrations of metal are found, significantly increasing the yield per hour. Higher levels require more power and population to operate the massive heavy machinery.',
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
    detailedDescription: 'Crystal is a vital resource used in high-tech electronics and specialized building components. The Crystal Mine utilizes precision laser cutting and sound-wave resonance to harvest these fragile formations without damage. Deeper levels allow for more specialized extraction techniques.',
    baseCost: {
      metal: 50,
      crystal: 25,
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
    detailedDescription: 'Deuterium is a rare isotope of hydrogen, essential for fueling advanced fusion reactors and starships. The Synthesizer extracts it from heavy water through a complex electrolysis and centrifugation process. This building is highly energy-intensive but crucial for late-game expansion.',
    baseCost: {
      metal: 200,
      crystal: 65,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      deuterium: 10 // Base production per hour at level 1
    },
    energyConsumption: 20, // Increased to add more energy pressure for deuterium
    populationRequired: 4, // Base population requirement
    requirements: {}
  },
  
  solarPlant: {
    name: 'Solar Plant',
    icon: '⚡',
    description: 'Provides energy through solar panels. Required to power other buildings.',
    detailedDescription: 'The primary source of clean energy for any new colony. Solar Plants use vast arrays of high-efficiency photovoltaic cells to convert stellar radiation into electricity. Effectiveness varies depending on the distance from the sun, but it remains the most reliable early-game energy source.',
    baseCost: {
      metal: 80,
      crystal: 35,
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
    detailedDescription: 'The pinnacle of energy technology. Fusion Reactors simulate the core of a star, fusing deuterium atoms to release massive amounts of energy. While expensive to build and maintain, they provide far more power than solar plants and become more efficient with Energy Technology research.',
    baseCost: {
      metal: 1000,
      crystal: 400,
      deuterium: 200
    },
    maxLevel: 50,
    production: {
      energy: 80 // Increased to make it more attractive vs Solar Plant later on
    },
    deuteriumConsumption: 8, // Increased consumption to balance higher energy output
    requirements: {
      deuteriumSynthesizer: 5,
      energyTech: 3
    }
  },
  
  roboticsFactory: {
    name: 'Robotics Factory',
    icon: '🤖',
    description: 'Produces construction robots that speed up building construction. Each level reduces construction time by 20%.',
    detailedDescription: 'The Robotics Factory produces and maintains a fleet of automated construction drones. These machines work tirelessly, far exceeding human labor in precision and speed. Each upgrade increases the number and efficiency of drones, significantly reducing the time required for all planetary construction projects.',
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
    detailedDescription: 'The planetary Shipyard is capable of assembling everything from tiny espionage probes to massive battleships. It contains dry-docks and automated assembly lines for rapid hull construction. Higher levels unlock more advanced ship designs and improve overall production speed.',
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
    detailedDescription: 'Scientific advancement is the key to dominating the galaxy. The Research Lab provides the facilities and supercomputing power needed to develop new technologies. Upgrading the lab unlocks advanced theoretical research and improves the speed at which scientists can make breakthroughs.',
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
    detailedDescription: 'Massive silo complexes designed to store raw metal ores and refined ingots. Without adequate storage, excess production will be lost once local depots are full. Upgrading storage is essential for accumulating the resources needed for expensive high-tier projects.',
    baseCost: {
      metal: 2000,
      crystal: 0,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      metal: 15000 // Additional storage per level
    },
    requirements: {}
  },
  
  crystalStorage: {
    name: 'Crystal Storage',
    icon: '📦',
    description: 'Increases crystal storage capacity.',
    detailedDescription: 'Climate-controlled environments designed to prevent the degradation of harvested crystals. Essential for maintaining large stockpiles of this high-tech component. Each upgrade increases the capacity by 15,000 units.',
    baseCost: {
      metal: 2000,
      crystal: 1000,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      crystal: 15000 // Additional storage per level
    },
    requirements: {}
  },
  
  deuteriumTank: {
    name: 'Deuterium Tank',
    icon: '🛢️',
    description: 'Increases deuterium storage capacity.',
    detailedDescription: 'Pressure-shielded cryogenic tanks for the safe storage of Deuterium fuel. Due to its volatile nature, specialized containment is required to store large quantities. Vital for maintaining a deep-space fleet.',
    baseCost: {
      metal: 2000,
      crystal: 2000,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      deuterium: 15000 // Additional storage per level
    },
    requirements: {}
  },
  
  naniteFactory: {
    name: 'Nanite Factory',
    icon: '🔧',
    description: 'Produces nanomachines that dramatically speed up construction.',
    detailedDescription: 'The ultimate construction facility. This building produces billions of microscopic nanites capable of assembling structures atom by atom. The Nanite Factory provides a massive multiplicative boost to construction and production speeds, dwarfing the bonuses of the Robotics Factory.',
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
    detailedDescription: 'Water is the biological lifeblood of any colony. The Water Extractor harvests moisture from the atmosphere and deep aquifers. Planets farther from the star tend to have higher moisture levels, making these buildings significantly more productive in outer orbits.',
    baseCost: {
      metal: 50,
      crystal: 25,
      deuterium: 0
    },
    maxLevel: 50,
    production: {
      water: 40 // Base production per hour at level 1
    },
    energyConsumption: 10, // Increased to align with basic mines
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
    energyConsumption: 8, // Increased energy consumption
    populationRequired: 8, // Base population requirement
    requirements: {
      waterExtractor: 1
    }
  },
  
  housing: {
    name: 'Housing',
    icon: '🏘️',
    description: 'Provides housing for population. Each level houses more people.',
    detailedDescription: 'Residential complexes for your colonists. Population growth is limited by the amount of available housing. High-level housing uses vertical construction and life-support systems to support thousands of workers per level.',
    baseCost: {
      metal: 30,
      crystal: 20,
      deuterium: 0
    },
    maxLevel: 50,
    housingCapacity: 150,
    energyConsumption: 3,
    requirements: {}
  },
  
  waterStorage: {
    name: 'Water Storage',
    icon: '💦',
    description: 'Increases water storage capacity.',
    detailedDescription: 'Massive underground reservoirs designed to store millions of liters of purified water. Critical for sustaining population growth during potential extraction shortfalls.',
    baseCost: {
      metal: 2000,
      crystal: 1000,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      water: 15000 // Additional storage per level
    },
    requirements: {
      waterExtractor: 1
    }
  },
  
  foodSilo: {
    name: 'Food Silo',
    icon: '🍞',
    description: 'Increases food storage capacity.',
    detailedDescription: 'Automated silos that maintain the freshness of planetary food supplies. Adequate food storage prevents population decay and provides a buffer for rapid expansion.',
    baseCost: {
      metal: 2000,
      crystal: 1000,
      deuterium: 0
    },
    maxLevel: 50,
    storage: {
      food: 15000 // Additional storage per level
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
