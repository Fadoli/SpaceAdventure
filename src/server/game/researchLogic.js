// Research game logic - handles research progression and management

import { generateId, isEmpty } from '../../shared/utils.js';
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
  calculateTheoreticalResearchCost,
  calculateTheoreticalResearchTime,
  calculatePracticalResearchCost,
  calculatePracticalResearchTime,
  rollResearchOutcome
} from '../../shared/formulas.js';
import { calculateBaseTime } from '../../shared/time.js';
import { BUILDINGS } from '../../shared/buildings.js';
import { getEffectiveBuildingDefinition } from './buildings.js';
import { RESEARCH_LAB_SPEED_MULTIPLIER } from '../../shared/constants.js';
import { addResearchHistoryEntry, getResearchHistory } from './researchHistory.js';

export { getResearchHistory };

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
import { updatePlayer, getPlayerByUserId } from './player.js';

function closeResearchQueueGap(queue, removedIndex) {
  queue.splice(removedIndex, 1);
  queue.forEach((item, index) => {
    if (index < removedIndex) return;
    item.startTime = index === 0 ? Date.now() : queue[index - 1].endTime;
    item.endTime = item.startTime + item.duration;
  });
}
import { logEvent } from '../storage/eventLogger.js';

/**
 * Start theoretical research
 */
export function startTheoreticalResearch(player, techKey, planetId) {
  const tech = getTheoreticalResearch()[techKey];
  if (!tech) {
    throw new Error(`Unknown technology: ${techKey}`);
  }
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) {
    throw new Error('Planet not found');
  }

  // Check prerequisites
  if (!canResearchTheoretical(techKey, player.research, planet.buildings)) {
    throw new Error(`Prerequisites not met for ${techKey}`);
  }
  
  // Get current completed level
  const currentCompletedLevel = player.research[techKey] || 0;
  const queuedCount = (player.researchQueue || []).filter(item => item.techKey === techKey).length;
  const nextLevelToQueue = currentCompletedLevel + 1 + queuedCount;
  
  // Calculate cost
  const cost = calculateTheoreticalResearchCost(tech.baseCost, nextLevelToQueue - 1, tech.costScaling);
  
  // Check resources
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) {
      throw new Error(`Insufficient ${resource}. Need ${cost[resource]}, have ${planet.resources[resource]}`);
    }
  }
  
  // Check for research lab
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Check queue size
  const maxQueueSize = getResearchQueueSize();
  if (player.researchQueue && player.researchQueue.length >= maxQueueSize) {
    throw new Error(`Research queue is full (max ${maxQueueSize})`);
  }

  // Deduct resources
  for (const resource in cost) {
    planet.resources[resource] -= cost[resource];
  }
  
  // Calculate research time
  const researchSpeedBonus = getResearchBonus(player.research, 'globalResearchSpeed');
  const configMultiplier = getResearchTimeMultiplier();
  
  const labDef = getEffectiveBuildingDefinition('researchLab', planet, player);
  const labSpeedMultiplier = labDef.speedMultiplier || RESEARCH_LAB_SPEED_MULTIPLIER;
  const labTimeMultiplier = labDef.timeMultiplier || 1;
  
  const time = calculateTheoreticalResearchTime(
    tech,
    nextLevelToQueue - 1,
    planet.buildings.researchLab || 0,
    researchSpeedBonus,
    configMultiplier,
    labSpeedMultiplier,
    labTimeMultiplier
  );
  
  // Calculate timing
  let startTime, endTime;
  if (!player.researchQueue || player.researchQueue.length === 0) {
    startTime = Date.now();
    endTime = startTime + (time * 1000);
  } else {
    const previousItem = player.researchQueue[player.researchQueue.length - 1];
    startTime = previousItem.endTime;
    endTime = startTime + (time * 1000);
  }
  
  // Create queue item
  const item = {
    id: generateId(),
    type: 'theoretical',
    techKey,
    level: nextLevelToQueue,
    startTime: startTime,
    duration: time * 1000,
    endTime: endTime,
    planetId,
    cost,
    progress: 0
  };
  
  player.researchQueue.push(item);

  return item;
}

/**
 * Complete theoretical research
 */
export async function completeTheoreticalResearch(player, queueItemId) {
  const index = player.researchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) throw new Error('Research queue item not found');
  
  const item = player.researchQueue[index];
  player.research[item.techKey] = item.level;
  
  // Log the event
  await logEvent('RESEARCH_COMPLETE', { 
      username: player.username, 
      research: item.techKey, 
      level: item.level 
  });

  player.researchQueue.splice(index, 1);
  
  return item;
}

/**
 * Cancel theoretical research
 */
export function cancelTheoreticalResearch(player, queueItemId, planetId) {
  const index = player.researchQueue.findIndex(item => item.id === queueItemId);
  if (index === -1) throw new Error('Research queue item not found');
  
  const item = player.researchQueue[index];
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');
  
  const refund = {};
  for (const resource in item.cost) {
    refund[resource] = Math.floor(item.cost[resource] * 0.9);
    planet.resources[resource] += refund[resource];
  }
  
  closeResearchQueueGap(player.researchQueue, index);
  return refund;
}

/**
 * Start practical research with allocation
 */
export function startPracticalResearchWithAllocation(player, researchKey, allocation, planetId, strength = 0.5) {
  const PRACTICAL = getPracticalResearch();
  const practicalResearchConfig = Object.hasOwn(PRACTICAL, researchKey) ? PRACTICAL[researchKey] : null;
  if (!practicalResearchConfig) throw new Error(`No practical research available for ${researchKey}`);

  if (!allocation || typeof allocation !== 'object' || Array.isArray(allocation)) throw new Error('Invalid research allocation');
  if (!Number.isFinite(strength) || strength < 0 || strength > 1) throw new Error('Research strength must be between 0 and 1');

  const baseType = practicalResearchConfig.baseType;

  // Validate allocation
  let allocationSum = 0;
  const allocationEntries = Object.entries(allocation);
  if (allocationEntries.length === 0) throw new Error('Invalid research allocation');
  for (const [focus, value] of allocationEntries) {
    if (!Object.hasOwn(practicalResearchConfig.focusModifiers, focus)) throw new Error(`Invalid research focus: ${focus}`);
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error('Research allocation values must be between 0 and 1');
    allocationSum += value;
  }
  if (Math.abs(allocationSum - 1) > 0.01) throw new Error(`Allocation must sum to 100%`);
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');

  if (player.practicalResearchQueue && player.practicalResearchQueue.length >= getResearchQueueSize()) {
    throw new Error(`Research queue is full`);
  }
  
  if (!planet.buildings.researchLab || planet.buildings.researchLab === 0) {
    throw new Error('No research lab available');
  }
  
  // Initialize tree if not exists
  if (!player.practicalResearch) player.practicalResearch = {};
  if (!player.practicalResearch[baseType]) {
    player.practicalResearch[baseType] = {
      experience: { output: 0, automation: 0, energy: 0, cost: 0 },
      treeBonus: 1.0
    };
  }

  // Cost calculation
  const currentExp = player.practicalResearch[baseType].experience;
  let totalFocusLevel = 0;
  for (const focus in currentExp) totalFocusLevel += Math.floor(Math.sqrt(currentExp[focus] / 100));
  
  const cost = calculatePracticalResearchCost(practicalResearchConfig.baseCost, totalFocusLevel, allocation, strength);
  
  for (const resource in cost) {
    if (planet.resources[resource] < cost[resource]) throw new Error(`Insufficient ${resource}`);
  }
  
  for (const resource in cost) planet.resources[resource] -= cost[resource];
  
  const researchSpeedBonus = getResearchBonus(player.research, 'globalResearchSpeed');
  const configMultiplier = getResearchTimeMultiplier();
  const labDef = getEffectiveBuildingDefinition('researchLab', planet, player);
  const labSpeedMultiplier = labDef.speedMultiplier || RESEARCH_LAB_SPEED_MULTIPLIER;
  const labTimeMultiplier = labDef.timeMultiplier || 1;
  const time = calculatePracticalResearchTime(practicalResearchConfig, totalFocusLevel, planet.buildings.researchLab || 1, researchSpeedBonus, configMultiplier, strength, allocation, labSpeedMultiplier, labTimeMultiplier);
  
  let startTime, endTime;
  if (!player.practicalResearchQueue || player.practicalResearchQueue.length === 0) {
    startTime = Date.now();
    endTime = startTime + (time * 1000);
  } else {
    const previousItem = player.practicalResearchQueue[player.practicalResearchQueue.length - 1];
    startTime = previousItem.endTime;
    endTime = startTime + (time * 1000);
  }
  
  const item = {
    id: generateId(),
    type: 'practical',
    baseType,
    itemType: practicalResearchConfig.type,
    allocation: { ...allocation },
    strength,
    startTime,
    duration: time * 1000,
    endTime,
    planetId,
    cost,
    progress: 0
  };
  
  if (!player.practicalResearchQueue) player.practicalResearchQueue = [];
  player.practicalResearchQueue.push(item);

  return item;
}

/**
 * Complete practical research
 */
export async function completePracticalResearch(player, queueItemId, now = Date.now()) {
  const index = (player.practicalResearchQueue || []).findIndex(item => item.id === queueItemId);
  if (index === -1) throw new Error('Practical research queue item not found');
  
  const item = player.practicalResearchQueue[index];
  const baseType = item.baseType;

  if (!player.practicalResearch) player.practicalResearch = {};
  if (!player.practicalResearch[baseType]) {
    player.practicalResearch[baseType] = {
      experience: { output: 0, automation: 0, energy: 0, cost: 0 },
      treeBonus: 1.0,
      history: []
    };
  }

  const tree = player.practicalResearch[baseType];

  // Ensure data integrity
  if (!tree.experience) tree.experience = { output: 0, automation: 0, energy: 0, cost: 0 };
  if (tree.bankedBreakthroughs === undefined) tree.bankedBreakthroughs = 0;
  if (tree.currentBreakthroughs === undefined) tree.currentBreakthroughs = 0;

  // New Breakthrough-based bonus (2% per banked breakthrough)
  // This replaces the old levelBonus (+1% per total focus level)
  const breakthroughMultiplier = 1 + (tree.bankedBreakthroughs * 0.02);

  const outcome = rollResearchOutcome();
  
  // Base XP gain scales linearly with actual strength (10 to 1M)
  const actualStrength = Math.pow(10, 1 + item.strength * 5);
  const baseGain = actualStrength * 10; 
  const totalXpGain = Math.floor(baseGain * outcome.multiplier * breakthroughMultiplier);

  const distribution = item.allocation || { output: 1.0 };
  const gains = {};
  for (const focus in distribution) {
    const share = distribution[focus];
    if (share > 0) {
      const focusGain = Math.floor(totalXpGain * share);
      tree.experience[focus] = (tree.experience[focus] || 0) + focusGain;
      gains[focus] = focusGain;
    }
  }

  // Increment breakthroughs for the current run
  if (outcome.type === 'breakthrough') {
    tree.currentBreakthroughs++;
  }

  const logEntry = {
    id: generateId(),
    timestamp: now,
    type: outcome.type,
    xpGain: totalXpGain,
    focusGains: gains,
    strength: item.strength,
    allocation: item.allocation
  };
  
  // Save to external history file
  await addResearchHistoryEntry(player.userId, baseType, logEntry);

  // Log the event
  await logEvent('RESEARCH_COMPLETE', { 
      username: player.username, 
      research: baseType + ' (Practical)', 
      level: tree.bankedBreakthroughs + 1 // Approximation
  });

  // Store only the last result in the player object to avoid bloating
  tree.lastResult = logEntry;

  player.practicalResearchQueue.splice(index, 1);
  return logEntry;
}

/**
 * Cancel practical research
 */
export function cancelPracticalResearch(player, queueItemId, planetId) {
  const index = (player.practicalResearchQueue || []).findIndex(item => item.id === queueItemId);
  if (index === -1) throw new Error('Practical research queue item not found');
  
  const item = player.practicalResearchQueue[index];
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');
  
  const refund = {};
  for (const resource in item.cost) {
    refund[resource] = Math.floor(item.cost[resource] * 0.9);
    planet.resources[resource] += refund[resource];
  }
  
  closeResearchQueueGap(player.practicalResearchQueue, index);
  return refund;
}

/**
 * Reset practical research for an item to bank breakthroughs
 */
export function resetPracticalResearch(player, baseType) {
  if (!player.practicalResearch || !Object.hasOwn(player.practicalResearch, baseType)) {
    throw new Error('Research for this item not found');
  }

  const tree = player.practicalResearch[baseType];
  const breakthroughsToBank = tree.currentBreakthroughs || 0;

  let hasExperience = false;
  if (tree.experience) {
    for (const k in tree.experience) {
      if (tree.experience[k] > 0) {
        hasExperience = true;
        break;
      }
    }
  }

  if (breakthroughsToBank === 0 && !hasExperience) {
    throw new Error('No progress to reset');
  }

  // Bank breakthroughs from the last run
  tree.bankedBreakthroughs = breakthroughsToBank;
  
  // Reset current run
  tree.currentBreakthroughs = 0;
  tree.experience = { output: 0, automation: 0, energy: 0, cost: 0 };

  return {
    baseType,
    bankedBreakthroughs: tree.bankedBreakthroughs,
    message: `Research for ${baseType} reset. Now gaining +${(tree.bankedBreakthroughs * 2).toFixed(0)}% research speed.`
  };
}

/**
 * Get all available practical research options
 */
export function getAvailablePracticalResearchForPlayer(player, planetId) {
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) return {};
  return getAvailablePracticalResearch(planet.buildings);
}

/**
 * Select or update a custom building variant
 */
export function selectCustomBuildingVariant(player, planetId, baseType, focusLevels) {
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');
  if (typeof baseType !== 'string' || !Object.hasOwn(BUILDINGS, baseType)) throw new Error('Invalid building type');
  if (!planet.buildings[baseType] || planet.buildings[baseType] === 0) throw new Error(`Building not available`);
  
  const practical = getPracticalResearch();
  let researchConfig = null;
  for (const k in practical) {
    if (practical[k].baseType === baseType && practical[k].type === 'building') {
      researchConfig = practical[k];
      break;
    }
  }
  if (!researchConfig) throw new Error(`No practical research available for ${baseType}`);
  
  const currentExp = player.practicalResearch?.[baseType]?.experience || { output: 0, automation: 0, energy: 0, cost: 0 };
  const validatedFocusLevels = validateFocusLevels(researchConfig, focusLevels, currentExp);
  
  if (!player.customBuildingVariants) player.customBuildingVariants = {};
  
  const modifiers = calculateFocusModifiers(researchConfig, validatedFocusLevels);
  const customized = applyCustomization(BUILDINGS[baseType], modifiers);
  
  player.customBuildingVariants[baseType] = { focusLevels: validatedFocusLevels, modifiers, customDefinition: customized };
  return player.customBuildingVariants[baseType];
}

export function getActiveBuildingVariant(player, planetId, baseType) {
  const variant = player.customBuildingVariants?.[baseType];
  return variant ? variant.customDefinition : BUILDINGS[baseType];
}

export function getResearchProgress(player, now = Date.now()) {
  const theoretical = (player.researchQueue || []).map(item => ({
    ...item,
    progress: Math.min(100, Math.floor(((now - item.startTime) / item.duration) * 100)),
    timeRemaining: Math.max(0, item.endTime - now)
  }));
  
  const practical = (player.practicalResearchQueue || []).map(item => ({
    ...item,
    progress: Math.min(100, Math.floor(((now - item.startTime) / item.duration) * 100)),
    timeRemaining: Math.max(0, item.endTime - now)
  }));
  
  return { theoretical, practical };
}

/**
 * Materialize completed research before a request reads or mutates the queue.
 */
export async function processCompletedResearch(player, now = Date.now()) {
  let updated = false;

  while (player.researchQueue && player.researchQueue.length > 0) {
    const item = player.researchQueue[0];
    if (item.endTime > now) break;

    await completeTheoreticalResearch(player, item.id);
    const planet = player.planets.find(p => p.id === item.planetId);
    if (planet) planet.lastActivity = now;

    if (player.researchQueue.length > 0) {
      const nextItem = player.researchQueue[0];
      nextItem.startTime = item.endTime;
      nextItem.endTime = nextItem.startTime + nextItem.duration;
    }
    updated = true;
  }

  while (player.practicalResearchQueue && player.practicalResearchQueue.length > 0) {
    const item = player.practicalResearchQueue[0];
    if (item.endTime > now) break;

    await completePracticalResearch(player, item.id, now);
    const planet = player.planets.find(p => p.id === item.planetId);
    if (planet) planet.lastActivity = now;

    if (player.practicalResearchQueue.length > 0) {
      const nextItem = player.practicalResearchQueue[0];
      nextItem.startTime = item.endTime;
      nextItem.endTime = nextItem.startTime + nextItem.duration;
    }
    updated = true;
  }

  return updated;
}

export function getTheoreticalResearchLevels(player) { return player.research || {}; }
export function getPracticalResearchProgress(player) { return player.practicalResearch || {}; }
export function getActiveCustomVariants(player, planetId) { return player.customBuildingVariants || {}; }
