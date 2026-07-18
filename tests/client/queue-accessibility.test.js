import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';

it('keeps persistent queue toggles keyboard accessible', async () => {
  const [buildings, research, shipyard, overview, fleetMovements] = await Promise.all([
    readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/research.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/overview.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/fleetMovements.js', import.meta.url), 'utf8')
  ]);

  for (const source of [buildings, research]) {
    expect(source).toContain('role="button" tabindex="0" aria-expanded=');
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
  }
  expect(buildings).toContain('aria-controls="build-queue-items"');
  expect(research).toContain('aria-controls="theoretical-research-queue"');
  expect(research).toContain('aria-controls="practical-research-queue"');
  expect(shipyard.match(/role="button" tabindex="0" aria-expanded=/g)).toHaveLength(3);
  expect(overview).toContain('role="button" tabindex="0" onclick="window.selectPlanet');
  expect(overview).toContain('${escapeHtml(planet.name)}');
  expect(fleetMovements).toContain('<button type="button" class="clickable-coord"');
  expect(shipyard).toContain("const queueType = item.defenses ? 'defenses' : 'ships'");
  expect(shipyard).toContain('window.cancelShipyardBuild(\'${item.id}\', \'${queueType}\')');
  expect(shipyard).toContain('const isActive = item.queuePosition === 1');
  expect(shipyard).not.toContain('const index = allQueue.indexOf(item)');
});

it('keeps focus visible on every keyboard target', async () => {
  const base = await readFile(new URL('../../src/client/css/base.css', import.meta.url), 'utf8');

  expect(base).toMatch(/:focus-visible\s*\{[^}]*outline: 2px solid var\(--accent-blue\) !important;/s);
});

it('announces notifications without reading decorative icons', async () => {
  const notifications = await readFile(new URL('../../src/client/js/notifications.js', import.meta.url), 'utf8');

  expect(notifications).toContain("notification.setAttribute('role', type === 'error' ? 'alert' : 'status')");
  expect(notifications).toContain('class="notification-icon" aria-hidden="true"');
});
