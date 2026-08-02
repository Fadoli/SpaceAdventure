// Building upgrade and management logic
import { 
  BUILDINGS,
  checkRequirements
} from '../../shared/buildings.js';
import { 
  getTheoreticalResearch,
  getPracticalResearch,
  canResearchTheoretical,
  getAvailablePracticalResearch,
  getCustomVariant,
  calculateFocusModifiers,
  applyCustomization,
  getResearchBonus,
  validateFocusLevels
} from '../../shared/research.js';
import {
  getBuildingEnergyConsumption,
  getBuildingPopulationRequired,
  calculateAllocationEffectiveness,
  calculatePositionMultiplier,
  calculateFoodConsumption,
  calculateWaterConsumption
} from '../../shared/formulas.js';
import { CONFIG, BUILDING_SPEED_MULTIPLIER, SCALING } from '../../shared/constants.js';
import { getPlayerByUserId, updatePlayer } from './player.js';
import { wsManager } from './wsManager.js';
import { logEvent } from '../storage/eventLogger.js';
import { 
  getBuildQueueSize, 
  getResourceProductionMultiplier,
  getResourceCostMultiplier,
  getBuildTimeMultiplier,
  getStorageCapacityMultiplier
} from '../config.js';
import { calculateBaseTime } from '../../shared/time.js';

export function validateBuildingType(buildingType) {
  if (typeof buildingType !== 'string' || !Object.hasOwn(BUILDINGS, buildingType)) {
    throw new Error('Invalid building type');
  }
  return BUILDINGS[buildingType];
}

export function validateBlueprintName(name) {
  if (typeof name !== 'string') throw new Error('Blueprint name must be text');
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) throw new Error('Blueprint name must be 1-40 characters');
  return trimmed;
}

function getBlueprintDefinition(baseType, blueprint) {
  if (blueprint?.focusLevels) {
    const variant = getCustomVariant(baseType, blueprint.focusLevels);
    if (variant) return applyCustomization(BUILDINGS[baseType], variant.modifiers);
  }
  return blueprint?.customDefinition;
}

/**
 * Get the effective building definition for a planet (base or custom blueprint)
 */
export function getEffectiveBuildingDefinition(buildingType, planet = null, player = null) {
  const activeVariantId = (planet?.activeVariants && planet.activeVariants[buildingType]) || 'base';
  
  if (activeVariantId === 'base') {
    return BUILDINGS[buildingType];
  }
  
  // Try to find in planet's local blueprint storage first
  if (planet && planet.localBlueprints && planet.localBlueprints[buildingType]) {
    return getBlueprintDefinition(buildingType, planet.localBlueprints[buildingType]);
  }
  
  // Try to find by blueprint ID in player's global storage (legacy/fallback)
  if (player && player.buildingBlueprints && player.buildingBlueprints[buildingType]) {
    const blueprint = player.buildingBlueprints[buildingType].find(bp => bp.id === activeVariantId);
    if (blueprint) return getBlueprintDefinition(buildingType, blueprint);
  }
  
  // Fallback to legacy single variant if ID didn't match (for migration)
  if (activeVariantId === 'custom' && player && player.customBuildingVariants && player.customBuildingVariants[buildingType]) {
    return getBlueprintDefinition(buildingType, player.customBuildingVariants[buildingType]);
  }
  
  return BUILDINGS[buildingType];
}

/**
 * Calculate building cost for a specific level (server-side with config multipliers)
 */
export function getBuildingCost(buildingType, level, planet = null, player = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building) return null;
  
  const scaling = building.costScaling || SCALING.BUILDING_COST;
  const multiplier = Math.pow(scaling, level);
  const costMultiplier = getResourceCostMultiplier();
  
  // Apply research bonus: data-driven globalCostReduction
  const costReductionBonus = getResearchBonus(player?.research, 'globalCostReduction');
  const reduction = 1 - costReductionBonus;
  
  return {
    metal: Math.floor(building.baseCost.metal * multiplier * costMultiplier * reduction),
    crystal: Math.floor(building.baseCost.crystal * multiplier * costMultiplier * reduction),
    deuterium: Math.floor(building.baseCost.deuterium * multiplier * costMultiplier * reduction)
  };
}

/**
 * Calculate building construction time (server-side with config multipliers)
 */
export function getBuildTime(buildingType, level, roboticsLevel = 0, naniteLevel = 0, planet = null, player = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building) return 0;
  
  const baseTime = calculateBaseTime(building) * Math.pow(SCALING.BUILDING_TIME, level - 1);
  
  const roboticsDef = getEffectiveBuildingDefinition('roboticsFactory', planet, player);
  const roboticsSpeedMultiplier = roboticsDef.speedMultiplier || BUILDING_SPEED_MULTIPLIER;
  
  // Robotics factory speeds up construction (inverse formula: 1 / multiplier^n)
  const roboticsMultiplier = roboticsLevel > 0 ? 1 / Math.pow(roboticsSpeedMultiplier, roboticsLevel) : 1;
  
  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;
  
  // Apply config build time multiplier
  const configMultiplier = getBuildTimeMultiplier();
  
  // Apply research bonus: data-driven globalTimeReduction
  const timeReductionBonus = getResearchBonus(player?.research, 'globalTimeReduction');
  const reduction = 1 - timeReductionBonus;
  
  const naniteDef = getEffectiveBuildingDefinition('naniteFactory', planet, player);
  const globalBlueprintTimeMultiplier =
    (buildingType === 'roboticsFactory' ? 1 : (roboticsDef.timeMultiplier || 1)) *
    (buildingType === 'naniteFactory' ? 1 : (naniteDef.timeMultiplier || 1));
  let totalTime = (baseTime / roboticsMultiplier / naniteMultiplier) * configMultiplier * reduction * globalBlueprintTimeMultiplier;
  
  // Apply practical research time multiplier if it exists in the definition
  if (building.timeMultiplier !== undefined) {
    totalTime *= building.timeMultiplier;
  }
  
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

export function getBuildingDeuteriumConsumption(buildingType, level, planet = null, player = null, energyEfficiencyBonus = null) {
  const building = getEffectiveBuildingDefinition(buildingType, planet, player);
  if (!building?.deuteriumConsumption || level <= 0) return 0;

  const efficiencyBonus = energyEfficiencyBonus ?? getResearchBonus(player?.research, 'buildingEnergyEfficiency');
  const baseFusionOutput = BUILDINGS.fusionReactor?.production?.energy || 1;
  const outputMultiplier = buildingType === 'fusionReactor'
    ? (building.production?.energy ?? baseFusionOutput) / baseFusionOutput
    : 1;

  return Math.floor(
    building.deuteriumConsumption * level * Math.pow(SCALING.BUILDING_PRODUCTION, level) *
    getResourceProductionMultiplier() * outputMultiplier * Math.max(0.5, 1 - efficiencyBonus)
  );
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
  
  const building = validateBuildingType(buildingType);
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
  
  console.log(`[upgradeBuilding] ${buildingType}: currentLevel=${currentLevel}, buildQueue=${planet.buildQueue?.length || 0}, highestQueuedLevel=${highestQueuedLevel}, nextLevel=${nextLevel}`);
  
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
  
  const item = {
    building: buildingType,
    level: nextLevel,
    startTime: startTime,
    finishTime: finishTime,
    cost: cost,
    queuePosition: planet.buildQueue.length + 1
  };

  planet.buildQueue.push(item);
  
  // Update player
  await updatePlayer(userId, player);
  wsManager.sendToUser(userId, 'QUEUE_UPDATED', { planetId, queueType: 'build' });
  
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
  if (!Number.isInteger(queuePosition) || queuePosition < 1) {
    throw new Error('Invalid queue position');
  }

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
  wsManager.sendToUser(userId, 'QUEUE_UPDATED', { planetId, queueType: 'build' });
  
  return { refund };
}

/**
 * Remove a completed building before changing its blueprint.
 */
export async function demolishBuilding(userId, planetId, buildingType) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');

  validateBuildingType(buildingType);
  const level = planet.buildings[buildingType] || 0;
  if (level === 0) throw new Error('Building is already demolished');
  if (planet.buildQueue?.some(item => item.building === buildingType)) {
    throw new Error('Cancel queued upgrades before demolishing this building');
  }

  planet.buildings[buildingType] = 0;
  updatePlanetProduction(planet, player);
  await updatePlayer(userId, player);
  wsManager.sendToUser(userId, 'QUEUE_UPDATED', { planetId, queueType: 'build' });

  return { buildingType, demolishedLevel: level };
}

/**
 * Process completed buildings for all players
 */
export async function processCompletedBuildings(player, now = Date.now()) {
  let updated = false;
  
  for (const planet of player.planets) {
    // Process queue sequentially
    while (planet.buildQueue && planet.buildQueue.length > 0) {
      const buildItem = planet.buildQueue[0];
      
      // Check if building is complete
      if (buildItem.finishTime <= now) {
        // Complete the building
        planet.buildings[buildItem.building] = buildItem.level;
        
        // Log the event
        await logEvent('BUILDING_COMPLETE', { 
            username: player.username, 
            building: buildItem.building, 
            level: buildItem.level,
            planetName: planet.name
        });

        // Recalculate production
        updatePlanetProduction(planet, player);
        
        // Remove from queue
        planet.buildQueue.shift();
        
        // Update queue positions and times for remaining items
        if (planet.buildQueue.length > 0) {
          planet.buildQueue.forEach((item, index) => {
            item.queuePosition = index + 1;
            // The first item in the new queue starts when the previous one finished
            if (index === 0) {
              const duration = item.finishTime - item.startTime;
              item.startTime = buildItem.finishTime;
              item.finishTime = item.startTime + duration;
            } else {
              // Subsequent items start when their predecessor finishes
              const prevItem = planet.buildQueue[index - 1];
              const duration = item.finishTime - item.startTime;
              item.startTime = prevItem.finishTime;
              item.finishTime = item.startTime + duration;
            }
          });
        }
        
        // Update activity timestamp
        planet.lastActivity = now;
        updated = true;
      } else {
        break; // First item not finished
      }
    }
  }
  
  return updated;
}

/**
 * Calculate total energy production from all energy-producing buildings
 */
function calculateTotalEnergyProduction(planet, player = null, allocations = null) {
  let totalEnergy = 0;
  
  // Get energy tech bonus: data-driven buildingEnergyProduction
  const energyProductionBonus = getResearchBonus(player?.research, 'buildingEnergyProduction');
  const bonus = 1 + energyProductionBonus;
  
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    const building = getEffectiveBuildingDefinition(buildingType, planet, player);
    if (!building || !building.production || !building.production.energy) continue;
    
    // Use provided allocations or fall back to planet desired allocations
    const allocation = (allocations && allocations[buildingType]) 
      ? allocations[buildingType] 
      : (planet.buildingAllocations[buildingType] || { power: 1.0, population: 1.0 });
      
    const production = getProduction(buildingType, level, planet, player);
    
    if (production.energy) {
      // Energy allocation controls how much of a producer is online too.
      const powerEff = calculateAllocationEffectiveness(allocation.power * 100) / 100;
      const populationEff = calculateAllocationEffectiveness(allocation.population * 100) / 100;
      totalEnergy += production.energy * powerEff * populationEff * bonus;
    }
  }
  
  return totalEnergy;
}

/**
 * Resolve population allocation based on priority
 */
function resolvePopulationAllocation(planet, availablePopulation, player = null) {
  // Initialize actual allocations object from desired
  const actualAllocations = {};
  
  // Collect all buildings with their demands
  const buildings = [];
  
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    // Get effective definition to calculate correct demand (blueprints support)
    const effectiveDef = getEffectiveBuildingDefinition(buildingType, planet, player);
    const effectiveBuildingsObj = { [buildingType]: effectiveDef };
    
    // Check if building still exists in effective definitions (it should)
    if (!effectiveDef) continue;
    
    const desiredAllocation = planet.buildingAllocations[buildingType] || { 
      power: 1.0, 
      population: 1.0, 
      priority: 3
    };
    
    // Calculate population demand using effective definition
    const basePopulationRequired = getBuildingPopulationRequired(buildingType, level, effectiveBuildingsObj);
    const populationDemand = basePopulationRequired * desiredAllocation.population;
    
    buildings.push({
      type: buildingType,
      desiredAllocation,
      populationDemand,
      priority: desiredAllocation.priority || 3
    });
    
    // Initialize actual allocation to desired
    actualAllocations[buildingType] = {
      power: desiredAllocation.power,
      population: desiredAllocation.population,
      priority: desiredAllocation.priority || 3
    };
  }
  
  // Allocate population by priority
  let remainingPopulation = availablePopulation;
  for (let priority = 1; priority <= 3; priority++) {
    const buildingsAtPriority = buildings.filter(b => b.priority === priority && b.populationDemand > 0);
    
    if (buildingsAtPriority.length === 0) continue;
    
    const totalDemand = buildingsAtPriority.reduce((sum, b) => sum + b.populationDemand, 0);
    
    if (totalDemand <= remainingPopulation) {
      // Enough population for all at this priority
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
 * Resolve energy allocation based on priority
 * Uses existing actualAllocations (already processed for population) and updates power
 */
function resolveEnergyAllocation(planet, availableEnergy, actualAllocations, player = null) {
  // Collect all buildings with energy demands
  const buildings = [];
  const energyEfficiencyBonus = getResearchBonus(player?.research, 'buildingEnergyEfficiency');
  
  for (const buildingType in planet.buildings) {
    const level = planet.buildings[buildingType];
    if (level === 0) continue;
    
    // Get effective definition (blueprints support)
    const effectiveDef = getEffectiveBuildingDefinition(buildingType, planet, player);
    const effectiveBuildingsObj = { [buildingType]: effectiveDef };
    if (!effectiveDef) continue;
    
    // Use the allocation that might already exist (for desired power/priority)
    const allocation = actualAllocations[buildingType];
    if (!allocation) continue; // Should have been initialized in population step
    
    // Calculate energy demand based on desired power using effective definition
    const baseEnergyConsumption = getBuildingEnergyConsumption(
      buildingType,
      level,
      effectiveBuildingsObj,
      energyEfficiencyBonus
    );
    const energyDemand = baseEnergyConsumption * allocation.power;
    
    buildings.push({
      type: buildingType,
      energyDemand,
      priority: allocation.priority || 3
    });
  }
  
  // Allocate energy by priority
  let remainingEnergy = Math.max(0, availableEnergy);
  for (let priority = 1; priority <= 3; priority++) {
    const buildingsAtPriority = buildings.filter(b => b.priority === priority && b.energyDemand > 0);
    
    if (buildingsAtPriority.length === 0) continue;
    
    const totalDemand = buildingsAtPriority.reduce((sum, b) => sum + b.energyDemand, 0);
    
    if (totalDemand <= remainingEnergy) {
      // Enough energy
      remainingEnergy -= totalDemand;
    } else {
      // Not enough energy, distribute proportionally
      const ratio = remainingEnergy / totalDemand;
      for (const b of buildingsAtPriority) {
        // Here we modify the actual allocation directly
        actualAllocations[b.type].power *= ratio;
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
  
  return actualAllocations;
}

/**
 * Ensure a planet has all required state fields for all building types
 */
export function ensurePlanetState(planet) {
  if (!planet.buildingAllocations) {
    planet.buildingAllocations = {};
  }
  if (!planet.activeVariants) {
    planet.activeVariants = {};
  }
  if (!planet.localBlueprints) {
    planet.localBlueprints = {};
  }

  // Initialize state for every building type if missing
  for (const type in BUILDINGS) {
    if (!planet.buildingAllocations[type]) {
      planet.buildingAllocations[type] = { 
        power: 1.0, 
        population: 1.0, 
        priority: 3 
      };
    }
    if (!planet.activeVariants[type]) {
      planet.activeVariants[type] = 'base';
    }
  }
}

/**
 * Update planet production based on buildings
 */
export function updatePlanetProduction(planet, player = null) {
  // Ensure planet has all necessary state fields
  ensurePlanetState(planet);

  // Get planet position (coordinates[2] is the position in the system)
  const planetPosition = planet.coordinates ? planet.coordinates[2] : 8;
  
  // 1. Resolve Population Allocation first
  // This ensures we know exactly which buildings are staffed
  const currentPopulation = planet.resources?.population || 0;
  let actualAllocations = resolvePopulationAllocation(planet, currentPopulation, player);
  
  // 2. Calculate Energy Production based on resolved population
  // Solar plants etc might produce less if understaffed
  const totalEnergyProduced = calculateTotalEnergyProduction(planet, player, actualAllocations);
  
  // 3. Resolve Energy Allocation based on the actual energy produced
  // This turns off mines if there isn't enough power
  actualAllocations = resolveEnergyAllocation(planet, totalEnergyProduced, actualAllocations, player);
  
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
    deuterium: 0,
    water: 0,
    food: 0,
    population: 0
  };
  
  let totalEnergyConsumption = 0;
  let totalDeuteriumConsumption = 0;
  let totalWaterConsumption = 0;
  let totalPopulationRequired = 0;
  
  // Energy efficiency from research: data-driven buildingEnergyEfficiency
  const energyEfficiencyBonus = getResearchBonus(player?.research, 'buildingEnergyEfficiency');
  const reduction = 1 - energyEfficiencyBonus;
  
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
      // Energy consumption scales with ACTUAL power allocation
      const baseConsumption = getBuildingEnergyConsumption(
        buildingType,
        level,
        { [buildingType]: building },
        energyEfficiencyBonus
      );
      totalEnergyConsumption += baseConsumption * actualAllocation.power;
    }
    
    // Calculate water consumption (for farms)
    if (building.waterConsumption) {
      // Water efficiency: data-driven (re-using reduction for simplicity or adding specific one)
      const baseWaterConsumption = Math.floor(building.waterConsumption * level * Math.pow(SCALING.BUILDING_PRODUCTION, level));
      totalWaterConsumption += Math.floor(baseWaterConsumption * totalEffectiveness * Math.max(0.5, reduction));
    }

    if (building.deuteriumConsumption) {
      totalDeuteriumConsumption += getBuildingDeuteriumConsumption(
        buildingType,
        level,
        planet,
        player,
        energyEfficiencyBonus
      ) * totalEffectiveness;
    }
    
    // Calculate population requirements using ACTUAL allocation
    if (building.populationRequired) {
      let basePopRequired = Math.floor(building.populationRequired * level * Math.pow(SCALING.BUILDING_POPULATION, level));
      totalPopulationRequired += Math.floor(basePopRequired * actualAllocation.population);
    }
  }
  
  // Calculate max population from housing
  const housingLevel = planet.buildings.housing || 0;
  const housingDef = BUILDINGS.housing;
  
  // Get bonuses from research
  const housingBaseBonus = getResearchBonus(player?.research, 'housingBaseBonus');
  const housingScalingBonus = getResearchBonus(player?.research, 'housingScalingBonus');
  
  // Base slots increase with research: Base 500 + bonuses (e.g. Astro)
  const baseCapacity = (housingDef.housingCapacity || 500) + housingBaseBonus;
  
  // Scaling improves with research: Base 1.25 + bonuses (e.g. Astro)
  const scalingFactor = (SCALING.BUILDING_HOUSING || 1.25) + housingScalingBonus;
  
  planet.maxPopulation = Math.floor(baseCapacity * housingLevel * Math.pow(scalingFactor, housingLevel));
  
  // Calculate total consumption (Buildings + Population)
  const currentPop = planet.resources.population || 0;
  
  // 1. Food
  planet.consumption.food = calculateFoodConsumption(currentPop, CONFIG.FOOD_CONSUMPTION_PER_POPULATION);
  
  // 2. Water (Buildings already added to totalWaterConsumption, now add population need)
  const populationWaterNeed = calculateWaterConsumption(currentPop, CONFIG.WATER_CONSUMPTION_PER_POPULATION);
  planet.consumption.water = totalWaterConsumption + populationWaterNeed;
  planet.consumption.deuterium = Math.floor(totalDeuteriumConsumption);
  
  // 3. Energy (Buildings already added to totalEnergyConsumption)
  // 4. Workers (Calculated in loop as totalPopulationRequired)
  planet.consumption.population = totalPopulationRequired;
  
  // Store final totals
  planet.energyConsumption = Math.round(totalEnergyConsumption * 100) / 100;
  planet.consumption.energy = planet.energyConsumption;

  // Energy balance
  const originalEnergy = planet.production.energy;
  const netEnergy = originalEnergy - totalEnergyConsumption;
  planet.production.energy = netEnergy;
  
  // Calculate global efficiencies for reporting (UI)
  // Note: Production reduction is already handled by allocation logic
  // which adjusts actualAllocations for individual buildings.
  
  let populationEfficiency = 1.0;
  if (currentPop < totalPopulationRequired && totalPopulationRequired > 0) {
    populationEfficiency = currentPop / totalPopulationRequired;
  }

  let energyEfficiency = 1.0;
  if (netEnergy < 0 && totalEnergyConsumption > 0) {
    energyEfficiency = Math.max(0, originalEnergy / totalEnergyConsumption);
  }

  // Store efficiencies for UI display
  planet.energyEfficiency = Math.floor(energyEfficiency * 100);
  planet.populationEfficiency = Math.floor(populationEfficiency * 100);
  
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
export function validateBuildingAllocation(planet, buildingType, allocation) {
  if (!Object.hasOwn(BUILDINGS, buildingType) || !Object.hasOwn(planet.buildings || {}, buildingType) || planet.buildings[buildingType] <= 0) {
    throw new Error('Building not found or at level 0');
  }
  if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) throw new Error('Invalid building allocation');

  const { power, population, priority = 3 } = allocation;
  if (!Number.isFinite(power) || power < 0 || power > 2 || !Number.isFinite(population) || population < 0 || population > 2) {
    throw new Error('Allocation must be between 0% and 200%');
  }
  if (!Number.isSafeInteger(priority) || priority < 1 || priority > 3) throw new Error('Allocation priority must be between 1 and 3');

  return { power, population, priority };
}

export async function updateBuildingAllocation(userId, planetId, buildingType, powerPercent, populationPercent, priority) {
  const player = await getPlayerByUserId(userId);
  if (!player) {
    throw new Error('Player not found');
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  const validated = validateBuildingAllocation(planet, buildingType, { power: powerPercent, population: populationPercent, priority: priority ?? 3 });
  
  // Initialize allocations if not exists
  if (!planet.buildingAllocations) {
    planet.buildingAllocations = {};
  }
  
  // Update allocation with priority
  planet.buildingAllocations[buildingType] = validated;
  
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
  
  if (!allocations || typeof allocations !== 'object' || Array.isArray(allocations)) throw new Error('Invalid building allocations');
  const validated = Object.fromEntries(Object.entries(allocations).map(([buildingType, allocation]) => [
    buildingType,
    validateBuildingAllocation(planet, buildingType, allocation)
  ]));

  if (!planet.buildingAllocations) planet.buildingAllocations = {};
  Object.assign(planet.buildingAllocations, validated);
  
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

  validateBuildingType(buildingType);
  
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
  wsManager.sendToUser(userId, 'QUEUE_UPDATED', { planetId, queueType: 'build' });
  
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
export async function processCompletedVariantSwitches(player, now = Date.now()) {
  let updated = false;
  
  for (const planet of player.planets) {
    if (!planet.variantSwitchQueue || planet.variantSwitchQueue.length === 0) {
      continue;
    }
    
    // Only process the first item in queue (currently switching)
    const switchItem = planet.variantSwitchQueue[0];

    if (typeof switchItem?.buildingType !== 'string' || !Object.hasOwn(BUILDINGS, switchItem.buildingType)) {
      planet.variantSwitchQueue.shift();
      planet.variantSwitchQueue.forEach((item, index) => { item.queuePosition = index + 1; });
      updated = true;
      continue;
    }
    
    // Check if switch is complete
    if (switchItem.finishTime <= now) {
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

  validateBuildingType(buildingType);
  
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

/**
 * Create a new blueprint for a building type
 */
export async function createBuildingBlueprint(userId, baseType, focusLevels, name) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  validateBuildingType(baseType);
  const validatedName = name == null ? null : validateBlueprintName(name);

  const MAX_BLUEPRINTS = 5;
  const existingBlueprints = player.buildingBlueprints?.[baseType] || [];
  if (existingBlueprints.length >= MAX_BLUEPRINTS) {
    throw new Error(`Maximum limit of ${MAX_BLUEPRINTS} blueprints reached for ${baseType}.`);
  }

  const practical = getPracticalResearch();
  let researchConfig = null;
  for (const k in practical) {
    if (practical[k].baseType === baseType && practical[k].type === 'building') {
      researchConfig = practical[k];
      break;
    }
  }
  if (!researchConfig) throw new Error('No practical research available for ' + baseType);

  const validatedFocusLevels = validateFocusLevels(researchConfig, focusLevels, player.practicalResearch?.[baseType]?.experience);

  if (!player.buildingBlueprints) player.buildingBlueprints = {};
  if (!player.buildingBlueprints[baseType]) player.buildingBlueprints[baseType] = [];

  const blueprintId = 'bp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const modifiers = calculateFocusModifiers(researchConfig, validatedFocusLevels);
  const customDefinition = applyCustomization(BUILDINGS[baseType], modifiers);

  const blueprint = {
    id: blueprintId,
    name: validatedName ?? (baseType + ' Variant ' + (player.buildingBlueprints[baseType].length + 1)),
    baseType,
    focusLevels: validatedFocusLevels,
    modifiers,
    customDefinition,
    createdAt: Date.now()
  };

  player.buildingBlueprints[baseType].push(blueprint);
  await updatePlayer(userId, player);
  return blueprint;
}

/**
 * Set the active blueprint for a specific planet and building
 */
export async function setActiveBlueprint(userId, planetId, baseType, blueprintId) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  validateBuildingType(baseType);

  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');

  if ((planet.buildings[baseType] || 0) > 0) {
    throw new Error('Demolish the current building before changing its blueprint');
  }
  if (planet.buildQueue?.some(item => item.building === baseType)) {
    throw new Error('Cancel queued upgrades before changing this blueprint');
  }

  if (!planet.activeVariants) planet.activeVariants = {};
  if (!planet.localBlueprints) planet.localBlueprints = {};

  if (blueprintId === 'base') {
    planet.activeVariants[baseType] = 'base';
    delete planet.localBlueprints[baseType];
  } else {
    // Verify blueprint exists in player's collection
    const blueprints = player.buildingBlueprints?.[baseType] || [];
    const blueprint = blueprints.find(bp => bp.id === blueprintId);
    if (!blueprint) throw new Error('Blueprint not found');
    
    planet.activeVariants[baseType] = blueprintId;
    // Copy blueprint data to the planet locally
    planet.localBlueprints[baseType] = JSON.parse(JSON.stringify(blueprint));
  }

  updatePlanetProduction(planet, player);
  await updatePlayer(userId, player);
  return { activeVariant: planet.activeVariants[baseType] };
}

/**
 * Delete a building blueprint
 */
export async function deleteBuildingBlueprint(userId, baseType, blueprintId) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  validateBuildingType(baseType);

  if (!player.buildingBlueprints || !player.buildingBlueprints[baseType]) {
    throw new Error('Blueprint not found');
  }

  const index = player.buildingBlueprints[baseType].findIndex(bp => bp.id === blueprintId);
  if (index === -1) throw new Error('Blueprint not found');

  player.buildingBlueprints[baseType].splice(index, 1);

  await updatePlayer(userId, player);
  return { success: true };
}

/**
 * Rename a building blueprint
 */
export async function renameBuildingBlueprint(userId, baseType, blueprintId, newName) {
  const { getPlayerByUserId, updatePlayer } = await import('./player.js');
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  validateBuildingType(baseType);
  const validatedName = validateBlueprintName(newName);

  if (!player.buildingBlueprints || !player.buildingBlueprints[baseType]) {
    throw new Error('Blueprint not found');
  }

  const blueprint = player.buildingBlueprints[baseType].find(bp => bp.id === blueprintId);
  if (!blueprint) throw new Error('Blueprint not found');

  blueprint.name = validatedName;

  // Also update any planets using this blueprint locally
  for (const planet of player.planets) {
    if (planet.activeVariants?.[baseType] === blueprintId && planet.localBlueprints?.[baseType]) {
      planet.localBlueprints[baseType].name = validatedName;
    }
  }

  await updatePlayer(userId, player);
  return blueprint;
}
