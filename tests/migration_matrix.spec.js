import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

// Migrations-Testmatrix (Migrations-Audit-Auftrag 1, siehe
// "Diagnose & Sprints/diagnose-migrations-audit-2026-08-03.txt"). Anders als
// tests/fixtures.spec.js (nur "0 uncaught errors") prüft dieser Spec gezielt
// die RESULTIERENDE Datenstruktur nach migrate() — pro Fixture genau der
// schemaVersion-Sprung, den ihr Name benennt (state.js migrate(), Zeile
// 607-1069). Jede Fixture repräsentiert einen synthetischen historischen
// Speicherstand kurz VOR dem jeweiligen Sprung; migrate() durchläuft beim
// Laden automatisch die GESAMTE restliche Kaskade bis SCHEMA_VERSION (33).

const FIXTURES_DIR = 'tests/migration-fixtures';

/** Lädt eine Fixture per localStorage, reloaded, gibt den migrierten State + pageErrors zurück. */
async function loadAndMigrate(page, fixtureName) {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/');
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  const json = readFileSync(join(FIXTURES_DIR, fixtureName), 'utf-8');
  await page.evaluate((data) => {
    localStorage.setItem('train_v6', data);
  }, json);

  await page.reload();
  await page.waitForSelector('#app.is-ready', { timeout: 10000 });

  // Wie fixtures.spec.js: Coach-/Fortschritt-Tab öffnen, damit Rendering-
  // Fehler auf Basis der frisch migrierten (u.U. sparsen) Daten auffallen.
  await page.click('[data-tab="coach"]');
  await page.waitForTimeout(500);
  await page.click('[data-tab="progress"]');
  await page.waitForTimeout(500);

  const migrated = await page.evaluate(() => JSON.parse(localStorage.getItem('train_v6')));
  return { migrated, pageErrors };
}

test('v0 -> v33: kompletter Migrations-Durchlauf ohne Absturz', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v0_VollDurchlauf.v1.json (kein meta, keine
  //   settings/customTemplate — ältester denkbarer Speicherstand vor v6).
  // WO prüfen: localStorage['train_v6'] nach Reload (migrierter State).
  // ERWARTUNG VORHER (raw): kein meta.schemaVersion, ex.targetSets:2,
  //   ex.weightStep:2.5, ex.tags fehlt, kein skipReason/skipDate.
  // ERWARTUNG NACHHER: schemaVersion 33, targetSets entfernt (v9->10),
  //   weightStep 5 (v30->31 Squat-Bump greift, da 2.5 = unveränderter
  //   Default), tags per Muskelgruppen-Backfill befüllt, skipReason/
  //   skipDate/nextWeekPlanAutoReviewed gesetzt (v32->33), streakFreeze/
  //   surpriseLog NICHT vorhanden (transient v24->25 hinzugefügt, dann vom
  //   subtraktiven Always-apply-Block wieder entfernt).
  // WARUM diese Daten: deckt die GESAMTE Kaskade in einem Lauf ab — der
  //   härteste Einzeltest der Matrix (keine Version übersprungen).
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v0_VollDurchlauf.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);

  const ex = migrated.weeks[0].days[0].exercises[0];
  expect(ex.targetSets).toBeUndefined();
  expect(ex.weightStep).toBe(5);
  expect(ex.tags).toEqual(['Quadrizeps', 'Gluteus']);
  expect(ex.skipReason).toBeNull();
  expect(ex.skipDate).toBeNull();
  expect(ex.nextWeekPlanAutoReviewed).toBe(true);

  const day = migrated.weeks[0].days[0];
  expect(day.locked).toBe(false);
  expect(day.markedDone).toBe(false);
  expect(day.isVacation).toBe(false);

  const wk = migrated.weeks[0];
  expect(wk.label).toBe('');
  expect(wk.isSeedWeek).toBe(false);

  expect(migrated.settings.largestPlate).toBe(25);
  expect(migrated.settings.autoWeek).toEqual({ enabled: false, suggestProgress: true, showReview: true });
  expect(migrated.streakFreeze).toBeUndefined();
  expect(migrated.surpriseLog).toBeUndefined();
});

test('v9 -> v10: ex.targetSets wird entfernt', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v9_TargetSetsEntfernung.v1.json (schemaVersion 9, ex.targetSets:2).
  // WO prüfen: migrated.weeks[0].days[0].exercises[0].
  // ERWARTUNG VORHER: ex.targetSets === 2 (Feld existiert, wird per B9->10-Migration gelöscht).
  // ERWARTUNG NACHHER: ex.targetSets === undefined, ex.sets.length bleibt 2 (Ersatzquelle).
  // WARUM: state.js:704-719 löscht targetSets per `delete ex.targetSets` — ohne
  //   Test unbemerkt reversibel, falls der Block versehentlich entfernt/geändert wird.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v9_TargetSetsEntfernung.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  const ex = migrated.weeks[0].days[0].exercises[0];
  expect(ex.targetSets).toBeUndefined();
  expect(ex.sets.length).toBe(2);
});

test('v13 -> v14: ex.progressionType bekommt Default "weight"', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v13_ProgressionTypeDefault.v1.json (schemaVersion 13, kein progressionType).
  // WO prüfen: migrated.weeks[0].days[0].exercises[0].progressionType.
  // ERWARTUNG VORHER: progressionType fehlt komplett.
  // ERWARTUNG NACHHER: progressionType === 'weight' (state.js:766-771).
  // WARUM: einfachste additive Migration der Matrix — Referenzpunkt für die
  //   "ein Feld, ein Default"-Kategorie (v10/v11/v12/v18/v19/v20/v21/v26/v27
  //   folgen demselben Muster, hier stellvertretend geprüft).
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v13_ProgressionTypeDefault.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  expect(migrated.weeks[0].days[0].exercises[0].progressionType).toBe('weight');
});

test('v14 -> v15: 4-Wochen-Streak löst rückwirkend badge_4 aus', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v14_BadgeRueckwirkend.v1.json (schemaVersion 14,
  //   4 lückenlose 'completed'-Wochen 2024-01-01..01-22, kein badges-Array).
  // WO prüfen: migrated.badges.
  // ERWARTUNG VORHER: badges fehlt, kein Abzeichen vergeben.
  // ERWARTUNG NACHHER: badges enthält genau 'badge_4' (BADGE_THRESHOLDS,
  //   state.js:61-69), rückwirkend vergeben durch die v14->15-Migration
  //   (state.js:774-784) — NICHT durch _checkAndGrantBadges() (dessen
  //   automatisches Neu-Vergeben ist eingefroren, siehe DECISIONS.md
  //   "Badge-Granting eingefroren"; nur bereits vergebene Abzeichen bleiben
  //   sichtbar).
  // WARUM: die einzige Migration mit RÜCKWIRKENDER Berechnung aus der
  //   gesamten Wochenhistorie statt eines reinen Feld-Defaults — genau die
  //   Kategorie, die laut Diagnose am leichtesten unbemerkt bricht.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v14_BadgeRueckwirkend.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  expect(migrated.badges.some(b => b.id === 'badge_4')).toBe(true);
});

test('v22 -> v23: longestStreakEver wird aus der Historie berechnet', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v22_LongestStreakEver.v1.json (schemaVersion 22,
  //   6 lückenlose 'completed'-Wochen 2024-01-01..02-05, kein longestStreakEver).
  // WO prüfen: migrated.longestStreakEver.
  // ERWARTUNG VORHER: longestStreakEver fehlt.
  // ERWARTUNG NACHHER: longestStreakEver === 6 (state.js:849-854, _calcLongestStreakEver()).
  // WARUM: zweite rückwirkend-berechnete Migration (neben Badges) — beide
  //   hängen von derselben Wochenhistorie-Traversierung ab, aber über
  //   unterschiedliche Funktionen (_calcCurrentStreak vs. _calcLongestStreakEver);
  //   ein Bug in einer der beiden muss die andere nicht zwangsläufig treffen.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v22_LongestStreakEver.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  expect(migrated.longestStreakEver).toBe(6);
});

test('v24 -> v25 -> Always-apply: streakFreeze/surpriseLog werden hinzugefügt UND wieder entfernt', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v24_StreakFreezeLifecycle.v1.json (schemaVersion 24,
  //   noch KEIN streakFreeze/surpriseLog — echter Pre-v25-Zustand).
  // WO prüfen: migrated.streakFreeze, migrated.surpriseLog (Top-Level).
  // ERWARTUNG VORHER: beide Felder fehlen.
  // ERWARTUNG "ZWISCHENDURCH" (nicht direkt testbar, nur dokumentiert):
  //   v24->25-Block (state.js:862-872) fügt beide hinzu, migrate() setzt
  //   schemaVersion auf 25.
  // ERWARTUNG NACHHER (Ende von migrate()): beide Felder sind wieder WEG —
  //   der spätere, unconditional laufende "Always-apply, rein subtraktiv"-
  //   Block (state.js:1060-1066, Sprint "Framework-Audit Cleanup") löscht
  //   sie bei JEDEM migrate()-Aufruf, unabhängig von der Version.
  // WARUM: genau der von der Diagnose als Risiko benannte "Migrations-
  //   Zyklus" — ein Feld, das eine HISTORISCHE Migration einführt und eine
  //   SPÄTERE, versionslose Bereinigung wieder entfernt. Ohne diesen Test
  //   könnte jemand versehentlich die Lösch-Reihenfolge vor die Hinzufüge-
  //   Reihenfolge verschieben, ohne dass ein bestehender Test das bemerkt.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v24_StreakFreezeLifecycle.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  expect(migrated.streakFreeze).toBeUndefined();
  expect(migrated.surpriseLog).toBeUndefined();
});

test('v28 -> v29: bodyData.weightLog wird aus altem bodyData.weight abgeleitet', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v28_WeightLogAbleitung.v1.json (schemaVersion 28,
  //   Woche 1: bodyData.weight:82.5 (altes Feld); Woche 2: bodyData:{} (kein Gewicht)).
  // WO prüfen: migrated.weeks[0].bodyData.weightLog, migrated.weeks[1].bodyData.weightLog.
  // ERWARTUNG VORHER: weightLog fehlt in beiden Wochen.
  // ERWARTUNG NACHHER: Woche 1 hat weightLog === [{date: startDate, weight: 82.5}]
  //   (state.js:909-920, abgeleitet — kein reiner Default); Woche 2 hat
  //   weightLog === [] (kein altes Gewicht vorhanden, kein Datenverlust,
  //   aber auch keine erfundenen Werte).
  // WARUM: einzige Migration, die einen NEUEN Wert aus einem ANDEREN,
  //   bereits vorhandenen Feld ABLEITET statt nur einen Default zu setzen —
  //   höheres Risiko für stille Falschableitung als ein reiner Default.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v28_WeightLogAbleitung.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  expect(migrated.weeks[0].bodyData.weightLog).toEqual([{ date: '2024-01-01', weight: 82.5 }]);
  expect(migrated.weeks[1].bodyData.weightLog).toEqual([]);
});

test('v29 -> v30: metricStep-Default + bedingte progressionType-Umwandlung bei metric m/sec', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v29_MetricStepUndProgressionType.v1.json
  //   (schemaVersion 29, 3 Übungen: "Rudern" metric:'m'/progressionType:'weight',
  //   "Plank" metric:'sec'/progressionType:'weight', "Wandsitz" metric:'sec'/
  //   progressionType:'sets' — bereits bewusst vom Nutzer geändert).
  // WO prüfen: migrated.weeks[0].days[0].exercises[0..2].
  // ERWARTUNG VORHER: metricStep fehlt bei allen 3; progressionType bei
  //   "Rudern"/"Plank" auf dem bedeutungslosen Default 'weight'.
  // ERWARTUNG NACHHER: "Rudern".metricStep===50, "Plank"/"Wandsitz".metricStep===10
  //   (state.js:930-943); "Rudern"/"Plank".progressionType wird zu 'reps'
  //   umgewandelt; "Wandsitz".progressionType bleibt 'sets' (NICHT überschrieben,
  //   da bereits vom Nutzer bewusst gewählt — nur der unveränderte Default wird korrigiert).
  // WARUM: die BEDINGTE Umwandlung (nur bei unverändertem Default) ist die
  //   heikelste Stelle dieser Migration — ein zu aggressiver Fix würde
  //   bewusste Nutzerentscheidungen überschreiben (B18, siehe DECISIONS.md).
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v29_MetricStepUndProgressionType.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  const [rudern, plank, wandsitz] = migrated.weeks[0].days[0].exercises;
  expect(rudern.metricStep).toBe(50);
  expect(rudern.progressionType).toBe('reps');
  expect(plank.metricStep).toBe(10);
  expect(plank.progressionType).toBe('reps');
  expect(wandsitz.metricStep).toBe(10);
  expect(wandsitz.progressionType).toBe('sets');
});

test('v30 -> v31: Squat/Hinge-Übungen bekommen 5kg-Schrittweite, außer bereits angepasst', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v30_SquatHingeWeightStepBump.v1.json
  //   (schemaVersion 30, "Kniebeuge" ohne weightStep, "Kreuzheben" weightStep:2.5
  //   (unveränderter Default), "Frontkniebeuge" weightStep:1.25 (bewusst angepasst)).
  // WO prüfen: migrated.weeks[0].days[0].exercises[0..2].weightStep.
  // ERWARTUNG VORHER: Kniebeuge ohne Feld, Kreuzheben/Frontkniebeuge wie oben.
  // ERWARTUNG NACHHER: Kniebeuge.weightStep===5 (Squat-Kategorie, kein Wert vorher),
  //   Kreuzheben.weightStep===5 (Hinge-Kategorie, unveränderter 2.5-Default),
  //   Frontkniebeuge.weightStep===1.25 (Squat-Kategorie, aber NICHT überschrieben,
  //   da bereits abweichend vom Default — state.js:956-968, B65).
  // WARUM: wie beim progressionType-Test oben ist die Guard-Bedingung
  //   ("nur unveränderter Default wird angehoben") der eigentliche Risikopunkt —
  //   ein zu aggressiver Fix würde Frontkniebeuges bewusst gewählte 1.25kg überschreiben.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v30_SquatHingeWeightStepBump.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  const [kniebeuge, kreuzheben, frontkniebeuge] = migrated.weeks[0].days[0].exercises;
  expect(kniebeuge.weightStep).toBe(5);
  expect(kreuzheben.weightStep).toBe(5);
  expect(frontkniebeuge.weightStep).toBe(1.25);
});

test('v32 -> v33: skipReason/skipDate/nextWeekPlanAutoReviewed werden gebackfillt', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v32_SkipReasonBackfill.v1.json (schemaVersion 32,
  //   ex ohne skipReason/skipDate/nextWeekPlanAutoReviewed).
  // WO prüfen: migrated.weeks[0].days[0].exercises[0].
  // ERWARTUNG VORHER: alle 3 Felder fehlen.
  // ERWARTUNG NACHHER: skipReason===null, skipDate===null,
  //   nextWeekPlanAutoReviewed===true (state.js:985-993, B129 — echter
  //   Backfill für Bestandsübungen, nicht nur In-Memory-Default an
  //   Erstellungsstellen).
  // WARUM: letzte nummerierte Migration vor der aktuellen SCHEMA_VERSION —
  //   Grenzfall für "gerade noch nicht migriert".
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v32_SkipReasonBackfill.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);
  const ex = migrated.weeks[0].days[0].exercises[0];
  expect(ex.skipReason).toBeNull();
  expect(ex.skipDate).toBeNull();
  expect(ex.nextWeekPlanAutoReviewed).toBe(true);
});

test('v33 (aktuell) mit Legacy-Restmuell: alle Always-apply-Defaults + Subtraktion greifen unabhaengig von schemaVersion', async ({ page }) => {
  // WO importieren: TRAIN_Migration_v33_LegacyJunkAlwaysApplyDefaults.v1.json
  //   (schemaVersion bereits 33 — KEIN nummerierter Migrationsblock läuft mehr —
  //   aber: settings fehlen mehrere Always-apply-Felder, coachQuestion/
  //   substituteHistory/exerciseNotes/customAlternatives fehlen komplett,
  //   week.label/isSeedWeek fehlen, ex.setType:'pyramid' (Legacy-Name),
  //   ex.tags:[] bei erkanntem Übungsnamen "Kniebeuge", UND streakFreeze/
  //   surpriseLog sind als Restmüll noch vorhanden).
  // WO prüfen: diverse Felder, s.u.
  // ERWARTUNG VORHER: wie oben beschrieben — teils fehlend, teils veraltet, teils Restmüll.
  // ERWARTUNG NACHHER: alle Always-apply-Defaults gesetzt (state.js:996-1031),
  //   week.label==='' + isSeedWeek===false (state.js:1033-1036), setType
  //   'pyramid'->'manual' umbenannt (state.js:1039), tags per Muskelgruppen-
  //   Backfill befüllt (state.js:1052-1058), streakFreeze/surpriseLog trotz
  //   bereits aktueller schemaVersion gelöscht (state.js:1060-1066).
  // WARUM: diese Blöcke sind NICHT an eine schemaVersion-Prüfung gebunden —
  //   sie laufen bei JEDEM Laden, auch wenn ein Nutzer nie eine ältere
  //   Version hatte (z.B. nach manuellem JSON-Import mit Lücken). Die
  //   nummerierten Sprung-Tests oben würden diesen Pfad NICHT abdecken,
  //   da sie alle mit v<33 starten.
  const { migrated, pageErrors } = await loadAndMigrate(page, 'TRAIN_Migration_v33_LegacyJunkAlwaysApplyDefaults.v1.json');

  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
  expect(migrated.meta.schemaVersion).toBe(33);

  const s = migrated.settings;
  expect(s.vibrationEnabled).toBe(true);
  expect(s.rpeEnabled).toBe(true);
  expect(s.autoEval).toBe(false);
  expect(s.hideStopwatch).toBe(false);
  expect(s.largestPlate).toBe(25);
  expect(s.goal).toBeNull();
  expect(s.nutritionPhase).toBe('maintenance');

  expect(migrated.coachQuestion).toEqual({ weekStart: null, questionId: null, answer: null, outcome: null, measuredWeekStart: null });
  expect(migrated.coachQuestionHistory).toEqual([]);
  expect(migrated.coachPerformance).toEqual({ suggestions: [] });
  expect(migrated.substituteHistory).toEqual({});
  expect(migrated.exerciseNotes).toEqual({});
  expect(migrated.customAlternatives).toEqual({});

  const wk = migrated.weeks[0];
  expect(wk.label).toBe('');
  expect(wk.isSeedWeek).toBe(false);

  const ex = wk.days[0].exercises[0];
  expect(ex.setType).toBe('manual');
  expect(ex.tags).toEqual(['Quadrizeps', 'Gluteus']);

  expect(migrated.streakFreeze).toBeUndefined();
  expect(migrated.surpriseLog).toBeUndefined();
});
