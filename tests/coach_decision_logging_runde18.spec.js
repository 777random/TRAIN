import { test, expect } from '@playwright/test';

// Runde 18 (Cluster 1): Decision Logging feuerte praktisch nie, weil
// _buildCoachQuestionCard() den Fall status==='progression' &&
// confidence==='high' (der Normalfall bei konstant guter Progression) nicht
// abdeckte -- nur 'medium'. Fix erweitert die Bedingung auf beide
// Konfidenzstufen. Zusätzlich: die decisionLog-Track-Record-Aussage
// ("Weitertrainieren hat bei dir X-mal funktioniert") war bisher nur im
// eingeklappten "▾ Basis dieser Einschätzung"-Collapse sichtbar -- jetzt
// direkt und immer sichtbar (.coach-decision-track-record).

function todayISO() { return new Date().toISOString().split('T')[0]; }
function isoWeeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSuccessSet(weight, reps = 8, rpe = 7.0) {
  return { weight, reps, rpe, status: 'success', done: true, note: '' };
}

function mkExercise(name, weight, { weightStep = 2.5, targetReps = 8, n = 3, rpe = 7.0 } = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: Array.from({ length: n }, () => mkSuccessSet(weight, targetReps, rpe)),
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    targetSets: n, targetReps, progressionType: 'weight', progressionMode: 'weight_first',
    targetRepsMax: null, archived: false, skipReason: null, skipDate: null,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: 7, energyLevel: 4, sessionRating: null,
    sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, startDate, days) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

// 4 Wochen, konstant steigendes Gewicht, RPE 7.0 (<= CONF_HIGH_AVG_RPE_MAX_4WK
// von 7.5), alle Sätze voller Erfolg -> confSuccessRate 1.0, avgRpe 7.0 ->
// confidence 'high' (siehe weeklyFocus.js CONF_HIGH_SUCCESS_RATE_MIN/
// CONF_HIGH_AVG_RPE_MAX_4WK).
function buildHighConfidenceProgressionWeeks(exerciseName = 'Kniebeuge') {
  return [
    mkWeek(1, isoWeeksAgo(3), [mkDay('A', [mkExercise(exerciseName, 70)])]),
    mkWeek(2, isoWeeksAgo(2), [mkDay('A', [mkExercise(exerciseName, 72.5)])]),
    mkWeek(3, isoWeeksAgo(1), [mkDay('A', [mkExercise(exerciseName, 75)])]),
    mkWeek(4, isoWeeksAgo(0), [mkDay('A', [mkExercise(exerciseName, 77.5)])]),
  ];
}

async function seed(page, weeks, { decisionLog = [], curIdx = null } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, decisionLog, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: curIdx ?? weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog, badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, { weeksArg: weeks, decisionLog, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
}

test('Progression mit HIGH-Konfidenz erzeugt jetzt eine coachQuestion (vorher nur MEDIUM)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page, buildHighConfidenceProgressionWeeks());

  await expect(page.locator('.coach-confidence--high')).toBeVisible();
  const questionCard = page.locator('.coach-question-card');
  await expect(questionCard).toBeVisible();
  await expect(questionCard.locator('.coach-question__text')).toContainText('angefühlt');
  await expect(questionCard.locator('.coach-question__btn')).toHaveCount(3);

  await questionCard.locator('.coach-question__btn', { hasText: 'Gut' }).click();
  await page.waitForTimeout(150);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.coachQuestion.questionId).toBe('progression_feeling');
  expect(st.coachQuestion.answer).toBe('good');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('decisionLog-Track-Record ist jetzt außerhalb des Collapse direkt sichtbar (nicht mehr im ▾-Aufklapp-Feld versteckt)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // 3 abgeschlossene decisionLog-Einträge desselben Typs ('progression'),
  // alle "stay" + Signal danach verschwunden + Erfolgsquote nicht gesunken
  // -> _decisionHistoryConclusion() liefert "Weitertrainieren hat bei dir
  // 3-mal funktioniert — das Signal verschwand danach." (stayWorked=3 > N/2).
  const decisionLog = [1, 2, 3].map(i => ({
    id: `d${i}`, type: 'progression', choice: 'stay', decidedWeekStart: isoWeeksAgo(4 + i),
    outcome: { measuredWeekStart: isoWeeksAgo(2 + i), signalPersisted: false, successRateBefore: 80, successRateAfter: 92 },
  }));

  await seed(page, buildHighConfidenceProgressionWeeks(), { decisionLog });

  const trackRecord = page.locator('.coach-decision-track-record');
  await expect(trackRecord).toBeVisible(); // sichtbar OHNE das Collapse zu öffnen
  await expect(trackRecord).toContainText('Weitertrainieren hat bei dir 3-mal funktioniert');
  // vormalige gedämpfte Fließtext-Variante im Collapse ist entfernt, nicht dupliziert
  await expect(page.locator('.coach-decision-history')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
