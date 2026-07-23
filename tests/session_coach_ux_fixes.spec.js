import { test, expect } from '@playwright/test';

// B87: vier UX-Fixes aus dem ersten echten Nutzer-Test.
// Fix 1 (Spacing) ist reines CSS, hier nicht testbar -- per Screenshot verifiziert.
// Fix 2: Check-in korrigierbar ("✎ Tagesform anpassen").
// Fix 3: manueller Reduzierungs-Catch-up-Button.
// Fix 4+5: "Übernehmen"-Button pro Satz (Gewicht + Timer in einem Tap).

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx({ name = 'Bankdrücken', weight = 100, step = 5, targetReps = 5, nSets = 3 } = {}) {
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

function mkDay(exercises, { sessionCheckIn = null, sessionModifier = null } = {}) {
  return {
    id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn, sessionModifier,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { exercises, sessionCheckIn = null, sessionModifier = null, autoStartPauseTimer = false } = {}) {
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [mkDay(exercises, { sessionCheckIn, sessionModifier })], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate(({ weeksArg, autoStartPauseTimer }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer, rpeEnabled: true },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, favoriteExercises: [],
    }));
  }, { weeksArg: weeks, autoStartPauseTimer });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function setRpe(page, di, ei, si, val) {
  await page.click(`[data-action="open-rpe-popover"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
  await page.click(`[data-action="set-rpe-val"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"][data-val="${val}"]`);
}

async function toggleDone(page, di, ei, si) {
  await page.click(`[data-action="toggle-done"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
}

// ─── Fix 2 ──────────────────────────────────────────────────────────────────

test('Fix 2: "✎ Tagesform anpassen" öffnet Check-in mit vorherigen Werten vorausgewählt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [mkEx()],
    sessionCheckIn: { sleep: 'poor', energyPre: 'low', timestamp: Date.now() },
    sessionModifier: 'reduced',
  });

  const editLink = page.locator('[data-action="edit-checkin"]');
  await expect(editLink).toBeVisible();
  await editLink.click();

  await expect(page.locator('.session-checkin-card')).toBeVisible();
  await expect(page.locator('.session-checkin-btn.is-selected[data-field="sleep"]')).toHaveAttribute('data-val', 'poor');
  await expect(page.locator('.session-checkin-btn.is-selected[data-field="energyPre"]')).toHaveAttribute('data-val', 'low');

  // Korrektur: nur Schlaf auf "good" ändern -- energyPre ist bereits aus der
  // Vorbefüllung gesetzt ('low'), ein einzelner Tap reicht daher zum erneuten
  // Absenden (beide Felder sind ja schon nicht-null, exakt wie das bestehende
  // Zwei-Tap-Verhalten es für einen frischen Check-in ohnehin vorsieht).
  await page.click('[data-action="session-checkin-select"][data-field="sleep"][data-val="good"]');

  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card')).toBeVisible();

  const checkIn = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].sessionCheckIn);
  expect(checkIn.sleep).toBe('good');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── Fix 3 ──────────────────────────────────────────────────────────────────

test('Fix 3: Reduzierungs-Button erscheint nur bei sessionModifier=reduced, reduziert Gewichte -10%', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [mkEx({ weight: 100, step: 5 })],
    sessionCheckIn: { sleep: 'poor', energyPre: 'low', timestamp: Date.now() },
    sessionModifier: 'reduced',
  });

  // Automatische Reduktion lief bereits bei Check-in-Abgabe (SESSION_CHECKIN_SET,
  // state.js) -- aber dieser Tag wurde direkt mit sessionModifier='reduced'
  // geseedet, OHNE dass SESSION_CHECKIN_SET je gelaufen ist. Der Button muss
  // trotzdem erscheinen (reine UI-Bedingung: modifier==='reduced' + kein Flag).
  const reduceBtn = page.locator('[data-action="reduce-today-weights"]');
  await expect(reduceBtn).toBeVisible();

  await reduceBtn.click();

  await expect(page.locator('[data-action="reduce-today-weights"]')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card__reduce-done')).toBeVisible();

  const weight = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].exercises[0].sets[0].weight);
  expect(weight).toBe(90); // 100 * 0.9 = 90, bereits durch 5 teilbar

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Fix 3: kein Reduzierungs-Button wenn sessionModifier nicht reduced ist', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [mkEx()],
    sessionCheckIn: { sleep: 'good', energyPre: 'high', timestamp: Date.now() },
    sessionModifier: 'optimal',
  });
  await expect(page.locator('[data-action="reduce-today-weights"]')).toHaveCount(0);
});

test('Fix 3: Klick löst EINEN Undo-Schritt für alle betroffenen Sätze aus', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [mkEx({ name: 'Kniebeuge', weight: 100, step: 5 }), mkEx({ name: 'Bankdrücken', weight: 60, step: 2.5 })],
    sessionCheckIn: { sleep: 'poor', energyPre: 'low', timestamp: Date.now() },
    sessionModifier: 'reduced',
  });

  await page.click('[data-action="reduce-today-weights"]');
  await page.waitForTimeout(200);

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].exercises.map(e => e.sets[0].weight));
  expect(before).toEqual([90, 55]); // 100*0.9=90 (glatt), 60*0.9=54 -> gerundet auf 2.5er-Schritt -> 55

  await page.click('[data-tab="workout"]'); // Fokus weg vom entfernten Button
  await page.click('[data-action="undo"]');
  await page.waitForTimeout(200);

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].exercises.map(e => e.sets[0].weight));
  expect(after).toEqual([100, 60]); // EIN Undo macht BEIDE Übungen rückgängig
});

// ─── Fix 4+5 ────────────────────────────────────────────────────────────────

test('Fix 4+5: "Übernehmen"-Button setzt Gewicht des nächsten Satzes UND startet den Timer', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 100, step: 2.5, nSets: 3 })], autoStartPauseTimer: false });

  await setRpe(page, 0, 0, 0, 6); // RPE 6 -> steigern, +2.5kg -> 102.5kg
  await toggleDone(page, 0, 0, 0);

  const adoptBtn = page.locator('[data-action="adopt-set-feedback"][data-si="0"]');
  await expect(adoptBtn).toBeVisible();
  await expect(adoptBtn).toHaveAttribute('data-next-weight', '102.5');

  await adoptBtn.click();

  await expect(page.locator('[data-action="adopt-set-feedback"][data-si="0"]')).toHaveCount(0);
  await expect(page.locator('.set-feedback__line--confirm')).toContainText('Übernommen');

  const nextWeight = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].exercises[0].sets[1].weight);
  expect(nextWeight).toBe(102.5);

  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// B94 (train-v203) ersetzt das vormalige "verschwindet nach 2s"-Verhalten
// dieses Tests durch dauerhafte Sichtbarkeit -- siehe
// tests/session_coach_decision_matrix_v2.spec.js ("Fix 4: nach
// 'Übernehmen' bleibt Text dauerhaft sichtbar") für die aktuelle Erwartung.

test('Fix 4+5: kein Übernehmen-Button nach dem letzten Satz', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 100, step: 2.5, nSets: 2 })] });

  // RPE 8 (nicht <=6) auf dem letzten Satz -> "Perfekt abgeschlossen"-Zweig
  // (buildLastSetMessage), nicht der "Weiterer-Satz"-Zweig -- reiner Text,
  // kein Übernehmen-Button ist hier ohnehin nie vorgesehen (isLastSet).
  await setRpe(page, 0, 0, 1, 8);
  await toggleDone(page, 0, 0, 1); // letzter Satz (si=1 von 2)

  await expect(page.locator('[data-action="adopt-set-feedback"]')).toHaveCount(0);
  await expect(page.locator('.set-feedback__line')).toContainText('Nächste Woche');
});

test('Fix 4+5: kein Übernehmen-Button wenn nextWeight === currentWeight (RPE "halten")', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 100, step: 2.5, nSets: 3 })] });

  await setRpe(page, 0, 0, 0, 7); // RPE 7 -> "Gute Intensität", nextWeight === currentWeight
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 100kg');
  await expect(page.locator('[data-action="adopt-set-feedback"]')).toHaveCount(0);
});

test('Fix 4+5: kein Übernehmen-Button ohne RPE', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 100, step: 2.5, nSets: 3 })] });

  await toggleDone(page, 0, 0, 0); // ohne RPE bewerten
  await expect(page.locator('.set-feedback')).toBeVisible();
  await expect(page.locator('[data-action="adopt-set-feedback"]')).toHaveCount(0);
});

test('Fix 4+5: Timer läuft bereits -> Übernehmen setzt nur das Gewicht, Timer läuft unverändert weiter', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  // autoStartPauseTimer bewusst AUS -- sonst würde das bereits bestehende
  // B78-Verhalten (Timer startet automatisch bei JEDEM toggle-done) den
  // Timer schon vor dem eigentlichen Übernehmen-Klick neu starten und
  // diesen Test verfälschen. Hier soll AUSSCHLIESSLICH der neue
  // Übernehmen-Button den Timer steuern.
  await seed(page, { exercises: [mkEx({ weight: 100, step: 2.5, nSets: 3 })], autoStartPauseTimer: false });

  // Satz 0 mit RPE 9 bewerten und über "Übernehmen" den Timer mit der
  // LANGEN Pause starten (Sprint C1: Bankdrücken=Compound, goal nicht
  // gesetzt=Hypertrophie-Fallback -> 180s, nicht mehr die alte 240s-Tabelle).
  await setRpe(page, 0, 0, 0, 9);
  await toggleDone(page, 0, 0, 0);
  await page.click('[data-action="adopt-set-feedback"][data-si="0"]');
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const numBefore = await page.locator('#pause-ring-num').textContent();
  expect(Number(numBefore)).toBeGreaterThan(150); // ~180s, deutlich über der 90s-Pause von Satz 1

  // Jetzt Satz 1 mit RPE 6 bewerten -> eigener Übernehmen-Button mit Pause 90s.
  await setRpe(page, 0, 0, 1, 6);
  await toggleDone(page, 0, 0, 1);
  await page.click('[data-action="adopt-set-feedback"][data-si="1"]');

  // Timer darf NICHT auf die kürzere 90s-Pause von Satz 1 zurückgesetzt werden
  // -- er lief schon (240s-Pause von Satz 0), also nur Gewicht übernehmen.
  const numAfter = await page.locator('#pause-ring-num').textContent();
  expect(Number(numAfter)).toBeGreaterThan(150);

  const nextWeight = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].exercises[0].sets[2].weight);
  // Satz 1s Gewicht wurde durch das Übernehmen von Satz 0 bereits auf 97.5kg
  // gesetzt (100 - 2.5, RPE9-Reduzieren-Zweig), BEVOR Satz 1 selbst bewertet
  // wurde -- die "steigern"-Berechnung für Satz 1 (RPE6) geht daher von
  // 97.5kg aus: 97.5 + 2.5 = 100kg.
  expect(nextWeight).toBe(100);
});
