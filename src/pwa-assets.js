// Fixed PUBLIC assets only. Never proxy a supplied URL or forward credentials.
const PWA_ASSETS = Object.freeze({
  '/manifest.webmanifest': 'application/manifest+json',
  '/sw.js': 'text/javascript',
  '/assets/icon-192.png': 'image/png',
  '/assets/icon-512.png': 'image/png'
});
async function servePwaAsset(request) {
  const path = new URL(request.url).pathname, type = PWA_ASSETS[path];
  if (!type) return new Response('Not found', { status: 404 });
  if (!['GET', 'HEAD'].includes(request.method)) return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  try {
    const r = await fetch('https://jglisson8.github.io/j365-spa-logger' + path, {
      method: request.method, redirect: 'manual', headers: { Accept: type }
    });
    const mime = r.headers.get('Content-Type')?.split(';')[0].trim();
    const expected = type === 'text/javascript' ? ['text/javascript', 'application/javascript'] : type === 'application/manifest+json' ? ['application/manifest+json', 'application/json', 'application/octet-stream'] : [type];
    if (!r.ok || !expected.includes(mime)) throw Error('Public asset unavailable');
    return new Response(request.method === 'HEAD' ? null : r.body, { headers: {
      'Content-Type': type + (type === 'image/png' ? '' : '; charset=utf-8'),
      'Cache-Control': path === '/sw.js' || path === '/manifest.webmanifest' ? 'no-cache' : 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
      ...(path === '/sw.js' ? { 'Service-Worker-Allowed': '/', 'Content-Security-Policy': "default-src 'none'; script-src 'self'; connect-src 'self'" } : {})
    }});
  } catch {
    return new Response('Public app asset temporarily unavailable', { status: 502, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = { PWA_ASSETS, servePwaAsset };
