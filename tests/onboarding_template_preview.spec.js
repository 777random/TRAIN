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

// Befund #3 (Hantelscheiben-Rechner-Default): _applyTpl() setzte showPlates
// bislang IMMER auf false, unabhängig von der Metrik -- der Hantelscheiben-
// Rechner war dadurch nach einer Vorlagen-Übernahme für keine einzige Übung
// sichtbar, bis man ihn manuell im "Erweitert"-Panel einschaltete. Jetzt
// true per Default, aber NUR für Gewichts-Übungen (metric 'reps') -- Plank
// (m: 'sec') muss weiterhin false bleiben, da ein Scheiben-Rechner für eine
// Zeit-Übung ohne Gewichtsachse keinen Sinn ergibt.
test('Vorlagen-Übernahme: showPlates ist true für Gewichts-Übungen, false für Zeit-/Distanz-Übungen (Plank)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=0');
  await page.click('[data-ob="load"]');

  const exercises = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return st.weeks[0].days[0].exercises.map(ex => ({ name: ex.name, metric: ex.metric, showPlates: ex.showPlates }));
  });

  const kniebeuge = exercises.find(ex => ex.name === 'Kniebeuge');
  const plank     = exercises.find(ex => ex.name === 'Plank');
  expect(kniebeuge.metric).toBe('reps');
  expect(kniebeuge.showPlates).toBe(true);
  expect(plank.metric).toBe('sec');
  expect(plank.showPlates).toBe(false);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
