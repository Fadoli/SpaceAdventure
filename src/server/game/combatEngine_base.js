// Combat Engine - Handles space battles between fleets and planetary defenses
import { SHIPS } from '../../shared/ships.js';
import { DEFENSES } from '../../shared/defenses.js';
import { THEORETICAL_RESEARCH } from '../../shared/research.js';

/**
 * Execute a combat simulation between an attacker and a defender
 * @param {Object} attacker - { ships, research }
 * @param {Object} defender - { ships, defenses, research }
 * @returns {Object} Combat report
 */
export function simulateCombat(attacker, defender) {
  const report = {
    rounds: [],
    winner: null, // 'attacker', 'defender', or 'draw'
    attackerLosses: {},
    defenderLosses: {},
    debris: { metal: 0, crystal: 0 },
    lootedResources: { metal: 0, crystal: 0, deuterium: 0, water: 0, food: 0 }
  };

  // 1. Prepare combat units
  let attackerUnits = prepareUnits(attacker.ships || {}, attacker.research || {}, true);
  let defenderUnits = prepareUnits(defender.ships || {}, defender.research || {}, false, defender.defenses || {});

  const initialAttackerValue = calculateUnitsValue(attackerUnits);
  const initialDefenderValue = calculateUnitsValue(defenderUnits);

  // 2. Combat Rounds (max 6)
  for (let round = 1; round <= 6; round++) {
    if (attackerUnits.length === 0 || defenderUnits.length === 0) break;

    // SHIELDS REGENERATE at the start of each round
    regenerateShields(attackerUnits);
    regenerateShields(defenderUnits);

    const roundData = {
      round,
      attackerShotCount: attackerUnits.length,
      defenderShotCount: defenderUnits.length,
      attackerDamage: 0,
      defenderDamage: 0
    };

    // Calculate total damage for this round
    const attackerPower = attackerUnits.reduce((sum, u) => sum + u.attack, 0);
    const defenderPower = defenderUnits.reduce((sum, u) => sum + u.attack, 0);
    
    roundData.attackerDamage = attackerPower;
    roundData.defenderDamage = defenderPower;

    // Apply damage (simplified OGame-like: units target random enemies)
    applyCombatDamage(attackerUnits, defenderUnits);
    
    // Cleanup destroyed units
    attackerUnits = attackerUnits.filter(u => u.currentHull > 0);
    defenderUnits = defenderUnits.filter(u => u.currentHull > 0);

    report.rounds.push(roundData);
    
    if (attackerUnits.length === 0 || defenderUnits.length === 0) break;
  }

  // 3. Determine Winner
  if (attackerUnits.length > 0 && defenderUnits.length === 0) {
    report.winner = 'attacker';
  } else if (defenderUnits.length > 0 && attackerUnits.length === 0) {
    report.winner = 'defender';
  } else {
    report.winner = 'draw';
  }

  // 4. Calculate Losses and Debris
  const finalAttackerValue = calculateUnitsValue(attackerUnits);
  const finalDefenderValue = calculateUnitsValue(defenderUnits);
  
  report.attackerLosses = calculateLosses(attacker.ships || {}, attackerUnits);
  report.defenderLosses = {
    ships: calculateLosses(defender.ships || {}, defenderUnits.filter(u => u.isShip)),
    defenses: calculateLosses(defender.defenses || {}, defenderUnits.filter(u => !u.isShip))
  };

  // Debris: 30% of lost ship costs (metal/crystal only)
  const attackerLossValue = initialAttackerValue - finalAttackerValue;
  const defenderLossValue = initialDefenderValue - finalDefenderValue;
  
  // Simplified debris
  report.debris.metal = Math.floor((attackerLossValue + defenderLossValue) * 0.3 * 0.7);
  report.debris.crystal = Math.floor((attackerLossValue + defenderLossValue) * 0.3 * 0.3);

  // 5. Consolidate final surviving ships for returning
  report.survivingAttackerShips = consolidateUnits(attackerUnits);
  report.survivingDefenderShips = consolidateUnits(defenderUnits.filter(u => u.isShip));
  report.survivingDefenderDefenses = consolidateUnits(defenderUnits.filter(u => !u.isShip));

  return report;
}

function regenerateShields(units) {
  units.forEach(u => {
    u.currentShield = u.maxShield;
  });
}

function applyCombatDamage(attackers, defenders) {
  // Each unit shoots once at a random target, with potential rapid fire
  attackers.forEach(u => {
    shootWithRapidFire(u, defenders);
  });

  defenders.forEach(u => {
    shootWithRapidFire(u, attackers);
  });
}

function shootWithRapidFire(unit, targets) {
  if (targets.length === 0) return;

  let continueShooting = true;
  while (continueShooting) {
    continueShooting = false;
    const targetIndex = Math.floor(Math.random() * targets.length);
    const target = targets[targetIndex];
    
    // Shoot
    // Damage is first absorbed by shields
    let damage = unit.attack;
    
    if (damage > 0) {
      if (target.currentShield > 0) {
        if (damage >= target.currentShield) {
          damage -= target.currentShield;
          target.currentShield = 0;
        } else {
          target.currentShield -= damage;
          damage = 0;
        }
      }
      
      // Remaining damage goes to hull
      if (damage > 0) {
        target.currentHull -= damage;
      }
    }

    // Check for Rapid Fire
    if (unit.rapidFire && unit.rapidFire[target.key]) {
      const rfValue = unit.rapidFire[target.key];
      const chance = 1 - (1 / rfValue);
      if (Math.random() < chance) {
        continueShooting = true;
      }
    }
  }
}

function prepareUnits(ships, research, isAttacker, defenses = {}) {
  const units = [];
  
  // Apply research bonuses
  const attackBonus = 1 + (research.weaponsTech || 0) * (THEORETICAL_RESEARCH.weaponsTech.bonuses.unitAttackPower || 0.1);
  const shieldBonus = 1 + (research.shieldingTech || 0) * (THEORETICAL_RESEARCH.shieldingTech.bonuses.unitShieldStrength || 0.1);
  const hullBonus = 1 + (research.armorTech || 0) * (THEORETICAL_RESEARCH.armorTech.bonuses.unitHullStrength || 0.1);

  // Add Ships
  for (const shipKey in ships) {
    const count = ships[shipKey];
    const def = SHIPS[shipKey];
    if (!def) continue;
    
    for (let i = 0; i < count; i++) {
      units.push({
        key: shipKey,
        isShip: true,
        attack: def.attack * attackBonus,
        maxShield: def.shield * shieldBonus,
        currentShield: def.shield * shieldBonus,
        maxHull: def.hull * hullBonus,
        currentHull: def.hull * hullBonus,
        baseCost: def.baseCost,
        rapidFire: def.rapidFire || {}
      });
    }
  }

  // Add Defenses
  for (const defKey in defenses) {
    const count = defenses[defKey];
    const def = DEFENSES[defKey];
    if (!def) continue;
    
    for (let i = 0; i < count; i++) {
      units.push({
        key: defKey,
        isShip: false,
        attack: def.attack * attackBonus,
        maxShield: def.shield * shieldBonus,
        currentShield: def.shield * shieldBonus,
        maxHull: def.hull * hullBonus,
        currentHull: def.hull * hullBonus,
        baseCost: def.baseCost,
        rapidFire: def.rapidFire || {}
      });
    }
  }

  return units;
}

function calculateUnitsValue(units) {
  return units.reduce((sum, u) => {
    return sum + (u.baseCost.metal + u.baseCost.crystal + u.baseCost.deuterium);
  }, 0);
}

function calculateLosses(originalCounts, survivingUnits, isShipGroup = true) {
  const losses = {};
  const survivors = consolidateUnits(survivingUnits);
  
  for (const key in originalCounts) {
    const lost = originalCounts[key] - (survivors[key] || 0);
    if (lost > 0) losses[key] = lost;
  }
  return losses;
}

function consolidateUnits(units) {
  const counts = {};
  units.forEach(u => {
    counts[u.key] = (counts[u.key] || 0) + 1;
  });
  return counts;
}
