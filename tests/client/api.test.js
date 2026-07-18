import { afterEach, expect, it } from 'bun:test';
import { API } from '../../src/client/js/api.js';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('surfaces API error messages', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ success: false, error: 'Queue full' }), { status: 400 });
  await expect(API.request('/test')).rejects.toThrow('Queue full');
});

it('reports non-JSON server failures clearly', async () => {
  globalThis.fetch = async () => new Response('<html>proxy error</html>', { status: 502 });
  await expect(API.request('/test')).rejects.toThrow('Request failed (502)');
});

it('uses the server rank-index route for the current player', async () => {
  let url;
  globalThis.fetch = async requestUrl => {
    url = requestUrl;
    return new Response(JSON.stringify({ success: true, data: { index: 42 } }));
  };

  await expect(API.getMyRank()).resolves.toEqual({ index: 42 });
  expect(url).toBe('/api/game/rank-index');
});

it('preserves the shipyard queue type when cancelling production', async () => {
  let options;
  globalThis.fetch = async (_url, requestOptions) => {
    options = requestOptions;
    return new Response(JSON.stringify({ success: true, data: {} }));
  };

  await API.cancelShipyardProduction('planet-1', 'queue-1', 'defenses');
  expect(JSON.parse(options.body)).toEqual({ type: 'defenses' });
});
