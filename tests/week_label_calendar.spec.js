import { test, expect } from '@playwright/test';

// B99 (train-v208): Wochenbezeichnung ("Aktuelle Woche"/"Letzte Woche") folgte
// bisher getLatestWeek(weeks) (chronologisch letzte Woche IM ARRAY) statt dem
// echten Kalenderdatum -- eine im Voraus erstellte Zukunftswoche wurde
// faelschlich "Aktuelle Woche" genannt, die tatsaechlich laufende Woche
// dagegen "Letzte Woche". _calendarCurrentWeek()/_weekLabel() (ui.js) fixen
// das, indem sie gegen new Date() vergleichen, nicht gegen die Array-Position.
// Konsolidiert zugleich die vormals getrennte _relDate() (Wochenrueckblick-
// Dropdown im Fortschritt-Tab) in dieselbe Funktion (Nutzer-Entscheidung:
// "Konsolidieren"). Label-Schema bewusst verengt auf "Diese/Naechste/Letzte
// Woche" + "KW N * Jahr"-Fallback (Nutzer-Entscheidung: "wie in der Vorlage"),
// die alten Zwischenstufen ("Vorletzte Woche"/"Vor N Wochen"/"In N Wochen")
// entfallen.

function isoMondayOffset(weeksOffset) {
  const today = new Date();
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow) + weeksOffset * 7);
  monday.setHours(0, 0, 0, 0);
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function buildExercise() {
  return {
    name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps',
    sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false }],
    weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
    targetReps: 8, progressionType: 'weight', archived: false, substituteFor: null,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    progressionMode: 'weight_first', targetRepsMax: null,
  };
}

function buildDoneExercise() {
  return {
    name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps',
    sets: [{ weight: 80, reps: 5, rpe: null, status: 'success', done: true }],
    weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
    targetReps: 5, progressionType: 'weight', archived: false, substituteFor: null,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    progressionMode: 'weight_first', targetRepsMax: null,
  };
}

function makeWeek(id, startDate, { markedDone = false } = {}) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{
      id: id * 10, title: 'Tag 1', subtitle: '', warmup: '', cooldown: '',
      locked: markedDone, markedDone, isVacation: false,
      sleepHours: null, energyLevel: null, sessionRating: null,
      sessionCheckIn: null, sessionModifier: null,
      exercises: [markedDone ? buildDoneExercise() : buildExercise()],
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seedWeeks(page, weeks, curIdx) {
  await page.evaluate(({ weeks, curIdx }) => {
    const now = new Date().toISOString();
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: now, createdAt: now },
      curIdx,
      weeks,
      customTemplate: [], settings: { sessionCoach: true }, prs: {},
      coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_v6_shadow', 'x');
  }, { weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Diese Woche im Header, auch wenn curIdx auf eine im Voraus erstellte Zukunftswoche zeigt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const thisWeek = makeWeek(1, isoMondayOffset(0), { markedDone: true });
  const nextWeek = makeWeek(2, isoMondayOffset(1));
  // curIdx zeigt auf die neu erstellte Zukunftswoche (Index 1) -- genau das
  // Szenario aus dem Bug-Report ("Woche fuer naechste Woche erstellt").
  await seedWeeks(page, [thisWeek, nextWeek], 1);

  await expect(page.locator('#wk-label')).toHaveText(/Nächste Woche/);

  await page.click('[data-action="nav-prev"]');
  await page.waitForTimeout(200);
  await expect(page.locator('#wk-label')).toHaveText(/Diese Woche/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Letzte Woche + KW-Fallback fuer ältere Wochen', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const twoAgo  = makeWeek(1, isoMondayOffset(-2), { markedDone: true });
  const lastWk  = makeWeek(2, isoMondayOffset(-1), { markedDone: true });
  const current = makeWeek(3, isoMondayOffset(0));
  await seedWeeks(page, [twoAgo, lastWk, current], 1);

  await expect(page.locator('#wk-label')).toHaveText(/Letzte Woche/);

  await page.click('[data-action="nav-prev"]');
  await page.waitForTimeout(200);
  await expect(page.locator('#wk-label')).toHaveText(/^KW \d+ · \d{4}/);
});

test('Kein Absturz und KW-Anzeige fuer alle Wochen, wenn keine Woche das heutige Datum enthaelt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Beide Wochen liegen weit in der Vergangenheit -- keine enthaelt "heute".
  const far1 = makeWeek(1, isoMondayOffset(-10), { markedDone: true });
  const far2 = makeWeek(2, isoMondayOffset(-9), { markedDone: true });
  await seedWeeks(page, [far1, far2], 1);

  await expect(page.locator('#wk-label')).toHaveText(/^KW \d+ · \d{4}/);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Wochenrückblick-Dropdown im Fortschritt-Tab zeigt dieselben kalendarischen Bezeichnungen', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const lastWk  = makeWeek(1, isoMondayOffset(-1), { markedDone: true });
  const current = makeWeek(2, isoMondayOffset(0), { markedDone: true });
  const future  = makeWeek(3, isoMondayOffset(1));
  // curIdx auf die Zukunftswoche -- Dropdown-Text darf sich davon nicht
  // beirren lassen, da reviewableWeeks ohnehin nur markedDone-Tage listet.
  await seedWeeks(page, [lastWk, current, future], 2);

  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(300);

  const options = await page.locator('#week-review-select option').allTextContents();
  expect(options.some(o => o.includes('Diese Woche'))).toBe(true);
  expect(options.some(o => o.includes('Letzte Woche'))).toBe(true);
});
