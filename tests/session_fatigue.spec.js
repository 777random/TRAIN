import { test, expect } from '@playwright/test';

// B140 (Sprint 2026-07, Ansatz B): Intra-Session-Erschöpfung — Session
// Summary zeigt einen informativen Block, wenn die letzten Übungen einer
// Session deutlich schlechter performen als die ersten (RPE-Anstieg >= 1.5
// UND Erfolgsquote sinkt >= 10 Prozentpunkte). Reuse der Test-Helper aus
// session_summary.spec.js (identisches Fixture-Muster).

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, reps, status, rpe = null) {
  return { weight, reps, rpe, status, done: status === 'success', note: '', prBadge: null };
}

function mkEx({ name, sets, weightStep = 5, targetReps = 5 }) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets,
    prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay({ id = 11, exercises }) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek({ id, startDate, days }) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

async function seed(page, weeks, curIdx) {
  await page.evaluate(({ weeksArg, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true }, favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function completeDay(page, rateVal = '2') {
  await page.click('[data-action="toggle-complete"]');
  await page.click(`.completion-modal__rate-btn[data-val="${rateVal}"]`);
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
}

test('AC12/AC13: Erschoepfungs-Block erscheint bei RPE-Anstieg >=1.5 + Erfolgsquote sinkt >=10%, zeigt firstAvg/secondAvg/erschoepfteste Uebung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({
      exercises: [
        mkEx({ name: 'Bankdrücken', sets: [mkSet(80, 8, 'success', 7.0), mkSet(80, 8, 'success', 7.0)] }),
        mkEx({ name: 'OHP', sets: [mkSet(40, 8, 'success', 8.0), mkSet(40, 6, 'fail', 8.0)] }),
        mkEx({ name: 'Dips', sets: [mkSet(0, 5, 'fail', 9.5)] }),
      ],
    })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  const card = page.locator('.session-fatigue-card');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Erschöpfungs-Muster erkannt');
  await expect(card).toContainText('Ø RPE 7');
  await expect(card).toContainText('Ø RPE 8.8'); // (8.0+9.5)/2 gerundet
  await expect(card).toContainText('Dips');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC14: weniger als 3 RPE-bewertete Uebungen -> kein Block', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({
      exercises: [
        mkEx({ name: 'Bankdrücken', sets: [mkSet(80, 8, 'success', 7.0)] }),
        mkEx({ name: 'Dips', sets: [mkSet(0, 5, 'fail', 9.5)] }),
      ],
    })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('.session-fatigue-card')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kein Block wenn RPE stabil bleibt (keine Erschoepfung)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({
      exercises: [
        mkEx({ name: 'Bankdrücken', sets: [mkSet(80, 8, 'success', 7.0)] }),
        mkEx({ name: 'OHP', sets: [mkSet(40, 8, 'success', 7.2)] }),
        mkEx({ name: 'Dips', sets: [mkSet(0, 8, 'success', 7.1)] }),
      ],
    })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('.session-fatigue-card')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
