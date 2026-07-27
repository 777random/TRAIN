import { test, expect } from '@playwright/test';

// B126: Hantelscheiben-Rechner. Ein ⚖-Button neben dem Gewichts-Input jedes
// Satzes öffnet ein Inline-Panel direkt unter der Set-Row: Scheiben-Chips
// addieren 2x ihr Gewicht (beide Seiten der Stange) zu einem laufenden
// Gesamt, ein "pro Seite eingeben"-Feld rechnet umgekehrt und übernimmt
// sofort, "Übernehmen" schreibt das Gesamtgewicht ins Gewichtsfeld. Nutzt
// dieselbe Stange+2x-Konvention wie das bestehende calcPlates() (plate-hint),
// liest aber state.settings.barbellWeight statt eines hartkodierten Defaults
// -- ein Nebenfund war, dass der bestehende plate-hint calcPlates() bisher
// ohne barKg-Argument aufrief und daher IMMER 20kg annahm.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 0, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null, showPlates: false,
  };
}

function mkWeek() {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [mkEx('Bankdrücken')],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, barbellWeight) {
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
  }, { weekArg: mkWeek(), barbellWeight });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('⚖-Button öffnet den Rechner, Scheiben-Chips addieren korrekt (2x pro Tap)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, 20);

  await page.click('[data-action="toggle-plate-calc"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(page.locator('.plate-calc-panel')).toBeVisible();
  await expect(page.locator('.plate-calc-bar')).toHaveText('Stangengewicht: 20 kg');
  await expect(page.locator('.plate-calc-total')).toHaveText('Gesamt: 20 kg');

  await page.click('[data-action="plate-calc-add"][data-weight="20"]');
  await page.click('[data-action="plate-calc-add"][data-weight="5"]');
  // 20 (Stange) + 2x20 + 2x5 = 70
  await expect(page.locator('.plate-calc-total')).toHaveText('Gesamt: 70 kg');
  await expect(page.locator('.plate-calc-breakdown')).toHaveText('+ 2× 20kg + 2× 5kg');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('"Übernehmen" schreibt das berechnete Gesamtgewicht ins Gewichtsfeld', async ({ page }) => {
  await seed(page, 20);
  await page.click('[data-action="toggle-plate-calc"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="plate-calc-add"][data-weight="10"]');
  await page.click('[data-action="plate-calc-add"][data-weight="2.5"]');
  // 20 + 2x10 + 2x2.5 = 45
  await page.click('[data-action="plate-calc-apply"]');
  await expect(page.locator('.plate-calc-panel')).toHaveCount(0);
  await expect(page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]')).toHaveValue('45');
});

test('Pro-Seite-Eingabe berechnet Gesamt korrekt und übernimmt sofort', async ({ page }) => {
  await seed(page, 20);
  await page.click('[data-action="toggle-plate-calc"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.fill('[data-action="plate-calc-perside"]', '30');
  await page.locator('[data-action="plate-calc-perside"]').blur();
  // 20 + 2x30 = 80
  await expect(page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]')).toHaveValue('80');
});

test('Rechner nutzt state.settings.barbellWeight statt hartkodiertem 20kg-Default', async ({ page }) => {
  await seed(page, 15);
  await page.click('[data-action="toggle-plate-calc"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(page.locator('.plate-calc-bar')).toHaveText('Stangengewicht: 15 kg');
  await expect(page.locator('.plate-calc-total')).toHaveText('Gesamt: 15 kg');

  await page.click('[data-action="plate-calc-add"][data-weight="20"]');
  // 15 + 2x20 = 55
  await expect(page.locator('.plate-calc-total')).toHaveText('Gesamt: 55 kg');
});

test('Panel schließt sich bei Klick außerhalb', async ({ page }) => {
  await seed(page, 20);
  await page.click('[data-action="toggle-plate-calc"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(page.locator('.plate-calc-panel')).toBeVisible();

  await page.mouse.click(5, 5);
  await expect(page.locator('.plate-calc-panel')).toHaveCount(0);
});
