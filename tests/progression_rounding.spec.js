import { test, expect } from '@playwright/test';

// B101 (train-v210): "Automatische Steigerung bei neuer Woche" wandte den im
// "Neue Woche"-Modal bestätigten Delta (ex.nextWeekPlan) bisher ungerundet an
// (_applyPlannedProgression(), state.js) -- im Normalfall folgenlos (Delta ist
// bereits weightStep-ausgerichtet), aber der Recovery-Boost (ui.js, rec.delta
// *= 1.5 bei aktivem isInRecoveryWindow(), ohne danach neu zu runden) und ein
// manuell im "Anderer Wert"-Feld eingetragener Custom-Delta konnten ein nicht
// ausgerichtetes Delta erzeugen -- das im Modal versprochene Gewicht (gerundet)
// wich dann vom tatsächlich in der neuen Woche gesetzten Gewicht (ungerundet)
// ab. Fix: Rundung auf ex.weightStep direkt in _applyPlannedProgression(),
// EINE Stelle statt an jeder Delta-Berechnung einzeln.
// Zusätzlich (B101 Fix B): _checkPersistentFailure()/_checkMultiExerciseFailure()
// (weeklyFocus.js) verwendeten für den Gewichts-Reduktionsvorschlag bei
// Dauer-Fehlschlägen bisher immer state.settings.plateStep (global), nie
// ex.weightStep (pro Übung) -- unabhängiges, aber verwandtes Problem.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, weight, { weightStep = 2.5, nextWeekPlan = 0, confirmed = false, status = 'success' } = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: [{ weight, reps: 5, rpe: 7, status, done: status !== 'pending', note: '' }],
    prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan, nextWeekPlanConfirmed: confirmed, targetSets: 1, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, { markedDone = true } = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, weeks, settingsOverride = {}) {
  await page.evaluate(({ weeksArg, settingsOverride }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: { plateStep: 2.5, deloadFactor: 0.75, ...settingsOverride },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, settingsOverride });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

async function createWeekFromPrev(page) {
  await page.click('[data-action="open-new-week"]');
  const reviewContinue = page.locator('#wr-btn-continue');
  if (await reviewContinue.count()) await reviewContinue.click();
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');
}

test('Nicht ausgerichtetes bestätigtes Delta (Recovery-Boost-Fall) wird beim Anwenden auf weightStep gerundet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Simuliert einen bereits im Modal bestätigten, durch den Recovery-Boost
  // (*1.5) nicht mehr weightStep-ausgerichteten Delta: 2.5 * 1.5 = 3.75.
  const day = mkDay(1, [mkEx('Bankdrücken', 80, { weightStep: 2.5, nextWeekPlan: 3.75, confirmed: true })]);
  await seed(page, [{ id: 1, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }]);

  await createWeekFromPrev(page);

  const st = await getState(page);
  const newWk = st.weeks.at(-1);
  expect(newWk.days[0].exercises[0].sets[0].weight).toBe(85);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Manuell eingetragener, nicht ausgerichteter Custom-Delta wird beim Anwenden gerundet', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Bizepscurls: weightStep 1.25, letztes Gewicht 20kg, Custom-Delta 2.6
  // (frei eingetippt, kein Vielfaches von 1.25). Erwartung:
  // Math.round((20+2.6)/1.25)*1.25 = Math.round(18.08)*1.25 = 22.5.
  const day = mkDay(1, [mkEx('Bizepscurls', 20, { weightStep: 1.25, nextWeekPlan: 2.6, confirmed: true })]);
  await seed(page, [{ id: 1, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }]);

  await createWeekFromPrev(page);

  const st = await getState(page);
  const newWk = st.weeks.at(-1);
  expect(newWk.days[0].exercises[0].sets[0].weight).toBe(22.5);
});

test('Bereits schiefes Ausgangsgewicht wird zusammen mit dem Delta auf weightStep gerundet', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Kniebeuge: manuell auf 81kg eingetragen (nicht auf dem 2.5kg-Raster),
  // Delta 2.5 (ausgerichtet). Erwartung: 82.5kg (nicht 83.5kg roh addiert).
  const day = mkDay(1, [mkEx('Kniebeuge', 81, { weightStep: 2.5, nextWeekPlan: 2.5, confirmed: true })]);
  await seed(page, [{ id: 1, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }]);

  await createWeekFromPrev(page);

  const st = await getState(page);
  const newWk = st.weeks.at(-1);
  expect(newWk.days[0].exercises[0].sets[0].weight).toBe(82.5);
});

test('Regressionsschutz: bereits ausgerichtetes Delta bleibt unverändert korrekt (Kniebeuge weightStep 5 -> 105kg)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const day = mkDay(1, [mkEx('Kniebeuge', 100, { weightStep: 5, nextWeekPlan: 5, confirmed: true })]);
  await seed(page, [{ id: 1, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }]);

  await createWeekFromPrev(page);

  const st = await getState(page);
  const newWk = st.weeks.at(-1);
  expect(newWk.days[0].exercises[0].sets[0].weight).toBe(105);
});

test('Coach-Tab Dauer-Fehlschlag-Vorschlag rundet auf ex.weightStep, nicht auf das globale plateStep', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Bizepscurls: weightStep 1.25, 3 Wochen durchgehend 0% Erfolg,
  // lastFailWeight 22kg, deloadFactor 0.75 -> 16.5kg.
  // Mit ex.weightStep (1.25): round(16.5/1.25)*1.25 = 16.25kg.
  // Mit globalem settings.plateStep (2.5, absichtlich abweichend gesetzt):
  // round(16.5/2.5)*2.5 = 17.5kg -- der alte, fehlerhafte Wert.
  const weeks = [];
  for (let i = 0; i < 3; i++) {
    const ex = mkEx('Bizepscurls', 22, { weightStep: 1.25, status: 'fail' });
    ex.sets = [{ weight: 22, reps: 5, rpe: null, status: 'fail', done: true, note: '' }];
    weeks.push({
      id: i + 1, startDate: isoMondayWeeksAgo(2 - i), note: '', mode: 'standard',
      days: [mkDay(i + 10, [ex])], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
  }
  await seed(page, weeks, { plateStep: 2.5 });

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const directive = await page.locator('.coach-focus-directive').first().textContent();
  expect(directive).toContain('16.25');
  expect(directive).not.toContain('17.5');
});
