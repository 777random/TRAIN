import { test, expect } from '@playwright/test';

// Runde 15, Cluster 3 (Nutzerfeedback: die "Schlaf & Energie"-Fläche im
// Körper-Tab wird als wenig wertvoll empfunden). Diagnose ergab: die Fläche
// zeigt bereits eine Volumen-Korrelation (sleepHours vs. _trueVol()), aber
// die deutlich aussagekräftigere Schlafqualität-vs-Erfolgsquote-Berechnung
// (calcSleepCorrelation(), sessionSummary.js, seit B79) lief bisher NUR
// einmalig im Session-Summary-Screen. Nutzer-Entscheidung: Eingabe behalten,
// diese Erkenntnis zusätzlich PERSISTENT im Körper-Tab zeigen (kein
// Datenverlust). Eigener Toggle (toggle-sleep-quality-insight), unabhängig
// von der bestehenden Volumen-Korrelation (toggle-body-insights).

function weeksAgoISO(n) {
  const d = new Date();
  d.setDate(d.getDate() - n * 7);
  return d.toISOString().split('T')[0];
}

function mkSet(weight, reps, status, rpe = null) {
  return { weight, reps, rpe, status, done: status === 'success', note: '' };
}

function mkEx({ name, sets, targetReps = 5 }) {
  return {
    name, note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
    sets,
    prWeight: Math.max(...sets.map(s => s.weight)), prRepsAtMaxWeight: targetReps, prRepsHistory: {},
    nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: sets.length, targetReps,
    progressionType: 'weight', progressionMode: 'weight_first', targetRepsMax: null, archived: false,
  };
}

// sleep: 'poor'|'good' via sessionCheckIn.sleep (Pre-Session-Check-in) --
// NICHT dasselbe Feld wie day.sleepHours (Tagesabschluss), siehe Diagnose.
function mkDay({ id = 11, sleep, sets }) {
  return {
    id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
    locked: false, markedDone: true, isVacation: false,
    sleepHours: null, energyLevel: null, sessionStartTs: Date.now(), sessionEndTs: Date.now(),
    sessionCheckIn: { sleep, energyPre: 'medium', timestamp: Date.now() },
    sessionModifier: null,
    exercises: [mkEx({ name: 'Kniebeuge', sets })],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

function mkWeek({ id, startDate, days }) {
  return { id, startDate, note: '', mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false };
}

// 6 Wochen, alternierend poor (20% Erfolg) / good (90% Erfolg) -> diff weit
// über der 15-Prozentpunkte-Signifikanzschwelle, totalDaysWithSleep=6.
function buildSleepQualityWeeks() {
  const weeks = [];
  for (let i = 0; i < 6; i++) {
    const sleep = i % 2 === 0 ? 'poor' : 'good';
    const sets = sleep === 'poor'
      ? [mkSet(80, 3, 'fail', 8), mkSet(80, 3, 'fail', 8), mkSet(80, 5, 'success', 8), mkSet(80, 3, 'fail', 8), mkSet(80, 3, 'fail', 8)]
      : [mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 3, 'fail', 6)];
    const day = mkDay({ id: i + 1, sleep, sets });
    weeks.push(mkWeek({ id: i + 1, startDate: weeksAgoISO(5 - i), days: [day] }));
  }
  return weeks;
}

async function seed(page, weeks, settingsOverride = { sessionCoach: true, rpeEnabled: true }) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate(({ weeksArg, settingsArg }) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1, weeks: weeksArg,
      customTemplate: [], settings: settingsArg,
      favoriteExercises: [], customExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      longestStreakEver: 0, seenTips: [],
    }));
  }, { weeksArg: weeks, settingsArg: settingsOverride });
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

test('Körper-Tab zeigt persistente Schlaf-Erfolgsquote-Beobachtung bei nachweisbarem Unterschied', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await seed(page, buildSleepQualityWeeks());

  await page.click('[data-tab="body"]');
  await page.waitForTimeout(300);

  const toggle = page.locator('[data-action="toggle-sleep-quality-insight"]');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText('Schlaf & Erfolgsquote');

  await toggle.click();
  const card = page.locator('#body-tab-content .insight-card', { hasText: 'Erfolgsquote' });
  await expect(card).toBeVisible();
  await expect(card).toContainText('Prozentpunkte höher');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Körper-Tab: kein Schlaf-Erfolgsquote-Hinweis ohne genug Historie (<6 Tage mit Schlafdaten)', async ({ page }) => {
  await seed(page, buildSleepQualityWeeks().slice(0, 3));

  await page.click('[data-tab="body"]');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="toggle-sleep-quality-insight"]')).toHaveCount(0);
});

// Regressionsschutz: die bestehende Volumen-Korrelation (toggle-body-insights)
// bleibt unabhängig funktionsfähig -- beide Insights können gleichzeitig da
// sein, mit getrennten Auf-/Zuklapp-Zuständen.
test('Körper-Tab: bestehende Volumen-Korrelation bleibt unverändert neben der neuen Schlaf-Erfolgsquote-Beobachtung', async ({ page }) => {
  const weeks = [];
  for (let i = 0; i < 6; i++) {
    const sleep = i % 2 === 0 ? 'poor' : 'good';
    const sets = sleep === 'poor'
      ? [mkSet(80, 3, 'fail', 8), mkSet(80, 3, 'fail', 8), mkSet(80, 5, 'success', 8), mkSet(80, 3, 'fail', 8), mkSet(80, 3, 'fail', 8)]
      : [mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 5, 'success', 6), mkSet(80, 3, 'fail', 6)];
    const day = mkDay({ id: i + 1, sleep, sets });
    day.sleepHours = sleep === 'poor' ? 5 : 8.5; // zusätzlich Tagesabschluss-Feld für die Volumen-Korrelation
    weeks.push(mkWeek({ id: i + 1, startDate: weeksAgoISO(5 - i), days: [day] }));
  }
  await seed(page, weeks);

  await page.click('[data-tab="body"]');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="toggle-body-insights"]')).toBeVisible();
  await expect(page.locator('[data-action="toggle-sleep-quality-insight"]')).toBeVisible();

  await page.locator('[data-action="toggle-body-insights"]').click();
  await expect(page.locator('#body-tab-content .insight-card')).toHaveCount(1);
  await page.locator('[data-action="toggle-sleep-quality-insight"]').click();
  await expect(page.locator('#body-tab-content .insight-card')).toHaveCount(2);
});

// Launch-Roadmap Phase B, Kategorie 5, Szenario 21: Session Coach AKTUELL
// deaktiviert, aber der Nutzer hat HISTORISCHE sessionCheckIn-Daten aus
// einer Zeit, als der Toggle noch aktiv war (nachträglich umgeschaltet).
// calcSleepCorrelation() wird in renderBodyTab() UNBEDINGT aufgerufen (kein
// `if (settings.sessionCoach)`-Gate) -- die Erkenntnis muss also weiterhin
// auf Basis der alten Daten erscheinen, nicht durch den aktuellen
// Toggle-Zustand verschwinden.
test('Körper-Tab zeigt die Schlaf-Erfolgsquote-Beobachtung weiterhin, wenn Session Coach AKTUELL deaktiviert ist (historische Daten)', async ({ page }) => {
  await seed(page, buildSleepQualityWeeks(), { sessionCoach: false, rpeEnabled: true });

  await page.click('[data-tab="body"]');
  await page.waitForTimeout(300);

  await expect(page.locator('[data-action="toggle-sleep-quality-insight"]')).toBeVisible();
});
