// Fleet and Mission management logic
import { generateId, isEmpty, formatNumber } from '../../shared/utils.js';
import { MISSION_TYPES, STARTING_BUILDINGS, CONFIG } from '../../shared/constants.js';
import { 
    calculateShipSpeed, 
    calculateFleetFuelCost, 
    calculateFleetCrew, 
    calculateFleetSurvivalNeeds, 
    calculateCargoCapacity, 
    getShip,
    SHIPS as SHIP_DEFINITIONS,
    ALIEN_SHIPS
} from '../../shared/ships.js';
import { calculateTravelTime, calculateDistance, calculateMaxPlanets } from '../../shared/formulas.js';
import { getResearchBonus } from '../../shared/research.js';
import { getPlayerByUserId, updatePlayer, getPlayers } from './player.js';
import { getFleetSpeedMultiplier } from '../config.js';
import { addMessage } from './messages.js';
import { simulateCombat, simulateGroupCombat } from './combatEngine.js';
import { getGalaxyData, updateDebrisField, updateGhostPlanet } from './galaxyData.js';
import { wsManager } from './wsManager.js';
import { logEvent } from '../storage/eventLogger.js';

const CARGO_RESOURCES = new Set(['metal', 'crystal', 'deuterium', 'water', 'food']);
const TRADE_RESOURCES = new Set(['metal', 'crystal', 'deuterium']);

function validateQuantities(values, label, isAllowed, required = false) {
    if (!values || typeof values !== 'object' || Array.isArray(values)) throw new Error(`Invalid ${label} payload`);
    const entries = Object.entries(values);
    if (required && entries.length === 0) throw new Error(`No ${label} selected`);

    let total = 0;
    for (const [key, quantity] of entries) {
        if (!isAllowed(key)) throw new Error(`Unknown ${label}: ${key}`);
        if (!Number.isSafeInteger(quantity) || quantity <= 0) throw new Error(`${label} quantity must be a positive integer`);
        total += quantity;
        if (!Number.isSafeInteger(total)) throw new Error(`${label} quantity is too large`);
    }
    return total;
}

/**
 * Start a new mission
 */
export async function sendFleet(userId, originPlanetId, targetCoords, missionType, ships, resources = {}, stayTime = 0, buyResources = null, speedPercent = 1.0) {
    if (!Object.values(MISSION_TYPES).includes(missionType)) throw new Error('Invalid mission type');
    const maxPosition = missionType === MISSION_TYPES.EXPEDITION ? 16 : 15;
    if (!Array.isArray(targetCoords) || targetCoords.length !== 3 ||
        !targetCoords.every(Number.isSafeInteger) || targetCoords[0] < 1 || targetCoords[0] > 10 ||
        targetCoords[1] < 1 || targetCoords[1] > 499 || targetCoords[2] < 1 || targetCoords[2] > maxPosition) {
        throw new Error('Invalid target coordinates');
    }

    validateQuantities(ships, 'ships', key => Boolean(getShip(key)), true);
    const resourceKeys = missionType === MISSION_TYPES.MARKET_TRADE ? TRADE_RESOURCES : CARGO_RESOURCES;
    validateQuantities(resources, 'resources', key => resourceKeys.has(key), missionType === MISSION_TYPES.MARKET_TRADE);
    if (missionType === MISSION_TYPES.MARKET_TRADE) {
        validateQuantities(buyResources, 'trade resources', key => TRADE_RESOURCES.has(key), true);
    } else if (buyResources !== null) {
        throw new Error('Buy resources are only valid for market missions');
    }
    if (!Number.isFinite(stayTime) || stayTime < 0 || stayTime > 24) throw new Error('Invalid mission duration');
    if (!Number.isFinite(speedPercent) || speedPercent < 0.0001 || speedPercent > 1) throw new Error('Invalid fleet speed');

    const player = await getPlayerByUserId(userId);
    if (!player) throw new Error('Player not found');

    const originPlanet = player.planets.find(p => p.id === originPlanetId);
    if (!originPlanet) throw new Error('Origin planet not found');

    const finalSpeedPercent = speedPercent;

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

    // Market trade check: cargo must fit either what we send or what we expect to bring back
    let buyWeight = 0;
    if (buyResources) {
        for (const k in buyResources) buyWeight += buyResources[k];
    }
    const maxWeight = Math.max(totalResources, buyWeight);

    if (maxWeight > cargoCapacity) {
        throw new Error(`Insufficient cargo capacity: ${maxWeight} / ${cargoCapacity}`);
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
    const travelTime = calculateTravelTime(distance, slowestSpeed, fleetSpeedMultiplier, finalSpeedPercent);

    if (missionType === MISSION_TYPES.COLONIZE) {
        const maxPlanets = calculateMaxPlanets(player.research);
        
        // Count existing planets + colonization missions in flight
        const activeColonizations = (player.fleets || []).filter(f => f.missionType === MISSION_TYPES.COLONIZE && !f.returning).length;
        
        if (player.planets.length + activeColonizations >= maxPlanets) {
            throw new Error(`Colonial limit reached (${maxPlanets} planets). Research Astrophysics to expand.`);
        }
    }

    // Calculate mission costs - use speed-aware helpers
    const fuelCost = calculateFleetFuelCost(ships, distance, finalSpeedPercent);
    const crewCount = calculateFleetCrew(ships);

    // Total mission duration (travel both ways + stay time for expeditions)
    const totalDuration = (travelTime * 2) + (missionType === MISSION_TYPES.EXPEDITION ? (stayTime || 1) * 3600 : 0);
    const survivalNeeds = calculateFleetSurvivalNeeds(crewCount, totalDuration);

    // Check origin planet resources
    if (originPlanet.resources.deuterium < fuelCost + (resources.deuterium || 0)) throw new Error(`Insufficient Deuterium (Need ${fuelCost + (resources.deuterium || 0)})`);
    if (originPlanet.resources.food < survivalNeeds.food + (resources.food || 0)) throw new Error(`Insufficient Food (Need ${survivalNeeds.food + (resources.food || 0)})`);
    if (originPlanet.resources.water < survivalNeeds.water + (resources.water || 0)) throw new Error(`Insufficient Water (Need ${survivalNeeds.water + (resources.water || 0)})`);
    if ((originPlanet.resources.population || 0) < crewCount) throw new Error(`Insufficient Population (Need ${crewCount})`);

    // Deduct costs
    originPlanet.resources.deuterium -= fuelCost;
    originPlanet.resources.food -= survivalNeeds.food;
    originPlanet.resources.water -= survivalNeeds.water;
    originPlanet.resources.population -= crewCount;

    // Deduct cargo resources
    for (const res in resources) {
        originPlanet.resources[res] -= resources[res];
    }

    // Deduct ships
    for (const shipKey in ships) {
        originPlanet.ships[shipKey] -= ships[shipKey];
    }

    const now = Date.now();
    const newFleet = {
        id: generateId(),
        missionType,
        ships: { ...ships },
        resources: { ...resources },
        buyResources: buyResources ? { ...buyResources } : null,
        originCoords: [...originPlanet.coordinates],
        targetCoords: [...targetCoords],
        startTime: now,
        arrivalTime: now + (travelTime * 1000),
        travelTime: travelTime,
        returning: false,
        waiting: false,
        stayTime,
        speedPercent: finalSpeedPercent,
        costs: {
            deuterium: fuelCost,
            food: survivalNeeds.food,
            water: survivalNeeds.water,
            crew: crewCount
        }
    };

    if (!player.fleets) player.fleets = [];
    player.fleets.push(newFleet);

    // Save player state
    await updatePlayer(player.userId, player);

    return newFleet;
}

/**
 * Process all active fleets for a player
 */
export async function processFleets(player, allPlayers, now = Date.now(), isCatchUp = false) {
    if (!player.fleets || player.fleets.length === 0) return false;

    let updated = false;

    for (let i = player.fleets.length - 1; i >= 0; i--) {
        const fleet = player.fleets[i];
        if (!fleet) continue;

        // Prevent double-processing in the same tick
        if (fleet.processedAt === now) continue;

        if (now >= fleet.arrivalTime) {
            const transitionTime = isCatchUp ? fleet.arrivalTime : now;
            // Skip if this fleet was already processed by a "lead" fleet in a group combat this tick
            if (fleet.processedAtWS) {
                delete fleet.processedAtWS;
                continue;
            }

            fleet.processedAt = transitionTime;

            if (fleet.waiting) {
                // Stay time finished, start return journey

                // Generate expedition result before returning
                if (fleet.missionType === MISSION_TYPES.EXPEDITION) {
                    const destroyed = await executeExpedition(player, fleet);
                    if (destroyed) {
                        player.fleets.splice(i, 1);
                        updated = true;
                        if (!isCatchUp) wsManager.sendToUser(player.userId, 'FLEET_ARRIVED', { userId: player.userId, fleetId: fleet.id, completed: true });
                        continue;
                    }
                }

                const distance = calculateDistance(fleet.originCoords, fleet.targetCoords);
                let slowestSpeed = Infinity;
                for (const shipKey in fleet.ships) {
                    const speed = calculateShipSpeed(shipKey, player.research);
                    if (speed < slowestSpeed) slowestSpeed = speed;
                }
                const travelTime = calculateTravelTime(distance, slowestSpeed, getFleetSpeedMultiplier(), fleet.speedPercent || 1.0);

                fleet.returning = true;
                fleet.waiting = false;
                fleet.startTime = transitionTime;
                fleet.arrivalTime = transitionTime + (travelTime * 1000);

                // Swap coords so target becomes home
                const origin = [...fleet.originCoords];
                fleet.originCoords = [...fleet.targetCoords];
                fleet.targetCoords = origin;

                updated = true;
            } else if (fleet.returning) {
                // Fleet returned home
                await handleFleetReturn(player, fleet);
                player.fleets.splice(i, 1);
                updated = true;
                if (!isCatchUp) wsManager.sendToUser(player.userId, 'FLEET_RETURNED', { userId: player.userId, fleetId: fleet.id });
            } else {
                // Fleet arrived at target
                const missionCompleted = await handleFleetArrival(player, fleet, allPlayers);
                if (missionCompleted) {
                    // Some missions complete immediately (like colonize success)
                    player.fleets.splice(i, 1);
                    if (!isCatchUp) wsManager.sendToUser(player.userId, 'FLEET_ARRIVED', { userId: player.userId, fleetId: fleet.id, completed: true });
                } else {
                    // Other missions reverse and return (spy, attack, transport)
                    // For expedition, it stays for a while
                    if (fleet.missionType === MISSION_TYPES.EXPEDITION) {
                        fleet.waiting = true;
                        fleet.startTime = transitionTime;
                        const stayTime = (fleet.stayTime || 1) * 60 * 60 * 1000; // Use stored hours or default to 1h
                        fleet.arrivalTime = transitionTime + stayTime;
                    } else {
                        const distance = calculateDistance(fleet.originCoords, fleet.targetCoords);
                        let slowestSpeed = Infinity;
                        for (const shipKey in fleet.ships) {
                            const speed = calculateShipSpeed(shipKey, player.research);
                            if (speed < slowestSpeed) slowestSpeed = speed;
                        }
                        const travelTime = calculateTravelTime(distance, slowestSpeed, getFleetSpeedMultiplier(), fleet.speedPercent || 1.0);

                        fleet.returning = true;
                        fleet.startTime = transitionTime;
                        fleet.arrivalTime = transitionTime + (travelTime * 1000);

                        // Swap coords
                        const origin = [...fleet.originCoords];
                        fleet.originCoords = [...fleet.targetCoords];
                        fleet.targetCoords = origin;
                    }
                    if (!isCatchUp) wsManager.sendToUser(player.userId, 'FLEET_ARRIVED', { userId: player.userId, fleetId: fleet.id, completed: false });
                }
                updated = true;
            }
        }
    }

    return updated;
}

async function handleFleetReturn(player, fleet) {
    // 1. Handle Pooled Fleets (ACS Group Attack)
    if (fleet.isPooled && fleet.originalParticipants) {
        const totalArrivedShips = {};
        fleet.originalParticipants.forEach(p => {
            for (const k in p.ships) totalArrivedShips[k] = (totalArrivedShips[k] || 0) + p.ships[k];
        });

        // Calculate survival ratio per ship type
        const survivalRatios = {};
        for (const k in totalArrivedShips) {
            survivalRatios[k] = totalArrivedShips[k] > 0 ? (fleet.ships[k] || 0) / totalArrivedShips[k] : 0;
        }

        // Distribute survivors and loot back to each participant
        for (const participant of fleet.originalParticipants) {
            const pPlayer = await getPlayerByUserId(participant.userId);
            if (!pPlayer) continue;

            // Find original origin planet or homeworld
            const pPlanet = pPlayer.planets.find(p => p.coordinates.every((c, i) => c === fleet.targetCoords[i])) || pPlayer.planets[0];

            // Calculate my survivors
            for (const k in participant.ships) {
                const count = Math.floor(participant.ships[k] * survivalRatios[k]);
                pPlanet.ships[k] = (pPlanet.ships[k] || 0) + count;
            }

            // Distribute loot proportionally to initial contribution value
            // (Simplified: just give them their share of what the fleet is carrying)
            let participantInitialValue = 0;
            for (const k in participant.ships) {
                const def = SHIP_DEFINITIONS[k];
                if (def) participantInitialValue += (def.baseCost.metal + def.baseCost.crystal + def.baseCost.deuterium) * participant.ships[k];
            }

            let totalInitialValue = 0;
            for (const k in totalArrivedShips) {
                const def = SHIP_DEFINITIONS[k];
                if (def) totalInitialValue += (def.baseCost.metal + def.baseCost.crystal + def.baseCost.deuterium) * totalArrivedShips[k];
            }

            if (totalInitialValue > 0) {
                const shareRatio = participantInitialValue / totalInitialValue;
                for (const res in fleet.resources) {
                    const share = Math.floor(fleet.resources[res] * shareRatio);
                    pPlanet.resources[res] = (pPlanet.resources[res] || 0) + share;
                }
            }

            await updatePlayer(participant.userId, pPlayer);
            wsManager.sendToUser(participant.userId, 'RESOURCES_UPDATED', { planetId: pPlanet.id });
        }
        return;
    }

    // 2. Normal Fleet Return (Standard)
    // Find origin planet (or nearest owned if destroyed - simplified: always find origin)
    // When returning, targetCoords is the home planet because coordinates were swapped
    const planet = player.planets.find(p =>
        p.coordinates[0] === fleet.targetCoords[0] &&
        p.coordinates[1] === fleet.targetCoords[1] &&
        p.coordinates[2] === fleet.targetCoords[2]
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
        case MISSION_TYPES.MARKET_TRADE:
            await executeMarketTrade(player, fleet);
            return false; // Returns home with exchanged resources
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
    const totalDebris = debris.metal + debris.crystal;

    let metalHarvested = 0;
    let crystalHarvested = 0;

    if (capacity >= totalDebris) {
        // Can take everything
        metalHarvested = debris.metal;
        crystalHarvested = debris.crystal;
    } else {
        // Take proportional amounts
        const ratio = capacity / totalDebris;
        metalHarvested = Math.floor(debris.metal * ratio);
        crystalHarvested = Math.floor(debris.crystal * ratio);
        
        // Handle rounding leftovers if there is still capacity
        let currentHarvested = metalHarvested + crystalHarvested;
        let remainingCapacity = capacity - currentHarvested;
        
        if (remainingCapacity > 0) {
            // Give remaining to whichever has more left in field proportionately or just fill up
            // To be simple and fair: add to metal if possible, then crystal
            const extraMetal = Math.min(remainingCapacity, Math.ceil(debris.metal - metalHarvested));
            metalHarvested += extraMetal;
            remainingCapacity -= extraMetal;
            
            if (remainingCapacity > 0) {
                const extraCrystal = Math.min(remainingCapacity, Math.ceil(debris.crystal - crystalHarvested));
                crystalHarvested += extraCrystal;
            }
        }
    }

    // Update debris field
    debris.metal = Math.max(0, debris.metal - metalHarvested);
    debris.crystal = Math.max(0, debris.crystal - crystalHarvested);
    await updateDebrisField(fleet.targetCoords, debris);

    // Load resources onto fleet
    fleet.resources.metal = (fleet.resources.metal || 0) + metalHarvested;
    fleet.resources.crystal = (fleet.resources.crystal || 0) + crystalHarvested;

    // Notify client of resource change (fleet resources changed, will be added to planet on return)
    // No direct planet change yet, but we send it to trigger any listeners if needed
    wsManager.sendToUser(player.userId, 'RESOURCES_UPDATED', {});

    await addMessage(player.userId, {
        from: 'Recycling Service',
        subject: `Harvest Successful: [${fleet.targetCoords.join(':')}]`,
        body: `Your fleet has harvested ${formatNumber(metalHarvested)} Metal and ${formatNumber(crystalHarvested)} Crystal from the debris field at [${fleet.targetCoords.join(':')}]. They are now returning home.`,
        type: 'harvest',
        data: { target: fleet.targetCoords, resources: { metal: metalHarvested, crystal: crystalHarvested } }
    });
}

async function executeAttack(leadAttackerPlayer, leadFleet, allPlayers) {
    // 1. Find all fleets arriving at the same target at roughly the same time (ACS)
    // Window: 1 second
    const TIME_WINDOW = 1000;
    const targetCoordsStr = leadFleet.targetCoords.join(':');

    const alliedFleets = [];
    const defendingFleets = [];

    for (const p of allPlayers) {
        if (!p.fleets) continue;
        for (const f of p.fleets) {
            if (f.targetCoords.join(':') === targetCoordsStr && Math.abs(f.arrivalTime - leadFleet.arrivalTime) <= TIME_WINDOW && !f.returning && !f.processedAtWS) {
                if (f.missionType === MISSION_TYPES.ATTACK || f.missionType === MISSION_TYPES.GROUP_ATTACK) {
                    alliedFleets.push({ player: p, fleet: f });
                    f.processedAtWS = true; // Mark so we don't process them again in the same tick loop
                } else if (f.missionType === MISSION_TYPES.STATION) {
                    defendingFleets.push({ player: p, fleet: f });
                    f.processedAtWS = true;
                }
            }
        }
    }

    // Find target planet and owner
    let targetPlanet = null;
    let targetPlayer = null;
    let isGhost = false;

    for (const p of allPlayers) {
        const planet = p.planets.find(pl => pl.coordinates.join(':') === targetCoordsStr);
        if (planet) {
            targetPlanet = planet;
            targetPlayer = p;
            break;
        }
    }

    // Check for ghost planet if no player planet found
    if (!targetPlanet) {
        const galaxy = await getGalaxyData();
        if (galaxy.ghostPlanets?.[targetCoordsStr]) {
            targetPlanet = galaxy.ghostPlanets[targetCoordsStr];
            const techLevel = (targetPlanet.tier || 1) * 3;
            targetPlayer = {
                userId: 'GHOST',
                username: 'Ancient Remnants',
                research: {
                    weaponsTech: techLevel,
                    shieldingTech: techLevel,
                    armorTech: techLevel,
                    espionageTech: techLevel
                }
            };
            isGhost = true;
        }
    }

    if (!targetPlanet) {
        for (const af of alliedFleets) {
            await addMessage(af.player.userId, {
                from: 'Fleet Command',
                subject: `Attack Mission Failed: [${targetCoordsStr}]`,
                body: `Our fleet reached [${targetCoordsStr}] but found no planet to attack. They are returning home.`,
                type: 'attack'
            });
        }
        return;
    }

    // 2. Prepare Combat Data for all participants
    const attackers = alliedFleets.map(af => ({
        id: af.fleet.id,
        username: af.player.username,
        ships: af.fleet.ships,
        research: af.player.research || {}
    }));

    const defenders = [
        {
            id: targetPlanet.id || targetPlayer.userId,
            username: targetPlayer.username,
            ships: targetPlanet.ships || {},
            defenses: targetPlanet.defenses || {},
            research: targetPlayer.research || {}
        },
        ...defendingFleets.map(df => ({
            id: df.fleet.id,
            username: df.player.username,
            ships: df.fleet.ships,
            research: df.player.research || {}
        }))
    ];

    // 3. Simulate Group Combat
    const combatReport = simulateGroupCombat(attackers, defenders);

    // Log the event
    await logEvent('COMBAT', { 
        coords: leadFleet.targetCoords, 
        attacker: leadAttackerPlayer.username, 
        defender: targetPlayer.username,
        winner: combatReport.winner
    });

    // 4. Apply Losses
    // Update Target Planet
    const targetReportDef = combatReport.defenders.find(d => d.id === (targetPlanet.id || targetPlayer.userId));
    targetPlanet.ships = targetReportDef.survivingShips;
    targetPlanet.defenses = targetReportDef.survivingDefenses;

    // Update Attacking Fleets
    const now = Date.now();
    for (const af of alliedFleets) {
        const reportAtk = combatReport.attackers.find(a => a.id === af.fleet.id);
        af.fleet.ships = reportAtk.survivingShips;

        // If not the lead fleet (which is handled by the caller), we need to set its return state here
        if (af.fleet.id !== leadFleet.id) {
            const distance = calculateDistance(af.fleet.originCoords, af.fleet.targetCoords);
            let slowestSpeed = Infinity;
            for (const shipKey in af.fleet.ships) {
                const speed = calculateShipSpeed(shipKey, af.player.research);
                if (speed < slowestSpeed) slowestSpeed = speed;
            }
            const travelTime = calculateTravelTime(distance, slowestSpeed, getFleetSpeedMultiplier(), af.fleet.speedPercent || 1.0);

            af.fleet.returning = true;
            af.fleet.startTime = now;
            af.fleet.arrivalTime = now + (travelTime * 1000);

            // Swap coords
            const origin = [...af.fleet.originCoords];
            af.fleet.originCoords = [...af.fleet.targetCoords];
            af.fleet.targetCoords = origin;
            af.fleet.processedAt = now; // Prevent further processing in this tick
        }
    }

    // Update Stationary Defending Fleets
    for (const df of defendingFleets) {
        const reportDef = combatReport.defenders.find(d => d.id === df.fleet.id);
        df.fleet.ships = reportDef.survivingShips;

        // Stationary fleets stay at the planet or return? 
        // In this game, STATION (deployment) is permanent, but ACS defend might return.
        // If MISSION_TYPES.STATION is used for temporary defense, it should return.
        // Assuming STATION fleets should return home after combat.
        const distance = calculateDistance(df.fleet.originCoords, df.fleet.targetCoords);
        let slowestSpeed = Infinity;
        for (const shipKey in df.fleet.ships) {
            const speed = calculateShipSpeed(shipKey, df.player.research);
            if (speed < slowestSpeed) slowestSpeed = speed;
        }
        const travelTime = calculateTravelTime(distance, slowestSpeed, getFleetSpeedMultiplier(), df.fleet.speedPercent || 1.0);

        df.fleet.returning = true;
        df.fleet.startTime = now;
        df.fleet.arrivalTime = now + (travelTime * 1000);

        const origin = [...df.fleet.originCoords];
        df.fleet.originCoords = [...df.fleet.targetCoords];
        df.fleet.targetCoords = origin;
        df.fleet.processedAt = now;
    }

    // 5. Handle Looting (Only for attackers)
    let totalLoot = { metal: 0, crystal: 0, deuterium: 0, water: 0, food: 0 };
    const totalCargoCapacity = alliedFleets.reduce((sum, af) => sum + calculateCargoCapacity(af.fleet.ships), 0);

    if (totalCargoCapacity > 0 && combatReport.winner === 'attacker') {
        const availableLoot = {};
        for (const res in targetPlanet.resources) {
            if (['metal', 'crystal', 'deuterium', 'water', 'food'].includes(res)) {
                availableLoot[res] = Math.floor((targetPlanet.resources[res] || 0) * 0.5);
            }
        }

        let totalAvailableLoot = 0;
        for (const k in availableLoot) totalAvailableLoot += availableLoot[k];

        if (totalAvailableLoot > 0) {
            const ratio = Math.min(1, totalCargoCapacity / totalAvailableLoot);
            for (const res in availableLoot) {
                const amount = Math.floor(availableLoot[res] * ratio);
                totalLoot[res] = amount;
                targetPlanet.resources[res] -= amount;

                // Distribute loot proportionally to remaining cargo capacity
                alliedFleets.forEach(af => {
                    const cap = calculateCargoCapacity(af.fleet.ships);
                    const share = Math.floor(amount * (cap / totalCargoCapacity));
                    af.fleet.resources[res] = (af.fleet.resources[res] || 0) + share;
                });
            }
            wsManager.sendToUser(targetPlayer.userId, 'RESOURCES_UPDATED', { planetId: targetPlanet.id });
        }
    }

    // 6. Update Debris Field
    if (combatReport.debris.metal > 0 || combatReport.debris.crystal > 0) {
        const galaxy = await getGalaxyData();
        const existingDebris = galaxy.debrisFields?.[targetCoordsStr] || { metal: 0, crystal: 0 };
        await updateDebrisField(leadFleet.targetCoords, {
            metal: existingDebris.metal + combatReport.debris.metal,
            crystal: existingDebris.crystal + combatReport.debris.crystal
        });
    }

    // 7. Send Messages to all participants
    const reportId = generateId();
    const summary = `Winner: ${combatReport.winner.toUpperCase()} | Loot: M:${formatNumber(totalLoot.metal)} C:${formatNumber(totalLoot.crystal)}`;

    // To Attackers
    for (const af of alliedFleets) {
        const myLoot = {
            metal: af.fleet.resources.metal || 0,
            crystal: af.fleet.resources.crystal || 0,
            deuterium: af.fleet.resources.deuterium || 0,
            water: af.fleet.resources.water || 0,
            food: af.fleet.resources.food || 0
        };
        await addMessage(af.player.userId, {
            from: 'Combat Command',
            subject: `ACS Combat Report: [${targetCoordsStr}]`,
            body: `Our coalition engaged the enemy at [${targetCoordsStr}]. ${summary}`,
            type: 'attack',
            data: { ...combatReport, loot: myLoot, reportId, isAttacker: true, targetCoords: leadFleet.targetCoords }
        });
    }

    // To Defenders
    const defendersAll = [{ player: targetPlayer, isOwner: true }, ...defendingFleets.map(df => ({ player: df.player, isOwner: false }))];
    for (const def of defendersAll) {
        await addMessage(def.player.userId, {
            from: 'Planetary Defense',
            subject: `ACS Defense Report: [${targetCoordsStr}]`,
            body: `A coalition of attackers engaged our forces at [${targetCoordsStr}]. ${summary}`,
            type: 'attack',
            data: { ...combatReport, reportId, isAttacker: false, targetCoords: leadFleet.targetCoords }
        });
    }

    // If ghost planet was attacked, update or remove it
    if (isGhost) {
        let totalRemainingResources = 0;
        for (const k in targetPlanet.resources) totalRemainingResources += targetPlanet.resources[k];

        let totalRemainingUnits = 0;
        for (const k in targetPlanet.ships) totalRemainingUnits += targetPlanet.ships[k];
        for (const k in targetPlanet.defenses) totalRemainingUnits += targetPlanet.defenses[k];

        if (totalRemainingUnits === 0 && totalRemainingResources < 1000) {
            // Completely wiped and looted
            await updateGhostPlanet(leadFleet.targetCoords, null);
        } else {
            await updateGhostPlanet(leadFleet.targetCoords, targetPlanet);
        }
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

        // Notify player of resource change
        wsManager.sendToUser(player.userId, 'RESOURCES_UPDATED', { planetId: targetPlanet.id });

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

        // Notify target player of resource change
        wsManager.sendToUser(targetPlayer.userId, 'RESOURCES_UPDATED', { planetId: targetPlanet.id });

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
    let isGhost = false;

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

    // Check for ghost planet if no player planet found
    if (!targetPlanet) {
        const galaxy = await getGalaxyData();
        const targetCoordsStr = fleet.targetCoords.join(':');
        if (galaxy.ghostPlanets?.[targetCoordsStr]) {
            targetPlanet = galaxy.ghostPlanets[targetCoordsStr];
            const techLevel = (targetPlanet.tier || 1) * 3;
            targetPlayer = { userId: 'GHOST', username: 'Ancient Remnants', research: { espionageTech: techLevel } };
            isGhost = true;
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
        power: espionagePower.toFixed(2),
        isGhost: isGhost
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

                if (!isGhost) {
                    await addMessage(targetPlayer.userId, {
                        from: 'Planetary Defense',
                        subject: `FOREIGN SPY DETECTED: [${targetPlanet.coordinates?.join(':') || fleet.targetCoords.join(':')}]`,
                        body: `An espionage fleet from ${player.username} was detected and neutralized.`,
                        type: 'attack',
                        data: { ...combatReport, isAttacker: false, targetCoords: targetPlanet.coordinates || fleet.targetCoords }
                    });
                }
                return; // Mission ends here
            } else {
                // Probes survived but were detected
                if (!isGhost) {
                    await addMessage(targetPlayer.userId, {
                        from: 'Planetary Defense',
                        subject: `FOREIGN SPY DETECTED: [${targetPlanet.coordinates?.join(':') || fleet.targetCoords.join(':')}]`,
                        body: `An espionage fleet from ${player.username} was detected but some probes escaped.`,
                        type: 'attack',
                        data: { ...combatReport, isAttacker: false, targetCoords: targetPlanet.coordinates || fleet.targetCoords }
                    });
                }
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

        // If it's a ghost, we might want to update it if it took damage
        if (isGhost) {
            await updateGhostPlanet(fleet.targetCoords, targetPlanet);
        }
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
    // Check max planets limit
    const maxPlanets = calculateMaxPlanets(player.research);
    
    if (player.planets.length >= maxPlanets) {
        await addMessage(player.userId, {
            from: 'Colonial Command',
            subject: 'Colonization Failed: Administrative Limit',
            body: `Your empire has reached its current administrative limit of ${maxPlanets} planets. Research more Astrophysics to expand further.`,
            type: 'colonization',
            data: { target: fleet.targetCoords }
        });
        return false; // Fleet returns home
    }

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
    
    // Apply colonist capacity bonus: base 10 + (base 10 * bonus * level)
    const colonistBonus = getResearchBonus(player.research, 'unitColonistCapacity');
    const startingPopulation = Math.floor(10 * (1 + colonistBonus));

    const newPlanet = {
        id: planetId,
        name: 'Colony',
        coordinates: [...fleet.targetCoords],
        resources: { 
            metal: 500, crystal: 500, deuterium: 0, energy: 0, 
            water: 1000, food: 1000, population: startingPopulation 
        },
        buildings: { ...STARTING_BUILDINGS }, // Small subset usually but let's use starting for now
        production: { metal: 30, crystal: 15, deuterium: 0, energy: 0, water: 40, food: 30 },
        storage: { metal: 10000, crystal: 10000, deuterium: 10000, water: 10000, food: 10000 },
        maxPopulation: 100,
        ships: {},
        defenses: {},
        lastUpdate: Date.now()
    };

    player.planets.push(newPlanet);
    // Log the event
    await logEvent('COLONY', { 
        coords: [...fleet.targetCoords], 
        username: player.username,
        planetId
    });
    // Notify client of new planet and changed resources
    wsManager.sendToUser(player.userId, 'RESOURCES_UPDATED', { planetId: planetId });

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
    let destroyed = false;

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

        const shipTypesPresent = Object.keys(fleet.ships).filter(k => fleet.ships[k] > 0);
        if (shipTypesPresent.length > 0) {
            // Apply a random loss percentage (10-50%) to ALL ship types in the fleet
            const lossPercent = 0.1 + (Math.random() * 0.4);
            const lostShipNames = [];
            
            for (const shipKey of shipTypesPresent) {
                const lostCount = Math.ceil(fleet.ships[shipKey] * lossPercent);
                if (lostCount > 0) {
                    fleet.ships[shipKey] -= lostCount;
                    const shipName = SHIP_DEFINITIONS[shipKey]?.name || shipKey.replace(/([A-Z])/g, ' $1').trim();
                    lostShipNames.push(`${formatNumber(lostCount)}x ${shipName}`);
                }
            }
            
            body = `Your fleet entered a gravity well of a dark star. Structural integrity failed across multiple vessels. You lost: ${lostShipNames.join(', ')}.`;
            
            if (isEmpty(fleet.ships)) {
                body += " The entire fleet was pulverized by the gravitational forces.";
                destroyed = true;
            }
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
    } else if (roll < 0.55) {
        // Found ships - Scales with fleet value
        resultType = 'ships';
        subject = 'Expedition: New Ships Found';

        // Find a ship type that is roughly affordable with the reward scale
        const affordableShips = Object.keys(SHIP_DEFINITIONS).filter(k => {
            const s = SHIP_DEFINITIONS[k];
            const cost = (s.baseCost.metal || 0) + (s.baseCost.crystal || 0) + (s.baseCost.deuterium || 0);
            return cost < rewardScale;
        });

        if (affordableShips.length > 0) {
            const foundShipKey = affordableShips[Math.floor(Math.random() * affordableShips.length)];
            const shipDef = SHIP_DEFINITIONS[foundShipKey];
            const shipCost = (shipDef.baseCost.metal || 0) + (shipDef.baseCost.crystal || 0) + (shipDef.baseCost.deuterium || 0);
            const foundCount = Math.max(1, Math.floor(rewardScale / shipCost * (0.2 + Math.random() * 0.5)));

            fleet.ships[foundShipKey] = (fleet.ships[foundShipKey] || 0) + foundCount;
            body = `Your fleet found some abandoned ${shipDef.name.toLowerCase()}s drifting in space. They have been integrated into your fleet. (${foundCount} ships found)`;
        } else {
            body = `Your explorers found some tech debris, but were unable to recover any functional ships.`;
        }
    } else if (roll < 0.65) {
        // Hostile Alien Encounter (Combat)
        resultType = 'combat';
        subject = 'Expedition: Xeno-Fleet Contact!';
        
        // Generate Alien Fleet based on player fleet value
        const alienFleet = {};
        const alienStrength = fleetValue * (0.3 + Math.random() * 0.5); // 30-80% of player strength
        
        const alienTypes = Object.keys(ALIEN_SHIPS);
        let remainingStrength = alienStrength;
        
        // Simple generation: start from biggest ships
        for (let i = alienTypes.length - 1; i >= 0; i--) {
            const type = alienTypes[i];
            const def = ALIEN_SHIPS[type];
            // Estimate value for scaling (similar to player ships)
            const estValue = (def.attack * 10) + (def.shield * 20) + (def.hull / 2);
            
            if (remainingStrength > estValue) {
                const count = Math.floor(remainingStrength / estValue * (0.4 + Math.random() * 0.4));
                if (count > 0) {
                    alienFleet[type] = count;
                    remainingStrength -= count * estValue;
                }
            }
        }
        
        // Ensure at least some scouts if empty
        if (isEmpty(alienFleet)) alienFleet.alienScout = 5;

        const attackerData = { 
            ships: { ...fleet.ships }, 
            research: player.research || {},
            username: player.username 
        };
        const defenderData = { 
            ships: alienFleet, 
            research: { weaponsTech: 5, shieldingTech: 5, armorTech: 5 }, // Aliens have decent tech
            username: 'Unknown Xeno-Fleet'
        };

        const combatReport = simulateCombat(attackerData, defenderData);
        
        // Apply losses to player fleet
        fleet.ships = combatReport.survivingAttackerShips;

        // Update Debris Field at Position 16
        if (combatReport.debris.metal > 0 || combatReport.debris.crystal > 0) {
            const targetCoordsStr = fleet.targetCoords.join(':');
            const galaxyData = await getGalaxyData();
            const existingDebris = galaxyData.debrisFields?.[targetCoordsStr] || { metal: 0, crystal: 0 };
            await updateDebrisField(fleet.targetCoords, {
                metal: existingDebris.metal + combatReport.debris.metal,
                crystal: existingDebris.crystal + combatReport.debris.crystal
            });
        }
        
        if (isEmpty(fleet.ships)) {
            body = `Your fleet was intercepted by a massive Xeno-fleet. After a desperate struggle, the last transmission from your commander was cut short. The entire fleet has been lost.`;
            destroyed = true;
        } else {
            const victory = combatReport.winner === 'attacker';
            body = victory 
                ? `Our fleet was attacked by hostile alien vessels! We managed to repel the attackers and continue our journey, though we suffered some losses.`
                : `We encountered a superior alien force and were forced to retreat after a heavy engagement.`;
        }
        
        // Store report for the message
        const reportId = generateId();
        await addMessage(player.userId, {
            from: 'Fleet Command',
            subject,
            body,
            type: 'attack',
            data: { ...combatReport, reportId, isAttacker: true, targetCoords: fleet.targetCoords }
        });
        return destroyed; // Return whether fleet was wiped
    } else if (roll < 0.75) {
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

    return destroyed;
}

/**
 * Handle resource exchange at Galactic Market Hub
 */
async function executeMarketTrade(player, fleet) {
    if (!fleet.buyResources) {
        return;
    }

    const rates = { metal: 1, crystal: 1.5, deuterium: 3 }; // Value in metal units
    let sellValue = 0;
    let buyValue = 0;

    // Calculate value of resources brought to sell
    for (const res in fleet.resources) {
        sellValue += (fleet.resources[res] || 0) * (rates[res] || 1);
    }

    // Calculate value of resources requested to buy
    for (const res in fleet.buyResources) {
        buyValue += (fleet.buyResources[res] || 0) * (rates[res] || 1);
    }

    // Verification: Cannot buy more than you sold
    if (buyValue > sellValue + 0.1) {
        await addMessage(player.userId, {
            from: 'Galactic Market Hub',
            subject: `TRADE REJECTED: [${fleet.originCoords.join(':')}]`,
            body: `Your trade request was rejected due to insufficient credit value. Resources are being returned.`,
            type: 'market'
        });
        return;
    }

    // Execute exchange
    const oldResources = { ...fleet.resources };

    // Update only the traded resources, preserve water/food
    const tradedKeys = ['metal', 'crystal', 'deuterium'];
    tradedKeys.forEach(res => {
        fleet.resources[res] = fleet.buyResources[res] || 0;
    });

    // Notify client of resource change
    wsManager.sendToUser(player.userId, 'RESOURCES_UPDATED', {});

    // Verify coordinates exist for the report
    const traderCoords = fleet.targetCoords ? `[${fleet.targetCoords.join(':')}]` : 'Deep Space Station';
    
    // Construct informative message body
    const soldList = Object.entries(oldResources)
        .filter(([_, qty]) => qty > 0)
        .map(([res, qty]) => `${formatNumber(qty)} ${res.toUpperCase()}`)
        .join(', ');
        
    const boughtList = Object.entries(fleet.buyResources)
        .filter(([_, qty]) => qty > 0)
        .map(([res, qty]) => `${formatNumber(qty)} ${res.toUpperCase()}`)
        .join(', ');

    await addMessage(player.userId, {
        from: 'Galactic Market Hub',
        subject: `TRADE CONFIRMED: ${traderCoords}`,
        body: `Exchange successful at ${traderCoords}.\n\nSold: ${soldList}\nBought: ${boughtList}\n\nYour fleet is returning with the requested commodities.`,
        type: 'market',
        data: { sold: oldResources, bought: fleet.buyResources, target: fleet.targetCoords }
    });
}
