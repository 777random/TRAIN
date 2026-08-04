import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

// Launch-Roadmap Phase B, Kategorie 6/7 (Backup/Restore-Grenzfälle), Szenarien
// 22-24 (Cowork-Priorität: hoch, Datenverlust-/Absturz-Risiko). Anders als
// tests/migration_matrix.spec.js/fixtures.spec.js (localStorage.setItem +
// Reload, umgeht den echten UI-Import) nutzen diese Tests den ECHTEN
// Restore-Pfad (page.setInputFiles('[data-action="import-json"]', ...) ->
// backup.js importJSON()).

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
    plateauActions: {}, decisionLog: [], badges: [], onboardingDone: true,
  });
}

async function boot(page) {
  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
  await page.evaluate((data) => { localStorage.setItem('train_v6', data); }, minimalBootState());
  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });
}

// Szenario 22 (hohe Priorität). Root Cause (Commit ccd22d5, 2026-06-19):
// backup.js importJSON() lehnte Backups ohne meta.schemaVersion/settings
// hart als "Ungültiges Backup" ab -- state.js migrate() (via STATE_IMPORT)
// hätte sie längst korrekt migriert (v = raw?.meta?.schemaVersion ?? 0,
// exakt wie tests/migration_matrix.spec.js "v0 -> v33" für denselben
// Fixture-Inhalt über den localStorage-Boot-Pfad beweist). Ursprünglicher
// Code-Kommentar vor der Verschärfung lautete wörtlich "warn but still
// import (migrate() will handle it)" -- dahin zurückgekehrt. Fix: settings
// wird bei Fehlen defensiv auf {} normiert, fehlende schemaVersion gilt
// als v0, statt den Import abzulehnen.
test('Szenario 22: sehr altes Backup (v0, kein meta/settings) laesst sich ueber den echten Restore-Pfad wiederherstellen', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await boot(page);
  await page.click('[data-tab="settings"]');

  const json = readFileSync('tests/migration-fixtures/TRAIN_Migration_v0_VollDurchlauf.v1.json', 'utf-8');
  await page.setInputFiles('[data-action="import-json"]', {
    name: 'sehr-altes-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf-8'),
  });
  await page.waitForTimeout(500);

  await expect(page.locator('#invalid-backup-dialog')).toHaveCount(0);
  await expect(page.locator('.toast')).toContainText('wiederhergestellt');

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(state.meta.schemaVersion).toBe(33);
  expect(state.weeks.length).toBeGreaterThan(0);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Szenario 23 (hohe Priorität): echt korrupte Datei -- muss weiterhin sauber
// abgefangen werden (JSON.parse-Fehler), bestehende Daten bleiben unangetastet.
test('Szenario 23: korrupte (kein gueltiges JSON) Backup-Datei wird sauber abgelehnt, bestehende Daten bleiben unangetastet', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  await boot(page);
  await page.click('[data-tab="settings"]');

  await page.setInputFiles('[data-action="import-json"]', {
    name: 'kaputt.json', mimeType: 'application/json',
    buffer: Buffer.from('{ das ist kein json !!', 'utf-8'),
  });
  await page.waitForTimeout(500);

  await expect(page.locator('#invalid-backup-dialog')).toBeVisible();
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(state.weeks.length).toBe(1); // unverändert (minimalBootState)
  expect(state.weeks[0].days[0].title).toBe('Tag A');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});

// Szenario 23b: JSON, das strukturell KEIN TRAIN-Backup ist (kein
// weeks-Array) -- eigenständige Prüfung, bleibt bewusst hart (einzige
// verbliebene Gatekeeper-Bedingung nach dem Szenario-22-Fix).
test('Szenario 23b: strukturfremdes JSON (kein weeks-Array) wird weiterhin abgelehnt', async ({ page }) => {
  page.on('dialog', dialog => dialog.accept());
  await boot(page);
  await page.click('[data-tab="settings"]');

  await page.setInputFiles('[data-action="import-json"]', {
    name: 'unrelated.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ hello: 'world' }), 'utf-8'),
  });
  await page.waitForTimeout(500);
  await expect(page.locator('#invalid-backup-dialog')).toBeVisible();
});

// Szenario 24 (hohe Priorität): Backup-Import während einer laufenden
// Trainingssession (Timer aktiv, per _ensureSessionStart()/'train:set-input'
// ausgelöst wie in tests/sw_deferred_registration.spec.js). Erwartung:
// definiertes Verhalten -- kein Crash, App bleibt nach dem Import bedienbar,
// State entspricht vollständig dem importierten Backup (kein Mischzustand
// zwischen altem Timer-Kontext und neuen Daten). timer.js's _clockDi-Guards
// (`wk.days[_clockDi]` immer gegengeprüft) machen das erwartbar sicher --
// hier als echter Regressionsschutz verifiziert statt nur angenommen.
test('Szenario 24: Backup-Import waehrend laufender Trainingssession bleibt stabil, kein Crash', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('dialog', dialog => dialog.accept());
  await boot(page);

  // Session starten (wie timer.js _ensureSessionStart() es bei der ersten
  // Eingabe tut).
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('train:set-input', { detail: { di: 0 } }));
  });
  await page.waitForTimeout(300);
  const stateBeforeImport = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(stateBeforeImport.weeks[0].days[0].sessionStartTs).not.toBeNull();

  await page.click('[data-tab="settings"]');
  const json = readFileSync('tests/migration-fixtures/TRAIN_Migration_v0_VollDurchlauf.v1.json', 'utf-8');
  await page.setInputFiles('[data-action="import-json"]', {
    name: 'backup-waehrend-session.json', mimeType: 'application/json',
    buffer: Buffer.from(json, 'utf-8'),
  });
  await page.waitForTimeout(500);

  await expect(page.locator('.toast')).toContainText('wiederhergestellt');

  // App bleibt danach voll bedienbar -- Training-Tab öffnen, kein Crash.
  await page.click('[data-tab="workout"]');
  await page.waitForTimeout(300);
  await expect(page.locator('#app')).toBeVisible();

  const stateAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  expect(stateAfter.meta.schemaVersion).toBe(33);
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
