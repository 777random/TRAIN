import { test, expect } from '@playwright/test';

// B127: Zwei unabhängige Notiz-Arten pro Übung.
// - "Heute" (ex.note): tagesspezifisch, neue Live-UI im Trainings-Tab (vorher
//   nur über den Vorlagen-Editor editierbar), wird bei jedem Wochen-/
//   Tages-Klon zurückgesetzt (siehe _resetExerciseSubstitution()).
// - "Immer" (state.exerciseNotes[exName]): permanent, übersteht Wochen-Klone,
//   additiver State-Default ohne SCHEMA_VERSION-Bump.
// s.note (pro Satz) ist ein drittes, unabhängiges, hier unangetastetes Feld.

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

function mkDay(id, title, exercises, extra = {}) {
  return {
    id, title, subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    ...extra,
  };
}

async function seed(page, { weeks, curIdx = 0, exerciseNotes, omitExerciseNotes = false } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeks, curIdx, exerciseNotes, omitExerciseNotes }) => {
    const state = {
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    };
    if (!omitExerciseNotes) state.exerciseNotes = exerciseNotes ?? {};
    localStorage.setItem('train_v6', JSON.stringify(state));
  }, { weeks, curIdx, exerciseNotes, omitExerciseNotes });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('Zwei Tabs (Heute/Immer) schreiben unabhängig in ex.note bzw. state.exerciseNotes', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const day = mkDay(11, 'Tag A', [mkExercise('Bankdrücken')], { markedDone: false, locked: false });
  await seed(page, { weeks: [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }] });

  await page.click('[data-action="toggle-ex-note"][data-di="0"][data-ei="0"]');
  await expect(page.locator('.ex-note-panel')).toBeVisible();

  // "Heute"-Tab ist standardmäßig aktiv
  await page.fill('[data-action="ex-note-heute"]', 'Fühlte sich heute schwer an');
  await page.locator('[data-action="ex-note-heute"]').blur();
  await page.waitForTimeout(150);

  await page.click('[data-action="ex-note-tab"][data-tab="immer"]');
  await page.fill('[data-action="ex-note-immer"]', 'Rack: Loch 7, Griff: 81cm');
  await page.locator('[data-action="ex-note-immer"]').blur();
  await page.waitForTimeout(150);

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.note).toBe('Fühlte sich heute schwer an');
  expect(st.exerciseNotes['Bankdrücken']).toBe('Rack: Loch 7, Griff: 81cm');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('"Immer"-Notiz übersteht eine neue Woche, "Heute"-Notiz wird zurückgesetzt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const day = mkDay(11, 'Tag A', [mkExercise('Kniebeuge', { note: 'Kniee taten weh' })], { markedDone: true, locked: true });
  await seed(page, {
    weeks: [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
    exerciseNotes: { 'Kniebeuge': 'Fersen erhöht, schmaler Stand' },
  });

  await page.click('[data-action="open-new-week"]');
  // Der einzige Tag ist markedDone -> Wochenrückblick-Modal kommt zuerst.
  await page.click('#wr-btn-continue');
  await page.waitForSelector('#modal-new-week', { state: 'visible' });
  await page.click('[data-action="create-week"]');
  await page.waitForTimeout(200);

  const st = await readState(page);
  expect(st.weeks.length).toBeGreaterThan(1);
  const newWeekEx = st.weeks[st.weeks.length - 1].days[0].exercises.find(e => e.name === 'Kniebeuge');
  expect(newWeekEx.note).toBe(''); // Heute-Notiz zurückgesetzt
  expect(st.exerciseNotes['Kniebeuge']).toBe('Fersen erhöht, schmaler Stand'); // Immer-Notiz bleibt

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Hinweis-Text erscheint unter der Übung, wenn eine permanente Notiz existiert', async ({ page }) => {
  const day = mkDay(11, 'Tag A', [mkExercise('Rudern')], { markedDone: false, locked: false });
  await seed(page, {
    weeks: [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
    exerciseNotes: { 'Rudern': 'Enger Griff' },
  });

  await expect(page.locator('.ex-note-hint')).toContainText('Enger Griff');
});

test('Migration: alte States ohne exerciseNotes-Feld crashen nicht, bekommen leeres Objekt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const day = mkDay(11, 'Tag A', [mkExercise('Überkopfdrücken')], { markedDone: false, locked: false });
  await seed(page, {
    weeks: [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
    omitExerciseNotes: true,
  });

  const st = await readState(page);
  expect(st.exerciseNotes).toEqual({});

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Satz-Notiz (s.note) bleibt vollständig unabhängig von den neuen Übungs-Notizen', async ({ page }) => {
  const day = mkDay(11, 'Tag A', [mkExercise('Latzug', {
    note: 'Übungs-Heute-Notiz',
    sets: [{ weight: 40, reps: 10, rpe: null, status: 'pending', done: false, note: 'Satz-Notiz bleibt separat' }],
  })], { markedDone: false, locked: false });
  await seed(page, {
    weeks: [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
    exerciseNotes: { 'Latzug': 'Permanente Notiz' },
  });

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.sets[0].note).toBe('Satz-Notiz bleibt separat');
  expect(ex.note).toBe('Übungs-Heute-Notiz');
  expect(st.exerciseNotes['Latzug']).toBe('Permanente Notiz');
});
