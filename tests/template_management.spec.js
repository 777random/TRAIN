import { test, expect } from '@playwright/test';

// Runde 6, Cluster 7: schliesst die 4 Testluecken aus Runde 3
// ("Standard-Template bearbeiten", "Woche als Vorlage speichern",
// "Woche zuruecksetzen", "Original wiederherstellen"), die dort wegen des
// damaligen nativen-confirm()-Blockers vorsichtshalber uebersprungen wurden.
//
// Update Runde 16 (Phase-C-Cluster-1b): "Woche zuruecksetzen"
// (reset-to-tpl), "Original wiederherstellen" (reset-factory) und "Woche
// als Vorlage speichern" (save-named-template) nutzten bis dahin native
// confirm()/prompt()-Dialoge -- jetzt auf dasselbe In-App-Inline-Panel-
// Muster umgestellt wie "Alle Daten loeschen"/"Tag entfernen". Tests unten
// entsprechend auf echte Klicks auf die Inline-Panels umgestellt, inkl.
// page.on('dialog', ...)-Regressionswaechter (darf nie feuern).
// "Standard-Template bearbeiten" hatte nie einen Dialog.

const CUSTOM_TEMPLATE = [
  {
    id: 'A', title: 'Tag A', subtitle: 'Custom', warmup: '', cooldown: '',
    exercises: [
      { name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps',
        sets: [{ weight: 20, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] },
    ],
  },
];

async function seed(page, { weekOverrides = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ customTemplate, weekOverrides }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: new Date().toISOString().split('T')[0], note: '', mode: 'standard',
        days: [{
          id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [{
            name: 'Bankdruecken', note: '', pauseSec: 90, metric: 'reps', progressionType: 'weight',
            sets: [{ weight: 40, reps: 8, rpe: 8, status: 'success', done: true, note: '' }],
          }],
          ...weekOverrides,
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      onboardingDone: true,
      customTemplate, templates: [],
      settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, { customTemplate: CUSTOM_TEMPLATE, weekOverrides });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="settings"]');
}

// ─── 1. Standard-Template bearbeiten ───────────────────────────────────────

test('Standard-Template bearbeiten: Name aendern + Uebung hinzufuegen wird gespeichert (Happy Path)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="open-tpl"]');
  await expect(page.locator('#modal-template')).toBeVisible();

  // Reihenfolge wichtig: add-ex dispatched sofort TPL_SAVE mit dem
  // aktuellen State und rendert #tpl-editor-body danach neu — ein bereits
  // getippter, aber noch ungespeicherter Namens-Input-Wert würde dadurch
  // verworfen. Erst hinzufuegen, dann umbenennen, dann final speichern.
  await page.click('[data-tpl-action="add-ex"][data-tpl-di="0"]');
  await expect(page.locator('[data-tpl-di="0"][data-tpl-ei="1"][data-tpl-field="name"]')).toHaveCount(1);

  const nameInput = page.locator('[data-tpl-di="0"][data-tpl-ei="0"][data-tpl-field="name"]');
  await nameInput.fill('Kniebeuge Variante');

  await page.click('[data-action="save-tpl"]');
  await expect(page.locator('#modal-template')).toBeHidden();

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.customTemplate[0].exercises).toHaveLength(2);
  expect(st.customTemplate[0].exercises[0].name).toBe('Kniebeuge Variante');
  expect(st.customTemplate[0].exercises[1].name).toBe('Neue Übung');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Standard-Template bearbeiten: Saetze-Anzahl wird beim Speichern auf 8 geklemmt (Edge Case)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="open-tpl"]');
  await expect(page.locator('#modal-template')).toBeVisible();

  const setsInput = page.locator('[data-tpl-di="0"][data-tpl-ei="0"][data-tpl-field="setsCount"]');
  await setsInput.fill('99');

  await page.click('[data-action="save-tpl"]');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.customTemplate[0].exercises[0].sets).toHaveLength(8);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── 2. Woche als Vorlage speichern (Runde 16: Inline-Textfeld statt prompt()) ─

test('Woche als Vorlage speichern: Name eingeben + Speichern legt Vorlage an (Happy Path)', async ({ page }) => {
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => { unexpectedDialogs.push(dialog.message()); dialog.dismiss(); });
  await seed(page);

  await page.click('[data-action="save-named-template"]');
  const nameInput = page.locator('[data-action="save-named-template-name"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill('Mein Split');
  await page.click('[data-action="confirm-save-named-template"]');
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.templates).toHaveLength(1);
  expect(st.templates[0].name).toBe('Mein Split');
  expect(st.templates[0].days[0].exercises[0].name).toBe('Bankdruecken');

  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Woche als Vorlage speichern: Abbrechen im Inline-Panel legt keine Vorlage an (Edge Case)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="save-named-template"]');
  const nameInput = page.locator('[data-action="save-named-template-name"]');
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  await nameInput.fill('Wird verworfen');
  await page.click('[data-action="cancel-save-named-template"]');
  await expect(page.locator('[data-action="save-named-template-name"]')).toHaveCount(0);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.templates).toHaveLength(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Woche als Vorlage speichern: leerer Name legt keine Vorlage an (Edge Case)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="save-named-template"]');
  await page.click('[data-action="confirm-save-named-template"]');
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.templates).toHaveLength(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── 3. Woche zuruecksetzen (Runde 16: Inline-Panel statt nativem confirm()) ─

test('Woche zuruecksetzen: Bestaetigen im Inline-Panel ueberschreibt die Woche mit dem Custom-Template (Happy Path)', async ({ page }) => {
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => { unexpectedDialogs.push(dialog.message()); dialog.dismiss(); });
  await seed(page, { weekOverrides: { locked: true, markedDone: true } });

  await page.click('[data-action="reset-to-tpl"]');
  await expect(page.locator('[data-action="confirm-reset-to-tpl"]')).toBeVisible({ timeout: 3000 });
  await page.click('[data-action="confirm-reset-to-tpl"]');
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const day = st.weeks[0].days[0];
  expect(day.locked).toBe(false);
  expect(day.markedDone).toBe(false);
  expect(day.exercises[0].name).toBe('Kniebeuge');
  expect(day.exercises[0].sets[0].status).toBe('pending');
  expect(day.exercises[0].sets[0].done).toBe(false);

  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0); // kein natives confirm() mehr
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Woche zuruecksetzen: Abbrechen im Inline-Panel laesst die Woche unangetastet (Edge Case)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { weekOverrides: { locked: true, markedDone: true } });

  await page.click('[data-action="reset-to-tpl"]');
  await expect(page.locator('[data-action="confirm-reset-to-tpl"]')).toBeVisible({ timeout: 3000 });
  await page.click('[data-action="cancel-reset-to-tpl"]');
  await expect(page.locator('[data-action="confirm-reset-to-tpl"]')).toHaveCount(0);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const day = st.weeks[0].days[0];
  expect(day.locked).toBe(true);
  expect(day.markedDone).toBe(true);
  expect(day.exercises[0].name).toBe('Bankdruecken');
  expect(day.exercises[0].sets[0].done).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── 4. Original wiederherstellen (Runde 16: Inline-Panel statt nativem confirm()) ─

test('Original wiederherstellen: Bestaetigen im Inline-Panel setzt das Custom-Template auf FACTORY_TEMPLATE zurueck (Happy Path)', async ({ page }) => {
  const pageErrors = [];
  const unexpectedDialogs = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => { unexpectedDialogs.push(dialog.message()); dialog.dismiss(); });
  await seed(page);

  await page.click('[data-action="reset-factory"]');
  await expect(page.locator('[data-action="confirm-reset-factory"]')).toBeVisible({ timeout: 3000 });
  await page.click('[data-action="confirm-reset-factory"]');
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.customTemplate.map(d => d.id)).toEqual(['A', 'B', 'C']);
  expect(st.customTemplate.map(d => d.title)).toEqual(['Tag A', 'Tag B', 'Tag C']);

  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0); // kein natives confirm() mehr
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Original wiederherstellen: Abbrechen im Inline-Panel laesst das Custom-Template unangetastet (Edge Case)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="reset-factory"]');
  await expect(page.locator('[data-action="confirm-reset-factory"]')).toBeVisible({ timeout: 3000 });
  await page.click('[data-action="cancel-reset-factory"]');
  await expect(page.locator('[data-action="confirm-reset-factory"]')).toHaveCount(0);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(st.customTemplate).toEqual(CUSTOM_TEMPLATE);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
