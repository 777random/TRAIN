import { test, expect } from '@playwright/test';

// B62 (Runde 13, Council-Entscheidung): Service-Worker-Registrierung soll
// nicht mehr unconditional beim reinen Seitenaufruf passieren, sondern erst
// bei der ersten echten Trainingsaktion (timer.js '_ensureSessionStart()',
// ausgelöst z.B. über das bestehende 'train:set-input'-Event, das ui.js bei
// jeder Gewichts-/Wiederholungs-/RPE-Eingabe feuert). Grund: die 7.
// Precache-Reduktion (datenschutz.html + Badge-PNGs raus, siehe sw.js) allein
// hätte den P0-Kern des Bugs nicht behoben — der eigentliche Punkt ist der
// VERSCHOBENE Registrierungszeitpunkt.
//
// navigator.serviceWorker.register() wird per addInitScript instrumentiert
// (Zähler statt echtem Two-Version-SW-Zyklus — analog zum bestehenden Muster
// in tests/sw_update_and_version.spec.js), damit der Test unabhängig davon
// funktioniert, ob der Browser im CI tatsächlich Service Worker unterstützt.

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

async function instrumentRegister(page) {
  await page.addInitScript(() => {
    window.__swRegisterCalls = 0;
    if ('serviceWorker' in navigator) {
      const orig = navigator.serviceWorker.register.bind(navigator.serviceWorker);
      navigator.serviceWorker.register = async (...args) => {
        window.__swRegisterCalls++;
        return orig(...args);
      };
    }
  });
}

async function seed(page) {
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
      sessionCheckIn: null, sessionModifier: 'normal',
      exercises: [{
        name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' }],
        prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      onboardingDone: true,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('registerServiceWorker() wird NICHT beim reinen Seitenaufruf aufgerufen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await instrumentRegister(page);
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  const calls = await page.evaluate(() => window.__swRegisterCalls);
  expect(calls).toBe(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('registerServiceWorker() wird erst nach der ersten Trainingsaktion (Session-Start) aufgerufen + zeigt Hinweis-Toast', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await instrumentRegister(page);
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  expect(await page.evaluate(() => window.__swRegisterCalls)).toBe(0);

  // Simuliert exakt das Event, das ui.js bei der ersten Gewichts-/
  // Wiederholungs-/RPE-Eingabe feuert (timer.js hört hier bereits ab,
  // siehe timer.js '_bindCustomEvents()' -> 'train:set-input').
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('train:set-input', { detail: { di: 0 } }));
  });

  await expect.poll(() => page.evaluate(() => window.__swRegisterCalls)).toBe(1);

  await expect(page.locator('#toast')).toHaveClass(/is-visible/);
  await expect(page.locator('#toast')).toContainText('lokal');

  // Erneutes Auslösen (z.B. weitere Eingabe im selben, bereits gestarteten
  // Tag) darf KEINE zweite Registrierung nach sich ziehen -- der Guard in
  // '_ensureSessionStart()' (day.sessionStartTs bereits gesetzt) verhindert
  // das bereits für den SESSION_START-Dispatch selbst, das neue
  // 'train:sw-register-trigger'-Event hängt am selben Guard.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('train:set-input', { detail: { di: 0 } }));
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__swRegisterCalls)).toBe(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
