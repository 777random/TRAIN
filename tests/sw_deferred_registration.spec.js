import { test, expect } from '@playwright/test';

// B62 (Runde 13, Council-Entscheidung): Service-Worker-Registrierung sollte
// nicht mehr unconditional beim reinen Seitenaufruf passieren, sondern erst
// bei der ersten echten Trainingsaktion (timer.js '_ensureSessionStart()').
//
// Runde 20 (Befund 4): Live-Nutzer-Feedback ("ich bekomme nicht mehr die
// Meldung dass es Updates gibt") deckte eine Regression aus B62 auf --
// _ensureSessionStart() feuert den Registrierungs-Trigger nur EINMAL PRO TAG
// (Guard: day.sessionStartTs bereits gesetzt). Ein Nutzer, der die App nur
// öffnet ohne sofort zu trainieren, oder sie mehrfach am selben Tag neu
// öffnet, bekam dadurch NIE eine neue SW-Registrierung/updatefound-Prüfung
// in diesem JS-Kontext -- vor B62 lief das bei JEDEM Seitenaufruf. Fix:
// zusätzlicher, Idle-verzögerter Trigger bei JEDEM App-Start (mountTimer(),
// timer.js), unabhängig von einer Trainingsaktion. Die 7. Precache-Reduktion
// (datenschutz.html + Badge-PNGs raus, siehe sw.js) bleibt unverändert --
// nur der Registrierungszeitpunkt ändert sich erneut.
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

test('registerServiceWorker() wird nach dem Seitenaufruf automatisch (Idle-verzögert) aufgerufen, auch OHNE Trainingsaktion', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await instrumentRegister(page);
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  // Runde 20 (Befund 4): keine Trainingsaktion ausgelöst -- Registrierung
  // muss trotzdem passieren (Idle-Trigger aus mountTimer(), timer.js).
  await expect.poll(() => page.evaluate(() => window.__swRegisterCalls), { timeout: 8000 }).toBe(1);
  await expect(page.locator('#toast')).toHaveClass(/is-visible/);
  await expect(page.locator('#toast')).toContainText('lokal');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Eine Trainingsaktion nach bereits erfolgter Idle-Registrierung löst KEINE zweite Registrierung aus ({ once: true })', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await instrumentRegister(page);
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  await expect.poll(() => page.evaluate(() => window.__swRegisterCalls), { timeout: 8000 }).toBe(1);

  // Simuliert exakt das Event, das ui.js bei der ersten Gewichts-/
  // Wiederholungs-/RPE-Eingabe feuert (timer.js hört hier bereits ab,
  // siehe timer.js '_bindCustomEvents()' -> 'train:set-input') -- der
  // redundante _ensureSessionStart()-Trigger darf dank { once: true } in
  // index.html keine zweite Registrierung mehr auslösen.
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('train:set-input', { detail: { di: 0 } }));
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__swRegisterCalls)).toBe(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
