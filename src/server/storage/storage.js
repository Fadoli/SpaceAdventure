// JSON file storage utilities with backup support
import { existsSync } from 'fs';
import { readFile, writeFile, mkdir, rename } from 'fs/promises';
import { dirname } from 'path';
import { AI_TYPES } from '../../shared/constants.js';

const DATA_DIR = './data';

/**
 * Read JSON file with backup fallback
 */
export async function readJsonFile(filename) {
  const filepath = `${DATA_DIR}/${filename}`;
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  const backupPath = `${DATA_DIR}/${filename}.backup`;
  
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
export async function writeJsonFile(filename, data) {
  const filepath = `${DATA_DIR}/${filename}`;
  const dir = dirname(filepath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  
  const backupPath = `${DATA_DIR}/${filename}.backup`;
  const tempPath = `${DATA_DIR}/${filename}.tmp`;
  
  try {
    // Step 1: Write to temporary file
    await writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    
    // Step 2: If main file exists, rename it to backup (overwrites old backup)
    if (existsSync(filepath)) {
      await rename(filepath, backupPath);
    }
    
    // Step 3: Rename temporary file to main file
    await rename(tempPath, filepath);
    
    return true;
  } catch (error) {
    console.error(`Error writing ${filename}:`, error.message);
    
    // Cleanup: try to remove temp file if it exists
    if (existsSync(tempPath)) {
      try {
        await rename(tempPath, tempPath + '.failed');
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
  
  console.log('Storage initialized');
}