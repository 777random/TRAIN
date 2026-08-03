import { test, expect } from '@playwright/test';

// Runde 10/Teil 2/Cluster 5: einmaliger Hinweis-Toast auf die B185-
// Rückwirkung (Konsistenz-%-Neuberechnung, siehe DECISIONS.md) beim ersten
// Fortschritt-Tab-Besuch nach dem Update. Nutzt das bestehende
// seenTips/MARK_TIP_SEEN-Muster (_maybeShowTip(), ui.js) — kein neues
// Infrastruktur-Stück, kein CACHE_VERSION-Vergleich nötig.

function mkWeek(id, startDate) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{
      id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null, sessionRating: null,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps',
        sets: [{ weight: 80, reps: 5, rpe: null, status: 'success', done: true }],
        weightStep: 5, nextWeekPlan: 0, nextWeekPlanConfirmed: false,
        targetReps: 5, progressionType: 'weight', archived: false, substituteFor: null,
        prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
        progressionMode: 'weight_first', targetRepsMax: null,
      }],
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function baseState(overrides = {}) {
  return {
    meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
    curIdx: 0, weeks: [mkWeek(1, '2026-01-05')],
    onboardingDone: true,
    customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true }, prs: {},
    favoriteExercises: [], customExercises: [],
    coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
    lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
    longestStreakEver: 0, seenTips: [],
    ...overrides,
  };
}

async function seed(page, state) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((s) => localStorage.setItem('train_v6', JSON.stringify(s)), state);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Fortschritt-Tab zeigt den Konsistenz-Hinweis beim ersten Besuch (Happy Path)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page, baseState());
  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(300);

  await expect(page.locator('.tip-banner')).toHaveText(/Konsistenz-Berechnung leicht korrigiert/);

  const seenTips = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).seenTips);
  expect(seenTips).toContain('tip-13');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Hinweis erscheint nach dem ersten Mal nicht erneut (persistent, kein Reload-Reset)', async ({ page }) => {
  await seed(page, baseState({ seenTips: ['tip-13'] }));
  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(300);

  await expect(page.locator('.tip-banner')).toHaveCount(0);
});

test('Kein Hinweis ohne abgeschlossene Trainingshistorie (frischer Onboarding-Nutzer)', async ({ page }) => {
  const emptyWeek = { ...mkWeek(1, '2026-01-05'), days: [{ ...mkWeek(1, '2026-01-05').days[0], markedDone: false }] };
  await seed(page, baseState({ weeks: [emptyWeek] }));
  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(300);

  await expect(page.locator('.tip-banner')).toHaveCount(0);

  const seenTips = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).seenTips);
  expect(seenTips).not.toContain('tip-13');
});
