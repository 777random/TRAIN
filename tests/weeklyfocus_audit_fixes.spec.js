import { test, expect } from '@playwright/test';

// Nutzer-Feedback (2026-08-17): Coach-Tab-Berechnungs-Audit (5 parallele
// Diagnose-Agenten) fand 7 weitere bestätigte Bugs + 7 Verdachtsfälle
// zusätzlich zum bereits gefixten B267. Dieser Test deckt die wichtigsten
// neuen Fixes ab, die noch nicht durch bestehende Tests abgesichert sind.

function isoWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkExRate(name, success, total, weight = 60, opts = {}) {
  const sets = [];
  for (let i = 0; i < total; i++) sets.push({ weight, reps: 8, rpe: 7, status: i < success ? 'success' : 'fail', done: true, note: '' });
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: total, targetReps: 8,
    progressionType: 'reps', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    ...opts,
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
      customExercises: [], decisionLog: [], coachQuestion: null,
    };
    const focus = mod.computeWeeklyFocus(state);
    return { status: focus.status, reasoning: focus.reasoning, recommendation: focus.recommendation };
  }, weeks);
}

test('_completionRate(): pending-Sätze der laufenden Woche zählen nicht mehr im Nenner mit', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // 8 Wochen konstant 85% Erfolgsquote (17/20), letzte 3 davon inkl. der
  // aktuell laufenden Woche, die erst zur Hälfte trainiert ist (10 weitere
  // Sätze noch 'pending'). Vor dem Fix zählten diese pending-Sätze im
  // Nenner mit und drückten avg3 künstlich unter die 10pp-Schwelle.
  const weeks = [];
  for (let n = 1; n <= 5; n++) {
    weeks.push(mkWeek(n, isoWeeksAgo(9 - n), [mkDay(10 + n, [mkExRate('Kniebeuge', 17, 20)])]));
  }
  for (let n = 6; n <= 7; n++) {
    weeks.push(mkWeek(n, isoWeeksAgo(9 - n), [mkDay(10 + n, [mkExRate('Kniebeuge', 17, 20)])]));
  }
  // Aktuell laufende Woche: 17/20 bewertete Sätze wie immer (85%), PLUS 10
  // weitere noch 'pending' Sätze (z.B. spätere Übungen des Tages).
  const pendingSets = Array.from({ length: 10 }, () => ({ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }));
  const curEx = mkExRate('Kniebeuge', 17, 20);
  curEx.sets.push(...pendingSets);
  weeks.push(mkWeek(8, isoWeeksAgo(9 - 8), [mkDay(18, [curEx])]));

  const result = await computeSignal(page, weeks);
  expect(result.status).not.toBe('overload');
  expect(result.reasoning ?? '').not.toContain('Erfolgsquote');
});

test('plateauDetector: Seed-Woche + 2 echte Wochen lösen KEIN falsches Plateau-Signal für Neueinsteiger aus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Seed-Woche (Startgewicht 60kg) + 2 echte Trainingswochen bei
  // unverändertem Gewicht (60kg), hoher Erfolgsquote -- vor dem Fix zählte
  // die Seed-Woche als "3. stagnierende Woche" mit.
  const seedWeek = mkWeek(0, isoWeeksAgo(3), [mkDay(1, [mkExRate('Bankdrücken', 1, 1, 60)])], true);
  const realWeeks = [1, 2].map(n =>
    mkWeek(n, isoWeeksAgo(2 - n + 1), [mkDay(10 + n, [mkExRate('Bankdrücken', 9, 10, 60)])])
  );

  const result = await computeSignal(page, [seedWeek, ...realWeeks]);
  expect(result.status).not.toBe('plateau');
});

test('_checkPersistentFailure: archivierte Übung löst keine "Gewicht reduzieren"-Meldung mehr aus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // 0% Erfolg über 3 Wochen bei EINER archivierten Übung -- vor dem Fix
  // hätte das trotzdem "Gewicht zu hoch" ausgelöst, obwohl der Nutzer die
  // Übung längst archiviert (nicht mehr trainiert) hat.
  const weeks = [1, 2, 3].map(n =>
    mkWeek(n, isoWeeksAgo(4 - n), [mkDay(10 + n, [mkExRate('Kniebeuge', 0, 3, 100, { archived: true })])])
  );

  const result = await computeSignal(page, weeks);
  expect(result.status).not.toBe('persistent_failure');
});

test('_checkDecisionOutcomes (ui.js): Seed-Woche fließt nicht mehr in successRateBefore/After ein', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const decidedWeekStart = isoWeeksAgo(4);
  const seedWeek = mkWeek(0, isoWeeksAgo(20), [mkDay(1, [mkExRate('Kniebeuge', 1, 1)])], true);
  // Nur die Seed-Woche liegt VOR der Entscheidung -- ohne Fix würde
  // beforeWeeks (slice(-2)) sie mit ihrer künstlichen 100%-Quote enthalten.
  const afterWeeks = [1, 2].map(n =>
    mkWeek(n, isoWeeksAgo(4 - n), [mkDay(10 + n, [mkExRate('Kniebeuge', 5, 10)])])
  );

  const outcome = await page.evaluate(async ({ weeksArg, decidedWeekStartArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: {},
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, badges: [], longestStreakEver: 0, seenTips: [],
      decisionLog: [{ id: 'dtest1', type: 'overload', signal: 'sleep', choice: 'stay', decidedWeekStart: decidedWeekStartArg, outcome: null }],
    }));
    return null;
  }, { weeksArg: [seedWeek, ...afterWeeks], decidedWeekStartArg: decidedWeekStart });

  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(500);

  const logged = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem('train_v6'));
    return raw.decisionLog.find(e => e.id === 'dtest1');
  });

  expect(logged.outcome).not.toBeNull();
  // Ohne Seed-Woche in beforeWeeks bleibt successRateBefore bei 0 (keine
  // echte Vorwoche vorhanden) statt künstlich durch die Seed-Woche auf 100
  // angehoben zu werden.
  expect(logged.outcome.successRateBefore).toBe(0);
});

test('coachQuestion (pre_plateau): Antwort wird der richtigen Übung zugeordnet, nicht global übernommen', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Zwei Übungen, beide qualifizieren unabhängig für Pre-Plateau (steigendes
  // Gewicht, steigende RPE-Kosten/kg). "Kniebeuge" hat eine gespeicherte
  // Antwort, "Bankdrücken" nicht -- da _checkPrePlateau() beim ERSTEN
  // Treffer zurückkehrt und die Iterationsreihenfolge nicht garantiert
  // "Kniebeuge zuerst" ist, darf die Kniebeuge-Antwort NIE für Bankdrücken
  // übernommen werden, wenn Bankdrücken zuerst gefunden wird.
  const mkPrePlateauEx = (name, weights, rpes) => {
    const sets = weights.map((w, i) => ({ weight: w, reps: 8, rpe: rpes[i], status: 'success', done: true, note: '' }));
    return {
      name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
      prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
      progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    };
  };
  const weeks = [
    mkWeek(1, isoWeeksAgo(2), [mkDay(11, [mkPrePlateauEx('Kniebeuge', [60], [6]), mkPrePlateauEx('Bankdrücken', [40], [6])])]),
    mkWeek(2, isoWeeksAgo(1), [mkDay(12, [mkPrePlateauEx('Kniebeuge', [65], [7.5]), mkPrePlateauEx('Bankdrücken', [45], [7.5])])]),
    mkWeek(3, isoWeeksAgo(0), [mkDay(13, [mkPrePlateauEx('Kniebeuge', [70], [9]), mkPrePlateauEx('Bankdrücken', [50], [9])])]),
  ];
  const latestWeekStart = weeks[2].startDate;

  const result = await page.evaluate(async ({ weeksArg, weekStartArg }) => {
    const mod = await import('./weeklyFocus.js');
    // coachQuestion beantwortet für Kniebeuge -- Bankdrücken hat KEINE Antwort.
    const state = {
      weeks: weeksArg, curIdx: weeksArg.length - 1, settings: {}, favoriteExercises: [],
      customExercises: [], decisionLog: [],
      coachQuestion: { weekStart: weekStartArg, questionId: 'pre_plateau_subjective', answer: 'yes', exerciseName: 'Kniebeuge', outcome: null, measuredWeekStart: null },
    };
    const focus = mod.computeWeeklyFocus(state);
    return { exerciseName: focus.exerciseName, reasoning: focus.reasoning };
  }, { weeksArg: weeks, weekStartArg: latestWeekStart });

  // Falls Bankdrücken das zuerst gefundene Signal ist: die "bestätigt"-
  // Zusatzformulierung darf NICHT erscheinen, wenn exerciseName !== 'Kniebeuge'.
  if (result.exerciseName !== 'Kniebeuge') {
    expect(result.reasoning ?? '').not.toContain('Du bestätigst');
  } else {
    expect(result.reasoning ?? '').toContain('Du bestätigst');
  }
});
