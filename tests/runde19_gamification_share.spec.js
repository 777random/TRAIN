import { test, expect } from '@playwright/test';

// Runde 19, Cluster 10 + 11 (Live-Nutzerfeedback 2026-08-08).
// Cluster 10: Streak-Dots-Kette (_renderStreakChain) + Abzeichen-Galerie
// (_renderBadgeGallery) vollständig entfernt (train-v150 begonnenes
// Gamification-Cleanup zu Ende geführt) — neutrale Streak-ZAHL bleibt.
// Cluster 11: Wochenrückblick-Share bietet jetzt "Beste Übung" (bisher)
// UND "Zusammenfassung" (neu, buildWeekSummaryShareCanvas()) als getrennte
// Optionen an, sowohl im Wochenwechsel-Modal als auch im manuellen
// Wochenrückblick-Dropdown (Fortschritt-Tab).

function mkWeek(id, startDate, weight) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
      sleepHours: 7, energyLevel: 4, sessionRating: 2,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '', prBadge: weight >= 80 ? 'weight' : undefined }],
        prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', archived: false,
      }] }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seedTwoWeeks(page) {
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: [], customTemplate: [], settings: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  });
}

test('Cluster 10: Abzeichen-Galerie und Streak-Dots-Kette sind aus dem Fortschritt-Tab entfernt, Streak-Zahl bleibt sichtbar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedTwoWeeks(page);
  await page.evaluate(() => {
    const mk = (id, startDate, weight) => ({
      id, startDate, note: '', mode: 'standard',
      days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
        sleepHours: 7, energyLevel: 4, sessionRating: 2,
        exercises: [{ name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
          sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
          prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
          nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
          progressionType: 'weight', archived: false }] }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
    // 12 aufeinanderfolgende Wochen -> lange Streak, würde vorher nur 8
    // Dots zeigen (last8-Deckel in _renderStreakChain).
    const weeks = [];
    const monday = new Date(); monday.setDate(monday.getDate() - monday.getDay() + 1 - 12 * 7);
    for (let i = 0; i < 12; i++) {
      const d = new Date(monday); d.setDate(d.getDate() + i * 7);
      weeks.push(mk(i + 1, d.toISOString().slice(0, 10), 70 + i));
    }
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() }, curIdx: weeks.length - 1,
      weeks, customTemplate: [], settings: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('.streak-row', { timeout: 5000 });

  await expect(page.locator('.badge-gallery')).toHaveCount(0);
  await expect(page.locator('.streak-chain-wrap')).toHaveCount(0);
  await expect(page.locator('.streak-card').first()).toBeVisible();
  const streakText = await page.locator('.streak-row').innerText();
  expect(streakText).toContain('12');
  // .streak-lbl hat CSS text-transform:uppercase -- innerText() spiegelt das
  // gerenderte Ergebnis, nicht den Quelltext -- case-insensitiv prüfen.
  expect(streakText.toLowerCase()).toContain('wochen');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Cluster 11: buildWeekSummaryShareCanvas liefert ein 1080x1080-Canvas mit Highlights, auch ohne Highlights kein Absturz', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const withHighlights = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildWeekSummaryShareCanvas({
      kw: '32', monthYear: 'August 2026', streak: 3, doneDays: 2, totalDays: 3,
      successPct: 88,
      highlights: [
        { label: 'Neuer PR', text: 'Kniebeuge 100kg' },
        { label: 'Konsistenz', text: '3 Wochen in Folge' },
      ],
    });
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(withHighlights).toEqual({ w: 1080, h: 1080 });

  const withoutHighlights = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildWeekSummaryShareCanvas({
      kw: '32', monthYear: 'August 2026', streak: 0, doneDays: 0, totalDays: 1,
      successPct: null, highlights: [],
    });
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(withoutHighlights).toEqual({ w: 1080, h: 1080 });
});

test('Cluster 11: Wochenrückblick-Dropdown bietet beide Share-Optionen, jede löst einen eigenen PNG-Download aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const mkW = (id, startDate, weight) => ({
      id, startDate, note: '', mode: 'standard',
      days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
        sleepHours: 7, energyLevel: 4, sessionRating: 2,
        exercises: [{ name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
          sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
          prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
          nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
          progressionType: 'weight', archived: false }] }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: [mkW(1, '2026-06-22', 75), mkW(2, '2026-06-29', 80)],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 80, maxVolume: 400, maxEstimated1RM: 93, maxRepsAtMaxWeight: 5, date: '2026-06-29' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_share_consent', 'true');
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });
  await page.waitForSelector('#week-review-inline-share-summary', { timeout: 5000 });

  const [downloadBest] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share'),
  ]);
  expect(downloadBest.suggestedFilename()).toBe('train-woche.png');

  const [downloadSummary] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share-summary'),
  ]);
  expect(downloadSummary.suggestedFilename()).toBe('train-woche.png');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
