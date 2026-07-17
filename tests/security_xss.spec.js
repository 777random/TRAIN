import { test, expect } from '@playwright/test';

// Regression-Test für den in ui.js:4134 gefundenen XSS-Fund (Template-
// Editor-Übungsname wurde ohne h()-Escaping in ein value-Attribut
// geschrieben) sowie für die backup.js-Importvalidierung, über die
// derselbe Wert aus einer fremden Backup-Datei eingeschleust werden
// konnte. Payload bricht bei fehlendem Escaping aus dem value-Attribut
// aus und erzeugt ein <img src="x">, dessen onerror-Handler feuert.

const XSS_PAYLOAD = 'x"><img src=x onerror="window.__xssFired = true">';

// Minimaler valider State (analog tests/fixtures/*.json) — wird vor dem
// eigentlichen Testablauf per localStorage gesetzt, damit die App direkt
// in die normale Ansicht statt ins Onboarding startet (Onboarding-Overlay
// blockiert sonst Tab-Klicks, siehe fixtures.spec.js für dasselbe Muster).
function minimalBootState() {
  return JSON.stringify({
    meta: { schemaVersion: 30, savedAt: Date.now(), createdAt: Date.now() },
    curIdx: 0,
    weeks: [{
      id: 1, startDate: '2026-07-06', note: '', mode: 'standard',
      days: [{
        id: 2, title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
        locked: false, markedDone: false, isVacation: false,
        sleepHours: null, energyLevel: null, sessionRating: null,
        exercises: [{
          name: 'Kreuzheben', note: '', pauseSec: 90, metric: 'reps',
          sets: [{ weight: 100, reps: 5, rpe: null, status: 'pending', done: false, note: '' }],
          weightStep: 2.5, nextWeekPlan: 0, nextWeekPlanConfirmed: false,
          targetSets: 1, targetReps: 5, progressionType: 'weight', archived: false,
        }],
      }],
      sessionLog: [], bodyData: {}, restDays: [], isSeedWeek: false,
    }],
    customTemplate: [], settings: {}, prs: {}, coachPerformance: { suggestions: [] },
    coachQuestion: null, coachQuestionHistory: [], lastReentryHandled: null,
    plateauActions: {}, decisionLog: [], badges: [],
  });
}

function backupWithMaliciousTemplateName(name) {
  return JSON.stringify({
    meta: { schemaVersion: 1, savedAt: Date.now(), createdAt: Date.now() },
    weeks: [],
    settings: {},
    customTemplate: [
      {
        id: 'day-1',
        title: 'Tag 1',
        subtitle: '',
        exercises: [{ name, note: '', metric: 'kg', sets: [] }],
      },
    ],
  });
}

test('Template-Editor: XSS-Payload im Übungsnamen wird escaped angezeigt, nicht ausgeführt (JSON-Import-Weg)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => dialog.accept());

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.evaluate((data) => {
    localStorage.setItem('train_v6', data);
  }, minimalBootState());
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  await page.click('[data-tab="settings"]');

  await page.setInputFiles('[data-action="import-json"]', {
    name: 'malicious-backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(backupWithMaliciousTemplateName(XSS_PAYLOAD), 'utf-8'),
  });

  await page.waitForSelector('.toast', { timeout: 10000 });

  await page.click('[data-action="open-tpl"]');
  await page.waitForSelector('#modal-template.is-open', { timeout: 10000 });

  const fired = await page.evaluate(() => window.__xssFired === true);
  expect(fired).toBe(false);
  await expect(page.locator('img[src="x"]')).toHaveCount(0);

  const nameInput = page.locator('.tpl-name-input').first();
  await expect(nameInput).toHaveValue(XSS_PAYLOAD);

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
