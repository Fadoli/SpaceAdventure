// Global events logic (PvE, Ghost Planets, etc.)
import { getGalaxyData, updateGhostPlanet } from './galaxyData.js';
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { logEvent } from '../storage/eventLogger.js';

/**
 * Generate a random ghost planet with balanced stats
 */
function generateGhostPlanet(coords) {
  // 8 Tiers with weighted probability
  const rand = Math.random();
  let tier = 1;
  if (rand < 0.005) tier = 8;
  else if (rand < 0.015) tier = 7;
  else if (rand < 0.03) tier = 6;
  else if (rand < 0.07) tier = 5;
  else if (rand < 0.15) tier = 4;
  else if (rand < 0.30) tier = 3;
  else if (rand < 0.60) tier = 2;
  else tier = 1;

  const ships = {};
  const defenses = {};
  
  // Resource scaling: Factor 50 per tier
  const resMultiplier = Math.pow(50, tier - 1);
  const resources = {
    metal: Math.min(Number.MAX_SAFE_INTEGER, (Math.floor(Math.random() * 40000) + 10000) * resMultiplier),
    crystal: Math.min(Number.MAX_SAFE_INTEGER, (Math.floor(Math.random() * 20000) + 5000) * resMultiplier),
    deuterium: Math.min(Number.MAX_SAFE_INTEGER, (Math.floor(Math.random() * 10000) + 2000) * resMultiplier),
    water: Math.min(Number.MAX_SAFE_INTEGER, 5000 * resMultiplier),
    food: Math.min(Number.MAX_SAFE_INTEGER, 5000 * resMultiplier)
  };

  // Combat scaling: Factor 50 per tier
  const combatMultiplier = Math.pow(50, tier - 1);

  // Basic tier (1+)
  ships.lightFighter = Math.floor((Math.random() * 20 + 10) * combatMultiplier);
  defenses.rocketLauncher = Math.floor((Math.random() * 10 + 5) * combatMultiplier);

  // Tier 2+
  if (tier >= 2) {
    ships.heavyFighter = Math.floor((Math.random() * 15 + 5) * (combatMultiplier / 50));
    defenses.laserCannon = Math.floor((Math.random() * 15 + 5) * (combatMultiplier / 50));
  }
  // Tier 3+
  if (tier >= 3) {
    ships.cruiser = Math.floor((Math.random() * 10 + 5) * (combatMultiplier / 2500));
    defenses.particleBeam = Math.floor((Math.random() * 10 + 5) * (combatMultiplier / 2500));
  }
  // Tier 4+
  if (tier >= 4) {
    ships.battleship = Math.floor((Math.random() * 10 + 5) * (combatMultiplier / 125000));
    defenses.gaussCannon = Math.floor((Math.random() * 5 + 2) * (combatMultiplier / 125000));
  }
  // Tier 5+
  if (tier >= 5) {
    ships.destroyer = Math.floor((Math.random() * 5 + 2) * (combatMultiplier / 6250000));
    defenses.plasmaTurret = Math.floor((Math.random() * 3 + 1) * (combatMultiplier / 6250000));
  }
  // Tier 6+
  if (tier >= 6) {
    ships.bomber = Math.floor((Math.random() * 5 + 2) * (combatMultiplier / 312500000));
    defenses.shield = 1;
  }
  // Tier 7+
  if (tier >= 7) {
    ships.carrier = Math.floor((Math.random() * 2 + 1) * (combatMultiplier / 15625000000));
  }
  // Tier 8
  if (tier >= 8) {
    ships.dreadnought = Math.floor((Math.random() * 1 + 1) * (combatMultiplier / 781250000000));
  }

  // Cleanup: remove zero counts
  for (const k in ships) if (ships[k] <= 0) delete ships[k];
  for (const k in defenses) if (defenses[k] <= 0) delete defenses[k];

  return {
    name: `Ghost Echo ${coords[2]}`,
    player: 'Ancient Remnants',
    playerType: 'ghost',
    ships,
    defenses,
    resources,
    tier,
    createdAt: Date.now()
  };
}

/**
 * Periodically spawn ghost planets in empty slots
 */
export async function spawnGhostPlanets() {
  const galaxy = await getGalaxyData();
  const allPlayers = await getAllPlayers();
  
  // Map occupied slots
  const occupied = new Set();
  allPlayers.forEach(p => {
    p.planets.forEach(pl => occupied.add(pl.coordinates.join(':')));
  });

  // Current ghosts
  if (galaxy.ghostPlanets) {
    for (const k in galaxy.ghostPlanets) occupied.add(k);
  }

  let spawnedCount = 0;

  // Scan galaxies 1-3, systems 1-100
  for (let g = 1; g <= 3; g++) {
    for (let s = 1; s <= 100; s++) {
      // Check if this system already has a ghost
      let hasGhost = false;
      if (galaxy.ghostPlanets) {
        for (const k in galaxy.ghostPlanets) {
          if (k.startsWith(`${g}:${s}:`)) {
            hasGhost = true;
            break;
          }
        }
      }
      if (hasGhost) continue;

      // Find an empty slot
      const slots = [4, 5, 6, 7, 8, 9, 10, 11, 12]; // Favor middle slots
      const emptySlots = slots.filter(p => !occupied.has(`${g}:${s}:${p}`));
      
      if (emptySlots.length > 0) {
        const targetPos = emptySlots[Math.floor(Math.random() * emptySlots.length)];
        const coords = [g, s, targetPos];
        const ghost = generateGhostPlanet(coords);
        
        await updateGhostPlanet(coords, ghost);
        await logEvent('SPAWN_GHOST', { coords, tier: ghost.tier });
        spawnedCount++;
      }
    }
  }

  if (spawnedCount > 0) {
    console.log(`[Events] Spawned ${spawnedCount} new ghost planets`);
  }
}

/**
 * Cleanup old ghost planets
 */
export async function cleanupGhostPlanets() {
  const galaxy = await getGalaxyData();
  const now = Date.now();
  const MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

  let removedCount = 0;
  for (const key in galaxy.ghostPlanets) {
    const ghost = galaxy.ghostPlanets[key];
    if (now - ghost.createdAt > MAX_AGE) {
      await updateGhostPlanet(ghost.coords, null);
      removedCount++;
    }
  }

  if (removedCount > 0) {
    console.log(`[Events] Cleaned up ${removedCount} expired ghost planets`);
  }
}

async function getAllPlayers() {
    const { getPlayers } = await import('./player.js');
    return await getPlayers();
}
