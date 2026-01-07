// Shipyard production system

import { getShip, calculateShipCost, calculateShipBuildTime, calculateShipSpeed, SHIPS } from '../../shared/ships.js';
import { getDefense, calculateDefenseCost, calculateDefenseBuildTime } from '../../shared/defenses.js';
import { getResearchBonus } from '../../shared/research.js';
import { getShipBuildTimeMultiplier } from '../config.js';
import { calculateBaseTime } from '../../shared/time.js';
import { trackSpentResources } from './player.js';

/**
 * Add ships to build queue
 */
export function buildShips(planet, player, ships, shipyardLevel, roboticsLevel = 0, naniteLevel = 0) {
  if (!planet.shipQueue) {
    planet.shipQueue = [];
  }

  let totalCost = { metal: 0, crystal: 0, deuterium: 0 };
  let totalBuildTime = 0;

  // Research bonuses
  const costReductionBonus = getResearchBonus(player?.research, 'globalCostReduction');
  const timeReductionBonus = getResearchBonus(player?.research, 'globalTimeReduction');

  // ships object can now contain either base ship keys or blueprint IDs
  // Format: { "smallCargo": 5, "sbp_12345": 2 }
  
  for (const identifier in ships) {
    const quantity = ships[identifier];
    if (quantity <= 0) continue;

    let shipDef;
    let shipKey = identifier;

    // Check if it's a blueprint
    if (identifier.startsWith('sbp_')) {
      // Find blueprint in player data
      let blueprint = null;
      for (const key in player.shipBlueprints || {}) {
        blueprint = player.shipBlueprints[key].find(bp => bp.id === identifier);
        if (blueprint) {
          shipKey = key;
          break;
        }
      }
      if (!blueprint) throw new Error(`Unknown blueprint: ${identifier}`);
      shipDef = blueprint.customDefinition;
    } else {
      shipDef = SHIPS[identifier];
    }

    if (!shipDef) {
      throw new Error(`Unknown ship type: ${identifier}`);
    }

    // Calculate cost based on the specific definition
    const baseCost = shipDef.baseCost;
    const cost = {
      metal: Math.floor(baseCost.metal * quantity * (1 - costReductionBonus)),
      crystal: Math.floor(baseCost.crystal * quantity * (1 - costReductionBonus)),
      deuterium: Math.floor(baseCost.deuterium * quantity * (1 - costReductionBonus))
    };

    totalCost.metal += cost.metal;
    totalCost.crystal += cost.crystal;
    totalCost.deuterium += cost.deuterium;

    // Calculate build time
    const baseTime = calculateBaseTime(shipDef) * quantity;
    const speedFactor = 2500; // units/hr
    const timeInSeconds = (baseTime / speedFactor) * 3600;
    const shipyardMultiplier = Math.pow(0.85, shipyardLevel);
    const naniteMultiplier = Math.pow(2, naniteLevel);
    
    const buildTime = Math.max(1, Math.floor((timeInSeconds * shipyardMultiplier * (1 - timeReductionBonus) / naniteMultiplier)));
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

  // Track spending for ranking
  if (player) trackSpentResources(player, totalCost);

  // Apply config multiplier
  const configMultiplier = getShipBuildTimeMultiplier();
  const effectiveBuildTime = totalBuildTime * configMultiplier;
  const finishTime = Date.now() + (effectiveBuildTime * 1000);

  // Add to queue
  const queueItem = {
    id: Math.random().toString(36).substr(2, 9),
    ships,
    startTime: Date.now(),
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
  if (!planet.defenseQueue) {
    planet.defenseQueue = [];
  }

  let totalCost = { metal: 0, crystal: 0, deuterium: 0 };
  let totalBuildTime = 0;

  // Research bonuses
  const costReductionBonus = getResearchBonus(player?.research, 'globalCostReduction');
  const timeReductionBonus = getResearchBonus(player?.research, 'globalTimeReduction');

  // Validate and calculate costs
  for (const defenseKey in defenses) {
    const quantity = defenses[defenseKey];
    if (quantity <= 0) continue;

    const defense = getDefense(defenseKey);
    if (!defense) {
      throw new Error(`Unknown defense: ${defenseKey}`);
    }

    const cost = calculateDefenseCost(defenseKey, quantity, costReductionBonus);
    totalCost.metal += cost.metal;
    totalCost.crystal += cost.crystal;
    totalCost.deuterium += cost.deuterium;

    const buildTime = calculateDefenseBuildTime(defenseKey, quantity, shipyardLevel, naniteLevel, timeReductionBonus);
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

  // Track spending for ranking
  if (player) trackSpentResources(player, totalCost);

  // Apply config multiplier
  const configMultiplier = getShipBuildTimeMultiplier();
  const effectiveBuildTime = totalBuildTime * configMultiplier;
  const finishTime = Date.now() + (effectiveBuildTime * 1000);

  // Add to queue
  const queueItem = {
    id: Math.random().toString(36).substr(2, 9),
    defenses,
    startTime: Date.now(),
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
  const queue = type === 'ships' ? planet.shipQueue : planet.defenseQueue;
  if (!queue) return null;

  const index = queue.findIndex(item => item.id === queueId);
  if (index === -1) return null;

  const item = queue[index];

  // Refund 90% of resources
  const refundMultiplier = 0.9;

  if (item.ships) {
    for (const shipKey in item.ships) {
      const quantity = item.ships[shipKey];
      const cost = calculateShipCost(shipKey, quantity);
      planet.resources.metal += Math.floor(cost.metal * refundMultiplier);
      planet.resources.crystal += Math.floor(cost.crystal * refundMultiplier);
      planet.resources.deuterium += Math.floor(cost.deuterium * refundMultiplier);
    }
  }

  if (item.defenses) {
    for (const defenseKey in item.defenses) {
      const quantity = item.defenses[defenseKey];
      const cost = calculateDefenseCost(defenseKey, quantity);
      planet.resources.metal += Math.floor(cost.metal * refundMultiplier);
      planet.resources.crystal += Math.floor(cost.crystal * refundMultiplier);
      planet.resources.deuterium += Math.floor(cost.deuterium * refundMultiplier);
    }
  }

  // Remove from queue
  queue.splice(index, 1);

  // Update queue positions
  queue.forEach((qItem, idx) => {
    qItem.queuePosition = idx + 1;
  });

  return item;
}

/**
 * Process completed ship/defense production
 */
export function processCompletedProduction(planet) {
  const now = Date.now();

  // Process ship queue
  if (planet.shipQueue && planet.shipQueue.length > 0) {
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
      planet.lastActivity = Date.now();

      // Recursively process next items
      return processCompletedProduction(planet);
    }
  }

  // Process defense queue
  if (planet.defenseQueue && planet.defenseQueue.length > 0) {
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
      planet.lastActivity = Date.now();

      // Recursively process next items
      return processCompletedProduction(planet);
    }
  }
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

  // Calculate effective speeds if player is provided
  const effectiveSpeeds = {};
  const shipBlueprints = player?.shipBlueprints || {};
  if (player) {
    for (const shipKey in SHIPS) {
      effectiveSpeeds[shipKey] = calculateShipSpeed(shipKey, player.research);
    }
  }

  return {
    planetId: planet.id,
    shipyardLevel,
    roboticsLevel,
    naniteLevel,
    ships: planet.ships,
    defenses: planet.defenses,
    effectiveSpeeds,
    shipBlueprints,
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

/**
 * Create a new ship blueprint
 */
export async function createShipBlueprint(userId, baseType, focusLevels, name) {
  const { getPlayerByUserId, updatePlayer } = await import('./player.js');
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  if (!player.shipBlueprints) player.shipBlueprints = {};
  if (!player.shipBlueprints[baseType]) player.shipBlueprints[baseType] = [];

  const MAX_BLUEPRINTS = 5;
  if (player.shipBlueprints[baseType].length >= MAX_BLUEPRINTS) {
    throw new Error(`Maximum limit of ${MAX_BLUEPRINTS} blueprints reached for ${baseType}.`);
  }

  const practical = getPracticalResearch();
  let researchConfig = Object.values(practical).find(r => r.baseType === baseType && r.type === 'ship');
  if (!researchConfig) throw new Error('No practical research available for ' + baseType);

  // Validate focus levels
  for (const focus in focusLevels) {
    const level = focusLevels[focus];
    const currentExp = player.practicalResearch?.[baseType]?.experience?.[focus] || 0;
    const maxLevel = Math.floor(Math.sqrt(currentExp / 100));
    if (level > maxLevel) throw new Error('Focus level ' + level + ' exceeds research level ' + maxLevel);
  }

  const blueprintId = 'sbp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const modifiers = calculateFocusModifiers(researchConfig, focusLevels);
  const customDefinition = applyCustomization(SHIPS[baseType], modifiers);

  const blueprint = {
    id: blueprintId,
    name: name || (SHIPS[baseType].name + ' Variant ' + (player.shipBlueprints[baseType].length + 1)),
    baseType,
    focusLevels,
    modifiers,
    customDefinition,
    createdAt: Date.now()
  };

  player.shipBlueprints[baseType].push(blueprint);
  await updatePlayer(userId, player);
  return blueprint;
}

/**
 * Delete a ship blueprint
 */
export async function deleteShipBlueprint(userId, baseType, blueprintId) {
  const { getPlayerByUserId, updatePlayer } = await import('./player.js');
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  if (!player.shipBlueprints || !player.shipBlueprints[baseType]) {
    throw new Error('Blueprint not found');
  }

  const index = player.shipBlueprints[baseType].findIndex(bp => bp.id === blueprintId);
  if (index === -1) throw new Error('Blueprint not found');

  player.shipBlueprints[baseType].splice(index, 1);

  await updatePlayer(userId, player);
  return { success: true };
}
