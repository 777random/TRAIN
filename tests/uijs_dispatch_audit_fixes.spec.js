import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 390, height: 2200 } });

// Runde 33 (ui.js-Dispatch-Handler-Audit): 2 parallele Diagnose-Agenten
// fanden 2 bestätigte Bugs (7 Bestätigungs-Panels ohne Outside-Click-
// Schließen + 2 weitere UTC-Datumsstellen im Dispatch-Switch) + 2
// Verdachtsfälle. Beim Umsetzen zusätzlich entdeckt: ein in Runde 28
// diagnostizierter, aber nie tatsächlich gefixter UTC-Datums-Fund
// (_finish()s ONBOARDING_SEED-Startdatum) sowie 2 weitere unabhängige
// Instanzen desselben Musters (nextMonday(), measuredWeekStart) --
// alle im Zuge dieser Runde nachgeholt.

function mkEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: weight, prRepsAtMaxWeight: 8, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, skipReason: null, skipDate: null, substituteFor: null,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionCheckIn: null,
    sessionModifier: null, sessionModifierScope: null, exercises,
  };
}

async function seed(page, days) {
  const week = {
    id: 1, startDate: '2026-08-10', note: '', mode: 'standard',
    days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weekArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: {},
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      exerciseNotes: {}, customAlternatives: {},
    }));
  }, week);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('"Alle Daten löschen"-Bestätigungs-Panel schließt bei Klick daneben, statt sichtbar zu bleiben', async ({ page }) => {
  const unexpectedDialogs = [];
  page.on('dialog', d => { unexpectedDialogs.push(d.message()); d.dismiss(); });
  await seed(page, [mkDay(1, [mkEx('Kniebeuge', 60)])]);

  await page.click('[data-tab="settings"]');
  await page.click('[data-action="delete-all-data"]');
  await expect(page.locator('[data-action="confirm-delete-all-data"]')).toBeVisible();

  // Klick auf einen neutralen Bereich außerhalb des Panels (keine
  // data-action, keine Zugehörigkeit zu .js-confirm-panel).
  await page.locator('.settings-section__title').first().click();

  await expect(page.locator('[data-action="confirm-delete-all-data"]')).toHaveCount(0);

  // Daten müssen unangetastet geblieben sein.
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(state.weeks.length).toBe(1);
  expect(unexpectedDialogs, unexpectedDialogs.join('; ')).toHaveLength(0);
});

test('"Übung entfernen"-Bestätigungs-Panel schließt bei Klick daneben', async ({ page }) => {
  await seed(page, [mkDay(1, [mkEx('Kniebeuge', 60)])]);

  await page.click('.day-tab[data-day-hdr="0"]');
  await page.waitForTimeout(150);
  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await expect(page.locator('[data-action="remove-ex"][data-di="0"][data-ei="0"]')).toBeVisible();
  await page.click('[data-action="remove-ex"][data-di="0"][data-ei="0"]');
  await expect(page.locator('[data-action="confirm-remove-ex"]')).toBeVisible();

  await page.locator('.streak-row, .day-tab-pills-row, body').first().click({ position: { x: 5, y: 5 } });

  await expect(page.locator('[data-action="confirm-remove-ex"]')).toHaveCount(0);

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(state.weeks[0].days[0].exercises.length).toBe(1); // nicht entfernt
});

test('"Satz entfernen" verlangt jetzt eine Bestätigung (vorher ohne jede Rückfrage)', async ({ page }) => {
  await seed(page, [mkDay(1, [mkEx('Kniebeuge', 60)])]);

  let dialogSeen = false;
  page.on('dialog', d => { dialogSeen = true; d.dismiss(); }); // Abbrechen -> Satz bleibt

  await page.click('[data-action="remove-set"]');
  await page.waitForTimeout(200);

  expect(dialogSeen).toBe(true);
  const afterCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(afterCancel.weeks[0].days[0].exercises[0].sets.length).toBe(1);

  page.removeAllListeners('dialog');
  page.on('dialog', d => d.accept());
  await page.click('[data-action="remove-set"]');
  await page.waitForTimeout(200);

  const afterAccept = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(afterAccept.weeks[0].days[0].exercises[0].sets.length).toBe(0);
});
