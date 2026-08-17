import { test, expect } from '@playwright/test';
import { getWeightRecommendation, isReadyForAutoSelect, roundToPlate } from '../weightRecommendation.js';

// Runde 31 (weightRecommendation.js-Audit): 2 parallele Diagnose-Agenten
// fanden 3 bestätigte Bugs + 4 Verdachtsfälle im zentralen RPE-/
// Erfolgsquoten-Empfehlungsalgorithmus. Die ersten 4 Tests laufen als
// reine Node-Unit-Tests ohne Browser (weightRecommendation.js ist "pure
// functions, keine Seiteneffekte", analog zu
// tests/metric_recommendation_nutrition_phase.spec.js).

function mkSet(weight, reps, rpe, status = 'success') {
  return { weight, reps, rpe, status, done: true };
}

test('getWeightRecommendation() bucht Sätze auch unter dem ORIGINAL-Namen, wenn die Übung an dem Tag substituiert wurde', () => {
  const weeks = [
    { startDate: '2026-01-05', mode: 'standard', days: [{ exercises: [{ name: 'Kniebeuge', substituteFor: null, sets: [mkSet(60, 8, 7)] }] }] },
    { startDate: '2026-01-12', mode: 'standard', days: [{ exercises: [{ name: 'Ausfallschritte', substituteFor: 'Kniebeuge', sets: [mkSet(65, 8, 7)] }] }] },
  ];
  // Ohne Fix: nur Woche 1 matcht "Kniebeuge" -> weekSets.filter(w=>w.success.length>0).length===1 < 2 -> null.
  const rec = getWeightRecommendation('Kniebeuge', weeks, 2.5);
  expect(rec).not.toBeNull();
  expect(rec.lastWeight).toBe(65);
});

test('isReadyForAutoSelect() bucht Sätze auch unter dem ORIGINAL-Namen, wenn die Übung an dem Tag substituiert wurde', () => {
  const weeks = [
    { startDate: '2026-01-05', mode: 'standard', days: [{ exercises: [{ name: 'Kniebeuge', substituteFor: null, targetReps: 8, sets: [mkSet(60, 8, 7)] }] }] },
    { startDate: '2026-01-12', mode: 'standard', days: [{ exercises: [{ name: 'Ausfallschritte', substituteFor: 'Kniebeuge', targetReps: 8, sets: [mkSet(65, 8, 7)] }] }] },
  ];
  // Ohne Fix: nur Woche 1 hat Daten fuer "Kniebeuge" -> weeksWithData.length===1 < 2 -> false.
  expect(isReadyForAutoSelect('Kniebeuge', weeks)).toBe(true);
});

test('isReadyForAutoSelect() zählt einen Teilerfolg (reps < targetReps) weiterhin als Fehlschlag (isFullSuccess()-Refactor bleibt äquivalent)', () => {
  const weeks = [
    { startDate: '2026-01-05', mode: 'standard', days: [{ exercises: [{ name: 'Kniebeuge', substituteFor: null, targetReps: 10, sets: [mkSet(60, 8, 7)] }] }] },
    { startDate: '2026-01-12', mode: 'standard', days: [{ exercises: [{ name: 'Kniebeuge', substituteFor: null, targetReps: 10, sets: [mkSet(60, 10, 7)] }] }] },
  ];
  // Woche 1: 8 von 10 Ziel-Wdh -> Teilerfolg zaehlt als Fehlschlag -> nicht "allPerfect".
  expect(isReadyForAutoSelect('Kniebeuge', weeks)).toBe(false);
});

test('roundToPlate() liefert keine Floating-Point-Artefakte bei untypischen Schrittweiten', () => {
  expect(roundToPlate(82.45, 0.1)).toBe(82.5);
  expect(roundToPlate(61.3, 0.1)).toBe(61.3);
});

async function seedAndTrigger(page, weeks) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  return page.evaluate(async ({ weeksArg }) => {
    const mod = await import('./insightEngine.js');
    const state = {
      weeks: weeksArg, curIdx: weeksArg.length - 1,
      favoriteExercises: [], customExercises: [], settings: {},
    };
    const insights = mod.evaluateInsights(state, { type: 'NEUE_WOCHE_ERSTELLT' });
    return insights.map(i => i.id);
  }, { weeksArg: weeks });
}

test('insightEngine.js A-01/A-02: isCompound wird jetzt berechnet -- Isolationsübung bei RPE 8 empfiehlt "Halten" statt Steigerung', async ({ page }) => {
  const mkWeek = (id, startDate) => ({
    id, startDate, mode: 'standard', isSeedWeek: false,
    days: [{ exercises: [{ name: 'Seitheben', substituteFor: null, sets: [mkSet(20, 8, 8)] }] }],
  });
  const weeks = [mkWeek(1, '2026-01-05'), mkWeek(2, '2026-01-12'), mkWeek(3, '2026-01-19')];

  const ids = await seedAndTrigger(page, weeks);
  // Vor dem Fix: isCompound fest auf true -> RPE 8 faellt in die
  // Compound-Halbzone (7.5-8.5) -> A-01 ("Steigerung empfohlen") feuert.
  // Nach dem Fix: Isolationsuebung -> halfCeiling kollabiert auf 7.5 ->
  // RPE 8 > 7.5 -> delta 0 -> A-02 ("Gewicht halten") feuert, A-01 nicht.
  expect(ids).toContain('A-02');
  expect(ids).not.toContain('A-01');
});
