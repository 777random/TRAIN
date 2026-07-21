import { test, expect } from '@playwright/test';

// B68 (Feature): Share-Bild — Canvas-generiertes PNG (1080×1080) für den
// PR-Moment (Tagesabschluss) und den Wochenrückblick, geteilt über
// navigator.share/canShare (backup.js-Muster) mit Download-Fallback. Kein
// Server-Upload. In Chromium-Headless ist navigator.share nicht verfügbar,
// der Fallback-Pfad (Download) ist daher der tatsächlich getestete Zweig.

test('shareImage.js: buildPrShareCanvas liefert ein 1080x1080-Canvas', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const dims = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildPrShareCanvas([{ name: 'Kniebeuge', weight: 82.5, reps: 5, type: 'weight' }]);
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(dims).toEqual({ w: 1080, h: 1080 });
});

test('PR-Teilen-Button: erscheint nach echtem PR am Tagesabschluss und löst PNG-Download aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
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
    // B73: Datenschutz-Hinweis vor dem ersten Teilen — hier nicht Testgegenstand,
    // Consent per Flag vorab erteilen, damit der Klick sofort zum Download führt.
    localStorage.setItem('train_share_consent', 'true');
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="toggle-done"]');
  await expect(page.locator('.pr-badge:not(.pr-badge--goal):not(.pr-badge--reps)')).toHaveCount(1);

  await page.click('[data-action="toggle-complete"]');
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');

  // B79: Session Summary erscheint jetzt vor dem Tagesabschluss-Screen —
  // hier nicht Testgegenstand, per "Weiter" durchklicken.
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
  await page.click('#session-summary-continue');

  await page.waitForSelector('#dcs-share-btn', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#dcs-share-btn'),
  ]);
  expect(download.suggestedFilename()).toBe('train-pr.png');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Wochenrückblick-Teilen-Button löst PNG-Download aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }],
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
    // B73: Datenschutz-Hinweis vor dem ersten Teilen — hier nicht Testgegenstand,
    // Consent per Flag vorab erteilen, damit der Klick sofort zum Download führt.
    localStorage.setItem('train_share_consent', 'true');
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('#wr-btn-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#wr-btn-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
