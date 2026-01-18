// Global galaxy state management
import { readJsonFile, writeJsonFile } from '../storage/storage.js';

const GALAXY_FILE = 'galaxy.json';
let galaxyCache = null;
let isGalaxyDirty = false;

/**
 * Get galaxy data
 */
export async function getGalaxyData() {
  if (galaxyCache) return galaxyCache;
  
  const data = await readJsonFile(GALAXY_FILE);
  galaxyCache = data || {
    debrisFields: {}, // Format: "G:S:P": { metal: 100, crystal: 50 }
    playerRegistry: {}, // Format: userId: { username: "name", homeworld: [G,S,P] }
    ghostPlanets: {} // Format: "G:S:P": { ships, defenses, resources, createdAt }
  };
  if (!galaxyCache.ghostPlanets) galaxyCache.ghostPlanets = {};
  return galaxyCache;
}

/**
 * Update a ghost planet (spawn or remove)
 */
export async function updateGhostPlanet(coords, data) {
  const galaxy = await getGalaxyData();
  const key = coords.join(':');
  
  if (!data) {
    delete galaxy.ghostPlanets[key];
  } else {
    galaxy.ghostPlanets[key] = {
      ...data,
      coords: [...coords],
      updatedAt: Date.now()
    };
  }
  
  isGalaxyDirty = true;
}

/**
 * Save galaxy data (In-memory + Mark dirty)
 */
export async function saveGalaxyData(data) {
  galaxyCache = data;
  isGalaxyDirty = true;
  return true;
}

/**
 * Flush galaxy data to disk if dirty
 */
export async function flushGalaxyData() {
  if (!isGalaxyDirty || !galaxyCache) return;
  
  console.log('[Storage] Flushing galaxy data to disk...');
  await writeJsonFile(GALAXY_FILE, galaxyCache);
  isGalaxyDirty = false;
}

/**
 * Add player to registry
 */
export async function registerPlayer(userId, username, homeworldCoords) {
  const data = await getGalaxyData();
  data.playerRegistry[userId] = { username, homeworld: homeworldCoords };
  isGalaxyDirty = true;
}

/**
 * Update debris field
 */
export async function updateDebrisField(coords, resources) {
  const data = await getGalaxyData();
  const coordKey = coords.join(':');
  
  if (!data.debrisFields) data.debrisFields = {};
  
  if (!resources || (resources.metal <= 0 && resources.crystal <= 0)) {
    delete data.debrisFields[coordKey];
  } else {
    data.debrisFields[coordKey] = resources;
  }
  
  isGalaxyDirty = true;
}
