import { test, expect } from '@playwright/test';

// Runde 17: vier unabhängige Live-Nutzerfeedback-Punkte (2026-08-04).
// Cluster 1 (Plain Mode), Cluster 3 (Plate-Settings-Layout) und Cluster 4
// (Onboarding-Autosave) werden hier über echte Klick-Pfade getestet.
// Cluster 2 (Vibration) ist eine strukturelle Browser-Einschränkung ohne
// Code-Fix -- getestet wird nur die neue Sound-Alternative.

function todayISO() { return new Date().toISOString().split('T')[0]; }

async function seedSettings(page, settingsOverrides = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((settingsOverrides) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [], onboardingDone: true,
      customTemplate: [], templates: [],
      settings: { sessionCoach: true, rpeEnabled: true, ...settingsOverrides },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, settingsOverrides);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="settings"]');
}

// ─── Cluster 1: Plain Mode ───────────────────────────────────────────────

test('Plain Mode: Klick setzt alle 6 Werte korrekt (inkl. invertierter Flags), Indikator wird aktiv', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedSettings(page, {
    sessionCoach: true, rpeEnabled: true, hideStreakBadge: false, hideStopwatch: false,
    autoWeek: { enabled: true, suggestProgress: true, showReview: true },
  });

  const btn = page.locator('[data-action="apply-plain-mode"]');
  await expect(btn).not.toHaveClass(/is-selected/);
  await btn.click();
  await expect(btn).toHaveClass(/is-selected/);
  await expect(btn).toHaveText('✓ Plain Mode aktiv');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings);
  expect(st.sessionCoach).toBe(false);
  expect(st.rpeEnabled).toBe(false);
  expect(st.hideStreakBadge).toBe(true);
  expect(st.hideStopwatch).toBe(true);
  expect(st.autoWeek.suggestProgress).toBe(false);
  expect(st.autoWeek.showReview).toBe(false);
  // Master bleibt bewusst an -- automatische Wochenerstellung soll weiter
  // laufen, nur die beiden Zusatz-Dialoge verschwinden (siehe DECISIONS.md).
  expect(st.autoWeek.enabled).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Plain Mode: Einzel-Toggle bleibt danach normal änderbar, Indikator verschwindet bei Abweichung', async ({ page }) => {
  await seedSettings(page, {
    sessionCoach: true, rpeEnabled: true, hideStreakBadge: false, hideStopwatch: false,
    autoWeek: { enabled: true, suggestProgress: true, showReview: true },
  });

  await page.click('[data-action="apply-plain-mode"]');
  await expect(page.locator('[data-action="apply-plain-mode"]')).toHaveClass(/is-selected/);

  // Einzelnes Setting manuell wieder umschalten -- Preset ist kein Sperr-Modus.
  await page.click('[data-action="toggle-setting"][data-key="rpeEnabled"]');
  await expect(page.locator('[data-action="toggle-setting"][data-key="rpeEnabled"]')).toHaveClass(/is-on/);
  await expect(page.locator('[data-action="apply-plain-mode"]')).not.toHaveClass(/is-selected/);
});

// ─── Cluster 2: Sound-Alternative (Vibration bleibt unveraendert/nicht fixbar) ─

test('Ton nach Pause: Toggle vorhanden und persistiert', async ({ page }) => {
  await seedSettings(page, { soundEnabled: false });
  const toggle = page.locator('[data-action="toggle-setting"][data-key="soundEnabled"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toHaveClass(/is-on/);
  await toggle.click();
  await expect(toggle).toHaveClass(/is-on/);
  const val = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.soundEnabled);
  expect(val).toBe(true);
});

test('Ton nach Pause: AudioContext wird beim Pausenstart (echter Klick) unlocked, Ton spielt beim Pausenende', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.addInitScript(() => {
    window.__audioLog = [];
    class MockOscillator {
      constructor() { this.frequency = { value: 0 }; }
      connect() {}
      start() { window.__audioLog.push('osc-start'); }
      stop() {}
    }
    class MockGain {
      constructor() { this.gain = { setValueAtTime() {}, linearRampToValueAtTime() {} }; }
      connect() {}
    }
    class MockAudioContext {
      constructor() { this.state = 'running'; this.currentTime = 0; window.__audioLog.push('ctx-created'); }
      createOscillator() { return new MockOscillator(); }
      createGain() { return new MockGain(); }
      resume() { this.state = 'running'; return Promise.resolve(); }
    }
    window.AudioContext = MockAudioContext;
  });

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: new Date().toISOString().split('T')[0], note: '', mode: 'standard',
        days: [{
          id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null,
          exercises: [{
            name: 'Bankdrücken', note: '', pauseSec: 1, metric: 'reps', weightStep: 2.5,
            targetReps: 8, targetSets: 2,
            sets: [
              { weight: 40, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
              { weight: 40, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
            ],
          }],
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      onboardingDone: true,
      customTemplate: [], templates: [],
      settings: { sessionCoach: false, rpeEnabled: false, soundEnabled: true, autoStartPauseTimer: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="0"]');
  // AudioContext wird SOFORT beim Pausenstart erzeugt (echter Klick-Kontext).
  await expect.poll(() => page.evaluate(() => window.__audioLog)).toContain('ctx-created');

  // pauseSec:1 -> Pause endet nach ~1s, Ton spielt dann.
  await expect.poll(
    () => page.evaluate(() => window.__audioLog),
    { timeout: 5000 },
  ).toContain('osc-start');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── Cluster 3: Plate-Settings nebeneinander ────────────────────────────────

test('Plate-Settings: Stangengewicht + Groesste Hantelscheibe im gemeinsamen Grid, funktional unveraendert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedSettings(page);

  const grid = page.locator('.body-grid').filter({ has: page.locator('[data-action="set-barbell-weight"]') });
  await expect(grid).toHaveCount(1);
  await expect(grid.locator('[data-action="set-barbell-weight"]')).toBeVisible();
  await expect(grid.locator('[data-action="set-largest-plate"]')).toHaveCount(3);

  // Funktional unveraendert.
  await page.click('[data-action="set-largest-plate"][data-plate="15"]');
  await expect(page.locator('[data-action="set-largest-plate"][data-plate="15"]')).toHaveAttribute('aria-pressed', 'true');
  const val = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.largestPlate);
  expect(val).toBe(15);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Plate-Settings: bei 375px weiterhin gestapelt, ab 480px nebeneinander', async ({ page }) => {
  await seedSettings(page);
  const barbellRow = page.locator('[data-action="set-barbell-weight"]').locator('..');
  const plateRow   = page.locator('[data-action="set-largest-plate"]').first().locator('../..');

  await page.setViewportSize({ width: 375, height: 800 });
  const yNarrowBarbell = (await barbellRow.boundingBox()).y;
  const yNarrowPlate   = (await plateRow.boundingBox()).y;
  expect(yNarrowPlate).toBeGreaterThan(yNarrowBarbell); // gestapelt -> Plate-Row weiter unten

  await page.setViewportSize({ width: 600, height: 800 });
  const yWideBarbell = (await barbellRow.boundingBox()).y;
  const yWidePlate   = (await plateRow.boundingBox()).y;
  expect(Math.abs(yWidePlate - yWideBarbell)).toBeLessThan(5); // nebeneinander -> gleiche Zeile
});

// ─── Cluster 4: Onboarding-Autosave als Standard-Vorlage ────────────────────

test('Onboarding: gewaehlte Vorlage wird automatisch zur Standard-Vorlage (echter Onboarding-Durchlauf)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=0');
  await page.click('[data-ob="load"]');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.customTemplate.length).toBeGreaterThan(0);
  expect(st.customTemplate[0].exercises.map(ex => ex.name))
    .toEqual(st.weeks[0].days[0].exercises.map(ex => ex.name));

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Onboarding: "Ohne Vorlage starten" laesst die Standard-Vorlage unangetastet (FACTORY_TEMPLATE bleibt)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('[data-ob="skip"]');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  // FACTORY_TEMPLATE hat 3 Tage (A/B/C) -- unveraendert, kein leerer Platzhalter uebernommen.
  expect(st.customTemplate.length).toBe(3);
  expect(st.customTemplate.map(d => d.id)).toEqual(['A', 'B', 'C']);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
