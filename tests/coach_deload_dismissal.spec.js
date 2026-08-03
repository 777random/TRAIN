import { test, expect } from '@playwright/test';

// B131: die Deload-Strukturkarte hatte bisher KEINEN eigenen Dismiss-Button —
// das sichtbare "Weiter wie bisher" gehörte zur unabhängigen Hauptkarte
// (computeWeeklyFocus(), type:focus.status) und hatte nie Einfluss auf
// _checkPreventiveDeload() (weeklyFocus.js), das nie decisionLog las. Jetzt:
// eigener Button auf der Deload-Karte selbst, dispatcht DECISION_LOG_ADD mit
// type:'preventive_deload', choice:'stay' — _checkPreventiveDeload()
// unterdrückt sich selbst 4 Wochen lang, wenn ein solcher Eintrag existiert.
// Fixture-Muster identisch zu tests/coach_deload_info_badge.spec.js (8 Wochen,
// RPE 8.5, steigendes Gewicht -> triggert _checkPreventiveDeload()).
//
// Runde 14 (Council-Entscheidung, Governance Coach-Struktursignale): der
// Button-Mechanismus wurde generalisiert (data-action jetzt
// "coach-signal-dismiss" + data-signal-type statt dem deload-exklusiven
// "decision-log-deload-stay", Button-Label jetzt "Verstanden" statt "Weiter
// wie bisher") -- dieselbe Infrastruktur wird in Runde 14 auch für
// consistency_quality/push_pull/recurring_fatigue genutzt (siehe jeweils
// eigene Testdateien). Verhalten/Timing hier unverändert, nur die
// Selektoren angepasst.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, nSets = 5, rpe = 8.5) {
  return Array.from({ length: nSets }, () => ({ weight, reps: 5, rpe, status: 'success', done: true, note: '' }));
}

function mkEx(name, weight, nSets = 5) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
    sets: mkSet(weight, nSets),
    prWeight: weight, prRepsAtMaxWeight: 5, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: nSets, targetReps: 5,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

function mkDay(id, exercises, { markedDone = true } = {}) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

// 8 Wochen Kniebeuge, RPE 8.5, steigendes Gewicht -> deload_preventive.
function buildDeloadWeeks() {
  const weeks = [];
  for (let i = 0; i < 8; i++) {
    const day = mkDay(1, [mkEx('Kniebeuge', 100 + i * 2.5)]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(8 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  const doneDay = mkDay(10, [mkEx('Kniebeuge', 120, 5)], { markedDone: true });
  const openDay = mkDay(11, [mkEx('Kniebeuge', 120, 5)], { markedDone: false });
  weeks.push({ id: 9, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [doneDay, openDay], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  return weeks;
}

// Wie buildDeloadWeeks(), aber zusätzlich Bankdrücken (Push, viele Sätze) +
// Rudern (Pull, wenige Sätze) jede Woche -> triggert ZUSÄTZLICH push_pull
// (Verhältnis > 1.5), um zu prüfen dass nach Deload-Unterdrückung automatisch
// das nächste qualifizierende Struktursignal einen der 2 sichtbaren Slots
// bekommt (computeStructuralSignals() ist reine Neuberechnung pro Render).
function buildDeloadPlusPushPullWeeks() {
  const weeks = [];
  for (let i = 0; i < 8; i++) {
    const day = mkDay(1, [
      mkEx('Kniebeuge', 100 + i * 2.5),
      mkEx('Bankdrücken', 60, 5),
      mkEx('Rudern', 40, 1),
    ]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(8 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  const doneDay = mkDay(10, [mkEx('Kniebeuge', 120, 5), mkEx('Bankdrücken', 60, 5), mkEx('Rudern', 40, 1)], { markedDone: true });
  const openDay = mkDay(11, [mkEx('Kniebeuge', 120, 5), mkEx('Bankdrücken', 60, 5), mkEx('Rudern', 40, 1)], { markedDone: false });
  weeks.push({ id: 9, startDate: isoMondayWeeksAgo(0), note: '', mode: 'standard', days: [doneDay, openDay], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  return weeks;
}

async function seed(page, weeks, decisionLog = []) {
  await page.evaluate(({ weeksArg, decisionLogArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false, suggestProgress: false, showReview: false }, deloadFactor: 0.75 },
      favoriteExercises: [], customExercises: [], exerciseNotes: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: decisionLogArg, badges: [], onboardingDone: true,
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weeksArg: weeks, decisionLogArg: decisionLog });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// Runde 14 (Council-Entscheidung): Haupttext ist jetzt reine Beobachtung
// ("... Wochen ohne Deload, Volumentrend ..."), die Empfehlung
// ("Regenerationswoche einplanen") liegt nur noch im info-Feld/Aufklapp-Feld.
test('Deload-Haupttext ist Beobachtung (kein "einplanen"-Imperativ), Empfehlung liegt im Aufklapp-Feld', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const mainText = await page.locator('.coach-structural-text').first().textContent();
  expect(mainText).toContain('Wochen ohne Deload');
  expect(mainText).toContain('Volumentrend');
  expect(mainText).not.toContain('einplanen');

  await page.locator('.deload-info__badge').first().click();
  const infoText = await page.locator('.deload-info__body').first().textContent();
  expect(infoText).toContain('einplanen');
});

// Escalation-Stufenleiter (Council-Vorgabe: begrenzt, nicht wortwörtlich
// identisch beim Re-Trigger nach Cooldown-Ablauf).
test('Re-Trigger nach 1 vorherigem Dismiss zeigt Eskalations-Stufe 1 (nicht identischer Text)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  // Eintrag ist 5 Wochen alt -> Cooldown (4 Wochen) abgelaufen, Signal feuert
  // wieder, aber tier=1 (genau 1 vorheriger 'stay'-Eintrag für diesen Typ).
  await seed(page, buildDeloadWeeks(), [
    { id: 1, type: 'preventive_deload', signal: 'x', choice: 'stay', decidedWeekStart: isoMondayWeeksAgo(5), outcome: null },
  ]);

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const mainText = await page.locator('.coach-structural-text').first().textContent();
  expect(mainText).toContain('Seit deiner letzten Entscheidung sind weitere');
  expect(mainText).toContain('Wochen ohne Deload');
});

test('Re-Trigger nach 2 vorherigen Dismissals zeigt Eskalations-Stufe 2 (gedeckelt, nicht weiter wachsend)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks(), [
    { id: 1, type: 'preventive_deload', signal: 'x', choice: 'stay', decidedWeekStart: isoMondayWeeksAgo(9), outcome: null },
    { id: 2, type: 'preventive_deload', signal: 'x', choice: 'stay', decidedWeekStart: isoMondayWeeksAgo(5), outcome: null },
  ]);

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const mainText = await page.locator('.coach-structural-text').first().textContent();
  expect(mainText).toContain('Das Muster hält weiterhin an');
});

test('"Weiter wie bisher" auf der Deload-Karte loggt preventive_deload/stay und blendet die Karte aus', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const dismissBtn = page.locator('[data-action="coach-signal-dismiss"][data-signal-type="preventive_deload"]');
  await expect(dismissBtn).toBeVisible();
  await dismissBtn.click();
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="preventive_deload"]')).toHaveCount(0);
  await expect(page.locator('.deload-info__badge')).toHaveCount(0);

  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).decisionLog);
  expect(log).toHaveLength(1);
  expect(log[0].type).toBe('preventive_deload');
  expect(log[0].choice).toBe('stay');
  expect(typeof log[0].decidedWeekStart).toBe('string');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('decisionLog-Eintrag 3 Wochen alt unterdrückt das Signal weiterhin (innerhalb 4-Wochen-Fenster)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks(), [
    { id: 1, type: 'preventive_deload', signal: 'x', choice: 'stay', decidedWeekStart: isoMondayWeeksAgo(3), outcome: null },
  ]);

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="preventive_deload"]')).toHaveCount(0);
  await expect(page.locator('.deload-info__badge')).toHaveCount(0);
});

test('decisionLog-Eintrag 5 Wochen alt unterdrückt NICHT mehr (Fenster abgelaufen)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks(), [
    { id: 1, type: 'preventive_deload', signal: 'x', choice: 'stay', decidedWeekStart: isoMondayWeeksAgo(5), outcome: null },
  ]);

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="preventive_deload"]')).toBeVisible();
});

test('Nach Deload-Unterdrückung erscheint automatisch ein anderes qualifizierendes Struktursignal (push_pull)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Ohne Unterdrückung: deload_preventive nimmt (mind.) einen der 2 Slots.
  await seed(page, buildDeloadPlusPushPullWeeks());
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);
  const itemsBefore = await page.locator('.coach-structural-item').count();
  expect(itemsBefore).toBeGreaterThan(0);

  // Mit Unterdrückung (Eintrag von heute): deload verschwindet, push_pull
  // sollte jetzt sichtbar sein — reine Neuberechnung, kein Zusatzcode nötig.
  await seed(page, buildDeloadPlusPushPullWeeks(), [
    { id: 1, type: 'preventive_deload', signal: 'x', choice: 'stay', decidedWeekStart: isoMondayWeeksAgo(0), outcome: null },
  ]);
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="coach-signal-dismiss"][data-signal-type="preventive_deload"]')).toHaveCount(0);
  await expect(page.locator('.coach-structural-item', { hasText: 'Push' })).toBeVisible();
});

test('Hauptkarten-"Weiter wie bisher" (overload etc.) funktioniert weiterhin unverändert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Schlechter Schlaf -> overload/sleep-Signal auf der Hauptkarte.
  const weeks = [];
  for (let i = 0; i < 3; i++) {
    const day = mkDay(1, [mkEx('Kniebeuge', 100, 5)]);
    day.sleepHours = 5;
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(2 - i), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  await seed(page, weeks);

  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(300);

  const stayBtn = page.locator('[data-action="decision-log-stay"]');
  if (await stayBtn.count() > 0) {
    await stayBtn.click();
    await page.waitForTimeout(200);
    const log = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).decisionLog);
    expect(log.length).toBeGreaterThan(0);
    expect(log.at(-1).type).not.toBe('preventive_deload');
  }

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
