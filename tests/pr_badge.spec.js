import { test, expect } from '@playwright/test';

// Nutzer-Fund (2026-07): der PR-Pokal (🏆) blieb auch dann sichtbar, wenn ein
// bereits in einer FRÜHEREN Woche erreichtes Gewicht in einer späteren Woche
// nur WIEDERHOLT (nicht gesteigert) wurde — ex.prWeight ist ein All-Time-Wert
// und der alte Vergleich `s.weight >= ex.prWeight` konnte das nicht von einem
// echten neuen Rekord unterscheiden. Fix: `_applyPrTracking()` (state.js)
// markiert den Satz, der einen Rekord TATSÄCHLICH auslöst, direkt am Satz
// (`s.prBadge`), statt es am Render-Zeitpunkt neu zu berechnen. Beide Seiten
// verifiziert: alte Wiederholung zeigt keinen Pokal, echte Steigerung schon.
// Selektor bewusst `.pr-badge:not(.pr-badge--goal):not(.pr-badge--reps)` —
// dieselbe CSS-Klasse wird auch für den unabhängigen "Ziel erreicht"-Badge
// (isEffortGoal) verwendet, der nichts mit einem PR zu tun hat.

test('PR-Pokal: Wiederholung eines alten Rekords zeigt keinen Pokal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const exBase = {
      name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
      prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 99,
      progressionType: 'weight', archived: false,
    };
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 30, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: [
        { id: 1, startDate: '2026-06-29', note: '', mode: 'standard',
          days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
            sleepHours: null, energyLevel: null, sessionRating: null,
            exercises: [{ ...exBase, sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }] }] }],
          sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
        { id: 2, startDate: '2026-07-06', note: '', mode: 'standard',
          days: [{ id: 22, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false,
            sleepHours: null, energyLevel: null, sessionRating: null,
            exercises: [{ ...exBase, sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }] }] }],
          sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
      ],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-06-29' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await expect(page.locator('.pr-badge:not(.pr-badge--goal):not(.pr-badge--reps)')).toHaveCount(0);
  await expect(page.locator('.pr-badge--reps')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('PR-Pokal: echte Gewichtssteigerung zeigt weiterhin den Pokal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 30, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-13', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 105, reps: 5, rpe: 8, status: 'pending', done: false, note: '' }],
            prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false,
          }] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-07-06' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="toggle-done"]');
  await expect(page.locator('.pr-badge:not(.pr-badge--goal):not(.pr-badge--reps)')).toHaveCount(1);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
