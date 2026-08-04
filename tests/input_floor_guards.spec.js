import { test, expect } from '@playwright/test';

// Launch-Roadmap Phase B, Kategorie 3, Szenario 10: negative/0-Gewicht.
// B144 (Pre-Launch-Fix-Sprint) fügte SET_UPDATE einen Math.max(0,...)-Floor
// für 'weight' hinzu (reps/rpe hatten ihn bereits) -- verifiziert damals nur
// indirekt über plate_calculator.spec.js. Kein dedizierter Regressionstest
// sperrte den Reducer-Floor selbst fest, obwohl er zentral (nicht nur an
// einer UI-Eingabestelle) wirkt -- ein künftiger Reducer-Edit könnte ihn
// stillschweigend verlieren, ohne dass ein bestehender Test das bemerkt.

function todayISO() { return new Date().toISOString().split('T')[0]; }

async function seed(page) {
  const week = {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
      sessionCheckIn: null, sessionModifier: null,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
        sets: [{ weight: 80, reps: 5, rpe: null, status: 'pending', done: false, note: '' }],
        prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weekArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg],
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, seenTips: [],
    }));
  }, week);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('SET_UPDATE: negatives Gewicht wird auf 0 geklemmt (Reducer-Floor, B144)', async ({ page }) => {
  await seed(page);
  const weightInput = page.locator('[data-action="set-weight"]').first();
  await weightInput.fill('-20');
  await weightInput.blur();
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const weight = state.weeks[0].days[0].exercises[0].sets[0].weight;
  expect(weight).toBeGreaterThanOrEqual(0);
  expect(weight).not.toBeLessThan(0);
});

test('SET_UPDATE: Gewicht 0 wird akzeptiert (kein Absturz nachgelagerter Berechnungen)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  const weightInput = page.locator('[data-action="set-weight"]').first();
  await weightInput.fill('0');
  await weightInput.blur();
  await page.waitForTimeout(200);

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(state.weeks[0].days[0].exercises[0].sets[0].weight).toBe(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
