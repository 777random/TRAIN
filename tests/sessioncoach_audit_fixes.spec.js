import { test, expect } from '@playwright/test';
import { buildSetFeedback, buildLastSetMessage } from '../sessionCoach.js';

// Runde 32 (sessionCoach.js-Audit): 2 parallele Diagnose-Agenten fanden 1
// bestätigten Bug (buildLastSetMessage() ohne Compound/Isolation-
// Bewusstsein) + 4 Verdachtsfälle. Reine Node-Unit-Tests ohne Browser --
// sessionCoach.js ist bewusst "importfrei, reine Berechnungsfunktionen"
// (siehe Datei-Kopfkommentar).

test('buildLastSetMessage(): Isolationsübung bei RPE 8 zeigt "Hart aber fertig" statt "Perfekt abgeschlossen" (konsistent mit getWeightRecommendation()s Halten-Empfehlung)', () => {
  const s  = { weight: 20, reps: 8, rpe: 8, status: 'success', done: true };
  const ex = { name: 'Bizepscurls', weightStep: 2.5, targetReps: 8 };

  const isolation = buildLastSetMessage(s, ex, 20, 2.5, null, false);
  expect(isolation.text).toContain('Hart aber fertig');
  expect(isolation.text).not.toContain('Perfekt abgeschlossen');
});

test('Kontrolle: Compound-Übung bei RPE 8 zeigt weiterhin "Perfekt abgeschlossen" (unverändertes Verhalten)', () => {
  const s  = { weight: 100, reps: 8, rpe: 8, status: 'success', done: true };
  const ex = { name: 'Kniebeuge', weightStep: 2.5, targetReps: 8 };

  const compound = buildLastSetMessage(s, ex, 102.5, 2.5, null, true);
  expect(compound.text).toContain('Perfekt abgeschlossen');
});

test('Kontrolle: isCompound-Parameter weggelassen fällt weiterhin auf Compound-Verhalten zurück (Rückwärtskompatibilität)', () => {
  const s  = { weight: 100, reps: 8, rpe: 8, status: 'success', done: true };
  const ex = { name: 'Kniebeuge', weightStep: 2.5, targetReps: 8 };

  const noParam = buildLastSetMessage(s, ex, 102.5, 2.5, null);
  expect(noParam.text).toContain('Perfekt abgeschlossen');
});

test('buildSetFeedback(): RPE-Trend-Pausenverlängerung wird auf MAX_PAUSE_SEC (300s) gedeckelt', () => {
  const ex = {
    name: 'Kniebeuge', weightStep: 2.5, targetReps: 8, metric: 'reps',
    sets: [
      { weight: 100, reps: 8, rpe: 8, status: 'success', done: true },
      { weight: 100, reps: 8, rpe: 9.5, status: 'success', done: true },
    ],
  };
  // Basis-Pausenzeit bei RPE 9.5/Kraft/Compound ist bereits 300s (Maximum
  // der Tabelle). Trend (RPE-Sprung >=1.5 ggü. Vorsatz) würde ohne Deckel
  // auf 450s hochskalieren.
  const fb = buildSetFeedback(ex.sets[1], ex, null, 1, 'kraftaufbau', true, 'all', 2.5);
  expect(fb.pauseSec).toBe(300);
});
