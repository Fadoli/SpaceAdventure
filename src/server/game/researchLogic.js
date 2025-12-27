// Research game logic - handles research progression and management

import { generateId } from '../../shared/utils.js';
import {
  getTheoreticalResearch,
  getPracticalResearch,
  canResearchTheoretical,
  getAvailablePracticalResearch,
  getCustomVariant,
  calculateFocusModifiers,
  applyCustomization
} from '../../shared/research.js';
import {
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime
} from '../../shared/formulas.js';
import { BUILDINGS } from '../../shared/buildings.js';
import { SHIPS } from '../../shared/ships.js';

/**
 * Start theoretical research
 * Returns the research queue item
 */
export function startTheoreticalResearch(player, techKey, planetId) {
  const tech = getTheoreticalResearch()[techKey];
  if (!tech) {
    throw new Error(`Unknown technology: ${techKey}`);
  }
  
  // Check prerequisites
  if (!canResearchTheoretical(techKey, player.research)) {
    throw new Error(`Prerequisites not met for ${techKey}`);
  }
  
  // Check resources
  const currentLevel = player.research[techKey] || 0;
  const cost = calculateTheoreticalResearchCost(tech.baseCost, currentLevel);
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) {
      throw new Error(`Insufficient ${resource}. Need ${cost[resource]}, have ${planet.resources[resource]}`);
    }
  }
  
  // Check for research lab
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Deduct resources
  for (const resource in cost) {
    planet.resources[resource] -= cost[resource];
  }
  
  // Calculate research time
  const time = calculateTheoreticalResearchTime(
    tech.baseTime,
    currentLevel,
    planet.buildings.researchLab || 0
  );
  
  // Create research queue item
  const item = {
    id: generateId(),
    type: 'theoretical',
    techKey,
    level: currentLevel + 1,
    startTime: Date.now(),
    duration: time * 1000, // Convert to milliseconds
    endTime: Date.now() + (time * 1000),
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
export function startPracticalResearch(player, baseType, type, focus, planetId) {
  const FOCUS_TYPES = ['output', 'manpower', 'energy', 'cost'];
  
  if (!FOCUS_TYPES.includes(focus)) {
    throw new Error(`Invalid focus type: ${focus}`);
  }
  
  // Get the practical research config
  const practicalResearchConfig = Object.values(getPracticalResearch()).find(
    r => r.baseType === baseType && r.type === type
  );
  
  if (!practicalResearchConfig) {
    throw new Error(`No practical research available for ${type} ${baseType}`);
  }
  
  // Initialize if not exists
  if (!player.practicalResearch[baseType]) {
    player.practicalResearch[baseType] = {
      output: 0,
      manpower: 0,
      energy: 0,
      cost: 0
    };
  }
  
  const currentFocusLevel = player.practicalResearch[baseType][focus] || 0;
  
  // Check max levels
  if (currentFocusLevel >= practicalResearchConfig.maxLevels) {
    throw new Error(`Max level reached for ${baseType} ${focus}`);
  }
  
  // Check resources
  const cost = calculatePracticalResearchCost(
    practicalResearchConfig.baseCost,
    currentFocusLevel
  );
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }
  
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) {
      throw new Error(`Insufficient ${resource}. Need ${cost[resource]}, have ${planet.resources[resource]}`);
    }
  }
  
  // Check for research lab
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Deduct resources
  for (const resource in cost) {
    planet.resources[resource] -= cost[resource];
  }
  
  // Calculate research time
  const time = calculatePracticalResearchTime(
    practicalResearchConfig.baseTime,
    currentFocusLevel,
    planet.buildings.researchLab || 0
  );
  
  // Create queue item
  const item = {
    id: generateId(),
    type: 'practical',
    baseType,
    itemType: type, // 'building' or 'ship'
    focus,
    level: currentFocusLevel + 1,
    startTime: Date.now(),
    duration: time * 1000,
    endTime: Date.now() + (time * 1000),
    planetId,
    cost,
    progress: 0
  };
  
  player.practicalResearchQueue.push(item);
  
  return item;
}

/**
 * Complete practical research
 */
export function completePracticalResearch(player, queueItemId) {
  const index = player.practicalResearchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) {
    throw new Error('Practical research queue item not found');
  }
  
  const item = player.practicalResearchQueue[index];
  
  // Increment focus level
  if (!player.practicalResearch[item.baseType]) {
    player.practicalResearch[item.baseType] = {
      output: 0,
      manpower: 0,
      energy: 0,
      cost: 0
    };
  }
  
  player.practicalResearch[item.baseType][item.focus] = item.level;
  player.practicalResearchQueue.splice(index, 1);
  
  return item;
}

/**
 * Cancel practical research
 */
export function cancelPracticalResearch(player, queueItemId, planetId) {
  const index = player.practicalResearchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) {
    throw new Error('Practical research queue item not found');
  }
  
  const item = player.practicalResearchQueue[index];
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
  
  player.practicalResearchQueue.splice(index, 1);
  
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
 * Select or update a custom building variant for a planet
 * Replaces or creates a new variant with specified focus levels
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
  const researchConfig = Object.values(getPracticalResearch()).find(
    r => r.baseType === baseType && r.type === 'building'
  );
  
  if (!researchConfig) {
    throw new Error(`No practical research available for ${baseType}`);
  }
  
  // Validate focus levels don't exceed research levels
  for (const [focus, level] of Object.entries(focusLevels)) {
    const researchLevel = player.practicalResearch[baseType]?.[focus] || 0;
    if (level > researchLevel) {
      throw new Error(`Focus level ${level} exceeds research level ${researchLevel} for ${focus}`);
    }
  }
  
  // Initialize if needed
  if (!player.customBuildingVariants[planetId]) {
    player.customBuildingVariants[planetId] = {};
  }
  
  // Calculate modifiers and create variant
  const modifiers = calculateFocusModifiers(researchConfig, focusLevels);
  const baseDefinition = BUILDINGS[baseType];
  const customized = applyCustomization(baseDefinition, modifiers);
  
  player.customBuildingVariants[planetId][baseType] = {
    focusLevels,
    modifiers,
    customDefinition: customized
  };
  
  return player.customBuildingVariants[planetId][baseType];
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
  const researchConfig = Object.values(getPracticalResearch()).find(
    r => r.baseType === baseType && r.type === 'ship'
  );
  
  if (!researchConfig) {
    throw new Error(`No practical research available for ${baseType}`);
  }
  
  // Validate focus levels
  for (const [focus, level] of Object.entries(focusLevels)) {
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
 * Get the active variant for a building on a planet
 * Returns either custom variant or base definition
 */
export function getActiveBuildingVariant(player, planetId, baseType) {
  const variant = player.customBuildingVariants[planetId]?.[baseType];
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
 * Get active custom variants for a planet
 */
export function getActiveCustomVariants(player, planetId) {
  return player.customBuildingVariants[planetId] || {};
}

/**
 * Get all active ship custom variants
 */
export function getActiveShipCustomVariants(player) {
  return player.customShipVariants || {};
}
