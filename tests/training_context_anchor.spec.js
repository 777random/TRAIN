import { test, expect } from '@playwright/test';

// B100 (train-v209): "Letzte Einheit: vor X Tagen" (_trainingContextAnchor(),
// ui.js) schätzte das Datum des zuletzt trainierten Tages bisher rein aus dem
// Array-Index (_dayDate(): startDate + dayIdx Kalendertage) -- korrekt nur,
// wenn an jedem Wochentag in Array-Reihenfolge trainiert wird. Bei Splits
// ohne tägliches Training (z.B. Mo/Mi/Fr) rutscht die Schätzung um einen Tag
// pro übersprungenem Tag, genau das gemeldete Verhalten. Fix: ein echter
// Zeitstempel existiert bereits (day.sessionEndTs, seit SCHEMA 12 bei jedem
// Tagesabschluss gesetzt, DAY_TOGGLE_COMPLETE state.js) -- _realDayDate()
// nutzt ihn bevorzugt (kein neues Feld, keine state.js-Änderung nötig),
// sessionStartTs als zweiter Fallback, die alte Index-Schätzung nur noch für
// Alt-Daten ganz ohne Zeitstempel.

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

function epochNoonDaysAgo(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.getTime();
}

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

function makeDay(id, title, { markedDone = false, sessionStartTs = null, sessionEndTs = null, evaluated = false } = {}) {
  return {
    id, title, subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    sessionStartTs, sessionEndTs,
    exercises: [buildExercise(markedDone || evaluated ? 'success' : 'pending')],
  };
}

async function seedWeek(page, days, startDate) {
  await page.evaluate(({ days, startDate }) => {
    const now = new Date().toISOString();
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: now, createdAt: now },
      curIdx: 0,
      weeks: [{
        id: 1, startDate, note: '', mode: 'standard', days,
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      customTemplate: [], settings: { sessionCoach: true }, prs: {},
      coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_v6_shadow', 'x');
  }, { days, startDate });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function openDay(page, idx) {
  await page.locator('[data-day-hdr]').nth(idx).click();
  await page.waitForTimeout(200);
}

async function anchorText(page) {
  return page.locator('.ritual-anchor__row').first().textContent();
}

test('Mo/Mi/Fr-Split: echter Zeitstempel (sessionEndTs) schlägt die alte Array-Index-Schätzung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // startDate 10 Tage in der Vergangenheit. Tag A (Index 0) vor 5 Tagen
  // abgeschlossen, Tag B (Index 1) vor 2 Tagen -- die alte Index-Schätzung
  // hätte Tag B fälschlich auf startDate+1 (= vor 9 Tagen) gelegt.
  const days = [
    makeDay(1, 'Tag A', { markedDone: true, sessionEndTs: epochNoonDaysAgo(5) }),
    makeDay(2, 'Tag B', { markedDone: true, sessionEndTs: epochNoonDaysAgo(2) }),
    makeDay(3, 'Tag C'),
  ];
  await seedWeek(page, days, isoDaysAgo(10));

  await openDay(page, 2);
  const text = await anchorText(page);
  expect(text).toContain('vor 2 Tagen');
  expect(text).not.toContain('vor 9 Tagen');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('"gestern" basiert auf echtem sessionEndTs, nicht auf Index-Schätzung', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const days = [
    makeDay(1, 'Tag A', { markedDone: true, sessionEndTs: epochNoonDaysAgo(1) }),
    makeDay(2, 'Tag B'),
  ];
  await seedWeek(page, days, isoDaysAgo(10));

  await openDay(page, 1);
  const text = await anchorText(page);
  expect(text).toContain('gestern');
});

test('"heute" wenn sessionEndTs auf den aktuellen Tag fällt', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const days = [
    makeDay(1, 'Tag A', { markedDone: true, sessionEndTs: epochNoonDaysAgo(0) }),
    makeDay(2, 'Tag B'),
  ];
  await seedWeek(page, days, isoDaysAgo(10));

  await openDay(page, 1);
  const text = await anchorText(page);
  expect(text).toContain('heute');
});

test('Alt-Daten ohne Zeitstempel: Fallback auf die Index-Schätzung, kein Absturz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Tag A markedDone, aber weder sessionStartTs noch sessionEndTs gesetzt
  // (simuliert Daten von vor SCHEMA 12) -- muss auf die alte
  // startDate+dayIdx-Schätzung zurückfallen, exakt 4 Tage.
  const days = [
    makeDay(1, 'Tag A', { markedDone: true }),
    makeDay(2, 'Tag B'),
  ];
  await seedWeek(page, days, isoDaysAgo(4));

  await openDay(page, 1);
  const text = await anchorText(page);
  expect(text).toContain('vor 4 Tagen');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Session gestartet, noch nicht abgeschlossen: sessionStartTs zählt, nicht die Index-Schätzung', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Tag A: hasEvaluated (ein bewerteter Satz), aber NICHT markedDone.
  // sessionStartTs vor 3 Tagen -- die Index-Schätzung (startDate+0 = vor 10
  // Tagen) wäre deutlich abweichend, falls sie fälschlich gewinnen würde.
  const days = [
    makeDay(1, 'Tag A', { evaluated: true, sessionStartTs: epochNoonDaysAgo(3) }),
    makeDay(2, 'Tag B'),
  ];
  await seedWeek(page, days, isoDaysAgo(10));

  await openDay(page, 1);
  const text = await anchorText(page);
  expect(text).toContain('vor 3 Tagen');
  expect(text).not.toContain('vor 10 Tagen');
});
