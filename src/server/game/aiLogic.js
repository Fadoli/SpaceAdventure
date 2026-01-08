// AI Decision making logic
import { AI_TYPES, BUILDINGS } from '../../shared/constants.js';
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { upgradeBuilding } from './buildings.js';
import { buildShips, buildDefenses } from './shipyard.js';
import { updatePlayer } from './player.js';

/**
 * Process a single AI player's turn
 */
export async function processAiPlayer(player) {
  if (!player.isAI) return false;
  
  const now = Date.now();
  if (now < player.aiConfig.nextAction) return false;
  
  let updated = false;
  
  // Decide what to do based on archetype
  switch (player.aiConfig.archetype) {
    case AI_TYPES.AGGRESSIVE:
      updated = await handleAggressiveStrategy(player);
      break;
    case AI_TYPES.DEFENSIVE:
      updated = await handleDefensiveStrategy(player);
      break;
    case AI_TYPES.RAIDER:
      updated = await handleRaiderStrategy(player);
      break;
    case AI_TYPES.BALANCED:
    case AI_TYPES.TUTORIAL:
    default:
      updated = await handleBalancedStrategy(player);
      break;
  }
  
  // Set next action time (random delay between 5-15 minutes for realism)
  const delay = (Math.random() * 600 + 300) * 1000; 
  player.aiConfig.nextAction = now + delay;
  player.aiConfig.lastAction = now;
  
  if (updated) {
    await updatePlayer(player.userId, player);
  }
  
  return updated;
}

/**
 * Helper to try upgrading a building
 */
async function tryBuild(player, planet, buildingKey) {
  try {
    await upgradeBuilding(player.userId, planet.id, buildingKey);
    console.log(`[AI] ${player.username} started building ${buildingKey} on ${planet.name}`);
    return true;
  } catch (e) {
    // Ignore errors (insufficient resources, etc)
    return false;
  }
}

/**
 * Helper to try building ships
 */
async function tryBuildShips(player, planet, shipKey, count = 1) {
  try {
    const shipyardLevel = planet.buildings.shipyard || 0;
    if (shipyardLevel === 0) return false;
    
    // Check if queue is full
    if (planet.shipQueue && planet.shipQueue.length >= 5) return false;

    buildShips(planet, player, { [shipKey]: count }, shipyardLevel, planet.buildings.roboticsFactory || 0, planet.buildings.naniteFactory || 0);
    console.log(`[AI] ${player.username} queued ${count}x ${shipKey} on ${planet.name}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Helper to try building defenses
 */
async function tryBuildDefenses(player, planet, defenseKey, count = 1) {
  try {
    const shipyardLevel = planet.buildings.shipyard || 0;
    if (shipyardLevel === 0) return false;
    
    // Check if queue is full
    if (planet.defenseQueue && planet.defenseQueue.length >= 5) return false;

    buildDefenses(planet, player, { [defenseKey]: count }, shipyardLevel, planet.buildings.roboticsFactory || 0, planet.buildings.naniteFactory || 0);
    console.log(`[AI] ${player.username} queued ${count}x ${defenseKey} on ${planet.name}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Balanced strategy: build resources first, then tech/research
 */
async function handleBalancedStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    if (planet.buildQueue && planet.buildQueue.length > 0) continue;
    
    const buildings = planet.buildings || {};
    
    // Keep solar plant ahead
    const solarLevel = buildings[BUILDINGS.SOLAR_PLANT] || 0;
    const metalLevel = buildings[BUILDINGS.METAL_MINE] || 0;
    
    if (solarLevel <= metalLevel) {
      if (await tryBuild(player, planet, BUILDINGS.SOLAR_PLANT)) {
        changed = true;
        continue;
      }
    }
    
    // Priority list
    const priorities = [
      BUILDINGS.METAL_MINE,
      BUILDINGS.CRYSTAL_MINE,
      BUILDINGS.DEUTERIUM_SYNTHESIZER,
      BUILDINGS.ROBOTICS_FACTORY,
      BUILDINGS.SHIPYARD,
      BUILDINGS.RESEARCH_LAB
    ];
    
    // Find lowest level building from priorities
    let target = priorities[0];
    let minLevel = 999;
    
    for (const p of priorities) {
      const lvl = buildings[p] || 0;
      if (lvl < minLevel) {
        minLevel = lvl;
        target = p;
      }
    }
    
    if (await tryBuild(player, planet, target)) {
      changed = true;
    }
  }
  
  return changed;
}

/**
 * Aggressive strategy: Prioritize military infrastructure and ships
 */
async function handleAggressiveStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    const buildings = planet.buildings || {};
    
    // 1. Prioritize Shipyard
    const shipyardLevel = buildings[BUILDINGS.SHIPYARD] || 0;
    const metalLevel = buildings[BUILDINGS.METAL_MINE] || 0;
    
    // Ensure basic resources first
    if (metalLevel < 5) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.SOLAR_PLANT)) {
        changed = true;
        continue;
      }
    }
    
    // Push shipyard
    if (shipyardLevel < 8 && (!planet.buildQueue || planet.buildQueue.length === 0)) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) {
        changed = true;
        continue;
      }
    }
    
    // Build Ships
    const shipPriorities = ['battleship', 'cruiser', 'heavyFighter', 'lightFighter'];
    for (const shipKey of shipPriorities) {
      // Simple logic: try to build 1 of the strongest ship possible
      if (await tryBuildShips(player, planet, shipKey, 1)) {
        changed = true;
        break; // One ship order per turn per planet
      }
    }
    
    // Fallback to resources if nothing else
    if (!changed && (!planet.buildQueue || planet.buildQueue.length === 0)) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE)) {
        changed = true;
      }
    }
  }
  
  return changed;
}

/**
 * Defensive strategy: Turtle up
 */
async function handleDefensiveStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    const buildings = planet.buildings || {};
    
    // Ensure basic resources
    if ((buildings[BUILDINGS.METAL_MINE] || 0) < 5) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.SOLAR_PLANT)) {
        changed = true;
        continue;
      }
    }
    
    // Build Defenses
    const defensePriorities = ['plasmaTurret', 'shield', 'laserCannon', 'rocketLauncher'];
    for (const defKey of defensePriorities) {
      if (await tryBuildDefenses(player, planet, defKey, 1)) {
        changed = true;
        break;
      }
    }
    
    // If shipyard is too low to build defenses, upgrade it
    if (!changed && (!planet.buildQueue || planet.buildQueue.length === 0)) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) {
        changed = true;
        continue;
      }
      
      // Otherwise resources
      if (await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.METAL_MINE)) {
        changed = true;
      }
    }
  }
  
  return changed;
}

/**
 * Raider strategy: Fast ships, resources
 */
async function handleRaiderStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    // Prioritize light fighters and small cargo
    if (await tryBuildShips(player, planet, 'lightFighter', 5)) {
      changed = true;
    } else if (await tryBuildShips(player, planet, 'smallCargo', 2)) {
      changed = true;
    }
    
    if (!changed && (!planet.buildQueue || planet.buildQueue.length === 0)) {
      // Build infrastructure
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.DEUTERIUM_SYNTHESIZER)) {
        changed = true;
      }
    }
  }
  
  return changed;
}
