import { test, expect } from '@playwright/test';

// B82: Session Coach (Pre-Session Check-in, Intra-Session Feedback,
// Pause-Timer-Empfehlung) erschien nie bei einem 3x/Woche-Split (z.B.
// Mo/Mi/Fr), da _isTodayDay(wk, di) das Datum eines Tages rein aus seinem
// Array-Index ableitete (wk.startDate + di Tage) statt "offener Tag der
// aktuellen Woche" zu prüfen. Diese Tests bauen exakt das Mo/Mi/Fr-
// Szenario aus der Diagnose nach: die aktive Übung liegt an Tag-Index 2
// ("Freitag" gemeint), was die alte Implementierung immer als Mittwoch
// missinterpretiert hätte.

function buildExercise(status = 'pending') {
  return {
    name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps',
    sets: [{ weight: 60, reps: 8, rpe: null, status, done: status !== 'pending' }],
    weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
    targetReps: 8, progressionType: 'weight', archived: false, substituteFor: null,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    progressionMode: 'weight_first', targetRepsMax: null,
  };
}

function makeDay(idx, { markedDone = false, withExercise = true } = {}) {
  return {
    id: 100 + idx, title: `Tag ${idx}`, subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: withExercise ? [buildExercise(markedDone ? 'success' : 'pending')] : [],
  };
}

async function seedTwoWeekState(page, { activeWeekDays, curIdx, oldWeekDone = true }) {
  return page.evaluate(({ activeWeekDays, curIdx, oldWeekDone }) => {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
    const activeStart = monday.toISOString().slice(0, 10);
    const oldMonday = new Date(monday);
    oldMonday.setDate(oldMonday.getDate() - 7);
    const oldStart = oldMonday.toISOString().slice(0, 10);

    const oldWeek = {
      id: 1, startDate: oldStart, note: '', mode: 'standard',
      days: [{
        id: 1, title: 'Alte Woche Tag', subtitle: '', warmup: '', cooldown: '',
        locked: oldWeekDone, markedDone: oldWeekDone, isVacation: false,
        sleepHours: null, energyLevel: null, sessionRating: null,
        sessionCheckIn: null, sessionModifier: null,
        exercises: [{
          name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps',
          sets: [{ weight: 80, reps: 5, rpe: null, status: oldWeekDone ? 'success' : 'pending', done: oldWeekDone }],
          weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
          targetReps: 5, progressionType: 'weight', archived: false, substituteFor: null,
          prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
          progressionMode: 'weight_first', targetRepsMax: null,
        }],
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    };

    const activeWeek = {
      id: 2, startDate: activeStart, note: '', mode: 'standard',
      days: activeWeekDays,
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    };

    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: today.toISOString(), createdAt: today.toISOString() },
      curIdx,
      weeks: [oldWeek, activeWeek],
      customTemplate: [], settings: { sessionCoach: true }, prs: {},
      coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_v6_shadow', 'x');
    return { activeStart, oldStart };
  }, { activeWeekDays, curIdx, oldWeekDone });
}

test('Mo/Mi/Fr-Split: Session Coach erscheint für den offenen Tag an Index 2 (aktuelle Woche)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // 3 Tage: Index 0/1 "Ruhetage" (keine Übungen), Index 2 die trainierte
  // Einheit ("Freitag" gemeint) — genau das Diagnose-Szenario.
  const days = [makeDay(0, { withExercise: false }), makeDay(1, { withExercise: false }), makeDay(2)];
  await seedTwoWeekState(page, { activeWeekDays: days, curIdx: 1 });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const tabs = page.locator('[data-day-hdr]');
  await tabs.nth(2).click();
  await page.waitForTimeout(300);

  const checkin = await page.locator('.session-checkin-card').count();
  const briefing = await page.locator('.session-briefing-card').count();
  expect(checkin + briefing).toBeGreaterThan(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Abgeschlossener Tag (markedDone): kein Check-in, kein Feedback', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const days = [makeDay(0, { withExercise: false }), makeDay(1, { withExercise: false }), makeDay(2, { markedDone: true })];
  await seedTwoWeekState(page, { activeWeekDays: days, curIdx: 1 });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const tabs = page.locator('[data-day-hdr]');
  await tabs.nth(2).click();
  await page.waitForTimeout(300);

  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card')).toHaveCount(0);
});

test('Vergangene Woche (nach Zurück-Navigation): kein Session Coach, auch bei offenem Tag', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const days = [makeDay(0, { withExercise: false }), makeDay(1, { withExercise: false }), makeDay(2)];
  // Alte Woche bewusst NICHT abgeschlossen (oldWeekDone: false), damit ihr
  // einziger Tag offen ist -- die einzige Bedingung, die ihn trotzdem
  // ausblenden darf, ist "nicht die aktuelle/letzte Woche".
  await seedTwoWeekState(page, { activeWeekDays: days, curIdx: 1, oldWeekDone: false });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="nav-prev"]');
  await page.waitForTimeout(300);

  await expect(page.locator('.session-checkin-card')).toHaveCount(0);
  await expect(page.locator('.session-briefing-card')).toHaveCount(0);
});

test('Zwei gleichzeitig offene Tage in der aktuellen Woche zeigen beide Session Coach', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const days = [makeDay(0), makeDay(1, { withExercise: false }), makeDay(2)];
  await seedTwoWeekState(page, { activeWeekDays: days, curIdx: 1 });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const tabs = page.locator('[data-day-hdr]');

  await tabs.nth(0).click();
  await page.waitForTimeout(300);
  const first = await page.locator('.session-checkin-card, .session-briefing-card').count();
  expect(first).toBeGreaterThan(0);

  await tabs.nth(2).click();
  await page.waitForTimeout(300);
  const second = await page.locator('.session-checkin-card, .session-briefing-card').count();
  expect(second).toBeGreaterThan(0);
});

test('Intra-Session Feedback erscheint nach Satz + RPE im offenen Tag der aktuellen Woche', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const days = [makeDay(0, { withExercise: false }), makeDay(1, { withExercise: false }), makeDay(2)];
  await seedTwoWeekState(page, { activeWeekDays: days, curIdx: 1 });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.locator('[data-day-hdr]').nth(2).click();
  await page.waitForTimeout(300);

  await page.fill('[data-action="set-reps"]', '8');
  const rpeBtn = page.locator('[data-action="open-rpe-popover"]').first();
  await rpeBtn.click();
  await page.locator('[data-action="set-rpe-val"][data-val="7"]').first().click();
  await page.locator('[data-action="toggle-done"]').first().click();
  await page.waitForTimeout(300);

  await expect(page.locator('.set-feedback')).toHaveCount(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
