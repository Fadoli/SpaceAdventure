import { expect, it } from 'bun:test';
import { cancelBuilding, validateBlueprintName, validateBuildingAllocation, validateBuildingType } from '../../src/server/game/buildings.js';

it('normalizes bounded blueprint names', () => {
  expect(validateBlueprintName('  Efficient Mine  ')).toBe('Efficient Mine');
  for (const name of [null, {}, '', '   ', 'x'.repeat(41)]) {
    expect(() => validateBlueprintName(name)).toThrow();
  }
});

it('accepts only declared building type keys', () => {
  expect(validateBuildingType('metalMine')).toBeDefined();
  for (const buildingType of ['__proto__', 'constructor', 'toString', 'missing']) {
    expect(() => validateBuildingType(buildingType)).toThrow('Invalid building type');
  }
});

it('validates building allocations without changing planet state', () => {
  const planet = { buildings: { metalMine: 1 }, buildingAllocations: { metalMine: { power: 1, population: 1, priority: 3 } } };
  const before = structuredClone(planet);
  const invalid = [
    ['metalMine', { power: '1', population: 1, priority: 3 }],
    ['metalMine', { power: Number.NaN, population: 1, priority: 3 }],
    ['metalMine', { power: 1, population: -1, priority: 3 }],
    ['metalMine', { power: 1, population: 1, priority: 4 }],
    ['__proto__', { power: 1, population: 1, priority: 3 }]
  ];

  for (const [buildingType, allocation] of invalid) {
    expect(() => validateBuildingAllocation(planet, buildingType, allocation)).toThrow();
  }
  expect(planet).toEqual(before);
  expect(validateBuildingAllocation(planet, 'metalMine', { power: 0, population: 2 })).toEqual({ power: 0, population: 2, priority: 3 });
  expect(validateBuildingAllocation(planet, 'metalMine', { power: 0.01, population: 1 })).toEqual({ power: 0.01, population: 1, priority: 3 });
});

it('rejects malformed building queue positions before loading player state', async () => {
  for (const position of [0, -1, 1.5, Number.NaN, '1']) {
    await expect(cancelBuilding('missing', 'missing', position)).rejects.toThrow('Invalid queue position');
  }
});
