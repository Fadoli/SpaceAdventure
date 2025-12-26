// Building definitions and configurations
import { getResourceCostMultiplier, getBuildTimeMultiplier, getResourceProductionMultiplier, getEnergyConsumptionMultiplier, getStorageCapacityMultiplier } from '../server/config.js';

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
  NANITE_FACTORY: 'naniteFactory'
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
    baseTime: 30, // seconds
    maxLevel: 50,
    production: {
      metal: 30 // Base production per hour at level 1
    },
    energyConsumption: 10, // Base energy consumption
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
    baseTime: 30,
    maxLevel: 50,
    production: {
      crystal: 20 // Base production per hour at level 1
    },
    energyConsumption: 10,
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
    baseTime: 45,
    maxLevel: 50,
    production: {
      deuterium: 10 // Base production per hour at level 1
    },
    energyConsumption: 20,
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
    baseTime: 25,
    maxLevel: 50,
    production: {
      energy: 20 // Base energy production at level 1
    },
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
    baseTime: 120,
    maxLevel: 30,
    production: {
      energy: 50 // Base energy production at level 1
    },
    deuteriumConsumption: 10, // Per hour
    requirements: {
      deuteriumSynthesizer: 5,
      energyTech: 3
    }
  },
  
  roboticsFactory: {
    name: 'Robotics Factory',
    icon: '🤖',
    description: 'Produces construction robots that speed up building construction.',
    baseCost: {
      metal: 400,
      crystal: 120,
      deuterium: 200
    },
    baseTime: 60,
    maxLevel: 10,
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
    baseTime: 90,
    maxLevel: 12,
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
    baseTime: 60,
    maxLevel: 12,
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
    baseTime: 20,
    maxLevel: 20,
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
    baseTime: 20,
    maxLevel: 20,
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
    baseTime: 20,
    maxLevel: 20,
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
    baseTime: 3600, // 1 hour
    maxLevel: 5,
    requirements: {
      roboticsFactory: 10,
      computerTech: 10
    }
  }
};

/**
 * Calculate building cost for a specific level
 */
export function getBuildingCost(buildingType, level) {
  const building = BUILDINGS[buildingType];
  if (!building) return null;
  
  const multiplier = Math.pow(1.5, level);
  const costMultiplier = getResourceCostMultiplier();
  
  return {
    metal: Math.floor(building.baseCost.metal * multiplier * costMultiplier),
    crystal: Math.floor(building.baseCost.crystal * multiplier * costMultiplier),
    deuterium: Math.floor(building.baseCost.deuterium * multiplier * costMultiplier)
  };
}

/**
 * Calculate building construction time
 */
export function getBuildTime(buildingType, level, roboticsLevel = 0, naniteLevel = 0) {
  const building = BUILDINGS[buildingType];
  if (!building) return 0;
  
  const baseTime = building.baseTime * Math.pow(1.5, level - 1);
  
  // Robotics factory speeds up construction (5% per level)
  const roboticsMultiplier = 1 + (roboticsLevel * 0.05);
  
  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  
  // Apply config build time multiplier
  const configMultiplier = getBuildTimeMultiplier();
  
  const totalTime = (baseTime / (roboticsMultiplier * naniteMultiplier)) * configMultiplier;
  
  return Math.max(1, Math.floor(totalTime)); // Minimum 1 second
}

/**
 * Calculate production for a building level
 */
export function getProduction(buildingType, level) {
  const building = BUILDINGS[buildingType];
  if (!building || !building.production) return {};
  
  const production = {};
  const productionMultiplier = getResourceProductionMultiplier();
  
  for (const [resource, baseAmount] of Object.entries(building.production)) {
    // Production increases by 1.1^level, then apply config multiplier
    production[resource] = Math.floor(baseAmount * level * Math.pow(1.1, level) * productionMultiplier);
  }
  
  return production;
}

/**
 * Calculate storage capacity increase for a building level
 */
export function getStorageIncrease(buildingType, level) {
  const building = BUILDINGS[buildingType];
  if (!building || !building.storage) return {};
  
  const storage = {};
  const storageMultiplier = getStorageCapacityMultiplier();
  
  for (const [resource, baseAmount] of Object.entries(building.storage)) {
    storage[resource] = Math.floor(baseAmount * Math.pow(1.6, level - 1) * storageMultiplier);
  }
  
  return storage;
}

/**
 * Check if building requirements are met
 */
export function checkRequirements(buildingType, buildings, research = {}) {
  const building = BUILDINGS[buildingType];
  if (!building || !building.requirements) return true;
  
  for (const [requirement, requiredLevel] of Object.entries(building.requirements)) {
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
  
  return Object.entries(building.requirements).map(([req, level]) => {
    const reqBuilding = BUILDINGS[req];
    const name = reqBuilding ? reqBuilding.name : req;
    return { name, level };
  });
}
