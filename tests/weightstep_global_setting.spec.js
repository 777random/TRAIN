import { test, expect } from '@playwright/test';

// Runde 6 (A9-Folgefix): B65 hob 2026 zwar bestehende Squat/Hinge-Übungen
// per Migration (v30->v31) auf 5kg an, aber JEDE neu angelegte Übung bekam
// weiterhin unconditional den Kategorie-Default als ex.weightStep (state.js
// EX_ADD) -- das hatte in der überall genutzten Fallback-Kette
// (ex.weightStep ?? settings.plateStep ?? 2.5) IMMER Vorrang vor der
// globalen Einstellung "Kleinstmögliche Steigerung" (settings.plateStep),
// die dadurch für jede real existierende Übung wirkungslos war. Fix:
// ex.weightStep wird bei EX_ADD nicht mehr hart gesetzt -- die Schrittweite
// wird jetzt zur Lesezeit über state.js getEffectiveWeightStep() aufgelöst
// (ex.weightStep ?? settings.plateStep ?? Kategorie-Default ?? 2.5).

function todayISO() { return new Date().toISOString().split('T')[0]; }

async function seed(page, { settings = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ startDate, settings }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate, note: '', mode: 'standard',
        days: [{
          id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
          locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null,
          exercises: [], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
        }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      onboardingDone: true, customTemplate: [], favoriteExercises: [], customExercises: [],
      settings: { sessionCoach: false, rpeEnabled: true, ...settings },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { startDate: todayISO(), settings });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// Fügt eine bekannte Übung (Standard- oder movementMap.js-Synonym) über den
// echten Such-/Auswahl-Dialog hinzu -- dispatcht EX_ADD, exakt wie ein Nutzer
// es tun würde (siehe tests/exercise_search_fix.spec.js für dasselbe Muster).
async function addKnownExercise(page, name) {
  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', name);
  await page.waitForTimeout(150);
  await page.click(`[data-action="ex-search-pick"][data-name="${name}"]`);
}

async function openExerciseSettings(page, di, ei) {
  await page.click(`[data-action="toggle-ex-menu"][data-di="${di}"][data-ei="${ei}"]`);
  await page.click(`[data-action="toggle-cfg"][data-di="${di}"][data-ei="${ei}"]`);
  // Schrittweite-Picker liegt hinter dem "Erweitert"-Sub-Toggle (Ebene 2,
  // selten genutzt, siehe ui.js ~Zeile 2293-2298).
  await page.click(`[data-action="toggle-cfg-adv"][data-di="${di}"][data-ei="${ei}"]`);
}

test('Neu angelegte Übung: ex.weightStep bleibt unset, globale Einstellung wird wirksam', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  // Bankdrücken -> Push-Kategorie, Kategorie-Default wäre 2.5kg -- globale
  // Einstellung auf 5kg gestellt, muss jetzt greifen (vorher: immer 2.5kg,
  // unabhängig von dieser Einstellung).
  await seed(page, { settings: { plateStep: 5 } });

  await addKnownExercise(page, 'Bankdrücken');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Bankdrücken');
  expect(added).toBeTruthy();
  expect(added.weightStep).toBeUndefined();

  await openExerciseSettings(page, 0, 0);
  const selectedStepBtn = page.locator('[data-action="set-step"][data-di="0"][data-ei="0"].is-selected');
  await expect(selectedStepBtn).toHaveText('5');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Squat/Hinge-Kategorie-Default bleibt 5kg ohne gesetzte globale Einstellung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page); // kein settings.plateStep

  await addKnownExercise(page, 'Kniebeuge');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Kniebeuge');
  expect(added).toBeTruthy();
  expect(added.weightStep).toBeUndefined();

  await openExerciseSettings(page, 0, 0);
  const selectedStepBtn = page.locator('[data-action="set-step"][data-di="0"][data-ei="0"].is-selected');
  await expect(selectedStepBtn).toHaveText('5');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Manuelle Anpassung (EX_SET_STEP) hat weiterhin Vorrang vor der globalen Einstellung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { settings: { plateStep: 5 } });

  await addKnownExercise(page, 'Bankdrücken');
  await openExerciseSettings(page, 0, 0);
  await page.click('[data-action="set-step"][data-di="0"][data-ei="0"][data-step="1.25"]');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Bankdrücken');
  expect(added.weightStep).toBe(1.25);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
