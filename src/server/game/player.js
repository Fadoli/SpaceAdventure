// Player game state management
import { generateId } from '../../shared/utils.js';
import { STARTING_RESOURCES, STARTING_BUILDINGS, CONFIG } from '../../shared/constants.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { updatePlanetProduction, ensurePlanetState } from './buildings.js';
import { registerPlayer, getGalaxyData } from './galaxyData.js';
import { SHIPS } from '../../shared/ships.js';
import { BUILDINGS } from '../../shared/buildings.js';
import { THEORETICAL_RESEARCH } from '../../shared/research.js';
import { DEFENSES } from '../../shared/defenses.js';
import { SCALING } from '../../shared/constants.js';
import { calculateBuildingCost, calculateTheoreticalResearchCost } from '../../shared/formulas.js';

const playersCache = new Map();
const dirtyPlayers = new Set();

/**
 * Find a suitable available planet slot [G, S, P] for a new player or expansion.
 * @param {Array} nearPlanets - Optional array of existing planets to expand around
 */
export async function findAvailablePlanetSlot(nearPlanets = null) {
  const players = await getPlayers();
  const occupied = new Set();
  
  players.forEach(p => {
    if (p && p.planets) {
      p.planets.forEach(pl => {
        occupied.add(pl.coordinates.join(':'));
      });
    }
  });

  // If we want to expand near existing colonies
  if (nearPlanets && nearPlanets.length > 0) {
    // 1. Try to find a slot in the same system as a random existing planet
    const basePlanet = nearPlanets[Math.floor(Math.random() * nearPlanets.length)];
    const [bg, bs] = basePlanet.coordinates;
    
    // Try systems in increasing distance
    for (let dist = 0; dist <= 5; dist++) {
      const systems = [];
      if (dist === 0) systems.push(bs);
      else {
        if (bs - dist >= 1) systems.push(bs - dist);
        if (bs + dist <= 499) systems.push(bs + dist);
      }

      for (const s of systems) {
        const slots = [4, 5, 6, 7, 8, 9, 10, 11, 12];
        // Shuffle slots
        for (let i = slots.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [slots[i], slots[j]] = [slots[j], slots[i]];
        }

        for (const p of slots) {
          const coords = [bg, s, p];
          if (!occupied.has(coords.join(':'))) return coords;
        }
      }
    }
  }

  // Fallback to random global search
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
export async function getPlayerByUserId(userId, forceFresh = false) {
  if (!forceFresh && playersCache.has(userId)) {
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
 * Update player data (In-memory update + Mark dirty)
 */
export async function updatePlayer(userId, playerData) {
  playersCache.set(userId, playerData);
  dirtyPlayers.add(userId);
  return playerData;
}

/**
 * Flush all dirty player data to disk
 */
export async function flushDirtyPlayers() {
  if (dirtyPlayers.size === 0) return;

  const count = dirtyPlayers.size;
  console.log(`[Storage] Flushing ${count} dirty players to disk...`);

  const ids = Array.from(dirtyPlayers);
  dirtyPlayers.clear();

  for (const userId of ids) {
    const player = playersCache.get(userId);
    if (player) {
      await writeJsonFile(`players/${userId}/data.json`, player);
    }
  }
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
 * Recompute a player's scores based on current assets (1 point per 1000 resources)
 */
export async function recomputePlayerScores(player) {
  if (!player.statistics) {
    player.statistics = { 
      totalResourcesSpent: 0,
      economySpent: 0,
      researchSpent: 0,
      fleetSpent: 0,
      miscSpent: 0
    };
  }

  let economyScore = 0;
  let researchScore = 0;
  let fleetScore = 0;

  // 1. Recompute Economy (Buildings)
  for (const planet of player.planets) {
    for (const bType in planet.buildings) {
      const level = planet.buildings[bType];
      if (level <= 0) continue;
      const def = BUILDINGS[bType];
      if (!def) continue;

      // Sum cost of all levels from 1 up to current level
      for (let l = 1; l <= level; l++) {
        const cost = calculateBuildingCost(def.baseCost, l - 1, 0, def.costScaling);
        economyScore += (cost.metal + cost.crystal + cost.deuterium);
      }
    }
  }

  // 2. Recompute Research
  for (const techKey in player.research) {
    const level = player.research[techKey];
    if (level <= 0) continue;
    const def = THEORETICAL_RESEARCH[techKey];
    if (!def) continue;

    for (let l = 1; l <= level; l++) {
      const cost = calculateTheoreticalResearchCost(def.baseCost, l - 1);
      researchScore += (cost.metal + cost.crystal + cost.deuterium);
    }
  }

  // 3. Recompute Fleet (Ships and Defenses)
  for (const planet of player.planets) {
    // Ships
    for (const shipKey in planet.ships) {
      const count = planet.ships[shipKey];
      if (count <= 0) continue;
      const def = SHIPS[shipKey];
      if (!def) continue;
      fleetScore += (def.baseCost.metal + def.baseCost.crystal + def.baseCost.deuterium) * count;
    }
    // Defenses
    for (const defKey in planet.defenses) {
      const count = planet.defenses[defKey];
      if (count <= 0) continue;
      const def = DEFENSES[defKey];
      if (!def) continue;
      fleetScore += (def.baseCost.metal + def.baseCost.crystal + def.baseCost.deuterium) * count;
    }
  }

  // Add fleet currently in flight
  if (player.fleets) {
    for (const fleet of player.fleets) {
      for (const shipKey in fleet.ships) {
        const count = fleet.ships[shipKey];
        if (count <= 0) continue;
        const def = SHIPS[shipKey];
        if (!def) continue;
        fleetScore += (def.baseCost.metal + def.baseCost.crystal + def.baseCost.deuterium) * count;
      }
    }
  }

  // Update statistics (storing raw resource value, rankings convert to points if needed, 
  // but current rankings show these raw values as 'Score')
  player.statistics.economySpent = economyScore;
  player.statistics.researchSpent = researchScore;
  player.statistics.fleetSpent = fleetScore;
  player.statistics.totalResourcesSpent = economyScore + researchScore + fleetScore;

  return player.statistics;
}

/**
 * Get a specific player's rank index
 */
export async function getPlayerRankIndex(userId, category = 'total') {
  const players = await getPlayers();
  
  const rankings = players.map(p => {
    let score = 0;
    if (category === 'economy') score = p.statistics?.economySpent || 0;
    else if (category === 'research') score = p.statistics?.researchSpent || 0;
    else if (category === 'fleet') score = p.statistics?.fleetSpent || 0;
    else score = p.statistics?.totalResourcesSpent || 0;

    return {
      userId: p.userId,
      score
    };
  });
  
  // Sort by score descending
  rankings.sort((a, b) => b.score - a.score);
  
  return rankings.findIndex(r => r.userId === userId);
}

/**
 * Take a snapshot of all rankings for historical comparison
 */
export async function takeRankingSnapshot() {
  const categories = ['total', 'economy', 'research', 'fleet'];
  const players = await getPlayers();
  
  // Recompute all scores before snapshot to ensure accuracy
  for (const player of players) {
    await recomputePlayerScores(player);
  }

  const snapshot = {
    timestamp: Date.now(),
    rankings: {}
  };

  for (const cat of categories) {
    const rankings = players.map(p => {
      let score = 0;
      if (cat === 'economy') score = p.statistics?.economySpent || 0;
      else if (cat === 'research') score = p.statistics?.researchSpent || 0;
      else if (cat === 'fleet') score = p.statistics?.fleetSpent || 0;
      else score = p.statistics?.totalResourcesSpent || 0;

      return { userId: p.userId, score };
    });

    // Sort to determine rank position
    rankings.sort((a, b) => b.score - a.score);
    
    snapshot.rankings[cat] = rankings.map((r, index) => ({
      userId: r.userId,
      score: r.score,
      rank: index + 1
    }));
  }

  // Load history
  let historyData = await readJsonFile('rankings_history.json') || { snapshots: [] };
  
  // Add new snapshot
  historyData.snapshots.push(snapshot);

  // Keep only the last 5 snapshots (0h, 6h, 12h, 18h, 24h)
  if (historyData.snapshots.length > 5) {
    historyData.snapshots.shift();
  }

  await writeJsonFile('rankings_history.json', historyData);
  return snapshot;
}

/**
 * Get player rankings based on total resources spent
 * @param {number} offset - Pagination offset
 * @param {number} limit - Pagination limit
 * @param {Object} alliances - Map of allianceId to alliance data (to include tags)
 * @param {string} category - Ranking category (total, economy, research, fleet)
 */
export async function getRankings(offset = 0, limit = 100, alliances = {}, category = 'total') {
  offset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;
  limit = Number.isFinite(limit) ? Math.min(100, Math.max(1, Math.trunc(limit))) : 100;
  if (!['total', 'economy', 'research', 'fleet'].includes(category)) category = 'total';
  const players = await getPlayers();
  
  // Load ranking history for 24h change calculation
  const historyData = await readJsonFile('rankings_history.json');
  const oldSnapshot = historyData?.snapshots?.[0]; // Oldest snapshot (approx 24h ago if full)

  const rankings = players.map(p => {
    let allianceTag = null;
    if (p.allianceId && alliances[p.allianceId]) {
      allianceTag = alliances[p.allianceId].tag;
    }

    let score = 0;
    if (category === 'economy') score = p.statistics?.economySpent || 0;
    else if (category === 'research') score = p.statistics?.researchSpent || 0;
    else if (category === 'fleet') score = p.statistics?.fleetSpent || 0;
    else score = p.statistics?.totalResourcesSpent || 0;

    let scoreChange = 0;
    if (oldSnapshot && oldSnapshot.rankings[category]) {
      const oldEntry = oldSnapshot.rankings[category].find(r => r.userId === p.userId);
      if (oldEntry) {
        scoreChange = score - oldEntry.score;
      }
    }

    return {
      userId: p.userId,
      username: p.username,
      score: score,
      scoreChange: scoreChange,
      planets: p.planets.length,
      homeworldCoords: p.planets[0]?.coordinates || [1, 1, 1],
      allianceTag
    };
  });
  
  // Sort by score descending
  rankings.sort((a, b) => b.score - a.score);
  
  const totalPlayers = rankings.length;
  
  // Add rank position and rank change
  const rankedAll = rankings.map((r, index) => {
    const currentRank = index + 1;
    let rankChange = 0;
    
    if (oldSnapshot && oldSnapshot.rankings[category]) {
      const oldEntry = oldSnapshot.rankings[category].find(oe => oe.userId === r.userId);
      if (oldEntry) {
        rankChange = oldEntry.rank - currentRank; // Positive means rank improved (e.g. 5 -> 3 = +2)
      }
    }

    return {
      rank: currentRank,
      rankChange: rankChange,
      ...r
    };
  });

  // Limit to the requested range
  const slicedRankings = rankedAll.slice(offset, offset + limit);
  
  return {
    rankings: slicedRankings,
    totalPlayers,
    offset,
    limit,
    category,
    lastSnapshotTime: oldSnapshot?.timestamp || null
  };
}

/**
 * Recompute all planets and scores on startup
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
      // Recompute scores to ensure rankings are correct after a restart
      await recomputePlayerScores(player);
    }
    console.log(`[Startup] Recomputed ${recomputedCount} planets and all player scores.`);
  } catch (error) {
    console.error('[Startup] Error:', error.message);
  }
}
