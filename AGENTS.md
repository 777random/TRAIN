# TRAIN — Parallel Agent Regeln
# Wird nach jedem Multi-Agent Sprint
# automatisch aktualisiert.
# Letzte Aktualisierung: 2026-07-12 / train-v154

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

Erzeugt durch Parsen aller `import`-Statements in den 23 JS-Dateien im
Repo-Root (Stand Commit 10c7686, train-v154). `sw.js` importiert nichts
als ES-Modul — es ist der Service-Worker-Scope, wird über
`registerSW.js:22` (`navigator.serviceWorker.register('./sw.js')`) als
Ganzes registriert, nicht via `import`. `index.html` ist kein Modul,
sondern der Einstiegspunkt, der `state.js`, `backup.js`, `ui.js`,
`timer.js`, `registerSW.js` direkt importiert.

| Datei | Importiert | Wird importiert von |
|-------|-----------|---------------------|
| state.js | — | backup.js, consistencyUtils.js, timer.js, triggerEngine.js, ui.js, weeklyFocus.js, index.html |
| icons.js | — | ui.js |
| setUtils.js | — | plateauDetector.js, weeklyFocus.js, weightRecommendation.js |
| movementMap.js | — | overallPerformance.js, ui.js, weeklyFocus.js |
| progressChart.js | — | ui.js |
| weekReview.js | — | ui.js |
| weekReviewModal.js | — | ui.js |
| exerciseNameCleanup.js | — | ui.js |
| registerSW.js | — | index.html |
| dragdrop.js | — | **keine** (nirgends importiert, auch nicht in sw.js-Precache — vermutlich totes Legacy-Modul, siehe Hinweis unten) |
| recommendationEngine.js | — | **keine** JS-Importe (nur in sw.js:41 Precache-Liste referenziert — wird gecacht, aber nie ausgeführt) |
| backup.js | state.js | ui.js, index.html |
| timer.js | state.js | index.html (kein JS-Modul importiert es, nur der Einstiegspunkt) |
| plateauDetector.js | setUtils.js | insightEngine.js, weeklyFocus.js |
| weightRecommendation.js | setUtils.js | insightEngine.js, ui.js, weeklyFocus.js |
| insightEngine.js | weightRecommendation.js, plateauDetector.js | consistencyUtils.js, overallPerformance.js, progressInsights.js, triggerEngine.js |
| triggerEngine.js | insightEngine.js, state.js | ui.js |
| consistencyUtils.js | state.js, insightEngine.js | overallPerformance.js, weeklyFocus.js |
| progressInsights.js | insightEngine.js | overallPerformance.js, ui.js |
| overallPerformance.js | insightEngine.js, consistencyUtils.js, progressInsights.js, movementMap.js | ui.js, weeklyFocus.js |
| weeklyFocus.js | state.js, plateauDetector.js, weightRecommendation.js, setUtils.js, consistencyUtils.js, overallPerformance.js, movementMap.js | ui.js |
| ui.js | state.js, backup.js, icons.js, triggerEngine.js, weightRecommendation.js, progressChart.js, weekReview.js, weekReviewModal.js, weeklyFocus.js, exerciseNameCleanup.js, progressInsights.js, movementMap.js, overallPerformance.js | — (Einstiegspunkt via index.html) |
| sw.js | — (kein ES-Import; referenziert Dateipfade als Precache-Liste) | — (via registerSW.js als Service Worker registriert, kein JS-Import) |

**Abhängigkeitstiefe (0 = keine internen Imports, aufsteigend = mehr
Kettenglieder bis zum Blatt):**
```
Tiefe 0: state.js, icons.js, setUtils.js, movementMap.js, progressChart.js,
         weekReview.js, weekReviewModal.js, exerciseNameCleanup.js,
         registerSW.js, dragdrop.js*, recommendationEngine.js*
Tiefe 1: backup.js, timer.js, plateauDetector.js, weightRecommendation.js
Tiefe 2: insightEngine.js
Tiefe 3: triggerEngine.js, consistencyUtils.js, progressInsights.js
Tiefe 4: overallPerformance.js
Tiefe 5: weeklyFocus.js
Tiefe 6: ui.js   ← importiert am meisten, höchstes Blast-Radius-Risiko
```
*dragdrop.js/recommendationEngine.js haben Tiefe 0 nur weil sie
isoliert sind — nicht weil sie aktiv genutzte Basis-Module wären.

Diese Tabelle ist die Grundlage für alle
Parallelisierungs-Entscheidungen unten.

---

## PARALLELISIERUNGS-REGELN

### IMMER parallel möglich:

Dateipaare/-gruppen ohne direkte oder indirekte Import-Kante
zueinander — basierend auf der Matrix oben:

- **movementMap.js (reine Datenergänzung) + weekReview.js / progressChart.js
  / icons.js / exerciseNameCleanup.js** — keine gegenseitigen Imports.
  Achtung: Datenergänzung (neue MOVEMENT_MAP-Einträge), NICHT
  Export-Umbenennung — das würde die 3 Importer (overallPerformance.js,
  ui.js, weeklyFocus.js) gleichzeitig betreffen.
- **setUtils.js (falls angefasst) + movementMap.js / icons.js /
  progressChart.js / weekReview.js** — keine gegenseitigen Imports.
- **dragdrop.js + irgendeine andere Datei** — dragdrop.js hat keine
  Importer, jede Änderung dort ist isoliert (aber siehe Hinweis: die
  Datei scheint aktuell ungenutzt zu sein — vor einer Änderung prüfen,
  ob sie das überhaupt noch sein soll).
- **recommendationEngine.js + irgendeine andere Datei** — dieselbe
  Situation wie dragdrop.js (nur Precache, kein aktiver Import).
- **BUGS.md / HANDOFF.md / DECISIONS.md / CLAUDE.md + jede JS-Datei** —
  Markdown-Dokumente werden von keinem JS-Modul importiert.
- **Mehrere Test-JSON-Dateien** (z.B. unter "Testing - Simulation/") —
  keine Code-Abhängigkeiten untereinander.
- **styles.css + jede JS-Datei außer ui.js**, sofern die CSS-Änderung
  keine neuen Klassennamen einführt, die ui.js erst noch rendern muss
  (reine Style-Anpassung an bestehenden Klassen ist unkritisch).

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
- **insightEngine.js + eine seiner 4 Importer** (consistencyUtils.js,
  overallPerformance.js, progressInsights.js, triggerEngine.js) —
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
