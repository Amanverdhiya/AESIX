/**
 * Runtime API-base resolver (PWA-safe).
 *
 * `VITE_API_URL` is baked in at build time (currently localhost:5001).
 * On a phone's installed PWA, `localhost` resolves to the phone itself,
 * so every backend call — including the whole Medical Directory — fails.
 *
 * Resolution order:
 * 1. `localStorage 'mediksha_api_base'` manual override (power users).
 * 2. `VITE_API_URL`, unless it points at localhost while the app itself
 *    is served from another host (phone over LAN / hosted domain) — then
 *    same-origin `/api` is the only thing that can work (dev & preview
 *    servers proxy `/api` + `/socket.io` to the backend).
 * 3. Same-origin `/api` fallback.
 */

const CONFIGURED = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

const LOOPBACKS = new Set(['localhost', '127.0.0.1', '::1', '']);

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function pageOnLoopback() {
  if (typeof window === 'undefined') return true;
  return LOOPBACKS.has(window.location.hostname);
}

function normalizeApiUrl(raw) {
  if (!raw) return '/api';
  const clean = raw.trim().replace(/\/+$/, '');
  if (!clean || clean === '/api') return '/api';
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean.endsWith('/api') ? clean : `${clean}/api`;
  }
  return clean.startsWith('/') ? clean : `/${clean}`;
}

export function getApiBase() {
  try {
    const override = localStorage.getItem('mediksha_api_base');
    if (override && override.trim()) {
      return normalizeApiUrl(override);
    }
  } catch {
    /* private-mode storage — ignore */
  }
  if (CONFIGURED) {
    if (LOOPBACKS.has(hostOf(CONFIGURED)) && !pageOnLoopback()) {
      return '/api';
    }
    return normalizeApiUrl(CONFIGURED);
  }
  return '/api';
}

/** Root URL for socket.io (same-origin when the API base is relative). */
export function getSocketUrl() {
  const base = getApiBase();
  if (base === '/api') return undefined; // io() with no URL = same origin
  return base.replace(/\/api\/?$/, '');
}

/**
 * fetch() that retries once against same-origin `/api` when the configured
 * host is unreachable (phone PWA vs. stale localhost bundle, DNS hiccups).
 * Only true network errors trigger the retry — HTTP 4xx/5xx pass through.
 */
export async function fetchApi(path, options = {}) {
  const base = getApiBase();
  try {
    return await fetch(`${base}${path}`, options);
  } catch (err) {
    if (base !== '/api') {
      return fetch(`/api${path}`, options);
    }
    throw err;
  }
}

// Debug handle: `window.__MEDIKSHA_API__()` in remote devtools.
try {
  window.__MEDIKSHA_API__ = getApiBase;
} catch {
  /* non-browser (tests) — ignore */
}
