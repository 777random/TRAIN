import { test, expect } from '@playwright/test';

// Runde 40 (ui.js-Render-Logik-Audit, Teil 2: App-Scaffold/Modals/
// Completion-Flow, Zeile 8441-10335): zweite Runde der neuen Multi-
// Runden-Serie für ui.js' bisher nie eigenständig auditierte Render-
// Logik, nach Runde 39 (Training-Tab). 2 parallele Diagnose-Agenten
// fanden 9 bestätigte Kernfunde (4 HIGH, 4 MEDIUM, 1 LOW/MEDIUM) plus
// 2 direkt anliegende Nebenfunde (F10 ui.js, F11 state.js), siehe
// `Diagnose & Sprints/diagnose-uijs-scaffold-modals-completion-audit-
// 2026-08-22.txt`.

function todayISO() { return new Date().toISOString().split('T')[0]; }
function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSuccessSet(weight, reps, rpe = 7) {
  return { weight, reps, rpe, status: 'success', done: true, note: '' };
}
function mkPendingSet(weight = 0, reps = 0) {
  return { weight, reps, rpe: null, status: 'pending', done: false, note: '' };
}

function mkHistoryEx(name, weight, { weightStep = 2.5, targetReps = 5, rpe = 7, archived = false } = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: [mkSuccessSet(weight, targetReps, rpe)],
    prWeight: weight, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    targetSets: 1, targetReps, progressionType: 'weight', progressionMode: 'weight_first',
    targetRepsMax: null, archived, substituteFor: null,
  };
}
function mkTodayEx(name, {
  weightStep = 2.5, targetReps = 5, rpe = 7, sets = null, archived = false, substituteFor = null,
} = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep,
    sets: sets ?? [mkSuccessSet(75, targetReps, rpe)],
    prWeight: 75, prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
    targetSets: 1, targetReps, progressionType: 'weight', progressionMode: 'weight_first',
    targetRepsMax: null, archived, substituteFor,
  };
}
function mkHistoryDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: Date.now(),
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}
function mkTodayDay(exercises, overrides = {}) {
  return {
    id: 99, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    ...overrides,
  };
}
function mkWeek(id, startDate, days, overrides = {}) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false, ...overrides };
}

// 3 vergangene Wochen (steigend, RPE<=8) + heutiger Tag -> isReadyForAutoSelect()
// liefert true, getWeightRecommendation() eine Steigerung (Muster aus
// auto_progression_optout.spec.js, dort bereits als zuverlässig verifiziert).
function buildEligibleWeeks(exerciseName, todayExercises, opts = {}) {
  return [
    mkWeek(1, weeksAgoISO(3), [mkHistoryDay(1, [mkHistoryEx(exerciseName, 70)])]),
    mkWeek(2, weeksAgoISO(2), [mkHistoryDay(2, [mkHistoryEx(exerciseName, 72.5)])]),
    mkWeek(3, weeksAgoISO(1), [mkHistoryDay(3, [mkHistoryEx(exerciseName, 75)])]),
    mkWeek(4, weeksAgoISO(0), [mkTodayDay(todayExercises, opts)]),
  ];
}

async function seed(page, weeks, curIdx, extra = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, curIdx, extra }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks: weeksArg,
      customTemplate: [], templates: [], settings: { sessionCoach: false, plateStep: 2.5 },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null, plateauActions: [],
      decisionLog: [], badges: [], onboardingDone: true, longestStreakEver: 0, seenTips: [],
      ...extra,
    }));
  }, { weeksArg: weeks, curIdx, extra });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function readState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

async function completeDay(page) {
  await page.click('[data-action="toggle-complete"]');
  while (await page.locator('[data-skip-val=""]').count() > 0) {
    await page.click('[data-skip-val=""]');
    await page.waitForTimeout(100);
  }
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
  await page.waitForSelector('#session-summary-continue', { timeout: 5000 });
}

// ─── F1 — Named-Template-Auswahl im "Neue Woche"-Modal ────────────────────────

test('F1: benannte Vorlage aus dem "Neue Woche"-Dropdown wird tatsächlich verwendet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week = mkWeek(1, todayISO(), [mkTodayDay([mkTodayEx('Standardübung')])]);
  await seed(page, [week], 0, {
    customTemplate: [{ id: 'A', title: 'Tag A', subtitle: '', warmup: '', cooldown: '', exercises: [{ name: 'Standardübung', note: '', pauseSec: 90, metric: 'reps', sets: [{ weight: 0, reps: 10, rpe: null, status: 'pending', done: false, note: '' }] }] }],
    templates: [
      { id: 1, name: 'Push/Pull/Legs', days: [{ id: 'X', title: 'Tag X', subtitle: '', warmup: '', cooldown: '', exercises: [{ name: 'Vorlage-Übung', note: '', pauseSec: 90, metric: 'reps', sets: [{ weight: 0, reps: 10, rpe: null, status: 'pending', done: false, note: '' }] }] }] },
    ],
  });

  await page.click('[data-action="open-new-week"]');
  await expect(page.locator('#modal-new-week')).toBeVisible();
  await page.uncheck('#nw-copy-prev');
  await page.selectOption('#nw-template-select', 'tpl-0');
  await page.fill('#new-week-date', weeksAgoISO(-1));
  await page.click('[data-action="create-week"]');
  await expect(page.locator('#modal-new-week')).toBeHidden();

  const st = await readState(page);
  const newWeek = st.weeks.find(w => w.id !== week.id);
  expect(newWeek.days[0].exercises[0].name).toBe('Vorlage-Übung');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F2 — Vorlagen-Editor verwirft ungespeicherte Eingaben ────────────────────

test('F2: Übungsname bleibt beim Hinzufügen einer weiteren Übung erhalten (vorher: kommentarlos verworfen)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week = mkWeek(1, todayISO(), [mkTodayDay([mkTodayEx('Standardübung')])]);
  await seed(page, [week], 0, {
    customTemplate: [{ id: 'A', title: 'Tag A', subtitle: '', warmup: '', cooldown: '', exercises: [{ name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', sets: [{ weight: 20, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }] }],
  });
  await page.click('[data-tab="settings"]');
  await page.click('[data-action="open-tpl"]');
  await expect(page.locator('#modal-template')).toBeVisible();

  // Umbenennen, NICHT speichern, dann eine Übung hinzufügen -- vor F2 wurde
  // diese Umbenennung dabei kommentarlos verworfen.
  const nameInput = page.locator('[data-tpl-di="0"][data-tpl-ei="0"][data-tpl-field="name"]');
  await nameInput.fill('Front Squat');
  await page.click('[data-tpl-action="add-ex"][data-tpl-di="0"]');
  await expect(page.locator('[data-tpl-di="0"][data-tpl-ei="1"][data-tpl-field="name"]')).toHaveCount(1);
  await expect(nameInput).toHaveValue('Front Squat');

  await page.click('[data-action="save-tpl"]');
  const st = await readState(page);
  expect(st.customTemplate[0].exercises[0].name).toBe('Front Squat');
  expect(st.customTemplate[0].exercises).toHaveLength(2);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F3 — Neue-Woche-Auto-Vorauswahl bei Multi-Tag-Substitution ───────────────

test('F3: an einem von zwei Tagen substituierte Übung bekommt dieselbe Auto-Vorauswahl wie ihre Schwester-Instanz', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const exName = 'Kreuzheben';
  const weeks = buildEligibleWeeks.call(null, exName, null);
  // Heutige Woche: 2 Tage, Tag A normal, Tag B substituiert (Original =
  // exName, heutiger Name = 'Rudern').
  weeks[3].days = [
    mkTodayDay([mkTodayEx(exName, { targetReps: 5 })]),
    { ...mkTodayDay([mkTodayEx('Rudern', { targetReps: 5, substituteFor: exName })]), id: 100 },
  ];

  await seed(page, weeks, 3);
  await page.click('[data-action="open-new-week"]');
  await expect(page.locator('#modal-new-week')).toBeVisible();

  const st = await readState(page);
  const curWk = st.weeks[3];
  const dayA = curWk.days[0].exercises[0];
  const dayB = curWk.days[1].exercises[0];
  expect(dayA.nextWeekPlanConfirmed).toBe(true);
  expect(dayB.nextWeekPlanConfirmed).toBe(true);
  expect(dayB.nextWeekPlan).toBe(dayA.nextWeekPlan);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F4 — Übungssuche-Duplikat-Check ───────────────────────────────────────────

test('F4: Übungssuche erkennt eine heute substituierte Übung unter ihrem Original-Namen als "bereits im Tag"', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week = mkWeek(1, todayISO(), [mkTodayDay([mkTodayEx('Liegestütz', { substituteFor: 'Bankdrücken' })])]);
  await seed(page, [week], 0);

  await page.click('[data-action="open-ex-search"][data-di="0"]');
  await page.fill('#ex-search-input', 'Bankdrücken');
  await page.waitForTimeout(150);
  await expect(page.locator('#ex-search-results')).toContainText('bereits im Tag');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F5 — Urlaubswoche-Popup fehlt die Datenverlust-Bestätigung ───────────────

test('F5: "Urlaubswoche" fragt jetzt nach Bestätigung, wenn bereits Sätze eingetragen sind', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week = mkWeek(1, todayISO(), [mkHistoryDay(1, [mkHistoryEx('Kniebeuge', 60)])]);
  week.days[0].markedDone = false; // Woche noch nicht abgeschlossen, nur der Satz bewertet
  await seed(page, [week], 0);

  let dialogSeen = false;
  page.on('dialog', d => { dialogSeen = true; d.dismiss(); });

  await page.click('[data-action="toggle-week-menu"]');
  await page.click('[data-action="mode-vac"]');
  await expect(page.locator('.vac-plan-modal-overlay')).toBeVisible();
  await page.click('[data-vac="rest"]');
  await page.waitForTimeout(150);

  expect(dialogSeen).toBe(true);
  const st = await readState(page);
  // Dialog wurde abgelehnt (dismiss) -> Daten müssen unangetastet sein.
  expect(st.weeks[0].days[0].exercises[0].sets[0].status).toBe('success');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F6 — Überhöhte Erfolgsquote auf dem Completion-Screen ────────────────────

test('F6: Completion-Screen zeigt die korrekte (nicht überhöhte) Erfolgsquote nach Tagesabschluss', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // 1 Erfolg + 1 offener Satz -> vor dem Fix zeigte der Screen 100%
  // (nur der bereits bewertete Satz zählte), tatsächlich korrekt sind 50%
  // (der offene Satz wird beim Abschluss auf 'fail' gesetzt).
  const ex = mkTodayEx('Kniebeuge', { sets: [mkSuccessSet(60, 8), mkPendingSet()] });
  const week = mkWeek(1, todayISO(), [mkTodayDay([ex])]);
  await seed(page, [week], 0);

  await completeDay(page);
  await page.click('#session-summary-continue');
  await expect(page.locator('.day-completion-screen__pct')).toHaveText('50%');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F7 — Archivierte Übung bekommt keine stille Gewichtsänderung ─────────────

test('F7: eine mitten in der Woche archivierte Übung bekommt beim Tagesabschluss keine automatische Gewichts-Vorauswahl', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const exName = 'Bankdrücken';
  // Archiviert, aber bereits ein Satz erfolgreich bewertet -> landet NICHT
  // in skippedNames (das würde die Funktion ohnehin schon abfangen) -- nur
  // der archived-Filter selbst entscheidet hier.
  const weeks = buildEligibleWeeks(exName, [mkTodayEx(exName, { archived: true, sets: [mkSuccessSet(75, 5)] })]);
  await seed(page, weeks, 3);

  await completeDay(page);
  const st = await readState(page);
  const ex = st.weeks[3].days[0].exercises[0];
  expect(ex.nextWeekPlanConfirmed).toBe(false);
  expect(ex.nextWeekPlan).toBe(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F8 — Session-Summary "Nächstes Training"-Vorschau substituteFor-blind ────

test('F8: "Nächstes Training"-Vorschau erscheint für eine heute substituierte Fokus-Übung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const exName = 'Bankdrücken';
  // Heute: "Liegestütz" ersetzt "Bankdrücken" (Push-Kategorie, siehe
  // movementMap.js). Historie liegt unter dem Original-Namen.
  const weeks = buildEligibleWeeks(exName, [mkTodayEx('Liegestütz', { substituteFor: exName })]);
  await seed(page, weeks, 3);

  await completeDay(page);
  await expect(page.locator('.session-summary-screen__next')).toBeVisible();
  await expect(page.locator('.session-summary-screen__next')).toContainText('Nächstes Training');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F9 — Echtzeit-PR-Toast auch für Wdh-PRs ──────────────────────────────────

test('F9: ein Wiederholungs-PR (gleiches Gewicht, mehr Wdh) löst den Echtzeit-PR-Toast aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  // ex.prWeight/prRepsAtMaxWeight bereits auf 60kg×8 -- ein Satz mit 60kg×9
  // ist ein Wdh-PR (prBadge:'reps'), kein Gewichts-PR.
  const ex = {
    name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 9, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: 60, prRepsAtMaxWeight: 8, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
  };
  const week = mkWeek(1, todayISO(), [mkTodayDay([ex])]);
  await seed(page, [week], 0);

  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="0"]');
  await expect(page.locator('#pr-moment-toast')).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F10 — Skip-Grund-Abfrage schließt archivierte Übungen aus ───────────────

test('F10: eine archivierte, unbewertete Übung wird beim Tagesabschluss NICHT nach dem Skip-Grund gefragt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const trainedEx = mkTodayEx('Kniebeuge');
  const archivedUntouchedEx = mkTodayEx('Beinpresse', { archived: true, sets: [mkPendingSet()] });
  const week = mkWeek(1, todayISO(), [mkTodayDay([trainedEx, archivedUntouchedEx])]);
  await seed(page, [week], 0);

  await page.click('[data-action="toggle-complete"]');
  // Die archivierte Übung darf NICHT in der Skip-Grund-Warteschlange
  // auftauchen -- direkt der Bewertungs-Dialog sollte erscheinen.
  await expect(page.locator('[data-skip-val]').first()).toHaveCount(0);
  await expect(page.locator('.completion-modal__rate-btn').first()).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F11 — PR-Baseline schließt die Seed-Woche nicht aus ──────────────────────

test('F11: eine Korrektur an einem PR-Satz zieht die Seed-Woche nicht mehr als Baseline heran', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const seedWeek = mkWeek(1, weeksAgoISO(2), [
    { ...mkHistoryDay(1, [mkHistoryEx('Kniebeuge', 100, { targetReps: 5 })]), isSeedWeek: true },
  ], { isSeedWeek: true });
  const realWeek = mkWeek(2, todayISO(), [mkHistoryDay(2, [mkHistoryEx('Kniebeuge', 60, { targetReps: 8 })])]);

  await seed(page, [seedWeek, realWeek], 1);

  const prs = await page.evaluate(async () => {
    const mod = await import('./state.js');
    // Korrektur an einem bereits bewerteten (success) Satz -> löst
    // _recomputePrFromHistory() aus.
    mod.dispatch(mod.A.SET_UPDATE, { di: 0, ei: 0, si: 0, field: 'reps', value: '9' });
    return mod.getState().prs['Kniebeuge'];
  });

  expect(prs.maxWeight).toBe(60);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
