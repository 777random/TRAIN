import { test, expect } from '@playwright/test';

// Runde-19-Bundlefolgefund (nicht Teil der ursprünglichen 12 Cluster):
// #app hat position:fixed -> IMMER eigener Stacking-Context, unabhängig
// vom z-index. Der Backup-Reminder-Toast hing an document.body (Sibling
// von #app statt Nachfahre) -- sein z-index konkurrierte dadurch NICHT
// im selben Context wie Modal-Overlays (z-index 400) und rendert über
// JEDEM offenen Modal, egal welchen z-index dieses intern nutzt. Ursache
// des seit Phase B dokumentierten "Backup-Reminder-Toast-Overlap"-Flakes
// (deload_volumen.spec.js) und der Regression in
// settings_combination_smoke.spec.js Szenario 20. Fix: Toast wird jetzt
// an #app gehängt (wie jedes Modal), z-index gesenkt (800 -> 350, über
// Sticky-Kopfzeile/Tab-Nav, unter jedem Modal-Overlay).

function mkWeek(id, startDate) {
  return {
    id, startDate, note: '', mode: 'standard',
    days: [{ id, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
      exercises: [], sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
    sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
  };
}

test('Backup-Reminder-Toast liegt im selben Stacking-Context wie #app (Kind von #app, nicht von document.body)', async ({ page }) => {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // _shouldShowBackupReminder() (ui.js): ohne settings.lastBackupDate gilt
  // die Erinnerung als fällig, sobald state.weeks.length >= 2 -- also 2
  // Wochen seeden, KEIN lastBackupDate setzen. Der Toast selbst feuert
  // über einen 2000ms-setTimeout beim App-Start (ui.js, APP_GEÖFFNET).
  const todayISO = new Date().toISOString().slice(0, 10);
  const weeks = [mkWeek(1, todayISO), mkWeek(2, todayISO)];
  await page.evaluate((weeksArg) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: weeksArg.length - 1,
      weeks: weeksArg,
      customTemplate: [], settings: {},
      favoriteExercises: [], prs: {}, coachPerformance: { suggestions: [] },
      coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  }, weeks);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const toast = page.locator('#backup-reminder-toast');
  await expect(toast).toBeVisible({ timeout: 10000 });

  const isChildOfApp = await page.evaluate(() => {
    const t = document.getElementById('backup-reminder-toast');
    const app = document.getElementById('app');
    return !!t && !!app && t.parentElement === app;
  });
  expect(isChildOfApp).toBe(true);

  // Der eigentliche End-to-End-Regressionsschutz fürs Klick-Blockieren
  // eines offenen Modals liegt bereits in
  // settings_combination_smoke.spec.js (Szenario 20) und
  // deload_volumen.spec.js -- dieser Test sperrt gezielt die strukturelle
  // Root Cause (DOM-Elternteil) fest, die beide zuvor unabhängig
  // voneinander betraf.
});
