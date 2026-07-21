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


## 2026-07-19 train-v182 (Cross-AI-Review Runde 3 ausgewertet)
Loop 1: 21/21 grün (Playwright, inkl. neuem Streak-Toggle-Test) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v182 synchronisiert
Loop 3: übersprungen — unverändert seit v181
Eigentliche Aufgabe: Nutzer teilte Runde-3-Feedback von Gemini und Claude
  Cowork zu den 4 aktualisierten Advisor-Exportdokumenten, bat um weitere
  kritische Prüfung. Direkte Widersprüche zwischen den beiden KIs traten
  diesmal mehrfach auf — gezielt einzeln aufgelöst statt gemittelt:
  - **GoatCounter-SRI: eigene Fehleinschätzung aus Runde 2 korrigiert.**
    Claude Cowork widersprach der Runde-2-Ablehnung direkt und fand eine
    tatsächlich existierende versionierte GoatCounter-URL (`count.v5.js`)
    mit offiziellem SRI-Hash — per WebFetch an der GoatCounter-
    Primärquelle selbst nachgeprüft (nicht nur der KI geglaubt), Hash
    vollständig übernommen, in `index.html` umgesetzt und per Playwright
    gegen die echte App verifiziert (keine Integrity-Fehler).
  - **§ 309 Nr. 9 BGB:** neuer, an Primärquelle verifizierter Rechts-Fund
    (Claude Cowork) zu AGB-Verlängerungsklauseln — in LEGAL.md als
    "später"-Blaupause ergänzt.
  - **Fitbod-Preis:** Gemini nannte $12,99/Monat als Referenzklasse für
    TRAINs Coaching-Preis, Claude Cowork verweigerte explizit eigene
    Zahlen ("mein Such-Limit war erreicht, ich erfinde nichts aus altem
    Trainingswissen — das war genau der Fehler beim c/o-Punkt in Runde
    2"). Eigenständig nachrecherchiert: aktuell $15,99/Monat bzw. $95,99/
    Jahr (≈$8/Monat effektiv) — Gemini lag ungefähr richtig, aber am
    unteren/veralteten Ende; die aktuelle Zahl macht TRAINs 8-12€ sogar
    noch kompetitiver als von Gemini dargestellt.
  - **BFSG und § 25 TDDDG (Service-Worker):** beide Male widersprachen
    sich die KIs direkt (eine erklärte die Frage für sicher gelöst, die
    andere hielt sie explizit für offen). Jeweils die vorsichtigere
    Einschätzung übernommen — Muster aus Runde 2 bestätigt sich: die KI,
    die transparent macht was sie nicht geprüft hat, lag bisher
    zuverlässiger richtig als die, die volle Sicherheit behauptet.
    Für § 25 TDDDG zusätzlich einen konstruktiven, nicht umgesetzten
    Lösungsvorschlag dokumentiert (Offline-Modus als Opt-in statt
    immer-an, B62 in BUGS.md).
  - **Prototype-Pollution-Guard-Abdeckung geprüft** (Claude Cowork bat um
    einen 10-Minuten-Grep-Check): bestätigt, der Guard sitzt am einzigen
    tatsächlich verwundbaren Punkt, kein zweiter ungeschützter
    JSON-Import-Pfad im Code gefunden.
  Umsetzung (nicht nur Dokumentation): B60 (Streak-Anzeige-Toggle,
  Settings) — dabei einen echten, unabhängigen Bug in `SETTING_TOGGLE`
  gefunden und gefixt (togglete nur bereits existierende Settings-Keys;
  `hideStreakBadge` hatte keinen Default, der Button hätte beim ersten
  Klick still nichts bewirkt). Onboarding-Datenverlust-Hinweis ergänzt
  (Install-Screen). GoatCounter-SRI (`index.html`). LEGAL.md/SECURITY.md/
  BUGS.md um Runde-3-Funde ergänzt. Neue Regressionstests
  `tests/streak_toggle.spec.js`, in CI verdrahtet. CACHE_VERSION
  train-v181→v182. Volle Suite 21/21 grün.
  **Bewusst NICHT getan:** eine vierte Runde von Advisor-Dokumenten
  erzeugen — beide KIs empfehlen unabhängig, stattdessen jetzt die
  Rekrutierung der 20 echten Testnutzer zu starten (Reddit
  r/weightroom, r/powerlifting), da Legal/Security nach 3 Runden gut
  durchgekaut sind und der eigentliche Engpass fehlendes echtes
  Nutzer-Feedback ist, nicht weitere Recherche.
Loop 5: nicht ausgeführt — kein neuer Code-Fakten-Export angefordert.


## 2026-07-19 train-v183 (echter GoatCounter-Site-Code aktiviert)
Loop 1: 21/21 grün (Playwright) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v183 synchronisiert
Loop 3: übersprungen — unverändert seit v182
Eigentliche Aufgabe: Nutzer hat einen GoatCounter-Account angelegt und
  den echten Embed-Code geliefert (Site-Code "train"). `index.html`:
  Platzhalter `<SITE-CODE>` durch `train.goatcounter.com` ersetzt — die
  seit train-v182 aktive versionierte SRI-Absicherung (`count.v5.js` +
  offizieller Hash) blieb unverändert, nur der Site-Code getauscht statt
  auf die vom Nutzer eingefügte unversionierte `count.js`-Variante
  zurückzufallen. Einer von drei verbliebenen Launch-Platzhaltern damit
  erledigt (Impressum-Name/-Adresse und Feedback-E-Mail bleiben offen,
  hängen an B55). CACHE_VERSION train-v182→v183. Volle Suite 21/21 grün.
Loop 5: nicht ausgeführt — kein neuer Code-Fakten-Export angefordert.


## 2026-07-19 train-v184 (5 Nutzer-Bugs — B63/B64 gefixt, B65/B66/B67 offen)
Loop 1: 23/23 grün (Playwright, inkl. 2 neuer PR-Badge-Tests) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf train-v184 synchronisiert. Nebenbei Doku-Drift gefunden und behoben: BUGS.md/LEGAL.md/SECURITY.md hatten den train-v183-GoatCounter-Sprint nicht mitgezogen (Stand-Header blieben bei v182).
Loop 3: übersprungen — unverändert seit v183
Eigentliche Aufgabe: Nutzer meldete 5 Bugs aus dem echten Gebrauch. Jeden
  einzeln diagnostiziert (Code lesen, nicht raten) vor jedem Fix:
  - **B63 — PR-Pokal blieb bei Wiederholung eines alten Rekords sichtbar:**
    `ex.prWeight` (All-Time-Wert, bleibt über Wochen bestehen) wurde beim
    Render live mit `s.weight >= ex.prWeight` verglichen — zeigte den
    Pokal erneut, sobald ein späterer Satz (auch in einer alten,
    abgeschlossenen Woche) denselben oder höheren Wert traf, unabhängig
    von echter Steigerung. Erster Fix-Versuch ("nur aktuellste Woche")
    per Playwright getestet und als unzureichend verworfen — betraf auch
    die aktuelle Woche bei reiner Wiederholung. Eigentlicher Fix: neues
    `s.prBadge`-Feld, von `_applyPrTracking()` (state.js) direkt am Satz
    gesetzt, der den Rekord beim Schreiben tatsächlich auslöst — 3
    Reducer-Aufrufstellen (SET_TOGGLE_DONE/CONFIRM_SET/AUTO_EVAL_SET)
    entsprechend angepasst (Set-Objekt statt nur Gewicht/Wdh übergeben).
    Render-Bedingungen in `renderSetRow()` (ui.js) auf `s.prBadge`
    umgestellt, live-Vergleiche entfernt. Bewusster Kompromiss: bereits
    gespeicherte Sätze (vor train-v184) haben kein `prBadge`, zeigen also
    rückwirkend keine historischen Pokale mehr — Rekonstruktion aus der
    Historie wäre möglich, aber unverhältnismäßig für einen kosmetischen
    Anzeigefehler bei abgeschlossenen Wochen. 2 neue Tests
    (`tests/pr_badge.spec.js`) verifizieren beide Richtungen, inkl. eines
    Fehlversuchs währenddessen (Test-Selektor `.pr-badge` traf anfangs
    auch den unabhängigen "Ziel erreicht"-Badge, dieselbe CSS-Klasse —
    korrigiert auf `.pr-badge:not(.pr-badge--goal):not(.pr-badge--reps)`).
  - **B64 — volle statt Zahlen-Tastatur:** 6 `<input type="number">`
    ohne `inputmode` gefunden und ergänzt (Körpergewicht heute/Ziel,
    Stangengewicht → decimal; Deload-Prozentsatz, Template-Editor
    Sätze/Wdh → numeric; Template-Editor Gewicht → decimal) — analog zum
    bereits etablierten B16-Muster im Rest der App.
  - **B65 — Gewichtssteigerung "immer noch 1,25kg bei Squats":**
    Empfehlungs-Logik (B48) und alle 4 Aufrufstellen lesen `ex.weightStep`
    bereits korrekt — keine Regression gefunden. Root Cause liegt
    stattdessen darin, dass JEDE Übungs-Erstellungsstelle `weightStep`
    unconditional auf 2.5 setzt, ohne die bereits vorhandene
    movementMap.js-Kategorisierung (Kniebeuge = "Squat") zu nutzen. Nicht
    gefixt — Rückfrage an Nutzer, ob das echter Bug (Schrittweite war
    manuell gesetzt) oder Produkt-Frage (smarterer Default fehlt) ist.
  - **B66 — Fehler-Toast beim App-Öffnen:** nicht reproduziert. 2
    realistische Szenarien per Playwright durchgespielt (Neustart ohne
    Daten, 3-Wochen-Bestand mit echter Kniebeuge-Historie), `pageerror`/
    `unhandledrejection`-Listener fingen nichts. `window.goatcounter`-
    Aufrufe bereits defensiv mit Optional Chaining abgesichert. Braucht
    mehr Kontext vom Nutzer.
  - **B67 — zwei Prozentzahlen beim Tages-Abschluss (100%/86%):**
    diagnostiziert als bewusst unterschiedliche, je korrekte Kennzahlen
    (`_showCompletionScreen()`, ui.js — `pct` = Erfolgsquote NUR bewerteter
    Sätze, `effortPct` = Zielerfüllung inkl. übersprungener/pending Sätze,
    aus einem früheren Sprint bewusst so entschieden). Erklärt den
    gemeldeten Fall exakt (KB Windmill übersprungen zieht die
    Zielerfüllung runter, obwohl alles Gemachte erfolgreich war). Direktes
    Analogon zu einem bereits bestehenden "BEWUSST KEIN BUG"-Fall.
    Label-Fix vorgeschlagen (obere Zahl aktuell unbeschriftet), aber
    NICHT umgesetzt — Formulierungsänderungen brauchen laut Projekt-
    Konvention Nutzer-Bestätigung, nicht einseitig entschieden.
  CACHE_VERSION train-v183→v184. Volle Suite 23/23 grün.
Loop 5: nicht ausgeführt — kein neuer Code-Fakten-Export angefordert.


## 2026-07-19 train-v185 (B65/B67 gefixt, B66 Observability — SCHEMA 31)
Loop 1: 24/24 grün (Playwright, inkl. neuem Migrations-Test) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS/SCHEMA in HANDOFF.md/CLAUDE.md auf train-v185/?v=192/31 synchronisiert
Loop 3: übersprungen — unverändert seit v184
Eigentliche Aufgabe: Nutzer beantwortete die 3 offenen Rückfragen aus dem
  vorherigen Sprint in einer Nachricht und bat um konkrete Umsetzung:
  - **B65:** Squats standen tatsächlich beim nie geänderten 2.5kg-Standard
    (Nutzer bestätigt) — trotzdem expliziter Wunsch nach dem smarten
    Default. Import-Zyklus-Check zuerst (movementMap.js hat keine
    Imports, sicher in state.js importierbar). Neue
    `defaultWeightStepForExercise(name, customExercises)` (state.js)
    nutzt die bereits vorhandene movementMap.js-Kategorisierung (B46) —
    Squat/Hinge-Übungen bekommen 5kg statt 2.5kg. Angewendet an EX_ADD,
    ONBOARDING_SEED (state.js) und `_applyTpl` (ui.js) — dieselbe
    Funktion, keine Duplikate. SCHEMA-Migration v30→v31 hebt bestehende
    Squat/Hinge-Übungen mit unverändertem Standard (`undefined` oder
    exakt 2.5) rückwirkend an, respektiert aber explizite Nutzer-
    Overrides (z.B. 1.25 für eine leichte Variante). Neuer Test
    `tests/smart_weightstep.spec.js` verifiziert alle 3 Fälle.
  - **B66:** Nutzer bestätigte: passiert auf allen Geräten (Android/iOS,
    Handy/Tablet/Laptop), immer direkt beim Öffnen. 2 weitere
    Reproduktionsversuche (echte Produktions-URL `777random.github.io/
    TRAIN` frisch besucht per Playwright; Service-Worker-Install-und-
    erneutes-Öffnen-Übergang mit zweitem Tab simuliert) — zusammen mit
    den 2 aus dem vorherigen Sprint macht das 4 Versuche insgesamt,
    keiner reproduzierte den Fehler. Statt weiter zu raten (CLAUDE.md-
    Regel: keine Fixes ohne bekannten Root Cause): `index.html`/`ui.js`
    geben die tatsächliche Fehlermeldung (gekürzt auf 120 Zeichen, keine
    Nutzdaten) jetzt als GoatCounter-Event-Pfad mit (`js_error:
    <Meldung>` statt nur `js_error`) — sobald der Fehler erneut auftritt,
    zeigt das GoatCounter-Dashboard die konkrete Ursache, ohne dass der
    Nutzer die Browser-Konsole öffnen muss. Bleibt offen.
  - **B67:** Nutzer bestätigte den Label-Vorschlag, bat zusätzlich um
    eine auf einen Blick erkennbare visuelle Unterscheidung. Neues Label
    unter der großen Erfolgsquote-Zahl (`_showCompletionScreen()`,
    ui.js) plus erklärender Zusatz bei der bereits bestehenden
    Zielerfüllungs-Zeile. Neue CSS-Klasse `.day-completion-screen__pct-
    label` (styles.css, negativer margin-top rückt Label eng an die
    Zahl). Per Playwright mit dem exakten gemeldeten Szenario verifiziert
    (eine Übung erfolgreich, eine übersprungen → 100% Erfolgsquote/33%
    Zielerfüllung, beide klar beschriftet).
  CACHE_VERSION train-v184→v185, CSS ?v=191→192, SCHEMA 30→31. Volle
  Suite 24/24 grün.
Loop 5: nicht ausgeführt — kein neuer Code-Fakten-Export angefordert.

Zusätzlich in derselben Nutzer-Nachricht angefordert: eine neue
Feature-Spec (Share-Bild PR-Moment + Wochenrückblick, Canvas API) nach
explizitem Spec-erst-dann-Bestätigung-Workflow — wird im Anschluss an
diesen Sprint separat bearbeitet (Doku lesen, aktive Loops, Spec
schreiben, auf Bestätigung warten), noch nicht umgesetzt.

## 2026-07-20 train-v186 (Share-Bild B68 umgesetzt, Streak-Fix B69, PR-Count-Fix B70 — SCHEMA 31 unverändert)
Loop 1: 28/28 grün (1 bekannter `delete_all_data.spec.js`-Flake unter
  Parallel-Last, im Retry grün — siehe LOOPS.md, kein neues Problem) ✓
Loop 2: aktualisiert — CACHE_VERSION/CSS in HANDOFF.md/CLAUDE.md auf
  train-v186/?v=193 synchronisiert, SCHEMA unverändert 31
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 in
  tests/fixtures/ bereits erfüllt, keine neuen Edge-Cases in diesem Sprint
Eigentliche Aufgabe: Nutzer bestätigte die im Vorsprint vorgelegte
  Share-Bild-Spec ("passt so, leg los") und meldete in derselben
  Nachricht 3 weitere mögliche Bugs aus dem echten Gebrauch. Diagnose vor
  Fix (CLAUDE.md-Regel) für jeden einzeln, bevor irgendetwas geändert wurde:
  - **Automatischer Wochenrückblick-Popup (kein Bug):** Nutzer vermutete
    selbst schon korrekt "weil heute Montag ist und automatisch eine neue
    Woche kreiert wurde". Per Code-Prüfung bestätigt: bereits bestehendes
    `AUTO_WEEK_CREATE`/`_runAutoWeekFlow()`-Feature (Sprint C3,
    train-v110), gesteuert über `settings.autoWeek.showReview` (Standard
    an, in den Einstellungen abschaltbar). Kein neuer Code — in BUGS.md
    unter "BEWUSST KEIN BUG" mit Erklärung + Abschalt-Hinweis dokumentiert.
  - **B69 (echter Bug, gefixt) — Streak zeigt 0 trotz Wochen konsistenten
    Trainings:** Root Cause in `_calcCurrentStreak()` (state.js): die
    Funktion iteriert von der neuesten Woche rückwärts und bricht die
    GESAMTE Zählung sofort ab, sobald eine Woche `_weekTrainingStatus()
    === 'missed'` liefert. Eine soeben (montags automatisch) angelegte,
    noch komplett leere aktuelle Woche hat 0 bewertete Sätze und erfüllt
    diese Bedingung IMMER — unabhängig davon, wie viele Wochen zuvor
    tatsächlich lückenlos abgeschlossen wurden, brach die Streak dadurch
    strukturell bei jeder neuen Woche sofort auf 0. Fix: die neueste
    Woche bricht die Kette nur noch, wenn ihr eigenes 7-Tage-Fenster
    bereits abgelaufen ist (`_weekEndMs()`, bereits vorhandener
    Lücken-Erkennungs-Helfer, hier erstmals für diesen Zweck
    wiederverwendet) — läuft es noch, wird die Woche einfach
    übersprungen (weder gezählt noch bricht sie die Kette), die
    dahinterliegende echte Streak zählt korrekt weiter.
    `_calcLongestStreakEver()` separat geprüft und NICHT betroffen
    (andere Iterationsrichtung, `best` bleibt beim tatsächlichen
    Bestwert). Neuer Test `tests/streak_inprogress_week.spec.js`: 3
    lückenlos abgeschlossene Vorwochen + 1 frische leere aktuelle Woche
    → Badge zeigt jetzt korrekt "3", vorher "0".
  - **Schrittweite zeigt 5kg, angewendet werden nur +2,5kg (kein Bug):**
    Frontkniebeuge-Beispiel des Nutzers geprüft. Per Code-Prüfung
    bestätigt: bereits bestehende, mit dem Nutzer ausdrücklich
    abgestimmte B48-Entscheidung (train-v172) —
    `getWeightRecommendation()` empfiehlt bei "guter, aber nicht
    herausragender" Form (RPE 7.5-8.5 bei ≥80% Erfolgsquote, oder 80-90%
    Erfolgsquote ohne RPE) bewusst nur die HALBE Schrittweite. Die
    gesehene "5kg" war vermutlich die Schrittweite-Einstellung selbst
    (korrekt — bestätigt, dass der B65-Fix wirkt), nicht die für diese
    konkrete Woche berechnete Empfehlung. Kein Bug, keine Code-Änderung —
    in BUGS.md unter "BEWUSST KEIN BUG" dokumentiert, inkl. Hinweis auf
    den bereits existierenden manuellen Override ("Anderer Wert", B50).
  - **B68 (Feature) — Share-Bild:** Umsetzung exakt nach der im
    Vorsprint vorgelegten und bestätigten Spec. Neues, importfreies
    Modul `shareImage.js` (AGENTS.md-Matrix-Tiefe 0) — Canvas-basiertes
    1080×1080-PNG, Farben live über `getComputedStyle(--c-bg/--c-accent/
    --c-text/--c-text-2)` gelesen (bleibt bei künftigen Palette-
    Änderungen automatisch konsistent), Bebas Neue/DM Sans (seit B51
    selbst gehostet) nach `await document.fonts.ready` gezeichnet, damit
    kein Fallback-Font-Rendering. Teilen über `navigator.share`/
    `canShare` mit Datei — dasselbe, bereits verifizierte Muster wie der
    bestehende JSON-Backup-Export (`backup.js:52-62`) —, sonst Download-
    Fallback über einen lokalen `triggerDownload`-Klon (bewusst nicht aus
    backup.js importiert, um shareImage.js als reinen Tiefe-0-Leaf-Modul
    zu erhalten). Kein Server-Upload, kein Drittanbieter-Bildhost — neue
    DECISIONS.md-Entscheidung dazu ergänzt. Zwei Einstiegspunkte: "📤 PR
    teilen"-Button in `_showCompletionScreen()` (ui.js, nur wenn
    `prCount > 0`), "📤 Teilen"-Button in `showWeekReviewModal()`
    (weekReviewModal.js — importiert dafür neu shareImage.js, Tiefe 0→1,
    AGENTS.md-Matrix entsprechend aktualisiert).
    **B70 (Zusatzfund, gefixt):** beim Bau der PR-Bild-Datenquelle
    aufgefallen — `_getDayCompletionStats()`s `prCount` verglich noch
    live gegen `state.prs[ex.name]` (All-Time-Wert). Zum Zeitpunkt des
    Tagesabschlusses ist `state.prs` für die heutigen Sätze aber bereits
    aktualisiert, wodurch `s.weight > exPR.maxWeight` für den GENAU
    rekordbrechenden Satz fast nie mehr zutraf (`exPR.maxWeight ==
    s.weight`, nicht `>`) — derselbe Bug-Typ wie B63, nur mit
    umgekehrtem Vorzeichen (Unter- statt Überzählung des Tagesabschluss-
    "🏆 X neue PRs!"-Textes). Fix: nutzt jetzt `s.prBadge`, dieselbe
    historisch-korrekte Quelle wie der Satz-Pokal seit B63 — liefert
    nebenbei auch die für das Share-Bild benötigte PR-Detailliste
    (Übungsname/Gewicht/Wdh/Typ) ohne zweite eigene Implementierung.
    Verifiziert per 3 neuen Tests (`tests/share_image.spec.js`): Canvas-
    Maße korrekt 1080×1080; PR-Teilen-Button erscheint nach einem live
    per Dispatch ausgelösten echten Rekord (kompletter UI-Flow: Satz
    bestätigen → Tag abschließen → Bewertung → Überspringen) und löst
    einen `train-pr.png`-Download aus (Fallback-Pfad — `navigator.share`
    ist in Headless-Chromium nicht verfügbar, das ist der tatsächlich
    getestete Zweig); Wochenrückblick-Teilen-Button löst
    `train-woche.png`-Download aus.
  CACHE_VERSION train-v185→v186, CSS ?v=192→193, SCHEMA unverändert 31
  (kein Migrations-Bedarf — weder Streak-Berechnung noch Share-Bild
  ändern die persistierte State-Shape). Alle 3 neuen Testdateien in
  .github/workflows/test.yml verdrahtet. Volle Suite 28/28 grün.
Loop 5: nicht ausgeführt — läuft laut LOOPS.md erst am Sitzungsende.

## 2026-07-20 train-v187 (B71 — Share-Bild v2 Sparkline-Redesign)
Loop 1: 28/28 grün (kein Flake diesmal) ✓
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem vorherigen
  Sprintabschluss bereits auf train-v186/?v=193 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt, keine neuen Edge-Cases angefordert
Eigentliche Aufgabe: Nutzer forderte per detaillierter Sprint-Vorlage ein
  Layout-Redesign des Wochenrückblick-Share-Bilds (B68) mit einer
  Übungsfortschritt-Sparkline als Herzstück an, mit explizitem
  Spec-erst-Workflow ("technische Spec schreiben, auf Bestätigung
  warten"). Vor dem Spec-Schreiben die konkreten technischen Behauptungen
  der Vorlage gegen den echten Code geprüft (nicht blind übernommen —
  etablierte Regel dieses Projekts bei Nutzer-Vorlagen):
  - Versionsstände falsch: Vorlage sprach von "Share-Bild (v178)" und
    Ziel-"train-v179" — Share-Bild existiert tatsächlich erst seit B68/
    train-v186 (letzter Sprint). Reale Zielversion train-v187 verwendet.
  - `generateWeekImage(weekData, state)` mit einem
    `{kwNumber, monthYear, ..., prExercise, prWeight}`-Objekt existiert
    nirgends im Code — erfundene/erinnerte API, keine reale.
  - `exWeightHistory()` per Grep verortet: liegt in `insightEngine.js`
    (Zeile 49), nicht wie in der Vorlage behauptet in
    `progressInsights.js`.
  - Der reale Teilen-Button-Aufrufort ist `weekReviewModal.js` (hat seit
    B68 direkten `reviewData`-Zugriff), nicht `ui.js` wie die
    Vorlagen-Constraint "Nur shareImage.js + ui.js" annahm.
  Technische Spec mit allen 4 Korrekturen geschrieben und vorgelegt,
  Nutzer bestätigte ("passt so, leg los").
  **Umsetzung:**
  - `ui.js`: an beiden `buildWeekReview()`-Aufrufstellen (`open-new-week`,
    `_runAutoWeekFlow`) wird `_review.allWeeks = state.weeks` angehängt,
    bevor `showWeekReviewModal()` aufgerufen wird — einzige ui.js-
    Änderung, gibt weekReviewModal.js erstmals Zugriff auf die volle
    Wochen-Historie (vorher nur die eine aktuelle `week`).
  - `weekReviewModal.js`: importiert neu `getSortedWeeks`/
    `exWeightHistory` (insightEngine.js). Neue `_pickBestExercise()`:
    1. echter PR-Highlight dieser Woche (`highlights.find(h => h.type
    === 'pr')`, bereits von `buildWeekReview()`/`_findPR()` ermittelt),
    2. sonst höchstes Trainingsvolumen der Woche (neu, lokal berechnet —
    keine bestehende Funktion dafür gefunden, keine dupliziert). Neue
    `_monthYear()` für den Header ("KW N · Monat Jahr").
  - `shareImage.js`: `buildWeekShareCanvas()` komplett neu aufgebaut,
    4-Zonen-Layout (Header/Sparkline-Hero/Stats-Kacheln/Footer),
    Bezier-geglättete Kurve exakt nach Vorlagen-Formel, Gradient-Fill
    unter der Linie, Glow-Effekt (shadowBlur 20) auf dem letzten/
    aktuellen Punkt, Gewichts-Labels an erstem/letztem Datenpunkt,
    dynamischer Hook-Satz (Steigerung/Plateau/Rückbau), Fallback bei <3
    Datenpunkten (großes aktuelles Gewicht statt bedeutungsloser
    Mini-Kurve), 2-Zeilen-Umbruch bei Übungsnamen >20 Zeichen.
  - **Eigener Fehler gefunden und korrigiert (Screenshot-Prüfung vor
    Commit, wie von der Vorlage selbst als Qualitätsschritt gefordert):**
    Canvas als `data:`-URL gerendert und visuell geprüft (`Read`-Tool auf
    die PNG-Datei) — die erste Umsetzung nach den wörtlichen
    Vorlagen-Koordinaten (Zonen enden bei y:780 von 1080px) ließ ca.
    300px komplett leeren Raum am unteren Bildrand, exakt das Problem,
    das dieses Redesign laut Nutzer-Anfrage eigentlich beheben sollte
    ("zu viel Leerraum, kein Wow-Faktor"). Vertikalen Rhythmus
    neu verteilt (Sparkline-Box 260→330px Höhe, Stats-Kacheln 100→120px,
    Footer 60→100px, alle nach unten verschoben) — Leerraum am Ende auf
    ~117px reduziert, zweiter Screenshot bestätigt deutlich ausgewogeneres
    Bild. Auch der Lange-Namen-Fallback visuell verifiziert (38 Zeichen
    passten bei 38px Font noch einzeilig, kein unnötiger Umbruch).
  - CSS-Version bewusst NICHT gebumpt (?v=193 unverändert) — B71 ist
    reines Canvas-Redesign, keine neue CSS-Klasse — abweichend von der
    Vorlagen-Angabe "?v=193" (die von einer CSS-Änderung ausging, die es
    nie gab; Projekt-Konvention aus CLAUDE.md: nur bei echter
    CSS-Änderung bumpen).
  4 neue Tests (`tests/share_image_sparkline.spec.js`, in CI): Canvas-
  Maße mit Sparkline-Pfad (≥3 Punkte), Fallback-Pfad (<3 Punkte), langer
  Übungsname ohne Absturz, vollständiger UI-Flow über 4 echte Wochen mit
  steigendem Gewicht (Sparkline-Daten fließen nachweislich korrekt ein,
  PNG-Download ausgelöst). CACHE_VERSION train-v186→v187, CSS/SCHEMA
  unverändert. AGENTS.md-Matrix aktualisiert (weekReviewModal.js
  importiert jetzt zusätzlich insightEngine.js, Tiefe 1→3). Volle Suite
  32/32 grün.
Loop 5: for-advisor.txt aktualisiert (am Ende der Session).

## 2026-07-20 train-v188 (B72 — Auto-Wochenrückblick-Fix + Teilen im Dropdown)
Loop 1: 32/32 grün ✓
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem vorherigen
  Sprintabschluss bereits auf train-v187/?v=193 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt
Eigentliche Aufgabe: Nutzer meldete, dass das Wochenrückblick-Share-Bild
  0/0, keinen Übungsnamen und den <3-Punkte-Fallback zeigte, obwohl
  mehrere Wochen echte Trainingsdaten vorlagen. Zwei-Schritt-Vorgehen
  exakt wie angefordert:
  1. **Reiner Diagnose-Auftrag (keine Änderungen).** Erste Prämisse
     korrigiert: die Fragen bezogen sich auf `weekData`/
     `generateWeekImage()` — beide existieren nicht, wurden im B71-Sprint
     bereits durch die echte Architektur ersetzt. Alle 5 Fragen gegen den
     echten Code beantwortet (weekReviewModal.js/shareImage.js/
     insightEngine.js, mit Datei:Zeile). **Mit realistischen
     Testdaten reproduziert:** 4 echte Wochen, steigendes Gewicht → Code
     lieferte korrekt "4 Wochen · 100% Ziel · PR Kniebeuge 87.5kg",
     `exWeightHistory` lieferte `[75,80,82.5,87.5]` — der Bug trat mit
     normalen Daten NICHT auf. Einzige plausible Erklärung ohne die
     echten Nutzerdaten zu kennen: `_runAutoWeekFlow()`s
     `sorted[length-2]`-Annahme, aber ausdrücklich als unbestätigte
     Hypothese markiert (Diagnose-vor-Fix-Regel: nicht raten).
  2. **Fix-Auftrag** auf Basis dieser Hypothese. **Vor der Umsetzung
     tatsächlich reproduziert** (nicht nur die Hypothese übernommen):
     Testfixture mit 2 echten Trainingswochen + 1 manuell vorausgeplanter,
     leerer Woche mit ZUKÜNFTIGEM `startDate` (das Datumsfeld bei "Neue
     Woche" erlaubt jedes Datum) — bestätigte exakt das gemeldete Symptom
     ("KW 30 · 0 Wochen · 0/0 Tage") trotz vorhandener echter Historie.
     Root Cause damit real bestätigt, nicht mehr spekulativ.
  **Fix:** `_runAutoWeekFlow()` (ui.js) — `prevWeek` wird jetzt rückwärts
  durch die sortierten Wochen gesucht (erste Woche mit ≥1 `markedDone`-
  Tag), statt positional `sorted[length-2]` zu raten. Verifiziert: die
  soeben erstellte Woche selbst kann dabei nie fälschlich treffen, da
  `_resetClonedDays()` `markedDone` beim Anlegen immer auf `false` setzt.
  Fallback auf die alte Positions-Logik bleibt für den Extremfall "noch
  nie irgendeine Woche abgeschlossen" bestehen.
  **Zusätzlich (Nutzer-Anfrage):** Teilen-Button jetzt auch im manuellen
  Wochenrückblick-Dropdown (Fortschritt-Tab, `#week-review-inline`)
  verfügbar — jede dort wählbare Woche hat durch den bereits bestehenden
  `reviewable`-Filter (nur Wochen mit ≥1 `markedDone`-Tag) garantiert
  echte Daten, kann die B72-Falle also strukturell nie treffen,
  unabhängig vom Auto-Flow. Teilen-Logik dafür aus dem Modal-Klick-
  Handler in eine gemeinsame, exportierte `shareWeekReviewImage()`
  (weekReviewModal.js) extrahiert statt sie zu duplizieren — beide
  Einstiegspunkte (Modal + Dropdown) nutzen jetzt dieselbe Implementierung.
  **Sprint-Vorlage enthielt erneut falsche Versionsstände** (nannte
  "train-v180"/"?v=194" — aktueller Stand war train-v187/?v=193, also
  RÜCKWÄRTS) — reale nächste Version (train-v188) verwendet, CSS
  unverändert gelassen (keine neue CSS-Klasse, reused `.btn`/`.btn--ghost`).
  **Nebenbefund:** eigener Doku-Fehler aus dem B71-Sprint gefunden — die
  DECISIONS.md-Einfügung hatte die "Gilt"-Zeile des scrollTop-Restore-
  Eintrags versehentlich ans Dateiende verschoben (Einfügepunkt zu früh
  gewählt). Korrigiert, plus neuer DECISIONS.md-Eintrag zum "Rückwärtssuche
  statt Array-Position"-Muster für künftige "letzte reale Woche"-Logik.
  Verifiziert per 2 neuen Tests (`tests/share_image_autoweek_fix.spec.js`,
  in CI) plus Screenshot über den ECHTEN Klick-Handler (nicht neu
  nachgebaut — `toBlob()` kurzzeitig gepatcht, um das tatsächlich erzeugte
  Bild abzufangen): 3 reale Trainingswochen 72.5→75→82.5kg zeigen korrekt
  "+10kg in 3 Wochen 🏆", vorausgeplante leere Woche korrekt ignoriert.
  CACHE_VERSION train-v187→v188, CSS/SCHEMA unverändert. Volle Suite
  34/34 grün.
Loop 5: for-advisor.txt aktualisiert (am Ende der Session).

## 2026-07-20 train-v189 (B73 — Share-Bild v3: Favoriten, Retina, PR-Moment-Toast, Consent)
Loop 1: 34/34 grün ✓
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem vorherigen
  Sprintabschluss bereits auf train-v188/?v=193 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt
Eigentliche Aufgabe: Nutzer forderte per detaillierter Sprint-Vorlage ein
  großes Share-Bild-v3-Paket an (6 Fixes: Favoriten-Kaskade, Hook-Satz im
  Fallback, Retina-Fix, differenzierter Fallback, PR-Moment-Bild,
  Datenschutz-Hinweis), mit explizitem Spec-erst-Workflow. Vor dem
  Spec-Schreiben die konkreten technischen Behauptungen gegen den echten
  Code geprüft (wiederholt etabliertes Muster dieses Projekts bei
  Nutzer-Vorlagen — mittlerweile die 5. Vorlage in dieser Session mit
  echten Diskrepanzen):
  - Versionsstände falsch: "train-v181"/"?v=195"/"SCHEMA unverändert
    (30)" — echter Stand war train-v188/CSS ?v=193/SCHEMA 31 (v181 lag 7
    Versionen hinter dem aktuellen Stand).
  - BUGS.md-IDs B61-B64 waren bereits seit Wochen an andere, längst
    erledigte Bugs vergeben (Versions-Anzeige-Fix, Offline-Modus,
    PR-Pokal-Wiederholung, inputmode-Felder). Echte nächste ID: B73.
  - "PR-Moment-Bild fehlte" (als BUGS.md-Eintrag formuliert) war
    sachlich falsch — existiert bereits seit B68 (train-v186), aktiv
    getestet und in CI. Tatsächlich gewünscht: ein zusätzlicher,
    früherer Trigger direkt nach dem Satz statt erst beim
    Tagesabschluss — eine echte neue Funktion, kein Bugfix.
  - `_pickBestExercise(reviewData, sorted, state)`-Signatur passte
    nicht zur echten Funktion (kein `state`-Feld auf `reviewData`, nur
    `allWeeks` seit B72).
  - Prio-1-Logik der Vorlage (`highlights.filter(h => h.type ===
    'pr').sort((a,b) => b.weightDiff - a.weightDiff)`) kann strukturell
    NIE mehrere PR-Kandidaten vergleichen — `_findPR()` (weekReview.js)
    liefert maximal EINEN `type:'pr'`-Highlight pro Woche (den mit dem
    größten Delta über alle Übungen, favoritenblind), `weightDiff`
    existiert als Feld gar nicht.
  - Prio-5-Code hatte einen echten, eigenständig gefundenen Bug:
    `_weekVolumeByExercise()` gibt eine `Map` zurück, `Object.entries()`
    auf einer Map liefert immer `[]` — Prio 5 hätte nie gegriffen.
  Technische Spec mit allen Korrekturen geschrieben und vorgelegt,
  Nutzer bestätigte alle 6 Punkte einzeln ("Bestätigung für alle 6
  Punkte: ... ja") plus die korrekten Versions-/ID-Angaben.
  **Umsetzung (alle 6 Punkte):**
  1. **Favoriten-Kaskade** — `_pickBestExercise(reviewData, sorted,
     favs)` (weekReviewModal.js), 6 Prioritäten, Favorit immer vor
     Nicht-Favorit. Neue `_weekPrExerciseNames()` scannt `s.prBadge`
     direkt an den Sätzen (dieselbe historisch korrekte Quelle wie
     B63/B70), statt sich auf `highlights`/`_findPR()` zu verlassen —
     liefert ALLE PRs der Woche, nicht nur den größten. Prio 5 korrekt
     mit `[...vol.entries()]` statt `Object.entries()`. `ui.js` hängt
     `favoriteExercises` jetzt an 3 Stellen an `reviewData` an (analog
     zum `allWeeks`-Muster aus B72): `open-new-week`, `_runAutoWeekFlow`,
     `_updateInlineReview`-Dropdown.
  2. **Hook-Satz im Fallback** — die bestehende +Xkg/konstant/Rückbau-
     Kaskade aus B71 gilt jetzt bereits ab 2 Datenpunkten (gerade Linie
     statt Bezier-Kurve bei genau 2 Punkten — mathematisch ohnehin
     identisch bei nur 2 Stützstellen), nicht mehr erst ab 3.
  3. **Retina-Deckelung** — `_buildCanvas()`: `Math.min(devicePixelRatio
     || 1, 3)`. `canvas.style.width/height` bewusst NICHT ergänzt (aus
     der Vorlage übernommen geprüft und verworfen) — der Canvas wird nie
     ins DOM eingefügt (nur `toBlob()`/Download), das CSS-Sizing wäre
     wirkungsloser toter Code.
  4. **Fallback-Sparkline differenziert** — 0 Punkte: Ausblickstext
     ("Trainiere weiter · Sparkline erscheint ab Woche 2"), 1 Punkt:
     großes Gewicht + Subtext ("Erste Einheit · Mehr Wochen ="), 2
     Punkte: siehe Punkt 2 oben.
  5. **PR-Moment-Toast** — neue `_maybeShowPrMomentToast()`/
     `_showPrMomentToast()` (ui.js), aufgerufen direkt nach `toggle-done`/
     `confirm-set` bei `s?.status === 'success' && s?.prBadge ===
     'weight'` — bewusst NICHT der in der Vorlage vorgeschlagene prevPr/
     newPr-Snapshot-Vergleich (fragiler bei mehreren PRs am selben Tag),
     sondern dieselbe etablierte `s.prBadge`-Quelle wie B63/B70.
     `prevWeight` (für "Vorheriger Rekord"/Differenz-Hook) wird vor dem
     jeweiligen `dispatch()` aus `ex.prWeight` erfasst. Banner
     verschwindet nach 10s oder Klick, bei Klick `buildPrShareCanvas()`
     + `shareCanvas()`. `buildPrShareCanvas()` komplett neu aufgebaut:
     Header (TRAIN+KW), große Trophäe, Übungsname, Gewicht×Wdh, optional
     "Vorheriger Rekord: X kg" + "+Y kg Steigerung 🔥" (nur wenn
     `prevWeight` bekannt — beim bestehenden Tagesabschluss-Trigger
     weiterhin `undefined`, Funktion bleibt abwärtskompatibel).
     **Nach Screenshot-Prüfung ein zweites Mal** (erstes Mal war B71)
     einen eigenen Leerraum-Fehler gefunden: die erste Umsetzung von
     `buildPrShareCanvas()` ließ wieder ca. 300px toten Raum zwischen
     Inhalt und Footer. Zonen großzügiger verteilt (Trophäe/Name/
     Gewicht größer und weiter auseinander), Trennlinie+Footer jetzt
     dynamisch direkt nach dem tatsächlichen Inhalt platziert statt an
     einer fixen Nahe-Bildunterkante-Position — dabei den nun
     überflüssigen `_footer()`-Helper als toten Code entfernt (keine
     Aufrufer mehr).
  6. **Datenschutz-Hinweis** — neue `_ensureShareConsent()` zentral in
     `shareImage.js`s `shareCanvas()` (nicht an den 4 Aufrufern
     dupliziert) — zeigt einmalig einen Bestätigungsdialog (reused
     `.vac-plan-modal-overlay`/`.vac-plan-modal`, keine neue CSS-Klasse
     nötig), merkt sich die Zustimmung in `localStorage['train_share_
     consent']`, fragt danach nie wieder.
  **4 bestehende Tests mussten wegen des neuen Consent-Gates angepasst
  werden** (`share_image.spec.js` ×2, `share_image_sparkline.spec.js`
  ×1, `share_image_autoweek_fix.spec.js` ×1) — Consent-Flag im
  jeweiligen `page.evaluate`-Setup vorab gesetzt, da Consent nicht deren
  Testgegenstand ist, reiner Download-Flow bleibt unverändert geprüft.
  10 neue Tests (`tests/share_image_v3.spec.js`, in CI): 0-Punkte-
  Fallback, Retina-Deckelung (DPR 5→3 verifiziert), Favoriten-Kaskade
  (Favorit mit kleinerem PR schlägt Nicht-Favorit mit größerem PR, per
  `CanvasRenderingContext2D.fillText()`-Interception direkt verifiziert
  — kein Umweg über Bildinhalt-Erkennung), PR-Moment-Toast-Flow
  (kompletter UI-Weg: Satz bestätigen → Toast erscheint → Klick → PNG-
  Download), Datenschutz-Hinweis (erscheint beim ersten Teilen mit dem
  korrekten Text, verschwindet danach dauerhaft, zweiter Share läuft
  direkt durch). Volle Suite 39/39 grün. CACHE_VERSION train-v188→v189,
  CSS ?v=193→194 (neue `.pr-moment-toast`/`.pr-moment-toast__btn`-
  Klassen). SCHEMA unverändert 31 (keine State-Shape-Änderung — der
  Consent-Flag lebt bewusst in einem eigenen localStorage-Key, nicht im
  `train_v6`-State-Blob).
Loop 5: for-advisor.txt aktualisiert (am Ende der Session).

## 2026-07-20 train-v190 (B74 — Streak-Konsolidierung Wochenrückblick/Share-Bild)
Loop 1: 41/41 grün (1 bekannter `delete_all_data.spec.js`-Flake unter
  Parallel-Last, im Retry grün — siehe LOOPS.md, kein neues Problem) ✓
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem vorherigen
  Sprintabschluss bereits auf train-v189/?v=194 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt
Eigentliche Aufgabe: Nutzer meldete "Streak zeigt 0 bei neuer Woche", mit
  explizitem Diagnose-zuerst-Auftrag (keine Änderungen bis das Ergebnis
  dokumentiert ist — CLAUDE.md-Kernregel).
  **Diagnose:** Zunächst versucht, den wörtlich gemeldeten Fall zu
  reproduzieren — mit 3 real vollständig abgeschlossenen, lückenlosen
  Wochen zeigte das Training-Tab-Badge korrekt weiterhin 3, auch direkt
  nach Erstellung einer neuen leeren Woche (manuell UND simuliert via
  AUTO_WEEK_CREATE). Das ist exakt der in B69 (train-v186) behobene Fall
  — die Sonderbehandlung in `_calcCurrentStreak()` (state.js:422-448,
  "die neueste Woche bricht nur, wenn ihr 7-Tage-Fenster bereits
  abgelaufen ist") ist intakt, per frischer Reproduktion UND dem
  bestehenden `tests/streak_inprogress_week.spec.js` (seit B69
  durchgehend grün in CI) doppelt bestätigt.
  Da der gemeldete Fall nicht reproduzierte, aber die Sprint-Vorlage
  explizit nach drei potenziellen Streak-Quellen fragte (state.js,
  weekReview.js, shareImage.js/weekReviewModal.js), alle drei systematisch
  gegen den echten Code geprüft — dabei den TATSÄCHLICHEN Bug gefunden:
  `weekReview.js`s `_calcStreak(sortedWeeks, week)` (Zeile 124, vor dem
  Fix) ist eine zweite, komplett unabhängige Implementierung — zählt nur
  `days.some(d => d.markedDone)`, ohne den 70%-'completed'-Schwellenwert
  von `_weekTrainingStatus()` (state.js) und ohne jede
  Kalenderlücken-Prüfung (`_streakGapBreaks()`-Äquivalent fehlt
  komplett). Diese Funktion speist `summary.streak`, das sowohl das
  Wochenrückblick-Modal (`_summaryRow()`) als auch — unverändert
  durchgereicht via `shareWeekReviewImage()` (weekReviewModal.js) — das
  Share-Bild (`buildWeekShareCanvas({streak})`) anzeigt.
  Per 2 gezielten Reproduktionen konkret nachgewiesen (nicht nur
  Code-Lesen, echte Playwright-Läufe mit synthetischen Daten):
  - Teilabschluss (1 von 4 Tagen der letzten Woche erledigt): Training-
    Tab-Badge zeigt korrekt 2, Wochenrückblick/Share-Bild fälschlich 3
    (zählt jede angetippte Woche voll, ignoriert die 70%-Schwelle).
  - Kalenderlücke (3 Wochen komplett ausgesetzt, real 2 Wochen davor + 2
    danach trainiert): Training-Tab-Badge zeigt korrekt 2 (Lücke bricht
    die Streak über `_streakGapBreaks()`), Wochenrückblick/Share-Bild
    zeigt fälschlich 4 — zählt einfach durch die Lücke durch, da
    `_calcStreak()` nur Array-Positionen kennt, nie Kalenderdaten
    vergleicht. **Das Share-Bild hätte damit eine objektiv falsche,
    potenziell öffentlich geteilte Streak-Zahl gezeigt** — der
    schwerwiegendere der beiden Funde.
  `state.longestStreakEver` als dritte, unabhängige Größe eingeordnet:
  All-Time-Bestwert, monoton wachsend, speist nur die "Längste"-Anzeige
  im Fortschritt-Tab, kein Bug, aber nicht mit dem aktuellen Streak zu
  verwechseln.
  Diagnose-Ergebnis vor dem Fix dokumentiert und dem Nutzer als
  Zwischenantwort gemeldet (wie von der Sprint-Vorlage gefordert).
  **Fix (nach Diagnose):** `weekReview.js`s `_calcStreak()` delegiert
  jetzt vollständig an `calcCurrentStreak()` (state.js) — neuer Import
  `calcCurrentStreak` aus state.js, analog zum bereits bestehenden
  `isTrainingDay()`-Import (beides reine, zustandslose Funktionen, keine
  `getState()`/`dispatch()`-Kopplung, Datei bleibt "State-frei" im
  ursprünglich gemeinten Sinn). `calcCurrentStreak(sortedWeeks.slice(0,
  idx + 1))` liefert exakt "Streak-Stand zum Zeitpunkt dieser Woche" —
  identische Semantik wie die Training-Tab-Badge, inklusive der
  B69-Sonderbehandlung für eine noch laufende, unvollständige neueste
  Woche in der Slice. Konsolidiert zwei unabhängige Implementierungen auf
  eine einzige Quelle, dasselbe etablierte Muster wie B44/B45/B47.
  Beide zuvor divergenten Reproduktions-Szenarien zu permanenten Tests
  ausgebaut (`tests/streak_weekreview_consistency.spec.js`, in CI) —
  beide liefern jetzt identische Werte in Training-Tab UND
  Wochenrückblick/Share-Bild.
  **Aufgabe 2 (Share-Bild-Feinschliff, dieselbe Sprint-Vorlage) geprüft,
  keine Änderung vorgenommen:** alle 3 angeforderten Korrekturen waren
  bereits erfüllt, per Code-Lesen UND Screenshot verifiziert — Hook-Satz
  ist bereits zentriert (`ctx.textAlign='center'` vor jedem
  `fillText(..., SIZE/2, hookY)`, seit B71), Footer bereits dynamisch
  positioniert ohne nennenswerten Leerraum (Bottom-Marge ~117px, kein
  Vergleich zu den echten ~300px-Leerraum-Funden aus B71/B73), Stats-
  Kacheln bereits 120px hoch — größer als die in der Vorlage angeforderten
  100px (die Vorlage ging fälschlich von einer alten 88px-Basis aus).
  Die Vorlagen-Pixelwerte blind zu übernehmen hätte teils eine
  Verschlechterung bedeutet (Kacheln 120→100px trotz "größer machen"-
  Ziel) — keine Änderung an shareImage.js vorgenommen, stattdessen
  dokumentiert warum.
  CACHE_VERSION train-v189→v190, CSS ?v=194 unverändert (kein CSS
  geändert), SCHEMA unverändert 31. Volle Suite 41/41 grün.
Loop 5: for-advisor.txt aktualisiert (am Ende der Session).

## 2026-07-20 train-v191 (B75 — Toast beim Auto-Backup, kein Trigger-Bug)
Loop 1: 43/43 grün ✓
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem vorherigen
  Sprintabschluss bereits auf train-v190/?v=194 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt
Eigentliche Aufgabe: Nutzer meldete, ein Auto-Backup-JSON-Download
  erscheine beim Klick auf "Teilen" im Fortschritt-Tab-Dropdown, mit
  explizitem Diagnose-zuerst-Auftrag (keine Änderungen bis das Ergebnis
  dokumentiert ist).
  **Diagnose:** Alle 4 gestellten Fragen beantwortet — `exportJSONAuto()`
  (backup.js:65) hat genau eine Aufrufstelle im gesamten Repo
  (`ui.js:6540`, innerhalb `scheduleRender()`), gategated ausschließlich
  über einen reinen Zahlenvergleich (`ui.js:6536`:
  `_knownWeekCount >= 0 && newWeekCount > _knownWeekCount &&
  newWeekCount >= 2`, wobei `newWeekCount = state.weeks.length`). Der
  Share-Button im Fortschritt-Tab (`#week-review-inline-share`,
  ui.js:3373 → `shareWeekReviewImage()`, weekReviewModal.js) dispatcht
  nichts und liest nur Zustand — kein gemeinsamer Codepfad gefunden.
  **5 realistische Reproduktionen** (echte Playwright-Läufe, nicht nur
  Code-Lesen): AUTO_WEEK_CREATE + Dropdown-Teilen; manuelle
  Wochenerstellung mitten in der Sitzung + Dropdown-Teilen (mit/ohne
  Wartezeit); Teilen direkt im manuell geöffneten Wochenwechsel-Modal
  ohne vorheriges "Weiter"; Teilen im automatisch geöffneten Modal als
  allererste Interaktion — **in keinem einzigen Fall löste der
  Teilen-Klick einen `TRAIN_Backup_*.json`-Download aus.** Die
  Wochenerstellung selbst löste den Backup korrekt und sofort aus.
  Diagnose-Ergebnis dem Nutzer vorgelegt (wie gefordert), dabei zwei
  gezielte Rückfragen gestellt statt zu raten: 1) welcher Teilen-Button
  genau + Gerät + Häufigkeit — Antwort: Dropdown im Fortschritt-Tab,
  Android, **jedesmal**, und eine neue Woche war jeweils kurz zuvor
  erstellt worden; 2) die entscheidende Eingrenzungsfrage — tritt es
  auch OHNE kurz zuvor erstellte Woche auf? Antwort: **nein, nur in
  Kombination mit einer neuen Woche.** Das bestätigte abschließend: der
  Trigger war die ganze Zeit korrekt, kein Bug im eigentlichen Sinn. Die
  tatsächliche Ursache der Verwirrung: der Auto-Backup-Download passierte
  bisher völlig unangekündigt (kein Toast, keine UI-Rückmeldung) — auf
  Android ohne aufdringliche Download-Anzeige fiel er dem Nutzer erst
  beim NÄCHSTEN Tap auf (meist der Teilen-Button, da das typischerweise
  der nächste Schritt nach einem Wochenwechsel ist) und wurde diesem
  fälschlich zugeschrieben. Kausalität lief umgekehrt.
  Bevor blind der in der Aufgabe verlangte "Trigger-Fix" umgesetzt wurde
  (der hätte das legitime Auto-Backup-Feature kaputt gemacht, ohne das
  eigentliche Problem zu lösen), dem Nutzer 3 Optionen vorgelegt (mehr
  Details / Observability statt Blindfix / trotzdem defensiv absichern)
  — Nutzer wählte "mehr Details erfragen", dann nach Klärung "Ja, Toast
  ergänzen".
  **Fix (nach Rücksprache, kein Trigger geändert):**
  `showToast('💾 Automatisches Backup gespeichert', 'info', 3000)` direkt
  an der bestehenden Auslösestelle (`ui.js:6540`) ergänzt — macht
  sichtbar wann und warum der Download passiert, ohne die (korrekte)
  Trigger-Bedingung selbst anzufassen. Verifiziert per 2 neuen Tests
  (`tests/autobackup_toast.spec.js`, in CI): Toast erscheint korrekt bei
  echter Wochenerstellung (inkl. Download-Dateinamen-Check), Teilen-Klick
  im Fortschritt-Tab löst weiterhin nachweislich keinen Backup-Download
  aus. CACHE_VERSION train-v190→v191, CSS/SCHEMA unverändert. Volle
  Suite 43/43 grün.

## 2026-07-20 train-v192 (B76 — Pre-Session Check-in + Session Briefing — SCHEMA 32)
Loop 1: 49/49 grün ✓ (43 bestehend + 6 neue `session_coach.spec.js`)
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem vorherigen
  Sprintabschluss bereits auf train-v191/?v=194 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt
Eigentliche Aufgabe: Nutzer-Anfrage ("SPRINT 1 — Pre-Session Check-in +
  Session Briefing") mit ausführlicher Vorlage (Teile A-E, Constraints,
  Akzeptanzkriterien) — Trainings-Empfehlungen sollten den tagesaktuellen
  Zustand (Schlaf/Energie) einbeziehen statt nur auf Vorwochendaten zu
  basieren.
  **Vorlage vor der Umsetzung gegen den echten Code geprüft, 4
  Diskrepanzen gefunden und offengelegt statt stillschweigend
  übernommen:** (1) `day.energyLevel` existiert bereits (gesetzt im
  bestehenden Tagesabschluss-Flow, `_finishCompletion()`) — die Vorlage
  wollte ein neues, redundantes `sessionEnergyPost`-Feld samt eigener UI
  einführen (Teil D der Vorlage). (2) `getWeightRecommendation()`
  (weightRecommendation.js) berechnet ausschließlich die
  Steigerungsempfehlung für die NÄCHSTE Woche (genutzt vom "Neue
  Woche"-Chip + 3 Coach-Insight-Triggern) — nie die bereits gesetzten
  Gewichte der laufenden Session; die Vorlage nahm fälschlich an, diese
  Funktion ließe sich für die "-10% heute"-Reduktion nutzen. (3) Kein
  `'in_progress'`-Satzstatus existiert (nur `'pending'|'success'|'fail'`).
  (4) SCHEMA_VERSION stand bereits bei 31, nicht 30 wie die Vorlage
  annahm — neue Migration daher v31→v32, nicht v30→v31.
  Zwei genuine Produktentscheidungen per `AskUserQuestion` geklärt: (1)
  bestehendes `energyLevel` wiederverwenden statt neuem Feld — bestätigt.
  (2) Reducer mutiert `ex.sets[].weight` direkt statt
  `getWeightRecommendation()` zweckzuentfremden — bestätigt ("empfohlen").
  Korrigierte technische Spec vorgelegt, Nutzer bestätigte ("passt so,
  leg los").
  **Umsetzung:**
  - state.js: Migration v31→v32 (`day.sessionCheckIn`/`sessionModifier`
    als `null` für bestehende Tage), `DAY_ADD`/`DAY_ADD_CLONE`-Reducer
    um beide Felder ergänzt, `_resetClonedDays()` setzt sie beim
    Wochen-Klonen zurück (Vorwoche-Check-in darf nie mitklonen). Neuer
    Settings-Default `sessionCoach: true` (Muster: `hideStreakBadge`) in
    `STATE_INIT` UND `migrate()`. Neuer Reducer `SESSION_CHECKIN_SET`
    wendet den von ui.js bereits bestimmten Modifier nur mechanisch an
    (keine eigene Sleep/Energie→Modifier-Entscheidung im Reducer) — bei
    `reduced` werden alle noch `pending`-Sätze der heutigen Übungen
    einmalig um 10% reduziert, gerundet auf die pro-Übung-Schrittweite.
  - ui.js: `_isTodayDay()` (wiederverwendet `_dayDate()`),
    `_buildSessionBriefing()` (reine Sleep/Energie→Modifier/Text-Logik),
    `_findFocusExercise()` (erste Squat/Hinge/Push-Übung in
    Tages-Reihenfolge via bestehendem movementMap.js), `_lastWeekAvgRpe()`
    für die RPE-Ziel-Verschiebung. Zwei-Tap-Check-in-UI
    (`_renderSessionCheckIn()`, Button-Grid Schlaf+Energie, Draft pro Tag
    in `_checkInDraft` Map, automatischer Dispatch sobald beide Felder
    gesetzt sind, kein Persistieren des Zwischenstands). Briefing-UI
    (`_renderSessionBriefing()`, auf-/zuklappbar, Standard-Zustand an
    `sessionStartTs` gekoppelt). Check-in/Briefing nur am heutigen, noch
    offenen, nicht-Urlaubstag UND wenn `settings.sessionCoach !== false`.
    Neuer Settings-Toggle "Session Coach" (`tog()`-Helper, Muster
    `hideStreakBadge`).
  - styles.css: neue `.session-checkin-card`/`.session-briefing-card`-
    Klassen (Button-Grid, Toggle-Karte, Fokus-Block).
  - Test-Fund während der Umsetzung: `tests/smart_weightstep.spec.js`
    prüfte `schemaVersion === 31` hart — durch die neue v32-Migration ein
    erwarteter, nicht inhaltlicher Fehlschlag. Assertion auf
    `toBeGreaterThanOrEqual(31)` verallgemeinert (prüft weiterhin den
    eigentlichen Testgegenstand — dass die v30→v31-Migration gelaufen
    ist — ohne bei jeder künftigen neuen Migration erneut brechen zu
    müssen).
  6 neue Tests (`tests/session_coach.spec.js`, in CI): Check-in-
  Sichtbarkeit + Migration auf SCHEMA 32, Zwei-Tap-Auto-Submit +
  Persistenz über Reload, "Überspringen"-Pfad, "schlecht geschlafen"→
  `reduced`-Modifier inkl. korrekter -10%-Gewichtsrundung auf die
  Übungs-Schrittweite und RPE-Ziel-Verschiebung (-1), Settings-Toggle
  blendet beides aus, Settings-Toggle selbst schaltbar. 2 Screenshots
  verifiziert (Check-in-UI, Briefing nach "gut geschlafen/hohe Energie" —
  zeigt korrekt "Optimale Voraussetzungen — heute Steigerung versuchen"
  + Fokus-Übung "Kniebeuge, 80 kg × 2×5"). CACHE_VERSION train-v191→v192,
  CSS ?v=194→195, SCHEMA_VERSION 31→32. Volle Suite 49/49 grün.
  Dokumentation aktualisiert: BUGS.md (neuer Eintrag B76), DECISIONS.md
  (2 neue Einträge unter TECHNISCH für die beiden per `AskUserQuestion`
  getroffenen Entscheidungen), HANDOFF.md (STAND-Sektion), CLAUDE.md
  (Versionsstand-Header + Feature-Status-Tabelle + State-Shape-Beispiel),
  AGENTS.md (Datums-/Versions-Header — Abhängigkeits-Matrix selbst
  unverändert, keine neuen Cross-Datei-Imports), `.github/workflows/
  test.yml` (neuer CI-Schritt für `session_coach.spec.js`).
Loop 5: for-advisor.txt aktualisiert (17. Fassung, v192/SCHEMA 32)

## 2026-07-20/21 train-v192→v193 (B77 — Intra-Session Coach — SCHEMA 32 unverändert)
Loop 1: 49/49 grün ✓ (Session-Start, vor Umsetzung)
Loop 2: aktuell ✓ — HANDOFF.md/CLAUDE.md waren nach dem B76-Sprintabschluss
  bereits auf train-v192/?v=195/SCHEMA 32 synchron
Loop 3: übersprungen — Stop-Bedingung (≥15 Fixtures) mit 17 weiterhin
  erfüllt
Eigentliche Aufgabe: Nutzer-Anfrage "SPRINT 2 — Intra-Session Coach"
  (Teile A-E) — dezentes Feedback direkt unter jedem bewerteten Satz statt
  erst rückblickend am Wochenende.
  **Vorlage vor der Umsetzung gegen den echten Code geprüft, 5 echte
  Diskrepanzen gefunden und offengelegt statt stillschweigend
  übernommen:** (1) RPE hat im echten Popover Halbschritte
  (6/6.5/7/7.5/8/8.5/9/9.5/10) — die Vorlagen-Logik prüfte nur exakte
  Ganzzahlen, RPE 7.5/8.5 hätten keinen Branch getroffen. (2) Teil A hatte
  zwei sich überschneidende `if`-Blöcke für RPE 8 ohne `else` (zweiter
  überschrieb den ersten still). (3) Teil B wollte `getWeightRecommendation()`
  für den nächsten SATZ derselben Session verwenden — widerspricht der
  B76-Entscheidung ("nur nächste Woche") und liefert bei <2 Wochen
  Historie `null`. (4) Teil C (Favoriten-RPE-Nudge) hätte eine zweite,
  parallele Komponente neben der bereits bestehenden `.rpe-nudge` gebaut.
  (5) Teil E (Aufwärm-Empfehlung) hätte denselben Namen wie das bestehende
  freie Aufwärm-Textfeld (`day.warmup`, "🔥 Aufwärmen") verwendet.
  Korrigierte Spec vorgelegt, 2 Rückfragen-Runden per `AskUserQuestion`
  geklärt: (1) bestehende `.rpe-nudge` erweitern statt duplizieren —
  bestätigt ("empfohlen"). (2) eigener, klar anders benannter Aufwärm-Block
  statt Integration ins bestehende Feld — bestätigt ("empfohlen"). Danach
  eine dritte Rückfrage zu Teil B: Nutzer bestätigte explizit, dass ein
  echter Gewichts-Vorschlag (nicht nur der bereits geplante Wert) gezeigt
  werden soll — Klärung, OB das über `getWeightRecommendation()` oder eine
  neue eigene Funktion laufen soll: Nutzer wählte "neue eigene Funktion"
  (empfohlen) — B76-Entscheidung bleibt damit unrevidiert gültig, Teil B
  bekommt eine session-lokale Logik ohne Wochen-Minimum.
  Finale Bestätigung: "passt so, leg los".
  **Umsetzung:**
  - Neues, importfreies Modul `sessionCoach.js` (Tiefe 0, Muster
    movementMap.js/setUtils.js — weeklyFocus.js/Coach-Tab bewusst
    unangetastet): `buildSetFeedback(s, ex, sessionModifier)` (RPE-Bereiche
    korrigiert per Punkt 1/2 oben, ohne RPE eigene session-lokale
    success/fail-Logik für Teil B), `buildLastSetMessage(s, ex,
    nextWeekWeight)` (Abschluss-Text, `nextWeekWeight` als einzig
    legitimer `getWeightRecommendation()`-Aufruf, lazy nur bei bereits
    bewertetem letztem Satz), `buildWarmupSets(workingWeight, weightStep)`
    (50/70/85%-Formel).
  - ui.js: Feedback-Text ist rein render-abhängig (Status/RPE des Satzes)
    — erscheint identisch ob per `toggle-done` (manuelles ✓/✗) oder
    `confirm-set` bewertet, kein neuer Click-Handler für die Anzeige
    selbst nötig. `.rpe-nudge` erweitert: Variante (`plain`/`favorite`)
    wird einmalig am Trigger-Zeitpunkt entschieden (nicht bei jedem
    Render, sonst hätte sich der `localStorage`-Nudge-Zähler bei jedem
    Re-Render erhöht), Favoriten-Variante nur bei Favorit + erste 4 echte
    (nicht-Seed-)Wochen + Sitzungs-/Zähler-Caps (max. 3 total,
    `localStorage['train_rpe_nudge_count']`), "Nie für diese Übung" per
    `localStorage['train_rpe_skip_<name>']` (try/catch, Muster
    shareImage.js' Consent-Flag). Neuer "📋 Aufwärm-Empfehlung"-Block
    (bewusst anders benannt als das bestehende "🔥 Aufwärmen"-Textfeld),
    Default zugeklappt, Kategorie-Satz Squat/Hinge/Push/Pull (breiter als
    B76s Fokus-Übung-Satz — zwei unabhängige Features, keine
    Vereinheitlichung), nur Gewichts-Übungen (metric 'reps').
  - **Zusatzfund während der Umsetzung (nicht in der Vorlage, nicht in der
    Spec-Phase erkannt):** `timer.js` hat eine EIGENE, von ui.js
    unabhängige Klick-Erkennung für `[data-action="toggle-done"]`
    (`_bindAppInteractions()`, Zeile ~622) — löst den Pause-Timer
    UNCONDITIONAL (nicht `autoStartPauseTimer`-gated wie der
    `confirm-set`-Pfad) mit dem statischen `ex.pauseSec` aus. Ohne
    zusätzlichen Fix hätte die neue Pause-Empfehlung nur den selteneren
    `confirm-set`-Pfad erreicht, nicht den vermutlich häufigeren manuellen
    ✓/✗-Icon-Pfad. Per eigenem Debug-Skript verifiziert (Pause-Ring zeigte
    vor dem Fix weiterhin 90s bei RPE 8 trotz `autoStartPauseTimer:false`
    UND trotz korrekter Berechnung — weil der Trigger komplett am
    gepatchten Code vorbeilief). Gefixt: `timer.js` importiert neu
    `buildSetFeedback` aus `sessionCoach.js` — zweiter Import neben
    `state.js`, aber kein Bruch der "NIEMALS ui.js↔timer.js"-Regel, da
    sessionCoach.js importfrei und von beiden unabhängig ist (DECISIONS.md
    neuer Eintrag dazu). Die vorbestehende `autoStartPauseTimer`-
    Inkonsistenz selbst (nur `confirm-set` respektiert die Einstellung)
    wurde NICHT mitgefixt — als neuer, niedrigpriorer Kandidat **B78** in
    BUGS.md dokumentiert, out of scope für diesen Sprint.
  10 neue Tests (`tests/intra_session_coach.spec.js`, in CI): RPE 6/8/10
  (nicht letzter Satz) mit korrekten Hint-/Pause-Texten, letzter Satz zeigt
  "Nächste Woche" statt "Nächster Satz", ohne RPE nur Gewicht ohne
  Hint/Pause, Timer übernimmt die berechnete Pause als Voreinstellung,
  Favoriten-Nudge einmalig + "Nie für diese Übung" persistiert dauerhaft,
  RPE≤6 nach letztem Satz → Weiterer-Satz-Vorschlag inkl. "+ Satz
  hinzufügen" mit korrektem Vorschlagsgewicht, Aufwärm-Empfehlung
  eingeklappt per Default + korrekte 50/70/85%-Formel, sessionCoach=false
  deaktiviert alles Neue (bestehende generische RPE-Nudge bleibt
  unberührt). 2 Screenshots verifiziert (Aufwärm-Empfehlung aufgeklappt,
  Intra-Session-Feedback nach RPE 6 mit "→ Nächster Satz: 105kg" /
  "Noch Luft — steigern · Pause: 90s"). CACHE_VERSION train-v192→v193, CSS
  ?v=195→196, SCHEMA unverändert (32). Volle Suite 59/59 grün.
  Dokumentation aktualisiert: BUGS.md (neuer Eintrag B77 + neuer Kandidat
  B78), DECISIONS.md (3 neue Einträge: session-lokale Logik statt
  getWeightRecommendation()-Zweckentfremdung, sessionCoach.js als
  Tiefe-0-Ausnahme von der ui.js↔timer.js-Kopplungsregel), HANDOFF.md
  (STAND-Sektion), CLAUDE.md (Versionsstand-Header + Modul-Tabelle +
  Timer-Entkopplung-Abschnitt + Feature-Status-Tabelle), AGENTS.md
  (Datei-Abhängigkeits-Matrix: sessionCoach.js neu, timer.js-Import
  erweitert, neuer "NIE parallel"-Eintrag), `.github/workflows/test.yml`
  (neuer CI-Schritt für `intra_session_coach.spec.js`).
Loop 5: for-advisor.txt aktualisiert (am Ende der Session).
