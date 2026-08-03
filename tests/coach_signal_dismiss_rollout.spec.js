import { test, expect } from '@playwright/test';

// Runde 14 (Council-Entscheidung, Governance Coach-Struktursignale): der in
// Cluster 1 an 'deload_preventive' erprobte generische Dismiss (state.
// decisionLog, signal-spezifische Cooldown-Dauer, siehe weeklyFocus.js
// DISMISS_COOLDOWN_DAYS) wird hier auf 3 weitere Struktursignale ausgerollt:
// consistency_quality (14 Tage), push_pull (21 Tage), recurring_fatigue
// (21 Tage). injury_reminder bekommt BEWUSST KEINEN Dismiss (Council:
// asymmetrisches Risiko) -- eigener Regressionstest ganz unten.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSets(list) {
  return list.map(([weight, reps, status, rpe = null]) =>
    ({ weight, reps, rpe, status, done: status === 'success', note: '' }));
}

function mkEx(name, sets, weightStep = 5) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets,
    prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, weeks, decisionLog = []) {
  await page.evaluate(({ weeksArg, decisionLogArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false, suggestProgress: false, showReview: false }, deloadFactor: 0.75 },
      favoriteExercises: [], customExercises: [], exerciseNotes: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: decisionLogArg, badges: [], onboardingDone: true,
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weeksArg: weeks, decisionLogArg: decisionLog });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// 16 Wochen, ein Tag/Woche, ein Exercise, RPE null + konstantes Gewicht
// (kein deload_preventive/recurring_fatigue-Rauschen). computeConsistency-
// Trend(state,8) braucht >=16 Wochen Historie, um eine echte
// prev-vs-cur-Richtung zu liefern (sonst direction:null, Signal feuert
// nie) -- alle 16 Wochen sind vollständig trainiert (ratio 1.0), damit
// Konsistenz durchgehend stabil/hoch bleibt. computeQualityTrend(...,8)
// betrachtet nur die letzten 8 Wochen: Wochen 9-12 100% Erfolg ("prev"),
// Wochen 13-16 überwiegend Fehlschlag ("cur") -> Qualität sinkt deutlich
// unter 75%, während Konsistenz unverändert stabil bleibt.
function buildConsistencyQualityWeeks() {
  const weeks = [];
  for (let i = 0; i < 16; i++) {
    const sets = i < 12
      ? mkSets([[60, 5, 'success'], [60, 5, 'success'], [60, 5, 'success'], [60, 5, 'success'], [60, 5, 'success']])
      : mkSets([[60, 5, 'success'], [60, 5, 'fail'], [60, 5, 'fail'], [60, 5, 'fail'], [60, 5, 'fail']]);
    const day = mkDay(1, [mkEx('Bankdrücken', sets)]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(15 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  return weeks;
}

// 8 Wochen, Bankdrücken (Push, 5 Sätze/Woche) + Rudern (Pull, 1 Satz/Woche)
// -> Verhältnis 5:1, deutlich > 1.5 -> push_pull. Konstantes Gewicht/kein
// RPE -> kein deload_preventive-Rauschen.
function buildPushPullWeeks() {
  const weeks = [];
  for (let i = 0; i < 8; i++) {
    const day = mkDay(1, [
      mkEx('Bankdrücken', mkSets([[60, 5, 'success'], [60, 5, 'success'], [60, 5, 'success'], [60, 5, 'success'], [60, 5, 'success']])),
      mkEx('Rudern', mkSets([[40, 5, 'success']])),
    ]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(7 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  return weeks;
}

// 3 konsekutive Wochen mit demselben Erschöpfungsmuster wie
// tests/recurring_fatigue_signal.spec.js: Bankdrücken RPE 7.0, OHP RPE 8.0,
// Dips RPE 9.5 -> RPE-Anstieg >=1.5 UND Erfolgsquote sinkt.
function buildRecurringFatigueWeeks() {
  const weeks = [];
  for (let i = 0; i < 3; i++) {
    const day = mkDay(10 + i, [
      mkEx('Bankdrücken', mkSets([[80, 8, 'success', 7.0], [80, 8, 'success', 7.0]])),
      mkEx('OHP', mkSets([[40, 8, 'success', 8.0], [40, 6, 'fail', 8.0]])),
      mkEx('Dips', mkSets([[0, 5, 'fail', 9.5]])),
    ]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(2 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  return weeks;
}

test.describe('consistency_quality Dismiss', () => {
  test('Dismiss-Button vorhanden, Klick loggt consistency_quality/stay und blendet die Karte aus', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
    await seed(page, buildConsistencyQualityWeeks());

    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);

    const btn = page.locator('[data-action="coach-signal-dismiss"][data-signal-type="consistency_quality"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="consistency_quality"]')).toHaveCount(0);

    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).decisionLog);
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('consistency_quality');
    expect(log[0].choice).toBe('stay');
  });

  test('Cooldown 13 Tage alt unterdrückt weiterhin (< 14 Tage), 15 Tage alt nicht mehr', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });

    const recentISO = new Date(Date.now() - 13 * 86_400_000).toISOString().slice(0, 10);
    await seed(page, buildConsistencyQualityWeeks(), [
      { id: 1, type: 'consistency_quality', signal: 'x', choice: 'stay', decidedWeekStart: recentISO, outcome: null },
    ]);
    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="consistency_quality"]')).toHaveCount(0);

    const oldISO = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 10);
    await seed(page, buildConsistencyQualityWeeks(), [
      { id: 1, type: 'consistency_quality', signal: 'x', choice: 'stay', decidedWeekStart: oldISO, outcome: null },
    ]);
    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="consistency_quality"]')).toBeVisible();
  });
});

test.describe('push_pull Dismiss', () => {
  test('Dismiss-Button vorhanden, Klick loggt push_pull/stay und blendet die Karte aus', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
    await seed(page, buildPushPullWeeks());

    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);

    const btn = page.locator('[data-action="coach-signal-dismiss"][data-signal-type="push_pull"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="push_pull"]')).toHaveCount(0);

    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).decisionLog);
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('push_pull');
  });

  test('Cooldown 20 Tage alt unterdrückt weiterhin (< 21 Tage), 22 Tage alt nicht mehr', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });

    const recentISO = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    await seed(page, buildPushPullWeeks(), [
      { id: 1, type: 'push_pull', signal: 'x', choice: 'stay', decidedWeekStart: recentISO, outcome: null },
    ]);
    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="push_pull"]')).toHaveCount(0);

    const oldISO = new Date(Date.now() - 22 * 86_400_000).toISOString().slice(0, 10);
    await seed(page, buildPushPullWeeks(), [
      { id: 1, type: 'push_pull', signal: 'x', choice: 'stay', decidedWeekStart: oldISO, outcome: null },
    ]);
    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="push_pull"]')).toBeVisible();
  });
});

test.describe('recurring_fatigue Dismiss', () => {
  test('Dismiss-Button vorhanden, Klick loggt recurring_fatigue/stay und blendet die Karte aus', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
    await seed(page, buildRecurringFatigueWeeks());

    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);

    const btn = page.locator('[data-action="coach-signal-dismiss"][data-signal-type="recurring_fatigue"]');
    await expect(btn).toBeVisible();
    await btn.click();
    await page.waitForTimeout(300);

    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="recurring_fatigue"]')).toHaveCount(0);

    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).decisionLog);
    expect(log).toHaveLength(1);
    expect(log[0].type).toBe('recurring_fatigue');
  });

  test('Cooldown 20 Tage alt unterdrückt weiterhin (< 21 Tage), 22 Tage alt nicht mehr', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });

    const recentISO = new Date(Date.now() - 20 * 86_400_000).toISOString().slice(0, 10);
    await seed(page, buildRecurringFatigueWeeks(), [
      { id: 1, type: 'recurring_fatigue', signal: 'x', choice: 'stay', decidedWeekStart: recentISO, outcome: null },
    ]);
    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="recurring_fatigue"]')).toHaveCount(0);

    const oldISO = new Date(Date.now() - 22 * 86_400_000).toISOString().slice(0, 10);
    await seed(page, buildRecurringFatigueWeeks(), [
      { id: 1, type: 'recurring_fatigue', signal: 'x', choice: 'stay', decidedWeekStart: oldISO, outcome: null },
    ]);
    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(300);
    await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="recurring_fatigue"]')).toBeVisible();
  });
});

// Regressionstest (Cluster 2 explizit gefordert): injury_reminder bekommt
// KEINEN Dismiss-Button, auch nach dem Rollout auf die anderen 3 Signale.
// Fixture-Muster identisch zu tests/coach_injury_reminder.spec.js (Übung vor
// 5 Tagen wegen Verletzung übersprungen, taucht heute wieder auf).
test('injury_reminder hat weiterhin KEINEN Dismiss-Button (Council: asymmetrisches Risiko)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  function isoDaysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  }
  const exSkipped = { ...mkEx('Bankdrücken', mkSets([[80, 5, 'success']])), skipReason: 'injury', skipDate: isoDaysAgo(5) };
  const exAgain = mkEx('Bankdrücken', mkSets([[80, 5, 'success']]));
  const weeks = [
    { id: 1, startDate: isoDaysAgo(7), note: '', mode: 'standard', days: [mkDay(1, [exSkipped])], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 2, startDate: isoDaysAgo(0), note: '', mode: 'standard', days: [mkDay(2, [exAgain])], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
  ];
  await seed(page, weeks);

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  await expect(page.locator('.coach-structural-item')).toContainText(/Schmerzen/);
  await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="injury_reminder"]')).toHaveCount(0);
});
