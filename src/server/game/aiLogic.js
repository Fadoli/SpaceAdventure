import { AI_TYPES, BUILDINGS, TECHNOLOGIES, MISSION_TYPES, CONFIG } from '../../shared/constants.js';
import { SHIPS, calculateShipCost } from '../../shared/ships.js';
import { DEFENSES, calculateDefenseCost } from '../../shared/defenses.js';
import { upgradeBuilding, createBuildingBlueprint, setActiveBlueprint, getBuildingCost } from './buildings.js';
import { buildShips, buildDefenses } from './shipyard.js';
import { startTheoreticalResearch, startPracticalResearchWithAllocation } from './researchLogic.js';
import { sendFleet } from './fleet.js';
import { updatePlayer, findAvailablePlanetSlot, renamePlanet, getPlayers } from './player.js';
import { isEmpty } from '../../shared/utils.js';
import { getResearchBonus, getTheoreticalResearch, getPracticalResearch } from '../../shared/research.js';
import { calculateTheoreticalResearchCost, calculatePracticalResearchCost, calculateFocusLevel, calculateMaxPlanets } from '../../shared/formulas.js';

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
export async function processAiPlayer(player, now = Date.now()) {
  if (!player.isAI) return false;
  
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

  // 5b. Handle AI Espionage
  updated = await handleAiEspionage(player) || updated;

  // 6. Handle Colonization
  updated = await handleColonization(player) || updated;

  // 7. Handle Flavor (Renaming)
  updated = await handlePlanetRenaming(player, now) || updated;
  
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
  const maxPlanets = calculateMaxPlanets(player.research);
  
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
      const targetCoords = await findAvailablePlanetSlot(player.planets);
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
async function handlePlanetRenaming(player, now = Date.now()) {
  let changed = false;
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
 * Helper to check and execute dynamic build order based on planet state
 */
async function handleBuildOrder(player, planet) {
  if (planet.buildQueue && planet.buildQueue.length > 0) return false;

  const b = planet.buildings || {};
  const res = planet.resources || {};
  const prod = planet.production || {};
  const cons = planet.consumption || {};

  // 1. EMERGENCY ENERGY (High Priority)
  // If efficiency is low or net energy is very low, prioritize energy.
  const energyEfficiency = planet.energyEfficiency || 100;
  if (energyEfficiency < 100 || (prod.energy || 0) < 2) {
    if (await tryBuild(player, planet, BUILDINGS.SOLAR_PLANT)) return true;
    // If we can't afford solar, we might need a Fusion Reactor if available
    const hasFusion = (b[BUILDINGS.FUSION_REACTOR] || 0) > 0 || (player.research.energyTech || 0) >= 3;
    if (hasFusion) {
      if (await tryBuild(player, planet, BUILDINGS.FUSION_REACTOR)) return true;
    }
    return true; // Wait for energy resources
  }

  // 2. LIFE SUPPORT (High Priority)
  // Check net production. If near zero or negative, upgrade immediately.
  const netWater = (prod.water || 0) - (cons.water || 0);
  const netFood = (prod.food || 0) - (cons.food || 0);
  
  if (netWater < 5) {
    if (await tryBuild(player, planet, BUILDINGS.WATER_EXTRACTOR)) return true;
    return true; // Wait for water
  }
  if (netFood < 5) {
    if (await tryBuild(player, planet, BUILDINGS.FARM)) return true;
    return true; // Wait for food
  }

  // 3. HOUSING (Medium Priority)
  // If population is near capacity, upgrade housing.
  const maxPop = planet.maxPopulation || 100;
  const currentPop = res.population || 0;
  if (currentPop > maxPop * 0.85) {
    if (await tryBuild(player, planet, BUILDINGS.HOUSING)) return true;
    // Don't stall here if we can't afford housing yet, but it's important.
  }

  // 4. RESOURCE BALANCE & SCALING (Normal Priority)
  const metalLvl = b[BUILDINGS.METAL_MINE] || 0;
  const crystalLvl = b[BUILDINGS.CRYSTAL_MINE] || 0;
  const deutLvl = b[BUILDINGS.DEUTERIUM_SYNTHESIZER] || 0;

  // Early metal push
  if (metalLvl < 5 && metalLvl <= crystalLvl) {
    if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) return true;
  }

  // Crystal should stay around 70-80% of metal
  if (crystalLvl < metalLvl * 0.75) {
    if (await tryBuild(player, planet, BUILDINGS.CRYSTAL_MINE)) return true;
  }

  // Deut should be around 50% of metal once established
  if (metalLvl >= 10 && deutLvl < metalLvl * 0.5) {
    if (await tryBuild(player, planet, BUILDINGS.DEUTERIUM_SYNTHESIZER)) return true;
  }

  // 5. INFRASTRUCTURE CATCH-UP (Normal Priority)
  // Robotics, Lab, Shipyard should scale with the colony size.
  if (metalLvl >= 6) {
    const roboticsLvl = b[BUILDINGS.ROBOTICS_FACTORY] || 0;
    const labLvl = b[BUILDINGS.RESEARCH_LAB] || 0;
    const shipyardLvl = b[BUILDINGS.SHIPYARD] || 0;

    // Robotics Factory (Speeds up construction)
    if (roboticsLvl < metalLvl * 0.4 && roboticsLvl < 10) {
      if (await tryBuild(player, planet, BUILDINGS.ROBOTICS_FACTORY)) return true;
    }

    // Research Lab (Needed for tech)
    if (labLvl < metalLvl * 0.3 && labLvl < 12) {
      if (await tryBuild(player, planet, BUILDINGS.RESEARCH_LAB)) return true;
    }

    // Shipyard (Needed for defense and expansion)
    if (shipyardLvl < metalLvl * 0.3 && shipyardLvl < 12) {
      if (await tryBuild(player, planet, BUILDINGS.SHIPYARD)) return true;
    }
  }

  // 6. DEFAULT PROGRESSION
  // If nothing else is urgent, push Metal Mine.
  if (await tryBuild(player, planet, BUILDINGS.METAL_MINE)) return true;

  return false;
}

/**
 * Balanced strategy: build resources with a specific ratio
 */
async function handleBalancedStrategy(player) {
  let changed = false;
  
  for (const planet of player.planets) {
    if (planet.buildQueue && planet.buildQueue.length >= 5) continue;
    
    // Check storage (Critical)
    if (await handleStorageNeed(player, planet)) {
      changed = true;
      continue;
    }

    // Follow early build order for homeworld/early colonies
    if (await handleBuildOrder(player, planet)) {
      changed = true;
      continue;
    }

    // Mid-game Ratio Logic
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
      // Facilities should stay around 70% of mine levels
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

    // Follow early build order
    if (await handleBuildOrder(player, planet)) {
      changed = true;
      continue;
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

    // Follow early build order
    if (await handleBuildOrder(player, planet)) {
      changed = true;
      continue;
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
 * AI Espionage Logic: Spy on other players, prioritizing nearby systems (Optimized)
 */
async function handleAiEspionage(player) {
  if (Math.random() > 0.4) return false;

  // 1. Find a planet with espionage probes
  const originPlanet = player.planets.find(p => (p.ships?.espionageProbe || 0) > 0);

  if (!originPlanet) {
    const shipyardPlanet = player.planets.find(p => (p.buildings.shipyard || 0) >= 1);
    if (shipyardPlanet && Math.random() < 0.2) {
      await tryBuildShips(player, shipyardPlanet, 'espionageProbe', 2);
    }
    return false;
  }

  // 2. Select a target coordinate using a weighted proximity strategy
  // 70% chance same system, 20% same galaxy, 10% random
  const [g, s] = originPlanet.coordinates;
  let targetCoords;
  const roll = Math.random();

  if (roll < 0.7) {
    // Local: Same system, random position
    targetCoords = [g, s, Math.floor(Math.random() * 15) + 1];
  } else if (roll < 0.9) {
    // Regional: Same galaxy, nearby system (+/- 10)
    const targetS = Math.max(1, Math.min(499, s + Math.floor(Math.random() * 21) - 10));
    targetCoords = [g, targetS, Math.floor(Math.random() * 15) + 1];
  } else {
    // Inter-galactic: Random
    targetCoords = [
      Math.floor(Math.random() * 10) + 1,
      Math.floor(Math.random() * 499) + 1,
      Math.floor(Math.random() * 15) + 1
    ];
  }

  // Don't spy on self
  const isSelf = player.planets.some(p => p.coordinates.every((c, i) => c === targetCoords[i]));
  if (isSelf) return false;

  // 3. Check if target is occupied (Efficient lookup)
  const allPlayers = await getPlayers();
  let targetPlayer = null;
  let targetPlanet = null;

  for (const p of allPlayers) {
    targetPlanet = p.planets.find(pl => pl.coordinates.every((c, i) => c === targetCoords[i]));
    if (targetPlanet) {
      targetPlayer = p;
      break;
    }
  }

  if (!targetPlanet || targetPlayer.userId === player.userId) return false;

  // 4. Mission Check
  const alreadySpying = player.fleets?.some(f => 
    f.missionType === MISSION_TYPES.ESPIONAGE && 
    f.targetCoords.every((c, i) => c === targetCoords[i])
  );
  if (alreadySpying) return false;

  try {
    await sendFleet(player.userId, originPlanet.id, targetCoords, MISSION_TYPES.ESPIONAGE, { espionageProbe: 1 });
    console.log(`[AI] ${player.username} launched intelligence scan on ${targetPlayer.username} at ${targetCoords.join(':')}`);
    return true;
  } catch (e) {
    return false;
  }
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

    // Follow early build order
    if (await handleBuildOrder(player, planet)) {
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
