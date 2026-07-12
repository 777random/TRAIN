# TRAIN — Session Handoff
*Letzte Aktualisierung: Juli 2026 nach train-v154*
*Nächste Version: train-v155*

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v154
- CSS: ?v=180
- SCHEMA: 29
- Letzter Commit: 8686458 (ui.js:1183 Live-Hinweis success+fail-Fix)
- Alle 12 Test-Szenarien verifiziert ✓
- Regressions-Test: 10/10 grün (raf=sync), 0 uncaught errors
- Framework-Score: 11/11

---

## FILES (zuletzt angefasst)
```
ui.js                 — _nextGoalText() Live-Hinweis success+fail-Filter (8686458)
consistencyUtils.js   — _weekConsistencyRatio() off-by-one fix (ab33633)
weekReview.js         — _reachableDays() future-days fix (66c034d)
weeklyFocus.js        — REENTRY_WINDOW_DAYS 14→7, Plateau vor PrePlateau (f1d4f54)
state.js              — Wochenerstellung isSeedWeek-Skip, Auto-Eval Guard (f1d4f54)
movementMap.js        — +32 englische Synonyme (8143086)
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
**Sprint v155: iOS Doppelklick-Zoom beim Picker (B16)**
- font-size < 16px in Picker-Feldern → Browser-Zoom bei Doppeltipp
- Fix: touch-action:manipulation oder font-size ≥ 16px auf betroffenen Inputs
- Siehe BUGS.md B16 für Details
