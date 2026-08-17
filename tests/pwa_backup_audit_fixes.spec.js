import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

// Runde 30 (PWA/Service-Worker + Backup/Restore-Audit, letzte von vier
// angekündigten Folgerunden): 2 parallele Diagnose-Agenten fanden 4
// bestätigte Bugs (einer davon eine CSV-Formula-Injection-Sicherheitslücke)
// + 5 Verdachtsfälle. sw.js/registerSW.js-Fixes (event.waitUntil()-Schutz
// für den Hintergrund-Cache-Refresh, korrektes Fehler-Propagieren bei
// fehlgeschlagenem Precache, controllerchange-Listener für den Versions-
// Toast) sind durch die bestehende sw_update_and_version.spec.js/
// sw_silent_update_toast.spec.js-Regressionssuite (weiterhin grün)
// abgedeckt -- ein eigener Test für die exakten Multi-Generation-Timing-
// Szenarien wäre unverhältnismäßig aufwändig zu reproduzieren. Dieser Test
// deckt die backup.js-Fixes ab (CSV-Export/-Import).

function mkSet(weight, status = 'success') {
  return { weight, reps: 8, rpe: 7, status, done: true, note: '' };
}

function mkEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [mkSet(weight)],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, skipReason: null, skipDate: null, substituteFor: null,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionCheckIn: null,
    sessionModifier: null, sessionModifierScope: null,
    exercises,
  };
}

function mkWeek(id, startDate, days, opts = {}) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false, ...opts };
}

async function seed(page, weeks, curIdx, extra = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, curIdxArg, extraArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: curIdxArg, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: {},
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      exerciseNotes: {}, customAlternatives: {},
      ...extraArg,
    }));
  }, { weeksArg: weeks, curIdxArg: curIdx, extraArg: extra });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function exportAllCSV(page) {
  await page.click('[data-tab="settings"]');
  await page.click('[data-action="open-export"]');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('[data-action="export-all"]'),
  ]);
  const path = await download.path();
  return readFileSync(path, 'utf-8');
}

test('CSV-Export "Progression pro Übung" schließt die Startwerte-Woche aus', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-07-01', [mkDay(1, [mkEx('Kniebeuge', 100)])], { isSeedWeek: true });
  const realWeek1 = mkWeek(1, '2026-07-08', [mkDay(2, [mkEx('Kniebeuge', 60)])]);
  const realWeek2 = mkWeek(2, '2026-07-15', [mkDay(3, [mkEx('Kniebeuge', 65)])]);
  await seed(page, [seedWeek, realWeek1, realWeek2], 2);

  const csv = await exportAllCSV(page);
  const progressionSection = csv.split('PROGRESSION PRO ÜBUNG')[1];
  expect(progressionSection).toContain('Kniebeuge');
  // Vorheriges Gewicht muss aus realWeek1 (60) stammen, nicht aus der
  // Startwerte-Woche (100).
  expect(progressionSection).toContain(';60;');
  expect(progressionSection).not.toContain(';100;');
});

test('CSV-Export: Übungsname mit Formel-Präfix wird mit führendem Apostroph entschärft', async ({ page }) => {
  const week = mkWeek(1, '2026-07-08', [mkDay(1, [mkEx('=cmd|"/c calc"!A1', 60), mkEx('Kreuzheben', 80)])]);
  await seed(page, [week, mkWeek(2, '2026-07-15', [mkDay(2, [mkEx('=cmd|"/c calc"!A1', 65), mkEx('Kreuzheben', 85)])])], 1);

  const csv = await exportAllCSV(page);
  expect(csv).not.toContain('\n=cmd');
  expect(csv).not.toContain(';=cmd');
  expect(csv).toContain("'=cmd");
});

test('CSV-Export: Körpergewicht-Durchschnitt ignoriert null-Einträge statt NaN zu erzeugen', async ({ page }) => {
  const week = mkWeek(1, '2026-07-08', [mkDay(1, [mkEx('Kniebeuge', 60)])], {
    bodyData: { weightLog: [{ date: '2026-07-08', weight: 80 }, { date: '2026-07-09', weight: null }, { date: '2026-07-10', weight: 82 }] },
  });
  await seed(page, [week], 0);

  const csv = await exportAllCSV(page);
  expect(csv).not.toContain('NaN');
  expect(csv).toContain(';81;'); // (80+82)/2
});

test('JSON-Import sanitisiert exerciseNotes/customAlternatives/favoriteExercises/customExercises (Längen-Deckel)', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  const week = mkWeek(1, '2026-07-08', [mkDay(1, [mkEx('Kniebeuge', 60)])]);
  await seed(page, [week], 0);

  const longText = 'A'.repeat(500);
  const backup = {
    meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
    curIdx: 0, weeks: [week], onboardingDone: true,
    customTemplate: [], settings: {},
    favoriteExercises: [longText],
    customExercises: [{ name: longText, metric: 'reps', category: null }],
    prs: {}, coachPerformance: { suggestions: [] },
    coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
    plateauActions: {}, decisionLog: [], badges: [],
    exerciseNotes: { 'Kniebeuge': longText },
    customAlternatives: { 'Kniebeuge': [longText] },
  };

  await page.click('[data-tab="settings"]');
  await page.setInputFiles('[data-action="import-json"]', {
    name: 'test-import.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup), 'utf-8'),
  });
  await page.waitForTimeout(500);

  const result = await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    return {
      fav: st.favoriteExercises[0].length,
      customExName: st.customExercises[0].name.length,
      note: st.exerciseNotes['Kniebeuge'].length,
      alt: st.customAlternatives['Kniebeuge'][0].length,
    };
  });
  expect(result.fav).toBe(80);
  expect(result.customExName).toBe(80);
  expect(result.note).toBe(200);
  expect(result.alt).toBe(80);
});
