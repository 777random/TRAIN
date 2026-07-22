import { test, expect } from '@playwright/test';

// B76: Pre-Session Check-in + Session Briefing. SCHEMA 31->32.

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function openDay(id, weight = 80) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [{
      name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
      sets: [
        { weight, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
        { weight, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
      ],
      prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 2, targetReps: 5,
      progressionType: 'weight', archived: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { sessionCoach = true, prevWeekRpe = null } = {}) {
  const days = [openDay(11)];
  const weeks = [{
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }];
  if (prevWeekRpe != null) {
    weeks.unshift({
      id: 0, startDate: '2000-01-03', note: '', mode: 'standard',
      days: [{
        id: 5, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
        locked: true, markedDone: true, isVacation: false,
        sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
        sessionCheckIn: null, sessionModifier: null,
        exercises: [{
          name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
          sets: [{ weight: 80, reps: 5, rpe: prevWeekRpe, status: 'success', done: true, note: '' }],
          prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
          nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
          progressionType: 'weight', archived: false,
        }],
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
  }
  await page.evaluate(({ weeksArg, sessionCoach }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: { sessionCoach },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, favoriteExercises: [],
    }));
  }, { weeksArg: weeks, sessionCoach });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Check-in erscheint beim heutigen offenen Tag, Migration hebt SCHEMA auf 32', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  await expect(page.locator('.session-checkin-card')).toBeVisible();
  await expect(page.locator('.session-briefing-card')).toHaveCount(0);

  const schemaVersion = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).meta.schemaVersion);
  expect(schemaVersion).toBe(32);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Zwei Taps (Schlaf + Energie) reichen, Briefing erscheint danach, Check-in nie wieder', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  await page.click('[data-action="session-checkin-select"][data-field="sleep"][data-val="great"]');
  await expect(page.locator('.session-checkin-card')).toBeVisible(); // noch da, erst 1 von 2 Feldern
  await page.click('[data-action="session-checkin-select"][data-field="energyPre"][data-val="high"]');

  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card')).toBeVisible();
  await expect(page.locator('.session-briefing-card__msg')).toContainText('Optimale Voraussetzungen');

  const checkIn = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].sessionCheckIn);
  expect(checkIn.sleep).toBe('great');
  expect(checkIn.energyPre).toBe('high');

  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card')).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('"Überspringen" blendet Check-in aus, Briefing zeigt Standardwerte', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  await page.click('[data-action="session-checkin-skip"]');
  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card__msg')).toContainText('Normales Training');

  const checkIn = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0].sessionCheckIn);
  expect(checkIn).toBeNull();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// B83: _skippedCheckIn (ui.js, Modul-Set) war bisher nach Tag-ARRAY-INDEX
// geschlüsselt, nicht nach der stabilen day.id — ein Index ist über Wochen
// hinweg wiederverwendbar (Tag-Index 0 existiert in jeder neuen Woche neu).
// Ohne Reload zwischen zwei Wochen (z.B. manuelles "Neue Woche" erstellen,
// ohne die Seite neu zu laden) hätte ein "Überspringen" in der alten Woche
// den Check-in der neuen Woche am gleichen Index fälschlich mit-übersprungen.
test('B83: "Überspringen" in einer Woche überspringt NICHT den Check-in der nächsten Woche (ohne Reload)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  // Check-in der aktuellen (ersten) Woche überspringen.
  await page.click('[data-action="session-checkin-skip"]');
  await expect(page.locator('.session-checkin-card')).toHaveCount(0);

  // Neue Woche erstellen -- OHNE Seiten-Reload, damit das In-Memory-
  // _skippedCheckIn-Set aus der vorherigen Woche bestehen bleibt. Kein
  // Wochenrückblick-Zwischenschritt, da der Seed-Tag nicht markedDone ist
  // (open-new-week zeigt .wr-modal nur wenn die letzte Woche einen
  // abgeschlossenen Tag hat).
  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');

  // Die neue Woche klont day.id vom Vorlagen-Tag (WEEK_CREATE, state.js
  // clone(lastWeek.days) -- day.id bleibt bewusst über Wochen hinweg
  // stabil, repräsentiert denselben wiederkehrenden Wochenplan-Slot).
  // sessionCheckIn wird beim Klonen aber zurückgesetzt (_resetClonedDays) --
  // der Check-in muss dafür erneut erscheinen, nicht durch die alte Woche
  // (andere wk.id) als "übersprungen" gelten.
  await expect(page.locator('.session-checkin-card')).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Schlecht geschlafen -> modifier reduced, Gewichte -10% gerundet auf weightStep, RPE-Ziel -1', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { prevWeekRpe: 8 });

  await page.click('[data-action="session-checkin-select"][data-field="sleep"][data-val="poor"]');
  await page.click('[data-action="session-checkin-select"][data-field="energyPre"][data-val="medium"]');

  await expect(page.locator('.session-briefing-card__msg')).toContainText('Heute reduzieren');
  await expect(page.locator('.session-briefing-card__focus')).toContainText('RPE 7'); // 8 - 1

  const day = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.at(-1).days[0]);
  expect(day.sessionModifier).toBe('reduced');
  // 80kg * 0.9 = 72, gerundet auf weightStep 5 -> 70
  expect(day.exercises[0].sets[0].weight).toBe(70);
  expect(day.exercises[0].sets[1].weight).toBe(70);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('sessionCoach=false: kein Check-in, kein Briefing', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, { sessionCoach: false });

  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Toggle "Session Coach" in den Einstellungen ist vorhanden und schaltbar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page);

  await page.click('[data-tab="settings"]');
  const toggle = page.locator('[data-action="toggle-setting"][data-key="sessionCoach"]');
  await expect(toggle).toHaveClass(/is-on/);
  await toggle.click();
  await expect(toggle).not.toHaveClass(/is-on/);

  await page.click('[data-tab="workout"]');
  await expect(page.locator('.session-checkin-card')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
