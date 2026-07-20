import { test, expect } from '@playwright/test';

// B71: Share-Bild v2 — Übungsfortschritt-Sparkline als Herzstück des
// Wochenrückblick-Bilds (buildWeekShareCanvas() komplett neu aufgebaut,
// 4-Zonen-Layout). bestExercise wird in weekReviewModal.js ermittelt
// (PR-Highlight aus buildWeekReview() > höchstes Wochenvolumen), die
// Gewichtshistorie kommt aus exWeightHistory() (insightEngine.js).

test('buildWeekShareCanvas: mit >=3 Datenpunkten liefert Canvas ohne Fehler (Sparkline-Pfad)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const dims = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildWeekShareCanvas({
      kw: '29', monthYear: 'Juli 2026', streak: 4, doneDays: 3, totalDays: 4,
      successPct: 88, bestExercise: 'Kniebeuge', weights: [75, 80, 82.5, 85], isPr: true,
    });
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(dims).toEqual({ w: 1080, h: 1080 });
});

test('buildWeekShareCanvas: mit <3 Datenpunkten nutzt Fallback ohne Fehler', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const dims = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildWeekShareCanvas({
      kw: '29', monthYear: 'Juli 2026', streak: 1, doneDays: 1, totalDays: 1,
      successPct: 100, bestExercise: 'Kniebeuge', weights: [80], isPr: false,
    });
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(dims).toEqual({ w: 1080, h: 1080 });
});

test('buildWeekShareCanvas: sehr langer Übungsname bricht nicht (2-Zeilen-Umbruch)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const dims = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildWeekShareCanvas({
      kw: '29', monthYear: 'Juli 2026', streak: 2, doneDays: 2, totalDays: 3,
      successPct: 75, bestExercise: 'Bulgarische Split-Kniebeuge Langhantel',
      weights: [40, 42.5, 45], isPr: false,
    });
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(dims).toEqual({ w: 1080, h: 1080 });
});

test('Wochenrückblick-Teilen: echte Gewichtshistorie über 4 Wochen fließt in die Sparkline ein', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const mkWeek = (id, startDate, weight, markedDone) => ({
      id, startDate, note: '', mode: 'standard',
      days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: markedDone, markedDone, isVacation: false,
        sleepHours: null, energyLevel: null, sessionRating: null,
        exercises: [{
          name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
          sets: [{ weight, reps: 5, rpe: 8, status: 'success', done: true, note: '' }],
          prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
          nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
          progressionType: 'weight', archived: false,
        }] }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 3,
      weeks: [
        mkWeek(1, '2026-06-15', 75, true),
        mkWeek(2, '2026-06-22', 80, true),
        mkWeek(3, '2026-06-29', 82.5, true),
        mkWeek(4, '2026-07-06', 87.5, true), // aktuelle PR-Woche
      ],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 87.5, maxVolume: 437.5, maxEstimated1RM: 101.5, maxRepsAtMaxWeight: 5, date: '2026-07-06' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_share_consent', 'true'); // B73: hier nicht Testgegenstand
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('#wr-btn-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#wr-btn-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
