// Building upgrade and management logic
import { 
  BUILDINGS, 
  getBuildingCost, 
  getBuildTime, 
  getProduction,
  getStorageIncrease,
  checkRequirements 
} from '../../shared/buildings.js';
import { getPlayerByUserId, updatePlayer } from './player.js';

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
  
  // Check if already building
  if (planet.buildQueue && planet.buildQueue.length > 0) {
    throw new Error('Already constructing a building');
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
  const finishTime = Date.now() + (buildTime * 1000);
  
  if (!planet.buildQueue) {
    planet.buildQueue = [];
  }
  
  planet.buildQueue.push({
    building: buildingType,
    level: nextLevel,
    startTime: Date.now(),
    finishTime: finishTime,
    cost: cost
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
export async function cancelBuilding(userId, planetId) {
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
  
  const buildItem = planet.buildQueue[0];
  
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
  planet.buildQueue.shift();
  
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
    
    const buildItem = planet.buildQueue[0];
    
    // Check if building is complete
    if (buildItem.finishTime <= Date.now()) {
      // Complete the building
      planet.buildings[buildItem.building] = buildItem.level;
      
      // Recalculate production
      updatePlanetProduction(planet);
      
      // Remove from queue
      planet.buildQueue.shift();
      
      updated = true;
    }
  }
  
  return updated;
}

/**
 * Update planet production based on buildings
 */
export function updatePlanetProduction(planet) {
  // Reset production
  planet.production = {
    metal: 0,
    crystal: 0,
    deuterium: 0,
    energy: 0
  };
  
  let energyConsumption = 0;
  
  // Calculate production from all buildings
  for (const [buildingType, level] of Object.entries(planet.buildings)) {
    if (level === 0) continue;
    
    const production = getProduction(buildingType, level);
    
    for (const [resource, amount] of Object.entries(production)) {
      planet.production[resource] = (planet.production[resource] || 0) + amount;
    }
    
    // Calculate energy consumption
    const building = BUILDINGS[buildingType];
    if (building && building.energyConsumption) {
      energyConsumption += Math.floor(building.energyConsumption * level * Math.pow(1.1, level));
    }
  }
  
  // Store energy consumption separately for UI
  planet.energyConsumption = energyConsumption;
  
  // Energy balance
  const netEnergy = planet.production.energy - energyConsumption;
  const originalEnergy = planet.production.energy;
  planet.production.energy = netEnergy;
  
  // If not enough energy, reduce production efficiency
  if (netEnergy < 0) {
    const efficiency = Math.max(0, originalEnergy / energyConsumption);
    planet.production.metal = Math.floor(planet.production.metal * efficiency);
    planet.production.crystal = Math.floor(planet.production.crystal * efficiency);
    planet.production.deuterium = Math.floor(planet.production.deuterium * efficiency);
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
    deuterium: 10000
  };
  
  // Add storage from buildings
  for (const [buildingType, level] of Object.entries(planet.buildings)) {
    if (level === 0) continue;
    
    const storageIncrease = getStorageIncrease(buildingType, level);
    
    for (const [resource, amount] of Object.entries(storageIncrease)) {
      planet.storage[resource] = (planet.storage[resource] || 0) + amount;
    }
  }
}
