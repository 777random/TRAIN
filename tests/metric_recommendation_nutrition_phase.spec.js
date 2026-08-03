import { test, expect } from '@playwright/test';
import { getMetricRecommendation } from '../weightRecommendation.js';

// B139-Nebenfund (Runde 12, Cluster 5): getWeightRecommendation() respektiert
// seit B139 settings.nutritionPhase (cut: volle Steigerung nur bis RPE 6.0,
// KEINE Halbzone danach), getMetricRecommendation() (Distanz/Zeit-Übungen,
// metric 'm'/'sec') hatte diesen Parameter bisher gar nicht in der Signatur —
// fiel immer auf 'maintenance' zurück, unabhängig von der tatsächlichen
// Phase des Nutzers. Reiner Unit-Test ohne Browser (weightRecommendation.js
// ist "pure functions, keine Seiteneffekte").

function mkSet(reps, rpe) {
  return { reps, rpe, status: 'success', done: true };
}

function mkWeekWithSets(startDate, reps, rpe) {
  return {
    startDate, mode: 'standard',
    days: [{ exercises: [{ name: 'Rudern', sets: [mkSet(reps, rpe)] }] }],
  };
}

test('cut-Phase: RPE 6.5 bei Distanz-Übung führt zu "Halten", nicht zu Steigerung (dieselbe strikte Schwelle wie bei Gewicht)', () => {
  const weeks = [
    mkWeekWithSets('2026-01-05', 400, 6.5),
    mkWeekWithSets('2026-01-12', 400, 6.5),
  ];
  const rec = getMetricRecommendation('Rudern', weeks, 50, 'weight_first', null, true, 'cut');
  expect(rec.delta).toBe(0);
});

test('Kontrolle: maintenance-Phase bei gleichem RPE 6.5 erlaubt weiterhin volle Steigerung', () => {
  const weeks = [
    mkWeekWithSets('2026-01-05', 400, 6.5),
    mkWeekWithSets('2026-01-12', 400, 6.5),
  ];
  const rec = getMetricRecommendation('Rudern', weeks, 50, 'weight_first', null, true, 'maintenance');
  expect(rec.delta).toBeGreaterThan(0);
});

test('Kontrolle: nutritionPhase-Parameter weggelassen fällt weiterhin auf "maintenance" zurück (Rückwärtskompatibilität bestehender Aufrufer)', () => {
  const weeks = [
    mkWeekWithSets('2026-01-05', 400, 6.5),
    mkWeekWithSets('2026-01-12', 400, 6.5),
  ];
  const rec = getMetricRecommendation('Rudern', weeks, 50, 'weight_first', null);
  expect(rec.delta).toBeGreaterThan(0);
});
