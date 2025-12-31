// Ship definitions and stats

export const SHIPS = {
  // Civilian Ships
  smallCargo: {
    name: 'Small Cargo',
    icon: '📦',
    type: 'civilian',
    description: 'Basic transport ship for small cargo operations.',
    baseCost: {
      metal: 2000,
      crystal: 2000,
      deuterium: 0
    },
    buildTime: 30,
    cargoCapacity: 5000,
    fuel: 50,
    speed: 5000, // Units per hour
    attack: 5,
    shield: 10,
    hull: 400
  },

  largeCargo: {
    name: 'Large Cargo',
    icon: '📫',
    type: 'civilian',
    description: 'Heavy transport ship for large cargo operations.',
    baseCost: {
      metal: 6000,
      crystal: 6000,
      deuterium: 0
    },
    buildTime: 60,
    cargoCapacity: 25000,
    fuel: 300,
    speed: 4000, // Units per hour
    attack: 5,
    shield: 20,
    hull: 1200
  },

  colonyShip: {
    name: 'Colony Ship',
    icon: '🏗️',
    type: 'civilian',
    description: 'Colonizes new planets. Single-use, one-way trip.',
    baseCost: {
      metal: 10000,
      crystal: 20000,
      deuterium: 10000
    },
    buildTime: 300,
    cargoCapacity: 0,
    fuel: 1000,
    speed: 2500, // Units per hour
    attack: 50,
    shield: 100,
    hull: 3000
  },

  recycler: {
    name: 'Recycler',
    icon: '♻️',
    type: 'civilian',
    description: 'Collects debris from destroyed ships in battle.',
    baseCost: {
      metal: 10000,
      crystal: 6000,
      deuterium: 2000
    },
    buildTime: 45,
    cargoCapacity: 20000,
    fuel: 300,
    speed: 2000, // Units per hour
    attack: 1,
    shield: 10,
    hull: 1600
  },

  espionageProbe: {
    name: 'Espionage Probe',
    icon: '🛸',
    type: 'civilian',
    description: 'Gathers intelligence on target planets.',
    baseCost: {
      metal: 0,
      crystal: 1000,
      deuterium: 0
    },
    buildTime: 30,
    cargoCapacity: 5,
    fuel: 1,
    speed: 8000, // Units per hour - fastest ship
    attack: 0,
    shield: 1,
    hull: 10
  },

  // Military Ships - Fighters
  lightFighter: {
    name: 'Light Fighter',
    icon: '🛩️',
    type: 'military',
    description: 'Fast, cheap attack ship with low hull strength.',
    baseCost: {
      metal: 3000,
      crystal: 1000,
      deuterium: 0
    },
    buildTime: 30,
    cargoCapacity: 50,
    fuel: 100,
    speed: 7500, // Units per hour
    attack: 50,
    shield: 10,
    hull: 400
  },

  heavyFighter: {
    name: 'Heavy Fighter',
    icon: '🛡️',
    type: 'military',
    description: 'Stronger fighter with better armor and shield.',
    baseCost: {
      metal: 6000,
      crystal: 4000,
      deuterium: 0
    },
    buildTime: 60,
    cargoCapacity: 100,
    fuel: 200,
    speed: 6000, // Units per hour
    attack: 150,
    shield: 25,
    hull: 1000
  },

  // Medium Ships
  cruiser: {
    name: 'Cruiser',
    icon: '🚢',
    type: 'military',
    description: 'Medium combat ship, good against fighters.',
    baseCost: {
      metal: 20000,
      crystal: 7000,
      deuterium: 2000
    },
    buildTime: 120,
    cargoCapacity: 800,
    fuel: 500,
    speed: 4000, // Units per hour
    attack: 400,
    shield: 50,
    hull: 2700
  },

  bomber: {
    name: 'Bomber',
    icon: '💣',
    type: 'military',
    description: 'Specialized for destroying planetary defenses.',
    baseCost: {
      metal: 50000,
      crystal: 25000,
      deuterium: 15000
    },
    buildTime: 150,
    cargoCapacity: 500,
    fuel: 1000,
    speed: 3000, // Units per hour
    attack: 1000,
    shield: 25,
    hull: 7500
  },

  // Heavy Ships
  battleship: {
    name: 'Battleship',
    icon: '⚓',
    type: 'military',
    description: 'Heavy combat ship with high damage and durability.',
    baseCost: {
      metal: 45000,
      crystal: 15000,
      deuterium: 0
    },
    buildTime: 240,
    cargoCapacity: 1500,
    fuel: 1000,
    speed: 2000, // Units per hour
    attack: 1000,
    shield: 200,
    hull: 6000
  },

  destroyer: {
    name: 'Destroyer',
    icon: '⚡',
    type: 'military',
    description: 'Anti-capital ship specialized against large vessels.',
    baseCost: {
      metal: 60000,
      crystal: 50000,
      deuterium: 15000
    },
    buildTime: 300,
    cargoCapacity: 2000,
    fuel: 1500,
    speed: 3500, // Units per hour
    attack: 2000,
    shield: 500,
    hull: 11000
  }
};

/**
 * Get ship data by key
 */
export function getShip(shipKey) {
  return SHIPS[shipKey];
}

/**
 * Get all ships by type
 */
export function getShipsByType(type) {
  const result = {};
  for (const key in SHIPS) {
    const ship = SHIPS[key];
    if (ship.type === type) {
      result[key] = ship;
    }
  }
  return result;
}

/**
 * Calculate ship build cost based on quantity
 */
export function calculateShipCost(shipKey, quantity = 1) {
  const ship = getShip(shipKey);
  if (!ship) return null;

  return {
    metal: Math.floor(ship.baseCost.metal * quantity),
    crystal: Math.floor(ship.baseCost.crystal * quantity),
    deuterium: Math.floor(ship.baseCost.deuterium * quantity)
  };
}

/**
 * Calculate build time for ships
 */
export function calculateShipBuildTime(shipKey, quantity = 1, shipyardLevel = 1, roboticsLevel = 0, naniteLevel = 0) {
  const ship = getShip(shipKey);
  if (!ship) return 0;

  // Base time increases linearly with quantity
  let baseTime = ship.buildTime * quantity;

  // Shipyard level speeds up construction (20% per level, 0.8^n)
  const shipyardMultiplier = Math.pow(0.8, shipyardLevel);

  // Robotics factory speeds up construction (20% per level, 0.8^n)
  const roboticsMultiplier = roboticsLevel > 0 ? Math.pow(0.8, roboticsLevel) : 1;

  // Nanite factory dramatically speeds up (2x per level)
  const naniteMultiplier = naniteLevel > 0 ? Math.pow(2, naniteLevel) : 1;

  const totalTime = (baseTime * shipyardMultiplier * roboticsMultiplier) / naniteMultiplier;

  return Math.max(1, Math.floor(totalTime));
}

/**
 * Calculate total combat stats for a fleet
 */
export function calculateFleetStats(ships, weaponsTech = 0, shieldingTech = 0, armorTech = 0) {
  let totalAttack = 0;
  let totalShield = 0;
  let totalHull = 0;

  for (const shipKey in ships) {
    const count = ships[shipKey];
    if (count <= 0) continue;

    const ship = getShip(shipKey);
    if (!ship) continue;

    // Tech multipliers
    const attackMultiplier = 1 + (weaponsTech * 0.1);
    const shieldMultiplier = 1 + (shieldingTech * 0.1);
    const armorMultiplier = 1 + (armorTech * 0.1);

    totalAttack += ship.attack * count * attackMultiplier;
    totalShield += ship.shield * count * shieldMultiplier;
    totalHull += ship.hull * count * armorMultiplier;
  }

  return {
    attack: Math.floor(totalAttack),
    shield: Math.floor(totalShield),
    hull: Math.floor(totalHull)
  };
}

/**
 * Calculate total cargo capacity
 */
export function calculateCargoCapacity(ships) {
  let totalCapacity = 0;

  for (const shipKey in ships) {
    const count = ships[shipKey];
    const ship = getShip(shipKey);
    if (ship) {
      totalCapacity += ship.cargoCapacity * count;
    }
  }

  return totalCapacity;
}

/**
 * Calculate total fleet fuel cost
 */
export function calculateFleetFuelCost(ships, distance) {
  let totalFuelCost = 0;

  for (const shipKey in ships) {
    const count = ships[shipKey];
    const ship = getShip(shipKey);
    if (ship) {
      // Fuel cost per unit per distance
      totalFuelCost += (ship.fuel * count * distance) / 35000; // 35000 is reference distance
    }
  }

  return Math.ceil(totalFuelCost);
}
