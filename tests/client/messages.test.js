import { describe, expect, it } from 'bun:test';

globalThis.window = globalThis.window || {};

const { linkifyCoords } = await import('../../src/client/js/views/messages.js');

describe('message rendering', () => {
  it('escapes stored HTML while preserving coordinate links', () => {
    const html = linkifyCoords('<img src=x onerror=alert(1)> at [2:42:7]');

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).not.toContain('<img');
    expect(html).toContain('window.navigateToCoords(2, 42, 7)');
  });
});
