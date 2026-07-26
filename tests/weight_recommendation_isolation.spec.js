import { test, expect } from '@playwright/test';

// B121: weightRecommendation.js kannte bisher kein Compound/Isolation-
// Bewusstsein -- die "noch steigern"-RPE-Spanne (7.5-8.5) galt fuer JEDE
// Uebung gleich, wodurch z.B. Seitheben (Isolation) bei RPE 8 faelschlich
// eine Steigerung statt "Halten" vorschlug (movementMap.js/sessionCoach.js
// waren dabei bereits korrekt -- der Bug lag ausschliesslich in
// weightRecommendation.js/_recommendationCore()). Fix: isCompound-Parameter
// senkt die obere Grenze der Steigerungs-Spanne fuer Isolationsuebungen auf
// 7.5 -- RPE 8 faellt dort jetzt in die Halten-Zone, Compound-Uebungen
// (Spanne 7.5-8.5 unveraendert) steigern bei RPE 8 weiterhin.

function isoMondayWeeksAgo(n) {
  const d = new Date();
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow) - n * 7);
  return d.toISOString().split('T')[0];
}

function mkEx(name, weight) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 2.5,
    sets: [{ weight, reps: 8, rpe: 8, status: 'success', done: true, note: '' }],
    prWeight: weight, prRepsAtMaxWeight: 8, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 8,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
    substituteFor: null,
  };
}

function mkDay(id, exercises) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: true, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: null, sessionEndTs: null,
    sessionCheckIn: null, sessionModifier: null, sessionModifierScope: null,
    exercises, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

async function seed(page) {
  const weeks = [0, 1].map(i => ({
    id: i + 1, startDate: isoMondayWeeksAgo(1 - i), note: '', mode: 'standard',
    days: [mkDay(i + 10, [mkEx('Seitheben', 20), mkEx('Kniebeuge', 100)])],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  }));
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg, onboardingDone: true,
      customTemplate: [], settings: { plateStep: 2.5, deloadFactor: 0.75, sessionCoach: false, rpeEnabled: true },
      favoriteExercises: [], customExercises: [],
      prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: null, plateauActions: {}, decisionLog: [], badges: [],
      longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Seitheben (Isolation) bei RPE 8: "Gewicht halten" statt Steigerungsvorschlag', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page);

  await page.click('[data-action="open-new-week"]');
  const reviewContinue = page.locator('#wr-btn-continue');
  if (await reviewContinue.count()) await reviewContinue.click();
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });

  const seithebenAction = page.locator('[data-name="Seitheben"] .nw-rec-action');
  await expect(seithebenAction).toHaveText(/Gewicht halten/);
  await expect(seithebenAction).not.toContainText('empfohlen');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Kniebeuge (Compound) bei RPE 8: Steigerungsvorschlag bleibt unveraendert', async ({ page }) => {
  await seed(page);

  await page.click('[data-action="open-new-week"]');
  const reviewContinue = page.locator('#wr-btn-continue');
  if (await reviewContinue.count()) await reviewContinue.click();
  await page.waitForSelector('#modal-new-week.is-open', { timeout: 5000 });

  // Compound wird bei RPE 8 weiterhin automatisch vorausgewaehlt (Steigerung),
  // Text-Format unterscheidet sich daher von der unbestaetigten Isolations-
  // Anzeige ("+Xkg empfohlen") -- entscheidend ist: kein "Gewicht halten".
  const kniebeugeAction = page.locator('[data-name="Kniebeuge"] .nw-rec-action');
  await expect(kniebeugeAction).toContainText('+1.25kg');
  await expect(kniebeugeAction).not.toContainText('Gewicht halten');
});
