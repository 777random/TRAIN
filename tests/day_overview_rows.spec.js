import { test, expect } from '@playwright/test';

// Runde 19, Cluster 8 (Teil 1 von 2 -- nur die Zeilen-Umstellung, der
// Default-Ansicht-Teil wurde nach Diagnose bewusst zurückgestellt, siehe
// HANDOFF.md). Tage-Übersicht (.day-overview-grid/-card) von Kacheln-Grid
// auf volle-Breite-Zeilen umgestellt. Kein bestehender Test deckte den
// manuellen Übersicht-Toggle ab -- neu ergänzt.

function mkEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
    progressionType: 'weight', archived: false,
  };
}

function mkDay(id, title, markedDone) {
  return {
    id, title, subtitle: 'Testtag', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    exercises: [mkEx('Kniebeuge', 80)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('Übersicht-Toggle: Tage werden als volle-Breite-Zeilen dargestellt (nicht mehr als Grid-Kacheln), Tap öffnet den Tag', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{ id: 1, startDate: new Date().toISOString().slice(0, 10), note: '', mode: 'standard',
        days: [
          { id: 1, title: 'Tag A', subtitle: 'Testtag', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false,
            exercises: [{ name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
              sets: [{ weight: 80, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
              prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
              nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
              progressionType: 'weight', archived: false }],
            sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
          { id: 2, title: 'Tag B', subtitle: 'Testtag', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false,
            exercises: [], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
        ],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: {},
      favoriteExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Default bleibt unverändert: Tag A ist bereits offen (kein Übersicht-Grid im DOM).
  await expect(page.locator('.day-overview-grid')).toHaveCount(0);

  await page.click('[data-action="toggle-overview"]');
  const grid = page.locator('.day-overview-grid');
  await expect(grid).toBeVisible();

  const cards = page.locator('.day-overview-card');
  await expect(cards).toHaveCount(2);

  // Zeilen-Layout: Karte ist deutlich breiter als hoch (volle Breite statt
  // schmaler Grid-Kachel) -- Regressionsschutz gegen ein versehentliches
  // Zurückfallen auf das alte Mehrspalten-Grid.
  const box = await cards.first().boundingBox();
  expect(box.width).toBeGreaterThan(box.height * 2);

  // Inhalte weiterhin vorhanden (Titel, Sätze, Fortschrittsbalken).
  await expect(cards.first()).toContainText('Tag A');
  await expect(cards.first()).toContainText('Sätze');
  await expect(cards.first().locator('.day-overview-card__bar')).toBeVisible();

  // Tap auf eine Zeile öffnet weiterhin den jeweiligen Tag.
  await cards.nth(1).click();
  await expect(page.locator('.day-overview-grid')).toHaveCount(0);
  await expect(page.locator('#day-panel-1')).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
