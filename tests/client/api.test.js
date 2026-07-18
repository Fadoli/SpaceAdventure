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
