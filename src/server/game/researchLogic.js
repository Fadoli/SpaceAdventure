// Research game logic - handles research progression and management

import { generateId } from '../../shared/utils.js';
import {
  getTheoreticalResearch,
  getPracticalResearch,
  canResearchTheoretical,
  getAvailablePracticalResearch,
  getCustomVariant,
  calculateFocusModifiers,
  applyCustomization,
  getResearchBonus
} from '../../shared/research.js';
import {
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime
} from '../../shared/formulas.js';
import { calculateBaseTime } from '../../shared/time.js';
import { BUILDINGS } from '../../shared/buildings.js';
import { SHIPS } from '../../shared/ships.js';
import { BUILDING_SPEED_MULTIPLIER } from '../../shared/constants.js';

import { 
  getBuildQueueSize, 
  getResourceProductionMultiplier,
  getResourceCostMultiplier,
  getBuildTimeMultiplier,
  getStorageCapacityMultiplier,
  getResearchTimeMultiplier,
  getResearchQueueSize,
  getConfig
} from '../config.js';

/**
 * Start theoretical research
 * Returns the research queue item
 */
export function startTheoreticalResearch(player, techKey, planetId) {
  console.log('startTheoreticalResearch called with:', { techKey, planetId });
  
  const tech = getTheoreticalResearch()[techKey];
  console.log('Tech definition:', tech);
  
  if (!tech) {
    throw new Error(`Unknown technology: ${techKey}`);
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }

  // Check prerequisites (based on current completed level)
  console.log('Checking prerequisites for', techKey);
  if (!canResearchTheoretical(techKey, player.research, planet.buildings)) {
    throw new Error(`Prerequisites not met for ${techKey}`);
  }
  
  console.log('Planet resources:', planet.resources);
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) {
      throw new Error(`Insufficient ${resource}. Need ${cost[resource]}, have ${planet.resources[resource]}`);
    }
  }
  
  // Check for research lab
  console.log('Research lab level:', planet.buildings.researchLab);
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Deduct resources
  for (const resource in cost) {
    planet.resources[resource] -= cost[resource];
  }
  
  // Calculate research time (use the level being queued for time calculation)
  const researchSpeedBonus = getResearchBonus(player.research, 'globalResearchSpeed');
  const configMultiplier = getResearchTimeMultiplier();
  
  const time = calculateTheoreticalResearchTime(
    tech,
    nextLevelToQueue - 1,
    planet.buildings.researchLab || 0,
    researchSpeedBonus,
    configMultiplier
  );
  console.log('Research time (seconds):', time);
  
  // Calculate start and finish time based on queue position
  let startTime, endTime;
  if (!player.researchQueue || player.researchQueue.length === 0) {
    // First item starts immediately
    startTime = Date.now();
    endTime = startTime + (time * 1000);
  } else {
    // Subsequent items start when previous item finishes
    const previousItem = player.researchQueue[player.researchQueue.length - 1];
    startTime = previousItem.endTime;
    endTime = startTime + (time * 1000);
  }
  
  // Create research queue item with the correct next level
  const item = {
    id: generateId(),
    type: 'theoretical',
    techKey,
    level: nextLevelToQueue,
    startTime: startTime,
    duration: time * 1000, // Convert to milliseconds
    endTime: endTime,
    planetId,
    cost,
    progress: 0
  };
  
  player.researchQueue.push(item);
  
  return item;
}

/**
 * Complete theoretical research when time is up
 */
export function completeTheoreticalResearch(player, queueItemId) {
  const index = player.researchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) {
    throw new Error('Research queue item not found');
  }
  
  const item = player.researchQueue[index];
  player.research[item.techKey] = item.level;
  player.researchQueue.splice(index, 1);
  
  return item;
}

/**
 * Cancel theoretical research
 * Returns portion of resources (assume 90% returned)
 */
export function cancelTheoreticalResearch(player, queueItemId, planetId) {
  const index = player.researchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) {
    throw new Error('Research queue item not found');
  }
  
  const item = player.researchQueue[index];
  const planet = player.planets.find(p => p.id === planetId);
  
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  // Return 90% of resources
  const refund = {};
  for (const resource in item.cost) {
    refund[resource] = Math.floor(item.cost[resource] * 0.9);
    planet.resources[resource] += refund[resource];
  }
  
  player.researchQueue.splice(index, 1);
  
  return refund;
}

/**
 * Start practical research (building/ship customization)
 * Increments the focus level for a specific type and building/ship
 */
export function startPracticalResearchWithAllocation(player, researchKey, allocation, planetId, strength = 0.5) {
  console.log(`[RESEARCH] startPracticalResearchWithAllocation called with researchKey=${researchKey}, allocation=`, allocation, `strength=${strength}, planetId=${planetId}`);
  
  // Get the practical research config
  const PRACTICAL = getPracticalResearch();
  const practicalResearchConfig = PRACTICAL[researchKey];
  
  if (!practicalResearchConfig) {
    throw new Error(`No practical research available for ${researchKey}`);
  }
  
  const baseType = practicalResearchConfig.baseType;
  
  // Validate allocation sums to approximately 1 (or 100%)
  let allocationSum = 0;
  for (const focus in allocation) {
    allocationSum += allocation[focus];
  }
  console.log(`[RESEARCH] Allocation sum: ${allocationSum}`);
  
  if (Math.abs(allocationSum - 1) > 0.01) {  // Allow small rounding errors
    throw new Error(`Allocation must sum to 100%, got ${Math.round(allocationSum * 100)}%`);
  }
  
  // Validate strength
  if (strength < 0 || strength > 1) {
    throw new Error(`Strength must be between 0 and 1, got ${strength}`);
  }
  
  // Initialize if not exists
  if (!player.practicalResearch || !player.practicalResearch[baseType]) {
    if (!player.practicalResearch) player.practicalResearch = {};
    player.practicalResearch[baseType] = {
      output: 0,
      automation: 0,
      energy: 0,
      cost: 0
    };
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  console.log(`[RESEARCH] Planet found:`, planet ? 'yes' : 'no');
  
  if (!planet) {
    throw new Error('Planet not found');
  }

  // Check queue size
  // Check build queue size
  const maxQueueSize = getResearchQueueSize();
  if (player.practicalResearchQueue && player.practicalResearchQueue.length >= maxQueueSize) {
    throw new Error(`Research queue is full (max ${maxQueueSize})`);
  }
  
  // Check for research lab
  console.log(`[RESEARCH] Research lab level:`, planet.buildings.researchLab);
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Calculate weighted cost based on allocation
  const baseCost = practicalResearchConfig.baseCost;
  const costModifiers = {
    output: 1.05,
    automation: 1.12,
    energy: 1.08,
    cost: 0.88
  };
  
  let totalCostMultiplier = 0;
  for (const focus in allocation) {
    const percentage = allocation[focus];
    totalCostMultiplier += (costModifiers[focus] || 1) * percentage;
  }
  
  // Apply level scaling
  const currentLevel = player.practicalResearch[baseType];
  let totalFocusLevel = 0;
  for (const focus in currentLevel) {
    totalFocusLevel += currentLevel[focus];
  }
  const levelMultiplier = 1 + (totalFocusLevel * 0.3);
  
  // Apply non-linear strength multiplier (0 = 0.5x, 0.5 = 1x, 1 = 2.5x)
  const strengthMultiplier = 0.5 + (strength * strength * 2);
  
  const finalCostMultiplier = totalCostMultiplier * levelMultiplier * strengthMultiplier;
  const cost = {
    metal: Math.ceil(baseCost.metal * finalCostMultiplier),
    crystal: Math.ceil(baseCost.crystal * finalCostMultiplier),
    deuterium: Math.ceil(baseCost.deuterium * finalCostMultiplier)
  };
  
  console.log(`[RESEARCH] Cost calculation: allocation multiplier=${totalCostMultiplier}, level=${levelMultiplier}, strength=${strengthMultiplier}, final=${finalCostMultiplier}`)
  console.log(`[RESEARCH] Required cost:`, cost);
  console.log(`[RESEARCH] Planet resources:`, planet.resources);
  
  // Check resources
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) {
      throw new Error(`Insufficient ${resource}. Need ${cost[resource]}, have ${planet.resources[resource]}`);
    }
  }
  
  // Deduct resources
  for (const resource in cost) {
    planet.resources[resource] -= cost[resource];
  }
  console.log(`[RESEARCH] Resources deducted, remaining:`, planet.resources);
  
  // Calculate research time with unified formula
  const time = calculatePracticalResearchTime(
    practicalResearchConfig,
    totalFocusLevel,
    planet.buildings.researchLab || 1,
    researchSpeedBonus,
    configMultiplier,
    strength
  );
  
  // Calculate start and finish time based on queue position
  let startTime, endTime;
  if (!player.practicalResearchQueue || player.practicalResearchQueue.length === 0) {
    // First item starts immediately
    startTime = Date.now();
    endTime = startTime + (time * 1000);
  } else {
    // Subsequent items start when previous item finishes
    const previousItem = player.practicalResearchQueue[player.practicalResearchQueue.length - 1];
    startTime = previousItem.endTime;
    endTime = startTime + (time * 1000);
  }
  
  // Create queue item with allocation and strength
  const item = {
    id: generateId(),
    type: 'practical',
    baseType,
    itemType: practicalResearchConfig.type,
    allocation,  // Store the allocation
    strength,    // Store the strength
    startTime: startTime,
    duration: time * 1000,
    endTime: endTime,
    planetId,
    cost,
    progress: 0
  };
  
  console.log(`[RESEARCH] Created queue item:`, item);
  console.log(`[RESEARCH] Research time: ${time} seconds (${Math.floor(time / 60)} minutes)`);
  
  if (!player.practicalResearchQueue) {
    player.practicalResearchQueue = [];
  }
  
  player.practicalResearchQueue.push(item);
  console.log(`[RESEARCH] Added to queue, queue length now:`, player.practicalResearchQueue.length);
  
  return item;
}

/**
 * Start practical research at the next level
 * This is the simple system where players research the next level of a customization
 */
export function startPracticalResearchLevel(player, researchKey, planetId) {
  console.log(`[RESEARCH] startPracticalResearchLevel called with researchKey=${researchKey}, planetId=${planetId}`);
  
    // Get the practical research config
  
    const PRACTICAL = getPracticalResearch();
  
    const practicalKeys = [];
  
    for (const k in PRACTICAL) {
  
      practicalKeys.push(k);
  
    }
  
    console.log(`[RESEARCH] Available practical research keys:`, practicalKeys);
  
    const practicalResearchConfig = PRACTICAL[researchKey];
  console.log(`[RESEARCH] Config for ${researchKey}:`, practicalResearchConfig);
  
  if (!practicalResearchConfig) {
    throw new Error(`No practical research available for ${researchKey}`);
  }
  
  const baseType = practicalResearchConfig.baseType;
  const planet = player.planets.find(p => p.id === planetId);
  console.log(`[RESEARCH] Planet found:`, planet ? 'yes' : 'no');
  
  if (!planet) {
    throw new Error('Planet not found');
  }

  // Check queue size
  // Check build queue size
  const maxQueueSize = getResearchQueueSize();
  if (player.practicalResearchQueue && player.practicalResearchQueue.length >= maxQueueSize) {
    throw new Error(`Research queue is full (max ${maxQueueSize})`);
  }
  
  // Ensure player has practical research structure
  if (!player.practicalResearch) {
    player.practicalResearch = {};
    console.log(`[RESEARCH] Initialized player.practicalResearch`);
  }
  
  if (!player.practicalResearchQueue) {
    player.practicalResearchQueue = [];
    console.log(`[RESEARCH] Initialized player.practicalResearchQueue`);
  }
  
  // Check for research lab
  console.log(`[RESEARCH] Research lab level:`, planet.buildings.researchLab);
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Get current research level
  if (!player.practicalResearch[baseType]) {
    player.practicalResearch[baseType] = {
      output: 0,
      automation: 0,
      energy: 0,
      cost: 0
    };
    console.log(`[RESEARCH] Initialized practical research for ${baseType}`);
  }
  
  // Calculate the total level across all focuses to determine progression
  const currentLevel = player.practicalResearch[baseType];
  console.log(`[RESEARCH] Current focus levels for ${baseType}:`, currentLevel);
  
  let totalFocusLevel = 0;
  for (const focus in currentLevel) {
    totalFocusLevel += currentLevel[focus];
  }
  const nextLevel = totalFocusLevel + 1;
  console.log(`[RESEARCH] Total focus level: ${totalFocusLevel}, next level: ${nextLevel}`);
  
  // Calculate cost for this research level (scales exponentially)
  const baseCost = practicalResearchConfig.baseCost;
  const costMultiplier = 1 + (totalFocusLevel * 0.5);  // Cost increases with research
  const cost = {
    metal: Math.ceil(baseCost.metal * costMultiplier),
    crystal: Math.ceil(baseCost.crystal * costMultiplier),
    deuterium: Math.ceil(baseCost.deuterium * costMultiplier)
  };
  
  // Check resources
  console.log(`[RESEARCH] Required cost:`, cost);
  console.log(`[RESEARCH] Planet resources:`, planet.resources);
  
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) {
      throw new Error(`Insufficient ${resource}. Need ${cost[resource]}, have ${planet.resources[resource]}`);
    }
  }
  
  // Deduct resources
  for (const resource in cost) {
    planet.resources[resource] -= cost[resource];
  }
  console.log(`[RESEARCH] Resources deducted, remaining:`, planet.resources);
  
  // Calculate research time based on research lab level
  // Base time increases with research level
  const researchLabLevel = planet.buildings.researchLab || 1;
  const researchSpeedBonus = getResearchBonus(player.research, 'globalResearchSpeed');
  const configMultiplier = getResearchTimeMultiplier();
  
  const time = calculatePracticalResearchTime(
    practicalResearchConfig,
    totalFocusLevel,
    planet.buildings.researchLab || 1,
    researchSpeedBonus,
    configMultiplier,
    0.5 // Default strength for level-based
  );
  
  // Calculate start and finish time based on queue position
  let startTime, endTime;
  if (!player.practicalResearchQueue || player.practicalResearchQueue.length === 0) {
    // First item starts immediately
    startTime = Date.now();
    endTime = startTime + (time * 1000);
  } else {
    // Subsequent items start when previous item finishes
    const previousItem = player.practicalResearchQueue[player.practicalResearchQueue.length - 1];
    startTime = previousItem.endTime;
    endTime = startTime + (time * 1000);
  }
  
  // Create queue item for level-based research
  const item = {
    id: generateId(),
    type: 'practical',
    baseType,
    itemType: practicalResearchConfig.type,  // 'building' or 'ship'
    level: nextLevel,
    startTime: startTime,
    duration: time * 1000,  // Convert to milliseconds
    endTime: endTime,
    planetId,
    cost,
    progress: 0
  };
  
  console.log(`[RESEARCH] Created queue item:`, item);
  console.log(`[RESEARCH] Research time: ${time} seconds (${Math.floor(time / 60)} minutes)`);
  
  player.practicalResearchQueue.push(item);
  console.log(`[RESEARCH] Added to queue, queue length now:`, player.practicalResearchQueue.length);
  
  return item;
}

/**
 * Complete practical research
 */
export function completePracticalResearch(player, queueItemId) {
  console.log(`[RESEARCH] Completing research: ${queueItemId}`);
  
  const index = player.practicalResearchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) {
    throw new Error('Practical research queue item not found');
  }
  
  const item = player.practicalResearchQueue[index];
  console.log(`[RESEARCH] Found queue item:`, item);

  // Initialize if not exists
  if (!player.practicalResearch[item.baseType]) {
    player.practicalResearch[item.baseType] = {
      output: 0,
      automation: 0,
      energy: 0,
      cost: 0
    };
  }
  
  // For allocation-based research, distribute improvements based on allocation
  if (item.allocation) {
    console.log(`[RESEARCH] Processing allocation-based research`);
    for (const focus in item.allocation) {
      const percentage = item.allocation[focus];
      if (percentage > 0) {
        // Each percentage point gives 0.2 levels (so 100% = 20 levels, 50% = 10 levels, 20% = 4 levels, etc)
        const levelIncrease = Math.max(1, Math.floor(percentage * 20));
        player.practicalResearch[item.baseType][focus] += levelIncrease;
        console.log(`[RESEARCH] Added ${levelIncrease} levels to ${focus} (${Math.round(percentage * 100)}%)`);
      }
    }
  } else if (item.level) {
    // Level-based research - distribute using rotating pattern
    console.log(`[RESEARCH] Processing level-based research`);
    const focuses = ['output', 'automation', 'energy', 'cost'];
    const focusIndex = (item.level - 1) % focuses.length;
    const targetFocus = focuses[focusIndex];
    console.log(`[RESEARCH] Level ${item.level} grants focus: ${targetFocus}`);
    player.practicalResearch[item.baseType][targetFocus]++;
    console.log(`[RESEARCH] Updated research state:`, player.practicalResearch[item.baseType]);
  }
  
  // Automatically create a custom building variant when practical research completes
  // This allows the user to immediately build their customized version
  if (item.type === 'building' && item.planetId) {
    console.log(`[RESEARCH] Auto-creating building variant for ${item.baseType} on planet ${item.planetId}`);
    try {
      const focusLevels = player.practicalResearch[item.baseType];
      selectCustomBuildingVariant(player, item.planetId, item.baseType, focusLevels);
      console.log(`[RESEARCH] Successfully created variant for ${item.baseType}`);
    } catch (error) {
      console.error(`[RESEARCH] Failed to create variant: ${error.message}`);
      // Don't throw - research completion shouldn't fail if variant creation fails
    }
  }
  
  player.practicalResearchQueue.splice(index, 1);
  console.log(`[RESEARCH] Research completion processed, queue length now:`, player.practicalResearchQueue.length);
}

/**
 * Cancel practical research
 */
export function cancelPracticalResearch(player, queueItemId, planetId) {
  console.log(`[RESEARCH] Cancelling research: queueItemId=${queueItemId}, planetId=${planetId}`);
  console.log(`[RESEARCH] Queue length before cancel:`, player.practicalResearchQueue?.length || 0);
  
  if (!player.practicalResearchQueue || !Array.isArray(player.practicalResearchQueue)) {
    throw new Error('Practical research queue not found');
  }
  
  const index = player.practicalResearchQueue.findIndex(item => item.id === queueItemId);
  console.log(`[RESEARCH] Found queue item at index:`, index);
  
  if (index === -1) {
    throw new Error('Practical research queue item not found');
  }
  
  const item = player.practicalResearchQueue[index];
  console.log(`[RESEARCH] Queue item to cancel:`, item);
  
  const planet = player.planets.find(p => p.id === planetId);
  console.log(`[RESEARCH] Planet found:`, planet ? 'yes' : 'no');
  
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  // Return 90% of resources
  const refund = {};
  for (const resource in item.cost) {
    refund[resource] = Math.floor(item.cost[resource] * 0.9);
    planet.resources[resource] += refund[resource];
  }
  
  console.log(`[RESEARCH] Refund:`, refund);
  console.log(`[RESEARCH] Planet resources after refund:`, planet.resources);
  
  player.practicalResearchQueue.splice(index, 1);
  console.log(`[RESEARCH] Queue length after cancel:`, player.practicalResearchQueue.length);
  
  return refund;
}

/**
 * Get all available practical research options for a player
 * Based on which buildings/ships they have
 */
export function getAvailablePracticalResearchForPlayer(player, planetId) {
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    return {};
  }
  
  return getAvailablePracticalResearch(planet.buildings, planet.ships);
}

/**
 * Select or update a custom building variant
 * Replaces or creates a new variant with specified focus levels
 * Stored at account level, applies to all planets
 */
export function selectCustomBuildingVariant(player, planetId, baseType, focusLevels) {
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  // Verify building exists
  if (!planet.buildings[baseType] || planet.buildings[baseType] === 0) {
    throw new Error(`Building ${baseType} not available on this planet`);
  }
  
  // Verify research config exists
  let researchConfig = null;
  const practical = getPracticalResearch();
  for (const key in practical) {
    const r = practical[key];
    if (r.baseType === baseType && r.type === 'building') {
      researchConfig = r;
      break;
    }
  }
  
  if (!researchConfig) {
    throw new Error(`No practical research available for ${baseType}`);
  }
  
  // Validate focus levels don't exceed research levels
  for (const focus in focusLevels) {
    const level = focusLevels[focus];
    const researchLevel = player.practicalResearch[baseType]?.[focus] || 0;
    if (level > researchLevel) {
      throw new Error(`Focus level ${level} exceeds research level ${researchLevel} for ${focus}`);
    }
  }
  
  // Initialize if needed (account-level storage)
  if (!player.customBuildingVariants) {
    player.customBuildingVariants = {};
  }
  
  // Calculate modifiers and create variant
  const modifiers = calculateFocusModifiers(researchConfig, focusLevels);
  const baseDefinition = BUILDINGS[baseType];
  const customized = applyCustomization(baseDefinition, modifiers);
  
  player.customBuildingVariants[baseType] = {
    focusLevels,
    modifiers,
    customDefinition: customized
  };
  
  return player.customBuildingVariants[baseType];
}

/**
 * Select or update a custom ship variant
 */
export function selectCustomShipVariant(player, baseType, focusLevels) {
  // Verify ship exists
  if (!SHIPS[baseType]) {
    throw new Error(`Ship ${baseType} not found`);
  }
  
  // Verify research config exists
  let researchConfig = null;
  const practical = getPracticalResearch();
  for (const key in practical) {
    const r = practical[key];
    if (r.baseType === baseType && r.type === 'ship') {
      researchConfig = r;
      break;
    }
  }
  
  if (!researchConfig) {
    throw new Error(`No practical research available for ${baseType}`);
  }
  
  // Validate focus levels
  for (const focus in focusLevels) {
    const level = focusLevels[focus];
    const researchLevel = player.practicalResearch[baseType]?.[focus] || 0;
    if (level > researchLevel) {
      throw new Error(`Focus level ${level} exceeds research level ${researchLevel} for ${focus}`);
    }
  }
  
  // Initialize if needed
  if (!player.customShipVariants[baseType]) {
    player.customShipVariants[baseType] = {};
  }
  
  // Calculate modifiers and create variant
  const modifiers = calculateFocusModifiers(researchConfig, focusLevels);
  const baseDefinition = SHIPS[baseType];
  const customized = applyCustomization(baseDefinition, modifiers);
  
  player.customShipVariants[baseType] = {
    focusLevels,
    modifiers,
    customDefinition: customized
  };
  
  return player.customShipVariants[baseType];
}

/**
 * Get the active variant for a building
 * Returns either custom variant or base definition
 */
export function getActiveBuildingVariant(player, planetId, baseType) {
  const variant = player.customBuildingVariants?.[baseType];
  if (variant) {
    return variant.customDefinition;
  }
  
  return BUILDINGS[baseType];
}

/**
 * Get the active variant for a ship
 * Returns either custom variant or base definition
 */
export function getActiveShipVariant(player, baseType) {
  const variant = player.customShipVariants[baseType];
  if (variant) {
    return variant.customDefinition;
  }
  
  return SHIPS[baseType];
}

/**
 * Get research progress info
 */
export function getResearchProgress(player) {
  const theoretical = (player.researchQueue || []).map(item => {
    const progress = Math.min(100, Math.floor(
      ((Date.now() - item.startTime) / item.duration) * 100
    ));
    
    return {
      ...item,
      progress,
      timeRemaining: Math.max(0, item.endTime - Date.now())
    };
  });
  
  const practical = (player.practicalResearchQueue || []).map(item => {
    const progress = Math.min(100, Math.floor(
      ((Date.now() - item.startTime) / item.duration) * 100
    ));
    
    return {
      ...item,
      progress,
      timeRemaining: Math.max(0, item.endTime - Date.now())
    };
  });
  
  return { theoretical, practical };
}

/**
 * Get theoretical research levels
 */
export function getTheoreticalResearchLevels(player) {
  return player.research || {};
}

/**
 * Get practical research progress for all types
 */
export function getPracticalResearchProgress(player) {
  return player.practicalResearch || {};
}

/**
 * Get active custom variants for the account (applies to all planets)
 */
export function getActiveCustomVariants(player, planetId) {
  if (!player.customBuildingVariants) {
    return {};
  }
  return player.customBuildingVariants;
}

/**
 * Get all active ship custom variants
 */
export function getActiveShipCustomVariants(player) {
  return player.customShipVariants || {};
}
