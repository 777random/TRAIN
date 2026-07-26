import { test, expect } from '@playwright/test';

// B122: Die Fokus-Übungsauswahl bevorzugte weder im Session-Briefing
// (_findFocusExercise, ui.js) noch im Coach-Tab ("Fokus der Woche",
// _checkProgression, weeklyFocus.js) Favoriten-Übungen -- beide wählten rein
// nach Array-Reihenfolge bzw. höchstem vorgeschlagenem Delta. Fix: Priorität
// favorit+compound > favorit > compound > bisheriger Fallback in beiden
// unabhängigen Funktionen.

function todayISO() { return new Date().toISOString().split('T')[0]; }
function isoWeeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, { weightStep = 2.5, weight = 60, rpe = 7, n = 3 } = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: Array.from({ length: n }, () => ({ weight, reps: 8, rpe, status: 'success', done: true, note: '' })),
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: n, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
  };
}

test('Session-Briefing: Favorit wird trotz späterer Array-Position als Fokus-Übung gewählt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const week = {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      sessionCheckIn: { sleep: 'medium', energyPre: 'medium' },
      // Schulterdrücken (Push, zuerst im Array, NICHT Favorit) vs.
      // Kniebeuge (Squat, Favorit) -- vor B122 gewann immer Schulterdrücken.
      exercises: [mkEx('Schulterdrücken'), mkEx('Kniebeuge')],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };

  await page.evaluate((weekArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: ['Kniebeuge'], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, week);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const focusText = page.locator('.session-briefing-card__focus');
  await expect(focusText).toContainText('Kniebeuge');
  await expect(focusText).not.toContainText('Schulterdrücken');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Coach-Tab "Fokus der Woche": Favorit wird trotz kleinerem Delta bevorzugt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Kniebeuge (Compound, NICHT Favorit, weightStep 5 -> hoeheres Delta) vs.
  // Seitheben (Isolation, Favorit, weightStep 1.25 -> kleineres Delta).
  // Beide RPE 7 / 100% Erfolg ueber 2 Wochen -> beide "ready". Vor B122 hat
  // reines Delta-Sortieren immer Kniebeuge gewaehlt.
  const weeks = [1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [{
      id: i * 10 + 1, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: 7, energyLevel: 4, sessionRating: null,
      exercises: [mkEx('Kniebeuge', { weightStep: 5 }), mkEx('Seitheben', { weightStep: 1.25 })],
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));

  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: ['Seitheben'], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');

  const directive = page.locator('.coach-focus-directive');
  await expect(directive).toContainText('Seitheben');
  await expect(directive).not.toContainText('Kniebeuge');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
