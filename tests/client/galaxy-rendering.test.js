import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';

globalThis.window = {
  currentGalaxy: 1,
  currentSystem: 1,
  getCurrentPlanet: () => null
};

const { renderOGameTableRow } = await import('../../src/client/js/views/galaxy.js');
const { renderPlanetFleetContent } = await import('../../src/client/js/views/fleet.js');

it('escapes player-controlled galaxy fields outside executable handlers', () => {
  const html = renderOGameTableRow({
    playerType: 'player',
    playerId: 'user-1',
    player: `O'Reilly <img src=x onerror=alert(1)>`,
    planetName: '<script>alert(1)</script>',
    allianceTag: '<b>TAG</b>',
    activity: 'active'
  }, 2, false);

  expect(html).toContain('data-player-id="user-1"');
  expect(html).toContain('data-username="O&#39;Reilly &lt;img src=x onerror=alert(1)&gt;"');
  expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(html).toContain('&lt;b&gt;TAG&lt;/b&gt;');
  expect(html).not.toContain('<img');
  expect(html).not.toContain('<script>');
  expect(html).not.toContain("openRelationMenu(event, '");
});

it('escapes renamed planets in the fleet overview', () => {
  const html = renderPlanetFleetContent({
    planetName: '<img src=x onerror=alert(1)>',
    ships: {},
    defenses: {}
  });

  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img');
});

it('keeps galaxy 10 reachable from manual navigation', async () => {
  const source = await readFile(new URL('../../src/client/js/views/galaxy.js', import.meta.url), 'utf8');

  expect(source).toContain('Math.min(10, val)');
  expect(source).not.toContain('Math.min(9, val)');
});
