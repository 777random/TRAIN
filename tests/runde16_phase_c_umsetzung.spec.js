import { test, expect } from '@playwright/test';

// Runde 16 (Launch-Roadmap Phase C, Umsetzung): Settings-Restrukturierung
// (Ziele-Karte, Cross-Reference-Deep-Link, Datenschutz/Impressum-Collapse)
// + Wiederherstellung zweier seit B169 (Runde 6) toter Funktionen
// (edit-day-field, autofill-rpe). Beide waren vorher über keinen
// UI-Pfad erreichbar -- Tests hier üben den echten Klick-Pfad aus
// (AGENTS.md-Realpfad-Regel für Validierungs-/Gatekeeper-Logik), nicht nur
// State-Injektion.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [
      { weight: 40, reps: 8, rpe: 7, status: 'pending', done: false, note: '' },
      { weight: 40, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
    ],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 2, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null, showPlates: true,
    ...overrides,
  };
}

function mkWeek(ex, dayOverrides = {}) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Push Tag', subtitle: 'Brust & Trizeps', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, sessionNote: '',
      exercises: [ex],
      ...dayOverrides,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, ex = mkEx('Bankdrücken'), settingsOverrides = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, settingsOverrides }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], templates: [],
      settings: { sessionCoach: false, rpeEnabled: true, ...settingsOverrides },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weekArg: mkWeek(ex), settingsOverrides });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// ─── Cluster 1a: Ziele-Karte ────────────────────────────────────────────────

test('Ziele-Karte: Trainingsziel + Ernaehrungsphase stehen in eigener Karte vor der Training-Karte, funktional unveraendert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  await page.click('[data-tab="settings"]');

  const sections = page.locator('#settings-tab-content .settings-section');
  await expect(sections.first().locator('.settings-section__title')).toHaveText('Ziele');
  await expect(sections.first().locator('[data-action="set-goal"]')).toHaveCount(3);
  await expect(sections.first().locator('[data-action="set-nutrition-phase"]')).toHaveCount(3);

  // Trainingsziel steht NICHT mehr in der "Training"-Gruppe (der langen Liste).
  const trainingGroup = page.locator('.settings-group-title', { hasText: 'Training' }).locator('..');
  await expect(trainingGroup.locator('[data-action="set-goal"]')).toHaveCount(0);

  await page.click('[data-action="set-goal"][data-goal="muskelaufbau"]');
  await expect(page.locator('[data-action="set-goal"][data-goal="muskelaufbau"]')).toHaveClass(/is-selected/);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.goal);
  expect(st).toBe('muskelaufbau');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── Cluster 2c: Cross-Reference-Deep-Link ──────────────────────────────────

test('Ziele-Karte: Deep-Link "zu den Uebungseinstellungen" wechselt in den Training-Tab', async ({ page }) => {
  await seed(page);
  await page.click('[data-tab="settings"]');

  await page.click('[data-action="goto-ex-settings"]');
  await expect(page.locator('#page-workout')).toHaveClass(/is-active/);
});

// ─── Cluster 1c: Datenschutz/Impressum-Collapse (<details> statt onclick) ───

test('Datenschutz/Impressum: <details>-Mechanismus oeffnet und zeigt Inhalt (echter Klick)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  await page.click('[data-tab="settings"]');

  const privacySummary = page.locator('details.deload-details summary', { hasText: 'Datenschutz' });
  const privacyDetails = privacySummary.locator('..');
  await expect(privacyDetails).not.toHaveJSProperty('open', true);
  await privacySummary.click();
  await expect(privacyDetails).toHaveJSProperty('open', true);
  await expect(privacyDetails).toContainText('Trainingsdaten bleiben');

  const impressumSummary = page.locator('details.deload-details summary', { hasText: 'Impressum' });
  const impressumDetails = impressumSummary.locator('..');
  await impressumSummary.click();
  await expect(impressumDetails).toHaveJSProperty('open', true);
  await expect(impressumDetails).toContainText('§ 5 TMG/DDG');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── Cluster 2a: edit-day-field wiederhergestellt ───────────────────────────
// Seit B169 (Runde 6, train-v227) zeigte die offene Tagesansicht Titel/
// Subtitle ueberhaupt nicht mehr an -- der Case-Handler existierte weiter,
// war aber ueber keinen Trigger erreichbar. Test uebt den echten Klick-Pfad
// aus (Tap auf Titel -> Input erscheint -> Tippen -> Blur -> Persistenz).

test('edit-day-field: Tag-Titel per echtem Klick umbenennen, persistiert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  const titleSpan = page.locator('.day-body-header [data-action="edit-day-field"][data-field="title"]');
  await expect(titleSpan).toBeVisible();
  await expect(titleSpan).toHaveText('Push Tag');
  await titleSpan.click();

  const input = page.locator('.day-inline-edit--title');
  await expect(input).toBeVisible();
  await expect(input).toHaveValue('Push Tag');
  await input.fill('Oberkörper A');
  await input.blur();
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.weeks[0].days[0].title).toBe('Oberkörper A');
  await expect(page.locator('.day-body-header [data-action="edit-day-field"][data-field="title"]')).toHaveText('Oberkörper A');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('edit-day-field: Tag-Subtitle per echtem Klick umbenennen, persistiert', async ({ page }) => {
  await seed(page);

  const subSpan = page.locator('.day-body-header [data-action="edit-day-field"][data-field="subtitle"]');
  await expect(subSpan).toHaveText('Brust & Trizeps');
  await subSpan.click();

  const input = page.locator('.day-inline-edit--sub');
  await input.fill('Push Focus');
  await input.blur();
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.weeks[0].days[0].subtitle).toBe('Push Focus');
});

test('edit-day-field: leeres Subtitle zeigt Platzhalter "Schwerpunkt …"', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken'), {});
  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    st.weeks[0].days[0].subtitle = '';
    localStorage.setItem('train_v6', JSON.stringify(st));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await expect(page.locator('.day-subtitle-placeholder')).toHaveText('Schwerpunkt …');
});

// ─── Cluster 2b: autofill-rpe wiederhergestellt ─────────────────────────────
// Pendant zum weiterhin aktiven autofill-down (Wdh); Reducer SET_AUTOFILL_RPE
// existierte bereits, aber ohne Trigger unerreichbar.

test('autofill-rpe: RPE von Satz 1 per echtem Klick auf Satz 2 uebernehmen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page); // Satz 0 hat rpe:7, Satz 1 hat rpe:null

  const autofillBtn = page.locator('[data-action="autofill-rpe"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(autofillBtn).toBeVisible();
  await autofillBtn.click();
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.weeks[0].days[0].exercises[0].sets[1].rpe).toBe(7);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('autofill-rpe: Button erscheint nicht wenn Satz 1 noch kein RPE hat', async ({ page }) => {
  const ex = mkEx('Bankdrücken', {
    sets: [
      { weight: 40, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
      { weight: 40, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
    ],
  });
  await seed(page, ex);
  await expect(page.locator('[data-action="autofill-rpe"][data-di="0"][data-ei="0"][data-si="0"]')).toHaveCount(0);
});

test('autofill-rpe: Button erscheint nicht beim letzten Satz (kein naechster Satz zum Uebernehmen)', async ({ page }) => {
  await seed(page); // 2 Sätze, si=1 ist der letzte
  await expect(page.locator('[data-action="autofill-rpe"][data-di="0"][data-ei="0"][data-si="1"]')).toHaveCount(0);
});
