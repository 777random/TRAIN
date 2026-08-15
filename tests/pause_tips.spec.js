import { test, expect } from '@playwright/test';

// Runde 21 (Kurzartikel-Feature): kurzer, kategorie-gebundener Trainings-
// Tipp im Pause-Overlay, Ersatz für die abgelehnte In-App-Spiel-Idee
// (Befund 9, Runde 20). Nur sichtbar während der Pause läuft, bewusst
// befüllt im train:set-done-Handler (nicht im train:pause-restart-Handler
// aus Runde 20/B242), damit eine nachträgliche RPE-Korrektur den Tipp
// nicht mitten in der Pause wechselt.

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function mkEx({ name, weight = 100, step = 5, targetReps = 5, nSets = 2 } = {}) {
  const sets = [];
  for (let i = 0; i < nSets; i++) {
    sets.push({ weight, reps: targetReps, rpe: null, status: 'pending', done: false, note: '' });
  }
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: step,
    sets,
    prWeight: weight, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: nSets, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(exercises) {
  return {
    id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { exercises, showPauseTips = true } = {}) {
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [mkDay(exercises)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate(({ weeksArg, showPauseTips }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer: true, rpeEnabled: true, showPauseTips },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      onboardingDone: true,
    }));
  }, { weeksArg: weeks, showPauseTips });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function toggleDone(page, di, ei, si) {
  await page.click(`[data-action="toggle-done"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
}

test('Kniebeuge (Squat) zeigt den Squat-Tipp, sichtbar solange die Pause läuft', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Kniebeuge', nSets: 2 })] });

  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const tip = page.locator('#pause-tip');
  await expect(tip).toBeVisible();
  await expect(tip).toContainText('Knie-Richtung beachten');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Bankdrücken (Push) zeigt den Push-Tipp', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Bankdrücken', nSets: 2 })] });

  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('#pause-tip')).toContainText('Schulterblätter fixieren');
});

test('Unbekannte/eigene Übung ohne Kategorie fällt auf den generischen Tipp-Pool zurück', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Meine ganz eigene Übung XYZ', nSets: 2 })] });

  await toggleDone(page, 0, 0, 0);

  const text = await page.locator('#pause-tip').textContent();
  expect(text).toMatch(/Tempo statt Hast|Trinken nicht vergessen/);
});

test('Deaktivierte Einstellung "Lerninhalte in der Pause": kein Tipp, Timer funktioniert unverändert', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Kniebeuge', nSets: 2 })], showPauseTips: false });

  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  await expect(page.locator('#pause-tip')).toBeHidden();
});

test('Tipp verschwindet mit dem Overlay, sobald die Pause manuell beendet wird', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Kniebeuge', nSets: 2 })] });

  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('#pause-tip')).toBeVisible();

  // Dismiss braucht laut timer.js einen Doppel-Tap innerhalb von 2s
  // (Versehentlich-Beenden-Schutz) -- ein einzelner Klick zeigt nur einen Hinweis.
  await page.click('#pause-dismiss-btn');
  await page.click('#pause-dismiss-btn');
  await expect(page.locator('#pause-overlay')).not.toHaveClass(/pause-overlay--visible/);
});

test('Tipp-Text bleibt stabil, wenn eine nachträgliche RPE-Eingabe den Pausentimer neu startet (B242)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Kniebeuge', nSets: 2 })] });

  await toggleDone(page, 0, 0, 0);
  const before = await page.locator('#pause-tip').textContent();
  expect(before).toContain('Knie-Richtung beachten');

  // Nachträgliche RPE-Eingabe -> löst train:pause-restart aus (Runde 20/B242),
  // der Tipp-Text darf sich dabei NICHT ändern.
  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="0"][data-val="8"]');

  const after = await page.locator('#pause-tip').textContent();
  expect(after).toBe(before);
});
