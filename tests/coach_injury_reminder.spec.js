import { test, expect } from '@playwright/test';

// B129: Coach-Tab Strukturkarte "injury_reminder" — wenn eine Übung
// innerhalb der letzten 14 Tage wegen skipReason='injury' übersprungen
// wurde UND in der aktuellen Woche wieder auftaucht, erscheint eine
// Sicherheits-Erinnerung (⚠️, evidence: [{label,value}]-Muster wie jedes
// andere Struktursignal). Konkurriert mit den bestehenden 5 Signalen um
// die computeStructuralSignals()-Kappung (max. 2 gleichzeitig).

function isoDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function mkSuccessSet(weight = 80, reps = 5) {
  return { weight, reps, rpe: 7, status: 'success', done: true, note: '' };
}

function mkExercise(name, { skipReason = null, skipDate = null } = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [mkSuccessSet()], prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    skipReason, skipDate,
    targetSets: 1, targetReps: 5, progressionType: 'weight',
    progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, markedDone = true) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: markedDone ? Date.now() : null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, startDate, days) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

async function seed(page, weeks, curIdx) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeks, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks,
      customTemplate: [], settings: { sessionCoach: false }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  }, { weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function openCoachTab(page) {
  await page.click('.nav__tab[data-tab="coach"]');
  await page.waitForTimeout(200);
}

test('Übung vor 5 Tagen wegen Verletzung übersprungen, taucht heute wieder auf -> injury_reminder-Signal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const weeks = [
    mkWeek(1, isoDaysAgo(7), [mkDay(1, [mkExercise('Bankdrücken', { skipReason: 'injury', skipDate: isoDaysAgo(5) })])]),
    mkWeek(2, isoDaysAgo(0), [mkDay(2, [mkExercise('Bankdrücken')], false)]),
  ];
  await seed(page, weeks, 1);
  await openCoachTab(page);

  await expect(page.locator('.coach-structural-item')).toContainText(/Bankdrücken.*Schmerzen|Schmerzen.*Bankdrücken/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Übung vor mehr als 2 Wochen übersprungen -> KEIN Signal', async ({ page }) => {
  const weeks = [
    mkWeek(1, isoDaysAgo(21), [mkDay(1, [mkExercise('Bankdrücken', { skipReason: 'injury', skipDate: isoDaysAgo(20) })])]),
    mkWeek(2, isoDaysAgo(14), [mkDay(2, [mkExercise('Bankdrücken')])]),
    mkWeek(3, isoDaysAgo(0), [mkDay(3, [mkExercise('Bankdrücken')], false)]),
  ];
  await seed(page, weeks, 2);
  await openCoachTab(page);

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/wegen Schmerzen übersprungen/);
});

test('Übung mit nicht-injury Skip-Grund -> KEIN Signal', async ({ page }) => {
  const weeks = [
    mkWeek(1, isoDaysAgo(7), [mkDay(1, [mkExercise('Bankdrücken', { skipReason: 'time', skipDate: null })])]),
    mkWeek(2, isoDaysAgo(0), [mkDay(2, [mkExercise('Bankdrücken')], false)]),
  ];
  await seed(page, weeks, 1);
  await openCoachTab(page);

  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/wegen Schmerzen übersprungen/);
});
