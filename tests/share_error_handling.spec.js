import { test, expect } from '@playwright/test';

// Bugfix: "Teilen startet Download statt nativen Android-Share-Dialog".
// navigator.share()/canShare() existieren in Playwright/Chromium (auch
// mobil emuliert) nicht real -- daher hier per page.addInitScript() gemockt,
// um AbortError (Nutzer bricht ab) von anderen Fehlern (z.B. verlorener
// Gesten-Kontext) zu unterscheiden: AbortError -> kein Download, kein
// GoatCounter-Event. Andere Fehler -> Download-Fallback + anonymes
// GoatCounter-Event (Observability-Muster wie B66, kein Blindfix).

function todayISO() { return new Date().toISOString().split('T')[0]; }

async function seedWeekWithPr(page) {
  await page.evaluate(() => {
    localStorage.setItem('train_v6', JSON.stringify({
      meta: { schemaVersion: 32, savedAt: Date.now(), createdAt: Date.now() }, curIdx: 0,
      weeks: [{ id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
        days: [{ id: 11, title: 'Tag A', subtitle: '', warmup: '', cooldown: '', locked: true, markedDone: true, isVacation: false,
          sleepHours: 7, energyLevel: 4, sessionRating: 2,
          exercises: [{
            name: 'Kniebeuge', note: '', pauseSec: 90, metric: 'reps', weightStep: 5,
            sets: [{ weight: 100, reps: 5, rpe: 7, status: 'success', done: true, note: '' }],
            prWeight: 100, prRepsAtMaxWeight: 5, prRepsHistory: {},
            nextWeekPlan: 0, nextWeekPlanConfirmed: false, targetSets: 1, targetReps: 5,
            progressionType: 'weight', archived: false,
          }] }],
        sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false }],
      customTemplate: [], settings: {},
      prs: { 'Kniebeuge': { maxWeight: 100, maxVolume: 500, maxEstimated1RM: 116.7, maxRepsAtMaxWeight: 5, date: '2026-07-06' } },
      coachPerformance: { suggestions: [] }, coachQuestion: null, coachQuestionHistory: [],
      lastReentryHandled: new Date().toISOString().split('T')[0],
      plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
      // Consent bereits erteilt -- Fokus dieses Tests ist der Share-Fehlerpfad, nicht der Consent-Screen.
    }));
    localStorage.setItem('train_share_consent', 'true');
  });
}

async function mockShare(page, errorName) {
  await page.addInitScript((errName) => {
    window.__shareCalls = [];
    window.__gcEvents = [];
    navigator.share = async (data) => {
      window.__shareCalls.push(data.title);
      const err = new Error('mocked');
      err.name = errName;
      throw err;
    };
    navigator.canShare = () => true;
    window.goatcounter = { count: (opts) => { window.__gcEvents.push(opts); } };
  }, errorName);
}

test('AbortError (Nutzer bricht Share ab) -> kein Download, kein GoatCounter-Event', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await mockShare(page, 'AbortError');
  await page.route('https://gc.zgo.at/**', route => route.abort());
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedWeekWithPr(page);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });

  let downloadHappened = false;
  page.on('download', () => { downloadHappened = true; });
  await page.click('#week-review-inline-share');
  await page.waitForTimeout(500);

  expect(downloadHappened).toBe(false);
  const gcEvents = await page.evaluate(() => window.__gcEvents ?? []);
  expect(gcEvents.some(e => e.path?.startsWith('share_failed'))).toBe(false);
  const shareCalls = await page.evaluate(() => window.__shareCalls ?? []);
  expect(shareCalls.length).toBe(1); // navigator.share() wurde tatsächlich versucht

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('Anderer Fehler (z.B. NotAllowedError) -> Download-Fallback UND anonymes GoatCounter-Event', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await mockShare(page, 'NotAllowedError');
  await page.route('https://gc.zgo.at/**', route => route.abort());
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedWeekWithPr(page);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#week-review-inline-share'),
  ]);
  expect(download.suggestedFilename()).toBe('train-woche.png');

  const gcEvents = await page.evaluate(() => window.__gcEvents ?? []);
  expect(gcEvents.some(e => e.path === 'share_failed: NotAllowedError')).toBe(true);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

test('canShare() liefert true -> navigator.share() wird versucht statt sofort Download', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await mockShare(page, 'AbortError');
  await page.route('https://gc.zgo.at/**', route => route.abort());
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await seedWeekWithPr(page);
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="progress"]');
  await page.waitForSelector('#week-review-inline-share', { timeout: 5000 });
  await page.click('#week-review-inline-share');
  await page.waitForTimeout(500);

  const shareCalls = await page.evaluate(() => window.__shareCalls ?? []);
  expect(shareCalls[0]).toMatch(/^Wochenrückblick KW \d+ — TRAIN$/);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
