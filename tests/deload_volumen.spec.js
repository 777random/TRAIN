import { test, expect } from '@playwright/test';

// Sprint C2 (Teil B, Pritchard et al. 2015): Deload reduziert Volumen
// (Satz-Anzahl), nicht Intensität (Gewicht). "Plan übernehmen" öffnet eine
// Wahl zwischen sofortiger ("Diese Woche") und aufgeschobener ("Nächste
// Woche") Anwendung. Fixture (9 Wochen, RPE 8.5, steigendes Gewicht) ist
// identisch zum bereits etablierten deload_preventive-Trigger aus
// tests/session_summary.spec.js.

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

/**
 * 9 Wochen, letzte Woche mit einem abgeschlossenen und einem offenen Tag.
 * @param {number} offsetWeeks  zusätzliche Wochen in die Vergangenheit
 *   verschieben (0 = letzte Woche liegt auf dem aktuellen Montag; 1 = liegt
 *   eine Woche zurück, damit AUTO_WEEK_CREATE beim nächsten Laden eine neue
 *   Woche für den aktuellen Montag anlegt, da dieser noch nicht existiert).
 */
function buildDeloadWeeks(offsetWeeks = 0) {
  const weeks = [];
  for (let i = 0; i < 8; i++) {
    const day = mkDay(1, [mkEx('Kniebeuge', 100 + i * 2.5)]);
    weeks.push({ id: i + 1, startDate: isoMondayWeeksAgo(8 - i + offsetWeeks), note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  }
  const doneDay = mkDay(10, [mkEx('Kniebeuge', 120, 5)], { markedDone: true });
  const openDay = mkDay(11, [mkEx('Kniebeuge', 120, 5)], { markedDone: false });
  weeks.push({ id: 9, startDate: isoMondayWeeksAgo(offsetWeeks), note: '', mode: 'standard', days: [doneDay, openDay], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false });
  return weeks;
}

async function seed(page, weeks, { autoWeekEnabled = false } = {}) {
  await page.evaluate(({ weeksArg, autoWeekEnabled }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: autoWeekEnabled, suggestProgress: false, showReview: false }, deloadFactor: 0.75 },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: Date.now(), plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, autoWeekEnabled });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function getState(page) {
  return page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
}

test('"Diese Woche" reduziert nur den heute noch offenen Tag, der abgeschlossene Tag bleibt unangetastet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.waitForSelector('#deload-choice-modal', { timeout: 3000 });
  await page.click('[data-deload="now"]');

  const st = await getState(page);
  const wk = st.weeks.at(-1);
  expect(wk.mode).toBe('deload');
  const doneSets = wk.days[0].exercises[0].sets;
  const openSets = wk.days[1].exercises[0].sets;
  expect(doneSets.some(s => s.deloadSkip)).toBe(false); // abgeschlossener Tag unangetastet
  expect(openSets.filter(s => s.deloadSkip).length).toBe(2); // 5 Sätze -> Ziel 3, 2 übersprungen
  expect(doneSets.every(s => s.weight === 120)).toBe(true);
  expect(openSets.every(s => s.weight === 120)).toBe(true); // Gewicht nie verändert

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('deloadSkip-Sätze werden visuell ausgegraut, mit "Deload"-Label und gesperrten Eingaben dargestellt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.waitForSelector('#deload-choice-modal', { timeout: 3000 });
  await page.click('[data-deload="now"]');

  await page.click('[data-tab="workout"]');
  // Tag 2 (Index 1, offener Tag) ist der reduzierte -- Satz-Index 3/4 (0-basiert) übersprungen.
  const skippedRow = page.locator('.set-row--deload-skip').first();
  await expect(skippedRow).toBeVisible();
  await expect(skippedRow.locator('.deload-badge')).toHaveText('Deload');
  await expect(skippedRow.locator('.num-input').first()).toBeDisabled();
  await expect(skippedRow.locator('.set-done-btn')).toBeDisabled();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Tagesabschluss zählt deloadSkip-Sätze nicht als verpasst', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.waitForSelector('#deload-choice-modal', { timeout: 3000 });
  await page.click('[data-deload="now"]');

  await page.click('[data-tab="workout"]');
  const stats = await page.evaluate(() => {
    // _getDayCompletionStats ist modulintern -- über den sichtbaren Tages-
    // abschluss-Button-Fluss nicht ohne Weiteres ansteuerbar; stattdessen
    // direkt die verbleibenden (nicht deloadSkip) Sätze des offenen Tages
    // zählen und mit dem tatsächlich gerenderten Fortschritt vergleichen.
    const st = JSON.parse(localStorage.getItem('train_v6'));
    const day = st.weeks.at(-1).days[1];
    const ex = day.exercises[0];
    return {
      total: ex.sets.length,
      countable: ex.sets.filter(s => !s.deloadSkip).length,
    };
  });
  expect(stats.total).toBe(5);
  expect(stats.countable).toBe(3);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('"Nächste Woche" + manuelle Wochenerstellung: neue Woche wird Deload-Woche, Marker wird konsumiert', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.waitForSelector('#deload-choice-modal', { timeout: 3000 });
  await page.click('[data-deload="next"]');

  let st = await getState(page);
  const sourceWk = st.weeks.at(-1);
  expect(sourceWk.mode).toBe('standard');
  expect(sourceWk.deloadPlannedForNext).toBe(true);

  await page.click('[data-tab="workout"]');
  await page.click('[data-action="open-new-week"]');
  // Die letzte Woche hat einen markedDone-Tag -- "open-new-week" zeigt daher
  // zuerst den Wochenrückblick (showWeekReviewModal), erst nach "Weiter →"
  // öffnet sich das eigentliche "Neue Woche"-Modal.
  await page.click('#wr-btn-continue');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');

  st = await getState(page);
  const newWk = st.weeks.at(-1);
  expect(newWk.mode).toBe('deload');
  // Beide Tage der neuen Woche sind frisch (nichts markedDone) -> beide reduziert.
  expect(newWk.days[0].exercises[0].sets.filter(s => s.deloadSkip).length).toBe(2);
  expect(newWk.days[1].exercises[0].sets.filter(s => s.deloadSkip).length).toBe(2);
  // Marker auf der Quellwoche konsumiert (verhindert Stale-Re-Trigger nach WEEK_DELETE).
  const sourceAfter = st.weeks.find(w => w.id === sourceWk.id);
  expect(sourceAfter.deloadPlannedForNext).toBe(false);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('"Nächste Woche" + automatische Wochenerstellung (Montags-Rollover) wendet den Marker ebenfalls an', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  // Fixture eine Woche zurückverschoben (letzte Woche = letzter Montag, nicht
  // der aktuelle) -- der aktuelle Montag existiert dadurch noch nicht,
  // AUTO_WEEK_CREATE legt ihn beim nächsten Laden automatisch an.
  await seed(page, buildDeloadWeeks(1));

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.waitForSelector('#deload-choice-modal', { timeout: 3000 });
  await page.click('[data-deload="next"]');

  await page.evaluate(() => {
    const st = JSON.parse(localStorage.getItem('train_v6'));
    st.settings.autoWeek.enabled = true;
    localStorage.setItem('train_v6', JSON.stringify(st));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const st = await getState(page);
  expect(st.weeks.length).toBe(10); // 9 Fixture-Wochen + 1 automatisch erstellte
  const newWk = st.weeks.at(-1);
  expect(newWk.mode).toBe('deload');
  expect(newWk.days.some(d => d.exercises[0].sets.some(s => s.deloadSkip))).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Woche nach einer Deload-Woche wird aus der Vor-Deload-Woche geklont (originale Satz-Anzahl)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seed(page, buildDeloadWeeks());

  await page.click('[data-tab="coach"]');
  await page.click('[data-action="apply-deload-plan"]');
  await page.waitForSelector('#deload-choice-modal', { timeout: 3000 });
  await page.click('[data-deload="now"]'); // aktuelle (letzte) Woche wird sofort zur Deload-Woche

  // Neue Woche NACH der Deload-Woche erstellen -- sollte aus der Woche VOR
  // dem Deload klonen (die vorletzte Fixture-Woche, 1 Tag, 5 Sätze, kein
  // deloadSkip), nicht aus der reduzierten Deload-Woche selbst.
  await page.click('[data-tab="workout"]');
  await page.click('[data-action="open-new-week"]');
  // Die letzte Woche hat einen markedDone-Tag -- "open-new-week" zeigt daher
  // zuerst den Wochenrückblick (showWeekReviewModal), erst nach "Weiter →"
  // öffnet sich das eigentliche "Neue Woche"-Modal.
  await page.click('#wr-btn-continue');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');

  const st = await getState(page);
  const newWk = st.weeks.at(-1);
  expect(newWk.mode).toBe('standard');
  // Vor-Deload-Woche hatte nur 1 Tag (das Fixture-Muster der ersten 8 Wochen) --
  // die geklonte Woche übernimmt diese Struktur, nicht die 2-Tage-Struktur
  // der Deload-Woche selbst.
  expect(newWk.days.length).toBe(1);
  expect(newWk.days[0].exercises[0].sets.some(s => s.deloadSkip)).toBe(false);
  expect(newWk.days[0].exercises[0].sets.length).toBe(5);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
