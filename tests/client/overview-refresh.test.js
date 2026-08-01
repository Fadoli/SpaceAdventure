import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';

it('includes skeleton-owned planet identity in the empire refresh key', async () => {
  const source = await readFile(new URL('../../src/client/js/views/overview.js', import.meta.url), 'utf8');

  expect(source).toContain('gameState.planets.map(p => [p.id, p.name, p.coordinates])');
  expect(source).toContain('container.dataset.planetStructure = planetStructure');
  expect(source).not.toContain('container.dataset.planetIds');
});

it('forces a fresh state after allocation changes', async () => {
  const source = await readFile(new URL('../../src/client/js/views/allocation.js', import.meta.url), 'utf8');
  expect(source).toContain('await window.loadGameState(true)');
});
