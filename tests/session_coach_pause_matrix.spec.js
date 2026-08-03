import { test, expect } from '@playwright/test';

// Sprint C1 (train-v204): Pausenzeiten nach Trainingsziel (state.settings.goal)
// UND Übungstyp (Compound/Isolation, movementMap.js isCompoundExercise())
// differenziert statt einer einzigen RPE-Spalte. Siehe DECISIONS.md.

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function mkEx({ name, weight = 100, step = 5, targetReps = 5, nSets = 2 } = {}) {
  const sets = [];
  for (let i = 0; i < nSets; i++) {
    sets.push({ weight, reps: targetReps, rpe: null, status: 'pending', done: false, note: '' });
  }
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: step,
    sets,
    prWeight: weight, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: nSets, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(exercises) {
  return {
    id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: { sleep: 'good', energyPre: 'medium', timestamp: Date.now() }, sessionModifier: 'normal',
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { exercises, goal = null, autoStartPauseTimer = false, sessionCoach = true, isVacation = false } = {}) {
  const day = mkDay(exercises);
  day.isVacation = isVacation;
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate(({ weeksArg, goal, autoStartPauseTimer, sessionCoach }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach, autoStartPauseTimer, rpeEnabled: true, goal },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, goal, autoStartPauseTimer, sessionCoach });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function setRpe(page, di, ei, si, val) {
  await page.click(`[data-action="open-rpe-popover"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
  await page.click(`[data-action="set-rpe-val"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"][data-val="${val}"]`);
}

async function toggleDone(page, di, ei, si) {
  await page.click(`[data-action="toggle-done"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
}

async function confirmSet(page, di, ei) {
  await page.click(`[data-action="confirm-set"][data-di="${di}"][data-ei="${ei}"]`);
}

// #pause-ring-num is a LIVE countdown (ticks down via rAF) -- an exact
// string match races against real elapsed time between the triggering
// action and the read (worse under concurrent test-suite load). Same
// tolerance-window convention as the existing B78 tests above (117-120 for
// an expected 120s).
async function expectPauseNum(page, expected) {
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const num = Number(await page.locator('#pause-ring-num').textContent());
  expect(num).toBeGreaterThanOrEqual(expected - 3);
  expect(num).toBeLessThanOrEqual(expected);
}

// AC1: Kraft + Compound + RPE 8 -> 180s
test('AC1: Kraft + Compound (Bankdrücken) + RPE 8 -> Pause 3min', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 })], goal: 'kraftaufbau' });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 3min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC2: Kraft + Isolation + RPE 8 -> 120s
test('AC2: Kraft + Isolation (Bizepscurls) + RPE 8 -> Pause 2min', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bizepscurls', nSets: 2, targetReps: 5 })], goal: 'kraftaufbau' });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 2min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC3: Hypertrophie + Compound + RPE 8 -> 120s
test('AC3: Hypertrophie + Compound (Bankdrücken) + RPE 8 -> Pause 2min', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 })], goal: 'muskelaufbau' });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 2min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC4: Hypertrophie + Isolation + RPE 8 -> 90s
test('AC4: Hypertrophie + Isolation (Bizepscurls) + RPE 8 -> Pause 90s', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bizepscurls', nSets: 2, targetReps: 5 })], goal: 'muskelaufbau' });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 90s');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC5/AC6: Bankdrücken -> Compound, Bizepscurls -> Isolation (bereits durch
// AC1-4 indirekt bewiesen -- dieselben Werte wären identisch, wenn die
// Kategorisierung falsch liefe). Hier zusätzlich am RPE-6-Fall verifiziert,
// wo Compound/Isolation einen klar unterschiedlichen Wert ergibt (90 vs 60).
test('AC5/AC6: Bankdrücken (Compound) vs. Bizepscurls (Isolation) bei gleichem RPE unterschiedliche Pause', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [
      mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 }),
      mkEx({ name: 'Bizepscurls', nSets: 2, targetReps: 5 }),
    ],
    goal: 'muskelaufbau',
  });

  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);
  await setRpe(page, 0, 1, 0, 6);
  await toggleDone(page, 0, 1, 0);

  const feedbacks = page.locator('.set-feedback');
  await expect(feedbacks.nth(0)).toContainText('Pause: 90s');  // Hyp-Compound
  await expect(feedbacks.nth(1)).toContainText('Pause: 60s');  // Hyp-Isolation
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC7: unbekannte Übung -> Fallback Compound (sicherer)
test('AC7: unbekannte Übung fällt auf Compound zurück (nicht Isolation)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Ganz Neue Übung XYZ', nSets: 2, targetReps: 5 })], goal: 'muskelaufbau' });

  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);

  // Hyp-Compound bei RPE 6 = 90s (nicht 60s wie Hyp-Isolation)
  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 90s');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC8: goal nicht gesetzt -> Fallback Hypertrophie
test('AC8: goal nicht gesetzt (null) verhält sich wie Hypertrophie', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 })], goal: null });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  // Hyp-Compound bei RPE 8 = 120s (Kraft-Compound wäre 180s)
  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 2min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC9: Briefing zeigt erwartete Pause
test('AC9: Session Briefing zeigt "Erwartete Pause" für die Fokus-Übung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  // Zwei Wochen: Vorwoche liefert den lastRpe-Durchschnitt für die
  // RPE-Ziel/Pause-Vorschau, aktuelle Woche ist der heutige, offene Tag.
  const prevWeekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
  const prevEx = mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 });
  prevEx.sets = prevEx.sets.map(s => ({ ...s, status: 'success', rpe: 8, done: true }));
  const curDay = mkDay([mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 })]);
  curDay.sessionCheckIn = null;
  curDay.sessionStartTs = null;
  const weeks = [
    { id: 1, startDate: prevWeekStart, note: '', mode: 'standard', days: [{ ...mkDay([prevEx]), markedDone: true }], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 2, startDate: todayISO(), note: '', mode: 'standard', days: [curDay], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
  ];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer: false, rpeEnabled: true, goal: 'muskelaufbau' },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Check-in überspringen, um direkt zum Briefing zu kommen.
  await page.click('[data-action="session-checkin-skip"][data-di="0"]');

  // Vorwoche-RPE 8, modifier 'normal' -> targetRpe 8 -> Hyp-Compound RPE 8 = 120s.
  await expect(page.locator('.session-briefing-card__focus')).toContainText('Erwartete Pause: 2min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// AC10: Trend-Modifier bleibt aktiv (bereits in session_coach_decision_matrix_v2.spec.js
// abgedeckt -- hier zusätzlich mit explizitem goal/Compound-Kontext verifiziert).
test('AC10: Trend-Modifier (RPE-Anstieg >=1.5) verlängert weiterhin die neue Pausendauer', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bankdrücken', nSets: 3, targetReps: 5 })], goal: 'muskelaufbau' });

  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);
  // Satz 2: RPE 8, Hyp-Compound Basis = 120s. Anstieg 8-6=2 >= 1.5 -> *1.5 = 180s.
  await setRpe(page, 0, 0, 1, 8);
  await toggleDone(page, 0, 0, 1);

  const subLines = page.locator('.set-feedback__line--sub');
  await expect(subLines.nth(1)).toContainText('RPE steigt schnell');
  await expect(subLines.nth(1)).toContainText('Pause: 3min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Settings-Zeile: Trainingsziel wählbar und toggle-bar (an/aus wie Onboarding).
test('Settings: Trainingsziel-Zeile vorhanden, Auswahl persistiert und toggelt ab', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bankdrücken', nSets: 1, targetReps: 5 })], goal: null });

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="set-goal"][data-goal="kraftaufbau"]');
  await expect(page.locator('[data-action="set-goal"][data-goal="kraftaufbau"]')).toHaveClass(/is-selected/);

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.goal);
  expect(stored).toBe('kraftaufbau');

  // Erneutes Klicken auf denselben Wert schaltet zurück auf null (wie Onboarding).
  await page.click('[data-action="set-goal"][data-goal="kraftaufbau"]');
  const stored2 = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.goal);
  expect(stored2).toBe(null);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Runde 9 (Cluster 5, Domain E): Pausenzeit-Entscheidungslogik existiert
// architekturbedingt doppelt (ui.js' confirm-set-Pfad, timer.js' toggle-done-
// Pfad + _isCoachEligibleDay()) -- ui.js kann timer.js nicht importieren und
// umgekehrt (CLAUDE.md). B78 musste beide bereits einmal synchronisieren.
// Diese Sektion sichert ab, dass beide Pfade für denselben Input weiterhin
// dieselbe Pausendauer erzeugen -- ein künftiges stilles Auseinanderdriften
// (z.B. eine der beiden Gating-Bedingungen wird nur an einer Stelle
// geändert) fällt hier automatisch auf, statt erst manuell wiederentdeckt
// zu werden. Jede Zeile prüft BEIDE Pfade gegen denselben, aus der
// (unabhängig als "single source" bestätigten) _pauseSecForRpe()-Tabelle
// erwarteten Wert -- das ist äquivalent zu "beide Pfade liefern denselben
// Wert", robuster als ein direkter Pfad-zu-Pfad-DOM-Vergleich. Nutzt
// dieselbe Toleranzfenster-Konvention wie die B78-Tests oben (das
// #pause-ring-num-Element ist ein LIVE-Countdown, ein exakter String-Match
// würde gegen die real vergangene Zeit zwischen Aktion und Read racen).
test.describe('Cross-path consistency (drift guard for B78/Domain E)', () => {
  const RPE_TIER_ROWS = [
    { rpe: 6,   goal: null,            compound: true,  expected: 90  }, // Hyp-Compound
    { rpe: 7,   goal: 'kraftaufbau',   compound: false, expected: 90  }, // Kraft-Isolation
    { rpe: 8,   goal: 'kraftaufbau',   compound: true,  expected: 180 }, // Kraft-Compound
    { rpe: 8.5, goal: null,            compound: false, expected: 120 }, // Hyp-Isolation, RPE_PAUSE_TIER_HIGH-Grenze
    { rpe: 9.5, goal: 'kraftaufbau',   compound: true,  expected: 300 }, // Kraft-Compound, hohe Grenze
    { rpe: 10,  goal: null,            compound: false, expected: 180 }, // Hyp-Isolation, terminaler Zweig
  ];

  for (const { rpe, goal, compound, expected } of RPE_TIER_ROWS) {
    test(`RPE ${rpe} / goal=${goal ?? 'null'} / ${compound ? 'Compound' : 'Isolation'}: confirm-set UND toggle-done liefern ${expected}s`, async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err.message));
      await page.goto('/');
      await page.waitForSelector('#app.is-ready', { timeout: 10000 });
      const exA = mkEx({ name: compound ? 'Bankdrücken' : 'Bizepscurls', nSets: 2, targetReps: 5 });
      const exB = mkEx({ name: compound ? 'Kniebeuge' : 'Trizepsdrücken', nSets: 2, targetReps: 5 });
      await seed(page, { exercises: [exA, exB], goal, autoStartPauseTimer: true });

      // Pfad A: confirm-set (Übung 0, Satz 0 -- nicht der letzte Satz).
      await setRpe(page, 0, 0, 0, rpe);
      await confirmSet(page, 0, 0);
      await expectPauseNum(page, expected);

      // Pfad B: toggle-done (Übung 1, Satz 0 -- identischer RPE/goal/Kategorie).
      await setRpe(page, 0, 1, 0, rpe);
      await toggleDone(page, 0, 1, 0);
      await expectPauseNum(page, expected);

      expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
    });
  }

  // Wichtigste Zeile: Eligibility-Gate deliberately false (sessionCoach
  // deaktiviert) -- beide Pfade müssen identisch auf den statischen
  // ex.pauseSec zurückfallen, statt die RPE-Empfehlung zu verwenden. Das ist
  // exakt die Gating-Logik, die B78 einmal auseinanderlaufen ließ (nicht die
  // RPE-Tabelle selbst, die bereits als echte single source bestätigt ist).
  test('Eligibility-Gate=false (sessionCoach aus): confirm-set UND toggle-done fallen beide auf ex.pauseSec zurück', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });
    // Bewusst untypischer pauseSec-Wert (77), um eine zufällige Übereinstimmung
    // mit einem RPE-Tabellenwert auszuschließen.
    const exA = mkEx({ name: 'Bankdrücken', nSets: 2, targetReps: 5 });
    exA.pauseSec = 77;
    const exB = mkEx({ name: 'Kniebeuge', nSets: 2, targetReps: 5 });
    exB.pauseSec = 77;
    await seed(page, { exercises: [exA, exB], goal: 'kraftaufbau', autoStartPauseTimer: true, sessionCoach: false });

    await setRpe(page, 0, 0, 0, 8); // würde ohne Gate 180s ergeben (Kraft-Compound)
    await confirmSet(page, 0, 0);
    await expectPauseNum(page, 77);

    await setRpe(page, 0, 1, 0, 8);
    await toggleDone(page, 0, 1, 0);
    await expectPauseNum(page, 77);

    expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  });
});
