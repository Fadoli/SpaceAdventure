// JSON file storage utilities with backup support
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, rename, unlink } from 'fs/promises';
import { dirname, resolve } from 'path';
import { AI_TYPES } from '../../shared/constants.js';

const DATA_DIR = resolve('./data');
const writeQueues = new Map();

function queueFileWrite(filename, operation) {
  const next = (writeQueues.get(filename) || Promise.resolve())
    .catch(() => {})
    .then(operation);
  writeQueues.set(filename, next);
  return next.finally(() => {
    if (writeQueues.get(filename) === next) writeQueues.delete(filename);
  });
}

/**
 * Read JSON file with backup fallback
 */
export async function readJsonFile(filename) {
  const filepath = resolve(DATA_DIR, filename);
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const backupPath = `${filepath}.backup`;
  
  // Try reading main file first
  if (existsSync(filepath)) {
    try {
      const content = await readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Error reading ${filename}, trying backup:`, error.message);
      
      // Fall back to backup if main file is corrupted
      if (existsSync(backupPath)) {
        try {
          const backupContent = await readFile(backupPath, 'utf-8');
          console.log(`Successfully restored from backup: ${filename}.backup`);
          return JSON.parse(backupContent);
        } catch (backupError) {
          console.error(`Error reading backup ${filename}.backup:`, backupError.message);
          return null;
        }
      }
      return null;
    }
  }
  
  // If main file doesn't exist, try backup
  if (existsSync(backupPath)) {
    try {
      const backupContent = await readFile(backupPath, 'utf-8');
      console.log(`Main file not found, using backup: ${filename}.backup`);
      return JSON.parse(backupContent);
    } catch (error) {
      console.error(`Error reading backup ${filename}.backup:`, error.message);
      return null;
    }
  }
  
  return null;
}

/**
 * Write JSON file with atomic backup strategy
 */
export function writeJsonFile(filename, data) {
  return queueFileWrite(filename, () => writeJsonFileNow(filename, data));
}

export function updateJsonFile(filename, updater) {
  return queueFileWrite(filename, async () => {
    const current = await readJsonFile(filename);
    return writeJsonFileNow(filename, await updater(current));
  });
}

async function writeJsonFileNow(filename, data) {
  const filepath = resolve(DATA_DIR, filename);
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  
  const backupPath = `${filepath}.backup`;
  const tempPath = `${filepath}.tmp`;
  
  try {
    // Step 1: Write to temporary file
    await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Step 2: If main file exists, rename it to backup (overwrites old backup)
    if (existsSync(filepath)) {
      if (existsSync(backupPath)) {
        await unlink(backupPath);
      }
      await rename(filepath, backupPath);
    }
    
    // Step 3: Rename temporary file to main file
    if (existsSync(filepath)) {
      await unlink(filepath);
    }
    await rename(tempPath, filepath);
    
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error.message);
    
    // Cleanup: try to remove temp file if it exists
    if (existsSync(tempPath)) {
      try {
        await unlink(tempPath).catch(() => {});
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
    }
    
    return false;
  }
}

/**
 * Initialize storage files with default data
 */
export async function initializeStorage() {
  // Initialize users.json if it doesn't exist
  const users = await readJsonFile('users.json');
  if (!users) {
    await writeJsonFile('users.json', { users: [] });
  }
  
  // Initialize galaxy.json if it doesn't exist
  const galaxy = await readJsonFile('galaxy.json');
  if (!galaxy) {
    await writeJsonFile('galaxy.json', { 
      debrisFields: {}, 
      playerRegistry: {} 
    });
  }
  
  // Initialize ai.json if it doesn't exist
  const ai = await readJsonFile('ai.json');
  if (!ai) {
    await writeJsonFile('ai.json', { aiPlayers: [] });
    
    // Auto-spawn some AI for initial life in the galaxy
    const { createAiPlayer } = await import('../game/aiManager.js');
    await createAiPlayer('Nova Bot', AI_TYPES.BALANCED);
    await createAiPlayer('Nebula AI', AI_TYPES.BALANCED);
    console.log('Spawned initial AI bots');
  }

  // Initialize alliances.json if it doesn't exist
  const alliances = await readJsonFile('alliances.json');
  if (!alliances) {
    await writeJsonFile('alliances.json', { alliances: {} });
  }

  // Initialize server_state.json if it doesn't exist
  const serverState = await readJsonFile('server_state.json');
  if (!serverState) {
    await writeJsonFile('server_state.json', { lastHeartbeat: Date.now() });
  }
  
  console.log('Storage initialized');
}
