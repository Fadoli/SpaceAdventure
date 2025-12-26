// Defense definitions and stats

export const DEFENSES = {
  rocketLauncher: {
    name: 'Rocket Launcher',
    icon: '🚀',
    description: 'Basic planetary defense that launches missiles.',
    baseCost: {
      metal: 100,
      crystal: 50,
      deuterium: 0
    },
    buildTime: 30,
    attack: 80,
    shield: 20,
    hull: 200
  },

  laserCannon: {
    name: 'Laser Cannon',
    icon: '🔫',
    description: 'Energy-based defense weapon with high precision.',
    baseCost: {
      metal: 150,
      crystal: 100,
      deuterium: 0
    },
    buildTime: 45,
    attack: 120,
    shield: 30,
    hull: 250
  },

  particleBeam: {
    name: 'Particle Beam',
    icon: '⚛️',
    description: 'Advanced energy weapon dealing massive damage.',
    baseCost: {
      metal: 300,
      crystal: 300,
      deuterium: 100
    },
    buildTime: 90,
    attack: 250,
    shield: 60,
    hull: 400
  },

  shield: {
    name: 'Planetary Shield',
    icon: '🛡️',
    description: 'Protective energy shield around the planet.',
    baseCost: {
      metal: 200,
      crystal: 150,
      deuterium: 50
    },
    buildTime: 60,
    attack: 0,
    shield: 500,
    hull: 100
  },

  interceptor: {
    name: 'Interceptor Missile',
    icon: '🎯',
    description: 'Fast-moving defense against incoming attacks.',
    baseCost: {
      metal: 80,
      crystal: 80,
      deuterium: 40
    },
    buildTime: 25,
    attack: 60,
    shield: 10,
    hull: 100
  },

  antiAirMissile: {
    name: 'Anti-Air Missile',
    icon: '💣',
    description: 'Specialized defense against air/space attacks.',
    baseCost: {
      metal: 120,
      crystal: 100,
      deuterium: 50
    },
    buildTime: 40,
    attack: 100,
    shield: 15,
    hull: 150
  },

  plasmaTurret: {
    name: 'Plasma Turret',
    icon: '🌋',
    description: 'Extreme damage output at the cost of shorter range.',
    baseCost: {
      metal: 400,
      crystal: 200,
      deuterium: 150
    },
    buildTime: 120,
    attack: 350,
    shield: 40,
    hull: 500
  },

  ionCannon: {
    name: 'Ion Cannon',
    icon: '⚡',
    description: 'Long-range defense weapon with sustained fire.',
    baseCost: {
      metal: 250,
      crystal: 250,
      deuterium: 100
    },
    buildTime: 80,
    attack: 200,
    shield: 50,
    hull: 350
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
export function calculateDefenseBuildTime(defenseKey, quantity = 1, roboticsLevel = 0, naniteLevel = 0) {
  const defense = getDefense(defenseKey);
  if (!defense) return 0;

  // Base time increases with quantity
  let baseTime = defense.buildTime * quantity * Math.pow(1.05, quantity - 1);

  // Robotics factory speeds up construction (20% per level, 0.8^n)
  const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(0.8, roboticsLevel) : 1;

  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;

  const totalTime = (baseTime * roboticsMultiplier) / naniteMultiplier;

  return Math.max(1, Math.floor(totalTime));
}

/**
 * Calculate total defense stats
 */
export function calculateDefenseStats(defenses, weaponsTech = 0, shieldingTech = 0, armorTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  for (const [defenseKey, count] of Object.entries(defenses)) {
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
