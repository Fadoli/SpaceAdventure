// Game constants

export const RESOURCES = {
  METAL: 'metal',
  CRYSTAL: 'crystal',
  DEUTERIUM: 'deuterium',
  ENERGY: 'energy',
  WATER: 'water',
  FOOD: 'food',
  POPULATION: 'population'
};

export const RESOURCE_ICONS = {
  metal: '⚙️',
  crystal: '💎',
  deuterium: '🛢️',
  energy: '⚡',
  water: '💦',
  food: '🍞',
  population: '👥'
};

export const BUILDINGS = {
  METAL_MINE: 'metalMine',
  CRYSTAL_MINE: 'crystalMine',
  DEUTERIUM_SYNTHESIZER: 'deuteriumSynthesizer',
  SOLAR_PLANT: 'solarPlant',
  FUSION_REACTOR: 'fusionReactor',
  ROBOTICS_FACTORY: 'roboticsFactory',
  SHIPYARD: 'shipyard',
  RESEARCH_LAB: 'researchLab',
  METAL_STORAGE: 'metalStorage',
  CRYSTAL_STORAGE: 'crystalStorage',
  DEUTERIUM_TANK: 'deuteriumTank',
  WATER_STORAGE: 'waterStorage',
  FOOD_SILO: 'foodSilo',
  NANITE_FACTORY: 'naniteFactory',
  WATER_EXTRACTOR: 'waterExtractor',
  FARM: 'farm',
  HOUSING: 'housing'
};

export const DEFENSES = {
  ROCKET_LAUNCHER: 'rocketLauncher',
  LASER_CANNON: 'laserCannon',
  PARTICLE_BEAM: 'particleBeam',
  GAUSS_CANNON: 'gaussCannon',
  ION_CANNON: 'ionCannon',
  DISRUPTOR: 'disruptor',
  PLASMA_TURRET: 'plasmaTurret',
  SHIELD: 'shield'
};

export const TECHNOLOGIES = {
  ENERGY_TECH: 'energyTech',
  COMPUTER_TECH: 'computerTech',
  WEAPONS_TECH: 'weaponsTech',
  SHIELDING_TECH: 'shieldingTech',
  ARMOR_TECH: 'armorTech',
  COMBUSTION_DRIVE: 'combustionDrive',
  IMPULSE_DRIVE: 'impulseDrive',
  HYPERSPACE_DRIVE: 'hyperspaceDrive',
  ESPIONAGE_TECH: 'espionageTech',
  ASTROPHYSICS: 'astrophysics',
  ION_TECH: 'ionTech',
  LASER_TECH: 'laserTech',
  PLASMA_TECH: 'plasmaTech',
  HOUSING_TECH: 'housingTech'
};

export const SHIPS = {
  SMALL_CARGO: 'smallCargo',
  LARGE_CARGO: 'largeCargo',
  LIGHT_FIGHTER: 'lightFighter',
  HEAVY_FIGHTER: 'heavyFighter',
  CRUISER: 'cruiser',
  BATTLESHIP: 'battleship',
  DESTROYER: 'destroyer',
  BOMBER: 'bomber',
  DREADNOUGHT: 'dreadnought',
  CARRIER: 'carrier',
  COLONY_SHIP: 'colonyShip',
  RECYCLER: 'recycler',
  ESPIONAGE_PROBE: 'espionageProbe'
};

export const MISSION_TYPES = {
  ATTACK: 'attack',
  TRANSPORT: 'transport',
  DEPLOY: 'deploy',
  COLONIZE: 'colonize',
  ESPIONAGE: 'espionage',
  HARVEST: 'harvest',
  EXPEDITION: 'expedition',
  MARKET_TRADE: 'market',
  GROUP_ATTACK: 'group_attack',
  STATION: 'station'
};

export const MARKET_CONFIG = {
  POSITION: [250, 1], // [System, Position]
  RATES: {
    metal: 3,
    crystal: 2,
    deuterium: 1
  }
};

export const AI_TYPES = {
  TUTORIAL: 'tutorial',
  DEFENSIVE: 'defensive',
  BALANCED: 'balanced',
  AGGRESSIVE: 'aggressive',
  RAIDER: 'raider'
};

export const ALLIANCE_ROLES = {
  FOUNDER: 'founder',
  ADMIN: 'admin',
  MEMBER: 'member'
};

// Starting resources for new players
export const STARTING_RESOURCES = {
  metal: 500,
  crystal: 250,
  deuterium: 0,
  energy: 0,
  water: 1000,
  food: 1000,
  population: 100
};

// Starting buildings for new players
export const STARTING_BUILDINGS = {
  metalMine: 1,
  crystalMine: 1,
  deuteriumSynthesizer: 0,
  solarPlant: 1,
  fusionReactor: 0,
  roboticsFactory: 0,
  shipyard: 0,
  researchLab: 0,
  metalStorage: 0,
  crystalStorage: 0,
  deuteriumTank: 0,
  waterStorage: 0,
  foodSilo: 0,
  naniteFactory: 0,
  waterExtractor: 1,
  farm: 1,
  housing: 1
};

// Game configuration
export const CONFIG = {
  GAME_TICK_INTERVAL: 1000, // 1 second
  SESSION_EXPIRE_TIME: 24 * 60 * 60 * 1000, // 24 hours
  BCRYPT_SALT_ROUNDS: 12,
  MAX_BUILD_QUEUE: 1,
  MAX_RESEARCH_QUEUE: 10,
  DEBRIS_PERCENTAGE: 0.3,
  DEFENSE_REPAIR_CHANCE: 0.7, // 70% of destroyed defenses are repaired
  DEFENSE_TO_DEBRIS_CHANCE: 0.1, // 10% of unrepaired defenses go to debris (optional, usually 0 in OGame)
  MAX_PLANETS_PER_PLAYER: 9,
  FOOD_CONSUMPTION_PER_POPULATION: 0.1, // Per hour
  WATER_CONSUMPTION_PER_POPULATION: 0.2, // Per hour
  POPULATION_HOUSING_RATIO: 50, // Population per housing level
  MIN_POPULATION_GROWTH: 60, // Minimum population growth per hour when food available
  SHIP_BUILD_SPEED: 2500, // Cost units per hour at base speed
  DEFENSE_BUILD_SPEED: 2500 // Cost units per hour at base speed
};

export const BUILDING_SPEED_MULTIPLIER = 0.85;
export const RESEARCH_LAB_SPEED_MULTIPLIER = 0.80;

// Scaling factors for easier fine-tuning
export const SCALING = {
  BUILDING_COST: 1.5,
  BUILDING_TIME: 1.5,
  BUILDING_PRODUCTION: 1.1,
  BUILDING_STORAGE: 1.6,
  BUILDING_ENERGY: 1.1,
  BUILDING_POPULATION: 1.12, // This is the population required for factories ...
  BUILDING_HOUSING: 1.15, // Adjusted from 1.2 to 1.15 for balanced growth
  RESEARCH_COST: 1.5,
  RESEARCH_TIME: 1.5,
  MISSION_FOOD_COST_FACTOR: 1.0, // Reduced from 50 to match population x time
  MISSION_WATER_COST_FACTOR: 1.0  // Reduced from 50 to match population x time
};

export const PLANET_TYPES = {}
