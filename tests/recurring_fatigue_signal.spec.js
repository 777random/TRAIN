import { test, expect } from '@playwright/test';
import { computeStructuralSignals } from '../weeklyFocus.js';

// B140 (Runde 13, Council-Entscheidung): neues Coach-Strukturkarten-Signal
// "recurring_fatigue" -- feuert nur, wenn das bereits bestehende tages-
// skalierte Erschöpfungsmuster (detectSessionFatigue(), sessionSummary.js)
// in JEDER der letzten 3 konsekutiven Nicht-Deload/Nicht-Urlaub-Wochen an
// mindestens einem Tag auftritt. Reiner No-DOM-Unit-Test (computeStructural-
// Signals() ist pure JS, kein Browser nötig — Muster wie
// tests/metric_recommendation_nutrition_phase.spec.js).

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
    sets,
    prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay({ id = 11, exercises }) {
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

// Identisches Muster wie tests/session_fatigue.spec.js: Bankdrücken RPE 7.0,
// OHP RPE 8.0, Dips RPE 9.5 -> RPE-Anstieg >=1.5 UND Erfolgsquote sinkt.
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

// Stabiles RPE, kein Erschöpfungsmuster (Kontrollfixture wie
// tests/session_fatigue.spec.js "Kein Block wenn RPE stabil bleibt").
function stableDay(id) {
  return mkDay({
    id,
    exercises: [
      mkEx({ name: 'Bankdrücken', sets: [mkSet(80, 8, 'success', 7.0)] }),
      mkEx({ name: 'OHP', sets: [mkSet(40, 8, 'success', 7.2)] }),
      mkEx({ name: 'Dips', sets: [mkSet(0, 8, 'success', 7.1)] }),
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

test('recurring_fatigue feuert, wenn alle 3 letzten Wochen je einen Erschoepfungstag haben', () => {
  const weeks = [
    mkWeek({ id: 1, startDate: weeksAgoISO(2), days: [fatigueDay(11)] }),
    mkWeek({ id: 2, startDate: weeksAgoISO(1), days: [fatigueDay(12)] }),
    mkWeek({ id: 3, startDate: weeksAgoISO(0), days: [fatigueDay(13)] }),
  ];
  const signals = computeStructuralSignals(baseState(weeks));
  const sig = signals.find(s => s.type === 'recurring_fatigue');
  expect(sig).toBeTruthy();
  expect(sig.mostFatiguedExercise).toBe('Dips');
});

test('recurring_fatigue feuert NICHT, wenn nur 1 von 3 Wochen betroffen ist', () => {
  const weeks = [
    mkWeek({ id: 1, startDate: weeksAgoISO(2), days: [stableDay(11)] }),
    mkWeek({ id: 2, startDate: weeksAgoISO(1), days: [fatigueDay(12)] }),
    mkWeek({ id: 3, startDate: weeksAgoISO(0), days: [stableDay(13)] }),
  ];
  const signals = computeStructuralSignals(baseState(weeks));
  expect(signals.find(s => s.type === 'recurring_fatigue')).toBeUndefined();
});

test('recurring_fatigue feuert NICHT bei weniger als 3 Nicht-Deload/Urlaub-Wochen', () => {
  const weeks = [
    mkWeek({ id: 1, startDate: weeksAgoISO(1), days: [fatigueDay(11)] }),
    mkWeek({ id: 2, startDate: weeksAgoISO(0), days: [fatigueDay(12)] }),
  ];
  const signals = computeStructuralSignals(baseState(weeks));
  expect(signals.find(s => s.type === 'recurring_fatigue')).toBeUndefined();
});
