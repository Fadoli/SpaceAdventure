// Player game state management
import { generateId } from '../../shared/utils.js';
import { STARTING_RESOURCES, STARTING_BUILDINGS, CONFIG } from '../../shared/constants.js';
import { SHIPS } from '../../shared/ships.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { updatePlanetProduction, ensurePlanetState } from './buildings.js';
import { registerPlayer, getGalaxyData } from './galaxyData.js';

const playersCache = new Map();

/**
 * Find a suitable available planet slot [G, S, P] for a new player.
 */
export async function findAvailablePlanetSlot() {
  const players = await getPlayers();
  const occupied = new Set();
  
  players.forEach(p => {
    if (p && p.planets) {
      p.planets.forEach(pl => {
        occupied.add(pl.coordinates.join(':'));
      });
    }
  });

  const maxAttempts = 1000;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const g = Math.floor(Math.random() * 10) + 1;
    let s = Math.random() < 0.8 ? Math.floor(Math.random() * 399) + 51 : Math.floor(Math.random() * 499) + 1;
    const p = Math.floor(Math.random() * 9) + 4; // 4 to 12
    
    const coords = [g, s, p];
    if (!occupied.has(coords.join(':'))) return coords;
  }
  
  for (let g = 1; g <= 10; g++) {
    for (let s = 51; s <= 449; s++) {
      for (let p = 4; p <= 12; p++) {
        const coords = [g, s, p];
        if (!occupied.has(coords.join(':'))) return coords;
      }
    }
  }
  throw new Error('No available planet slots found');
}

/**
 * Get all players (reads from galaxy registry)
 */
export async function getPlayers() {
  const galaxy = await getGalaxyData();
  const playerIds = Object.keys(galaxy.playerRegistry || {});
  
  const players = await Promise.all(playerIds.map(id => getPlayerByUserId(id)));
  return players.filter(p => p !== null);
}

/**
 * Save players (Legacy - updated to per-player save)
 */
export async function savePlayers(players) {
  for (const player of players) {
    if (player && player.userId) {
      await updatePlayer(player.userId, player);
    }
  }
}

/**
 * Get player by user ID (reads from cache or individual file)
 */
export async function getPlayerByUserId(userId) {
  if (playersCache.has(userId)) {
    return playersCache.get(userId);
  }

  const player = await readJsonFile(`players/${userId}/data.json`);
  
  if (player) {
    // Initialize missing fields for backward compatibility
    if (!player.research) player.research = {};
    if (!player.researchQueue) player.researchQueue = [];
    if (!player.practicalResearch) player.practicalResearch = {};
    if (!player.practicalResearchQueue) player.practicalResearchQueue = [];
    if (!player.customBuildingVariants) player.customBuildingVariants = {};
    if (!player.buildingBlueprints) player.buildingBlueprints = {};
    if (!player.statistics) player.statistics = { totalResourcesSpent: 0 };
    if (player.allianceId === undefined) player.allianceId = null;
    if (player.allianceRole === undefined) player.allianceRole = null;
    if (!player.relations) player.relations = {};
    
    playersCache.set(userId, player);
  }
  
  return player;
}

/**
 * Create new player for a user
 */
export async function createPlayer(userId, username) {
  // Check if player already exists in registry
  const galaxy = await getGalaxyData();
  if (galaxy.playerRegistry[userId]) {
    return await getPlayerByUserId(userId);
  }
  
  const startingCoords = await findAvailablePlanetSlot();
  const planetId = generateId();
  const planet = {
    id: planetId,
    name: 'Homeworld',
    coordinates: startingCoords,
    resources: { ...STARTING_RESOURCES },
    buildings: { ...STARTING_BUILDINGS },
    production: { metal: 30, crystal: 15, deuterium: 0, energy: 0, water: 40, food: 30 },
    consumption: { energy: 0, water: 0, food: 0 },
    storage: { metal: 10000, crystal: 10000, deuterium: 10000, water: 10000, food: 10000 },
    maxPopulation: 100,
    energyConsumption: 0,
    energyEfficiency: 100,
    buildQueue: [],
    ships: {},
    defenses: {},
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
  
  ensurePlanetState(planet);
  updatePlanetProduction(planet);
  
  const player = {
    userId,
    username,
    planets: [planet],
    research: {
      energyTech: 0, computerTech: 0, weaponsTech: 0, shieldingTech: 0, armorTech: 0,
      combustionDrive: 0, impulseDrive: 0, hyperspaceDrive: 0, espionageTech: 0, astrophysics: 0
    },
    researchQueue: [],
    practicalResearch: {},
    practicalResearchQueue: [],
    customBuildingVariants: {},
    fleets: [],
    relations: {},
    statistics: { totalResourcesSpent: 0 }
  };
  
  await updatePlayer(userId, player);
  await registerPlayer(userId, username, planet.coordinates);
  
  return player;
}

/**
 * Update player data (writes to individual file)
 */
export async function updatePlayer(userId, playerData) {
  playersCache.set(userId, playerData);
  await writeJsonFile(`players/${userId}/data.json`, playerData);
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
 * Rename a planet
 */
export async function renamePlanet(userId, planetId, newName) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');
  const planet = player.planets.find(p => p.id === planetId);
  if (!planet) throw new Error('Planet not found');
  if (!newName || newName.length < 3 || newName.length > 20) throw new Error('Name must be 3-20 characters');
  if (!/^[a-zA-Z0-9\s_-]+$/.test(newName)) throw new Error('Invalid characters');
  const COOLDOWN = 3600000;
  const now = Date.now();
  if (planet.lastRenamed && (now - planet.lastRenamed < COOLDOWN)) throw new Error('Rename cooldown');
  planet.name = newName.trim();
  planet.lastRenamed = now;
  await updatePlayer(userId, player);
  return planet;
}

/**
 * Update relation tag for another player
 */
export async function updatePlayerRelation(userId, targetUserId, tag) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');
  
  if (!player.relations) player.relations = {};
  
  if (tag === null || tag === 'none') {
    delete player.relations[targetUserId];
  } else if (['friend', 'enemy'].includes(tag)) {
    player.relations[targetUserId] = tag;
  } else {
    throw new Error('Invalid relation tag');
  }
  
  await updatePlayer(userId, player);
  return player.relations;
}

/**
 * Get list of friends (ID and Username)
 */
export async function getFriends(userId) {
  const player = await getPlayerByUserId(userId);
  if (!player || !player.relations) return [];

  const friends = [];
  const allPlayers = await getPlayers();

  for (const targetId in player.relations) {
    if (player.relations[targetId] === 'friend') {
      const targetPlayer = allPlayers.find(p => p.userId === targetId);
      friends.push({
        id: targetId,
        username: targetPlayer ? targetPlayer.username : 'Unknown'
      });
    }
  }

  return friends;
}

/**
 * Track spent resources for ranking
 */
export function trackSpentResources(player, cost) {
  if (!player.statistics) player.statistics = { totalResourcesSpent: 0 };
  
  const metal = cost.metal || 0;
  const crystal = cost.crystal || 0;
  const deuterium = cost.deuterium || 0;
  const food = cost.food || 0;
  const water = cost.water || 0;
  
  player.statistics.totalResourcesSpent += (metal + crystal + deuterium + food + water);
}

/**
 * Get a specific player's rank index
 */
export async function getPlayerRankIndex(userId) {
  const players = await getPlayers();
  
  const rankings = players.map(p => ({
    userId: p.userId,
    totalSpent: p.statistics?.totalResourcesSpent || 0
  }));
  
  // Sort by total spent descending
  rankings.sort((a, b) => b.totalSpent - a.totalSpent);
  
  return rankings.findIndex(r => r.userId === userId);
}

/**
 * Get player rankings based on total resources spent
 */
export async function getRankings(offset = 0, limit = 100) {
  const players = await getPlayers();
  
  const rankings = players.map(p => ({
    userId: p.userId,
    username: p.username,
    totalSpent: p.statistics?.totalResourcesSpent || 0,
    planets: p.planets.length,
    homeworldCoords: p.planets[0]?.coordinates || [1, 1, 1]
  }));
  
  // Sort by total spent descending
  rankings.sort((a, b) => b.totalSpent - a.totalSpent);
  
  const totalPlayers = rankings.length;
  
  // Add rank position to all (needed for pagination)
  const rankedAll = rankings.map((r, index) => ({
    rank: index + 1,
    ...r
  }));

  // Limit to the requested range
  const slicedRankings = rankedAll.slice(offset, offset + limit);
  
  return {
    rankings: slicedRankings,
    totalPlayers,
    offset,
    limit
  };
}

/**
 * Recompute all planets on startup
 */
export async function recomputeAllPlanetsOnStartup() {
  try {
    const players = await getPlayers();
    let recomputedCount = 0;
    for (const player of players) {
      if (!player) continue;
      for (const planet of player.planets) {
        await updatePlanetProduction(planet, player);
        recomputedCount++;
      }
      await updatePlayer(player.userId, player);
    }
    console.log(`[Startup] Recomputed ${recomputedCount} planets`);
  } catch (error) {
    console.error('[Startup] Error:', error.message);
  }
}
