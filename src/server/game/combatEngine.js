// Combat Engine - Optimized Stack-Based Statistical Simulation
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { THEORETICAL_RESEARCH } from '../../shared/research.js';
import { isEmpty } from '../../shared/utils.js';
import { CONFIG } from '../../shared/constants.js';

/**
 * Execute a combat simulation between an attacker and a defender
 * Optimized for large scale battles using statistical stacks.
 */
export function simulateCombat(attacker, defender) {
  const report = {
    rounds: [],
    winner: null,
    attackerLosses: {},
    defenderLosses: {},
    debris: { metal: 0, crystal: 0 },
    lootedResources: { metal: 0, crystal: 0, deuterium: 0, water: 0, food: 0 }
  };

  // 1. Prepare unit stacks
  let attackerGroups = prepareGroups(attacker.ships || {}, attacker.research || {});
  let defenderGroups = prepareGroups(defender.ships || {}, defender.research || {}, defender.defenses || {});

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

  // 4. Calculate Losses and Debris
  report.attackerLosses = calculateGroupLosses(attacker.ships || {}, attackerGroups);
  
  // RAW defender losses (before repair)
  const rawDefenderShipLosses = calculateGroupLosses(defender.ships || {}, defenderGroups.filter(g => g.isShip));
  const rawDefenderDefLosses = calculateGroupLosses(defender.defenses || {}, defenderGroups.filter(g => !g.isShip));

  // Apply Defense Repair
  const repairedDefenses = {};
  const repairChance = CONFIG.DEFENSE_REPAIR_CHANCE || 0.7;
  for (const defKey in rawDefenderDefLosses) {
    const lostCount = rawDefenderDefLosses[defKey];
    const repairedCount = Math.floor(lostCount * repairChance);
    if (repairedCount > 0) {
      repairedDefenses[defKey] = repairedCount;
    }
  }

  // Defender losses for the report are the ones NOT repaired
  report.defenderLosses = {
    ships: rawDefenderShipLosses,
    defenses: {}
  };
  for (const defKey in rawDefenderDefLosses) {
    const lost = rawDefenderDefLosses[defKey] - (repairedDefenses[defKey] || 0);
    if (lost > 0) report.defenderLosses.defenses[defKey] = lost;
  }

  // Calculate Debris
  // Ships: Standard debris (30% of metal/crystal)
  // Defenses: scales on (1 - repair%) * defense_to_debris_chance
  const debrisShipsValue = calculateLossValue(report.attackerLosses, SHIPS) + 
                           calculateLossValue(report.defenderLosses.ships, SHIPS);
  
  const defenseToDebrisChance = CONFIG.DEFENSE_TO_DEBRIS_CHANCE || 0.1;
  const debrisDefensesValue = calculateLossValue(report.defenderLosses.defenses, DEFENSES) * defenseToDebrisChance;

  const totalDebrisValue = debrisShipsValue + debrisDefensesValue;
  
  report.debris.metal = Math.floor(totalDebrisValue * 0.3 * 0.7); // Simplified distribution
  report.debris.crystal = Math.floor(totalDebrisValue * 0.3 * 0.3);

  // 5. Consolidate survivors (including repaired defenses)
  report.survivingAttackerShips = consolidateGroups(attackerGroups);
  report.survivingDefenderShips = consolidateGroups(defenderGroups.filter(g => g.isShip));
  
  const survivingDefenses = consolidateGroups(defenderGroups.filter(g => !g.isShip));
  for (const defKey in repairedDefenses) {
    survivingDefenses[defKey] = (survivingDefenses[defKey] || 0) + repairedDefenses[defKey];
  }
  report.survivingDefenderDefenses = survivingDefenses;

  return report;
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

function prepareGroups(ships, research, defenses = {}) {
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
  targetGroups.forEach(tGroup => {
    const hits = actions.shotDistribution.filter(d => d.targetGroup === tGroup);
    if (hits.length === 0 || tGroup.count <= 0) return;

    const totalShotsOnGroup = hits.reduce((sum, h) => sum + h.shots, 0);
    const avgPower = hits.reduce((sum, h) => sum + h.shots * h.power, 0) / totalShotsOnGroup;
    
    // Average hits per unit
    const k = totalShotsOnGroup / tGroup.count;
    
    // Expected damage per unit based on Poisson distribution of hits
    // Rule: Shield is a buffer for the entire round.
    // Damage(n hits) = max(0, n*Power - Shield)
    // We also cap damage at Hull integrity to properly model overkill.
    
    let expectedDamagePerUnit = 0;
    if (k > 20) {
      // High density: use mean value approximation
      // Expected damage ~ max(0, E[hits]*Power - Shield)
      expectedDamagePerUnit = Math.min(tGroup.hull, Math.max(0, k * avgPower - tGroup.shield));
    } else {
      // Low density: sum Poisson terms for accuracy
      let p_n = Math.exp(-k); // P(hits = 0)
      for (let n = 1; n < 50; n++) {
        p_n = (p_n * k) / n; // P(hits = n)
        const damage_n = Math.min(tGroup.hull, Math.max(0, n * avgPower - tGroup.shield));
        expectedDamagePerUnit += p_n * damage_n;
        if (p_n < 1e-7) break;
      }
    }

    const unitsLost = Math.floor((tGroup.count * expectedDamagePerUnit) / tGroup.hull);
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
