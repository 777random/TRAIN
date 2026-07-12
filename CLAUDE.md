# TRAIN — CLAUDE.md
# Vollständiger Projektkontext für Claude Code
# Stand: train-v157 / SCHEMA 29 / Juli 2026
# Letztes Update: nach train-v157 Sprint

---

## SESSION START (IMMER ZUERST)

Beim Start jeder Session diese Reihenfolge einhalten:

1. Diese Dateien lesen:
   CLAUDE.md, HANDOFF.md, BUGS.md, DECISIONS.md, AGENTS.md, LOOPS.md

2. Alle AKTIVEN Loops in LOOPS.md ausführen

3. Ergebnis in SESSION_LOG.md dokumentieren

4. Erst dann mit der eigentlichen Aufgabe beginnen

---

## WAS TRAIN IST

TRAIN ist eine deutschsprachige PWA für Krafttraining. Pure Vanilla ES Modules — kein Framework, kein Build-Step, kein Bundler. `index.html` direkt im Browser öffnen.

**Nordstern:** "Decision Support für Krafttraining — nicht Workout-Tracker."
**Zielgruppe:** Ernsthafte Kraftsportler 3–5x/Woche, intermediate+, ohne Personal Trainer.
**Kernfrage jedes Features:** "Reduziert dieses Feature die Unsicherheit des Athleten bei seiner nächsten Trainingsentscheidung?"

- Repo: https://github.com/777random/TRAIN
- Deployed: https://777random.github.io/TRAIN/
- Aktueller Stand: SCHEMA_VERSION 29 · CACHE_VERSION train-v157 · CSS ?v=183

---

## APP STARTEN

`index.html` direkt in Chrome oder Safari öffnen. Kein Dev-Server, kein `npm install`, kein Build-Schritt.

Bei CSS-Änderungen: Cache-Buster in `index.html` erhöhen:
```html
<link rel="stylesheet" href="./styles.css?v=183">
```

---

## PROJEKTDOKUMENTE (beim Start lesen)

| Datei | Inhalt |
|-------|--------|
| `HANDOFF.md` | Session-Übergabe: aktueller Stand, zuletzt geänderte Files, nächster Schritt |
| `BUGS.md` | Bug-Tracker: behoben / offen / bewusst kein Bug / bekannte Test-Fallstricke |
| `DECISIONS.md` | Unveränderliche Produkt-/Architektur-Entscheidungen — nicht ohne neue explizite Entscheidung revidieren |
| `AGENTS.md` | Parallelisierungs-Regeln für Multi-Agent Sprints |
| `LOOPS.md` | Automatische Session-Loops (beim Start jeder Session ausführen) |
| `SESSION_LOG.md` | Protokoll aller Sessions und Loop-Ergebnisse |

Nach jedem Sprint: `HANDOFF.md` und `BUGS.md` aktualisieren (behobene Bugs verschieben, Commit-Hash eintragen, nächsten Schritt setzen).

---

## ARBEITSREGELN (PFLICHT)

### Git-Workflow:
```
# Vor jedem Sprint:
git add -A && git commit -m "chore: pre-sprint checkpoint"
git push origin main

# Nach jedem Sprint:
git add -A && git commit -m "fix/feat: [beschreibung] (vXXX->vYYY)"
git push origin main
```

Commit-Message Format: `type(scope): short description`
- `feat(ui): add weight progression chart`
- `fix(state): correct undo stack for SET_TOGGLE_DONE`
- `chore: bump CSS cache-buster to v180`

### Versions-Increment:
- Jede JS/CSS-Änderung: CACHE_VERSION erhöhen (train-v153 → train-v154)
- CSS-Datei: `?v=179` → `?v=180` in index.html
- SCHEMA_VERSION nur bei Datenmodell-Änderungen erhöhen

### Regressions-Test:
Nach JEDEM Sprint: `tests/regression_core.html` in headless Chrome ausführen.
Erwartung: 10/10 grün, 0 uncaught errors.
Bekannte Limitierung: Test 8 schlägt im Headless-Modus konsistent fehl (rAF-Timing) — akzeptiert.

### Lokale Milestone-Backups:
Nach jedem Milestone: alle Projektdateien (außer `backups/` und `.git/`) nach `backups/TRAIN_<YYYY-MM-DD>_<milestone-name>/` kopieren. `backups/` ist gitignored.

### Chrome-Prozesse:
Beim Testen: nur headless Chrome starten/beenden. Bestehende Chrome-Fenster des Users NICHT beenden.

### Vor konzeptionell neuen Features — zwei Pflichtfragen:
1. "Reduziert dieses Feature die Unsicherheit des Athleten bei seiner nächsten Trainingsentscheidung?"
2. "Für wen genau löst das ein Problem — für den ernsthaften Athleten der 3–5x/Woche trainiert, oder für jemand anderen?"
Wenn unklar: erst diskutieren, dann implementieren.

### Diagnose vor Fixes:
Bei unklarem Root Cause immer erst Diagnose → Ergebnis abwarten → dann Fix. Niemals raten wenn Code-Realität unbekannt.

### Test-JSONs:
- Format: `TRAIN_Test_vXXX_Beschreibung.v1.json`
- Bei jedem Test explizit angeben:
  - WO importieren / WO prüfen
  - ERWARTUNG VORHER (falsches Verhalten)
  - ERWARTUNG NACHHER (korrektes Verhalten)
  - WARUM diese Daten

---

## ARCHITEKTUR

### Module-Verantwortlichkeiten:

| Datei | Rolle |
|-------|-------|
| `state.js` | Single Source of Truth. Alle Writes über `dispatch()`. Subscribers synchron nach jeder Mutation. Persistenz in localStorage. |
| `ui.js` | Gesamtes DOM-Rendering. Einmalig gebootstrapped via `mountApp(root)`. Re-rendert Regionen bei State-Änderungen via `subscribe()`. |
| `weeklyFocus.js` | Coach-Logik. `computeWeeklyFocus()` + `computeStructuralSignals()`. |
| `plateauDetector.js` | Plateau-Erkennung. Verwendet `isFullSuccess()`. |
| `weightRecommendation.js` | Gewichtsempfehlung. `isReadyForAutoSelect()`. |
| `setUtils.js` | `isFullSuccess(s, ex)` — zentraler Helper. |
| `consistencyUtils.js` | `_weekConsistencyRatio()` — Shared Module (verhindert Circular Import overallPerformance ↔ weeklyFocus). |
| `overallPerformance.js` | `computeVolumeTrend/QualityTrend/ConsistencyTrend`. |
| `progressInsights.js` | Erkenntnisse-Sektion. |
| `insightEngine.js` | Toast-Regeln, Insights. |
| `movementMap.js` | Übungsname → Kategorie (Push/Pull/Squat/Hinge/Core/Carry). 50+ Übungen inkl. 32 englische Synonyme. |
| `progressChart.js` | Übungsfortschritt-Chart. |
| `weekReview.js` | Wochenrückblick. |
| `timer.js` | Session-Uhr + Pause-Timer. Vollständig entkoppelt von `ui.js` via custom `window` Events. |
| `backup.js` | JSON Import/Export, CSV Export. |
| `registerSW.js` | Service Worker Registrierung, Storage-Error, SW-Update Event. |
| `dragdrop.js` | Minifizierter Third-Party Drag-Drop Polyfill — NICHT bearbeiten. |
| `icons.js` | SVG Icon Strings als named constants. |

### State Layer (`state.js`):

Flux-Pattern: `dispatch(A.ACTION_TYPE, payload)` → `reduce()` → `persistState()` → `_notify()` → alle Subscriber synchron.

**Persistenz (defence-in-depth):**
- Primary: `localStorage['train_v6']` — bei jeder Mutation
- Shadow: `localStorage['train_v6_shadow']` — debounced 500ms (Crash-Safety)

**Undo:** 20-Entry Stack mit Deep-Cloned Snapshots. Navigation Actions (`WEEK_NAVIGATE`, `SESSION_START` etc.) sind von Undo ausgeschlossen (`_NO_UNDO`).

**Schema Migration:** `migrate()` läuft bei jedem `loadState()`. Neuen `case` Block hinzufügen wenn `SCHEMA_VERSION` erhöht wird. Aktuelle Version: **29**.

**State Shape (SCHEMA 29):**
```javascript
{
  meta: { schemaVersion: 29, savedAt, createdAt },
  curIdx: number,           // Index in weeks[]
  weeks: [{
    id, startDate, note, mode,
    days: [{
      id, title, subtitle, warmup, cooldown,
      locked, markedDone, isVacation,
      sleepHours, energyLevel, sessionRating,
      exercises: [{
        name, note, pauseSec, metric, sets,
        weightStep, nextWeekPlan, nextWeekPlanConfirmed,
        targetReps, progressionType, archived,
        substituteFor
      }]
    }],
    sessionLog, bodyData, restDays, isSeedWeek
  }],
  customTemplate: [],
  settings: {
    erkenntnisseHorizont: 8,  // geclampt gegen realWeeks beim Render
    autoEval, plateStep, barbellWeight, ...
  },
  prs: {},
  coachPerformance: { suggestions: [] },
  coachQuestion: { weekStart, questionId, answer, outcome, measuredWeekStart },
  coachQuestionHistory: [],
  lastReentryHandled: null | timestamp,
  plateauActions: {},
  decisionLog: [],
  badges: [],               // eingefroren — kein Granting mehr
  // ENTFERNT: surpriseLog, streakFreeze
}

Set → { weight, reps, rpe, status ('pending'|'success'|'fail'), done }
```

### UI Layer (`ui.js`):

- `mountApp(root)`: baut Static Shell einmalig (Toolbar, Tabs, Modals, Toast, Storage Warning)
- `subscribe()` → `render(state)` bei jedem Dispatch. `render()` diff'd — rendert nur geänderte Region
- **Event Delegation:** ein `click` + ein `input` Listener auf `#app`, routing via `data-action` Attribute. Niemals individuelle Element-Listener für Set/Exercise/Day Interaktionen
- Transient UI State (offener Day-Index, aktiver Tab, Drag Source) lebt in Modul-Variablen in `ui.js`, nie in `state.js`

### Timer-Entkopplung:

`timer.js` importiert nur `state.js`. Kommuniziert mit `ui.js` ausschließlich via custom `window` Events:
- `ui.js` → `timer.js`: `train:set-done`, `train:set-input`, `train:warmup-click`, `train:day-complete`
- `train:show-update-banner`: von `index.html` gefeuert, direkt von `ui.js` gehört

**NIEMALS:** `ui.js` von `timer.js` importieren oder umgekehrt.

### Neue Action hinzufügen:
1. Konstante zum `A` Object in `state.js` hinzufügen
2. `case` in `reduce()` switch hinzufügen
3. `dispatch(A.YOUR_ACTION, payload)` von `ui.js` aufrufen
4. Falls nicht undoable: zu `_NO_UNDO` hinzufügen

---

## COACH-TAB ARCHITEKTUR (seit train-v148)

### Zwei unabhängige Ebenen:

**Hauptkarte (akut) — `computeWeeklyFocus()`:**
```
_checkReentry(1)
?? _checkOverload(2)        // 3 Zweige: sleep, rpe, completion
?? _checkPlateau(3)         // VOR PrePlateau (stärkerer Befund)
?? _checkPrePlateau(4)
?? _checkConsistencyGap(5)
?? _checkProgression(6)
?? _fallback(7)
```

**Strukturkarte — `computeStructuralSignals()` (Array, 0-2 Signale):**
```
_checkPreventiveDeload()    // ≥8 Wochen ohne Deload + Volumen↑/RPE>7.5
_checkConsistencyQuality()  // Frequenz stabil + Qualität↓ + curPct<75%
_checkPushPullBalance()     // Ratio >1.5 über erkenntnisseHorizont
```
Max. 2 gleichzeitig (deload > consistency_quality > push_pull).
Unabhängig von Hauptkarte — erscheint auch neben Progression.

**Overload-Formulierungen (3 eigene):**
- sleep → "Schlaf priorisieren"
- rpe → "Aufwand steigt" + Übungsname
- completion → "Qualität sichern"

---

## CONCEPTUAL FRAMEWORK (11/11 Score)

**`isFullSuccess(s, ex)`** = `status === 'success'` UND `reps >= targetReps`

**Verwenden in:** plateauDetector.js, weightRecommendation.js (Konfidenz), weeklyFocus.js (_checkProgression)

**NICHT verwenden in:**
- `_scoreWeek()`, `_weekSuccessScore()`, `_weekTrainingStatus()` → messen Anwesenheit ("hat trainiert"), nicht Zielerreichung
- Volumen-Berechnungen (`_weightVolume`, `_trueVol`) → tatsächlich bewegtes Gewicht
- Chart-Datenpunkte / 1RM-Schätzung
- Daten-Anwesenheits-Gates (`.some(s => s.status === 'success' || s.status === 'fail')`)

**RPE-Schwellen (bewusst unterschiedlich):**
- Progressionsbereitschaft: avgRPE ≤ 8.0
- Konfidenz HIGH: ≤ 7.5 | Konfidenz MEDIUM: ≤ 8.5

**Datumsvergleiche:** immer `dayISO < todayISO` (nicht `<=`) — heutiger Tag gilt als noch nicht fällig.

---

## GAMIFICATION-STATUS

**Entfernt (train-v150):** surpriseRewards.js, Streak-Freeze, Flammen-Icon 🔥, Badge-Granting, tip-07, Badge-Countdown.

**Behalten:** Streak-Zahl (neutral: "X Wochen konsistentes Training"), Abzeichen-Galerie (historisch, eingefroren), PR-Badges am Satz (✓/↑/🏆).

**Aufwärmen-Button hat 🔥 — das ist unrelated zu Streak, NICHT anfassen.**

---

## FEATURE-STATUS

### Implementiert ✓:
**Training-Tab:** Wochenstruktur, Pillen-Nav, Satz-Bewertung (auto+manuell), Gewichtsempfehlung, Progressions-Präferenz, PR-Erkennung, "Heute anders", Übung archivieren, Stoppuhr, Auto-Wochenerstellung, Deload/Urlaubsmodus, Körpergewicht, Schlaf+Energie.

**Coach-Tab:** Hauptkarte (7 akute Signale) + Strukturkarte (3 strukturelle Signale), Adaptive Nachfrage-Karte, Coach-Bilanz Mini, Plateau-Konsequenz (EX_SET_NEXT_WEEK_PLAN).

**Fortschritt-Tab:** Erkenntnisse (geclampt), Gesamtperformance, Push/Pull-Ratio, Übungsfortschritt-Chart mit Prognose, Streak (neutral), Abzeichen-Galerie, Körpergewicht-Chart, Bewegungsschaubild, Coach-Bilanz.

**Technisch:** iOS Safe Area, Auto-Backup, Service Worker (user-gated Update), movementMap (+32 englische Synonyme), isFullSuccess(), consistencyUtils.js.

### Offen / In Arbeit:
| Feature | Priorität |
|---------|-----------|
| iOS Doppelklick-Zoom Picker | Nächster Sprint (UX-Hoch) |
| Heute anders — frisches Template | UX-Mittel |
| Meter statt Wdh bei Übungen | UX-Mittel |
| Edge-Case-Audit + Testszenarien | Stabilität |
| Muskelkater als Coach-Input | Konzept |
| Aufwärmen/Cooldown-Check | Konzept |
| Coaching-Filter | Konzept |
| Wilks Score / relative Stärke | Konzept |
| RPE 9-10 + manuelle Steigerung → Warnung | Konzept |
| Periodisierungs-Empfehlung | Konzept-komplex |
| Sperrbildschirm-Integration | Nach echten Nutzern |

### Bewusst ausgeschlossen:
Gamification (entfernt), CSV-Import, Cloud-Sync, Colorways, Erklär-Videos, Badge-Granting.

---

## UI-PATTERNS & DESIGN-REGELN

### CSS-Variablen:
```css
--c-bg, --c-surface, --c-surface-2
--c-accent        /* Akzentfarbe */
--c-text, --c-text-2
--c-border, --c-danger
```
Keine hardcodierten Farben — immer CSS-Variablen.

### Komponenten-Klassen:
```
.chart-card              — Standard-Karte mit Box-Shadow
.coach-focus-card        — Hauptkarte Coach-Tab (farbiger Rand)
.coach-structural-card   — Strukturkarte (kein Box-Shadow, dezent)
.coach-confidence        — HIGH/MEDIUM/LOW Badge
.streak-badge            — Streak (kompakt, Training-Tab Header)
.fulfill-meter           — Wdh-Balken unter Übung
.pill-nav                — Tages-Tabs
```

### Design-Prinzipien:
- Hauptinfo sofort sichtbar, Details hinter "Warum?"-Collapse
- Strukturelle Hinweise visuell schwächer als Hauptkarte
- Neutrale Sprache: kein Druck-Framing, keine Ausrufezeichen bei Streak
- Max. 3 Elemente Coach-Tab: Hauptkarte + Strukturkarte + Coach-Bilanz-Mini

### Formulierungs-Standards:
```
Streak:    "X Wochen konsistentes Training"  (NICHT "🔥 X Wochen!")
onTrack:   "Du baust gerade deine Datenbasis auf."  (Früh-Phase)
           "Trainiere wie geplant weiter."  (Standard)
Deload:    "Deload einplanen"
Plateau:   "Plateau überwinden" + konkrete Strategie
```

---

## TEST-JSON KONSTRUKTIONSREGELN

| Fallstrick | Wirkung | Lösung |
|-----------|---------|--------|
| weight=0 | _checkRisingRpe überspringt Übung | Gewicht > 0 verwenden |
| lastReentryHandled gesetzt | _checkReentry feuert immer (Prio 1) | null setzen |
| >8 Wochen | Präventiver Deload feuert vor Push/Pull | Max 7 Wochen |
| Keine fail-Sätze | _checkConsistencyQuality feuert nicht | Echte fail-Sätze (reps<targetReps reicht nicht) |
| Gewicht steigt konstant | Plateau verdrängt Push/Pull | Konstantes Gewicht ODER <3 Wochen |
| Unbekannter Übungsname | pullSets=0 → Push/Pull Guard | Bekannten Namen (z.B. "Rudern") |
| curPct < 0.7 | Totes Code (Scale 0-100) | curPct < 70 |

---

## STRATEGISCHE PRIORITÄTEN

1. **20 echte Nutzer** — r/weightroom, r/powerlifting, lokale Krafträume
2. **App Store** — PWABuilder nach ersten Nutzer-Signalen
3. **iOS verifizieren** — Eingabefelder-Zoom, Timer (braucht echtes Gerät)

**Paywall:** Logging kostenlos — Coaching kostenpflichtig (8–12€/Monat)

---

## NACH JEDEM SPRINT AKTUALISIEREN:

1. CACHE_VERSION + CSS-Version oben in diesem File
2. Feature-Status-Tabelle
3. HANDOFF.md überschreiben
4. BUGS.md aktualisieren (behoben/offen)
