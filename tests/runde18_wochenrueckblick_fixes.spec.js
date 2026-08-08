import { test, expect } from '@playwright/test';

// Runde 18 / Cluster 2 (Diagnose: diagnose-runde18-vertrauensbugs-2026-08-08.txt):
// 3 unabhängige Wochenrückblick-Bugs, alle über echte Interaktionspfade
// geprüft (AGENTS.md-Realpfad-Regel), nicht per direkter Funktions-Injektion,
// AUSSER beim reinen Pure-Function-Test für 2.4 (weekReview.js hat ohnehin
// keinen DOM-Bezug, siehe bestehendes Muster in weekreview_deload_pr_filter.spec.js).

// 2.2/2.3 braucht eine ECHTE Zeitzonen-Differenz zwischen UTC und Ortszeit,
// um den ursprünglichen toISOString()-Rollover-Bug reproduzierbar zu machen
// (CI-Runner laufen typischerweise in UTC, wo der Bug gar nicht auftreten
// würde) — deshalb bewusst timezoneId statt sich auf die Runner-Standardzeit
// zu verlassen.
test.use({ timezoneId: 'Europe/Berlin' });

function buildDoneExercise(name = 'Kniebeuge', weight = 80) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps',
    sets: [{ weight, reps: 5, rpe: 7, status: 'success', done: true }],
    weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
    targetReps: 5, progressionType: 'weight', archived: false, substituteFor: null,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    progressionMode: 'weight_first', targetRepsMax: null,
  };
}

function buildPendingExercise(name = 'Kniebeuge', weight = 80) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps',
    sets: [{ weight, reps: 5, rpe: null, status: 'pending', done: false }],
    weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
    targetReps: 5, progressionType: 'weight', archived: false, substituteFor: null,
    prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
    progressionMode: 'weight_first', targetRepsMax: null,
  };
}

function makeDay(id, { markedDone = false, exercise } = {}) {
  return {
    id, title: 'Tag', subtitle: '', warmup: '', cooldown: '',
    locked: markedDone, markedDone, isVacation: false,
    sleepHours: null, energyLevel: null, sessionRating: null,
    sessionCheckIn: null, sessionModifier: null,
    exercises: [exercise],
  };
}

async function seedWeeks(page, weeks, curIdx, nowIso) {
  await page.evaluate(({ weeks, curIdx, nowIso }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: nowIso, createdAt: nowIso },
      curIdx, weeks,
      customTemplate: [], settings: { sessionCoach: true }, prs: {},
      coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      favoriteExercises: [],
    }));
    localStorage.setItem('train_v6_shadow', 'x');
  }, { weeks, curIdx, nowIso });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Cluster 2.1: Wochenrückblick-Inline zeigt "Diese Woche" statt roher KW-Nummer', async ({ page }) => {
  const FIXED_NOW = new Date('2026-01-05T12:00:00+01:00'); // Montag, Mittag Berlin
  await page.clock.install({ time: FIXED_NOW });
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const week = {
    id: 1, startDate: '2026-01-05', note: '', mode: 'standard',
    days: [makeDay(10, { markedDone: true, exercise: buildDoneExercise() })],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
  await seedWeeks(page, [week], 0, FIXED_NOW.toISOString());

  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(300);

  const kwText = await page.locator('#week-review-inline .wr-kw').innerText();
  expect(kwText).toBe('Diese Woche');
  expect(kwText).not.toMatch(/^KW/);
});

test('Cluster 2.2/2.3: ein bereits vergangener, nicht abgeschlossener Tag zählt korrekt (kein UTC-Rollover-Verlust)', async ({ page }) => {
  // 00:30 Ortszeit Berlin (CET, UTC+1 im Januar) == 23:30 UTC am Vortag --
  // exakt das Fenster, in dem new Date().toISOString() vor dem Fix auf den
  // FALSCHEN (vorherigen) Kalendertag zurückfiel.
  const FIXED_NOW = new Date('2026-01-05T00:30:00+01:00');
  await page.clock.install({ time: FIXED_NOW });
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Woche beginnt Montag 2026-01-05 (== "heute", Ortszeit). Tag 0 ist damit
  // "heute" selbst (nicht erledigt, korrekt noch nicht faellig). Um einen
  // ECHT VERGANGENEN, nicht erledigten Tag zu bekommen, beginnt die Woche
  // stattdessen VORGESTERN (2026-01-03) mit 3 Tagen: Tag 0 (03.01., erledigt),
  // Tag 1 (04.01., NICHT erledigt -- das ist der Tag, den der Bug verschluckte),
  // Tag 2 (05.01. == heute, NICHT erledigt, darf laut Fix-3-Regel nicht als
  // "verpasst" zaehlen, da der Tag noch laeuft).
  const week = {
    id: 1, startDate: '2026-01-03', note: '', mode: 'standard',
    days: [
      makeDay(10, { markedDone: true,  exercise: buildDoneExercise('Kniebeuge', 80) }),
      makeDay(11, { markedDone: false, exercise: buildPendingExercise('Bankdrücken', 60) }),
      makeDay(12, { markedDone: false, exercise: buildPendingExercise('Kreuzheben', 100) }),
    ],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
  // curIdx auf diese Woche, damit sie als "aktuelle Woche" im Header zaehlt --
  // fuer den Wochenrueckblick-Inline-Test reicht "mind. ein markedDone-Tag".
  await seedWeeks(page, [week], 0, FIXED_NOW.toISOString());

  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(300);

  // plannedDays muss 2 sein (03.01. erledigt + 04.01. bereits vergangen,
  // NICHT nur 1 wie vor dem Fix, wo 04.01. durch den UTC-Rollover
  // faelschlich als "noch nicht erreicht" ausgeschlossen wurde). 05.01.
  // (heute, nicht erledigt) darf NICHT mitzaehlen.
  const summaryText = await page.locator('#week-review-inline .wr-metrics-row').innerText();
  expect(summaryText).toMatch(/1\/2 Tage/);

  // "Was nicht gut lief" muss den 04.01. (echt vergangen, nicht erledigt)
  // als verpassten Tag zeigen -- aber NICHT mit "2 von 2" (das wuerde
  // bedeuten, dass auch der noch laufende 05.01. faelschlich mitgezaehlt wird).
  const lowlightText = await page.locator('#week-review-inline').innerText();
  expect(lowlightText).toMatch(/1 von 2 Tag/);
});

test('Cluster 2.4: PR und hohe RPE bei derselben Übung erzeugen eine verschmolzene, keine widersprüchliche Empfehlung', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const result = await page.evaluate(async () => {
    const weekReviewMod = await import('./weekReview.js');
    const mkSet = (weight, reps, rpe) => ({ weight, reps, rpe, status: 'success', done: true });
    const mkEx = (name, sets) => ({
      name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
      sets, prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetReps: 5,
      progressionType: 'weight', archived: false,
    });
    const mkDay = (id, ex) => ({
      id, title: 'Tag', subtitle: '', warmup: '', cooldown: '',
      locked: true, markedDone: true, isVacation: false,
      sleepHours: null, energyLevel: null,
      exercises: [ex], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    });
    // Front Squat: neuer PR (100kg, vorher max 90kg) UND Ø-RPE 9 (>= 8.5-
    // Schwelle für "Hohe Belastung") -- exakt der Front-Squat-Fall aus dem
    // Nutzer-Report (widersprüchliche PR- vs. hohe-RPE-Aussage).
    const prevWeek = {
      id: 1, startDate: '2026-01-05', note: '', mode: 'standard',
      days: [mkDay(10, mkEx('Front Squat', [mkSet(90, 5, 8)]))],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    };
    const thisWeek = {
      id: 2, startDate: '2026-01-12', note: '', mode: 'standard',
      days: [mkDay(20, mkEx('Front Squat', [mkSet(100, 5, 9), mkSet(100, 5, 9)]))],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    };
    const review = weekReviewMod.buildWeekReview(thisWeek, [prevWeek, thisWeek], []);
    return {
      highlightTypes: review.highlights.map(h => h.type),
      lowlightTypes: review.lowlights.map(l => l.type),
      recommendations: review.recommendations.map(r => r.text),
    };
  });

  expect(result.highlightTypes).toContain('pr');
  expect(result.lowlightTypes).toContain('fatigue');
  // Vorher: 2 Empfehlungszeilen mit widersprüchlichem Inhalt zu Front Squat
  // ("halte Gewicht, steigere Volumen" UND "leichtere Einheit einplanen").
  // Jetzt: genau EINE verschmolzene Zeile, die beides nennt.
  expect(result.recommendations).toHaveLength(1);
  expect(result.recommendations[0]).toContain('Front Squat');
  expect(result.recommendations[0]).toMatch(/PR/);
  expect(result.recommendations[0]).toMatch(/Anstrengung|halten/);
});
