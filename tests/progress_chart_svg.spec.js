import { test, expect } from '@playwright/test';

// Gefunden als Nebenbefund während einer B66-Diagnose: die drei SVG-Charts
// in progressChart.js (Übungsfortschritt, Körpergewicht, Relative Stärke)
// setzten `height="auto"` als XML-ATTRIBUT statt als CSS-Eigenschaft — "auto"
// ist kein gültiger SVG-<length>-Wert für das height-Attribut, der Browser
// loggt dafür "Error: <svg> attribute height: Expected length, 'auto'." in
// die Konsole (keine Exception, kein sichtbarer Fehler, aber technisch
// ungültiges Markup). Fix: height:auto lebt jetzt im ohnehin vorhandenen
// style-Attribut (dort ist "auto" ein gültiger CSS-Wert), width bleibt
// unverändert als Attribut (Prozent-Angaben sind für SVG-width gültig).

function monday(weeksAgo) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - weeksAgo * 7);
  return d.toISOString().split('T')[0];
}

function mkWeek(id, weeksAgo) {
  return {
    id, startDate: monday(weeksAgo), note: '', mode: 'standard',
    days: [{
      id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: 'good', energyLevel: null, sessionRating: 3,
      sessionStartTs: null, sessionEndTs: null,
      sessionCheckIn: { sleep: 'good', energyPre: 'medium', timestamp: Date.now() },
      sessionModifier: 'normal',
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 80, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
        prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
      }],
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('Übungsfortschritt-SVG: kein ungültiges height-Attribut, height:auto lebt in style', async ({ page }) => {
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [];
  for (let i = 10; i >= 0; i--) weeks.push(mkWeek(i, i));
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.waitForTimeout(2500);
  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(500);

  const svg = page.locator('svg[aria-label^="Gewichtsprogression"]').first();
  await expect(svg).toBeVisible();
  expect(await svg.getAttribute('height')).toBeNull();
  expect(await svg.evaluate(el => el.style.height)).toBe('auto');

  const heightAutoErrors = consoleErrors.filter(e => e.includes('height') && e.includes('auto'));
  expect(heightAutoErrors, heightAutoErrors.join('; ')).toHaveLength(0);
});
