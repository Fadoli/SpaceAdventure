import { expect, it } from 'bun:test';
import { applyAdminAssetUpdate } from '../../src/server/adminAssets.js';

function makePlayer() {
  return {
    research: { energyTech: 1 },
    planets: [{
      id: 'planet',
      ships: { smallCargo: 2 },
      defenses: { rocketLauncher: 3 },
      resources: { metal: 100, crystal: 50, deuterium: 0, energy: 0, water: 0, food: 0, population: 10 },
      buildings: { metalMine: 1 }
    }]
  };
}

it('applies validated admin asset updates atomically', () => {
  const player = makePlayer();
  const result = applyAdminAssetUpdate(player, {
    planetId: 'planet', mode: 'ADD', ships: { smallCargo: -5 }, resources: { metal: 25 }, research: { energyTech: 2 }
  });

  expect(result.planet.id).toBe('planet');
  expect(player.planets[0].ships.smallCargo).toBe(0);
  expect(player.planets[0].resources.metal).toBe(125);
  expect(player.research.energyTech).toBe(3);
});

it('rejects malformed admin updates without changing state', () => {
  for (const changes of [
    { planetId: 'planet', mode: 'SET', ships: JSON.parse('{"__proto__":1}') },
    { planetId: 'planet', mode: 'SET', ships: { smallCargo: 4 }, resources: { metal: 1.5 } },
    { planetId: 'planet', mode: 'SET', resources: { metal: 1.5 } },
    { planetId: 'planet', mode: 'UNKNOWN', buildings: { metalMine: 2 } },
    { mode: 'SET', buildings: { metalMine: 2 } }
  ]) {
    const player = makePlayer();
    const before = structuredClone(player);
    expect(() => applyAdminAssetUpdate(player, changes)).toThrow();
    expect(player).toEqual(before);
  }
});
