import { test, expect } from '@playwright/test';

// B69: Streak-Badge zeigte 0, obwohl mehrere Wochen in Folge konsistent
// trainiert wurde. Root Cause: _calcCurrentStreak() (state.js) iteriert von
// der neuesten Woche rückwärts und bricht sofort ab, sobald eine Woche als
// 'missed' bewertet wird — eine frisch (z.B. per AUTO_WEEK_CREATE montags
// beim Öffnen) angelegte, noch leere aktuelle Woche hat 0 bewertete Sätze
// und galt daher fälschlich als 'missed', noch bevor der Nutzer überhaupt
// die Chance hatte, darin zu trainieren. Das brach die gesamte Streak auf 0,
// unabhängig davon wie viele Wochen zuvor tatsächlich durchgehend
// abgeschlossen wurden.
//
// Fix: die neueste Woche zählt nur dann als echtes Versäumnis, wenn ihr
// 7-Tage-Fenster bereits abgelaufen ist. Läuft es noch, wird sie übersprungen
// (weder gezählt noch bricht sie die Streak) und die dahinterliegende,
// tatsächliche Streak wird korrekt weitergezählt.

function mondayOfWeek(daysAgoWeeks) {
  const d = new Date();
  const dow = d.getDay(); // 0 = Sonntag
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday - daysAgoWeeks * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function completedDay(id) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    exercises: [{
      name: 'Kniebeuge', archived: false, weightStep: 5, metric: 'reps',
      progressionMode: 'weight_first', targetRepsMax: null,
      nextWeekPlan: 0, nextWeekPlanConfirmed: false,
      sets: [
        { weight: 80, reps: 5, status: 'success', done: true, rpe: null },
        { weight: 80, reps: 5, status: 'success', done: true, rpe: null },
      ],
    }],
  };
}

function emptyDay(id) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    exercises: [{
      name: 'Kniebeuge', archived: false, weightStep: 5, metric: 'reps',
      progressionMode: 'weight_first', targetRepsMax: null,
      nextWeekPlan: 0, nextWeekPlanConfirmed: false,
      sets: [
        { weight: 80, reps: 5, status: 'pending', done: false, rpe: null },
        { weight: 80, reps: 5, status: 'pending', done: false, rpe: null },
      ],
    }],
  };
}

test('Streak-Badge zählt 3 abgeschlossene Vorwochen weiter, obwohl die aktuelle Woche noch leer ist', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const weeks = [
    { id: 1, startDate: mondayOfWeek(3), note: '', mode: 'standard', days: [completedDay(11)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 2, startDate: mondayOfWeek(2), note: '', mode: 'standard', days: [completedDay(21)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 3, startDate: mondayOfWeek(1), note: '', mode: 'standard', days: [completedDay(31)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 4, startDate: mondayOfWeek(0), note: '', mode: 'standard', days: [emptyDay(41)],     sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
  ];

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: {}, prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await expect(page.locator('.streak-badge__num')).toHaveText('3');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
