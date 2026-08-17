import { test, expect } from '@playwright/test';

// Nutzer-Feedback (2026-08-17): Wochenrückblick soll bis zu 3 Highlights
// ("was gut lief") und 3 Lowlights ("was nicht so gut lief") zeigen (vorher
// je max. 2), mit Favoriten-Priorität: bei der Auswahl wird zuerst NUR unter
// den Favoriten-Übungen gesucht, erst wenn dort nichts zu finden ist, wird
// auf alle Übungen ausgewichen (siehe weekReview.js _withFavoritesFirst()).

function mkSuccessEx(name, weight, count = 1) {
  const sets = [];
  for (let i = 0; i < count; i++) sets.push({ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '' });
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: count, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkFailEx(name, weight, failCount) {
  const sets = [];
  for (let i = 0; i < failCount; i++) sets.push({ weight, reps: 3, rpe: 8, status: 'fail', done: true, note: '' });
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: failCount, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkHighRpeEx(name, weight) {
  const sets = [{ weight, reps: 5, rpe: 9.5, status: 'success', done: true, note: '' }];
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5, sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, markedDone = true) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises,
  };
}

function mkWeek(id, startDate, exercises) {
  return { id, startDate, note: '', mode: 'standard', days: [mkDay(id * 10, exercises)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

async function review(page, week, allWeeks, favoriteExercises) {
  return page.evaluate(async ({ weekArg, allWeeksArg, favArg }) => {
    const mod = await import('./weekReview.js');
    const r = mod.buildWeekReview(weekArg, allWeeksArg, favArg);
    return {
      highlights: r.highlights.map(h => ({ type: h.type, exName: h.exName })),
      lowlights: r.lowlights.map(l => ({ type: l.type, exName: l.exName })),
    };
  }, { weekArg: week, allWeeksArg: allWeeks, favArg: favoriteExercises });
}

test('Favorit mit kleinerem PR wird vor Nicht-Favorit mit größerem PR gewählt', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const prevWeek = mkWeek(1, '2026-06-01', [mkSuccessEx('Kniebeuge', 60), mkSuccessEx('Bankdrücken', 40)]);
  // Kniebeuge (Favorit): +5kg PR. Bankdrücken (kein Favorit): +20kg PR (objektiv größer).
  const curWeek  = mkWeek(2, '2026-06-08', [mkSuccessEx('Kniebeuge', 65), mkSuccessEx('Bankdrücken', 60)]);

  const withFav = await review(page, curWeek, [prevWeek, curWeek], ['Kniebeuge']);
  expect(withFav.highlights[0]).toEqual({ type: 'pr', exName: 'Kniebeuge' });

  const withoutFav = await review(page, curWeek, [prevWeek, curWeek], []);
  expect(withoutFav.highlights[0]).toEqual({ type: 'pr', exName: 'Bankdrücken' });
});

test('Favorit ohne jedes Ergebnis weicht auf alle Übungen aus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const prevWeek = mkWeek(1, '2026-06-01', [mkSuccessEx('Bankdrücken', 40)]);
  const curWeek  = mkWeek(2, '2026-06-08', [mkSuccessEx('Bankdrücken', 60)]);

  // "Rudern" ist als Favorit gesetzt, kommt aber in keiner Woche vor -- die
  // Favoriten-Suche findet nichts, muss auf alle Übungen ausweichen.
  const result = await review(page, curWeek, [prevWeek, curWeek], ['Rudern']);
  expect(result.highlights[0]).toEqual({ type: 'pr', exName: 'Bankdrücken' });
});

test('Bis zu 3 Highlights (PR + Steigerung + saubere Ausführung) und 3 Lowlights (Fails + verpasste Tage + Belastung)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const prevWeek = mkWeek(1, '2026-06-01', [
    mkSuccessEx('Kniebeuge', 60), mkSuccessEx('Latziehen', 40),
  ]);
  const curWeek = mkWeek(2, '2026-06-08', [
    mkSuccessEx('Kniebeuge', 65),              // PR
    mkSuccessEx('Latziehen', 50),               // Steigerung ggü. Vorwoche
    mkSuccessEx('Rudern', 30, 3),                // saubere Ausführung (3/3 erfolgreich)
    mkFailEx('Bankdrücken', 80, 3),              // fehlgeschlagene Sätze
    mkHighRpeEx('Schulterdrücken', 40),          // hohe Belastung
  ]);
  // Ein Tag der Woche bleibt bewusst offen/nicht abgeschlossen für "verpasste Tage" --
  // einfacher: zweiter Tag mit markedDone:false, in der Vergangenheit liegend.
  curWeek.days.push({
    id: 999, title: 'Tag B', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [mkSuccessEx('Kreuzheben', 100)],
  });

  const result = await review(page, curWeek, [prevWeek, curWeek], []);

  expect(result.highlights.length).toBeLessThanOrEqual(3);
  expect(result.highlights.map(h => h.type)).toContain('pr');
  expect(result.highlights.some(h => h.type === 'gain' || h.type === 'perfect')).toBe(true);

  expect(result.lowlights.length).toBeLessThanOrEqual(3);
  expect(result.lowlights.map(l => l.type)).toContain('fails');
});
