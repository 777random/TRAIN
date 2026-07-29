import { test, expect } from '@playwright/test';

// B75: Nutzer meldete, ein Auto-Backup-JSON-Download erscheine beim Klick
// auf "Teilen" im Fortschritt-Tab. Diagnose (5 reale Reproduktionen, siehe
// SESSION_LOG.md) zeigte: kein gemeinsamer Code-Pfad zwischen Share-Button
// und exportJSONAuto() — der Trigger (ui.js, scheduleRender()) reagiert
// ausschließlich auf state.weeks.length-Zuwachs (WEEK_CREATE/
// AUTO_WEEK_CREATE). Rückfrage beim Nutzer bestätigte: der Download tritt
// NUR in Kombination mit einer kurz zuvor erstellten Woche auf, nie ohne —
// der Trigger war die ganze Zeit korrekt. Ursache der Verwirrung: der
// Download passierte bisher völlig unangekündigt (kein Toast), fiel dem
// Nutzer erst beim NÄCHSTEN Tap auf (Android zeigt Downloads nicht
// aufdringlich an) und wurde fälschlich dem Share-Klick zugeschrieben.
// Fix: Toast direkt am echten Auslösepunkt, Trigger selbst unverändert.

function mondayOffset(weeksFromNow) {
  const d = new Date();
  const dow = d.getDay();
  const diffToMonday = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diffToMonday + weeksFromNow * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function fullWeek(id, startDate) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{ id: id * 10, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: 7, energyLevel: 4, sessionRating: 2,
      exercises: [{
        name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [{ weight: 80, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
        prWeight: 80, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
        progressionType: 'weight', archived: false,
      }] }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('Toast erscheint beim Auto-Backup (Wochenerstellung), Download bleibt unverändert korrekt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  const downloads = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-2)), fullWeek(2, mondayOffset(-1))];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false, showReview: true, suggestProgress: false } },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0], plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
    localStorage.setItem('train_share_consent', 'true');
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('.wr-modal', { timeout: 5000 });
  await page.click('#wr-btn-continue');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');

  await expect(page.locator('.toast.is-visible')).toContainText('Automatisches Backup gespeichert');
  await expect.poll(() => downloads).toContain('TRAIN_Backup_' + mondayOffset(-1) + '.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Auto-Backup setzt settings.lastBackupDate als numerischen Zeitstempel (B-Befund #12)', async ({ page }) => {
  // exportJSONAuto() löste bisher einen echten Download aus, schrieb aber
  // lastBackupDate nirgends — die Einstellungen zeigten danach fälschlich
  // weiterhin "Noch nie gesichert". Dieser Test prüft den State-Write
  // direkt (nicht nur den Toast-Text/Download-Dateinamen wie oben).
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-2)), fullWeek(2, mondayOffset(-1))];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false, showReview: true, suggestProgress: false } },
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0], plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
    localStorage.setItem('train_share_consent', 'true');
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.lastBackupDate);
  expect(before == null).toBe(true);

  await page.click('[data-action="open-new-week"]');
  await page.waitForSelector('.wr-modal', { timeout: 5000 });
  await page.click('#wr-btn-continue');
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });
  await page.click('[data-action="create-week"]');

  await expect(page.locator('.toast.is-visible')).toContainText('Automatisches Backup gespeichert');

  await expect.poll(async () => {
    const settings = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings);
    return settings.lastBackupDate;
  }).not.toBeNull();

  const lastBackupDate = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).settings.lastBackupDate);
  expect(typeof lastBackupDate).toBe('number');
  expect(lastBackupDate).toBeGreaterThan(Date.now() - 60_000);
});

test('Teilen-Klick im Fortschritt-Tab löst weiterhin KEIN Auto-Backup aus', async ({ page }) => {
  const downloads = [];
  page.on('download', d => downloads.push(d.suggestedFilename()));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  const weeks = [fullWeek(1, mondayOffset(-2)), fullWeek(2, mondayOffset(-1))];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 31, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 1,
      weeks: weeksArg,
      customTemplate: [], settings: {},
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0], plateauActions: {}, decisionLog: [], badges: [],
      onboardingDone: true, longestStreakEver: 0, favoriteExercises: [],
    }));
    localStorage.setItem('train_share_consent', 'true');
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');
  expect(downloads.filter(f => f.startsWith('TRAIN_Backup_'))).toHaveLength(0);
});

// ─────────────────────────────────────────────────────────────────────────────
// W-01 History-Gate (Diagnose-Sprint Befund #10, Runde 2): "Heute X% der
// Sätze nicht abgeschlossen – das ist ungewöhnlich für dich" (insightEngine.js)
// hatte KEIN Mindest-Historie-Gate und feuerte fälschlich auch am allerersten
// Trainingstag ohne jede Vergleichsbasis. Fix: mindestens 6 abgeschlossene
// Trainingstage VOR dem aktuellen Tag nötig, bevor die Regel überhaupt
// auswertet. Beide Tests nutzen denselben Toast-Mechanismus wie die
// Auto-Backup-Tests oben (`.toast.is-visible`), da W-01 als `immediate: true`
// Insight ebenfalls über showToast() angezeigt wird.

function w01Set(weight, reps, status, rpe = null) {
  return { weight, reps, rpe, status, done: status === 'success', note: '' };
}

function w01Exercise(name, sets, targetReps = 5) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
    sets,
    prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', archived: false,
  };
}

// Bereits abgeschlossener Trainingstag, voller Erfolg — dient nur dazu,
// Historie vor dem eigentlichen Test-Tag aufzubauen. sessionRating bewusst
// konstant 2 (neutral), damit E-01/E-04 (3x in Folge "erschöpft"/"stark")
// nicht versehentlich mitfeuern und den Toast überschreiben.
function w01DoneDay(id) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: 7, energyLevel: 3, sessionRating: 2,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [w01Exercise('Kniebeuge', [w01Set(80, 5, 'success', 7)])],
  };
}

// Der zu testende, noch offene Tag: 2 von 3 Sätzen fail (~67%, > 30%-Schwelle).
function w01FailDay(id) {
  return {
    id, title: 'Tag B', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [w01Exercise('Kniebeuge', [
      w01Set(80, 2, 'fail', 9.5),
      w01Set(80, 1, 'fail', 10),
      w01Set(80, 5, 'success', 7),
    ])],
  };
}

// Zweiter, unberührter Tag in derselben Woche wie w01FailDay — rein technisch
// nötig, damit die Woche nach Abschluss des Fail-Tags NICHT komplett ist:
// wäre sie es, würde ui.js 'WOCHE_ABGESCHLOSSEN' statt 'TAG_ABGESCHLOSSEN'
// feuern (siehe ui.js ~8676), und W-01 (trigger: nur 'TAG_ABGESCHLOSSEN')
// würde gar nicht erst ausgewertet — das wäre ein falsch-grüner Test, der
// aus dem falschen Grund passt statt das History-Gate zu prüfen.
function w01PendingDay(id) {
  return {
    id, title: 'Tag C', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [w01Exercise('Kniebeuge', [w01Set(80, 5, 'pending', null)])],
  };
}

async function seedW01(page, priorDoneDayCount) {
  const weeks = [];
  if (priorDoneDayCount > 0) {
    const histDays = [];
    for (let i = 0; i < priorDoneDayCount; i++) histDays.push(w01DoneDay(100 + i));
    const histStart = new Date();
    histStart.setDate(histStart.getDate() - 21);
    weeks.push({
      id: 1, startDate: histStart.toISOString().split('T')[0], note: '', mode: 'standard',
      days: histDays, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
  }
  weeks.push({
    id: weeks.length + 1, startDate: new Date().toISOString().split('T')[0], note: '', mode: 'standard',
    days: [w01FailDay(999), w01PendingDay(998)],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  });
  const curIdx = weeks.length - 1;
  await page.evaluate(({ weeksArg, curIdx }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx, weeks: weeksArg,
      customTemplate: [], settings: { autoWeek: { enabled: false } }, favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0], plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  }, { weeksArg: weeks, curIdx });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function completeW01Day(page) {
  await page.click('[data-action="toggle-complete"]');
  await page.click('.completion-modal__rate-btn[data-val="2"]');
  await page.click('.completion-modal__skip');
}

test('W-01: allererster Trainingstag ohne Historie -- Warnung erscheint NICHT trotz 67% Fail-Quote', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedW01(page, 0); // keine vorherigen abgeschlossenen Tage
  await completeW01Day(page);

  await expect(page.locator('.toast.is-visible')).not.toContainText('ungewöhnlich für dich');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('W-01: 6 abgeschlossene Trainingstage Historie + 67% Fail-Quote -- Warnung erscheint weiterhin korrekt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedW01(page, 6); // Schwelle exakt erreicht (>= 6 abgeschlossene Tage davor)
  await completeW01Day(page);

  await expect(page.locator('.toast.is-visible')).toContainText('Heute 67% der Sätze nicht abgeschlossen – das ist ungewöhnlich für dich.');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
