import { test, expect } from '@playwright/test';

// B195 (Runde 10, Domäne B): `_findRecentInjurySkipExercise()` (ui.js, füttert
// die bedingte "Wie fühlt sich X heute an?"-Nachfrage im Session-Check-in,
// B129) verglich bisher die VOLLE aktuelle Uhrzeit gegen Mitternacht des
// Skip-Datums — dasselbe Off-by-one-Risiko wie B147 (weeklyFocus.js
// _checkInjuryReminder(), dort bereits noon-normiert gefixt). Dieser Test
// fixiert die Uhrzeit auf kurz vor Mitternacht (23:30), wo der alte Fehler
// am ehesten sichtbar wurde (voller Tagesunterschied vs. Mitternacht-
// Skip-Datum rundet einen Tag zu viel).

const FIXED_NOW = new Date('2026-01-19T23:30:00'); // Montag, 14/15 Tage nach den Test-Skip-Daten unten

function isoDaysBefore(n) {
  const d = new Date(FIXED_NOW);
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function mkExercise(name, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 80, reps: 5, rpe: 7, status: 'fail', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    skipReason: null, skipDate: null,
    targetReps: 5, progressionType: 'weight',
    progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    ...overrides,
  };
}

function mkDay(id, exercises, overrides = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    ...overrides,
  };
}

async function seed(page, skipDate) {
  await page.clock.install({ time: FIXED_NOW });
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const oldWeek = {
    id: 1, startDate: '2026-01-05', note: '', mode: 'standard',
    days: [mkDay(1, [mkExercise('Kniebeuge', {
      skipReason: 'injury', skipDate, sets: [{ weight: 0, reps: 0, rpe: null, status: 'pending', done: false, note: '' }],
    })])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
  const activeWeek = {
    id: 2, startDate: '2026-01-19', note: '', mode: 'standard',
    days: [mkDay(11, [mkExercise('Kniebeuge')])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };

  await page.evaluate(({ oldWeek, activeWeek }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 1, weeks: [oldWeek, activeWeek],
      customTemplate: [], settings: { sessionCoach: true }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  }, { oldWeek, activeWeek });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Verletzungs-Skip vor genau 14 Tagen (23:30 Uhr): Nachfrage erscheint noch', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await seed(page, isoDaysBefore(14));
  await page.click('[data-day-hdr]');
  await page.waitForTimeout(300);

  await expect(page.locator('.session-checkin-card__label', { hasText: 'Wie fühlt sich Kniebeuge heute an?' })).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Verletzungs-Skip vor genau 15 Tagen (23:30 Uhr): Nachfrage erscheint NICHT mehr', async ({ page }) => {
  await seed(page, isoDaysBefore(15));
  await page.click('[data-day-hdr]');
  await page.waitForTimeout(300);

  await expect(page.locator('.session-checkin-card__label', { hasText: 'Wie fühlt sich Kniebeuge heute an?' })).toHaveCount(0);
});
