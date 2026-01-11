// AI Player management
import { createPlayer, getPlayerByUserId, updatePlayer } from './player.js';
import { AI_TYPES } from '../../shared/constants.js';
import { readJsonFile, writeJsonFile } from '../storage/storage.js';

const AI_FILE = 'ai.json';

const AI_NAMES = [
  'Xenon', 'Quasar', 'Nebula', 'Vortex', 'Stellaris', 'Nova', 'Astro', 'Cosmos', 'Galaxian', 'Orion',
  'Pulsar', 'Eclipse', 'Titan', 'Zenith', 'Apex', 'Void', 'Shadow', 'Cipher', 'Matrix', 'Vector',
  'Omega', 'Alpha', 'Prime', 'Core', 'Nexus', 'Relic', 'Exodus', 'Horizon', 'Infinity', 'Aegis',
  'Sentinel', 'Warden', 'Guardian', 'Overseer', 'Prophet', 'Oracle', 'Archon', 'Emperor', 'Overlord', 'Tyrant',
  'Unit 734', 'Node 01', 'System X', 'Logic-9', 'Synth-12', 'Borg-Prime', 'A.N.N.I.', 'H.A.L.O.', 'M.O.T.H.E.R.', 'V.I.K.I.'
];

const AI_PREFIXES = ['Imperial', 'Ancient', 'Cyber', 'Star', 'Deep', 'Lost', 'Dark', 'Golden', 'Silver', 'Iron'];
const AI_SUFFIXES = ['Empire', 'Collective', 'Swarm', 'Federation', 'Union', 'Order', 'Dominion', 'Republic', 'Hegemony', 'Syndicate'];

/**
 * Generate a random AI name
 */
export function generateAiName() {
  const roll = Math.random();
  if (roll < 0.4) {
    // Single name
    return AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
  } else if (roll < 0.7) {
    // Prefix + Name
    const prefix = AI_PREFIXES[Math.floor(Math.random() * AI_PREFIXES.length)];
    const name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
    return `${prefix} ${name}`;
  } else {
    // Name + Suffix
    const name = AI_NAMES[Math.floor(Math.random() * AI_NAMES.length)];
    const suffix = AI_SUFFIXES[Math.floor(Math.random() * AI_SUFFIXES.length)];
    return `${name} ${suffix}`;
  }
}

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
export async function createAiPlayer(username, archetype = null) {
  if (!username) {
    username = generateAiName();
  }
  
  if (!archetype) {
    const types = Object.values(AI_TYPES);
    archetype = types[Math.floor(Math.random() * types.length)];
  }

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
  
  console.log(`[AI Manager] Created ${username} (${archetype})`);
  return player;
}

/**
 * Seed the world with a number of AI players
 */
export async function seedAiPlayers(count = 100) {
  const metadata = await getAiMetadata();
  const currentCount = metadata.aiPlayers.length;
  const LIMIT = 500;
  
  if (currentCount >= LIMIT) {
    console.log(`[AI Manager] AI limit (${LIMIT}) reached, skipping seed.`);
    return;
  }

  const actualToCreate = Math.min(count, LIMIT - currentCount);
  console.log(`[AI Manager] Seeding ${actualToCreate} AI players...`);
  
  for (let i = 0; i < actualToCreate; i++) {
    // Generate AI details
    const username = generateAiName();
    const types = Object.values(AI_TYPES);
    const archetype = types[Math.floor(Math.random() * types.length)];
    const userId = `ai_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create player game state (handles disk write for player data)
    const player = await createPlayer(userId, username);
    
    // Mark as AI and set archetype
    player.isAI = true;
    player.aiConfig = {
      archetype,
      lastAction: Date.now(),
      nextAction: Date.now() + Math.random() * 60000
    };
    
    await updatePlayer(userId, player);
    
    // Track in local metadata list (don't save file yet)
    metadata.aiPlayers.push({ userId, username, archetype });
    
    if ((i + 1) % 10 === 0) {
      console.log(`[AI Manager] Created ${i + 1}/${actualToCreate} AIs...`);
    }
  }

  // Save metadata file once at the end
  await writeJsonFile(AI_FILE, metadata);
  console.log(`[AI Manager] Seed complete. Total AI players: ${metadata.aiPlayers.length}`);
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
