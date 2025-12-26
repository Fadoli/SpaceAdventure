// Building upgrade and management logic
import { 
  BUILDINGS,
  checkRequirements
} from '../../shared/buildings.js';
import { getPlayerByUserId, updatePlayer } from './player.js';
import { 
  getBuildQueueSize, 
  getResourceProductionMultiplier,
  getResourceCostMultiplier,
  getBuildTimeMultiplier,
  getStorageCapacityMultiplier
} from '../config.js';

/**
 * Calculate building cost for a specific level (server-side with config multipliers)
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
 * Calculate building construction time (server-side with config multipliers)
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
 * Calculate production for a building level (server-side with config multipliers)
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
 * Calculate storage capacity increase for a building level (server-side with config multipliers)
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
 * Start building upgrade
 */
export async function upgradeBuilding(userId, planetId, buildingType) {
  const player = await getPlayerByUserId(userId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  // Validate building type
  if (!BUILDINGS[buildingType]) {
    throw new Error('Invalid building type');
  }
  
  const building = BUILDINGS[buildingType];
  const currentLevel = planet.buildings[buildingType] || 0;
  const nextLevel = currentLevel + 1;
  
  // Check max level
  if (building.maxLevel && currentLevel >= building.maxLevel) {
    throw new Error('Building is at maximum level');
  }
  
  // Check build queue size
  const maxQueueSize = getBuildQueueSize();
  if (planet.buildQueue && planet.buildQueue.length >= maxQueueSize) {
    throw new Error(`Build queue is full (max ${maxQueueSize})`);
  }
  
  // Check requirements
  if (!checkRequirements(buildingType, planet.buildings, player.research)) {
    throw new Error('Requirements not met');
  }
  
  // Calculate cost
  const cost = getBuildingCost(buildingType, nextLevel);
  
  // Check resources
  if (planet.resources.metal < cost.metal ||
      planet.resources.crystal < cost.crystal ||
      planet.resources.deuterium < cost.deuterium) {
    throw new Error('Insufficient resources');
  }
  
  // Calculate build time
  const roboticsLevel = planet.buildings.roboticsFactory || 0;
  const naniteLevel = planet.buildings.naniteFactory || 0;
  const buildTime = getBuildTime(buildingType, nextLevel, roboticsLevel, naniteLevel);
  
  // Deduct resources
  planet.resources.metal -= cost.metal;
  planet.resources.crystal -= cost.crystal;
  planet.resources.deuterium -= cost.deuterium;
  
  // Add to build queue
  if (!planet.buildQueue) {
    planet.buildQueue = [];
  }
  
  // Calculate start and finish time based on queue position
  let startTime, finishTime;
  if (planet.buildQueue.length === 0) {
    // First item in queue starts immediately
    startTime = Date.now();
    finishTime = startTime + (buildTime * 1000);
  } else {
    // Subsequent items start when previous item finishes
    const previousItem = planet.buildQueue[planet.buildQueue.length - 1];
    startTime = previousItem.finishTime;
    finishTime = startTime + (buildTime * 1000);
  }
  
  planet.buildQueue.push({
    building: buildingType,
    level: nextLevel,
    startTime: startTime,
    finishTime: finishTime,
    cost: cost,
    queuePosition: planet.buildQueue.length + 1
  });
  
  // Update player
  await updatePlayer(userId, player);
  
  return {
    building: buildingType,
    level: nextLevel,
    cost: cost,
    buildTime: buildTime,
    finishTime: finishTime
  };
}

/**
 * Cancel building construction (refunds 50% of resources)
 */
export async function cancelBuilding(userId, planetId, queuePosition = 1) {
  const player = await getPlayerByUserId(userId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  if (!planet.buildQueue || planet.buildQueue.length === 0) {
    throw new Error('No building in progress');
  }
  
  const queueIndex = queuePosition - 1;
  if (queueIndex < 0 || queueIndex >= planet.buildQueue.length) {
    throw new Error('Invalid queue position');
  }
  
  const buildItem = planet.buildQueue[queueIndex];
  
  // Refund 50% of resources
  const refund = {
    metal: Math.floor(buildItem.cost.metal * 0.5),
    crystal: Math.floor(buildItem.cost.crystal * 0.5),
    deuterium: Math.floor(buildItem.cost.deuterium * 0.5)
  };
  
  planet.resources.metal += refund.metal;
  planet.resources.crystal += refund.crystal;
  planet.resources.deuterium += refund.deuterium;
  
  // Remove from queue
  planet.buildQueue.splice(queueIndex, 1);
  
  // Recalculate times for remaining items if we removed from the middle
  if (queueIndex === 0 && planet.buildQueue.length > 0) {
    // If we cancelled the first item, the next one starts now
    const nextItem = planet.buildQueue[0];
    const buildTime = (nextItem.finishTime - nextItem.startTime) / 1000; // in seconds
    nextItem.startTime = Date.now();
    nextItem.finishTime = nextItem.startTime + (buildTime * 1000);
    
    // Recalculate subsequent items
    for (let i = 1; i < planet.buildQueue.length; i++) {
      const item = planet.buildQueue[i];
      const prevItem = planet.buildQueue[i - 1];
      const itemBuildTime = (item.finishTime - item.startTime) / 1000;
      item.startTime = prevItem.finishTime;
      item.finishTime = item.startTime + (itemBuildTime * 1000);
    }
  } else if (queueIndex < planet.buildQueue.length) {
    // Recalculate times for items after the cancelled one
    for (let i = queueIndex; i < planet.buildQueue.length; i++) {
      const item = planet.buildQueue[i];
      const prevItem = i === 0 ? null : planet.buildQueue[i - 1];
      const buildTime = (item.finishTime - item.startTime) / 1000;
      
      if (prevItem) {
        item.startTime = prevItem.finishTime;
        item.finishTime = item.startTime + (buildTime * 1000);
      }
    }
  }
  
  // Update queue positions
  planet.buildQueue.forEach((item, index) => {
    item.queuePosition = index + 1;
  });
  
  await updatePlayer(userId, player);
  
  return { refund };
}

/**
 * Process completed buildings for all players
 */
export async function processCompletedBuildings(player) {
  let updated = false;
  
  for (const planet of player.planets) {
    if (!planet.buildQueue || planet.buildQueue.length === 0) {
      continue;
    }
    
    // Only process the first item in queue (currently building)
    const buildItem = planet.buildQueue[0];
    
    // Check if building is complete
    if (buildItem.finishTime <= Date.now()) {
      // Complete the building
      planet.buildings[buildItem.building] = buildItem.level;
      
      // Recalculate production
      updatePlanetProduction(planet);
      
      // Remove from queue
      planet.buildQueue.shift();
      
      // Update queue positions for remaining items
      planet.buildQueue.forEach((item, index) => {
        item.queuePosition = index + 1;
      });
      
      // If there are more items in queue, they continue with their scheduled times
      // (times were already calculated when added to queue)
      
      updated = true;
    }
  }
  
  return updated;
}

/**
 * Update planet production based on buildings
 */
export async function updatePlanetProduction(planet) {
  const { calculateAllocationEffectiveness, calculatePositionMultiplier } = await import('../../shared/formulas.js');
  const { CONFIG } = await import('../../shared/constants.js');
  
  // Get planet position (coordinates[2] is the position in the system)
  const planetPosition = planet.coordinates ? planet.coordinates[2] : 8;
  
  // Initialize building allocations if not exists
  if (!planet.buildingAllocations) {
    planet.buildingAllocations = {};
  }
  
  // Reset production and consumption
  planet.production = {
    metal: 0,
    crystal: 0,
    deuterium: 0,
    energy: 0,
    water: 0,
    food: 0
  };
  
  planet.consumption = {
    energy: 0,
    water: 0,
    food: 0,
    population: 0
  };
  
  let totalEnergyConsumption = 0;
  let totalWaterConsumption = 0;
  let totalPopulationRequired = 0;
  
  // Calculate production from all buildings
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    const building = BUILDINGS[buildingType];
    if (!building) continue;
    
    // Get base production
    const production = getProduction(buildingType, level);
    
    // Get allocation or default to 100%
    const allocation = planet.buildingAllocations[buildingType] || { power: 1.0, population: 1.0 };
    
    // Calculate effectiveness from power allocation
    const powerEffectiveness = calculateAllocationEffectiveness(allocation.power) / 100;
    
    // Calculate effectiveness from population allocation
    const populationEffectiveness = calculateAllocationEffectiveness(allocation.population) / 100;
    
    // Combined effectiveness (multiplicative)
    const totalEffectiveness = powerEffectiveness * populationEffectiveness;
    
    // Apply position multiplier for relevant resources
    for (const resource in production) {
      let amount = production[resource];
      
      // Apply position bonuses
      if (resource === 'water') {
        amount *= calculatePositionMultiplier(planetPosition, 'water');
      } else if (resource === 'food') {
        amount *= calculatePositionMultiplier(planetPosition, 'farm');
      } else if (resource === 'deuterium') {
        amount *= calculatePositionMultiplier(planetPosition, 'deuterium');
      }
      
      // Apply effectiveness
      amount *= totalEffectiveness;
      
      planet.production[resource] = (planet.production[resource] || 0) + Math.floor(amount);
    }
    
    // Calculate energy consumption
    if (building.energyConsumption) {
      const energyMultiplier = getResourceProductionMultiplier();
      const baseConsumption = Math.floor(building.energyConsumption * level * Math.pow(1.1, level) * energyMultiplier);
      // Energy consumption scales with power allocation
      totalEnergyConsumption += Math.floor(baseConsumption * allocation.power);
    }
    
    // Calculate water consumption (for farms)
    if (building.waterConsumption) {
      const baseWaterConsumption = Math.floor(building.waterConsumption * level * Math.pow(1.1, level));
      totalWaterConsumption += Math.floor(baseWaterConsumption * totalEffectiveness);
    }
    
    // Calculate population requirements
    if (building.populationRequired) {
      const basePopRequired = Math.floor(building.populationRequired * level * Math.pow(1.05, level));
      totalPopulationRequired += Math.floor(basePopRequired * allocation.population);
    }
  }
  
  // Store consumption
  planet.energyConsumption = totalEnergyConsumption;
  planet.consumption.energy = totalEnergyConsumption;
  planet.consumption.water = totalWaterConsumption;
  planet.consumption.population = totalPopulationRequired;
  
  // Calculate max population from housing
  const housingLevel = planet.buildings.housing || 0;
  planet.maxPopulation = CONFIG.POPULATION_HOUSING_RATIO * housingLevel * Math.pow(1.1, housingLevel);
  
  // Food consumption based on current population
  const currentPopulation = planet.resources.population || 0;
  planet.consumption.food = currentPopulation * CONFIG.FOOD_CONSUMPTION_PER_POPULATION;
  
  // Energy balance
  const netEnergy = planet.production.energy - totalEnergyConsumption;
  const originalEnergy = planet.production.energy;
  planet.production.energy = netEnergy;
  
  // If not enough energy, reduce production efficiency
  if (netEnergy < 0 && totalEnergyConsumption > 0) {
    const efficiency = Math.max(0, originalEnergy / totalEnergyConsumption);
    planet.production.metal = Math.floor(planet.production.metal * efficiency);
    planet.production.crystal = Math.floor(planet.production.crystal * efficiency);
    planet.production.deuterium = Math.floor(planet.production.deuterium * efficiency);
    planet.production.water = Math.floor(planet.production.water * efficiency);
    planet.production.food = Math.floor(planet.production.food * efficiency);
    planet.energyEfficiency = Math.floor(efficiency * 100);
  } else {
    planet.energyEfficiency = 100;
  }
  
  // Update storage capacity
  updatePlanetStorage(planet);
}

/**
 * Update planet storage capacity based on storage buildings
 */
export function updatePlanetStorage(planet) {
  // Base storage
  planet.storage = {
    metal: 10000,
    crystal: 10000,
    deuterium: 10000,
    water: 10000,
    food: 10000
  };
  
  // Add storage from buildings
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    const storageIncrease = getStorageIncrease(buildingType, level);
    
    for (const resource in storageIncrease) {
      planet.storage[resource] = (planet.storage[resource] || 0) + storageIncrease[resource];
    }
  }
}
/**
 * Update building allocation (power and population)
 */
export async function updateBuildingAllocation(userId, planetId, buildingType, powerPercent, populationPercent) {
  const player = await getPlayerByUserId(userId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  // Validate building exists
  if (!planet.buildings[buildingType] || planet.buildings[buildingType] === 0) {
    throw new Error('Building not found or at level 0');
  }
  
  // Validate percentages (allow 0-200% as per requirements)
  if (powerPercent < 0 || powerPercent > 2 || populationPercent < 0 || populationPercent > 2) {
    throw new Error('Allocation must be between 0% and 200%');
  }
  
  // Initialize allocations if not exists
  if (!planet.buildingAllocations) {
    planet.buildingAllocations = {};
  }
  
  // Update allocation
  planet.buildingAllocations[buildingType] = {
    power: powerPercent,
    population: populationPercent
  };
  
  // Recalculate production
  await updatePlanetProduction(planet);
  
  // Update player
  await updatePlayer(userId, player);
  
  return planet.buildingAllocations[buildingType];
}