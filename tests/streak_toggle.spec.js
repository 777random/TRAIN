import { test, expect } from '@playwright/test';

// B60: "Streak-Anzeige ausblenden"-Toggle (Settings, Abschnitt "Training").
// Fund während der Implementierung: SETTING_TOGGLE (state.js) toggled nur
// Keys, die bereits `in state.settings` existieren (`if (p.key in state.settings)`)
// — ohne einen Default-Wert für `hideStreakBadge` in STATE_INIT + migrate()
// hätte der Toggle-Button in der UI stumm gar nichts bewirkt. Regressionstest
// bestätigt beide Richtungen, nicht nur "kein Crash".

test('Streak-Badge-Toggle: aus- und wieder einblendbar', async ({ page }) => {
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
          locked: false, markedDone: true, isVacation: false,
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

  await expect(page.locator('.streak-badge')).toHaveCount(1);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="toggle-setting"][data-key="hideStreakBadge"]');
  await page.click('[data-tab="workout"]');
  await expect(page.locator('.streak-badge')).toHaveCount(0);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="toggle-setting"][data-key="hideStreakBadge"]');
  await page.click('[data-tab="workout"]');
  await expect(page.locator('.streak-badge')).toHaveCount(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
