import { test, expect } from '@playwright/test';
import { detectPlateaus } from '../plateauDetector.js';

// B41 (Runde 12, Cluster 6): "Variation"-Plateau-Strategie war laut BUGS.md
// strukturell nie erreichbar, weil `ex.tags` nirgends im UI befüllt wurde
// (_hasSharedMuscleGroupDay() hängt vollständig davon ab). Seit B184
// (Runde 8) + B188 (Runde 9, Backfill) füllt MUSCLE_GROUP_MAP/
// resolveMuscleGroups() ex.tags für neue UND kuratierte Bestandsübungen —
// per direkter Verifikation (dieser Test) bestätigt: die Strategie ist
// jetzt tatsächlich erreichbar und liefert sinnvollen Text. Reiner
// Unit-Test ohne Browser (plateauDetector.js ist "pure, no DOM").

function mkSet(weight) {
  return { weight, reps: 8, rpe: 6, status: 'success', done: true };
}

function mkEx(name, weight, tags) {
  return { name, tags, sets: [mkSet(weight), mkSet(weight)] };
}

function mkWeek(id, startDate, weight) {
  return {
    id, startDate, mode: 'standard',
    days: [{
      id: id * 10, markedDone: true,
      exercises: [
        mkEx('Bankdrücken', weight, ['Brust', 'Trizeps', 'Vordere Schulter']),
        mkEx('Schrägbankdrücken', 40, ['Brust', 'Vordere Schulter', 'Trizeps']),
        mkEx('Schulterdrücken', 30, ['Schulter', 'Vordere Schulter', 'Trizeps']),
      ],
    }],
  };
}

test('B41: "variation"-Strategie wird gewählt, wenn 3 Übungen am selben Tag Muskelgruppen-Tags teilen', () => {
  const weeks = [
    mkWeek(1, '2026-01-05', 80),
    mkWeek(2, '2026-01-12', 80),
    mkWeek(3, '2026-01-19', 80),
  ];
  const plateaus = detectPlateaus(weeks, [], true);
  const bank = plateaus.find(p => p.exerciseName === 'Bankdrücken');
  expect(bank).toBeDefined();
  expect(bank.strategy).toBe('variation');
  expect(bank.insightText).toContain('Variation');
  expect(bank.actionText).toContain('Variation versuchen');
});

test('Kontrolle: "volume"-Strategie bleibt, wenn keine andere Übung am Tag Tags teilt', () => {
  const weeks = ['2026-01-05', '2026-01-12', '2026-01-19'].map((sd, i) => ({
    id: i + 1, startDate: sd, mode: 'standard',
    days: [{ id: (i + 1) * 10, markedDone: true, exercises: [
      mkEx('Bankdrücken', 80, ['Brust', 'Trizeps', 'Vordere Schulter']),
      mkEx('Wadenheben', 30, ['Wade']),
    ] }],
  }));
  const plateaus = detectPlateaus(weeks, [], true);
  const bank = plateaus.find(p => p.exerciseName === 'Bankdrücken');
  expect(bank).toBeDefined();
  expect(bank.strategy).toBe('volume');
});

test('Kontrolle: exakt 1 gemeinsame Tag-Übung reicht NICHT (Schwelle ist >=2 andere Übungen)', () => {
  const weeks = ['2026-01-05', '2026-01-12', '2026-01-19'].map((sd, i) => ({
    id: i + 1, startDate: sd, mode: 'standard',
    days: [{ id: (i + 1) * 10, markedDone: true, exercises: [
      mkEx('Bankdrücken', 80, ['Brust', 'Trizeps', 'Vordere Schulter']),
      mkEx('Schrägbankdrücken', 40, ['Brust', 'Vordere Schulter', 'Trizeps']),
    ] }],
  }));
  const plateaus = detectPlateaus(weeks, [], true);
  const bank = plateaus.find(p => p.exerciseName === 'Bankdrücken');
  expect(bank).toBeDefined();
  expect(bank.strategy).toBe('volume');
});
