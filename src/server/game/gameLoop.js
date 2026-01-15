// Game tick system - processes game state periodically
import { getPlayers, savePlayers, takeRankingSnapshot, recomputePlayerScores } from './player.js';
import { processCompletedBuildings, updatePlanetProduction, processCompletedVariantSwitches } from './buildings.js';
import { processCompletedProduction } from './shipyard.js';
import { completeTheoreticalResearch, completePracticalResearch } from './researchLogic.js';
import { processFleets } from './fleet.js';
import { calculatePopulationChange } from '../../shared/formulas.js';
import { getResourceProductionMultiplier } from '../config.js';
import { CONFIG } from '../../shared/constants.js';
import { getAllAiPlayers } from './aiManager.js';
import { processAiPlayer } from './aiLogic.js';
import { spawnGhostPlanets, cleanupGhostPlanets } from './events.js';
import { readJsonFile } from '../storage/storage.js';
import { wsManager } from './wsManager.js';

let gameLoopInterval = null;
let lastSaveTime = 0;
let lastRankingSnapshotTime = 0;
let lastRecomputeTime = 0;
let lastGhostSpawnTime = 0;
let lastGhostCleanupTime = 0;

const SAVE_INTERVAL = 30000; // Save every 30 seconds
const RANKING_SNAPSHOT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const RECOMPUTE_INTERVAL = 60 * 60 * 1000; // 1 hour
const GHOST_SPAWN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const GHOST_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour

/**
 * Start the game loop
 */
export function startGameLoop() {
  if (gameLoopInterval) {
    console.log('Game loop already running');
    return;
  }
  
  console.log('Starting game loop...');
  
  // Initialize ranking snapshot timer from history file
  readJsonFile('rankings_history.json').then(data => {
    if (data && data.snapshots && data.snapshots.length > 0) {
      lastRankingSnapshotTime = data.snapshots[data.snapshots.length - 1].timestamp;
    }
  }).catch(() => {});
  
  gameLoopInterval = setInterval(async () => {
    await gameTick();
  }, CONFIG.GAME_TICK_INTERVAL);
}

/**
 * Stop the game loop
 */
export function stopGameLoop() {
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    console.log('Game loop stopped');
  }
}

/**
 * Single game tick - updates all game state
 */
async function gameTick() {
  try {
    // Load all players (uses in-memory cache)
    const players = await getPlayers();
    if (!players) {
      return;
    }
    
    let updated = false;
    
    for (const player of players) {
      // Process each planet
      for (const planet of player.planets) {
        // Update resources based on production
        const timeDelta = (Date.now() - planet.lastUpdate) / 1000; // seconds
        
        if (timeDelta > 0) {
          // Add resources based on production per hour
          const hoursElapsed = timeDelta / 3600;
          
          // Production logic: Allow exceeding storage (e.g. from transport), 
          // but shutdown production when storage is full.
          // Consumption always applies.
          
          const waterStorage = planet.storage.water || 10000;
          const foodStorage = planet.storage.food || 10000;

          // 1. Apply Consumption (always happens)
          if (planet.consumption) {
            planet.resources.water -= (planet.consumption.water || 0) * hoursElapsed;
            planet.resources.food -= (planet.consumption.food || 0) * hoursElapsed;
          }
          
          // 2. Apply Production (only if below storage)
          
          // Metal
          if (planet.resources.metal < planet.storage.metal) {
            planet.resources.metal += planet.production.metal * hoursElapsed;
            // Cap at storage if we just crossed it
            if (planet.resources.metal > planet.storage.metal) {
              planet.resources.metal = planet.storage.metal;
            }
          }
          
          // Crystal
          if (planet.resources.crystal < planet.storage.crystal) {
            planet.resources.crystal += planet.production.crystal * hoursElapsed;
            if (planet.resources.crystal > planet.storage.crystal) {
              planet.resources.crystal = planet.storage.crystal;
            }
          }
          
          // Deuterium
          if (planet.resources.deuterium < planet.storage.deuterium) {
            planet.resources.deuterium += planet.production.deuterium * hoursElapsed;
            if (planet.resources.deuterium > planet.storage.deuterium) {
              planet.resources.deuterium = planet.storage.deuterium;
            }
          }
          
          // Water
          if (planet.resources.water < waterStorage) {
            planet.resources.water += (planet.production.water || 0) * hoursElapsed;
            if (planet.resources.water > waterStorage) {
              planet.resources.water = waterStorage;
            }
          }
          
          // Food
          if (planet.resources.food < foodStorage) {
            planet.resources.food += (planet.production.food || 0) * hoursElapsed;
            if (planet.resources.food > foodStorage) {
              planet.resources.food = foodStorage;
            }
          }
          
          // Population growth/decay based on food availability
          const currentPopulation = planet.resources.population || 0;
          const maxPopulation = planet.maxPopulation || 0;
          const foodAvailable = planet.resources.food > 0;
          const waterAvailable = planet.resources.water > 0;
          const productionMultiplier = getResourceProductionMultiplier();
          
          planet.resources.population = calculatePopulationChange(
            currentPopulation,
            maxPopulation,
            foodAvailable,
            waterAvailable,
            hoursElapsed,
            productionMultiplier
          );
          
          // Prevent negative resources
          planet.resources.water = Math.max(0, planet.resources.water);
          planet.resources.food = Math.max(0, planet.resources.food);
          
          planet.lastUpdate = Date.now();
          updated = true;
        }
      }
      
      // Process completed buildings
      const buildingsUpdated = await processCompletedBuildings(player);
      if (buildingsUpdated) {
        updated = true;
        wsManager.sendToUser(player.userId, 'BUILDING_COMPLETE', { userId: player.userId });
      }
      
      // Process completed variant switches
      const variantSwitchesUpdated = await processCompletedVariantSwitches(player);
      if (variantSwitchesUpdated) {
        updated = true;
        wsManager.sendToUser(player.userId, 'VARIANT_SWITCH_COMPLETE', { userId: player.userId });
      }
      
      // Process completed ship and defense production
      for (const planet of player.planets) {
        const productionUpdated = processCompletedProduction(planet);
        if (productionUpdated) {
          updated = true;
          wsManager.sendToUser(player.userId, 'PRODUCTION_COMPLETE', { userId: player.userId, planetId: planet.id });
          
          // If queue is now completely empty, send a specific completion event
          const hasShipsInQueue = planet.shipQueue && planet.shipQueue.length > 0;
          const hasDefensesInQueue = planet.defenseQueue && planet.defenseQueue.length > 0;
          
          if (!hasShipsInQueue && !hasDefensesInQueue) {
            wsManager.sendToUser(player.userId, 'SHIPYARD_QUEUE_COMPLETE', { 
              userId: player.userId, 
              planetId: planet.id,
              planetName: planet.name
            });
          }
        }
      }
      
      // Process completed research
      const researchUpdated = await processCompletedResearch(player);
      if (researchUpdated) {
        updated = true;
        wsManager.sendToUser(player.userId, 'RESEARCH_COMPLETE', { userId: player.userId });
      }

      // Process fleets
      const fleetsUpdated = await processFleets(player, players);
      if (fleetsUpdated) {
        updated = true;
      }

      // Process AI decisions if it's an AI player
      if (player.isAI) {
        const aiUpdated = await processAiPlayer(player);
        if (aiUpdated) updated = true;
      }
    }
    
    // Save if anything changed and enough time has passed
    const now = Date.now();
    if (updated && (now - lastSaveTime) >= SAVE_INTERVAL) {
      await savePlayers(players);
      lastSaveTime = now;
    }

    // Handle periodic ranking snapshots (every 6 hours)
    if (now - lastRankingSnapshotTime >= RANKING_SNAPSHOT_INTERVAL) {
      await takeRankingSnapshot();
      lastRankingSnapshotTime = now;
    }

    // Handle hourly score recomputation
    if (now - lastRecomputeTime >= RECOMPUTE_INTERVAL) {
      console.log('[GameLoop] Hourly score recomputation starting...');
      for (const player of players) {
        await recomputePlayerScores(player);
      }
      await savePlayers(players);
      console.log('[GameLoop] Hourly score recomputation complete.');
      lastRecomputeTime = now;
    }

    // Handle PvE Spawning (Ghost Planets)
    if (now - lastGhostSpawnTime >= GHOST_SPAWN_INTERVAL) {
      await spawnGhostPlanets();
      lastGhostSpawnTime = now;
    }

    // Handle PvE Cleanup
    if (now - lastGhostCleanupTime >= GHOST_CLEANUP_INTERVAL) {
      await cleanupGhostPlanets();
      lastGhostCleanupTime = now;
    }
  } catch (error) {
    console.error('Error in game tick:', error);
  }
}

/**
 * Process completed research items
 */
async function processCompletedResearch(player) {
  let updated = false;
  let now = Date.now();
  
  // Check theoretical research - sequential
  while (player.researchQueue && player.researchQueue.length > 0) {
    const item = player.researchQueue[0];
    if (item.endTime <= now) {
      completeTheoreticalResearch(player, item.id);
      
      // If there's another item in the queue, update its start/end times
      if (player.researchQueue.length > 0) {
        const nextItem = player.researchQueue[0];
        // The next item starts when the previous one finished
        nextItem.startTime = item.endTime; 
        nextItem.endTime = nextItem.startTime + nextItem.duration;
      }
      updated = true;
    } else {
      break; // First item not finished yet
    }
  }
  
  // Check practical research - sequential
  while (player.practicalResearchQueue && player.practicalResearchQueue.length > 0) {
    const item = player.practicalResearchQueue[0];
    if (item.endTime <= now) {
      await completePracticalResearch(player, item.id);
      
      // If there's another item in the queue, update its start/end times
      if (player.practicalResearchQueue.length > 0) {
        const nextItem = player.practicalResearchQueue[0];
        // The next item starts when the previous one finished
        nextItem.startTime = item.endTime;
        nextItem.endTime = nextItem.startTime + nextItem.duration;
      }
      updated = true;
    } else {
      break; // First item not finished yet
    }
  }
  
  return updated;
}

/**
 * Manually trigger a game tick (useful for testing)
 */
export async function triggerGameTick() {
  await gameTick();
}
