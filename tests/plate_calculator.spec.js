import { test, expect } from '@playwright/test';

// B130 (train-v220): der bei B126 (train-v218) falsch herum gebaute
// Hantelscheiben-Rechner (Scheiben antippen -> Gesamtgewicht) wurde entfernt.
// Die bereits vorhandene, korrekte Umkehr-Berechnung (Zielgewicht -> Scheiben-
// Kombination, calcPlates()) wird stattdessen direkt unter dem Gewichts-Feld
// angezeigt.
// B133 (train-v221): B130s prominentes Chip/Badge-Design war zu klobig
// (Nutzer-Feedback) -- zurückgebaut auf einen dezenten Ein-Zeilen-Text
// (`.plate-hint`, gleiche Klasse/Optik wie vor B130), siehe DECISIONS.md.
// Der Slot wird immer gerendert (auch leer, `.plate-hint:empty{display:none}`
// in CSS), damit _handleInput() ihn bei jedem Tastendruck gezielt patchen
// kann (Live-Vorschau vor dem "change"-Commit) statt einen vollen Re-Render
// auszulösen -- letzterer würde auf Mobile die Tastatur schließen.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name, overrides = {}) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 0, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null, showPlates: true,
    ...overrides,
  };
}

function mkWeek(ex, dayOverrides = {}) {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [ex],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      ...dayOverrides,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, ex, barbellWeight = 20, dayOverrides = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, barbellWeight }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true, barbellWeight },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weekArg: mkWeek(ex, dayOverrides), barbellWeight });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('90kg / 20kg-Stange: dezenter Text "+ 25+10  pro Seite · Stange 20kg"', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));

  const hint = page.locator('.plate-hint');
  await expect(hint).toBeVisible();
  await expect(hint).toHaveText('+ 25+10  pro Seite · Stange 20kg');
  // Kein Chip/Badge-Markup (B130 zurückgebaut, B133)
  await expect(page.locator('.plate-chip')).toHaveCount(0);
  await expect(page.locator('.plate-chips-row')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('100kg / 20kg-Stange: "+ 25+15  pro Seite · Stange 20kg"', async ({ page }) => {
  await seed(page, mkEx('Kniebeuge', { sets: [{ weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' }] }));
  await expect(page.locator('.plate-hint')).toHaveText('+ 25+15  pro Seite · Stange 20kg');
});

test('90kg mit 2 gleichen Scheiben je Seite (z.B. 2x20kg) -> kompakte "2×"-Gruppierung', async ({ page }) => {
  // perSide = 35 -> 20+10+5 (kein Duplikat) reicht nicht zum Testen von "2×";
  // 130kg/20kg-Stange -> perSide=55 -> 25+25+5 -> "2×25+5"
  await seed(page, mkEx('Kreuzheben', { sets: [{ weight: 130, reps: 5, rpe: null, status: 'pending', done: false, note: '' }] }));
  await expect(page.locator('.plate-hint')).toHaveText('+ 2×25+5  pro Seite · Stange 20kg');
});

test('83kg / 20kg-Stange: nicht exakt auflegbar -> "≈ 82.5kg möglich"-Zusatz', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 83, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));
  await expect(page.locator('.plate-hint')).toHaveText('+ 25+5+1.25  pro Seite · Stange 20kg · ≈ 82.5kg möglich');
});

test('Scheiben-Toggle aus (ex.showPlates=false) -> leerer Slot, unsichtbar', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', {
    showPlates: false,
    sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
  }));
  const hint = page.locator('.plate-hint');
  await expect(hint).toHaveText('');
  await expect(hint).toBeHidden();
});

test('Gewicht <= Stangengewicht -> leerer Slot, unsichtbar', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 20, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }), 20);
  const hint = page.locator('.plate-hint');
  await expect(hint).toHaveText('');
  await expect(hint).toBeHidden();
});

test('Distanz-/Zeit-Übung (metric m/sec) -> leerer Slot, auch mit showPlates=true', async ({ page }) => {
  await seed(page, mkEx('Sprint', {
    metric: 'm',
    sets: [{ weight: 90, reps: 0, rpe: null, status: 'pending', done: false, note: '' }],
  }));
  await expect(page.locator('.plate-hint')).toBeHidden();
});

test('B126 vollständig entfernt: kein ⚖-Button, kein Chip-Tap-Panel mehr im DOM', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));
  await expect(page.locator('[data-action="toggle-plate-calc"]')).toHaveCount(0);
  await expect(page.locator('[data-action="plate-calc-add"]')).toHaveCount(0);
  await expect(page.locator('[data-action="plate-calc-apply"]')).toHaveCount(0);
  await expect(page.locator('[data-action="plate-calc-perside"]')).toHaveCount(0);
  await expect(page.locator('.plate-calc-panel')).toHaveCount(0);
});

// ─── B133 Problem 2: Live-Update ────────────────────────────────────────────

// Feuert nur ein 'input'-Event mit gesetztem Wert -- entspricht dem, was ein
// virtuelles/physisches Keyboard beim Tippen wirklich auslöst, BEVOR "change"
// (Blur/Bestätigung) committet. Bewusst NICHT über echte Tastatur-Events
// (page.keyboard.press/type) simuliert: bei `<input type="number">` unter
// headless Chromium feuert das CDP-Key-Dispatch bereits nach dem ersten
// Tastendruck zusätzlich ein sofortiges 'change'+'blur' (verifiziertes,
// vom App-Code unabhängiges Chromium/Playwright-Artefakt -- reproduziert
// auch auf einem bloßen `<input type="number">` ohne jeden TRAIN-Code) und
// würde damit genau den Zustand testen, den dieser Test ausschließen soll.
async function typeWithoutCommit(page, locator, value) {
  await locator.evaluate((el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

test('Manuelles Eintippen (95kg, vor Bestätigung/Blur) aktualisiert den Hinweis sofort', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));

  const hint = page.locator('.plate-hint');
  await expect(hint).toHaveText('+ 25+10  pro Seite · Stange 20kg');

  const inp = page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]');
  await typeWithoutCommit(page, inp, '95');

  // Nur 'input' gefeuert, kein 'change' -> state.weeks[..].sets[0].weight ist noch 90 ...
  const stateWeight = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].days[0].exercises[0].sets[0].weight);
  expect(stateWeight).toBe(90);
  // ... aber der Hinweis zeigt bereits die Live-Vorschau für 95kg (25+10+2.5).
  await expect(hint).toHaveText('+ 25+10+2.5  pro Seite · Stange 20kg');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// B133 Root Cause (Diagnose, siehe DECISIONS.md): der obige Test wäre auch
// ohne den _liveWeightPreview-Mechanismus grün, wenn timer.js zufällig nicht
// dazwischenfunkt -- er reproduziert das eigentliche Problem aber IMMER,
// weil es die erste Interaktion einer frischen Session ist: timer.js hat
// einen eigenen, von ui.js unabhängigen 'input'-Listener auf #app
// (_ensureSessionStart(), siehe timer.js), der beim allerersten Tastendruck
// eines noch nicht gestarteten Tages `dispatch()` aufruft -- das löst einen
// vollen state.js-getriebenen Re-Render aus, der einen reinen
// `.textContent`-Patch (ohne _liveWeightPreview) sofort wieder überschreiben
// würde, weil er ausschließlich aus dem (noch unveränderten) committeten
// State neu rechnet. Ab dem zweiten Tastendruck (Session bereits gestartet,
// _ensureSessionStart() ist dann ein No-op) träte das Problem nicht mehr
// auf -- dieser Test prüft deshalb explizit GENAU den ersten Tastendruck.
test('Live-Vorschau übersteht den (unabhängig ausgelösten) Re-Render beim allerersten Tastendruck der Session', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));

  const inp = page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]');
  // Erster Tastendruck des Tages -- feuert 'input' UND (in echt) timer.js'
  // _ensureSessionStart()-Dispatch. Wir simulieren nur das 'input'-Event
  // (siehe typeWithoutCommit oben) -- timer.js' eigener Listener hängt
  // unabhängig davon am selben #app-Element und feuert real mit.
  await typeWithoutCommit(page, inp, '9');
  await expect(page.locator('.plate-hint')).toBeHidden(); // 9kg <= 20kg Stange

  await typeWithoutCommit(page, inp, '95');
  await expect(page.locator('.plate-hint')).toHaveText('+ 25+10+2.5  pro Seite · Stange 20kg');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Eintippen eines Gewichts <= Stangengewicht blendet den Hinweis live wieder aus', async ({ page }) => {
  await seed(page, mkEx('Bankdrücken', { sets: [{ weight: 90, reps: 8, rpe: null, status: 'pending', done: false, note: '' }] }));

  const inp = page.locator('[data-action="set-weight"][data-di="0"][data-ei="0"][data-si="0"]');
  await typeWithoutCommit(page, inp, '10');

  await expect(page.locator('.plate-hint')).toBeHidden();
});

test('90kg -> 85kg via "Übernehmen ↗" (sessionCoach): Hinweis von Satz 2 aktualisiert sich sofort', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const nSets = 2;
  const ex = mkEx('Bankdrücken', {
    weightStep: 2.5, targetSets: nSets, targetReps: 5,
    sets: Array.from({ length: nSets }, () => ({ weight: 90, reps: 5, rpe: null, status: 'pending', done: false, note: '' })),
  });
  const week = mkWeek(ex);
  await page.evaluate(({ weekArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: true, rpeEnabled: true, barbellWeight: 20, autoStartPauseTimer: false },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, { weekArg: week });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await expect(page.locator('.plate-hint').nth(1)).toHaveText('+ 25+10  pro Seite · Stange 20kg');

  // RPE 6 auf Satz 1 -> Steigerungsvorschlag (+2.5 -> 92.5, bewusst nicht 85 --
  // der Test prüft den Update-Mechanismus, nicht einen bestimmten Zielwert).
  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="0"][data-val="6"]');
  await page.click('[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="0"]');

  const adoptBtn = page.locator('[data-action="adopt-set-feedback"][data-si="0"]');
  await expect(adoptBtn).toBeVisible();
  await expect(adoptBtn).toHaveAttribute('data-next-weight', '92.5');
  await adoptBtn.click();

  const nextWeight = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].days[0].exercises[0].sets[1].weight);
  expect(nextWeight).toBe(92.5);
  // 92.5kg/20kg-Stange -> perSide=36.25 -> 25+10+1.25
  await expect(page.locator('.plate-hint').nth(1)).toHaveText('+ 25+10+1.25  pro Seite · Stange 20kg');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── Befund #3 Teil B: Scheiben-Toggle bleibt nach Tagesabschluss editierbar ──

// Der "Scheiben: An/Aus"-Toggle im "Erweitert"-Panel hing bisher an derselben
// `!locked`-Bedingung wie z.B. "Typ" (Straight/Manuell) und "Superset" -- er
// verschwand deshalb nach dem Tagesabschluss (day.locked), obwohl der
// Hantelscheiben-Rechner gerade dann noch nützlich ist (rückblickend prüfen,
// welche Scheiben ein bereits abgeschlossener Satz brauchte). Pause/Kategorie
// sind schon länger unabhängig vom Lock-Status editierbar -- Scheiben zieht
// jetzt nach, Typ/Superset bleiben bewusst weiterhin gesperrt.
test('Scheiben-Toggle bleibt nach Tagesabschluss (day.locked) sichtbar und bedienbar, Typ/Superset bleiben gesperrt', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, mkEx('Bankdrücken', { showPlates: false }), 20, { locked: true, markedDone: true });

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="toggle-cfg"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="toggle-cfg-adv"][data-di="0"][data-ei="0"]');

  const platesToggle = page.locator('[data-action="toggle-plates"][data-di="0"][data-ei="0"]');
  await expect(platesToggle).toBeVisible();
  await expect(platesToggle).toHaveText('Aus');

  // Typ/Superset bleiben weiterhin an !locked gebunden -- dürfen NICHT
  // mit aufgetaut worden sein (Scope dieses Fixes war nur der Scheiben-Toggle).
  await expect(page.locator('[data-action="set-settype"][data-di="0"][data-ei="0"]')).toHaveCount(0);
  await expect(page.locator('[data-action="toggle-superset"][data-di="0"][data-ei="0"]')).toHaveCount(0);

  await platesToggle.click();
  const showPlatesAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].days[0].exercises[0].showPlates);
  expect(showPlatesAfter).toBe(true);
  await expect(platesToggle).toHaveText('An');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
