import { describe, expect, it } from 'bun:test';
import { buildDefenses, buildShips } from '../../src/server/game/shipyard.js';

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

  it('schedules each shipyard queue in order', () => {
    const planet = makePlanet();
    buildShips(planet, null, { smallCargo: 1 }, 1);
    buildShips(planet, null, { smallCargo: 1 }, 1);
    buildDefenses(planet, null, { rocketLauncher: 1 }, 1);
    buildDefenses(planet, null, { rocketLauncher: 1 }, 1);

    expect(planet.shipQueue[1].startTime).toBe(planet.shipQueue[0].finishTime);
    expect(planet.defenseQueue[1].startTime).toBe(planet.defenseQueue[0].finishTime);
  });
});
