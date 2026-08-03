import { test, expect } from '@playwright/test';
import { getWeightRecommendation } from '../weightRecommendation.js';

// B198 (Runde 10, Domäne C): die Erfolgsquote über "die letzten 3-4 Wochen"
// nahm bisher `weekSets.slice(-4)` OHNE vorher auf Wochen MIT Daten für die
// Übung zu filtern — anders als der double_progression-Zweig direkt
// darunter, der genau das schon tat. Bei Lücken (Deload-Wochen ohne diese
// Übung, anderer Split-Tag) verdünnte das effektiv das gemeinte Fenster:
// echte, ältere Fehlschläge fielen aus dem "letzte 4"-Fenster heraus, sobald
// dazwischen genug datenlose Wochen lagen — obwohl "die letzten 4
// TRAININGSEINHEITEN dieser Übung" gemeint war, nicht "die letzten 4
// Wochen-Slots im Array". Reiner Unit-Test (kein Browser nötig).

function mkSet(status, rpe = null) {
  return { weight: 100, reps: 8, rpe, status, done: status === 'success', note: '' };
}

function mkWeekWithSets(startDate, sets) {
  return {
    id: startDate, startDate, note: '', mode: 'standard',
    days: [{
      id: 1, title: 'Tag A', exercises: sets.length
        ? [{ name: 'Kniebeuge', sets, targetReps: 8, weightStep: 2.5 }]
        : [],
    }],
  };
}

test('Fenster überspringt datenlose Zwischenwochen statt sie als leere Slots mitzuzählen', () => {
  const weeks = [
    mkWeekWithSets('2026-01-05', [mkSet('fail'), mkSet('fail')]),   // echte, alte Fehlschläge
    mkWeekWithSets('2026-01-12', []),                                // Deload/anderer Split-Tag — keine Sätze dieser Übung
    mkWeekWithSets('2026-01-19', []),                                // dito
    mkWeekWithSets('2026-01-26', [mkSet('success'), mkSet('success')]),
    mkWeekWithSets('2026-02-02', [mkSet('success'), mkSet('success')]),
  ];

  const rec = getWeightRecommendation('Kniebeuge', weeks);
  const successRateReason = rec.reasons.find(r => r.text.includes('Erfolgsquote'));

  // VORHER (Bug): weekSets.slice(-4) erfasste nur die 2 leeren + 2
  // Erfolgs-Wochen -> 100% Erfolgsquote, volle Steigerung empfohlen.
  // NACHHER (Fix): auf Wochen MIT Daten gefiltert -> Fail-Woche zählt mit,
  // Quote sinkt auf 4/6 = 67% -> "Wert halten" statt Steigerung.
  expect(successRateReason.text).toContain('67%');
  expect(rec.delta).toBe(0);
  expect(rec.reason).toBe('Letzte Einheit war intensiv, Wert halten');
});

test('Kontrolle: ohne Lücken bleibt das Verhalten unverändert (reine Erfolgsserie -> volle Steigerung)', () => {
  const weeks = [
    mkWeekWithSets('2026-01-05', [mkSet('success'), mkSet('success')]),
    mkWeekWithSets('2026-01-12', [mkSet('success'), mkSet('success')]),
    mkWeekWithSets('2026-01-19', [mkSet('success'), mkSet('success')]),
    mkWeekWithSets('2026-01-26', [mkSet('success'), mkSet('success')]),
  ];

  const rec = getWeightRecommendation('Kniebeuge', weeks);
  const successRateReason = rec.reasons.find(r => r.text.includes('Erfolgsquote'));

  expect(successRateReason.text).toContain('100%');
  expect(rec.reason).toBe('Hohe Erfolgsquote, Steigerung möglich');
});
