// J-365 Spa Sync Worker v3.8 — installable public PWA assets; private APIs unchanged.
// Backward-compatible Cloudflare Worker for private GitHub-backed spa data.
//
// Required Cloudflare bindings:
//   GITHUB_CLIENT_ID       (text)
//   GITHUB_CLIENT_SECRET   (secret)
//   SESSION_SECRET         (secret, 32+ characters)
//
// Existing GitHub App installation must grant Contents: read/write to:
//   jglisson8/j365-spa-data

const OWNER = 'jglisson8';
const REPO = 'j365-spa-data';
const LEGACY_FILE = 'spa-log.json';
const CONFIG_FILE = 'config.json';
const MAX_EVENTS_PER_MONTH = 5000;
const MAX_EVENT_FILE_BYTES = 900000;
const MAX_CONFIG_BYTES = 100000;
const LOGGER_UI_URL = 'https://jglisson8.github.io/j365-spa-logger/';
let weatherCache=null;
export function normalizeWeather(data,retrievedAt){const p=data.properties;if(!Array.isArray(p?.periods))throw Error('Invalid NWS response');const hours=p.periods.flatMap(h=>{const temperature=!Number.isFinite(h.temperature)?null:h.temperatureUnit==='F'?h.temperature:h.temperatureUnit==='C'?h.temperature*9/5+32:null,rh=h.relativeHumidity?.value,winds=String(h.windSpeed).match(/\d+(?:\.\d+)?/g),wind=winds?Math.max(...winds.map(Number))*(/km\/h/i.test(h.windSpeed)?1/3.6:.44704):/^calm$/i.test(h.windSpeed)?0:null,start=Date.parse(h.startTime),end=Date.parse(h.endTime);return Number.isFinite(temperature)&&temperature>=-60&&temperature<=140&&Number.isFinite(rh)&&rh>=0&&rh<=100&&Number.isFinite(wind)&&wind<=100&&Number.isFinite(start)&&end>start?[{start:h.startTime,end:h.endTime,temperature_f:temperature,humidity_percent:rh,wind_m_s:wind,retrieved_at:retrievedAt,issued_at:p.updateTime??p.generatedAt??null,data_kind:'forecast'}]:[]});if(!hours.length)throw Error('NWS hourly fields unavailable');return {source:'NWS hourly forecast',data_kind:'forecast',location:{latitude:40.738,longitude:-111.616,site_elevation_ft:7200,grid_elevation_ft:p.elevation?.unitCode==='wmoUnit:m'?p.elevation.value/ .3048:null,time_zone:'America/Denver'},retrieved_at:retrievedAt,issued_at:p.updateTime??p.generatedAt??null,hours}}
async function localWeather(){if(weatherCache&&Date.now()-Date.parse(weatherCache.retrieved_at)<600000)return weatherCache;const headers={'User-Agent':'J365-Spa-Logger (https://jglisson8.github.io/j365-spa-logger/)','Accept':'application/geo+json'},point=await fetch('https://api.weather.gov/points/40.738,-111.616',{headers,signal:AbortSignal.timeout(8000)});if(!point.ok)throw Object.assign(Error('NWS point lookup unavailable'),{status:503});const url=(await point.json()).properties?.forecastHourly;if(typeof url!=='string'||!/^https:\/\/api\.weather\.gov\/gridpoints\/[A-Z]{3}\/\d+,\d+\/forecast\/hourly$/.test(url))throw Error('Invalid NWS hourly endpoint');const response=await fetch(url,{headers,signal:AbortSignal.timeout(8000)});if(!response.ok)throw Object.assign(Error('NWS hourly forecast unavailable'),{status:503});weatherCache=normalizeWeather(await response.json(),new Date().toISOString());return weatherCache}

function serviceError(message) { return Object.assign(new Error(message), { status: 500, code: '', currentSha: undefined }); }
const te = new TextEncoder();
const td = new TextDecoder();
const b64url = bytes => btoa(String.fromCharCode(...bytes))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = value => Uint8Array.from(
  atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)),
  char => char.charCodeAt(0)
);
const random = size => b64url(crypto.getRandomValues(new Uint8Array(size)));

const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...headers
  }
});
const redirect = (location, setCookie) => new Response(null, {
  status: 302,
  headers: {
    Location: location,
    'Cache-Control': 'no-store',
    ...(setCookie ? { 'Set-Cookie': setCookie } : {})
  }
});

function getCookie(req, name) {
  return (req.headers.get('Cookie') || '')
    .split(';')
    .map(item => item.trim())
    .find(item => item.startsWith(`${name}=`))
    ?.slice(name.length + 1) || '';
}

async function aesKey(env) {
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET missing or too short');
  }
  const digest = await crypto.subtle.digest('SHA-256', te.encode(env.SESSION_SECRET));
  return crypto.subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
async function seal(value, env) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    await aesKey(env),
    te.encode(JSON.stringify(value))
  ));
  return `${b64url(iv)}.${b64url(encrypted)}`;
}
async function unseal(value, env) {
  const [iv, encrypted] = value.split('.');
  if (!iv || !encrypted) throw new Error('Invalid cookie');
  const clear = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64url(iv) },
    await aesKey(env),
    fromB64url(encrypted)
  );
  return JSON.parse(td.decode(clear));
}

const sessionCookie = (value, age) => `__Host-j365=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;
const stateCookie = (value, age) => `__Host-j365-state=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`;

async function github(path, token, options = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'j365-spa-sync',
      ...(options.headers || {})
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = serviceError(body.message || 'GitHub request failed');
    error.status = response.status;
    throw error;
  }
  return body;
}

async function oauth(env, code, callback) {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: callback
    })
  });
  const body = await response.json();
  if (!response.ok || body.error || !body.access_token) {
    throw new Error(body.error_description || body.error || 'OAuth token exchange failed');
  }
  return body;
}

async function requireSession(req, env) {
  let value;
  try {
    value = await unseal(getCookie(req, '__Host-j365'), env);
  } catch {
    const error = serviceError('Sign in again');
    error.status = 401;
    throw error;
  }
  if (value.user !== OWNER || !value.token || Date.now() >= value.until) {
    const error = serviceError('Sign in again');
    error.status = 401;
    throw error;
  }
  return value;
}

function requireWriteAuth(req, url, session) {
  if (req.headers.get('Origin') !== url.origin) {
    const error = serviceError('Invalid origin');
    error.status = 403;
    throw error;
  }
  if (req.headers.get('X-CSRF-Token') !== session.csrf) {
    const error = serviceError('Invalid CSRF token');
    error.status = 403;
    throw error;
  }
  const contentType = req.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().startsWith('application/json')) {
    const error = serviceError('Content-Type must be application/json');
    error.status = 415;
    throw error;
  }
}

function decodeGitHubContent(value) {
  const binary = atob(value.replace(/\s/g, ''));
  return td.decode(Uint8Array.from(binary, char => char.charCodeAt(0)));
}
function encodeGitHubContent(value) {
  const bytes = te.encode(value);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

const repoFilePath = path => `/repos/${OWNER}/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;

async function readRepoJson(path, token, allowMissing = false) {
  try {
    const file = await github(repoFilePath(path), token);
    return { sha: file.sha, value: JSON.parse(decodeGitHubContent(file.content)) };
  } catch (error) {
    if (allowMissing && error.status === 404) return { sha: null, value: null };
    if (error instanceof SyntaxError) {
      const invalid = serviceError(`${path} contains invalid JSON`);
      invalid.status = 502;
      throw invalid;
    }
    throw error;
  }
}

async function writeRepoJson(path, token, value, expectedSha, message) {
  const current = await readRepoJson(path, token, true);
  if (current.sha !== expectedSha) {
    const error = serviceError('File changed on GitHub; reload and merge before saving');
    error.status = 409;
    error.code = 'CONFLICT';
    error.currentSha = current.sha;
    throw error;
  }
  const content = `${JSON.stringify(value, null, 2)}\n`;
  const payload = { message, content: encodeGitHubContent(content) };
  if (current.sha) payload.sha = current.sha;
  const saved = await github(repoFilePath(path), token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return saved.content.sha;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function isFiniteNumber(value, min, max) {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}
function isTimestamp(value) {
  return typeof value === 'string'
    && value.length <= 40
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?$/.test(value)
    && !Number.isNaN(Date.parse(value));
}
function monthFromTimestamp(value) {
  return value.slice(0, 7);
}
function validateMonth(month) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month || '')) {
    const error = serviceError('month must use YYYY-MM format');
    error.status = 400;
    throw error;
  }
  return month;
}
function monthlyPath(month) {
  validateMonth(month);
  return `events/${month.slice(0, 4)}/${month}.json`;
}
function validateText(value, field, max = 500, required = false) {
  if (value == null && !required) return;
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) {
    throw new Error(`${field} must be ${required ? 'a non-empty' : 'a'} string of at most ${max} characters`);
  }
}

const EVENT_TYPES = new Set([
  'soak', 'chemistry', 'chemical_addition', 'maintenance',
  'water_change', 'water_top_off', 'note'
]);
const MAINTENANCE_ACTIVITIES = new Set([
  'filter_rinse', 'filter_clean', 'filter_swap', 'filter_replace',
  'uv_bulb_replace', 'quartz_sleeve_clean', 'quartz_sleeve_replace',
  'inspection', 'equipment_repair', 'equipment_replace', 'custom'
]);

function validateEvent(event, month) {
  if (!isObject(event)) throw new Error('Each event must be an object');
  if(event.weather_for_event_id!=null)validateText(event.weather_for_event_id,'weather_for_event_id',128,true);
  if(event.weather_context!=null){const w=event.weather_context;if(!isObject(w)||w.data_kind!=='forecast'||w.location?.latitude!==40.738||w.location?.longitude!==-111.616||!Array.isArray(w.hours)||w.hours.length>400)throw Error('Invalid weather context');for(const h of w.hours)if(!isObject(h)||!Number.isFinite(Date.parse(h.start))||!(Date.parse(h.end)>Date.parse(h.start))||!isFiniteNumber(h.temperature_f,-60,140)||!isFiniteNumber(h.humidity_percent,0,100)||!isFiniteNumber(h.wind_m_s,0,100))throw Error('Invalid weather hour')}
  validateText(event.id, 'event.id', 128, true);
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(event.id)) {
    throw new Error('event.id contains unsupported characters or is too short');
  }
  if (!EVENT_TYPES.has(event.type)) throw new Error(`Unsupported event.type: ${event.type}`);
  const historical = event.historical != null;
  if (historical) {
    if (!isObject(event.historical) || !['reconstructed', 'timestamped_context', 'assumed_added'].includes(event.historical.status)) throw new Error('Invalid historical status');
    validateText(event.historical.import_id, 'historical.import_id', 128, true);
    if (event.historical.exclude_from_training !== true) throw new Error('Historical records must initially be excluded from training');
    if (!['date_only','exact'].includes(event.date_precision)) throw new Error('Historical date precision required');
  }
  const dateOnly = historical && event.date_precision === 'date_only';
  const validDate = typeof event.timestamp === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(event.timestamp) && !Number.isNaN(Date.parse(event.timestamp)) && new Date(event.timestamp).toISOString().slice(0,10) === event.timestamp;
  if (!(dateOnly ? validDate : isTimestamp(event.timestamp))) throw new Error(`Invalid timestamp for event ${event.id}`);
  if (monthFromTimestamp(event.timestamp) !== month) {
    throw new Error(`Event ${event.id} belongs in ${monthFromTimestamp(event.timestamp)}, not ${month}`);
  }
  if (event.created_at != null && !isTimestamp(event.created_at)) throw new Error(`Invalid created_at for event ${event.id}`);
  if (event.updated_at != null && !isTimestamp(event.updated_at)) throw new Error(`Invalid updated_at for event ${event.id}`);
  if (event.schema_version != null && !Number.isInteger(event.schema_version)) throw new Error(`Invalid schema_version for event ${event.id}`);
  validateText(event.app_version, 'event.app_version', 40);
  validateText(event.calculation_version, 'event.calculation_version', 40);
  validateText(event.fill_cycle_id, 'event.fill_cycle_id', 128);
  validateText(event.notes, 'event.notes', 4000);

  if (event.type === 'soak') {
    if (!(historical && event.bathers == null) && (!Number.isInteger(event.bathers) || event.bathers < 1 || event.bathers > 30)) throw new Error(`Invalid bathers for event ${event.id}`);
    if (!(historical && event.duration_minutes == null) && (!Number.isInteger(event.duration_minutes) || event.duration_minutes < 1 || event.duration_minutes > 720)) throw new Error(`Invalid duration_minutes for event ${event.id}`);
    if (event.showered != null && typeof event.showered !== 'boolean') throw new Error(`Invalid showered for event ${event.id}`);
    if (event.temperature_f != null && !isFiniteNumber(event.temperature_f, 32, 120)) throw new Error(`Invalid temperature_f for event ${event.id}`);
  }
  if (event.type === 'chemistry') {
    if (event.ph_bounds != null) {
      const b = event.ph_bounds;
      if (!isObject(b) || event.ph != null || !(b.operator === '>=' && b.value === 8 && Object.keys(b).length === 2 || historical && (b.operator === '>' && isFiniteNumber(b.value,0,14) && Object.keys(b).length === 2 || isFiniteNumber(b.minimum,0,14) && isFiniteNumber(b.maximum,b.minimum,14) && Object.keys(b).length === 2))) throw new Error('Invalid bounded pH');
    }
    const fields = ['fc_ppm', 'cc_ppm', 'ph', 'ta_ppm', 'ch_ppm', 'cya_ppm', 'borates_ppm', 'temperature_f'];
    if (!fields.some(field => event[field] != null) && event.ph_bounds == null) throw new Error(`Chemistry event ${event.id} has no measurements`);
    if (event.fc_ppm != null && !isFiniteNumber(event.fc_ppm, 0, 100)) throw new Error(`Invalid fc_ppm for event ${event.id}`);
    if (event.cc_ppm != null && !isFiniteNumber(event.cc_ppm, 0, 100)) throw new Error(`Invalid cc_ppm for event ${event.id}`);
    if (event.ph != null && !isFiniteNumber(event.ph, 0, 14)) throw new Error(`Invalid pH for event ${event.id}`);
    for (const field of ['ta_ppm', 'ch_ppm', 'cya_ppm', 'borates_ppm']) {
      if (event[field] != null && !isFiniteNumber(event[field], 0, 5000)) throw new Error(`Invalid ${field} for event ${event.id}`);
    }
    if (event.temperature_f != null && !isFiniteNumber(event.temperature_f, 32, 120)) throw new Error(`Invalid temperature_f for event ${event.id}`);
  }
  if (event.type === 'chemical_addition') {
    validateText(event.product, 'event.product', 200, true);
    if (!isFiniteNumber(event.amount, 0.000001, 100000)) throw new Error(`Invalid amount for event ${event.id}`);
    validateText(event.unit, 'event.unit', 40, true);
    validateText(event.product_strength, 'event.product_strength', 100);
  }
  if (event.type === 'maintenance') {
    if (!MAINTENANCE_ACTIVITIES.has(event.activity)) throw new Error(`Unsupported maintenance activity: ${event.activity}`);
    if (event.activity === 'custom') validateText(event.custom_activity, 'event.custom_activity', 200, true);
    validateText(event.filter_set, 'event.filter_set', 100);
    validateText(event.product, 'event.product', 200);
    validateText(event.component, 'event.component', 200);
    validateText(event.brand_model, 'event.brand_model', 200);
    if (event.cost != null && !isFiniteNumber(event.cost, 0, 1000000)) throw new Error(`Invalid cost for event ${event.id}`);
  }
  if (event.type === 'water_change') {
    if (event.full !== true && event.full !== false) throw new Error(`water_change.full must be boolean for event ${event.id}`);
    if (event.gallons != null && !isFiniteNumber(event.gallons, 0.1, 5000)) throw new Error(`Invalid gallons for event ${event.id}`);
    validateText(event.new_fill_cycle_id, 'event.new_fill_cycle_id', 128, event.full === true);
  }
  if (event.type === 'water_top_off') {
    if (!(historical && event.gallons == null) && !isFiniteNumber(event.gallons, 0.01, 1000)) throw new Error(`Invalid gallons for event ${event.id}`);
    if (event.softened != null && typeof event.softened !== 'boolean') throw new Error(`Invalid softened flag for event ${event.id}`);
    validateText(event.water_source, 'event.water_source', 100);
  }
  if (event.starting_cya_ppm != null && (event.type !== 'water_change' || !isFiniteNumber(event.starting_cya_ppm, 0, 5000))) throw new Error(`Invalid starting_cya_ppm for event ${event.id}`);
  if (event.cya_baseline_ppm != null && (event.type !== 'note' || !isFiniteNumber(event.cya_baseline_ppm, 0, 5000))) throw new Error(`Invalid cya_baseline_ppm for event ${event.id}`);
  return event;
}

function validateMonthlyDocument(document, month) {
  if (!isObject(document)) throw new Error('Monthly document must be an object');
  if (document.schema_version !== 2) throw new Error('Monthly document schema_version must be 2');
  if (document.month != null && document.year_month != null && document.month !== document.year_month) {
    throw new Error('Monthly document month and year_month fields disagree');
  }
  const documentMonth = document.year_month ?? document.month;
  if (documentMonth !== month) throw new Error('Monthly document month does not match URL');
  if (!Array.isArray(document.events) || document.events.length > MAX_EVENTS_PER_MONTH) {
    throw new Error(`events must be an array with at most ${MAX_EVENTS_PER_MONTH} items`);
  }
  const seen = new Set();
  for (const event of document.events) {
    validateEvent(event, month);
    if (seen.has(event.id)) throw new Error(`Duplicate event id: ${event.id}`);
    seen.add(event.id);
  }
  const size = te.encode(JSON.stringify(document)).length;
  if (size > MAX_EVENT_FILE_BYTES) throw new Error('Monthly event file is too large');
  return document;
}

function validateConfig(config) {
  if (!isObject(config)) throw new Error('config must be an object');
  if (config.schema_version !== 2) throw new Error('config.schema_version must be 2');
  if (!isObject(config.spa)) throw new Error('config.spa is required');
  validateText(config.spa.model, 'config.spa.model', 100, true);
  if (!isFiniteNumber(config.spa.volume_gallons, 1, 10000)) throw new Error('Invalid spa.volume_gallons');
  if (config.current_fill_cycle_id != null) validateText(config.current_fill_cycle_id, 'current_fill_cycle_id', 128, true);
  if (config.maintenance_intervals != null && !isObject(config.maintenance_intervals)) throw new Error('maintenance_intervals must be an object');
  if (config.products != null && !isObject(config.products)) throw new Error('products must be an object');
  if (config.targets != null && !isObject(config.targets)) throw new Error('targets must be an object');
  if (config.source_water != null && (!isObject(config.source_water) || config.source_water.schema_version !== 1 || !['latest','average'].includes(config.source_water.mode) || Object.keys(config.source_water).some(k=>!['schema_version','mode'].includes(k)))) throw new Error('Invalid source-water preference');
  if (te.encode(JSON.stringify(config)).length > MAX_CONFIG_BYTES) throw new Error('config is too large');
  return config;
}

function validateClientInput(callback) {
  try {
    return callback();
  } catch (error) {
    if (!error.status) error.status = 400;
    throw error;
  }
}

async function parseJsonBody(req, maxBytes) {
  const declared = Number(req.headers.get('Content-Length') || 0);
  if (declared > maxBytes) {
    const error = serviceError('Request body is too large');
    error.status = 413;
    throw error;
  }
  const text = await req.text();
  if (te.encode(text).length > maxBytes) {
    const error = serviceError('Request body is too large');
    error.status = 413;
    throw error;
  }
  try { return JSON.parse(text); }
  catch {
    const error = serviceError('Request body contains invalid JSON');
    error.status = 400;
    throw error;
  }
}

function testPage() {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>J-365 Sync</title><style>body{font:16px system-ui;background:#101c23;color:#f2f6f7;max-width:760px;margin:40px auto;padding:20px}a,button{color:#9fe5da}button{background:#183d43;border:1px solid #6caaa2;border-radius:8px;padding:12px;margin:4px;cursor:pointer}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#1b2c34;padding:12px;border-radius:8px}</style><h1>J-365 Spa Sync v3</h1><p>Secure API test page. The full logger UI has not yet migrated to this address.</p><p id="who">Checking sign-in…</p><p><a href="/auth/start">Sign in with GitHub</a></p><button data-url="/api/config">Test config</button><button data-url="/api/events?month=2026-10">Test October events</button><button data-url="/api/log">Test legacy log</button><pre id="result">Not tested</pre><button id="logout">Sign out</button><script>const result=document.getElementById('result');fetch('/api/me').then(async r=>{const j=await r.json();document.getElementById('who').textContent=r.ok?'Connected as '+j.user:'Not signed in'});document.querySelectorAll('[data-url]').forEach(b=>b.onclick=async()=>{const r=await fetch(b.dataset.url);result.textContent=JSON.stringify(await r.json(),null,2)});document.getElementById('logout').onclick=()=>location.href='/auth/logout';</script></html>`;
}

// BEGIN LOGO ASSET ROUTE
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

// END LOGO ASSET ROUTE

async function spaLoggerPage() {
  const upstream = await fetch(`${LOGGER_UI_URL}?v=${Date.now()}`, {
    cache: 'no-store',
    headers: {
      Accept: 'text/html',
      'Cache-Control': 'no-cache',
      'User-Agent': 'j365-spa-sync-worker'
    }
  });
  if (!upstream.ok) {
    const error = serviceError(`Spa Logger interface is temporarily unavailable (${upstream.status})`);
    error.status = 502;
    throw error;
  }
  const headers = new Headers({
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; manifest-src 'self'; worker-src 'self'; img-src 'self' data: blob:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
  });
  return new Response(await upstream.text(), { status: 200, headers });
}

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
    const r = await fetch('https://jglisson8.github.io/j365-spa-logger' + path + '?public_asset=' + Date.now(), {
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

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const path = url.pathname;
    try {
      if (Object.hasOwn(PWA_ASSETS, path)) return servePwaAsset(req);
      if (path === LOGO_ASSET_PATH) return serveLogoAsset(req);
      if (req.method === 'GET' && path === '/') {
        return await spaLoggerPage();
      }
      if (req.method === 'GET' && path === '/diagnostics') {
        return new Response(testPage(), {
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
            'X-Content-Type-Options': 'nosniff',
            'Referrer-Policy': 'no-referrer'
          }
        });
      }
      if (req.method === 'GET' && path === '/health') {
        return json({ service: 'J-365 Spa Sync', status: 'running', version: '3.8', app_version: 'live-from-github-pages', storage_schema: 2 });
      }
      // Fixed public forecast only: no session, GitHub data, coordinates or URLs
      // supplied by callers. Weather works independently of repository sync.
      if(req.method==='GET'&&path==='/api/weather')return json(await localWeather());
      if (req.method === 'GET' && path === '/auth/start') {
        const state = random(32);
        const authorize = `https://github.com/login/oauth/authorize?${new URLSearchParams({
          client_id: env.GITHUB_CLIENT_ID,
          redirect_uri: `${url.origin}/auth/callback`,
          state
        })}`;
        return redirect(authorize, stateCookie(state, 600));
      }
      if (req.method === 'GET' && path === '/auth/callback') {
        const expectedState = getCookie(req, '__Host-j365-state');
        if (!expectedState || expectedState !== url.searchParams.get('state') || !url.searchParams.get('code')) {
          return json({ error: 'OAuth state verification failed' }, 403);
        }
        const token = await oauth(env, url.searchParams.get('code'), `${url.origin}/auth/callback`);
        const me = await github('/user', token.access_token);
        if (me.login !== OWNER) return json({ error: 'GitHub account not authorized' }, 403);
        const lifetime = Math.min(Math.max(Number(token.expires_in || 28800) - 120, 60), 28800);
        const sealed = await seal({
          user: me.login,
          token: token.access_token,
          until: Date.now() + lifetime * 1000,
          csrf: random(24)
        }, env);
        const headers = new Headers({ Location: '/', 'Cache-Control': 'no-store' });
        headers.append('Set-Cookie', sessionCookie(sealed, lifetime));
        headers.append('Set-Cookie', stateCookie('', 0));
        return new Response(null, { status: 302, headers });
      }
      if (req.method === 'GET' && path === '/auth/logout') return redirect('/', sessionCookie('', 0));

      if (req.method === 'GET' && path === '/api/me') {
        const current = await requireSession(req, env);
        return json({ user: current.user, csrf: current.csrf, api_version: 3 });
      }

      // New schema-v2 config API.
      if (path === '/api/config' && req.method === 'GET') {
        const current = await requireSession(req, env);
        const file = await readRepoJson(CONFIG_FILE, current.token);
        validateConfig(file.value);
        return json({ sha: file.sha, config: file.value });
      }
      if (path === '/api/config' && req.method === 'POST') {
        const current = await requireSession(req, env);
        requireWriteAuth(req, url, current);
        const body = await parseJsonBody(req, MAX_CONFIG_BYTES + 10000);
        if (!isObject(body) || (typeof body.sha !== 'string' && body.sha !== null)) return json({ error: 'sha must be a string or null' }, 400);
        validateClientInput(() => validateConfig(body.config));
        const sha = await writeRepoJson(CONFIG_FILE, current.token, body.config, body.sha, 'Update J-365 spa config');
        return json({ ok: true, sha });
      }

      // Discover archived months so a new phone also loads historical fill boundaries.
      if (path === '/api/months' && req.method === 'GET') {
        const current = await requireSession(req, env);
        let years;
        try { years = await github(repoFilePath('events'), current.token); }
        catch (error) { if (error.status === 404) return json({ months: [] }); throw error; }
        if (!Array.isArray(years)) throw new Error('Invalid events directory');
        const months = [];
        for (const year of years.filter(item => item.type === 'dir' && /^\d{4}$/.test(item.name))) {
          const entries = await github(repoFilePath(`events/${year.name}`), current.token);
          if (!Array.isArray(entries)) throw new Error('Invalid year directory');
          for (const entry of entries) if (entry.type === 'file' && new RegExp(`^${year.name}-(0[1-9]|1[0-2])\\.json$`).test(entry.name)) months.push(entry.name.slice(0,7));
        }
        return json({ months: [...new Set(months)].sort() });
      }
      // New schema-v2 monthly event API.
      if (path === '/api/events' && req.method === 'GET') {
        const current = await requireSession(req, env);
        const month = validateMonth(url.searchParams.get('month'));
        const file = await readRepoJson(monthlyPath(month), current.token, true);
        const document = file.value || { schema_version: 2, year_month: month, events: [] };
        validateMonthlyDocument(document, month);
        return json({ sha: file.sha, document });
      }
      if (path === '/api/events' && req.method === 'POST') {
        const current = await requireSession(req, env);
        requireWriteAuth(req, url, current);
        const month = validateMonth(url.searchParams.get('month'));
        const body = await parseJsonBody(req, MAX_EVENT_FILE_BYTES + 10000);
        if (!isObject(body) || (typeof body.sha !== 'string' && body.sha !== null)) return json({ error: 'sha must be a string or null' }, 400);
        validateClientInput(() => validateMonthlyDocument(body.document, month));
        const sha = await writeRepoJson(monthlyPath(month), current.token, body.document, body.sha, `Sync J-365 events for ${month}`);
        return json({ ok: true, sha, event_count: body.document.events.length });
      }

      // Legacy v2 API retained without behavioral changes.
      if (path === '/api/log' && req.method === 'GET') {
        const current = await requireSession(req, env);
        const file = await readRepoJson(LEGACY_FILE, current.token);
        return json({ sha: file.sha, log: file.value });
      }
      if (path === '/api/log' && req.method === 'POST') {
        const current = await requireSession(req, env);
        requireWriteAuth(req, url, current);
        const body = await parseJsonBody(req, MAX_EVENT_FILE_BYTES + 10000);
        if (!isObject(body) || !Array.isArray(body.events) || body.events.length > 20000 || typeof body.sha !== 'string') {
          return json({ error: 'Invalid legacy log' }, 400);
        }
        const value = {
          schema_version: 1,
          spa: { model: 'Jacuzzi J-365', volume_gallons: 395 },
          events: body.events
        };
        if (te.encode(JSON.stringify(value)).length > MAX_EVENT_FILE_BYTES) return json({ error: 'Legacy log is too large' }, 413);
        const sha = await writeRepoJson(LEGACY_FILE, current.token, value, body.sha, 'Sync J-365 spa log');
        return json({ ok: true, sha });
      }

      return json({ error: 'Not found' }, 404);
    } catch (error) {
      const status = error.status >= 400 && error.status < 600 ? error.status : 500;
      return json({
        error: error.message || 'Unexpected error',
        ...(error.code ? { code: error.code } : {}),
        ...(error.currentSha !== undefined ? { current_sha: error.currentSha } : {})
      }, status);
    }
  }
};
