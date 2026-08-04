import { test, expect } from '@playwright/test';
import { computeStructuralSignals } from '../weeklyFocus.js';

// Launch-Roadmap Phase B, Kategorie 2, Szenario 9: Datenlage, die mehrere
// Struktursignale gleichzeitig auslöst -- korrekte Deckelung auf max. 2
// gleichzeitig sichtbare Karten (computeStructuralSignals() endet mit
// `signals.slice(0, 2)`) UND korrekte Priorität (die am höchsten
// priorisierten der ausgelösten Signale gewinnen, siehe DECISIONS.md
// "Strukturkarte max. 2 Signale": multi_exercise_failure > injury_reminder >
// deload_preventive > recurring_fatigue > consistency_quality > push_pull >
// compound_isolation). Bisherige Tests (z.B. coach_deload_dismissal.spec.js)
// kombinieren maximal 2 Signale gleichzeitig -- dieser Test bringt bewusst
// eine dritte, unabhängige Bedingung (Push/Pull-Ungleichgewicht) zusätzlich
// zu recurring_fatigue zum gleichzeitigen Auslösen.

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}
function mkSet(weight, reps, status, rpe = null) {
  return { weight, reps, rpe, status, done: status === 'success', note: '', prBadge: null };
}
function mkEx({ name, sets, weightStep = 5, targetReps = 5 }) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets, prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}
function mkDay({ id, exercises }) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now() - 3600_000, sessionEndTs: Date.now(),
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}
function mkWeek({ id, startDate, days }) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

// Push-lastiges Erschöpfungsmuster: Bankdrücken/OHP/Dips (alle Push),
// eskalierendes RPE -> recurring_fatigue. Identisches Muster wie
// tests/recurring_fatigue_signal.spec.js (verifiziert funktionierend).
function fatigueDay(id) {
  return mkDay({
    id,
    exercises: [
      mkEx({ name: 'Bankdrücken', sets: [mkSet(80, 8, 'success', 7.0), mkSet(80, 8, 'success', 7.0)] }),
      mkEx({ name: 'OHP', sets: [mkSet(40, 8, 'success', 8.0), mkSet(40, 6, 'fail', 8.0)] }),
      mkEx({ name: 'Dips', sets: [mkSet(0, 5, 'fail', 9.5)] }),
    ],
  });
}
// Push-lastige Woche mit minimalem Pull-Gegenstück -> baut über den
// erkenntnisseHorizont (Default 8 Wochen) das Push/Pull-Ungleichgewicht auf
// (pushSets/pullSets müssen beide > 0 sein, sonst greift der "keine Daten
// für eine Seite"-Guard in _checkPushPullBalance() und liefert null statt
// eines Extremwerts).
function fillerPushDay(id) {
  return mkDay({
    id,
    exercises: [
      mkEx({ name: 'Bankdrücken', sets: [mkSet(80, 8, 'success', 7.0), mkSet(80, 8, 'success', 7.0), mkSet(80, 8, 'success', 7.0)] }),
      mkEx({ name: 'Rudern', sets: [mkSet(40, 8, 'success', 6.0)] }),
    ],
  });
}

function baseState(weeks) {
  return {
    weeks, curIdx: weeks.length - 1,
    customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true }, favoriteExercises: [],
    customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
    coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
    badges: [], onboardingDone: true, longestStreakEver: 0,
  };
}

test('mehrere gleichzeitig ausgeloeste Struktursignale werden auf max. 2 gedeckelt, hoechste Prioritaet zuerst', () => {
  const weeks = [];
  for (let i = 0; i < 5; i++) weeks.push(mkWeek({ id: i + 1, startDate: weeksAgoISO(7 - i), days: [fillerPushDay(100 + i)] }));
  for (let i = 0; i < 3; i++) weeks.push(mkWeek({ id: 6 + i, startDate: weeksAgoISO(2 - i), days: [fatigueDay(200 + i)] }));

  const signals = computeStructuralSignals(baseState(weeks));

  // Mindestens 2 unabhängige Bedingungen wirklich gleichzeitig ausgelöst --
  // sonst testet dieser Fall keine echte Kollision.
  const types = signals.map(s => s.type);
  expect(types).toContain('recurring_fatigue');
  expect(types).toContain('push_pull');

  // Deckelung: nie mehr als 2 gleichzeitig, wie in DECISIONS.md festgelegt.
  expect(signals.length).toBeLessThanOrEqual(2);

  // Priorität: recurring_fatigue steht laut Kaskade vor push_pull -- muss
  // an erster Stelle im Array stehen (Reihenfolge bestimmt, was im UI
  // zuerst/prominent gerendert wird).
  expect(signals[0].type).toBe('recurring_fatigue');
});
