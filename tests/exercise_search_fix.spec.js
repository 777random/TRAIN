import { test, expect } from '@playwright/test';

// B123: Der Übungs-Such-Dialog kannte bisher nur _STANDARD_EXERCISES +
// customExercises (gefiltert auf metric!=null) -- movementMap.js (Synonyme
// wie "Walking Lunges") wurde nie durchsucht. Zusätzlich prüfte der
// Duplikat-Check beim manuellen Anlegen ("existiert bereits") global gegen
// ALLE customExercises-Einträge ohne den metric-Filter -- ein reiner
// Kategorie-Override-Eintrag (EX_SET_CATEGORY_OVERRIDE, kein metric-Feld)
// war dadurch in der Suche unsichtbar, aber blockierte trotzdem die
// Neuanlage mit "existiert bereits". Fix: MOVEMENT_MAP als dritte
// Suchquelle, kein metric-Filter mehr in der Suche, und der Duplikat-Check
// beim manuellen Anlegen prüft jetzt nur noch gegen den ZIEL-TAG statt
// global.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
  };
}

function mkWeek(exercises) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, { exercises = [], customExercises = [] } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, customExercises }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises,
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weekArg: mkWeek(exercises), customExercises });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('"Walking Lunges" (movementMap.js-Synonym) erscheint in der Suche und ist hinzufügbar', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { exercises: [mkEx('Bankdrücken')] });

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Walking Lunges');
  await page.waitForTimeout(150);

  const item = page.locator('[data-action="ex-search-pick"][data-name="Walking Lunges"]');
  await expect(item).toBeVisible();
  await item.click();

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const names = st.weeks[0].days[0].exercises.map(e => e.name);
  expect(names).toContain('Walking Lunges');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kategorie-Override-Eintrag (kein metric-Feld) erscheint jetzt in der Suche statt "existiert bereits" zu blockieren', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  // Simuliert eine Übung, die per EX_SET_CATEGORY_OVERRIDE nur mit
  // {name, category} in customExercises gelandet ist, ohne je über
  // EX_ADD/CUSTOM_EX_ADD ein metric-Feld bekommen zu haben.
  await seed(page, {
    exercises: [mkEx('Bankdrücken')],
    customExercises: [{ name: 'Nordic Curls', category: 'Hinge' }],
  });

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Nordic Curls');
  await page.waitForTimeout(150);

  const item = page.locator('[data-action="ex-search-pick"][data-name="Nordic Curls"]');
  await expect(item).toBeVisible();
  await item.click();

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const added = st.weeks[0].days[0].exercises.find(e => e.name === 'Nordic Curls');
  expect(added).toBeTruthy();
  expect(added.metric).toBe('reps'); // Fallback, da customExercises-Eintrag kein metric hatte

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Duplikat-Check beim manuellen Anlegen blockiert nur, wenn Übung schon am Ziel-Tag ist', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  // Name existiert nur als Tages-Übung, nicht in _STANDARD_EXERCISES/
  // customExercises/MOVEMENT_MAP -- daher zeigt die Suche kein Ergebnis und
  // der "+ ... anlegen"-Button erscheint (allNames enthält den Namen nicht).
  await seed(page, { exercises: [mkEx('Ganz Spezielle Tagesübung')] });

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Ganz Spezielle Tagesübung');
  await page.waitForTimeout(150);
  await page.click('[data-action="ex-search-create"]');
  await page.click('[data-action="ex-form-submit"]');

  await expect(page.locator('#ex-form-error')).toHaveText('Diese Übung ist an diesem Tag bereits vorhanden.');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Manuelles Anlegen eines global unbekannten Namens legt ihn ohne Fehler an (kein Duplikat-Fehlalarm)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, { exercises: [mkEx('Bankdrücken')] });

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Ganz Neue Übung XYZ123');
  await page.waitForTimeout(150);
  await page.click('[data-action="ex-search-create"]');
  await page.click('[data-action="ex-form-submit"]');

  await expect(page.locator('#modal-ex-form')).not.toHaveClass(/is-open|is-visible/);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const names = st.weeks[0].days[0].exercises.map(e => e.name);
  expect(names).toContain('Ganz Neue Übung XYZ123');
  expect((st.customExercises ?? []).some(c => c.name === 'Ganz Neue Übung XYZ123')).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Case-insensitive Suche funktioniert weiterhin für Standard- und eigene Übungen', async ({ page }) => {
  await seed(page, {
    exercises: [mkEx('Bankdrücken')],
    customExercises: [{ name: 'Meine Sonderübung', metric: 'reps', category: null }],
  });

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'kniebeuge');
  await page.waitForTimeout(150);
  await expect(page.locator('[data-action="ex-search-pick"][data-name="Kniebeuge"]')).toBeVisible();

  await page.fill('#ex-search-input', 'sonderübung');
  await page.waitForTimeout(150);
  await expect(page.locator('[data-action="ex-search-pick"][data-name="Meine Sonderübung"]')).toBeVisible();
});
