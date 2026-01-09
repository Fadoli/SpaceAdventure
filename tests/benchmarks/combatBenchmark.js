/**
 * Combat Engine Benchmark
 * Measures the duration of combat resolution for large-scale battles.
 */
import { simulateCombat } from '../../src/server/game/combatEngine.js';
import { formatNumber } from '../../src/shared/utils.js';

function runBenchmark() {
  console.log('--- Combat Engine Benchmark ---');

  // Define "Mega" fleets (Approx 2M units)
  const attacker = {
    ships: {
      lightFighter: 5000000,
      cruiser: 1000000,
      battleship: 500000,
      destroyer: 200000
    },
    research: { weaponsTech: 18, shieldingTech: 18, armorTech: 18 }
  };

  const defender = {
    ships: {
      lightFighter: 4000000,
      heavyFighter: 1000000,
      cruiser: 500000,
      battleship: 200000
    },
    defenses: {
      rocketLauncher: 5000000,
      laserCannon: 2000000,
      plasmaTurret: 100000,
      ionCannon: 500000
    },
    research: { weaponsTech: 18, shieldingTech: 18, armorTech: 18 }
  };

  const attackerUnitCount = Object.values(attacker.ships).reduce((a, b) => a + b, 0);
  const defenderUnitCount = Object.values(defender.ships).reduce((a, b) => a + b, 0) + 
                           Object.values(defender.defenses).reduce((a, b) => a + b, 0);

  console.log(`Attacker units: ${formatNumber(attackerUnitCount)}`);
  console.log(`Defender units: ${formatNumber(defenderUnitCount)}`);
  console.log(`Total units involved: ${formatNumber(attackerUnitCount + defenderUnitCount)}`);
  console.log('Resolving combat...');

  const startTime = performance.now();
  const report = simulateCombat(attacker, defender);
  const endTime = performance.now();

  const duration = endTime - startTime;

  console.log('\n--- Results ---');
  console.log(`Winner: ${report.winner.toUpperCase()}`);
  console.log(`Rounds: ${report.rounds.length}`);
  console.log(`Duration: ${duration.toFixed(2)}ms`);
  console.log(`Avg time per round: ${(duration / report.rounds.length).toFixed(2)}ms`);
  
  if (duration > 0) {
    const unitsPerSecond = (attackerUnitCount + defenderUnitCount) / (duration / 1000);
    console.log(`Throughput: ~${formatNumber(Math.floor(unitsPerSecond))} units processed per second`);
  }

  // Brief loss summary
  const attackerLosses = Object.values(report.attackerLosses).reduce((a, b) => a + b, 0);
  const defenderShipLosses = Object.values(report.defenderLosses.ships).reduce((a, b) => a + b, 0);
  const defenderDefLosses = Object.values(report.defenderLosses.defenses).reduce((a, b) => a + b, 0);

  console.log(`\nAttacker lost ${formatNumber(attackerLosses)} ships.`);
  console.log(`Defender lost ${formatNumber(defenderShipLosses)} ships and ${formatNumber(defenderDefLosses)} defenses.`);
  console.log(`Debris Field: M:${formatNumber(report.debris.metal)} C:${formatNumber(report.debris.crystal)}`);
}

runBenchmark();
