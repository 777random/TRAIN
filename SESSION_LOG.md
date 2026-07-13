# TRAIN — Session Log
# Automatisch von Claude Code
# befüllt beim Session-Start

## 2026-07-13 train-v165 (B31-Diagnose, kein neuer Code-Sprint)
Eigentliche Aufgabe: "B31 diagnostizieren" — reine Diagnose, keine
  Änderungen am Code (wie explizit gefordert). Root Cause: ui.js:2426
  `if (ex.metric && ex.metric !== 'kg') return [];` in
  _renderAnalysis1RM()'s Fallback-Zweig — 'kg' ist nie ein gültiger
  ex.metric-Wert, Bedingung damit praktisch immer wahr, Fallback liefert
  immer [] statt Daten. Empirisch bestätigt (headless, per fetch der
  echten TRAIN_Test_EdgeCase_MaxGewicht.v1.json-Fixture über
  #chart-ex-select/#chart-1rm-hint, nicht nur Code gelesen): Hint bleibt
  leer trotz klar qualifizierender 500kg×3-Daten. Dabei eine
  Fehlverifikation aus dem Loop-3-Audit (v157) aufgedeckt und korrigiert
  — die damals bestätigte "~550.0 kg"-Anzeige stammte aus einer ANDEREN
  .orm-hint-Instanz (Training-Tab-Live-Ansicht, ui.js:1613, eigene
  korrekte Berechnung), nicht aus der hier untersuchten Fortschritt-Tab-
  Funktion. tests/fixtures/README.md entsprechend korrigiert. Realer
  Haupt-Auslöser in Produktivnutzung identifiziert: Ausweichübungen — der
  Fallback ist explizit für ex.substituteFor-Fälle gebaut (state.js
  aktualisiert state.prs nur unter dem Namen der TATSÄCHLICH
  ausgeführten Übung), greift aber wegen des Guards nie. Empfohlener Fix
  dokumentiert (Zeile 2426 → !== 'reps', oder Zeile entfernen — der
  bestehende weight>0-Filter reicht bereits), NICHT umgesetzt. BUGS.md
  B31 von "Low" auf "UX-Mittel" hochgestuft (realer statt nur
  theoretischer Bug). Kein Versions-Bump, kein Regressionstest nötig
  (kein Code geändert).

## 2026-07-13 train-v165
Loop 1: 10/10 grün ✓, 0 uncaught errors. Kein Fix nötig.
Loop 2: HANDOFF.md/CLAUDE.md waren aktuell (train-v164/?v=187, passend
  zu sw.js/index.html vor diesem Sprint). Kein Fix nötig.
Loop 3: übersprungen — Stopp-Bedingung längst erreicht.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: "B18 angehen (Meter statt Wdh)" — Diagnose zuerst:
  metric 'm'/'sec' war bereits vollständig UI-verdrahtet, die
  eigentliche Lücke lag in getWeightRecommendation()'s lastWeight<=0-
  Guard (liefert für Distanz/Zeit-Übungen immer null, da dort kein
  Gewicht getrackt wird). Konzeptionell neues Feature — vor
  Implementierung 3 Design-Fragen mit Nutzer besprochen (Scope beide
  Metriken vs. nur Distanz, feste vs. konfigurierbare Schrittweite,
  gleiche vs. eigene Auto-Vorauswahl-Schwelle), alle "Empfohlen"-
  Optionen gewählt.
  Umsetzung: weightRecommendation.js (_recommendationCore() extrahiert,
  neue getMetricRecommendation() — bewusst gleiche Feldnamen wie
  getWeightRecommendation() zurückgegeben, damit ui.js's Verbraucher-
  code beide Ergebnisse identisch behandelt), state.js (ex.metricStep
  neu, progressionType-Default korrigiert für metric≠'reps' an allen
  Erstellungsstellen + Migration v29→v30), ui.js (New-Week-Modal-
  Branch, Schrittweite-Picker, metrikabhängige Labels).
  Regressionsschutz: getWeightRecommendation()s Originalverhalten
  (fixe Deltas 2.5/1.25, unabhängig von plateStep) bewusst exakt
  erhalten und per Test abgesichert — beim ersten Refactor-Versuch
  hätte eine zu direkte Verallgemeinerung (delta=step statt fixem Wert)
  das bestehende Verhalten für Nutzer mit nicht-Standard plateStep
  unbemerkt verändert, noch vor dem Testen selbst korrigiert.
  Echten Blocker während der Implementierung gefunden: bestehender
  Skip-Guard in ui.js (`if progressionType==='reps' return`) hätte mit
  dem neuen Default jede Distanz/Zeit-Übung übersprungen, bevor sie
  geprüft wird — korrigiert (Guard gilt jetzt nur noch für
  metric:'reps'-Übungen).
  Nebenbefund bei der Diagnose (nicht Teil des Sprints, nur
  dokumentiert): ui.js:2426 `ex.metric !== 'kg'` ist vermutlich immer
  wahr (kein gültiger Metrik-Wert heißt je 'kg') — als B31 in BUGS.md
  OFFEN getrackt, nicht gefixt (Nutzer bat explizit nur um B18).
  Verifiziert: dedizierte Test-Harness (16 Checks: Empfehlungs-Kaskade,
  Regressionsschutz, EX_ADD-Defaults, Migration) + End-to-End-UI-Test
  (New-Week-Chip "+50m → 450m", targetReps korrekt erhöht statt
  Gewicht) — alle grün. Neue Fixture DistanceProgression.v1.json.
  Regressionstest 10/10 grün, Playwright lokal 18/18 grün.
  SCHEMA_VERSION → 30, CACHE_VERSION → train-v165 (kein CSS-Bump,
  styles.css nicht angefasst).
Loop 5: for-advisor.txt am Ende der Session aktualisiert.

## 2026-07-13 train-v164
Loop 1: 10/10 grün ✓, 0 uncaught errors. Kein Fix nötig.
Loop 2: HANDOFF.md/CLAUDE.md waren aktuell (train-v163/?v=186, passend
  zu sw.js/index.html vor diesem Sprint). Kein Fix nötig.
Loop 3: übersprungen — Stopp-Bedingung (15/15, jetzt 16) längst erreicht.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: 4 Aufgaben —
  (1) Loop 5 (for-advisor.txt am Sessionende) in LOOPS.md ergänzt.
  (2) Prompt-Bibliothek: prompts/ mit 7 Vorlagen angelegt (Sprint-
      Vorgabe sprach von "6 Dateien" in der Akzeptanzliste, listete im
      Detail aber 7 — Widerspruch in der Vorgabe selbst, alle 7 erstellt
      statt einer zu fehlen oder eine wegzulassen).
  (3) Lighthouse CI: zweiter GitHub-Actions-Job `lighthouse` (needs:
      regression). Vor dem Committen lokal getestet (wie schon bei
      B28 etabliert — nicht blind übernehmen) und zwei echte Probleme
      gefunden: `lighthouserc.js` mit `export default` scheiterte an
      package.json's `"type":"module"` (lhci lädt Config per CommonJS
      `require()`) — als `.cjs` mit `module.exports` gelöst.
      `categories:pwa`-Assertion hätte immer sinnlos gewarnt (diese
      Lighthouse-Version hat seit v9 keine PWA-Kategorie mehr,
      auditRan bleibt strukturell 0) — entfernt. Echte lokale Scores:
      Performance 84, Accessibility 91 (klar über der blockierenden
      0.8-Schwelle), Best Practices 96, SEO 100. Lokales `npx lhci
      autorun` ist auf dieser Windows-Maschine ca. 4-von-5-Läufen von
      einem chrome-launcher-EPERM-Cleanup-Fehler betroffen (Windows-
      Eigenart, tritt nach erfolgreicher Messung auf, betrifft nicht
      den ubuntu-latest-CI-Job) — als bekannte lokale Einschränkung
      dokumentiert (BUGS.md B30), nicht weiter verfolgt.
  (4) CLAUDE.md/LOOPS.md aktualisiert (Prompt-Bibliothek, Spec-
      Konvention, CI-Status-Ergänzung, Loop 5).
  ID/Versions-Korrektur: Sprint-Vorgabe nannte "B28"/"train-v163" für
  den Lighthouse-Bug — beide bereits in dieser Session vergeben (B28 =
  GitHub Actions CI, train-v163 = B29 Mehr-Übungen-Aggregation) —
  B30/train-v164 verwendet, wie schon beim vorherigen Sprint (B27-
  Kollision) nach demselben Muster korrigiert.
  Regressionstest 10/10 grün, Playwright lokal 17/17 grün nach allen
  Änderungen. Loop 5 direkt ausgeführt: for-advisor.txt komplett neu
  generiert (3. Fassung, Stand v160→v164, alle 8 Abschnitte direkt aus
  Code-Fakten statt nur aus Doku zusammengefasst — u.a. volle
  computeWeeklyFocus()/computeStructuralSignals()-Bodies, alle 6
  Prozentzahl-Stellen mit Datei:Zeile, vollständige MOVEMENT_MAP).
Loop 1: 10/10 grün ✓ nach der Implementierung (1 isolierter Flake bei
  Prüfpunkt 8 währenddessen beobachtet, 3 weitere Läufe danach sauber —
  gleiches bekanntes Headless-Timing-Artefakt wie bei B28, kein
  Zusammenhang mit dem Code-Change). Playwright lokal: 17/17 grün.
Loop 2: HANDOFF.md/CLAUDE.md aktuell gehalten (in diesem Durchgang
  direkt mitgepflegt).
Loop 3: übersprungen — Stopp-Bedingung (15/15) längst erreicht, die
  16. Fixture war ein gezielter Feature-Test (B29), kein Loop-3-Edge-
  Case-Zuwachs.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: "Mehr-Übungen-Aggregation für persistent_failure"
  (B29) — konzeptionell neues Feature, daher vor Implementierung Design
  mit Nutzer besprochen (CLAUDE.md-Pflichtfragen): 3 AskUserQuestion-
  Runden (Platzierung Strukturkarte vs. akut, Schwelle 0% vs. ≤20%,
  Aktionsfähigkeit Text vs. Button) — jeweils empfohlene Option gewählt.
  Beim Implementieren einen echten Architektur-Konflikt entdeckt und
  VOR dem Schreiben von Code zurückgemeldet: buildDecisionalBalance()-
  Docstring schließt Aktions-Buttons für Strukturkarte-Signale explizit
  aus, "Top-3 mit Gewichtsempfehlung" hätte das gebrochen — Nutzer
  entschied sich für reinen Text (hält Konvention ein).
  Umsetzung: _checkMultiExerciseFailure() in weeklyFocus.js
  (computeStructuralSignals(), Priorität zuoberst — konkretester Befund
  unter den strukturellen Signalen), Rendering in ui.js
  (_structuralSignalHtml()). Mindestens 2 unterschiedliche betroffene
  Übungen als Gate, damit dasselbe Einzelübungs-Scheitern nicht doppelt
  gemeldet wird (akut UND strukturell). Neue Fixture
  MultiExerciseFailure.v1.json bewusst so konstruiert, dass KEINE
  einzelne Übung 0% erreicht (je 17%) — isoliert den neuen Code, zeigt
  klar keinen Overlap mit persistent_failure. Headless verifiziert: sowohl
  computeStructuralSignals()-Rohdaten als auch der tatsächlich gerenderte
  Strukturkarte-Text ("🛑 Erfolgsquote insgesamt nur 17%...").
  Nebenbei: stale Kopfkommentar in weeklyFocus.js korrigiert (akute
  Kaskade listete noch die alte 6-Punkte-Nummerierung von vor v160,
  persistent_failure fehlte dort seit dessen Einführung).
  DECISIONS.md: bestehende "Bekannte Grenze"-Zeile bei
  _checkPersistentFailure als behoben markiert + neuer Eintrag mit den
  3 Design-Entscheidungen. CACHE_VERSION → train-v163 (kein CSS-Bump,
  styles.css nicht angefasst).

## 2026-07-13 train-v162
Loop 1: 10/10 grün ✓ (raf=sync), 0 uncaught errors. Kein Fix nötig.
Loop 2: HANDOFF.md/CLAUDE.md waren aktuell (im selben Session-
  Durchgang bereits korrigiert). Kein Fix nötig.
Loop 3: übersprungen — Stopp-Bedingung (15/15) bereits erreicht.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: GitHub Actions CI + Playwright eingerichtet
  (B28). Vor der Umsetzung echten DOM/Umgebungs-Check gemacht (wie in
  der Sprint-Vorgabe selbst gefordert: "nicht blind übernehmen") —
  4 reale Abweichungen von der Vorlage gefunden und korrigiert:
  (1) regression_core.html gibt sein Ergebnis als Klartext in
      <pre id="result"> aus, nicht als .test-result/.pass-Elemente —
      Spec entsprechend umgeschrieben.
  (2) npx playwright install braucht --with-deps auf ubuntu-latest,
      sonst startet Chromium dort nicht.
  (3) pageerror-Listener in fixtures.spec.js vor page.goto()
      registriert statt danach (Vorlage hätte Fehler beim Reload
      selbst verpasst).
  (4) npm init -y + manueller Server-Start-Schritt entfernt, durch
      committetes package.json + playwright.config.js webServer-Block
      ersetzt (robuster als festes sleep 2).
  Zusätzlich: README.md existierte noch nicht — neu angelegt (Titel +
  Badge). Bug-ID der Vorgabe (B27) kollidierte mit dem bereits in
  dieser Session vergebenen B27 (dragdrop.js) — B28 verwendet.
  Bekannte Lücke: kein Node.js/npm auf dieser Maschine — lokaler
  Playwright-Pre-Check (LOOPS.md Loop 1) kann hier nicht ausgeführt
  werden, GitHub Actions ist bis dahin der einzige Ort, an dem die
  Suite läuft. "Push blockieren" aus dem Ziel-Abschnitt der Vorgabe ist
  ohne Branch-Protection-Regeln nicht erreichbar (reiner Repo-
  Settings-Schritt, nicht Teil des Workflows) — bewusst nicht
  eingerichtet, da main ohne PR-Flow direkt gepusht wird; CLAUDE.md
  entsprechend präzisiert (Badge-Signal statt echtem Block).
  CACHE_VERSION → train-v162, CSS → ?v=186 (kein echter App-Code
  betroffen, Bump als expliziter Sprint-Marker wie schon bei v185).
  Regressionstest 10/10 grün nach allen Änderungen (lokal, headless
  Chrome — Playwright selbst nicht lokal lauffähig, siehe oben).
  Gepusht (813eaf2, nach Nutzer-Bestätigung). Erster GitHub-Actions-Run
  beobachtet (gh run watch): ✓ erfolgreich, beide Jobs grün
  (regression_core.spec.js + fixtures.spec.js/15 Fixtures), 1m7s.
  https://github.com/777random/TRAIN/actions/runs/29247704723

  Danach auf Nutzerwunsch Node.js v24.18.0 LTS installiert (winget,
  --source winget um interaktiven MS-Store-Terms-Prompt zu vermeiden).
  npm install + npx playwright install chromium liefen sauber durch.
  Erster lokaler Testlauf zeigte einen Flake im Regressionstest (9/10
  fehlgeschlagen beim ersten Versuch, "Cannot set properties of null" —
  vermutlich Chromium-Kaltstart direkt nach dem 113-MB-Download,
  retries:1 hat den Gesamtlauf trotzdem grün gemeldet). 4 Wiederholungen
  danach (warm, retries=0) liefen alle sauber durch (~2.3s), GitHub
  Actions selbst hatte in seinem eigenen Log nie einen Retry nötig —
  als einmaliges lokales Kaltstart-Artefakt eingeordnet, nicht als
  echte Race Condition. Voller Suite-Lauf lokal: 16/16 grün, ~30s.
  LOOPS.md/HANDOFF.md/BUGS.md entsprechend aktualisiert.

## 2026-07-13 train-v161
Loop 1: 10/10 grün ✓ (raf=sync), 0 uncaught errors. Kein Fix nötig.
Loop 2: CLAUDE.md war veraltet (Stand/Header zeigten train-v160 · ?v=184,
  sw.js/index.html tatsächlich train-v161 · ?v=185 — Konsolidierung nach
  dem letzten Sprint hatte CLAUDE.md übersprungen). 3 Stellen korrigiert
  (Header-Kommentar, "Aktueller Stand"-Zeile, CSS-Codebeispiel).
  HANDOFF.md/BUGS.md/DECISIONS.md waren aktuell.
Loop 3: übersprungen — Stopp-Bedingung (15/15) bereits erreicht.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: Nutzer sagte "es soll weiter gehen" ohne konkrete
  Aufgabe — SESSION-START-Protokoll ausgeführt, CLAUDE.md-Drift behoben,
  Nutzer nach nächstem Schritt gefragt (Geräte-Verifikation vs.
  Mehr-Übungen-Aggregation vs. B18). Nutzer wählte Geräte-Verifikation
  und testete selbst auf echtem Gerät: B16 (Doppeltipp-Zoom) bestanden,
  dragdrop.js Touch-Drag funktioniert weiterhin nicht (neu als B27
  getrackt, bewusst zurückgestellt — Pfeile in Übungseinstellungen
  decken den Bedarf bereits ab). BUGS.md/HANDOFF.md entsprechend
  aktualisiert, kein Code geändert, kein Versions-Bump nötig.

## 2026-07-12 train-v161
Loop 1: 10/10 grün ✓ (raf=sync), 0 uncaught errors. Kein Fix nötig.
Loop 2: HANDOFF.md/CLAUDE.md waren aktuell (Vorsession bereits
  korrigiert). Kein Fix nötig.
Loop 3: 15/15 Edge-Cases bereits erreicht (Vorsession) — Stopp-Bedingung
  erfüllt, kein weiterer Edge-Case in dieser Session erzeugt.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: 3 Aufgaben sequenziell —
  (1) DECISIONS.md-Lücke geschlossen: _checkPersistentFailure-Priorität
      + persistent_failure-Balance-Design als 2 neue Einträge unter
      COACH-LOGIK.
  (2) B26: buildDecisionalBalance() um persistent_failure-Fall ergänzt.
      Dabei aufgefallen: die Sprint-Vorlage nahm eine andere Objekt-Form
      an ({status,stay,change}) als der echte Code tatsächlich nutzt
      ({stayOption,changeOption,closing}) — nach dem echten Code
      implementiert, nicht nach der Vorlage. "Empfehlung folgen"
      dispatcht EX_SET_NEXT_WEEK_PLAN (Delta über deloadFactor, nicht
      Plateaus hartkodierte 22.5% — bewusste Abweichung für Konsistenz
      zwischen angezeigter Empfehlung und tatsächlich gesetztem Wert).
      Beide Pfade (stay/change) headless verifiziert: Toasts, nextWeekPlan,
      decisionLog-Eintrag korrekt.
  (3) 26 ältere Test-JSONs unter tests/ (Nutzer hatte sie dorthin
      kopiert) real headless importiert und geprüft — alle 26 laufen
      fehlerfrei, alle bereits schemaVersion 29, keine "veraltet"-
      Markierung nötig, keine neuen Bugs. tests/README.md neu erstellt.
  Regressionstest 10/10 grün nach allen Änderungen.
Loop 1: 10/10 grün ✓ (raf=sync), 0 uncaught errors. Kein Fix nötig.
Loop 2: HANDOFF.md war veraltet ("Letzter Commit" zeigte e0b0f01,
  tatsächlich 5a9b935 — 3 Commits fehlten in GEÄNDERT-Tabelle: LOOPS.md,
  SESSION START, Loop-2-Erweiterung). Aktualisiert. CLAUDE.md war bereits
  aktuell (in der Vorsession korrigiert). (Push: erledigt, Commit 56bdba1,
  nach Nutzer-Bestätigung)
Loop 3: übersprungen — B16 (iOS Doppelklick-Zoom) war zu diesem
  Zeitpunkt noch offen und UX-Hoch, Loop 3 läuft laut eigener Priorität
  nur wenn keine UX-Hoch-Bugs offen sind. Nach B16-Fix (siehe unten)
  jetzt keine UX-Hoch-Bugs mehr offen — Loop 3 ab nächster Session frei.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: Nutzer fragte "womit geht es jetzt weiter" —
  SESSION-START-Protokoll ausgeführt, HANDOFF.md-Drift behoben,
  Empfehlung gegeben (B16 vs. Edge-Case-Audit), Nutzer wählte B16.
  Diagnose ergab zwei unabhängige Ursachen statt der einen in BUGS.md
  notierten (Doppeltipp-Zoom-Kollision am +kg/+Wdh-Button UND separates
  Zoom-bei-Fokus auf Set-Inputs <16px) — beide behoben (Commit e312751).
  Grid-Layout-Regression durch Font-Size-Erhöhung per A/B-Screenshot
  geprüft und ausgeschlossen. Regressionstest 10/10 grün. Touch-Verhalten
  selbst weiterhin nicht auf echtem Gerät verifiziert.

  Danach erneut "was als nächstes" gefragt — Nutzer wählte Edge-Case-
  Audit statt manueller Geräte-Verifikation. Alle 5 tests/fixtures/-
  Dateien echt importiert (headless, per fetch der echten JSON-Dateien)
  und verifiziert statt nur schema-validiert. Ergebnis: 0 uncaught
  errors bei allen 5, kein Crash. B17 dabei präzisiert (Vorwoche-Hint
  ist positions- statt namensbasiert, zeigt falsche Übungs-Werte an —
  noch nicht gefixt). EdgeCase_AllesFail-Fixture hat Schlaf+Fail-Sätze
  als überlagernde Störfaktoren, testet nicht isoliert. Details in
  tests/fixtures/README.md. Keine Code-Änderung, nur Doku (README.md,
  BUGS.md B17, HANDOFF.md) — kein Versions-Bump nötig.
