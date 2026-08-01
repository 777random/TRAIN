import { test, expect } from '@playwright/test';

// B57: "Alle Daten löschen"-Button in den Einstellungen (Settings-Tab,
// Abschnitt "Deine Daten"). Verifiziert, dass bestehende Trainingsdaten
// nach Bestätigung wirklich unwiderruflich entfernt werden (primary +
// shadow localStorage-Key) und die App danach frisch in den Onboarding-
// Zustand startet, statt z.B. auf einem Zwischenzustand hängen zu bleiben.
//
// P1-Fix (2026-08): "delete-all-data" nutzte bis dahin ein natives,
// synchron blockierendes confirm() -- von Browser-Automatisierung (und
// potenziell echten Nutzern auf manchen Plattformen) nicht sauber
// handhabbar. Ersetzt durch ein In-App Inline-Panel (gleiches Muster wie
// "Übung archivieren"): Klick auf den Button öffnet das Panel
// (_deleteAllDataConfirmOpen), "Alles löschen" (confirm-delete-all-data)
// führt die Löschung aus, "Abbrechen" (cancel-delete-all-data) verwirft sie.
// Kein page.on('dialog', ...) mehr nötig/erwartet -- ein registrierter
// Dialog-Handler, der NIE feuern darf, dient hier als Regressionswächter:
// würde ui.js wieder auf confirm() zurückfallen, bliebe die Seite hängen
// (kein Handler mehr würde ihn automatisch schliessen) und der Test würde
// per Timeout fehlschlagen statt fälschlich grün zu sein.

async function seedOldData(page) {
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
}

test('Alle Daten löschen: bestehende Daten weg, App startet danach frisch (Onboarding)', async ({ page }) => {
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => { unexpectedDialogs.push(dialog.message()); dialog.dismiss(); });

  await seedOldData(page);

  const beforeHasOldMarker = await page.evaluate(() => localStorage.getItem('train_v6').includes('MARKER_ALTE_DATEN'));
  expect(beforeHasOldMarker).toBe(true);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="delete-all-data"]');

  // Inline-Panel statt nativem Dialog -- muss ohne Timeout/Blockade erscheinen.
  await expect(page.locator('[data-action="confirm-delete-all-data"]')).toBeVisible({ timeout: 3000 });
  await expect(page.locator('[data-action="cancel-delete-all-data"]')).toBeVisible();

  await page.click('[data-action="confirm-delete-all-data"]');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const after = await page.evaluate(() => {
    const raw = localStorage.getItem('train_v6');
    return raw ? JSON.parse(raw) : null;
  });

  expect(JSON.stringify(after)).not.toContain('MARKER_ALTE_DATEN');
  expect(after.onboardingDone).toBe(false);
  await expect(page.locator('#onboarding')).toBeVisible();

  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Alle Daten löschen: Abbrechen im Inline-Panel lässt Daten unangetastet', async ({ page }) => {
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => { unexpectedDialogs.push(dialog.message()); dialog.dismiss(); });

  await seedOldData(page);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="delete-all-data"]');
  await expect(page.locator('[data-action="confirm-delete-all-data"]')).toBeVisible({ timeout: 3000 });

  await page.click('[data-action="cancel-delete-all-data"]');
  await expect(page.locator('[data-action="confirm-delete-all-data"]')).toHaveCount(0);

  const stillHasOldMarker = await page.evaluate(() => localStorage.getItem('train_v6').includes('MARKER_ALTE_DATEN'));
  expect(stillHasOldMarker).toBe(true);

  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
