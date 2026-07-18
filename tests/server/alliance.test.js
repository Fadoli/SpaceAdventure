import { expect, it } from 'bun:test';
import { sendAllianceMessage } from '../../src/server/game/alliance.js';

it('rejects oversized alliance messages before storage', async () => {
  await expect(sendAllianceMessage('user', 'alliance', 'x'.repeat(501))).rejects.toThrow('cannot exceed 500 characters');
});
