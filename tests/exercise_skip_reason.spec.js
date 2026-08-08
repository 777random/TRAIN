import { test, expect } from '@playwright/test';

// B129: Übersprungene Übungen abfragen — wenn beim Tagesabschluss eine Übung
// KEINEN einzigen bewerteten Satz hat (alle pending), wird der Grund
// abgefragt (Verletzung/Keine Zeit/Zu müde/Ersetzt/Kein Grund), gespeichert
// als ex.skipReason (+ ex.skipDate nur bei 'injury'). Teilweise bewertete
// Übungen (mind. ein Satz success/fail) lösen die Abfrage NICHT aus.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkPendingSet() { return { weight: 0, reps: 0, rpe: null, status: 'pending', done: false, note: '' }; }
function mkDoneSet(status = 'success') { return { weight: 80, reps: 5, rpe: 7, status, done: status === 'success', note: '' }; }

function mkExercise(name, sets, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets, prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    skipReason: null, skipDate: null,
    targetSets: sets.length, targetReps: 5, progressionType: 'weight',
    progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    ...overrides,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, days, { schemaVersion = 33, extraState = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [{ id: 1, startDate: todayISO(), note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }];
  await page.evaluate(({ weeks, schemaVersion, extraState }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks,
      customTemplate: [], settings: { sessionCoach: false }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
      ...extraState,
    }));
  }, { weeks, schemaVersion, extraState });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('Komplett übersprungene Übung löst die Skip-Abfrage aus, "Verletzung" setzt skipReason+skipDate', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page, [mkDay(11, [mkExercise('Bankdrücken', [mkPendingSet(), mkPendingSet()])])]);

  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).toContainText('Bankdrücken wurde nicht durchgeführt');
  await page.click('[data-skip-val="injury"]');
  await page.waitForTimeout(150);

  // Danach der normale Bewertungs-Dialog
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.skipReason).toBe('injury');
  expect(ex.skipDate).toBe(todayISO());

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Teilweise bewertete Übung (mind. ein Satz success/fail) löst KEINE Abfrage aus', async ({ page }) => {
  await seed(page, [mkDay(11, [mkExercise('Bankdrücken', [mkDoneSet('success'), mkPendingSet()])])]);

  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).not.toContainText('wurde nicht durchgeführt');
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
});

test('Mehrere übersprungene Übungen werden nacheinander abgefragt', async ({ page }) => {
  await seed(page, [mkDay(11, [
    mkExercise('Bankdrücken', [mkPendingSet()]),
    mkExercise('Kniebeuge', [mkPendingSet()]),
  ])]);

  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).toContainText('Bankdrücken wurde nicht durchgeführt');
  await page.click('[data-skip-val="time"]');
  await page.waitForTimeout(150);
  await expect(page.locator('.completion-modal__title')).toContainText('Kniebeuge wurde nicht durchgeführt');
  await page.click('[data-skip-val="fatigue"]');
  await page.waitForTimeout(150);
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();

  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });

  const st = await readState(page);
  expect(st.weeks[0].days[0].exercises[0].skipReason).toBe('time');
  expect(st.weeks[0].days[0].exercises[1].skipReason).toBe('fatigue');
});

test('Alle 5 Optionen setzen den korrekten skipReason', async ({ page }) => {
  const cases = [
    ['injury', 'injury'], ['time', 'time'], ['fatigue', 'fatigue'],
    ['substituted', 'substituted'], ['', null],
  ];
  for (const [val, expected] of cases) {
    await seed(page, [mkDay(11, [mkExercise('Bankdrücken', [mkPendingSet()])])]);
    await page.click('[data-action="toggle-complete"]');
    await page.click(`[data-skip-val="${val}"]`);
    await page.waitForTimeout(150);
    await page.click('.completion-modal__rate-btn[data-val="2"]');
    await page.click('.completion-modal__skip');
    await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
    const st = await readState(page);
    expect(st.weeks[0].days[0].exercises[0].skipReason).toBe(expected);
    if (expected !== 'injury') expect(st.weeks[0].days[0].exercises[0].skipDate).toBe(null);
  }
});

// Pre-Launch-Diagnose-Sprint 2026-07-29, Befund #1: weekReview.js'
// _findFailHighlight() filterte NICHT nach ex.skipReason — eine verletzungs-
// bedingt übersprungene Übung (ex.skipReason === 'injury') landete trotzdem
// im "Was nicht gut lief"-Lowlight inkl. der Empfehlung "Gewicht um 5 %
// reduzieren". Fix schließt injury-Skips aus der Lowlight-/Empfehlungs-
// Betrachtung aus, ändert aber bewusst NICHT weekSuccessCounts()/
// _calcSuccessScore() (Erfolgsquote bleibt für die Statistik unverändert).
test('Verletzungsbedingt übersprungene Übung erscheint NICHT im "Was nicht gut lief"-Lowlight, normaler Fehlschlag weiterhin schon', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const today = todayISO();
  const week = {
    id: 1, startDate: today, note: '', mode: 'standard',
    days: [mkDay(11, [
      mkExercise('Kreuzheben', [mkDoneSet('fail'), mkDoneSet('fail')], { skipReason: 'injury', skipDate: today }),
      mkExercise('Bankdrücken', [mkDoneSet('fail')]),
    ])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };

  const review = await page.evaluate(async (week) => {
    const { buildWeekReview } = await import('./weekReview.js');
    return buildWeekReview(week, [week], []);
  }, week);

  const lowlightNames = review.lowlights.map(l => l.exName);
  expect(lowlightNames).not.toContain('Kreuzheben');
  expect(lowlightNames).toContain('Bankdrücken');

  const failLowlight = review.lowlights.find(l => l.type === 'fails');
  expect(failLowlight).toBeTruthy();
  expect(failLowlight.text).toContain('Bankdrücken');

  const rec = review.recommendations.find(r => r.text.includes('Gewicht um 5'));
  expect(rec).toBeTruthy();
  expect(rec.text).toContain('Bankdrücken');
  expect(rec.text).not.toContain('Kreuzheben');
});

// A6-Fix (Runde 2): eine Übung mit ex.skipReason === 'substituted' aus einer
// Vorwoche (z.B. nach Wochen-Klon, wieder alle Sätze 'pending') soll NICHT
// erneut in die Skip-Abfrage-Warteschlange aufgenommen werden -- "Durch
// andere ersetzt" ist strukturell dauerhaft, nicht tagesspezifisch. Andere
// skipReason-Werte (injury/time/fatigue) sind tagesspezifisch und lösen die
// Abfrage weiterhin jede Woche neu aus.
test('Übung mit skipReason "substituted" aus Vorwoche wird NICHT erneut gefragt, andere skipReason-Werte weiterhin schon', async ({ page }) => {
  await seed(page, [mkDay(11, [
    mkExercise('Bankdrücken', [mkPendingSet()], { skipReason: 'substituted', skipDate: null }),
    mkExercise('Kniebeuge', [mkPendingSet()], { skipReason: 'injury', skipDate: '2026-07-01' }),
  ])]);

  await page.click('[data-action="toggle-complete"]');
  // Nur Kniebeuge (injury) landet in der Abfrage-Warteschlange -- Bankdrücken
  // (substituted) wird übersprungen, obwohl auch dort alle Sätze pending sind.
  await expect(page.locator('.completion-modal__title')).toContainText('Kniebeuge wurde nicht durchgeführt');
  await page.click('[data-skip-val="time"]');
  await page.waitForTimeout(150);

  // Keine weitere Abfrage (Bankdrücken wurde nicht in die Warteschlange
  // aufgenommen) -- direkt der normale Bewertungs-Dialog.
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });

  const st = await readState(page);
  const exercises = st.weeks[0].days[0].exercises;
  // Bankdrücken bleibt unangetastet bei 'substituted' (nie erneut gefragt).
  expect(exercises[0].skipReason).toBe('substituted');
  // Kniebeuge wurde neu abgefragt und mit der aktuellen Antwort überschrieben.
  expect(exercises[1].skipReason).toBe('time');
});

// Runde 18 (Cluster 5): "Heute anders" (EX_SET_SUBSTITUTE) setzt seit diesem
// Fix zusätzlich skipReason='substituted' — vorher wurde ein Nutzer, der
// eine Übung NUR per "Heute anders" ersetzt hatte (ohne separat beim
// Tagesabschluss "🔄 Durch andere ersetzt" zu wählen), bei jedem weiteren
// Tagesabschluss erneut gefragt, obwohl er die Übung faktisch schon
// "beantwortet" hatte. Andere Skip-Gründe (injury/time/fatigue) bleiben
// bewusst tagesspezifisch wiederkehrend — siehe Test oben
// ("Übung mit skipReason 'substituted' aus Vorwoche...").
test('"Heute anders" (confirm-sub, echter UI-Pfad) setzt automatisch skipReason=substituted, Tagesabschluss fragt danach NICHT erneut', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page, [mkDay(11, [
    mkExercise('Sled Push', [mkPendingSet()]),
  ])]);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="open-sub-form"][data-di="0"][data-ei="0"]');
  await page.fill('.sub-name-input[data-di="0"][data-ei="0"]', 'Leg Press');
  await page.click('[data-action="confirm-sub"][data-di="0"][data-ei="0"]');

  let st = await readState(page);
  expect(st.weeks[0].days[0].exercises[0].skipReason).toBe('substituted');

  // Sätze bleiben nach reiner Umbenennung unangetastet (alle noch pending) —
  // wäre skipReason NICHT gesetzt, würde jetzt die Skip-Abfrage-Warteschlange
  // erscheinen (siehe Guard ui.js ~6415, `ex.skipReason !== 'substituted'`).
  await page.click('[data-action="toggle-complete"]');
  await expect(page.locator('.completion-modal__title')).not.toContainText('wurde nicht durchgeführt');
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });

  st = await readState(page);
  expect(st.weeks[0].days[0].exercises[0].skipReason).toBe('substituted');
  expect(st.weeks[0].days[0].exercises[0].name).toBe('Leg Press');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Migration: altes State ohne skipReason/skipDate/nextWeekPlanAutoReviewed lädt ohne Absturz, SCHEMA wird 33', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const oldEx = {
    name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [mkDoneSet('success')], prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false,
    targetSets: 1, targetReps: 5, progressionType: 'weight',
    progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    // bewusst KEIN skipReason/skipDate/nextWeekPlanAutoReviewed
  };
  await seed(page, [mkDay(11, [oldEx])], { schemaVersion: 30 });

  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.skipReason).toBe(null);
  expect(ex.skipDate).toBe(null);
  expect(ex.nextWeekPlanAutoReviewed).toBe(true);
  expect(st.meta.schemaVersion).toBe(33);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
