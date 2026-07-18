import { test, expect } from '@playwright/test';

// B57: "Alle Daten löschen"-Button in den Einstellungen (Settings-Tab,
// Abschnitt "Deine Daten"). Verifiziert, dass bestehende Trainingsdaten
// nach Bestätigung wirklich unwiderruflich entfernt werden (primary +
// shadow localStorage-Key) und die App danach frisch in den Onboarding-
// Zustand startet, statt z.B. auf einem Zwischenzustand hängen zu bleiben.

test('Alle Daten löschen: bestehende Daten weg, App startet danach frisch (Onboarding)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 30, savedAt: '2020-01-01T00:00:00.000Z', createdAt: '2020-01-01T00:00:00.000Z' },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: '2020-01-06', note: 'MARKER_ALTE_DATEN', mode: 'standard',
        days: [{
          id: 2, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null, exercises: [],
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      customTemplate: [], settings: {}, prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_v6_shadow', 'x');
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const beforeHasOldMarker = await page.evaluate(() => localStorage.getItem('train_v6').includes('MARKER_ALTE_DATEN'));
  expect(beforeHasOldMarker).toBe(true);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="delete-all-data"]');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const after = await page.evaluate(() => {
    const raw = localStorage.getItem('train_v6');
    return raw ? JSON.parse(raw) : null;
  });

  expect(JSON.stringify(after)).not.toContain('MARKER_ALTE_DATEN');
  expect(after.onboardingDone).toBe(false);
  await expect(page.locator('#onboarding')).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
