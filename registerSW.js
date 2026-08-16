/**
 * registerSW.js – Service Worker registration for TRAIN.
 *
 * Import this module once at the bottom of your HTML shell or from main.js.
 * It is intentionally separate from state.js so the data layer has zero
 * dependency on browser APIs beyond localStorage.
 *
 * Also handles the 'train:storage-error' custom event emitted by state.js
 * when localStorage quota is exceeded, so the UI can prompt the user to
 * download a JSON backup.
 */

// ─── Service Worker registration ─────────────────────────────────────────────

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.info('[SW] Service workers not supported in this browser.');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js');

    // B166 Fix: 'updatefound' fires (per spec) only when a worker NEWLY
    // transitions into the 'installing' state — never merely because a
    // worker already sits in 'waiting' at the moment this script runs. If
    // the page loads in a fresh JS context (new tab, or a reload that
    // happens after an earlier reload already left a worker waiting), this
    // registration's 'updatefound' will never fire again for that worker,
    // so without this check the update banner logic downstream (ui.js'
    // _pendingSwRegistration) would never learn an update is ready.
    if (registration.waiting) {
      window.dispatchEvent(new CustomEvent('train:sw-update-ready', {
        detail: { registration },
      }));
    } else if (registration.installing) {
      // Nice-to-have: an update is already mid-download/installing while
      // this page loads (so 'updatefound' won't fire for it either, since
      // it already transitioned before we attached the listener below).
      // Mirrors the exact event structure of the updatefound handler.
      const installingWorker = registration.installing;
      installingWorker.addEventListener('statechange', () => {
        if (
          installingWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          window.dispatchEvent(new CustomEvent('train:sw-update-ready', {
            detail: { registration },
          }));
        }
      });
    }

    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      newWorker?.addEventListener('statechange', () => {
        if (
          newWorker.state === 'installed' &&
          navigator.serviceWorker.controller
        ) {
          // A new version is ready. Dispatch a UI event so the app can show
          // a "Update available – Neu laden?" banner if desired.
          window.dispatchEvent(new CustomEvent('train:sw-update-ready', {
            detail: { registration },
          }));
        }
      });
    });

    // Solotest-Feedback (2026-08-16): eine installierte PWA (Android WebAPK)
    // führt beim Zurückkehren aus dem Hintergrund KEIN Neuladen von
    // registerSW.js aus — mountTimer()/registerServiceWorker() läuft nur
    // einmal beim ersten Start. Der Browser prüft zwar selbständig
    // periodisch auf SW-Updates, aber ohne einen erneuten Check hier bleibt
    // ein zwischenzeitlich fertig heruntergeladener, wartender Worker
    // unentdeckt -- das Update-Banner erschien dadurch bei Resume-aus-
    // Hintergrund nie, nur bei einem vollständigen Neuladen der Seite.
    // visibilitychange (Tab-/App-Wechsel) + pageshow (bfcache-Restore)
    // decken zusammen die relevanten Resume-Fälle ab. registration.update()
    // stößt zusätzlich aktiv einen Update-Check an (kein automatischer
    // Reload, nur Download+Installation im Hintergrund).
    const _recheckForUpdate = () => {
      if (document.visibilityState !== 'visible') return;
      registration.update().catch(() => { /* Netzwerkfehler ignorieren, nächster Trigger versucht es erneut */ });
      if (registration.waiting) {
        window.dispatchEvent(new CustomEvent('train:sw-update-ready', {
          detail: { registration },
        }));
      }
    };
    document.addEventListener('visibilitychange', _recheckForUpdate);
    window.addEventListener('pageshow', _recheckForUpdate);

    console.info('[SW] Registered, scope:', registration.scope);
  } catch (err) {
    console.error('[SW] Registration failed:', err);
  }
}

// ─── Storage quota error handler ─────────────────────────────────────────────

/**
 * Call once during app boot. Listens for the custom event emitted by
 * state.js when localStorage.setItem() throws a QuotaExceededError and
 * invokes the provided callback so the UI layer can show a warning/prompt.
 *
 * @param {function(ErrorEvent): void} onError
 */
export function onStorageError(onError) {
  window.addEventListener('train:storage-error', event => {
    console.error('[TRAIN] localStorage quota exceeded:', event.detail);
    onError(event);
  });
}

/**
 * Listens for the SW update-ready event and invokes the callback.
 * The callback receives the ServiceWorkerRegistration so the UI can
 * call registration.waiting.postMessage({ type: 'SKIP_WAITING' }) to
 * immediately activate the new SW.
 *
 * @param {function(CustomEvent): void} onUpdate
 */
export function onSwUpdateReady(onUpdate) {
  window.addEventListener('train:sw-update-ready', onUpdate);
}
