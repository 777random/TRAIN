import { test, expect } from '@playwright/test';

// B196 (Runde 10, Domäne B): `_backupAgeInDays()` (ui.js, Settings-Tab
// Backup-Status) verglich bisher die volle aktuelle Uhrzeit gegen den
// rohen lastBackupDate-Zeitstempel — ein Backup kurz vor Mitternacht,
// gefolgt von "jetzt" kurz nach Mitternacht, zeigte fälschlich "Heute
// gesichert" statt kalendarisch korrekt "Vor 1 Tag". Fix: beide Seiten auf
// Mittag ihres jeweiligen Kalendertags normiert (gleiches Muster wie B147).

async function seed(page, { now, lastBackupDate }) {
  await page.clock.install({ time: now });
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((lastBackupDate) => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 33, savedAt: Date.now(), createdAt: Date.now() },
      curIdx: 0,
      weeks: [{
        id: 1, startDate: '2026-01-05', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: false, markedDone: false, isVacation: false, exercises: [] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
      }],
      customTemplate: [], settings: { lastBackupDate }, favoriteExercises: [],
      customExercises: [], prs: {}, coachPerformance: { suggestions: [] }, coachQuestion: null,
      coachQuestionHistory: [], lastReentryHandled: null, plateauActions: {}, decisionLog: [],
      badges: [], onboardingDone: true, longestStreakEver: 0,
    }));
  }, lastBackupDate);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.click('[data-tab="settings"]');
  await page.waitForTimeout(200);
}

test('Backup kurz vor Mitternacht, "jetzt" kurz danach: zeigt "Vor 1 Tag", nicht "Heute gesichert"', async ({ page }) => {
  const now = new Date('2026-01-06T00:01:00');
  const lastBackupDate = new Date('2026-01-05T23:59:00').getTime();
  await seed(page, { now, lastBackupDate });

  await expect(page.locator('.backup-status-line')).toHaveText(/Vor 1 Tag/);
});

test('Backup und "jetzt" am selben Kalendertag (unterschiedliche Uhrzeit): zeigt "Heute gesichert"', async ({ page }) => {
  const now = new Date('2026-01-05T23:59:00');
  const lastBackupDate = new Date('2026-01-05T00:01:00').getTime();
  await seed(page, { now, lastBackupDate });

  await expect(page.locator('.backup-status-line')).toHaveText(/Heute gesichert/);
});
