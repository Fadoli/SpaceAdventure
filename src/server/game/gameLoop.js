// Game tick system - processes game state periodically
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { processCompletedBuildings, updatePlanetProduction } from './buildings.js';
import { CONFIG } from '../../shared/constants.js';

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
    // Load all players
    const playersData = await readJsonFile('players.json');
    if (!playersData || !playersData.players) {
      return;
    }
    
    let updated = false;
    
    for (const player of playersData.players) {
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
          
          if (foodAvailable && currentPopulation < maxPopulation) {
            // Grow population slowly (1% per hour when food available and under cap)
            const growthRate = 0.01;
            planet.resources.population = Math.min(
              maxPopulation, 
              currentPopulation + (currentPopulation * growthRate * hoursElapsed)
            );
          } else if (!foodAvailable) {
            // Lose population when no food (2% per hour)
            const decayRate = 0.02;
            planet.resources.population = Math.max(
              0, 
              currentPopulation - (currentPopulation * decayRate * hoursElapsed)
            );
          }
          
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
    }
    
    // Save if anything changed and enough time has passed
    const now = Date.now();
    if (updated && (now - lastSaveTime) >= SAVE_INTERVAL) {
      await writeJsonFile('players.json', playersData);
      lastSaveTime = now;
    }
  } catch (error) {
    console.error('Error in game tick:', error);
  }
}

/**
 * Manually trigger a game tick (useful for testing)
 */
export async function triggerGameTick() {
  await gameTick();
}
