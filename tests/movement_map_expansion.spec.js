import { test, expect } from '@playwright/test';
import { resolveCategory, isCompoundExercise } from '../movementMap.js';

// B111: movementMap.js erweitert um häufig verwendete Variationen +
// deutsche/englische Synonyme. Reiner Unit-Test (kein Browser nötig) -
// prüft direkt gegen die exportierten Funktionen.

test('Neue Compound-Variationen werden korrekt kategorisiert', () => {
  expect(resolveCategory('Pendlay Row', {})).toBe('Pull');
  expect(resolveCategory('SSB Squat', {})).toBe('Squat');
  expect(resolveCategory('RDL', {})).toBe('Hinge');
  expect(resolveCategory('Sumo Deadlift', {})).toBe('Hinge');
  expect(resolveCategory('Close Grip Bench Press', {})).toBe('Push');
});

test('Neue Isolationsübungen werden korrekt als Isolation erkannt', () => {
  expect(isCompoundExercise('Preacher Curl', {})).toBe(false);
  expect(isCompoundExercise('Skull Crusher', {})).toBe(false);
});

test('Hip Thrust bleibt Hinge + Compound', () => {
  expect(resolveCategory('Hip Thrust', {})).toBe('Hinge');
  expect(isCompoundExercise('Hip Thrust', {})).toBe(true);
});

test('Face Pull ist Pull + Compound (Korrektur: vorher fälschlich Isolation)', () => {
  expect(resolveCategory('Face Pull', {})).toBe('Pull');
  expect(isCompoundExercise('Face Pull', {})).toBe(true);
  // 'Face Pulls' (Plural, bestehender Schlüssel) muss dieselbe Korrektur haben
  expect(isCompoundExercise('Face Pulls', {})).toBe(true);
});

test('Leg Curl/Beinbeuger: Bewegungsmuster Hinge, aber Isolation ueber ISOLATION_EXERCISE_NAMES (bewusst, siehe DECISIONS.md)', () => {
  expect(resolveCategory('Leg Curl', {})).toBe('Hinge');
  expect(isCompoundExercise('Leg Curl', {})).toBe(false);
  expect(resolveCategory('Beinbeuger', {})).toBe('Hinge');
  expect(isCompoundExercise('Beinbeuger', {})).toBe(false);
});

test('Keine Duplikate in MOVEMENT_MAP (Key-Anzahl entspricht 139 vor B111 + 79 neue Eintraege)', async () => {
  const mod = await import('../movementMap.js');
  // Ein doppelt vergebener Objekt-Key würde von JS beim Parsen still
  // überschrieben statt zu einem sichtbaren Fehler zu führen -- eine reine
  // Object.keys()-Prüfung auf dem bereits geparsten Objekt kann das daher
  // NICHT erkennen. Stattdessen: die erwartete Gesamtzahl bestätigt indirekt,
  // dass keine der 79 neuen Zeilen versehentlich einen bereits vorhandenen
  // Namen (oder einen der anderen neuen Namen) erneut vergeben hat -- sonst
  // wäre die Gesamtzahl kleiner als 218.
  expect(Object.keys(mod.MOVEMENT_MAP).length).toBe(218);
});
