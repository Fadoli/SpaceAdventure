// Game tick system - processes game state periodically
import { getPlayers, updatePlayer, getPlayerStateVersion, savePlayers, takeRankingSnapshot, recomputePlayerScores, flushDirtyPlayers } from './player.js';
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
import { flushGalaxyData } from './galaxyData.js';
import { flushDirtyMessages } from './messages.js';
import { wsManager } from './wsManager.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';

let gameLoopInterval = null;
let isTickRunning = false;
let lastSaveTime = 0;
let lastRankingSnapshotTime = 0;
let lastRecomputeTime = 0;
let lastGhostSpawnTime = 0;
let lastGhostCleanupTime = 0;
let lastStateSyncTime = 0;

const SAVE_INTERVAL = 30000; // Save every 30 seconds
const RANKING_SNAPSHOT_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const RECOMPUTE_INTERVAL = 60 * 60 * 1000; // 1 hour
const GHOST_SPAWN_INTERVAL = 10 * 60 * 1000; // 10 minutes
const GHOST_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
const STATE_SYNC_INTERVAL = 30 * 1000;
let lastProcessedTick = Date.now();

export function getCatchUpTimes(startTime, targetTime) {
  return targetTime > startTime ? [targetTime] : [];
}

/**
 * Persist server heartbeat to file
 */
async function saveServerState(lastHeartbeat) {
  try {
    console.log(`[GameLoop] PERSISTING FINAL HEARTBEAT: ${new Date(lastHeartbeat).toISOString()}`);
    await writeJsonFile('server_state.json', { lastHeartbeat });
  } catch (e) {
    console.error('[GameLoop] Failed to save server state:', e);
  }
}

/**
 * Load server heartbeat from file
 */
async function loadServerState() {
  try {
    const state = await readJsonFile('server_state.json');
    return state?.lastHeartbeat || Date.now();
  } catch (e) {
    return Date.now();
  }
}

/**
 * Start the game loop
 */
export async function startGameLoop() {
  if (gameLoopInterval) {
    console.log('Game loop already running');
    return;
  }
  
  console.log('Starting game loop...');
  
  // 1. Load persisted timers
  try {
    const rankingData = await readJsonFile('rankings_history.json');
    if (rankingData?.snapshots?.length > 0) {
      lastRankingSnapshotTime = rankingData.snapshots[rankingData.snapshots.length - 1].timestamp;
    }
  } catch (error) {
    console.warn('[GameLoop] Unable to load ranking snapshot history:', error);
  }

  // 2. Perform Catch-up Simulation
  const lastHeartbeat = await loadServerState();
  lastProcessedTick = lastHeartbeat; // Initialize from persisted state
  
  const now = Date.now();
  const gap = now - lastHeartbeat;

  if (gap > CONFIG.GAME_TICK_INTERVAL) {
    const minutes = Math.floor(gap / 60000);
    console.log(`[GameLoop] SERVER WAS DOWN FOR ${minutes}m ${Math.floor((gap % 60000)/1000)}s. STARTING CATCH-UP...`);
    
    // We catch up in steps. Since resource production is delta-based, 
    // we only really need to simulate at points where events (buildings, research, fleets) finish.
    await performCatchUp(lastHeartbeat, now);
    
    console.log('[GameLoop] CATCH-UP SIMULATION COMPLETE.');
  }

  lastSaveTime = now;
  lastRecomputeTime = now;
  lastStateSyncTime = now;

  // 3. Start real-time loop
  gameLoopInterval = setInterval(async () => {
    if (isTickRunning) return;
    isTickRunning = true;
    try {
      const now = Date.now();
      await gameTick(now);
      lastProcessedTick = now; // Only update AFTER successful tick
      // Heartbeat is NOT saved to disk here to prevent SSD wear.
      // It is only saved on graceful shutdown.
    } catch (error) {
      console.error('[GameLoop] Tick failed; retrying on the next interval:', error);
    } finally {
      isTickRunning = false;
    }
  }, CONFIG.GAME_TICK_INTERVAL);

}

/**
 * Catch-up Simulation Logic
 * Advances game state from lastHeartbeat to targetTime
 */
async function performCatchUp(startTime, targetTime) {
  // ponytail: one delta-based replay; use an event scheduler if cross-player historical ordering matters.
  for (const simTime of getCatchUpTimes(startTime, targetTime)) {
    await gameTick(simTime, true); // Pass true for isCatchUp
  }
  await flushDirtyPlayers(); // Final catch-up flush
  await flushGalaxyData();
  await flushDirtyMessages();
  lastProcessedTick = targetTime;
}

/**
 * Stop the game loop
 */
export async function stopGameLoop() {
  const wasRunning = Boolean(gameLoopInterval);
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }

  // Always flush, including shutdown during startup before the interval exists.
  // Try each store even when a sibling write fails.
  const flushResults = await Promise.allSettled([
    flushDirtyPlayers(),
    flushGalaxyData(),
    flushDirtyMessages()
  ]);
  await saveServerState(lastProcessedTick);

  for (const result of flushResults) {
    if (result.status === 'rejected') {
      console.error('[GameLoop] Shutdown persistence failed:', result.reason);
    }
  }

  if (wasRunning) console.log('Game loop stopped and data persisted.');
}

/**
 * Single game tick - updates all game state
 */
async function gameTick(now = Date.now(), isCatchUp = false) {
  try {
    // Load all players (uses in-memory cache)
    const players = await getPlayers();
    if (!players) {
      return;
    }

    const shouldSendPeriodicStateSync = !isCatchUp && now - lastStateSyncTime >= STATE_SYNC_INTERVAL;
    
    for (const player of players) {
      let stateChanged = false;
      // Process each planet
      for (const planet of player.planets) {
        // Update resources based on production
        // Use the passed 'now' for deterministic delta
        const timeDelta = (now - planet.lastUpdate) / 1000; // seconds
        
        if (timeDelta > 0) {
          // Add resources based on production per hour
          const hoursElapsed = timeDelta / 3600;
          
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
          
          planet.lastUpdate = now;
        }
      }
      
      // Process completed buildings
      const buildingsUpdated = await processCompletedBuildings(player, now);
      if (buildingsUpdated) {
        stateChanged = true;
        if (!isCatchUp) wsManager.sendToUser(player.userId, 'BUILDING_COMPLETE', { userId: player.userId });
      }
      
      // Process completed variant switches
      const variantSwitchesUpdated = await processCompletedVariantSwitches(player, now);
      if (variantSwitchesUpdated) {
        stateChanged = true;
        if (!isCatchUp) wsManager.sendToUser(player.userId, 'VARIANT_SWITCH_COMPLETE', { userId: player.userId });
      }
      
      // Process completed ship and defense production
      for (const planet of player.planets) {
        const productionUpdated = processCompletedProduction(planet, now);
        if (productionUpdated) {
          stateChanged = true;
          if (!isCatchUp) wsManager.sendToUser(player.userId, 'PRODUCTION_COMPLETE', { userId: player.userId, planetId: planet.id });
          
          // If queue is now completely empty, send a specific completion event
          const hasShipsInQueue = planet.shipQueue && planet.shipQueue.length > 0;
          const hasDefensesInQueue = planet.defenseQueue && planet.defenseQueue.length > 0;
          
          if (!hasShipsInQueue && !hasDefensesInQueue && !isCatchUp) {
            wsManager.sendToUser(player.userId, 'SHIPYARD_QUEUE_COMPLETE', { 
              userId: player.userId, 
              planetId: planet.id,
              planetName: planet.name
            });
          }
        }
      }
      
      // Process completed research
      const researchUpdated = await processCompletedResearch(player, now);
      if (researchUpdated) {
        stateChanged = true;
        if (!isCatchUp) wsManager.sendToUser(player.userId, 'RESEARCH_COMPLETE', { userId: player.userId });
      }

      // Process fleets
      const fleetPasses = isCatchUp ? 3 : 1;
      for (let pass = 0; pass < fleetPasses; pass++) {
        const fleetsUpdated = await processFleets(player, players, now, isCatchUp);
        if (fleetsUpdated) stateChanged = true;
      }

      // Process AI decisions if it's an AI player
      if (player.isAI) {
        if (isCatchUp) {
          player.aiConfig.nextAction = now + Math.random() * 60_000;
        } else {
          const aiUpdated = await processAiPlayer(player, now);
          if (aiUpdated) stateChanged = true;
        }
      }

      if (stateChanged) await updatePlayer(player.userId, player);
      if (shouldSendPeriodicStateSync && !stateChanged) {
        wsManager.sendStateSync(
          player.userId,
          player,
          getPlayerStateVersion(player.userId),
          true
        );
      }
    }

    if (shouldSendPeriodicStateSync) lastStateSyncTime = now;
    
    // Save if anything changed and enough time has passed
    // During catch-up, we don't save every tick to disk for performance
    if (!isCatchUp && (now - lastSaveTime) >= SAVE_INTERVAL) {
      await flushDirtyPlayers();
      await flushGalaxyData();
      await flushDirtyMessages();
      lastSaveTime = now;
    }

    // Handle periodic ranking snapshots (every 6 hours)
    if (!isCatchUp && now - lastRankingSnapshotTime >= RANKING_SNAPSHOT_INTERVAL) {
      await takeRankingSnapshot();
      lastRankingSnapshotTime = now;
    }

    // Handle hourly score recomputation
    if (!isCatchUp && now - lastRecomputeTime >= RECOMPUTE_INTERVAL) {
      if (!isCatchUp) console.log('[GameLoop] Hourly score recomputation starting...');
      for (const player of players) {
        await recomputePlayerScores(player);
      }
      if (!isCatchUp) {
        await flushDirtyPlayers();
        await flushGalaxyData();
        await flushDirtyMessages();
        console.log('[GameLoop] Hourly score recomputation complete.');
      }
      lastRecomputeTime = now;
    }

    // Handle PvE Spawning (Ghost Planets)
    if (!isCatchUp && now - lastGhostSpawnTime >= GHOST_SPAWN_INTERVAL) {
      await spawnGhostPlanets();
      lastGhostSpawnTime = now;
    }

    // Handle PvE Cleanup
    if (!isCatchUp && now - lastGhostCleanupTime >= GHOST_CLEANUP_INTERVAL) {
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
async function processCompletedResearch(player, now = Date.now()) {
  let updated = false;
  
  // Check theoretical research - sequential
  while (player.researchQueue && player.researchQueue.length > 0) {
    const item = player.researchQueue[0];
    if (item.endTime <= now) {
      await completeTheoreticalResearch(player, item.id);
      
      // Update activity on the research planet
      const planet = player.planets.find(p => p.id === item.planetId);
      if (planet) planet.lastActivity = now;

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
      await completePracticalResearch(player, item.id, now);
      
      // Update activity on the research planet
      const planet = player.planets.find(p => p.id === item.planetId);
      if (planet) planet.lastActivity = now;

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
