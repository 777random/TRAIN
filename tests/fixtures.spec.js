import { test, expect } from '@playwright/test';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const FIXTURES_DIR = 'tests/fixtures';
const fixtures = readdirSync(FIXTURES_DIR).filter(f => f.endsWith('.json'));

for (const fixture of fixtures) {
  test(`Fixture: ${fixture}`, async ({ page }) => {
    // Muss VOR jeder Navigation registriert werden — sonst werden Fehler,
    // die während des page.reload() unten selbst auftreten, verpasst.
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto('/');
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });

    // Fixture-JSON entspricht direkt dem rohen state.js-Shape
    // (meta/curIdx/weeks/...), kein Export-Envelope — per localStorage
    // gesetzt statt über den UI-Import-Dialog, analog zum bereits
    // etablierten Testmuster dieser Session (siehe SESSION_LOG.md).
    const json = readFileSync(join(FIXTURES_DIR, fixture), 'utf-8');
    await page.evaluate((data) => {
      localStorage.setItem('train_v6', data);
    }, json);

    await page.reload();
    await page.waitForSelector('#app.is-ready', { timeout: 10000 });

    await page.click('[data-tab="coach"]');
    await page.waitForTimeout(500);

    await page.click('[data-tab="progress"]');
    await page.waitForTimeout(500);

    expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  });
}
