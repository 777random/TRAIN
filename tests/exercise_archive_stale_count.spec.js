import { test, expect } from '@playwright/test';

// Runde 8, Cluster 0: _getDayCompletionStats() (ui.js) zählte archivierte
// Übungen weiterhin in totalSets/effortTarget mit, obwohl die Live-
// Progress-Bar sie bereits korrekt ausschließt (ex.archived-Filter,
// analog zu den ~11 anderen Stellen im Code). Fix: `if (ex.archived)
// continue;` in beiden Zählschleifen ergänzt.

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, reps, status) {
  return { weight, reps, rpe: null, status, done: status === 'success', note: '', prBadge: null };
}

function mkEx({ name, sets, targetReps = 8, archived = false }) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
    sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived,
  };
}

function mkDay({ exercises }) {
  return {
    id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, day) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((dayArg) => {
    const week = {
      id: 1, startDate: new Date().toISOString().split('T')[0], note: '', mode: 'standard',
      days: [dayArg], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    };
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [week], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, day);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Tagesabschluss zählt eine archivierte Übung nicht mehr in Soll-Satzzahl/Erfolgsquote mit', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // Archivierte Übung: 2 fail (0 Wdh erreicht) + 2 noch-pending Sätze --
  // bewusst NICHT alle pending, damit die Skip-Grund-Abfrage (B129, prüft
  // "alle Sätze noch pending") für diese Übung nicht separat aufploppt --
  // das ist ein anderer, nicht Teil dieses Fixes.
  const archivedEx = mkEx({
    name: 'Alte Übung', archived: true, targetReps: 5,
    sets: [mkSet(80, 0, 'fail'), mkSet(80, 0, 'fail'), mkSet(80, null, 'pending'), mkSet(80, null, 'pending')],
  });
  const activeEx1 = mkEx({
    name: 'Bankdrücken', targetReps: 8,
    sets: [mkSet(60, 8, 'success'), mkSet(60, 8, 'success'), mkSet(60, 8, 'success'), mkSet(60, 8, 'success')],
  });
  const activeEx2 = mkEx({
    name: 'Kniebeuge', targetReps: 8,
    sets: [mkSet(100, 8, 'success'), mkSet(100, 8, 'success'), mkSet(100, 8, 'success'), mkSet(100, 8, 'success')],
  });

  await seed(page, mkDay({ exercises: [archivedEx, activeEx1, activeEx2] }));

  // Live-Anzeige: Regressions-Guard, dass die bereits korrekte Filterung
  // (ex.archived) in der Progress-Bar weiterhin greift -- 8 von 8 aktiven
  // Sätzen erledigt (die 12 Gesamt-Sätze inkl. archivierter Übung dürfen
  // NICHT im Nenner auftauchen).
  await expect(page.locator('.training-progress__label')).toContainText('8/8 Sätze');

  await page.click('[data-action="toggle-complete"]');
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
  await page.click('#session-summary-continue');

  const screen = page.locator('#day-completion-screen');
  await expect(screen).toBeVisible();
  await expect(screen).toContainText('8/8 Sätze erfolgreich');
  await expect(screen.locator('.day-completion-screen__pct')).toContainText('100%');
  await expect(screen.locator('.day-completion-screen__effort')).toContainText('100%');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
