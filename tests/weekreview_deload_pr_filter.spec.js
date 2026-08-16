import { test, expect } from '@playwright/test';

// Runde 9/Cluster 2: weekReview.js's _findPR()/_findBestGain() (drive the
// "Neuer PR"/"Stärkste Steigerung" week-review-modal cards) did not exclude
// deload weeks, unlike exWeightHistory()/_weeklyP4PSeries()/_applyPrTracking()
// elsewhere in the codebase — a deload week's intentionally-reduced weight
// could show as a "Neuer PR", and a genuine gain could be inflated by
// comparing against a deload week's artificially-low baseline.

function mkEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
    progressionType: 'weight', archived: false,
  };
}
function mkWeek(id, startDate, mode, weight) {
  return {
    id, startDate, note: '', mode, days: [{
      id: id * 10, title: 'Tag', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [mkEx('Kniebeuge', weight)],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function goto(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function reviewHighlights(page, weeks, idx) {
  return page.evaluate(async ({ weeksArg, idxArg }) => {
    const weekReviewMod = await import('./weekReview.js');
    const review = weekReviewMod.buildWeekReview(weeksArg[idxArg], weeksArg, []);
    return review.highlights.map(h => h.type);
  }, { weeksArg: weeks, idxArg: idx });
}

test('Deload-Woche selbst zeigt keinen "Neuer PR", auch bei höherem Gewicht als die Vorwoche (Kontrolle: Nicht-Deload zeigt ihn)', async ({ page }) => {
  await goto(page);
  const weeksDeload = [mkWeek(1, '2026-06-01', 'standard', 80), mkWeek(2, '2026-06-08', 'deload', 100)];
  const deloadTypes = await reviewHighlights(page, weeksDeload, 1);
  expect(deloadTypes).not.toContain('pr');

  const weeksControl = [mkWeek(1, '2026-06-01', 'standard', 80), mkWeek(2, '2026-06-08', 'standard', 100)];
  const controlTypes = await reviewHighlights(page, weeksControl, 1);
  expect(controlTypes).toContain('pr');
});

test('Genuine Steigerung gg. Deload-Vorwoche zeigt keine "Stärkste Steigerung" (Kontrolle: Nicht-Deload-Vorwoche zeigt sie)', async ({ page }) => {
  await goto(page);
  // Solotest-Feedback (2026-08-16, weekReview.js): "Stärkste Steigerung" wird
  // jetzt unterdrückt, wenn sie dieselbe Übung wie "Neuer PR" beträfe (Dedupe
  // gegen Redundanz). Mit nur EINER Übung über 2 Wochen träfen PR und Gain
  // zwangsläufig dieselbe Übung -- eine vorgeschaltete, bereits höhere
  // All-Time-Bestleistung (90kg) isoliert diesen Test bewusst von diesem
  // Dedupe: _findPR() findet dadurch KEINEN neuen PR (80/80 < 90), nur
  // _findBestGain() (reine Vorwochen-Differenz) bleibt betroffen.
  const weeksDeloadPrev = [mkWeek(0, '2026-05-25', 'standard', 90), mkWeek(1, '2026-06-01', 'deload', 60), mkWeek(2, '2026-06-08', 'standard', 80)];
  const deloadPrevTypes = await reviewHighlights(page, weeksDeloadPrev, 2);
  expect(deloadPrevTypes).not.toContain('gain');

  const weeksControl = [mkWeek(0, '2026-05-25', 'standard', 90), mkWeek(1, '2026-06-01', 'standard', 60), mkWeek(2, '2026-06-08', 'standard', 80)];
  const controlTypes = await reviewHighlights(page, weeksControl, 2);
  expect(controlTypes).toContain('gain');
});
