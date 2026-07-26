import { test, expect } from '@playwright/test';

// Grösserer Viewport nur für diese Datei: 3 Übungen mit vollem Set-Detail
// passen im Standard-iPhone-Viewport nicht auf eine Bildschirmhöhe, was beim
// zweiten Klick auf denselben Button zu Playwright "outside of viewport"-
// Flakes führt (reines Test-Artefakt, kein Produkt-Bug).
test.use({ viewport: { width: 390, height: 2200 } });

// B116: Die ↕-Pfeile im ⋮-Menü einer Übung verschwanden nach dem ersten Tap
// auf "Nach oben"/"Nach unten". Root Cause: _exMenuOpenKey (ui.js) ist
// index-basiert ("${di}-${ei}"), nicht identitätsbasiert. move-ex-up/-down
// dispatchten EX_MOVE (Reducer selbst korrekt), aktualisierten aber nie
// _exMenuOpenKey -- nach dem Verschieben zeigte der Schlüssel auf den ALTEN
// Index, der jetzt von einer anderen Übung belegt ist, wodurch das Menü der
// verschobenen Übung geschlossen wirkte. Fix: _exMenuOpenKey folgt der
// verschobenen Übung an ihren neuen Index.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkEx(name) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
  };
}

function mkWeek() {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [mkEx('Bankdrücken'), mkEx('Kniebeuge'), mkEx('Rudern')],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weekArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg], onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0, seenTips: ['tip-11'],
    }));
  }, mkWeek());
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Menü + Pfeile bleiben nach "Nach unten" an der verschobenen Übung offen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await expect(page.locator('[data-action="move-ex-down"][data-di="0"][data-ei="0"]')).toBeVisible();

  await page.click('[data-action="move-ex-down"][data-di="0"][data-ei="0"]');
  await page.waitForTimeout(150);

  // Bankdrücken ist jetzt an Index 1 (Kniebeuge rückte auf Index 0) -- das
  // Menü muss dorthin gefolgt sein, nicht an Index 0 offen geblieben/ganz zu.
  await expect(page.locator('[data-action="move-ex-up"][data-di="0"][data-ei="1"]')).toBeVisible();
  await expect(page.locator('[data-action="move-ex-down"][data-di="0"][data-ei="1"]')).toBeVisible();
  await expect(page.locator('.ex-menu-dropdown')).toHaveCount(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Menü + Pfeile bleiben nach "Nach oben" an der verschobenen Übung offen', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="1"]');
  await expect(page.locator('[data-action="move-ex-up"][data-di="0"][data-ei="1"]')).toBeVisible();

  await page.click('[data-action="move-ex-up"][data-di="0"][data-ei="1"]');
  await page.waitForTimeout(150);

  // Kniebeuge ist jetzt an Index 0 -- Menü muss dorthin gefolgt sein.
  await expect(page.locator('[data-action="move-ex-down"][data-di="0"][data-ei="0"]')).toBeVisible();
  await expect(page.locator('.ex-menu-dropdown')).toHaveCount(1);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Zweiter Tap auf "Nach unten" verschiebt die Übung ein weiteres Mal (Menü folgt kumulativ)', async ({ page }) => {
  await seed(page);

  await page.click('[data-action="toggle-ex-menu"][data-di="0"][data-ei="0"]');
  await page.click('[data-action="move-ex-down"][data-di="0"][data-ei="0"]');
  await page.waitForTimeout(150);
  await page.click('[data-action="move-ex-down"][data-di="0"][data-ei="1"]');
  await page.waitForTimeout(150);

  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  const names = st.weeks[0].days[0].exercises.map(e => e.name);
  expect(names).toEqual(['Kniebeuge', 'Rudern', 'Bankdrücken']);
  await expect(page.locator('[data-action="move-ex-up"][data-di="0"][data-ei="2"]')).toBeVisible();
});
