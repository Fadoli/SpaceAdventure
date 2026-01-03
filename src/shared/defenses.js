// Defense definitions and stats

import { BUILDING_SPEED_MULTIPLIER, CONFIG } from './constants.js';
import { calculateBaseTime } from './time.js';

export const DEFENSES = {
  rocketLauncher: {
    name: 'Rocket Launcher',
    icon: '🚀',
    description: 'Basic planetary defense that launches missiles.',
    baseCost: {
      metal: 2000,
      crystal: 0,
      deuterium: 0
    },
    attack: 80,
    shield: 20,
    hull: 2000
  },

  laserCannon: {
    name: 'Laser Cannon',
    icon: '🔫',
    description: 'Energy-based defense weapon with high precision.',
    baseCost: {
      metal: 1500,
      crystal: 500,
      deuterium: 0
    },
    attack: 100,
    shield: 25,
    hull: 2000
  },

  particleBeam: {
    name: 'Particle Beam',
    icon: '⚛️',
    description: 'Advanced energy weapon dealing massive damage.',
    baseCost: {
      metal: 6000,
      crystal: 2000,
      deuterium: 0
    },
    attack: 250,
    shield: 100,
    hull: 8000
  },

  shield: {
    name: 'Planetary Shield',
    icon: '🛡️',
    description: 'Protective energy shield around the planet.',
    baseCost: {
      metal: 10000,
      crystal: 10000,
      deuterium: 0
    },
    attack: 0,
    shield: 2000,
    hull: 20000
  },

  interceptor: {
    name: 'Interceptor Missile',
    icon: '🎯',
    description: 'Fast-moving defense against incoming attacks.',
    baseCost: {
      metal: 8000,
      crystal: 2000,
      deuterium: 0
    },
    attack: 150,
    shield: 50,
    hull: 10000
  },

  antiAirMissile: {
    name: 'Anti-Air Missile',
    icon: '💣',
    description: 'Specialized defense against air/space attacks.',
    baseCost: {
      metal: 10000,
      crystal: 4000,
      deuterium: 0
    },
    attack: 200,
    shield: 60,
    hull: 14000
  },

  plasmaTurret: {
    name: 'Plasma Turret',
    icon: '🌋',
    description: 'Extreme damage output at the cost of shorter range.',
    baseCost: {
      metal: 50000,
      crystal: 50000,
      deuterium: 30000
    },
    attack: 3000,
    shield: 300,
    hull: 100000
  },

  ionCannon: {
    name: 'Ion Cannon',
    icon: '⚡',
    description: 'Long-range defense weapon with sustained fire.',
    baseCost: {
      metal: 2000,
      crystal: 6000,
      deuterium: 0
    },
    attack: 150,
    shield: 500,
    hull: 8000
  }
};

/**
 * Get defense data by key
 */
export function getDefense(defenseKey) {
  return DEFENSES[defenseKey];
}

/**
 * Calculate defense build cost based on quantity
 */
export function calculateDefenseCost(defenseKey, quantity = 1) {
  const defense = getDefense(defenseKey);
  if (!defense) return null;

  return {
    metal: Math.floor(defense.baseCost.metal * quantity),
    crystal: Math.floor(defense.baseCost.crystal * quantity),
    deuterium: Math.floor(defense.baseCost.deuterium * quantity)
  };
}

/**
 * Calculate build time for defenses
 */
export function calculateDefenseBuildTime(defenseKey, quantity = 1, shipyardLevel = 1, roboticsLevel = 0, naniteLevel = 0) {
  const defense = getDefense(defenseKey);
  if (!defense) return 0;

  // Base time related to cost
  const baseTime = calculateBaseTime(defense) * quantity;
  
  // Apply build speed factor (converting cost units to seconds)
  // We use hours-based speed: time = cost / speed * 3600
  const speedFactor = CONFIG.DEFENSE_BUILD_SPEED || 2500;
  const timeInSeconds = (baseTime / speedFactor) * 3600;

  // Shipyard level speeds up construction (20% per level, 0.8^n)
  const shipyardMultiplier = Math.pow(BUILDING_SPEED_MULTIPLIER, shipyardLevel);

  // Robotics factory speeds up construction (20% per level, 0.8^n)
  const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(BUILDING_SPEED_MULTIPLIER, roboticsLevel) : 1;

  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;

  const totalTime = (timeInSeconds * shipyardMultiplier * roboticsMultiplier) / naniteMultiplier;

  return Math.max(1, Math.floor(totalTime));
}

/**
 * Calculate total defense stats
 */
export function calculateDefenseStats(defenses, weaponsTech = 0, shieldingTech = 0, armorTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  for (const defenseKey in defenses) {
    const count = defenses[defenseKey];
    if (count <= 0) continue;

    const defense = getDefense(defenseKey);
    if (!defense) continue;

    // Tech multipliers
    const attackMultiplier = 1 + (weaponsTech * 0.1);
    const shieldMultiplier = 1 + (shieldingTech * 0.1);
    const armorMultiplier = 1 + (armorTech * 0.1);

    totalAttack += defense.attack * count * attackMultiplier;
    totalShield += defense.shield * count * shieldMultiplier;
    totalHull += defense.hull * count * armorMultiplier;
  }

  return {
    attack: Math.floor(totalAttack),
    shield: Math.floor(totalShield),
    hull: Math.floor(totalHull)
  };
}
