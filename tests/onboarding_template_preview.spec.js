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

// Befund (P1): "Vorlage laden" blieb inaktiv, obwohl eine Karte durch
// Erfahrung+Hauptziel bereits als "Empfohlen für dich" markiert war -- die
// Empfehlung (_recommendedIdx, rein visuell) war nie mit der echten Auswahl
// (_selTpl, steuert den Button + case 'load') verknüpft. Fix: die
// select-exp/select-goal-Handler übernehmen die berechnete Empfehlung jetzt
// zusätzlich in _selTpl, ohne dass ein Klick auf die Karte selbst nötig ist.
test('Erfahrung+Hauptziel setzen (ohne Kartenklick) aktiviert "Vorlage laden" und lädt die empfohlene Vorlage', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  const loadBtn = page.locator('[data-ob="load"]');
  await expect(loadBtn).toBeDisabled();

  // "Optional: Vorlage anpassen" aufklappen, damit die Buttons sichtbar/klickbar sind.
  await page.click('.ob-optional__summary');
  await page.click('[data-ob="select-exp"][data-exp="anfaenger"]');
  // Anfänger -> _recommendedIdx = 0 (siehe _computeRecommendedIdx(), ui.js)
  await expect(page.locator('.ob-tpl-card').nth(0)).toHaveClass(/is-selected/);
  await expect(loadBtn).toBeEnabled();

  await loadBtn.click();
  // Datenschutz-Screen folgt direkt nach "load" -> Beleg, dass _applyTpl()
  // tatsächlich gelaufen ist (case 'load' ruft _applyTpl() nur wenn
  // _selTpl !== null).
  await expect(page.locator('.ob-screen h2')).toHaveText('Deine Daten bleiben bei dir');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const weeks = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks);
  expect(weeks.length).toBe(1);
  expect(weeks[0].days[0].exercises.length).toBeGreaterThan(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Klick auf eine ANDERE Karte überschreibt die zuvor per Empfehlung gesetzte Auswahl weiterhin normal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-optional__summary');
  await page.click('[data-ob="select-exp"][data-exp="anfaenger"]'); // empfiehlt+wählt Karte 0
  await expect(page.locator('.ob-tpl-card').nth(0)).toHaveClass(/is-selected/);

  await page.click('.ob-tpl-card >> nth=1'); // manueller Klick auf andere Karte
  await expect(page.locator('.ob-tpl-card').nth(1)).toHaveClass(/is-selected/);
  await expect(page.locator('.ob-tpl-card').nth(0)).not.toHaveClass(/is-selected/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Befund (Minor): Körpergewicht-Vorlage hatte Split-Terminologie ("Push +
// Legs" / "Pull + Core") in den Tag-Titeln, obwohl die Vorlage als
// "Ganzkörper" beworben wird (siehe .ob-tpl-meta). Neutral auf "Tag A"/
// "Tag B" vereinheitlicht.
test('Körpergewicht-Vorlage erzeugt Tage mit neutralen Titeln "Tag A"/"Tag B" (kein Push/Pull-Split-Titel mehr)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#onboarding', { timeout: 10000 });

  await page.click('.ob-tpl-card >> nth=2'); // Körpergewicht ist die 3. Vorlage (Index 2)
  await page.click('[data-ob="load"]');
  await page.click('[data-ob="privacy-continue"]');
  await page.waitForSelector('#onboarding', { state: 'detached', timeout: 10000 });

  const dayTitles = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].days.map(d => d.title));
  expect(dayTitles).toEqual(['Tag A', 'Tag B']);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
