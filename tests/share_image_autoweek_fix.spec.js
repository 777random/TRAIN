import { test, expect } from '@playwright/test';

// B72: _runAutoWeekFlow() (ui.js) nahm bisher blind sorted[length-2] als
// "die Vorwoche" an. Reproduziert und bestätigt: eine manuell vorausgeplante
// Woche mit ZUKÜNFTIGEM startDate (z.B. "Neue Woche" mit frei wählbarem
// Datum) sortiert sich zwischen die echte letzte Trainingswoche und die
// soeben automatisch erstellte aktuelle Woche ein — sorted[length-2] traf
// dann die leere, vorausgeplante Woche statt der echten Vorwoche. Ergebnis
// im Wochenrückblick-Popup: "0 Wochen · 0 Sätze · 0/0 Tage", kein PR, keine
// Sparkline (Fallback), obwohl echte Trainingshistorie existiert.
// Fix: rückwärts nach der letzten Woche MIT mindestens einem markedDone-Tag
// suchen, statt positional zu raten.

function mondayOffset(weeksFromNow) {
  const d = new Date();
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday + weeksFromNow * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function realDay(id, weight) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: 7, energyLevel: 4, sessionRating: 2,
    exercises: [{
      name: 'Kniebeuge', archived: false, weightStep: 5, metric: 'reps',
      progressionMode: 'weight_first', targetRepsMax: null,
      nextWeekPlan: 0, nextWeekPlanConfirmed: false,
      sets: [
        { weight, reps: 5, status: 'success', done: true, rpe: 7 },
        { weight, reps: 5, status: 'success', done: true, rpe: 7 },
      ],
    }],
  };
}

function emptyDay(id) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    exercises: [],
  };
}

test('Auto-Wochenrückblick zeigt die echte letzte Trainingswoche, nicht eine leere vorausgeplante Zukunftswoche', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const weeks = [
    { id: 1, startDate: mondayOffset(-2), note: '', mode: 'standard', days: [realDay(11, 75)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 2, startDate: mondayOffset(-1), note: '', mode: 'standard', days: [realDay(21, 80)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 3, startDate: mondayOffset(1),  note: '', mode: 'standard', days: [emptyDay(31)],   sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }, // vorausgeplant, leer
  ];

  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: true, showReview: true, suggestProgress: false } },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.waitForSelector('.wr-modal', { timeout: 6000 });
  const summaryText = await page.locator('.wr-metrics-row').innerText();

  // Die echte Vorwoche (mondayOffset(-1)) hatte 1 markedDone-Tag, 1 Satzpaar
  // erfolgreich, kein "0/0". Die leere Zukunftswoche darf NICHT gezeigt werden.
  expect(summaryText).not.toContain('0/0 Tage');
  expect(summaryText).toContain('1/1 Tage');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Wochenrückblick-Dropdown (Fortschritt-Tab): Teilen-Button vorhanden und löst PNG-Download aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const mkWeek = (id, startDate, weight) => ({
      id, startDate, note: '', mode: 'standard',
      days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
        sleepHours: 7, energyLevel: 4, sessionRating: 2,
        exercises: [{
          name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
          sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
          prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
          nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
          progressionType: 'weight', archived: false,
        }] }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: [mkWeek(1, '2026-06-22', 75), mkWeek(2, '2026-06-29', 80)],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 80, maxVolume: 400, maxEstimated1RM: 93, maxRepsAtMaxWeight: 5, date: '2026-06-29' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
