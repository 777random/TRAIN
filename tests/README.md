# TRAIN — tests/ (ältere Test-JSONs)

Dieser Ordner enthält:
- `regression_core.html` — die 10-Punkte-Kernregression (siehe CLAUDE.md,
  läuft nach jedem Sprint headless in Chrome)
- `fixtures/` — die 15 neueren Edge-Case-Fixtures (v157-v160), bereits
  echt importiert/verifiziert, siehe `fixtures/README.md`
- **26 ältere Test-JSONs direkt in diesem Ordner** (Namensschema
  `TRAIN_Test_[A-D/vNNN]_[Beschreibung].json`) — historisch extern
  gepflegt, jetzt ins Repo übernommen. Diese Datei dokumentiert deren
  Status, validiert am 2026-07-12 (train-v161).
- `Alt/` — ältere Versionsstände einzelner Szenarien (z.B. frühere
  `.v2.json`/`.v3.json`-Iterationen), nicht Teil dieser Validierung
- `Testergebnisse.docx`, `TRAIN_Testplan.xlsx`, `TRAIN_Fixes_*.zip`,
  `TRAIN_Testszenarien.zip` — begleitende Dokumente/Archive, kein
  Testcode, nicht Teil dieser Validierung

## Validierungsmethode

Jede Datei wurde headless (Chrome `--dump-dom`) echt importiert (nicht
nur `JSON.parse()`-Syntax-Check): `localStorage` gesetzt, `loadState()`
+ `mountApp()` + Wechsel auf Coach- und Fortschritt-Tab, dann geprüft:
uncaught errors, `NaN`/`Infinity` im gerenderten HTML, Fetch/Parse/
Mount-Fehler.

## Ergebnis: 26 von 26 — alle ✓ läuft, keine veraltet, keine Bugs gefunden

Alle 26 Dateien enthalten bereits `meta.schemaVersion: 29` (aktuelle
Version) — obwohl viele Dateinamen ältere Sprint-Versionen referenzieren
(v146, v147, v148, v151), wurden die Dateien offenbar zwischenzeitlich
mit dem aktuellen Schema neu exportiert. Keine Datei fällt unter die
"veraltet (Schema < 29)"-Kategorie.

| Datei | Was getestet wird | Status |
|-------|--------------------|--------|
| TRAIN_Test_A1_Progression_HIGH.json | Progressions-Signal mit hoher Konfidenz | ✓ läuft |
| TRAIN_Test_A2_Plateau.json | Plateau-Erkennung (Hauptkarte) | ✓ läuft |
| TRAIN_Test_A3_PrePlateau.json | Pre-Plateau-Antizipation | ✓ läuft |
| TRAIN_Test_A4_Ueberlastung_RPE.json | Overload-Signal via RPE-Trend | ✓ läuft |
| TRAIN_Test_A5_Ueberlastung_Schlaf_Energie.json | Overload-Signal via Schlaf/Energie | ✓ läuft |
| TRAIN_Test_A6_OnTrack_FruehPhase.json | onTrack-Fallback in früher Phase (wenig Datenhistorie) | ✓ läuft |
| TRAIN_Test_B1_Frage_PrePlateau.json | Adaptive Nachfrage-Karte bei PrePlateau | ✓ läuft |
| TRAIN_Test_B2_Frage_Progression_MEDIUM.json | Adaptive Nachfrage bei Progression, Konfidenz MEDIUM | ✓ läuft |
| TRAIN_Test_B3_Konfidenz_Signal.json | Konfidenz-Badge-Anzeige (HIGH/MEDIUM/LOW) | ✓ läuft |
| TRAIN_Test_C1_CoachBilanz_5plus.json | Coach-Bilanz ab ≥5 gemessenen Fällen | ✓ läuft |
| TRAIN_Test_C2_CoachBilanz_unter_Schwelle.json | Coach-Bilanz unterhalb Mindestanzahl (sollte ausgeblendet bleiben) | ✓ läuft |
| TRAIN_Test_D1_AutoBackup_Wochenwechsel.json | Automatischer Backup-Export beim Wochenwechsel | ✓ läuft |
| TRAIN_Test_v146_Fix1a_isFullSuccess.v1.json | isFullSuccess()-Einführung (Framework-Sprint v146) | ✓ läuft |
| TRAIN_Test_v146_Fix3_onTrack_Directive.v1.json | onTrack-Formulierungs-Fix (v146) | ✓ läuft |
| TRAIN_Test_v147_Signal1_PraeventivDeload.v1.json | Präventives Deload-Signal (Strukturkarte, v147) | ✓ läuft |
| TRAIN_Test_v147_Signal2_KonsistenzQualitaet.v3.json | Konsistenz-Qualitäts-Signal (Strukturkarte, v147) | ✓ läuft |
| TRAIN_Test_v147_Signal3_PushPullBalance.v3.json | Push/Pull-Balance-Signal (Strukturkarte, v147) | ✓ läuft |
| TRAIN_Test_v148_AC10_Overload_Completion.v1.json | Overload via sinkende Erfolgsquote (Coach-Architektur v148) | ✓ läuft |
| TRAIN_Test_v148_AC12_Strukturkarte_neben_Progression.v1.json | Strukturkarte erscheint parallel zu Progression | ✓ läuft |
| TRAIN_Test_v148_AC12_Strukturkarte_neben_Progression.v2.json | Dito, zweite Iteration | ✓ läuft |
| TRAIN_Test_v148_AC5_Plateau_vor_PrePlateau.v1.json | Plateau-Priorität vor PrePlateau (v148) | ✓ läuft |
| TRAIN_Test_v148_AC8_Overload_Schlaf.v1.json | Overload via Schlaf (v148) | ✓ läuft |
| TRAIN_Test_v151_Fix3_FutureDays.v1.json | Future-Days-Off-by-one-Fix (B03, v151) | ✓ läuft |
| TRAIN_Test_v151_Fix4_Zeitbezug.v1.json | Zeitbezug-Clamping-Fix (B04, v151) | ✓ läuft |
| TRAIN_Test_v151_Fix6_Prognose_Deadlift.v1.json | Prognose-Chart-Fix für Deadlift (v151) | ✓ läuft |
| TRAIN_Test_v151_Fix7_8_FulfillFail.v1.json | Fulfill-Meter Fail-Sätze-Fix (B05, v151) | ✓ läuft |

## Neue Bugs aus dieser Validierung

Keine — alle 26 Dateien laufen fehlerfrei mit dem aktuellen Code-Stand
(train-v161). Kein neuer BUGS.md-Eintrag nötig.
