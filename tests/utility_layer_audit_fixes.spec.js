import { test, expect } from '@playwright/test';
import { detectPlateaus } from '../plateauDetector.js';

// Runde 29 (Geteilte-Utility-Schicht-Audit): 3 parallele Diagnose-Agenten
// fanden 8 bestätigte Bugs + 4 Verdachtsfälle in insightEngine.js und
// plateauDetector.js. Dieser Test deckt die wichtigsten, direkt
// testbaren Fixes ab. plateauDetector.js ist pure (kein DOM) -- diese 3
// Tests laufen ohne Browser-Fixture, analog zu
// tests/plateau_variation_strategy.spec.js.

function mkSet(weight, status = 'success') {
  return { weight, reps: 8, rpe: 6, status, done: status !== 'pending' };
}

function mkEx(name, weight, opts = {}) {
  return { name, tags: [], sets: [mkSet(weight), mkSet(weight)], archived: false, substituteFor: null, ...opts };
}

function mkPlateauWeek(id, startDate, exercises) {
  return { id, startDate, mode: 'standard', days: [{ id: id * 10, markedDone: true, exercises }] };
}

test('detectPlateaus(): eine Übung, die einmal als Substitutions-ZIEL diente, wird für ihre EIGENEN Wochen weiterhin geprüft (keine dauerhafte Blacklist)', () => {
  // "Ausfallschritte" ist an 3 Wochen eine reguläre, stagnierende Übung --
  // an einer VIERTEN (irrelevanten) Woche wurde eine andere Übung einmalig
  // per "Heute anders" auf "Ausfallschritte" substituiert. Vor dem Fix
  // wurde "Ausfallschritte" dadurch komplett aus der Plateau-Prüfung
  // entfernt, auch für seine eigenen 3 reguären Wochen.
  const weeks = [
    mkPlateauWeek(1, '2026-01-05', [mkEx('Ausfallschritte', 40)]),
    mkPlateauWeek(2, '2026-01-12', [mkEx('Ausfallschritte', 40)]),
    mkPlateauWeek(3, '2026-01-19', [mkEx('Ausfallschritte', 40)]),
    mkPlateauWeek(4, '2026-01-26', [mkEx('Ausfallschritte', 40, { substituteFor: 'Kniebeuge' })]),
  ];
  const plateaus = detectPlateaus(weeks, [], true);
  const found = plateaus.find(p => p.exerciseName === 'Ausfallschritte');
  expect(found).toBeDefined();
  expect(found.plateauWeeks).toBeGreaterThanOrEqual(3);
});

test('detectPlateaus(): pending-Sätze zählen nicht mehr im Erfolgsquote-Nenner', () => {
  // 2 success + 2 pending pro Woche -- ohne Fix läge die Erfolgsquote bei
  // 50% (unter der 80%-Schwelle, KEIN Plateau erkannt). Mit Fix zählen nur
  // die 2 bewerteten Sätze -> 100%, Plateau wird erkannt.
  const exWithPending = (name, weight) => ({
    name, weight, tags: [], archived: false, substituteFor: null,
    sets: [mkSet(weight, 'success'), mkSet(weight, 'success'), mkSet(weight, 'pending'), mkSet(weight, 'pending')],
  });
  const weeks = [
    mkPlateauWeek(1, '2026-01-05', [exWithPending('Bankdrücken', 60)]),
    mkPlateauWeek(2, '2026-01-12', [exWithPending('Bankdrücken', 60)]),
    mkPlateauWeek(3, '2026-01-19', [exWithPending('Bankdrücken', 60)]),
  ];
  const plateaus = detectPlateaus(weeks, [], true);
  const found = plateaus.find(p => p.exerciseName === 'Bankdrücken');
  expect(found).toBeDefined();
  expect(found.avgSuccessRate).toBe(1);
});

test('detectPlateaus(): archivierte Übungen werden nicht mehr als stagnierend vorgeschlagen', () => {
  const weeks = [
    mkPlateauWeek(1, '2026-01-05', [mkEx('Latziehen', 50, { archived: true })]),
    mkPlateauWeek(2, '2026-01-12', [mkEx('Latziehen', 50, { archived: true })]),
    mkPlateauWeek(3, '2026-01-19', [mkEx('Latziehen', 50, { archived: true })]),
  ];
  const plateaus = detectPlateaus(weeks, [], true);
  expect(plateaus.find(p => p.exerciseName === 'Latziehen')).toBeUndefined();
});

function mkInsightWeek(id, startDate, { isSeedWeek = false, mode = 'standard', successCount, totalSets = 4 }) {
  const sets = Array.from({ length: totalSets }, (_, i) => ({
    weight: 60, reps: 8, rpe: 7, status: i < successCount ? 'success' : 'fail', done: true, note: '',
  }));
  return {
    id, startDate, mode, isSeedWeek, note: '',
    days: [{ id: id * 10, markedDone: true, exercises: [{ name: 'Kniebeuge', sets, archived: false, substituteFor: null }] }],
    sessionLog: [], bodyData: {}, restDays: [],
  };
}

test('K-03 ("Beste Woche"-Toast) wird nicht mehr dauerhaft durch die Startwerte-Woche unterdrückt', async ({ page }) => {
  const seedWeek  = mkInsightWeek(0, '2026-01-01', { isSeedWeek: true, successCount: 4 }); // 100%
  const realWeek1 = mkInsightWeek(1, '2026-01-08', { successCount: 3 }); // 75% < 90%, kein eigener Trigger
  const realWeek2 = mkInsightWeek(2, '2026-01-15', { successCount: 4 }); // 100% -- soll "Beste Woche" auslösen

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const result = await page.evaluate(async ({ weeks }) => {
    const mod = await import('./insightEngine.js');
    const state = { weeks, curIdx: weeks.length - 1, favoriteExercises: [], prs: {} };
    const insights = mod.evaluateInsights(state, { type: 'WOCHE_ABGESCHLOSSEN' });
    return insights.map(i => i.id);
  }, { weeks: [seedWeek, realWeek1, realWeek2] });

  expect(result).toContain('K-03');
});

test('exWeightHistory() bucht ein Gewicht jetzt auch unter dem ORIGINAL-Namen, wenn die Übung an dem Tag substituiert wurde', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const week1 = { startDate: '2026-01-05', days: [{ exercises: [{ name: 'Kniebeuge', substituteFor: null, sets: [{ status: 'success', weight: 60 }] }] }] };
  const week2 = { startDate: '2026-01-12', days: [{ exercises: [{ name: 'Ausfallschritte', substituteFor: 'Kniebeuge', sets: [{ status: 'success', weight: 50 }] }] }] };

  const history = await page.evaluate(async ({ weeks }) => {
    const mod = await import('./insightEngine.js');
    return mod.exWeightHistory(weeks, 'Kniebeuge');
  }, { weeks: [week1, week2] });

  expect(history).toEqual([60, 50]);
});

test('computeSleepCorrelation() schließt Deload-Wochen jetzt aus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const goodWeeks = ['2026-01-05', '2026-01-12', '2026-01-19'].map((sd, i) =>
    mkInsightWeek(i, sd, { successCount: 4 })); // sleep=8, 100%
  goodWeeks.forEach(w => { w.days[0].sleepHours = 8; });
  const poorWeeks = ['2026-01-26', '2026-02-02', '2026-02-09'].map((sd, i) =>
    mkInsightWeek(i + 3, sd, { successCount: 2 })); // sleep=5, 50%
  poorWeeks.forEach(w => { w.days[0].sleepHours = 5; });
  // Deload-Woche mit gutem Schlaf, aber 0% Quote -- würde ohne Fix in den
  // "guter Schlaf"-Topf gemischt und avgWith nach unten ziehen.
  const deloadWeek = mkInsightWeek(6, '2026-02-16', { mode: 'deload', successCount: 0 });
  deloadWeek.days[0].sleepHours = 8;

  const result = await page.evaluate(async ({ weeks }) => {
    const mod = await import('./insightEngine.js');
    return mod.computeSleepCorrelation({ weeks });
  }, { weeks: [...goodWeeks, ...poorWeeks, deloadWeek] });

  expect(result).not.toBeNull();
  expect(result.avgWith).toBeCloseTo(1.0, 5);
});
