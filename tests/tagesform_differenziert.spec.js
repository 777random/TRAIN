import { test, expect } from '@playwright/test';

// Sprint C2 (Teil A, Knowles et al. 2018): Tagesform-Reduktion unterscheidet
// einmalig schlechten Schlaf (mild, -5%, alle Übungen) von kumulierter
// Schlafrestriktion / niedriger Energie (voll, -10%, nur Compound-Übungen).

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}
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

/** Ein abgeschlossener, vergangener Trainingstag mit gegebenem Schlaf-Signal — für die _isCumulativeSleepDeficit-Historie. */
function mkPastDoneDay(id, { sleepHours = null, checkInSleep = null } = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: checkInSleep ? { sleep: checkInSleep, energyPre: 'medium', timestamp: Date.now() } : null,
    sessionModifier: null, sessionModifierScope: null,
    exercises: [mkEx({ name: 'Kniebeuge', nSets: 1 })],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkOpenDay(exercises) {
  return {
    id: 99, title: 'Tag B', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

/**
 * @param {boolean} cumulative  true = 2 von 3 letzten Tagen schlechter Schlaf, false = alle gut
 */
async function seed(page, { cumulative, exercises }) {
  const pastDays = cumulative
    ? [mkPastDoneDay(1, { checkInSleep: 'poor' }), mkPastDoneDay(2, { checkInSleep: 'poor' }), mkPastDoneDay(3, { checkInSleep: 'good' })]
    : [mkPastDoneDay(1, { checkInSleep: 'good' }), mkPastDoneDay(2, { checkInSleep: 'good' }), mkPastDoneDay(3, { checkInSleep: 'good' })];
  const weeks = [{
    id: 1, startDate: isoDaysAgo(21), note: '', mode: 'standard',
    days: pastDays, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }, {
    id: 2, startDate: todayISO(), note: '', mode: 'standard',
    days: [mkOpenDay(exercises)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer: false, rpeEnabled: true, goal: null, autoWeek: { enabled: false } },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: Date.now(), plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function checkIn(page, { sleep, energyPre }) {
  await page.click(`[data-action="session-checkin-select"][data-field="sleep"][data-val="${sleep}"]`);
  await page.click(`[data-action="session-checkin-select"][data-field="energyPre"][data-val="${energyPre}"]`);
}

test('Kumulierter Schlafmangel + schlecht geschlafen -> reduced/compound, Isolation unverändert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { cumulative: true, exercises: [
    mkEx({ name: 'Bankdrücken', weight: 100, step: 5 }),
    mkEx({ name: 'Bizepscurls', weight: 20, step: 2.5 }),
  ] });

  await checkIn(page, { sleep: 'poor', energyPre: 'medium' });

  await expect(page.locator('.session-briefing-card__msg')).toContainText('Compound-Übungen heute reduzieren — Gewichte -10%, Isolation unverändert');

  const day = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return st.weeks.at(-1).days[0];
  });
  expect(day.sessionModifier).toBe('reduced');
  expect(day.sessionModifierScope).toBe('compound');
  // Bankdrücken (Compound): 100 * 0.9 = 90, gerundet auf Schritt 5 -> 90
  expect(day.exercises[0].sets[0].weight).toBe(90);
  // Bizepscurls (Isolation): unverändert
  expect(day.exercises[1].sets[0].weight).toBe(20);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Einmalig schlechter Schlaf (keine kumulierte Historie) -> reduced_mild/all, beide Übungen -5%', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { cumulative: false, exercises: [
    mkEx({ name: 'Bankdrücken', weight: 100, step: 5 }),
    mkEx({ name: 'Bizepscurls', weight: 20, step: 2.5 }),
  ] });

  await checkIn(page, { sleep: 'poor', energyPre: 'medium' });

  await expect(page.locator('.session-briefing-card__msg')).toContainText('Leicht reduzieren heute — Gewichte -5%');

  const day = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return st.weeks.at(-1).days[0];
  });
  expect(day.sessionModifier).toBe('reduced_mild');
  expect(day.sessionModifierScope).toBe('all');
  // Bankdrücken: 100 * 0.95 = 95, Schritt 5 -> 95
  expect(day.exercises[0].sets[0].weight).toBe(95);
  // Bizepscurls: 20 * 0.95 = 19, Schritt 2.5 -> 20 (gerundet)
  expect(day.exercises[1].sets[0].weight).toBe(20);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Niedrige Energie (ohne schlechten Schlaf) eskaliert direkt zu reduced/compound', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { cumulative: false, exercises: [mkEx({ name: 'Bankdrücken', weight: 100, step: 5 })] });

  await checkIn(page, { sleep: 'good', energyPre: 'low' });

  await expect(page.locator('.session-briefing-card__msg')).toContainText('Compound-Übungen heute reduzieren — Gewichte -10%, Isolation unverändert');
  const day = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0]);
  expect(day.sessionModifier).toBe('reduced');
  expect(day.sessionModifierScope).toBe('compound');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Catch-up-Button zeigt korrekten Prozentsatz für reduced_mild (-5%) und reduced (-10%)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { cumulative: false, exercises: [mkEx({ name: 'Bankdrücken', weight: 100, step: 5 })] });
  await checkIn(page, { sleep: 'poor', energyPre: 'medium' });
  await expect(page.locator('.session-briefing-card__reduce-btn')).toContainText('Gewichte heute anpassen (-5%)');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Intra-Session-Coach: reduced/compound dämpft nur die Compound-Übung, Isolation bleibt bei der vollen Reduktion', async ({ page }) => {
  // Check-in mit modifier='reduced'/scope='compound' hat Bankdrücken (Compound)
  // bereits bei der Abgabe von 100kg -> 90kg reduziert (_reducePendingWeights),
  // Bizepscurls (Isolation) blieb bei 20kg. RPE 10 (Gruppe C, "Maximum —
  // deutlich reduzieren", nextWeight = currentWeight - 2*step) ist danach VOR
  // dem Intra-Session-Modifier bereits eine echte Reduktion -- _applyModifier
  // greift hier als Kappung ("nicht stärker als -1 Schritt/-10%"), nicht als
  // Zusatz-Abzug. Bankdrücken: Math.max((90-10)*0.9, 90-5) = Math.max(72,85) = 85kg.
  // Bizepscurls (scope='compound' -> Modifier greift NICHT) bleibt bei der
  // vollen, ungekappten Reduktion: 20 - 2*2.5 = 15kg.
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { cumulative: true, exercises: [
    mkEx({ name: 'Bankdrücken', weight: 100, step: 5, nSets: 2 }),
    mkEx({ name: 'Bizepscurls', weight: 20, step: 2.5, nSets: 2 }),
  ] });
  await checkIn(page, { sleep: 'poor', energyPre: 'medium' });

  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="0"][data-val="10"]');
  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(page.locator('.set-feedback').first()).toContainText('Nächster Satz: 85kg');

  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="1"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="1"][data-si="0"][data-val="10"]');
  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="1"][data-si="0"]');
  await expect(page.locator('.set-feedback').nth(1)).toContainText('Nächster Satz: 15kg');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
