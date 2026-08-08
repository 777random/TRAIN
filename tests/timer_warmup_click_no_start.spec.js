import { test, expect } from '@playwright/test';

// Runde 18, Cluster 3: der Session-Timer startete bisher bereits durch einen
// bloßen Klick ins Aufwärm-Textfeld (train:warmup-click, ausgelöst vom
// 'click'-Listener in timer.js), ohne dass tatsächlich etwas eingegeben
// wurde. Das führte zu falschen (überhöhten) Session-Dauern, wenn Nutzer die
// App Stunden vor dem eigentlichen Training nur zum Nachsehen geöffnet
// hatten. Fix: die Session startet jetzt nur noch bei einer echten Eingabe
// (train:warmup-input, ausgelöst vom 'input'-Listener) — dieselbe Schwelle,
// die für die Gewichts-/Wdh-/RPE-Felder bereits galt.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkWeek() {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
        sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
        prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
        progressionType: 'weight', archived: false, substituteFor: null,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((week) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [week], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, mkWeek());
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readSessionStartTs(page) {
  return page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('train_v6'));
    return state.weeks[0].days[0].sessionStartTs ?? null;
  });
}

test('Aufwärmfeld: bloßer Klick/Fokus startet die Session NICHT', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('button.session-note-toggle[aria-label="Aufwärmen"]');
  const warmupField = page.locator('textarea[data-field="warmup"]');
  await expect(warmupField).toBeVisible();

  // Nur antippen/fokussieren, NICHT tippen.
  await warmupField.click();
  await page.waitForTimeout(200); // kurze Sicherheitsspanne, kein Dispatch erwartet

  expect(await readSessionStartTs(page)).toBeNull();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Aufwärmfeld: tatsächliches Tippen startet die Session weiterhin', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('button.session-note-toggle[aria-label="Aufwärmen"]');
  const warmupField = page.locator('textarea[data-field="warmup"]');
  await expect(warmupField).toBeVisible();

  await warmupField.fill('5 Min Rad, dynamisches Dehnen');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('train_v6'));
    return state.weeks[0].days[0].sessionStartTs != null;
  }, { timeout: 5000 });

  expect(await readSessionStartTs(page)).not.toBeNull();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Gewichtsfeld-Eingabe startet die Session weiterhin unverändert (Regressions-Check)', async ({ page }) => {
  await seed(page);
  const weightField = page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]');
  await weightField.fill('62.5');
  await page.waitForFunction(() => {
    const state = JSON.parse(localStorage.getItem('train_v6'));
    return state.weeks[0].days[0].sessionStartTs != null;
  }, { timeout: 5000 });

  expect(await readSessionStartTs(page)).not.toBeNull();
});
