import { test, expect } from '@playwright/test';

// B3: Einstellungen restrukturiert — 4 Zwischenüberschriften innerhalb der
// bestehenden "Training"-Karte (kein neuer Trennstrich, kein Logik-Wechsel).

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="settings"]');
}

test('4 Zwischenueberschriften sichtbar, in der richtigen Reihenfolge (AC1)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  const titles = await page.locator('.settings-group-title').allTextContents();
  expect(titles).toEqual(['Training', 'Fortschritt & Anzeige', 'Gewicht & Steigerung', 'Automatisierung']);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Alle bestehenden Elemente weiterhin vorhanden (AC2)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  for (const key of ['sessionCoach', 'rpeEnabled', 'autoEval', 'autoStartPauseTimer', 'vibrationEnabled', 'swipe', 'hideStreakBadge']) {
    await expect(page.locator(`[data-action="toggle-setting"][data-key="${key}"]`)).toBeVisible();
  }
  await expect(page.locator('[data-action="set-goal"]')).toHaveCount(3);
  await expect(page.locator('[data-action="set-plate-step"]')).toHaveCount(3);
  await expect(page.locator('[data-action="set-max-session"]')).toHaveCount(5);
  await expect(page.locator('[data-action="set-barbell-weight"]')).toBeVisible();
  // "Individuell"-Button sitzt in einem eingeklappten <details> (Erweiterte
  // Einstellungen) -- erst nach dem Aufklappen sichtbar, per Design.
  await expect(page.locator('[data-action="set-deload-factor-custom"]')).toHaveCount(1);
  await page.click('.deload-details__summary');
  await expect(page.locator('[data-action="set-deload-factor-custom"]')).toBeVisible();
  await expect(page.locator('[data-action="toggle-autoweek-enabled"]')).toBeVisible();
  await expect(page.locator('[data-action="toggle-autoweek-sub"][data-key="suggestProgress"]')).toBeVisible();
  await expect(page.locator('[data-action="toggle-autoweek-sub"][data-key="showReview"]')).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Toggle-Roundtrip funktioniert unveraendert (AC3)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  const toggle = page.locator('[data-action="toggle-setting"][data-key="hideStreakBadge"]');
  await expect(toggle).not.toHaveClass(/is-on/);
  await toggle.click();
  await expect(toggle).toHaveClass(/is-on/);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.hideStreakBadge);
  expect(st).toBe(true);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Sub-Toggles ausgegraut wenn Automatische Wochenerstellung AUS (AC4)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  const suggestRow = page.locator('[data-action="toggle-autoweek-sub"][data-key="suggestProgress"]').locator('..');
  await expect(suggestRow).toHaveClass(/is-disabled/);
  await expect(page.locator('[data-action="toggle-autoweek-sub"][data-key="suggestProgress"]')).toBeDisabled();

  await page.click('[data-action="toggle-autoweek-enabled"]');
  await expect(suggestRow).not.toHaveClass(/is-disabled/);
  await expect(page.locator('[data-action="toggle-autoweek-sub"][data-key="suggestProgress"]')).toBeEnabled();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Mobile (375px): Einstellungen rendern ohne Absturz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.setViewportSize({ width: 375, height: 667 });
  await seed(page);
  await expect(page.locator('.settings-group-title').first()).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
