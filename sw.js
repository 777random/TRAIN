/**
 * sw.js – Service Worker for TRAIN PWA
 *
 * Strategy:
 *   • App shell (HTML, CSS, JS, fonts) → Cache-First with background refresh.
 *     The app loads instantly from cache; stale assets are replaced silently
 *     and become active on the next visit. Fonts are self-hosted (same-origin)
 *     since train-v174 — no more separate Google-Fonts runtime-caching branch.
 *
 *   • Everything else → NetworkOnly (e.g., analytics, CDN scripts not listed
 *     in PRECACHE – they fail gracefully if offline).
 *
 * Cache versioning:
 *   Bump CACHE_VERSION when releasing a new build.  The activate handler
 *   deletes all caches with a different version prefix, preventing stale
 *   asset conflicts.
 */

const CACHE_VERSION  = 'train-v241';

/**
 * App shell – every file the app needs to render its first frame offline.
 * Adjust this list whenever you add/rename files in your build.
 */
// B62 (Runde 13, Council-Entscheidung): datenschutz.html + Badge-PNGs
// bewusst NICHT precached — für die reine Trainingsausführung entbehrlich,
// werden bei tatsächlichem Zugriff (Datenschutz-Link in Settings,
// Badge-Galerie) ganz normal per Netzwerk geladen und von der bestehenden
// cacheFirstWithRefresh()-Strategie unten automatisch nachgecacht. Alle
// JS-Module + Fonts bleiben precached (SPA-Architektur — praktisch jedes
// Modul wird für den Kernablauf gebraucht; Fonts ohne Precache verursachen
// einen sichtbaren FOUC beim Erstladen).
const PRECACHE_URLS = [
  './',
  './index.html',
  './state.js',
  './backup.js',
  './ui.js',
  './timer.js',
  './icons.js',
  './dragdrop.js',
  './styles.css',
  './registerSW.js',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './insightEngine.js',
  './triggerEngine.js',
  './weightRecommendation.js',
  './progressChart.js',
  './weekReview.js',
  './weekReviewModal.js',
  './shareImage.js',
  './plateauDetector.js',
  './setUtils.js',
  './exerciseNameCleanup.js',
  './progressInsights.js',
  './weeklyFocus.js',
  './movementMap.js',
  './overallPerformance.js',
  './consistencyUtils.js',
  './sessionCoach.js',
  './sessionSummary.js',
  './exerciseAlternatives.js',
  './fonts/BebasNeue-latin.woff2',
  './fonts/BebasNeue-latinext.woff2',
  './fonts/DMSans-latin.woff2',
  './fonts/DMSans-latinext.woff2',
];


// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', event => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_URLS))
      // KEIN automatisches self.skipWaiting() hier — der neue Worker soll in
      // 'installed' warten, bis die UI per postMessage({type:'SKIP_WAITING'})
      // eine bewusste Nutzer-Aktion bestätigt (siehe 'message'-Handler unten).
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
            .filter(key => key !== CACHE_VERSION)
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

// ─── Message handling ─────────────────────────────────────────────────────────
//
// UI layer (ui.js '#sw-update-btn' click) sends:
//   registration.waiting.postMessage({ type: 'SKIP_WAITING' })
// (targets the new, waiting worker directly — not navigator.serviceWorker.controller,
// which is still the OLD active worker at that point). This is the ONLY way this
// worker ever skips waiting — see 'install' above.
//
// UI layer (ui.js Settings-Tab, einmalig beim Rendern) sends:
//   navigator.serviceWorker.controller.postMessage({ type: 'GET_VERSION' })
// to read the running CACHE_VERSION at runtime (sw.js is a classic script, not
// an ES module, so ui.js cannot import CACHE_VERSION directly).

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data?.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'VERSION', version: CACHE_VERSION });
  }
});
