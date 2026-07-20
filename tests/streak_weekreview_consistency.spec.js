import { test, expect } from '@playwright/test';

// B74: weekReview.js hatte eine zweite, unabhängige Streak-Implementierung
// (_calcStreak(), nur `days.some(d => d.markedDone)`) neben der bereits
// korrekten, B69-gefixten calcCurrentStreak() (state.js) — ohne den
// 70%-'completed'-Schwellenwert und ohne Kalenderlücken-Prüfung. Speiste
// sowohl das Wochenrückblick-Modal als auch das davon abgeleitete
// Share-Bild (buildWeekShareCanvas({streak})) mit teils falschen Zahlen:
// zählte Teilabschlüsse unter der Schwelle voll mit, zählte durch mehr-
// wöchige Trainingspausen einfach durch. Fix: _calcStreak() delegiert
// jetzt vollständig an calcCurrentStreak() (identisches Muster wie der
// bereits bestehende isTrainingDay()-Import aus state.js).

function mondayOffset(weeksFromNow) {
  const d = new Date();
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday + weeksFromNow * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function day(id, markedDone, evaluated) {
  return {
    id, title: 'Tag', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: 7, energyLevel: 4, sessionRating: 2,
    exercises: [{
      name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
      sets: [{ weight: 80, reps: 5, rpe: 7, status: evaluated ? 'success' : 'pending', done: evaluated, note: '' }],
      prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
      progressionType: 'weight', archived: false,
    }],
  };
}
function partialWeek(id, startDate, doneCount) {
  const days = [];
  for (let i = 0; i < 4; i++) days.push(day(id * 10 + i, i < doneCount, i < doneCount));
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}
function fullWeek(id, startDate) { return partialWeek(id, startDate, 4); }

test('Streak bei Teil-Abschluss: Wochenrückblick stimmt mit Training-Tab-Badge überein', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-2)), fullWeek(2, mondayOffset(-1)), partialWeek(3, mondayOffset(0), 1)];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 2,
      weeks: weeksArg, customTemplate: [], settings: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, favoriteExercises: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const result = await page.evaluate(async () => {
    const stateMod = await import('./state.js');
    const weekReviewMod = await import('./weekReview.js');
    const st = stateMod.getState();
    const badgeStreak = stateMod.calcCurrentStreak(st.weeks);
    const lastWk = st.weeks[st.weeks.length - 1];
    const review = weekReviewMod.buildWeekReview(lastWk, st.weeks, st.favoriteExercises ?? []);
    return { badgeStreak, reviewStreak: review.summary.streak };
  });
  expect(result.reviewStreak).toBe(result.badgeStreak);
  expect(result.badgeStreak).toBe(2);
});

test('Streak bei Kalenderlücke: Wochenrückblick stimmt mit Training-Tab-Badge überein (bricht bei >7 Tagen Pause)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-6)), fullWeek(2, mondayOffset(-5)), fullWeek(3, mondayOffset(-1)), fullWeek(4, mondayOffset(0))];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 3,
      weeks: weeksArg, customTemplate: [], settings: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, favoriteExercises: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const result = await page.evaluate(async () => {
    const stateMod = await import('./state.js');
    const weekReviewMod = await import('./weekReview.js');
    const st = stateMod.getState();
    const badgeStreak = stateMod.calcCurrentStreak(st.weeks);
    const lastWk = st.weeks[st.weeks.length - 1];
    const review = weekReviewMod.buildWeekReview(lastWk, st.weeks, st.favoriteExercises ?? []);
    return { badgeStreak, reviewStreak: review.summary.streak };
  });
  expect(result.reviewStreak).toBe(result.badgeStreak);
  expect(result.badgeStreak).toBe(2);
});
