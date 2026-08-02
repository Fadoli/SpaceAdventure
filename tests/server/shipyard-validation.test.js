import { describe, expect, it } from 'bun:test';
import { buildDefenses, buildShips, cancelProduction, getShipyardDetails } from '../../src/server/game/shipyard.js';
import { calculateShipCost } from '../../src/shared/ships.js';
import { calculateDefenseCost } from '../../src/shared/defenses.js';
import { BUILDINGS } from '../../src/shared/buildings.js';

function makePlanet() {
  return {
    id: 'planet-1',
    resources: { metal: 100_000, crystal: 100_000, deuterium: 100_000 },
    shipQueue: [],
    defenseQueue: []
  };
}

describe('shipyard order validation', () => {
  it('rejects invalid orders before changing resources or queues', () => {
    const planet = makePlanet();
    const resources = { ...planet.resources };

    expect(() => buildShips(planet, null, { smallCargo: Number.NaN }, 1)).toThrow('ship quantity must be a positive integer');
    expect(() => buildShips(planet, null, { smallCargo: 1.5 }, 1)).toThrow('ship quantity must be a positive integer');
    expect(() => buildShips(planet, null, {}, 1)).toThrow('No ship selected');
    expect(() => buildDefenses(planet, null, { rocketLauncher: -1 }, 1)).toThrow('defense quantity must be a positive integer');

    expect(planet.resources).toEqual(resources);
    expect(planet.shipQueue).toEqual([]);
    expect(planet.defenseQueue).toEqual([]);
  });

  it('still accepts valid integer orders', () => {
    const planet = makePlanet();
    buildShips(planet, null, { smallCargo: 1 }, 1);
    buildDefenses(planet, null, { rocketLauncher: 1 }, 1);
    expect(planet.shipQueue).toHaveLength(1);
    expect(planet.defenseQueue).toHaveLength(1);
  });

  it('applies shipyard blueprints to ship and defense production time', () => {
    const baseShips = makePlanet();
    const blueprintShips = makePlanet();
    blueprintShips.activeVariants = { shipyard: 'optimized' };
    blueprintShips.localBlueprints = {
      shipyard: {
        customDefinition: { ...BUILDINGS.shipyard, timeMultiplier: 0.5 }
      }
    };

    const baseShipOrder = buildShips(baseShips, null, { smallCargo: 1 }, 1);
    const blueprintShipOrder = buildShips(blueprintShips, null, { smallCargo: 1 }, 1);

    const baseDefenses = makePlanet();
    const blueprintDefenses = makePlanet();
    blueprintDefenses.activeVariants = { shipyard: 'optimized' };
    blueprintDefenses.localBlueprints = {
      shipyard: {
        customDefinition: { ...BUILDINGS.shipyard, timeMultiplier: 0.5 }
      }
    };

    const baseDefenseOrder = buildDefenses(baseDefenses, null, { rocketLauncher: 1 }, 1);
    const blueprintDefenseOrder = buildDefenses(blueprintDefenses, null, { rocketLauncher: 1 }, 1);

    expect(blueprintShipOrder.buildTime).toBeLessThan(baseShipOrder.buildTime);
    expect(blueprintDefenseOrder.buildTime).toBeLessThan(baseDefenseOrder.buildTime);
  });

  it('charges research-reduced costs for ships and defenses', () => {
    const planet = makePlanet();
    const player = { userId: 'player-1', research: { resourceEfficiency: 10 } };
    const shipCost = calculateShipCost('smallCargo', 1, 0.05);
    const defenseCost = calculateDefenseCost('rocketLauncher', 1, 0.05);

    buildShips(planet, player, { smallCargo: 1 }, 1);
    buildDefenses(planet, player, { rocketLauncher: 1 }, 1);

    expect(planet.resources.metal).toBe(100_000 - shipCost.metal - defenseCost.metal);
    expect(planet.resources.crystal).toBe(100_000 - shipCost.crystal - defenseCost.crystal);
    expect(planet.resources.deuterium).toBe(100_000 - shipCost.deuterium - defenseCost.deuterium);
  });

  it('refunds the discounted amount actually paid when cancelling', () => {
    const planet = makePlanet();
    const player = { userId: 'player-1', research: { resourceEfficiency: 10 } };
    const charged = calculateShipCost('smallCargo', 1, 0.05);

    buildShips(planet, player, { smallCargo: 1 }, 1);
    const beforeCancel = { ...planet.resources };
    cancelProduction(planet, planet.shipQueue[0].id, 'ships');

    expect(planet.resources.metal).toBe(beforeCancel.metal + Math.floor(charged.metal * 0.9));
    expect(planet.resources.crystal).toBe(beforeCancel.crystal + Math.floor(charged.crystal * 0.9));
    expect(planet.resources.deuterium).toBe(beforeCancel.deuterium + Math.floor(charged.deuterium * 0.9));
  });

  it('exposes the research time reduction used by production estimates', () => {
    const planet = { id: 'planet-1', buildings: { shipyard: 1 } };
    const player = { research: { modularConstruction: 10 } };

    expect(getShipyardDetails(planet, player).timeReductionBonus).toBeGreaterThan(0);
  });

  it('schedules each shipyard queue in order', () => {
    const planet = makePlanet();
    buildShips(planet, null, { smallCargo: 1 }, 1);
    buildShips(planet, null, { smallCargo: 1 }, 1);
    buildDefenses(planet, null, { rocketLauncher: 1 }, 1);
    buildDefenses(planet, null, { rocketLauncher: 1 }, 1);

    expect(planet.shipQueue[1].startTime).toBe(planet.shipQueue[0].finishTime);
    expect(planet.defenseQueue[1].startTime).toBe(planet.defenseQueue[0].finishTime);
  });

  it('rejects an invalid queue type without cancelling either queue', () => {
    const planet = makePlanet();
    planet.shipQueue.push({ id: 'ship-order' });
    planet.defenseQueue.push({ id: 'defense-order' });

    expect(() => cancelProduction(planet, 'defense-order', 'other')).toThrow('Invalid production type');
    expect(planet.shipQueue).toHaveLength(1);
    expect(planet.defenseQueue).toHaveLength(1);
  });

  it('moves later orders forward after cancellation', () => {
    const planet = makePlanet();
    buildShips(planet, null, { smallCargo: 1 }, 1);
    buildShips(planet, null, { smallCargo: 1 }, 1);
    const queued = planet.shipQueue[1];
    const originalStart = queued.startTime;
    const duration = queued.finishTime - queued.startTime;

    cancelProduction(planet, planet.shipQueue[0].id, 'ships');

    expect(planet.shipQueue[0].startTime).toBeLessThan(originalStart);
    expect(planet.shipQueue[0].finishTime - planet.shipQueue[0].startTime).toBe(duration);
  });
});
