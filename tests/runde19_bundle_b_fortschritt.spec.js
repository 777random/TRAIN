import { test, expect } from '@playwright/test';

// Runde 19, Bundle B (Fortschritt-Tab-Sammelrunde, Live-Nutzerfeedback
// 2026-08-08/09): Cluster 4 (CSV-Export-Duplikat konsolidiert), Cluster 5
// (Bestleistungen: Wdh-PR fuer gewichtslose Uebungen + Detail-Ebene),
// Cluster 6 (Uebungsfortschritt: Favoriten-Default), Cluster 7
// (Erkenntnisse-Scroll-Jump-Bug), Cluster 9 (Koerpergewicht-Chart: relative
// Zeitangaben statt KW). Siehe "Diagnose & Sprints/TRAIN-Sprint-Prompts-
// Runde19.md" fuer die vollen Cluster-Beschreibungen.

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, reps, status = 'success') {
  return { weight, reps, rpe: null, status, done: status === 'success', note: '' };
}

function mkEx({ name, sets, weight = true }) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: weight ? 5 : 0,
    sets,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetReps: sets[0]?.reps ?? 5,
    progressionType: weight ? 'weight' : 'reps', progressionMode: 'weight_first',
    targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, { sleepHours = null, energyLevel = null } = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours, energyLevel, sessionRating: null,
    sessionStartTs: Date.now() - 3600_000, sessionEndTs: Date.now() - 1800_000,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek(id, startDate, { days, bodyWeight = null, sessionLog = [] } = {}) {
  return {
    id, startDate, note: '', mode: 'standard', days,
    sessionLog, bodyData: bodyWeight != null ? { weight: bodyWeight } : {},
    restDays: [], isSeedWeek: false,
  };
}

function baseState(overrides = {}) {
  return {
    meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
    curIdx: 0, weeks: [],
    onboardingDone: true,
    customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true, erkenntnisseHorizont: 8 },
    prs: {}, favoriteExercises: [], customExercises: [],
    coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
    lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
    longestStreakEver: 0, seenTips: [],
    ...overrides,
  };
}

async function seed(page, state) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((s) => localStorage.setItem('train_v6', JSON.stringify(s)), state);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// ── Cluster 4: CSV-Export-Duplikat ──────────────────────────────────────────

test('Cluster 4: Fortschritt-Tab hat keinen eigenen Export-Button mehr, Settings-Export funktioniert weiterhin', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const weeks = [mkWeek(1, weeksAgoISO(0), { days: [mkDay(11, [mkEx({ name: 'Kniebeuge', sets: [mkSet(80, 5)] })])] })];
  await seed(page, baseState({ curIdx: 0, weeks }));

  await page.click('[data-tab="progress"]');
  await expect(page.locator('#page-progress [data-action="open-export"]')).toHaveCount(0);

  await page.click('[data-tab="settings"]');
  const exportRow = page.locator('[data-action="open-export"]');
  await expect(exportRow).toHaveCount(1);
  await exportRow.click();
  await expect(page.locator('#modal-export')).toHaveClass(/is-open/);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-action="export-current"]'),
  ]);
  expect(download).toBeTruthy();

  expect(pageErrors).toEqual([]);
});

// ── Cluster 5: Bestleistungen Wdh-PR + Detail-Ebene ─────────────────────────

test('Cluster 5: gewichtslose Übung zeigt Wdh-PR statt "0 kg", Detail-Ebene zeigt Sätze+Datum', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const weeks = [
    mkWeek(1, weeksAgoISO(2), { days: [mkDay(11, [mkEx({ name: 'Klimmzüge', weight: false, sets: [mkSet(0, 8), mkSet(0, 7)] })])] }),
    mkWeek(2, weeksAgoISO(1), { days: [mkDay(21, [mkEx({ name: 'Klimmzüge', weight: false, sets: [mkSet(0, 10), mkSet(0, 9)] })])] }),
    mkWeek(3, weeksAgoISO(0), { days: [mkDay(31, [mkEx({ name: 'Klimmzüge', weight: false, sets: [mkSet(0, 6)] })])] }),
  ];
  // Als Favorit markiert, damit die Zeile direkt sichtbar ist statt hinter
  // dem "Alle Übungen"-Collapse zu stecken (Favoriten-Rendering selbst ist
  // Cluster 6, hier unabhängig getestet).
  await seed(page, baseState({ curIdx: 2, weeks, favoriteExercises: ['Klimmzüge'] }));

  await page.click('[data-tab="progress"]');
  const row = page.locator('.pr-row', { hasText: 'Klimmzüge' });
  await expect(row).toContainText('10 Wdh');
  await expect(row).not.toContainText('kg');

  await row.locator('[data-action="toggle-pr-detail"]').click();
  const detail = row.locator('.pr-row__detail');
  await expect(detail).toBeVisible();
  await expect(detail).toContainText('10 Wdh');
  await expect(detail).toContainText('9 Wdh');

  expect(pageErrors).toEqual([]);
});

test('Cluster 5 Kontrolle: gewichtsbasierte Übung zeigt weiterhin kg-Headline', async ({ page }) => {
  const weeks = [mkWeek(1, weeksAgoISO(0), { days: [mkDay(11, [mkEx({ name: 'Kniebeuge', sets: [mkSet(100, 5)] })])] })];
  await seed(page, baseState({ curIdx: 0, weeks }));
  await page.click('[data-tab="progress"]');
  const row = page.locator('.pr-row', { hasText: 'Kniebeuge' });
  await expect(row).toContainText('100 kg');
});

// ── Cluster 6: Übungsfortschritt Favoriten-Default ──────────────────────────

test('Cluster 6: Übungsfortschritt-Dropdown startet auf dem Favoriten statt alphabetisch erster Übung', async ({ page }) => {
  const weeks = [mkWeek(1, weeksAgoISO(0), {
    days: [mkDay(11, [
      mkEx({ name: 'Ausfallschritt', sets: [mkSet(40, 8)] }),
      mkEx({ name: 'Zwerchheben', sets: [mkSet(60, 5)] }),
    ])],
  })];
  await seed(page, baseState({ curIdx: 0, weeks, favoriteExercises: ['Zwerchheben'] }));
  await page.click('[data-tab="progress"]');

  const sel = page.locator('#chart-ex-select');
  await expect(sel).toHaveValue('Zwerchheben');
  const firstOptionText = await sel.locator('option').first().textContent();
  expect(firstOptionText).toContain('Zwerchheben');
});

test('Cluster 6 Kontrolle: ohne Favoriten bleibt alphabetische Reihenfolge/Default', async ({ page }) => {
  const weeks = [mkWeek(1, weeksAgoISO(0), {
    days: [mkDay(11, [
      mkEx({ name: 'Zwerchheben', sets: [mkSet(60, 5)] }),
      mkEx({ name: 'Ausfallschritt', sets: [mkSet(40, 8)] }),
    ])],
  })];
  await seed(page, baseState({ curIdx: 0, weeks, favoriteExercises: [] }));
  await page.click('[data-tab="progress"]');
  const sel = page.locator('#chart-ex-select');
  await expect(sel).toHaveValue('Ausfallschritt');
});

// ── Cluster 7: Erkenntnisse-Scroll-Jump-Bug ─────────────────────────────────

test('Cluster 7: Plus-Klick auf Erkenntnisse-Horizont verursacht keinen Scroll-Sprung', async ({ page }) => {
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    weeks.push(mkWeek(12 - i, weeksAgoISO(i), {
      days: [mkDay(i * 10 + 1, [mkEx({ name: 'Kniebeuge', sets: [mkSet(80 + i, 5), mkSet(80 + i, 5)] })])],
    }));
  }
  await seed(page, baseState({ curIdx: weeks.length - 1, weeks, settings: { sessionCoach: false, rpeEnabled: true, erkenntnisseHorizont: 8 } }));
  await page.click('[data-tab="progress"]');
  await page.waitForSelector('[data-action="erkenntnisse-horizont-inc"]', { timeout: 5000 });

  await page.evaluate(() => { document.getElementById('app').scrollTop = 250; });
  await page.waitForTimeout(100);
  const before = await page.evaluate(() => document.getElementById('app').scrollTop);
  expect(before).toBeGreaterThan(0);

  await page.click('[data-action="erkenntnisse-horizont-inc"]');
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => document.getElementById('app').scrollTop);
  expect(after).toBe(before);
});

// ── Cluster 9: Körpergewicht-Chart relative Zeitangaben ─────────────────────

test('Cluster 9: Körpergewicht-Chart zeigt relative Zeitangaben statt KW, keine Achsen-Überlappung über lange Historie', async ({ page }) => {
  const weeks = [];
  for (let i = 20; i >= 0; i--) {
    weeks.push(mkWeek(21 - i, weeksAgoISO(i), {
      days: [mkDay(i * 10 + 1, [mkEx({ name: 'Kniebeuge', sets: [mkSet(80, 5)] })])],
      bodyWeight: 80 - i * 0.1,
    }));
  }
  await seed(page, baseState({ curIdx: weeks.length - 1, weeks }));
  await page.click('[data-tab="body"]');
  await page.waitForSelector('svg[aria-label="Körpergewichtsverlauf"]', { timeout: 5000 });

  const svgText = await page.locator('svg[aria-label="Körpergewichtsverlauf"]').innerHTML();
  expect(svgText).toMatch(/Diese Woche|Letzte Woche|Vor \d+ Wochen|Vor \d+ Monaten/);
  expect(svgText).not.toMatch(/KW \d+/);

  // Kein Label-Paar direkt am Ende darf enger als xStep/2 zusammenstehen --
  // Regressionsschutz für den Fix an der xIdxs-Berechnung (progressChart.js).
  // Nur X-Achsen-Labels betrachten (y === VBH-4 === 136 für den Bodyweight-
  // Chart, siehe renderBodyWeightChart) -- die 3 Y-Achsen-Werte-Labels haben
  // eigene, unabhängige y-Werte und würden die Spacing-Prüfung sonst verfälschen.
  const allTexts = await page.locator('svg[aria-label="Körpergewichtsverlauf"] text').all();
  const xVals = [];
  for (const t of allTexts) {
    const y = await t.getAttribute('y');
    const x = await t.getAttribute('x');
    if (y === '136' && x !== null) xVals.push(parseFloat(x));
  }
  expect(xVals.length).toBeGreaterThan(1);
  expect(xVals.length).toBeLessThanOrEqual(7);
  xVals.sort((a, b) => a - b);
  for (let i = 1; i < xVals.length; i++) {
    expect(xVals[i] - xVals[i - 1]).toBeGreaterThan(15);
  }
});
