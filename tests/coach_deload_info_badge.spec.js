import { test, expect } from '@playwright/test';

// Sprint "Onboarding-Verbesserungen": Agent 4 — die Struktursignal-Karte
// "X Wochen ohne Deload — Regenerationswoche einplanen." erklärt nirgends,
// was ein Deload überhaupt ist. Ein kleines "?"-Badge (natives <details>,
// kein neuer JS-Toggle-State) blendet eine kurze Inline-Erklärung ein/aus.
// Fixture identisch zu tests/deload_volumen.spec.js (9 Wochen, RPE 8.5,
// steigendes Gewicht — triggert _checkPreventiveDeload()).

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, nSets = 5, rpe = 8.5) {
  return Array.from({ length: nSets }, () => ({ weight, reps: 5, rpe, status: 'success', done: true, note: '' }));
}

function mkEx(name, weight, nSets = 5) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
    sets: mkSet(weight, nSets),
    prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: nSets, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, { markedDone = true } = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function buildDeloadWeeks() {
  const weeks = [];
  for (let i = 0; i < 8; i++) {
    const day = mkDay(1, [mkEx('Kniebeuge', 100 + i * 2.5)]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(8 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  const doneDay = mkDay(10, [mkEx('Kniebeuge', 120, 5)], { markedDone: true });
  const openDay = mkDay(11, [mkEx('Kniebeuge', 120, 5)], { markedDone: false });
  weeks.push({ id: 9, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [doneDay, openDay], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  return weeks;
}

// 9 Wochen, keine besonderen Signale (konstantes Gewicht, RPE 6, kein
// Deload-Trigger) — Kontrollgruppe: Struktursignal-Karte kann trotzdem
// erscheinen (z.B. push_pull), aber ohne deload_preventive darf KEIN
// "?"-Badge auftauchen.
function buildNonDeloadWeeks() {
  const weeks = [];
  for (let i = 0; i < 9; i++) {
    const day = mkDay(1, [mkEx('Kniebeuge', 100, 5)]);
    day.exercises[0].sets.forEach(s => { s.rpe = 6; });
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(8 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  return weeks;
}

async function seed(page, weeks) {
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false, suggestProgress: false, showReview: false }, deloadFactor: 0.75 },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Deload-Struktursignal: "?"-Badge sichtbar, Erklärung erst nach Klick', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const badge = page.locator('.deload-info__badge');
  await expect(badge).toBeVisible();

  const body = page.locator('.deload-info__body');
  await expect(body).toBeHidden();

  await badge.click();
  await expect(body).toBeVisible();
  await expect(body).toContainText('reduziertem Volumen');

  await badge.click();
  await expect(body).toBeHidden();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kein Deload-Signal aktiv: kein "?"-Badge in der Strukturkarte', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildNonDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  await expect(page.locator('.deload-info__badge')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
