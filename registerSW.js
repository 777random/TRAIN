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
    const registration = await navigator.serviceWorker.register('./sw.js', {
      scope: '/',
    });

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
