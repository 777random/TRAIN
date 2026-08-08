import { test, expect } from '@playwright/test';

// Runde 18 (Cluster 4b): wenn dieselbe Übung an zwei Tagen derselben Woche
// vorkommt, verschmilzt die Wochen-Empfehlung beide Tage (sportlich
// korrekt) -- aber _prepNewWeekModal() deduplizierte die Auto-Auswahl NACH
// NAME, wodurch nur die zuerst gefundene Tages-Instanz ihr
// nextWeekPlanConfirmed-Flag bekam. Fix: JEDE passende Tages-Instanz
// bekommt das Flag, die Chip-Anzeige bleibt trotzdem einmalig pro Name
// (kein UI-Duplikat), die Subline nennt jetzt beide Tage.

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSuccessSet(weight, reps = 5, rpe = 7) {
  return { weight, reps, rpe, status: 'success', done: true, note: '' };
}
function mkPendingSet() {
  return { weight: 0, reps: 0, rpe: null, status: 'pending', done: false, note: '' };
}

function mkHistoryEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [mkSuccessSet(weight)], prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    targetSets: 1, targetReps: 5, progressionType: 'weight', progressionMode: 'weight_first',
    targetRepsMax: null, archived: false, skipReason: null, skipDate: null,
  };
}

function mkTodayEx(name) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [mkPendingSet()], prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    targetSets: 1, targetReps: 5, progressionType: 'weight', progressionMode: 'weight_first',
    targetRepsMax: null, archived: false, skipReason: null, skipDate: null,
  };
}

function mkHistoryDay(id, title, exercises) {
  return {
    id, title, subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: Date.now(),
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkTodayDay(id, title, exercises) {
  return {
    id, title, subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
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
  await page.evaluate(({ weeksArg, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, plateStep: 2.5 }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('Übung an zwei Tagen derselben Woche: BEIDE Tages-Instanzen bekommen nextWeekPlanConfirmed, nicht nur die erste', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const exName = 'Kreuzheben';
  const weeks = [
    mkWeek(1, weeksAgoISO(3), [mkHistoryDay(1, 'Tag B', [mkHistoryEx(exName, 100)])]),
    mkWeek(2, weeksAgoISO(2), [mkHistoryDay(2, 'Tag B', [mkHistoryEx(exName, 102.5)])]),
    mkWeek(3, weeksAgoISO(1), [mkHistoryDay(3, 'Tag B', [mkHistoryEx(exName, 105)])]),
    mkWeek(4, weeksAgoISO(0), [
      mkTodayDay(4, 'Tag B', [mkTodayEx(exName)]),
      mkTodayDay(5, 'Tag C', [mkTodayEx(exName)]),
    ]),
  ];
  await seed(page, weeks, 3);

  // Aktuelle Woche hat noch keinen abgeschlossenen Tag -> 'open-new-week'
  // geht direkt zu _prepNewWeekModal(), kein zwischengeschalteter
  // Wochenrückblick.
  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.waitForTimeout(200);

  // Nur EIN Chip für die Übung sichtbar (kein UI-Duplikat trotz zwei Tagen).
  const chips = page.locator('.nw-weight-rec-chip', { hasText: exName });
  await expect(chips).toHaveCount(1);
  // Subline macht sichtbar, dass beide Tage einfließen.
  await expect(page.locator('.nw-rec-subline')).toContainText('Tag B + Tag C');

  const st = await readState(page);
  const dayB = st.weeks[3].days.find(d => d.title === 'Tag B' && d.id === 4);
  const dayC = st.weeks[3].days.find(d => d.title === 'Tag C');
  expect(dayB.exercises[0].nextWeekPlanConfirmed).toBe(true);
  expect(dayC.exercises[0].nextWeekPlanConfirmed).toBe(true);
  expect(dayB.exercises[0].nextWeekPlan).toBeGreaterThan(0);
  expect(dayB.exercises[0].nextWeekPlan).toBe(dayC.exercises[0].nextWeekPlan);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
