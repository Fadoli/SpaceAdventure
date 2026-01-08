// Fleet and Mission management logic
import { generateId } from '../../shared/utils.js';
import { MISSION_TYPES, SHIPS as SHIP_TYPES, STARTING_BUILDINGS, CONFIG } from '../../shared/constants.js';
import { calculateShipSpeed, calculateFleetFuelCost, calculateFleetCrew, calculateFleetSurvivalNeeds, calculateCargoCapacity } from '../../shared/ships.js';
import { calculateTravelTime, calculateDistance } from '../../shared/formulas.js';
import { getPlayerByUserId, updatePlayer, trackSpentResources } from './player.js';
import { getFleetSpeedMultiplier } from '../config.js';
import { addMessage } from './messages.js';

/**
 * Start a new mission
 */
export async function sendFleet(userId, originPlanetId, targetCoords, missionType, ships, resources = {}, stayTime = 0) {
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

  // Calculate cargo capacity
  const cargoCapacity = calculateCargoCapacity(ships);
  let totalResources = 0;
  for (const res in resources) {
    totalResources += resources[res];
    if (originPlanet.resources[res] < resources[res]) {
      throw new Error(`Insufficient ${res} on planet`);
    }
  }

  if (totalResources > cargoCapacity) {
    throw new Error(`Insufficient cargo capacity: ${totalResources} / ${cargoCapacity}`);
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
  
  // Calculate mission costs
  const fuelCost = calculateFleetFuelCost(ships, distance);
  const crewCount = calculateFleetCrew(ships);
  
  // Total mission duration (travel both ways + stay time for expeditions)
  const totalDuration = (travelTime * 2) + (missionType === MISSION_TYPES.EXPEDITION ? (stayTime || 1) * 3600 : 0);
  const survivalNeeds = calculateFleetSurvivalNeeds(crewCount, totalDuration);

  // Check origin planet resources
  if (originPlanet.resources.deuterium < fuelCost + (resources.deuterium || 0)) throw new Error(`Insufficient Deuterium (Need ${fuelCost + (resources.deuterium || 0)})`);
  if (originPlanet.resources.food < survivalNeeds.food + (resources.food || 0)) throw new Error(`Insufficient Food (Need ${survivalNeeds.food + (resources.food || 0)})`);
  if (originPlanet.resources.water < survivalNeeds.water + (resources.water || 0)) throw new Error(`Insufficient Water (Need ${survivalNeeds.water + (resources.water || 0)})`);
  if ((originPlanet.resources.population || 0) < crewCount) throw new Error(`Insufficient Population (Need ${crewCount})`);

  // Create fleet object
  const fleet = {
    id: generateId(),
    ownerId: player.userId,
    ownerUsername: player.username,
    missionType,
    ships: { ...ships },
    resources: { ...resources },
    costs: {
      deuterium: fuelCost,
      food: survivalNeeds.food,
      water: survivalNeeds.water,
      crew: crewCount // Total crew sent
    },
    originCoords: [...originPlanet.coordinates],
    targetCoords: [...targetCoords],
    startTime: Date.now(),
    arrivalTime: Date.now() + (travelTime * 1000),
    returning: false,
    stayTime: stayTime // Store requested stay duration
  };

  // Deduct resources from planet (transported + mission costs)
  for (const res in resources) {
    originPlanet.resources[res] -= resources[res];
  }
  originPlanet.resources.deuterium -= fuelCost;
  originPlanet.resources.food -= survivalNeeds.food;
  originPlanet.resources.water -= survivalNeeds.water;
  originPlanet.resources.population -= crewCount;

  // Deduct ships from planet
  for (const shipKey in ships) {
    originPlanet.ships[shipKey] -= ships[shipKey];
  }

  // Track spending for ranking
  trackSpentResources(player, {
    deuterium: fuelCost,
    food: survivalNeeds.food,
    water: survivalNeeds.water
  });

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

    // Prevent double-processing in the same tick
    if (fleet.processedAt === now) continue;

    if (now >= fleet.arrivalTime) {
      fleet.processedAt = now; // Mark as processed in this tick
      
      if (fleet.waiting) {
        // Stay time finished, start return journey
        const distance = calculateDistance(fleet.originCoords, fleet.targetCoords);
        let slowestSpeed = Infinity;
        for (const shipKey in fleet.ships) {
          const speed = calculateShipSpeed(shipKey, player.research);
          if (speed < slowestSpeed) slowestSpeed = speed;
        }
        const fleetSpeedMultiplier = getFleetSpeedMultiplier();
        const travelTime = calculateTravelTime(distance, slowestSpeed, 1.0 / fleetSpeedMultiplier);
        
        fleet.returning = true;
        fleet.waiting = false;
        fleet.startTime = now;
        fleet.arrivalTime = now + (travelTime * 1000);
        updated = true;
      } else if (fleet.returning) {
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
          // For expedition, it stays for a while
          if (fleet.missionType === MISSION_TYPES.EXPEDITION) {
            fleet.waiting = true;
            fleet.startTime = now;
            const stayTime = (fleet.stayTime || 1) * 60 * 60 * 1000; // Use stored hours or default to 1h
            fleet.arrivalTime = now + stayTime;
          } else {
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
    // Return surviving crew to population
    if (fleet.costs && fleet.costs.crew) {
      const currentCrew = calculateFleetCrew(fleet.ships);
      planet.resources.population = (planet.resources.population || 0) + currentCrew;
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
    case MISSION_TYPES.EXPEDITION:
      await executeExpedition(player, fleet);
      return false; // Returns home after stay
    case MISSION_TYPES.TRANSPORT:
      await executeTransport(player, fleet, allPlayers);
      return false; // Returns home empty
    case MISSION_TYPES.DEPLOY:
      return await executeDeployment(player, fleet, allPlayers);
    default:
      return false;
  }
}

async function executeDeployment(player, fleet, allPlayers) {
  // Find target planet (Must be OWNED by player)
  const targetPlanet = player.planets.find(pl => 
    pl.coordinates[0] === fleet.targetCoords[0] &&
    pl.coordinates[1] === fleet.targetCoords[1] &&
    pl.coordinates[2] === fleet.targetCoords[2]
  );

  if (targetPlanet) {
    // Deliver resources
    for (const res in fleet.resources) {
      targetPlanet.resources[res] = (targetPlanet.resources[res] || 0) + fleet.resources[res];
      // Cap at storage
      if (targetPlanet.storage && targetPlanet.storage[res]) {
        targetPlanet.resources[res] = Math.min(targetPlanet.resources[res], targetPlanet.storage[res]);
      }
    }

    // Deliver ships (they STAY here)
    for (const shipKey in fleet.ships) {
      targetPlanet.ships[shipKey] = (targetPlanet.ships[shipKey] || 0) + fleet.ships[shipKey];
    }

    // Return surviving crew to population AT TARGET
    if (fleet.costs && fleet.costs.crew) {
      const currentCrew = calculateFleetCrew(fleet.ships);
      targetPlanet.resources.population = (targetPlanet.resources.population || 0) + currentCrew;
    }

    await addMessage(player.userId, {
      from: 'Fleet Command',
      subject: `Deployment Successful: [${fleet.targetCoords.join(':')}]`,
      body: `Your fleet has been deployed to ${targetPlanet.name} [${fleet.targetCoords.join(':')}]. They have been integrated into the local forces.`,
      type: 'transport',
      data: { target: fleet.targetCoords }
    });

    return true; // Fleet record removed, ships integrated
  } else {
    // Target is not owned by player or doesn't exist
    await addMessage(player.userId, {
      from: 'Fleet Command',
      subject: `Deployment Failed: [${fleet.targetCoords.join(':')}]`,
      body: `Your fleet reached [${fleet.targetCoords.join(':')}] but deployment failed. Target must be one of your own planets. They are returning home.`,
      type: 'transport',
      data: { target: fleet.targetCoords }
    });
    return false; // Returns home
  }
}

async function executeTransport(player, fleet, allPlayers) {
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

  if (targetPlanet) {
    // Deliver resources
    for (const res in fleet.resources) {
      targetPlanet.resources[res] = (targetPlanet.resources[res] || 0) + fleet.resources[res];
      // Cap at storage
      if (targetPlanet.storage && targetPlanet.storage[res]) {
        targetPlanet.resources[res] = Math.min(targetPlanet.resources[res], targetPlanet.storage[res]);
      }
    }

    // Clear resources from fleet
    const deliveredResources = { ...fleet.resources };
    for (const res in fleet.resources) {
      fleet.resources[res] = 0;
    }

    // Message to target player
    if (targetPlayer.userId !== player.userId) {
      await addMessage(targetPlayer.userId, {
        from: 'Trade Office',
        subject: `Incoming Transport from ${player.username}`,
        body: `A transport fleet from ${player.username} has delivered resources to your planet at [${fleet.targetCoords.join(':')}].`,
        type: 'transport',
        data: { from: player.username, resources: deliveredResources }
      });
    }

    // Message to sender
    await addMessage(player.userId, {
      from: 'Fleet Command',
      subject: `Transport Mission Arrived: [${fleet.targetCoords.join(':')}]`,
      body: `Your fleet has delivered resources to [${fleet.targetCoords.join(':')}]. They are now returning home.`,
      type: 'transport',
      data: { target: fleet.targetCoords, resources: deliveredResources }
    });
  } else {
    // Target is empty space, fleet returns with resources
    await addMessage(player.userId, {
      from: 'Fleet Command',
      subject: `Transport Mission Failed: [${fleet.targetCoords.join(':')}]`,
      body: `Your fleet reached the coordinates [${fleet.targetCoords.join(':')}] but found no planet. They are returning with the resources.`,
      type: 'transport',
      data: { target: fleet.targetCoords }
    });
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

  // Proper Espionage Logic
  // Formula: Effective Level = AttackerTech - DefenderTech + sqrt(probes) - 1
  const attackerTech = player.research?.espionageTech || 0;
  const defenderTech = targetPlayer?.research?.espionageTech || 0;
  const probes = fleet.ships.espionageProbe || 1;
  
  // Difference in tech levels
  const techDiff = attackerTech - defenderTech;
  
  // Total espionage power
  // 1 probe at same tech level -> level 0 (Resources only)
  // More probes or higher tech -> higher level
  const espionagePower = techDiff + (Math.sqrt(probes) - 1);
  
  const report = {
    id: generateId(),
    type: 'espionage',
    time: Date.now(),
    coords: [...fleet.targetCoords],
    targetPlayer: targetPlayer ? targetPlayer.username : 'Unknown',
    techLevel: attackerTech,
    defenderTechLevel: defenderTech,
    probeCount: probes,
    power: espionagePower.toFixed(2)
  };

  if (targetPlanet) {
    // Reveal info based on power thresholds
    // Level 0: Resources
    report.resources = { ...targetPlanet.resources };
    
    // Level 2: + Fleet
    if (espionagePower >= 2) {
      report.ships = { ...targetPlanet.ships };
    }
    
    // Level 4: + Defense
    if (espionagePower >= 4) {
      report.defenses = { ...targetPlanet.defenses };
    }
    
    // Level 6: + Buildings
    if (espionagePower >= 6) {
      report.buildings = { ...targetPlanet.buildings };
    }
    
    // Level 8: + Research
    if (espionagePower >= 8) {
      report.research = { ...targetPlayer.research };
    }

    // Add info about what was NOT seen
    if (espionagePower < 2) report.info = "Your espionage power was too low to see fleet movements.";
    else if (espionagePower < 4) report.info = "Your espionage power was too low to see planetary defenses.";
    else if (espionagePower < 6) report.info = "Your espionage power was too low to see planetary buildings.";
    else if (espionagePower < 8) report.info = "Your espionage power was too low to see enemy research levels.";
    
  } else {
    report.info = "Target coordinates are empty space.";
  }

  await addMessage(player.userId, {
    from: 'Intelligence Service',
    subject: `Espionage Report: [${fleet.targetCoords.join(':')}]`,
    body: `Our spies have returned from ${fleet.targetCoords.join(':')}. (Power: ${espionagePower.toFixed(1)})`,
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

async function executeExpedition(player, fleet) {
  const roll = Math.random();
  let resultType = 'nothing';
  let body = '';
  let subject = 'Expedition Report';

  if (roll < 0.1) {
    // Black hole (Lose some ships)
    resultType = 'black_hole';
    subject = 'Expedition: Disaster!';
    const shipToLose = Object.keys(fleet.ships).find(k => fleet.ships[k] > 0);
    if (shipToLose) {
      const lostCount = Math.ceil(fleet.ships[shipToLose] * 0.5);
      fleet.ships[shipToLose] -= lostCount;
      body = `Your fleet entered a gravity well of a dark star. You lost ${lostCount} ${shipToLose}.`;
    } else {
      body = `Your fleet narrowly escaped a black hole. No ships were lost.`;
    }
  } else if (roll < 0.4) {
    // Found resources
    resultType = 'resources';
    subject = 'Expedition: Resources Found';
    const metalFound = Math.floor(Math.random() * 5000) + 1000;
    const crystalFound = Math.floor(Math.random() * 2500) + 500;
    fleet.resources.metal = (fleet.resources.metal || 0) + metalFound;
    fleet.resources.crystal = (fleet.resources.crystal || 0) + crystalFound;
    body = `Your explorers found an abandoned mining colony. You collected ${metalFound} Metal and ${crystalFound} Crystal.`;
  } else if (roll < 0.6) {
    // Found ships
    resultType = 'ships';
    subject = 'Expedition: New Ships Found';
    const foundShips = { lightFighter: Math.floor(Math.random() * 3) + 1 };
    for (const s in foundShips) {
      fleet.ships[s] = (fleet.ships[s] || 0) + foundShips[s];
    }
    body = `Your fleet found some abandoned ships drifting in space. They have been integrated into your fleet.`;
  } else {
    // Nothing
    resultType = 'nothing';
    body = `Your expedition team explored the sector but found nothing of interest. They are preparing to return home.`;
  }

  await addMessage(player.userId, {
    from: 'Expedition Command',
    subject,
    body,
    type: 'expedition',
    data: { resultType, coords: [...fleet.targetCoords] }
  });
}
