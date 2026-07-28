import { test, expect } from '@playwright/test';

// B138 (Sprint 2026-07, Option C): kuratierte Alternativ-Chips im "Heute
// anders"-Dialog, ergänzend zur bestehenden historienbasierten
// sub-suggestions-Liste (D2, siehe heute_anders_history.spec.js).

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkWeek(exName, exOverrides = {}) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [{
        name: exName, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
        prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
        progressionType: 'weight', archived: false, substituteFor: null,
        ...exOverrides,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { week, customAlternatives = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, customAlternatives }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'], substituteHistory: {}, customAlternatives,
    }));
  }, { weekArg: week, customAlternatives });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function openSubForm(page, di = 0, ei = 0) {
  await page.click(`[data-action="toggle-ex-menu"][data-di="${di}"][data-ei="${ei}"]`);
  await page.click(`[data-action="open-sub-form"][data-di="${di}"][data-ei="${ei}"]`);
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('AC1: bekannte Uebung zeigt Vorschlags-Chips', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { week: mkWeek('Kniebeuge') });
  await openSubForm(page);
  const chips = page.locator('.alt-chip');
  await expect(chips).toHaveCount(5); // Bulgarian Split Squat, Goblet Squat, Hack Squat, Box Squat, Leg Press
  await expect(chips.first()).toHaveText('Bulgarian Split Squat');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC2: Chip tippen -> sofort uebernommen (ex.name + substituteFor gesetzt)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { week: mkWeek('Kniebeuge') });
  await openSubForm(page);
  await page.click('.alt-chip[data-suggested="Bulgarian Split Squat"]');
  const st = await readState(page);
  const ex = st.weeks[0].days[0].exercises[0];
  expect(ex.name).toBe('Bulgarian Split Squat');
  expect(ex.substituteFor).toBe('Kniebeuge');
  await expect(page.locator('.sub-form')).toHaveCount(0); // Dialog schliesst
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC3: freie Eingabe + Speichern -> customAlternatives aktualisiert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { week: mkWeek('Kniebeuge') });
  await openSubForm(page);
  await expect(page.locator('.save-alt-btn')).toBeHidden();
  await page.fill('.sub-name-input[data-di="0"][data-ei="0"]', 'Zercher Squat');
  await expect(page.locator('.save-alt-btn')).toBeVisible();
  await expect(page.locator('.save-alt-btn')).toContainText('Kniebeuge');
  await page.click('.save-alt-btn');
  const st = await readState(page);
  expect(st.customAlternatives['Kniebeuge']).toEqual(['Zercher Squat']);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC4: eigene Alternative erscheint beim naechsten Mal als erster Chip', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { week: mkWeek('Kniebeuge'), customAlternatives: { 'Kniebeuge': ['Zercher Squat'] } });
  await openSubForm(page);
  const chips = page.locator('.alt-chip');
  await expect(chips.first()).toHaveText('Zercher Squat');
  await expect(chips).toHaveCount(6); // 1 eigene + 5 vordefinierte, dedupliziert
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('AC5: unbekannte Uebung -> nur Eingabefeld, kein Fehler', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { week: mkWeek('Ganz Unbekannte Uebung XYZ') });
  await openSubForm(page);
  await expect(page.locator('.alt-chip')).toHaveCount(0);
  await expect(page.locator('.alt-chips-block')).toHaveCount(0);
  await expect(page.locator('.sub-name-input')).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
