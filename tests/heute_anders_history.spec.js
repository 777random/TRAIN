import { test, expect } from '@playwright/test';

// D2: "Heute anders" merkt sich Ersatz-Übungen je Original und schlägt sie
// beim nächsten Mal vor. Reducer-Mechanik (EX_SET_SUBSTITUTE setzt nur
// ex.substituteFor, Umbenennung läuft über das normale EX_UPDATE-Namensfeld)
// bleibt bewusst unverändert — ein neuer Vorschlags-Tap feuert beide
// bestehenden Actions hintereinander aus einem Klick-Handler.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkWeek(exOverrides = {}) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [{
        name: 'Sled Push', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
        prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
        progressionType: 'weight', archived: false, substituteFor: null,
        ...exOverrides,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { week, substituteHistory = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, substituteHistory, includeField }) => {
    const state = {
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    };
    if (includeField) state.substituteHistory = substituteHistory;
    localStorage.setItem('train_v6', JSON.stringify(state));
  }, { weekArg: week ?? mkWeek(), substituteHistory, includeField: true });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function openSubForm(page, di = 0, ei = 0) {
  await page.click(`[data-action="toggle-ex-menu"][data-di="${di}"][data-ei="${ei}"]`);
  await page.click(`[data-action="open-sub-form"][data-di="${di}"][data-ei="${ei}"]`);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('Vorschlag sichtbar + sortiert nach Haeufigkeit, max 3', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, {
    substituteHistory: {
      'Sled Push': [
        { name: 'Leg Press', count: 1, lastUsed: '2026-07-10' },
        { name: 'Bulgarian Split Squats', count: 3, lastUsed: '2026-07-24' },
        { name: 'Goblet Squat', count: 2, lastUsed: '2026-07-20' },
        { name: 'Hack Squat', count: 1, lastUsed: '2026-07-01' },
      ],
    },
  });

  await openSubForm(page);
  const rows = page.locator('.sub-suggestion');
  await expect(rows).toHaveCount(3); // max 3, AC4
  await expect(rows.nth(0).locator('.sub-suggestion__name')).toHaveText('Bulgarian Split Squats');
  await expect(rows.nth(0).locator('.sub-suggestion__count')).toHaveText('3×');
  await expect(rows.nth(1).locator('.sub-suggestion__name')).toHaveText('Goblet Squat');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Vorschlag antippen: Name + substituteFor werden in einem Tap atomar gesetzt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, {
    substituteHistory: { 'Sled Push': [{ name: 'Bulgarian Split Squats', count: 3, lastUsed: '2026-07-24' }] },
  });

  await openSubForm(page);
  await page.click('.sub-suggestion');

  const banner = page.locator('.sub-banner');
  await expect(banner).toHaveText('↔ Heute: Bulgarian Split Squats (statt Sled Push)');

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.name).toBe('Bulgarian Split Squats');
  expect(ex.substituteFor).toBe('Sled Push');
  expect(st.substituteHistory['Sled Push'][0].count).toBe(4); // 3 -> 4, AC6

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Keine History fuer diese Uebung: Feld erscheint direkt wie bisher', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page); // substituteHistory: {}

  await openSubForm(page);
  await expect(page.locator('.sub-suggestions')).toHaveCount(0);
  await expect(page.locator('.sub-name-input')).toBeVisible();
  // B138: Eingabefeld-Label heisst seit train-v222 "Andere Uebung:" (Sprint-
  // Mockup) statt "Ursprüngliche Übung:" -- .sub-form__label ist seither
  // NICHT mehr eindeutig (auch "Vorschläge:" nutzt dieselbe Klasse, siehe
  // die kuratierten Alternativ-Chips fuer "Sled Push"), daher exakter Text-
  // Locator statt der reinen Klasse.
  await expect(page.getByText('Andere Übung:', { exact: true })).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Manueller Pfad unveraendert: umbenennen + Original eintippen erzeugt History-Eintrag', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.fill('[data-action="ex-name"][data-di="0"][data-ei="0"]', 'Leg Press');
  await page.dispatchEvent('[data-action="ex-name"][data-di="0"][data-ei="0"]', 'change');
  await openSubForm(page);
  await page.fill('.sub-name-input[data-di="0"][data-ei="0"]', 'Sled Push');
  await page.click('[data-action="confirm-sub"][data-di="0"][data-ei="0"]');

  const st = await readState(page);
  expect(st.substituteHistory['Sled Push']).toEqual([
    { name: 'Leg Press', count: 1, lastUsed: expect.any(String) },
  ]);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Limit: max 5 Eintraege pro Uebung, aeltester (nach lastUsed) wird entfernt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, {
    substituteHistory: {
      'Sled Push': [
        { name: 'A', count: 1, lastUsed: '2026-07-01' },
        { name: 'B', count: 1, lastUsed: '2026-07-05' },
        { name: 'C', count: 1, lastUsed: '2026-07-10' },
        { name: 'D', count: 1, lastUsed: '2026-07-15' },
        { name: 'E', count: 1, lastUsed: '2026-07-20' },
      ],
    },
  });

  // Umbenennen auf einen 6. neuen Ersatznamen VOR dem Öffnen des Dialogs
  // (der belegte Normalfall, siehe Test "Manueller Pfad unverändert" oben)
  await page.fill('[data-action="ex-name"][data-di="0"][data-ei="0"]', 'F');
  await page.dispatchEvent('[data-action="ex-name"][data-di="0"][data-ei="0"]', 'change');
  await openSubForm(page);
  await page.fill('.sub-name-input[data-di="0"][data-ei="0"]', 'Sled Push');
  await page.click('[data-action="confirm-sub"][data-di="0"][data-ei="0"]');

  const st = await readState(page);
  const list = st.substituteHistory['Sled Push'];
  expect(list).toHaveLength(5); // AC8
  expect(list.map(e => e.name).sort()).toEqual(['B', 'C', 'D', 'E', 'F'].sort()); // 'A' (ältestes lastUsed) entfernt

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Migration: Bestandsdaten ohne substituteHistory-Feld crashen nicht', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weekArg) => {
    const state = {
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
      // absichtlich KEIN substituteHistory-Feld — simuliert Alt-Daten vor D2
    };
    localStorage.setItem('train_v6', JSON.stringify(state));
  }, mkWeek());
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await openSubForm(page);
  await expect(page.locator('.sub-name-input')).toBeVisible();
  const st = await readState(page);
  expect(st.substituteHistory).toEqual({}); // additiver Default greift, AC9

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
