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

test('onTrack (Runde 9/Cluster 1): "Einheiten"-Zaehler nutzt Auswertungs-Anteil statt markedDone', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  // Beide Tage haben markedDone:false (nie "Tag abschliessen" angetippt),
  // aber vollstaendig bewertete Saetze -> muessen unter der neuen Regel
  // trotzdem als "erledigt" in der Einheiten-Zahl auftauchen (vorher haette
  // dieser Fall faelschlich 0/Y gezeigt).
  const weeks = [1, 0].map((n, i) => ({
    id: i + 1, startDate: isoWeeksAgo(n), note: '', mode: 'standard',
    days: [mkDay(i * 10 + 1, [mkExercise('Bankdrücken', 80, 'success', 8.5)], { markedDone: false, locked: false })],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await seed(page, weeks);
  await expect(page.locator('.coach-focus-status')).toContainText('Auf Kurs');
  const texts = await evidenceTexts(page);
  const unitLine = texts.find(t => /\d+\/\d+/.test(t));
  expect(unitLine).toBeTruthy();
  const [done] = unitLine.match(/\d+\/\d+/)[0].split('/').map(Number);
  expect(done).toBeGreaterThan(0); // vorher waere dies 0 gewesen (markedDone: false)
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

// Phase A/Launch-Roadmap (2026-08-04, Regressionsfund): ursprünglich prüfte
// AC7 nur, dass die Disclosure ein "Woche"-Wort enthält -- das galt vor
// Runde 14, als der Haupttext nur weeksSince zeigte und evidence 2 echte
// Zusatzwerte ergänzte. Seit Runde 14 zeigt der Haupttext bereits alle 3
// Rohwerte (weeksSince/Volumentrend/Ø-RPE) wörtlich -- ein Evidence-Feld
// mit denselben 3 Werten wäre nur noch Wiederholung, kein Mehrwert mehr
// (Nutzer-Feedback: "'Warum'-Aufklappen-Feld zeigt denselben Text wie der
// Haupttext"). Fix: evidence liefert jetzt den Auslösegrund (Volumen und/
// oder RPE), NICHT die bereits im Haupttext stehenden Rohwerte. AC7 bleibt
// erfüllt (Disclosure weiterhin vorhanden, zeigt echte Zusatzinfo) -- Test
// entsprechend aktualisiert statt nur den alten Regex-Treffer zu retten.
test('Strukturkarte (Praeventiver Deload): "▾ Basis dieser Einschaetzung" vorhanden (AC7), zeigt ECHTE Zusatzinfo statt Haupttext-Wiederholung', async ({ page }) => {
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

  const mainText = await page.locator('.coach-structural-text').first().textContent();

  const structWhy = page.locator('.coach-structural-why summary');
  await expect(structWhy).toContainText('Basis dieser Einschätzung');
  await structWhy.click();
  const evText = await page.locator('.coach-structural-why .coach-evidence-list').innerText();

  // AC7: Disclosure vorhanden mit echtem Inhalt.
  expect(evText.trim().length).toBeGreaterThan(0);
  // Regressionsschutz: Aufklapp-Text darf den Haupttext nicht 1:1
  // enthalten (die konkrete Nutzer-Beschwerde) -- prüft konkret, dass die
  // 3 Rohwerte aus dem Haupttext NICHT nochmal wortgleich in evidence
  // auftauchen, sondern etwas qualitativ anderes (Auslösegrund) zeigen.
  expect(evText).not.toBe(mainText);
  expect(evText).toMatch(/Auslöser/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Phase A/Launch-Roadmap (2026-08-04): Spot-Check des anderen Signals mit
// einem 'info'-Feld ("?"-Badge, identisches <details>-Muster wie Deload) --
// recurring_fatigue war von der Deload-Regression selbst nicht betroffen
// (sein Haupttext enthält weiterhin nur die Übung + "letzte 3 Wochen", das
// info-Feld ergänzt eine eigene Erklärung), aber derselbe strukturelle
// Fallstrick (Haupttext-Erweiterung macht info/evidence redundant) könnte
// hier künftig genauso auftreten -- Regressionsschutz für beide Felder.
test('recurring_fatigue: "?"-Info-Text und Haupttext sind unterschiedlich (kein Duplikat)', async ({ page }) => {
  function weeksAgoISO(n) {
    const d = new Date();
    d.setDate(d.getDate() - n * 7);
    return d.toISOString().split('T')[0];
  }
  function fatigueDay(id) {
    return mkDay(id, [
      mkExercise('Bankdrücken', 80, 'success', 7.0, 2),
      mkExercise('OHP', 40, 'success', 8.0, 2),
      mkExercise('Dips', 0, 'fail', 9.5, 1),
    ]);
  }
  const weeks = [
    { id: 1, startDate: weeksAgoISO(2), note: '', mode: 'standard', days: [fatigueDay(11)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 2, startDate: weeksAgoISO(1), note: '', mode: 'standard', days: [fatigueDay(12)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
    { id: 3, startDate: weeksAgoISO(0), note: '', mode: 'standard', days: [fatigueDay(13)], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false },
  ];
  await seed(page, weeks);

  const item = page.locator('.coach-structural-item', { hasText: 'aufgefallen' });
  await expect(item).toBeVisible();
  const mainText = await item.locator('.coach-structural-text').textContent();

  const badge = item.locator('.deload-info__badge');
  await expect(badge).toBeVisible();
  await badge.click();
  const infoText = await item.locator('.deload-info__body').textContent();

  expect(infoText).not.toBe(mainText);
  expect(mainText).not.toContain(infoText);
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
