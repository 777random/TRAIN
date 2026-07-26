import { test, expect } from '@playwright/test';

// E1: "▾ Basis dieser Einschätzung" — jede Coach-Tab-Karte (Hauptkarte +
// Strukturkarte) zeigt auf Wunsch die konkreten Datenpunkte hinter der
// Einschätzung. Bestehende ".coach-why-collapse"-Disclosure wiederverwendet
// (umbenannt), kein zweiter redundanter Toggle.

function todayISO() { return new Date().toISOString().split('T')[0]; }
function isoWeeksAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkDay(id, exercises, overrides = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: 7, energyLevel: 4, sessionRating: null,
    exercises,
    ...overrides,
  };
}

function mkExercise(name, weight, status, rpe, n = 3) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: Array.from({ length: n }, () => ({ weight, reps: 8, rpe, status, done: true, note: '' })),
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: n, targetReps: 8,
    progressionType: 'weight', archived: false, substituteFor: null,
  };
}

async function seed(page, weeks, curIdx = null) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: curIdx ?? weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, { weeksArg: weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="coach"]');
}

async function evidenceTexts(page, detailsSelector = '.coach-why-collapse') {
  const summary = page.locator(`${detailsSelector} summary`).first();
  await expect(summary).toContainText('Basis dieser Einschätzung');
  await summary.click();
  const list = page.locator(`${detailsSelector} .coach-evidence-list li`);
  const texts = await list.allTextContents();
  await summary.click(); // toggle closed again
  return texts;
}

test('Plateau: Gewicht + Erfolgsquote + RPE-Trend sichtbar (AC4)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [3, 2, 1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [mkDay(i * 10 + 1, [mkExercise('Bankdrücken', 80, 'success', 7.5)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await seed(page, weeks);
  await expect(page.locator('.coach-focus-status')).toContainText('Plateau');
  const texts = await evidenceTexts(page);
  expect(texts.some(t => t.includes('Bankdrücken'))).toBe(true);
  expect(texts.some(t => t.includes('80kg'))).toBe(true);
  expect(texts.some(t => /\d+%/.test(t))).toBe(true); // Erfolgsquote
  expect(texts.some(t => t.toLowerCase().includes('rpe'))).toBe(true);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Persistenter Fehlschlag: Uebung + Erfolgsquote + Saetze sichtbar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [2, 1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [mkDay(i * 10 + 1, [mkExercise('Kreuzheben', 100, 'fail', 9.5)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await seed(page, weeks);
  await expect(page.locator('.coach-focus-status')).toContainText('Gewicht zu hoch');
  const texts = await evidenceTexts(page);
  expect(texts.some(t => t.includes('Kreuzheben'))).toBe(true);
  expect(texts.some(t => t.includes('0%'))).toBe(true);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('onTrack (steady-state): Einheiten + Erfolgsquote sichtbar (AC6)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [mkDay(i * 10 + 1, [mkExercise('Bankdrücken', 80, 'success', 8.5)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await seed(page, weeks);
  await expect(page.locator('.coach-focus-status')).toContainText('Auf Kurs');
  const texts = await evidenceTexts(page);
  expect(texts.some(t => /\d+\/\d+/.test(t))).toBe(true); // Einheiten X/Y
  expect(texts.some(t => /\d+%/.test(t))).toBe(true); // Erfolgsquote
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Progression: Uebungsname + Empfehlung + Konfidenz sichtbar (AC5)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [mkDay(i * 10 + 1, [mkExercise('Bankdrücken', 80, 'success', 6.5)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await seed(page, weeks);
  await expect(page.locator('.coach-focus-status')).toContainText('Steigerung sinnvoll');
  const texts = await evidenceTexts(page);
  expect(texts.some(t => t.includes('Bankdrücken'))).toBe(true);
  expect(texts.some(t => /\d+(\.\d+)?kg/.test(t))).toBe(true); // Empfehlung
  expect(texts.some(t => /HIGH|MEDIUM|LOW/.test(t))).toBe(true); // Konfidenz
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Strukturkarte (Praeventiver Deload): "▾ Basis dieser Einschaetzung" vorhanden (AC7)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [];
  for (let i = 9; i >= 1; i--) {
    weeks.push({
      id: i, startDate: isoWeeksAgo(i), note: '', mode: 'standard',
      days: [mkDay(i * 10 + 1, [mkExercise('Kniebeuge', 80 + i, 'success', 8.5)])],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
  }
  await seed(page, weeks);
  const badge = page.locator('.deload-info__badge');
  await expect(badge).toBeVisible();
  const structWhy = page.locator('.coach-structural-why summary');
  await expect(structWhy).toContainText('Basis dieser Einschätzung');
  await structWhy.click();
  const evText = await page.locator('.coach-structural-why .coach-evidence-list').innerText();
  expect(evText).toMatch(/Woche/);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Zweiter Tap schliesst die Evidence-Box wieder (AC2/AC3)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const weeks = [3, 2, 1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [mkDay(i * 10 + 1, [mkExercise('Bankdrücken', 80, 'success', 7.5)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await seed(page, weeks);
  const details = page.locator('.coach-why-collapse');
  await expect(details).not.toHaveJSProperty('open', true);
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', true);
  await details.locator('summary').click();
  await expect(details).toHaveJSProperty('open', false);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
