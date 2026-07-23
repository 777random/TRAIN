import { test, expect } from '@playwright/test';

// B91-B94: Entscheidungsmatrix v2 (RPE + Wdh-Differenz), Begründung
// sichtbar machen, Übernehmen-Feedback bleibt dauerhaft sichtbar (auch
// nach Undo). Siehe DECISIONS.md für die B91/B94-Einträge.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx({ name = 'Militärpress', weight = 55, step = 2.5, targetReps = 8, nSets = 3 } = {}) {
  const sets = [];
  for (let i = 0; i < nSets; i++) sets.push({ weight, reps: targetReps, rpe: null, status: 'pending', done: false, note: '' });
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: step, sets,
    prWeight: weight, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: nSets, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(exercises, { sessionModifier = null } = {}) {
  return {
    id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { exercises, sessionModifier = null } = {}) {
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [mkDay(exercises, { sessionModifier })], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer: false, rpeEnabled: true },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, favoriteExercises: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function setReps(page, di, ei, si, val) {
  const input = page.locator(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
  await input.fill(String(val));
  await input.blur();
}

async function setRpe(page, di, ei, si, val) {
  await page.click(`[data-action="open-rpe-popover"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
  await page.click(`[data-action="set-rpe-val"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"][data-val="${val}"]`);
}

async function toggleDone(page, di, ei, si) {
  await page.click(`[data-action="toggle-done"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
}

// ─── Fix 1 / B91 ────────────────────────────────────────────────────────────

test('B91: RPE 7.5 (Ziel erreicht) bei sessionModifier=reduced zeigt 55kg halten, nicht 52.5kg', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 55, step: 2.5, targetReps: 8, nSets: 3 })], sessionModifier: 'reduced' });

  await setReps(page, 0, 0, 0, 8);
  await setRpe(page, 0, 0, 0, 7.5);
  await toggleDone(page, 0, 0, 0);

  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 55kg');
  await expect(page.locator('[data-action="adopt-set-feedback"]')).toHaveCount(0); // halten -> kein Übernehmen-Button

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── Fix 2: Entscheidungsmatrix v2 ──────────────────────────────────────────

test('Gruppe C: 8/8 Wdh @ RPE 7.5 -> halten', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, targetReps: 8 })] });
  await setReps(page, 0, 0, 0, 8);
  await setRpe(page, 0, 0, 0, 7.5);
  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 60kg');
});

test('Gruppe B: 7/8 Wdh @ RPE 8 -> halten', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, targetReps: 8 })] });
  await setReps(page, 0, 0, 0, 7);
  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 60kg');
  await expect(page.locator('.set-feedback__line--sub')).toContainText('1 Wdh gefehlt — Gewicht halten');
});

// Hinweis: Gruppe A (repDiff>=2) reduziert laut Matrix IMMER (auch bei RPE<9,
// nur bei RPE>=9 zusaetzlich staerker) -- die urspruengliche Akzeptanzliste
// nannte hier "Technik, halten", was der im selben Sprint bestaetigten
// Matrix-Definition (Gruppe A: "Unabhaengig von RPE: reduzieren") widerspricht.
// Getestet wird die tatsaechlich bestaetigte Matrix-Regel.
test('Gruppe A: 6/8 Wdh @ RPE 7 -> reduzieren (repDiff>=2, RPE<9)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8 })] });
  await setReps(page, 0, 0, 0, 6);
  await setRpe(page, 0, 0, 0, 7);
  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 57.5kg');
  await expect(page.locator('.set-feedback__line--sub')).toContainText('Ziel deutlich verfehlt (-2 Wdh) — reduzieren');
});

test('Gruppe A: 6/8 Wdh @ RPE 9 -> deutlich reduzieren (repDiff>=2, RPE>=9)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8 })] });
  await setReps(page, 0, 0, 0, 6);
  await setRpe(page, 0, 0, 0, 9);
  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 55kg'); // 60 - 2*2.5
  await expect(page.locator('.set-feedback__line--sub')).toContainText('deutlich reduzieren');
});

test('Gruppe D: 10/8 Wdh @ RPE 6 -> steigern (repDiff<0)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8 })] });
  await setReps(page, 0, 0, 0, 10);
  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 62.5kg');
  await expect(page.locator('.set-feedback__line--sub')).toContainText('steigern');
});

test('Trend-Erkennung: RPE steigt >=1.5 gegenüber Vorsatz -> längere Pause + Hinweis', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8, nSets: 3 })] });

  // Satz 0: RPE 6 (Basis-Pause 90s)
  await setReps(page, 0, 0, 0, 8);
  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);

  // Satz 1: RPE 8 (Basiswert für repDiff=0/RPE<=8 -- Militärpress=Push=Compound,
  // goal nicht gesetzt=Hypertrophie-Fallback -- waere 120s, Sprint C1) -- Anstieg
  // 8-6=2 >= 1.5 -> Pause * 1.5 = 180s statt 120s.
  await setReps(page, 0, 0, 1, 8);
  await setRpe(page, 0, 0, 1, 8);
  await toggleDone(page, 0, 0, 1);

  const subLines = page.locator('.set-feedback__line--sub');
  await expect(subLines.nth(1)).toContainText('RPE steigt schnell');
  await expect(subLines.nth(1)).toContainText('Pause: 3min'); // round(120*1.5)=180 -> "3min" (_fmtPause)
});

// ─── Fix 3: Begründung ──────────────────────────────────────────────────────

test('Fix 3: "▾ Warum?" erscheint, Tap klappt Begründung mit Wdh-Status + RPE + Logik auf', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8 })] });
  await setReps(page, 0, 0, 0, 7);
  await setRpe(page, 0, 0, 0, 8);
  await toggleDone(page, 0, 0, 0);

  const whyToggle = page.locator('[data-action="toggle-set-feedback-why"]');
  await expect(whyToggle).toBeVisible();
  await expect(page.locator('.set-feedback__why-body')).toHaveCount(0);

  await whyToggle.click();

  const whyBody = page.locator('.set-feedback__why-body');
  await expect(whyBody).toBeVisible();
  await expect(whyBody).toContainText('7/8 Wdh ✗ 1 gefehlt');
  await expect(whyBody).toContainText('RPE 8 — optimal');
  await expect(whyBody).toContainText('1 Wdh gefehlt — Gewicht halten');
});

// ─── Fix 4: Empfehlung bleibt sichtbar ──────────────────────────────────────

test('Fix 4: nach "Übernehmen" bleibt Text dauerhaft sichtbar (kein 2s-Verschwinden)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8, nSets: 3 })] });
  await setReps(page, 0, 0, 0, 8);
  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);

  await page.click('[data-action="adopt-set-feedback"][data-si="0"]');
  await expect(page.locator('.set-feedback__line--confirm')).toContainText('✓ Übernommen');
  await expect(page.locator('[data-action="adopt-set-feedback"]')).toHaveCount(0);

  await page.waitForTimeout(2500); // laenger als die alte B89 2s-Frist
  await expect(page.locator('.set-feedback__line--confirm')).toContainText('✓ Übernommen');
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 62.5kg');
});

test('Fix 4: nach Undo bleibt Feedback sichtbar mit "(rückgängig gemacht)"', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8, nSets: 3 })] });
  await setReps(page, 0, 0, 0, 8);
  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);
  await page.click('[data-action="adopt-set-feedback"][data-si="0"]');
  await expect(page.locator('.set-feedback__line--confirm')).toContainText('✓ Übernommen');

  await page.click('[data-tab="workout"]'); // Fokus weg vom entfernten Button
  // Zwei Undo-Schritte: der erste macht den "Übernehmen"-Dispatch (SET_UPDATE
  // auf Satz 1) rückgängig, der zweite den davorliegenden toggle-done-Dispatch
  // (Satz 0 zurück auf 'pending') -- reps/rpe von Satz 0 wurden in noch
  // früheren, hier nicht betroffenen Dispatches gesetzt.
  await page.click('[data-action="undo"]');
  await page.waitForTimeout(150);
  await page.click('[data-action="undo"]');
  await page.waitForTimeout(150);

  await expect(page.locator('.set-feedback__line--confirm')).toContainText('✓ Übernommen (rückgängig gemacht)');
  await expect(page.locator('.set-feedback__line').first()).toContainText('Nächster Satz: 62.5kg');
  await expect(page.locator('[data-action="adopt-set-feedback"]')).toHaveCount(0);
});

test('Fix 4: nach Tagesabschluss wird das Feedback aus dem Speicher gelöscht (Reopen zeigt wieder den Button)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ weight: 60, step: 2.5, targetReps: 8, nSets: 2 })] });
  await setReps(page, 0, 0, 0, 8);
  await setRpe(page, 0, 0, 0, 6);
  await toggleDone(page, 0, 0, 0);
  await page.click('[data-action="adopt-set-feedback"][data-si="0"]');
  await expect(page.locator('.set-feedback__line--confirm')).toContainText('✓ Übernommen');

  // Tag abschliessen (RPE 8 auf dem letzten Satz -> "Perfekt abgeschlossen"-
  // Zweig, kein Übernehmen-Button dort, unabhaengig vom Test hier relevant)
  await setRpe(page, 0, 0, 1, 8);
  await toggleDone(page, 0, 0, 1);
  await page.click('[data-action="toggle-complete"][data-di="0"]');
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForTimeout(300);
  // B79: Session Summary erscheint vor dem eigentlichen Tagesabschluss-Screen
  // und faengt Klicks ab, bis "Weiter" getippt wird; danach zeigt
  // _showCompletionScreen() einen weiteren, durch Klick dismissbaren Overlay
  // (#day-completion-screen, auto-dismiss nach 4s oder bei Klick).
  await page.click('#session-summary-continue');
  await page.waitForTimeout(200);
  const completionScreen = page.locator('#day-completion-screen');
  if (await completionScreen.isVisible().catch(() => false)) {
    await completionScreen.click();
  }
  await page.waitForTimeout(200);

  // Tag wieder oeffnen (toggle-complete auf einem markedDone-Tag entsperrt
  // direkt, ohne erneutes Modal) -- Set 0 ist weiterhin 'success' (nur
  // day.locked/markedDone werden umgeschaltet), Übernehmen-Snapshot muss
  // aber geloescht sein -> Button erscheint wieder statt der dauerhaften
  // "✓ Übernommen"-Bestätigung.
  await page.click('[data-action="toggle-complete"][data-di="0"]');
  await page.waitForTimeout(200);

  await expect(page.locator('[data-action="adopt-set-feedback"][data-si="0"]')).toBeVisible();
  await expect(page.locator('.set-feedback__line--confirm')).toHaveCount(0);
});
