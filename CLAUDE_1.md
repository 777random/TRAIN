# TRAIN — CLAUDE.md
# Vollständiger Projektkontext für Claude Code
# Stand: train-v154 / SCHEMA 29 / Juli 2026
# Letztes Update: nach train-v154 Sprint

---

## PROJEKT-ÜBERSICHT

**TRAIN** ist eine Vanilla JS PWA (kein Framework, kein Build-Step, ES Modules, lokal-first).
- Repo: https://github.com/777random/TRAIN
- Deployed: https://777random.github.io/TRAIN/
- Aktueller Stand: SCHEMA_VERSION 29 · CACHE_VERSION train-v154 · CSS ?v=180

**Nordstern:** "Decision Support für Krafttraining — nicht Workout-Tracker."
**Zielgruppe:** Ernsthafte Kraftsportler 3–5x/Woche, intermediate+, ohne Personal Trainer.
**Kernfrage jedes Features:** "Reduziert dieses Feature die Unsicherheit des Athleten bei seiner nächsten Trainingsentscheidung?"

---

## ARBEITSREGELN (PFLICHT — bei jedem Sprint einhalten)

### Vor jedem Sprint:
```
git add -A && git commit -m "chore: pre-sprint checkpoint"
git push origin main
```

### Nach jedem Sprint:
```
git add -A && git commit -m "fix/feat: [beschreibung] (vXXX->vYYY)"
git push origin main
```

### Versions-Increment:
- Jede JS/CSS-Änderung: CACHE_VERSION erhöhen (train-v153 → train-v154)
- CSS-Datei: `?v=179` → `?v=180` in index.html
- SCHEMA_VERSION nur bei Datenmodell-Änderungen erhöhen

### Regressions-Test:
Nach JEDEM Sprint: `tests/regression_core.html` in headless Chrome ausführen.
Erwartung: 10/10 grün, 0 uncaught errors.
Bekannte Limitierung: Test 8 schlägt im Headless-Modus konsistent fehl (rAF-Timing) — akzeptiert.

### Vor jedem konzeptionell neuen Feature — zwei Pflichtfragen:
1. "Reduziert dieses Feature die Unsicherheit des Athleten bei seiner nächsten Trainingsentscheidung?"
2. "Für wen genau löst das ein Problem — für den ernsthaften Athleten der 3–5x/Woche trainiert, oder für jemand anderen?"
Wenn unklar: erst diskutieren, dann spezifizieren.

### Test-JSONs:
- Immer als downloadbare Dateien mit Versionssuffix (`.v1`, `.v2` etc.)
- Format: `TRAIN_Test_vXXX_Beschreibung.v1.json`
- Bei jedem Test explizit angeben:
  - WO importieren
  - WO prüfen (Tab + Sektion)
  - ERWARTUNG VORHER (falsches Verhalten)
  - ERWARTUNG NACHHER (korrektes Verhalten)
  - WARUM diese Daten

### Diagnose vor Fixes:
Bei unklarem Root Cause immer erst Diagnose → Ergebnis abwarten → dann Fix spezifizieren.
Niemals raten wenn Code-Realität unbekannt.

### Chrome-Prozesse:
Beim Testen: nur headless Chrome starten und beenden. Bestehende Chrome-Fenster des Users NICHT beenden.

---

## ARCHITEKTUR

### Tech Stack:
- Vanilla JS, ES Modules, kein Build-Step, kein Framework
- localStorage-Persistenz (Shadow-Key + Schema-Versioning)
- Service Worker: user-gated Update-Mechanismus (skipWaiting nur auf Nutzer-Aktion)
- PWA, lokal-first, kein Backend, kein Login

### Key Files:
```
state.js          — State-Management, Reducer, Migration
ui.js             — Rendering, Event-Handler (größte Datei)
weeklyFocus.js    — Coach-Logik, Kaskade, computeWeeklyFocus()
plateauDetector.js — Plateau-Erkennung
weightRecommendation.js — Gewichtsempfehlung, isReadyForAutoSelect()
setUtils.js       — isFullSuccess() Helper
consistencyUtils.js — _weekConsistencyRatio() (Shared Module)
overallPerformance.js — computeVolumeTrend/QualityTrend/ConsistencyTrend
progressInsights.js — Erkenntnisse-Sektion
insightEngine.js  — Toast-Regeln, Insights
movementMap.js    — Übungsname → Kategorie (Push/Pull/Squat/Hinge/Core/Carry)
progressChart.js  — Übungsfortschritt-Chart
weekReview.js     — Wochenrückblick
```

### State-Struktur (SCHEMA 29):
```javascript
{
  meta: { schemaVersion: 29, savedAt, createdAt },
  curIdx: number,           // aktuelle Woche
  weeks: [{
    startDate, mode, days, isSeedWeek,
    sessionLog, bodyData, restDays
  }],
  settings: {
    erkenntnisseHorizont: 8,  // clamped gegen realWeeks beim Render
    autoEval: boolean,
    plateStep, barbellWeight, ...
  },
  prs: {},
  coachPerformance: { suggestions: [] },
  coachQuestion: { weekStart, questionId, answer, outcome, measuredWeekStart },
  coachQuestionHistory: [],
  lastReentryHandled: null | timestamp,
  plateauActions: {},
  decisionLog: [],
  badges: [],               // eingefroren, kein Granting mehr
  // ENTFERNT: surpriseLog, streakFreeze
}
```

---

## FEATURE-STATUS (vollständige Liste)

### Training-Tab ✓ implementiert:
- Wochenstruktur, Pillen-Navigation, horizontaler Scroll (Android/iOS)
- Satz-Bewertung: automatisch (autoEval, blur+setTimeout) + manuell (✓/✗)
- Fail-Sätze zählen in Fulfill-Meter (success + fail seit v151)
- Gewichtsempfehlung (successRate + RPE), ex.weightStep hat Vorrang
- Progressions-Präferenz pro Übung: weight_first / double_progression / reps_only + targetRepsMax
- Submaximale PR-Erkennung: prRepsHistory {[weight]: maxReps}
- "Heute anders": temporärer Übungsersatz — OFFEN: frisches Template für Ausweichübung
- Übung archivieren: ex.archived=true, aus Training-Tab ausgeblendet, History erhalten
- Stoppuhr H:MM:SS ab 60min, Dauer bei Abschluss eingefroren
- Automatische Wochenerstellung (opt-in, Suboptionen)
- Deload-Modus, Urlaubsmodus
- Körpergewicht täglich: weightLog Array, Wochendurchschnitt
- Schlaf + Energielevel pro Tag
- Wochenerstellung: isSeedWeek wird übersprungen als Template (seit v151)

### Coach-Tab ✓ implementiert:
- Hauptkarte (akute Kaskade) + Strukturkarte (unabhängig, max. 2 Signale)
- Alle 7 akuten Signale (siehe Coach-Tab Architektur)
- Alle 3 strukturellen Signale (Deload, Konsistenz-Qualität, Push/Pull)
- Adaptive Nachfrage-Karte: 3 Typen, 1x/Woche
- Coach-Bilanz Mini mit Details-Link zum Fortschritt-Tab
- Plateau: automatische Konsequenz (EX_SET_NEXT_WEEK_PLAN für deload/volume)
- Overload: 3 eigene Formulierungen (sleep/rpe/completion)

### Fortschritt-Tab ✓ implementiert:
- Erkenntnisse-Sektion: Zeithorizont-Selektor (geclampt gegen echte Wochen)
- Gesamtperformance: Qualität/Konsistenz/Volumen/Breite
- Push/Pull-Ratio als Text + Balken
- Übungsfortschritt-Chart mit Prognose-Linie (wenn Trend vorhanden)
- "Kein klarer Trend erkennbar" wenn kein Trend (seit v151)
- Streak: neutral formuliert, kein Druck-Framing
- Abzeichen-Galerie: eingefroren, nur historisch
- Körpergewicht-Chart (Wochendurchschnitt)
- Bewegungsschaubild: Balken nach Muskelkategorie
- Coach-Bilanz: Trefferquote ab ≥5 Messungen (outcome !== null)
- Wochenrückblick: verpasste Tage nur für fällige Tage (< heute, seit v152)

### Onboarding ✓ implementiert:
- 2 Taps bis erster Satz
- Erfahrung + Ziel → Vorlage-Empfehlung (optional, einklappbar)
- Startwerte als isSeedWeek (Coach ab Tag 1 intelligent)

### Technisch ✓ implementiert:
- iOS PWA Safe Area: --sat/--sab CSS-Variablen
- Android horizontaler Scroll: touch-action:pan-x
- Auto-Backup: exportJSONAuto mit Datum beim Wochenwechsel
- Service Worker: user-gated Update-Mechanismus + Update-Banner
- movementMap.js: 50+ Übungen inkl. 32 englische Synonyme (seit v149)
- isFullSuccess(s, ex): zentraler Helper in setUtils.js
- consistencyUtils.js: Shared-Modul (kein Circular-Import)

### NICHT implementiert / bewusst ausgeschlossen:
- Gamification: Streak-Freeze, Surprise Rewards, Badge-Granting (alle entfernt v150)
- CSV-Import, Cloud-Sync
- Sperrbildschirm-Integration (nach echten Nutzern)
- Periodisierungs-Empfehlung (Konzept-Sprint nötig)
- Wilks Score / relative Stärke (Konzept-Entscheidung offen)
- Muskelkater als Coach-Input (neue Datenerfassung nötig)

---

## UI-PATTERNS & DESIGN-REGELN

### CSS-Variablen (Kern):
```css
--c-bg          /* Hintergrund (dunkel) */
--c-surface     /* Karten-Hintergrund */
--c-surface-2   /* Sekundäre Flächen */
--c-accent      /* Akzentfarbe (grün/gelb) */
--c-text        /* Primärer Text */
--c-text-2      /* Sekundärer Text (dezent) */
--c-border      /* Rahmen */
--c-danger      /* Fehler/Warnung (rot) */
```

### Komponenten-Klassen:
```
.chart-card          — Standard-Karte mit Box-Shadow
.coach-focus-card    — Hauptkarte Coach-Tab (mit farbigem Rand)
.coach-structural-card — Strukturkarte (kein Box-Shadow, dezent)
.coach-confidence    — Konfidenz-Badge (HIGH/MEDIUM/LOW)
.streak-badge        — Streak-Anzeige (kompakt, Training-Tab Header)
.fulfill-meter       — Wdh-Balken unter Übung
.pill-nav            — Pillen-Navigation (Tages-Tabs)
```

### Design-Prinzipien:
- Hauptinformation sofort sichtbar, Details hinter "Warum?"-Collapse
- Strukturelle Hinweise visuell schwächer als Hauptkarte (kein Box-Shadow)
- Neutrale Sprache: kein Druck-Framing, keine Ausrufezeichen bei Streak
- Max. 3 Elemente im Coach-Tab: Hauptkarte + Strukturkarte + Coach-Bilanz-Mini
- Neue UI-Elemente: erst CSS-Variablen verwenden, keine hardcodierten Farben
- Dezente Erfolgs-Indikatoren: ✓ (Ziel erreicht), ↑ (PR), 🏆 (Gewichts-PR)
- Kein 🔥 Emoji irgendwo (nur auf Aufwärmen-Button — unrelated, nicht anfassen)

### Formulierungs-Standards:
```
Streak:     "X Wochen konsistentes Training" (nicht "🔥 X Wochen!")
Deload:     "Deload einplanen" (nicht "Du musst pausieren!")
Plateau:    "Plateau überwinden" + konkrete Strategie
Overload:   "Schlaf priorisieren" / "Aufwand steigt" / "Qualität sichern"
onTrack:    "Du baust gerade deine Datenbasis auf." (Früh-Phase)
            "Trainiere wie geplant weiter." (Standard)
```

---

## COACH-TAB ARCHITEKTUR (seit train-v148)

### Zwei unabhängige Ebenen:

**Hauptkarte (akut) — computeWeeklyFocus():**
```
_checkReentry(1)
?? _checkOverload(2)        // sleep + rpe + completion (3 Zweige)
?? _checkPlateau(3)         // VOR PrePlateau seit v148
?? _checkPrePlateau(4)
?? _checkConsistencyGap(5)
?? _checkProgression(6)
?? _fallback(7)
```

**Strukturkarte — computeStructuralSignals() (Array, 0-2 Signale):**
```
_checkPreventiveDeload()    // ≥8 Wochen ohne Deload + Volumen↑/RPE>7.5
_checkConsistencyQuality()  // Frequenz stabil + Qualität↓ + curPct<75
_checkPushPullBalance()     // Ratio >1.5 über erkenntnisseHorizont
```
Max. 2 gleichzeitig (deload > consistency_quality > push_pull).
Unabhängig von Hauptkarte — erscheint auch wenn Progression aktiv.

### Overload-Formulierungen (3 eigene):
- sleep → "Schlaf priorisieren"
- rpe → "Aufwand steigt" + Übungsname
- completion → "Qualität sichern"

---

## CONCEPTUAL FRAMEWORK (11/11 Score)

**Definition "Erfolgreicher Satz":**
`isFullSuccess(s, ex)` = status==='success' UND reps >= targetReps
→ In Analyse-Schicht (Plateau, Gewichtsempfehlung, Konfidenz)
→ State-Reducer bleiben bei status==='success' (subjektive Bewertung)

**RPE-Schwellen:**
- Progressionsbereitschaft: avgRPE ≤ 8.0
- Konfidenz HIGH: lastRPE ≤ 7.5
- Konfidenz MEDIUM: lastRPE ≤ 8.5
(bewusst unterschiedlich — Bereitschaft ≠ Konfidenz)

**isFullSuccess() Anwendung:**
- ✓ plateauDetector.js (seit train-v146)
- ✓ weightRecommendation.js Konfidenz (seit train-v151)
- ✓ weeklyFocus.js _checkProgression (seit train-v151)
- ✗ BEWUSST NICHT in _scoreWeek()/_weekSuccessScore()/_weekTrainingStatus()
  → Diese messen "hat trainiert" (Anwesenheit), nicht "hat Ziel erreicht"

**status==='success' NICHT ändern bei:**
- Volumen-Berechnungen (_weightVolume, _trueVol)
- Chart-Datenpunkte / 1RM-Schätzung
- Streak-Berechnung (_weekTrainingStatus)
- Daten-Anwesenheits-Gates (.some(s => s.status === 'success' || s.status === 'fail'))

---

## GAMIFICATION-STATUS

**Entfernt (train-v150):**
- surpriseRewards.js — vollständig gelöscht
- Streak-Freeze — vollständig entfernt
- Flammen-Icon 🔥 — aus allen Streak-Anzeigen entfernt
- Badge-Granting — eingefroren (_checkAndGrantBadges auskommentiert)
- tip-07 (Badge-Versprechen) — entfernt
- Badge-Countdown — entfernt

**Behalten:**
- Streak-Zahl (neutral formuliert: "12 Wochen konsistentes Training")
- Abzeichen-Galerie (wenn badges[] nicht leer — rein historisch)
- PR-Badges am Satz (✓/↑/🏆) — datengetrieben, entscheidungsrelevant

---

## BEKANNTE BUGS & STATUS

### Behoben (seit letzter Session):
| Bug | Fix | Train-Version |
|-----|-----|---------------|
| Auto-Eval bei 0 Wdh | Guard reps < 0 statt <= 0 | v151 |
| Wochenerstellung Toast bei Kollision | before/after weeks.length Check | v151 |
| Verpasste Einheiten laufende Woche | _reachableDays() < statt <= | v152 |
| Zeitbezug geclampt | effectiveN gegen realWeeks | v151 |
| Fulfill-Meter fail-Sätze | success+fail in achieved | v151 |
| Wiedereinstieg 14→7 Tage | REENTRY_WINDOW_DAYS = 7 | v151 |
| _weekConsistencyRatio future-Tage | < statt <= (off-by-one) | v153 |
| ui.js:1183 vs 1642 Inkonsistenz | success+fail in Live-Hinweis | v154 |

### Offen (noch nicht angegangen):
| Bug/Feature | Priorität | Notizen |
|-------------|-----------|---------|
| iOS Doppelklick-Zoom Picker | UX-Hoch | font-size < 16px → touch-action fix |
| Heute anders — frisches Template | UX-Mittel | Ausweichübung ohne Vorwoche-Daten |
| Meter statt Wdh bei Übungen | UX-Mittel | metric:'distance' Progressionstyp |
| Muskelkater als Coach-Input | Konzept | Neue Datenerfassung nötig |
| Aufwärmen/Cooldown-Check | Konzept | Check + Analyse, nicht ausbauen |
| Coaching-Filter | Konzept | Nur bestimmte Kennzahlen coachen |
| Wilks Score / relative Stärke | Konzept | "Reife" des Athleten messen |
| RPE 9-10 + manuelle Steigerung | Konzept | System-Warnung ausgeben |
| Periodisierungs-Empfehlung | Konzept-komplex | Eigener Konzept-Sprint nötig |
| Actual Date einführen | Konzept | App verwendet startDate-relativ |
| Sperrbildschirm-Integration | UX-komplex | Nach echten Nutzern |
| Edge-Case-Audit + Testszenarien | Stabilität | Noch nicht angegangen |
| getCompletionRate()/_scoreWeek() | Low | Verwandter Bug-Typ, kein akuter Fix |

### Bewusst zurückgestellt:
- iOS Eingabefelder-Zoom + Timer bei offener Tastatur → braucht echtes iOS-Gerät
- CSV-Import, Cloud-Sync, Colorways, Erklär-Videos
- Abzeichen-System vollständig entfernen (nach echten Nutzern)

---

## TEST-INFRASTRUKTUR

### 12 JSON-Testszenarien (alle verifiziert ✓):
| Szenario | Status | Datei |
|----------|--------|-------|
| A1 Progression HIGH | ✓ | TRAIN_Test_A1_... |
| A2 Plateau + Buttons + Konsequenz | ✓ | TRAIN_Test_A2_... |
| A3 pre_plateau + Nachfragen | ✓ | TRAIN_Test_A3_... |
| A4 Überlastung RPE-Trend | ✓ | TRAIN_Test_v147_Signal1... |
| A5 Überlastung Schlaf+Energie | ✓ | TRAIN_Test_A5_... |
| A6 onTrack Früh-Phase | ✓ | TRAIN_Test_A6_... |
| B1 Adaptive Frage pre_plateau | ✓ | TRAIN_Test_B1_... |
| B2 Frage Progression MEDIUM | ✓ | TRAIN_Test_B2_... |
| B3 Konfidenz-Signal | ✓ | TRAIN_Test_B3_... |
| C1 Coach-Bilanz Fortschritt-Tab | ✓ | TRAIN_Test_C1_... |
| C2 Keine Coach-Bilanz | ✓ | TRAIN_Test_C2_... |
| D1 Auto-Backup | ✓ | TRAIN_Test_D1_... |

### Bekannte Test-JSON-Konstruktionsregeln:
- `weight=0` Übungen → nie für _checkRisingRpe-Tests (Guard weights.some(w=>w===0))
- `lastReentryHandled: null` → sonst _checkReentry feuert (Prio 1, verwendet Date.now())
- Für Push/Pull-Tests: Übungsnamen müssen in movementMap.js vorhanden sein
- Für _checkConsistencyQuality: fail-Sätze nötig (nicht reps<targetReps) weil _scoreWeek() isFullSuccess() nicht nutzt
- Für _checkPushPullBalance: ≤7 Wochen (unter 8-Wochen-Deload-Schwelle) + konstantes Gewicht
- Kaskaden-Priorität beachten: Prio 1 (Reentry) verdrängt alles, Prio 6 (Progression) verdrängt Prio 8 (Push/Pull)

---

## SPRINT-COMMIT-HISTORIE (letzte Sprints)

| Commit | Version | Inhalt |
|--------|---------|--------|
| ba26b55 | v150 | Framework-Audit Cleanup: Gamification entfernt |
| f1d4f54 | v151 | Kategorie-1-Bugfixes (8 Bugs) |
| 66c034d | v152 | Fix3b future days + Fix4 Stepper |
| ab33633 | v153 | _weekConsistencyRatio off-by-one |
| 8686458 | v154 | ui.js:1183 Inkonsistenz (Live-Hinweis success+fail) |

---

## STRATEGISCHE PRIORITÄTEN

1. **20 echte Nutzer** — r/weightroom, r/powerlifting, lokale Krafträume (OFFEN seit v10.0)
2. **App Store Listing** — PWABuilder nach ersten Nutzer-Signalen
3. **iOS verifizieren** — Eingabefelder-Zoom, Timer bei offener Tastatur (braucht echtes Gerät)

**Paywall-Konzept:** Logging kostenlos — Coaching kostenpflichtig (8–12€/Monat)

---

## MARKETING-POSITIONIERUNG

**Die drei Kernpunkte:**
1. Coach-Lücke: Entweder 80–150€/Monat für Coach oder allein gestellt. TRAIN füllt diese Lücke.
2. Kein System das alles vereint: YouTube, Reddit, Artikel — aber kein System das konkret sagt was jetzt zu tun ist.
3. 10+ Jahre Erfahrung verinnerlicht: gelebte Praxis, nicht nur akademische Studien.

**Echte Konkurrenten:** Hevy/Strong (nur Tracking), Boostcamp (statische Programme), Fitbod (kein RPE), RP Hypertrophy (direktester Konkurrent).
**Keine Konkurrenten:** Kahunas, Everfit, Trainerize (Coach-Software für Coaches, nicht Athleten).

---

## LANGFRIST-VISION

"Passives Tracking": Meta-KI-Brille erkennt Übung/Sätze/Wdh automatisch, Apple Watch leitet RPE ab, TRAIN dokumentiert ohne manuellen Eintrag. TRAIN bleibt Software (kein Hardware-Produkt), empfängt standardisierten Daten-Stream über API-Schicht.

Architektur-Implikation heute: Datenstruktur sauber und erweiterbar halten.

---

## NACH JEDEM SPRINT AKTUALISIEREN:

1. CACHE_VERSION + CSS-Version in diesem File
2. Behobene Bugs aus "Offen" in "Behoben" verschieben
3. Neuen Commit-Hash in Sprint-Historie eintragen
4. Neue offene Punkte ergänzen
