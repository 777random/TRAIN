import { test, expect } from '@playwright/test';

// B128: Automatische Steigerung Opt-out — nextWeekPlan wird jetzt schon beim
// Tagesabschluss automatisch gesetzt (nicht erst im "Neue Woche"-Dialog),
// analog zum bestehenden EX_AUTO_PRESELECT_NEXT_WEEK_PLAN-Mechanismus. Neues
// Feld ex.nextWeekPlanAutoReviewed steuert das Banner ("Steigerungen
// vorgeschlagen") unabhängig von nextWeekPlanConfirmed, das bereits beim
// Auto-Setzen selbst auf true gesetzt wird (Opt-out, nicht Opt-in).

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSuccessSet(weight, reps, rpe = 7) {
  return { weight, reps, rpe, status: 'success', done: true, note: '' };
}

function mkPendingSet(weight = 0, reps = 0) {
  return { weight, reps, rpe: null, status: 'pending', done: false, note: '' };
}

function mkHistoryEx(name, weight, { weightStep = 2.5, targetReps = 5, rpe = 7 } = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: [mkSuccessSet(weight, targetReps, rpe)],
    prWeight: weight, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    targetSets: 1, targetReps, progressionType: 'weight', progressionMode: 'weight_first',
    targetRepsMax: null, archived: false,
  };
}

function mkTodayEx(name, weight, {
  weightStep = 2.5, targetReps = 5, rpe = 7, confirmed = false,
  progressionMode = 'weight_first', skipped = false,
} = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: skipped ? [mkPendingSet()] : [mkSuccessSet(weight, targetReps, rpe)],
    prWeight: weight, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: confirmed, nextWeekPlanAutoReviewed: true,
    targetSets: 1, targetReps, progressionType: 'weight', progressionMode,
    targetRepsMax: null, archived: false,
  };
}

function mkHistoryDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: Date.now(),
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkTodayDay(exercises) {
  return {
    id: 99, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
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
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: false, plateStep: 2.5 }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

async function completeDay(page) {
  await page.click('[data-action="toggle-complete"]');
  // B129: falls komplett übersprungene Übungen vorhanden sind, fragt zuerst
  // die neue Skip-Grund-Warteschlange (eine Übung nach der anderen) -- hier
  // pauschal "Überspringen / Kein Grund" durchklicken, bis der normale
  // Bewertungs-Dialog erscheint.
  while (await page.locator('[data-skip-val=""]').count() > 0) {
    await page.click('[data-skip-val=""]');
    await page.waitForTimeout(100);
  }
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
}

// 3 vergangene Wochen (perfekt, RPE<=8) + heutiger Tag -> isReadyForAutoSelect()
// sollte true liefern, getWeightRecommendation() eine Steigerung.
function buildEligibleWeeks(exerciseName = 'Bankdrücken', todayExercises) {
  return [
    mkWeek(1, weeksAgoISO(3), [mkHistoryDay(1, [mkHistoryEx(exerciseName, 70)])]),
    mkWeek(2, weeksAgoISO(2), [mkHistoryDay(2, [mkHistoryEx(exerciseName, 72.5)])]),
    mkWeek(3, weeksAgoISO(1), [mkHistoryDay(3, [mkHistoryEx(exerciseName, 75)])]),
    mkWeek(4, weeksAgoISO(0), [mkTodayDay(todayExercises)]),
  ];
}

test('Tag abschließen -> nextWeekPlan automatisch gesetzt (Opt-out, sofort confirmed)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const weeks = buildEligibleWeeks('Bankdrücken', [mkTodayEx('Bankdrücken', 75)]);
  await seed(page, weeks, 3);
  await completeDay(page);

  const st = await readState(page);
  const ex = st.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBeGreaterThan(0);
  expect(ex.nextWeekPlanConfirmed).toBe(true);
  expect(ex.nextWeekPlanAutoReviewed).toBe(false);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Bereits manuell bestätigter Plan wird beim Tagesabschluss NICHT überschrieben', async ({ page }) => {
  const weeks = buildEligibleWeeks('Bankdrücken', [
    mkTodayEx('Bankdrücken', 75, { confirmed: true }),
  ]);
  weeks[3].days[0].exercises[0].nextWeekPlan = 1.25; // manueller Custom-Wert
  await seed(page, weeks, 3);
  await completeDay(page);

  const st = await readState(page);
  const ex = st.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(1.25);
  expect(ex.nextWeekPlanConfirmed).toBe(true);
});

test('Komplett übersprungene Übung (alle Sätze pending) bekommt keinen Auto-Plan', async ({ page }) => {
  const weeks = buildEligibleWeeks('Bankdrücken', [
    mkTodayEx('Bankdrücken', 75, { skipped: true }),
  ]);
  await seed(page, weeks, 3);
  await completeDay(page);

  const st = await readState(page);
  const ex = st.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(0);
  expect(ex.nextWeekPlanConfirmed).toBe(false);
});

test('reps_only (nie auto-vorausgewählt) bekommt keinen Plan', async ({ page }) => {
  const weeks = buildEligibleWeeks('Bankdrücken', [
    mkTodayEx('Bankdrücken', 75, { progressionMode: 'reps_only' }),
  ]);
  await seed(page, weeks, 3);
  await completeDay(page);

  const st = await readState(page);
  const ex = st.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(0);
  expect(ex.nextWeekPlanConfirmed).toBe(false);
});

test('Banner erscheint nach Tagesabschluss und "Alle übernehmen" setzt AutoReviewed=true ohne den Plan zu ändern', async ({ page }) => {
  const weeks = buildEligibleWeeks('Bankdrücken', [mkTodayEx('Bankdrücken', 75)]);
  await seed(page, weeks, 3);
  await completeDay(page);
  await page.click('#session-summary-continue');
  await page.waitForTimeout(300);

  await expect(page.locator('.auto-plan-banner')).toBeVisible();
  await expect(page.locator('.auto-plan-banner')).toContainText('Steigerungen vorgeschlagen');

  const stBefore = await readState(page);
  const planBefore = stBefore.weeks[3].days[0].exercises[0].nextWeekPlan;

  await page.click('[data-action="autoplan-accept-all"]');
  await page.waitForTimeout(150);

  const stAfter = await readState(page);
  const ex = stAfter.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(planBefore);
  expect(ex.nextWeekPlanConfirmed).toBe(true);
  expect(ex.nextWeekPlanAutoReviewed).toBe(true);
  await expect(page.locator('.auto-plan-banner')).toHaveCount(0);
});

test('"Anpassen" -> "Ablehnen" setzt Plan zurück (echter Opt-out)', async ({ page }) => {
  const weeks = buildEligibleWeeks('Bankdrücken', [mkTodayEx('Bankdrücken', 75)]);
  await seed(page, weeks, 3);
  await completeDay(page);
  await page.click('#session-summary-continue');
  await page.waitForTimeout(300);

  await page.click('[data-action="autoplan-expand"]');
  await page.waitForTimeout(150);
  await page.click('[data-action="autoplan-reject-one"]');
  await page.waitForTimeout(150);

  const st = await readState(page);
  const ex = st.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(0);
  expect(ex.nextWeekPlanConfirmed).toBe(false);
  expect(ex.nextWeekPlanAutoReviewed).toBe(true);
  await expect(page.locator('.auto-plan-banner')).toHaveCount(0);
});
