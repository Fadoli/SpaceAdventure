// Shipyard production system

import { getShip, calculateShipCost, calculateShipBuildTime } from '../../shared/ships.js';
import { getDefense, calculateDefenseCost, calculateDefenseBuildTime } from '../../shared/defenses.js';
import { getShipBuildTimeMultiplier } from '../config.js';

/**
 * Add ships to build queue
 */
export function buildShips(planet, ships, shipyardLevel, roboticsLevel = 0, naniteLevel = 0) {
  if (!planet.shipQueue) {
    planet.shipQueue = [];
  }

  let totalCost = { metal: 0, crystal: 0, deuterium: 0 };
  let totalBuildTime = 0;

  // Validate and calculate costs
  for (const shipKey in ships) {
    const quantity = ships[shipKey];
    if (quantity <= 0) continue;

    const ship = getShip(shipKey);
    if (!ship) {
      throw new Error(`Unknown ship: ${shipKey}`);
    }

    const cost = calculateShipCost(shipKey, quantity);
    totalCost.metal += cost.metal;
    totalCost.crystal += cost.crystal;
    totalCost.deuterium += cost.deuterium;

    const buildTime = calculateShipBuildTime(shipKey, quantity, shipyardLevel, roboticsLevel, naniteLevel);
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
export function buildDefenses(planet, defenses, shipyardLevel = 0, roboticsLevel = 0, naniteLevel = 0) {
  if (!planet.defenseQueue) {
    planet.defenseQueue = [];
  }

  let totalCost = { metal: 0, crystal: 0, deuterium: 0 };
  let totalBuildTime = 0;

  // Validate and calculate costs
  for (const defenseKey in defenses) {
    const quantity = defenses[defenseKey];
    if (quantity <= 0) continue;

    const defense = getDefense(defenseKey);
    if (!defense) {
      throw new Error(`Unknown defense: ${defenseKey}`);
    }

    const cost = calculateDefenseCost(defenseKey, quantity);
    totalCost.metal += cost.metal;
    totalCost.crystal += cost.crystal;
    totalCost.deuterium += cost.deuterium;

    const buildTime = calculateDefenseBuildTime(defenseKey, quantity, shipyardLevel, roboticsLevel, naniteLevel);
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
export function getShipyardDetails(planet) {
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

  return {
    shipyardLevel,
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
