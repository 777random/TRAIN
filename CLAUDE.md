# TRAIN — CLAUDE.md
# Vollständiger Projektkontext für Claude Code
# Stand: train-v241 / SCHEMA 33 / August 2026
# Letztes Update: nach train-v241, Runde 17 (2026-08-04) -- vier unabhängige
# Live-Nutzerfeedback-Punkte. B209: "Plain Mode"-Preset (neue Settings-
# Karte, buendelt 6 bestehende Settings auf einen Klick, Master
# "Automatische Wochenerstellung" bleibt bewusst an). B210: Vibrations-Bug
# als strukturelle Browser-Einschraenkung eingeordnet (navigator.vibrate()
# feuert aus einem rAF-Loop weit ausserhalb jedes User-Activation-Fensters,
# nicht zuverlaessig fixbar) -- neue Sound-Alternative ("Ton nach Pause",
# soundEnabled) via Web Audio, AudioContext wird proaktiv beim Pausenstart
# unlocked. B211: Stangengewicht + Groesste Hantelscheibe im Settings-Tab
# nebeneinander (bestehendes .body-grid-Muster wiederverwendet, ab 480px
# zweispaltig). B212: Onboarding-Plan wird jetzt automatisch zur Standard-
# Vorlage (A.TPL_SAVE, nur beim "Vorlage laden"-Pfad). 9 neue Real-Path-
# Tests, volle Suite gruen. Siehe HANDOFF.md für Details.
# Davor train-v240, Runde 16 (Launch-Roadmap Phase C,
# Umsetzung, 2026-08-04) -- B206: Settings-Tab restrukturiert (Trainingsziel/
# Ernährungsphase in eigener "Ziele"-Karte, "Woche zurücksetzen"/"Original
# wiederherstellen"/"Als Vorlage speichern" von nativen confirm()/prompt()
# auf In-App-Inline-Panels umgestellt, Datenschutz/Impressum-Collapse auf
# <details> vereinheitlicht). B207: zwei seit Runde 6 (B169) tote Funktionen
# wiederhergestellt (edit-day-field: Tag-Titel/-Subtitle-Inline-Umbenennung;
# autofill-rpe: Pendant zum aktiven autofill-down) -- dabei eine NEUE,
# ungeplante Redundanz entdeckt (Wochen-Menü hatte bereits ein live
# "Tag umbenennen" per prompt()) und per Rückfrage entfernt zugunsten der
# Inline-Bearbeitung. B208: 6 tote Case-Handler in ui.js entfernt
# (toggle-day-menu-System, set-session-rating, day-edit-note,
# create-week-prev/-template, set-rpe). 9 neue Real-Path-Tests +
# 6 aktualisierte Tests, volle Suite grün. Siehe HANDOFF.md für Details.
# Davor train-v239, Launch-Roadmap Phase C, Inventar-Teil (2026-08-04) --
# reine UX-/Feature-Bestandsaufnahme, siehe HANDOFF.md.
# Davor train-v239, Launch-Roadmap Phase B (2026-08-04) —
# 25 Stabilitäts-Testszenarien (7 Kategorien, von Claude Cowork) gegen den
# aktuellen Code-Stand geprüft (Baseline vor dem Phase-C-Redesign). 1
# echter Bug gefunden+gefixt (B205): backup.js importJSON() lehnte sehr
# alte, legitime Backups (vor SCHEMA 6) über den ECHTEN Restore-Pfad
# fälschlich ab, obwohl migrate() sie längst korrekt verarbeitet -- alle
# bisherigen Migrations-Tests hatten localStorage direkt injiziert statt
# den echten Restore-UI-Pfad zu prüfen. 4 echte Test-Lücken geschlossen
# (Mehr-Signal-Kollision, Alle-Settings-AUS/AN, Negativ-Gewicht-Reducer-
# Floor, Session-Coach-Historie), kein weiterer Bug gefunden. Siehe
# HANDOFF.md für Details.
# Davor train-v238, Launch-Roadmap Phase A (2026-08-04) —
# neues lebendes Master-Dokument `Diagnose & Sprints/TRAIN-Launch-
# Roadmap.md` (8 Phasen bis Launch) angelegt, Phase A (Verifikation
# Runde 13-15 gegen tatsächliches Verhalten) abgeschlossen. Fund (B204):
# Deload-Struktursignals "▾ Basis dieser Einschätzung"-Aufklapp-Feld
# wiederholte seit Runde 14 dieselben 3 Rohwerte, die der Haupttext
# bereits zeigte (E1-Feature v215 wurde bei der Runde-14-Textänderung
# nicht mitgezogen) — zeigt jetzt stattdessen den Auslösegrund
# (Volumen/RPE). Alle übrigen geprüften Runde-13/14/15-Punkte bestätigt,
# keine weiteren Abweichungen. Siehe HANDOFF.md für Details.
# Davor train-v237, Runde 15 (2026-08-04) — 3 unabhängige
# Live-Nutzerfeedback-Punkte (B201-B203): Settings-Tab "Tag löschen" zeigte
# den Button nur beim letzten Tag + verschwand bei nur 1 Tag komplett statt
# disabled (jetzt: jeder Tag, disabled+Tooltip bei 1 Tag); largestPlate-
# Picker speicherte nie einen Wert (case lag in _handleChange() statt
# _handleClick() -- Picker ist ein <button>, feuert nie 'change'); Körper-
# Tab "Schlaf & Energie" zeigt jetzt zusätzlich persistent
# calcSleepCorrelation() (bisher nur einmalig im Session-Summary), Nutzer-
# entschieden (Eingabe behalten, Anzeige aufwerten). Siehe HANDOFF.md für
# Details.
# Davor train-v236, Runde 14 (2026-08-03) — Council-
# Entscheidung "Coach-Signal-Governance": Beobachtungston jetzt Default für
# ALLE Coach-Struktursignale (nicht nur recurring_fatigue, gilt rückwirkend
# fürs Deload-Signal), generalisierter aber signal-spezifisch
# konfigurierbarer Dismiss über state.decisionLog (Deload 4/Konsistenz 2/
# Push-Pull 3/recurring_fatigue 3 Wochen Cooldown, gedeckelte 3-stufige
# Eskalation bei Re-Trigger statt identischem Text), injury_reminder + die
# Plateau-Hauptkarte bewusst ausgenommen (siehe
# `Diagnose & Sprints/TRAIN-Council-Entscheidung-Deload-Signal-2026-08-03.md`
# und HANDOFF.md für Details). Davor train-v235, Runde 13 — Council-
# Entscheidungen B62 (SW-Registrierung an ersten Workout-Start gekoppelt,
# Precache-Scope reduziert) + B140 (neues Coach-Tab-Strukturkarten-Signal
# `recurring_fatigue`, Ausbaustufe des bestehenden tagesskalierten
# `detectSessionFatigue()`) technisch umgesetzt. Dokumentation für Runde
# 10-12 (train-v231-234) wurde in diesem Header nicht nachgezogen — siehe
# HANDOFF.md für den vollständigen Verlauf dieser Zwischenrunden.
# Davor train-v230, Runde-9-Audit-Folgerunde (2026-08-03) —
# B185-B190, schließt das Runde-8-Datenkonsistenz-Audit vollständig ab
# (siehe AUDIT-BERECHNUNGEN.md — alle 3 "Verdacht auf Bug"-Funde + 2
# kosmetische Nebenfunde behoben). Wichtigster Einzelfund: B185
# (`_weekConsistencyRatio()` nutzt jetzt dieselbe Anti-Gaming-Definition
# wie die Streak-Berechnung) ändert RÜCKWIRKEND die angezeigte
# Fortschritt-Tab-Konsistenz-% für ALLE Bestandswochen (keine Migration,
# reine Neuberechnung — vom Nutzer vorab bestätigt, siehe DECISIONS.md).
# Davor train-v229, Runde-8-Datenkonsistenz-Sprint (2026-08-02) — B181-B184:
# konkreter Bug (Soll-Satzzahl nach Übungs-Archivierung veraltet) plus ein
# bewusst breites 5-Domänen-Audit über alle Berechnungen im Projekt (NUR
# Diagnose in dieser Runde, Fixes folgten in Runde 9) plus 3 unabhängige
# Feedback-Punkte (Muskelgruppen-Zuordnung, Steigerungs-Picker ohne
# Doppeltap, konfigurierbare größte Hantelscheibe). Davor train-v228,
# Runde-7-Coaching-Qualitäts-Sprint (2026-08-02) — B178-B180: Coach-
# "Warum"-Texte nutzen jetzt Mehrwochen-Trends, 4 RPE-Schwellenwerte benannt
# (NICHT konsolidiert — unterschiedliche Konzepte, korrekt getrennt),
# Volumen-/Satzzahl-Progression wird jetzt als Fortschritt erkannt. Davor
# train-v227, Runde-6-Nutzerfeedback-Fix-Sprint (2026-08-02) — B167-B177:
# globale Steigerungs-Einstellung endlich wirksam (`getEffectiveWeightStep()`),
# Carry-Übungen können über Gewicht progressieren, diverse UI-Fixes, plus
# eine während der Verifikation gefundene+gefixte Regression (B176,
# CSS-Stacking-Context-Fallstrick). Davor train-v226, Runde-5-Fix-Sprint
# (2026-08-02) — B166, echte Regression von B152 (SW-Update aktiviert im
# echten Zwei-Versionen-Zyklus nicht zuverlässig), gefunden per echtem
# Live-Test gegen den deployten Build. Ältere Sprints siehe HANDOFF.md/
# SESSION_LOG.md.

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
- **Lokaler Projektpfad (seit 2026-07-22): `C:\ClaudeProjects\TRAIN`** — vorher
  unter `C:\Users\joojo\OneDrive\Desktop\ClaudeCode\TRAIN` (OneDrive-
  synchronisiert). Wurde verschoben, weil der dortige `backups/`-Ordner
  (181 Milestone-Snapshots, ~2 GB) den Cloud-Speicher des Nutzers gefüllt
  hatte. `C:\ClaudeProjects\` liegt bewusst außerhalb jeder Cloud-Sync
  (nicht unter `OneDrive\Desktop`/`Documents`/`Pictures`) — künftige
  Sessions müssen aus diesem neuen Pfad heraus gestartet werden, sonst
  landet man am alten (jetzt leeren) OneDrive-Ort. Nutzer zieht den Ordner
  regelmäßig manuell auf eine externe Festplatte statt über Cloud-Sync.
- Aktueller Stand: SCHEMA_VERSION 33 · CACHE_VERSION train-v239 · CSS ?v=213

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
| `Diagnose & Sprints/TRAIN-Launch-Roadmap.md` | **Lebendes Master-Dokument für den Weg zum Launch** (8 Phasen A-H, Status-Tabelle). Bei jeder Sitzung zum Launch-Thema ZUERST lesen, nach jedem abgeschlossenen Schritt die Status-Tabelle darin aktualisieren — ersetzt nicht die einzelnen Sprint-Runden, jede Code-Phase bekommt ihre eigene Runde. |
| `BUGS.md` | Bug-Tracker: behoben / offen / bewusst kein Bug / bekannte Test-Fallstricke |
| `DECISIONS.md` | Unveränderliche Produkt-/Architektur-Entscheidungen — nicht ohne neue explizite Entscheidung revidieren |
| `AGENTS.md` | Parallelisierungs-Regeln für Multi-Agent Sprints |
| `AUDIT-BERECHNUNGEN.md` | Referenzdokument: Konsistenz-Audit über alle Berechnungen im Projekt (Runde 8), alle Funde inzwischen bewertet/behoben (Runde 9) — Vorlage für künftige ähnliche Audits |
| `SECURITY.md` | Security-Status heutiger Architektur (kein Backend) + dokumentierte Blaupause für Auth/Rate-Limiting/Access-Control, sobald ein Server (Paywall/Coaching) kommt |
| `LEGAL.md` | Rechts-Recherche zu Impressum/Datenschutz (Name-/Adress-Pflicht, c/o-Workaround, DDG/DSGVO-Fakten) + Blaupause für AGB/Widerrufsrecht/BFSG, sobald Paywall/App-Store kommen |
| `LOOPS.md` | Automatische Session-Loops (beim Start jeder Session ausführen) |
| `SESSION_LOG.md` | Protokoll aller Sessions und Loop-Ergebnisse |
| `Diagnose & Sprints/` | Diagnose-Ergebnisse (nach Phase 2) und Sprint-Ergebnisse (nach Phase 4) als .txt, siehe `TRAIN-Sprint-Prompts.md` — für externe Produkt-/Strategie-Gespräche ("Claude Cowork"), gitignored (nie auf GitHub) |
| `prompts/` | Wiederverwendbare Prompt-Vorlagen für Claude Code und externe Beratung |
| `context-exports/for-advisor-product.txt` | Produkt + User Journey für externe Beratung (Loop 7) |
| `context-exports/for-advisor-market.txt` | Markt + Konkurrenz für externe Beratung (Loop 8) |
| `context-exports/for-advisor-ux.txt` | UX + Onboarding für externe Beratung (Loop 9) |
| `context-exports/for-advisor-growth.txt` | Growth + Distribution für externe Beratung (Loop 10) |
| `context-exports/for-advisor-consolidated.txt` | Konsolidierter Export aus allen Perspektiven — für neue externe Chats (Loop 11) |

Nach jedem Sprint: `HANDOFF.md` und `BUGS.md` aktualisieren (behobene Bugs verschieben, Commit-Hash eintragen, nächsten Schritt setzen). Bei Sprints nach dem Diagnose-vor-Fix-Muster (siehe `Diagnose & Sprints/TRAIN-Sprint-Prompts.md`): zusätzlich Diagnose- und Sprint-Ergebnis als .txt in `Diagnose & Sprints/` ablegen.

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

**Nutzer-Anweisung (2026-08-03):** Wenn der Nutzer "commit"/"committen" sagt,
ist damit IMMER `git commit` + `git push origin main` gemeint (nicht nur der
lokale Commit) — außer der Nutzer sagt explizit etwas anderes (z.B. "nur
committen, noch nicht pushen"). Nicht nach jedem Commit separat nachfragen,
ob auch gepusht werden soll.

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

**Bekannte Infra-Grenze (gefunden 2026-07-28, B138/B139/B140-Sprint):** die volle
`npx playwright test`-Suite (273 Tests, keine Datei-Filter) kann den lokalen
`npx serve .`-Devserver mit `EMFILE: too many open files` abstürzen lassen —
danach schlagen ALLE nachfolgenden Tests mit `net::ERR_CONNECTION_REFUSED`
fehl (Server-Prozess tot, nicht neu gestartet). Reproduziert unabhängig von
`--workers`-Anzahl und nach Killen verwaister `chrome`/`node`-Prozesse —
scheint eine Windows-spezifische Handle-Grenze von `serve` bei sehr langen
Testläufen (>10 Min) zu sein, kein Code-Bug. **Workaround:** Suite in 2-3
Datei-Batches aufteilen (`npx playwright test <dateien-batch-1>`, dann
Batch 2, Batch 3 — jeder Aufruf startet einen frischen Serverprozess). Bei
einem plötzlichen Massenausfall (>50% der Tests, immer derselbe
Connection-Refused-Fehler) NICHT von einer echten Regression ausgehen, ohne
das vorher per Batch-Lauf gegenzuprüfen.

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
| `state.js` | Single Source of Truth. Alle Writes über `dispatch()`. Subscribers synchron nach jeder Mutation. Persistenz in localStorage. Seit train-v227 (B167) `getEffectiveWeightStep(ex, settings, customExercises)` — zentraler Resolver für die effektive Gewichts-Schrittweite (`ex.weightStep ?? settings.plateStep ?? categoryDefault ?? 2.5`), lückenlos an ~22 Stellen genutzt (per Runde-8-Audit verifiziert, keine übersehenen Inline-Fallbacks). Seit train-v230 (B185) `_dayEvalCounts(day)` — extrahiert aus `_weekTrainingStatus()`, gibt `{evaluated, total}` zurück, von `consistencyUtils.js`/`weeklyFocus.js` wiederverwendet statt `day.markedDone` (Anti-Streak-Faking-Definition jetzt konsistent für Streak UND Konsistenz-%). |
| `ui.js` | Gesamtes DOM-Rendering. Einmalig gebootstrapped via `mountApp(root)`. Re-rendert Regionen bei State-Änderungen via `subscribe()`. |
| `weeklyFocus.js` | Coach-Logik. `computeWeeklyFocus()` + `computeStructuralSignals()`. |
| `plateauDetector.js` | Plateau-Erkennung. Verwendet `isFullSuccess()`. |
| `weightRecommendation.js` | Gewichtsempfehlung. `isReadyForAutoSelect()`. |
| `setUtils.js` | `isFullSuccess(s, ex)` — zentraler Helper. Seit train-v170 auch `weekSuccessCounts(week)` (success/(success+fail), archiviert-bewusst) — einzige Quelle, von ui.js UND weekReview.js genutzt. |
| `consistencyUtils.js` | `_weekConsistencyRatio()` — Shared Module (verhindert Circular Import overallPerformance ↔ weeklyFocus). Seit train-v230 (B185) nutzt reguläre Trainingstage `state.js`s `_dayEvalCounts()` (≥50% Sätze bewertet) statt `day.markedDone` — angeglichen an die Streak-Definition, analog zum B38-Fix für Urlaubstage. **Bestätigte Rückwirkung:** ändert die angezeigte Konsistenz-% für alle Bestandswochen sofort (reine Neuberechnung, keine Migration), siehe DECISIONS.md. |
| `overallPerformance.js` | `computeVolumeTrend/QualityTrend/ConsistencyTrend`. |
| `progressInsights.js` | Erkenntnisse-Sektion. |
| `insightEngine.js` | Toast-Regeln, Insights. Seit train-v173 auch `detectRecurringStep()`/`exMetricHistory()`/`detectRecurringWeightStep()` — Muster-Erkennung für Schrittweite-Vorschläge (B49), rein rückblickend, nie automatisch angewendet. |
| `movementMap.js` | Übungsname → Kategorie (Push/Pull/Squat/Hinge/Core/Carry). 218 Übungen/Synonyme (seit train-v214/B111, davor 139 — +79 Variationen/deutsche+englische Synonyme; Zahl per `Object.keys(MOVEMENT_MAP).length`-Laufzeitzählung train-v222 verifiziert — ein früherer regex-basierter Zähler hatte fälschlich 217 ermittelt, da ein Eintrag mit Apostroph im Namen [`"Farmer's Walk"`, doppelte Anführungszeichen] übersehen wurde). Seit train-v170 auch `buildCategoryMap()`/`resolveCategory()` — einzige Quelle für den Kategorie-Override-Lookup (`state.customExercises`-Override vor `MOVEMENT_MAP`-Fallback), genutzt von ui.js, weeklyFocus.js UND overallPerformance.js. Seit train-v229 (B184) zusätzlich `MUSCLE_GROUP_MAP`/`resolveMuscleGroups(name)` — eine ANDERE, unabhängige Taxonomie (Muskelgruppe statt Bewegungsmuster, z.B. "Schulter"/"Rücken"/"Brust"), alle 72 `_STANDARD_EXERCISES`-Einträge per-Übung kuratiert (nicht mechanisch aus dem Bewegungsmuster abgeleitet). Befüllt `ex.tags` bei Übungserstellung (Onboarding + `EX_ADD`-Fallback ohne History) und seit train-v230 (B188) auch rückwirkend für Bestandsdaten mit Standard-Namen (additiver Migrations-Guard, kein Backfill für individuell umbenannte Übungen). |
| `exerciseAlternatives.js` | Seit train-v222 (B138). `EXERCISE_ALTERNATIVES` (24 Übungen mit je 2-5 kuratierten Alternativen) + `getAlternatives(exName, state)` (kombiniert `state.customAlternatives[exName]` mit vordefinierten Einträgen, dedupliziert). Importfrei (Tiefe 0), nur von ui.js genutzt (Chip-Reihe im "Heute anders"-Dialog, neben der bereits bestehenden historienbasierten `sub-suggestions`-Liste aus B109/D2). |
| `progressChart.js` | Übungsfortschritt-Chart. |
| `weekReview.js` | Wochenrückblick. |
| `timer.js` | Session-Uhr + Pause-Timer. Vollständig entkoppelt von `ui.js` via custom `window` Events. Seit train-v193 (B77) importiert es zusätzlich `sessionCoach.js` (`buildSetFeedback()`) für die Pause-Dauer-Empfehlung — kein Bruch der ui.js-Entkopplung, siehe DECISIONS.md. |
| `sessionCoach.js` | Seit train-v193 (B77). Intra-Session Coach: `buildSetFeedback()` (Gewichts-/Pause-Vorschlag für den nächsten Satz, seit train-v203/B92 Entscheidungsmatrix v2 — RPE + `repDiff` kombiniert, Wdh-Differenz hat Vorrang, plus Satz-zu-Satz-RPE-Trend-Erkennung; session-lokale Logik ohne RPE unverändert; seit train-v204/Sprint C1 zusätzlich `goal`/`isCompound`-Parameter — Pausendauer sportwissenschaftlich nach Trainingsziel + Compound/Isolation differenziert, `_pauseSecForRpe()` exportiert für die Briefing-Pausenvorschau; seit train-v205/Sprint C2 zusätzlich `modifierScope`-Parameter — `_applyModifier()` dämpft eine Isolationsübung nicht mehr bei `modifierScope==='compound'`, konsistent mit der Pre-Session-Reduktion), `buildLastSetMessage()` (Abschluss-Text der Übung), `buildWarmupSets()` (50/70/85%-Aufwärmformel). Importfrei (Tiefe 0) — `isCompound`/`modifierScope` werden von `ui.js`/`timer.js` bestimmt und nur als primitive Parameter durchgereicht, damit sessionCoach.js selbst keinen neuen Import braucht. Von `ui.js` UND `timer.js` genutzt — bewusst KEINE Wiederverwendung von `getWeightRecommendation()` (weightRecommendation.js) für Intra-Session-Vorschläge, siehe DECISIONS.md. |
| `sessionSummary.js` | Seit train-v194 (B79). Session Summary + Schlaf-Korrelation: `buildSessionHighlights()`, `buildSessionEinordnung()`, `buildNextSessionPreview()`, `calcSleepCorrelation()`. Importiert `getSortedWeeks`/`exWeightHistory` (insightEngine.js), `isFullSuccess` (setUtils.js), `buildCategoryMap`/`resolveCategory` (movementMap.js) — Tiefe 3, kein ui.js-Import (lokal duplizierter Kategorie-Filter für die Fokus-Übung, gleiches Muster wie weeklyFocus.js' Push/Pull-Duplikation). PR-Deltas rechnen bewusst gegen `exWeightHistory()` der Vorwochen, nicht gegen `ex.prWeight`/`state.prs` (zum Abschlusszeitpunkt bereits überschrieben, siehe DECISIONS.md). |
| `backup.js` | JSON Import/Export, CSV Export. |
| `registerSW.js` | Service Worker Registrierung, Storage-Error, SW-Update Event. |
| `dragdrop.js` | Minifizierter Third-Party Drag-Drop Polyfill — NICHT bearbeiten. |
| `icons.js` | SVG Icon Strings als named constants. |
| `shareImage.js` | Seit train-v186 (B68), Wochenrückblick-Canvas seit v187 (B71) mit Bezier-Sparkline neu aufgebaut, seit v189 (B73) Favoriten-Kaskade/Retina-Deckelung/PR-Moment-Redesign/Datenschutz-Consent-Gate. Canvas-basierte Share-Bilder (PR-Moment + Wochenrückblick, 1080×1080 PNG, DPR max. 3x). Importfrei/State-frei (Tiefe 0), Farben live via `getComputedStyle()`. Teilen via `navigator.share`/`canShare` mit Download-Fallback (identisches Muster wie `backup.js`), kein Server-Upload. Einmaliger Datenschutz-Hinweis vor dem ersten Teilen (`localStorage['train_share_consent']`), zentral in `shareCanvas()` für alle Einstiegspunkte. Seit train-v207 (B98): Blob/File werden vor dem Consent-Await gebaut (weniger async-Schritte vor `navigator.share()`, Android-Bugfix — "transient activation" kann sonst verfallen); `AbortError` löst keinen Download aus, jeder andere Fehler zusätzlich ein anonymes GoatCounter-Event (`share_failed: <ErrorName>`). |

### State Layer (`state.js`):

Flux-Pattern: `dispatch(A.ACTION_TYPE, payload)` → `reduce()` → `persistState()` → `_notify()` → alle Subscriber synchron.

**Persistenz (defence-in-depth):**
- Primary: `localStorage['train_v6']` — bei jeder Mutation
- Shadow: `localStorage['train_v6_shadow']` — debounced 500ms (Crash-Safety)

**Undo:** 20-Entry Stack mit Deep-Cloned Snapshots. Navigation Actions (`WEEK_NAVIGATE`, `SESSION_START` etc.) sind von Undo ausgeschlossen (`_NO_UNDO`).

**Schema Migration:** `migrate()` läuft bei jedem `loadState()`. Neuen `case` Block hinzufügen wenn `SCHEMA_VERSION` erhöht wird. Aktuelle Version: **33**.

**State Shape (SCHEMA 33):**
```javascript
{
  meta: { schemaVersion: 33, savedAt, createdAt },
  curIdx: number,           // Index in weeks[]
  weeks: [{
    id, startDate, note, mode,
    days: [{
      id, title, subtitle, warmup, cooldown,
      locked, markedDone, isVacation,
      sleepHours, energyLevel, sessionRating,
      sessionCheckIn, sessionModifier,  // seit SCHEMA 32 (B76); sessionCheckIn.injuryFollowUp seit B129
      exercises: [{
        name, note, pauseSec, metric, sets,
        weightStep, metricStep, nextWeekPlan, nextWeekPlanConfirmed,
        nextWeekPlanAutoReviewed,  // seit SCHEMA 33 (B128) — steuert nur die Auto-Steigerung-Banner-Sichtbarkeit
        targetReps, progressionType, archived,
        substituteFor,
        skipReason, skipDate,  // seit SCHEMA 33 (B129) — Grund für komplett übersprungene Übung
        tags,  // Muskelgruppen (nicht Bewegungsmuster!), seit train-v229 (B184) bei
               // Neuerstellung + train-v230 (B188) per Backfill für Bestandsdaten
               // befüllt, siehe movementMap.js resolveMuscleGroups(). Feld existiert
               // seit SCHEMA 9, war aber jahrelang tot (nirgends im UI befüllt, B41).
        // ENTFERNT (B187, train-v230): targetSets — wurde stale, sobald Sätze
        // manuell hinzugefügt/entfernt wurden; sets.length ist die einzige Quelle.
      }]
    }],
    sessionLog, bodyData, restDays, isSeedWeek
  }],
  customTemplate: [],
  settings: {
    erkenntnisseHorizont: 8,  // geclampt gegen realWeeks beim Render
    autoEval, plateStep, barbellWeight, ...
    nutritionPhase: 'maintenance',  // 'bulk'|'maintenance'|'cut' — B139, additiver Default, kein SCHEMA-Bump
    hideStopwatch: false,   // B171 (train-v229), additiver Default
    largestPlate: 25,       // B182 (train-v229) — Hantelscheiben-Rechner-Obergrenze, additiver Default
  },
  prs: {},
  coachPerformance: { suggestions: [] },
  substituteHistory: {},   // { [originalExerciseName]: { name, count, lastUsed }[] } — D2, additiver Default, kein SCHEMA-Bump
  exerciseNotes: {},       // { [exerciseName]: string } — B127, permanent, additiver Default, kein SCHEMA-Bump
  customAlternatives: {},  // { [exerciseName]: string[] } — B138, additiver Default, kein SCHEMA-Bump
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
- `train:set-done`: wird sowohl von `ui.js` (`confirm-set`-Klick-Handler) als auch von `timer.js` selbst gefeuert (`_bindAppInteractions()` erkennt `[data-action="toggle-done"]`-Klicks direkt auf `#app`, ohne über ui.js' eigenes Klick-Routing zu gehen — historisch gewachsen). Beide Pfade respektieren `settings.autoStartPauseTimer` seit train-v199 konsistent (B78, vorher prüfte das nur der `confirm-set`-Pfad).
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
_checkRecurringFatigue()   // seit v235 (B140, Runde 13, Council-Entscheidung):
                              // detectSessionFatigue() (sessionSummary.js, tages-
                              // skaliert) trat in JEDER der letzten 3 konsekutiven
                              // Nicht-Deload/Nicht-Urlaub-Wochen an ≥1 Tag auf.
                              // Reine Beobachtung, optionaler Deload-Hinweis nur im
                              // <details>-Aufklapp-Feld, kein Action-Button im Haupttext.
_checkConsistencyQuality()  // Frequenz stabil + Qualität↓ + curPct<75%
_checkPushPullBalance()     // Ratio >1.5 über erkenntnisseHorizont
_checkCompoundIsolationBalance() // seit v194 (B79): Compound-Sätze
                              // (Squat/Hinge/Push/Pull) <60% über
                              // erkenntnisseHorizont, sonst kein Signal
```
Max. 2 gleichzeitig (multi_exercise_failure > deload > recurring_fatigue > consistency_quality > push_pull > compound_isolation).
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

**RPE-Schwellen (bewusst unterschiedlich, seit Runde 7/9 als benannte Konstanten
dokumentiert statt anonymer Zahlenliterale — siehe AUDIT-BERECHNUNGEN.md für die
volle Klassifizierung "unterschiedliches Konzept, korrekt getrennt" pro Wert,
NICHT konsolidieren):**
- Progressionsbereitschaft: avgRPE ≤ 8.0
- Konfidenz HIGH: ≤ 7.5 (`CONF_HIGH_AVG_RPE_MAX_4WK`, weeklyFocus.js) | Konfidenz MEDIUM: ≤ 8.5 (`CONF_MEDIUM_AVG_RPE_MAX_4WK`)
- Satz-Zone "hart": ≥ 8.5 (`RPE_SET_HARD_ZONE`, sessionCoach.js, Einzelsatz/Echtzeit)
- Deload-Strategie-Weiche: ≥ 8.5 (`RPE_PLATEAU_DELOAD_STRATEGY_1WK_AVG`, plateauDetector.js, 1-Wochen-Ø pro Übung)
- Präventives Deload-Signal: > 7.5 (`RPE_PREVENTIVE_DELOAD_3WK_AVG`, weeklyFocus.js, 3-Wochen-Ø fürs ganze Programm)

**Datumsvergleiche:** immer `dayISO < todayISO` (nicht `<=`) — heutiger Tag gilt als noch nicht fällig.

---

## GAMIFICATION-STATUS

**Entfernt (train-v150):** surpriseRewards.js, Streak-Freeze, Flammen-Icon 🔥, Badge-Granting, tip-07, Badge-Countdown.

**Behalten:** Streak-Zahl (neutral: "X Wochen konsistentes Training"), Abzeichen-Galerie (historisch, eingefroren), PR-Badges am Satz (✓/↑/🏆).

**Aufwärmen-Button hat 🔥 — das ist unrelated zu Streak, NICHT anfassen.**

---

## FEATURE-STATUS

### Implementiert ✓:
**Training-Tab:** Wochenstruktur, Pillen-Nav, Satz-Bewertung (auto+manuell), Gewichtsempfehlung (seit v165 auch Distanz/Zeit-Progression für metric 'm'/'sec' via getMetricRecommendation(), B18; seit v172 pro-Übung-Schrittweite statt fixem Delta, B48), Schrittweite-Vorschlag aus Historie (v173, B49, nur sichtbarer Hinweis), anpassbare Steigerungsmenge im Empfehlungs-Chip (v173, B50), Progressions-Präferenz, PR-Erkennung, "Heute anders", Übung archivieren, Stoppuhr, Auto-Wochenerstellung, Deload/Urlaubsmodus (seit v205/B96: Deload-Plan im Coach-Tab reduziert Volumen [Satz-Anzahl, `s.deloadSkip`, gesperrt+ausgegraut mit "Deload"-Badge] statt Intensität [Gewicht] — Wahl zwischen "Diese Woche"/"Nächste Woche" beim Übernehmen, Restore der originalen Satz-Anzahl aus der Vor-Deload-Woche danach), Körpergewicht, Schlaf+Energie, Share-Bild bei echtem PR (v186, B68 — Tagesabschluss-Screen; v189, B73 — zusätzlich sofortiger Toast direkt nach dem PR-Satz), Pre-Session Check-in + Session Briefing (v192, B76 — Zwei-Tap Schlaf/Energie-Check-in am heutigen Tag, Briefing mit Fokus-Übung + RPE-Ziel, Gewichtsreduktion bei schlechter Tagesform, per Settings-Toggle "Session Coach" abschaltbar; seit v202/B87 nachträglich korrigierbar über "✎ Tagesform anpassen"; seit v202/B88 zusätzlicher manueller Catch-up-Button für die Reduktion; seit v205/B96 differenziert nach kumuliertem vs. einmaligem Schlafmangel — `reduced_mild` [-5%, alle Übungen] vs. `reduced` [-10%, nur Compound-Übungen, `modifierScope`], niedrige Energie eskaliert immer zu `reduced`), Intra-Session Coach (v193, B77 — Feedback direkt unter jedem bewerteten Satz: Gewichts-/Pause-Empfehlung nach RPE-Bereich bzw. Erfolg/Fehlschlag ohne RPE, Abschluss-Nachricht mit Nächste-Woche-Projektion, Weiterer-Satz-Vorschlag bei RPE≤6, Aufwärm-Empfehlung 50/70/85%, erweiterte Favoriten-RPE-Nudge — alles über denselben "Session Coach"-Toggle abschaltbar; seit v202/B89 mit "Übernehmen ↗"-Button, setzt Gewicht des nächsten Satzes + startet Pause-Timer in einem Tap, seit v203/B94 bleibt die Bestätigung dauerhaft sichtbar statt nach 2s zu verschwinden, auch nach Undo; seit v203/B92 Entscheidungsmatrix v2 — RPE + Wdh-Differenz kombiniert statt nur RPE, plus RPE-Trend-Erkennung; seit v203/B93 aufklappbare "▾ Warum?"-Begründung; seit v204/B95 Pausendauer sportwissenschaftlich nach Trainingsziel [neue Settings-Zeile "Trainingsziel", `state.settings.goal`] + Compound/Isolation [`isCompoundExercise()`, movementMap.js] differenziert statt einer einzigen RPE-Spalte, Vorschau im Session Briefing; seit v205/B96 respektiert auch die Intra-Session-Dämpfung den Compound/Isolation-Scope), Session Summary (v194, B79 — Vollbild-Screen direkt nach Tagesabschluss vor dem bestehenden Tagesabschluss-Screen: bis zu 3 Übungs-Highlights, 1-2-Satz-Einordnung nach Prioritätskaskade, Vorschau nächstes Training; einmalige Schlaf-Erfolgsquote-Korrelation wenn nachweisbar und genug Historie vorhanden; seit v222/B140 zusätzlich ein informativer Intra-Session-Erschöpfungs-Block, wenn die letzten Übungen einer Session deutlich schlechter performen als die ersten [RPE-Anstieg ≥1.5 UND Erfolgsquote sinkt ≥10 Prozentpunkte], `detectSessionFatigue()` in sessionSummary.js, tagesskaliert, NICHT im Coach-Tab). Alternativübungen im "Heute anders"-Dialog (v222, B138 — kuratierte Chip-Vorschläge aus exerciseAlternatives.js + eigene gespeicherte Alternativen `state.customAlternatives`, neben der bereits bestehenden historienbasierten Vorschlagsliste). Ernährungsphase (v222, B139 — Settings-Toggle Aufbau/Erhalt/Diät, `state.settings.nutritionPhase`, beeinflusst Steigerungs-Empfehlung und Coach-Tab-Plateau-Signal/Subtext, siehe DECISIONS.md).

**Wochenrückblick-Modal:** Zusammenfassung/Highlights/Lowlights/Empfehlungen (weekReview.js/weekReviewModal.js), Share-Bild-Button (v186, B68; Sparkline-Redesign v187, B71; Favoriten-Kaskade v189, B73) — auch im manuellen Wochenrückblick-Dropdown im Fortschritt-Tab (v188, B72).

**Coach-Tab:** Hauptkarte (8 akute Signale, seit v160 inkl. Konsistente Fehlschläge) + Strukturkarte (6 strukturelle Signale, seit v163 inkl. Mehr-Übungen-Aggregation, seit v194/B79 inkl. Compound/Isolation-Balance, seit v235/B140/Runde 13 inkl. `recurring_fatigue`), Adaptive Nachfrage-Karte, Coach-Bilanz Mini, Plateau-Konsequenz (EX_SET_NEXT_WEEK_PLAN), Deload-Plan-Tabelle mit "Plan übernehmen" bei aktiver präventiver Deload-Karte (v194, B79). Seit v215 (E1): jede Haupt- UND Strukturkarte hat eine "▾ Basis dieser Einschätzung"-Disclosure (bestehende `.coach-why-collapse`-Komponente umbenannt/erweitert statt eines zweiten Toggles) mit strukturierter Evidence-Liste (`focus.evidence`/`sig.evidence`, `{label, value}[]`) — die konkreten Datenpunkte, die zur jeweiligen Einschätzung geführt haben. Seit v236 (B200/Runde 14): 4 der 6 Strukturkarten-Signale (`deload_preventive`/`consistency_quality`/`push_pull`/`recurring_fatigue`) haben einen generischen "Verstanden"-Dismiss-Button (`state.decisionLog`, je eigene Cooldown-Dauer, gedeckelte 3-stufige Eskalation bei Re-Trigger statt identischem Text) — `injury_reminder` und `multi_exercise_failure`/`compound_isolation` bewusst ohne, Deload-Haupttext jetzt reine Beobachtung statt Imperativ (siehe DECISIONS.md).

**Fortschritt-Tab:** Erkenntnisse (geclampt), Gesamtperformance, Push/Pull-Ratio, Übungsfortschritt-Chart mit Prognose, Streak (neutral), Abzeichen-Galerie, Körpergewicht-Chart, Bewegungsschaubild, Coach-Bilanz, Relative Stärke / Pound-for-Pound (`renderRelativeStrengthChart()`, progressChart.js + `_weeklyP4PSeries()`, ui.js — war fälschlich noch unter "Offen/Konzept" gelistet, Doku-Drift im Deep-Check-Audit v169 gefunden).

**Technisch:** iOS Safe Area, Auto-Backup, Service Worker (user-gated Update; seit v235/B62/Runde 13: Registrierung an die erste Trainingsaktion gekoppelt statt an den Seitenaufruf, reduzierter Precache-Scope — `datenschutz.html`/Badge-PNGs nicht mehr precached), movementMap (+32 englische Synonyme), isFullSuccess(), consistencyUtils.js. Konfigurierbare größte Hantelscheibe (v229, B182 — `settings.largestPlate`, Default 25kg). Muskelgruppen-Zuordnung für die Standard-Übungsbibliothek (v229/v230, B184/B188 — `ex.tags`, separate Taxonomie zur Bewegungsmuster-Klassifizierung, revidiert 2 zuvor tote Insight-Signale P-04/W-03).

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
Deload (Hauptkarten-Kontext, z.B. Plateau-Strategie): "Deload einplanen"
Deload-Struktursignal (seit Runde 14): reine Beobachtung im Haupttext
  ("X Wochen ohne Deload, Volumentrend Y / Ø-RPE Z"), Empfehlung nur im
  <details>-Aufklapp-Feld — siehe "Beobachtung als Default-Ton für
  Coach-Struktursignale" in DECISIONS.md, gilt für ALLE Struktursignale.
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
