import { test, expect } from '@playwright/test';

// Launch-Roadmap Phase B, Kategorie 5 (Einstellungs-Kombinationen), Szenario
// 19/20 (alle optionalen Features gleichzeitig AUS/AN). Ziel: Kombinationen
// finden, die niemand einzeln testet -- jeder Toggle hat bereits einen
// eigenen Einzeltest (z.B. session_coach.spec.js, stopwatch_toggle.spec.js,
// streak_toggle.spec.js), aber keine ALLE gleichzeitig.

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, weight, status = 'success', rpe = 7) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [
      { weight, reps: 5, rpe, status, done: status === 'success', note: '' },
      { weight, reps: 5, rpe, status, done: status === 'success', note: '' },
    ],
    prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 2, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, markedDone = true) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '5 Min Aufwärmen', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: 7, energyLevel: 4, sessionStartTs: Date.now() - 3600_000, sessionEndTs: markedDone ? Date.now() : null,
    sessionCheckIn: { sleep: 'good', energyPre: 'good', timestamp: Date.now() }, sessionModifier: null,
    exercises: [mkEx('Kniebeuge', 80), mkEx('Bankdrücken', 60)],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function buildWeeks() {
  const weeks = [];
  // Erste 3 Wochen fertig -- letzte Woche bewusst NICHT abgeschlossen
  // (markedDone:false), damit autoWeek.showReview/suggestProgress keinen
  // Wochenübergangs-Modal-Chain (Wochenrückblick -> Neue-Woche-Vorschlag,
  // ui.js:5856) auslöst -- der ist ein eigenes, bereits andernorts
  // getestetes Feature, nicht Teil dieses Toggle-Interaktions-Tests.
  for (let i = 0; i < 4; i++) {
    const done = i < 3;
    weeks.push({
      id: i + 1, startDate: weeksAgoISO(3 - i), note: '', mode: 'standard',
      days: [mkDay(i * 10 + 1, done)], sessionLog: [], bodyData: { weightLog: [{ date: weeksAgoISO(3 - i), weight: 80 }] },
      restDays: [], isSeedWeek: false,
    });
  }
  return weeks;
}

const ALL_TOGGLES_OFF = {
  sessionCoach: false, rpeEnabled: false, autoEval: false, autoStartPauseTimer: false,
  hideStopwatch: false, vibrationEnabled: false, swipe: false, hideStreakBadge: false,
  autoWeek: { enabled: false, suggestProgress: false, showReview: false },
};
const ALL_TOGGLES_ON = {
  sessionCoach: true, rpeEnabled: true, autoEval: true, autoStartPauseTimer: true,
  hideStopwatch: true, vibrationEnabled: true, swipe: true, hideStreakBadge: true,
  autoWeek: { enabled: true, suggestProgress: true, showReview: true },
};

async function seedAndVisitAllTabs(page, settingsOverride, pageErrors) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, settingsArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg,
      customTemplate: [], settings: settingsArg,
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 3, seenTips: [],
    }));
  }, { weeksArg: buildWeeks(), settingsArg: settingsOverride });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Mit autoWeek.enabled/showReview/suggestProgress=true kann beim Laden
  // eine Kette automatischer Modals aufgehen (Wochenrückblick ->
  // "Weiter →" -> Neue-Woche-Vorschlag, ui.js:5856) -- bewusstes,
  // andernorts bereits getestetes Feature, hier nur generisch abzuräumen,
  // damit die eigentliche Toggle-Interaktions-Prüfung (worum es in diesem
  // Test geht) nicht daran hängen bleibt. Modal-Elemente bleiben im DOM
  // (wiederverwendet), nur 'is-open' steuert Sichtbarkeit -- deshalb
  // gezielt auf ".is-open"-Overlays mit ihrem jeweiligen primären Button
  // prüfen, nicht nur auf Existenz.
  const dismissOpenModalsIfAny = async () => {
    for (let i = 0; i < 6; i++) {
      const wrContinue = page.locator('#modal-week-review.is-open #wr-btn-continue');
      if (await wrContinue.count() > 0) { await wrContinue.click(); await page.waitForTimeout(300); continue; }
      const nwCancel = page.locator('#modal-new-week.is-open [data-action="close-modal"]');
      if (await nwCancel.count() > 0) { await nwCancel.click(); await page.waitForTimeout(300); continue; }
      return;
    }
  };

  await page.waitForTimeout(500);
  await dismissOpenModalsIfAny();

  for (const tab of ['workout', 'coach', 'progress', 'body', 'settings']) {
    await dismissOpenModalsIfAny();
    await page.click(`[data-tab="${tab}"]`);
    await page.waitForTimeout(300);
    await dismissOpenModalsIfAny();
    await expect(page.locator('#app')).toBeVisible();
  }
}

// Szenario 19: alle optionalen Features gleichzeitig AUS.
test('Szenario 19: alle optionalen Toggles gleichzeitig AUS -- App bleibt in allen Tabs bedienbar, kein Crash', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedAndVisitAllTabs(page, ALL_TOGGLES_OFF, pageErrors);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Szenario 20: alle optionalen Features gleichzeitig AN.
test('Szenario 20: alle optionalen Toggles gleichzeitig AN -- App bleibt in allen Tabs bedienbar, kein Crash, kein doppeltes Overlay', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seedAndVisitAllTabs(page, ALL_TOGGLES_ON, pageErrors);

  // Stichprobe auf "zwei Overlays gleichzeitig": Session-Timer + Aufwärm-
  // Empfehlung + Coach-Karten sollten gleichzeitig existieren dürfen, aber
  // es darf nur EIN aktives Modal/Overlay gleichzeitig offen sein.
  const openModals = await page.locator('.modal-overlay.is-open, .vac-plan-modal-overlay').count();
  expect(openModals).toBeLessThanOrEqual(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
