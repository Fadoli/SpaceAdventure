// Player game state management
import { generateId } from '../../shared/utils.js';
import { STARTING_RESOURCES, STARTING_BUILDINGS, CONFIG } from '../../shared/constants.js';
import { SHIPS } from '../../shared/ships.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { updatePlanetProduction } from './buildings.js';

let playersCache = null;

/**
 * Get all players (uses in-memory cache if available)
 */
export async function getPlayers() {
  if (playersCache) {
    return playersCache;
  }
  const data = await readJsonFile('players.json');
  playersCache = data?.players || [];
  return playersCache;
}

/**
 * Save players to storage and update cache
 */
export async function savePlayers(players) {
  playersCache = players;
  return await writeJsonFile('players.json', { players });
}

/**
 * Get player by user ID
 */
export async function getPlayerByUserId(userId) {
  const players = await getPlayers();
  let player = players.find(p => p.userId === userId);
  
  // Initialize missing fields for backward compatibility
  if (player) {
    if (!player.research) player.research = {};
    if (!player.researchQueue) player.researchQueue = [];
    if (!player.practicalResearch) player.practicalResearch = {};
    if (!player.practicalResearchQueue) player.practicalResearchQueue = [];
    if (!player.customBuildingVariants) player.customBuildingVariants = {};
    if (!player.customShipVariants) player.customShipVariants = {};
    if (!player.buildingBlueprints) player.buildingBlueprints = {};
    if (!player.shipBlueprints) player.shipBlueprints = {};
  }
  
  return player;
}

/**
 * Find a suitable available planet slot [G, S, P] for a new player.
 * Implements randomization and population bias: 
 * - Avoids first 50 and last 50 systems if possible.
 * - Randomizes selection rather than sequential filling.
 */
async function findAvailablePlanetSlot() {
  const players = await getPlayers();
  const occupied = new Set();
  
  players.forEach(p => {
    p.planets.forEach(pl => {
      occupied.add(pl.coordinates.join(':'));
    });
  });

  // Galaxy: 1-10
  // System: 1-499
  // Position: 1-15 (Home worlds usually 4-12, but we allow 1-15)

  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const g = Math.floor(Math.random() * 10) + 1;
    
    // Bias: 80% chance to pick from middle systems (51-449)
    let s;
    if (Math.random() < 0.8) {
      s = Math.floor(Math.random() * 399) + 51;
    } else {
      s = Math.floor(Math.random() * 499) + 1;
    }

    // Homeworlds are usually not on the extremes
    const p = Math.floor(Math.random() * 9) + 4; // 4 to 12
    
    const coords = [g, s, p];
    if (!occupied.has(coords.join(':'))) {
      return coords;
    }
  }
  
  // Fallback to systematic search if randomization fails
  for (let g = 1; g <= 10; g++) {
    for (let s = 51; s <= 449; s++) { // Prefer middle
      for (let p = 4; p <= 12; p++) {
        const coords = [g, s, p];
        if (!occupied.has(coords.join(':'))) return coords;
      }
    }
  }
  
  throw new Error('No available planet slots found in preferred sectors');
}

/**
 * Create new player for a user
 */
export async function createPlayer(userId, username) {
  const players = await getPlayers();
  
  // Check if player already exists
  const existing = players.find(p => p.userId === userId);
  if (existing) {
    return existing;
  }
  
  // Find an empty planet slot
  const startingCoords = await findAvailablePlanetSlot();
  
  // Create starting planet
  const planetId = generateId();
  const planet = {
    id: planetId,
    name: 'Homeworld',
    coordinates: startingCoords,
    resources: { ...STARTING_RESOURCES },
    buildings: { ...STARTING_BUILDINGS },
    production: {
      metal: 30,
      crystal: 15,
      deuterium: 0,
      energy: 0,
      water: 40,
      food: 30
    },
    consumption: {
      energy: 0,
      water: 0,
      food: 0
    },
    storage: {
      metal: 10000,
      crystal: 10000,
      deuterium: 10000,
      water: 10000,
      food: 10000
    },
    maxPopulation: 100,
    energyConsumption: 0,
    energyEfficiency: 100,
    buildQueue: [],
    ships: {},
    defenses: {},
    // Building allocation: tracks power % and population % for each building + priority
    buildingAllocations: {
      metalMine: { power: 1.0, population: 1.0, powerPriority: 3, populationPriority: 3 },
      crystalMine: { power: 1.0, population: 1.0, powerPriority: 3, populationPriority: 3 },
      deuteriumSynthesizer: { power: 1.0, population: 1.0, powerPriority: 3, populationPriority: 3 },
      waterExtractor: { power: 1.0, population: 1.0, powerPriority: 3, populationPriority: 3 },
      farm: { power: 1.0, population: 1.0, powerPriority: 3, populationPriority: 3 }
    },
    lastUpdate: Date.now(),
    lastActivity: Date.now()
  };
  
  // Calculate proper production based on starting buildings
  updatePlanetProduction(planet);
  
  // Create player
  const player = {
    userId,
    username,
    planets: [planet],
    // Theoretical research: technology unlocks
    research: {
      energyTech: 0,
      computerTech: 0,
      weaponsTech: 0,
      shieldingTech: 0,
      armorTech: 0,
      combustionDrive: 0,
      impulseDrive: 0,
      hyperspaceDrive: 0,
      espionageTech: 0,
      astrophysics: 0
    },
    // Theoretical research queue
    researchQueue: [],
    // Practical research: customization focuses per building/ship type
    // Structure: { metalMine: { output: 5, automation: 2, energy: 1, cost: 0 }, ... }
    practicalResearch: {},
    // Practical research queue
    practicalResearchQueue: [],
    // Selected custom variants per planet
    // Structure: { planetId: { metalMine: { focusLevels: {...}, modifiers: {...} }, ... } }
    customBuildingVariants: {},
    customShipVariants: {},
    fleets: []
  };
  
  players.push(player);
  await savePlayers(players);
  
  return player;
}

/**
 * Update player data
 */
export async function updatePlayer(userId, playerData) {
  const players = await getPlayers();
  const index = players.findIndex(p => p.userId === userId);
  
  if (index === -1) {
    throw new Error('Player not found');
  }
  
  players[index] = playerData;
  await savePlayers(players);
  
  return playerData;
}

/**
 * Get planet by ID
 */
export async function getPlanetById(userId, planetId) {
  const player = await getPlayerByUserId(userId);
  if (!player) return null;
  
  return player.planets.find(p => p.id === planetId);
}

/**
 * Update resources for a planet
 */
export async function updatePlanetResources(userId, planetId, resources) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');
  
  planet.resources = resources;
  planet.lastUpdate = Date.now();
  
  await updatePlayer(userId, player);
  return planet;
}

/**
 * Rename a planet with rate limiting
 */
export async function renamePlanet(userId, planetId, newName) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');
  
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');
  
  // Validation
  if (!newName || newName.length < 3 || newName.length > 20) {
    throw new Error('Name must be 3-20 characters');
  }
  
  if (!/^[a-zA-Z0-9\s_-]+$/.test(newName)) {
    throw new Error('Name can only contain letters, numbers, spaces, underscores, and hyphens');
  }
  
  // Rate limiting (once per hour)
  const COOLDOWN = 60 * 60 * 1000; // 1 hour
  const now = Date.now();
  
  if (planet.lastRenamed && (now - planet.lastRenamed < COOLDOWN)) {
    const remaining = Math.ceil((COOLDOWN - (now - planet.lastRenamed)) / 60000);
    throw new Error(`You can only rename this planet once per hour. Please wait ${remaining} minutes.`);
  }
  
  planet.name = newName.trim();
  planet.lastRenamed = now;
  
  await updatePlayer(userId, player);
  return planet;
}

/**
 * Recompute all planets on startup (in-memory only, no persistence)
 * This ensures all derived values are correctly calculated based on:
 * - Current buildings and their levels
 * - CONFIG constants (POPULATION_HOUSING_RATIO, etc)
 * - Building allocations
 * Recomputed values include: production, consumption, storage, maxPopulation, etc
 */
export async function recomputeAllPlanetsOnStartup() {
  try {
    const players = await getPlayers();
    let recomputedCount = 0;
    
    for (const player of players) {
      // Initialize player-level research fields if missing
      if (!player.research) player.research = {};
      if (!player.researchQueue) player.researchQueue = [];
      if (!player.practicalResearch) player.practicalResearch = {};
      if (!player.practicalResearchQueue) player.practicalResearchQueue = [];
      if (!player.customBuildingVariants) player.customBuildingVariants = {};
      if (!player.customShipVariants) player.customShipVariants = {};
      if (!player.buildingBlueprints) player.buildingBlueprints = {};
      if (!player.shipBlueprints) player.shipBlueprints = {};

      // Cleanup blueprints data integrity
      for (const shipType in player.shipBlueprints) {
        player.shipBlueprints[shipType].forEach(blueprint => {
          if (blueprint.customDefinition) {
            // Fix NaN speed if any
            if (blueprint.customDefinition.speed === null || isNaN(blueprint.customDefinition.speed)) {
              blueprint.customDefinition.speed = SHIPS[blueprint.baseType]?.speed || 0;
            }
          }
        });
      }

      for (const planet of player.planets) {
        // Initialize building allocations if missing
        if (!planet.buildingAllocations) {
          planet.buildingAllocations = {};
        }
        
        // Initialize ships and defenses if missing
        if (!planet.ships) {
          planet.ships = {};
        }
        if (!planet.defenses) {
          planet.defenses = {};
        }
        
        // Initialize queues if missing
        if (!planet.buildQueue) {
          planet.buildQueue = [];
        }
        if (!planet.shipQueue) {
          planet.shipQueue = [];
        }
        if (!planet.defenseQueue) {
          planet.defenseQueue = [];
        }
        
        // Recompute production values (includes storage, consumption, maxPopulation, etc)
        // updatePlanetProduction handles:
        // - Production calculations for all buildings
        // - Storage capacity from storage buildings
        // - Energy consumption and efficiency
        // - Population requirements
        // - maxPopulation calculation
        await updatePlanetProduction(planet, player);
        
        recomputedCount++;
      }
    }
    
    console.log(`[Startup] Recomputed all planetary data for ${recomputedCount} planets`);
  } catch (error) {
    console.error('[Startup] Error recomputing planets:', error.message);
  }
}
