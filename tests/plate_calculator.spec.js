import { test, expect } from '@playwright/test';

// B130: der bei B126 (train-v218) falsch herum gebaute Hantelscheiben-
// Rechner (Scheiben antippen -> Gesamtgewicht) wurde entfernt. Die bereits
// vorhandene, korrekte Umkehr-Berechnung (Zielgewicht -> Scheiben-
// Kombination, calcPlates()) wird stattdessen prominent als Chip-Reihe
// direkt unter dem Gewichts-Feld angezeigt -- ein Chip pro tatsächlich
// benötigter Einzel-Scheibe, "pro Seite"-Label, "Stange Xkg"-Zeile,
// "≈ Xkg möglich"-Hinweis wenn das Zielgewicht nicht exakt auflegbar ist
// (kleinste Scheibe 1.25kg -> jedes Vielfache von 1.25kg pro Seite ist
// erreichbar, es wird auf das nächste erreichbare Vielfache abgerundet).

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 0, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null, showPlates: true,
    ...overrides,
  };
}

function mkWeek(ex) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [ex],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, ex, barbellWeight = 20) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, barbellWeight }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true, barbellWeight },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weekArg: mkWeek(ex), barbellWeight });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('90kg / 20kg-Stange: Chips [25kg][10kg], "pro Seite" + "Stange 20kg"', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));

  const row = page.locator('.plate-chips-row');
  await expect(row).toBeVisible();
  const chips = row.locator('.plate-chip');
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).toHaveText('25kg');
  await expect(chips.nth(1)).toHaveText('10kg');
  await expect(row.locator('.plate-chips__label')).toHaveText('pro Seite');
  await expect(row.locator('.plate-chips__bar')).toHaveText('Stange 20kg');
  await expect(row.locator('.plate-chips__approx')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('100kg / 20kg-Stange: Chips [25kg][15kg]', async ({ page }) => {
  await seed(page, mkEx('Kniebeuge', { sets: [{ weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' }] }));

  const chips = page.locator('.plate-chips-row .plate-chip');
  await expect(chips).toHaveCount(2);
  await expect(chips.nth(0)).toHaveText('25kg');
  await expect(chips.nth(1)).toHaveText('15kg');
});

test('83kg / 20kg-Stange: nicht exakt auflegbar -> Chips für 82.5kg + "≈ 82.5kg möglich"', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 83, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));

  const row = page.locator('.plate-chips-row');
  const chips = row.locator('.plate-chip');
  await expect(chips).toHaveCount(3);
  await expect(chips.nth(0)).toHaveText('25kg');
  await expect(chips.nth(1)).toHaveText('5kg');
  await expect(chips.nth(2)).toHaveText('1.25kg');
  await expect(row.locator('.plate-chips__approx')).toHaveText('≈ 82.5kg möglich');
});

test('Scheiben-Toggle aus (ex.showPlates=false) -> keine Anzeige', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', {
    showPlates: false,
    sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
  }));
  await expect(page.locator('.plate-chips-row')).toHaveCount(0);
});

test('Gewicht <= Stangengewicht -> keine Anzeige', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 20, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }), 20);
  await expect(page.locator('.plate-chips-row')).toHaveCount(0);
});

test('Distanz-/Zeit-Übung (metric m/sec) -> keine Anzeige, auch mit showPlates=true', async ({ page }) => {
  await seed(page, mkEx('Sprint', {
    metric: 'm',
    sets: [{ weight: 90, reps: 0, rpe: null, status: 'pending', done: false, note: '' }],
  }));
  await expect(page.locator('.plate-chips-row')).toHaveCount(0);
});

test('B126 vollständig entfernt: kein ⚖-Button, kein Chip-Tap-Panel mehr im DOM', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));
  await expect(page.locator('[data-action="toggle-plate-calc"]')).toHaveCount(0);
  await expect(page.locator('[data-action="plate-calc-add"]')).toHaveCount(0);
  await expect(page.locator('[data-action="plate-calc-apply"]')).toHaveCount(0);
  await expect(page.locator('[data-action="plate-calc-perside"]')).toHaveCount(0);
  await expect(page.locator('.plate-calc-panel')).toHaveCount(0);
});
