import { test, expect } from '@playwright/test';

// B102: Intra-Session-Feedback (.set-feedback) hatte auf Laptop-Breite
// gefühlt zu viel Abstand nach oben zum gerade bewerteten Satz.
// Prüft den tatsächlichen Pixel-Abstand zwischen Unterkante .set-row und
// Oberkante .set-feedback bei Desktop (1280px) und Mobile (375px).

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkWeek() {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
      sessionCheckIn: { sleep: 'good', energyPre: 'medium', timestamp: Date.now() }, sessionModifier: 'normal',
      exercises: [{
        name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [
          { weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
          { weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
          { weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
        ],
        prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 3, targetReps: 5,
        progressionType: 'weight', archived: false,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weekArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg],
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer: true, rpeEnabled: true },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: Date.now(), plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, mkWeek());
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function measureGap(page) {
  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="0"][data-val="6"]');
  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.waitForTimeout(500);

  const row = page.locator('.set-row[data-di="0"][data-ei="0"][data-si="0"]');
  const fb = page.locator('.set-feedback[data-di="0"][data-ei="0"][data-si="0"]');
  await expect(fb).toBeVisible();
  const rowBox = await row.boundingBox();
  const fbBox = await fb.boundingBox();
  return { gap: fbBox.y - (rowBox.y + rowBox.height), rowBox, fbBox };
}

for (const [name, viewport] of [['Desktop', { width: 1280, height: 900 }], ['Mobile', { width: 375, height: 667 }]]) {
  test(`${name} (${viewport.width}px): Abstand .set-row -> .set-feedback ist minimal (< 16px), kein Überlapp`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await seed(page);

    const { gap } = await measureGap(page);
    expect(gap, `Gemessener Abstand: ${gap}px`).toBeGreaterThanOrEqual(0); // AC3: kein Überlapp
    expect(gap, `Gemessener Abstand: ${gap}px`).toBeLessThan(16); // AC1/AC2: direkt unter dem Satz

    expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  });
}
