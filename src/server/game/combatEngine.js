// Combat Engine - Optimized Stack-Based Statistical Simulation
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { THEORETICAL_RESEARCH } from '../../shared/research.js';
import { isEmpty } from '../../shared/utils.js';

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
    applyGroupDamage(defenderGroups, attackerActions.shotDistribution);
    applyGroupDamage(attackerGroups, defenderActions.shotDistribution);

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
  report.defenderLosses = {
    ships: calculateGroupLosses(defender.ships || {}, defenderGroups.filter(g => g.isShip)),
    defenses: calculateGroupLosses(defender.defenses || {}, defenderGroups.filter(g => !g.isShip))
  };

  const finalAttackerValue = calculateGroupsValue(attackerGroups);
  const finalDefenderValue = calculateGroupsValue(defenderGroups);
  
  const attackerLossValue = initialAttackerValue - finalAttackerValue;
  const defenderLossValue = initialDefenderValue - finalDefenderValue;
  
  report.debris.metal = Math.floor((attackerLossValue + defenderLossValue) * 0.3 * 0.7);
  report.debris.crystal = Math.floor((attackerLossValue + defenderLossValue) * 0.3 * 0.3);

  // 5. Consolidate survivors
  report.survivingAttackerShips = consolidateGroups(attackerGroups);
  report.survivingDefenderShips = consolidateGroups(defenderGroups.filter(g => g.isShip));
  report.survivingDefenderDefenses = consolidateGroups(defenderGroups.filter(g => !g.isShip));

  return report;
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

  shooterGroups.forEach(sGroup => {
    // 1. Calculate continuation probability (P_cont)
    // P_cont = Sum( Chance_to_hit_type_j * Chance_to_continue_after_hitting_j )
    let pCont = 0;
    targetGroups.forEach(tGroup => {
      const pHit = tGroup.count / targetTotal;
      const rfValue = sGroup.rapidFire[tGroup.key] || 1;
      const pContinueForType = rfValue > 1 ? (1 - 1 / rfValue) : 0;
      pCont += pHit * pContinueForType;
    });

    // 2. Total expected shots from this group
    // Expected shots per unit = 1 / (1 - P_cont)
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

function applyGroupDamage(groups, shotDistribution) {
  // Reset group damage for this round (shields regenerate)
  groups.forEach(g => { g.roundDamage = 0; });

  // Accumulate damage to each group
  shotDistribution.forEach(dist => {
    const damagePerShot = Math.max(0, dist.power - dist.targetGroup.shield);
    dist.targetGroup.roundDamage += dist.shots * damagePerShot;
  });

  // Calculate losses
  groups.forEach(g => {
    const lost = Math.floor(g.roundDamage / g.hull);
    g.count = Math.max(0, g.count - lost);
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