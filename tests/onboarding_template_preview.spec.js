import { test, expect } from '@playwright/test';

// Onboarding-Vorlagenkarten zeigten bisher nur Icon/Titel/Frequenz/Equipment,
// nie die enthaltenen Übungen -- ein Nutzer konnte eine Vorlage übernehmen,
// ohne je die 5 Übungen pro Tag gesehen zu haben. Neue `.ob-tpl-exercises`-
// Zeile zeigt die ersten 3-5 eindeutigen Übungsnamen (Reihenfolge wie in
// _ONBOARDING_TEMPLATES), dezent unter `.ob-tpl-sub`.

test('Alle 3 Vorlagenkarten zeigen eine Übungs-Vorschau', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  const previews = page.locator('.ob-tpl-exercises');
  await expect(previews).toHaveCount(3);

  await expect(previews.nth(0)).toHaveText('Kniebeuge · Bankdrücken · Latziehen · Militärpress · Plank');
  await expect(previews.nth(1)).toHaveText('Bankdrücken · Militärpress · Schrägbankdrücken · Seitheben · Trizepsdrücken');
  await expect(previews.nth(2)).toHaveText('Liegestütz · Kniebeuge · Dips · Ausfallschritte · Plank');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Übungs-Vorschau bleibt sichtbar unabhängig von Auswahl/Empfehlung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=1');
  await expect(page.locator('.ob-tpl-card.is-selected .ob-tpl-exercises')).toHaveText('Bankdrücken · Militärpress · Schrägbankdrücken · Seitheben · Trizepsdrücken');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
