import { test, expect } from '@playwright/test';

// Runde 8 (Cluster 3): das manuelle Anpassen einer Steigerungsempfehlung
// erforderte bisher einen Doppel-Tap auf den "+kg"-Button (Nutzerfeedback:
// unintuitiv, kollidiert auf Touch-Geräten gedanklich mit Zoom-Gesten,
// Editierbarkeit war nicht sichtbar). Fix: ein Tap öffnet den Picker direkt,
// dessen Chip-Werte werden jetzt aus getEffectiveWeightStep() (B167)
// abgeleitet statt einer hartcodierten Liste.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 5, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
  };
}

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((ex) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: new Date().toISOString().split('T')[0], note: '', mode: 'standard',
        days: [{
          id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null,
          exercises: [ex], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      onboardingDone: true, customTemplate: [], favoriteExercises: [], customExercises: [],
      settings: { sessionCoach: false, rpeEnabled: true },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-01', 'tip-11'],
    }));
  }, mkEx('Bankdrücken'));
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Ein Tap auf "+kg" öffnet den Picker direkt (kein Doppel-Tap mehr nötig)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="inc-weight"][data-di="0"][data-ei="0"]');
  await expect(page.locator('.ex-kg-picker')).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Picker-Chips leiten sich aus getEffectiveWeightStep() + aktuellem Plan ab', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page); // weightStep=2.5, nextWeekPlan=5 -> erwartete Chips: 0, 2.5, 5, 7.5, 10

  await page.click('[data-action="inc-weight"][data-di="0"][data-ei="0"]');
  const chipTexts = await page.locator('.ex-kg-picker-btn:not(.ex-kg-picker-btn--other)').allTextContents();
  expect(chipTexts).toEqual(['0', '+2.5', '+5', '+7.5', '+10']);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Chip-Tap übernimmt sofort und schließt den Picker (kein zweiter Klick)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="inc-weight"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="kg-picker-select"][data-di="0"][data-ei="0"][data-value="7.5"]');

  await expect(page.locator('.ex-kg-picker')).toBeHidden();
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(7.5);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Freitext-Pfad ("Anderer Wert") funktioniert weiterhin', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="inc-weight"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="kg-picker-show-custom"][data-di="0"][data-ei="0"]');
  await page.fill('#kg-picker-custom-input', '13.5');
  await page.click('[data-action="kg-picker-custom-confirm"][data-di="0"][data-ei="0"]');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.nextWeekPlan).toBe(13.5);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
