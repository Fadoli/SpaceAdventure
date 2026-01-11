// Fleet and Mission management logic
import { generateId, isEmpty, formatNumber } from '../../shared/utils.js';
import { MISSION_TYPES, SHIPS as SHIP_TYPES, STARTING_BUILDINGS, CONFIG } from '../../shared/constants.js';
import { calculateShipSpeed, calculateFleetFuelCost, calculateFleetCrew, calculateFleetSurvivalNeeds, calculateCargoCapacity, SHIPS as SHIP_DEFINITIONS } from '../../shared/ships.js';
import { calculateTravelTime, calculateDistance } from '../../shared/formulas.js';
import { getPlayerByUserId, updatePlayer, trackSpentResources } from './player.js';
import { getFleetSpeedMultiplier } from '../config.js';
import { addMessage } from './messages.js';
import { simulateCombat } from './combatEngine.js';
import { getGalaxyData, updateDebrisField } from './galaxyData.js';

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

        // Generate expedition result before returning
        if (fleet.missionType === MISSION_TYPES.EXPEDITION) {
          await executeExpedition(player, fleet);
        }

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
      // await executeExpedition(player, fleet); // Moved to end of waiting period
      return false; // Returns home after stay
    case MISSION_TYPES.TRANSPORT:
      await executeTransport(player, fleet, allPlayers);
      return false; // Returns home empty
    case MISSION_TYPES.DEPLOY:
      return await executeDeployment(player, fleet, allPlayers);
    case MISSION_TYPES.ATTACK:
      await executeAttack(player, fleet, allPlayers);
      return false; // Returns home with loot (if any)
    case MISSION_TYPES.HARVEST:
      await executeHarvest(player, fleet);
      return false; // Returns home with recycled resources
    default:
      return false;
  }
}

async function executeHarvest(player, fleet) {
  const galaxy = await getGalaxyData();
  const coordKey = fleet.targetCoords.join(':');
  const debris = galaxy.debrisFields?.[coordKey];

  if (!debris || (debris.metal <= 0 && debris.crystal <= 0)) {
    await addMessage(player.userId, {
      from: 'Recycling Service',
      subject: `Harvest Mission: [${fleet.targetCoords.join(':')}]`,
      body: `Your fleet reached [${fleet.targetCoords.join(':')}] but found no debris field to harvest. They are returning home.`,
      type: 'harvest',
      data: { target: fleet.targetCoords }
    });
    return;
  }

  // Calculate capacity
  const capacity = calculateCargoCapacity(fleet.ships);
  
  // Harvest Metal first, then Crystal
  let metalHarvested = Math.min(debris.metal, capacity);
  let crystalHarvested = Math.min(debris.crystal, capacity - metalHarvested);

  // Update debris field
  debris.metal -= metalHarvested;
  debris.crystal -= crystalHarvested;
  await updateDebrisField(fleet.targetCoords, debris);

  // Load resources onto fleet
  fleet.resources.metal = (fleet.resources.metal || 0) + metalHarvested;
  fleet.resources.crystal = (fleet.resources.crystal || 0) + crystalHarvested;

  await addMessage(player.userId, {
    from: 'Recycling Service',
    subject: `Harvest Successful: [${fleet.targetCoords.join(':')}]`,
    body: `Your fleet has harvested ${formatNumber(metalHarvested)} Metal and ${formatNumber(crystalHarvested)} Crystal from the debris field at [${fleet.targetCoords.join(':')}]. They are now returning home.`,
    type: 'harvest',
    data: { target: fleet.targetCoords, resources: { metal: metalHarvested, crystal: crystalHarvested } }
  });
}

async function executeAttack(attackerPlayer, fleet, allPlayers) {
  // 1. Find target planet
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

  if (!targetPlanet) {
    await addMessage(attackerPlayer.userId, {
      from: 'Fleet Command',
      subject: `Attack Mission Failed: [${fleet.targetCoords.join(':')}]`,
      body: `Your fleet reached [${fleet.targetCoords.join(':')}] but found no planet to attack. They are returning home.`,
      type: 'attack'
    });
    return;
  }

  // 2. Prepare Combat Data
  const attacker = {
    ships: fleet.ships,
    research: attackerPlayer.research || {}
  };

  const defender = {
    ships: targetPlanet.ships || {},
    defenses: targetPlanet.defenses || {},
    research: targetPlayer.research || {}
  };

  // 3. Simulate Combat
  const combatReport = simulateCombat(attacker, defender);

  // 4. Apply Losses to Defender Planet
  targetPlanet.ships = combatReport.survivingDefenderShips;
  targetPlanet.defenses = combatReport.survivingDefenderDefenses;

  // 5. Update Attacker Fleet
  fleet.ships = combatReport.survivingAttackerShips;

  // 6. Handle Looting if attacker is not wiped out and target had resources
  let loot = { metal: 0, crystal: 0, deuterium: 0, water: 0, food: 0 };
  if (!isEmpty(fleet.ships)) {
    const cargoCapacity = calculateCargoCapacity(fleet.ships);
    // Attacker can take up to 50% of each resource, limited by total cargo capacity
    const availableLoot = {};
    for (const res in targetPlanet.resources) {
      if (['metal', 'crystal', 'deuterium', 'water', 'food'].includes(res)) {
        availableLoot[res] = Math.floor((targetPlanet.resources[res] || 0) * 0.5);
      }
    }

    // Fill cargo proportionally
    const totalAvailableLoot = Object.values(availableLoot).reduce((a, b) => a + b, 0);
    if (totalAvailableLoot > 0) {
      const ratio = Math.min(1, cargoCapacity / totalAvailableLoot);
      for (const res in availableLoot) {
        const amount = Math.floor(availableLoot[res] * ratio);
        loot[res] = amount;
        targetPlanet.resources[res] -= amount;
        fleet.resources[res] = (fleet.resources[res] || 0) + amount;
      }
    }
  }

  // 6.5. Update Debris Field in Galaxy
  if (combatReport.debris.metal > 0 || combatReport.debris.crystal > 0) {
    const galaxy = await getGalaxyData();
    const coordKey = fleet.targetCoords.join(':');
    const existingDebris = galaxy.debrisFields?.[coordKey] || { metal: 0, crystal: 0 };
    
    await updateDebrisField(fleet.targetCoords, {
      metal: existingDebris.metal + combatReport.debris.metal,
      crystal: existingDebris.crystal + combatReport.debris.crystal
    });
  }

  // 7. Send Messages
  const reportId = generateId();
  const summary = `Winner: ${combatReport.winner.toUpperCase()} | Loot: M:${formatNumber(loot.metal)} C:${formatNumber(loot.crystal)} D:${formatNumber(loot.deuterium)}`;

  // To Attacker
  await addMessage(attackerPlayer.userId, {
    from: 'Combat Command',
    subject: `Combat Report: [${fleet.targetCoords.join(':')}]`,
    body: `Our fleet engaged the enemy at [${fleet.targetCoords.join(':')}]. ${summary}`,
    type: 'attack',
    data: { ...combatReport, loot, reportId, isAttacker: true, targetCoords: fleet.targetCoords }
  });

  // To Defender
  if (targetPlayer.userId !== attackerPlayer.userId) {
    await addMessage(targetPlayer.userId, {
      from: 'Planetary Defense',
      subject: `URGENT: Planet Under Attack! [${fleet.targetCoords.join(':')}]`,
      body: `An enemy fleet from ${attackerPlayer.username} attacked your planet! ${summary}`,
      type: 'attack',
      data: { ...combatReport, loot, reportId, isAttacker: false, targetCoords: fleet.targetCoords, attackerName: attackerPlayer.username }
    });
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
    // 1. Detection/Counter-spying Logic
    // Chance increases with number of probes and decreases with tech advantage
    // Base chance: 2% per probe
    // Multiplied by tech factor: (DefenderTech + 1) / (AttackerTech + 1)
    const detectionChance = Math.min(1, (probes * 0.02) * ((defenderTech + 1) / (attackerTech + 1)));
    const isDetected = Math.random() < detectionChance;

    if (isDetected) {
      report.detected = true;
      report.detectionChance = (detectionChance * 100).toFixed(1);

      // Trigger Combat (Probes vs Planet)
      const attackerData = { ships: { ...fleet.ships }, research: player.research || {} };
      const defenderData = { 
        ships: targetPlanet.ships || {}, 
        defenses: targetPlanet.defenses || {}, 
        research: targetPlayer.research || {} 
      };

      const combatReport = simulateCombat(attackerData, defenderData);
      
      // Apply losses
      targetPlanet.ships = combatReport.survivingDefenderShips;
      targetPlanet.defenses = combatReport.survivingDefenderDefenses;
      fleet.ships = combatReport.survivingAttackerShips;

      // Update Debris Field in Galaxy
      if (combatReport.debris.metal > 0 || combatReport.debris.crystal > 0) {
        const galaxy = await getGalaxyData();
        const coordKey = fleet.targetCoords.join(':');
        const existingDebris = galaxy.debrisFields?.[coordKey] || { metal: 0, crystal: 0 };
        
        await updateDebrisField(fleet.targetCoords, {
          metal: existingDebris.metal + combatReport.debris.metal,
          crystal: existingDebris.crystal + combatReport.debris.crystal
        });
      }

      // If all probes destroyed, mission ends
      if (isEmpty(fleet.ships)) {
        await addMessage(player.userId, {
          from: 'Intelligence Service',
          subject: `ESPIONAGE FAILED: [${fleet.targetCoords.join(':')}]`,
          body: `Our espionage fleet was detected and destroyed! (Detection Chance: ${report.detectionChance}%)`,
          type: 'espionage',
          data: report
        });

        await addMessage(targetPlayer.userId, {
          from: 'Planetary Defense',
          subject: `FOREIGN SPY DETECTED: [${targetPlanet.coordinates.join(':')}]`,
          body: `An espionage fleet from ${player.username} was detected and neutralized.`,
          type: 'attack',
          data: { ...combatReport, isAttacker: false, targetCoords: targetPlanet.coordinates }
        });
        return; // Mission ends here
      } else {
        // Probes survived but were detected
        await addMessage(targetPlayer.userId, {
          from: 'Planetary Defense',
          subject: `FOREIGN SPY DETECTED: [${targetPlanet.coordinates.join(':')}]`,
          body: `An espionage fleet from ${player.username} was detected but some probes escaped.`,
          type: 'attack',
          data: { ...combatReport, isAttacker: false, targetCoords: targetPlanet.coordinates }
        });
      }
    }

    // Reveal info based on power thresholds
    // Level 0: Resources + population + energy
    report.resources = { 
      ...targetPlanet.resources,
      population: targetPlanet.resources.population || 0,
      energy: targetPlanet.production?.energy || 0
    };
    
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

  // Calculate total resource value of the fleet
  let fleetValue = 0;
  for (const shipKey in fleet.ships) {
    const count = fleet.ships[shipKey];
    if (count <= 0) continue;
    const shipDef = SHIP_DEFINITIONS[shipKey];
    if (shipDef && shipDef.baseCost) {
      fleetValue += (shipDef.baseCost.metal + shipDef.baseCost.crystal + shipDef.baseCost.deuterium) * count;
    }
  }

  // Scaling factor: close to 100% for small fleets, dropping to 10% at 1 billion fleet value
  const maxScalingFleetValue = 1000000000;
  const scalingFactor = 1.0 - (Math.min(fleetValue, maxScalingFleetValue) / maxScalingFleetValue) * 0.9;
  const rewardScale = Math.max(1000, fleetValue * scalingFactor);

  if (roll < 0.1) {
    // Disaster (Lose some ships) - Risk scales slightly with fleet size
    resultType = 'disaster';
    subject = 'Expedition: Disaster!';
    
    // Choose a random ship type that is present in the fleet
    const shipTypesPresent = Object.keys(fleet.ships).filter(k => fleet.ships[k] > 0);
    if (shipTypesPresent.length > 0) {
      const randomShipKey = shipTypesPresent[Math.floor(Math.random() * shipTypesPresent.length)];
      // Lose 20-70% of that ship type
      const lossPercent = 0.2 + (Math.random() * 0.5);
      const lostCount = Math.ceil(fleet.ships[randomShipKey] * lossPercent);
      fleet.ships[randomShipKey] -= lostCount;
      body = `Your fleet entered a gravity well of a dark star. You lost ${lostCount} ${randomShipKey.replace(/([A-Z])/g, ' $1').trim()}.`;
    } else {
      body = `Your fleet narrowly escaped a black hole. No ships were lost.`;
    }
  } else if (roll < 0.4) {
    // Found resources - Scales with fleet value
    resultType = 'resources';
    subject = 'Expedition: Resources Found';
    
    const metalFound = Math.floor(rewardScale * (0.5 + Math.random() * 1.5));
    const crystalFound = Math.floor(rewardScale * 0.5 * (0.5 + Math.random() * 1.5));
    const deuteriumFound = Math.floor(rewardScale * 0.1 * (0.5 + Math.random() * 1.5));
    
    fleet.resources.metal = (fleet.resources.metal || 0) + metalFound;
    fleet.resources.crystal = (fleet.resources.crystal || 0) + crystalFound;
    fleet.resources.deuterium = (fleet.resources.deuterium || 0) + deuteriumFound;
    
    body = `Your explorers found an abandoned mining colony. You collected ${formatNumber(metalFound)} Metal, ${formatNumber(crystalFound)} Crystal, and ${formatNumber(deuteriumFound)} Deuterium.`;
  } else if (roll < 0.6) {
    // Found ships - Scales with fleet value
    resultType = 'ships';
    subject = 'Expedition: New Ships Found';
    
    // Find a ship type that is roughly affordable with the reward scale
    const affordableShips = Object.keys(SHIP_TYPES).filter(k => {
      const s = SHIP_TYPES[k];
      const cost = s.baseCost.metal + s.baseCost.crystal + s.baseCost.deuterium;
      return cost < rewardScale;
    });

    if (affordableShips.length > 0) {
      const foundShipKey = affordableShips[Math.floor(Math.random() * affordableShips.length)];
      const shipDef = SHIP_TYPES[foundShipKey];
      const shipCost = shipDef.baseCost.metal + shipDef.baseCost.crystal + shipDef.baseCost.deuterium;
      const foundCount = Math.max(1, Math.floor(rewardScale / shipCost * (0.2 + Math.random() * 0.5)));
      
      fleet.ships[foundShipKey] = (fleet.ships[foundShipKey] || 0) + foundCount;
      body = `Your fleet found some abandoned ${shipDef.name.toLowerCase()}s drifting in space. They have been integrated into your fleet. (${foundCount} ships found)`;
    } else {
      body = `Your explorers found some tech debris, but were unable to recover any functional ships.`;
    }
  } else if (roll < 0.7) {
    // Found credits/statistics (Lore only for now)
    resultType = 'info';
    body = `Your explorers discovered an ancient archive containing star charts of nearby systems. While no physical resources were found, the navigational data will be invaluable for future missions.`;
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
