import { test, expect } from '@playwright/test';

// Nutzer-Feedback (2026-08-17): Coach-Tab behauptete "Erfolgsquote gesunken",
// obwohl die reale Erfolgsquote nur leicht (< 10 Prozentpunkte) gesunken war.
// Root Cause: weeklyFocus.js' eigene, unabhängige _sortedWeeks()/
// _nonDeloadWeeks()-Kopie schloss die synthetische Startwerte-Woche
// (ONBOARDING_SEED, isSeedWeek) nicht aus -- deren IMMER 100%-Erfolgsquote
// (per Konstruktion) verzerrte den Trendvergleich in _checkDroppingCompletion()
// als künstlich hohe Baseline. Analog zur bereits gefixten state.js-Kopie
// (B246, Runde 22) -- weeklyFocus.js hatte denselben Bug unabhängig.

function isoWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

// Eine Übung mit `total` Sätzen, `success` davon erfolgreich (Rest fail) --
// simple, exakt kontrollierbare Erfolgsquote pro Woche.
function mkExRate(name, success, total, weight = 60) {
  const sets = [];
  for (let i = 0; i < total; i++) {
    sets.push({ weight, reps: 8, rpe: 7, status: i < success ? 'success' : 'fail', done: true, note: '' });
  }
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: total, targetReps: 8,
    progressionType: 'reps', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [],
  };
}

function mkWeek(id, startDate, days, isSeedWeek = false) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek };
}

async function computeSignal(page, weeks) {
  return page.evaluate(async (weeksArg) => {
    const mod = await import('./weeklyFocus.js');
    const state = {
      weeks: weeksArg, curIdx: weeksArg.length - 1, settings: {}, favoriteExercises: [],
      customExercises: [], decisionLog: [],
    };
    const focus = mod.computeWeeklyFocus(state);
    return { status: focus.status, reasoning: focus.reasoning };
  }, weeks);
}

test('Seed-Woche (100% künstliche Erfolgsquote) täuscht keinen Erfolgsquote-Rückgang mehr vor', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const seedWeek = mkWeek(0, isoWeeksAgo(10), [mkDay(1, [mkExRate('Kniebeuge', 1, 1)])], true);
  // "prev"-Fenster (Wochen -8..-3): 75% Erfolgsquote. Alle 6 Wochen (prev +
  // last3) bewusst lückenlos aufeinanderfolgend (isoWeeksAgo(9-n) für
  // n=1..6 -> 8,7,6,5,4,3 Wochen her) -- eine Kalenderlücke zwischen den
  // Fenstern würde sonst durch die (separat getestete) Kontinuitätsprüfung
  // in _checkDroppingCompletion() abgefangen und hier fälschlich als
  // "Seed-Woche korrekt ausgeschlossen" statt als "Lücke erkannt" durchgehen.
  const prevWeeks = [1, 2, 3].map(n =>
    mkWeek(n, isoWeeksAgo(9 - n), [mkDay(10 + n, [mkExRate('Kniebeuge', 15, 20)])])
  );
  // "last3"-Fenster (aktuellste 3 Wochen): 70% -- nur 5 Prozentpunkte Rückgang,
  // UNTER der 10-Prozentpunkte-Schwelle für ein echtes Signal.
  const last3Weeks = [4, 5, 6].map(n =>
    mkWeek(n, isoWeeksAgo(9 - n), [mkDay(20 + n, [mkExRate('Kniebeuge', 14, 20)])])
  );

  const weeks = [seedWeek, ...prevWeeks, ...last3Weeks];
  const result = await computeSignal(page, weeks);

  // Ohne den Fix würde die Seed-Woche mit ihrer 100%-Quote ins "prev"-Fenster
  // rutschen, die Baseline künstlich anheben und dadurch fälschlich einen
  // >10-Prozentpunkte-Rückgang vortäuschen (status: 'overload', reasoning
  // enthält "Erfolgsquote ... gesunken").
  expect(result.status).not.toBe('overload');
  expect(result.reasoning ?? '').not.toContain('Erfolgsquote');
});

test('Kontrolle: derselbe echte 15-Prozentpunkte-Rückgang OHNE Seed-Woche löst weiterhin das Signal aus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Gleiches Muster, aber ohne Seed-Woche und mit einem echten, deutlichen
  // Rückgang (85% -> 65%, 20 Prozentpunkte) -- Kontrolltest, dass das Signal
  // bei einem tatsächlichen Rückgang weiterhin sauber feuert. Alle 6 Wochen
  // bewusst lückenlos aufeinanderfolgend (siehe Kommentar im ersten Test oben).
  const prevWeeks = [1, 2, 3].map(n =>
    mkWeek(n, isoWeeksAgo(9 - n), [mkDay(10 + n, [mkExRate('Kniebeuge', 17, 20)])])
  );
  const last3Weeks = [4, 5, 6].map(n =>
    mkWeek(n, isoWeeksAgo(9 - n), [mkDay(20 + n, [mkExRate('Kniebeuge', 13, 20)])])
  );

  const weeks = [...prevWeeks, ...last3Weeks];
  const result = await computeSignal(page, weeks);

  expect(result.status).toBe('overload');
  expect(result.reasoning ?? '').toContain('Erfolgsquote');
});
