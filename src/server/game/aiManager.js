// AI Player management
import { createPlayer, getPlayerByUserId, updatePlayer } from './player.js';
import { AI_TYPES } from '../../shared/constants.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';

const AI_FILE = 'ai.json';

/**
 * Get AI metadata (list of AI userIds)
 */
export async function getAiMetadata() {
  const data = await readJsonFile(AI_FILE);
  return data || { aiPlayers: [] };
}

/**
 * Create a new AI player
 */
export async function createAiPlayer(username, archetype = AI_TYPES.BALANCED) {
  const userId = `ai_${Math.random().toString(36).substr(2, 9)}`;
  const player = await createPlayer(userId, username);
  
  // Mark as AI and set archetype
  player.isAI = true;
  player.aiConfig = {
    archetype,
    lastAction: Date.now(),
    nextAction: Date.now() + Math.random() * 60000 // Random start
  };
  
  await updatePlayer(userId, player);
  
  // Track in AI list
  const metadata = await getAiMetadata();
  metadata.aiPlayers.push({ userId, username, archetype });
  await writeJsonFile(AI_FILE, metadata);
  
  return player;
}

/**
 * Get all full AI player objects
 */
export async function getAllAiPlayers() {
  const metadata = await getAiMetadata();
  const players = await Promise.all(
    metadata.aiPlayers.map(m => getPlayerByUserId(m.userId))
  );
  return players.filter(p => p !== null);
}
