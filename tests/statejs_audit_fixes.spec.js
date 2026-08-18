import { test, expect } from '@playwright/test';

// Runde 35 (state.js-Audit): 2 parallele Diagnose-Agenten fanden 7 bestätigte
// Bugs + 2 gekoppelte Verdachtsfälle im zentralen Reducer. Nutzer wählte
// "Alle 7 fixen + V1/V2 mit". state.js ist NICHT import-frei (Seiteneffekte
// wie persistState/localStorage) -- alle Tests laufen im Browser-Kontext,
// analog zu koerper_einstellungen_audit_fixes.spec.js.

function todayISO() { return new Date().toISOString().split('T')[0]; }

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
      exerciseNotes: {}, customAlternatives: {}, substituteHistory: {},
      ...extraArg,
    }));
  }, { weeksArg: weeks, curIdxArg: curIdx, extraArg: extra });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('B1: _recordSubstitution() speichert lastUsed als lokales Datum, nicht UTC', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [mkEx('Kniebeuge')])]);
  await seed(page, [week], 0);

  const lastUsed = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.EX_UPDATE, { di: 0, ei: 0, field: 'name', value: 'Ausfallschritte' });
    mod.dispatch(mod.A.EX_SET_SUBSTITUTE, { di: 0, ei: 0, substituteFor: 'Kniebeuge' });
    return mod.getState().substituteHistory['Kniebeuge'][0].lastUsed;
  });
  const d = new Date();
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  expect(lastUsed).toBe(expected);
});

test('B2: EX_SET_SKIP_REASON speichert skipDate als lokales Datum, nicht UTC', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [mkEx('Kniebeuge')])]);
  await seed(page, [week], 0);

  const skipDate = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.EX_SET_SKIP_REASON, { di: 0, ei: 0, reason: 'injury' });
    return mod.getState().weeks[0].days[0].exercises[0].skipDate;
  });
  const d = new Date();
  const expected = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  expect(skipDate).toBe(expected);
});

test('B3: Phantom-PR-Korrektur (SET_UPDATE) durchsucht auch Sätze unter dem substituierten Namen', async ({ page }) => {
  // Woche 1: reguläre "Kniebeuge" mit einem 100kg-PR-Satz.
  // Woche 2: "Ausfallschritte" substituiert "Kniebeuge" -- der Nutzer korrigiert
  // hier nachträglich einen (irrelevanten) anderen Satz, was den Phantom-PR-
  // Recompute für "Kniebeuge" (ex.substituteFor) auslösen soll und dabei
  // weiterhin Woche 1s echten 100kg-Satz finden muss.
  const week1 = mkWeek(1, '2026-01-05', [mkDay(1, [
    mkEx('Kniebeuge', { sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }] }),
  ])]);
  const week2 = mkWeek(2, '2026-01-12', [mkDay(2, [
    mkEx('Ausfallschritte', { substituteFor: 'Kniebeuge', sets: [{ weight: 20, reps: 8, rpe: 6, status: 'success', done: true, note: '' }] }),
  ])]);
  await seed(page, [week1, week2], 1);

  const prWeight = await page.evaluate(async () => {
    const mod = await import('./state.js');
    // Eine erfolgreiche Wdh-Korrektur an der substituierten Übung stößt den
    // Phantom-PR-Recompute an (_wasSuccessForPr-Zweig in SET_UPDATE).
    mod.dispatch(mod.A.SET_UPDATE, { di: 0, ei: 0, si: 0, field: 'reps', value: '9' });
    return mod.getState().weeks[1].days[0].exercises[0].prWeight;
  });
  expect(prWeight).toBe(100);
});

test('B4: _applyPrTracking() bucht state.prs[] unter dem ORIGINAL-Namen bei aktiver Substitution', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [
    mkEx('Ausfallschritte', {
      substituteFor: 'Kniebeuge',
      sets: [{ weight: null, reps: null, rpe: null, status: 'pending', done: false, note: '' }],
    }),
  ])]);
  await seed(page, [week], 0);

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.SET_UPDATE, { di: 0, ei: 0, si: 0, field: 'weight', value: '80' });
    mod.dispatch(mod.A.SET_UPDATE, { di: 0, ei: 0, si: 0, field: 'reps', value: '8' });
    mod.dispatch(mod.A.SET_TOGGLE_DONE, { di: 0, ei: 0, si: 0 }); // pending -> success (targetReps 8)
    const st = mod.getState();
    return { kniebeuge: st.prs['Kniebeuge']?.maxWeight, ausfallschritte: st.prs['Ausfallschritte'] };
  });
  expect(result.kniebeuge).toBe(80);
  expect(result.ausfallschritte).toBeUndefined();
});

test('B5: EX_ADD übernimmt keine tags:[] aus der Startwerte-Woche (isSeedWeek)', async ({ page }) => {
  const seedWeek = mkWeek(1, '2026-01-01', [mkDay(1, [
    mkEx('Kniebeuge', { tags: [] }),
  ])], true);
  const week2 = mkWeek(2, '2026-01-08', [mkDay(2, [])]);
  await seed(page, [seedWeek, week2], 1);

  const tags = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.EX_ADD, { di: 0, name: 'Kniebeuge', metric: 'reps' });
    return mod.getState().weeks[1].days[0].exercises[0].tags;
  });
  // Ohne Fix: [] (aus der Seed-Woche übernommen). Mit Fix: computed default
  // über resolveMuscleGroups('Kniebeuge') -- nicht leer.
  expect(tags.length).toBeGreaterThan(0);
});

test('B6: EX_MERGE_NAMES migriert jetzt auch prs/plateauActions/exerciseNotes/customAlternatives', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [mkEx('Kniebeugen')])]);
  await seed(page, [week], 0, {
    prs: { 'Kniebeugen': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-06-01' } },
    plateauActions: { 'Kniebeugen': { action: 'ignored', since: '2026-06-01' } },
    exerciseNotes: { 'Kniebeugen': 'Rack Stufe 4' },
    customAlternatives: { 'Kniebeugen': ['Beinpresse'] },
  });

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.EX_MERGE_NAMES, { variantNames: ['Kniebeugen', 'Squat'], finalName: 'Kniebeuge' });
    const st = mod.getState();
    return {
      prsOld: st.prs['Kniebeugen'], prsNew: st.prs['Kniebeuge']?.maxWeight,
      plateauOld: st.plateauActions['Kniebeugen'], plateauNew: st.plateauActions['Kniebeuge']?.action,
      noteOld: st.exerciseNotes['Kniebeugen'], noteNew: st.exerciseNotes['Kniebeuge'],
      altOld: st.customAlternatives['Kniebeugen'], altNew: st.customAlternatives['Kniebeuge'],
    };
  });

  expect(result.prsOld).toBeUndefined();
  expect(result.prsNew).toBe(100);
  expect(result.plateauOld).toBeUndefined();
  expect(result.plateauNew).toBe('ignored');
  expect(result.noteOld).toBeUndefined();
  expect(result.noteNew).toBe('Rack Stufe 4');
  expect(result.altOld).toBeUndefined();
  expect(result.altNew).toEqual(['Beinpresse']);
});

test('B7/V1/V2: DAY_LOAD_VACATION_PLAN legt Übungen mit vollständigem Feld-Set an (prWeight/prRepsAtMaxWeight/showPlates)', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [])]);
  await seed(page, [week], 0);

  const ex = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.DAY_LOAD_VACATION_PLAN, { di: 0, plan: 'bodyweight' });
    return mod.getState().weeks[0].days[0].exercises[0];
  });
  expect(ex.prWeight).toBeNull();
  expect(ex.prRepsAtMaxWeight).toBeNull();
  expect(ex.showPlates).toBe(false); // 'Liegestütz' ist in NO_BARBELL_EXERCISE_NAMES
  expect(ex.progressionMode).toBe('weight_first');
});

test('B7/V1/V2: ein echter PR auf einer Urlaubsplan-Übung wird während der Sitzung sofort erkannt', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [])]);
  await seed(page, [week], 0);

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.WEEK_LOAD_VACATION_PLAN, { plan: 'light_kb' });
    mod.dispatch(mod.A.SET_UPDATE, { di: 0, ei: 0, si: 0, field: 'weight', value: '25' });
    mod.dispatch(mod.A.SET_UPDATE, { di: 0, ei: 0, si: 0, field: 'reps', value: '12' });
    mod.dispatch(mod.A.SET_TOGGLE_DONE, { di: 0, ei: 0, si: 0 }); // pending -> success
    const ex = mod.getState().weeks[0].days[0].exercises[0];
    return { prWeight: ex.prWeight, prBadge: ex.sets[0].prBadge, progressionMode: ex.progressionMode };
  });
  // Ohne Fix: prWeight/prRepsAtMaxWeight waren undefined statt null ->
  // _applyPrTracking()s `ex.prWeight === null`-Prüfung griff nicht -> kein Badge.
  expect(result.prWeight).toBe(25);
  expect(result.prBadge).toBe('weight');
  expect(result.progressionMode).toBe('weight_first'); // fehlte vorher bei WEEK_LOAD_VACATION_PLAN
});
