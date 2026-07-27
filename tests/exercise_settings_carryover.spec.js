import { test, expect } from '@playwright/test';

// B124: Beim Hinzufügen einer bereits bekannten Übung (case-insensitive
// Namensvergleich) sollen weightStep/targetReps/pauseSec/progressionType/
// metric/tags von einem bestehenden Exemplar übernommen werden -- NICHT
// weight/sets (die bleiben immer frisch). Suchreihenfolge, erster Treffer
// gewinnt: aktueller Tag (andere Position) -> andere Tage dieser Woche ->
// letzte Woche -> aeltere Wochen.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkExercise(name, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: null, status: 'success', done: true, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null, tags: [],
    ...overrides,
  };
}

function mkDay(id, title, exercises) {
  return {
    id, title, subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, startDate, days) {
  return {
    id, startDate, note: '', mode: 'standard', days,
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function isoMondayOffset(weeksOffset) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow) + weeksOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

async function seed(page, { weeks, curIdx = 0 }) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeks, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

async function addViaSearch(page, di, name) {
  await page.click(`.day-tab[data-day-hdr="${di}"]`);
  await page.waitForTimeout(150);
  await page.click(`[data-action="open-ex-search"][data-di="${di}"]`);
  await page.fill('#ex-search-input', name);
  await page.waitForTimeout(150);
  const item = page.locator(`[data-action="ex-search-pick"][data-name="${name}"]`);
  if (await item.count() > 0) {
    await item.click();
  } else {
    await page.click('[data-action="ex-search-create"]');
    await page.click('[data-action="ex-form-submit"]');
  }
}

test('Übernimmt Einstellungen einer anderen Übung dieser Woche, aber NICHT Gewicht/Sätze', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const dayA = mkDay(11, 'Tag A', [mkExercise('Bankdrücken', {
    weightStep: 5, targetReps: 6, pauseSec: 180, progressionType: 'weight',
    metric: 'reps', tags: ['wichtig'],
    sets: [{ weight: 100, reps: 6, rpe: 8, status: 'success', done: true, note: '' }],
  })]);
  const dayB = mkDay(12, 'Tag B', []);
  await seed(page, { weeks: [mkWeek(1, todayISO(), [dayA, dayB])] });

  await addViaSearch(page, 1, 'Bankdrücken');

  const st = await readState(page);
  const added = st.weeks[0].days[1].exercises.find(e => e.name === 'Bankdrücken');
  expect(added).toBeTruthy();
  expect(added.weightStep).toBe(5);
  expect(added.targetReps).toBe(6);
  expect(added.pauseSec).toBe(180);
  expect(added.progressionType).toBe('weight');
  expect(added.metric).toBe('reps');
  expect(added.tags).toEqual(['wichtig']);
  // Gewicht/Sätze bleiben frisch -- NICHT die 100kg/6 Wdh von Tag A
  expect(added.sets).toHaveLength(3);
  expect(added.sets[0].weight).toBe(0);
  expect(added.sets[0].status).toBe('pending');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Priorität: Treffer in dieser Woche schlägt Treffer in der letzten Woche', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const thisWeekDayA = mkDay(21, 'Tag A', [mkExercise('Kreuzheben', { weightStep: 10, pauseSec: 240 })]);
  const thisWeekDayB = mkDay(22, 'Tag B', []);
  const lastWeekDay  = mkDay(23, 'Tag A', [mkExercise('Kreuzheben', { weightStep: 2.5, pauseSec: 90 })]);
  await seed(page, {
    weeks: [
      mkWeek(1, isoMondayOffset(-1), [lastWeekDay]),
      mkWeek(2, isoMondayOffset(0), [thisWeekDayA, thisWeekDayB]),
    ],
    curIdx: 1,
  });

  await addViaSearch(page, 1, 'Kreuzheben');

  const st = await readState(page);
  const added = st.weeks[1].days[1].exercises.find(e => e.name === 'Kreuzheben');
  expect(added.weightStep).toBe(10);
  expect(added.pauseSec).toBe(240);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Fallback auf letzte Woche, wenn diese Woche keinen Treffer hat', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const thisWeekDay = mkDay(31, 'Tag A', []);
  const lastWeekDay  = mkDay(32, 'Tag A', [mkExercise('Rudern', { weightStep: 7.5, pauseSec: 150 })]);
  await seed(page, {
    weeks: [
      mkWeek(1, isoMondayOffset(-1), [lastWeekDay]),
      mkWeek(2, isoMondayOffset(0), [thisWeekDay]),
    ],
    curIdx: 1,
  });

  await addViaSearch(page, 0, 'Rudern');

  const st = await readState(page);
  const added = st.weeks[1].days[0].exercises.find(e => e.name === 'Rudern');
  expect(added.weightStep).toBe(7.5);
  expect(added.pauseSec).toBe(150);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Keine History vorhanden -> Standard-Werte wie bisher', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const day = mkDay(41, 'Tag A', []);
  await seed(page, { weeks: [mkWeek(1, todayISO(), [day])] });

  await addViaSearch(page, 0, 'Ganz Neue Uebung Ohne History');

  const st = await readState(page);
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Ganz Neue Uebung Ohne History');
  expect(added).toBeTruthy();
  expect(added.pauseSec).toBe(90);
  expect(added.metric).toBe('reps');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
