# TRAIN — Session Log
# Automatisch von Claude Code
# befüllt beim Session-Start

## 2026-07-14 train-v175 (B54 — Install-Button im Onboarding)
Eigentliche Aufgabe: direkter Anschluss an die Pre-Launch-Checkliste (B51-B53).
  Nutzer fragte, ob im Onboarding ein Button platziert werden kann, der die
  App automatisch auf den Home-Bildschirm bringt, damit der Nutzer das nicht
  manuell machen muss. Zunächst als technische Frage beantwortet statt direkt
  zu implementieren (exploratory-question-Stil, 2-3 Sätze): Android/Chrome/
  Edge haben ein echtes Browser-API dafür (`beforeinstallprompt`, echter
  Ein-Tap-Install-Dialog), iOS Safari hat diese API grundsätzlich NICHT
  (Apple erlaubt Web-Apps technisch nicht, den nativen "Zum Home-Bildschirm"-
  Dialog programmatisch auszulösen — kein Trick umgeht das). Realistischste
  Umsetzung vorgeschlagen: Button erkennt die Plattform und löst entweder den
  echten Prompt aus (Android) oder zeigt eine bebilderte Anleitung (iOS).
  Nutzer bestätigte "Ja, umsetzen".
  Umsetzung: index.html registriert `beforeinstallprompt`/`appinstalled`-
  Listener ganz am Anfang des Modul-Scripts (Event kann jederzeit früh
  feuern), `preventDefault()` unterdrückt die browsereigene Mini-Infobar,
  das Event wird auf `window.__trainInstallPrompt` zwischengespeichert
  (gleiches Muster wie das bereits bestehende `window.__trainExportJSON`).
  `appinstalled` feuert ein neues `train:app-installed`-Browser-Event nach
  dem bereits etablierten `train:show-update-banner`-Muster, auf das ui.js
  reagiert und ein anonymes GoatCounter-Event "App installiert" feuert
  (aussagekräftigeres Nutzungs-Signal als reine Seitenaufrufe, passt zur
  B52-Analytics-Arbeit vom Vorsprint).
  In ui.js `_showOnboarding()`: neue Onboarding-Phase `_obPhase='install'`,
  die NACH der Vorlagen-Wahl greift (nicht davor — erst Wert zeigen, dann
  installieren fragen ist die etablierte PWA-UX-Empfehlung), aber nur wenn
  sie auch etwas bewirken kann — neue Helper `_isIOS()`/`_isStandalone()`
  prüfen das: iOS zeigt eine Anleitung (Teilen-Symbol → Zum Home-Bildschirm),
  ein vorhandenes `beforeinstallprompt` löst den echten nativen Dialog aus,
  ansonsten (Desktop-Firefox, bereits als Standalone installiert) wird der
  Screen komplett übersprungen und direkt fertiggestellt statt einen
  wirkungslosen Button zu zeigen. Beim Bauen aufgefallen: mehrere CSS-Klassen
  (`.ob-logo`, `.ob-sub`) existierten bereits in styles.css, wurden aber
  nirgends in ui.js verwendet — vermutlich Reste eines früheren, komplexeren
  Onboarding-Designs. Für den neuen Install-Screen wiederverwendet statt neue
  Klassen zu erfinden, damit dieser bisher tote CSS-Code endlich bespielt
  wird. Neue Klassen nur für das iOS-Anleitungs-Kästchen (`.ob-ios-help`)
  ergänzt, da dafür kein passendes bestehendes Muster existierte.
  Verifiziert per 3 gezielten Playwright-Szenarien (jeweils frischer Browser-
  Context, simulierter `beforeinstallprompt` bzw. iOS-User-Agent bzw. keins
  von beidem): Android-Fall ruft `prompt()` korrekt auf und schließt das
  Onboarding; iOS-Fall zeigt die Anleitung erst nach Tap auf den Button,
  "Später" schließt zuverlässig; Desktop/nicht-unterstützter Fall überspringt
  den Install-Screen komplett und schließt sofort — keine der drei Varianten
  zeigt fälschlich einen wirkungslosen Button. Zusätzlich per Screenshot
  visuell geprüft (iOS-Anleitung sieht konsistent zum bestehenden Splash-
  Screen-Branding aus). Regressionstest 10/10 grün, Playwright 18/18 grün.
  CACHE_VERSION → train-v175, CSS → ?v=191 (kein SCHEMA-Bump — keine neuen
  State-Felder, reine UI/Browser-API-Erweiterung). Versionsnummer in den
  Einstellungen (Info-Sektion, aus B53) auf train-v175 nachgezogen.

Loop 5: for-advisor.txt aktualisiert (Stand v175, 10. Fassung — deckt jetzt
  B47-B54 ab, vorherige Fassung war Stand v170/B44-B46). Direkt gegen den
  aktuellen Code verifiziert (Coach-Kaskade, Prozentzahlen-Tabelle,
  MovementMap unverändert seit v170 bestätigt; CLAUDE.md-Sync per Grep
  bestätigt, kein Drift; externe Netzwerk-Aufrufe geprüft — nur noch
  GoatCounter; aktueller CI-Run 29339573665 abgerufen, beide Jobs grün).
  Neue Abschnitt-6-Einträge: Performance-Score-Root-Cause (Architektur,
  kein Bundler), Platzhalter-App-Icons, GoatCounter-Platzhalter-Site-Code,
  offene Domain-Frage. Session-Ende, ausgelöst durch Nutzer-Anfrage
  "content export?" nach expliziter Ankündigung, die Session zu schließen.

## 2026-07-14 train-v174 (B51+B52+B53 — Pre-Launch-Checkliste)
Eigentliche Aufgabe: Nutzer fragte, direkt im Anschluss an B49/B50, was vor
  dem Launch an die ersten ~20 echten Nutzer noch geprüft werden sollte, um
  einen schlechten ersten Eindruck zu vermeiden, und ob es dafür ein
  Branchen-Standard-Protokoll gibt. Zunächst als Analyse-Frage beantwortet
  (Recherche im Code statt Spekulation): zwei bis dahin unbekannte, konkrete
  Funde ergaben sich direkt aus einer Volltextsuche über alle .js/.html-
  Dateien — (1) Google Fonts liefen live über fonts.googleapis.com/
  fonts.gstatic.com, der einzige externe Netzwerk-Aufruf der gesamten App,
  was direkt der eigenen "kein Server/Datenschutz als USP"-Positionierung
  (DECISIONS.md) widerspricht und in Deutschland ein bekanntes DSGVO-
  Abmahnrisiko ist (LG München 2022); (2) kein Impressum/Datenschutz-
  erklärung vorhanden, obwohl bei einem öffentlichen Angebot an mehrere
  fremde Nutzer vermutlich nach §5 TMG erforderlich. Zusätzlich als
  Nebenbefunde: kein Feedback-Kanal, kein globaler JS-Error-Handler, eine
  seit langem eingefrorene falsche Versionsnummer in den Einstellungen.
  Nutzer bat anschließend um `/plan`, um alle Punkte zu strukturieren und
  eine Lösung für "wie sehe ich, wie viele Nutzer aktiv sind" zu finden.
  Per AskUserQuestion wurde GoatCounter (kostenlos, cookielos, DSGVO-
  konform ohne Consent-Banner) als Analytics-Ansatz gewählt (Alternativen:
  Plausible/eigener Mini-Zähler/nur GitHub Insights) — die App läuft rein
  statisch auf GitHub Pages (bestätigt in README.md/CLAUDE.md), es gibt
  kein Backend, daher ist irgendeine Form von Tracking technisch die
  einzige Möglichkeit, diese Frage zu beantworten. Trainingsdaten bleiben
  dabei ausschließlich lokal — GoatCounter zählt nur anonyme Events.
  Mit `/plan` zu einer 7-Schritte-Checkliste durchgeplant, dann sequenziell
  umgesetzt:
  - **B51 (Fonts):** Bebas Neue + DM Sans per curl mit Browser-User-Agent
    von Google heruntergeladen (4 woff2-Dateien, identisch zu den zuvor
    live ausgelieferten), unter fonts/ abgelegt, @font-face-Regeln in
    styles.css ergänzt (DM Sans als Variable-Font-Range 300-600 statt 4x
    derselben Datei — Google liefert für alle 4 statischen Gewichte
    dieselbe Variable-Font-Datei aus, per curl-Diff bestätigt). Google-
    Fonts-Links aus index.html entfernt. sw.js: totes Google-Fonts-
    Runtime-Caching (FONT_CACHE-Konstante, staleWhileRevalidate()-Funktion,
    dedizierter fetch-Handler-Zweig) komplett entfernt statt als toten Code
    stehen zu lassen, da Fonts jetzt same-origin sind und über den
    normalen App-Shell-Precache laufen. Verifiziert per Playwright:
    document.fonts zeigt beide Familien als 'loaded', 0 failed requests,
    grep über alle .js/.html zeigt danach keinen externen Aufruf mehr
    außer dem bewusst gewählten GoatCounter.
  - **B52 (Analytics + Error-Handler):** GoatCounter-Script-Tag mit
    Platzhalter-Site-Code (TODO vor Launch). Neuer _gcEvent()-Helper in
    ui.js, Custom Events "Woche erstellt" (_createWeek()) und "Onboarding
    abgeschlossen" (Onboarding-_finish()) an bestehenden Dispatch-Punkten
    angehängt, kein Reducer-Umbau. Neuer globaler window.error/
    unhandledrejection-Handler in index.html feuert ein train:js-error-
    Browser-Event, auf das ui.js reagiert (Toast + anonymes js_error-Event)
    — reused exakt das bestehende train:show-update-banner-Muster statt
    einen neuen Kommunikationsweg zu erfinden. Feedback-mailto-Zeile in
    den Einstellungen ergänzt. Verifiziert per Playwright: synthetisches
    train:js-error-Event zeigt zuverlässig den erwarteten Toast-Text.
  - **B53 (Impressum/Datenschutz/Icons):** Info-Sektion in
    renderSettingsTab() erweitert (korrekte Versionsnummer, aufklappbare
    Datenschutz-/Impressum-Zeilen über das bereits bestehende
    .session-note-toggle/.session-note-body-Akkordeon-Muster, bisher nur
    für Aufwärmen/Cooldown-Notizen genutzt — keine neue CSS nötig).
    Unabhängig beim vollen Lighthouse-Lauf entdeckt: manifest.json hatte
    gar kein icons-Array, und icon-192.png/icon-512.png — von index.html
    UND manifest.json referenziert — existierten im gesamten Projekt
    nirgends. "Zum Home-Bildschirm hinzufügen" hätte also gar kein
    App-Icon gezeigt, potenziell der schlechteste denkbare erste Eindruck
    für eine PWA. Da ein echtes Icon-Design eine Branding-Entscheidung ist,
    die dem Nutzer gehört, wurde stattdessen ein funktionaler Platzhalter
    erzeugt: identisch zum bereits etablierten Splash-Screen-Branding
    (dunkler Hintergrund, "TRAIN"-Wortmarke in Bebas Neue/Lime), per
    Playwright-Screenshot einer gerenderten HTML-Vorlage in beiden
    benötigten Größen gerendert (kein fertiges Icon-Design, klar als
    Platzhalter dokumentiert). manifest.json/index.html/sw.js
    entsprechend ergänzt.
  - Voller Lighthouse-Lauf (bisher nur gezielt Accessibility geprüft):
    Accessibility 100, Best-Practices 96→100 (Fix: fehlender
    <link rel="icon"> verursachte automatischen favicon.ico-404, von
    Lighthouse als Konsolen-Fehler gewertet), SEO 100 (ungeprüft aber
    bereits perfekt), Performance ~57-60 unter Lighthouses simulierter
    Slow-4G-Mobilthrottling (150ms RTT, ~1.6Mbps) — Root Cause identifiziert:
    die bewusste "kein Bundler"-Architektur (CLAUDE.md) bedeutet ~20
    einzelne ES-Module-Dateien, die der Browser unter dieser simulierten
    Drosselung nacheinander/parallel anfragen muss, bevor der erste Frame
    rendert (Bootup-Time/Main-Thread-Arbeit selbst sind unauffällig, 0.1s/
    1.0s — reines Netzwerk-Problem). modulepreload-Hints für alle
    App-Module in index.html als risikofreie Optimierung ergänzt (Browser
    kann parallel statt sequenziell laden) — gemessene Verbesserung lag
    innerhalb der Mess-Rauschgrenze (mehrere Lighthouse-Windows-EPERM-
    Cleanup-Flakes während der Messungen, dokumentiertes B30-Muster,
    JSON-Resultate trotzdem korrekt geschrieben vor dem Crash). Bewusst
    KEIN Bundler eingeführt — wäre die einzige echte Abhilfe, aber eine
    offene Architektur-Änderung außerhalb des Scopes dieser Checkliste.
    Reale Nutzer mit normalem WLAN/LTE dürften deutlich bessere Ladezeiten
    erleben als dieses simulierte Worst-Case-Szenario.
  - B27 (Touch-Drag-Reorder) im Rahmen der Checkliste erneut geprüft und
    bewusst als Nicht-Blocker für den Launch bestätigt (Pfeile decken den
    Bedarf ab).
  DECISIONS.md: neuer Eintrag unter ARCHITEKTUR ("Anonyme Nutzungs-Zählung
  (GoatCounter) statt kein Tracking") mit der Abwägung Datenschutz vs.
  Sichtbarkeit. Regressionstest 10/10 grün, Playwright 18/18 grün nach
  jedem der 3 Fixes einzeln geprüft. CACHE_VERSION → train-v174, CSS →
  ?v=190 (kein SCHEMA-Bump — keine neuen State-Felder).
  Vier TODOs bleiben vor dem echten Launch offen (nicht durch Code lösbar):
  GoatCounter-Site-Code eintragen, Impressum-Kontaktdaten eintragen,
  Feedback-E-Mail eintragen, "Nutzer-Null"-Gerätetest manuell durchführen.

## 2026-07-14 train-v173 (B49+B50 — Schrittweite-Vorschlag aus Historie + anpassbarer Empfehlungs-Chip)
Eigentliche Aufgabe: direkter Anschluss an B48. Nutzer korrigierte mich
  zunächst explizit, dass sein 1.25kg-Bankdrücken-Beispiel aus B48 nur
  eine Illustration war und nicht als feste Regel im Code verankert
  werden sollte — daraufhin nach echter individueller Konfigurierbarkeit
  gefragt, mit der Idee, die Schrittweite aus der geloggten Gewichts-
  Historie der Übung automatisch zu lernen. Auf Nachfrage "prüfe kritisch
  ob das der beste Weg ist" habe ich die reale Risiken einer stillen
  Automatik benannt (Kaltstart-Problem, mehrdeutige Delta-Wahl bei
  wechselnden Historien, Rausch-Fortpflanzung, Transparenzverlust —
  Kollision mit dem Nordstern "Athlet entscheidet, App schlägt nur vor")
  und stattdessen einen sichtbaren, nicht automatisch angewendeten
  Vorschlag vorgeschlagen. Nutzer stimmte zu und bat zusätzlich um eine
  frei editierbare Alternative im Wochen-Empfehlungs-Chip (Beispiel:
  System schlägt 5kg vor, Athlet traut sich nur 2.5kg zu).
  Mit `/plan` formal durchgeplant (Explore-Agent + Plan-Agent), davor
  explizit nach "was fehlt noch / blinder Fleck" gefragt — dabei ein
  echtes Architektur-Risiko VOR der Implementierung gefunden:
  `_prepNewWeekModal()` dispatcht bei jedem Re-Render erneut das
  Auto-Preselect, ein selbst gewählter Custom-Wert wäre ohne Gegenmaß-
  nahme beim nächsten Render auf den vollen Vorschlag zurückgesprungen.
  3 Design-Fragen per AskUserQuestion mit Nutzer abgestimmt (Feature A
  nur in "Erweitert"-Sektion, Feature A für Gewicht UND Distanz/Zeit
  gleichzeitig, Feature B ohne Halbierungs-Preset).
  Umsetzung Feature A (B49): `exMetricHistory()`, `detectRecurringStep()`,
  `detectRecurringWeightStep()` neu in insightEngine.js (Schwelle: 3
  identische positive Sprünge bei ≥4 Historien-Punkten). Neuer sichtbarer
  Vorschlagstext im etablierten `.target-suggestion`/`.btn-adopt-target`-
  Muster bei den Schrittweite-Buttons (Gewicht + Distanz/Zeit), neue
  Handler `adopt-suggested-step`/`adopt-suggested-metric-step` dispatchen
  die bereits existierenden `EX_SET_STEP`/`EX_SET_METRIC_STEP`-Actions
  (keine neue Action nötig — reiner sichtbarer Vorschlag, nie automatisch
  angewendet).
  Umsetzung Feature B (B50): `_renderRecChip()` umgebaut um einen
  "Anderer Wert"-Eingabepfad (wiederverwendet das etablierte
  `.ex-kg-picker`-Muster), neue Modul-Variablen `_recChipCustomOpenName`/
  `_userCustomStepChoice` (analog zu `_kgPickerKey`/
  `_userDismissedAutoSelect`), neue Handler `rec-chip-show-custom`/
  `rec-chip-custom-confirm`. `_prepNewWeekModal()`-Auto-Preselect-Logik
  um Custom-Wert-Prüfung erweitert (löst das zuvor identifizierte Risiko).
  Beim Testen zusätzlich einen echten Implementierungs-Lücke gefunden:
  der neue Custom-Picker hatte noch keinen Outside-Click-Close-Handler
  (anders als der bestehende `.ex-kg-wrap`) — nachgerüstet in `_handleClick`.
  Verifiziert per Node-Skripten (reine Funktionsaufrufe: Muster-Erkennung
  mit synthetischer Historie, EX_SET_NEXT_WEEK_PLAN-Dispatch +
  _applyPlannedProgression()-Pfad) UND echten Playwright-UI-Interaktionen
  (nicht nur localStorage-Shortcuts) inklusive eines dedizierten Tests für
  das Auto-Preselect-Snapback-Risiko (Re-Render via toggle-more-recs,
  Custom-Wert bleibt erhalten). Regressionstest 10/10 grün, volle
  Playwright-Suite 18/18 grün.
  DECISIONS.md: neuer Eintrag unter COACH-LOGIK (B49/B50) mit der
  Design-Entscheidung (sichtbarer Vorschlag statt Automatik, kein
  Halbierungs-Preset). CACHE_VERSION → train-v173, CSS → ?v=189
  (kein SCHEMA-Bump — keine neuen State-Felder, `ex.nextWeekPlan`/
  `ex.weightStep`/`ex.metricStep` existieren bereits).

## 2026-07-14 train-v172 (B48 — Gewichtsempfehlung pro-Übung-Schrittweite)
Eigentliche Aufgabe: Nutzer meldete ein selbst bemerktes Logik-Problem
  (nicht aus einem Audit) — die automatische Coach-Gewichtsempfehlung
  soll bei schweren Grundübungen (Kniebeuge, Kreuzheben) in 5kg-Schritten
  steigern, bei leichteren Übungen (Bankdrücken) in 1.25kg-Schritten.
  Status-quo-Vergleich zuerst (wie vom Nutzer verlangt): das Schrittweite-
  Feld pro Übung (ex.weightStep) existiert bereits und wird vom manuellen
  "+kg"-Button schon korrekt genutzt — aber getWeightRecommendation()
  (die automatische Empfehlung) hatte die Sprunggröße fest auf 2.5kg
  ("volle Steigerung")/1.25kg ("kleine Steigerung") hartkodiert,
  unabhängig von der eingestellten Schrittweite — die wurde nur zum
  Runden des Endergebnisses benutzt. Interessanter Fund dabei:
  getMetricRecommendation() (das B18-Gegenstück für Distanz/Zeit-
  Übungen) macht es bereits richtig (Schrittweite = Sprunggröße) — das
  Muster existierte im selben File schon, nur nicht für Gewicht.
  Design-Frage geklärt: bei bereits kleiner Schrittweite (Bankdrücken,
  1.25kg) macht eine weitere Halbierung (0.625kg) keinen Sinn — Nutzer
  entschied: "kleine Steigerung" bleibt dann bei 1x Schrittweite.
  Umsetzung: weightRecommendation.js — fullDelta=weightStep,
  halfDelta = weightStep<=1.25 ? weightStep : weightStep/2. Zusätzlich
  3 Insight-Trigger-Stellen (insightEngine.js, A-01/A-01b/A-02 Toast-
  Vorschläge) korrigiert, die bisher `undefined` statt der Übungs-
  Schrittweite übergaben und damit denselben pauschalen Default nutzten
  — im Sinne von "überall konsistent, nicht nur an der Hauptstelle".
  Verifiziert per Node-Skript (echte getWeightRecommendation()-Aufrufe,
  nicht nur Unit-Test der internen Formel): Kniebeuge (Schrittweite 5)
  liefert jetzt +5 (volle Steigerung) bzw. +2.5 (kleine Steigerung),
  Bankdrücken (Schrittweite 1.25) liefert +1.25 in beiden Fällen (keine
  Halbierung), Standard-Schrittweite (2.5, unveränderter Fall) liefert
  weiterhin exakt +2.5/+1.25 wie vor der Änderung — Rückwärtskompatibi-
  lität bestätigt.
  DECISIONS.md: neuer Eintrag unter COACH-LOGIK (B48) mit der
  Design-Entscheidung. Regressionstest 10/10 grün, Playwright 18/18
  grün. CACHE_VERSION → train-v172 (kein CSS-Bump, kein SCHEMA-Bump —
  keine neuen State-Felder, nur Berechnungslogik geändert).

## 2026-07-14 train-v171 (B47 — PR-Tracking-Bug)
Eigentliche Aufgabe: der im vorherigen Konsolidierungs-Sprint
  zurückgestellte Fund 4 ("PR-Erkennung evtl. 3 statt 2 Kopien") sollte
  genauer geprüft werden, auf Nutzer-Anfrage.
  Zeile-für-Zeile-Vergleich der 3 Kandidaten in state.js
  (SET_TOGGLE_DONE, CONFIRM_SET, AUTO_EVAL_SET): CONFIRM_SET und
  AUTO_EVAL_SET sind bit-identisch (nur kosmetische Whitespace-
  Unterschiede) — reine, überflüssige Duplikation. SET_TOGGLE_DONE
  (der manuelle ✓-Button, laut Projekt-Historie die häufigste
  Eingabeart) fehlte dagegen das komplette ex.oneRM-Update-Fragment,
  das die anderen beiden haben — ein echter Bug, nicht nur
  Duplikations-Risiko.
  Impact-Analyse: ui.js:1606 (Trainings-Tab-1RM-Hinweis) hat einen
  Live-Fallback (rechnet bei fehlendem ex.oneRM direkt aus den
  aktuellen Sätzen neu), der das im laufenden Betrieb kaschiert — aber
  ex.oneRM ist als wochenübergreifendes historisches Maximum gedacht
  (state.js: _resetClonedDays() rührt es beim Wochenwechsel bewusst
  nicht an, Migration v19→v20-Kommentar bestätigt die Absicht). Nutzer,
  die nur über den ✓-Button bestätigen, hätten den Hinweis beim Wechsel
  in eine neue, leere Woche verschwinden sehen, statt weiterhin den
  Vorwochen-Bestwert zu zeigen.
  Fix: neue gemeinsame _applyPrTracking(state, ex, weight, reps) in
  state.js (vor der reduce()-Funktion). Alle 3 Reducer delegieren jetzt
  dorthin, keine 3 Kopien mehr.
  Verifiziert auf zwei Ebenen: (1) volle Playwright-Suite 18/18 grün.
  (2) gezieltes Node-Skript mit ECHTEM dispatch(A.SET_TOGGLE_DONE, ...)
  (nicht nur die extrahierte Funktion isoliert aufgerufen) — localStorage
  minimal gemockt, State direkt mutiert, Reducer real durchlaufen:
  ex.oneRM war vorher null, ist danach korrekt 116.7 (Epley: 100kg ×
  (1+5/30)). Damit ist Fund 4 aus dem Konsolidierungs-Audit
  abgeschlossen — alle 4 Funde (B44-B47) bearbeitet.
  CACHE_VERSION → train-v171 (kein CSS-Bump, kein SCHEMA-Bump).

## 2026-07-14 train-v170 (Konsolidierungs-Sprint)
Eigentliche Aufgabe: direkte Fortsetzung der Geräte-Verifikation — Nutzer
  bat um einen systematischen Audit des ganzen Codes auf Berechnungen,
  die an mehreren Stellen unabhängig implementiert sind und dadurch
  auseinanderlaufen können (Muster aus B36/B44).
  Ein read-only Fork-Agent durchsuchte alle Root-JS-Dateien gezielt nach
  8 Kandidaten-Kategorien (Erfolgsquote, Tage-Eligibility, Kategorie-
  Lookup, Datums-Formel, PR-Erkennung, Volumen, Archiviert-Filter,
  Streak/Badge-Schwellen). 4 Cluster gefunden, mit Nutzer besprochen:
  - Fund 1 (Erfolgsquote): _weekSuccessScore() (ui.js) vs.
    _calcSuccessScore() (weekReview.js) — dieselbe Formel, aber
    _calcSuccessScore() schloss archivierte Übungen NICHT aus (Ursache
    der "100% Ziel"-Verwirrung aus der Geräte-Verifikation).
  - Fund 2 (Tage-Eligibility, = B44 von eben): _reachableDays()
    (weekReview.js) ohne isTrainingDay()-Filter.
  - Fund 3 (Kategorie-Lookup): 2x identisch dupliziert (ui.js,
    weeklyFocus.js), UND komplett fehlend in computeBreadthProgress()
    (overallPerformance.js) — Kategorie-Overrides dort ignoriert.
  - Fund 4 (PR-Erkennung): möglicherweise 3 statt der dokumentierten 2
    Kopien (state.js) — Fork konnte Byte-Gleichheit nicht abschließend
    bestätigen.
  Nutzer-Entscheidung: Fund 1-3 sofort konsolidieren, Fund 4 erst genauer
  prüfen bevor entschieden wird (noch offen für nächste Session).
  Umsetzung (jeweils einzeln implementiert, mit Regressionstest +
  gezieltem Node-Skript verifiziert, dann committet):
  - B44: weekReview.js importiert isTrainingDay() aus state.js,
    _reachableDays() filtert jetzt damit (Datei-Kopfkommentar "kein
    State-Zugriff" präzisiert: gemeint ist kein getState()/dispatch(),
    nicht "keine Imports aus state.js").
  - B45: neue weekSuccessCounts(week) in setUtils.js — einzige Quelle
    der Erfolgsquote-Formel. _weekSuccessScore() (ui.js) und
    _calcSuccessScore() (weekReview.js) delegieren beide dorthin.
  - B46: neue buildCategoryMap()/resolveCategory() in movementMap.js.
    ui.js und weeklyFocus.js nutzen sie jetzt statt eigener Inline-
    customCatMap-Logik; computeBreadthProgress() (overallPerformance.js)
    nutzt sie neu (vorher gar keine Override-Berücksichtigung).
  AGENTS.md-Dependency-Matrix aktualisiert (weekReview.js neu Tiefe 1
  statt Tiefe 0, importiert jetzt setUtils.js + state.js). CLAUDE.md
  Modul-Tabelle (setUtils.js, movementMap.js) entsprechend ergänzt.
  CACHE_VERSION → train-v170 (kein CSS-Bump, styles.css nicht
  angefasst, kein SCHEMA-Bump). Finaler Kombi-Regressionslauf:
  Playwright 18/18 grün.

## 2026-07-14 (Geräte-Verifikation, kein neuer Code-Sprint, weiterhin train-v169)
Eigentliche Aufgabe: Nutzer wollte den Deep-Check-Audit (B36-B40) auf
  echtem Gerät nachtesten. 4 Test-JSONs gebaut
  (tests/TRAIN_Test_DeviceCheck_*.v1.json: PushPullKonsistenz,
  ArchivierteUebung, UrlaubstagKonsistenz, UndoNachLoeschung) — jedes
  gezielt so konstruiert, dass der jeweilige Fix sichtbar wird. Vor der
  Übergabe an den Nutzer alle 4 selbst über den ECHTEN "JSON
  importieren"-Weg (Playwright: echter Datei-Upload über das
  Settings-Input, nicht der localStorage-Shortcut der regulären
  Fixtures) verifiziert — dabei zwei Fehler im eigenen Test-Setup
  gefunden und korrigiert (Onboarding-Screen blockierte Klicks ohne
  vorherigen Seed-Zustand; innerText() erfasst keine Input-Werte, Test
  prüfte Übungsnamen fälschlich per innerText statt .inputValue()).
  Wegwerf-Testdatei danach gelöscht (Konvention).
  Nutzer-Ergebnis auf echtem Gerät: 3/4 wie erwartet (B36 Push/Pull,
  B37 archiviert, B39 Undo). B38 (Urlaubstag) zunächst als "nicht wie
  erwartet" gemeldet — Diagnose ergab keinen Bug: "1/2 Tage" und
  "100% Ziel" in der Wochenrückblick-Karte sind zwei unabhängige,
  beide korrekte Kennzahlen (Tage-Anwesenheit vs. Erfolgsquote der
  bewerteten Sätze), siehe BUGS.md "BEWUSST KEIN BUG". Dabei einen
  dritten unabhängigen "welche Tage zählen als geplant"-Berechnungsort
  gefunden (weekReview.js `_reachableDays()`, filtert anders als
  consistencyUtils.js/state.js) — als B44 (OFFEN) getrackt, dasselbe
  Duplikations-Muster wie B36.
  Nutzer bat um systematische Konsolidierungs-Prüfung statt Einzelfix
  — nächster Schritt: Audit über den ganzen Code auf weitere Fälle
  dieses Musters, dann Konsolidierungsplan vorlegen.
  Kein Code geändert, kein Versions-Bump (weiterhin train-v169).

## 2026-07-14 train-v169
Eigentliche Aufgabe: Nutzer wollte vor dem Shippen sichergehen — "keine
  Bugs oder Logikfehler oder anderes". Nutzer wählte explizit den
  "Kompletten Deep-Check" (statt nur bestehende Tests bestätigen oder
  nur Code-Lesen).
  4 parallele, rein lesende Diagnose-Agents gestartet (Muster 1 aus
  AGENTS.md — sicher parallel, da nur lesend):
  - Fork A: Coach-Kaskade (weeklyFocus.js, plateauDetector.js,
    weightRecommendation.js) — 3 Funde.
  - Fork B: Fortschritt-Tab-Berechnungen (progressChart.js,
    overallPerformance.js, consistencyUtils.js, PR/Streak/Badges) —
    3 Funde.
  - Fork C: Training-Tab-Bedienung (Satz-Bewertung, Progressions-
    Präferenz, Heute-anders, Archivieren, Auto-Wochenerstellung,
    Deload/Urlaub, Timer) — 2 Funde, davon 2 empirisch per Playwright
    bestätigt.
  - Fork D: Persistenz/Migration/Undo/Backup (state.js migrate(),
    _NO_UNDO, backup.js, dual-localStorage) — 3 Funde, migrate() selbst
    mit synthetischem Uralt-State real durchgetestet (0 uncaught
    errors, alle Felder korrekt migriert).
  Alle 4 Forks räumten ihre Wegwerf-Test-Dateien selbständig auf
  (git status nach Abschluss sauber, keine _verify_*/_audit_*-Reste).
  10 Funde konsolidiert, mit Nutzer besprochen (2 gezielte Fragen zu
  den mehrdeutigen Fällen):
  - 4 eindeutige Bugs → sofort alle reparieren (Nutzer-Entscheidung).
  - Tote Plateau-Strategie "Variation" (B41) → nur dokumentieren
    (Nutzer-Entscheidung, größerer Umbau nötig für echten Fix).
  - RPE-Schwellen-Inkonsistenz bei Gewichtsempfehlung (B40) →
    begradigen (Nutzer-Entscheidung).
  5 Fixes sequenziell umgesetzt, JEDER einzeln mit Playwright (18/18)
  verifiziert bevor der nächste begann:
  - B36: weeklyFocus.js `_checkPushPullBalance()` success+fail
    (war seit B32 aus dem Sync mit ui.js gefallen — 2 Forks fanden das
    unabhängig).
  - B37: archivierte Übungen in 3 Zählstellen (2× ui.js, 1×
    weeklyFocus.js) jetzt ausgeschlossen, wie bereits bei
    `_weekSuccessScore()`.
  - B38: consistencyUtils.js `_weekConsistencyRatio()` — Urlaubstage
    zählen nur noch bei markedDone ODER echter Aktivität als erledigt.
  - B39: state.js `_NO_UNDO` — 4 Einstellungs-Actions ergänzt.
  - B40: weightRecommendation.js `_recommendationCore()` — RPE-Grenze
    7→7.5, Erfolgsquoten-Schwelle 0.9→0.8 für die "niedriges RPE"-
    Bedingung (schließt Lücke, beseitigt Inversion).
  Zusätzlich zu den Playwright-Läufen: 3 wegwerfbare Node-Skripte
  gebaut (nicht committet, nach jedem Lauf gelöscht), die direkt die
  betroffenen pure functions aufrufen und das tatsächliche Vor/Nach-
  Verhalten zeigen — z.B. RPE 7.0/85% liefert jetzt delta:2.5 (vorher
  0), RPE 8.0/85% weiterhin delta:1.25 (Inversion damit nachweislich
  weg, nicht nur behauptet).
  Nebenbei CLAUDE.md-Doku-Drift korrigiert: "Relative Stärke" (P4P)
  stand fälschlich unter "Offen/Konzept", ist aber bereits vollständig
  implementiert (Fund aus Fork B).
  CACHE_VERSION → train-v169 (kein CSS-Bump, styles.css nicht
  angefasst, kein SCHEMA-Bump). Finaler Kombi-Regressionslauf:
  Playwright 18/18 grün, git status sauber.

## 2026-07-13 train-v168
Eigentliche Aufgabe: direkte Fortsetzung des train-v167-Sprints — Nutzer
  bat darum, die beiden dort zurückgestellten Lighthouse-ARIA-Findings
  (B34/B35) jetzt auch umzusetzen, nachdem sie in einfacher Sprache
  erklärt wurden. Beide liegen in `_buildScaffold()` (ui.js):
  B34: `<main id="page-workout" role="tabpanel">` → `<section
  id="page-workout" role="tabpanel">` — `role="tabpanel"` ist für
  `<main>` kein zulässiger ARIA-Wert, die anderen 4 Tab-Seiten nutzten
  bereits `<section>`. Vor der Änderung per Grep bestätigt: kein
  CSS/JS referenziert das Element über den Tag `main`, nur über
  `#page-workout` — risikofrei.
  B35: `<div id="days-container" aria-label="Trainingstage">` bekam
  `role="region"` ergänzt — ein nacktes `<div>` hat implizit
  `role="generic"`, das keinen zugänglichen Namen aus `aria-label`
  ableiten darf; `role="region"` macht das Label gültig.
  Verifiziert: Playwright 18/18 grün, danach `npx lhci autorun`
  (1 von 1 Versuchen sauber durchgelaufen) zeigt Accessibility
  95 → 100, keine verbleibenden Accessibility-Findings unter Score 1.
  CACHE_VERSION → train-v168 (kein CSS-Bump, styles.css nicht
  angefasst). BUGS.md B34/B35 von OFFEN nach BEHOBEN verschoben.

## 2026-07-13 train-v167
Loop 1: 18/18 grün (npx playwright test, regression_core.spec.js +
  17 Fixtures), 0 uncaught errors. Kein Fix nötig.
Loop 2: HANDOFF.md/CLAUDE.md waren aktuell (train-v166/?v=187, passend
  zu sw.js/index.html vor diesem Sprint). Kein Fix nötig.
Loop 3: übersprungen — Stopp-Bedingung (15/15, tatsächlich bereits mehr)
  längst erreicht, keine UX-Hoch-Bugs offen.
Loop 4: übersprungen (inaktiv)
Eigentliche Aufgabe: Zweiter echter Multi-Agent-Sprint (2 parallele
  Agents, disjunkte Dateien lt. AGENTS.md-Matrix):
  Agent 1 (ui.js): B32 — Push/Pull-Ratio-Block in
  `_renderMovementPattern()` war die letzte der 4 Erfolgsquote-Stellen,
  die seit B22 (v157) noch nicht auf success+fail vereinheitlicht war.
  Fix: `ex.sets.filter(s => s.status === 'success')` →
  `filter(s => s.status === 'success' || s.status === 'fail')`.
  `_weekSuccessScore()`/`_weekTrainingStatus()` bewusst unangetastet
  (andere Semantik, siehe DECISIONS.md).
  Agent 2 (index.html + styles.css): Lighthouse Accessibility-Audit
  (`npx lhci autorun`, lokal — bekannter Windows-EPERM-Cleanup-Fehler
  siehe B30, 2 von 3 Läufen erfolgreich). Ausgangsscore 91, 3 Findings
  unter Score 1: `color-contrast` (`.ob-tpl-sub` u.a., 3.63 statt 4.5:1,
  Ursache `--c-text-3` gegen `--c-surface`), `aria-allowed-role`
  (`<main role="tabpanel">`) und `aria-prohibited-attr` (`<div
  aria-label>` ohne gültige Rolle). Nur der Kontrast-Fund lag im
  erlaubten Scope (index.html/styles.css) — `--c-text-3` global von
  `#72727A` auf `#90909A` angehoben (berechnet gegen alle 3
  Hintergründe, auf denen die Variable verwendet wird, nicht nur gegen
  den einen von Lighthouse gemeldeten). Die beiden ARIA-Findings liegen
  in `_buildScaffold()` (ui.js), also außerhalb des Scopes — als B34/B35
  dokumentiert, nicht gefixt (dem Ziel "≥95 oder Begründung" der
  Sprint-Vorgabe entsprechend).
  Ergebnis: Accessibility 91 → 95. Regressionstest 10/10 grün,
  Playwright 18/18 grün nach beiden Fixes zusammen. Keine Kollision
  zwischen den beiden Agents (disjunkte Dateien, siehe AGENTS.md
  Muster 5, neu dokumentiert).
  CACHE_VERSION → train-v167, CSS ?v=188.
Loop 5: for-advisor.txt aktualisiert (Stand v167, B32/B33/B34/B35
  eingepflegt).

## 2026-07-13 train-v166
Loop 1: 10/10 grün (nach 2 isolierten Flakes bei Prüfpunkt 8 während
  der Testreihe — bekanntes Headless-Timing-Artefakt, unabhängig via
  Playwright 18/18 bestätigt, kein Zusammenhang mit dem Fix).
Loop 2: HANDOFF.md/CLAUDE.md waren aktuell. Kein Fix nötig.
Loop 3/4: übersprungen (Stopp-Bedingung erreicht / inaktiv).
Eigentliche Aufgabe: "ja, fix umsetzen" — B31 aus der Vorsession-
  Diagnose implementiert. Fix: ui.js:2426 `!== 'kg'` → `!== 'reps'`
  (die bereits vorab dokumentierte Empfehlung, hier ausgeführt statt
  nur diagnostiziert). Vor dem Commit 3 gezielte Szenarien verifiziert
  (nicht nur "regression grün" angenommen): (1) MaxGewicht-Fixture mit
  leerem prs zeigt jetzt korrekt "~550.0 kg geschätzter 1RM (Epley ·
  500 kg × 3 Wdh)". (2) Eigens gebauter Ausweichübungs-Test (echte
  Kniebeuge-Session 100kg×5 in Woche 1, Beinpresse-Substitution
  200kg×8 in Woche 2) zeigt jetzt korrekt das höhere Epley-Ergebnis
  (253.3) aus der Substitutions-Woche — der Hauptfall, für den der
  Fallback ursprünglich gebaut wurde, aber nie griff. (3) Regressions-
  schutz: metric 'm'/'sec'-Übungen (DistanceProgression-Fixture) zeigen
  weiterhin korrekt keinen 1RM-Hint. Alle 3 Szenarien 0 uncaught errors.
  BUGS.md B31 von OFFEN nach BEHOBEN verschoben. Kein DECISIONS.md-
  Eintrag nötig (reiner Bugfix, keine neue Architektur-Entscheidung).
  CACHE_VERSION → train-v166 (kein CSS-Bump, styles.css nicht
  angefasst, kein SCHEMA-Bump, keine Datenmodell-Änderung).
Loop 5: for-advisor.txt aktualisiert (Stand v166, B31-Fix eingepflegt,
  alte "nicht gefixt"-Notiz zu B31 in technischen Schulden entfernt).

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

## 2026-07-14 train-v175 (DSGVO/Rechts-Review, kein Code-Sprint)
Loop 1: 18/18 grün (Playwright, regression_core + alle 17 Fixtures) ✓ —
  Kontroll-Lauf, kein Code geändert, daher erwartungsgemäß unverändert.
Loop 2: aktuell ✓ — CACHE_VERSION (sw.js train-v175) und CSS (?v=191)
  stimmen mit HANDOFF.md/CLAUDE.md überein, kein Sync nötig.
Loop 3: übersprungen — Stop-Bedingung bereits erfüllt (17 Fixtures ≥ 15),
  keine UX-Hoch-Bugs offen.
Eigentliche Aufgabe: Nutzer bat um Prüfung der App auf DSGVO-Verstöße und
  sonstige rechtliche Risiken vor weiterer Nutzerwerbung. Code-Review
  (index.html, ui.js, manifest.json, sw.js, fonts/) statt Vermutung:
  - **B55 (Blocker):** Impressum in den Einstellungen ist nur ein TODO-
    Platzhalter (`ui.js:4113-4118`), während die App bereits live ist und
    Nutzerwerbung + Bezahlfunktion geplant sind — akutes Abmahnrisiko nach
    § 5 TMG/DDG. War als TODO bereits bekannt, jetzt mit Rechts-Einordnung
    priorisiert vor jeder weiteren Nutzerwerbung.
  - **B56 (Mittel):** Datenschutz-Akkordeon (`ui.js:4097-4106`) ist keine
    vollständige Art.-13-Erklärung — v.a. fehlt ein Hinweis auf GitHub
    Pages als Hoster (IP-Verarbeitung durch Microsoft, unabhängig von
    GoatCounter), Betroffenenrechte, Verantwortlicher.
  - **B57/B58 (Low):** keine "Alle Daten löschen"-Funktion; OFL.txt für
    die selbst gehosteten Fonts (B51) fehlt im Repo.
  Positiv bestätigt: rein lokale Datenspeicherung (kein Server/Konto),
  selbst gehostete Fonts statt Google-Fonts-CDN, GoatCounter cookielos
  ohne weitere externe Netzwerk-Aufrufe (manifest.json/sw.js geprüft,
  sauber) — strukturell bereits datensparsam aufgebaut.
  Details siehe BUGS.md B55-B58, HANDOFF.md NEXT-Sektion. Keine Code-
  Änderung (reine Analyse/Doku), kein Versions-Bump. Lokal committet,
  Push braucht Bestätigung (Push-Policy, LOOPS.md).
Loop 5: übersprungen — kein Code seit letzter Regenerierung (cd9c4a5,
  Stand v175) geändert, for-advisor.txt wäre inhaltlich identisch.

## 2026-07-18 train-v176 (B59 — Security-Bestandsaufnahme vor Public-Launch)
Loop 1: 19/19 grün (Playwright: regression_core + 17 Fixtures + neuer
  Security-Test) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf
  train-v176 synchronisiert (Push: erledigt, Commit 98a5842)
Loop 3: übersprungen — Stop-Bedingung bereits erfüllt (17 Fixtures ≥ 15)
Eigentliche Aufgabe: Nutzer bat um eine Security-Bestandsaufnahme, nachdem
  er auf Instagram Beispiele gehackter "vibecoded" Apps gesehen hatte
  (Stichworte: API-Keys, Rate Limiting, DDoS, Auth, Access Control) —
  Ziel: alles schließen vor dem Public-Launch, in Alltagssprache erklärt.
  Per /plan zunächst ein Realitätscheck: TRAIN hat kein Backend/keine
  API-Keys/keine Accounts (verifiziert per Code-Audit), daher trifft der
  Großteil der üblichen Checkliste (Rate Limiting, JWT, SQL-Injection,
  SSRF, IDOR) auf die heutige Architektur schlicht nicht zu — dokumentiert
  als konsolidierte Tabelle im Plan. Ein Explore-Agent fand die einzige
  real zutreffende Lücke: `ui.js:4134` (Template-Editor) schrieb
  `ex.name` ohne das etablierte `h()`-Escaping direkt in ein
  `value`-Attribut — sowohl beim Tippen als auch über einen präparierten
  JSON-Import ausnutzbar. Fix: `h()` ergänzt. Zusätzlich `backup.js`s
  Import-Validierung gehärtet (`_sanitizeImportedState()`, Typ-/Längen-
  Coercion + 5-MB-Dateigrößen-Cap, Defense-in-Depth) und einen
  CSP-`<meta>`-Tag in index.html ergänzt (GitHub Pages erlaubt keine
  echten HTTP-Header; `'unsafe-inline'` bei script-src bewusst
  beibehalten, siehe DECISIONS.md "SICHERHEIT"). Neuer Regressionstest
  `tests/security_xss.spec.js` — manuell gegen den unreparierten Code
  laufen lassen zur Bestätigung, dass er die Lücke wirklich fängt (schlug
  dort korrekt fehl, danach Fix wiederhergestellt). Neues Dokument
  `SECURITY.md`: Teil 1 = heutiger Ist-Zustand, Teil 2 = dokumentierte,
  noch NICHT gebaute Blaupause für Auth/Rate-Limiting/Access-Control-
  Matrix/API-Key-Handling, aktiviert erst sobald die geplante Paywall/
  Coaching-Funktion einen echten Server bekommt. Committed, gepusht,
  Milestone-Backup erstellt (`backups/TRAIN_2026-07-18_security-xss-fix-csp-b59/`).

## 2026-07-18 train-v177 (B55/B56 — Impressum/Datenschutz strukturell vervollständigt)
Loop 1: 19/19 grün ✓ (nach Textänderung erneut bestätigt, inkl. Ad-hoc-
  Check dass beide Akkordeons fehlerfrei aufklappen)
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf
  train-v177 synchronisiert
Loop 3: übersprungen — unverändert seit v176
Eigentliche Aufgabe: direkter Anschluss an den B59-Sprint — Nutzer bat
  darum, die B55/B56-Platzhalter (Impressum/Datenschutz, aus der DSGVO/
  Rechts-Review vom 2026-07-14) mit korrektem rechtlichem Rahmentext
  vorzubereiten statt nur "TODO" stehen zu lassen. `ui.js` Settings-Tab:
  Impressum-Block hat jetzt § 5 TMG/DDG-Rahmentext mit klar markierten
  Platzhalter-Zeilen (Name/Anschrift/E-Mail in eckigen Klammern, ⚠️ +
  Warnfarbe). Datenschutz-Block erweitert um Verantwortlicher-Zeile
  (verweist auf Impressum statt Daten zu duplizieren), Rechtsgrundlage
  (Art. 6 Abs. 1 lit. f DSGVO), GitHub-Pages-Hosting-Hinweis mit Link
  zum GitHub Privacy Statement, Betroffenenrechte-Absatz, präzisierte
  GoatCounter-Formulierung. B55 bleibt Blocker (braucht echte
  Name+Anschrift-Angaben vom Nutzer), B56 ist jetzt code-vollständig.
  Zusätzlich zwei Nebenbefunde aus der Loop-5-Regenerierung (siehe
  unten) direkt behoben: `.github/workflows/test.yml` rief
  `security_xss.spec.js` bisher NICHT mit (nur die beiden älteren Specs
  namentlich aufgerufen) — dritter Schritt ergänzt, läuft jetzt bei
  jedem Push mit. `CLAUDE.md:189` hatte noch "State Shape (SCHEMA 29)"
  im Zwischenüberschrift-Label, obwohl SCHEMA_VERSION seit B18/v165
  bereits 30 ist — korrigiert. `project_train.md`-Memory aktualisiert
  (Verweis auf SECURITY.md als Referenz für künftige Server-Anforderungen,
  statt Inhalte zu duplizieren). DECISIONS.md um neue Sektion
  "SICHERHEIT" ergänzt (2 Einträge: Security-Checkliste erst Phase 2,
  CSP `'unsafe-inline'`-Kompromiss). Committed, gepusht, Milestone-Backup
  erstellt.
Loop 5: for-advisor.txt aktualisiert (11. Fassung, Stand train-v177) —
  per Fork direkt aus dem Code erzeugt (nicht aus Doku zusammengefasst),
  fand dabei die beiden oben genannten Nebenbefunde (CI-Wiring-Lücke,
  CLAUDE.md-Label-Drift), die noch im selben Sprint behoben und im
  Export nachgetragen wurden. context-exports/ ist gitignored, nie
  mitgepusht.

## 2026-07-18 train-v178 (B55/B56 — Datenschutz/Impressum erweitert, LEGAL.md, Cross-AI-Review)
Loop 1: 19/19 grün (Playwright) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v178 synchronisiert
Loop 3: übersprungen — unverändert seit v177
Eigentliche Aufgabe: direkter Anschluss an den v177-Sprint — Nutzer ließ
  den vorherigen Plan zusätzlich von Gemini und ChatGPT gegenchecken und
  bat um zwei Dinge: (1) einen Workaround, um die private Adresse im
  Impressum nicht offenlegen zu müssen, (2) eine EXPLIZIT KRITISCHE
  Prüfung des externen KI-Feedbacks statt blinder Übernahme — inkl. der
  Nachfrage, welche weiteren AI-Review-Perspektiven neben Legal/Security/
  Produkt sinnvoll wären. Per /plan durchgeführt (2 Iterationen, da der
  erste Plan-Entwurf das KI-Feedback zu unkritisch übernommen hatte —
  Nutzer wies das explizit zurück und forderte eigenständige Nachrecherche).
  Ergebnis der Nachrecherche (jeder Punkt einzeln mit eigenen Quellen
  verifiziert, nicht nur der KI-Aussage geglaubt):
  - c/o-Geschäftsadresse für die Anschrift bestätigt als legaler
    Workaround (echte Postannahme/-weiterleitung nötig, reines Postfach
    reicht nicht) — Klarname selbst bleibt ohne Workaround Pflicht.
  - Zweiter Kontaktweg (§5 DDG "unmittelbare Kommunikation"): nach
    Rückfrage (Kontaktformular würde neuen Drittanbieter-Service +
    neue externe Verbindung + neuen Auftragsverarbeiter-Eintrag
    bedeuten) Option "nur E-Mail, Risiko akzeptieren" gewählt statt
    Telefonnummer oder Formular.
  - SW/Cache-Rechtsgrundlage korrigiert (Art. 6 Abs. 1 lit. f statt der
    von Gemini vorgeschlagenen lit. b DSGVO — einfachere, gängigere
    Basis, identisch zur bereits genutzten GoatCounter-Grundlage).
  - **Link-Haftungsausschluss (ursprünglich geplant, von ChatGPT als
    "Textballast" kritisiert) nach eigener Recherche komplett
    gestrichen statt nur gekürzt** — Rechtsprechung (LG Hamburg 1998)
    zeigt, dass solche Disclaimer wirkungslos bis kontraproduktiv sind.
    Medizinischer Disclaimer (anderes Rechtsgebiet) bleibt.
  - Neu gefunden, von keiner KI erwähnt: BFSG (Barrierefreiheits-
    stärkungsgesetz, seit 2025-06-28 in Kraft) als künftiger Prüfpunkt
    beim Paywall-Start; dragdrop.js-MIT-Lizenz geprüft und für bereits
    compliant befunden (Hinweis im Dateikopf vorhanden).
  Umsetzung: `ui.js` Datenschutz-Akkordeon erweitert (Local-First-
  Dilemma/Cache-Datenverlust-Warnung, Backup-Hinweis, SW-Cache-Hinweis,
  Transparenz-Checkliste), Impressum-Akkordeon um medizinischen +
  Minderjährigen-Satz ergänzt (kein Link-Disclaimer). Neue eigenständig
  aufrufbare `datenschutz.html` (statisch, kein JS) für künftige
  App-Store-Einreichungen, in sw.js precached. Neues `LEGAL.md` (Fakten,
  kritische KI-Feedback-Prüfung, "später"-Blaupause) — BUGS.md B55/B56
  auf kurze Pointer gekürzt (bleibt reiner Bug-Tracker). CACHE_VERSION
  train-v177→v178. Verifiziert: volle Suite 19/19 grün, Ad-hoc-Checks
  für beide Akkordeons + datenschutz.html bestanden.
Loop 5: 4 Cross-AI-Review-Exportdokumente per 4 parallelen Subagents
  erzeugt — `context-exports/advisor-legal-2026-07-18.txt` (1438 Wörter),
  `advisor-security-2026-07-18.txt` (~1050 Wörter),
  `advisor-product-userjourney-2026-07-18.txt` (~1250 Wörter, bewusst
  von der bestehenden `for-advisor.txt` abgegrenzt — Produkt-/UX-
  Perspektive statt Code-Fakten), `advisor-business-ethics-2026-07-18.txt`
  (~1180 Wörter). Jedes Dokument in sich verständlich ohne Repo-Zugriff,
  endet mit gezielten, projektspezifischen Blind-Spot-Fragen (u.a. eine
  bemerkenswerte eigenständige Frage im Legal-Dokument: ob Art. 9 DSGVO
  "besondere Kategorien" (Gesundheitsdaten) für Körpergewicht/Schlaf/
  Trainingsleistung trotz reiner Lokalspeicherung in irgendeiner Form
  greift — bisher nirgends im Projekt geprüft, echter neuer offener
  Punkt). Alle 4 gitignored, nicht committet.


## 2026-07-18 train-v179 (B57 — "Alle Daten löschen"-Button)
Loop 1: 20/20 grün (Playwright, inkl. neuem Test) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v179 synchronisiert
Loop 3: übersprungen — unverändert seit v178
Eigentliche Aufgabe: Nutzer bestätigte auf Rückfrage, B57 (seit dem
  2026-07-14-DSGVO-Review offen, Low-Priorität) in denselben Sprint wie
  B55/B56 aufzunehmen, da thematisch identisch (Vertrauen/Datenkontrolle).
  Neue Settings-Row "🗑️ Alle Daten löschen" (ui.js, Abschnitt "Deine
  Daten", neben Backup/Restore) — `confirm()`-Dialog mit unmissverständ-
  licher Unwiderruflich-Warnung, identisches Bestätigungsmuster zu
  bereits bestehenden destruktiven Aktionen (`reset-factory`). Löscht
  bei Bestätigung `localStorage[STORAGE_KEY]` + `STORAGE_KEY_SHADOW`
  (aus state.js importierte Konstanten statt hartcodierter String-Keys)
  und lädt die Seite neu. Neuer Regressionstest
  `tests/delete_all_data.spec.js`, in CI verdrahtet — belädt die App
  zuerst mit synthetischen Alt-Daten (eindeutiger Marker-String),
  bestätigt danach dass der Marker nach Löschung+Reload nachweislich
  weg ist UND die App korrekt frisch im Onboarding-Zustand startet
  (kein kaputter Zwischenzustand — `loadState()` erzeugt beim nächsten
  Boot automatisch wieder einen validen Default-State, das ist
  erwartetes Verhalten, kein Datenleck). CACHE_VERSION train-v178→v179.
  Volle Suite 20/20 grün, CI grün. Committed, gepusht, Milestone-Backup
  erstellt.


## 2026-07-18 train-v180 (Cross-AI-Review Runde 2 — kritisch ausgewertet)
Loop 1: 20/20 grün (Playwright) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v180 synchronisiert
Loop 3: übersprungen — unverändert seit v179
Eigentliche Aufgabe: Nutzer ließ die 4 Cross-AI-Review-Exportdokumente von
  zwei weiteren KIs (Claude Cowork, Gemini) gegenlesen und bat ausdrücklich
  um eigenständige, kritische Prüfung statt Übernahme — inkl. der
  expliziten Frage nach weiteren blinden Flecken. Jeder Punkt einzeln
  nachrecherchiert bzw. am echten Code verifiziert (nicht nur behauptet):
  - **§ 25 TDDDG (vormals TTDSG):** echter, bisher übersehener Fund — gilt
    auch für localStorage, nicht nur Cookies. Jetzt explizit als eigene
    Rechtsgrundlage neben Art. 6 Abs. 1 lit. f DSGVO in der
    Datenschutzerklärung benannt (ui.js-Akkordeon + datenschutz.html).
  - **Prototype Pollution beim JSON-Import:** code-verifiziert am echten
    `Object.assign(state, imported)`-Merge in state.js — per direktem
    Test bestätigt, dass ein `"__proto__"`-Key in der importierten JSON
    ohne Guard tatsächlich state's Prototype-Chain kapert (kein
    Mythos-Abnicken, empirisch nachvollzogen: Test schlägt ohne Guard
    fehl, mit Guard nicht, legitime Importe bleiben unverändert). Fix:
    neue `_stripPrototypePollutionKeys()` in backup.js, läuft als
    allererstes über jede importierte Datei.
  - **BGH V ZR 210/22 korrigiert:** eine KI hatte das Urteil als Lockerung
    der c/o-Adress-Regel dargestellt — die echte Quellenlage bestätigt
    stattdessen die bereits vorsichtige LEGAL.md-Linie (reine
    Weiterleitungsvollmacht reicht nicht). Nicht gelockert.
  - **§ 312k BGB Kündigungsbutton:** echter neuer Fund (in Kraft seit
    01.07.2022), fehlte in allen 4 Runde-1-Dokumenten trotz direktem
    Bezug zur dort schon aufgeworfenen Paywall-UX-Frage. Als
    DECISIONS.md-Prinzip-Entscheidung festgehalten (Umsetzung über
    Zahlungsanbieter-Self-Service beim Payment-Sprint), analog zu den
    bereits früh getroffenen Gamification-Entscheidungen.
  - **BFSG-Einschätzung** leicht nach oben korrigiert (wahrscheinlich
    unproblematisch statt "unklar"), aber nicht so kategorisch "gelöst"
    übernommen wie vorgeschlagen — eigene Quelle bleibt vorsichtiger.
  - **Abgelehnt, mit technischer Begründung statt Meinung:** SRI-Hash für
    GoatCounter (unversionierte Script-URL, würde bei Anbieter-Updates
    lautlos brechen — Wartungs-Trade-off, kein Nulltarif-Fix wie
    behauptet), "zirkuläre JSON-Struktur als Client-DoS" (faktisch
    unmöglich, JSON-Syntax kennt keine Referenzen), client-seitige
    localStorage-Verschlüsselung + "silent automated native backup"
    (beide von Gemini als Top-Priorität vorgeschlagen — Verschlüsselung
    ist Security-Theater gegen das selbst genannte XSS-Szenario, da der
    Schlüssel im selben Origin/Web-Crypto-Keystore läge; Silent-Backup
    ist auf iOS Safari, TRAINs Hauptzielplattform, technisch nicht
    umsetzbar ohne Nutzer-Geste).
  - **Preis-Fund (recherchiert, noch offene Entscheidung):** Strong PRO
    $4,99/Monat, Hevy Pro $23,99/Jahr — TRAINs geplante 8-12€/Monat
    liegen deutlich darüber. Nicht direkt vergleichbar (TRAINs
    kostenloser Tier deckt bereits ab, was Strong/Hevy bezahlt anbieten;
    8-12€ sind für ein bei beiden Wettbewerbern fehlendes Coaching-
    Feature), aber psychologisch real. Bleibt offen, braucht
    Nutzer-Entscheidung (Preis senken, Jahres-Tier ergänzen, oder
    Coach-Wert stärker kommunizieren) — nicht code-seitig gelöst.
  - Neuer BUGS.md-Kandidat B60 (Streak-Anzeige optional ausblendbar,
    Low-Priorität, nicht umgesetzt) aus dem Business/Ethik-Dokument.
  Umsetzung: `ui.js`/`datenschutz.html` (TDDDG-Absatz), `backup.js`
  (Prototype-Pollution-Guard), `LEGAL.md`/`SECURITY.md` (je neuer
  "Kritische Prüfung Runde 2"-Abschnitt mit Quellen), `DECISIONS.md`
  (Kündigungsbutton-Prinzip), `BUGS.md` (B60). CACHE_VERSION
  train-v179→v180. Volle Suite 20/20 grün.
Loop 5: übersprungen — for-advisor.txt (Loop 5) wäre nach diesem Sprint
  wieder einen Schritt hinter dem echten Stand, aber kein neuer
  Cross-AI-Advisor-Export in diesem Sprint angefordert — nachholen bei
  Bedarf im nächsten Sprint.


## 2026-07-18 train-v181 (Cross-AI-Review Runde 3 vorbereitet, B61 Versions-Anzeige-Fix)
Loop 1: 20/20 grün (Playwright) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v181 synchronisiert
Loop 3: übersprungen — unverändert seit v180
Eigentliche Aufgabe: Nutzer bat um Aktualisierung aller .md-Dateien UND
  der 4 Cross-AI-Advisor-Exportdokumente für eine dritte externe
  Beratungsrunde, per paralleler Subagents. Konsistenz-Check über alle
  .md-Dateien lief zuerst (grep auf veraltete Versionsnummern) — keine
  echten Doku-Drifts gefunden, alle bereits korrekt auf v180 synchron
  (historische Sprint-Log-Einträge mit alten Versionsnummern sind
  korrekt, keine Fixes nötig). Anschließend 4 parallele Forks, je ein
  `context-exports/advisor-*.txt`-Dokument komplett neu erzeugt:
  - **Legal:** § 25 TDDDG + § 312k BGB ergänzt, explizite Warnung vor der
    BGH-Fehlinterpretation aus Runde 2 als Kalibrierungs-Hinweis für
    Runde 3 ("selbst spezifisch klingende Zitate prüfen, auch in diesem
    Dokument").
  - **Security:** Prototype-Pollution-Fix + alle 4 abgelehnten
    Gemini-Vorschläge aus Runde 2 (SRI, zirkuläre-JSON-DoS,
    Verschlüsselung, Silent-Backup) mit technischer Begründung als
    Kalibrierungs-Kontext dokumentiert.
  - **Produkt/UX:** leichteres Update (Runde 2 bestätigte die meisten
    Punkte als echte Ermessensfragen ohne harte Fakten) — Kreuzverweis
    auf die Preisfrage im Business-Dokument statt Duplizierung.
  - **Business/Ethik:** größtes Update — echte Strong/Hevy-Preise
    eingearbeitet MIT der kritischen Neurahmung (Vergleich mit reinen
    Logging-Apps ist die falsche Frage, da TRAINs Gratis-Tier das schon
    abdeckt), Kündigungsbutton-Prinzip + B60 als Erweiterung der
    bestehenden Dark-Pattern-Historie ergänzt, Preisfrage exakt als
    "gibt es eine Referenzklasse für Coaching-Preise, sonst
    Zahlungsbereitschaft der 20 Testnutzer messen" neu gestellt statt
    beantwortet.
  Nebenbefund eines Subagents beim Re-Lesen von ui.js (nicht gesucht):
  B61 — Versions-Anzeige in den Einstellungen zeigte seit train-v175
  unverändert "train-v175", weil dieser Wert bei keinem Sprint seither
  im Update-Ablauf enthalten war (kein gemeinsamer Konstanten-Import
  mit sw.js möglich — sw.js läuft als Classic Script, kein ES-Modul).
  Korrigiert auf train-v181, als expliziter Punkt 5 in CLAUDE.md "NACH
  JEDEM SPRINT AKTUALISIEREN" ergänzt. CACHE_VERSION train-v180→v181.
  Volle Suite 20/20 grün.
Loop 5: nicht erneut ausgeführt — die 4 Advisor-Exportdokumente wurden
  in diesem Sprint bereits gezielt (nicht über den generischen Loop-5-
  Ablauf) aktualisiert; for-advisor.txt selbst (der technische Loop-5-
  Code-Export) bleibt auf Stand v176, nachholen bei Bedarf.
