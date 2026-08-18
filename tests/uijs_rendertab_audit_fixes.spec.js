import { test, expect } from '@playwright/test';

// Runde 39 (ui.js-Render-Logik-Audit, Training-Tab, Zeile 917-3132): erste
// Runde einer neuen Multi-Runden-Serie für ui.js' bisher nie eigenständig
// auditierte Render-Schicht. 2 parallele Diagnose-Agenten fanden 9
// bestätigte Funde (2 HIGH, 4 MEDIUM, 3 LOW/kosmetisch), siehe
// `Diagnose & Sprints/diagnose-uijs-rendertab-audit-2026-08-18.txt`.
// F7 (toter Code, renderInfoBlock gelöscht) und F8 (isSeedWeek-Filter ohne
// aktuelle Verhaltensänderung) bekommen bewusst keinen eigenen Test hier.

function todayISO() { return new Date().toISOString().split('T')[0]; }
function daysAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
}

function mkEx(overrides = {}) {
  return {
    name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight: 60, reps: 8, rpe: null, status: 'pending', done: false, note: '' }],
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null,
    archived: false, substituteFor: null,
    ...overrides,
  };
}

function mkDay(overrides = {}) {
  return {
    id: 100, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: false, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [mkEx()], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    ...overrides,
  };
}

function mkWeek(overrides = {}) {
  return {
    id: Date.now() + Math.floor(Math.random() * 100000), startDate: todayISO(),
    note: '', mode: 'standard', isSeedWeek: false,
    days: [mkDay()], sessionLog: [], bodyData: {}, restDays: [],
    ...overrides,
  };
}

async function seed(page, { weeks, curIdx = 0, settings = {} } = {}) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, curIdxArg, settingsArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: curIdxArg, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { sessionCoach: false, rpeEnabled: true, ...settingsArg },
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], longestStreakEver: 0, seenTips: [],
    }));
  }, { weeksArg: weeks, curIdxArg: curIdx, settingsArg: settings });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// ─── F1 — Ritual-Anchor zeigt keine fabrizierten Seed-Wochen-Daten ────────────

test('F1: Ritual-Anchor-Karte zeigt am ersten echten Trainingstag keine fabrizierten Seed-Wochen-Daten', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const seedWeek = mkWeek({
    id: 1, startDate: daysAgoISO(7), note: 'Startwerte', isSeedWeek: true,
    days: [mkDay({
      id: 10, title: 'Startwerte', locked: true, markedDone: true, isSeedWeek: true,
      exercises: [mkEx({ sets: [{ weight: 60, reps: 8, rpe: null, status: 'success', done: true, note: '' }] })],
    })],
  });
  const realWeek = mkWeek({ id: 2, startDate: todayISO(), days: [mkDay({ id: 20 })] });

  await seed(page, { weeks: [seedWeek, realWeek], curIdx: 1 });

  await expect(page.locator('.training-context-anchor')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F2 — 1RM-Schätzung nur für metric:'reps' ─────────────────────────────────

test('F2: 1RM-Epley-Schätzung erscheint NICHT bei einer gewichteten metric:\'sec\'-Übung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week = mkWeek({
    days: [mkDay({
      exercises: [mkEx({
        name: 'Plank mit Gewicht', metric: 'sec', targetReps: 30,
        // reps trägt hier Sekunden (Projekt-Konvention bei metric:'sec') --
        // 8 Sekunden + Gewicht > 0 würde die Epley-Formel ohne Guard auslösen.
        sets: [{ weight: 10, reps: 8, rpe: null, status: 'success', done: true, note: '' }],
      })],
    })],
  });

  await seed(page, { weeks: [week], curIdx: 0 });

  await expect(page.locator('.orm-hint')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F3 — _lastWeekAvgRpe substituteFor-bewusst ───────────────────────────────

test('F3: RPE-/Pausen-Vorschau im Session-Briefing erscheint für eine heute substituierte Fokus-Übung', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const lastWeek = mkWeek({
    id: 1, startDate: daysAgoISO(7),
    days: [mkDay({
      id: 10,
      exercises: [mkEx({
        name: 'Bankdrücken', substituteFor: null,
        sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }],
      })],
    })],
  });
  const thisWeek = mkWeek({
    id: 2, startDate: todayISO(),
    days: [mkDay({
      id: 20, sessionCheckIn: { sleep: 'medium', energyPre: 'medium' },
      // "Liegestütz" (Push-Kategorie) ersetzt heute "Bankdrücken" -- noch
      // nicht trainiert (pending), Vorwochen-Historie existiert nur unter
      // dem Originalnamen.
      exercises: [mkEx({
        name: 'Liegestütz', substituteFor: 'Bankdrücken', targetReps: 10,
        sets: [{ weight: null, reps: null, rpe: null, status: 'pending', done: false, note: '' }],
      })],
    })],
  });

  await seed(page, { weeks: [lastWeek, thisWeek], curIdx: 1, settings: { sessionCoach: true } });

  const focus = page.locator('.session-briefing-card__focus');
  await expect(focus).toBeVisible();
  await expect(focus).toContainText('@ RPE');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F4 — prevEx-Lookup überspringt Urlaubswochen ─────────────────────────────

test('F4: Vorwoche-Gewichtshinweis überspringt eine Urlaubswoche und greift auf die letzte echte Trainingswoche zurück', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const realWeek = mkWeek({
    id: 1, startDate: daysAgoISO(14),
    days: [mkDay({
      id: 10,
      exercises: [mkEx({ sets: [{ weight: 60, reps: 8, rpe: 7, status: 'success', done: true, note: '' }] })],
    })],
  });
  // Platzhalter-Übung wie _buildVacationExercise() (state.js) sie erzeugt:
  // namensgleich, aber leere Sätze.
  const vacationWeek = mkWeek({
    id: 2, startDate: daysAgoISO(7), mode: 'vacation',
    days: [mkDay({
      id: 20, isVacation: true,
      exercises: [mkEx({ sets: [{ weight: null, reps: null, rpe: null, status: 'pending', done: false, note: '' }] })],
    })],
  });
  // Heute: 55kg eingetragen -- eine echte Reduktion gegenüber den 60kg der
  // letzten ECHTEN Trainingswoche, sollte als ↓ (nicht ↑) angezeigt werden.
  const todayWeek = mkWeek({
    id: 3, startDate: todayISO(),
    days: [mkDay({
      id: 30,
      exercises: [mkEx({ sets: [{ weight: 55, reps: null, rpe: null, status: 'pending', done: false, note: '' }] })],
    })],
  });

  await seed(page, { weeks: [realWeek, vacationWeek, todayWeek], curIdx: 2 });

  const prevHint = page.locator('[data-action="adopt-prev-weight"]');
  await expect(prevHint).toHaveAttribute('aria-label', 'Vorwoche 60 kg');
  await expect(page.locator('.w-arrow--dn')).toHaveCount(1);
  await expect(page.locator('.w-arrow--up')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F5 — Expand/Collapse-Zustand kollidiert nicht mehr zwischen Wochen ───────

test('F5: manuelles Einklappen des Session-Briefings in einer Woche beeinflusst eine neu erstellte Folgewoche nicht mehr', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week1 = mkWeek({
    id: 1, startDate: todayISO(),
    days: [mkDay({ id: 10, sessionCheckIn: { sleep: 'medium', energyPre: 'medium' } })],
  });

  await seed(page, { weeks: [week1], curIdx: 0, settings: { sessionCoach: true } });

  const card = page.locator('.session-briefing-card');
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/is-collapsed/);

  await page.click('[data-action="toggle-session-briefing"][data-di="0"]');
  await expect(card).toHaveClass(/is-collapsed/);

  // Neue Woche erstellen (klont Tage inkl. IDENTISCHER day.id, siehe B83-
  // Kommentar in ui.js) -- wird per _resortWeeksKeepingCurrent() automatisch
  // die neue "aktuelle" Woche. Dieselbe day.id, aber ein neues wk.id.
  const nextStart = new Date();
  nextStart.setDate(nextStart.getDate() + 7);
  const nextStartISO = nextStart.toISOString().split('T')[0];
  await page.evaluate(async (startDate) => {
    const mod = await import('./state.js');
    mod.dispatch(mod.A.WEEK_CREATE, { startDate });
    mod.dispatch(mod.A.SESSION_CHECKIN_SET, { di: 0, sleep: 'medium', energyPre: 'medium', modifier: 'optimal' });
  }, nextStartISO);

  // Neue Woche, Tag-Index 0, frischer (nicht gestarteter) Tag -> muss
  // unabhängig vom Einklapp-Zustand der alten Woche standardmäßig
  // aufgeklappt sein.
  await expect(card).toBeVisible();
  await expect(card).not.toHaveClass(/is-collapsed/);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F6 — _avgRepsLast4() substituteFor-bewusst ───────────────────────────────

test('F6: Wiederholungs-Vorschlag ("Vorschlag: Ø letzte Wochen") zählt eine substituierte Vorwoche mit', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const lastWeek = mkWeek({
    id: 1, startDate: daysAgoISO(7),
    days: [mkDay({
      id: 10,
      // "Ausfallschritte" ersetzte damals "Kniebeuge" -- 3 erfolgreiche
      // Sätze mit je 10 Wdh.
      exercises: [mkEx({
        name: 'Ausfallschritte', substituteFor: 'Kniebeuge',
        sets: [
          { weight: 40, reps: 10, rpe: 7, status: 'success', done: true, note: '' },
          { weight: 40, reps: 10, rpe: 7, status: 'success', done: true, note: '' },
          { weight: 40, reps: 10, rpe: 7, status: 'success', done: true, note: '' },
        ],
      })],
    })],
  });
  const thisWeek = mkWeek({
    id: 2, startDate: todayISO(),
    days: [mkDay({
      id: 20,
      // Heute wieder unter Originalnamen, noch nicht trainiert. _showCfg:true
      // öffnet das Ziele-Panel, in dem der Vorschlag lebt (sonst eingeklappt).
      exercises: [mkEx({ name: 'Kniebeuge', substituteFor: null, _showCfg: true })],
    })],
  });

  await seed(page, { weeks: [lastWeek, thisWeek], curIdx: 1 });

  const suggestion = page.locator('.target-suggestion');
  await expect(suggestion).toBeVisible();
  await expect(suggestion).toContainText('Vorschlag: 10');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// ─── F9 — Fulfillment-Meter nicht ohne echten Metrik-Konflikt unterdrückt ─────

test('F9: Zielerfüllungs-Balken bleibt sichtbar bei Substitution ohne Vorwoche (Programmwoche 1)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  const week = mkWeek({
    days: [mkDay({
      // Substituiert, aber es existiert gar keine Vorwoche (einzige Woche
      // im State) -- prevEx ist zwangsläufig null.
      exercises: [mkEx({ name: 'Liegestütz', substituteFor: 'Kniebeuge', targetReps: 10 })],
    })],
  });

  await seed(page, { weeks: [week], curIdx: 0 });

  await expect(page.locator('.fulfill-meter')).toBeVisible();
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
