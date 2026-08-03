import { test, expect } from '@playwright/test';

// Runde 9, Cluster 6 (Kosmetik, Nebenfund aus Domäne C/diagnose-runde8):
// weeklyFocus.js' _scoreWeek() dupliziert setUtils.js' weekSuccessCounts()
// bewusst (zirkulärer Import sonst, ui.js importiert bereits weeklyFocus.js)
// -- aktuell Byte-identische Formel. Dieser Test loest die Duplikation NICHT
// auf, sondern faengt kuenftiges stilles Auseinanderlaufen ab (gleiche
// Fehlerklasse wie der historische B38-Bug). Beide Module sind pure,
// state-lose Funktionen -- Test per direktem dynamischem Import, kein
// UI-Flow noetig (Muster wie volume_progression_override.spec.js).

function mkSet(status) {
  return { weight: 60, reps: 8, rpe: 7, status, done: status !== 'pending', note: '' };
}

function mkEx(name, statuses, archived = false) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: statuses.map(mkSet),
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived, substituteFor: null,
  };
}

function mkWeek(exercises) {
  return {
    id: 1, startDate: '2026-07-01', note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('_scoreWeek() (weeklyFocus.js) und weekSuccessCounts() (setUtils.js) liefern identisches Ergebnis (Drift-Absicherung)', async ({ page }) => {
  await page.goto('/');
  const week = mkWeek([
    mkEx('Bankdrücken', ['success', 'success', 'fail', 'pending']),
    mkEx('Rudern Maschine', ['success', 'fail']),
    mkEx('Archiviert', ['success', 'success'], true), // muss ausgeschlossen werden
  ]);
  const { fromWeeklyFocus, fromSetUtils } = await page.evaluate(async (wk) => {
    const { _scoreWeek } = await import('/weeklyFocus.js');
    const { weekSuccessCounts } = await import('/setUtils.js');
    return { fromWeeklyFocus: _scoreWeek(wk), fromSetUtils: weekSuccessCounts(wk) };
  }, week);

  expect(fromWeeklyFocus).toEqual(fromSetUtils);
  // Sabotage-Gegenprobe (dokumentiert, nicht Teil der Assertion): würde
  // eine der beiden Formeln z.B. archivierte Übungen nicht mehr ausschließen
  // oder 'fail' anders zählen, schlägt genau diese toEqual-Prüfung fehl --
  // das ist der beabsichtigte Zweck dieses Tests.
  expect(fromWeeklyFocus).toEqual({ succ: 3, fail: 2, total: 5, pct: 60 });
});
