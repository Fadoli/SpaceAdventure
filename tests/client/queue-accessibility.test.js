import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';

it('keeps persistent queue toggles keyboard accessible', async () => {
  const [buildings, research] = await Promise.all([
    readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/research.js', import.meta.url), 'utf8')
  ]);

  for (const source of [buildings, research]) {
    expect(source).toContain('role="button" tabindex="0" aria-expanded=');
    expect(source).toContain("event.key === 'Enter' || event.key === ' '");
  }
  expect(buildings).toContain('aria-controls="build-queue-items"');
  expect(research).toContain('aria-controls="theoretical-research-queue"');
  expect(research).toContain('aria-controls="practical-research-queue"');
});
