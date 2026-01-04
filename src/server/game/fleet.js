// Fleet and Mission management logic
import { generateId } from '../../shared/utils.js';
import { MISSION_TYPES, SHIPS as SHIP_TYPES, STARTING_BUILDINGS } from '../../shared/constants.js';
import { calculateShipSpeed } from '../../shared/ships.js';
import { calculateTravelTime } from '../../shared/formulas.js';
import { getPlayerByUserId, updatePlayer } from './player.js';
import { getFleetSpeedMultiplier } from '../config.js';
import { addMessage } from './messages.js';

/**
 * Calculate distance between two sets of coordinates [G, S, P]
 */
export function calculateDistance(coord1, coord2) {
  if (coord1[0] !== coord2[0]) {
    return Math.abs(coord1[0] - coord2[0]) * 20000;
  }
  if (coord1[1] !== coord2[1]) {
    return Math.abs(coord1[1] - coord2[1]) * 95 + 2700;
  }
  if (coord1[2] !== coord2[2]) {
    return Math.abs(coord1[2] - coord2[2]) * 5 + 1000;
  }
  return 5; // Same planet
}

/**
 * Start a new mission
 */
export async function sendFleet(userId, originPlanetId, targetCoords, missionType, ships, resources = {}) {
  const player = await getPlayerByUserId(userId);
  if (!player) throw new Error('Player not found');

  const originPlanet = player.planets.find(p => p.id === originPlanetId);
  if (!originPlanet) throw new Error('Origin planet not found');

  // Verify ships availability
  for (const shipKey in ships) {
    if ((originPlanet.ships[shipKey] || 0) < ships[shipKey]) {
      throw new Error(`Insufficient ships: ${shipKey}`);
    }
  }

  // Calculate stats
  const distance = calculateDistance(originPlanet.coordinates, targetCoords);
  
  // Find slowest ship speed
  let slowestSpeed = Infinity;
  for (const shipKey in ships) {
    if (ships[shipKey] > 0) {
      const speed = calculateShipSpeed(shipKey, player.research);
      if (speed < slowestSpeed) slowestSpeed = speed;
    }
  }

  if (slowestSpeed === Infinity) throw new Error('No ships selected');

  const fleetSpeedMultiplier = getFleetSpeedMultiplier();
  const travelTime = calculateTravelTime(distance, slowestSpeed, 1.0 / fleetSpeedMultiplier);
  
  // Create fleet object
  const fleet = {
    id: generateId(),
    ownerId: player.userId,
    ownerUsername: player.username,
    missionType,
    ships: { ...ships },
    resources: { ...resources },
    originCoords: [...originPlanet.coordinates],
    targetCoords: [...targetCoords],
    startTime: Date.now(),
    arrivalTime: Date.now() + (travelTime * 1000),
    returning: false
  };

  // Deduct ships from planet
  for (const shipKey in ships) {
    originPlanet.ships[shipKey] -= ships[shipKey];
  }

  // Add to player's active fleets
  if (!player.fleets) player.fleets = [];
  player.fleets.push(fleet);

  await updatePlayer(userId, player);
  return fleet;
}

/**
 * Process all active fleets for a player
 */
export async function processFleets(player, allPlayers) {
  if (!player.fleets || player.fleets.length === 0) return false;

  let updated = false;
  const now = Date.now();

  for (let i = player.fleets.length - 1; i >= 0; i--) {
    const fleet = player.fleets[i];

    if (now >= fleet.arrivalTime) {
      if (fleet.returning) {
        // Fleet returned home
        await handleFleetReturn(player, fleet);
        player.fleets.splice(i, 1);
        updated = true;
      } else {
        // Fleet arrived at target
        const missionCompleted = await handleFleetArrival(player, fleet, allPlayers);
        if (missionCompleted) {
          // Some missions complete immediately (like colonize success)
          player.fleets.splice(i, 1);
        } else {
          // Other missions reverse and return (spy, attack, transport)
          const distance = calculateDistance(fleet.originCoords, fleet.targetCoords);
          let slowestSpeed = Infinity;
          for (const shipKey in fleet.ships) {
            const speed = calculateShipSpeed(shipKey, player.research);
            if (speed < slowestSpeed) slowestSpeed = speed;
          }
          const fleetSpeedMultiplier = getFleetSpeedMultiplier();
          const travelTime = calculateTravelTime(distance, slowestSpeed, 1.0 / fleetSpeedMultiplier);
          
          fleet.returning = true;
          fleet.startTime = now;
          fleet.arrivalTime = now + (travelTime * 1000);
        }
        updated = true;
      }
    }
  }

  return updated;
}

async function handleFleetReturn(player, fleet) {
  // Find origin planet (or nearest owned if destroyed - simplified: always find origin)
  const planet = player.planets.find(p => 
    p.coordinates[0] === fleet.originCoords[0] && 
    p.coordinates[1] === fleet.originCoords[1] && 
    p.coordinates[2] === fleet.originCoords[2]
  );

  if (planet) {
    // Add ships back
    for (const shipKey in fleet.ships) {
      planet.ships[shipKey] = (planet.ships[shipKey] || 0) + fleet.ships[shipKey];
    }
    // Add resources back
    for (const res in fleet.resources) {
      planet.resources[res] += fleet.resources[res];
    }
  }
}

async function handleFleetArrival(player, fleet, allPlayers) {
  switch (fleet.missionType) {
    case MISSION_TYPES.ESPIONAGE:
      await executeEspionage(player, fleet, allPlayers);
      return false; // Returns home
    case MISSION_TYPES.COLONIZE:
      return await executeColonization(player, fleet, allPlayers);
    default:
      return false;
  }
}

async function executeEspionage(player, fleet, allPlayers) {
  // Find target planet
  let targetPlanet = null;
  let targetPlayer = null;

  for (const p of allPlayers) {
    const planet = p.planets.find(pl => 
      pl.coordinates[0] === fleet.targetCoords[0] &&
      pl.coordinates[1] === fleet.targetCoords[1] &&
      pl.coordinates[2] === fleet.targetCoords[2]
    );
    if (planet) {
      targetPlanet = planet;
      targetPlayer = p;
      break;
    }
  }

  const report = {
    id: generateId(),
    type: 'espionage',
    time: Date.now(),
    coords: [...fleet.targetCoords],
    targetPlayer: targetPlayer ? targetPlayer.username : 'Unknown'
  };

  if (targetPlanet) {
    report.resources = { ...targetPlanet.resources };
    report.buildings = { ...targetPlanet.buildings };
    report.ships = { ...targetPlanet.ships };
    report.defenses = { ...targetPlanet.defenses };
  } else {
    report.info = "Target coordinates are empty space.";
  }

  await addMessage(player.userId, {
    from: 'Intelligence Service',
    subject: `Espionage Report: [${fleet.targetCoords.join(':')}]`,
    body: `Our spies have returned from ${fleet.targetCoords.join(':')}.`,
    type: 'espionage',
    data: report
  });
}

async function executeColonization(player, fleet, allPlayers) {
  // Check if position is occupied
  let occupied = false;
  for (const p of allPlayers) {
    if (p.planets.find(pl => 
      pl.coordinates[0] === fleet.targetCoords[0] &&
      pl.coordinates[1] === fleet.targetCoords[1] &&
      pl.coordinates[2] === fleet.targetCoords[2]
    )) {
      occupied = true;
      break;
    }
  }

  if (occupied) {
    // Mission fails, return fleet (though usually colony ship is lost if it arrives and finds it occupied)
    // Simplified: Return the fleet
    return false;
  }

  // Create new planet
  const planetId = generateId();
  const newPlanet = {
    id: planetId,
    name: 'Colony',
    coordinates: [...fleet.targetCoords],
    resources: { metal: 500, crystal: 500, deuterium: 0, energy: 0, water: 1000, food: 1000, population: 10 },
    buildings: { ...STARTING_BUILDINGS }, // Small subset usually but let's use starting for now
    production: { metal: 30, crystal: 15, deuterium: 0, energy: 0, water: 40, food: 30 },
    storage: { metal: 10000, crystal: 10000, deuterium: 10000, water: 10000, food: 10000 },
    maxPopulation: 100,
    ships: {},
    defenses: {},
    lastUpdate: Date.now()
  };

  player.planets.push(newPlanet);
  // Colony ship is consumed
  fleet.ships.colonyShip--;
  
  // If other ships were with it, they stay at the new planet
  for (const shipKey in fleet.ships) {
    if (fleet.ships[shipKey] > 0) {
      newPlanet.ships[shipKey] = (newPlanet.ships[shipKey] || 0) + fleet.ships[shipKey];
    }
  }

  await addMessage(player.userId, {
    from: 'Colonial Command',
    subject: `Colonization Successful: [${fleet.targetCoords.join(':')}]`,
    body: `A new colony has been established at ${fleet.targetCoords.join(':')}.`,
    type: 'colonization',
    data: { coords: [...fleet.targetCoords], planetId }
  });

  return true; // Mission completed, fleet record removed
}
