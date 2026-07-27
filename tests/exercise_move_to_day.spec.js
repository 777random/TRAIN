import { test, expect } from '@playwright/test';

// B125: Neues Feature -- Übung per ⋮-Menü ("↪ Zu anderem Tag verschieben")
// atomar (EXERCISE_MOVE_TO_DAY) in einen anderen, nicht-markedDone Tag
// derselben Woche verschieben. Einstellungen bleiben erhalten, Sätze werden
// frisch/pending. Menüpunkt erscheint nur, wenn mindestens ein anderer,
// nicht abgeschlossener Tag existiert; Ziel-Tag mit gleichnamiger Übung
// blockiert mit Toast statt zu verschieben.

test.use({ viewport: { width: 390, height: 2200 } });

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkExercise(name, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
    sets: [
      { weight: 60, reps: 8, rpe: null, status: 'success', done: true, note: '' },
      { weight: 60, reps: 8, rpe: null, status: 'success', done: true, note: '' },
    ],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null, tags: [],
    ...overrides,
  };
}

function mkDay(id, title, exercises, extra = {}) {
  return {
    id, title, subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    ...extra,
  };
}

async function seed(page, days) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((days) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-20', note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, days);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

async function goToDay(page, di) {
  await page.click(`.day-tab[data-day-hdr="${di}"]`);
  await page.waitForTimeout(150);
}

test('Menüpunkt verschiebt Übung atomar an einen anderen Tag, Sätze werden frisch/pending', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const dayA = mkDay(11, 'Tag A', [mkExercise('Bankdrücken')]);
  const dayB = mkDay(12, 'Tag B', []);
  await seed(page, [dayA, dayB]);
  await goToDay(page, 0);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await expect(page.locator('[data-action="open-move-day"][data-di="0"][data-ei="0"]')).toBeVisible();
  await page.click('[data-action="open-move-day"][data-di="0"][data-ei="0"]');

  await expect(page.locator('#modal-move-ex-day')).toBeVisible();
  await page.click('[data-action="confirm-move-ex-day"][data-to-di="1"]');
  await page.waitForTimeout(150);

  const st = await readState(page);
  expect(st.weeks[0].days[0].exercises).toHaveLength(0);
  const moved = st.weeks[0].days[1].exercises[0];
  expect(moved).toBeTruthy();
  expect(moved.name).toBe('Bankdrücken');
  expect(moved.weightStep).toBe(5);
  // Sätze: gleiche Anzahl (2), aber frisch/pending, nicht die alten Werte
  expect(moved.sets).toHaveLength(2);
  expect(moved.sets[0].status).toBe('pending');
  expect(moved.sets[0].weight).toBe(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Ziel-Tag hat die Übung bereits -> Toast, kein Verschieben', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const dayA = mkDay(11, 'Tag A', [mkExercise('Kniebeuge')]);
  const dayB = mkDay(12, 'Tag B', [mkExercise('Kniebeuge')]);
  await seed(page, [dayA, dayB]);
  await goToDay(page, 0);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="open-move-day"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="confirm-move-ex-day"][data-to-di="1"]');
  await page.waitForTimeout(150);

  await expect(page.locator('.toast')).toContainText('bereits an Tag B vorhanden');

  const st = await readState(page);
  expect(st.weeks[0].days[0].exercises).toHaveLength(1); // unverändert, nicht verschoben
  expect(st.weeks[0].days[1].exercises).toHaveLength(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Nur ein Tag vorhanden -> Menüpunkt wird nicht angezeigt', async ({ page }) => {
  const dayA = mkDay(11, 'Tag A', [mkExercise('Rudern')]);
  await seed(page, [dayA]);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await expect(page.locator('[data-action="open-move-day"]')).toHaveCount(0);
});

test('Markierte Tage (markedDone) erscheinen nicht als Ziel', async ({ page }) => {
  const dayA = mkDay(11, 'Tag A', [mkExercise('Rudern')]);
  const dayB = mkDay(12, 'Tag B', [], { markedDone: true, locked: true });
  const dayC = mkDay(13, 'Tag C', []);
  await seed(page, [dayA, dayB, dayC]);
  await goToDay(page, 0);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="open-move-day"][data-di="0"][data-ei="0"]');

  await expect(page.locator('[data-action="confirm-move-ex-day"][data-to-di="1"]')).toHaveCount(0);
  await expect(page.locator('[data-action="confirm-move-ex-day"][data-to-di="2"]')).toBeVisible();
});
