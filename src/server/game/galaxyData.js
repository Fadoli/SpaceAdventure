// Global galaxy state management
import { readJsonFile, writeJsonFile } from '../storage/storage.js';

const GALAXY_FILE = 'galaxy.json';
let galaxyCache = null;

/**
 * Get galaxy data
 */
export async function getGalaxyData() {
  if (galaxyCache) return galaxyCache;
  
  const data = await readJsonFile(GALAXY_FILE);
  galaxyCache = data || {
    debrisFields: {}, // Format: "G:S:P": { metal: 100, crystal: 50 }
    playerRegistry: {} // Format: userId: { username: "name", homeworld: [G,S,P] }
  };
  return galaxyCache;
}

/**
 * Save galaxy data
 */
export async function saveGalaxyData(data) {
  galaxyCache = data;
  return await writeJsonFile(GALAXY_FILE, data);
}

/**
 * Add player to registry
 */
export async function registerPlayer(userId, username, homeworldCoords) {
  const data = await getGalaxyData();
  data.playerRegistry[userId] = { username, homeworld: homeworldCoords };
  await saveGalaxyData(data);
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
  
  await saveGalaxyData(data);
}
