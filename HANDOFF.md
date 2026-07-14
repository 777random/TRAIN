# TRAIN — Session Handoff
*Letzte Aktualisierung: Juli 2026 nach train-v169*
*Nächste Version: train-v170*

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v169 (v155 wurde nie vergeben, siehe vorherige
  Sprint-Notiz — Nummerierung folgt echten Code-Sprints, nicht der
  Sprint-Text-Nummerierung)
- CSS: ?v=188 (unverändert diesen Sprint — nur JS angefasst,
  kein CSS-Bump nötig)
- SCHEMA: 30 (unverändert diesen Sprint)
- Letzter Commit: siehe `git log` (dieser Sprint noch nicht committet
  zum Zeitpunkt dieses Eintrags — folgt direkt im Anschluss)
- **Deep-Check-Audit vor Produktions-Release (train-v169):** auf
  Nutzer-Wunsch ("sauberes Produkt shippen, keine Bugs/Logikfehler")
  4 parallele, rein lesende Diagnose-Agents (Muster 1 aus AGENTS.md)
  haben Coach-Kaskade, Fortschritt-Tab-Berechnungen, Training-Tab-
  Bedienung und Persistenz/Migration/Backup durchleuchtet — teils per
  Code-Lesen, teils per echten Playwright-Testläufen. 10 Funde
  insgesamt, davon 5 als eindeutige, risikoarme Fixes umgesetzt
  (B36-B40), 1 mit Nutzer besprochen und bewusst nur dokumentiert
  (B41 — bräuchte größeren Umbau), 3 als Kleinkram notiert (B42/B43 +
  ein CLAUDE.md-Doku-Drift zu "Relative Stärke", das Feature ist
  entgegen der Doku bereits fertig implementiert). Jeder der 5 Fixes
  einzeln umgesetzt und einzeln mit Playwright (18/18) verifiziert,
  zusätzlich 4 pure-function-Node-Skripte gebaut (nicht committet, nach
  Verifikation gelöscht), die das tatsächliche VOR/NACH-Verhalten der
  Berechnungen zeigen (nicht nur "stürzt nicht ab"):
  - B36: `_checkPushPullBalance()` (weeklyFocus.js) zählte noch
    success-only statt success+fail wie die B32-reparierte
    Zwillingsfunktion in ui.js — Coach-Tab und Fortschritt-Tab konnten
    sich für dieselbe Woche widersprechen.
  - B37: archivierte Übungen wurden in 3 Zählstellen (2× ui.js, 1×
    weeklyFocus.js) weiterhin mitgezählt, obwohl `_weekSuccessScore()`
    sie schon korrekt ausschloss.
  - B38: `_weekConsistencyRatio()` zählte jeden nicht-Rest-Urlaubstag
    automatisch als erledigt, auch ohne jede tatsächliche Aktivität —
    im Widerspruch zur Streak-Berechnung, die für denselben Tag echte
    Aktivität verlangt.
  - B39: 4 reine Einstellungs-Aktionen fehlten in `_NO_UNDO` und konnten
    den einzigen globalen Undo-Slot blockieren — ein Einstellungs-Tap
    nach einer versehentlichen Löschung machte die Löschung
    unwiderruflich.
  - B40: Gewichtsempfehlung hatte eine unbehandelte RPE-Lücke
    (7.0–7.5) und eine Inversion (besseres RPE konnte bei gleicher
    Erfolgsquote eine schlechtere Empfehlung als schlechteres RPE
    ergeben) — mit Nutzer besprochen, Schwellen begradigt.
  Details zu allen 10 Funden siehe BUGS.md (B36-B43). Regressionstest
  10/10 grün, Playwright 18/18 grün nach jedem einzelnen Fix und im
  finalen Kombi-Lauf.
- **B34+B35 behoben (train-v168):** die beiden in B33 (v167) offen
  gebliebenen Lighthouse-ARIA-Findings, jetzt in `ui.js` selbst gefixt
  (voriger Sprint war bewusst auf index.html/styles.css beschränkt).
  B34: `<main id="page-workout" role="tabpanel">` → `<section
  id="page-workout" role="tabpanel">` (`_buildScaffold()`, ui.js) —
  `role="tabpanel"` ist für `<main>` kein zulässiger ARIA-Wert, die
  anderen 4 Tab-Seiten nutzten bereits `<section>`. Kein CSS/JS
  referenziert das Element über den Tag `main` (per Grep bestätigt),
  nur über `#page-workout` — risikofreie Änderung. B35: `<div
  id="days-container" aria-label="Trainingstage">` bekam `role="region"`
  ergänzt — macht das vorhandene `aria-label` semantisch gültig (ein
  nacktes `<div>` hat implizit `role="generic"`, das keinen
  Namen aus `aria-label` unterstützt). Ergebnis: Lighthouse
  Accessibility 95 → **100**. Regressionstest 10/10 grün, Playwright
  18/18 grün. Details siehe BUGS.md B34/B35.
- **B32 behoben (train-v167):** Push/Pull-Ratio-Block in
  `_renderMovementPattern()` (ui.js) zählte als einzige der 4
  Erfolgsquote-Stellen im UI noch nicht success+fail (seit B22/v157
  als offener Nebenfund notiert) — jetzt vereinheitlicht:
  `ex.sets.filter(s => s.status === 'success' || s.status === 'fail')`.
  `_weekSuccessScore()`/`_weekTrainingStatus()` bewusst unangetastet
  (andere Semantik). Details siehe BUGS.md B32.
- **B33 behoben (train-v167, teilweise):** Lighthouse Accessibility
  91 → 95. `--c-text-3` (styles.css) von `#72727A` auf `#90909A`
  angehoben — behebt den `color-contrast`-Fund (3.63 → ≥4.5:1 gegen
  alle 3 Hintergründe, auf denen die Variable verwendet wird). Zwei
  weitere Findings (`aria-allowed-role` auf `<main role="tabpanel">`,
  `aria-prohibited-attr` auf `<div aria-label>` ohne gültige Rolle)
  liegen in `_buildScaffold()` (ui.js) — außerhalb des für diesen
  Sprint erlaubten Scopes (nur index.html/styles.css), daher nicht
  gefixt, sondern als eigene Bugs B34/B35 (Low) neu getrackt. Details
  siehe BUGS.md B33/B34/B35.
- **B31 behoben (train-v166):** `_renderAnalysis1RM()`-Fallback zeigte
  nie ein 1RM, wenn `state.prs` noch keinen Eintrag hatte (v.a. bei
  Ausweichübungen — der Fallback ist explizit dafür gebaut, griff aber
  wegen eines Guard-Typos nie). Root Cause bereits in der Vorsession
  vollständig diagnostiziert; dieser Sprint hat nur den bereits
  empfohlenen Fix umgesetzt (`ui.js:2426` `!== 'kg'` → `!== 'reps'`) und
  verifiziert (3 Szenarien: leeres prs, Ausweichübungs-Substitution,
  Regressionsschutz für metric 'm'/'sec'). Details siehe BUGS.md B31.
- **B18 behoben (train-v165):** Coach-Gewichtsempfehlung hatte für
  metric 'm'/'sec'-Übungen (Laufen, Rudermaschine, Plank etc.) nie eine
  Empfehlung geliefert (`getWeightRecommendation()`s `lastWeight<=0`-
  Guard griff immer, da diese Übungen kein Gewicht tracken). Neue
  `getMetricRecommendation()` (weightRecommendation.js) + neues Feld
  `ex.metricStep` + `progressionType`-Default korrigiert (`'reps'`
  statt `'weight'` bei metric≠'reps'). Details siehe BUGS.md B18.
- **CI aktiv seit v162, jetzt 2 Jobs:** GitHub Actions
  (`.github/workflows/test.yml`) läuft bei jedem Push auf main.
  `regression` (Playwright, alle 16 Fixtures) + neu `lighthouse`
  (needs: regression, Lighthouse CI via `lighthouserc.cjs` —
  Accessibility blockierend ≥0.8, Performance/Best-Practices nur warn).
  Lokal getestete echte Scores (Stand train-v168): Performance 81-84,
  Accessibility 100 (B34+B35: verbleibende ARIA-Findings aus B33
  gefixt, war 95), Best Practices 96, SEO 100. Lokal testen:
  `npx playwright test` /
  `npx lhci autorun` (Node.js v24.18.0 LTS seit 2026-07-13 installiert).
  Kein Branch-Protection-Gate — der Workflow blockiert den Push nicht,
  sondern zeigt nur ein Badge-Signal danach (README.md).
- **Prompt-Bibliothek (prompts/, seit v164):** 7 wiederverwendbare
  Prompt-Vorlagen (session-start, for-advisor, sprint-template,
  diagnose-template, parallel-sprint, entscheidung-eintragen,
  nutzer-feedback). Sprint-Vorgabe sprach von "6 Dateien", listete aber
  7 im Detail — alle 7 erstellt.
- **Loop 5 (seit v164):** generiert context-exports/for-advisor.txt am
  Ende jeder Session automatisch (siehe LOOPS.md).
- Alle 12 alten Test-Szenarien verifiziert ✓ + 5 Fixture-JSONs in
  tests/fixtures/ jetzt ECHT importiert und verifiziert (nicht mehr nur
  schema-validiert) — Ergebnisse in tests/fixtures/README.md, Kurzfassung
  unter NEXT unten
- Regressions-Test: 10/10 grün (raf=sync), 0 uncaught errors
- Touch-Drag-Verhalten (dragdrop.js, v156) jetzt auf echtem Gerät
  verifiziert (2026-07-13): funktioniert NICHT (siehe B27, BUGS.md) —
  bewusst zurückgestellt, da Pfeile in den Übungseinstellungen die
  Reihenfolge bereits änderbar machen. B16 (Doppeltipp-Zoom) dagegen auf
  echtem Gerät bestanden.
- Framework-Score: 11/11
- **Erster echter Multi-Agent-Sprint dieser Session:** 3 parallele
  Fork-Agents (ui.js / movementMap.js / tests/fixtures/, disjunkt lt.
  AGENTS.md-Matrix) + 1 Konsolidierungs-Durchgang. Keine Kollision
  aufgetreten — Details in AGENTS.md "Bewährte Parallel-Muster".

---

## FILES (zuletzt angefasst)
```
weeklyFocus.js            — B36-Fix: _checkPushPullBalance() zählt jetzt
                          success+fail statt nur success (wie ui.js seit
                          B32). B37-Fix: archivierte Übungen (ex.archived)
                          werden jetzt ausgeschlossen.
ui.js                    — B37-Fix: archivierte Übungen in
                          _renderMovementPattern() (Kategorie-Balken UND
                          Push/Pull-Ratio) ausgeschlossen.
consistencyUtils.js      — B38-Fix: _weekConsistencyRatio() zählt
                          Urlaubstage nur noch bei markedDone ODER
                          mindestens 1 bewertetem Satz als erledigt,
                          nicht mehr automatisch.
state.js                 — B39-Fix: SETTING_TOGGLE/SETTING_SET/
                          AUTOWEEK_SET/TOGGLE_FAVORITE zu _NO_UNDO
                          hinzugefügt.
weightRecommendation.js  — B40-Fix: _recommendationCore() RPE-Grenze
                          7 → 7.5 erweitert (Lücke geschlossen),
                          Erfolgsquoten-Schwelle 0.9 → 0.8 gesenkt
                          (Inversion beseitigt).
CLAUDE.md                — Doku-Drift korrigiert: "Relative Stärke"
                          (P4P) war fälschlich unter "Offen/Konzept"
                          gelistet, ist aber bereits vollständig
                          implementiert (gefunden im Deep-Check-Audit).
index.html / sw.js       — CACHE_VERSION train-v169 (kein CSS-Bump,
                          styles.css nicht angefasst)
ui.js                    — B34+B35-Fix (_buildScaffold()): <main
                          id="page-workout"> → <section> (role="tabpanel"
                          ist für <main> nicht zulässig), role="region"
                          auf #days-container ergänzt (macht aria-label
                          gültig)
index.html / sw.js       — CACHE_VERSION train-v168 (kein CSS-Bump,
                          styles.css nicht angefasst)
ui.js                    — B32-Fix: _renderMovementPattern() Push/Pull-
                          Ratio-Block zählt jetzt success+fail statt nur
                          success (letzter Nebenfund aus B22)
styles.css               — B33-Fix: --c-text-3 #72727A → #90909A
                          (color-contrast 3.63 → ≥4.5:1 gegen alle 3
                          Hintergründe, auf denen die Variable verwendet
                          wird)
index.html / sw.js       — CACHE_VERSION train-v167, CSS ?v=188
ui.js                    — B31-Fix: _renderAnalysis1RM()-Fallback-Guard
                          ui.js:2426 von `!== 'kg'` auf `!== 'reps'`
                          korrigiert (1RM-Schätzung zeigte nie Daten,
                          v.a. bei Ausweichübungen)
weightRecommendation.js  — B18: _recommendationCore() extrahiert (geteilte
                          Entscheidungslogik), neue getMetricRecommendation()
                          für metric 'm'/'sec'. getWeightRecommendation()
                          Originalverhalten exakt erhalten (fixe Deltas
                          2.5/1.25, nicht step-gekoppelt — per Test abgesichert)
state.js                 — B18: EX_SET_METRIC_STEP-Action, ex.metricStep-
                          Default + progressionType-Default korrigiert
                          (EX_ADD, Urlaubspläne) für metric≠'reps'.
                          Migration v29→v30 für bestehende Übungen
ui.js                    — B18: New-Week-Modal branch't nach ex.metric
                          (getWeightRecommendation/getMetricRecommendation),
                          Skip-Guard-Bug korrigiert (hätte mit neuem
                          progressionType-Default jede Distanz/Zeit-Übung
                          übersprungen), Schrittweite-Picker + Chip/Toast/
                          Button-Beschriftungen metrikabhängig (m/Sek statt kg)
tests/fixtures/TRAIN_Test_EdgeCase_DistanceProgression.v1.json — NEU: B18-Fixture
LOOPS.md                 — NEU: Loop 5 (for-advisor.txt am Sessionende)
prompts/                 — NEU: 7 Prompt-Vorlagen (session-start,
                          for-advisor, sprint-template, diagnose-template,
                          parallel-sprint, entscheidung-eintragen,
                          nutzer-feedback)
.github/workflows/test.yml — B30: zweiter Job `lighthouse` (needs: regression)
lighthouserc.cjs         — NEU (B30): bewusst .cjs statt .js (package.json
                          "type":"module" bricht sonst lhci's require()-
                          Config-Loader). Keine categories:pwa-Assertion
                          (Lighthouse-Version hat diese Kategorie nicht mehr)
package.json             — @lhci/cli als devDependency ergänzt
context-exports/for-advisor.txt — Loop 5 ausgeführt: komplett neu generiert
                          (3. Fassung, Stand v160→v164)
CLAUDE.md                — Prompt-Bibliothek + Spec-Konvention in
                          ARBEITSREGELN ergänzt, prompts/ in Projektdokumente-
                          Tabelle, Lighthouse-Hinweis in CI-Status
weeklyFocus.js           — B29: neue Funktion _checkMultiExerciseFailure()
                          in computeStructuralSignals() eingehängt (Strukturkarte,
                          Priorität zuoberst). Kopfkommentar-Drift zur akuten
                          Kaskade korrigiert (fehlte persistent_failure seit v160)
ui.js                    — B29: _structuralSignalHtml() um 'multi_exercise_failure'
                          ergänzt (Text-only, kein Button)
tests/fixtures/TRAIN_Test_EdgeCase_MultiExerciseFailure.v1.json — NEU:
                          isolierter Test für B29 (3 Übungen à 17%, keine
                          einzelne bei 0%)
.github/workflows/test.yml — NEU: GitHub Actions CI, läuft bei jedem
                          Push/PR auf main (B28)
playwright.config.js     — NEU: testDir tests/, iPhone-14-Viewport,
                          webServer startet npx serve automatisch
tests/regression_core.spec.js — NEU: Playwright-Wrapper um
                          regression_core.html, liest <pre id="result">
                          Klartext (nicht .test-result/.pass — Vorlage
                          hatte falsche Selektoren angenommen)
tests/fixtures.spec.js   — NEU: importiert alle 15 tests/fixtures/-JSONs
                          einzeln, prüft 0 pageerror je Fixture
package.json             — NEU: devDependencies @playwright/test + serve,
                          "type":"module" (für playwright.config.js)
README.md                — NEU (existierte vorher nicht): Titel + CI-Badge
.gitignore               — node_modules/, package-lock.json,
                          test-results/, playwright-report/ ergänzt
tests/README.md          — NEU: 26 ältere Test-JSONs (direkt unter tests/,
                          nicht tests/fixtures/) validiert — alle 26 laufen
                          fehlerfrei, alle bereits schemaVersion 29, keine
                          "veraltet"-Markierung nötig, keine neuen Bugs
DECISIONS.md             — 2 neue Einträge unter COACH-LOGIK:
                          _checkPersistentFailure-Priorität + persistent_
                          failure-Decisional-Balance-Design (B26)
weeklyFocus.js            — B26: _balanceForPersistentFailure() ergänzt,
                          in buildDecisionalBalance() eingehängt.
                          _checkPersistentFailure() liefert jetzt zusätzlich
                          currentWeight/suggestedWeight mit.
ui.js                    — B26: Button-Beschriftung für persistent_failure
                          override (Stay/Change), decision-log-stay/-change
                          Handler dispatcht bei persistent_failure "change"
                          zusätzlich EX_SET_NEXT_WEEK_PLAN + eigene Toasts.
weeklyFocus.js           — B25-Fix: neue Funktion _checkPersistentFailure()
                          (Prio 2, vor Overload), in computeWeeklyFocus()
                          eingehängt. roundToPlate-Import ergänzt.
ui.js                   — _FOCUS_ICONS um 'persistent_failure': '🛑' ergänzt.
                          B17-Fix: renderSetRow() unterdrückt "Vorwoche"-
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
| B17 Fix | 6e1a203 | Eigene Fehldiagnose aus dem Edge-Case-Audit korrigiert ("positionsbasiert" war falsch — tatsächlich namensbasiert auf den falschen Namen, ex.substituteFor statt ex.name). Adopt-Hints in renderSetRow() unterdrückt wenn ex.substituteFor gesetzt ist, prevEx für Fulfill-Meter-Guard unangetastet gelassen. Re-verifiziert mit TRAIN_Test_HeuteAnders.v1.json. |
| B25 Fix (mit Nutzer besprochen) | 668b00a | Neues Coach-Signal `_checkPersistentFailure()`, Priorität 2 (nach Reentry, vor Overload), Schwelle 0% Erfolg über 3 Wochen, konkrete Gewichtsempfehlung via deloadFactor+roundToPlate(). Neues Icon 🛑. Beide AllesFail-Fixtures neu verifiziert. |
| Loop 3 Batch (9 neue Fixtures) | 5688ed3 | 15/15 Edge-Cases erreicht, beide Grenzwert-Tests (2-Wochen-Plateau, 8-Wochen-Deload) bestätigt, kein neuer Bug |
| B26 + DECISIONS.md + tests/ validiert | 48b7272 | Decisional-Balance für persistent_failure (EX_SET_NEXT_WEEK_PLAN-Dispatch, eigene Toasts), DECISIONS.md-Lücke geschlossen, 26 alte Test-JSONs in tests/ validiert (alle ✓, keine veraltet, keine neuen Bugs) |
| CLAUDE.md Versions-Sync (Loop 2) | a061df1 | train-v160/?v=184 → train-v161/?v=185, war nach dem letzten Sprint übersprungen worden |
| Geräte-Verifikation B16/dragdrop.js | ec33550 | B16 (Doppeltipp-Zoom) auf echtem Gerät bestanden. dragdrop.js Touch-Drag funktioniert weiterhin nicht — neu als B27 getrackt, bewusst zurückgestellt (Pfeile in Übungseinstellungen decken den Bedarf ab) |
| B28: GitHub Actions CI + Playwright | 6b6a7af | .github/workflows/test.yml, playwright.config.js, tests/regression_core.spec.js, tests/fixtures.spec.js, package.json, README.md (neu). Details + bewusste Abweichungen von der Sprint-Vorlage siehe BUGS.md B28 |
| B29: Mehr-Übungen-Aggregation | 221da35 | _checkMultiExerciseFailure() in weeklyFocus.js (Strukturkarte), ui.js-Rendering, neue Fixture. Design mit Nutzer besprochen (3 Fragen, siehe DECISIONS.md) vor Implementierung |
| B30: Lighthouse CI + Prompt-Bibliothek + Loop 5 | d1241a6 | .github/workflows/test.yml (2. Job), lighthouserc.cjs (neu, .cjs statt .js — ESM/CJS-Konflikt real getestet und gelöst), prompts/ (7 Dateien), LOOPS.md (Loop 5), CLAUDE.md (Prompt-Bibliothek + Spec-Konvention), for-advisor.txt neu generiert. ID/Version-Korrektur: Sprint-Vorgabe nannte B28/v163 (beide bereits vergeben) — B30/v164 verwendet |
| B18: Distanz/Zeit-Progression | 11eb62e | weightRecommendation.js (getMetricRecommendation), state.js (ex.metricStep, progressionType-Default, Migration v30), ui.js (New-Week-Modal-Branch + Skip-Guard-Fix + metrikabhängige Labels), neue Fixture. Design mit Nutzer besprochen (3 Fragen) vor Implementierung, Nebenbefund B31 dokumentiert |
| B31-Diagnose (kein Code) | 8130e98 | Root Cause bestätigt + empirisch verifiziert, Fehlverifikation aus Loop-3-Audit (v157) korrigiert |
| B31-Fix | 66455e0 | ui.js:2426 Guard korrigiert, 3 Szenarien verifiziert (leeres prs, Substitution, metric-Regressionsschutz) |
| B32+B33: Push/Pull-Ratio + Lighthouse Accessibility | e51ce3e | Zweiter echter Multi-Agent-Sprint (2 parallele Agents: ui.js allein / index.html+styles.css allein, disjunkt lt. AGENTS.md). B32: letzter Erfolgsquote-Nebenfund aus B22 behoben. B33: Lighthouse Accessibility 91→95 via `--c-text-3`-Kontrast-Fix, 2 weitere ARIA-Findings als B34/B35 dokumentiert (JS-Fix nötig, außerhalb des Scopes). CACHE_VERSION → train-v167, CSS → ?v=188 |
| B34+B35: verbleibende ARIA-Fixes | fe71d80 | Nutzer bat direkt im Anschluss, die in B33 zurückgestellten ARIA-Findings jetzt in ui.js zu fixen. `<main>` → `<section>` für #page-workout, `role="region"` auf #days-container. Lighthouse Accessibility 95→100. CACHE_VERSION → train-v168 (kein CSS-Bump) |
| Deep-Check-Audit vor Release: B36-B40 | — | Nutzer wollte vor dem Shippen sichergehen, "keine Bugs oder Logikfehler". 4 parallele read-only Diagnose-Agents (Coach-Kaskade / Fortschritt-Berechnungen / Training-Bedienung / Persistenz), 10 Funde, 5 eindeutige Fixes umgesetzt (Push/Pull-Konsistenz weeklyFocus.js↔ui.js, archivierte Übungen ausgeschlossen, Urlaubstag-Konsistenz-Widerspruch, Undo-Stack-Lücke, RPE-Schwellen-Inversion+Lücke bei Gewichtsempfehlung), 1 Fund bewusst nur dokumentiert (tote Plateau-Strategie "Variation"), 3 Kleinkram-Funde notiert. Jeder Fix einzeln mit Playwright + gezielten Node-Skripten verifiziert (tatsächliches Vor/Nach-Verhalten, nicht nur Regressionstest-grün). CACHE_VERSION → train-v169 (kein CSS-Bump) |

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

**B25 behoben in train-v160** (siehe BUGS.md) — Design mit Nutzer
besprochen (Priorität + Schwelle), dann `_checkPersistentFailure()`
implementiert und mit beiden AllesFail-Fixtures re-verifiziert.

**Bekannte Grenzen der v160-Lösung (nicht behoben, nur notiert):**
- Keine Decisional-Balance (Stay/Change-Buttons) für `persistent_failure`
  — `buildDecisionalBalance()` unterstützt bisher nur 'overload'/
  'consistencyGap'. UI zeigt einfach keine Buttons (bestehendes
  Fallback-Verhalten, kein Crash), aber ggf. für spätere Konsistenz
  nachrüsten.
- Schwelle prüft nur EINZELNE Übungen einzeln (0% über 3 Wochen für
  eine bestimmte Übung), keine wochenübergreifende Gesamt-Erfolgsquote.
  Ein Nutzer, der bei VIELEN verschiedenen Übungen wechselnd, aber nie
  bei DERSELBEN Übung 3 Wochen durchgehend scheitert, würde das Signal
  nicht auslösen.

**Loop 3 abgeschlossen — 15 von 15 Edge-Cases erreicht.** 9 neue Fixtures
erstellt (NullGewicht, 9999Wdh, NullSätze, NullWochen,
GenauZweiWochenPlateau, GenauAchtWochenDeload, InkonsistenteDaten,
AlteDaten2020, 100Wochen), alle headless verifiziert: 0 uncaught errors,
kein NaN/Infinity bei allen 9. Beide Grenzwert-Tests bestätigen die
dokumentierten Schwellen exakt: 2 Wochen lösen KEIN Plateau aus (braucht
3+), 8 Wochen lösen korrekt das präventive Deload-Signal aus (Schwelle
"≥8"). Kein neuer Bug gefunden — Details in tests/fixtures/README.md.

**B26 behoben in train-v161** (siehe BUGS.md/DECISIONS.md) —
persistent_failure hat jetzt eine Decisional-Balance ("Weiter wie bisher
versuchen" / "Gewicht reduzieren (Empfehlung)"). Empfehlung folgen setzt
konkret EX_SET_NEXT_WEEK_PLAN für die betroffene Übung. Damit ist die in
v160 notierte "Bekannte Grenze — keine Decisional-Balance" geschlossen.
Die zweite Grenze (prüft nur einzelne Übungen, keine Mehr-Übungen-
Aggregation) bleibt bewusst offen, siehe DECISIONS.md.

**26 ältere Test-JSONs unter tests/ validiert** — alle 26 laufen
fehlerfrei (0 uncaught errors, kein NaN/Infinity), alle bereits
schemaVersion 29 (keine "veraltet"-Markierung nötig, obwohl viele
Dateinamen ältere Sprint-Versionen referenzieren). Details in
tests/README.md.

**Echte Geräte-Verifikation abgeschlossen (2026-07-13):**
- B16 (Doppeltipp-Zoom) bestanden — beide Ursachen final bestätigt behoben
- dragdrop.js Touch-Drag: funktioniert weiterhin NICHT — neu als B27
  getrackt, bewusst zurückgestellt (Pfeile in den Übungseinstellungen
  decken den Bedarf bereits ab, keine akute Diagnose nötig)

**B28 — GitHub Actions CI eingerichtet (train-v162):** Playwright-Suite
läuft jetzt bei jedem Push auf main. Siehe BUGS.md B28 für alle
Abweichungen von der Sprint-Vorlage (falsche DOM-Selektoren korrigiert,
`--with-deps` ergänzt, pageerror-Listener-Reihenfolge korrigiert, u.a.).

**Erster CI-Run erfolgreich (2026-07-13):** https://github.com/777random/TRAIN/actions/runs/29247704723
— beide Jobs grün (regression_core.spec.js + fixtures.spec.js, alle 15
Fixtures), 1m7s Laufzeit. Einzige Auffälligkeit: Info-Annotation von
GitHub ("Node.js 20 is deprecated... forced to run on Node.js 24") —
betrifft die Runtime der Actions selbst (checkout@v4/setup-node@v4),
nicht unser `node-version: '20'`-Input für die Job-Steps — keine
Handlung nötig, nur zur Kenntnis.

**B29 — Mehr-Übungen-Aggregation umgesetzt (train-v163):** neue
Funktion `_checkMultiExerciseFailure()` in computeStructuralSignals()
(Strukturkarte, NICHT akute Kaskade) — schließt die in DECISIONS.md
dokumentierte Grenze von `_checkPersistentFailure` (prüfte bisher nur
EINE Übung). Schwelle: Gesamterfolgsquote ≤20% über ≥2 Übungen, letzte
3 Nicht-Deload-Wochen. Reiner Informationstext (Top-3 schlechteste
Übungen + Gewichtsempfehlung je Übung), kein Aktions-Button — hält die
"Strukturkarte = rein informativ"-Konvention ein. Design vorab mit
Nutzer besprochen (3 Fragen: Platzierung/Schwelle/Aktionsfähigkeit,
siehe DECISIONS.md). Neue Fixture MultiExerciseFailure.v1.json isoliert
verifiziert (headless: computeStructuralSignals() UND gerenderter
Strukturkarte-Text geprüft, kein Overlap mit persistent_failure).

**B30 — Loop 5 + Prompt-Bibliothek + Lighthouse CI umgesetzt
(train-v164):** Lighthouse CI lokal getestet (echte Scores: Performance
84, Accessibility 91, Best Practices 96, SEO 100 — alle Schwellen
bestanden), zwei reale Probleme gefunden und gelöst statt blind
übernommen: (1) `lighthouserc.js` mit ESM-Syntax scheiterte an
package.json's `"type":"module"` — als `.cjs` mit `module.exports`
gelöst. (2) `categories:pwa`-Assertion hätte immer sinnlos gewarnt
(Kategorie existiert in dieser Lighthouse-Version nicht mehr) —
entfernt statt Dauer-Rauschen zu behalten. Prompt-Bibliothek (7 statt
der in der Akzeptanzliste genannten 6 Dateien — Sprint-Vorgabe war in
sich widersprüchlich, Detail-Liste hatte 7 Einträge) unter prompts/
angelegt. Loop 5 in LOOPS.md ergänzt und einmal ausgeführt
(for-advisor.txt komplett neu generiert, 3. Fassung).

**Lighthouse-CI-Run bestätigt (train-v164):** https://github.com/777random/TRAIN/actions/runs/29256409055
— beide Jobs grün, lighthouse-Job 45s, kein EPERM-Absturz (Windows-
spezifisch, bestätigt).

**B18 behoben (train-v165):** Distanz/Zeit-Progression für metric
'm'/'sec' — siehe BUGS.md B18 für vollständige Details. Design vorab
besprochen (3 Fragen: Scope beide Metriken, konfigurierbares
metricStep, gleiche Auto-Vorauswahl-Schwellen — alle "Empfohlen"-
Optionen gewählt). Beim Implementieren einen echten Blocker gefunden
und VOR dem Testen korrigiert: der bestehende Skip-Guard in ui.js
(`progressionType==='reps' → return`) hätte mit dem neuen
progressionType-Default jede Distanz/Zeit-Übung übersprungen, bevor sie
überhaupt geprüft wird. SCHEMA_VERSION → 30 (ex.metricStep + Migration
für bestehende Übungen mit dem alten, bedeutungslosen 'weight'-Default).
Nebenbefund B31 (ui.js:2426, `ex.metric !== 'kg'`-Typo) dokumentiert,
nicht gefixt.

**B31 diagnostiziert (2026-07-13, keine Code-Änderung):** Root Cause
bestätigt (ui.js:2426, `!== 'kg'` statt vermutlich `!== 'reps'` gemeint)
und empirisch verifiziert (headless: `#chart-1rm-hint` bleibt leer für
TRAIN_Test_EdgeCase_MaxGewicht.v1.json trotz klar qualifizierender
500kg×3-Daten). Dabei eine falsche Verifikation aus dem Loop-3-Audit
(v157) korrigiert — die dort bestätigte "~550.0 kg"-Anzeige war eine
ANDERE `.orm-hint`-Instanz (Training-Tab, ui.js:1613), nicht die hier
gemeinte Fortschritt-Tab-Anzeige. Hochgestuft von "Low" auf "UX-Mittel"
— realer, reproduzierbarer Bug (v.a. bei Ausweichübungen: der Fallback
ist explizit für `ex.substituteFor`-Fälle gebaut, greift wegen des
Guards aber nie). Empfohlener Fix (nicht umgesetzt, nur diagnostiziert):
Zeile 2426 → `!== 'reps'`, oder Zeile ganz entfernen (der bestehende
`weight>0`-Filter reicht bereits). Vollständige Diagnose siehe BUGS.md B31.

**B31 behoben (train-v166):** Fix umgesetzt (`ui.js:2426` → `!== 'reps'`)
und mit 3 Szenarien verifiziert: (1) MaxGewicht-Fixture (leeres `prs`)
zeigt jetzt korrekt "~550.0 kg geschätzter 1RM". (2) Ausweichübungs-
Substitution (eigener Test: echte Kniebeuge-Session + spätere
Beinpresse-Substitution) zeigt jetzt korrekt das höhere Epley-Ergebnis
aus der Substitutions-Woche — der Hauptfall, für den der Fallback
ursprünglich gebaut wurde. (3) Regressionsschutz: metric 'm'/'sec' zeigt
weiterhin korrekt keinen 1RM-Hint. Details siehe BUGS.md B31.

**B32+B33 umgesetzt (train-v167):** erster Sprint mit zwei echten
parallelen Agents in getrennten Dateigruppen (ui.js allein / index.html+
styles.css allein). B32 schließt den letzten offenen Erfolgsquote-
Nebenfund aus B22. B33 hebt Lighthouse Accessibility von 91 auf 95 —
lokal mit `npx lhci autorun` verifiziert (2 von 3 Läufen erfolgreich,
1 Lauf am bekannten Windows-EPERM-Cleanup-Fehler gescheitert, siehe
B30, kein neues Problem). Die verbleibenden 2 ARIA-Findings brauchen
einen JS-Fix in `_buildScaffold()` (ui.js) und wurden bewusst nicht
im Scope dieses Sprints (nur index.html/styles.css) umgesetzt, sondern
als B34/B35 neu getrackt.

**B34+B35 umgesetzt (train-v168):** die beiden in B33 zurückgestellten
ARIA-Findings direkt im Anschluss gefixt, da der Nutzer explizit danach
fragte. Lighthouse Accessibility jetzt bei **100** (war 91 vor diesem
Zwei-Sprint-Bogen). Keine offenen Accessibility-Findings mehr bekannt.

**Deep-Check-Audit vor Release umgesetzt (train-v169):** Nutzer wollte
vor dem Shippen sichergehen, dass keine Bugs/Logikfehler mehr in der
App stecken. 4 parallele read-only Diagnose-Agents haben die komplette
App durchleuchtet (Coach-Kaskade, Fortschritt-Berechnungen, Training-
Tab-Bedienung, Persistenz/Migration/Backup) — Code-Lesen UND echte
Playwright-Testläufe, nicht nur "stürzt nicht ab" sondern "zeigt das
Richtige an". 10 Funde, mit Nutzer besprochen: 5 eindeutige Bugs sofort
gefixt (B36-B40, siehe BUGS.md für Details), 1 struktureller Fund
bewusst nur dokumentiert statt gefixt (B41, tote Plateau-Strategie
"Variation" — bräuchte größeren Umbau), 3 kleinere Funde notiert
(B42/B43 + ein CLAUDE.md-Doku-Drift). Jeder der 5 Fixes einzeln
umgesetzt, mit Playwright UND gezielten Node-Skripten verifiziert
(tatsächliches Vor/Nach-Verhalten der betroffenen Berechnung gezeigt,
nicht nur Regressionstest-grün angenommen). Regressionstest 10/10 grün,
Playwright 18/18 grün nach jedem einzelnen Fix und im finalen Kombi-Lauf.

**Nächster Schritt:** echte Nutzer-Rekrutierung (strategische Priorität
1 laut CLAUDE.md) — keine offenen UX-Mittel-Bugs mehr in BUGS.md OFFEN,
nur noch Low/UX-komplex-Priorität-Items übrig. Der App-Zustand ist nach
diesem Deep-Check-Audit so sauber wie mit vertretbarem Aufwand lokal
feststellbar — verbleibende offene Punkte sind bewusste, dokumentierte
Zurückstellungen, keine unbekannten Baustellen.

**Offene Nebenfunde aus diesem Sprint (nicht behoben, nur notiert):**
- ~~Push/Pull-Ratio-Block in _renderMovementPattern() (ui.js, unterhalb der
  Kategorie-Balken) zählt weiterhin nur success-Sätze, nicht success+fail
  — war nicht Teil von B22, potenzieller Folge-Fix~~ BEHOBEN train-v167 (B32)
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

## VERIFIKATIONS-STATUS TOUCH-DRAG (train-v156 → real-device-Ergebnis 2026-07-13)

**Verifiziert (headless):**
- Regressionstest 10/10 grün, 0 uncaught errors
- index.html lädt headless fehlerfrei durch (kein "Uncaught" im Chrome-
  Log, `#app` erreicht Klasse `is-ready`, `#splash` wird korrekt entfernt)
- dragdrop.js wird als klassisches Script vor dem Module-Script geladen
  und wirft dabei keinen Fehler

**Echtes Gerät, 2026-07-13 — Ergebnis: funktioniert NICHT.**
Long-Press+Drag ändert die Übungsreihenfolge nicht. Als B27 in BUGS.md
getrackt. Bewusst zurückgestellt statt tiefer diagnostiziert — die
Pfeil-Buttons in den Übungseinstellungen lösen dasselbe Bedürfnis
(Reihenfolge ändern) bereits zuverlässig, das Feature hat daher keine
Priorität. Mögliche Ursachen für eine spätere Diagnose (nicht verfolgt):
`holdToDrag: 400` zu lang/kurz, `dragstart` feuert auf Touch-Geräten
nicht zuverlässig, `forceApply: false` entscheidet falsch, oder eine
Versions-/Kompatibilitätsfrage mit der eingebundenen mobile-drag-drop
2.3.0-rc.1 Build.
