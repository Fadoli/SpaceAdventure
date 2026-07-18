import { describe, it, expect, beforeEach, afterAll, mock } from 'bun:test';

let users = [];
let updateQueue = Promise.resolve();

mock.module('../../src/server/storage/storage.js', () => ({
  readJsonFile: async () => ({ users }),
  writeJsonFile: async (_filename, data) => {
    users = data.users || users;
    return true;
  },
  updateJsonFile: (_filename, updater) => {
    const next = updateQueue.then(async () => {
      const updated = await updater({ users });
      users = updated.users;
      return true;
    });
    updateQueue = next.catch(() => {});
    return next;
  }
}));

const { authenticateUser, findUserByUsername, registerUser } = await import('../../src/server/auth/auth.js');

afterAll(() => mock.restore());

describe('Authentication validation', () => {
  beforeEach(() => {
    users = [];
    updateQueue = Promise.resolve();
  });

  it('handles missing usernames without throwing a type error', async () => {
    expect(await findUserByUsername(undefined)).toBeUndefined();
    expect(registerUser(undefined, 'a'.repeat(64))).rejects.toThrow('Username must be 3-20 characters');
  });

  it('rejects malformed password hashes before authentication', async () => {
    expect(registerUser('player', 'z'.repeat(64))).rejects.toThrow('Invalid password format');
    expect(authenticateUser('player', 'not-a-hash')).rejects.toThrow('Invalid credentials');
  });

  it('rejects malformed optional email values', async () => {
    expect(registerUser('player', 'a'.repeat(64), 'not-an-email')).rejects.toThrow('Invalid email address');
    expect(registerUser('player', 'a'.repeat(64), { address: 'x@example.com' })).rejects.toThrow('Invalid email address');
  });

  it('allows only one concurrent registration per username', async () => {
    const attempts = await Promise.allSettled([
      registerUser('player', 'a'.repeat(64)),
      registerUser('PLAYER', 'b'.repeat(64))
    ]);

    expect(attempts.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(result => result.status === 'rejected')).toHaveLength(1);
    expect(users).toHaveLength(1);
  });
});
