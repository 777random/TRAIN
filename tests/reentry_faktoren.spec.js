import { test, expect } from '@playwright/test';

// Sprint C2 (Teil C, Bosquet et al. 2013): Wiedereinstiegs-Reduktion nach
// einer Trainingspause -- untere zwei Zeitfenster abgeschwächt (Intermediate+
// zeigen kaum Kraftverlust nach 1-2 Wochen), obere zwei unverändert.
// _detectReentryPause() (ui.js): pauseDays <= 14 -> 5% (war 10%),
// <= 28 -> 10% (war 15%), <= 56 -> 20% (unverändert), > 56 -> 25% (unverändert,
// Vorlage nahm faelschlich 30% als aktuellen Wert an).

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function mkWeekForPause(pauseDays) {
  // _reentryWeekEndMs(wk) = startDate + 6 Tage. ongoingPauseDays =
  // floor((now - weekEnd)/86400000). startDate so wählen, dass exakt
  // pauseDays Pausentage seit Wochenende vergangen sind.
  const startDate = isoDaysAgo(pauseDays + 6);
  return {
    id: 1, startDate, note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
      sessionCheckIn: null, sessionModifier: null,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }],
        prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', archived: false,
      }],
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seedPause(page, pauseDays) {
  const week = mkWeekForPause(pauseDays);
  await page.evaluate((weekArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [weekArg],
      customTemplate: [], settings: { autoWeek: { enabled: false } }, favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, week);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function expectReentryFactor(page, expectedPct) {
  await page.waitForSelector('#reentry-modal', { timeout: 3000 });
  await expect(page.locator('.vac-plan-modal__sub')).toContainText(`-${expectedPct}%`);
}

test('10 Tage Pause -> 5% Reduktion (war 10%)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedPause(page, 10);
  await expectReentryFactor(page, 5);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('21 Tage Pause -> 10% Reduktion (war 15%)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedPause(page, 21);
  await expectReentryFactor(page, 10);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('40 Tage Pause -> 20% Reduktion (unverändert, Regressionsschutz)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedPause(page, 40);
  await expectReentryFactor(page, 20);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('70 Tage Pause -> 25% Reduktion (unverändert, Regressionsschutz -- nicht 30%)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedPause(page, 70);
  await expectReentryFactor(page, 25);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Anwenden reduziert Gewicht exakt um den angezeigten Faktor', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedPause(page, 10); // -> 5%
  await page.waitForSelector('#reentry-modal', { timeout: 3000 });
  await page.click('[data-reentry="adjust"]');
  const weight = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return st.weeks[0].days[0].exercises[0].sets[0].weight;
  });
  // 100kg * 0.95 = 95, gerundet auf weightStep 5 -> 95
  expect(weight).toBe(95);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
