// Research history management - stores history in separate files to keep player object small
import { readJsonFile, writeJsonFile } from '../storage/storage.js';
import { existsSync } from 'fs';
import { mkdir } from 'fs/promises';

/**
 * Get history for a player
 */
export async function getPlayerResearchHistory(userId) {
  const filename = `players/${userId}/research_history.json`;
  const data = await readJsonFile(filename);
  return data || {};
}

/**
 * Get history for a specific base type
 */
export async function getResearchHistory(userId, baseType) {
  const history = await getPlayerResearchHistory(userId);
  return history[baseType] || [];
}

/**
 * Add an entry to research history
 */
export async function addResearchHistoryEntry(userId, baseType, entry) {
  const history = await getPlayerResearchHistory(userId);
  
  if (!history[baseType]) {
    history[baseType] = [];
  }
  
  history[baseType].unshift(entry);
  
  // Cap at 50 entries for each type
  if (history[baseType].length > 50) {
    history[baseType].pop();
  }
  
  const filename = `players/${userId}/research_history.json`;
  await writeJsonFile(filename, history);
  return history[baseType];
}
