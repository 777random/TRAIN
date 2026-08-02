import { test, expect } from '@playwright/test';

// Runde 6 (C12): Distanz-/Zeit-Übungen (metric 'm'/'sec') bekamen bislang
// unconditional progressionType 'reps' (state.js EX_ADD, B18) -- sinnvoll für
// die meisten Fälle (Ziel-Distanz/-Zeit steigern), aber für 'Carry'-Übungen
// (Farmer's Walk, KB Carry etc.) ist eine Gewichtssteigerung bei fixer/
// sekundärer Distanz die naheliegendere Progressionsform. Fix: EX_ADD lässt
// progressionType='weight' jetzt zusätzlich zu, wenn die Übung als 'Carry'
// klassifiziert ist (movementMap.js-Kategorie oder manueller Override).
// Bestehende Datensätze sind unberührt (v29->v30-Migration bleibt
// unverändert, testet weiterhin ausschließlich die alte Zwangslogik).

function todayISO() { return new Date().toISOString().split('T')[0]; }

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ startDate }) => {
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
      settings: { sessionCoach: false, rpeEnabled: true },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { startDate: todayISO() });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Neue Carry-Übung (metric m, Kategorie Carry) erlaubt progressionType weight', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Sandsack Carry Test');
  await page.waitForTimeout(150);
  await page.click('[data-action="ex-search-create"]');
  await page.click('[data-action="ex-form-set-metric"][data-metric="m"]');
  await page.click('[data-action="ex-form-set-category"][data-cat="Carry"]');
  await page.click('[data-action="ex-form-submit"]');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Sandsack Carry Test');
  expect(added).toBeTruthy();
  expect(added.metric).toBe('m');
  expect(added.progressionType).toBe('weight');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Neue Distanz-Übung ohne Carry-Kategorie bleibt bei progressionType reps', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Laufband Test');
  await page.waitForTimeout(150);
  await page.click('[data-action="ex-search-create"]');
  await page.click('[data-action="ex-form-set-metric"][data-metric="m"]');
  // keine Kategorie gewählt -> resolveCategory faellt auf 'Sonstige' zurueck
  await page.click('[data-action="ex-form-submit"]');

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Laufband Test');
  expect(added).toBeTruthy();
  expect(added.metric).toBe('m');
  expect(added.progressionType).toBe('reps');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
