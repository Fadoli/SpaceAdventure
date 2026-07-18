import { describe, expect, it } from 'bun:test';
import { canServeDuringStartup, getPublicFilePath } from '../../src/server/publicFiles.js';

describe('public file boundary', () => {
  it('serves browser assets', () => {
    expect(getPublicFilePath('/src/client/css/main.css').replaceAll('\\', '/')).toEndWith('src/client/css/main.css');
    expect(getPublicFilePath('/src/shared/formulas.js').replaceAll('\\', '/')).toEndWith('src/shared/formulas.js');
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
});
