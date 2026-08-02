import { test, expect } from '@playwright/test';

// Runde 6 / B5: Übersicht aller favorisierten Übungen — Button in der
// "Bestleistungen"-Karte (Fortschritt-Tab) öffnet ein Modal mit allen
// Einträgen aus state.favoriteExercises + ihren PR-Daten.

test('Favoriten-Übersicht: Button öffnet Modal mit allen favorisierten Übungen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 30, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{
        id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
        days: [{
          id: 2, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }],
            prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false,
          }],
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      customTemplate: [], settings: {},
      favoriteExercises: ['Kniebeuge', 'Bankdrücken'],
      prs: {
        'Kniebeuge':  { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, date: '2026-06-29' },
        'Bankdrücken': { maxWeight: 80,  maxVolume: 400, maxEstimated1RM: 93.3,  date: '2026-06-22' },
      },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.click('[data-action="open-favorites-overview"]');

  await expect(page.locator('#modal-favorites')).toHaveClass(/is-open/);
  const body = page.locator('#favorites-overview-body');
  await expect(body.locator('.pr-row')).toHaveCount(2);
  await expect(body).toContainText('Kniebeuge');
  await expect(body).toContainText('Bankdrücken');
  await expect(body).toContainText('100 kg');

  await page.click('#modal-favorites [data-action="close-modal"]');
  await expect(page.locator('#modal-favorites')).not.toHaveClass(/is-open/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Favoriten-Übersicht: leerer Zustand ohne Favoriten', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 30, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{
        id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
        days: [{
          id: 2, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }],
            prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false,
          }],
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      customTemplate: [], settings: {}, favoriteExercises: [],
      prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, date: '2026-06-29' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.click('[data-action="open-favorites-overview"]');

  await expect(page.locator('#modal-favorites')).toHaveClass(/is-open/);
  await expect(page.locator('#favorites-overview-body')).toContainText('Noch keine favorisierten Übungen');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
