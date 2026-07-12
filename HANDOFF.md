# TRAIN — Session Handoff
*Letzte Aktualisierung: Juli 2026 nach train-v159*
*Nächste Version: train-v160*

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v159 (v155 wurde nie vergeben, siehe vorherige
  Sprint-Notiz — Nummerierung folgt echten Code-Sprints, nicht der
  Sprint-Text-Nummerierung)
- CSS: ?v=184 (unverändert — v159 ist ein reiner JS-Fix, kein CSS)
- SCHEMA: 29
- Letzter Commit: siehe unten (B17 Fix)
- Alle 12 alten Test-Szenarien verifiziert ✓ + 5 Fixture-JSONs in
  tests/fixtures/ jetzt ECHT importiert und verifiziert (nicht mehr nur
  schema-validiert) — Ergebnisse in tests/fixtures/README.md, Kurzfassung
  unter NEXT unten
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
ui.js                   — B17-Fix: renderSetRow() unterdrückt "Vorwoche"-
                          Adopt-Hints für Ausweichübungen (prevSet=null
                          wenn ex.substituteFor gesetzt), prevEx selbst
                          für Fulfill-Meter-Guard unangetastet
styles.css              — B16-Fix: .btn-icon--kg touch-action:manipulation
                          (Doppeltipp-Zoom-Kollision), .num-input +
                          .ex-kg-picker-custom .num-input auf 16px
                          (Zoom-bei-Fokus)
index.html / sw.js       — CACHE_VERSION train-v158, CSS ?v=184
LOOPS.md                — NEU: 4 Session-Loops (3 aktiv, 1 inaktiv),
                          Push-Policy (Fix+Commit automatisch, Push mit
                          Bestätigung — Repo deployt direkt auf GitHub Pages)
SESSION_LOG.md          — NEU: leeres Protokoll, wird von Loops befüllt
CLAUDE.md               — SESSION START Sektion ergänzt (Reihenfolge:
                          Docs lesen → Loops ausführen → SESSION_LOG.md
                          → eigentliche Aufgabe). Eigener Versionsstand
                          war 2 Sprints lang veraltet, korrigiert
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
| LOOPS.md + SESSION_LOG.md | 18dab64 | 4 Session-Loops (Regressionstest, HANDOFF.md-Sync, Edge-Case-Audit, Bug-Diagnose-inaktiv), Push-Policy mit Bestätigungspflicht |
| SESSION START in CLAUDE.md | c838d5f | Neue Sektion + veraltete Versionsangaben (v154→v157) korrigiert |
| LOOP 2 Erweiterung | 5a9b935 | Prüft jetzt auch CLAUDE.md gegen sw.js/index.html, nicht nur HANDOFF.md |
| Loop-2-Autosync | 56bdba1 | HANDOFF.md GEÄNDERT-Tabelle + Letzter-Commit nachgezogen |
| B16 iOS-Zoom-Fix | e312751 | Diagnose korrigiert (2 unabhängige Ursachen statt 1) + beide behoben: touch-action:manipulation auf +kg/+Wdh-Button, font-size 16px auf allen Set-Inputs |
| Edge-Case-Audit | 3466751 | Alle 5 Fixtures echt importiert + verifiziert, B17 dabei erstmals genauer diagnostiziert (Diagnose später selbst nochmal korrigiert, siehe nächste Zeile) |
| B17 Fix | (dieser Sprint) | Eigene Fehldiagnose aus dem Edge-Case-Audit korrigiert ("positionsbasiert" war falsch — tatsächlich namensbasiert auf den falschen Namen, ex.substituteFor statt ex.name). Adopt-Hints in renderSetRow() unterdrückt wenn ex.substituteFor gesetzt ist, prevEx für Fulfill-Meter-Guard unangetastet gelassen. Re-verifiziert mit TRAIN_Test_HeuteAnders.v1.json. |

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
**Ab sofort: LOOPS.md beim Session-Start automatisch ausführen**
(Regressionstest → HANDOFF.md-Sync → Edge-Case-Audit, siehe LOOPS.md.
Push nach Loop-Fixes braucht einmal pro Session eine Bestätigung —
siehe Push-Policy in LOOPS.md.)

**Sprint v158: Edge-Case-Audit abgeschlossen** — alle 5 Fixtures echt
importiert und verifiziert (headless, per fetch der echten JSON-Dateien
aus tests/fixtures/, nicht neu abgetippt). Details in
tests/fixtures/README.md. Kurzfassung:
- Alle 5: 0 uncaught errors, kein Crash
- iOS_Zoom: B16 in v158 behoben, Fixture bestätigt fehlerfreies Laden
- HeuteAnders: **B17 präzisiert** — der "Vorwoche"-Hint-Button ist
  positions- statt namensbasiert und zeigt Werte der ALTEN Übung für
  die neue Ausweichübung. Feld selbst ist korrekt leer. Noch nicht
  gefixt, nur genauer diagnostiziert.
- EdgeCase_LeerWoche: kein Crash, "Übung hinzufügen"-Button statt
  dediziertem Empty-State-Text — funktional ok, nur anders als erwartet
- EdgeCase_AllesFail: Coach zeigt korrekt Schlaf-Overload statt
  Progression — Achtung, Fixture hat Schlaf UND Fail-Sätze gleichzeitig
  als Störfaktoren, keine isolierte Prüfung der Fail-Sätze-Reaktion
- EdgeCase_MaxGewicht: 1RM-Berechnung korrekt (~550kg via Epley), kein
  Overflow

**B17 behoben in train-v159** (siehe BUGS.md) — Korrektur einer eigenen
Fehldiagnose aus dem Edge-Case-Audit inklusive (dort stand fälschlich
"positionsbasiert", tatsächlich war es namensbasiert auf den falschen
Namen). tests/fixtures/README.md entsprechend nachgezogen.

**Nächster Schritt:** eine schärfere AllesFail-Variante ohne
Schlaf-Störfaktor bauen (isoliert die Coach-Reaktion auf reine
Fail-Sätze), ODER Loop 3 weitere Edge-Cases ergänzen lassen (aktuell 5
von 15 angestrebten).

**Offene Nebenfunde aus diesem Sprint (nicht behoben, nur notiert):**
- Push/Pull-Ratio-Block in _renderMovementPattern() (ui.js, unterhalb der
  Kategorie-Balken) zählt weiterhin nur success-Sätze, nicht success+fail
  — war nicht Teil von B22, potenzieller Folge-Fix
- movementMap.js-Grenzfälle geprüft, bewusst NICHT geändert (Agent-3-Review):
  Ausfallschritte/Lunges (Squat), Box Jumps (Squat) vs. Broad Jumps (Core),
  Wadenheben/Calf Raise (Hinge), KB Turkish Get-Up/Windmill (Hinge),
  Front/Lateral Raise (Pull), Battle Ropes/Burpees (Core) — jeweils
  vertretbare Konvention, keine eindeutigen Fehler

**B16 (iOS Doppelklick-Zoom) behoben in train-v158** — siehe BUGS.md für
die korrigierte Diagnose (zwei unabhängige Ursachen, nicht eine) und
beide Fixes. Touch-Verhalten selbst noch nicht auf echtem Gerät
verifiziert (headless kann das nicht) — bei Gelegenheit zusammen mit
dem noch offenen dragdrop.js-Touch-Check (train-v156) auf einem echten
iOS/Android-Gerät testen: Picker per Doppeltipp öffnen (kein Zoom?),
Gewicht-Feld antippen (kein Zoom?).

Kein UX-Hoch-Bug mehr offen in BUGS.md — Loop 3 (Edge-Case-Audit) ist
damit ab der nächsten Session nicht mehr blockiert.

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
