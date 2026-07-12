# TRAIN — Session Handoff
*Letzte Aktualisierung: Juli 2026 nach train-v157*
*Nächste Version: train-v158*

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v157 (v155 wurde nie vergeben, siehe vorherige
  Sprint-Notiz — Nummerierung folgt echten Code-Sprints, nicht der
  Sprint-Text-Nummerierung)
- CSS: ?v=183
- SCHEMA: 29
- Letzter Commit: e0b0f01 (Erfolgsquote vereinheitlicht, Beinbeuger→Hinge,
  tests/fixtures/ angelegt)
- Alle 12 alten Test-Szenarien verifiziert ✓ + 5 neue Fixture-JSONs in
  tests/fixtures/ (siehe unten) — diese sind neu, noch nicht real
  gegen die App durchgetestet, nur schema-validiert
- Regressions-Test: 10/10 grün (raf=sync), 0 uncaught errors
- Touch-Drag-Verhalten (dragdrop.js, v156) weiterhin NICHT auf echtem
  Gerät verifiziert (siehe Sprint v156 unten)
- Framework-Score: 11/11
- **Erster echter Multi-Agent-Sprint dieser Session:** 3 parallele
  Fork-Agents (ui.js / movementMap.js / tests/fixtures/, disjunkt lt.
  AGENTS.md-Matrix) + 1 Konsolidierungs-Durchgang. Keine Kollision
  aufgetreten — Details in AGENTS.md "Bewährte Parallel-Muster".

---

## FILES (zuletzt angefasst)
```
ui.js                   — _getDayCompletionStats() + _renderMovementPattern():
                          Erfolgsquote auf success/(success+fail) vereinheitlicht,
                          pending ausgeschlossen (B22). _weekSuccessScore()
                          bewusst unverändert (war bereits korrekt)
movementMap.js           — 'Beinbeuger'/'Leg Curl'/'Leg Curls'/'Hamstring Curl'
                          Squat→Hinge, 'Butterfly' Pull→Push (B23)
tests/fixtures/          — NEU: README.md + 5 Test-JSON-Fixtures
                          (iOS_Zoom, HeuteAnders, EdgeCase_LeerWoche,
                          EdgeCase_AllesFail, EdgeCase_MaxGewicht)
AGENTS.md                — erster echter Multi-Agent-Sprint dokumentiert
                          (Bewährtes Muster + Matrix-Nuance movementMap.js+ui.js)
index.html              — dragdrop.js Touch-Polyfill verdrahtet (Script-Tag +
                          MobileDragDrop.polyfill() vor dem Module-Script),
                          alter No-Op-touchmove-Listener zusammengeführt
sw.js                   — recommendationEngine.js aus Precache entfernt,
                          dragdrop.js zu Precache hinzugefügt (jetzt
                          ladungsrelevant)
recommendationEngine.js — GELÖSCHT (ungenutzt, Inhalt redundant zu
                          insightEngine.js — siehe BUGS.md)
consistencyUtils.js     — _weekConsistencyRatio() off-by-one fix (ab33633)
weekReview.js           — _reachableDays() future-days fix (66c034d)
weeklyFocus.js          — REENTRY_WINDOW_DAYS 14→7, Plateau vor PrePlateau (f1d4f54)
state.js                — Wochenerstellung isSeedWeek-Skip, Auto-Eval Guard (f1d4f54)
```

---

## GEÄNDERT (diese Session)

| Sprint | Commit | Was |
|--------|--------|-----|
| Framework 11/11 | 08db05a | isFullSuccess, onTrack-Directive, RPE-Doku |
| 3 neue Coach-Signale | 9a846e1 | Deload/Konsistenz-Qualität/Push-Pull + consistencyUtils.js |
| Coach-Tab Architektur | 7a16aec | Akut/Strukturell getrennt, Plateau vor PrePlateau |
| movementMap +32 | 8143086 | Englische Synonyme |
| Gamification Cleanup | ba26b55 | surpriseRewards/Freeze/Flammen entfernt, Badges eingefroren |
| Kategorie-1-Bugfixes | f1d4f54 | 8 Bugs behoben (siehe BUGS.md) |
| Future Days Fix | 66c034d | _reachableDays < statt <=, Stepper-Scroll |
| ConsistencyRatio Fix | ab33633 | _weekConsistencyRatio < statt <= |
| Live-Hinweis Fix | 8686458 | _nextGoalText success+fail statt nur success (B08) |
| Dragdrop verdrahtet + Cleanup | a3752f8 | dragdrop.js Touch-Polyfill aktiviert (B24), recommendationEngine.js entfernt |
| Parallel-Sprint: Erfolgsquote + Beinbeuger + Fixtures | e0b0f01 | B22 (Erfolgsquote), B23 (Beinbeuger→Hinge + Butterfly→Push), tests/fixtures/ neu — erster echter 3-Agent-Parallel-Sprint |

---

## ENTSCHEIDUNGEN (diese Session → siehe DECISIONS.md für vollständige Liste)
- isFullSuccess() NICHT in _scoreWeek()/_weekTrainingStatus() — misst Anwesenheit, nicht Zielerreichung
- Abzeichen eingefroren, nicht entfernt — historische Daten erhalten
- Strukturkarte max. 2 Signale (deload > consistency_quality > push_pull)
- Plateau hat Vorrang vor PrePlateau in Kaskade (stärkerer Befund gewinnt)

---

## GESCHEITERT / FALLSTRICKE
- Test-JSONs mit weight=0 → _checkRisingRpe überspringt Übung (Guard weights.some(w=>w===0))
- Test-JSONs mit lastReentryHandled gesetzt → _checkReentry feuert immer (Prio 1, Date.now())
- _checkConsistencyQuality: reps<targetReps reicht nicht — braucht echte fail-Sätze (_scoreWeek nutzt kein isFullSuccess)
- _checkPushPullBalance: >7 Wochen → präventiver Deload verdrängt Push/Pull (Prio-Problem)
- Stepper-Scroll: kein scrollIntoView() im Code — war Layout-Reflow-Artefakt, fix via scrollTop-Restore
- curPct < 0.7 wäre totes Code (Scale 0-100, nicht 0-1) — Claude Code hat das selbst erkannt

---

## NEXT (konkret nächster Schritt)
**Sprint v158: Edge-Case-Audit mit den neuen Fixture-JSONs**
- Die 5 neuen Dateien in tests/fixtures/ sind bisher nur schema-validiert
  (valides JSON, korrekter State-Shape), NICHT real gegen die laufende
  App importiert/getestet. Nächster Schritt: jede Datei einmal über
  Settings → JSON importieren einspielen und die in
  tests/fixtures/README.md dokumentierte Erwartung verifizieren:
  - TRAIN_Test_iOS_Zoom.v1.json → hängt an offenem B16 (Zoom-Bug)
  - TRAIN_Test_HeuteAnders.v1.json → hängt an offenem B17
  - TRAIN_Test_EdgeCase_LeerWoche.v1.json → kein Crash, Empty-State
  - TRAIN_Test_EdgeCase_AllesFail.v1.json → Coach-Reaktion prüfen (sollte
    kein "Steigerung sinnvoll" zeigen)
  - TRAIN_Test_EdgeCase_MaxGewicht.v1.json → kein NaN/Overflow bei 1RM

**Offene Nebenfunde aus diesem Sprint (nicht behoben, nur notiert):**
- Push/Pull-Ratio-Block in _renderMovementPattern() (ui.js, unterhalb der
  Kategorie-Balken) zählt weiterhin nur success-Sätze, nicht success+fail
  — war nicht Teil von B22, potenzieller Folge-Fix
- movementMap.js-Grenzfälle geprüft, bewusst NICHT geändert (Agent-3-Review):
  Ausfallschritte/Lunges (Squat), Box Jumps (Squat) vs. Broad Jumps (Core),
  Wadenheben/Calf Raise (Hinge), KB Turkish Get-Up/Windmill (Hinge),
  Front/Lateral Raise (Pull), Battle Ropes/Burpees (Core) — jeweils
  vertretbare Konvention, keine eindeutigen Fehler

**Danach: iOS Doppelklick-Zoom beim Picker (B16)** — font-size < 16px in
Picker-Feldern → Browser-Zoom bei Doppeltipp. Fix: touch-action:manipulation
oder font-size ≥ 16px auf betroffenen Inputs. Siehe BUGS.md B16.

## VERIFIKATIONS-STATUS TOUCH-DRAG (train-v156, WICHTIG für nächste Session)

**Verifiziert (headless, diese Session):**
- Regressionstest 10/10 grün, 0 uncaught errors
- index.html lädt headless fehlerfrei durch (kein "Uncaught" im Chrome-
  Log, `#app` erreicht Klasse `is-ready`, `#splash` wird korrekt entfernt)
- dragdrop.js wird als klassisches Script vor dem Module-Script geladen
  und wirft dabei keinen Fehler

**NICHT verifiziert (headless kann keine echten Touch-Events auslösen):**
- Ob `MobileDragDrop.polyfill()` auf einem echten Touch-Gerät tatsächlich
  greift und das Drag-Reorder von Übungen funktioniert
- Ob `holdToDrag: 400` sich richtig anfühlt (nicht zu kurz → Konflikt mit
  Scrollen; nicht zu lang → Drag fühlt sich träge an)
- Ob der neue `touchmove`-Listener (nur `preventDefault()` während
  `_dragActive`) das Scroll-Verhalten außerhalb eines Drags unverändert
  lässt — das war genau der Bug in der Sprint-Vorlage (dort hätte ein
  bedingungsloses `preventDefault()` jegliches Scrollen permanent
  blockiert; hier stattdessen an dragstart/dragend/drop gekoppelt)
- Ob `forceApply: false` auf dem Zielgerät korrekt entscheidet (Polyfill
  nur wo natives Touch-DnD fehlt)

→ Vor dem nächsten Sprint: einmal auf echtem iOS/Android-Gerät oder in
Chrome DevTools Mobile-Emulation (Device Toolbar, nicht nur Viewport-
Resize — braucht echte Touch-Event-Simulation) eine Übung per Drag
neu anordnen und dabei normales Scrollen der Seite testen.
