import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';

it('escapes dynamic errors written through HTML sinks', async () => {
  const files = ['admin.js', 'views/shipyard.js', 'views/research.js', 'views/messages.js'];
  const sources = await Promise.all(files.map(file =>
    readFile(new URL(`../../src/client/js/${file}`, import.meta.url), 'utf8')
  ));

  for (const source of sources) {
    const errorSinkLines = source.split('\n').filter(line =>
      line.includes('innerHTML') && line.includes('${') && /\.(?:message|error)/.test(line)
    );
    expect(errorSinkLines.length).toBeGreaterThan(0);
    expect(errorSinkLines.every(line => line.includes('escapeHtml('))).toBe(true);
  }
});
