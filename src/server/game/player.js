// Player game state management
import { generateId } from '../../shared/utils.js';
import { STARTING_RESOURCES, STARTING_BUILDINGS } from '../../shared/constants.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { updatePlanetProduction } from './buildings.js';

/**
 * Get all players from storage
 */
async function getPlayers() {
  const data = await readJsonFile('players.json');
  return data?.players || [];
}

/**
 * Save players to storage
 */
async function savePlayers(players) {
  return await writeJsonFile('players.json', { players });
}

/**
 * Get player by user ID
 */
export async function getPlayerByUserId(userId) {
  const players = await getPlayers();
  return players.find(p => p.userId === userId);
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
  
  // Create starting planet
  const planetId = generateId();
  const planet = {
    id: planetId,
    name: 'Homeworld',
    coordinates: [1, 1, Math.floor(Math.random() * 15) + 1], // Random position in galaxy 1, system 1
    resources: { ...STARTING_RESOURCES },
    buildings: { ...STARTING_BUILDINGS },
    production: {
      metal: 30,
      crystal: 15,
      deuterium: 0,
      energy: 0
    },
    storage: {
      metal: 10000,
      crystal: 10000,
      deuterium: 10000
    },
    energyConsumption: 0,
    energyEfficiency: 100,
    buildQueue: [],
    ships: {},
    defenses: {},
    lastUpdate: Date.now()
  };
  
  // Calculate proper production based on starting buildings
  updatePlanetProduction(planet);
  
  // Create player
  const player = {
    userId,
    username,
    planets: [planet],
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
    researchQueue: [],
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
