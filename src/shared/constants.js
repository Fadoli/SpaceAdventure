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
  STORAGE: 'storage',
  NANITE_FACTORY: 'naniteFactory',
  WATER_EXTRACTOR: 'waterExtractor',
  FARM: 'farm',
  HOUSING: 'housing'
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
  ASTROPHYSICS: 'astrophysics'
};

export const SHIPS = {
  SMALL_CARGO: 'smallCargo',
  LARGE_CARGO: 'largeCargo',
  LIGHT_FIGHTER: 'lightFighter',
  HEAVY_FIGHTER: 'heavyFighter',
  CRUISER: 'cruiser',
  BATTLESHIP: 'battleship',
  COLONY_SHIP: 'colonyShip',
  RECYCLER: 'recycler',
  ESPIONAGE_PROBE: 'espionageProbe'
};

export const MISSION_TYPES = {
  ATTACK: 'attack',
  TRANSPORT: 'transport',
  COLONIZE: 'colonize',
  ESPIONAGE: 'espionage',
  HARVEST: 'harvest',
  EXPEDITION: 'expedition'
};

export const AI_TYPES = {
  TUTORIAL: 'tutorial',
  DEFENSIVE: 'defensive',
  BALANCED: 'balanced',
  AGGRESSIVE: 'aggressive',
  RAIDER: 'raider'
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
  storage: 0,
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
  MAX_PLANETS_PER_PLAYER: 9,
  FOOD_CONSUMPTION_PER_POPULATION: 0.1, // Per hour
  POPULATION_HOUSING_RATIO: 50, // Population per housing level
  MIN_POPULATION_GROWTH: 60, // Minimum population growth per hour when food available
  SHIP_BUILD_SPEED: 2500, // Cost units per hour at base speed
  DEFENSE_BUILD_SPEED: 2500 // Cost units per hour at base speed
};

export const BUILDING_SPEED_MULTIPLIER = 0.85;

// Scaling factors for easier fine-tuning
export const SCALING = {
  BUILDING_COST: 1.5,
  BUILDING_TIME: 1.5,
  BUILDING_PRODUCTION: 1.1,
  BUILDING_STORAGE: 1.6,
  BUILDING_ENERGY: 1.1,
  BUILDING_POPULATION: 1.12,
  BUILDING_HOUSING: 1.15,
  RESEARCH_COST: 1.5,
  RESEARCH_TIME: 1.5
};

export const PLANET_TYPES = {}
