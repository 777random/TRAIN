import { test, expect } from '@playwright/test';

// B139 (Sprint 2026-07): Ernährungsphase (settings.nutritionPhase) beeinflusst
// Steigerungs-Empfehlung (weightRecommendation.js), Plateau-Signal und
// on_track-Subtext (weeklyFocus.js) sowie das Session Briefing (ui.js).
// cut: volle Steigerung nur bis RPE 6.0, KEINE Halbzone danach (immer
// halten) — bewusst strikter als die reine Verschiebung des alten 7.5er-
// Schwellenwerts, siehe DECISIONS.md.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}
function isoWeeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, weight, rpe) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 8, rpe, status: 'success', done: true, note: '' }],
    prWeight: weight, prRepsAtMaxWeight: 8, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    substituteFor: null,
  };
}
function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seedNewWeekFixture(page, { rpe, nutritionPhase }) {
  const weeks = [0, 1].map(i => ({
    id: i + 1, startDate: isoMondayWeeksAgo(1 - i), note: '', mode: 'standard',
    days: [mkDay(i + 10, [mkEx('Kniebeuge', 100, rpe)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, nutritionPhase }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { plateStep: 2.5, deloadFactor: 0.75, sessionCoach: false, rpeEnabled: true, nutritionPhase },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, nutritionPhase });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-action="open-new-week"]');
  const reviewContinue = page.locator('#wr-btn-continue');
  if (await reviewContinue.count()) await reviewContinue.click();
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
}

test('AC6: Ernaehrungsphase-Toggle in Einstellungen sichtbar + speichert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="settings"]');
  await expect(page.locator('[data-action="set-nutrition-phase"][data-phase="maintenance"]')).toHaveAttribute('aria-pressed', 'true');
  await page.click('[data-action="set-nutrition-phase"][data-phase="cut"]');
  await expect(page.locator('[data-action="set-nutrition-phase"][data-phase="cut"]')).toHaveAttribute('aria-pressed', 'true');
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.settings.nutritionPhase).toBe('cut');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC8: cut bei RPE 6.0 -> volle Steigerung, bei RPE 6.5 -> halten (keine Halbzone)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedNewWeekFixture(page, { rpe: 6.0, nutritionPhase: 'cut' });
  await expect(page.locator('[data-name="Kniebeuge"] .nw-rec-action')).toContainText('+2.5kg');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC8b: cut bei RPE 6.5 (waere unter maintenance volle Steigerung) -> halten', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedNewWeekFixture(page, { rpe: 6.5, nutritionPhase: 'cut' });
  await expect(page.locator('[data-name="Kniebeuge"] .nw-rec-action')).toContainText('Gewicht halten');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kontrolle: maintenance bei RPE 6.5 -> weiterhin volle Steigerung (unveraendertes Verhalten)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedNewWeekFixture(page, { rpe: 6.5, nutritionPhase: 'maintenance' });
  await expect(page.locator('[data-name="Kniebeuge"] .nw-rec-action')).toContainText('+2.5kg');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC10: bulk bei RPE 7.8 -> volle Steigerung (unter maintenance nur halbe)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedNewWeekFixture(page, { rpe: 7.8, nutritionPhase: 'bulk' });
  await expect(page.locator('[data-name="Kniebeuge"] .nw-rec-action')).toContainText('+2.5kg');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kontrolle: maintenance bei RPE 7.8 -> nur halbe Steigerung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedNewWeekFixture(page, { rpe: 7.8, nutritionPhase: 'maintenance' });
  await expect(page.locator('[data-name="Kniebeuge"] .nw-rec-action')).toContainText('+1.25kg');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC7: cut unterdrueckt das Plateau-Signal im Coach-Tab', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [3, 2, 1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [{ id: i * 10 + 1, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false, sleepHours: 7, energyLevel: 4, sessionRating: null,
      exercises: [mkEx('Kreuzheben', 140, 7.5)] }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true, nutritionPhase: 'cut' },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
  await expect(page.locator('.coach-focus-status')).not.toContainText('Plateau');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC9/AC11: on_track-Subtext fuer cut/bulk, kein Subtext bei maintenance', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [{ id: i * 10 + 1, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false, sleepHours: 7, energyLevel: 4, sessionRating: null,
      exercises: [mkEx('Bankdrücken', 80, 8.5)] }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  async function seedWithPhase(phase) {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
    await page.evaluate(({ weeksArg, phase }) => {
      localStorage.setItem('train_v6', JSON.stringify({
        meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
        curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
        customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true, nutritionPhase: phase },
        favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
        coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
        plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      }));
    }, { weeksArg: weeks, phase });
    await page.reload();
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
    await page.click('[data-tab="coach"]');
  }

  await seedWithPhase('cut');
  await expect(page.locator('.coach-focus-status')).toContainText('Auf Kurs');
  await expect(page.locator('.coach-focus-subtext')).toContainText('Definitionsphase');

  await seedWithPhase('bulk');
  await expect(page.locator('.coach-focus-subtext')).toContainText('Aufbauphase');

  await seedWithPhase('maintenance');
  await expect(page.locator('.coach-focus-subtext')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
