import { resolve, sep } from 'path';

const CLIENT_ROOT = resolve('./src/client');
const SHARED_ROOT = resolve('./src/shared');

export function getStaticCacheHeaders(filePath, { size, mtimeMs }) {
  const isImage = /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(filePath);
  const maxAge = isImage ? 604800 : 5;
  const lastModified = new Date(Math.floor(mtimeMs / 1000) * 1000).toUTCString();

  return {
    'Cache-Control': isImage
      ? `public, max-age=${maxAge}, stale-while-revalidate=86400`
      : `public, max-age=${maxAge}`,
    'Vary': 'Accept-Encoding',
    'ETag': `W/\"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}\"`,
    'Last-Modified': lastModified
  };
}

export function isStaticFileNotModified(req, headers) {
  const etag = req.headers.get('if-none-match');
  if (etag) return etag === '*' || etag.split(',').some(value => value.trim() === headers.ETag);

  const since = req.headers.get('if-modified-since');
  return Boolean(since && Date.parse(since) >= Date.parse(headers['Last-Modified']));
}

export function getPublicFilePath(urlPath) {
  if (urlPath === '/') return resolve(CLIENT_ROOT, 'index.html');
  if (urlPath === '/login.html') return resolve(CLIENT_ROOT, 'login.html');

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }

  // Keep generated game artwork on a short, stable public URL.
  const clientPath = decodedPath.startsWith('/assets/')
    ? `/src/client${decodedPath}`
    : decodedPath;
  const filePath = resolve(`.${clientPath}`);
  const isPublic = [CLIENT_ROOT, SHARED_ROOT].some(root => filePath.startsWith(`${root}${sep}`));
  return isPublic ? filePath : null;
}

export function canServeDuringStartup(req) {
  const path = new URL(req.url).pathname;
  return req.method === 'OPTIONS' || (req.method === 'GET' && !path.startsWith('/api/') && req.headers.get('upgrade') !== 'websocket');
}
