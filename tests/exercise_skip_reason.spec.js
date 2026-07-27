import { test, expect } from '@playwright/test';

// B129: Übersprungene Übungen abfragen — wenn beim Tagesabschluss eine Übung
// KEINEN einzigen bewerteten Satz hat (alle pending), wird der Grund
// abgefragt (Verletzung/Keine Zeit/Zu müde/Ersetzt/Kein Grund), gespeichert
// als ex.skipReason (+ ex.skipDate nur bei 'injury'). Teilweise bewertete
// Übungen (mind. ein Satz success/fail) lösen die Abfrage NICHT aus.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkPendingSet() { return { weight: 0, reps: 0, rpe: null, status: 'pending', done: false, note: '' }; }
function mkDoneSet(status = 'success') { return { weight: 80, reps: 5, rpe: 7, status, done: status === 'success', note: '' }; }

function mkExercise(name, sets, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets, prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    skipReason: null, skipDate: null,
    targetSets: sets.length, targetReps: 5, progressionType: 'weight',
    progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    ...overrides,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, days, { schemaVersion = 33, extraState = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }];
  await page.evaluate(({ weeks, schemaVersion, extraState }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks,
      customTemplate: [], settings: { sessionCoach: false }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
      ...extraState,
    }));
  }, { weeks, schemaVersion, extraState });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('Komplett übersprungene Übung löst die Skip-Abfrage aus, "Verletzung" setzt skipReason+skipDate', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page, [mkDay(11, [mkExercise('Bankdrücken', [mkPendingSet(), mkPendingSet()])])]);

  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).toContainText('Bankdrücken wurde nicht durchgeführt');
  await page.click('[data-skip-val="injury"]');
  await page.waitForTimeout(150);

  // Danach der normale Bewertungs-Dialog
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.skipReason).toBe('injury');
  expect(ex.skipDate).toBe(todayISO());

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Teilweise bewertete Übung (mind. ein Satz success/fail) löst KEINE Abfrage aus', async ({ page }) => {
  await seed(page, [mkDay(11, [mkExercise('Bankdrücken', [mkDoneSet('success'), mkPendingSet()])])]);

  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).not.toContainText('wurde nicht durchgeführt');
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
});

test('Mehrere übersprungene Übungen werden nacheinander abgefragt', async ({ page }) => {
  await seed(page, [mkDay(11, [
    mkExercise('Bankdrücken', [mkPendingSet()]),
    mkExercise('Kniebeuge', [mkPendingSet()]),
  ])]);

  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).toContainText('Bankdrücken wurde nicht durchgeführt');
  await page.click('[data-skip-val="time"]');
  await page.waitForTimeout(150);
  await expect(page.locator('.completion-modal__title')).toContainText('Kniebeuge wurde nicht durchgeführt');
  await page.click('[data-skip-val="fatigue"]');
  await page.waitForTimeout(150);
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();

  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });

  const st = await readState(page);
  expect(st.weeks[0].days[0].exercises[0].skipReason).toBe('time');
  expect(st.weeks[0].days[0].exercises[1].skipReason).toBe('fatigue');
});

test('Alle 5 Optionen setzen den korrekten skipReason', async ({ page }) => {
  const cases = [
    ['injury', 'injury'], ['time', 'time'], ['fatigue', 'fatigue'],
    ['substituted', 'substituted'], ['', null],
  ];
  for (const [val, expected] of cases) {
    await seed(page, [mkDay(11, [mkExercise('Bankdrücken', [mkPendingSet()])])]);
    await page.click('[data-action="toggle-complete"]');
    await page.click(`[data-skip-val="${val}"]`);
    await page.waitForTimeout(150);
    await page.click('.completion-modal__rate-btn[data-val="2"]');
    await page.click('.completion-modal__skip');
    await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
    const st = await readState(page);
    expect(st.weeks[0].days[0].exercises[0].skipReason).toBe(expected);
    if (expected !== 'injury') expect(st.weeks[0].days[0].exercises[0].skipDate).toBe(null);
  }
});

test('Migration: altes State ohne skipReason/skipDate/nextWeekPlanAutoReviewed lädt ohne Absturz, SCHEMA wird 33', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const oldEx = {
    name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [mkDoneSet('success')], prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false,
    targetSets: 1, targetReps: 5, progressionType: 'weight',
    progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    // bewusst KEIN skipReason/skipDate/nextWeekPlanAutoReviewed
  };
  await seed(page, [mkDay(11, [oldEx])], { schemaVersion: 30 });

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.skipReason).toBe(null);
  expect(ex.skipDate).toBe(null);
  expect(ex.nextWeekPlanAutoReviewed).toBe(true);
  expect(st.meta.schemaVersion).toBe(33);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
