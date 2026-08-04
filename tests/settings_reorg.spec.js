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

// P1-Fix (2026-08): der rote --Button ("Tag entfernen") unter "Trainingstage
// verwalten" nutzte bis dahin ein natives, synchron blockierendes confirm() --
// von Browser-Automatisierung (und potenziell echten Nutzern auf manchen
// Plattformen) nicht sauber handhabbar. Ersetzt durch dasselbe In-App
// Inline-Panel-Muster wie "Übung archivieren"/"Übung löschen": Klick öffnet
// das Panel (_removeDayConfirmKey), "Löschen" (confirm-remove-day) führt
// DAY_REMOVE aus, "Abbrechen" (cancel-remove-day) verwirft nur den State.
// Ein page.on('dialog', ...)-Handler, der NIE feuern darf, dient als
// Regressionswächter -- ein wiederkehrendes confirm() würde die Seite ohne
// automatische Bestätigung hängen lassen und den Test per Timeout kippen.

async function seedWithTwoDays(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: todayISO, note: '', mode: 'standard',
        days: [
          { id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
            locked: false, markedDone: false, isVacation: false,
            sleepHours: null, energyLevel: null, exercises: [] },
          { id: 12, title: 'Tag B', subtitle: '', warmup: '', cooldown: '',
            locked: false, markedDone: false, isVacation: false,
            sleepHours: null, energyLevel: null, exercises: [] },
        ],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      onboardingDone: true,
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

test('Tag entfernen (roter Minus-Button): Inline-Panel statt nativem Dialog, Bestätigen löscht den Tag', async ({ page }) => {
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => { unexpectedDialogs.push(dialog.message()); dialog.dismiss(); });
  await seedWithTwoDays(page);
  const settingsScope = page.locator('#settings-tab-content');

  // Runde 15: der rote Minus-Button erscheint jetzt bei JEDEM Tag (vorher
  // nur beim jeweils letzten) -- hier weiterhin gezielt der letzte Tag.
  await settingsScope.locator('[data-action="remove-day"][data-di="1"]').click();

  await expect(settingsScope.locator('[data-action="confirm-remove-day"][data-di="1"]')).toBeVisible({ timeout: 3000 });
  await expect(settingsScope.locator('[data-action="cancel-remove-day"]')).toBeVisible();

  await settingsScope.locator('[data-action="confirm-remove-day"][data-di="1"]').click();
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const titles = st.weeks[0].days.map(d => d.title);
  expect(titles).toEqual(['Tag A']);

  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Tag entfernen: Abbrechen im Inline-Panel laesst beide Tage unangetastet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedWithTwoDays(page);
  const settingsScope = page.locator('#settings-tab-content');

  await settingsScope.locator('[data-action="remove-day"][data-di="1"]').click();
  await expect(settingsScope.locator('[data-action="confirm-remove-day"][data-di="1"]')).toBeVisible({ timeout: 3000 });

  await settingsScope.locator('[data-action="cancel-remove-day"]').click();
  await expect(settingsScope.locator('[data-action="confirm-remove-day"]')).toHaveCount(0);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const titles = st.weeks[0].days.map(d => d.title);
  expect(titles).toEqual(['Tag A', 'Tag B']);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Runde 15 (Nutzerfeedback: Tag löschen wirkte "kompliziert und nicht
// intuitiv"): der rote Minus-Button war im Settings-Tab bisher NUR beim
// jeweils letzten Tag der Liste sichtbar (di === days.length-1) -- ein
// Nutzer, der einen ANDEREN Tag entfernen wollte, fand dort keine
// Möglichkeit dazu, obwohl DAY_REMOVE (state.js) jeden Index unterstützt.
// Fix: Button erscheint jetzt bei jedem Tag.
test('Tag entfernen: roter Minus-Button erscheint jetzt bei JEDEM Tag, nicht nur beim letzten', async ({ page }) => {
  await seedWithTwoDays(page);
  const settingsScope = page.locator('#settings-tab-content');

  await expect(settingsScope.locator('[data-action="remove-day"][data-di="0"]')).toBeVisible();
  await settingsScope.locator('[data-action="remove-day"][data-di="0"]').click();
  await expect(settingsScope.locator('[data-action="confirm-remove-day"][data-di="0"]')).toBeVisible({ timeout: 3000 });
  await settingsScope.locator('[data-action="confirm-remove-day"][data-di="0"]').click();
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const titles = st.weeks[0].days.map(d => d.title);
  expect(titles).toEqual(['Tag B']);
});

// Zweiter Teil desselben Befunds: bei genau 1 verbleibendem Tag verschwand
// der Button bisher komplett (kein disabled-Zustand, keine Erklärung) --
// identisch verwirrend wie das gemeldete "konnte den letzten Tag nicht
// löschen". Fix: Button bleibt sichtbar, aber disabled + Tooltip, analog
// zum bereits bestehenden Guard im Wochen-Menü-Dropdown.
test('Tag entfernen: bei nur noch 1 Tag ist der Button sichtbar aber disabled (nicht mehr unsichtbar)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const todayISO = new Date().toISOString().split('T')[0];
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: todayISO, note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, exercises: [] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="settings"]');

  const btn = page.locator('#settings-tab-content [data-action="remove-day"][data-di="0"]');
  await expect(btn).toBeVisible();
  await expect(btn).toBeDisabled();
  await expect(btn).toHaveAttribute('title', /Mindestens ein Trainingstag/);
});

// Befund (Minor): Stangengewicht-Feld akzeptierte unrealistisch hohe Werte
// (z.B. 99999) ohne Obergrenze -- nur negative Werte fielen bereits auf den
// Default (20) zurück. Fix: Bedingung um `&& bw <= 50` erweitert, Fallback
// bleibt konsistent 20 (nicht der letzte gültige Wert).
test('Stangengewicht: unrealistisch hoher Wert (99999) faellt beim Verlassen des Feldes auf 20 zurueck', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  const input = page.locator('[data-action="set-barbell-weight"]');
  await input.fill('99999');
  await input.blur();
  const bw = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.barbellWeight);
  expect(bw).toBe(20);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Bestehendes Negativ-Fallback-Verhalten bleibt unveraendert (Regressionsschutz
// fuer die genaue Bedingung, nicht Teil dieses Fixes selbst).
test('Stangengewicht: negativer Wert faellt weiterhin auf 20 zurueck (unveraendertes Verhalten)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);
  const input = page.locator('[data-action="set-barbell-weight"]');
  await input.fill('-5');
  await input.blur();
  const bw = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.barbellWeight);
  expect(bw).toBe(20);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
