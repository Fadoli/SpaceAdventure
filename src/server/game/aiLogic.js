import { AI_TYPES, BUILDINGS, TECHNOLOGIES, MISSION_TYPES, CONFIG } from '../../shared/constants.js';
import { SHIPS, calculateShipCost } from '../../shared/ships.js';
import { DEFENSES, calculateDefenseCost } from '../../shared/defenses.js';
import { upgradeBuilding, createBuildingBlueprint, setActiveBlueprint, getBuildingCost } from './buildings.js';
import { buildShips, buildDefenses } from './shipyard.js';
import { startTheoreticalResearch, startPracticalResearchWithAllocation } from './researchLogic.js';
import { sendFleet } from './fleet.js';
import { updatePlayer, findAvailablePlanetSlot, renamePlanet } from './player.js';
import { isEmpty } from '../../shared/utils.js';
import { getResearchBonus, getTheoreticalResearch, getPracticalResearch } from '../../shared/research.js';
import { calculateTheoreticalResearchCost, calculatePracticalResearchCost, calculateFocusLevel } from '../../shared/formulas.js';

const PLANET_NAMES = [
  'Arrakis', 'Coruscant', 'Dagobah', 'Endor', 'Hoth', 'Kashyyyk', 'Naboo', 'Tatooine', 'Yavin',
  'Reach', 'Harvest', 'Arcadia', 'Sanghelios', 'Eridanus', 'Threshold', 'Installation 04',
  'Acheron', 'LV-426', 'Fiorina 161', 'Origae-6', 'Pandora', 'Polyphemus', 'Vesta', 'Ceres',
  'Asgard', 'Midgard', 'Jotunheim', 'Muspelheim', 'Niflheim', 'Helheim', 'Alfheim', 'Vanaheim',
  'Terra Prime', 'New Earth', 'Gaia', 'Eden', 'Nova Terra', 'Proxima', 'Centauri', 'Cygnus',
  'Hydra', 'Phoenix', 'Dragon', 'Serpent', 'Aquila', 'Lyra', 'Orion B', 'Sigma-9', 'Delta-4'
];

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

  // 6. Handle Colonization
  updated = await handleColonization(player) || updated;

  // 7. Handle Flavor (Renaming)
  updated = await handlePlanetRenaming(player) || updated;
  
  // Set next action time (30-60 seconds for much faster progression)
  const delay = (Math.random() * 30 + 30) * 1000; 
  player.aiConfig.nextAction = now + delay;
  player.aiConfig.lastAction = now;
  
  if (updated) {
    await updatePlayer(player.userId, player);
  }
  
  return updated;
}

/**
 * AI Colonization logic
 */
async function handleColonization(player) {
  const maxPlanets = CONFIG.MAX_PLANETS_PER_PLAYER || 9;
  if (player.planets.length >= maxPlanets) return false;

  // 1. Check if we have a colony ship in flight
  const hasColonyMission = player.fleets?.some(f => f.missionType === MISSION_TYPES.COLONIZE);
  if (hasColonyMission) return false;

  // 2. Check if we have a colony ship on any planet
  let originPlanet = null;
  for (const planet of player.planets) {
    if ((planet.ships?.colonyShip || 0) > 0) {
      originPlanet = planet;
      break;
    }
  }

  if (originPlanet) {
    // Launch colonization mission
    try {
      const targetCoords = await findAvailablePlanetSlot();
      await sendFleet(player.userId, originPlanet.id, targetCoords, MISSION_TYPES.COLONIZE, { colonyShip: 1 });
      console.log(`[AI] ${player.username} launched colonization mission to ${targetCoords.join(':')}`);
      return true;
    } catch (e) {
      return false;
    }
  } else {
    // Try to build a colony ship
    for (const planet of player.planets) {
      if (planet.shipQueue && planet.shipQueue.length > 0) continue;
      
      const shipyardLevel = planet.buildings.shipyard || 0;
      if (shipyardLevel < 4) continue;

      // Resource check for colony ship
      const cost = SHIPS.colonyShip.baseCost;
      if (planet.resources.metal < cost.metal || 
          planet.resources.crystal < cost.crystal || 
          planet.resources.deuterium < cost.deuterium) {
        continue;
      }

      try {
        if (await tryBuildShips(player, planet, 'colonyShip', 1)) {
          return true;
        }
      } catch (e) {
        // Skip
      }
    }
  }

  return false;
}

/**
 * AI Planet Renaming for flavor
 */
async function handlePlanetRenaming(player) {
  let changed = false;
  const now = Date.now();
  const COOLDOWN = 3600000; // 1 hour

  for (const planet of player.planets) {
    // Only rename "Homeworld" or "Colony"
    if (planet.name !== 'Homeworld' && planet.name !== 'Colony') continue;
    
    // Cooldown check
    if (planet.lastRenamed && (now - planet.lastRenamed < COOLDOWN)) continue;

    // 10% chance to rename per action when applicable
    if (Math.random() < 0.1) {
      const newName = PLANET_NAMES[Math.floor(Math.random() * PLANET_NAMES.length)];
      try {
        await renamePlanet(player.userId, planet.id, newName);
        console.log(`[AI] ${player.username} renamed planet ${planet.id} to ${newName}`);
        changed = true;
      } catch (e) {
        // Ignore
      }
    }
  }

  return changed;
}

/**
 * Helper to try upgrading a building
 */
async function tryBuild(player, planet, buildingKey) {
  try {
    const currentLevel = planet.buildings[buildingKey] || 0;
    
    // Check queue for highest level
    let highestLevel = currentLevel;
    if (planet.buildQueue) {
      planet.buildQueue.forEach(item => {
        if (item.building === buildingKey) highestLevel = Math.max(highestLevel, item.level);
      });
    }
    
    const cost = getBuildingCost(buildingKey, highestLevel + 1, planet, player);
    if (planet.resources.metal < cost.metal || 
        planet.resources.crystal < cost.crystal || 
        planet.resources.deuterium < cost.deuterium) {
      return false;
    }

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

    // Resource check
    const costReduction = getResearchBonus(player.research, 'globalCostReduction');
    const cost = calculateShipCost(shipKey, count, costReduction);
    
    if (planet.resources.metal < cost.metal || 
        planet.resources.crystal < cost.crystal || 
        planet.resources.deuterium < cost.deuterium) {
      return false;
    }

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

    // Resource check
    const costReduction = getResearchBonus(player.research, 'globalCostReduction');
    const cost = calculateDefenseCost(defenseKey, count, costReduction);
    
    if (planet.resources.metal < cost.metal || 
        planet.resources.crystal < cost.crystal || 
        planet.resources.deuterium < cost.deuterium) {
      return false;
    }

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
  let changed = false;
  // Use config-driven max queue size
  if (player.researchQueue && player.researchQueue.length >= 10) return false;

  // AI Priorities for Theoretical Research
  const techPriorities = [
    TECHNOLOGIES.COMPUTER_TECH,
    TECHNOLOGIES.ENERGY_TECH,
    TECHNOLOGIES.COMBUSTION_DRIVE,
    TECHNOLOGIES.ASTROPHYSICS, // Higher priority for expansion
    TECHNOLOGIES.IMPULSE_DRIVE, // Needed for colony ships
    TECHNOLOGIES.WEAPONS_TECH,
    TECHNOLOGIES.SHIELDING_TECH,
    TECHNOLOGIES.ARMOR_TECH
  ];

  // Find a planet with a research lab
  const labPlanet = player.planets.find(p => (p.buildings.researchLab || 0) > 0);
  if (!labPlanet) return false;

  const theoreticalTechs = getTheoreticalResearch();

  for (const tech of techPriorities) {
    if (player.researchQueue && player.researchQueue.length >= 10) break;

    // Resource check
    const currentLevel = player.research[tech] || 0;
    const queuedCount = player.researchQueue.filter(item => item.techKey === tech).length;
    const nextLevel = currentLevel + queuedCount;
    const techDef = theoreticalTechs[tech];
    if (!techDef) continue;

    const cost = calculateTheoreticalResearchCost(techDef.baseCost, nextLevel);
    if (labPlanet.resources.metal < cost.metal || 
        labPlanet.resources.crystal < cost.crystal || 
        labPlanet.resources.deuterium < cost.deuterium) {
      continue;
    }

    try {
      startTheoreticalResearch(player, tech, labPlanet.id);
      console.log(`[AI] ${player.username} started research: ${tech}`);
      changed = true;
    } catch (e) {
      // Continue to next priority
    }
  }

  return changed;
}

/**
 * AI Practical Research (Specialization XP)
 */
async function handlePracticalResearch(player) {
  if (player.practicalResearchQueue && player.practicalResearchQueue.length >= 10) return false;

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

  // Resource check
  try {
    const practicalConfig = getPracticalResearch()[targetType];
    
    if (!practicalConfig) return false;

    const currentExp = player.practicalResearch?.[targetType]?.experience || { output: 0, automation: 0, energy: 0, cost: 0 };
    let totalFocusLevel = 0;
    for (const f in currentExp) totalFocusLevel += calculateFocusLevel(currentExp[f]);
    
    const strength = 0.2;
    const cost = calculatePracticalResearchCost(practicalConfig.baseCost, totalFocusLevel, allocation, strength);

    if (labPlanet.resources.metal < cost.metal || 
        labPlanet.resources.crystal < cost.crystal || 
        labPlanet.resources.deuterium < cost.deuterium) {
      return false;
    }

    startPracticalResearchWithAllocation(player, targetType, allocation, labPlanet.id, strength);
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
  const criticalThreshold = 0.95; // 95% full (must save up)
  let hasUrgentNeed = false;

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
      
      if (current > capacity * criticalThreshold) {
        hasUrgentNeed = true;
      }
    }
  }
  
  // If we found a resource nearing cap but couldn't afford storage yet,
  // we return true to "wait" and prevent spending resources on other things.
  return hasUrgentNeed;
}

/**
 * Balanced strategy: build resources with a specific ratio
 */
async function handleBalancedStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    if (planet.buildQueue && planet.buildQueue.length >= 5) continue;
    
    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      // Storage is critical, but we might be able to build on other planets
      continue;
    }

    // Ensure basic base first
    if (await handleResourceBase(player, planet)) {
      changed = true;
      // If we started a critical resource building, we might still want to queue more if queue allows
      if (planet.buildQueue && planet.buildQueue.length >= 5) continue;
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
      }
    }

    if (metalLvl < crystalLvl + 2) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) {
        changed = true;
      }
    }

    if (crystalLvl < deutLvl + 3) {
      if (await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE)) {
        changed = true;
      }
    }

    // Facilities (catch-up logic)
    const facilitiesPriorities = [
      BUILDINGS.ROBOTICS_FACTORY,
      BUILDINGS.RESEARCH_LAB,
      BUILDINGS.SHIPYARD,
      BUILDINGS.HOUSING
    ];
    
    // Push facilities
    for (const p of facilitiesPriorities) {
      if (planet.buildQueue && planet.buildQueue.length >= 5) break;
      const lvl = buildings[p] || 0;
      // Facilities should stay around 70% of mine levels for faster expansion
      if (lvl < metalLvl * 0.7) {
        if (await tryBuild(player, planet, p)) {
          changed = true;
        }
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
    if (planet.buildQueue && planet.buildQueue.length >= 5) continue;

    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    // MUST have resource base
    if (await handleResourceBase(player, planet)) {
      changed = true;
    }

    const buildings = planet.buildings || {};
    const shipyardLevel = buildings[BUILDINGS.SHIPYARD] || 0;
    const metalLevel = buildings[BUILDINGS.METAL_MINE] || 0;
    
    // Aggressive AI needs a lot of metal
    if (metalLevel < shipyardLevel + 5) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) {
        changed = true;
      }
    }
    
    // Push shipyard
    if (shipyardLevel < 15) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) {
        changed = true;
      }
    }
    
    // Build Ships in larger batches
    const shipPriorities = ['battleship', 'cruiser', 'heavyFighter', 'lightFighter'];
    for (const shipKey of shipPriorities) {
      const count = Math.max(1, Math.floor(shipyardLevel / 2));
      if (await tryBuildShips(player, planet, shipKey, count)) {
        changed = true;
        // Don't break, allow queuing multiple types if possible
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
    if (planet.buildQueue && planet.buildQueue.length >= 5) continue;

    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    // MUST have resource base
    if (await handleResourceBase(player, planet)) {
      changed = true;
    }

    const buildings = planet.buildings || {};
    const shipyardLevel = buildings[BUILDINGS.SHIPYARD] || 0;
    
    // Build Defenses
    const defensePriorities = ['plasmaTurret', 'shield', 'laserCannon', 'rocketLauncher'];
    for (const defKey of defensePriorities) {
      const count = Math.max(1, Math.floor(shipyardLevel / 3));
      if (await tryBuildDefenses(player, planet, defKey, count)) {
        changed = true;
      }
    }
    
    // If shipyard is too low, upgrade it
    if (shipyardLevel < 10) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) {
        changed = true;
      }
    }
    
    // Keep crystal mine up for defenses
    if ((buildings[BUILDINGS.CRYSTAL_MINE] || 0) < (buildings[BUILDINGS.METAL_MINE] || 0)) {
      if (await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE)) {
        changed = true;
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
  
  // High speed AI: allowed much more fleet activity
  if (player.fleets.length >= 20) return false;

  let changed = false;

  for (const planet of player.planets) {
    // --- Mission Type 1: Expedition (Exploration) ---
    // Increased probability for faster-paced game
    const hasCombatShips = (planet.ships?.lightFighter || 0) > 0;
    const activeExpeditionsFromPlanet = player.fleets.filter(f => f.missionType === MISSION_TYPES.EXPEDITION && f.originCoords.every((c, i) => c === planet.coordinates[i])).length;

    // Allow multiple expeditions if planet has ships
    if (hasCombatShips && activeExpeditionsFromPlanet < 3 && Math.random() < 0.7) {
      try {
        const shipsToSend = { lightFighter: Math.max(1, Math.floor((planet.ships.lightFighter || 0) / 2)) };
        const targetCoords = [planet.coordinates[0], planet.coordinates[1], 16]; // Deep space
        await sendFleet(player.userId, planet.id, targetCoords, MISSION_TYPES.EXPEDITION, shipsToSend, {}, 0.1); // Short stay for fast game
        console.log(`[AI] ${player.username} launched expedition from ${planet.name}`);
        changed = true;
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
    if (planet.buildQueue && planet.buildQueue.length >= 5) continue;

    // Check storage
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    const shipyardLevel = planet.buildings.shipyard || 0;
    const shipBatchSize = Math.max(2, Math.floor(shipyardLevel / 2));

    if (await tryBuildShips(player, planet, 'lightFighter', shipBatchSize * 2)) {
      changed = true;
    }
    if (await tryBuildShips(player, planet, 'smallCargo', shipBatchSize)) {
      changed = true;
    }
    
    if (planet.buildQueue && planet.buildQueue.length < 5) {
      if (await tryBuild(player, planet, BUILDINGS.METAL_MINE) || 
          await tryBuild(player, planet, BUILDINGS.DEUTERIUM_SYNTHESIZER)) {
        changed = true;
      }
    }
  }
  
  return changed;
}
