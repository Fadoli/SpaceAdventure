import { expect, it } from 'bun:test';
import { normalizeEventLimit } from '../../src/server/storage/eventLogger.js';

it('bounds event-log reads to a safe page size', () => {
  expect(normalizeEventLimit(-1)).toBe(1);
  expect(normalizeEventLimit(1_000)).toBe(100);
  expect(normalizeEventLimit(Number.NaN)).toBe(100);
});
