/**
 * sw.js – Service Worker for TRAIN PWA
 *
 * Strategy:
 *   • App shell (HTML, CSS, JS, fonts) → Cache-First with background refresh.
 *     The app loads instantly from cache; stale assets are replaced silently
 *     and become active on the next visit.
 *
 *   • Google Fonts (runtime) → StaleWhileRevalidate so the user always gets
 *     a font (even offline) while keeping it fresh in the background.
 *
 *   • Everything else → NetworkOnly (e.g., analytics, CDN scripts not listed
 *     in PRECACHE – they fail gracefully if offline).
 *
 * Cache versioning:
 *   Bump CACHE_VERSION when releasing a new build.  The activate handler
 *   deletes all caches with a different version prefix, preventing stale
 *   asset conflicts.
 */

const CACHE_VERSION  = 'train-v1';
const FONT_CACHE     = 'train-fonts-v1';

/**
 * App shell – every file the app needs to render its first frame offline.
 * Adjust this list whenever you add/rename files in your build.
 */
const PRECACHE_URLS = [
  './',
  './index.html',
  './state.js',
  './backup.js',
  './ui.js',
  './timer.js',
  './icons.js',
  './styles.css',
  './registerSW.js',
  './manifest.json'
];


// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()) // activate immediately, don't wait for tabs to close
      .catch(err => console.error('[SW] Precache failed:', err))
  );
});

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_VERSION && key !== FONT_CACHE)
            .map(key => {
              console.log('[SW] Deleting old cache:', key);
              return caches.delete(key);
            })
        )
      )
      .then(() => self.clients.claim()) // take control of all open tabs immediately
  );
});

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests; let POST/PUT/DELETE pass through.
  if (request.method !== 'GET') return;

  // ── Google Fonts – StaleWhileRevalidate ────────────────────────────────────
  if (
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(staleWhileRevalidate(request, FONT_CACHE));
    return;
  }

  // ── App shell – Cache-First with background refresh ────────────────────────
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstWithRefresh(request, CACHE_VERSION));
    return;
  }

  // ── Everything else – NetworkOnly ─────────────────────────────────────────
  // (CDN scripts, etc. – fail silently if offline)
});

// ─── Strategy helpers ─────────────────────────────────────────────────────────

/**
 * Cache-First with background refresh.
 * 1. Return cached response immediately (if present).
 * 2. Fetch from network in the background; update cache on success.
 * 3. If not in cache, fetch from network (first visit).
 */
async function cacheFirstWithRefresh(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null); // offline – background refresh fails silently

  return cached ?? await networkFetch ?? new Response('Offline', { status: 503 });
}

/**
 * StaleWhileRevalidate.
 * Return whatever is in cache, and update cache from network in the background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Background revalidation – don't await
  fetch(request)
    .then(response => { if (response.ok) cache.put(request, response.clone()); })
    .catch(() => {});

  if (cached) return cached;

  // Not cached yet – must wait for network (first visit)
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

// ─── Message handling (for future use) ───────────────────────────────────────
//
// The UI layer can send messages to the SW via:
//   navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' })
//
// Useful for "Update available – reload?" prompts.

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
