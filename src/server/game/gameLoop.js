// Game tick system - processes game state periodically
import { getPlayers, savePlayers } from './player.js';
import { processCompletedBuildings, updatePlanetProduction, processCompletedVariantSwitches } from './buildings.js';
import { processCompletedProduction } from './shipyard.js';
import { completeTheoreticalResearch, completePracticalResearch } from './researchLogic.js';
import { processFleets } from './fleet.js';
import { calculatePopulationChange } from '../../shared/formulas.js';
import { getResourceProductionMultiplier } from '../config.js';
import { CONFIG } from '../../shared/constants.js';
import { getAllAiPlayers } from './aiManager.js';
import { processAiPlayer } from './aiLogic.js';

let gameLoopInterval = null;
let lastSaveTime = 0;
const SAVE_INTERVAL = 30000; // Save every 30 seconds

/**
 * Start the game loop
 */
export function startGameLoop() {
  if (gameLoopInterval) {
    console.log('Game loop already running');
    return;
  }
  
  console.log('Starting game loop...');
  
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
          
          // Production
          planet.resources.metal += planet.production.metal * hoursElapsed;
          planet.resources.crystal += planet.production.crystal * hoursElapsed;
          planet.resources.deuterium += planet.production.deuterium * hoursElapsed;
          planet.resources.water += (planet.production.water || 0) * hoursElapsed;
          planet.resources.food += (planet.production.food || 0) * hoursElapsed;
          
          // Consumption
          if (planet.consumption) {
            planet.resources.water -= (planet.consumption.water || 0) * hoursElapsed;
            planet.resources.food -= (planet.consumption.food || 0) * hoursElapsed;
          }
          
          // Population growth/decay based on food availability
          const currentPopulation = planet.resources.population || 0;
          const maxPopulation = planet.maxPopulation || 0;
          const foodAvailable = planet.resources.food > 0;
          const productionMultiplier = getResourceProductionMultiplier();
          
          planet.resources.population = calculatePopulationChange(
            currentPopulation,
            maxPopulation,
            foodAvailable,
            hoursElapsed,
            productionMultiplier
          );
          
          // Prevent negative resources
          planet.resources.water = Math.max(0, planet.resources.water);
          planet.resources.food = Math.max(0, planet.resources.food);
          
          // Cap at storage
          planet.resources.metal = Math.min(planet.resources.metal, planet.storage.metal);
          planet.resources.crystal = Math.min(planet.resources.crystal, planet.storage.crystal);
          planet.resources.deuterium = Math.min(planet.resources.deuterium, planet.storage.deuterium);
          planet.resources.water = Math.min(planet.resources.water, planet.storage.water || 10000);
          planet.resources.food = Math.min(planet.resources.food, planet.storage.food || 10000);
          
          planet.lastUpdate = Date.now();
          updated = true;
        }
      }
      
      // Process completed buildings
      const buildingsUpdated = await processCompletedBuildings(player);
      if (buildingsUpdated) {
        updated = true;
      }
      
      // Process completed variant switches
      const variantSwitchesUpdated = await processCompletedVariantSwitches(player);
      if (variantSwitchesUpdated) {
        updated = true;
      }
      
      // Process completed ship and defense production
      for (const planet of player.planets) {
        const productionUpdated = processCompletedProduction(planet);
        if (productionUpdated) {
          updated = true;
        }
      }
      
      // Process completed research
      const researchUpdated = await processCompletedResearch(player);
      if (researchUpdated) {
        updated = true;
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
