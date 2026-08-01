import { describe, expect, it } from 'bun:test';
import { mkdtemp, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ensureTlsConfig } from '../../src/server/tls.js';

describe('TLS bootstrap', () => {
  it('uses an existing certificate pair without invoking OpenSSL', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'space-adventure-tls-'));
    const certPath = join(directory, 'localhost.crt');
    const keyPath = join(directory, 'localhost.key');
    await writeFile(certPath, 'certificate');
    await writeFile(keyPath, 'key');

    const config = await ensureTlsConfig({ certPath, keyPath, opensslBin: 'missing-openssl' });
    expect(await config.cert.text()).toBe('certificate');
    expect(await config.key.text()).toBe('key');
  });
});
