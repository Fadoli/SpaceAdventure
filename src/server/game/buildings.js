// Building upgrade and management logic
import { 
  BUILDINGS,
  checkRequirements
} from '../../shared/buildings.js';
import {
  getBuildingEnergyConsumption,
  getBuildingPopulationRequired,
  calculateAllocationEffectiveness,
  calculatePositionMultiplier
} from '../../shared/formulas.js';
import { CONFIG, BUILDING_SPEED_MULTIPLIER, SCALING } from '../../shared/constants.js';
import { getPlayerByUserId, updatePlayer } from './player.js';
import { 
  getBuildQueueSize, 
  getResourceProductionMultiplier,
  getResourceCostMultiplier,
  getBuildTimeMultiplier,
  getStorageCapacityMultiplier
} from '../config.js';
import { calculateBaseTime } from '../../shared/time.js';

/**
 * Get the effective building definition for a planet (base or custom)
 */
export function getEffectiveBuildingDefinition(buildingType, planet = null, player = null) {
  const currentVariant = (planet?.activeVariants && planet.activeVariants[buildingType]) || 'base';
  if (currentVariant === 'custom' && player && player.customBuildingVariants && player.customBuildingVariants[buildingType]) {
    return player.customBuildingVariants[buildingType].customDefinition;
  }
  return BUILDINGS[buildingType];
}

/**
 * Calculate building cost for a specific level (server-side with config multipliers)
 */
export function getBuildingCost(buildingType, level, planet = null, player = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building) return null;
  
  const multiplier = Math.pow(SCALING.BUILDING_COST, level);
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
export function getBuildTime(buildingType, level, roboticsLevel = 0, naniteLevel = 0, planet = null, player = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building) return 0;
  
  const baseTime = calculateBaseTime(building) * Math.pow(SCALING.BUILDING_TIME, level - 1);
  
  // Robotics factory speeds up construction (inverse formula: 1 / 0.85^n)
  const roboticsMultiplier = roboticsLevel > 0 ? 1 / Math.pow(BUILDING_SPEED_MULTIPLIER, roboticsLevel) : 1;
  
  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  
  // Apply config build time multiplier
  const configMultiplier = getBuildTimeMultiplier();
  
  const totalTime = (baseTime / roboticsMultiplier / naniteMultiplier) * configMultiplier;
  
  return Math.max(1, Math.floor(totalTime)); // Minimum 1 second
}

/**
 * Calculate production for a building level (server-side with config multipliers)
 */
export function getProduction(buildingType, level, planet = null, player = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building || !building.production) return {};
  
  const production = {};
  const productionMultiplier = getResourceProductionMultiplier();
  
  for (const resource in building.production) {
    const baseAmount = building.production[resource];
    // Production increases by productionScaling^level, then apply config multiplier
    production[resource] = Math.floor(baseAmount * level * Math.pow(SCALING.BUILDING_PRODUCTION, level) * productionMultiplier);
  }
  
  return production;
}

/**
 * Calculate storage capacity increase for a building level (server-side with config multipliers)
 */
export function getStorageIncrease(buildingType, level, planet = null, player = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building || !building.storage) return {};
  
  const storage = {};
  const storageMultiplier = getStorageCapacityMultiplier();
  
  for (const resource in building.storage) {
    const baseAmount = building.storage[resource];
    storage[resource] = Math.floor(baseAmount * Math.pow(SCALING.BUILDING_STORAGE, level - 1) * storageMultiplier);
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
  
  // Find the highest level of this building in the queue
  let highestQueuedLevel = currentLevel;
  if (planet.buildQueue) {
    const queuedBuildings = planet.buildQueue.filter(item => item.building === buildingType);
    if (queuedBuildings.length > 0) {
      highestQueuedLevel = Math.max(...queuedBuildings.map(item => item.level));
    }
  }
  
  const nextLevel = highestQueuedLevel + 1;
  console.log(`[upgradeBuilding] ${buildingType}: currentLevel=${currentLevel}, buildQueue=${planet.buildQueue?.length || 0}, highestQueuedLevel=${highestQueuedLevel}, nextLevel=${nextLevel}`);
  
  // Check max level
  if (building.maxLevel && nextLevel > building.maxLevel) {
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
  const cost = getBuildingCost(buildingType, nextLevel, planet, player);
  
  // Check resources
  if (planet.resources.metal < cost.metal ||
      planet.resources.crystal < cost.crystal ||
      planet.resources.deuterium < cost.deuterium) {
    throw new Error('Insufficient resources');
  }
  
  // Calculate build time
  const roboticsLevel = planet.buildings.roboticsFactory || 0;
  const naniteLevel = planet.buildings.naniteFactory || 0;
  const buildTime = getBuildTime(buildingType, nextLevel, roboticsLevel, naniteLevel, planet, player);
  
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
      
      // Recalculate production (pass player for variant modifier support)
      updatePlanetProduction(planet, player);
      
      // Remove from queue
      planet.buildQueue.shift();
      
      // Update queue positions for remaining items
      planet.buildQueue.forEach((item, index) => {
        item.queuePosition = index + 1;
      });
      
      // If there are more items in queue, they continue with their scheduled times
      // (times were already calculated when added to queue)
      
      // Update activity timestamp when building completes
      planet.lastActivity = Date.now();
      
      updated = true;
    }
  }
  
  return updated;
}

/**
 * Calculate total energy production from all energy-producing buildings
 */
function calculateTotalEnergyProduction(planet, player = null) {
  let totalEnergy = 0;
  
  // Get energy tech bonus
  const energyTechLevel = player?.research?.energyTech || 0;
  const energyTechBonus = 1 + (energyTechLevel * 0.1); // 10% per level
  
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    const building = getEffectiveBuildingDefinition(buildingType, planet, player);
    if (!building || !building.production || !building.production.energy) continue;
    
    const allocation = planet.buildingAllocations[buildingType] || { power: 1.0, population: 1.0 };
    const production = getProduction(buildingType, level, planet, player);
    
    if (production.energy) {
      // For energy producers, apply population effectiveness only (they don't consume power)
      const populationEff = Math.sqrt(allocation.population); // Simplified effectiveness
      totalEnergy += production.energy * populationEff * energyTechBonus;
    }
  }
  
  return totalEnergy;
}

/**
 * Apply priority-based allocation when resources are scarce
 * Returns actual allocations based on available resources and priorities
 */
function applyPriorityBasedAllocation(planet, availablePopulation, availableEnergy) {
  // Initialize actual allocations object
  const actualAllocations = {};
  
  // Collect all buildings with their demands based on DESIRED allocations
  const buildings = [];
  
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    const building = BUILDINGS[buildingType];
    if (!building) continue;
    
    const desiredAllocation = planet.buildingAllocations[buildingType] || { 
      power: 1.0, 
      population: 1.0, 
      priority: 3
    };
    
    // Calculate base demands using DESIRED allocation and shared functions
    let energyDemand = 0;
    const baseEnergyConsumption = getBuildingEnergyConsumption(buildingType, level, BUILDINGS);
    energyDemand = baseEnergyConsumption * desiredAllocation.power;
    
    let populationDemand = 0;
    const basePopulationRequired = getBuildingPopulationRequired(buildingType, level, BUILDINGS);
    populationDemand = basePopulationRequired * desiredAllocation.population;
    
    buildings.push({
      type: buildingType,
      desiredAllocation,
      energyDemand,
      populationDemand,
      priority: desiredAllocation.priority || 3
    });
    
    // Initialize actual allocation to desired (will be adjusted below)
    actualAllocations[buildingType] = {
      power: desiredAllocation.power,
      population: desiredAllocation.population
    };
  }
  
  // Allocate energy by priority
  let remainingEnergy = availableEnergy;
  for (let priority = 1; priority <= 3; priority++) {
    const buildingsAtPriority = buildings.filter(b => b.priority === priority && b.energyDemand > 0);
    
    if (buildingsAtPriority.length === 0) continue;
    
    const totalDemand = buildingsAtPriority.reduce((sum, b) => sum + b.energyDemand, 0);
    
    if (totalDemand <= remainingEnergy) {
      // Enough energy for all at this priority - keep desired allocation
      remainingEnergy -= totalDemand;
    } else {
      // Not enough energy, distribute proportionally
      const ratio = remainingEnergy / totalDemand;
      for (const b of buildingsAtPriority) {
        actualAllocations[b.type].power = b.desiredAllocation.power * ratio;
      }
      remainingEnergy = 0;
      
      // Zero out lower priorities
      for (let p = priority + 1; p <= 3; p++) {
        buildings.filter(b => b.priority === p).forEach(b => {
          actualAllocations[b.type].power = 0;
        });
      }
      break;
    }
  }
  
  // Allocate population by priority
  let remainingPopulation = availablePopulation;
  for (let priority = 1; priority <= 3; priority++) {
    const buildingsAtPriority = buildings.filter(b => b.priority === priority && b.populationDemand > 0);
    
    if (buildingsAtPriority.length === 0) continue;
    
    const totalDemand = buildingsAtPriority.reduce((sum, b) => sum + b.populationDemand, 0);
    
    if (totalDemand <= remainingPopulation) {
      // Enough population for all at this priority - keep desired allocation
      remainingPopulation -= totalDemand;
    } else {
      // Not enough population, distribute proportionally
      const ratio = remainingPopulation / totalDemand;
      for (const b of buildingsAtPriority) {
        actualAllocations[b.type].population = b.desiredAllocation.population * ratio;
      }
      remainingPopulation = 0;
      
      // Zero out lower priorities
      for (let p = priority + 1; p <= 3; p++) {
        buildings.filter(b => b.priority === p).forEach(b => {
          actualAllocations[b.type].population = 0;
        });
      }
      break;
    }
  }
  
  return actualAllocations;
}

/**
 * Update planet production based on buildings
 */
export function updatePlanetProduction(planet, player = null) {
  // Get planet position (coordinates[2] is the position in the system)
  const planetPosition = planet.coordinates ? planet.coordinates[2] : 8;
  
  // Initialize building allocations if not exists
  if (!planet.buildingAllocations) {
    planet.buildingAllocations = {};
  }
  
  // First pass: Calculate demands and apply priority-based allocation
  const currentPopulation = planet.resources?.population || 0;
  const totalEnergyProduced = calculateTotalEnergyProduction(planet, player);
  
  const actualAllocations = applyPriorityBasedAllocation(planet, currentPopulation, totalEnergyProduced);
  
  // Store actual allocations for display purposes
  if (!planet.actualAllocations) {
    planet.actualAllocations = {};
  }
  planet.actualAllocations = actualAllocations;
  
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
  
  // Energy efficiency from research
  const energyTechLevel = player?.research?.energyTech || 0;
  const energyEfficiencyBonus = 1 - (energyTechLevel * 0.05); // 5% reduction per level
  
  // Calculate production from all buildings
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    // Get effective building definition (custom or base)
    const building = getEffectiveBuildingDefinition(buildingType, planet, player);
    if (!building) continue;
    
    // Get base production (already takes variant into account through definition)
    const production = getProduction(buildingType, level, planet, player);
    
    // Get ACTUAL allocation (computed based on priority and available resources)
    const actualAllocation = actualAllocations[buildingType] || { power: 1.0, population: 1.0 };
    
    // Calculate effectiveness from ACTUAL allocations
    const powerEffectiveness = calculateAllocationEffectiveness(actualAllocation.power * 100) / 100;
    const populationEffectiveness = calculateAllocationEffectiveness(actualAllocation.population * 100) / 100;
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
    
    // Calculate energy consumption using ACTUAL allocation
    if (building.energyConsumption) {
      const energyMultiplier = getResourceProductionMultiplier();
      let baseConsumption = Math.floor(building.energyConsumption * level * Math.pow(SCALING.BUILDING_ENERGY, level) * energyMultiplier);
      
      // Apply research efficiency bonus (never reduce below 50% of base consumption)
      baseConsumption = Math.floor(baseConsumption * Math.max(0.5, energyEfficiencyBonus));
      
      // Energy consumption scales with ACTUAL power allocation
      totalEnergyConsumption += Math.floor(baseConsumption * actualAllocation.power);
    }
    
    // Calculate water consumption (for farms)
    if (building.waterConsumption) {
      const baseWaterConsumption = Math.floor(building.waterConsumption * level * Math.pow(SCALING.BUILDING_PRODUCTION, level));
      totalWaterConsumption += Math.floor(baseWaterConsumption * totalEffectiveness);
    }
    
    // Calculate population requirements using ACTUAL allocation
    if (building.populationRequired) {
      let basePopRequired = Math.floor(building.populationRequired * level * Math.pow(SCALING.BUILDING_POPULATION, level));
      totalPopulationRequired += Math.floor(basePopRequired * actualAllocation.population);
    }
  }
  
  // Store consumption
  planet.energyConsumption = totalEnergyConsumption;
  planet.consumption.energy = totalEnergyConsumption;
  planet.consumption.water = totalWaterConsumption;
  planet.consumption.population = totalPopulationRequired;
  
  // Calculate max population from housing
  const housingLevel = planet.buildings.housing || 0;
  planet.maxPopulation = CONFIG.POPULATION_HOUSING_RATIO * housingLevel * Math.pow(SCALING.BUILDING_PRODUCTION, housingLevel);
  
  // Food consumption based on current population
  const currentPop = planet.resources.population || 0;
  planet.consumption.food = currentPop * CONFIG.FOOD_CONSUMPTION_PER_POPULATION;
  
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
export async function updateBuildingAllocation(userId, planetId, buildingType, powerPercent, populationPercent, priority) {
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
  
  // Update allocation with priority
  planet.buildingAllocations[buildingType] = {
    power: powerPercent,
    population: populationPercent,
    priority: priority || 3
  };
  
  // Recalculate production (pass player for variant modifier support)
  updatePlanetProduction(planet, player);
  
  // Update player
  await updatePlayer(userId, player);
  
  return planet.buildingAllocations[buildingType];
}

/**
 * Update all building allocations for a planet at once
 */
export async function updatePlanetAllocations(userId, planetId, allocations) {
  const player = await getPlayerByUserId(userId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  // Initialize allocations if not exists
  if (!planet.buildingAllocations) {
    planet.buildingAllocations = {};
  }
  
  // Update all allocations
  for (const buildingType in allocations) {
    const allocation = allocations[buildingType];
    // Validate building exists
    if (!planet.buildings[buildingType] || planet.buildings[buildingType] === 0) {
      continue;
    }
    
    // Validate percentages (allow 0-200% as per requirements)
    if (allocation.power < 0 || allocation.power > 2 || allocation.population < 0 || allocation.population > 2) {
      throw new Error(`Allocation for ${buildingType} must be between 0% and 200%`);
    }
    
    planet.buildingAllocations[buildingType] = {
      power: allocation.power,
      population: allocation.population,
      priority: allocation.priority || 3
    };
  }
  
  // Recalculate production (pass player for variant modifier support)
  updatePlanetProduction(planet, player);
  
  // Update player
  await updatePlayer(userId, player);
  
  return planet.buildingAllocations;
}

/**
 * Switch building variant (between base and custom)
 */
/**
 * Calculate variant switch duration based on cost (similar to build time)
 */
function getVariantSwitchDuration(switchCost) {
  // Base duration: 30 seconds per 100,000 total resources cost
  const totalCost = switchCost.metal + switchCost.crystal + switchCost.deuterium;
  const baseDuration = Math.max(10, Math.floor((totalCost / 100000) * 30)); // Minimum 10 seconds
  return baseDuration * 1000; // Convert to milliseconds
}

export async function queueVariantSwitch(userId, planetId, buildingType, toCustom) {
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
  
  // Check if custom variant exists
  if (!player.customBuildingVariants || !player.customBuildingVariants[buildingType]) {
    throw new Error('No custom variant available for this building');
  }
  
  // Initialize active variants tracking if needed
  if (!planet.activeVariants) {
    planet.activeVariants = {};
  }
  
  const currentVariant = planet.activeVariants[buildingType] || 'base';
  const buildingDef = BUILDINGS[buildingType];
  const customVariant = player.customBuildingVariants[buildingType];
  
  // Calculate costs
  const baseCost = getBuildingCost(buildingType, planet.buildings[buildingType]);
  
  // Calculate custom cost by applying cost modifier
  let customCost = { ...baseCost };
  if (customVariant.modifiers && customVariant.modifiers.costMultiplier !== 1) {
    customCost = {
      metal: Math.floor(baseCost.metal * customVariant.modifiers.costMultiplier),
      crystal: Math.floor(baseCost.crystal * customVariant.modifiers.costMultiplier),
      deuterium: Math.floor(baseCost.deuterium * customVariant.modifiers.costMultiplier)
    };
  }
  
  // Calculate switch cost (twice the difference)
  let switchCost = { metal: 0, crystal: 0, deuterium: 0 };
  const baseTotalCost = baseCost.metal + baseCost.crystal + baseCost.deuterium;
  const customTotalCost = customCost.metal + customCost.crystal + customCost.deuterium;
  
  if (toCustom) {
    // Switching to custom
    if (currentVariant === 'custom') {
      throw new Error('Already using custom variant');
    }
    
    if (customTotalCost > baseTotalCost) {
      // Custom is more expensive, cost is twice the difference
      const difference = {
        metal: customCost.metal - baseCost.metal,
        crystal: customCost.crystal - baseCost.crystal,
        deuterium: customCost.deuterium - baseCost.deuterium
      };
      switchCost = {
        metal: Math.max(0, difference.metal * 2),
        crystal: Math.max(0, difference.crystal * 2),
        deuterium: Math.max(0, difference.deuterium * 2)
      };
    } else {
      // Custom is cheaper, refund half the difference
      const difference = {
        metal: baseCost.metal - customCost.metal,
        crystal: baseCost.crystal - customCost.crystal,
        deuterium: baseCost.deuterium - customCost.deuterium
      };
      // Refund is negative cost (we give back resources)
      switchCost = {
        metal: -Math.floor(difference.metal / 2),
        crystal: -Math.floor(difference.crystal / 2),
        deuterium: -Math.floor(difference.deuterium / 2)
      };
    }
  } else {
    // Switching to base
    if (currentVariant === 'base') {
      throw new Error('Already using base variant');
    }
    
    if (baseTotalCost > customTotalCost) {
      // Base is more expensive, cost is twice the difference
      const difference = {
        metal: baseCost.metal - customCost.metal,
        crystal: baseCost.crystal - customCost.crystal,
        deuterium: baseCost.deuterium - customCost.deuterium
      };
      switchCost = {
        metal: Math.max(0, difference.metal * 2),
        crystal: Math.max(0, difference.crystal * 2),
        deuterium: Math.max(0, difference.deuterium * 2)
      };
    } else {
      // Base is cheaper, refund half the difference
      const difference = {
        metal: customCost.metal - baseCost.metal,
        crystal: customCost.crystal - baseCost.crystal,
        deuterium: customCost.deuterium - baseCost.deuterium
      };
      // Refund is negative cost (we give back resources)
      switchCost = {
        metal: -Math.floor(difference.metal / 2),
        crystal: -Math.floor(difference.crystal / 2),
        deuterium: -Math.floor(difference.deuterium / 2)
      };
    }
  }
  
  // Check if can afford the switch cost
  if (switchCost.metal > 0 && planet.resources.metal < switchCost.metal) {
    throw new Error('Insufficient metal for variant switch');
  }
  if (switchCost.crystal > 0 && planet.resources.crystal < switchCost.crystal) {
    throw new Error('Insufficient crystal for variant switch');
  }
  if (switchCost.deuterium > 0 && planet.resources.deuterium < switchCost.deuterium) {
    throw new Error('Insufficient deuterium for variant switch');
  }
  
  // Deduct or add resources upfront
  planet.resources.metal += switchCost.metal;
  planet.resources.crystal += switchCost.crystal;
  planet.resources.deuterium += switchCost.deuterium;
  
  // Initialize variant switch queue if needed
  if (!planet.variantSwitchQueue) {
    planet.variantSwitchQueue = [];
  }
  
  // Calculate duration and timing
  const duration = getVariantSwitchDuration(switchCost);
  let startTime, finishTime;
  
  if (planet.variantSwitchQueue.length === 0) {
    // First item starts immediately
    startTime = Date.now();
    finishTime = startTime + duration;
  } else {
    // Subsequent items start when previous item finishes
    const previousItem = planet.variantSwitchQueue[planet.variantSwitchQueue.length - 1];
    startTime = previousItem.finishTime;
    finishTime = startTime + duration;
  }
  
  // Queue the switch
  planet.variantSwitchQueue.push({
    buildingType,
    toCustom,
    startTime,
    finishTime,
    switchCost,
    queuePosition: planet.variantSwitchQueue.length + 1
  });
  
  // Update player
  await updatePlayer(userId, player);
  
  return {
    buildingType,
    targetVariant: toCustom ? 'custom' : 'base',
    switchCost,
    duration: duration / 1000, // Duration in seconds
    finishTime,
    resources: planet.resources
  };
}

/**
 * Process completed variant switches in the game loop
 */
export async function processCompletedVariantSwitches(player) {
  let updated = false;
  
  for (const planet of player.planets) {
    if (!planet.variantSwitchQueue || planet.variantSwitchQueue.length === 0) {
      continue;
    }
    
    // Only process the first item in queue (currently switching)
    const switchItem = planet.variantSwitchQueue[0];
    
    // Check if switch is complete
    if (switchItem.finishTime <= Date.now()) {
      // Complete the switch
      if (!planet.activeVariants) {
        planet.activeVariants = {};
      }
      planet.activeVariants[switchItem.buildingType] = switchItem.toCustom ? 'custom' : 'base';
      
      // Recalculate production after variant change (pass player for variant modifier support)
      updatePlanetProduction(planet, player);
      
      // Remove from queue
      planet.variantSwitchQueue.shift();
      
      // Update queue positions for remaining items
      planet.variantSwitchQueue.forEach((item, index) => {
        item.queuePosition = index + 1;
      });
      
      // Update activity timestamp
      planet.lastActivity = Date.now();
      
      updated = true;
    }
  }
  
  return updated;
}

/**
 * Legacy function - switches variant immediately (kept for backwards compatibility)
 */
export async function switchBuildingVariant(userId, planetId, buildingType, toCustom) {
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
  
  // Check if custom variant exists
  if (!player.customBuildingVariants || !player.customBuildingVariants[buildingType]) {
    throw new Error('No custom variant available for this building');
  }
  
  // Initialize active variants tracking if needed
  if (!planet.activeVariants) {
    planet.activeVariants = {};
  }
  
  const currentVariant = planet.activeVariants[buildingType] || 'base';
  const buildingDef = BUILDINGS[buildingType];
  const customVariant = player.customBuildingVariants[buildingType];
  
  // Calculate costs
  const baseCost = getBuildingCost(buildingType, planet.buildings[buildingType]);
  
  // Calculate custom cost by applying cost modifier
  let customCost = { ...baseCost };
  if (customVariant.modifiers && customVariant.modifiers.costMultiplier !== 1) {
    customCost = {
      metal: Math.floor(baseCost.metal * customVariant.modifiers.costMultiplier),
      crystal: Math.floor(baseCost.crystal * customVariant.modifiers.costMultiplier),
      deuterium: Math.floor(baseCost.deuterium * customVariant.modifiers.costMultiplier)
    };
  }
  
  // Calculate switch cost (twice the difference)
  let switchCost = { metal: 0, crystal: 0, deuterium: 0 };
  const baseTotalCost = baseCost.metal + baseCost.crystal + baseCost.deuterium;
  const customTotalCost = customCost.metal + customCost.crystal + customCost.deuterium;
  
  if (toCustom) {
    // Switching to custom
    if (currentVariant === 'custom') {
      throw new Error('Already using custom variant');
    }
    
    if (customTotalCost > baseTotalCost) {
      // Custom is more expensive, cost is twice the difference
      const difference = {
        metal: customCost.metal - baseCost.metal,
        crystal: customCost.crystal - baseCost.crystal,
        deuterium: customCost.deuterium - baseCost.deuterium
      };
      switchCost = {
        metal: Math.max(0, difference.metal * 2),
        crystal: Math.max(0, difference.crystal * 2),
        deuterium: Math.max(0, difference.deuterium * 2)
      };
    } else {
      // Custom is cheaper, refund half the difference
      const difference = {
        metal: baseCost.metal - customCost.metal,
        crystal: baseCost.crystal - customCost.crystal,
        deuterium: baseCost.deuterium - customCost.deuterium
      };
      // Refund is negative cost (we give back resources)
      switchCost = {
        metal: -Math.floor(difference.metal / 2),
        crystal: -Math.floor(difference.crystal / 2),
        deuterium: -Math.floor(difference.deuterium / 2)
      };
    }
  } else {
    // Switching to base
    if (currentVariant === 'base') {
      throw new Error('Already using base variant');
    }
    
    if (baseTotalCost > customTotalCost) {
      // Base is more expensive, cost is twice the difference
      const difference = {
        metal: baseCost.metal - customCost.metal,
        crystal: baseCost.crystal - customCost.crystal,
        deuterium: baseCost.deuterium - customCost.deuterium
      };
      switchCost = {
        metal: Math.max(0, difference.metal * 2),
        crystal: Math.max(0, difference.crystal * 2),
        deuterium: Math.max(0, difference.deuterium * 2)
      };
    } else {
      // Base is cheaper, refund half the difference
      const difference = {
        metal: customCost.metal - baseCost.metal,
        crystal: customCost.crystal - baseCost.crystal,
        deuterium: customCost.deuterium - baseCost.deuterium
      };
      // Refund is negative cost (we give back resources)
      switchCost = {
        metal: -Math.floor(difference.metal / 2),
        crystal: -Math.floor(difference.crystal / 2),
        deuterium: -Math.floor(difference.deuterium / 2)
      };
    }
  }
  
  // Check if can afford the switch cost
  if (switchCost.metal > 0 && planet.resources.metal < switchCost.metal) {
    throw new Error('Insufficient metal for variant switch');
  }
  if (switchCost.crystal > 0 && planet.resources.crystal < switchCost.crystal) {
    throw new Error('Insufficient crystal for variant switch');
  }
  if (switchCost.deuterium > 0 && planet.resources.deuterium < switchCost.deuterium) {
    throw new Error('Insufficient deuterium for variant switch');
  }
  
  // Deduct or add resources
  planet.resources.metal += switchCost.metal;
  planet.resources.crystal += switchCost.crystal;
  planet.resources.deuterium += switchCost.deuterium;
  
  // Update active variant
  planet.activeVariants[buildingType] = toCustom ? 'custom' : 'base';
  
  // Update player
  await updatePlayer(userId, player);
  
  return {
    buildingType,
    variant: planet.activeVariants[buildingType],
    switchCost,
    resources: planet.resources
  };
}
