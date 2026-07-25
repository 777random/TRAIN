import { test, expect } from '@playwright/test';

// Sprint "Onboarding-Verbesserungen" (train-v211), Agent 2: der Coach-Tab-
// Fallback ("Du baust gerade deine Datenbasis auf...") erwähnte bisher nicht,
// dass Session Coach (Intra-Session-Feedback) schon ab dem ersten Satz
// funktioniert -- Nutzer konnten daraus schließen, TRAIN sei erst ab Woche 2
// nützlich. Neues `focus.subtext`-Feld (nur im Frühphasen-Zweig von
// _fallback(), weeklyFocus.js) macht das explizit.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, status, weight = 60) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 8, rpe: 7, status, done: status !== 'pending', note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'reps', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, markedDone = true) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, startDate, days) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

async function seed(page, weeks) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { plateStep: 2.5, deloadFactor: 0.75 },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);
}

test('Woche 1 (Fallback-Frühphase): Subtext sichtbar, erwähnt Session Coach', async ({ page }) => {
  const weeks = [mkWeek(1, isoMondayWeeksAgo(0), [mkDay(1, [mkEx('Bankdrücken', 'success')])])];
  await seed(page, weeks);

  const directive = await page.locator('.coach-focus-directive').textContent();
  expect(directive).toContain('Woche 2');
  const subtext = page.locator('.coach-focus-subtext');
  await expect(subtext).toBeVisible();
  await expect(subtext).toContainText('Session Coach');
});

test('Persistenter Fehlschlag (echtes Signal, nicht Fallback): kein Subtext', async ({ page }) => {
  const weeks = [
    mkWeek(1, isoMondayWeeksAgo(2), [mkDay(1, [mkEx('Bankdrücken', 'fail')])]),
    mkWeek(2, isoMondayWeeksAgo(1), [mkDay(2, [mkEx('Bankdrücken', 'fail')])]),
    mkWeek(3, isoMondayWeeksAgo(0), [mkDay(3, [mkEx('Bankdrücken', 'fail')])]),
  ];
  await seed(page, weeks);

  const status = await page.locator('.coach-focus-status').textContent();
  expect(status).not.toContain('Auf Kurs');
  await expect(page.locator('.coach-focus-subtext')).toHaveCount(0);
});

test('Spätere onTrack-Phase (>=2 echte Wochen, kein Signal): kein Subtext', async ({ page }) => {
  const weeks = [
    mkWeek(1, isoMondayWeeksAgo(1), [mkDay(1, [mkEx('Bankdrücken', 'success')])]),
    mkWeek(2, isoMondayWeeksAgo(0), [mkDay(2, [mkEx('Bankdrücken', 'success')])]),
  ];
  await seed(page, weeks);

  const status = await page.locator('.coach-focus-status').textContent();
  expect(status).toContain('Auf Kurs');
  const directive = await page.locator('.coach-focus-directive').textContent();
  expect(directive).not.toContain('Woche 2');
  await expect(page.locator('.coach-focus-subtext')).toHaveCount(0);
});
