# TRAIN — CLAUDE.md
# Vollständiger Projektkontext für Claude Code
# Stand: train-v194 / SCHEMA 32 / Juli 2026
# Letztes Update: nach train-v194 (B79 Session Summary + Schlaf-Korrelation + Compound/Isolation-Balance + Deload-Plan)

---

## SESSION START (IMMER ZUERST)

Beim Start jeder Session diese Reihenfolge einhalten:

1. Diese Dateien lesen:
   CLAUDE.md, HANDOFF.md, BUGS.md, DECISIONS.md, AGENTS.md, LOOPS.md

2. Alle AKTIVEN Loops in LOOPS.md ausführen

3. Ergebnis in SESSION_LOG.md dokumentieren

4. Erst dann mit der eigentlichen Aufgabe beginnen

**Automatischer CI-Check (seit train-v162):** GitHub Actions führt bei
jedem Push auf main automatisch aus:
- `tests/regression_core.spec.js` (10 Kernprüfungen, via Playwright)
- `tests/fixtures.spec.js` (alle Edge-Case-Fixtures in tests/fixtures/)

Status sichtbar als Badge oben in README.md. Läuft zusätzlich zum
lokalen Loop 1 — kein Ersatz dafür, da lokal kein Node.js verfügbar ist
(siehe HANDOFF.md), CI ist damit aktuell der einzige Ort, an dem die
Playwright-Suite tatsächlich läuft.

---

## WAS TRAIN IST

TRAIN ist eine deutschsprachige PWA für Krafttraining. Pure Vanilla ES Modules — kein Framework, kein Build-Step, kein Bundler. `index.html` direkt im Browser öffnen.

**Nordstern:** "Decision Support für Krafttraining — nicht Workout-Tracker."
**Zielgruppe:** Ernsthafte Kraftsportler 3–5x/Woche, intermediate+, ohne Personal Trainer.
**Kernfrage jedes Features:** "Reduziert dieses Feature die Unsicherheit des Athleten bei seiner nächsten Trainingsentscheidung?"

- Repo: https://github.com/777random/TRAIN
- Deployed: https://777random.github.io/TRAIN/
- Aktueller Stand: SCHEMA_VERSION 32 · CACHE_VERSION train-v194 · CSS ?v=197

---

## APP STARTEN

`index.html` direkt in Chrome oder Safari öffnen. Kein Dev-Server, kein `npm install`, kein Build-Schritt.

Bei CSS-Änderungen: Cache-Buster in `index.html` erhöhen:
```html
<link rel="stylesheet" href="./styles.css?v=191">
```

---

## PROJEKTDOKUMENTE (beim Start lesen)

| Datei | Inhalt |
|-------|--------|
| `HANDOFF.md` | Session-Übergabe: aktueller Stand, zuletzt geänderte Files, nächster Schritt |
| `BUGS.md` | Bug-Tracker: behoben / offen / bewusst kein Bug / bekannte Test-Fallstricke |
| `DECISIONS.md` | Unveränderliche Produkt-/Architektur-Entscheidungen — nicht ohne neue explizite Entscheidung revidieren |
| `AGENTS.md` | Parallelisierungs-Regeln für Multi-Agent Sprints |
| `SECURITY.md` | Security-Status heutiger Architektur (kein Backend) + dokumentierte Blaupause für Auth/Rate-Limiting/Access-Control, sobald ein Server (Paywall/Coaching) kommt |
| `LEGAL.md` | Rechts-Recherche zu Impressum/Datenschutz (Name-/Adress-Pflicht, c/o-Workaround, DDG/DSGVO-Fakten) + Blaupause für AGB/Widerrufsrecht/BFSG, sobald Paywall/App-Store kommen |
| `LOOPS.md` | Automatische Session-Loops (beim Start jeder Session ausführen) |
| `SESSION_LOG.md` | Protokoll aller Sessions und Loop-Ergebnisse |
| `prompts/` | Wiederverwendbare Prompt-Vorlagen für Claude Code und externe Beratung |
| `context-exports/for-advisor-product.txt` | Produkt + User Journey für externe Beratung (Loop 7) |
| `context-exports/for-advisor-market.txt` | Markt + Konkurrenz für externe Beratung (Loop 8) |
| `context-exports/for-advisor-ux.txt` | UX + Onboarding für externe Beratung (Loop 9) |
| `context-exports/for-advisor-growth.txt` | Growth + Distribution für externe Beratung (Loop 10) |
| `context-exports/for-advisor-consolidated.txt` | Konsolidierter Export aus allen Perspektiven — für neue externe Chats (Loop 11) |

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

### CI-Status:
Nach jedem Push: GitHub Actions Badge in README.md prüfen (oder `gh run list`/`gh run view`).
Roter Badge = blockierender Fehler → vor neuem Sprint fixen.
**Wichtig:** der Workflow läuft NACH dem Push (kein Branch-Protection-Gate eingerichtet) —
er blockiert den Push selbst nicht, sondern liefert ein sichtbares Fehlersignal danach.
Echtes Push-Blocking bräuchte Branch-Protection-Regeln (GitHub-Repo-Einstellung, nicht
Teil dieses Workflows) — bewusst nicht eingerichtet, da main direkt gepusht wird (kein PR-Flow).
Seit train-v164: zweiter Job `lighthouse` (Performance/Accessibility/Best-Practices via
Lighthouse CI, `lighthouserc.cjs`) läuft nach `regression` (`needs: regression`).
Accessibility ist blockierend (`error`, ≥0.8), Performance/Best-Practices nur `warn`.
Keine `categories:pwa`-Assertion — diese Lighthouse-Version hat keine PWA-Kategorie mehr
(seit Lighthouse v9 entfernt), eine solche Assertion würde nur bedeutungsloses Dauer-Warnen
erzeugen (siehe BUGS.md B30).

### Prompt-Bibliothek:
Für jeden Sprint den passenden Prompt aus `prompts/` als Basis verwenden. Nie von null anfangen.
Neue Prompt-Typen in `prompts/` hinzufügen wenn sie mehr als 2x manuell geschrieben wurden.

### Spec-Konvention (neu):
Bei komplexen Features:
1. Produktentscheidung kommt von externem Berater (DECISIONS.md)
2. Claude Code schreibt technische Spec basierend darauf
3. Spec zeigen + auf Bestätigung warten bevor implementiert wird
4. Erst nach Bestätigung: umsetzen

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
| `setUtils.js` | `isFullSuccess(s, ex)` — zentraler Helper. Seit train-v170 auch `weekSuccessCounts(week)` (success/(success+fail), archiviert-bewusst) — einzige Quelle, von ui.js UND weekReview.js genutzt. |
| `consistencyUtils.js` | `_weekConsistencyRatio()` — Shared Module (verhindert Circular Import overallPerformance ↔ weeklyFocus). |
| `overallPerformance.js` | `computeVolumeTrend/QualityTrend/ConsistencyTrend`. |
| `progressInsights.js` | Erkenntnisse-Sektion. |
| `insightEngine.js` | Toast-Regeln, Insights. Seit train-v173 auch `detectRecurringStep()`/`exMetricHistory()`/`detectRecurringWeightStep()` — Muster-Erkennung für Schrittweite-Vorschläge (B49), rein rückblickend, nie automatisch angewendet. |
| `movementMap.js` | Übungsname → Kategorie (Push/Pull/Squat/Hinge/Core/Carry). 50+ Übungen inkl. 32 englische Synonyme. Seit train-v170 auch `buildCategoryMap()`/`resolveCategory()` — einzige Quelle für den Kategorie-Override-Lookup (`state.customExercises`-Override vor `MOVEMENT_MAP`-Fallback), genutzt von ui.js, weeklyFocus.js UND overallPerformance.js. |
| `progressChart.js` | Übungsfortschritt-Chart. |
| `weekReview.js` | Wochenrückblick. |
| `timer.js` | Session-Uhr + Pause-Timer. Vollständig entkoppelt von `ui.js` via custom `window` Events. Seit train-v193 (B77) importiert es zusätzlich `sessionCoach.js` (`buildSetFeedback()`) für die Pause-Dauer-Empfehlung — kein Bruch der ui.js-Entkopplung, siehe DECISIONS.md. |
| `sessionCoach.js` | Seit train-v193 (B77). Intra-Session Coach: `buildSetFeedback()` (Gewichts-/Pause-Vorschlag für den nächsten Satz, RPE-Bereiche + session-lokale Logik ohne RPE), `buildLastSetMessage()` (Abschluss-Text der Übung), `buildWarmupSets()` (50/70/85%-Aufwärmformel). Importfrei (Tiefe 0), von `ui.js` UND `timer.js` genutzt — bewusst KEINE Wiederverwendung von `getWeightRecommendation()` (weightRecommendation.js) für Intra-Session-Vorschläge, siehe DECISIONS.md. |
| `sessionSummary.js` | Seit train-v194 (B79). Session Summary + Schlaf-Korrelation: `buildSessionHighlights()`, `buildSessionEinordnung()`, `buildNextSessionPreview()`, `calcSleepCorrelation()`. Importiert `getSortedWeeks`/`exWeightHistory` (insightEngine.js), `isFullSuccess` (setUtils.js), `buildCategoryMap`/`resolveCategory` (movementMap.js) — Tiefe 3, kein ui.js-Import (lokal duplizierter Kategorie-Filter für die Fokus-Übung, gleiches Muster wie weeklyFocus.js' Push/Pull-Duplikation). PR-Deltas rechnen bewusst gegen `exWeightHistory()` der Vorwochen, nicht gegen `ex.prWeight`/`state.prs` (zum Abschlusszeitpunkt bereits überschrieben, siehe DECISIONS.md). |
| `backup.js` | JSON Import/Export, CSV Export. |
| `registerSW.js` | Service Worker Registrierung, Storage-Error, SW-Update Event. |
| `dragdrop.js` | Minifizierter Third-Party Drag-Drop Polyfill — NICHT bearbeiten. |
| `icons.js` | SVG Icon Strings als named constants. |
| `shareImage.js` | Seit train-v186 (B68), Wochenrückblick-Canvas seit v187 (B71) mit Bezier-Sparkline neu aufgebaut, seit v189 (B73) Favoriten-Kaskade/Retina-Deckelung/PR-Moment-Redesign/Datenschutz-Consent-Gate. Canvas-basierte Share-Bilder (PR-Moment + Wochenrückblick, 1080×1080 PNG, DPR max. 3x). Importfrei/State-frei (Tiefe 0), Farben live via `getComputedStyle()`. Teilen via `navigator.share`/`canShare` mit Download-Fallback (identisches Muster wie `backup.js`), kein Server-Upload. Einmaliger Datenschutz-Hinweis vor dem ersten Teilen (`localStorage['train_share_consent']`), zentral in `shareCanvas()` für alle Einstiegspunkte. |

### State Layer (`state.js`):

Flux-Pattern: `dispatch(A.ACTION_TYPE, payload)` → `reduce()` → `persistState()` → `_notify()` → alle Subscriber synchron.

**Persistenz (defence-in-depth):**
- Primary: `localStorage['train_v6']` — bei jeder Mutation
- Shadow: `localStorage['train_v6_shadow']` — debounced 500ms (Crash-Safety)

**Undo:** 20-Entry Stack mit Deep-Cloned Snapshots. Navigation Actions (`WEEK_NAVIGATE`, `SESSION_START` etc.) sind von Undo ausgeschlossen (`_NO_UNDO`).

**Schema Migration:** `migrate()` läuft bei jedem `loadState()`. Neuen `case` Block hinzufügen wenn `SCHEMA_VERSION` erhöht wird. Aktuelle Version: **32**.

**State Shape (SCHEMA 32):**
```javascript
{
  meta: { schemaVersion: 32, savedAt, createdAt },
  curIdx: number,           // Index in weeks[]
  weeks: [{
    id, startDate, note, mode,
    days: [{
      id, title, subtitle, warmup, cooldown,
      locked, markedDone, isVacation,
      sleepHours, energyLevel, sessionRating,
      sessionCheckIn, sessionModifier,  // seit SCHEMA 32 (B76)
      exercises: [{
        name, note, pauseSec, metric, sets,
        weightStep, metricStep, nextWeekPlan, nextWeekPlanConfirmed,
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

`timer.js` importiert `state.js` sowie (seit train-v193, B77) `sessionCoach.js` — ein importfreies, reines Berechnungsmodul (Tiefe 0), das auch `ui.js` nutzt. Kommuniziert mit `ui.js` ausschließlich via custom `window` Events:
- `ui.js` → `timer.js`: `train:set-input`, `train:warmup-click`, `train:day-complete`
- `train:set-done`: wird sowohl von `ui.js` (`confirm-set`-Klick-Handler) als auch von `timer.js` selbst gefeuert (`_bindAppInteractions()` erkennt `[data-action="toggle-done"]`-Klicks direkt auf `#app`, ohne über ui.js' eigenes Klick-Routing zu gehen — historisch gewachsen, siehe BUGS.md B78 für eine daraus resultierende Inkonsistenz bei `autoStartPauseTimer`)
- `train:show-update-banner`: von `index.html` gefeuert, direkt von `ui.js` gehört

**NIEMALS:** `ui.js` von `timer.js` importieren oder umgekehrt. Ausnahmen sind ausschließlich importfreie Tiefe-0-Module (wie `sessionCoach.js`), die von beiden unabhängig genutzt werden — nie eine direkte Kopplung der beiden Dateien selbst.

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
?? _checkPersistentFailure(2)  // seit v160 (B25): 0% Erfolg über 3 Wochen bei
                                // einer Übung — VOR Overload, da eingetretenes
                                // Totalversagen dringlicher ist als drohende
                                // Überlastung
?? _checkOverload(3)        // 3 Zweige: sleep, rpe, completion
?? _checkPlateau(4)         // VOR PrePlateau (stärkerer Befund)
?? _checkPrePlateau(5)
?? _checkConsistencyGap(6)
?? _checkProgression(7)
?? _fallback(8)
```

**Strukturkarte — `computeStructuralSignals()` (Array, 0-2 Signale):**
```
_checkMultiExerciseFailure() // seit v163 (B29): Gesamterfolgsquote ≤20% über
                              // ≥2 Übungen der letzten 3 Wochen — Gegenstück
                              // zu _checkPersistentFailure (dort: EINE Übung
                              // bei 0%). Reiner Text, kein Aktions-Button.
_checkPreventiveDeload()    // ≥8 Wochen ohne Deload + Volumen↑/RPE>7.5
_checkConsistencyQuality()  // Frequenz stabil + Qualität↓ + curPct<75%
_checkPushPullBalance()     // Ratio >1.5 über erkenntnisseHorizont
_checkCompoundIsolationBalance() // seit v194 (B79): Compound-Sätze
                              // (Squat/Hinge/Push/Pull) <60% über
                              // erkenntnisseHorizont, sonst kein Signal
```
Max. 2 gleichzeitig (multi_exercise_failure > deload > consistency_quality > push_pull > compound_isolation).
Unabhängig von Hauptkarte — erscheint auch neben Progression. `deload_preventive` zeigt
seit v194 (B79) zusätzlich eine konkrete Deload-Plan-Tabelle (alle Übungen aller Tage der
aktuellen Woche, Gewicht × deloadFactor gerundet auf weightStep) mit
"Plan übernehmen"-Button (`EX_AUTO_PRESELECT_NEXT_WEEK_PLAN`, wirkt beim nächsten
manuellen Wochenwechsel).

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
**Training-Tab:** Wochenstruktur, Pillen-Nav, Satz-Bewertung (auto+manuell), Gewichtsempfehlung (seit v165 auch Distanz/Zeit-Progression für metric 'm'/'sec' via getMetricRecommendation(), B18; seit v172 pro-Übung-Schrittweite statt fixem Delta, B48), Schrittweite-Vorschlag aus Historie (v173, B49, nur sichtbarer Hinweis), anpassbare Steigerungsmenge im Empfehlungs-Chip (v173, B50), Progressions-Präferenz, PR-Erkennung, "Heute anders", Übung archivieren, Stoppuhr, Auto-Wochenerstellung, Deload/Urlaubsmodus, Körpergewicht, Schlaf+Energie, Share-Bild bei echtem PR (v186, B68 — Tagesabschluss-Screen; v189, B73 — zusätzlich sofortiger Toast direkt nach dem PR-Satz), Pre-Session Check-in + Session Briefing (v192, B76 — Zwei-Tap Schlaf/Energie-Check-in am heutigen Tag, Briefing mit Fokus-Übung + RPE-Ziel, -10%-Gewichtsreduktion bei schlechter Tagesform, per Settings-Toggle "Session Coach" abschaltbar), Intra-Session Coach (v193, B77 — Feedback direkt unter jedem bewerteten Satz: Gewichts-/Pause-Empfehlung nach RPE-Bereich bzw. Erfolg/Fehlschlag ohne RPE, Abschluss-Nachricht mit Nächste-Woche-Projektion, Weiterer-Satz-Vorschlag bei RPE≤6, Aufwärm-Empfehlung 50/70/85%, erweiterte Favoriten-RPE-Nudge — alles über denselben "Session Coach"-Toggle abschaltbar), Session Summary (v194, B79 — Vollbild-Screen direkt nach Tagesabschluss vor dem bestehenden Tagesabschluss-Screen: bis zu 3 Übungs-Highlights, 1-2-Satz-Einordnung nach Prioritätskaskade, Vorschau nächstes Training; einmalige Schlaf-Erfolgsquote-Korrelation wenn nachweisbar und genug Historie vorhanden).

**Wochenrückblick-Modal:** Zusammenfassung/Highlights/Lowlights/Empfehlungen (weekReview.js/weekReviewModal.js), Share-Bild-Button (v186, B68; Sparkline-Redesign v187, B71; Favoriten-Kaskade v189, B73) — auch im manuellen Wochenrückblick-Dropdown im Fortschritt-Tab (v188, B72).

**Coach-Tab:** Hauptkarte (8 akute Signale, seit v160 inkl. Konsistente Fehlschläge) + Strukturkarte (5 strukturelle Signale, seit v163 inkl. Mehr-Übungen-Aggregation, seit v194/B79 inkl. Compound/Isolation-Balance), Adaptive Nachfrage-Karte, Coach-Bilanz Mini, Plateau-Konsequenz (EX_SET_NEXT_WEEK_PLAN), Deload-Plan-Tabelle mit "Plan übernehmen" bei aktiver präventiver Deload-Karte (v194, B79).

**Fortschritt-Tab:** Erkenntnisse (geclampt), Gesamtperformance, Push/Pull-Ratio, Übungsfortschritt-Chart mit Prognose, Streak (neutral), Abzeichen-Galerie, Körpergewicht-Chart, Bewegungsschaubild, Coach-Bilanz, Relative Stärke / Pound-for-Pound (`renderRelativeStrengthChart()`, progressChart.js + `_weeklyP4PSeries()`, ui.js — war fälschlich noch unter "Offen/Konzept" gelistet, Doku-Drift im Deep-Check-Audit v169 gefunden).

**Technisch:** iOS Safe Area, Auto-Backup, Service Worker (user-gated Update), movementMap (+32 englische Synonyme), isFullSuccess(), consistencyUtils.js.

### Offen / In Arbeit:
| Feature | Priorität |
|---------|-----------|
| Muskelkater als Coach-Input | Konzept |
| Aufwärmen/Cooldown-Check | Konzept |
| Coaching-Filter | Konzept |
| Wilks Score (relative Stärke als P4P ist bereits implementiert, siehe oben — Wilks-Formel selbst nicht) | Konzept |
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
5. Versions-Anzeige in den Einstellungen (`ui.js`, Settings-Tab "Info"-Sektion,
   `<div class="settings-row__desc">TRAIN train-vXXX</div>`) — hartkodierter
   String, kein gemeinsamer Konstanten-Import mit sw.js möglich (sw.js läuft
   als Classic Script, kein ES-Modul, siehe registerSW.js). War bis train-v180
   seit train-v175 nicht mehr mitgezogen worden (Fund aus Cross-AI-Review
   Runde 3) — deshalb jetzt explizit im Checklist, nicht mehr nur implizit
   über CACHE_VERSION mitgemeint.
