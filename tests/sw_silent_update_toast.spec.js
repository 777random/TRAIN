import { test, expect } from '@playwright/test';

// Nutzer-Feedback (2026-08-17): "Später" gedrückt -> Update-Banner kommt beim
// nächsten App-Öffnen nicht mehr. Ursache: ein wartender Worker aktiviert
// sich automatisch (Browser-Standardverhalten), sobald der alte Worker keine
// Clients mehr hat -- typisch beim vollständigen Schließen+Neuöffnen der
// installierten App. registration.waiting ist beim nächsten Start dann
// bereits leer, das Update WURDE angewendet, nur ohne jede Rückmeldung.
// registerSW.js vergleicht seither die aktuell aktive CACHE_VERSION gegen die
// beim letzten Aufruf gespeicherte (localStorage 'train_last_sw_version') und
// zeigt bei Abweichung (nicht beim allerersten Laden) einen einmaligen
// Bestätigungs-Toast. Analog zum echten GET_VERSION-Roundtrip-Test in
// sw_update_and_version.spec.js ("Versions-Label...").

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// Registriert den echten Worker (falls unterstützt) und bringt die Seite in
// den Zustand "vom aktiven Worker kontrolliert" (navigator.serviceWorker.
// controller gesetzt) -- identisches Muster wie der Versions-Label-Test.
async function registerAndGetControlled(page) {
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('train:sw-register-trigger')));
  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
  if (!hasSW) return false;
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  return true;
}

test('Abweichende gespeicherte Version -> einmaliger "im Hintergrund aktualisiert"-Toast', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!hasSW, 'Service Worker nicht unterstützt in diesem Kontext');

  // Simuliert einen vorherigen Besuch auf einer älteren Version.
  await page.evaluate(() => localStorage.setItem('train_last_sw_version', 'train-v0-fake-old'));

  await registerAndGetControlled(page);

  await expect(page.locator('#toast')).toHaveClass(/is-visible/, { timeout: 8000 });
  await expect(page.locator('#toast')).toContainText('im Hintergrund aktualisiert');

  const stored = await page.evaluate(() => localStorage.getItem('train_last_sw_version'));
  expect(stored).toMatch(/^train-v\d+$/);
  expect(stored).not.toBe('train-v0-fake-old');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Explizites "Jetzt aktualisieren" (Consent-Flag gesetzt) zeigt KEINEN Silent-Update-Toast', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!hasSW, 'Service Worker nicht unterstützt in diesem Kontext');

  await page.evaluate(() => {
    localStorage.setItem('train_last_sw_version', 'train-v0-fake-old');
    // Simuliert exakt das, was ui.js' '#sw-update-btn'-Klick VOR dem Reload setzt.
    localStorage.setItem('train_explicit_update_consent', 'true');
  });

  await registerAndGetControlled(page);

  // Kurz warten und sicherstellen, dass KEIN Toast mit diesem Text erscheint
  // (statt auf Abwesenheit eines Elements zu prüfen, das aus anderen Gründen
  // ohnehin nie existiert -- #toast kann für andere Zwecke sichtbar sein).
  await page.waitForTimeout(1500);
  const toastText = await page.locator('#toast').textContent().catch(() => '');
  expect(toastText ?? '').not.toContain('im Hintergrund aktualisiert');

  // Consent-Flag wird verbraucht (entfernt), nicht dauerhaft stehengelassen.
  const consentAfter = await page.evaluate(() => localStorage.getItem('train_explicit_update_consent'));
  expect(consentAfter).toBeNull();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Allererstes Laden (keine gespeicherte Vorversion) zeigt keinen Toast, speichert aber die aktuelle Version', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
  test.skip(!hasSW, 'Service Worker nicht unterstützt in diesem Kontext');

  await page.evaluate(() => localStorage.removeItem('train_last_sw_version'));

  await registerAndGetControlled(page);

  await page.waitForTimeout(1500);
  const toastText = await page.locator('#toast').textContent().catch(() => '');
  expect(toastText ?? '').not.toContain('im Hintergrund aktualisiert');

  const stored = await page.evaluate(() => localStorage.getItem('train_last_sw_version'));
  expect(stored).toMatch(/^train-v\d+$/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
