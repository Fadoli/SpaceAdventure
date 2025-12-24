// Configuration loader
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

let config = null;

/**
 * Load configuration from config.json
 */
export async function loadConfig() {
  const configPath = './config.json';
  
  if (!existsSync(configPath)) {
    console.warn('config.json not found, using default values');
    return getDefaultConfig();
  }
  
  try {
    const content = await readFile(configPath, 'utf-8');
    config = JSON.parse(content);
    console.log('Configuration loaded from config.json');
    return config;
  } catch (error) {
    console.error('Error loading config.json:', error.message);
    return getDefaultConfig();
  }
}

/**
 * Get default configuration
 */
function getDefaultConfig() {
  return {
    gameSpeed: {
      resourceProduction: 1.0,
      buildTime: 1.0,
      researchTime: 1.0,
      shipBuildTime: 1.0,
      fleetSpeed: 1.0
    },
    balancing: {
      resourceCostMultiplier: 1.0,
      energyConsumptionMultiplier: 1.0,
      storageCapacityMultiplier: 1.0
    },
    gameplay: {
      buildQueueSize: 1,
      researchQueueSize: 1,
      maxPlanetsPerPlayer: 9,
      startingResourcesMultiplier: 1.0
    }
  };
}

/**
 * Get current configuration
 */
export function getConfig() {
  if (!config) {
    return getDefaultConfig();
  }
  return config;
}

/**
 * Get resource production multiplier
 */
export function getResourceProductionMultiplier() {
  return getConfig().gameSpeed.resourceProduction || 1.0;
}

/**
 * Get build time multiplier
 */
export function getBuildTimeMultiplier() {
  return getConfig().gameSpeed.buildTime || 1.0;
}

/**
 * Get research time multiplier
 */
export function getResearchTimeMultiplier() {
  return getConfig().gameSpeed.researchTime || 1.0;
}

/**
 * Get ship build time multiplier
 */
export function getShipBuildTimeMultiplier() {
  return getConfig().gameSpeed.shipBuildTime || 1.0;
}

/**
 * Get fleet speed multiplier
 */
export function getFleetSpeedMultiplier() {
  return getConfig().gameSpeed.fleetSpeed || 1.0;
}

/**
 * Get resource cost multiplier
 */
export function getResourceCostMultiplier() {
  return getConfig().balancing.resourceCostMultiplier || 1.0;
}

/**
 * Get energy consumption multiplier
 */
export function getEnergyConsumptionMultiplier() {
  return getConfig().balancing.energyConsumptionMultiplier || 1.0;
}

/**
 * Get storage capacity multiplier
 */
export function getStorageCapacityMultiplier() {
  return getConfig().balancing.storageCapacityMultiplier || 1.0;
}

/**
 * Get starting resources multiplier
 */
export function getStartingResourcesMultiplier() {
  return getConfig().gameplay.startingResourcesMultiplier || 1.0;
}
