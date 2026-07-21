import { test, expect } from '@playwright/test';

// B84: Bei sessionModifier='reduced' (B76 — schlechter Schlaf/Energie-
// Check-in) dämpfte _applyModifier() (sessionCoach.js) jede Intra-Session-
// Gewichtsempfehlung identisch über Math.max(nextWeight*0.9, currentWeight
// -step) — das ist für eine Halten/Reduzieren-Empfehlung sinnvoll, drückte
// aber eine echte STEIGERUNG (RPE<=6, "Noch Luft — steigern") fälschlich
// UNTER das gerade gehobene Gewicht: 98kg RPE6 zeigte "95kg" (unter 98kg!)
// bei gleichzeitigem "steigern"-Hinweistext — ein direkter Widerspruch.
//
// Reproduziert exakt das gemeldete Szenario (90kg RPE10 korrekt @ 87.5kg,
// 98kg RPE6 vormals falsch @ 95kg, jetzt korrekt @ 100kg).

async function seedDayWithSets(page, { sessionModifier, sets }) {
  await page.evaluate(({ sessionModifier, sets }) => {
    const today = new Date();
    const dow = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() + (dow === 0 ? -6 : 1 - dow));
    const startDate = monday.toISOString().slice(0, 10);

    const ex = {
      name: 'Bankdrücken', note: '', pauseSec: 90, metric: 'reps',
      sets, weightStep: 2.5, metricStep: null, nextWeekPlan: null, nextWeekPlanConfirmed: false,
      targetReps: 5, progressionType: 'weight', archived: false, substituteFor: null,
      prWeight: null, prRepsAtMaxWeight: null, prRepsHistory: {},
      progressionMode: 'weight_first', targetRepsMax: null,
    };
    const day = {
      id: 1, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, sessionRating: null,
      sessionCheckIn: null, sessionModifier,
      exercises: [ex],
    };
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: today.toISOString(), createdAt: today.toISOString() },
      curIdx: 0,
      weeks: [{ id: 1, startDate, note: '', mode: 'standard', days: [day], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: { sessionCoach: true }, prs: {},
      coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
    }));
    localStorage.setItem('train_v6_shadow', 'x');
  }, { sessionModifier, sets });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.waitForTimeout(300);
}

test('sessionModifier=reduced: Steigerung (RPE<=6) wird NICHT unter das gehobene Gewicht gedämpft', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await seedDayWithSets(page, {
    sessionModifier: 'reduced',
    sets: [
      { weight: 90, reps: 5, rpe: 10, status: 'success', done: true },
      { weight: 98, reps: 5, rpe: 6,  status: 'success', done: true },
      { weight: 100, reps: 5, rpe: null, status: 'pending', done: false },
    ],
  });

  const feedback = await page.locator('.set-feedback').evaluateAll(els => els.map(el => el.textContent));

  // Satz 1 (90kg RPE10, Reduzieren-Zweig): weiterhin gedämpft auf 87.5kg —
  // unverändertes, gewolltes Verhalten (AC1, Regressionsschutz).
  expect(feedback[0]).toContain('87.5kg');

  // Satz 2 (98kg RPE6, Steigern-Zweig): NICHT mehr unter 98kg gedämpft.
  // Vorher (Bug): 95kg. Jetzt: 100kg (98+2.5=100.5, gerundet auf 100).
  expect(feedback[1]).toContain('100kg');
  expect(feedback[1]).not.toContain('95kg');
  expect(feedback[1]).toContain('steigern');
});

test('sessionModifier=normal: unverändertes Verhalten (kein Dämpfen)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await seedDayWithSets(page, {
    sessionModifier: 'normal',
    sets: [
      { weight: 98, reps: 5, rpe: 6, status: 'success', done: true },
      { weight: 100, reps: 5, rpe: null, status: 'pending', done: false },
    ],
  });

  const feedback = await page.locator('.set-feedback').evaluateAll(els => els.map(el => el.textContent));
  expect(feedback[0]).toContain('100kg');
});

test('sessionModifier=reduced: Halten-Empfehlung (RPE optimal, gleiches Gewicht) bleibt weiterhin gedämpft', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await seedDayWithSets(page, {
    sessionModifier: 'reduced',
    sets: [
      { weight: 100, reps: 5, rpe: 7, status: 'success', done: true },
      { weight: 100, reps: 5, rpe: null, status: 'pending', done: false },
    ],
  });

  const feedback = await page.locator('.set-feedback').evaluateAll(els => els.map(el => el.textContent));
  // "Halten" (RPE 6.5-7.5) -> nextWeight === currentWeight (100) VOR dem
  // Modifier -> nextWeight > currentWeight ist FALSE -> weiterhin gedämpft
  // (Math.max(90, 97.5) = 97.5). Unverändertes Verhalten, kein Regress.
  expect(feedback[0]).toContain('97.5kg');
});
