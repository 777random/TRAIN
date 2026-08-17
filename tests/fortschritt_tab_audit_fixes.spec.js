import { test, expect } from '@playwright/test';

// Runde 27 (Fortschritt-Tab-Audit): 4 parallele Diagnose-Agenten fanden 10
// bestätigte Bugs + 6 Verdachtsfälle + 1 toten-Code-Fund. Dieser Test deckt
// die wichtigsten, bisher nicht abgesicherten Fixes ab (Startwerte-Woche
// wurde an mehreren unabhängigen Stellen im Fortschritt-Tab fälschlich als
// echte Trainingswoche gewertet).

function mkEx(name, opts = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, skipReason: null, skipDate: null, substituteFor: null,
    ...opts,
  };
}

function mkDay(id, exercises, opts = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises,
    ...opts,
  };
}

function mkWeek(id, startDate, days, isSeedWeek = false) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek };
}

async function seed(page, weeks, curIdx, extra = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, curIdxArg, extraArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: curIdxArg, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: {},
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      exerciseNotes: {}, customAlternatives: {},
      ...extraArg,
    }));
  }, { weeksArg: weeks, curIdxArg: curIdx, extraArg: extra });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Wochenrückblick-Dropdown listet die Startwerte-Woche nicht als reviewbare Woche', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-07-01', [mkDay(1, [mkEx('Kniebeuge')])], true);
  const realWeek = mkWeek(1, '2026-08-10', [mkDay(2, [mkEx('Kniebeuge')])], false);
  await seed(page, [seedWeek, realWeek], 1);
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-select', { timeout: 5000 });
  const optionCount = await page.locator('#week-review-select option').count();
  expect(optionCount).toBe(1);
});

test('"Neue Woche"-Button zeigt bei reinem Onboarding-Nutzer nicht den fabrizierten Wochenrückblick', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-08-10', [mkDay(1, [mkEx('Kniebeuge')])], true);
  await seed(page, [seedWeek], 0);
  await page.click('[data-action="open-new-week"]');
  await page.waitForTimeout(300);
  await expect(page.locator('#modal-new-week')).toHaveClass(/is-open/);
  // Das Wochenrückblick-Modal wird nur bei tatsächlichem Aufruf von
  // showWeekReviewModal() dynamisch ins DOM eingefügt -- ganz fehlend ist
  // hier also der korrekte (gefixte) Zustand.
  await expect(page.locator('#modal-week-review')).toHaveCount(0);
});

test('"Ø Erfolg"- und "Wochen"-Badge schließen die Startwerte-Woche aus', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-07-01', [mkDay(1, [mkEx('Kniebeuge')])], true); // 1 success = 100%
  const realWeek = mkWeek(1, '2026-08-10', [mkDay(2, [mkEx('Kniebeuge', {
    sets: [
      { weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' },
      { weight: 60, reps: 8, rpe: 9, status: 'fail', done: true, note: '' },
    ],
  })])], false); // 1 success + 1 fail = 50%
  await seed(page, [seedWeek, realWeek], 1);
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('.streak-row', { timeout: 5000 });

  const avgScoreText = await page.locator('[data-metric="avg-score"] .streak-num').textContent();
  expect(avgScoreText.trim()).toBe('50%');

  const weeksBadgeText = await page.locator('.streak-row .streak-card').nth(2).locator('.streak-num').textContent();
  expect(weeksBadgeText.trim()).toBe('1');
});

test('Bestleistungen-Karte zeigt nicht den PR aus der Startwerte-Woche', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-07-01', [mkDay(1, [mkEx('Kniebeuge', {
    sets: [{ weight: 100, reps: 5, rpe: null, status: 'success', done: true, note: '' }],
  })])], true);
  const realWeek = mkWeek(1, '2026-08-10', [mkDay(2, [mkEx('Kniebeuge', {
    sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
  })])], false);
  await seed(page, [seedWeek, realWeek], 1);
  await page.click('[data-tab="progress"]');
  // .pr-val liegt bei einer nicht-favorisierten Übung in einem kollabierten
  // <details>-Element (unsichtbar per Default) -- state:'attached' statt
  // dem Standard 'visible' warten.
  await page.waitForSelector('.pr-val', { state: 'attached', timeout: 5000 });
  const prText = await page.locator('.pr-val').first().textContent();
  expect(prText.trim()).toBe('60 kg');
});

test('Bewegungsmuster-Karte schließt die Startwerte-Woche aus der Kategorie-Verteilung aus', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-07-01', [mkDay(1, [mkEx('Bankdrücken')])], true); // Push
  const realWeek = mkWeek(1, '2026-08-10', [mkDay(2, [mkEx('Kniebeuge')])], false); // Squat
  await seed(page, [seedWeek, realWeek], 1);
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('.mg-bar-row', { timeout: 5000 });
  const rows = page.locator('.mg-bar-row');
  const pushVal  = await rows.nth(0).locator('.mg-bar-val').textContent(); // RADAR_CATS[0] = Push
  const squatVal = await rows.nth(2).locator('.mg-bar-val').textContent(); // RADAR_CATS[2] = Squat
  expect(pushVal.trim()).toBe('—');
  expect(squatVal.trim()).toBe('100%');
});

test('Hauptchart "Übungsfortschritt" zeigt die Startwerte-Woche nicht als Datenpunkt', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-07-01', [mkDay(1, [mkEx('Kniebeuge', {
    sets: [{ weight: 60, reps: 5, rpe: null, status: 'success', done: true, note: '' }],
  })])], true);
  const realWeek = mkWeek(1, '2026-08-10', [mkDay(2, [mkEx('Kniebeuge', {
    sets: [{ weight: 65, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
  })])], false);
  await seed(page, [seedWeek, realWeek], 1);
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#chart-ex-select', { timeout: 5000 });
  const hint = page.getByText('Wähle eine Übung und trainiere mindestens 2 Wochen um den Verlauf zu sehen.');
  await expect(hint).toBeVisible({ timeout: 5000 });
});

test('Wochenrückblick: "Saubere Ausführung"-Highlight bekommt eine spezifische Empfehlung statt generischem Fallback', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const week = mkWeek(0, '2026-08-10', [mkDay(1, [mkEx('Klimmzüge', {
    metric: 'reps',
    sets: [
      { weight: 0, reps: 10, rpe: null, status: 'success', done: true, note: '' },
      { weight: 0, reps: 10, rpe: null, status: 'success', done: true, note: '' },
      { weight: 0, reps: 10, rpe: null, status: 'success', done: true, note: '' },
    ],
  })])], false);

  const recs = await page.evaluate(async ({ weekArg }) => {
    const mod = await import('./weekReview.js');
    const r = mod.buildWeekReview(weekArg, [weekArg], []);
    return { h0type: r.highlights[0]?.type, rec0: r.recommendations[0]?.text };
  }, { weekArg: week });

  expect(recs.h0type).toBe('perfect');
  expect(recs.rec0).toContain('Klimmzüge');
  expect(recs.rec0).not.toContain('Konsistenz ist der Schlüssel');
});
