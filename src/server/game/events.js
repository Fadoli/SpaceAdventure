// Global events logic (PvE, Ghost Planets, etc.)
import { getGalaxyData, updateGhostPlanet } from './galaxyData.js';
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';

/**
 * Generate a random ghost planet with balanced stats
 */
function generateGhostPlanet(coords) {
  const tier = Math.floor(Math.random() * 3) + 1; // Tier 1-3
  
  const ships = {};
  const defenses = {};
  const resources = {
    metal: Math.floor(Math.random() * 50000 * tier) + 10000,
    crystal: Math.floor(Math.random() * 30000 * tier) + 5000,
    deuterium: Math.floor(Math.random() * 10000 * tier) + 2000,
    water: 5000,
    food: 5000
  };

  // Fleet based on tier
  if (tier >= 1) {
    ships.lightFighter = Math.floor(Math.random() * 20) + 10;
    defenses.rocketLauncher = Math.floor(Math.random() * 10) + 5;
  }
  if (tier >= 2) {
    ships.heavyFighter = Math.floor(Math.random() * 10) + 5;
    ships.cruiser = Math.floor(Math.random() * 5) + 2;
    defenses.laserCannon = Math.floor(Math.random() * 10) + 5;
  }
  if (tier >= 3) {
    ships.battleship = Math.floor(Math.random() * 3) + 1;
    defenses.particleBeam = Math.floor(Math.random() * 5) + 2;
  }

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
