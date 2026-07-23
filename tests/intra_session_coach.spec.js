import { test, expect } from '@playwright/test';

// B77: Intra-Session Coach — Feedback direkt nach einem bewerteten Satz,
// Aufwärm-Empfehlung, Favoriten-RPE-Nudge. SCHEMA unverändert (32).

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function mkEx({ name = 'Bankdrücken', weight = 100, step = 5, targetReps = 5, nSets = 2, favorite = false } = {}) {
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
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: { sleep: 'good', energyPre: 'medium', timestamp: Date.now() }, sessionModifier: 'normal',
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { exercises, sessionCoach = true, favoriteExercises = [], autoStartPauseTimer = false } = {}) {
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [mkDay(exercises)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate(({ weeksArg, sessionCoach, favoriteExercises, autoStartPauseTimer }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach, autoStartPauseTimer, rpeEnabled: true }, favoriteExercises,
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, sessionCoach, favoriteExercises, autoStartPauseTimer });
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

test('RPE 6 (nicht letzter Satz) -> "Noch Luft — steigern" + Pause 90s', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2 })] });

  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);

  // B92: Hint-Text um "Ziel erreicht, " erweitert (Entscheidungsmatrix v2,
  // repDiff===0 -> Gruppe C) -- Verhalten (Gewicht/Pause) unverändert.
  await expect(page.locator('.set-feedback').first()).toContainText('Ziel erreicht, noch Luft — steigern');
  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 90s');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('RPE 8 (nicht letzter Satz, Ziel erreicht) -> "Optimale Zone" + Pause 2min', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2, targetReps: 5 })] });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  // Sprint C1: Pause hängt jetzt zusätzlich von Trainingsziel (state.settings.goal,
  // hier nicht gesetzt -> Hypertrophie-Zweig) + Compound/Isolation ab ("Bankdrücken"
  // = Push = Compound) -- Hyp-Compound bei RPE 8 = 120s, nicht mehr die alte
  // flache 180s-RPE-Tabelle.
  await expect(page.locator('.set-feedback').first()).toContainText('Optimale Zone');
  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 2min');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('RPE 10 (nicht letzter Satz) -> "Maximum — deutlich reduzieren" + Pause 5min+', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2 })] });

  await setRpe(page, 0, 0, 0, 10);
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback').first()).toContainText('Maximum — deutlich reduzieren');
  await expect(page.locator('.set-feedback').first()).toContainText('Pause: 5min+');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Letzter Satz zeigt "Nächste Woche: ..." statt "Nächster Satz"-Text', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 1 })] });

  await setRpe(page, 0, 0, 0, 7);
  await toggleDone(page, 0, 0, 0);

  const fb = page.locator('.set-feedback').first();
  await expect(fb).toContainText('Nächste Woche:');
  await expect(fb).not.toContainText('Nächster Satz:');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Ohne RPE: nur Gewicht, kein Hint/Pause-Text', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2, weight: 100, step: 5, targetReps: 5 })] });

  await toggleDone(page, 0, 0, 0); // success (reps=targetReps=5), rpe bleibt null

  const fb = page.locator('.set-feedback').first();
  await expect(fb).toContainText('Nächster Satz: 100kg');
  await expect(fb).not.toContainText('Pause:');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Timer übernimmt die berechnete Pause als Voreinstellung (nicht mehr fix ex.pauseSec)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2, targetReps: 5 })], autoStartPauseTimer: true });

  // Sprint C1: Bankdrücken (Compound) + goal nicht gesetzt (Hypertrophie-Fallback)
  // + RPE 8 -> 120s, nicht mehr die alte flache 180s-RPE-Tabelle.
  await setRpe(page, 0, 0, 0, 8); // -> pauseSec 120, ex.pauseSec ist 90
  await page.click('[data-action="confirm-set"][data-di="0"][data-ei="0"]');

  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const num = await page.locator('#pause-ring-num').textContent();
  expect(Number(num)).toBeGreaterThanOrEqual(117); // 120s abzüglich minimaler Renderzeit
  expect(Number(num)).toBeLessThanOrEqual(120);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// B85: die berechnete Pausenzahl wurde bisher erst beim ERSTEN
// requestAnimationFrame-Tick von _tickPause() (timer.js) ins DOM
// geschrieben -- _startPause() selbst schrieb sie nicht synchron. Auf
// einem langsameren/anders getakteten Client (beobachtet in GitHub Actions
// CI, nie lokal) konnte ein Auslesen VOR diesem ersten Tick noch den
// statischen Platzhalter "90" aus dem initialen Overlay-Markup zeigen
// statt der echten Sekundenzahl (hier: 180).
//
// Dieser Test klickt "Satz bestätigen" UND liest #pause-ring-num direkt
// im selben page.evaluate()-Aufruf aus -- beides läuft synchron im
// selben JS-Task der Seite, ohne Playwright-IPC-Rundreise dazwischen.
// requestAnimationFrame-Callbacks können per Spezifikation frühestens
// NACH Abschluss des aktuellen synchronen Tasks feuern -- ist die Zahl
// hier bereits korrekt, kann das nur an einem synchronen Schreiben in
// _startPause() liegen, nie am rAF-Tick. Deterministisch, unabhängig
// von jeglicher Timing-Varianz (im Unterschied zum ursprünglichen Test
// oben, der über zwei separate awaits/IPC-Rundreisen geht).
test('B85: Pausenzahl ist synchron korrekt, unabhängig von requestAnimationFrame-Timing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2, targetReps: 5 })], autoStartPauseTimer: true });

  // Sprint C1: Bankdrücken (Compound) + goal nicht gesetzt (Hypertrophie-Fallback)
  // + RPE 8 -> 120s, nicht mehr die alte flache 180s-RPE-Tabelle.
  await setRpe(page, 0, 0, 0, 8); // -> pauseSec 120

  const numRightAfterClick = await page.evaluate(() => {
    document.querySelector('[data-action="confirm-set"][data-di="0"][data-ei="0"]').click();
    return document.getElementById('pause-ring-num').textContent;
  });
  expect(numRightAfterClick).toBe('120');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// B78: der manuelle ✓/✗-Button (toggle-done) hatte eine eigene,
// von ui.js unabhängige Klick-Erkennung in timer.js (_bindAppInteractions()),
// die den Pause-Timer bisher UNCONDITIONAL auslöste — ohne die Einstellung
// autoStartPauseTimer zu prüfen. Der confirm-set-Pfad (ui.js) respektierte
// die Einstellung bereits korrekt. Diese beiden Tests sichern beide
// Richtungen über den toggle-done-Pfad ab.
test('B78: toggle-done startet den Pause-Timer NICHT wenn autoStartPauseTimer deaktiviert ist', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2, targetReps: 5 })], autoStartPauseTimer: false });

  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);
  await page.waitForTimeout(300);

  await expect(page.locator('#pause-overlay')).not.toHaveClass(/pause-overlay--visible/);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('B78: toggle-done startet den Pause-Timer weiterhin korrekt wenn autoStartPauseTimer aktiviert ist', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 2, targetReps: 5 })], autoStartPauseTimer: true });

  // Sprint C1: Bankdrücken (Compound) + goal nicht gesetzt (Hypertrophie-Fallback)
  // + RPE 8 -> 120s, nicht mehr die alte flache 180s-RPE-Tabelle.
  await setRpe(page, 0, 0, 0, 8); // -> pauseSec 120
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const num = await page.locator('#pause-ring-num').textContent();
  expect(Number(num)).toBeGreaterThanOrEqual(117);
  expect(Number(num)).toBeLessThanOrEqual(120);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Favoriten-Übung ohne RPE: erweiterte Nudge einmalig pro Sitzung, "Nie für diese Übung" wirkt dauerhaft', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [mkEx({ name: 'Kniebeuge', nSets: 3, targetReps: 5 })],
    favoriteExercises: ['Kniebeuge'],
  });

  // Der RPE-Nudge (plain wie favorite) wird ausschließlich über "Satz
  // bestätigen" (confirm-set) bzw. Auto-Eval getriggert, NICHT über das
  // manuelle ✓/✗-Icon (toggle-done) — bestehendes, unverändertes Verhalten.
  await page.click('[data-action="confirm-set"][data-di="0"][data-ei="0"]'); // success, kein RPE -> Nudge erscheint

  await expect(page.locator('.rpe-nudge--favorite')).toBeVisible();
  await expect(page.locator('.rpe-nudge__label--favorite')).toContainText('Kniebeuge');
  await page.click('[data-action="rpe-nudge-never"]');
  await expect(page.locator('.rpe-nudge--favorite')).toHaveCount(0);

  const skipFlag = await page.evaluate(() => localStorage.getItem('train_rpe_skip_Kniebeuge'));
  expect(skipFlag).toBe('true');

  // Zweiter Satz ohne RPE: bleibt bei der generischen Nudge (dauerhaft "nie")
  await page.click('[data-action="confirm-set"][data-di="0"][data-ei="0"]');
  await expect(page.locator('.rpe-nudge')).toBeVisible();
  await expect(page.locator('.rpe-nudge--favorite')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('RPE <= 6 nach letztem Satz -> Weiterer-Satz-Vorschlag, "+ Satz hinzufügen" legt Satz mit Vorschlagsgewicht an', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ nSets: 1, weight: 100, step: 5, targetReps: 5 })] });

  await setRpe(page, 0, 0, 0, 6); // 6 ist der kleinste im RPE-Popover angebotene Wert
  await toggleDone(page, 0, 0, 0);

  const fb = page.locator('.set-feedback--action');
  await expect(fb).toContainText('Du hast noch Kapazität');
  await expect(fb).toContainText('105kg');
  await page.click('[data-action="add-optional-set"]');

  const sets = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].days[0].exercises[0].sets);
  expect(sets).toHaveLength(2);
  expect(sets[1].weight).toBe(105);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Aufwärm-Empfehlung: eingeklappt per Default, korrekte 50/70/85%-Formel', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ name: 'Kniebeuge', weight: 100, step: 5, nSets: 2 })] });

  await expect(page.locator('.warmup-rec-block')).toBeVisible();
  await expect(page.locator('.warmup-rec-body')).toHaveCount(0); // eingeklappt

  await page.click('[data-action="toggle-warmup-rec"]');
  const body = page.locator('.warmup-rec-body');
  await expect(body).toBeVisible();
  await expect(body).toContainText('50kg × 5'); // 100*0.5=50
  await expect(body).toContainText('70kg × 3'); // 100*0.7=70
  await expect(body).toContainText('85kg × 1'); // 100*0.85=85

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('sessionCoach=false: kein Satz-Feedback, keine Aufwärm-Empfehlung, keine erweiterte Favoriten-Nudge', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, {
    exercises: [mkEx({ name: 'Kniebeuge', nSets: 2, targetReps: 5 })],
    sessionCoach: false,
    favoriteExercises: ['Kniebeuge'],
  });

  await expect(page.locator('.warmup-rec-block')).toHaveCount(0);

  await page.click('[data-action="confirm-set"][data-di="0"][data-ei="0"]'); // success, kein RPE
  await expect(page.locator('.set-feedback')).toHaveCount(0);
  // generische RPE-Nudge (rpeEnabled-gated, nicht Teil von B77) bleibt
  // unberührt bestehen — nur die B77-Erweiterung ist deaktiviert.
  await expect(page.locator('.rpe-nudge')).toBeVisible();
  await expect(page.locator('.rpe-nudge--favorite')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
