import { test, expect } from '@playwright/test';

// Runde 6 / B4: "Stoppuhr ausblenden"-Toggle (Settings, Abschnitt "Training"),
// analog zum bestehenden hideStreakBadge-Muster (siehe streak_toggle.spec.js).
// Regressionstest bestätigt beide Richtungen, nicht nur "kein Crash".

test('Stoppuhr-Toggle: aus- und wieder einblendbar', async ({ page }) => {
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
          sleepHours: null, energyLevel: null, sessionRating: null, exercises: [],
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      customTemplate: [], settings: {}, prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await expect(page.locator('#toolbar-session-timer')).toHaveCount(1);
  await expect(page.locator('#btn-reset-timer')).toHaveCount(1);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="toggle-setting"][data-key="hideStopwatch"]');
  await page.click('[data-tab="workout"]');
  await expect(page.locator('#toolbar-session-timer')).toHaveCount(0);
  await expect(page.locator('#btn-reset-timer')).toHaveCount(0);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="toggle-setting"][data-key="hideStopwatch"]');
  await page.click('[data-tab="workout"]');
  await expect(page.locator('#toolbar-session-timer')).toHaveCount(1);
  await expect(page.locator('#btn-reset-timer')).toHaveCount(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
