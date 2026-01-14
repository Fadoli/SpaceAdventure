// Combat Engine - Optimized Stack-Based Statistical Simulation
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { THEORETICAL_RESEARCH } from '../../shared/research.js';
import { isEmpty } from '../../shared/utils.js';
import { CONFIG } from '../../shared/constants.js';

/**
 * Execute a combat simulation between multiple attackers and multiple defenders
 * Optimized for large scale battles using statistical stacks.
 * 
 * @param {Array} attackers - Array of { ships, research, id, username }
 * @param {Array} defenders - Array of { ships, defenses, research, id, username }
 */
export function simulateGroupCombat(attackers, defenders) {
  const report = {
    rounds: [],
    winner: null,
    attackers: attackers.map(a => ({ id: a.id, username: a.username, initialShips: { ...a.ships }, losses: {}, survivingShips: {} })),
    defenders: defenders.map(d => ({ id: d.id, username: d.username, initialShips: { ...d.ships }, initialDefenses: { ...d.defenses }, losses: { ships: {}, defenses: {} }, survivingShips: {}, survivingDefenses: {} })),
    debris: { metal: 0, crystal: 0 },
    lootedResources: { metal: 0, crystal: 0, deuterium: 0, water: 0, food: 0 }
  };

  // 1. Prepare unit stacks
  let attackerGroups = [];
  attackers.forEach(attacker => {
    attackerGroups.push(...prepareGroups(attacker.ships || {}, attacker.research || {}, {}, attacker.id));
  });

  let defenderGroups = [];
  defenders.forEach(defender => {
    defenderGroups.push(...prepareGroups(defender.ships || {}, defender.research || {}, defender.defenses || {}, defender.id));
  });

  const initialAttackerValue = calculateGroupsValue(attackerGroups);
  const initialDefenderValue = calculateGroupsValue(defenderGroups);

  // 2. Combat Rounds (max 6)
  for (let round = 1; round <= 6; round++) {
    const attackerCount = getTotalCount(attackerGroups);
    const defenderCount = getTotalCount(defenderGroups);

    if (attackerCount === 0 || defenderCount === 0) break;

    const roundData = {
      round,
      attackerShotCount: 0,
      defenderShotCount: 0,
      attackerDamage: 0,
      defenderDamage: 0
    };

    // Calculate shots and damage for this round
    const attackerActions = resolveRoundShots(attackerGroups, defenderGroups);
    const defenderActions = resolveRoundShots(defenderGroups, attackerGroups);

    roundData.attackerShotCount = Math.floor(attackerActions.totalShots);
    roundData.defenderShotCount = Math.floor(defenderActions.totalShots);
    roundData.attackerDamage = Math.floor(attackerActions.totalDamage);
    roundData.defenderDamage = Math.floor(defenderActions.totalDamage);

    // Apply damage to stacks
    applyGroupDamage(defenderGroups, attackerActions);
    applyGroupDamage(attackerGroups, defenderActions);

    // Cleanup destroyed groups
    attackerGroups = attackerGroups.filter(g => g.count > 0);
    defenderGroups = defenderGroups.filter(g => g.count > 0);

    report.rounds.push(roundData);
    
    if (attackerGroups.length === 0 || defenderGroups.length === 0) break;
  }

  // 3. Determine Winner
  const finalAttackerCount = getTotalCount(attackerGroups);
  const finalDefenderCount = getTotalCount(defenderGroups);

  if (finalAttackerCount > 0 && finalDefenderCount === 0) {
    report.winner = 'attacker';
  } else if (finalDefenderCount > 0 && finalAttackerCount === 0) {
    report.winner = 'defender';
  } else {
    report.winner = 'draw';
  }

  // 4. Calculate Losses per participant and Debris
  const repairChance = CONFIG.DEFENSE_REPAIR_CHANCE || 0.7;

  // Process Attackers
  report.attackers.forEach(a => {
    const participantGroups = attackerGroups.filter(g => g.participantId === a.id);
    a.survivingShips = consolidateGroups(participantGroups);
    a.losses = calculateGroupLosses(a.initialShips, participantGroups);
  });

  // Process Defenders
  report.defenders.forEach(d => {
    const participantShipGroups = defenderGroups.filter(g => g.participantId === d.id && g.isShip);
    const participantDefGroups = defenderGroups.filter(g => g.participantId === d.id && !g.isShip);
    
    const rawShipLosses = calculateGroupLosses(d.initialShips, participantShipGroups);
    const rawDefLosses = calculateGroupLosses(d.initialDefenses, participantDefGroups);

    // Defense Repair
    const repairedDefenses = {};
    for (const defKey in rawDefLosses) {
      const repairedCount = Math.floor(rawDefLosses[defKey] * repairChance);
      if (repairedCount > 0) repairedDefenses[defKey] = repairedCount;
    }

    d.survivingShips = consolidateGroups(participantShipGroups);
    d.survivingDefenses = consolidateGroups(participantDefGroups);
    // Add repaired defenses back to surviving
    for (const defKey in repairedDefenses) {
      d.survivingDefenses[defKey] = (d.survivingDefenses[defKey] || 0) + repairedDefenses[defKey];
    }

    d.losses = {
      ships: rawShipLosses,
      defenses: {}
    };
    for (const defKey in rawDefLosses) {
      const lost = rawDefLosses[defKey] - (repairedDefenses[defKey] || 0);
      if (lost > 0) d.losses.defenses[defKey] = lost;
    }
  });

  // Calculate Debris (Consolidated)
  const debris = { metal: 0, crystal: 0 };
  const addDebris = (losses, definitions, ratio) => {
    for (const key in losses) {
      const def = definitions[key];
      if (def && def.baseCost) {
        debris.metal += Math.floor((def.baseCost.metal || 0) * losses[key] * ratio);
        debris.crystal += Math.floor((def.baseCost.crystal || 0) * losses[key] * ratio);
      }
    }
  };

  report.attackers.forEach(a => addDebris(a.losses, SHIPS, CONFIG.DEBRIS_PERCENTAGE));
  report.defenders.forEach(d => {
    addDebris(d.losses.ships, SHIPS, CONFIG.DEBRIS_PERCENTAGE);
    addDebris(d.losses.defenses, DEFENSES, CONFIG.DEFENSE_TO_DEBRIS_CHANCE);
  });

  report.debris = debris;

  // 5. Consolidated summaries for backward compatibility
  report.attackerLosses = {};
  report.defenderLosses = { ships: {}, defenses: {} };
  report.survivingAttackerShips = {};
  report.survivingDefenderShips = {};
  report.survivingDefenderDefenses = {};

  report.attackers.forEach(a => {
    for (const k in a.losses) report.attackerLosses[k] = (report.attackerLosses[k] || 0) + a.losses[k];
    for (const k in a.survivingShips) report.survivingAttackerShips[k] = (report.survivingAttackerShips[k] || 0) + a.survivingShips[k];
  });
  report.defenders.forEach(d => {
    for (const k in d.losses.ships) report.defenderLosses.ships[k] = (report.defenderLosses.ships[k] || 0) + d.losses.ships[k];
    for (const k in d.losses.defenses) report.defenderLosses.defenses[k] = (report.defenderLosses.defenses[k] || 0) + d.losses.defenses[k];
    for (const k in d.survivingShips) report.survivingDefenderShips[k] = (report.survivingDefenderShips[k] || 0) + d.survivingShips[k];
    for (const k in d.survivingDefenses) report.survivingDefenderDefenses[k] = (report.survivingDefenderDefenses[k] || 0) + d.survivingDefenses[k];
  });

  return report;
}

/**
 * Legacy wrapper for single vs single combat
 */
export function simulateCombat(attacker, defender) {
  return simulateGroupCombat(
    [{ ...attacker, id: attacker.id || 'attacker', username: attacker.username || 'Attacker' }],
    [{ ...defender, id: defender.id || 'defender', username: defender.username || 'Defender' }]
  );
}

function calculateLossValue(losses, definitions) {
  let value = 0;
  for (const key in losses) {
    const count = losses[key];
    const def = definitions[key];
    if (def && def.baseCost) {
      value += (def.baseCost.metal + def.baseCost.crystal) * count;
    }
  }
  return value;
}

function prepareGroups(ships, research, defenses = {}, participantId = null) {
  const groups = [];
  
  const attackBonus = 1 + (research.weaponsTech || 0) * (THEORETICAL_RESEARCH.weaponsTech.bonuses.unitAttackPower || 0.1);
  const shieldBonus = 1 + (research.shieldingTech || 0) * (THEORETICAL_RESEARCH.shieldingTech.bonuses.unitShieldStrength || 0.1);
  const hullBonus = 1 + (research.armorTech || 0) * (THEORETICAL_RESEARCH.armorTech.bonuses.unitHullStrength || 0.1);

  for (const shipKey in ships) {
    const count = ships[shipKey];
    if (count <= 0) continue;
    const def = SHIPS[shipKey];
    if (!def) continue;
    
    groups.push({
      key: shipKey,
      participantId,
      isShip: true,
      count: count,
      initialCount: count,
      attack: def.attack * attackBonus,
      shield: def.shield * shieldBonus,
      hull: def.hull * hullBonus,
      baseCost: def.baseCost,
      rapidFire: def.rapidFire || {}
    });
  }

  for (const defKey in defenses) {
    const count = defenses[defKey];
    if (count <= 0) continue;
    const def = DEFENSES[defKey];
    if (!def) continue;
    
    groups.push({
      key: defKey,
      participantId,
      isShip: false,
      count: count,
      initialCount: count,
      attack: def.attack * attackBonus,
      shield: def.shield * shieldBonus,
      hull: def.hull * hullBonus,
      baseCost: def.baseCost,
      rapidFire: def.rapidFire || {}
    });
  }

  return groups;
}

function resolveRoundShots(shooterGroups, targetGroups) {
  const targetTotal = targetGroups.reduce((sum, g) => sum + g.count, 0);
  const shotDistribution = []; // [{ targetGroup, shots, power }]
  let totalShots = 0;
  let totalDamage = 0;

  if (targetTotal === 0) return { totalShots: 0, totalDamage: 0, shotDistribution: [] };

  shooterGroups.forEach(sGroup => {
    // 1. Calculate continuation probability (P_cont)
    let pCont = 0;
    targetGroups.forEach(tGroup => {
      const pHit = tGroup.count / targetTotal;
      const rfValue = sGroup.rapidFire[tGroup.key] || 1;
      const pContinueForType = rfValue > 1 ? (1 - 1 / rfValue) : 0;
      pCont += pHit * pContinueForType;
    });

    // 2. Total expected shots from this group (Geometric Series)
    const shotsPerUnit = 1 / (1 - Math.min(0.999, pCont));
    const groupShots = sGroup.count * shotsPerUnit;
    totalShots += groupShots;

    // 3. Distribute shots across target groups
    targetGroups.forEach(tGroup => {
      const shotsToType = groupShots * (tGroup.count / targetTotal);
      if (shotsToType > 0) {
        shotDistribution.push({
          targetGroup: tGroup,
          shots: shotsToType,
          power: sGroup.attack
        });
        totalDamage += shotsToType * sGroup.attack;
      }
    });
  });

  return { totalShots, totalDamage, shotDistribution };
}

function applyGroupDamage(targetGroups, actions) {
  const totalTargets = getTotalCount(targetGroups);
  const S = actions.totalShots;
  const p = 1 / Math.max(1, totalTargets);

  targetGroups.forEach(tGroup => {
    const hits = actions.shotDistribution.filter(d => d.targetGroup === tGroup);
    if (hits.length === 0 || tGroup.count <= 0) return;

    const totalShotsOnGroup = hits.reduce((sum, h) => sum + h.shots, 0);
    const avgPower = hits.reduce((sum, h) => sum + h.shots * h.power, 0) / totalShotsOnGroup;
    
    let expectedDamagePerUnit = 0;
    
    if (totalTargets === 1) {
      // Special case: Only one unit/group exists on this side.
      // Every shot fired at this side must hit a unit in this group.
      expectedDamagePerUnit = Math.min(tGroup.hull, Math.max(0, S * avgPower - tGroup.shield));
    } else if (S > 100) {
      // Use Poisson approximation for high shot counts to avoid large power calculations
      const k = S * p;
      if (k > 20) {
        expectedDamagePerUnit = Math.min(tGroup.hull, Math.max(0, k * avgPower - tGroup.shield));
      } else {
        let p_n = Math.exp(-k);
        for (let n = 1; n < 100; n++) {
          p_n = (p_n * k) / n;
          const damage_n = Math.min(tGroup.hull, Math.max(0, n * avgPower - tGroup.shield));
          expectedDamagePerUnit += p_n * damage_n;
          if (p_n < 1e-9) break;
        }
      }
    } else {
      // Use exact Binomial distribution for small number of shots
      let p_n = Math.pow(1 - p, S); // P(0 hits)
      for (let n = 1; n <= S; n++) {
        // P(n) = P(n-1) * (S-n+1)/n * p/(1-p)
        p_n = p_n * (S - n + 1) / n * (p / (1 - p));
        const damage_n = Math.min(tGroup.hull, Math.max(0, n * avgPower - tGroup.shield));
        expectedDamagePerUnit += p_n * damage_n;
        if (p_n < 1e-9) break;
      }
    }

    const expectedUnitsLost = (tGroup.count * expectedDamagePerUnit) / tGroup.hull;
    let unitsLost = Math.floor(expectedUnitsLost);
    const fractionalLoss = expectedUnitsLost - unitsLost;
    
    // Stochastic rounding for the fractional unit loss
    if (fractionalLoss > 0 && Math.random() < fractionalLoss) {
      unitsLost += 1;
    }

    tGroup.count = Math.max(0, tGroup.count - unitsLost);
  });
}

function calculateGroupsValue(groups) {
  return groups.reduce((sum, g) => {
    return sum + (g.baseCost.metal + g.baseCost.crystal + g.baseCost.deuterium) * g.count;
  }, 0);
}

function getTotalCount(groups) {
  return groups.reduce((sum, g) => sum + g.count, 0);
}

function calculateGroupLosses(originalCounts, survivingGroups) {
  const losses = {};
  const survivors = consolidateGroups(survivingGroups);
  
  for (const key in originalCounts) {
    const lost = originalCounts[key] - (survivors[key] || 0);
    if (lost > 0) losses[key] = lost;
  }
  return losses;
}

function consolidateGroups(groups) {
  const counts = {};
  groups.forEach(g => {
    counts[g.key] = (counts[g.key] || 0) + g.count;
  });
  return counts;
}
