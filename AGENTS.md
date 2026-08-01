# TRAIN — Parallel Agent Regeln
# Wird nach jedem Multi-Agent Sprint
# automatisch aktualisiert.
# Letzte Aktualisierung: 2026-08-01 / train-v224 (Runde-3-Tiefentest-Fix-Sprint,
# B152-B157 — neues Muster 9 ergänzt: 3 Cluster, alle disjunkt, KEIN state.js
# involviert, komplett in EINER Runde parallel statt vorsorglich sequenziell,
# siehe HANDOFF.md)

---

## GRUNDREGEL

Parallele Agents nur wenn:
1. Jeder Agent schreibt in andere Dateien
2. Keine gemeinsamen Imports die
   zur Laufzeit kollidieren
3. CACHE_VERSION wird von genau
   einem Agent am Ende erhöht

Bei Zweifel: sequenziell ist sicherer.

---

## DATEI-ABHÄNGIGKEITS-MATRIX

Erzeugt durch Parsen aller `import`-Statements in den 24 JS-Dateien im
Repo-Root (Stand Commit 10c7686, train-v154; shareImage.js seit train-v186
ergänzt). `sw.js` importiert nichts
als ES-Modul — es ist der Service-Worker-Scope, wird über
`registerSW.js:22` (`navigator.serviceWorker.register('./sw.js')`) als
Ganzes registriert, nicht via `import`. `index.html` ist kein Modul,
sondern der Einstiegspunkt, der `state.js`, `backup.js`, `ui.js`,
`timer.js`, `registerSW.js` direkt importiert.

| Datei | Importiert | Wird importiert von |
|-------|-----------|---------------------|
| state.js | — | backup.js, consistencyUtils.js, timer.js, triggerEngine.js, ui.js, weeklyFocus.js, weekReview.js (seit train-v170, siehe unten), index.html |
| icons.js | — | ui.js |
| setUtils.js | — | plateauDetector.js, weeklyFocus.js, weightRecommendation.js, weekReview.js (seit train-v170, siehe unten), ui.js (seit train-v171 — B45-Konsolidierung: `weekSuccessCounts()`) |
| movementMap.js | — | overallPerformance.js, ui.js, weeklyFocus.js, sessionSummary.js (seit train-v194 — B79), timer.js (seit train-v204 — Sprint C1: isCompoundExercise() für Pausenzeiten-Empfehlung) |
| exerciseAlternatives.js | — | ui.js (seit train-v222 — B138: `getAlternatives()` für die Alternativ-Chips im "Heute anders"-Dialog) |
| progressChart.js | — | ui.js |
| sessionCoach.js | — | ui.js, timer.js (beide seit train-v193 — B77: `buildSetFeedback()`/`buildLastSetMessage()`/`buildWarmupSets()`, importfrei/Tiefe 0, siehe DECISIONS.md für die bewusste Ausnahme von der "NIEMALS ui.js↔timer.js"-Regel) |
| weekReview.js | setUtils.js, state.js (seit train-v170 — B44/B45-Konsolidierung: `isTrainingDay()` für `_reachableDays()`, `weekSuccessCounts()` für `_calcSuccessScore()`; seit train-v190/B74 zusätzlich `calcCurrentStreak()` für `_calcStreak()`; alle reine, zustandslose Funktionen, kein `getState()`/`dispatch()` — Datei ist weiterhin "State-frei" im ursprünglich gemeinten Sinn) | ui.js |
| weekReviewModal.js | shareImage.js (seit train-v186 — B68: Teilen-Button im Wochenrückblick-Modal, ruft `buildWeekShareCanvas()`/`shareCanvas()` direkt auf), insightEngine.js (seit train-v187 — B71: `getSortedWeeks`/`exWeightHistory` für die Sparkline-Datenquelle) | ui.js |
| shareImage.js | — | ui.js, weekReviewModal.js (beide seit train-v186 — B68) |
| exerciseNameCleanup.js | — | ui.js |
| registerSW.js | — | index.html |
| dragdrop.js | — | **kein ES-Import** — seit train-v156 aber per `<script src="./dragdrop.js">` klassisch in index.html geladen (vor dem Module-Script) und in sw.js precached. Kein JS-Modul importiert es, aber es ist jetzt aktiv ladungsrelevant, nicht mehr totes Legacy-Modul. |
| backup.js | state.js | ui.js, index.html |
| timer.js | state.js, sessionCoach.js (seit train-v193 — B77, siehe oben), movementMap.js (seit train-v204 — Sprint C1: isCompoundExercise()) | index.html (kein JS-Modul importiert es, nur der Einstiegspunkt) |
| plateauDetector.js | setUtils.js | insightEngine.js, weeklyFocus.js |
| weightRecommendation.js | setUtils.js | insightEngine.js, ui.js, weeklyFocus.js |
| sessionSummary.js | insightEngine.js, setUtils.js, movementMap.js (seit train-v194 — B79: `buildSessionHighlights()`/`buildSessionEinordnung()`/`buildNextSessionPreview()`/`calcSleepCorrelation()`, kein ui.js-Import — lokal duplizierter Kategorie-Filter, Muster wie weeklyFocus.js' Push/Pull-Duplikation) | ui.js |
| insightEngine.js | weightRecommendation.js, plateauDetector.js | consistencyUtils.js, overallPerformance.js, progressInsights.js, triggerEngine.js, ui.js (seit train-v173 — B49: `getSortedWeeks`, `exWeightHistory`, `exMetricHistory`, `detectRecurringStep` für den Schrittweite-Vorschlag), weekReviewModal.js (seit train-v187 — B71), sessionSummary.js (seit train-v194 — B79) |
| triggerEngine.js | insightEngine.js, state.js | ui.js |
| consistencyUtils.js | state.js, insightEngine.js | overallPerformance.js, weeklyFocus.js |
| progressInsights.js | insightEngine.js | overallPerformance.js, ui.js |
| overallPerformance.js | insightEngine.js, consistencyUtils.js, progressInsights.js, movementMap.js | ui.js, weeklyFocus.js |
| weeklyFocus.js | state.js, plateauDetector.js, weightRecommendation.js, setUtils.js, consistencyUtils.js, overallPerformance.js, movementMap.js | ui.js |
| ui.js | state.js, backup.js, icons.js, triggerEngine.js, weightRecommendation.js, progressChart.js, weekReview.js, weekReviewModal.js, weeklyFocus.js, exerciseNameCleanup.js, progressInsights.js, movementMap.js, overallPerformance.js, insightEngine.js (seit train-v173), setUtils.js (seit train-v171), shareImage.js (seit train-v186 — B68), sessionCoach.js (seit train-v193 — B77), sessionSummary.js (seit train-v194 — B79) | — (Einstiegspunkt via index.html) |
| sw.js | — (kein ES-Import; referenziert Dateipfade als Precache-Liste) | — (via registerSW.js als Service Worker registriert, kein JS-Import) |

**Abhängigkeitstiefe (0 = keine internen Imports, aufsteigend = mehr
Kettenglieder bis zum Blatt):**
```
Tiefe 0: state.js, icons.js, setUtils.js, movementMap.js, progressChart.js,
         exerciseNameCleanup.js, shareImage.js (seit train-v186 — B68),
         sessionCoach.js (seit train-v193 — B77), registerSW.js, dragdrop.js*,
         exerciseAlternatives.js (seit train-v222 — B138)
Tiefe 1: backup.js, timer.js (importiert jetzt state.js + sessionCoach.js,
         beide Tiefe 0, bleibt daher Tiefe 1), plateauDetector.js,
         weightRecommendation.js, weekReview.js (seit train-v170 —
         importiert jetzt setUtils.js/state.js, war vorher Tiefe 0)
Tiefe 2: insightEngine.js
Tiefe 3: triggerEngine.js, consistencyUtils.js, progressInsights.js,
         weekReviewModal.js (seit train-v187 — B71: importiert jetzt
         insightEngine.js für exWeightHistory(), war seit v186 Tiefe 1),
         sessionSummary.js (seit train-v194 — B79: importiert
         insightEngine.js, setUtils.js, movementMap.js)
Tiefe 4: overallPerformance.js
Tiefe 5: weeklyFocus.js
Tiefe 6: ui.js   ← importiert am meisten, höchstes Blast-Radius-Risiko
```
*dragdrop.js hat Tiefe 0 nur weil es isoliert ist — nicht weil es ein
aktiv aus anderen Modulen genutztes Basis-Modul wäre. Seit train-v156
per `<script src="./dragdrop.js">` in index.html geladen (kein ES-Import,
daher taucht es in keiner "Importiert von"-Spalte auf, obwohl es jetzt
aktiv genutzt wird — siehe HANDOFF.md).

(recommendationEngine.js wurde in train-v156 entfernt — war ungenutzt,
Inhalt bereits redundant in insightEngine.js. Kein Eintrag mehr hier.)

Diese Tabelle ist die Grundlage für alle
Parallelisierungs-Entscheidungen unten.

---

## PARALLELISIERUNGS-REGELN

### IMMER parallel möglich:

Dateipaare/-gruppen ohne direkte oder indirekte Import-Kante
zueinander — basierend auf der Matrix oben:

- **movementMap.js (reine Datenergänzung ODER Wertkorrektur an
  bestehenden Keys) + weekReview.js / progressChart.js / icons.js /
  exerciseNameCleanup.js** — keine gegenseitigen Imports.
  Achtung: Datenergänzung/Wertkorrektur, NICHT Export-Umbenennung oder
  Entfernen eines Keys — das würde die 3 Importer (overallPerformance.js,
  ui.js, weeklyFocus.js) gleichzeitig betreffen.
- **movementMap.js (Wertkorrektur an bestehenden Keys) + ui.js**, WENN die
  gleichzeitige ui.js-Änderung nicht selbst category-abhängige Logik für
  genau die geänderten Übungsnamen einführt/ändert — siehe "Muster 4"
  unten für den verifizierten Beleg (train-v157) und die genaue
  Abgrenzung. Trotz Import-Kante (ui.js importiert movementMap.js) in
  diesem eingeschränkten Fall sicher.
- **setUtils.js (falls angefasst) + movementMap.js / icons.js /
  progressChart.js / weekReview.js** — keine gegenseitigen Imports.
- **dragdrop.js + irgendeine andere Datei** — dragdrop.js hat keine
  ES-Modul-Importer, jede Änderung dort ist isoliert. Seit train-v156
  aber via `<script src="./dragdrop.js">` in index.html geladen — eine
  gleichzeitige Änderung an index.html selbst zählt als Kollision (siehe
  "NIE parallel" unten), nur die JS-Datei dragdrop.js allein bleibt frei
  parallelisierbar.
- **BUGS.md / HANDOFF.md / DECISIONS.md / CLAUDE.md + jede JS-Datei** —
  Markdown-Dokumente werden von keinem JS-Modul importiert.
- **Mehrere Test-JSON-Dateien** (z.B. unter "Testing - Simulation/") —
  keine Code-Abhängigkeiten untereinander.
- **styles.css + jede JS-Datei außer ui.js**, sofern die CSS-Änderung
  keine neuen Klassennamen einführt, die ui.js erst noch rendern muss
  (reine Style-Anpassung an bestehenden Klassen ist unkritisch).
- **styles.css + ui.js**, WENN keine gemeinsamen Klassen-Definitionen
  betroffen sind — d.h. der ui.js-Agent führt keine neuen Klassennamen
  ein, die der CSS-Agent gleichzeitig stylen müsste, und der CSS-Agent
  ändert nur bestehende Klassen ohne Umbenennung/Entfernen. Siehe
  Muster 6 unten (2026-07-26, train-v210) für den konkreten Beleg —
  präziser als die reine Datei-Abhängigkeits-Matrix nahelegt (ui.js
  importiert styles.css zwar nicht als ES-Modul, rendert aber Markup,
  das auf CSS-Klassennamen angewiesen ist — die Matrix-Kante existiert
  nur "durch Konvention", nicht durch `import`, ist aber real).

Grundmuster: zwei Dateien sind sicher parallel, wenn keine der beiden
in der Spalte "Importiert" der anderen auftaucht UND keine dritte
Datei beide gleichzeitig importiert und von beiden Änderungen
gleichzeitig abhängt (z.B. wäre movementMap.js + weeklyFocus.js
riskant, weil ui.js beide importiert und eine Export-Änderung in
movementMap.js weeklyFocus.js UND ui.js gleichzeitig treffen könnte).

### NIE parallel:

- **state.js + irgendeine importierende Datei** (backup.js,
  consistencyUtils.js, timer.js, triggerEngine.js, ui.js,
  weeklyFocus.js) — state.js hat die meisten Importer aller Module,
  eine State-Shape-Änderung kollidiert mit praktisch jedem anderen
  gleichzeitigen Write.
- **ui.js + weeklyFocus.js** (ui.js importiert computeWeeklyFocus/
  computeStructuralSignals direkt) — inkonsistente Funktions-Signatur
  bei gleichzeitiger Änderung.
- **ui.js + overallPerformance.js** (ui.js importiert
  computeQualityTrend/computeConsistencyTrend/computeVolumeTrend/
  computeBreadthProgress direkt).
- **weeklyFocus.js + overallPerformance.js / consistencyUtils.js /
  setUtils.js / weightRecommendation.js / plateauDetector.js /
  movementMap.js** — alle sechs werden von weeklyFocus.js importiert;
  Signatur-Änderungen dort brechen weeklyFocus.js sofort.
- **insightEngine.js + eine seiner 5 Importer** (consistencyUtils.js,
  overallPerformance.js, progressInsights.js, triggerEngine.js,
  weekReviewModal.js seit train-v187/B71) —
  insightEngine.js hat selbst die zweitmeisten Importer nach state.js.
- **setUtils.js + eine seiner 3 Importer** (plateauDetector.js,
  weeklyFocus.js, weightRecommendation.js) — isFullSuccess() ist die
  zentrale, in Abschnitt 5 des Advisor-Exports als knapp dokumentiert
  identifizierte Funktion; Signaturänderungen dort sind besonders
  riskant.
- **Zwei Agents die CACHE_VERSION erhöhen** (sw.js) — Race Condition,
  einer überschreibt den anderen.
- **Zwei Agents die dieselbe Funktion in ui.js ändern** (ui.js ist mit
  Abstand die größte Datei, 324KB — Kollisionswahrscheinlichkeit
  zwischen zwei gleichzeitigen ui.js-Agents ist real, auch bei
  "verschiedenen Funktionen", wegen gemeinsamer module-level State-
  Variablen wie `_activeDayIdx`, `_overviewMode`).
- **index.html + sw.js** (CSS-Version + CACHE_VERSION müssen konsistent
  im selben Commit steigen) bzw. **index.html + registerSW.js** (SW-
  Registrierungslogik muss zur aktuellen sw.js-Version passen).
- **sessionCoach.js + eine seiner 2 Importer** (ui.js, timer.js, beide
  seit train-v193/B77) — Signaturänderungen an `buildSetFeedback()`/
  `buildLastSetMessage()`/`buildWarmupSets()` brechen sofort beide
  Aufrufer, die zudem in unterschiedlichen Dateien liegen (leicht zu
  übersehen bei einer nur-ui.js-fokussierten Änderung).
- **sessionSummary.js + ui.js** (seit train-v194/B79) — Signaturänderungen
  an `buildSessionHighlights()`/`buildSessionEinordnung()`/
  `buildNextSessionPreview()`/`calcSleepCorrelation()` brechen sofort den
  neuen Session-Summary-Screen in ui.js.
- **weeklyFocus.js + sessionSummary.js gleichzeitig an derselben
  Deload-Logik** — `_checkPreventiveDeload()` (weeklyFocus.js) und die
  Deload-Plan-Tabelle (ui.js, liest `deloadSignal`/`deloadFactor`) sind
  eng gekoppelt; eine Änderung an `_checkPreventiveDeload()`s Rückgabeform
  ohne gleichzeitige Anpassung des Deload-Plan-Renderings in ui.js bricht
  die Tabelle still (kein Crash, nur falsche/keine Anzeige).

### KONSOLIDIERUNGS-AGENT (immer letzter):

Nach allen parallelen Agents übernimmt EIN einzelner Agent:
1. CACHE_VERSION auf nächste Version (sw.js)
2. CSS `?v=N` in index.html erhöhen
3. HANDOFF.md aktualisieren
4. BUGS.md aktualisieren
5. `git add -A && git commit && git push`

---

## BEWÄHRTE PARALLEL-MUSTER

### Muster 1 — Diagnose parallel:
```
Agent 1: Diagnose Bug A (nur lesen)
Agent 2: Diagnose Bug B (nur lesen)
Agent 3: Diagnose Bug C (nur lesen)
→ Alle Ergebnisse gleichzeitig
→ Dann sequenziell fixen
```
Sicher weil: nur lesend, keine Schreibkonflikte.

### Muster 2 — Unabhängige Features:
```
Agent 1: styles.css (UI-Fix)
Agent 2: movementMap.js (neue Übungen)
Agent 3: Test-JSONs generieren
→ Konsolidierungs-Agent zuletzt
```

### Muster 3 — Coach-Signale:
```
Agent 1: weeklyFocus.js (neues Signal)
Agent 2: progressInsights.js (neue Regel)
→ NICHT: beide in weeklyFocus.js
```
Hinweis zur Matrix: progressInsights.js importiert insightEngine.js,
nicht weeklyFocus.js, und wird selbst nicht von weeklyFocus.js
importiert — die beiden Dateien haben tatsächlich keine direkte Kante,
das Muster ist durch die Analyse bestätigt.

### Muster 4 — ui.js + movementMap.js + tests/fixtures/ (ERSTER ECHTER
MULTI-AGENT-SPRINT, verifiziert 2026-07-12, train-v157):
```
Agent 1: ui.js (Erfolgsquote-Formeln in zwei Funktionen vereinheitlicht)
Agent 2: tests/fixtures/ (neuer Ordner, README + 5 JSON-Dateien)
Agent 3: movementMap.js (Wertkorrektur an 5 bestehenden Einträgen)
→ Konsolidierungs-Agent zuletzt (Regressionstest, Version, Docs, Commit)
```
Ergebnis: keine Kollision, Regressionstest 10/10 grün nach dem Merge.

### Muster 5 — ui.js + index.html/styles.css (verifiziert 2026-07-13,
train-v167):
```
Agent 1: ui.js (Push/Pull-Ratio-Zählformel vereinheitlicht, B32)
Agent 2: index.html + styles.css (Lighthouse-Accessibility-Fixes, B33)
→ Konsolidierungs-Agent zuletzt (Version, Docs, Commit)
```
Ergebnis: keine Kollision, Regressionstest 10/10 grün + Playwright 18/18
grün nach dem Merge. Kein Eintrag vorher in der "IMMER parallel möglich"-
Liste explizit für dieses Paar (nur "styles.css + jede JS-Datei AUSSER
ui.js" war dort bereits abgedeckt — schließt ui.js selbst ausdrücklich
aus) — hier trotzdem sicher, weil Agent 1 ausschließlich in ui.js und
Agent 2 ausschließlich in index.html/styles.css schrieb, disjunkte
Dateimengen ohne inhaltliche Berührung (Agent 2s Änderungen führten
keine neuen Klassennamen ein, die ui.js hätte rendern müssen — reine
Kontrastwert-Änderung einer bestehenden CSS-Variable + kein index.html-
Markup-Fix, da die beiden gefundenen ARIA-Probleme tatsächlich in
`_buildScaffold()` in ui.js liegen und außerhalb des Scopes blieben).
Präzisere Regel analog zu Muster 4: **ui.js + index.html/styles.css
sind parallel sicher, wenn die CSS/HTML-Änderung keine neuen
Klassennamen/IDs einführt, auf die eine gleichzeitige ui.js-Änderung
angewiesen wäre, und umgekehrt keine der beiden Änderungen Markup
anfasst, das die andere Datei tatsächlich erzeugt** (hier: die
ARIA-Probleme steckten in ui.js selbst, nicht in index.html — wichtig
das vor der Umsetzung zu prüfen, sonst hätte Agent 2 fälschlich versucht,
in ui.js-generiertes Markup über index.html zu "reparieren").

**Wichtige Matrix-Nuance, die dieser Sprint konkret bestätigt hat:**
movementMap.js wird von ui.js importiert — nach der bisherigen Formel
("sicher parallel wenn keine der beiden Dateien in der 'Importiert'-
Spalte der anderen auftaucht") wäre ui.js + movementMap.js also NICHT
uneingeschränkt sicher gewesen. In diesem konkreten Fall war es trotzdem
unproblematisch, weil Agent 3 ausschließlich WERTE bestehender
MOVEMENT_MAP-Einträge geändert hat (keine Export-Umbenennung, kein Key
entfernt) und Agent 1s ui.js-Änderungen (Zähl-Formeln in
_getDayCompletionStats/_renderMovementPattern) an keiner Stelle vom
konkreten Wert eines bestimmten MOVEMENT_MAP-Eintrags abhingen. Präzisere
Regel: **movementMap.js-Wertänderungen an bestehenden Keys sind parallel
zu ui.js sicher, wenn die gleichzeitige ui.js-Änderung nicht selbst
category-abhängige Logik für genau die geänderten Übungsnamen einführt
oder ändert.** Reine Formel-/Aggregations-Änderungen (wie hier) sind
unkritisch; eine ui.js-Änderung, die z.B. neue Kategorie-spezifische
Schwellenwerte einführt, wäre es nicht.

### Muster 6 — styles.css + ui.js, zwei Diagnose-Agents parallel
(verifiziert 2026-07-26, train-v210):
```
Agent 1: styles.css (B102 — Feedback-Spacing-Diagnose + ggf. Fix)
Agent 2: ui.js (B103 — Settings-Overlay-Diagnose + ggf. Fix)
→ Konsolidierungs-Agent zuletzt (Version, Docs, Commit)
```
Ergebnis: keine Kollision — beide Agents kamen unabhängig zum Ergebnis
"nicht reproduzierbar, kein Code-Fix nötig" (beide Fix-Vorlagen passten
nicht zur tatsächlichen Architektur). Agent 1 hat einzig eine neue
Testdatei ergänzt (`tests/set_feedback_spacing.spec.js`), Agent 2 hat
`ui.js` inhaltlich unverändert gelassen. **Wichtige Einschränkung
dieses Belegs:** da keiner der beiden Agents tatsächlich Code in seiner
Datei geändert hat, ist dies KEIN Beleg für einen echten simultanen
Schreibkonflikt-Test (anders als Muster 4/5, wo beide Agents wirklich
gleichzeitig Code änderten) — nur ein Beleg dafür, dass disjunkte
Diagnose-Scopes (styles.css lesen+minimal testen / ui.js lesen+minimal
testen) sich nicht gegenseitig beeinflusst haben. Die Grundregel aus
Muster 5 (keine neuen Klassennamen/IDs, auf die die jeweils andere
Seite angewiesen wäre) bleibt die eigentliche Sicherheits-Bedingung für
einen künftigen Sprint, in dem BEIDE Agents tatsächlich Code ändern.

### Muster 7 — 4 Agents in 2 Runden, alle in ui.js aber disjunkte
Funktionen + je eigene Zusatzdatei (verifiziert 2026-07-26, train-v211,
Onboarding-Sprint B105-B108):
```
Runde 1 (parallel):
  Agent 1: ui.js _obPhase==='privacy'-Block (Onboarding) + styles.css .ob-backup-warn
  Agent 2: weeklyFocus.js _fallback() + ui.js renderCoachTab()-Focus-Card + styles.css neue Klasse
Runde 2 (parallel, erst nach Runde 1 gemerged):
  Agent 3: ui.js Template-Card-Rendering (Onboarding) + styles.css neue Klasse
  Agent 4: ui.js _structuralSignalHtml()+Structural-Card-Caller (Coach-Tab) + styles.css neue Klassen
→ Konsolidierungs-Agent zuletzt
```
Ergebnis: keine Kollision, alle 4 Diffs disjunkt bestätigt (`git diff` nach
jeder Runde geprüft, bevor die nächste startete). Bestätigt/verfeinert die
"Zwei Agents die dieselbe Funktion in ui.js ändern"-Warnregel unten:
**vier** Agents durften gleichzeitig(-ish) in ui.js schreiben, weil jeder
eine andere, nicht-überlappende Funktion/Region traf (Onboarding-Overlay
vs. Coach-Tab-Rendering, und innerhalb dieser wieder unterschiedliche
Teilfunktionen) — die Regel bezieht sich auf dieselbe Funktion/denselben
Abschnitt, nicht auf die Datei als Ganzes. Sicherheitsnetz war trotzdem
die Zwei-Runden-Sequenzierung (Runde 2 erst nach Runde 1) statt aller 4
Agents gleichzeitig — bewusst vorsichtiger als nötig gewesen sein könnte,
aber jede Runde für sich war bereits verifiziert konfliktfrei. Ein
Agent (Agent 4) musste seinen Scope beim Umsetzen leicht erweitern (von
nur `_structuralSignalHtml()` auf zusätzlich dessen unmittelbare
Caller-Stelle in `renderCoachTab()`), weil das Rückgabeobjekt dort
escaped gerendert wird (`h(item.text)`) — kein rohes HTML einschleusbar.
Präzisere Regel: **eine Funktion + ihre unmittelbare, escaped-rendernde
Caller-Stelle gelten als eine Einheit für die Scope-Zuweisung**, falls
neues Markup (nicht nur Text) eingefügt werden soll.

### Muster 8 — 4 Runden für 9 Befunde, state.js zuerst und allein, danach bis
zu 3 Agents parallel pro Runde (verifiziert 2026-07-29, train-v223,
Pre-Launch-Fix-Sprint B143-B151):
```
Runde 1 (solo, EIN Agent): state.js SET_UPDATE (Status-Neubewertung +
  Gewichts-Floor) + gekoppelter ui.js-Teil (Plate-Rechner-Defaults/-Gating)
→ git diff geprüft, Playwright-Baseline (Batch-Läufe, s.u.) grün, erst dann
  Runde 2 gestartet.
Runde 2 (3 parallel): weekReview.js, backup.js, insightEngine.js
  — bewusst gewählt, weil keine der drei Dateien state.js importiert
  (weekReview.js/backup.js zwar schon, aber state.js war zu diesem
  Zeitpunkt bereits fertig und gemergt — die NIE-parallel-Regel gilt für
  GLEICHZEITIGE Änderungen, nicht für sequenzielle Runden) und keine der
  drei die andere importiert.
Runde 3a (2 parallel): ui.js+weeklyFocus.js (EIN Agent für beide gekoppelten
  Dateien einer Verletzungs-Erinnerungs-Funktion) + ui.js (andere, disjunkte
  Region: confirm-sub-Handler) — zweiter Agent.
Runde 3b (2 parallel, nach 3a gemerged): ui.js+sessionSummary.js (Session-
  Summary-Titel + PR-Highlight) + ui.js (andere, disjunkte Region:
  Check-in-Copy-Texte).
→ Konsolidierungs-Agent zuletzt (Version, Docs, Commit).
```
Ergebnis: keine Kollision über alle 4 Runden, `git diff --stat` nach jeder
Runde geprüft bevor die nächste startete (wie in Muster 6/7). **Neue,
verallgemeinerte Präzisierung der Grundregel:** "state.js + jede
importierende Datei NIE parallel" bezieht sich auf GLEICHZEITIGE Agents in
DERSELBEN Runde — eine Datei, die state.js importiert, darf in einer
SPÄTEREN Runde geändert werden, nachdem state.js in einer FRÜHEREN, für sich
allein laufenden Runde bereits fertig und verifiziert ist. Das erlaubte hier,
`weekReview.js`/`backup.js` (beide state.js-Importer) bereits in Runde 2
anzufassen, statt bis zum Sprint-Ende zu warten.

**Bekannte Infra-Grenze, während dieses Sprints erstmals konkret bestätigt
(nicht Teil der Parallelisierungsregeln, aber relevant für die Verifikation
zwischen den Runden):** die volle Playwright-Suite (282 Tests nach diesem
Sprint) kann den lokalen `npx serve`-Devserver bei langen Läufen mit `EMFILE:
too many open files` abstürzen lassen (siehe CLAUDE.md) — Verifikation
zwischen den Runden lief deshalb in 3 Datei-Batches statt einem einzigen
`npx playwright test`-Aufruf. Ein scheinbarer Massenausfall (>50% der Tests,
durchgängig `net::ERR_CONNECTION_REFUSED`) nach einem langen vorherigen Lauf
ist ein Hinweis auf diese Infra-Grenze, keine echte Regression — vor jeder
Schlussfolgerung per Batch-Lauf gegenprüfen.

### Muster 9 — 3 Cluster komplett in EINER Runde parallel, weil Diagnose
state.js-Unbeteiligung vorab bestätigte (verifiziert 2026-08-01, train-v224,
Runde-3-Tiefentest-Sprint B152-B157):
```
Alle 3 Agents gleichzeitig, EINE Runde (kein Vorab-Solo-Agent nötig):
  Agent A: ui.js (~5150 Versions-Label, ~8298-8360 SW-Update-Handler) + sw.js
  Agent B: ui.js (~5979, ~6172, ~6872-6882 — 3× confirm()→In-App-Dialog)
  Agent C: ui.js (~357-387, ~7256-7259, ~9113-9310 — Onboarding + 2 Minor-Fixes)
→ Konsolidierungs-Agent zuletzt (Version, Docs, Commit)
```
Ergebnis: keine Kollision, `git diff --stat` nach allen 3 Agents geprüft — alle
Regionen exakt disjunkt wie in der Diagnose-Phase vorhergesagt. Anders als
Muster 8 (wo state.js-Arbeit vorab eine Solo-Runde brauchte) war hier VORHER
per Diagnose-Agent explizit geklärt worden, ob die vermuteten state.js-Dispatches
(`EX_REMOVE`, `DAY_REMOVE` in Cluster B) eine Datei-ÄNDERUNG an state.js
erfordern — Antwort: nein, die Dispatches selbst blieben unverändert, nur ihr
Aufruf-Guard (`confirm()` → Inline-Panel) wurde ersetzt. **Präzisierung:**
"state.js betroffen" im Sinne der Grundregel heißt "state.js wird als Datei
geändert", nicht "ein Dispatch zu state.js wird aufgerufen" — ein reiner
UI-Guard-Fix um einen unveränderten Dispatch herum zählt nicht als
state.js-Berührung und braucht daher keine exklusive Runde. Diese Unterscheidung
lohnt sich, VOR der Implementierungsplanung explizit per Diagnose-Frage zu
klären (wie hier in der Cluster-B-Diagnose geschehen), statt sie erst beim
Blick auf den fertigen Diff festzustellen.

---

## GESCHEITERTE PARALLELISIERUNGEN
# Wird nach jedem fehlgeschlagenen
# Versuch automatisch ergänzt

| Datum | Dateien | Problem | Lösung |
|-------|---------|---------|--------|
| — | — | — | — |

(Noch keine Multi-Agent-Sprints in diesem Projekt durchgeführt — alle
bisherigen Commits in der Git-Historie stammen aus sequenzieller
Einzel-Agent-Arbeit. Diese Tabelle wird beim ersten tatsächlichen
Parallel-Sprint erstmals befüllt.)

---

## AUTO-UPDATE REGEL

Claude Code aktualisiert diese Datei nach jedem Multi-Agent Sprint:

1. Neue bewährte Muster → zu "Bewährte Parallel-Muster" hinzufügen
2. Neue Konflikte → zu "Gescheiterte Parallelisierungen" hinzufügen
3. Neue Dateien im Repo → zur Datei-Abhängigkeits-Matrix hinzufügen
4. Datum + Version oben aktualisieren
