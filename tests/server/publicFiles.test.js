import { describe, expect, it } from 'bun:test';
import { canServeDuringStartup, getPublicFilePath, getStaticCacheHeaders, isStaticFileNotModified } from '../../src/server/publicFiles.js';

describe('public file boundary', () => {
  it('serves browser assets', () => {
    expect(getPublicFilePath('/src/client/css/main.css').replaceAll('\\', '/')).toEndWith('src/client/css/main.css');
    expect(getPublicFilePath('/src/shared/formulas.js').replaceAll('\\', '/')).toEndWith('src/shared/formulas.js');
  });

  it('maps generated artwork through the /assets alias', () => {
    expect(getPublicFilePath('/assets/icons/research/armorTech.png').replaceAll('\\', '/'))
      .toEndWith('src/client/assets/icons/research/armorTech.png');
  });

  it('does not expose private files or encoded traversal', () => {
    expect(getPublicFilePath('/data/users.json')).toBeNull();
    expect(getPublicFilePath('/src/server/index.js')).toBeNull();
    expect(getPublicFilePath('/src/client/%2e%2e/server/index.js')).toBeNull();
  });

  it('serves the UI but gates APIs and sockets during startup', () => {
    expect(canServeDuringStartup(new Request('http://localhost/login.html'))).toBe(true);
    expect(canServeDuringStartup(new Request('http://localhost/api/game/state'))).toBe(false);
    expect(canServeDuringStartup(new Request('http://localhost/ws', { headers: { upgrade: 'websocket' } }))).toBe(false);
  });

  it('provides bounded image caching with revalidation validators', () => {
    const headers = getStaticCacheHeaders('asset.png', { size: 1024, mtimeMs: 1700000000123 });
    expect(headers['Cache-Control']).toBe('public, max-age=604800, stale-while-revalidate=86400');
    expect(headers.ETag).toBe('W/\"400-18bcfe5687b\"');
    expect(headers['Last-Modified']).toBe('Tue, 14 Nov 2023 22:13:20 GMT');

    expect(isStaticFileNotModified(new Request('http://localhost/asset.png', {
      headers: { 'If-None-Match': headers.ETag }
    }), headers)).toBe(true);
    expect(isStaticFileNotModified(new Request('http://localhost/asset.png'), headers)).toBe(false);
  });
});
