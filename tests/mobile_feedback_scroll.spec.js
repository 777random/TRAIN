import { test, expect } from '@playwright/test';

// Bugfix: "Übernehmen"-Button war auf kurzen Mobile-Viewports (Android)
// unterhalb des sichtbaren Bereichs, weil (a) toggle-done gar nicht scrollte
// und (b) confirm-set aktiv zum NÄCHSTEN offenen Satz zentrierte (block:
// 'center'), was das gerade gerenderte Feedback aus dem Blickfeld drängte.
// Root Cause war ein Scroll-Positions-Problem, kein Flexbox/CSS-Clipping.

function todayISO() { return new Date().toISOString().split('T')[0]; }

function mkWeek() {
  return {
    id: 1, startDate: todayISO(), note: '', mode: 'standard',
    days: [{
      id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: null,
      sessionCheckIn: { sleep: 'good', energyPre: 'medium', timestamp: Date.now() }, sessionModifier: 'normal',
      exercises: [{
        name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
        sets: [
          { weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
          { weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
          { weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' },
        ],
        prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 3, targetReps: 5,
        progressionType: 'weight', archived: false,
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page, autoStartPauseTimer = true) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weekArg, autoStartPauseTimer }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0, weeks: [weekArg],
      customTemplate: [], settings: { sessionCoach: true, autoStartPauseTimer, rpeEnabled: true },
      favoriteExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: Date.now(), plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0,
    }));
  }, { weekArg: mkWeek(), autoStartPauseTimer });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

async function evaluateSetWithRpe(page, si, rpe) {
  await page.click(`[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="${si}"]`);
  await page.click(`[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="${si}"][data-val="${rpe}"]`);
  await page.click(`[data-action="toggle-done"][data-di="0"][data-ei="0"][data-si="${si}"]`);
}

for (const [name, viewport] of [['Galaxy S21', { width: 360, height: 800 }], ['iPhone SE', { width: 375, height: 667 }], ['Pixel 7', { width: 412, height: 915 }]]) {
  test(`${name} (${viewport.width}x${viewport.height}): Übernehmen-Button nach toggle-done sichtbar und klickbar`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err.message));
    await seed(page);

    // RPE 6 (repDiff=0, Gruppe C, rpe<=6 -> steigern) -> nextWeight !== currentWeight -> canAdopt
    await evaluateSetWithRpe(page, 0, 6);
    await page.waitForTimeout(500); // setTimeout(50ms) + smooth-scroll-Transition abwarten

    const btn = page.locator('[data-action="adopt-set-feedback"]').first();
    await expect(btn).toBeVisible();
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);

    // Touch-Event/Klickbarkeit: tatsächlicher Klick muss die Aktion auslösen
    await btn.click();
    const nextWeight = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('train_v6')).weeks[0].days[0].exercises[0].sets[1].weight);
    expect(nextWeight).toBe(105); // 100 + weightStep 5

    expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  });
}

test('Desktop (1280px breit, ausreichend hoch): kein unnötiger Scroll, Button ohne weiteres Zutun sichtbar', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  const scrollYBefore = await page.evaluate(() => window.scrollY);
  await evaluateSetWithRpe(page, 0, 6);
  await page.waitForTimeout(500);

  const btn = page.locator('[data-action="adopt-set-feedback"]').first();
  await expect(btn).toBeVisible();
  const scrollYAfter = await page.evaluate(() => window.scrollY);
  // block:'nearest' darf nur scrollen wenn nötig -- bei ausreichend hohem
  // Viewport war der Button schon sichtbar, daher keine (oder nur minimale) Verschiebung.
  expect(Math.abs(scrollYAfter - scrollYBefore)).toBeLessThan(50);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('confirm-set-Pfad: Feedback des soeben bewerteten Satzes sichtbar statt Zentrierung auf den nächsten Satz (360x800)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="open-rpe-popover"][data-di="0"][data-ei="0"][data-si="0"]');
  await page.click('[data-action="set-rpe-val"][data-di="0"][data-ei="0"][data-si="0"][data-val="6"]');
  await page.click('[data-action="confirm-set"][data-di="0"][data-ei="0"]');
  await page.waitForTimeout(500);

  const btn = page.locator('[data-action="adopt-set-feedback"]').first();
  await expect(btn).toBeVisible();
  const box = await btn.boundingBox();
  expect(box.y + box.height).toBeLessThanOrEqual(800);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('toggle-done ohne autoStartPauseTimer: Feedback trotzdem sichtbar (Scroll unabhängig vom Pause-Timer)', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, false);

  await evaluateSetWithRpe(page, 0, 6);
  await page.waitForTimeout(500);

  const btn = page.locator('[data-action="adopt-set-feedback"]').first();
  await expect(btn).toBeVisible();

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// A2: .toast (styles.css) und timer.js' .pause-overlay sitzen beide auf
// fast derselben bottom:88px-Höhe -- der zentrierte Toast kann rechts mit
// dem 220px breiten Pause-Overlay in der unteren rechten Ecke kollidieren.
// Fix: `body:has(.pause-overlay--visible) .toast` hebt den Toast an,
// solange das Pause-Overlay sichtbar ist.
test('A2: Toast wird über dem sichtbaren Pause-Overlay angehoben statt zu kollidieren', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page); // autoStartPauseTimer = true

  await evaluateSetWithRpe(page, 0, 6); // startet den Pause-Timer
  await expect(page.locator('#pause-overlay')).toHaveClass(/pause-overlay--visible/);

  // Realistische Toast-Länge (vergleichbar mit echten Meldungen wie "Sätze
  // zurückgesetzt — Undo möglich") -- kurze/leere Texte würden die
  // horizontale Kollision nicht zuverlässig reproduzieren.
  const bottomGapWithOverlay = await page.evaluate(() => {
    const toast = document.getElementById('toast');
    toast.textContent = 'Sätze zurückgesetzt — Undo möglich';
    toast.classList.add('is-visible');
    return window.innerHeight - toast.getBoundingClientRect().bottom;
  });
  const overlapWithOverlay = await page.evaluate(() => {
    const t = document.getElementById('toast').getBoundingClientRect();
    const p = document.getElementById('pause-overlay').getBoundingClientRect();
    return !(t.right < p.left || t.left > p.right || t.bottom < p.top || t.top > p.bottom);
  });

  await page.evaluate(() => document.getElementById('pause-overlay').classList.remove('pause-overlay--visible'));
  const bottomGapWithoutOverlay = await page.evaluate(() =>
    window.innerHeight - document.getElementById('toast').getBoundingClientRect().bottom);

  expect(bottomGapWithOverlay).toBeGreaterThan(bottomGapWithoutOverlay);
  expect(overlapWithOverlay).toBe(false); // die eigentliche, vom Nutzer gemeldete Kollision

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// A2: showToast()s Default-Anzeigedauer wurde von 2600ms auf 3600ms erhöht
// (Aufrufstellen mit explizit übergebener Dauer sind davon unberührt).
test('A2: Standard-Toast bleibt länger sichtbar als der alte 2600ms-Default', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => dialog.accept());
  await seed(page, false);

  // "Sätze zurückgesetzt — Undo möglich" (day-reset-sets) ruft showToast()
  // ohne explizite Dauer auf -> nutzt den Default. Braucht keine
  // abgeschlossene Woche (anders als der Körpergewicht-Eintrag im
  // Fortschritt-Tab, der ohne Historie gar nicht gerendert wird).
  await page.click('[data-action="toggle-week-menu"]');
  await page.click('[data-action="day-reset-sets"][data-di="0"]');

  await expect(page.locator('.toast.is-visible')).toHaveCount(1);
  await page.waitForTimeout(3000); // unter dem alten 2600ms-Default schon wieder ausgeblendet
  await expect(page.locator('.toast.is-visible')).toHaveCount(1);
  await page.waitForTimeout(1000); // insgesamt ~4000ms seit dem Trigger
  await expect(page.locator('.toast.is-visible')).toHaveCount(0);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
