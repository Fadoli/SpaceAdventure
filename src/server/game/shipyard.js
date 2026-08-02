// Shipyard production system

import { calculateShipCost, calculateShipBuildTime, SHIPS } from '../../shared/ships.js';
import { DEFENSES, calculateDefenseCost, calculateDefenseBuildTime } from '../../shared/defenses.js';
import { getResearchBonus } from '../../shared/research.js';
import { getShipBuildTimeMultiplier } from '../config.js';
import { getEffectiveBuildingDefinition } from './buildings.js';
import { BUILDING_SPEED_MULTIPLIER } from '../../shared/constants.js';

function validateBuildOrder(order, definitions, label) {
  if (!order || typeof order !== 'object' || Array.isArray(order) || Object.keys(order).length === 0) {
    throw new Error(`No ${label} selected`);
  }

  for (const [key, quantity] of Object.entries(order)) {
    if (!Object.hasOwn(definitions, key)) throw new Error(`Unknown ${label}: ${key}`);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error(`${label} quantity must be a positive integer`);
  }
}

/**
 * Add ships to build queue
 */
export function buildShips(planet, player, ships, shipyardLevel, roboticsLevel = 0, naniteLevel = 0) {
  validateBuildOrder(ships, SHIPS, 'ship');

  if (!planet.shipQueue) {
    planet.shipQueue = [];
  }

  let totalCost = { metal: 0, crystal: 0, deuterium: 0 };
  let totalBuildTime = 0;

  // Research bonuses
  const costReductionBonus = getResearchBonus(player?.research, 'globalCostReduction');
  const timeReductionBonus = getResearchBonus(player?.research, 'globalTimeReduction');
  const shipyardDef = getEffectiveBuildingDefinition('shipyard', planet, player);
  const naniteDef = getEffectiveBuildingDefinition('naniteFactory', planet, player);
  const blueprintTimeMultiplier = (shipyardDef.timeMultiplier || 1) * (naniteDef.timeMultiplier || 1);

  // ships object can now contain either base ship keys or blueprint IDs
  // Format: { "smallCargo": 5, "sbp_12345": 2 }
  
  for (const shipKey in ships) {
    const quantity = ships[shipKey];
    if (quantity <= 0) continue;

    const cost = calculateShipCost(shipKey, quantity, costReductionBonus);

    totalCost.metal += cost.metal;
    totalCost.crystal += cost.crystal;
    totalCost.deuterium += cost.deuterium;

    // Keep the authoritative ship timing formula in shared code.
    const buildTime = calculateShipBuildTime(shipKey, quantity, shipyardLevel, naniteLevel, timeReductionBonus, blueprintTimeMultiplier);
    totalBuildTime = Math.max(totalBuildTime, buildTime);
  }

  // Check if can afford
  if (planet.resources.metal < totalCost.metal ||
      planet.resources.crystal < totalCost.crystal ||
      planet.resources.deuterium < totalCost.deuterium) {
    throw new Error('Insufficient resources');
  }

  // Deduct resources
  planet.resources.metal -= totalCost.metal;
  planet.resources.crystal -= totalCost.crystal;
  planet.resources.deuterium -= totalCost.deuterium;

  // Apply config multiplier
  const configMultiplier = getShipBuildTimeMultiplier();
  const effectiveBuildTime = totalBuildTime * configMultiplier;
  const startTime = Math.max(Date.now(), planet.shipQueue.at(-1)?.finishTime || 0);
  const finishTime = startTime + (effectiveBuildTime * 1000);

  // Add to queue
  const queueItem = {
    id: Math.random().toString(36).substr(2, 9),
    ships,
    cost: totalCost,
    startTime,
    finishTime,
    buildTime: effectiveBuildTime,
    queuePosition: planet.shipQueue.length + 1
  };

  planet.shipQueue.push(queueItem);

  // Update queue positions
  planet.shipQueue.forEach((item, index) => {
    item.queuePosition = index + 1;
  });

  return queueItem;
}

/**
 * Add defenses to build queue
 */
export function buildDefenses(planet, player, defenses, shipyardLevel = 0, roboticsLevel = 0, naniteLevel = 0) {
  validateBuildOrder(defenses, DEFENSES, 'defense');

  if (!planet.defenseQueue) {
    planet.defenseQueue = [];
  }

  let totalCost = { metal: 0, crystal: 0, deuterium: 0 };
  let totalBuildTime = 0;

  // Research bonuses
  const costReductionBonus = getResearchBonus(player?.research, 'globalCostReduction');
  const timeReductionBonus = getResearchBonus(player?.research, 'globalTimeReduction');
  const shipyardDef = getEffectiveBuildingDefinition('shipyard', planet, player);
  const naniteDef = getEffectiveBuildingDefinition('naniteFactory', planet, player);
  const blueprintTimeMultiplier = (shipyardDef.timeMultiplier || 1) * (naniteDef.timeMultiplier || 1);

  // Validate and calculate costs
  for (const defenseKey in defenses) {
    const quantity = defenses[defenseKey];
    if (quantity <= 0) continue;

    const cost = calculateDefenseCost(defenseKey, quantity, costReductionBonus);
    totalCost.metal += cost.metal;
    totalCost.crystal += cost.crystal;
    totalCost.deuterium += cost.deuterium;

    const shipyardSpeedMultiplier = shipyardDef.speedMultiplier || BUILDING_SPEED_MULTIPLIER;
    const buildTime = calculateDefenseBuildTime(defenseKey, quantity, shipyardLevel, naniteLevel, timeReductionBonus, shipyardSpeedMultiplier, blueprintTimeMultiplier);
    totalBuildTime = Math.max(totalBuildTime, buildTime); // Take the max since they build in parallel
  }

  // Check if can afford
  if (planet.resources.metal < totalCost.metal ||
      planet.resources.crystal < totalCost.crystal ||
      planet.resources.deuterium < totalCost.deuterium) {
    throw new Error('Insufficient resources');
  }

  // Deduct resources
  planet.resources.metal -= totalCost.metal;
  planet.resources.crystal -= totalCost.crystal;
  planet.resources.deuterium -= totalCost.deuterium;

  // Apply config multiplier
  const configMultiplier = getShipBuildTimeMultiplier();
  const effectiveBuildTime = totalBuildTime * configMultiplier;
  const startTime = Math.max(Date.now(), planet.defenseQueue.at(-1)?.finishTime || 0);
  const finishTime = startTime + (effectiveBuildTime * 1000);

  // Add to queue
  const queueItem = {
    id: Math.random().toString(36).substr(2, 9),
    defenses,
    cost: totalCost,
    startTime,
    finishTime,
    buildTime: effectiveBuildTime,
    queuePosition: planet.defenseQueue.length + 1
  };

  planet.defenseQueue.push(queueItem);

  // Update queue positions
  planet.defenseQueue.forEach((item, index) => {
    item.queuePosition = index + 1;
  });

  return queueItem;
}

/**
 * Cancel ship or defense in queue
 */
export function cancelProduction(planet, queueId, type = 'ships') {
  if (!['ships', 'defenses'].includes(type)) {
    throw new Error('Invalid production type');
  }

  const queue = type === 'ships' ? planet.shipQueue : planet.defenseQueue;
  if (!queue) return null;

  const index = queue.findIndex(item => item.id === queueId);
  if (index === -1) return null;

  const item = queue[index];

  // Refund 90% of resources
  const refundMultiplier = 0.9;

  const chargedCost = item.cost || { metal: 0, crystal: 0, deuterium: 0 };

  if (!item.cost && item.ships) {
    for (const shipKey in item.ships) {
      const quantity = item.ships[shipKey];
      const cost = calculateShipCost(shipKey, quantity);
      chargedCost.metal += cost.metal;
      chargedCost.crystal += cost.crystal;
      chargedCost.deuterium += cost.deuterium;
    }
  }

  if (!item.cost && item.defenses) {
    for (const defenseKey in item.defenses) {
      const quantity = item.defenses[defenseKey];
      const cost = calculateDefenseCost(defenseKey, quantity);
      chargedCost.metal += cost.metal;
      chargedCost.crystal += cost.crystal;
      chargedCost.deuterium += cost.deuterium;
    }
  }

  for (const resource of ['metal', 'crystal', 'deuterium']) {
    planet.resources[resource] += Math.floor((chargedCost[resource] || 0) * refundMultiplier);
  }

  // Remove from queue
  queue.splice(index, 1);

  // Update queue positions and close the gap left by the cancelled order.
  queue.forEach((qItem, idx) => {
    qItem.queuePosition = idx + 1;
    if (idx < index) return;

    const duration = qItem.finishTime - qItem.startTime;
    qItem.startTime = idx === 0 ? Date.now() : queue[idx - 1].finishTime;
    qItem.finishTime = qItem.startTime + duration;
  });

  return item;
}

/**
 * Process completed ship/defense production
 */
export function processCompletedProduction(planet, now = Date.now()) {
  let anyCompleted = false;

  // Process ship queue
  while (planet.shipQueue && planet.shipQueue.length > 0) {
    const firstShip = planet.shipQueue[0];
    if (firstShip.finishTime <= now) {
      // Add ships to planet
      if (!planet.ships) {
        planet.ships = {};
      }

      for (const shipKey in firstShip.ships) {
        const quantity = firstShip.ships[shipKey];
        planet.ships[shipKey] = (planet.ships[shipKey] || 0) + quantity;
      }

      // Remove from queue
      planet.shipQueue.shift();

      // Update queue positions
      planet.shipQueue.forEach((item, index) => {
        item.queuePosition = index + 1;
      });

      // Update activity timestamp when ships complete
      planet.lastActivity = now;
      anyCompleted = true;
    } else {
      break;
    }
  }

  // Process defense queue
  while (planet.defenseQueue && planet.defenseQueue.length > 0) {
    const firstDefense = planet.defenseQueue[0];
    if (firstDefense.finishTime <= now) {
      // Add defenses to planet
      if (!planet.defenses) {
        planet.defenses = {};
      }

      for (const defenseKey in firstDefense.defenses) {
        const quantity = firstDefense.defenses[defenseKey];
        planet.defenses[defenseKey] = (planet.defenses[defenseKey] || 0) + quantity;
      }

      // Remove from queue
      planet.defenseQueue.shift();

      // Update queue positions
      planet.defenseQueue.forEach((item, index) => {
        item.queuePosition = index + 1;
      });

      // Update activity timestamp when defenses complete
      planet.lastActivity = now;
      anyCompleted = true;
    } else {
      break;
    }
  }

  return anyCompleted;
}

/**
 * Get shipyard details for a planet
 */
export function getShipyardDetails(planet, player = null) {
  if (!planet.shipQueue) {
    planet.shipQueue = [];
  }
  if (!planet.defenseQueue) {
    planet.defenseQueue = [];
  }
  if (!planet.ships) {
    planet.ships = {};
  }
  if (!planet.defenses) {
    planet.defenses = {};
  }

  const shipyardLevel = planet.buildings?.shipyard || 0;
  const roboticsLevel = planet.buildings?.roboticsFactory || 0;
  const naniteLevel = planet.buildings?.naniteFactory || 0;
  const shipyardDef = getEffectiveBuildingDefinition('shipyard', planet, player);
  const naniteDef = getEffectiveBuildingDefinition('naniteFactory', planet, player);

  return {
    planetId: planet.id,
    shipyardLevel,
    roboticsLevel,
    naniteLevel,
    costReductionBonus: getResearchBonus(player?.research, 'globalCostReduction'),
    timeReductionBonus: getResearchBonus(player?.research, 'globalTimeReduction'),
    productionTimeMultiplier: (shipyardDef.timeMultiplier || 1) * (naniteDef.timeMultiplier || 1),
    ships: planet.ships,
    defenses: planet.defenses,
    shipQueue: planet.shipQueue.map(item => ({
      ...item,
      ships: item.ships || {},
      defenses: item.defenses || {},
      queuePosition: item.queuePosition,
      finishTime: item.finishTime,
      timeRemaining: Math.max(0, item.finishTime - Date.now())
    })),
    defenseQueue: planet.defenseQueue.map(item => ({
      ...item,
      ships: item.ships || {},
      defenses: item.defenses || {},
      queuePosition: item.queuePosition,
      finishTime: item.finishTime,
      timeRemaining: Math.max(0, item.finishTime - Date.now())
    }))
  };
}
