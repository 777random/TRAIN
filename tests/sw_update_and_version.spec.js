import { test, expect } from '@playwright/test';

// Onboarding-Overlay überdeckt die App und blockiert Klicks (siehe
// tests/settings_reorg.spec.js) — Seed mit onboardingDone:true, um es zu
// überspringen, analog zum dortigen seed()-Muster.
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

// Pre-Launch-Fix-Sprint (train-v223+): Service-Worker-Update aktiviert nicht
// zuverlässig (P0) + hartkodiertes Versions-Label (Minor).
//
// Root Cause Fix 1: der '#sw-update-btn' Klick-Handler postete SKIP_WAITING an
// navigator.serviceWorker.controller (der ALTE, bereits aktive Worker) statt
// an registration.waiting (der NEUE, wartende Worker) — self.skipWaiting() im
// aktiven Worker ist ein No-op. Fix: ui.js hält jetzt die Registrierung aus
// dem 'train:show-update-banner'-Event in einer Modul-Variable
// (_pendingSwRegistration) und postet an deren `.waiting`.
//
// Ein echter End-to-End-Test (zwei tatsächliche SW-Versionen erzeugen, eine
// davon zum "waiting" bringen) ist im Playwright-Headless-Kontext nicht
// praktikabel zu erzwingen (siehe CLAUDE.md/AGENTS.md zu Infra-Grenzen) — der
// Test unten verifiziert stattdessen den exakten Code-Pfad direkt: eine fake
// `registration` mit `.waiting`-Mock wird über denselben Event eingespeist,
// den index.html im echten Betrieb feuert, und geprüft, dass GENAU dieses
// `.waiting`-Objekt das SKIP_WAITING-postMessage empfängt (nicht irgendein
// anderer Pfad). Das deckt exakt den Bug (falsches Ziel-Objekt) ab, ohne einen
// brüchigen echten Zwei-Versionen-Update-Zyklus simulieren zu müssen.

test('SW-Update-Handler postet SKIP_WAITING an registration.waiting, nicht an controller', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page);

  // Simuliert exakt das, was registerSW.js -> index.html im echten Update-Fall
  // feuert: 'train:show-update-banner' mit { detail: { registration } }.
  await page.evaluate(() => {
    window.__swTestPosted = null;
    const fakeWaiting = {
      postMessage: (msg) => { window.__swTestPosted = { source: 'waiting', msg }; },
    };
    const fakeRegistration = { waiting: fakeWaiting };
    window.dispatchEvent(new CustomEvent('train:show-update-banner', {
      detail: { registration: fakeRegistration },
    }));
  });

  await expect(page.locator('#sw-update-banner')).toHaveClass(/is-visible/);

  await page.click('#sw-update-btn');

  const posted = await page.evaluate(() => window.__swTestPosted);
  expect(posted).toEqual({ source: 'waiting', msg: { type: 'SKIP_WAITING' } });

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Versions-Label zeigt die per Laufzeit-Message abgefragte CACHE_VERSION statt eines hartkodierten Strings', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page);

  const hasSW = await page.evaluate(() => 'serviceWorker' in navigator);
  if (hasSW) {
    // Auf der REGISTRIERENDEN Seite selbst ist navigator.serviceWorker.controller
    // i.d.R. noch null (kein 'message'-Empfänger möglich) — erst nach einem
    // Reload ist die Seite tatsächlich vom (jetzt aktiven) Worker kontrolliert.
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload();
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  }

  await page.click('[data-tab="settings"]');

  const label = page.locator('#sw-version-label');
  await expect(label).toBeVisible();

  if (hasSW) {
    // Echter Roundtrip: GET_VERSION -> sw.js -> VERSION-Antwort -> DOM-Patch.
    await expect(label).toHaveText(/^TRAIN train-v\d+$/, { timeout: 8000 });
  } else {
    // Fallback-Pfad ohne aktiven Controller (z.B. allererstes Laden).
    await expect(label).toHaveText('TRAIN');
  }

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
