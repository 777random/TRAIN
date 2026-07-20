import { test, expect } from '@playwright/test';

// B65: Nutzer meldete, die automatische Gewichtssteigerung wirke bei Squats
// "immer noch 1,25kg" — die Empfehlungs-Logik selbst (B48) war korrekt,
// aber jede Übung startete unconditional mit weightStep=2.5, unabhängig von
// movementMap.js's bereits vorhandener Kategorisierung. Migration v30→v31
// hebt Squat/Hinge-Übungen mit unverändertem Standard (undefined oder 2.5)
// auf 5kg an — bewusst NUR den unveränderten Default, eine bereits vom
// Nutzer gewählte andere Schrittweite bleibt unangetastet.

test('Migration v31: Squat/Hinge-Schrittweite angehoben, andere Übungen/Nutzer-Overrides unangetastet', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(() => {
    const exBase = { note: '', pauseSec: 90, metric: 'reps', sets: [],
      prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
      nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
      progressionType: 'weight', archived: false };
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 30, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-13', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false,
          sleepHours: null, energyLevel: null, sessionRating: null,
          exercises: [
            { ...exBase, name: 'Kniebeuge', weightStep: 2.5 },   // Squat, Standard -> soll 5 werden
            { ...exBase, name: 'Kreuzheben', weightStep: 1.25 }, // Hinge, Nutzer-Override -> bleibt 1.25
            { ...exBase, name: 'Bankdrücken', weightStep: 2.5 }, // Push, Standard -> bleibt 2.5
          ] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: {}, prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
  });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const exs = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).weeks[0].days[0].exercises);
  const byName = Object.fromEntries(exs.map(e => [e.name, e.weightStep]));
  expect(byName['Kniebeuge']).toBe(5);
  expect(byName['Kreuzheben']).toBe(1.25);
  expect(byName['Bankdrücken']).toBe(2.5);

  // >= statt === 31: prüft nur, dass die v30->v31-Migration selbst gelaufen
  // ist (Kernanliegen dieses Tests) — nicht die exakte Endversion, die sich
  // mit jeder neuen Migration (zuletzt B76, SCHEMA 32) sonst hier mit
  // ändern müsste, ohne dass dieser Test inhaltlich etwas damit zu tun hat.
  const schemaVersion = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')).meta.schemaVersion);
  expect(schemaVersion).toBeGreaterThanOrEqual(31);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
