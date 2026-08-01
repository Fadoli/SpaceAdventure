import { existsSync } from 'fs';
import { mkdir, rename, rm } from 'fs/promises';
import { dirname, resolve } from 'path';

const DEFAULT_CERT_PATH = 'data/tls/localhost.crt';
const DEFAULT_KEY_PATH = 'data/tls/localhost.key';

function outputText(value) {
  return value ? new TextDecoder().decode(value) : '';
}

/**
 * Return TLS files for Bun. Generate a local-only certificate once when no
 * certificate pair was configured or created yet.
 */
export async function ensureTlsConfig({
  certPath = process.env.TLS_CERT_PATH || DEFAULT_CERT_PATH,
  keyPath = process.env.TLS_KEY_PATH || DEFAULT_KEY_PATH,
  opensslBin = process.env.OPENSSL_BIN || 'openssl'
} = {}) {
  const certFile = resolve(process.cwd(), certPath);
  const keyFile = resolve(process.cwd(), keyPath);
  const hasCert = existsSync(certFile);
  const hasKey = existsSync(keyFile);

  if (hasCert !== hasKey) {
    throw new Error(`TLS certificate pair is incomplete: ${certFile} and ${keyFile}`);
  }

  if (!hasCert) {
    await mkdir(dirname(certFile), { recursive: true });
    const tempCert = `${certFile}.tmp-${process.pid}`;
    const tempKey = `${keyFile}.tmp-${process.pid}`;
    try {
      const result = Bun.spawnSync([
        opensslBin,
        'req', '-x509', '-newkey', 'rsa:2048', '-sha256', '-nodes',
        '-days', '365',
        '-keyout', tempKey,
        '-out', tempCert,
        '-subj', '/CN=localhost',
        '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1,IP:::1'
      ]);

      if (result.exitCode !== 0) {
        throw new Error(outputText(result.stderr) || `openssl exited with code ${result.exitCode}`);
      }

      await rename(tempCert, certFile);
      await rename(tempKey, keyFile);
      console.log(`[TLS] Generated self-signed development certificate at ${certFile}`);
    } catch (error) {
      await Promise.allSettled([rm(tempCert, { force: true }), rm(tempKey, { force: true })]);
      throw new Error(`Unable to generate self-signed TLS certificate with ${opensslBin}: ${error.message}`);
    }
  }

  return {
    cert: Bun.file(certFile),
    key: Bun.file(keyFile)
  };
}
