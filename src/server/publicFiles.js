import { resolve, sep } from 'path';

const CLIENT_ROOT = resolve('./src/client');
const SHARED_ROOT = resolve('./src/shared');

export function getPublicFilePath(urlPath) {
  if (urlPath === '/') return resolve(CLIENT_ROOT, 'index.html');
  if (urlPath === '/login.html') return resolve(CLIENT_ROOT, 'login.html');

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  const filePath = resolve(`.${decodedPath}`);
  const isPublic = [CLIENT_ROOT, SHARED_ROOT].some(root => filePath.startsWith(`${root}${sep}`));
  return isPublic ? filePath : null;
}

export function canServeDuringStartup(req) {
  const path = new URL(req.url).pathname;
  return req.method === 'OPTIONS' || (req.method === 'GET' && !path.startsWith('/api/') && req.headers.get('upgrade') !== 'websocket');
}
