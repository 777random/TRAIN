import { test, expect } from '@playwright/test';

// Runde 28 (Onboarding-Flow-Audit): 2 parallele Diagnose-Agenten fanden 5
// bestätigte Bugs. Dieser Test deckt die funktional relevanten Fixes ab
// (UTC-Datum, Klon-Reset-Lücke, verwaiste Startwerte, fehlende Obergrenze).

test('"Startwerte eingeben": Vorlagenwechsel verwirft verwaiste Werte einer vorherigen Vorlage', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=0'); // Krafttraining Einsteiger (Kniebeuge/Kreuzheben)
  await page.click('.ob-startwerte > .ob-optional__summary');
  await page.fill('[data-sw-field="weight"][data-sw-name="Kniebeuge"]', '60');

  await page.click('.ob-tpl-card >> nth=2'); // Wechsel zu Körpergewicht (kein Kniebeuge/Kreuzheben)
  await page.click('[data-ob="load"]');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const weeks = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks);
  // Ohne Fix würde eine zweite ("Startwerte") Woche mit dem verwaisten
  // Kniebeuge-Eintrag aus der verworfenen Vorlage entstehen.
  expect(weeks.length).toBe(1);
  expect(weeks.some(w => w.isSeedWeek)).toBe(false);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Startwerte-Eingabe: unrealistischer Gewichtswert wird abgelehnt, gültige Werte bleiben unangetastet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=0');
  await page.click('.ob-startwerte > .ob-optional__summary');
  await page.fill('[data-sw-field="weight"][data-sw-name="Kniebeuge"]', '8250'); // Tippfehler
  await page.fill('[data-sw-field="weight"][data-sw-name="Kreuzheben"]', '100'); // gültig

  await page.click('[data-ob="load"]');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const weeks = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks);
  const seedWeek = weeks.find(w => w.isSeedWeek);
  expect(seedWeek).toBeTruthy();
  const seedNames = seedWeek.days[0].exercises.map(ex => ex.name);
  expect(seedNames).toContain('Kreuzheben');
  expect(seedNames).not.toContain('Kniebeuge');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Onboarding-Wochenstartdatum ist lokal berechnet (kein UTC-Rollover)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=0');
  await page.click('[data-ob="load"]');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const startDate = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].startDate);

  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  expect(startDate).toBe(expected);
});

test('_appendDefaultWeek() (ONBOARDING_DONE-Fallback) nutzt jetzt _resetClonedDays()', async ({ page }) => {
  const customTemplate = [{
    id: 'A', title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: 7, energyLevel: 4, sessionStartTs: 111, sessionEndTs: 222,
    sessionCheckIn: { sleep: 'good' }, sessionModifier: 'normal', sessionModifierScope: 'day',
    exercises: [{
      name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
      sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
      prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
      progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
      archived: false, skipReason: 'injury', skipDate: '2026-06-01', substituteFor: null,
    }],
  }];

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((tpl) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [], onboardingDone: false,
      customTemplate: tpl, settings: {},
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      exerciseNotes: {}, customAlternatives: {},
    }));
  }, customTemplate);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.ONBOARDING_DONE, {});
    const day = mod.getState().weeks[0].days[0];
    return {
      markedDone: day.markedDone, locked: day.locked,
      sessionCheckIn: day.sessionCheckIn, sleepHours: day.sleepHours,
      skipReason: day.exercises[0].skipReason,
    };
  });

  expect(result.markedDone).toBe(false);
  expect(result.locked).toBe(false);
  expect(result.sessionCheckIn).toBeNull();
  expect(result.sleepHours).toBeNull();
  expect(result.skipReason).toBeNull();
});
