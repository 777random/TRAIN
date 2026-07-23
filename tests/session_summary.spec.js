import { test, expect } from '@playwright/test';

// B79: Session Summary + Schlaf-Korrelation + Compound/Isolation-Balance +
// Deload-Plan. SCHEMA unverändert (kein neues State-Feld, nutzt
// day.sessionCheckIn aus B76 und ex.nextWeekPlan aus dem Plateau-Sprint).

// Wochen-Startdaten relativ zu "heute" statt fixer Kalenderdaten — der
// App-Boot prüft 2s nach mountApp() automatisch auf einen Wiedereinstiegs-
// Popup (_detectReentryPause(), ui.js), der bei Wochen weit in der
// Vergangenheit sonst über der Test-Summary erscheint (pauseDays > 7).
function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, reps, status, rpe = null, prBadge = null) {
  return { weight, reps, rpe, status, done: status === 'success', note: '', prBadge };
}

function mkEx({ name, sets, weightStep = 5, targetReps = 5, archived = false }) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets,
    prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived,
  };
}

function mkDay({ id = 11, exercises, sessionModifier = null, sleep = null, isVacation = false }) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: sleep ? { sleep, energyPre: 'medium', timestamp: Date.now() } : null,
    sessionModifier,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek({ id, startDate, days, mode = 'standard' }) {
  return { id, startDate, note: '', mode, days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

async function seed(page, weeks, curIdx, extraSettings = {}) {
  await page.evaluate(({ weeksArg, curIdx, extraSettings }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, ...extraSettings }, favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, curIdx, extraSettings });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function completeDay(page, rateVal = '2') {
  await page.click('[data-action="toggle-complete"]');
  await page.click(`.completion-modal__rate-btn[data-val="${rateVal}"]`);
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
}

test('Summary erscheint nach day-done mit Highlights + Einordnung + Vorschau (PR-Fall)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const prevWeek = mkWeek({
    id: 1, startDate: weeksAgoISO(1),
    days: [mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success')] })] })],
  });
  const curWeek = mkWeek({
    id: 2, startDate: weeksAgoISO(0),
    days: [mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(105, 5, 'success', 7, 'weight')] })] })],
  });
  await seed(page, [prevWeek, curWeek], 1);

  await completeDay(page);

  const summary = page.locator('#session-summary-screen');
  await expect(summary).toContainText('Kniebeuge: +5kg ↑');
  await expect(summary).toContainText('Neuer Rekord heute');
  await expect(summary).toContainText('Nächstes Training: Kniebeuge');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('RPE-Warnung (>8.5) erscheint als Highlight', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({ exercises: [mkEx({ name: 'Kreuzheben', sets: [mkSet(140, 5, 'success', 9)] })] })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('#session-summary-screen')).toContainText('Kreuzheben: RPE 9 — schwer ⚠');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Gemischtes Training: eine Übung stark, eine schwach', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({ exercises: [
      mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 7)] }),
      mkEx({ name: 'Bankdrücken', sets: [mkSet(60, 3, 'fail', 8)], targetReps: 5 }),
    ] })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('#session-summary-screen')).toContainText('Gemischtes Training — Kniebeuge war stark, Bankdrücken braucht noch Arbeit.');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Hartes Training: ø RPE > 8.5 ohne PR', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 9.5)] })] })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('#session-summary-screen')).toContainText('Hartes Training — heute hast du alles gegeben. Erholung ist jetzt wichtig.');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Solides Training: alle Ziele erreicht, ø RPE <= 7', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 6.5)] })] })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('#session-summary-screen')).toContainText('Solides Training — du hast noch Kapazität. Nächste Woche: steigern.');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('sessionModifier reduced -> Anerkennung trotz schwachem Start (Fallback f)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({
      sessionModifier: 'reduced',
      exercises: [
        // Beide Übungen bleiben unter Ziel (fail) -> anyFullSuccess=false,
        // "Gemischtes Training" (d) kann so nicht zutreffen; ø RPE 7 <= 8.5
        // schließt auch "Hartes Training" (e) aus -> reiner Fallback f.
        mkEx({ name: 'Kniebeuge', sets: [mkSet(90, 3, 'fail', 7)] }),
        mkEx({ name: 'Bankdrücken', sets: [mkSet(50, 3, 'fail', 7)], targetReps: 5 }),
      ],
    })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await expect(page.locator('#session-summary-screen')).toContainText('Gut gemacht — du bist trotz schwachem Start durchgezogen.');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Weiter-Button führt zum bestehenden Tagesabschluss-Screen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 6)] })] })],
  });
  await seed(page, [wk], 0);
  await completeDay(page);

  await page.click('#session-summary-continue');
  await expect(page.locator('#session-summary-screen')).toHaveCount(0);
  await expect(page.locator('.day-completion-screen')).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Urlaubstag überspringt die Summary direkt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const wk = mkWeek({
    id: 1, startDate: weeksAgoISO(0),
    days: [mkDay({ isVacation: true, exercises: [] })],
  });
  await seed(page, [wk], 0);

  await page.click('[data-action="toggle-complete"]');
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('.day-completion-screen', { timeout: 5000 });
  await expect(page.locator('#session-summary-screen')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ── Schlaf-Korrelation ──────────────────────────────────────────────────

// `count` konsekutive Wochen endend 1 Woche vor heute (weeksAgoISO(1)) —
// der Aufrufer hängt danach die "aktuelle", gerade abzuschließende Woche
// bei weeksAgoISO(0) an. Kein day.markedDone (weder calcSleepCorrelation()
// noch die "realWeeks"-Prüfung brauchen es — success/fail-Sätze reichen),
// vermeidet damit unabsichtlich den Wiedereinstiegs-Popup (_detectReentryPause,
// ui.js), der bei mehreren weit auseinanderliegenden "aktiven" Wochen sonst
// über der Test-Summary erscheinen würde.
function buildSleepCorrelationWeeks(count = 8) {
  const weeks = [];
  for (let i = 0; i < count; i++) {
    const sleep = i % 2 === 0 ? 'poor' : 'good';
    // poor -> viele fail-Sätze (20% Erfolg), good -> fast alle success (90%)
    const sets = sleep === 'poor'
      ? [mkSet(80, 3, 'fail', 8), mkSet(80, 3, 'fail', 8), mkSet(80, 5, 'success', 8), mkSet(80, 3, 'fail', 8), mkSet(80, 3, 'fail', 8)]
      : [mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 3, 'fail', 6)];
    const day = mkDay({ sleep, exercises: [mkEx({ name: 'Kniebeuge', sets, targetReps: 5 })] });
    weeks.push(mkWeek({ id: i + 1, startDate: weeksAgoISO(count - i), days: [day] }));
  }
  return weeks;
}

test('Schlaf-Korrelation erscheint einmalig bei nachweisbarem Unterschied, nie wieder danach', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const weeks = buildSleepCorrelationWeeks(8);
  const newDay = mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 6)] })] });
  weeks.push(mkWeek({ id: 9, startDate: weeksAgoISO(0), days: [newDay] }));
  await seed(page, weeks, weeks.length - 1);

  await completeDay(page);

  const summary = page.locator('#session-summary-screen');
  await expect(summary.locator('.sleep-insight-card')).toBeVisible();
  await expect(summary).toContainText('Erfolgsquote');
  await expect(summary).toContainText('Schlaf ist dein größter Hebel für bessere Trainings.');

  const flag = await page.evaluate(() => localStorage.getItem('train_sleep_insight_shown'));
  expect(flag).toBe('true');

  // Zweiter Tagesabschluss in einer neuen Woche: Erkenntnis nicht mehr da.
  await page.click('#session-summary-continue');
  const week10 = mkWeek({ id: 10, startDate: weeksAgoISO(0), days: [mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 6)] })] })] });
  await seed(page, [...weeks, week10], weeks.length, { sessionCoach: true });
  // sleep-insight-shown Flag übersteht den Reload (localStorage, nicht state.js)
  await completeDay(page);
  await expect(page.locator('.sleep-insight-card')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Schlaf-Korrelation erscheint NICHT bei zu wenig Historie (<8 Wochen)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const weeks = buildSleepCorrelationWeeks(3);
  const newDay = mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5, 'success', 6)] })] });
  weeks.push(mkWeek({ id: 4, startDate: weeksAgoISO(0), days: [newDay] }));
  await seed(page, weeks, weeks.length - 1);

  await completeDay(page);
  await expect(page.locator('.sleep-insight-card')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ── Compound/Isolation-Balance (Coach-Tab) ──────────────────────────────

function buildCategoryWeeks(exName) {
  const weeks = [];
  for (let i = 0; i < 4; i++) {
    const day = mkDay({ exercises: [mkEx({ name: exName, sets: [mkSet(50, 8, 'success', 7), mkSet(50, 8, 'success', 7)], targetReps: 8 })] });
    weeks.push(mkWeek({ id: i + 1, startDate: weeksAgoISO(3 - i), days: [day] }));
  }
  return weeks;
}

test('Compound/Isolation-Signal erscheint im Coach-Tab bei <60% Compound', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // "Nackenrollen" ist in movementMap.js nicht gelistet -> resolveCategory
  // liefert 'Sonstige' -> zählt als Isolation (0% Compound).
  const weeks = buildCategoryWeeks('Nackenrollen');
  await seed(page, weeks, weeks.length - 1);

  await page.click('[data-tab="coach"]');
  await expect(page.locator('.coach-structural-item', { hasText: 'Compound' })).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Compound/Isolation-Signal erscheint NICHT bei >=60% Compound', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const weeks = buildCategoryWeeks('Kniebeuge'); // Squat -> 100% Compound
  await seed(page, weeks, weeks.length - 1);

  await page.click('[data-tab="coach"]');
  await expect(page.locator('.coach-structural-item', { hasText: 'Compound' })).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ── Deload-Plan ──────────────────────────────────────────────────────────

function buildDeloadWeeks() {
  const weeks = [];
  for (let i = 0; i < 9; i++) {
    // Letzte (aktuelle) Woche bekommt 5 Sätze -- damit die Deload-Plan-
    // Vorschau (Sprint C2 Teil B: Sätze statt Gewicht) eine echte Reduktion
    // zeigt; die 8 Vorwochen (1 Satz) bleiben unverändert für den Volumen-/
    // RPE-Trend, der das deload_preventive-Signal auslöst.
    const isLast = i === 8;
    const sets = isLast
      ? Array.from({ length: 5 }, () => mkSet(120, 5, 'success', 8.5))
      : [mkSet(100 + i * 2.5, 5, 'success', 8.5)];
    const day = mkDay({ exercises: [mkEx({ name: 'Kniebeuge', sets, weightStep: 5 })] });
    weeks.push(mkWeek({ id: i + 1, startDate: weeksAgoISO(8 - i), days: [day] }));
  }
  return weeks;
}

test('Deload-Plan zeigt konkrete Sätze, "Diese Woche" reduziert Sätze sofort ohne Gewichtsänderung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const weeks = buildDeloadWeeks();
  await seed(page, weeks, weeks.length - 1, { deloadFactor: 0.75 });

  await page.click('[data-tab="coach"]');
  await expect(page.locator('.deload-plan-card')).toBeVisible();
  await expect(page.locator('.deload-plan-card')).toContainText('DELOAD-PLAN');

  // 5 Sätze, Ziel Math.round(5*0.6)=3 -> "5 Sätze → 3 Sätze"
  await expect(page.locator('.deload-plan-row')).toContainText('5 Sätze → 3 Sätze');

  await page.click('[data-action="apply-deload-plan"]');
  await expect(page.locator('#deload-choice-modal')).toBeVisible();
  await page.click('[data-deload="now"]');

  const wk = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return st.weeks[st.curIdx];
  });
  expect(wk.mode).toBe('deload');
  const sets = wk.days[0].exercises[0].sets;
  expect(sets.map(s => s.deloadSkip ?? false)).toEqual([false, false, false, true, true]);
  // Gewicht bleibt unverändert (Intensität halten, Volumen reduzieren)
  expect(sets.every(s => s.weight === 120)).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Deload-Plan "Nächste Woche" plant nur vor, aktuelle Woche bleibt unangetastet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const weeks = buildDeloadWeeks();
  await seed(page, weeks, weeks.length - 1, { deloadFactor: 0.75 });

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.click('[data-deload="next"]');

  const wk = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return st.weeks[st.curIdx];
  });
  expect(wk.mode).toBe('standard');
  expect(wk.deloadPlannedForNext).toBe(true);
  expect(wk.days[0].exercises[0].sets.some(s => s.deloadSkip)).toBe(false);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
