import { AI_TYPES, BUILDINGS, TECHNOLOGIES, MISSION_TYPES } from '../../shared/constants.js';
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { upgradeBuilding, createBuildingBlueprint, setActiveBlueprint } from './buildings.js';
import { buildShips, buildDefenses } from './shipyard.js';
import { startTheoreticalResearch, startPracticalResearchWithAllocation } from './researchLogic.js';
import { sendFleet } from './fleet.js';
import { updatePlayer } from './player.js';
import { isEmpty } from '../../shared/utils.js';

/**
 * Process a single AI player's turn
 */
export async function processAiPlayer(player) {
  if (!player.isAI) return false;
  
  const now = Date.now();
  if (now < player.aiConfig.nextAction) return false;
  
  let updated = false;
  
  // 1. Handle Buildings (Strategy-specific)
  switch (player.aiConfig.archetype) {
    case AI_TYPES.AGGRESSIVE:
      updated = await handleAggressiveStrategy(player) || updated;
      break;
    case AI_TYPES.DEFENSIVE:
      updated = await handleDefensiveStrategy(player) || updated;
      break;
    case AI_TYPES.RAIDER:
      updated = await handleRaiderStrategy(player) || updated;
      break;
    case AI_TYPES.BALANCED:
    case AI_TYPES.TUTORIAL:
    default:
      updated = await handleBalancedStrategy(player) || updated;
      break;
  }

  // 2. Handle Theoretical Research
  updated = await handleResearch(player) || updated;

  // 3. Handle Practical Research (Specialization)
  updated = await handlePracticalResearch(player) || updated;

  // 4. Handle Planet Specialization (Blueprints)
  updated = await handlePlanetSpecialization(player) || updated;

  // 5. Handle Fleet Missions
  updated = await handleMissions(player) || updated;
  
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
    
    if (planet.defenseQueue && planet.defenseQueue.length >= 5) return false;

    buildDefenses(planet, player, { [defenseKey]: count }, shipyardLevel, planet.buildings.roboticsFactory || 0, planet.buildings.naniteFactory || 0);
    console.log(`[AI] ${player.username} queued ${count}x ${defenseKey} on ${planet.name}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Helper to ensure basic resource production and energy
 */
async function handleResourceBase(player, planet) {
  if (planet.buildQueue && planet.buildQueue.length > 0) return false;

  const buildings = planet.buildings || {};
  const metalLevel = buildings[BUILDINGS.METAL_MINE] || 0;
  const crystalLevel = buildings[BUILDINGS.CRYSTAL_MINE] || 0;
  const solarLevel = buildings[BUILDINGS.SOLAR_PLANT] || 0;
  const waterLevel = buildings[BUILDINGS.WATER_EXTRACTOR] || 0;
  const farmLevel = buildings[BUILDINGS.FARM] || 0;

  // 1. Critical Energy Check: If efficiency is low, MUST build solar
  const energyEfficiency = planet.energyEfficiency || 100;
  if (energyEfficiency < 100 || (planet.production?.energy || 0) < 5) {
    if (await tryBuild(player, planet, BUILDINGS.SOLAR_PLANT)) return true;
  }

  // 2. Critical Metal Check: If metal is way behind others
  if (metalLevel < 3 || metalLevel < crystalLevel) {
    if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) return true;
  }

  // 3. Basic Life Support (Water/Food)
  if (waterLevel < 2) {
    if (await tryBuild(player, planet, BUILDINGS.WATER_EXTRACTOR)) return true;
  }
  if (farmLevel < 2) {
    if (await tryBuild(player, planet, BUILDINGS.FARM)) return true;
  }

  return false;
}

/**
 * AI Research Handling
 */
async function handleResearch(player) {
  if (player.researchQueue && player.researchQueue.length > 0) return false;

  // AI Priorities for Theoretical Research
  const techPriorities = [
    TECHNOLOGIES.COMPUTER_TECH,
    TECHNOLOGIES.ENERGY_TECH,
    TECHNOLOGIES.COMBUSTION_DRIVE,
    TECHNOLOGIES.WEAPONS_TECH,
    TECHNOLOGIES.SHIELDING_TECH,
    TECHNOLOGIES.ARMOR_TECH,
    TECHNOLOGIES.ASTROPHYSICS
  ];

  // Find a planet with a research lab
  const labPlanet = player.planets.find(p => (p.buildings.researchLab || 0) > 0);
  if (!labPlanet) return false;

  for (const tech of techPriorities) {
    try {
      startTheoreticalResearch(player, tech, labPlanet.id);
      console.log(`[AI] ${player.username} started research: ${tech}`);
      return true;
    } catch (e) {
      // Continue to next priority
    }
  }

  return false;
}

/**
 * AI Practical Research (Specialization XP)
 */
async function handlePracticalResearch(player) {
  if (player.practicalResearchQueue && player.practicalResearchQueue.length > 0) return false;

  const labPlanet = player.planets.find(p => (p.buildings.researchLab || 0) > 0);
  if (!labPlanet) return false;

  // Decide what to specialize in based on archetype
  let targetType = 'metalMine';
  let allocation = { output: 1.0, automation: 0, energy: 0, cost: 0 };

  if (player.aiConfig.archetype === AI_TYPES.DEFENSIVE) {
    targetType = 'solarPlant';
    allocation = { output: 0.5, automation: 0, energy: 0, cost: 0.5 };
  } else if (player.aiConfig.archetype === AI_TYPES.AGGRESSIVE) {
    targetType = 'lightFighter';
    allocation = { output: 1.0, automation: 0, energy: 0, cost: 0 };
  }

  try {
    startPracticalResearchWithAllocation(player, targetType, allocation, labPlanet.id, 0.2); // Low strength for frequent runs
    console.log(`[AI] ${player.username} started practical research for ${targetType}`);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * AI Planet Specialization (Using Blueprints)
 */
async function handlePlanetSpecialization(player) {
  let changed = false;

  for (const planet of player.planets) {
    // If planet has no active variant for metalMine, try to create and set one
    if ((planet.activeVariants?.metalMine || 'base') === 'base') {
      const exp = player.practicalResearch?.metalMine?.experience?.output || 0;
      const level = Math.floor(Math.sqrt(exp / 100));

      if (level >= 1) {
        try {
          // Create blueprint
          const bp = await createBuildingBlueprint(player.userId, 'metalMine', { output: level }, `${player.username} Industrial`);
          // Set as active
          await setActiveBlueprint(player.userId, planet.id, 'metalMine', bp.id);
          console.log(`[AI] ${player.username} specialized planet ${planet.name} with metal blueprint`);
          changed = true;
        } catch (e) {
          // Blueprint might already exist or limit reached
        }
      }
    }
  }

  return changed;
}

/**
 * Helper to check if storage upgrade is needed
 */
async function handleStorageNeed(player, planet) {
  if (planet.buildQueue && planet.buildQueue.length > 0) return false;

  const storageThreshold = 0.8; // 80% full
  const resourceMap = {
    metal: BUILDINGS.METAL_STORAGE,
    crystal: BUILDINGS.CRYSTAL_STORAGE,
    deuterium: BUILDINGS.DEUTERIUM_TANK,
    water: BUILDINGS.WATER_STORAGE,
    food: BUILDINGS.FOOD_SILO
  };

  for (const [res, building] of Object.entries(resourceMap)) {
    const current = planet.resources[res] || 0;
    const capacity = planet.storage[res] || 10000;
    
    if (current > capacity * storageThreshold) {
      if (await tryBuild(player, planet, building)) {
        console.log(`[AI] ${player.username} upgrading storage for ${res} on ${planet.name}`);
        return true;
      }
    }
  }
  return false;
}

/**
 * Balanced strategy: build resources with a specific ratio
 */
async function handleBalancedStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    if (planet.buildQueue && planet.buildQueue.length > 0) continue;
    
    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    // MUST have resource base
    if (await handleResourceBase(player, planet)) {
      changed = true;
      continue;
    }

    const buildings = planet.buildings || {};
    const metalLvl = buildings[BUILDINGS.METAL_MINE] || 0;
    const crystalLvl = buildings[BUILDINGS.CRYSTAL_MINE] || 0;
    const deutLvl = buildings[BUILDINGS.DEUTERIUM_SYNTHESIZER] || 0;
    const solarLvl = buildings[BUILDINGS.SOLAR_PLANT] || 0;

    // Target Ratio: Metal(10) : Crystal(8) : Solar(10) : Deut(5)
    if (solarLvl < metalLvl + 2) {
      if (await tryBuild(player, planet, BUILDINGS.SOLAR_PLANT)) {
        changed = true;
        continue;
      }
    }

    if (metalLvl < crystalLvl + 2) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) {
        changed = true;
        continue;
      }
    }

    if (crystalLvl < deutLvl + 3) {
      if (await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE)) {
        changed = true;
        continue;
      }
    }

    // Facilities
    const priorities = [
      BUILDINGS.ROBOTICS_FACTORY,
      BUILDINGS.SHIPYARD,
      BUILDINGS.RESEARCH_LAB,
      BUILDINGS.HOUSING
    ];
    
    let target = null;
    let minLvl = 999;
    for (const p of priorities) {
      const lvl = buildings[p] || 0;
      if (lvl < minLvl) {
        minLvl = lvl;
        target = p;
      }
    }

    if (target && metalLvl >= 5) {
      if (await tryBuild(player, planet, target)) {
        changed = true;
      }
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
    if (planet.buildQueue && planet.buildQueue.length > 0) continue;

    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    // MUST have resource base
    if (await handleResourceBase(player, planet)) {
      changed = true;
      continue;
    }

    const buildings = planet.buildings || {};
    const shipyardLevel = buildings[BUILDINGS.SHIPYARD] || 0;
    const metalLevel = buildings[BUILDINGS.METAL_MINE] || 0;
    
    // Aggressive AI needs a lot of metal
    if (metalLevel < shipyardLevel + 2) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) {
        changed = true;
        continue;
      }
    }
    
    // Push shipyard
    if (shipyardLevel < 12) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) {
        changed = true;
        continue;
      }
    }
    
    // Build Ships
    const shipPriorities = ['battleship', 'cruiser', 'heavyFighter', 'lightFighter'];
    for (const shipKey of shipPriorities) {
      if (await tryBuildShips(player, planet, shipKey, 1)) {
        changed = true;
        break;
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
    if (planet.buildQueue && planet.buildQueue.length > 0) continue;

    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    // MUST have resource base
    if (await handleResourceBase(player, planet)) {
      changed = true;
      continue;
    }

    const buildings = planet.buildings || {};
    
    // Build Defenses
    const defensePriorities = ['plasmaTurret', 'shield', 'laserCannon', 'rocketLauncher'];
    for (const defKey of defensePriorities) {
      if (await tryBuildDefenses(player, planet, defKey, 1)) {
        changed = true;
        break;
      }
    }
    
    // If shipyard is too low to build defenses, upgrade it
    if (!changed) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) {
        changed = true;
        continue;
      }
      
      // Keep crystal mine up for defenses
      if ((buildings[BUILDINGS.CRYSTAL_MINE] || 0) < (buildings[BUILDINGS.METAL_MINE] || 0)) {
        if (await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE)) {
          changed = true;
        }
      }
    }
  }
  
  return changed;
}

/**
 * AI Fleet Missions (Expeditions, Transports)
 */
async function handleMissions(player) {
  if (!player.fleets) player.fleets = [];
  
  // Limit concurrent AI fleets to avoid spam
  if (player.fleets.length >= 3) return false;

  let changed = false;

  for (const planet of player.planets) {
    // --- Mission Type 1: Expedition (Exploration) ---
    // If we have some military ships and no active expedition from this planet
    const hasCombatShips = (planet.ships?.lightFighter || 0) > 0;
    const activeExpedition = player.fleets.find(f => f.missionType === MISSION_TYPES.EXPEDITION && f.originCoords.every((c, i) => c === planet.coordinates[i]));

    if (hasCombatShips && !activeExpedition && Math.random() < 0.3) {
      try {
        const shipsToSend = { lightFighter: 1 };
        const targetCoords = [planet.coordinates[0], planet.coordinates[1], 16]; // Deep space
        await sendFleet(player.userId, planet.id, targetCoords, MISSION_TYPES.EXPEDITION, shipsToSend, {}, 1);
        console.log(`[AI] ${player.username} launched expedition from ${planet.name}`);
        changed = true;
        continue;
      } catch (e) {
        // Ignore fleet errors
      }
    }

    // --- Mission Type 2: Internal Transport (Balance resources) ---
    // If another planet is low on resources and this one has surplus
    if (player.planets.length > 1) {
      const otherPlanet = player.planets.find(p => p.id !== planet.id);
      const needsResources = Object.entries(otherPlanet.resources).some(([res, val]) => val < 1000);
      const hasSurplus = Object.entries(planet.resources).some(([res, val]) => val > 5000);
      const hasCargo = (planet.ships?.smallCargo || 0) > 0;

      if (needsResources && hasSurplus && hasCargo) {
        try {
          const transportShips = { smallCargo: 1 };
          const resourcesToMove = {};
          
          for (const res of ['metal', 'crystal', 'deuterium']) {
            if (planet.resources[res] > 5000) {
              resourcesToMove[res] = 2000;
            }
          }

          if (!isEmpty(resourcesToMove)) {
            await sendFleet(player.userId, planet.id, otherPlanet.coordinates, MISSION_TYPES.TRANSPORT, transportShips, resourcesToMove);
            console.log(`[AI] ${player.username} launched transport from ${planet.name} to ${otherPlanet.name}`);
            changed = true;
            continue;
          }
        } catch (e) {
          // Ignore fleet errors
        }
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
    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    if (await tryBuildShips(player, planet, 'lightFighter', 5)) {
      changed = true;
    } else if (await tryBuildShips(player, planet, 'smallCargo', 2)) {
      changed = true;
    }
    
    if (!changed && (!planet.buildQueue || planet.buildQueue.length === 0)) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.DEUTERIUM_SYNTHESIZER)) {
        changed = true;
      }
    }
  }
  
  return changed;
}
