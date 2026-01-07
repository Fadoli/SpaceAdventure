// AI Decision making logic
import { AI_TYPES, BUILDINGS, TECHNOLOGIES } from '../../shared/constants.js';
import { calculateBuildingCost } from '../../shared/formulas.js';
import { upgradeBuilding } from './buildings.js';
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
    case AI_TYPES.BALANCED:
    case AI_TYPES.TUTORIAL:
    default:
      updated = await handleBalancedStrategy(player);
      break;
  }
  
  // Set next action time (random delay between 5-15 minutes for realism)
  // For testing/initial phase, maybe shorter: 1-2 minutes
  const delay = (Math.random() * 60 + 60) * 1000; 
  player.aiConfig.nextAction = now + delay;
  player.aiConfig.lastAction = now;
  
  if (updated) {
    await updatePlayer(player.userId, player);
  }
  
  return updated;
}

/**
 * Balanced strategy: build resources first, then tech
 */
async function handleBalancedStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    // 1. Check building queue
    if (planet.buildQueue && planet.buildQueue.length > 0) continue;
    
    // 2. Decide what to build based on current levels
    const buildings = planet.buildings || {};
    
    // Priority list for balanced AI
    const priorities = [
      { key: BUILDINGS.SOLAR_PLANT, minLevel: 1 },
      { key: BUILDINGS.METAL_MINE, minLevel: 1 },
      { key: BUILDINGS.CRYSTAL_MINE, minLevel: 1 },
      { key: BUILDINGS.WATER_EXTRACTOR, minLevel: 1 },
      { key: BUILDINGS.FARM, minLevel: 1 },
      { key: BUILDINGS.HOUSING, minLevel: 1 }
    ];
    
    // Try to keep solar plant slightly ahead
    const solarLevel = buildings[BUILDINGS.SOLAR_PLANT] || 0;
    const metalLevel = buildings[BUILDINGS.METAL_MINE] || 0;
    
    let targetBuilding = null;
    
    if (solarLevel <= metalLevel) {
      targetBuilding = BUILDINGS.SOLAR_PLANT;
    } else {
      // Find lowest resource building
      const resourceBuildings = [
        BUILDINGS.METAL_MINE, 
        BUILDINGS.CRYSTAL_MINE, 
        BUILDINGS.WATER_EXTRACTOR, 
        BUILDINGS.FARM,
        BUILDINGS.HOUSING
      ];
      
      resourceBuildings.sort((a, b) => (buildings[a] || 0) - (buildings[b] || 0));
      targetBuilding = resourceBuildings[0];
    }
    
    if (targetBuilding) {
      try {
        // We need to pass the building definition, but upgradeBuilding takes the key
        // Let's see if we can trigger it
        await upgradeBuilding(player.userId, planet.id, targetBuilding);
        changed = true;
        console.log(`[AI] ${player.username} started building ${targetBuilding} on ${planet.name}`);
      } catch (e) {
        // Probably insufficient resources, ignore
      }
    }
  }
  
  return changed;
}
