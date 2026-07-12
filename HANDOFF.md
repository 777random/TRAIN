# TRAIN — Session Handoff
*Letzte Aktualisierung: Juli 2026 nach train-v156*
*Nächste Version: train-v157*

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v156 (v155 wurde nie vergeben — die Zwischensession
  war reine Doku/Diagnose: AGENTS.md-Erstellung + dragdrop.js/
  recommendationEngine.js-Diagnose, keine Code-Änderung, daher kein
  Versions-Bump)
- CSS: ?v=182 (?v=181 aus demselben Grund übersprungen)
- SCHEMA: 29
- Letzter Commit: a3752f8 (dragdrop.js verdrahtet + recommendationEngine.js entfernt)
- Alle 12 Test-Szenarien verifiziert ✓ (aus früheren Sprints — dieser
  Sprint hat keine neuen Test-JSONs erzeugt, siehe NEXT)
- Regressions-Test: 10/10 grün (raf=sync), 0 uncaught errors
- Touch-Drag-Verhalten NICHT auf echtem Gerät/Emulator verifiziert —
  headless kann Touch-Events nicht auslösen (siehe Abschnitt unten)
- Framework-Score: 11/11

---

## FILES (zuletzt angefasst)
```
index.html             — dragdrop.js Touch-Polyfill verdrahtet (Script-Tag +
                          MobileDragDrop.polyfill() vor dem Module-Script),
                          alter No-Op-touchmove-Listener zusammengeführt,
                          CSS-Version → ?v=182
sw.js                   — recommendationEngine.js aus Precache entfernt,
                          dragdrop.js zu Precache hinzugefügt (jetzt
                          ladungsrelevant), CACHE_VERSION → train-v156
recommendationEngine.js — GELÖSCHT (ungenutzt, Inhalt redundant zu
                          insightEngine.js — siehe BUGS.md)
AGENTS.md               — recommendationEngine.js aus Abhängigkeitsmatrix
                          entfernt, dragdrop.js-Einträge aktualisiert
ui.js                   — _nextGoalText() Live-Hinweis success+fail-Filter (8686458)
consistencyUtils.js     — _weekConsistencyRatio() off-by-one fix (ab33633)
weekReview.js           — _reachableDays() future-days fix (66c034d)
weeklyFocus.js          — REENTRY_WINDOW_DAYS 14→7, Plateau vor PrePlateau (f1d4f54)
state.js                — Wochenerstellung isSeedWeek-Skip, Auto-Eval Guard (f1d4f54)
movementMap.js          — +32 englische Synonyme (8143086)
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
**Parallel-Sprint v157: Erfolgsquote-Vereinheitlichung + Beinbeuger-Kategorie
+ tests/fixtures/**
- Erfolgsquote: mind. 3 verschiedene Formeln im UI (_weekSuccessScore,
  _getDayCompletionStats, _renderMovementPattern) — Vereinheitlichung
  oder zumindest saubere Doku der 3 Semantiken prüfen
- movementMap.js: "Beinbeuger" steht unter Squat statt Hinge — fachlich
  prüfen ob Umkategorisierung sinnvoll ist
- Test-JSONs aus "01 Privat/TRAIN/Testing - Simulation/" nach
  tests/fixtures/ ins Repo übernehmen (aktuell nicht git-getrackt)
- Vor Start: AGENTS.md-Matrix konsultieren, ob diese drei Teilaufgaben
  wirklich parallelisierbar sind (unterschiedliche Dateien, keine
  gemeinsame Import-Kante) oder ob z.B. die Erfolgsquote-Aufgabe ui.js
  anfasst und damit NICHT parallel zu anderen ui.js-Arbeiten laufen darf

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
