import { test, expect } from '@playwright/test';

// Runde 7, Cluster C (C3): Volumen-/Satzzahl-Progression als Override fuer
// Plateau-/Stagnations-Erkennung. plateauDetector.js/insightEngine.js sind
// bewusst "pure, no DOM"-Module (siehe Dateikopf) -- getestet per direktem
// dynamischem Import statt vollem UI-Flow, da hier reine Funktionslogik
// geprueft wird, keine Rendering-/State-Dispatch-Mechanik.

function mkSet(weight, reps) {
  return { weight, reps, rpe: 7, status: 'success', done: true, note: '' };
}

function mkEx(name, weight, reps, setCount) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: Array.from({ length: setCount }, () => mkSet(weight, reps)),
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: setCount, targetReps: reps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
  };
}

function mkWeek(id, weeksAgo, setCount) {
  const d = new Date();
  d.setDate(d.getDate() - weeksAgo * 7);
  return {
    id, startDate: d.toISOString().split('T')[0], note: '', mode: 'standard',
    days: [{
      id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [mkEx('Bankdrücken', 60, 8, setCount)],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('plateauDetector: steigende Satzzahl bei flachem Gewicht ueber 3 Wochen -> kein Plateau', async ({ page }) => {
  await page.goto('/');
  const weeks = [mkWeek(1, 2, 3), mkWeek(2, 1, 3), mkWeek(3, 0, 4)]; // 3->3->4 Sätze
  const plateaus = await page.evaluate(async (wks) => {
    const { detectPlateaus } = await import('/plateauDetector.js');
    return detectPlateaus(wks, [], true);
  }, weeks);
  expect(plateaus.find(p => p.exerciseName === 'Bankdrücken')).toBeUndefined();
});

test('plateauDetector: Kontrolltest -- Gewicht/Wdh/Sätze alle konstant über 3 Wochen -> weiterhin Plateau', async ({ page }) => {
  await page.goto('/');
  const weeks = [mkWeek(1, 2, 3), mkWeek(2, 1, 3), mkWeek(3, 0, 3)]; // 3->3->3, alles eingefroren
  const plateaus = await page.evaluate(async (wks) => {
    const { detectPlateaus } = await import('/plateauDetector.js');
    return detectPlateaus(wks, [], true);
  }, weeks);
  expect(plateaus.find(p => p.exerciseName === 'Bankdrücken')).toBeDefined();
});

test('insightEngine S-01: steigende Satzzahl bei flachem Gewicht über 4 Wochen -> keine Stagnations-Meldung', async ({ page }) => {
  await page.goto('/');
  const weeks = [mkWeek(1, 3, 3), mkWeek(2, 2, 3), mkWeek(3, 1, 3), mkWeek(4, 0, 4)]; // 3->3->3->4
  const result = await page.evaluate(async (wks) => {
    const { INSIGHTS } = await import('/insightEngine.js');
    const s01 = INSIGHTS.find(r => r.id === 'S-01');
    const state = { weeks: wks, settings: { rpeEnabled: true } };
    return s01.evaluate(state);
  }, weeks);
  expect(result).toBeNull();
});

test('insightEngine S-01: Kontrolltest -- Gewicht/Sätze konstant über 4 Wochen -> Stagnations-Meldung erscheint weiterhin', async ({ page }) => {
  await page.goto('/');
  const weeks = [mkWeek(1, 3, 3), mkWeek(2, 2, 3), mkWeek(3, 1, 3), mkWeek(4, 0, 3)]; // 3->3->3->3
  const result = await page.evaluate(async (wks) => {
    const { INSIGHTS } = await import('/insightEngine.js');
    const s01 = INSIGHTS.find(r => r.id === 'S-01');
    const state = { weeks: wks, settings: { rpeEnabled: true } };
    return s01.evaluate(state);
  }, weeks);
  expect(result).not.toBeNull();
  expect(result.id).toBe('S-01');
});

test('insightEngine: exSetCountHistory() zaehlt Erfolgs-Saetze pro Woche korrekt', async ({ page }) => {
  await page.goto('/');
  const weeks = [mkWeek(1, 2, 3), mkWeek(2, 1, 3), mkWeek(3, 0, 4)];
  const history = await page.evaluate(async (wks) => {
    const { exSetCountHistory, getSortedWeeks } = await import('/insightEngine.js');
    return exSetCountHistory(getSortedWeeks({ weeks: wks }), 'Bankdrücken');
  }, weeks);
  expect(history).toEqual([3, 3, 4]);
});
