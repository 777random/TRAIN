import { test, expect } from '@playwright/test';

// Datenschutz/Backup-Vertrauens-Screen im Onboarding (train-v195). Vorher
// stand der einzige Hinweis auf lokale Speicherung/Datenverlust nur als ein
// einzelner Satz auf dem plattformabhängigen Install-Screen — der wird auf
// vielen Plattformen (Desktop-Firefox, bereits installiert) komplett
// übersprungen, wodurch diese Nutzer den Hinweis nie sahen. Jetzt läuft ein
// eigener, IMMER gezeigter Screen direkt nach der Vorlagen-Wahl, unabhängig
// vom gewählten Pfad (Vorlage laden ODER "Ohne Vorlage starten") und
// unabhängig davon, ob der Install-Screen danach folgt oder übersprungen
// wird (siehe _afterPrivacy(), ui.js).

test('Datenschutz-Screen erscheint nach "Ohne Vorlage starten" und lässt sich fortsetzen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('[data-ob="skip"]');
  await expect(page.locator('.ob-screen h2')).toHaveText('Deine Daten bleiben bei dir');
  await expect(page.locator('.ob-backup-warn')).toContainText('unwiderruflich weg');
  await expect(page.locator('.ob-backup-warn')).toContainText('Einstellungen → Backup');

  await page.click('[data-ob="privacy-continue"]');
  // Headless Chromium: kein beforeinstallprompt, kein iOS-UA -> _afterPrivacy()
  // geht direkt zu _finish(), Install-Screen wird übersprungen.
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });
  await expect(page.locator('#app.is-ready')).toBeVisible();

  const onboardingDone = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).onboardingDone);
  expect(onboardingDone).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Datenschutz-Screen erscheint auch nach "Vorlage laden" (nicht nur beim Leer-Start)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=0');
  await page.click('[data-ob="load"]');
  await expect(page.locator('.ob-screen h2')).toHaveText('Deine Daten bleiben bei dir');

  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });
  await expect(page.locator('#app.is-ready')).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
