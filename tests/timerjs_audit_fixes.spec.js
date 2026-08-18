import { test, expect } from '@playwright/test';

// Runde 38: erstes eigenständiges Audit von timer.js (bisher nie separat
// auditiert). 1 mittlerer Fund + 2 kosmetische, siehe
// `Diagnose & Sprints/diagnose-timerjs-audit-2026-08-18.txt`.
//
// F1 (MEDIUM): _dismissPause()/_stopSession() räumten bei einem
// Wochenwechsel bzw. manuellem Stopp während des 3-Sekunden-"WEITER!"-
// Popup-Fensters _goTimer/_goPopup nicht mit auf -- das Popup blieb bis zu
// 3s sichtbar auf einer bereits verlassenen Woche bzw. nach manuellem
// Session-Stopp. Fix: beide Funktionen räumen den Popup-Zustand jetzt
// synchron mit ab.
// F3 (LOW, kosmetisch): der "Nochmal tippen ✓"-Bestätigungshinweis beim
// Dismiss-Button trägt jetzt aria-live="polite", damit Screenreader-Nutzer
// die Anforderung angesagt bekommen.
// F2 (LOW, kosmetisch, kein Test): maxSessionMs-Default war doppelt
// hardcodiert (timer.js:142/193) -- jetzt eine gemeinsame Modulkonstante
// (DEFAULT_MAX_SESSION_MS). Reiner Wartbarkeits-Fix ohne beobachtbares
// Verhalten (die beiden Werte waren bereits konsistent), daher keine eigene
// Regression hier -- ein git-stash-Differenztest würde ohnehin nicht
// trennen.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx({ name = 'Kniebeuge', pauseSec = 1 } = {}) {
  // Zwei Sätze: der Pause-Timer startet nur nach einem NICHT-letzten Satz
  // (B78-Gating in timer.js' _bindAppInteractions()) -- ein einzelner Satz
  // würde nie eine Pause auslösen.
  return {
    name, note: '', pauseSec, metric: 'reps', weightStep: 2.5,
    sets: [
      { weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
      { weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' },
    ],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 2, targetReps: 8,
    progressionType: 'weight', archived: false, substituteFor: null,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, exercises) {
  return {
    id, startDate: todayISO(), note: '', mode: 'standard',
    days: [mkDay(id * 10, exercises)],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, weeks, curIdx = 0) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, curIdxArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: curIdxArg, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true, autoStartPauseTimer: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, { weeksArg: weeks, curIdxArg: curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function toggleDone(page, di, ei, si) {
  await page.click(`[data-action="toggle-done"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
}

test('F1: Wochenwechsel während des "WEITER!"-Popup-Fensters blendet das Popup sofort aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week0 = mkWeek(1, [mkEx({ pauseSec: 1 })]);
  const week1 = mkWeek(2, [mkEx({ pauseSec: 1 })]);
  await seed(page, [week0, week1], 0);

  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);

  // Pause läuft (pauseSec: 1) natürlich ab -> "WEITER!"-Popup erscheint.
  await page.waitForFunction(() => {
    const el = document.getElementById('go-popup');
    return el?.classList.contains('go-popup--visible');
  }, { timeout: 5000 });

  // Noch innerhalb des 3s-Auto-Hide-Fensters zur nächsten Woche wechseln.
  await page.click('[data-action="nav-next"]');

  // Vor dem Fix blieb das Popup bis zu 3s sichtbar; der Fix räumt es
  // synchron mit _dismissPause() im train:curIdx-Change-Handler auf.
  await expect(page.locator('#go-popup')).not.toHaveClass(/go-popup--visible/, { timeout: 300 });

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('F1: manuelles Stoppen der Session während des "WEITER!"-Popup-Fensters blendet das Popup sofort aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week0 = mkWeek(1, [mkEx({ pauseSec: 1 })]);
  await seed(page, [week0], 0);

  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);

  await page.waitForFunction(() => {
    const el = document.getElementById('go-popup');
    return el?.classList.contains('go-popup--visible');
  }, { timeout: 5000 });

  // Manueller Stopp über den Toolbar-Clock (_manualToggle -> _stopSession)
  // noch innerhalb des 3s-Fensters.
  await page.click('#toolbar-session-timer');

  await expect(page.locator('#go-popup')).not.toHaveClass(/go-popup--visible/, { timeout: 300 });

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('F3: Dismiss-Bestätigungshinweis ist eine aria-live-Region', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week0 = mkWeek(1, [mkEx({ pauseSec: 90 })]);
  await seed(page, [week0], 0);

  await toggleDone(page, 0, 0, 0);
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);

  const hint = page.locator('.pause-overlay__label span');
  await expect(hint).toHaveAttribute('aria-live', 'polite');

  // Erster Tap zeigt den Bestätigungshinweis -- muss dieselbe Live-Region
  // bleiben (nicht neu erzeugt ohne das Attribut).
  await page.click('#pause-dismiss-btn');
  await expect(hint).toHaveText('Nochmal tippen ✓');
  await expect(hint).toHaveAttribute('aria-live', 'polite');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
