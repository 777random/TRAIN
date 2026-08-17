import { test, expect } from '@playwright/test';

// Nutzer-Feedback (2026-08-17): Trainings-Tab-Berechnungs-Audit (5 parallele
// Diagnose-Agenten) fand 5 bestätigte Bugs + 8 Verdachtsfälle. Dieser Test
// deckt die wichtigsten Fixes ab, die noch nicht durch bestehende Tests
// abgesichert sind (toggle-done/train:set-done ist bereits indirekt über
// mobile_feedback_scroll.spec.js "A2: Toast wird über dem sichtbaren
// Pause-Overlay..." abgedeckt, hier nicht erneut dupliziert).

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
    sets: [{ weight: 60, reps: 8, rpe: 7, status: 'pending', done: false, note: '' }],
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
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true, autoStartPauseTimer: true },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
      ...extraArg,
    }));
  }, { weeksArg: weeks, curIdxArg: curIdx, extraArg: extra });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Startwerte-Woche wird von der Gewichtsempfehlung ausgeschlossen (Intra-Session-Feedback)', async ({ page }) => {
  const seedWeek = mkWeek(0, '2026-06-01', [mkDay(1, [mkEx('Kniebeuge', {
    sets: [{ weight: 60, reps: 5, rpe: null, status: 'success', done: true, note: '' }],
  })])], true);
  const curWeek = mkWeek(1, todayISO(), [mkDay(2, [mkEx('Kniebeuge', {
    sets: [{ weight: 65, reps: 8, rpe: 7, status: 'pending', done: false, note: '' }],
  })])]);

  await seed(page, [seedWeek, curWeek], 1);
  // RPE 7 (nicht 6!) -- buildLastSetMessage() nimmt bei RPE<=6 einen
  // ANDEREN Zweig ("Optionaler Satz"), der nextWeekWeight gar nicht nutzt.
  // Nur der "Übung abgeschlossen ✓ Nächste Woche: ..."-Zweig (RPE 7) liest
  // tatsächlich den calcWeeks-basierten nextWeekWeight-Wert aus.
  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="0"][data-val="7"]');
  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.waitForTimeout(300);

  // Einziger Satz -> letzter Satz -> buildLastSetMessage() nutzt
  // nextWeekWeight (aus calcWeeks). Mit nur Seed-Woche + dieser einen echten
  // Woche darf calcWeeks.length NIE >=2 erreichen -- der Text muss "gleiches
  // Gewicht" zeigen (nextWeekWeight===null), nicht eine konkrete kg-Zahl,
  // die auf dem Vergleich Seed-Startwert vs. erste echte Session beruht.
  const feedback = page.locator('.set-feedback__line').first();
  await expect(feedback).toContainText('gleiches Gewicht');
});

test('Archivierte Übung mit offenen Sätzen bricht die Streak nicht (_dayEvalCounts)', async ({ page }) => {
  const prevWeeks = [3, 2, 1].map(n => mkWeek(n, isoWeeksAgo(n), [
    mkDay(n * 10, [mkEx('Kniebeuge', { sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }] })], { markedDone: true, locked: true }),
  ]));
  const curWeek = mkWeek(4, isoWeeksAgo(0), [
    mkDay(40, [
      mkEx('Kniebeuge', { sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }] }),
      // Archivierte Übung mit noch offenen (pending) Sätzen -- darf den Tag
      // NICHT unter die 50%-Bewertungsquote drücken.
      mkEx('Bizepscurls', { archived: true, sets: [
        { weight: 15, reps: 10, rpe: null, status: 'pending', done: false, note: '' },
        { weight: 15, reps: 10, rpe: null, status: 'pending', done: false, note: '' },
        { weight: 15, reps: 10, rpe: null, status: 'pending', done: false, note: '' },
      ] }),
    ], { markedDone: true, locked: true }),
  ]);

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const result = await page.evaluate(async ({ weeksArg }) => {
    const mod = await import('./state.js');
    return mod.calcCurrentStreak(weeksArg);
  }, { weeksArg: [...prevWeeks, curWeek] });

  expect(result).toBeGreaterThanOrEqual(4);
});

test('EX_MERGE_NAMES aktualisiert substituteFor-Referenzen (kein Geister-Name nach Zurücksetzen)', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [
    mkEx('Ausfallschritte', { substituteFor: 'Kniebeuge (alt)' }),
  ])]);
  await seed(page, [week], 0);

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.EX_MERGE_NAMES, { variantNames: ['Kniebeuge (alt)'], finalName: 'Kniebeuge' });
    return mod.getState().weeks[0].days[0].exercises[0].substituteFor;
  });

  expect(result).toBe('Kniebeuge');
});

test('Phantom-PR: Korrektur eines PR-Satzes auf ein niedrigeres Gewicht senkt den gespeicherten PR', async ({ page }) => {
  const week = mkWeek(1, todayISO(), [mkDay(1, [
    // targetReps === reps des Satzes, damit die Statuseinstufung nach der
    // Gewichtskorrektur 'success' bleibt (isoliert den Phantom-PR-Effekt
    // von einer Nebenwirkung durch _evaluateSetStatus()).
    mkEx('Kreuzheben', { targetReps: 5, sets: [{ weight: 100, reps: 5, rpe: 8, status: 'success', done: true, note: '' }], prWeight: 100, prRepsAtMaxWeight: 5 }),
  ])]);
  await seed(page, [week], 0, { prs: { 'Kreuzheben': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-06-01' } } });

  const before = await page.evaluate(async () => {
    const mod = await import('./state.js');
    return mod.getState().prs['Kreuzheben']?.maxWeight;
  });
  expect(before).toBe(100);

  // Gewicht nachträglich korrigiert (z.B. Tippfehler) -- der 100kg-PR
  // basierte NUR auf diesem einen Satz, sollte danach nicht mehr bestehen.
  await page.fill('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]', '80');
  await page.dispatchEvent('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]', 'change');

  await page.waitForFunction(async () => {
    const mod = await import('./state.js');
    return mod.getState().prs['Kreuzheben']?.maxWeight === 80;
  }, { timeout: 5000 });

  const after = await page.evaluate(async () => {
    const mod = await import('./state.js');
    return mod.getState().prs['Kreuzheben']?.maxWeight;
  });
  expect(after).toBe(80);
});

test('skipReason "injury" wird beim Wochen-Klonen (WEEK_CREATE) zurückgesetzt (Ausnahme: "substituted" bleibt)', async ({ page }) => {
  const week = mkWeek(1, '2026-06-01', [mkDay(1, [
    mkEx('Kniebeuge', { skipReason: 'injury', skipDate: '2026-06-01' }),
    mkEx('Latziehen', { skipReason: 'substituted', skipDate: '2026-06-01' }),
  ], { markedDone: true, locked: true })]);
  await seed(page, [week], 0);

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.WEEK_CREATE, { startDate: '2026-06-08', source: 'prev' });
    const st = mod.getState();
    const newWk = st.weeks[st.weeks.length - 1];
    return {
      injuryReason: newWk.days[0].exercises[0].skipReason,
      substitutedReason: newWk.days[0].exercises[1].skipReason,
    };
  });

  expect(result.injuryReason).toBeNull();
  expect(result.substitutedReason).toBe('substituted');
});

test('skipReason "injury" wird auch bei WEEK_COPY_PREV zurückgesetzt (dritte, unabhängige Klon-Kopie)', async ({ page }) => {
  const week1 = mkWeek(1, '2026-06-01', [mkDay(1, [
    mkEx('Kniebeuge', { skipReason: 'injury', skipDate: '2026-06-01' }),
  ], { markedDone: true, locked: true })]);
  const week2 = mkWeek(2, '2026-06-08', [mkDay(2, [mkEx('Kniebeuge')])]);
  await seed(page, [week1, week2], 1);

  const result = await page.evaluate(async () => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.WEEK_COPY_PREV, {});
    return mod.getState().weeks[1].days[0].exercises[0].skipReason;
  });

  expect(result).toBeNull();
});
