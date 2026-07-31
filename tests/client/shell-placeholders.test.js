import { expect, it } from 'bun:test';
import { readFile } from 'node:fs/promises';

it('does not advertise implemented views as coming soon', async () => {
  const html = await readFile(new URL('../../src/client/index.html', import.meta.url), 'utf8');
  expect(html).not.toContain('coming soon');
});
