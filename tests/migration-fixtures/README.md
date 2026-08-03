# Migrations-Test-Fixtures

Synthetische, historisch alte `state.js`-Speicherstände (nach dem Muster
von `tests/fixtures/`, aber gezielt für `migrate()` statt für allgemeine
Feature-Edge-Cases). Jede Datei repräsentiert einen Zustand kurz VOR einem
bestimmten `schemaVersion`-Sprung — beim Laden durchläuft `migrate()`
automatisch die GESAMTE restliche Kaskade bis `SCHEMA_VERSION` (aktuell 33).

Getestet von `tests/migration_matrix.spec.js`. Anders als
`tests/fixtures.spec.js` (nur "0 uncaught errors") prüft dieser Spec gezielt
die RESULTIERENDE Datenstruktur nach der Migration.

## Namenskonvention

`TRAIN_Migration_v{N}_{Beschreibung}.v1.json` — `N` ist die
`meta.schemaVersion`, die die Fixture VOR dem Laden hat (der Sprung, der
getestet wird, ist `N -> N+1` bzw. `N -> nächster benannter Sprung`).

## Aktuelle Szenarien (Stand 2026-08-03, Migrations-Audit-Auftrag 1)

| Datei | schemaVersion | Getesteter Sprung | WARUM diese Version gewählt |
|-------|---------------|--------------------|------------------------------|
| TRAIN_Migration_v0_VollDurchlauf.v1.json | (kein `meta`) | v0 -> v33, komplette Kaskade | Härtester Einzeltest — keine Version wird übersprungen. Ältester denkbarer Speicherstand: kein `meta`, keine `settings`, kein `customTemplate`. |
| TRAIN_Migration_v9_TargetSetsEntfernung.v1.json | 9 | v9 -> v10: `ex.targetSets` wird gelöscht | Einzige rein SUBTRAKTIVE nummerierte Migration — Datenverlust-Risiko, falls der Block je entfernt/geändert wird. |
| TRAIN_Migration_v13_ProgressionTypeDefault.v1.json | 13 | v13 -> v14: `ex.progressionType` Default `'weight'` | Referenzfall für die häufigste Kategorie ("ein Feld, ein Default") — steht stellvertretend für v10/v11/v12/v18/v19/v20/v21/v26/v27. |
| TRAIN_Migration_v14_BadgeRueckwirkend.v1.json | 14 | v14 -> v15: rückwirkende Badge-Vergabe aus Streak | Einzige Migration mit RÜCKWIRKENDER Berechnung aus der gesamten Wochenhistorie statt eines reinen Feld-Defaults. |
| TRAIN_Migration_v22_LongestStreakEver.v1.json | 22 | v22 -> v23: `longestStreakEver` aus Historie berechnet | Zweite historie-berechnete Migration, andere Funktion (`_calcLongestStreakEver` statt `_calcCurrentStreak`) — ein Bug in einer trifft nicht zwangsläufig die andere. |
| TRAIN_Migration_v24_StreakFreezeLifecycle.v1.json | 24 | v24 -> v25 (Zugabe) -> Always-apply (Entfernung) | Von der Diagnose explizit als Risiko benannter "Migrations-Zyklus": ein Feld, das eine historische Migration einführt und ein späterer, versionsloser Cleanup-Block wieder entfernt. |
| TRAIN_Migration_v28_WeightLogAbleitung.v1.json | 28 | v28 -> v29: `bodyData.weightLog` aus `bodyData.weight` abgeleitet | Einzige Migration, die einen Wert aus einem ANDEREN Feld ableitet statt nur einen Default zu setzen — testet sowohl den Ableitungsfall als auch den Leer-Fall (2 Wochen). |
| TRAIN_Migration_v29_MetricStepUndProgressionType.v1.json | 29 | v29 -> v30: `metricStep`-Default + bedingte `progressionType`-Umwandlung | Heikelste Guard-Bedingung der Matrix (B18) — testet 3 Übungen, davon eine mit bereits bewusst vom Nutzer geändertem Feld, das NICHT überschrieben werden darf. |
| TRAIN_Migration_v30_SquatHingeWeightStepBump.v1.json | 30 | v30 -> v31: Squat/Hinge `weightStep`-Bump (B65) | Gleiche Guard-Kategorie wie oben, andere Migration — testet fehlenden Wert, unveränderten Default UND bereits individuell angepassten Wert (darf nicht überschrieben werden). |
| TRAIN_Migration_v32_SkipReasonBackfill.v1.json | 32 | v32 -> v33: `skipReason`/`skipDate`/`nextWeekPlanAutoReviewed`-Backfill (B129) | Letzte nummerierte Migration vor der aktuellen `SCHEMA_VERSION` — Grenzfall "gerade noch nicht migriert". |
| TRAIN_Migration_v33_LegacyJunkAlwaysApplyDefaults.v1.json | 33 (aktuell) | Always-apply-Defaults + Subtraktion, UNABHÄNGIG von schemaVersion | Deckt den Pfad ab, den die nummerierten Sprung-Tests NICHT abdecken können: Always-apply-Blöcke (state.js:996-1066) laufen bei JEDEM Laden, auch bei bereits aktueller schemaVersion (z.B. nach lückenhaftem manuellem JSON-Import). |

## Bekannte Konstruktionsregeln (analog zu `tests/fixtures/README.md`)

- Jede Fixture enthält nur die Felder, die kumulativ bis zur eigenen
  `schemaVersion` bereits existiert hätten — alles danach wird bewusst
  weggelassen, damit die Migration es sichtbar (nach)liefert. Ausnahme:
  Always-apply-Felder (settings.vibrationEnabled etc., coachQuestion,
  week.label, …) — diese sind NICHT an eine Versionsprüfung gebunden und
  werden bei jedem `migrate()`-Aufruf ohnehin (re-)ergänzt, daher in den
  meisten Fixtures ausgelassen (Ausnahme: die v33-Fixture testet genau
  diesen Pfad gezielt).
- Wochen-Startdaten liegen bewusst in der Vergangenheit (2024), damit
  streak-/datumsabhängige Berechnungen (`_calcCurrentStreak`,
  `_calcLongestStreakEver`) unabhängig vom tatsächlichen Testlauf-Datum
  stabil bleiben (das 7-Tage-Fenster der jeweils letzten Woche ist so immer
  sicher abgelaufen).
- Übungsnamen ("Kniebeuge", "Kreuzheben", "Frontkniebeuge") sind bewusst aus
  `movementMap.js` (MOVEMENT_MAP/MUSCLE_GROUP_MAP) gewählt, damit
  Kategorie-Auflösung (Squat/Hinge) und Muskelgruppen-Backfill in den
  Fixtures, die das prüfen, tatsächlich greifen.
- `migrate()` selbst ist nicht exportiert — Verifikation läuft ausschließlich
  über den echten Browser-Loadpfad (`localStorage` -> Reload -> `loadState()`),
  wie bei `tests/fixtures.spec.js`.
