import { test, expect } from '@playwright/test';

// B75: Nutzer meldete, ein Auto-Backup-JSON-Download erscheine beim Klick
// auf "Teilen" im Fortschritt-Tab. Diagnose (5 reale Reproduktionen, siehe
// SESSION_LOG.md) zeigte: kein gemeinsamer Code-Pfad zwischen Share-Button
// und exportJSONAuto() — der Trigger (ui.js, scheduleRender()) reagiert
// ausschließlich auf state.weeks.length-Zuwachs (WEEK_CREATE/
// AUTO_WEEK_CREATE). Rückfrage beim Nutzer bestätigte: der Download tritt
// NUR in Kombination mit einer kurz zuvor erstellten Woche auf, nie ohne —
// der Trigger war die ganze Zeit korrekt. Ursache der Verwirrung: der
// Download passierte bisher völlig unangekündigt (kein Toast), fiel dem
// Nutzer erst beim NÄCHSTEN Tap auf (Android zeigt Downloads nicht
// aufdringlich an) und wurde fälschlich dem Share-Klick zugeschrieben.
// Fix: Toast direkt am echten Auslösepunkt, Trigger selbst unverändert.

function mondayOffset(weeksFromNow) {
  const d = new Date();
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday + weeksFromNow * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function fullWeek(id, startDate) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: 7, energyLevel: 4, sessionRating: 2,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 80, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
        prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', archived: false,
      }] }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('Toast erscheint beim Auto-Backup (Wochenerstellung), Download bleibt unverändert korrekt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const downloads = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-2)), fullWeek(2, mondayOffset(-1))];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false, showReview: true, suggestProgress: false } },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0], plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
    localStorage.setItem('train_share_consent', 'true');
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('.wr-modal', { timeout: 5000 });
  await page.click('#wr-btn-continue');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');

  await expect(page.locator('.toast.is-visible')).toContainText('Automatisches Backup gespeichert');
  await expect.poll(() => downloads).toContain('TRAIN_Backup_' + mondayOffset(-1) + '.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Teilen-Klick im Fortschritt-Tab löst weiterhin KEIN Auto-Backup aus', async ({ page }) => {
  const downloads = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-2)), fullWeek(2, mondayOffset(-1))];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0], plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
    localStorage.setItem('train_share_consent', 'true');
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');
  expect(downloads.filter(f => f.startsWith('TRAIN_Backup_'))).toHaveLength(0);
});
