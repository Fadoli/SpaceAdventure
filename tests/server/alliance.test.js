import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';
import { createAlliance, createPlannedAttack, getAllianceById, sendAllianceMessage, shareBlueprint } from '../../src/server/game/alliance.js';

it('rejects inherited alliance and blueprint keys', async () => {
  expect(await getAllianceById('__proto__')).toBeNull();
  await expect(shareBlueprint('user', '__proto__', 'blueprint', 'building', 'alliance')).rejects.toThrow('Invalid building type');
});

it('rejects malformed alliance text before storage', async () => {
  await expect(createAlliance('user', {}, 'TAG')).rejects.toThrow('Alliance name must be text');
  await expect(createAlliance('user', '   ', 'TAG')).rejects.toThrow('Alliance name must be 3-30 characters');
  await expect(sendAllianceMessage('user', 'alliance', {})).rejects.toThrow('Message content cannot be empty');
});

it('rejects oversized alliance messages before storage', async () => {
  await expect(sendAllianceMessage('user', 'alliance', 'x'.repeat(501))).rejects.toThrow('cannot exceed 500 characters');
});

it('rejects invalid planned-attack targets before storage', async () => {
  await expect(createPlannedAttack('user', 'alliance', 'planet', [1, 500, 1]))
    .rejects.toThrow('Invalid target coordinates');
});

it('leaves group-launch deductions to sendFleet', async () => {
  const source = await readFile(new URL('../../src/server/game/alliance.js', import.meta.url), 'utf8');

  expect(source).not.toContain('hostPlanet.ships[shipKey] -= hostShips[shipKey]');
});
