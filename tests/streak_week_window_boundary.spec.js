import { test, expect } from '@playwright/test';

// B110: _calcCurrentStreak() behandelte das 7-Tage-Fenster der aktuellen,
// noch leeren Woche als bereits abgelaufen, sobald der Kalendertag (UTC)
// des 7. Tages begonnen hatte -- unabhängig von der Uhrzeit. Eine leere
// Woche, deren Fenster tatsächlich noch bis Ende des 7. Tages läuft, brach
// die Streak dadurch bis zu einen vollen Tag zu früh auf 0 ab. Fix: das
// Fenster-Ende wird jetzt korrekt als startDate + 7*24h (exklusiv)
// berechnet, nicht wiederverwendet aus _weekEndMs() (das für die separate
// Lücken-Erkennung in _streakGapBreaks() eine andere Bedeutung hat).

function completedDay(id) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false,
    markedDone: true, isVacation: false, sleepHours: null, energyLevel: null, sessionRating: null,
    exercises: [{
      name: 'Kniebeuge', archived: false, weightStep: 5, metric: 'reps',
      progressionMode: 'weight_first', targetRepsMax: null,
      nextWeekPlan: 0, nextWeekPlanConfirmed: false,
      sets: [{ weight: 80, reps: 5, status: 'success', done: true, rpe: null }],
    }],
  };
}

function emptyDay(id) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false,
    markedDone: false, isVacation: false, sleepHours: null, energyLevel: null, sessionRating: null,
    exercises: [{
      name: 'Kniebeuge', archived: false, weightStep: 5, metric: 'reps',
      progressionMode: 'weight_first', targetRepsMax: null,
      nextWeekPlan: 0, nextWeekPlanConfirmed: false,
      sets: [{ weight: 80, reps: 5, status: 'pending', done: false, rpe: null }],
    }],
  };
}

function isoDaysAgo(days) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().split('T')[0];
}

async function seedAndCheckStreak(page, currentWeekStartDaysAgo, expectedStreak) {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [
    { id: 1, startDate: isoDaysAgo(currentWeekStartDaysAgo + 14), note: '', mode: 'standard', days: [completedDay(11)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 2, startDate: isoDaysAgo(currentWeekStartDaysAgo + 7), note: '', mode: 'standard', days: [completedDay(21)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 3, startDate: isoDaysAgo(currentWeekStartDaysAgo), note: '', mode: 'standard', days: [emptyDay(31)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
  ];
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() }, curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: {}, prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await expect(page.locator('.streak-badge__num')).toHaveText(String(expectedStreak));
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
}

test('Aktuelle Woche startet HEUTE (Tag 0 des Fensters), noch leer: Fenster offen, Streak zaehlt weiter', async ({ page }) => {
  await seedAndCheckStreak(page, 0, 2);
});

test('Aktuelle Woche startet vor 6 Tagen (letzter Tag des 7-Tage-Fensters), noch leer: Fenster noch offen', async ({ page }) => {
  await seedAndCheckStreak(page, 6, 2);
});

test('Aktuelle Woche startet vor 8 Tagen (Fenster echt abgelaufen), noch leer: bricht die Streak auf 0', async ({ page }) => {
  await seedAndCheckStreak(page, 8, 0);
});
