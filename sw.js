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

const CACHE_VERSION  = 'train-v263';

// Runde 20 (Befund 4): kurze Änderungsliste für den aktuellen Build, im
// Update-Banner beim Aufklappen ("mehr Details") angezeigt. 2-3 knappe
// Stichpunkte, KEIN vollständiger Changelog -- wird von demselben Agent
// gepflegt, der CACHE_VERSION erhöht (gleiche Konvention wie die
// CACHE_VERSION-Erhöhung selbst, siehe AGENTS.md "GRUNDREGEL" Punkt 3).
// Lebt bewusst hier (nicht in einer separaten .js/.json-Datei), weil sw.js
// bei jedem Update-Check ohnehin byte-genau frisch vom Server geladen wird
// (Browser-Update-Algorithmus) -- die Werte sind dadurch garantiert die des
// NEUEN, wartenden Workers, ganz ohne zusätzlichen Cache-Bypass.
const CHANGELOG_ENTRIES = [
  '"Heute anders": kuratierte Alternativ-Vorschläge für Bizepscurls und Trizeps-Pushdown-Varianten korrigiert/ergänzt',
];

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
  './pauseTips.js',
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
      //
      // PWA-Audit (Runde 30): der Fehler wird jetzt weitergeworfen statt nur
      // geloggt -- cache.addAll() ist atomar (alle ~34 URLs oder keine).
      // Vorher fing .catch() den Fehler ab, OHNE ihn erneut zu werfen:
      // event.waitUntil() sah dadurch ein aufgelöstes statt abgelehntes
      // Promise, die Installation galt als erfolgreich, obwohl der Precache
      // komplett leer blieb -- Offline-Nutzung wäre für jede App-Shell-Datei
      // gebrochen gewesen, ohne dass ein Nutzer je etwas davon gesehen hätte.
      // Ein weitergeworfener Fehler lässt den Worker stattdessen korrekt im
      // 'redundant'-Zustand landen; der alte, funktionierende Worker bleibt
      // aktiv, und der nächste Update-Check versucht die Installation erneut.
      .catch(err => { console.error('[SW] Precache failed:', err); throw err; })
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
    event.respondWith(cacheFirstWithRefresh(event, request, CACHE_VERSION));
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
 *
 * PWA-Audit (Runde 30): `networkFetch` läuft bei einem Cache-Hit im
 * Hintergrund WEITER, nachdem diese Funktion (und damit event.respondWith())
 * bereits mit `cached` aufgelöst hat -- ohne einen eigenen
 * event.waitUntil()-Aufruf hat der Worker ab dann keine garantierte
 * Laufzeit mehr und darf laut Spec beendet werden, sobald keine Events mehr
 * offen sind (auf Mobilgeräten oft binnen Sekunden). Der Hintergrund-
 * Refresh, den der Datei-Kopfkommentar oben verspricht ("stale assets are
 * replaced silently... on the next visit"), konnte dadurch praktisch nie
 * zuverlässig fertig laufen. `event` wird jetzt durchgereicht, damit
 * cacheFirstWithRefresh() den Hintergrund-Fetch selbst absichern kann.
 */
async function cacheFirstWithRefresh(event, request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkFetch = fetch(request)
    .then(response => {
      if (response.ok) {
        // PWA-Audit (Runde 30): .catch() ergänzt -- ein QuotaExceededError
        // beim Hintergrund-Cache-Update führte vorher zu einer unhandled
        // promise rejection (nur Browser-Konsolenwarnung, kein Logging im
        // Projekt-Stil). Funktional unschädlich (die Response wird trotzdem
        // zurückgegeben), aber jetzt sichtbar für Diagnosezwecke.
        cache.put(request, response.clone()).catch(err => console.error('[SW] Cache-Refresh fehlgeschlagen:', err));
      }
      return response;
    })
    .catch(() => null); // offline – background refresh fails silently

  if (cached) {
    event.waitUntil(networkFetch);
    return cached;
  }
  return await networkFetch ?? new Response('Offline', { status: 503 });
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
  // Runde 20 (Befund 4): Antwort per MessagePort statt event.source -- ui.js
  // fragt hierüber gezielt den WARTENDEN (noch nicht aktiven) Worker ab, für
  // den event.source-basiertes Antworten browserübergreifend weniger
  // zuverlässig ist als bei einem bereits kontrollierenden Worker.
  if (event.data?.type === 'GET_CHANGELOG') {
    event.ports?.[0]?.postMessage({ type: 'CHANGELOG', version: CACHE_VERSION, entries: CHANGELOG_ENTRIES });
  }
});
