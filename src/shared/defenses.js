// Defense definitions and stats

import { BUILDING_SPEED_MULTIPLIER, CONFIG } from './constants.js';
import { calculateBaseTime } from './time.js';
import { getResearchBonus } from './research.js';

export const DEFENSES = {
  rocketLauncher: {
    name: 'MAG-7 Kinetic Launcher',
    icon: '🚀',
    description: 'Basic planetary defense that launches high-velocity kinetic missiles.',
    detailedDescription: 'The MAG-7 Kinetic Launcher is the primary line of defense for any new colony.\n\nUtilizing a multi-tube array of high-explosive kinetic slugs, it provides a reliable and inexpensive deterrent against light raiders and swarms of fighters.\n\nWhile its guidance systems are rudimentary, its sheer volume of fire can overwhelm targets through saturation bombardment.',
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
    name: 'Phased Pulse Emitter',
    icon: '🔫',
    description: 'Energy-based defense weapon with high-frequency phased pulses.',
    detailedDescription: 'Refining planetary defense through focused optics, the Phased Pulse Emitter delivers high-precision energy beams at extreme ranges.\n\nUnlike projectile weapons, its beams travel at the speed of light, making them virtually impossible to evade for smaller craft.\n\nIts rapid-cycle capacitors allow for sustained fire, effectively thinning out fighter screens before they can reach the planet\'s atmosphere.',
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
    name: 'Hadron Beam Projector',
    icon: '⚛️',
    description: 'Advanced energy weapon dealing massive subatomic damage.',
    detailedDescription: 'The Hadron Beam Projector accelerates subatomic particles to relativistic speeds, creating a concentrated stream of matter that can bypass conventional shielding and shred reinforced alloys.\n\nThis advanced weapon system bridges the gap between light point defense and heavy orbital artillery, providing substantial stopping power against medium-tonnage vessels and heavily armored bombers.',
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

  gaussCannon: {
    name: 'Hyper-Velocity Gauss Cannon',
    icon: '🔋',
    description: 'Electromagnetic accelerator firing heavy metallic slugs.',
    detailedDescription: 'Utilizing massive electromagnetic rails, the Gauss Cannon accelerates high-density slugs to a significant fraction of the speed of light.\n\nThe sheer kinetic energy of the impact can penetrate the thickest battleship hulls, making it an excellent medium-tier defense against armored targets.\n\nIt requires significant metal for its specialized ammunition but remains one of the most cost-effective heavy weapons.',
    baseCost: {
      metal: 20000,
      crystal: 15000,
      deuterium: 2000
    },
    attack: 1100,
    shield: 200,
    hull: 35000,
    rapidFire: {
      smallCargo: 3,
      largeCargo: 3
    }
  },

  ionCannon: {
    name: 'Cascading Ion Disruptor',
    icon: '⚡',
    description: 'Long-range defense weapon that overloads enemy electronics.',
    detailedDescription: 'Utilizing ionized gas accelerated to near-light speed, the Cascading Ion Disruptor is a long-range defensive system specialized in disrupting enemy electronics and overloading shield generators.\n\nUnlike thermal or kinetic weapons, its beams cause cascading power failures in target vessels, making it ideal for disabling incoming fleets and rendering them vulnerable to coordinated counter-attacks.',
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
  },

  disruptor: {
    name: 'Sub-Atomic Disruptor',
    icon: '🌀',
    description: 'Experimental weapon that destabilizes molecular bonds.',
    detailedDescription: 'The Sub-Atomic Disruptor fires high-frequency spatial distortions that resonate with the target\'s molecular structure, causing matter to literally dissolve.\n\nThis experimental technology ignores a portion of conventional shielding, making it deadly against high-tech capital ships.\n\nIts complexity makes it expensive, but its presence on a planet is a terrifying prospect for any invader.',
    baseCost: {
      metal: 35000,
      crystal: 25000,
      deuterium: 10000
    },
    attack: 1800,
    shield: 400,
    hull: 60000,
    rapidFire: {
      heavyFighter: 4,
      cruiser: 2
    }
  },

  plasmaTurret: {
    name: 'Omega Plasma Array',
    icon: '🌋',
    description: 'Extreme damage output utilizing superheated solar gas.',
    detailedDescription: 'The pinnacle of static planetary defense, the Omega Plasma Array harnesses the same energy that powers stars.\n\nIt fires superheated bolts of ionized gas that can vaporize a battleship\'s hull in seconds.\n\nWhile the energy requirements and heat-management systems are enormous, the sheer destructive potential of this turret makes it the ultimate deterrent against any large-scale orbital invasion force.',
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

  shield: {
    name: 'Gravitic Deflector Dome',
    icon: '🛡️',
    description: 'Protective gravitic barrier that deflects incoming fire.',
    detailedDescription: 'The Gravitic Deflector Dome is a massive installation designed to protect an entire colony from orbital bombardment.\n\nBy generating a high-frequency gravitic barrier, it can absorb and redistribute the energy of incoming attacks, significantly increasing the survivability of planetary infrastructure and fleets stationed in the dock.\n\nWhile it possesses no offensive capabilities, its presence is often the difference between total annihilation and survival.',
    baseCost: {
      metal: 10000,
      crystal: 10000,
      deuterium: 0
    },
    attack: 0,
    shield: 2000,
    hull: 20000
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
export function calculateDefenseBuildTime(defenseKey, quantity = 1, shipyardLevel = 1, naniteLevel = 0, timeReductionBonus = 0, speedMultiplier = null, timeMultiplier = 1) {
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
  const totalTime = ((timeInSeconds * shipyardMultiplier * reduction) / naniteMultiplier) * timeMultiplier;

  return Math.max(1, Math.floor(totalTime));
}

/**
 * Calculate total defense stats
 */
export function calculateDefenseStats(defenses, weaponsTech = 0, shieldingTech = 0, armorTech = 0, hullBonusTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  const attackMultiplier = 1 + getResearchBonus({ weaponsTech }, 'unitAttackPower');
  const shieldMultiplier = 1 + getResearchBonus({ shieldingTech }, 'unitShieldStrength');
  const armorMultiplier = 1 + getResearchBonus({ armorTech }, 'unitHullStrength');

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
