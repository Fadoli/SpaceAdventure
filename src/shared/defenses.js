// Defense definitions and stats

import { BUILDING_SPEED_MULTIPLIER, CONFIG } from './constants.js';
import { calculateBaseTime } from './time.js';
import { getResearchBonus, THEORETICAL_RESEARCH } from './research.js';

export const DEFENSES = {
  rocketLauncher: {
    name: 'Rocket Launcher',
    icon: '🚀',
    description: 'Basic planetary defense that launches missiles.',
    detailedDescription: 'The Rocket Launcher is the primary line of defense for any new colony.\n\nUtilizing a multi-tube array of high-explosive missiles, it provides a reliable and inexpensive deterrent against light raiders and swarms of fighters.\n\nWhile its guidance systems are rudimentary, its sheer volume of fire can overwhelm targets through saturation bombardment.',
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
    detailedDescription: 'Refining planetary defense through focused optics, the Laser Cannon delivers high-precision energy beams at extreme ranges.\n\nUnlike projectile weapons, its beams travel at the speed of light, making them virtually impossible to evade for smaller craft.\n\nIts rapid-cycle capacitors allow for sustained fire, effectively thinning out fighter screens before they can reach the planet\'s atmosphere.',
    baseCost: {
      metal: 1500,
      crystal: 500,
      deuterium: 0
    },
    attack: 100,
    shield: 25,
    hull: 2000,
    rapidFire: {
      espionageProbe: 5
    }
  },

  particleBeam: {
    name: 'Particle Beam',
    icon: '⚛️',
    description: 'Advanced energy weapon dealing massive damage.',
    detailedDescription: 'The Particle Beam accelerates subatomic particles to relativistic speeds, creating a concentrated stream of matter that can bypass conventional shielding and shred reinforced alloys.\n\nThis advanced weapon system bridges the gap between light point defense and heavy orbital artillery, providing substantial stopping power against medium-tonnage vessels and heavily armored bombers.',
    baseCost: {
      metal: 6000,
      crystal: 2000,
      deuterium: 0
    },
    attack: 250,
    shield: 100,
    hull: 8000,
    rapidFire: {
      espionageProbe: 5
    }
  },

  shield: {
    name: 'Planetary Shield',
    icon: '🛡️',
    description: 'Protective energy shield around the planet.',
    detailedDescription: 'The Planetary Shield Dome is a massive installation designed to protect an entire colony from orbital bombardment.\n\nBy generating a high-frequency gravitic barrier, it can absorb and redistribute the energy of incoming attacks, significantly increasing the survivability of planetary infrastructure and fleets stationed in the dock.\n\nWhile it possesses no offensive capabilities, its presence is often the difference between total annihilation and survival.',
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
    detailedDescription: 'Specialized in high-speed kinetic interception, the Interceptor Missile is a sophisticated counter-measure against bombers and specialized siege vessels.\n\nIts advanced tracking computers allow it to navigate through chaotic debris fields and fighter screens to deliver a precision strike to critical enemy systems.\n\nIt is the definitive solution for neutralizing threats that lighter laser arrays cannot penetrate.',
    baseCost: {
      metal: 8000,
      crystal: 2000,
      deuterium: 0
    },
    attack: 150,
    shield: 50,
    hull: 10000,
    rapidFire: {
      espionageProbe: 5
    }
  },

  antiAirMissile: {
    name: 'Anti-Air Missile',
    icon: '💣',
    description: 'Specialized defense against air/space attacks.',
    detailedDescription: 'The Anti-Air Missile system utilizes a multi-layered warhead designed to fracture upon impact, creating a localized field of shrapnel that is lethal to any ship within its radius.\n\nThis makes it exceptionally effective against swarms of fighters and light reconnaissance craft that rely on speed and evasion rather than heavy shielding.\n\nIt serves as a vital area-denial asset for planetary airspace.',
    baseCost: {
      metal: 10000,
      crystal: 4000,
      deuterium: 0
    },
    attack: 200,
    shield: 60,
    hull: 14000,
    rapidFire: {
      espionageProbe: 5
    }
  },

  plasmaTurret: {
    name: 'Plasma Turret',
    icon: '🌋',
    description: 'Extreme damage output at the cost of shorter range.',
    detailedDescription: 'The pinnacle of static planetary defense, the Plasma Turret harnesses the same energy that powers stars.\n\nIt fires superheated bolts of ionized gas that can vaporize a battleship\'s hull in seconds.\n\nWhile the energy requirements and heat-management systems are enormous, the sheer destructive potential of this turret makes it the ultimate deterrent against any large-scale orbital invasion force.',
    baseCost: {
      metal: 50000,
      crystal: 50000,
      deuterium: 30000
    },
    attack: 3000,
    shield: 300,
    hull: 100000,
    rapidFire: {
      espionageProbe: 5
    }
  },

  ionCannon: {
    name: 'Ion Cannon',
    icon: '⚡',
    description: 'Long-range defense weapon with sustained fire.',
    detailedDescription: 'Utilizing ionized gas accelerated to near-light speed, the Ion Cannon is a long-range defensive system specialized in disrupting enemy electronics and overloading shield generators.\n\nUnlike thermal or kinetic weapons, its beams cause cascading power failures in target vessels, making it ideal for disabling incoming fleets and rendering them vulnerable to coordinated counter-attacks.',
    baseCost: {
      metal: 2000,
      crystal: 6000,
      deuterium: 0
    },
    attack: 150,
    shield: 500,
    hull: 8000,
    rapidFire: {
      espionageProbe: 5,
      smallCargo: 2
    }
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
export function calculateDefenseCost(defenseKey, quantity = 1, costReductionBonus = 0) {
  const defense = getDefense(defenseKey);
  if (!defense) return null;

  const reduction = 1 - costReductionBonus;
  return {
    metal: Math.floor(defense.baseCost.metal * quantity * reduction),
    crystal: Math.floor(defense.baseCost.crystal * quantity * reduction),
    deuterium: Math.floor(defense.baseCost.deuterium * quantity * reduction)
  };
}

/**
 * Calculate build time for defenses
 */
export function calculateDefenseBuildTime(defenseKey, quantity = 1, shipyardLevel = 1, naniteLevel = 0, timeReductionBonus = 0, speedMultiplier = null) {
  const defense = getDefense(defenseKey);
  if (!defense) return 0;

  const baseTime = calculateBaseTime(defense) * quantity;
  
  // Apply build speed factor
  const speedFactor = CONFIG.DEFENSE_BUILD_SPEED || 2500;
  const timeInSeconds = (baseTime / speedFactor) * 3600;

  // Shipyard level speeds up construction
  const scaling = speedMultiplier || BUILDING_SPEED_MULTIPLIER;
  const shipyardMultiplier = Math.pow(scaling, shipyardLevel);

  // Nanite factory speedup
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;

  const reduction = 1 - timeReductionBonus;
  const totalTime = (timeInSeconds * shipyardMultiplier * reduction) / naniteMultiplier;

  return Math.max(1, Math.floor(totalTime));
}

/**
 * Calculate total defense stats
 */
export function calculateDefenseStats(defenses, weaponsTech = 0, shieldingTech = 0, armorTech = 0, hullBonusTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  // Tech multipliers: data-driven
  const attackBonus = THEORETICAL_RESEARCH.weaponsTech.bonuses.unitAttackPower || 0.2;
  const shieldBonus = THEORETICAL_RESEARCH.shieldingTech.bonuses.unitShieldStrength || 0.2;
  const armorBonus = THEORETICAL_RESEARCH.armorTech.bonuses.unitHullStrength || 0.15;
  const hullBonus = THEORETICAL_RESEARCH.advancedMaterials.bonuses.unitHullBonus || 0.05;

  const attackMultiplier = 1 + (weaponsTech * attackBonus);
  const shieldMultiplier = 1 + (shieldingTech * shieldBonus);
  const armorMultiplier = 1 + (armorTech * armorBonus) + (hullBonusTech * hullBonus);

  for (const defenseKey in defenses) {
    const count = defenses[defenseKey];
    if (count <= 0) continue;

    const defense = getDefense(defenseKey);
    if (!defense) continue;

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
