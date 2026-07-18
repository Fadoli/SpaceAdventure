import { afterAll, describe, it, expect } from 'bun:test';
import { unlink } from 'fs/promises';
import { resolve } from 'path';
import { readJsonFile, updateJsonFile, writeJsonFile } from '../../src/server/storage/storage.js';

const filename = `test-storage-${crypto.randomUUID()}.json`;
const filepath = resolve('data', filename);

afterAll(async () => {
  await Promise.allSettled([
    unlink(filepath),
    unlink(`${filepath}.backup`),
    unlink(`${filepath}.tmp`)
  ]);
});

describe('JSON storage', () => {
  it('serializes concurrent writes to one file', async () => {
    const payloads = Array.from({ length: 10 }, (_, id) => ({ id, value: 'x'.repeat(10_000) }));
    const results = await Promise.all(payloads.map(payload => writeJsonFile(filename, payload)));
    const stored = await readJsonFile(filename);

    expect(results.every(Boolean)).toBe(true);
    expect(payloads.some(payload => payload.id === stored.id && payload.value === stored.value)).toBe(true);
  });

  it('serializes read-modify-write updates', async () => {
    await writeJsonFile(filename, { count: 0 });
    await Promise.all(Array.from({ length: 10 }, () =>
      updateJsonFile(filename, data => ({ count: data.count + 1 }))
    ));

    expect(await readJsonFile(filename)).toEqual({ count: 10 });
  });
});
