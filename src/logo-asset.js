// Fixed public image only. Never forward browser cookies, authorization or URLs.
const LOGO_ASSET_PATH = '/assets/spa-mountain-logo.png';
const LOGO_ASSET_URL = 'https://jglisson8.github.io/j365-spa-logger/assets/spa-mountain-logo.png';

async function serveLogoAsset(request) {
  if (new URL(request.url).pathname !== LOGO_ASSET_PATH) {
    return new Response('Not found', { status: 404 });
  }
  if (!['GET', 'HEAD'].includes(request.method)) {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  try {
    const upstream = await fetch(LOGO_ASSET_URL, {
      method: request.method,
      redirect: 'manual',
      headers: { Accept: 'image/png' }
    });
    if (!upstream.ok || upstream.headers.get('Content-Type')?.split(';')[0].trim() !== 'image/png') {
      throw new Error('Logo unavailable');
    }
    return new Response(request.method === 'HEAD' ? null : upstream.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }
    });
  } catch {
    return new Response('Logo temporarily unavailable', {
      status: 502,
      headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
    });
  }
}

if (typeof module !== 'undefined' && module.exports) module.exports = { serveLogoAsset, LOGO_ASSET_PATH, LOGO_ASSET_URL };
