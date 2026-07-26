import { test, expect } from '@playwright/test';

// B114: "Heute anders"-Substitution (ex.name = Ersatzname, ex.substituteFor =
// Original) muss bei JEDEM Klon-/Speicher-Vorgang zurückgesetzt werden — nicht
// nur beim Erstellen einer neuen Kalenderwoche (WEEK_CREATE/AUTO_WEEK_CREATE,
// die bereits vorher korrekt waren), sondern auch bei "Tag hinzufügen/klonen"
// (DAY_ADD_CLONE), "Tag duplizieren" (DAY_DUPLICATE) und beim Anlegen der
// allerersten Woche aus einem gespeicherten Template (_appendDefaultWeek).

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkExercise(overrides = {}) {
  return {
    name: 'Kurzhantel-Seitheben', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 10, reps: 12, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 12,
    progressionType: 'weight', archived: false, substituteFor: null,
    ...overrides,
  };
}

function mkWeek(exOverrides = {}) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [mkExercise(exOverrides)],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function baseState(overrides = {}) {
  return {
    meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
    curIdx: 0, weeks: [mkWeek({ name: 'Frontheben', substituteFor: 'Kurzhantel-Seitheben' })],
    onboardingDone: true,
    customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
    favoriteExercises: [], customExercises: [],
    prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
    lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
    longestStreakEver: 0, seenTips: ['tip-11'],
    ...overrides,
  };
}

async function seed(page, state) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((s) => localStorage.setItem('train_v6', JSON.stringify(s)), state);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('Tag hinzufügen (Klon): aktive Substitution wird im neuen Tag zurückgesetzt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, baseState());

  // "Tag hinzufügen" mit Klon-Auswahl liegt unter Einstellungen ›
  // Trainingstage verwalten (die Version im Trainings-Tab selbst legt nur
  // direkt einen leeren Tag an, ohne Klon-Auswahl-Modal).
  await page.click('.nav__tab[data-tab="settings"]');
  await page.click('[data-action="add-day"]');
  await page.check('input[name="add-day-src"][value="0"]');
  await page.click('[data-action="confirm-add-day"]');

  const st = await readState(page);
  const days = st.weeks[0].days;
  expect(days).toHaveLength(2);
  const clonedEx = days[1].exercises[0];
  expect(clonedEx.name).toBe('Kurzhantel-Seitheben');
  expect(clonedEx.substituteFor).toBeNull();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Tag duplizieren: aktive Substitution wird in der Kopie zurückgesetzt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, baseState());

  // "Tag duplizieren" liegt im Wochen-Menü (⋮ im Trainings-Toolbar), nicht in
  // der separaten (aktuell ungenutzten) Pro-Tag-Menü-Variante.
  await page.click('[data-action="toggle-week-menu"]');
  await page.click('[data-action="day-duplicate"]');

  const st = await readState(page);
  const days = st.weeks[0].days;
  expect(days).toHaveLength(2);
  const dupedEx = days[1].exercises[0];
  expect(dupedEx.name).toBe('Kurzhantel-Seitheben');
  expect(dupedEx.substituteFor).toBeNull();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Allererste Woche aus Template: gespeicherte Substitution wird nicht mit übernommen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  // Simuliert: Nutzer hat vor langer Zeit ein Template gespeichert, während
  // eine Substitution aktiv war (SAVE_WEEK_AS_TEMPLATE speichert das bisher
  // unverändert mit). weeks:[] zwingt loadState() dazu, _appendDefaultWeek()
  // aus genau diesem Template aufzurufen.
  await seed(page, baseState({
    weeks: [],
    customTemplate: [{
      id: 99, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [mkExercise({ name: 'Frontheben', substituteFor: 'Kurzhantel-Seitheben' })],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
  }));

  const st = await readState(page);
  expect(st.weeks).toHaveLength(1);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.name).toBe('Kurzhantel-Seitheben');
  expect(ex.substituteFor).toBeNull();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
