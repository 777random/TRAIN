import { test, expect } from '@playwright/test';

// Runde 19, Cluster 12: Nutzerfeedback "man soll merken, dass es für jede
// Woche eine neue/aktualisierte Coaching-Anweisung gibt". Zwei Teile:
// (1) neuer sichtbarer Wochen-Stempel auf der Fokus-der-Woche-Karte
//     (".coach-focus-week-stamp", ui.js) — reine Anzeige, nutzt die
//     bestehende _weekLabel()-Funktion.
// (2) die deterministische Formulierungs-Rotation für den onTrack-Fallback-
//     Text existierte bereits VOR diesem Sprint (weeklyFocus.js `_fallback()`,
//     `variants[state.weeks.length % variants.length]`) — bisher ohne
//     Regressionsschutz. Dieser Test sperrt beide Verhalten fest.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'reps', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, weight) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises: [mkEx('Bankdrücken', weight)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, startDate, weight) {
  return { id, startDate, note: '', mode: 'standard', days: [mkDay(id, weight)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

async function seed(page, nWeeks) {
  // Ansteigendes Gewicht pro Woche -> vermeidet den Plateau-Detector
  // (konstantes Gewicht über >=3 Wochen), damit der Status zuverlässig
  // 'onTrack' bleibt (siehe CLAUDE.md TEST-JSON-KONSTRUKTIONSREGELN).
  const weeks = Array.from({ length: nWeeks }, (_, i) =>
    mkWeek(i + 1, isoMondayWeeksAgo(nWeeks - 1 - i), 60 + i * 2.5)
  );
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { plateStep: 2.5, deloadFactor: 0.75 },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: [],
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);
  // tatsächliche state.weeks.length nach etwaiger Auto-Wochenerstellung
  // beim Boot auslesen, statt nWeeks blind anzunehmen.
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks.length);
}

const VARIANTS = [
  'Keine besonderen Auffälligkeiten diese Woche. Trainiere wie geplant weiter.',
  'Alles im grünen Bereich — mach weiter wie bisher.',
];

test('Wochen-Stempel: "Fokus der Woche"-Karte zeigt "Stand: Diese Woche"', async ({ page }) => {
  await seed(page, 2);
  const status = await page.locator('.coach-focus-status').textContent();
  expect(status).toContain('Auf Kurs');
  const stamp = page.locator('.coach-focus-week-stamp');
  await expect(stamp).toBeVisible();
  await expect(stamp).toContainText('Diese Woche');
});

test('onTrack-Formulierung rotiert deterministisch nach state.weeks.length, ist stabil bei Reload derselben Woche', async ({ page }) => {
  const actualLen = await seed(page, 2);
  const status = await page.locator('.coach-focus-status').textContent();
  expect(status).toContain('Auf Kurs');

  const expected = VARIANTS[actualLen % VARIANTS.length];
  const directive1 = await page.locator('.coach-focus-directive').textContent();
  expect(directive1).toBe(expected);

  // Determinismus: erneutes Laden derselben Daten liefert exakt denselben Text.
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);
  const directive2 = await page.locator('.coach-focus-directive').textContent();
  expect(directive2).toBe(directive1);
});

test('onTrack-Formulierung unterscheidet sich bei anderer Wochenzahl (unveränderte Datenlage, andere Woche)', async ({ page }) => {
  const len4 = await seed(page, 4);
  const status = await page.locator('.coach-focus-status').textContent();
  expect(status).toContain('Auf Kurs');
  const directive4 = await page.locator('.coach-focus-directive').textContent();
  expect(directive4).toBe(VARIANTS[len4 % VARIANTS.length]);

  const len5 = await seed(page, 5);
  const directive5 = await page.locator('.coach-focus-directive').textContent();
  expect(directive5).toBe(VARIANTS[len5 % VARIANTS.length]);

  if (len4 % VARIANTS.length !== len5 % VARIANTS.length) {
    expect(directive5).not.toBe(directive4);
  }
});
