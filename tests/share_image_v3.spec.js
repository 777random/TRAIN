import { test, expect } from '@playwright/test';

// B73 — Share-Bild v3: Favoriten-Kaskade, Retina-Deckelung, PR-Moment-Toast,
// Datenschutz-Hinweis vor dem ersten Teilen.

function mkWeek(id, startDate, exercises, markedDone = true) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: markedDone, markedDone, isVacation: false,
      sleepHours: 7, energyLevel: 4, sessionRating: 2, exercises }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}
function ex(name, weight, reps, extra = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: weight, prRepsAtMaxWeight: reps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: reps,
    progressionType: 'weight', archived: false, ...extra,
  };
}

test('buildWeekShareCanvas: 0 Datenpunkte zeigt Ausblick statt Absturz', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const dims = await page.evaluate(async () => {
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildWeekShareCanvas({
      kw: '29', monthYear: 'Juli 2026', streak: 0, doneDays: 0, totalDays: 1,
      successPct: null, bestExercise: null, weights: [], isPr: false,
    });
    const dpr = window.devicePixelRatio || 1;
    return { w: canvas.width / dpr, h: canvas.height / dpr };
  });
  expect(dims).toEqual({ w: 1080, h: 1080 });
});

test('_buildCanvas: DPR wird bei 3x gedeckelt (Retina-Fix)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const px = await page.evaluate(async () => {
    Object.defineProperty(window, 'devicePixelRatio', { value: 5, configurable: true });
    const mod = await import('./shareImage.js');
    const canvas = await mod.buildPrShareCanvas([{ name: 'Kniebeuge', weight: 100, reps: 5, type: 'weight' }]);
    return canvas.width; // muss 1080*3, NICHT 1080*5 sein
  });
  expect(px).toBe(1080 * 3);
});

test('Favoriten-Kaskade: Favorit mit kleinerem PR wird trotzdem vor Nicht-Favorit mit größerem PR gewählt', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const w = {
      id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
      days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
        sleepHours: 7, energyLevel: 4, sessionRating: 2,
        exercises: [
          // Nicht-Favorit, großer PR — würde ohne Favoriten-Kaskade gewinnen.
          { name: 'Kreuzheben', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 150, reps: 3, rpe: 8, status: 'success', done: true, note: '', prBadge: 'weight' }],
            prWeight: 150, prRepsAtMaxWeight: 3, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 3,
            progressionType: 'weight', archived: false },
          // Favorit, kleinerer PR — MUSS trotzdem gewinnen (Prio 1).
          { name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 82.5, reps: 5, rpe: 7, status: 'success', done: true, note: '', prBadge: 'weight' }],
            prWeight: 82.5, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false },
        ] }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    };
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [w],
      customTemplate: [], settings: {}, favoriteExercises: ['Kniebeuge'],
      prs: {
        'Kreuzheben': { maxWeight: 150, maxVolume: 450, maxEstimated1RM: 165, maxRepsAtMaxWeight: 3, date: '2026-07-06' },
        'Kniebeuge':  { maxWeight: 82.5, maxVolume: 412.5, maxEstimated1RM: 95.6, maxRepsAtMaxWeight: 5, date: '2026-07-06' },
      },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_share_consent', 'true');
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // CanvasRenderingContext2D.fillText() abfangen, um zu prüfen, welcher
  // Übungsname tatsächlich in Zone 2 des Bilds landet -- direkter Beleg für
  // bestExercise, ohne _pickBestExercise() zu exportieren.
  await page.evaluate(() => {
    window.__drawnTexts = [];
    const orig = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
      window.__drawnTexts.push(text);
      return orig.call(this, text, ...rest);
    };
  });

  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('#wr-btn-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#wr-btn-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');

  const drawnTexts = await page.evaluate(() => window.__drawnTexts);
  expect(drawnTexts).toContain('KNIEBEUGE');
  expect(drawnTexts).not.toContain('KREUZHEBEN');
});

test('PR-Moment-Toast erscheint nach echtem PR und löst PNG-Download aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-13', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 105, reps: 5, rpe: 8, status: 'pending', done: false, note: '' }],
            prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false,
          }] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-07-06' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_share_consent', 'true');
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="toggle-done"]');
  await page.waitForSelector('#pr-moment-toast-btn', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#pr-moment-toast-btn'),
  ]);
  expect(download.suggestedFilename()).toBe('train-pr.png');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Datenschutz-Hinweis erscheint beim ersten Teilen, nicht mehr beim zweiten Mal', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
          sleepHours: 7, energyLevel: 4, sessionRating: 2,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 100, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
            prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false,
          }] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-07-06' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      // lastReentryHandled = heute -> unterdrückt den unabhängigen
      // Wiedereinstiegs-Popup, der sonst hier ebenfalls feuern würde
      // (Testdaten liegen lange vor "heute") und Klicks blockiert.
      lastReentryHandled: new Date().toISOString().split('T')[0],
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    // Bewusst KEIN train_share_consent gesetzt -- erster Share dieser Session.
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Beide Shares über das Dropdown im Fortschritt-Tab -- vermeidet die
  // Wochenwechsel-Modal-Kette (die nach "Weiter →" ein zweites Modal
  // öffnet), hier nicht Testgegenstand.
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });
  await page.click('#week-review-inline-share');

  await page.waitForSelector('#share-consent-ok', { timeout: 5000 });
  await expect(page.locator('.vac-plan-modal-overlay')).toBeVisible();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#share-consent-ok'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');

  const consentFlag = await page.evaluate(() => localStorage.getItem('train_share_consent'));
  expect(consentFlag).toBe('true');

  // Zweites Teilen -- Hinweis darf NICHT erneut erscheinen, Download muss
  // direkt kommen.
  const [download2] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share'),
  ]);
  expect(download2.suggestedFilename()).toBe('train-woche.png');
  await expect(page.locator('.vac-plan-modal-overlay')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
