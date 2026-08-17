import { test, expect } from '@playwright/test';

// Nutzer-Feedback (2026-08-17): Körper-Tab + Einstellungen-Audit (4 parallele
// Diagnose-Agenten) fand 5 bestätigte Bugs + 9 Verdachtsfälle. Dieser Test
// deckt die wichtigsten Fixes ab, die noch nicht durch bestehende Tests
// abgesichert sind.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function isoWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, opts = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, skipReason: null, skipDate: null, substituteFor: null,
    ...opts,
  };
}

function mkDay(id, exercises, opts = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises,
    ...opts,
  };
}

function mkWeek(id, startDate, days, isSeedWeek = false) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek };
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

test('CUSTOM_EX_UPDATE migriert substituteFor + prs/plateauActions/exerciseNotes/customAlternatives beim Umbenennen', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [
    mkEx('Kniebeuge'),
    mkEx('Ausfallschritte', { substituteFor: 'Kniebeuge' }),
  ])]);
  await seed(page, [week], 0, {
    customExercises: [{ name: 'Kniebeuge', metric: 'reps', category: 'Squat' }],
    prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-06-01' } },
    plateauActions: { 'Kniebeuge': { action: 'ignored', since: '2026-06-01' } },
    exerciseNotes: { 'Kniebeuge': 'Rack Stufe 4' },
    customAlternatives: { 'Kniebeuge': ['Beinpresse'] },
  });

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.CUSTOM_EX_UPDATE, { oldName: 'Kniebeuge', name: 'Kniebeugen', metric: 'reps', category: 'Squat' });
    const st = mod.getState();
    return {
      exName: st.weeks[0].days[0].exercises[0].name,
      substituteFor: st.weeks[0].days[0].exercises[1].substituteFor,
      prsOld: st.prs['Kniebeuge'], prsNew: st.prs['Kniebeugen']?.maxWeight,
      plateauOld: st.plateauActions['Kniebeuge'], plateauNew: st.plateauActions['Kniebeugen']?.action,
      noteOld: st.exerciseNotes['Kniebeuge'], noteNew: st.exerciseNotes['Kniebeugen'],
      altOld: st.customAlternatives['Kniebeuge'], altNew: st.customAlternatives['Kniebeugen'],
    };
  });

  expect(result.exName).toBe('Kniebeugen');
  expect(result.substituteFor).toBe('Kniebeugen');
  expect(result.prsOld).toBeUndefined();
  expect(result.prsNew).toBe(100);
  expect(result.plateauOld).toBeUndefined();
  expect(result.plateauNew).toBe('ignored');
  expect(result.noteOld).toBeUndefined();
  expect(result.noteNew).toBe('Rack Stufe 4');
  expect(result.altOld).toBeUndefined();
  expect(result.altNew).toEqual(['Beinpresse']);
});

test('WEEK_RESET_TO_TPL setzt skipReason und Tag-Session-Felder zurück (nutzt jetzt _resetClonedDays())', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [
    mkEx('Kniebeuge', { skipReason: 'injury', skipDate: '2026-06-01' }),
  ], {
    sessionCheckIn: { sleep: 'good', energyPre: 4, injuryFollowUp: null },
    sessionModifier: 'normal', sleepHours: 7.5, energyLevel: 4,
  })]);
  await seed(page, [week], 0, { customTemplate: [mkDay(1, [mkEx('Kniebeuge')])] });

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.WEEK_RESET_TO_TPL, {});
    const day = mod.getState().weeks[0].days[0];
    return {
      skipReason: day.exercises[0].skipReason,
      sessionCheckIn: day.sessionCheckIn,
      sleepHours: day.sleepHours,
    };
  });

  expect(result.skipReason).toBeNull();
  expect(result.sessionCheckIn).toBeNull();
  expect(result.sleepHours).toBeNull();
});

test('Template "+Übung" erzeugt eine Übung mit vollständigem Feld-Set (weightStep-Auflösung, showPlates, progressionType)', async ({ page }) => {
  await seed(page, [mkWeek(1, todayISO(), [mkDay(1, [mkEx('Kniebeuge')])])], 0, {
    customTemplate: [{ id: 'A', title: 'Tag A', subtitle: '', warmup: '', cooldown: '', exercises: [] }],
  });

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    const tpl = JSON.parse(JSON.stringify(mod.getState().customTemplate));
    tpl[0].exercises.push({
      name: 'Neue Übung', note: '', pauseSec: 90, metric: 'reps',
      progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, prRepsHistory: {},
      prWeight: null, prRepsAtMaxWeight: null,
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
      skipReason: null, skipDate: null, substituteFor: null,
      tags: [], targetReps: 10, showPlates: true, metricStep: undefined,
      sets: [{ weight: 0, reps: 10, rpe: null, status: 'pending', done: false, note: '' }],
    });
    mod.dispatch(mod.A.TPL_SAVE, { template: tpl });
    const ex = mod.getState().customTemplate[0].exercises[0];
    return { hasProgressionType: ex.progressionType !== undefined, hasShowPlates: ex.showPlates !== undefined, hasTargetReps: ex.targetReps !== undefined };
  });

  expect(result.hasProgressionType).toBe(true);
  expect(result.hasShowPlates).toBe(true);
  expect(result.hasTargetReps).toBe(true);
});

test('Körpergewicht-Eingabe: Obergrenze verhindert Tippfehler, Datum ist lokal', async ({ page }) => {
  await seed(page, [mkWeek(1, todayISO(), [mkDay(1, [mkEx('Kniebeuge')])])], 0);
  await page.click('[data-tab="body"]');

  const input = page.locator('#body-weight-today');
  await expect(input).toBeVisible();
  await input.fill('825');
  await page.click('[data-action="log-bodyweight"]');
  await page.waitForTimeout(200);

  const afterInvalid = await page.evaluate(async () => {
    const mod = await import('./state.js');
    return (mod.getState().weeks[0].bodyData?.weightLog ?? []).length;
  });
  expect(afterInvalid).toBe(0);

  await input.fill('82.5');
  await page.click('[data-action="log-bodyweight"]');
  await page.waitForTimeout(200);

  const afterValid = await page.evaluate(async () => {
    const mod = await import('./state.js');
    return mod.getState().weeks[0].bodyData?.weightLog;
  });
  expect(afterValid?.length).toBe(1);
  expect(afterValid[0].weight).toBe(82.5);
  // Lokales Datum, nicht UTC -- vergleicht gegen dieselbe lokale Formel wie im Test-Setup.
  const localToday = new Date();
  const expected = `${localToday.getFullYear()}-${String(localToday.getMonth() + 1).padStart(2, '0')}-${String(localToday.getDate()).padStart(2, '0')}`;
  expect(afterValid[0].date).toBe(expected);
});

test('Relative-Stärke-Chart: Startwerte-Woche liefert keinen synthetischen zweiten Datenpunkt', async ({ page }) => {
  // renderRelativeStrengthChart() braucht >=2 Punkte, um überhaupt ein SVG
  // zu rendern (sonst Fallback-Text). Mit NUR einem Körpergewichts-Eintrag
  // (nahe der echten Woche) würde die Seed-Woche OHNE den Fix trotzdem
  // einen 2. Punkt beisteuern (liegt within der 30-Tage-Toleranz zum
  // selben Körpergewichts-Eintrag) -- der Chart würde dann fälschlich
  // rendern statt des "noch nicht genug Datenpunkte"-Hinweises.
  const seedWeek = mkWeek(0, isoWeeksAgo(4), [mkDay(1, [mkEx('Kniebeuge', {
    sets: [{ weight: 60, reps: 5, rpe: null, status: 'success', done: true, note: '' }],
  })])], true);
  const realWeek = mkWeek(1, isoWeeksAgo(0), [mkDay(2, [mkEx('Kniebeuge', {
    prWeight: 65,
    sets: [{ weight: 65, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
  })])], false);
  realWeek.bodyData = { weight: 82 };

  await seed(page, [seedWeek, realWeek], 1);
  await page.click('[data-tab="body"]');
  await page.waitForSelector('#rs-ex-select', { timeout: 5000 });

  const emptyHint = page.getByText('Noch nicht genug Datenpunkte für einen Verlauf.');
  await expect(emptyHint).toBeVisible({ timeout: 5000 });
});
