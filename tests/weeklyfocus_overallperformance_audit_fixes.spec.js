import { test, expect } from '@playwright/test';

// Runde 36 (weeklyFocus.js + overallPerformance.js-Audit): 2 parallele
// Diagnose-Agenten fanden 6 bestätigte Bugs + 1 Verdachtsfall (nur
// dokumentiert, kein Test nötig). Nutzer wählte "Alle 6 fixen + V1
// dokumentieren". weeklyFocus.js importiert state.js (Seiteneffekte) --
// alle Tests laufen im Browser-Kontext via direktem Modul-Import, analog
// zu tests/weeklyfocus_audit_fixes.spec.js.

function isoWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, reps, rpe, status = 'success') {
  return { weight, reps, rpe, status, done: status !== 'pending', note: '' };
}

function mkEx(name, sets, opts = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
    ...opts,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [],
  };
}

function mkWeek(id, startDate, days, isSeedWeek = false) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek };
}

function mkState(weeks, overrides = {}) {
  return {
    weeks, curIdx: weeks.length - 1, settings: {}, favoriteExercises: [],
    customExercises: [], decisionLog: [], coachQuestion: null, lastReentryHandled: null,
    ...overrides,
  };
}

async function computeFocus(page, state) {
  return page.evaluate(async (s) => {
    const mod = await import('./weeklyFocus.js');
    return mod.computeWeeklyFocus(s);
  }, state);
}

async function computeStructural(page, state) {
  return page.evaluate(async (s) => {
    const mod = await import('./weeklyFocus.js');
    return mod.computeStructuralSignals(s);
  }, state);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
});

test('B1: _checkRisingRpe() erkennt einen RPE-Anstieg auch, wenn die Übung in einer der 3 Wochen substituiert wurde', async ({ page }) => {
  const weeks = [
    mkWeek(1, isoWeeksAgo(2), [mkDay(11, [mkEx('Kniebeuge', [mkSet(60, 8, 6)])])]),
    mkWeek(2, isoWeeksAgo(1), [mkDay(12, [mkEx('Ausfallschritte', [mkSet(60, 8, 7)], { substituteFor: 'Kniebeuge' })])]),
    mkWeek(3, isoWeeksAgo(0), [mkDay(13, [mkEx('Kniebeuge', [mkSet(60, 8, 8)])])]),
  ];
  const focus = await computeFocus(page, mkState(weeks));
  expect(focus.status).toBe('overload');
  expect(focus.signalType).toBe('rpe');
  expect(focus.reasoning).toContain('Kniebeuge');
});

test('B2: _checkPrePlateau() erkennt steigende RPE-Kosten pro kg auch, wenn die Übung in einer der 3 Wochen substituiert wurde', async ({ page }) => {
  // Gewicht steigt leicht (60->62.5->65), RPE-Kosten pro kg steigen dabei
  // trotzdem streng monoton (RPE steigt schneller als das Gewicht).
  const weeks = [
    mkWeek(1, isoWeeksAgo(2), [mkDay(11, [mkEx('Kniebeuge', [mkSet(60, 8, 6)])])]),
    mkWeek(2, isoWeeksAgo(1), [mkDay(12, [mkEx('Ausfallschritte', [mkSet(62.5, 8, 6.5)], { substituteFor: 'Kniebeuge' })])]),
    mkWeek(3, isoWeeksAgo(0), [mkDay(13, [mkEx('Kniebeuge', [mkSet(65, 8, 7.5)])])]),
  ];
  const focus = await computeFocus(page, mkState(weeks));
  expect(focus.status).toBe('pre_plateau');
  expect(focus.exerciseName).toBe('Kniebeuge');
});

test('B3: Compound/Isolation-Balance nutzt jetzt isCompoundExercise() statt der hardcodierten Kategorie-Liste', async ({ page }) => {
  // 'Bizepscurls': Kategorie 'Pull', aber laut ISOLATION_EXERCISE_NAMES
  // explizit Isolation. Vor dem Fix zählte es hier fälschlich als Compound
  // (>=60% -> kein Signal). Mit Fix: 0% Compound -> Signal feuert.
  const weeks = [];
  for (let n = 4; n >= 1; n--) {
    weeks.push(mkWeek(5 - n, isoWeeksAgo(n), [mkDay(n, [
      mkEx('Bizepscurls', [mkSet(20, 10, 6), mkSet(20, 10, 6)]),
    ])]));
  }
  const signals = await computeStructural(page, mkState(weeks));
  const ci = signals.find(s => s.type === 'compound_isolation');
  expect(ci).toBeDefined();
  expect(ci.compoundPct).toBe(0);
});

test('B4: _checkPersistentFailure() erkennt drei Fehlschlags-Wochen auch, wenn die Übung in einer davon substituiert wurde', async ({ page }) => {
  const weeks = [
    mkWeek(1, isoWeeksAgo(2), [mkDay(11, [mkEx('Kniebeuge', [mkSet(60, 8, 9, 'fail'), mkSet(60, 8, 9, 'fail'), mkSet(60, 8, 9, 'fail')])])]),
    mkWeek(2, isoWeeksAgo(1), [mkDay(12, [mkEx('Ausfallschritte', [mkSet(60, 8, 9, 'fail'), mkSet(60, 8, 9, 'fail'), mkSet(60, 8, 9, 'fail')], { substituteFor: 'Kniebeuge' })])]),
    mkWeek(3, isoWeeksAgo(0), [mkDay(13, [mkEx('Kniebeuge', [mkSet(60, 8, 9, 'fail'), mkSet(60, 8, 9, 'fail'), mkSet(60, 8, 9, 'fail')])])]),
  ];
  const focus = await computeFocus(page, mkState(weeks));
  expect(focus.status).toBe('persistent_failure');
  expect(focus.exerciseName).toBe('Kniebeuge');
});

test('B5: _checkMultiExerciseFailure() gruppiert Sätze einer substituierten Übung unter dem Original-Namen', async ({ page }) => {
  // >=15 bewertete Saetze insgesamt, Erfolgsquote <=20%, >=2 betroffene
  // Uebungen mit je >=2 Saetzen und mind. 1 Fehlschlag. "Kniebeuge" wird in
  // Woche 2 substituiert -- ohne Fix landen ihre Saetze unter einem
  // getrennten "Ausfallschritte"-Eintrag statt zusammengefuehrt zu werden.
  const failSets = (n) => Array.from({ length: n }, () => mkSet(60, 8, 9, 'fail'));
  const weeks = [
    mkWeek(1, isoWeeksAgo(2), [mkDay(11, [
      mkEx('Kniebeuge', failSets(3)),
      mkEx('Bankdrücken', failSets(3)),
    ])]),
    mkWeek(2, isoWeeksAgo(1), [mkDay(12, [
      mkEx('Ausfallschritte', failSets(3), { substituteFor: 'Kniebeuge' }),
      mkEx('Bankdrücken', failSets(3)),
    ])]),
    mkWeek(3, isoWeeksAgo(0), [mkDay(13, [
      mkEx('Kniebeuge', failSets(3)),
      mkEx('Bankdrücken', failSets(3)),
    ])]),
  ];
  const signals = await computeStructural(page, mkState(weeks));
  const mf = signals.find(s => s.type === 'multi_exercise_failure');
  expect(mf).toBeDefined();
  const kniebeugeEntry = mf.worst.find(w => w.name === 'Kniebeuge');
  expect(kniebeugeEntry).toBeDefined();
  expect(mf.worst.find(w => w.name === 'Ausfallschritte')).toBeUndefined();
});

test('B6: _checkProgression()s Konfidenz-Berechnung zählt Sätze auch, wenn die Übung in einer der letzten 4 Wochen substituiert wurde', async ({ page }) => {
  // Woche 1 (aelteste von 4) ist substituiert und enthaelt 1 Fehlschlag --
  // faellt aus dem "letzte 3 Wochen"-Bereitschafts-Fenster (isReadyForAutoSelect)
  // natuerlich heraus, wird aber vom "letzte 4 Wochen"-Konfidenz-Fenster erfasst.
  // Ohne Fix zaehlt Woche 1 dort nicht mit (ex.name!=='Kniebeuge') -> 6/6
  // Erfolg (100%, "high"). Mit Fix zaehlt sie mit -> 7/8 Erfolg (87.5%,
  // "medium", da < CONF_HIGH_SUCCESS_RATE_MIN 0.9).
  const mkWk = (id, date, name, sets, opts = {}) =>
    mkWeek(id, date, [mkDay(id * 10, [mkEx(name, sets, opts)])]);
  const weeks = [
    mkWk(1, isoWeeksAgo(3), 'Ausfallschritte', [mkSet(55, 8, 6), mkSet(55, 8, 6, 'fail')], { substituteFor: 'Kniebeuge' }),
    mkWk(2, isoWeeksAgo(2), 'Kniebeuge', [mkSet(57.5, 8, 6), mkSet(57.5, 8, 6)]),
    mkWk(3, isoWeeksAgo(1), 'Kniebeuge', [mkSet(60, 8, 6), mkSet(60, 8, 6)]),
    mkWk(4, isoWeeksAgo(0), 'Kniebeuge', [mkSet(62.5, 8, 6), mkSet(62.5, 8, 6)]),
  ];
  const focus = await computeFocus(page, mkState(weeks));
  expect(focus.status).toBe('progression');
  expect(focus.exerciseName).toBe('Kniebeuge');
  expect(focus.confidence).toBe('medium');
  const konfidenzEvidence = focus.evidence.find(e => e.label === 'Konfidenz');
  expect(konfidenzEvidence.value).toContain('88%');
});
