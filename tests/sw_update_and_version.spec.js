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

// B166 (Regression von B152, gefunden per echtem Zwei-Versionen-Live-Test
// gegen den deployten Build): 'updatefound' feuert laut Spec nur, wenn ein
// Worker NEU nach 'installing' übergeht — nie einfach weil ein Worker
// bereits im 'waiting'-Zustand sitzt. Lädt die Seite in einem frischen JS-
// Kontext (neuer Tab, oder ein Reload NACHDEM ein früherer Reload bereits
// einen Worker warten ließ), feuert in diesem Kontext kein 'updatefound'
// mehr für den bereits wartenden Worker — ui.js' _pendingSwRegistration
// blieb dadurch null, der Klick-Handler fiel auf den '!waiting'-Fallback
// (sofortiger Reload OHNE SKIP_WAITING) zurück. Fix: registerSW.js prüft
// jetzt direkt nach register(), ob registration.waiting bereits existiert,
// und feuert in dem Fall sofort dasselbe train:sw-update-ready-Event.
//
// Dieser Test ruft registerServiceWorker() ein zweites Mal auf (die echte,
// beim normalen Seitenladen bereits erfolgte erste Registrierung bleibt
// unberührt bestehen) mit einem gemockten navigator.serviceWorker.register(),
// das eine bereits "wartende" Registration zurückgibt, OHNE je ein
// 'updatefound'-Event zu feuern — genau das Szenario aus dem Live-Test.
test('B166: registerServiceWorker() erkennt bereits wartenden Worker auch OHNE updatefound-Event', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page);

  await page.evaluate(async () => {
    window.__swTestPosted = null;
    const fakeWaiting = {
      postMessage: (msg) => { window.__swTestPosted = { source: 'waiting', msg }; },
    };
    // Kein 'updatefound' wird je gefeuert — nur .waiting ist bereits gesetzt,
    // exakt wie bei einem Worker, der schon vor dieser Seitenladung wartete.
    const fakeRegistration = {
      waiting: fakeWaiting,
      installing: null,
      addEventListener: () => {}, // 'updatefound' hört hier bewusst nie zu
    };
    const originalRegister = navigator.serviceWorker.register.bind(navigator.serviceWorker);
    navigator.serviceWorker.register = async () => fakeRegistration;
    try {
      const mod = await import('/registerSW.js');
      await mod.registerServiceWorker();
    } finally {
      navigator.serviceWorker.register = originalRegister;
    }
  });

  // Der initiale registration.waiting-Check in registerSW.js muss das Event
  // OHNE jedes updatefound gefeuert haben -> Banner erscheint trotzdem.
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

  // B62 (Runde 13): Registrierung passiert seit diesem Sprint nicht mehr
  // automatisch beim Laden, sondern erst nach der ersten Trainingsaktion
  // (timer.js '_ensureSessionStart()'). seed() hier hat keine Übungen/Tage
  // für eine echte UI-Interaktion -- das Trigger-Event direkt zu feuern
  // simuliert exakt das, was index.html im echten Betrieb dafür abhört.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('train:sw-register-trigger'));
  });

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

// Runde 11: das Update-Banner hatte bisher NUR den "Jetzt aktualisieren"-
// Button, keine Möglichkeit, es bewusst für den Moment wegzuklicken (siehe
// ui.js-Kommentar "kein Auto-Dismiss"). Neuer "Später"-Button blendet den
// Banner rein DOM-lokal aus (kein state.js, kein localStorage) -- beim
// nächsten Page-Load erscheint er ohnehin erneut, solange ein Update wartet
// (bereits durch den B166-Fix oben garantiert, hier nicht erneut getestet).

test('"Später"-Button blendet den Banner aus, ohne zu aktualisieren', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page);

  await page.evaluate(() => {
    const fakeRegistration = { waiting: { postMessage: () => {} } };
    window.dispatchEvent(new CustomEvent('train:show-update-banner', {
      detail: { registration: fakeRegistration },
    }));
  });

  await expect(page.locator('#sw-update-banner')).toHaveClass(/is-visible/);

  await page.click('#sw-update-later-btn');

  await expect(page.locator('#sw-update-banner')).not.toHaveClass(/is-visible/);
  // Kein Reload, kein SKIP_WAITING -- "Später" ist rein kosmetisch.
  expect(page.url()).toContain('localhost');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Mehrere-Deploys-Szenario: nach "Später" erscheint der Banner bei einem weiteren Update erneut und zielt auf den NEUESTEN wartenden Worker', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page);

  // Deploy 1: Banner erscheint, Nutzer klickt "Später" (reagiert nicht).
  await page.evaluate(() => {
    window.__swTestPosted = null;
    const staleWaiting = {
      postMessage: (msg) => { window.__swTestPosted = { source: 'stale', msg }; },
    };
    window.dispatchEvent(new CustomEvent('train:show-update-banner', {
      detail: { registration: { waiting: staleWaiting } },
    }));
  });
  await expect(page.locator('#sw-update-banner')).toHaveClass(/is-visible/);
  await page.click('#sw-update-later-btn');
  await expect(page.locator('#sw-update-banner')).not.toHaveClass(/is-visible/);

  // Deploy 2 (simuliert zwei weitere, während der Nutzer nicht reagiert hat):
  // ein NEUER wartender Worker ersetzt den alten -- exakt das, was
  // registerSW.js bei jedem weiteren 'updatefound' feuert.
  await page.evaluate(() => {
    const freshWaiting = {
      postMessage: (msg) => { window.__swTestPosted = { source: 'fresh', msg }; },
    };
    window.dispatchEvent(new CustomEvent('train:show-update-banner', {
      detail: { registration: { waiting: freshWaiting } },
    }));
  });

  // Banner muss trotz vorherigem "Später"-Klick erneut erscheinen.
  await expect(page.locator('#sw-update-banner')).toHaveClass(/is-visible/);

  await page.click('#sw-update-btn');

  // SKIP_WAITING muss an den NEUESTEN Worker gehen, nicht an den
  // veralteten aus Deploy 1.
  const posted = await page.evaluate(() => window.__swTestPosted);
  expect(posted.source).toBe('fresh');
  expect(posted.msg).toEqual({ type: 'SKIP_WAITING' });

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
