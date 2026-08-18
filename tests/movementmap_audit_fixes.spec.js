import { test, expect } from '@playwright/test';
import {
  MOVEMENT_MAP,
  resolveCategory,
  isCompoundExercise,
  defaultShowPlates,
} from '../movementMap.js';

// Runde 34 (movementMap.js-Audit): 2 parallele Diagnose-Agenten fanden 5
// bestätigte Bugs (Namens-Varianten-Lücken zwischen MOVEMENT_MAP und
// NO_BARBELL_EXERCISE_NAMES + fehlende Null-Robustheit) + 1 Verdachtsfall.
// movementMap.js ist "import-frei" (siehe Datei-Kopfkommentar) -> reine
// Node-Unit-Tests ohne Browser, analog zu weightrecommendation_audit_fixes.spec.js.

test('B1: defaultShowPlates() erkennt jetzt auch die hyphenierten Formen "Push-Up"/"Chin-Up"', () => {
  expect(defaultShowPlates('Push-Up')).toBe(false);
  expect(defaultShowPlates('Push-Ups')).toBe(false);
  expect(defaultShowPlates('Chin-Up')).toBe(false);
  expect(defaultShowPlates('Chin-Ups')).toBe(false);
});

test('B2: MOVEMENT_MAP kennt jetzt auch die Leerzeichen-Formen "Push Up"/"Pull Up"/"Chin Up"', () => {
  expect(MOVEMENT_MAP['Push Up']).toBe('Push');
  expect(MOVEMENT_MAP['Push Ups']).toBe('Push');
  expect(MOVEMENT_MAP['Pull Up']).toBe('Pull');
  expect(MOVEMENT_MAP['Pull Ups']).toBe('Pull');
  expect(MOVEMENT_MAP['Chin Up']).toBe('Pull');
  expect(MOVEMENT_MAP['Chin Ups']).toBe('Pull');
  expect(resolveCategory('Push Up', {})).toBe('Push');
});

test('B3: "Planks" (Plural) wird jetzt korrekt als Core statt Compound eingestuft', () => {
  expect(MOVEMENT_MAP['Planks']).toBe('Core');
  expect(isCompoundExercise('Planks', {})).toBe(false);
});

test('B4: resolveCategory()/isCompoundExercise() stürzen nicht mehr ab, wenn categoryMap null/undefined ist', () => {
  expect(() => resolveCategory('Kniebeuge', null)).not.toThrow();
  expect(() => resolveCategory('Kniebeuge', undefined)).not.toThrow();
  expect(resolveCategory('Kniebeuge', null)).toBe('Squat');
  expect(resolveCategory('Unbekannte Übung XYZ', null)).toBe('Sonstige');
  expect(() => isCompoundExercise('Kniebeuge', null)).not.toThrow();
});

test('B5: "Sit Up" (Singular, Leerzeichen) wird jetzt korrekt als Core erkannt', () => {
  expect(MOVEMENT_MAP['Sit Up']).toBe('Core');
});

test('V1 (teilweise): Burpees/Box Jumps/Broad Jumps/Battle Ropes gelten jetzt als hantelfrei', () => {
  expect(defaultShowPlates('Burpees')).toBe(false);
  expect(defaultShowPlates('Box Jumps')).toBe(false);
  expect(defaultShowPlates('Broad Jumps')).toBe(false);
  expect(defaultShowPlates('Battle Ropes')).toBe(false);
});
