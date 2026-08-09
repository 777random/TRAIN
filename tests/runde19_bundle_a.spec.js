import { test, expect } from '@playwright/test';

// Runde 19, Bundle A: Session-Coach-Icon-Buttons (Cluster 1), Pausenzeit-
// Automatik bei Default vs. manueller Übungseinstellung (Cluster 2),
// "Ton nach Pause"-Aktivierungs-Bug (Cluster 3). Siehe
// Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde19.md.

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function mkEx({ name = 'Bankdrücken', weight = 100, step = 5, targetReps = 5, nSets = 2, pauseSec = 90, pauseSecManual = false } = {}) {
  const sets = [];
  for (let i = 0; i < nSets; i++) {
    sets.push({ weight, reps: targetReps, rpe: null, status: 'pending', done: false, note: '' });
  }
  return {
    name, note: '', pauseSec, pauseSecManual, metric: 'reps', weightStep: step,
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

async function seed(page, { exercises, autoStartPauseTimer = true, sessionCoach = true, settingsOverrides = {} } = {}) {
  const day = mkDay(exercises);
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate(({ weeksArg, autoStartPauseTimer, sessionCoach, settingsOverrides }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach, autoStartPauseTimer, rpeEnabled: true, goal: 'kraftaufbau', ...settingsOverrides },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, autoStartPauseTimer, sessionCoach, settingsOverrides });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function setRpe(page, di, ei, si, val) {
  await page.click(`[data-action="open-rpe-popover"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
  await page.click(`[data-action="set-rpe-val"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"][data-val="${val}"]`);
}

async function confirmSet(page, di, ei) {
  await page.click(`[data-action="confirm-set"][data-di="${di}"][data-ei="${ei}"]`);
}

async function expectPauseNum(page, expectedMax) {
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const num = Number(await page.locator('#pause-ring-num').textContent());
  expect(num).toBeGreaterThanOrEqual(expectedMax - 3);
  expect(num).toBeLessThanOrEqual(expectedMax);
}

// ── Cluster 2: Pausenzeit-Automatik ────────────────────────────────────────

test('Cluster 2: Default (keine manuelle Pausenzeit) -- Session-Coach-Vorschlag startet automatisch, kein Klick nötig', async ({ page }) => {
  // RPE 8 + Compound + goal=kraftaufbau -> dynamische Empfehlung 180s
  // (identische Matrix wie session_coach_pause_matrix.spec.js AC1), NICHT
  // das statische ex.pauseSec=90.
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ pauseSec: 90, pauseSecManual: false })], autoStartPauseTimer: true });
  await setRpe(page, 0, 0, 0, 8);
  await confirmSet(page, 0, 0);
  await expectPauseNum(page, 180);
});

test('Cluster 2: manuell gesetzte Pausenzeit (pauseSecManual) overrult die dynamische Empfehlung', async ({ page }) => {
  // Gleiches RPE-8-Compound-Szenario wie oben (würde dynamisch 180s ergeben),
  // aber pauseSecManual=true -> muss stattdessen exakt ex.pauseSec (45s) nutzen.
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ pauseSec: 45, pauseSecManual: true })], autoStartPauseTimer: true });
  await setRpe(page, 0, 0, 0, 8);
  await confirmSet(page, 0, 0);
  await expectPauseNum(page, 45);
});

// ── Cluster 1: Icon-Buttons statt Text-Pille ───────────────────────────────

test('Cluster 1: Übernehmen/Ignorieren als Haken/X-Icons mit >=44px Touch-Target', async ({ page }) => {
  // RPE 6, Ziel erreicht -> canAdopt=true (nextWeight steigt gegenüber currentWeight).
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ pauseSec: 90, pauseSecManual: false })], autoStartPauseTimer: false });
  await setRpe(page, 0, 0, 0, 6);
  await confirmSet(page, 0, 0);

  const accept = page.locator('[data-action="adopt-set-feedback"][data-di="0"][data-ei="0"][data-si="0"]');
  const reject = page.locator('[data-action="dismiss-set-feedback"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(accept).toBeVisible();
  await expect(reject).toBeVisible();
  const acceptBox = await accept.boundingBox();
  const rejectBox = await reject.boundingBox();
  expect(acceptBox.width).toBeGreaterThanOrEqual(44);
  expect(acceptBox.height).toBeGreaterThanOrEqual(44);
  expect(rejectBox.width).toBeGreaterThanOrEqual(44);
  expect(rejectBox.height).toBeGreaterThanOrEqual(44);

  // Reject blendet nur die Accept/Reject-Zeile aus, kein State-Write.
  await reject.click();
  await expect(accept).toHaveCount(0);
  await expect(reject).toHaveCount(0);
});

test('Cluster 1: Haken übernimmt weiterhin Gewicht + startet Pause (Regressionsschutz B89/B94)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx({ pauseSec: 90, pauseSecManual: false, nSets: 3 })], autoStartPauseTimer: false });
  await setRpe(page, 0, 0, 0, 6);
  await confirmSet(page, 0, 0);
  const accept = page.locator('[data-action="adopt-set-feedback"][data-di="0"][data-ei="0"][data-si="0"]');
  await accept.click();
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);
  const nextWeightInput = page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="1"]');
  await expect(nextWeightInput).toHaveValue('105');
});

// ── Cluster 3: "Ton nach Pause" aktiviert sich nicht ───────────────────────

test('Cluster 3: soundEnabled-Toggle funktioniert jetzt auch OHNE vorherige Seed (Regression: Key fehlte in Settings-Defaults/migrate())', async ({ page }) => {
  // Bewusst OHNE soundEnabled in den Settings geseedet -- entspricht dem
  // echten Bug: state.settings hatte den Key vor diesem Fix nie, SETTING_TOGGLE
  // (state.js) toggled nur Keys, die bereits vorhanden sind ('in'-Guard).
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { exercises: [mkEx()], settingsOverrides: {} });
  const val0 = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.soundEnabled);
  expect(val0).toBe(false); // migrate()-Backfill greift bereits vor jedem Toggle-Klick

  const toggle = page.locator('[data-action="toggle-setting"][data-key="soundEnabled"]');
  await page.click('[data-tab="settings"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).not.toHaveClass(/is-on/);
  await toggle.click();
  await expect(toggle).toHaveClass(/is-on/);
  const val = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.soundEnabled);
  expect(val).toBe(true);
});
