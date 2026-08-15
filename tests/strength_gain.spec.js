import { test, expect } from '@playwright/test';

// Runde 20 (Befund 5): neues Feature "Wie viel stärker bin ich in den
// letzten X Wochen geworden?" -- Übungsfortschritt-Karte bekommt einen
// Wochenanzahl-Picker (4/8/12/26), computeStrengthGain() (progressInsights.js)
// vergleicht den besten geschätzten 1RM (Epley) der ältesten gegen die
// neueste Woche mit Daten im gewählten Zeitraum.

function monday(weeksAgo) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - weeksAgo * 7);
  return d.toISOString().split('T')[0];
}

function mkWeek(id, weeksAgo, weight) {
  return {
    id, startDate: monday(weeksAgo), note: '', mode: 'standard',
    days: [{
      id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null, sessionRating: 3,
      sessionStartTs: null, sessionEndTs: null,
      sessionCheckIn: null, sessionModifier: 'normal',
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight, reps: 5, rpe: 8, status: 'success', done: true, note: '' }],
        prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
      }],
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seedWeeks(page, weeks) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(500);
  await page.selectOption('#chart-ex-select', 'Kniebeuge');
  await page.waitForTimeout(200);
}

test('Kraftzuwachs zeigt die Differenz zwischen ältester und neuester Woche im gewählten Zeitraum', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // 8 Wochen, Gewicht steigt von 80kg auf 100kg (5 Wdh je Satz durchgehend).
  const weeks = [];
  for (let i = 7; i >= 0; i--) weeks.push(mkWeek(7 - i, i, 80 + (7 - i) * (20 / 7)));
  await seedWeeks(page, weeks);

  const gainHint = page.locator('.strength-gain-hint').first();
  await expect(gainHint).toBeVisible();
  await expect(gainHint).toContainText('kg geschätzter 1RM');
  await expect(gainHint).toContainText('+'); // positiver Zuwachs

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kraftzuwachs zeigt einen Hinweis statt eines Werts bei nur einer Trainingswoche im Zeitraum', async ({ page }) => {
  await seedWeeks(page, [mkWeek(0, 0, 80)]);

  await expect(page.locator('.strength-gain-hint--empty')).toBeVisible();
  await expect(page.locator('.strength-gain-hint--empty')).toContainText('Noch nicht genug');
});

test('Wochenanzahl-Wechsel (4 Wochen statt 8) berechnet den Kraftzuwachs neu', async ({ page }) => {
  const weeks = [];
  for (let i = 7; i >= 0; i--) weeks.push(mkWeek(7 - i, i, 80 + (7 - i) * (20 / 7)));
  await seedWeeks(page, weeks);

  const before = await page.locator('.strength-gain-hint').first().textContent();

  await page.selectOption('#chart-strength-gain-weeks', '4');
  await page.waitForTimeout(200);

  const after = await page.locator('.strength-gain-hint').first().textContent();
  expect(after).not.toBe(before);
});
