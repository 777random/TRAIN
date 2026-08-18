# TRAIN — Session Handoff
*Letzte Aktualisierung: 2026-08-18 — Runde 39 (train-v264→v265,
B396-B404, ABGESCHLOSSEN):*
ui.js-Render-Logik-Audit, Teil 1: Training-Tab (Zeile 917-3132), DREIZEHNTE
Runde -- erste einer neuen Multi-Runden-Serie für ui.js' bisher nie
eigenständig auditierte Render-Logik (10724 Zeilen, mit Abstand größte
Datei im Projekt; bisher nur der Dispatch-Handler-Mechanismus,
_handleClick/_handleChange/_handleInput/_handleBlur/_handleKeydown,
Runde 33, eigenständig auditiert). Auf Nutzerauftrag "start with the
ui.js render logic audit" bewusst auf den höchstfrequentierten Teil
beschränkt: Wochenkopf/Tagesliste/Session-Briefing (renderWeekHeader,
renderDayList, renderDayBody + Helfer) und Übungs-/Satz-Rendering
(renderExercise, renderSetRow). 2 parallele Diagnose-Agenten (Fork A:
Zeile 917-2103, Fork B: Zeile 2104-3132) fanden 9 bestätigte Funde (2
HIGH, 4 MEDIUM, 3 LOW/kosmetisch). Diagnose in `Diagnose & Sprints/
diagnose-uijs-rendertab-audit-2026-08-18.txt`, Sprint-Ergebnis in
`Diagnose & Sprints/sprint-ergebnis-runde39-2026-08-18.txt`. Nutzer
bestätigte den konsolidierten Plan (Plan-Mode) -> "alle 9 fixen" ->
B396-B404 umgesetzt:
  B396 (HIGH): Ritual-Anchor-Karte zeigte am ersten echten Trainingstag
      fabrizierte Daten aus der Onboarding-Seed-Woche (erfundene "Letzte
      Einheit", verwässerte Ø-Erfolgsquote, falscher "Selber Tag letzte
      Woche"-Banner) -- isSeedWeek fehlte an 3 Stellen, obwohl 2 andere
      Stellen derselben Datei es bereits korrekt filterten.
  B397 (HIGH): 1RM-Epley-Schätzung auf der Übungskarte fehlte der
      Metrik-Guard, den die Schwesterfunktion im Analysis-Tab (B31)
      bereits hatte -- sinnlose Zahl bei gewichteten metric:'sec'/'m'-
      Übungen.
  B398 (MEDIUM): _lastWeekAvgRpe() suchte bei einer heute substituierten
      Fokus-Übung unter dem neuen statt dem Originalnamen -- RPE-/
      Pausen-Vorschau verschwand komplett aus dem Session-Briefing.
  B399 (MEDIUM): prevEx-Lookup in renderExercise() schloss Deload-, aber
      nicht Urlaubswochen aus -- Vorwoche-Hints verschwanden bzw. der
      Gewichts-Pfeil konnte in der ersten Woche nach einem Urlaub
      fälschlich "↑" zeigen.
  B400 (MEDIUM): _briefingExpandedOverride/_warmupExpanded kollidierten
      zwischen Wochen (bare Tag-Index statt ${wk.id}_${day.id}, trotz
      B83-Präzedenzfall direkt darüber in derselben Datei).
  B401 (MEDIUM): calcWeeks-Filter + _avgRepsLast4() substituteFor-blind
      -- 9./10. Fundstelle derselben, im Projekt bereits mehrfach
      gefixten Fehlerklasse, hier erstmals in ui.js' Render-Schicht.
  B402 (LOW, kosmetisch): renderInfoBlock() toter Code, gelöscht.
  B403 (LOW, kosmetisch): _isCumulativeSleepDeficit() ohne isSeedWeek-
      Filter (aktuell ohne reale Auswirkung) -- beide Seiten gefixt
      (ui.js-Filter + state.js ONBOARDING_SEED setzt sleepHours/
      energyLevel jetzt explizit null).
  B404 (LOW, kosmetisch): Fulfillment-Meter bei Substitution auch ohne
      echten Metrik-Konflikt unterdrückt (nur wegen fehlendem prevEx,
      z.B. Programmwoche 1) -- Existenzcheck entfernt.
Bemerkenswert: die erste Testversion für B398/B401 schlug trotz
korrektem Code-Fix zunächst fehl -- B398s Fix setzte anfangs am falschen
Ende an (Suchfunktion erweitert statt kanonischen Namen am Aufrufer
aufzulösen), B401s Testfixture hatte das Ziele-Panel (ex._showCfg) nicht
geöffnet, hinter dem der Wiederholungsvorschlag lebt. Beide korrigiert,
danach grün, per git-stash-Differenztest gegen den Vorher-Stand
verifiziert (alle 7 neuen Tests schlagen mit unverändertem ui.js/state.js
zuverlässig fehl). 7 neue Tests (tests/uijs_rendertab_audit_fixes.
spec.js) -- F7 (toter Code) und F8 (ohne aktuelle Verhaltensänderung)
bewusst ohne eigenen Test.

Volle Playwright-Suite (115 Spec-Dateien) lief diese Runde NICHT in einem
Durchgang: der `npx serve`-Dev-Server stürzte bei sustained load nach
ca. 5-6 Minuten wiederholt ab (bei 4 UND bei 1 Worker, an unterschiedlichen
Stellen -- bestätigt umgebungsbedingt, dasselbe "Windows-EMFILE-Limit"-
Muster wie in Runde 37 dokumentiert). In 6 kleineren Batches gefahren
(je frischer Server), alle 115 Spec-Dateien lückenlos abgedeckt (per
Datei-Listen-Abgleich verifiziert) -- grün bis auf das seit Runde 26
bekannte, umgebungsbedingte "Phantom-PR"-Flake (trainingstab_audit_
fixes.spec.js, identisches Fehlerbild wie in jeder vorherigen Runde);
state.js' PR-Tracking-Pfad wurde diese Runde nicht angefasst.

NÄCHSTER SCHRITT (offen, kein Auftrag): Body-Tab (renderBodyTab + Body-
Weight-/P4P-Chart-Helfer, ~3132-3609) und/oder Coach-/Fortschritt-Tab-
Rendering (~3609-5126) sind die nächsten Kandidaten der neuen ui.js-
Render-Serie, danach Settings-Tab/Template-Editor (~5126-8385, exkl.
Dispatch-Handler) und App-Scaffold/Modals/Completion-Flow (~8385-10724).
Braucht neuen Nutzerauftrag, bevor gestartet wird.
Davor: Runde 38 (train-v263→v264, B393-B395):
timer.js + dragdrop.js + setUtils.js-Audit, ZWÖLFTE Runde -- vierte einer
angekündigten Multi-Runden-Serie nach state.js (Runde 35), weeklyFocus.js/
overallPerformance.js (Runde 36), triggerEngine.js/exerciseAlternatives.js
(Runde 37). dragdrop.js ist eine vendorte Drittanbieter-Bibliothek
(mobile-drag-drop 2.3.0-rc.1, MIT) -- bewusst aus dem Scope genommen,
keine weitere Aktion nötig. setUtils.js (53 Zeilen) per eigenem Recon
geprüft und für sauber befunden (weekSuccessCounts()/isFullSuccess() sind
bereits die konsolidierte Quelle, mit eigenem Drift-Absicherungs-Test,
siehe tests/weeklyfocus_scoreweek_parity.spec.js) -- keine weitere Aktion
nötig.

timer.js (986 Zeilen, Pausenzeit-/Rest-Timer + Session-Tracking-UI) war
bisher nie eigenständig auditiert. 2 parallele Diagnose-Agenten (Zeile
1-414: Wake-Lock/Zeit-Formatierung/Session-Tracking/Pausenzeit-Timer-Kern/
Audio/_onStateChange(); Zeile 414-986: Custom-Events-Binding/Overlay-DOM/
Styles/App-Interaktions-Binding/mountTimer()) fanden insgesamt ein
ungewöhnlich sauberes Modul -- KEIN HIGH-Bug, nur 1 mittlerer + 2
kosmetische Funde. Diagnose in `Diagnose & Sprints/diagnose-timerjs-
audit-2026-08-18.txt`, Sprint-Ergebnis in `Diagnose & Sprints/sprint-
ergebnis-runde38-2026-08-18.txt`. Nutzer wählte "Alle 3 fixen" -> B393-
B395 umgesetzt:
  B393 (MEDIUM): _dismissPause()/_stopSession() räumten bei einem
      Wochenwechsel bzw. manuellem Stopp während des 3-Sekunden-
      "WEITER!"-Popup-Fensters _goTimer/_goPopup nicht mit auf -- jetzt
      brechen beide zusätzlich clearTimeout(_goTimer) aus und entfernen
      go-popup--visible synchron (timer.js:321-333, 191-209).
  B394 (LOW, kosmetisch): maxSessionMs-Default (3h/10800000) doppelt
      hardcodiert -- neue DEFAULT_MAX_SESSION_MS-Modulkonstante, kein
      beobachtbares Verhalten geändert.
  B395 (LOW, kosmetisch): Dismiss-Bestätigungs-Hinweis ("Nochmal tippen ✓")
      trägt jetzt aria-live="polite" im Basis-Markup.
Bemerkenswert sauberer Befund: eine auf den ersten Blick vertraute
substituteFor-Blindheit in _renderPauseTip() wurde geprüft und als
KEIN Bug verworfen (Punkt-in-Zeit-Abfrage "wovon erhole ich mich
gerade" soll bewusst die aktuell aktive, ggf. substituierte Übung
zeigen). mountTimer()-Reentrancy-Risiko (kein Idempotenz-Schutz) geprüft
und als aktuell nicht erreichbar bestätigt (wird laut projektweitem
Grep exakt einmal aufgerufen, kein Re-Mount-Pfad im Code) -- nur als
defensive-Härtung-Hinweis notiert, kein Fix.

3 neue Tests (tests/timerjs_audit_fixes.spec.js, Playwright-Browser-
Kontext analog zu pause_tips.spec.js -- timer.js ist DOM-gebunden). Alle
3 per git-stash-Differenztest gegen den Vorher-Stand verifiziert (schlagen
mit unverändertem timer.js zuverlässig fehl). B394 bewusst ohne eigenen
Test (reine Konstanten-Konsolidierung ohne beobachtbares Verhalten). Volle
Playwright-Suite (114 Spec-Dateien, diesmal in einem einzigen Lauf statt
gebatcht -- das in Runde 37 dokumentierte Windows-EMFILE-Risiko trat
diesmal nicht auf) grün: 170 passed, 0 failed, ~14.5 Min. Das
vorbestehende Flake (trainingstab_audit_fixes.spec.js "Phantom-PR", seit
Runde 26 beobachtet) ist in diesem Lauf nicht aufgetreten -- weiterhin als
bekannt unzuverlässig einzustufen, kein Beleg für Behebung. state.js in
dieser Runde nicht angefasst.

Damit ist die angekündigte Multi-Runden-Serie (state.js Runde 35 ->
weeklyFocus.js/overallPerformance.js Runde 36 -> triggerEngine.js/
exerciseAlternatives.js Runde 37 -> timer.js/dragdrop.js/setUtils.js
Runde 38) vollständig durch. KEIN offener nächster Datei-Kandidat --
nächste Runde braucht einen neuen Nutzerauftrag.
Davor: Runde 37 (train-v262→v263, B390-B392):
triggerEngine.js + exerciseAlternatives.js-Audit, ELFTE Runde -- dritte
einer angekündigten Multi-Runden-Serie nach state.js (Runde 35) und
weeklyFocus.js/overallPerformance.js (Runde 36). Beide Dateien
ungewöhnlich klein (35 bzw. 59 Zeilen) -- kein Fall für die übliche
2-Fork-Diagnose. Auf Nachfrage bestätigte der Nutzer: eigener Recon statt
Fork-Dispatch, direkt weiter mit exerciseAlternatives.js in derselben
Runde. Ergebnis in `Diagnose & Sprints/diagnose-triggerengine-
exercisealternatives-audit-2026-08-18.txt`. triggerEngine.js ist reiner
Pass-Through (fireTrigger() -> evaluateInsights(), insightEngine.js
bereits Runde 29 auditiert) -- einziger Fund (B390, kosmetisch): die
exportierte TRIGGERS-Konstante wurde nirgends importiert, alle 5
Aufrufstellen in ui.js nutzten rohe String-Literale statt Tippfehler-
geschützter Konstanten-Referenz. exerciseAlternatives.js (26 kuratierte
Alternativ-Einträge für "Heute anders") hatte 2 Namens-Schlüssel-Funde:
B391 (HIGH) 'Bizepscurl' (Singular) war ein toter Schlüssel, die
restliche App nutzt durchgängig 'Bizepscurls' (Plural); B392 (MEDIUM)
'Trizeps-Pushdown' kommt sonst nirgends im Projekt vor, movementMap.js
kennt nur die englischen Formen. Ein dritter, auf den ersten Blick
plausibler Verdacht (getAlternatives(ex.name, state) statt
substituteFor-Auflösung, dieselbe Fehlerklasse wie ~9 andere Funde
dieser Session) wurde NICHT gefixt -- der Code direkt darüber trägt
einen expliziten, bereits bestehenden Kommentar, der genau dieses
Verhalten für die Schwesterfunktion (D2 sub-suggestions) als bewusste
Design-Entscheidung dokumentiert; getAlternatives() folgt laut eigenem
Kommentar demselben Muster. 2 neue Tests (exercise_alternatives.spec.js
erweitert, reine Node-Unit-Tests, da exerciseAlternatives.js
"importfrei" ist). Volle Regressionssuite (113 Spec-Dateien, gebatcht)
grün, 1 vorbestehendes Flake (trainingstab_audit_fixes.spec.js
Phantom-PR) unverändert, state.js in dieser Runde nicht angefasst.
Davor: Runde 36 (train-v261→v262, B384-B389):
weeklyFocus.js + overallPerformance.js-Audit, ZEHNTE Runde -- zweite einer
angekündigten Multi-Runden-Serie nach state.js (Runde 35, B375-B383).
weeklyFocus.js (1600 Zeilen, Coach-Tab-Signal-Engine, ~20 unabhängige
`_check*`-Funktionen) und overallPerformance.js (185 Zeilen,
"Gesamtperformance"-Sektion Fortschritt-Tab) waren beide im
movementMap.js-Audit (Runde 34) bereits auf Aufrufstellen-Ebene sauber
verifiziert worden, ihre interne Logik aber nicht. 2 parallele Diagnose-
Agenten (weeklyFocus.js Zeile 1-900 bzw. 899-1600 + overallPerformance.js)
fanden 6 bestätigte Bugs + 1 Verdachtsfall (geringe Auswirkung). Ergebnis
in `Diagnose & Sprints/diagnose-weeklyfocus-overallperformance-audit-
2026-08-18.txt`. Nutzer wählte "Alle 6 fixen + V1 dokumentieren" ->
B384-B389 umgesetzt. 5 der 6 Bugs (B384/B386/B387/B388, B384 deckt sowohl
`_checkRisingRpe()` als auch `_checkPrePlateau()` ab) sind dieselbe, in
dieser Session bereits ~7-8x unabhängig gefundene substituteFor-
Blindheits-Fehlerklasse (vgl. B335, B359, B377/B378 aus Runde 35) -- eine
an einem Tag substituierte Übung wurde beim mehrwöchigen Verfolgen über
rohen `ex.name` statt `ex.name === name || ex.substituteFor === name`
unsichtbar für ihre eigene Historie. B385 ist die zweite etablierte
Fehlerklasse (hardcodierte statt über `isCompoundExercise()` berechnete
Compound/Isolation-Einstufung, vgl. B358 aus Runde 31) -- deckte dabei
auch einen bestehenden Test auf, der sich unbeabsichtigt auf das alte
Fallback-Verhalten für unbekannte Übungen verlassen hatte (auf eine echte
Isolationsübung umgestellt statt den Fix aufzuweichen). 6 neue Tests
(weeklyfocus_overallperformance_audit_fixes.spec.js, Browser-Kontext via
direktem Aufruf von computeWeeklyFocus()/computeStructuralSignals(), da
weeklyFocus.js state.js importiert und damit nicht import-frei ist) --
alle 6 einzeln per git-stash-Differenztest gegen den Vorher-Stand
verifiziert (5/6 schlugen ohne die Fixes sofort fehl, der 6. wurde nach
einer zu schwachen ersten Assertion verschärft, bis er ebenfalls
trennscharf war). Volle Regressionssuite (113 Spec-Dateien, gebatcht)
grün, 1 vorbestehendes Flake (trainingstab_audit_fixes.spec.js
Phantom-PR, seit Runde 26 in jeder Runde beobachtet) unverändert.
Davor: Runde 35 (train-v260→v261, B375-B383):
state.js-Audit, NEUNTE Runde -- erste einer angekündigten Multi-Runden-
Serie (state.js, danach weeklyFocus.js, overallPerformance.js,
triggerEngine.js, exerciseAlternatives.js, timer.js, dragdrop.js,
setUtils.js), auf Nutzerauftrag "start with state.js and continue with
the other files" gestartet. state.js (3347 Zeilen, zentraler Reducer)
war bisher nie als eigenständiges Subsystem auditiert. Eigener Recon vor
Fork-Dispatch fand bereits selbst einen Bug (`EX_MERGE_NAMES` fehlten 4
namensbasierte State-Map-Updates, dieselbe Fehlerklasse wie bei
`CUSTOM_EX_UPDATE` bereits im Körper-Tab-Audit gefixt). 2 parallele
Diagnose-Agenten (Helper-Funktionen vor dem Reducer inkl. migrate(),
Reducer-Switch selbst mit ~120 Cases) fanden 7 bestätigte Bugs + 2
gekoppelte Verdachtsfälle. Ergebnis in
`Diagnose & Sprints/diagnose-statejs-audit-2026-08-18.txt`. Nutzer wählte
"Alle 7 fixen + V1/V2 mit" -> B375-B383 umgesetzt. Bemerkenswertester
Fund (B381, gekoppelt mit V1/V2 = B382/B383): `DAY_LOAD_VACATION_PLAN`/
`WEEK_LOAD_VACATION_PLAN` legten Übungs-Objekte ohne `prWeight`/
`prRepsAtMaxWeight` an (anders als die EX_ADD-Referenz-Implementierung,
die beide explizit auf `null` setzt) -- dadurch griff
`_applyPrTracking()`s strikte `=== null`-Prüfung nie, ein echter PR auf
einer Urlaubsplan-Übung wurde während der laufenden Sitzung gar nicht
erkannt (kein Badge, kein Update), sondern erst beim nächsten
vollständigen Neuladen über den vollen PR-Recompute. Im selben Zug eine
neue `_buildVacationExercise()`-Helper-Funktion eingeführt (ersetzt zwei
unabhängig duplizierte ~20-zeilige Objekt-Literale, analog zur bereits
einmal konsolidierten Tag-/Wochen-Reset-Logik). Zwei weitere Funde (B377/
B378) sind die inzwischen fünfte bzw. dritte unabhängige Fundstelle
bereits etablierter Fehlerklassen im Projekt (substituteFor-Blindheit bei
PR-Verarbeitung bzw. unvollständige namensbasierte State-Map-Pflege bei
Umbenennungs-Operationen). 8 neue Tests (statejs_audit_fixes.spec.js,
Browser-Kontext via direktem `dispatch()`-Aufruf, analog zu
koerper_einstellungen_audit_fixes.spec.js, da state.js NICHT import-frei
ist). Volle Regressionssuite (112 Spec-Dateien, gebatcht) grün. Ein
vermeintlicher Regressions-Verdacht (Phantom-PR-Test aus
trainingstab_audit_fixes.spec.js schlug 4/5 Wiederholungen fehl, direkt
im selben Bereich wie B377/B378) wurde per git-stash-Differenztest
zweifelsfrei als vorbestehende, umgebungsbedingte Flakiness bestätigt --
schlägt mit UNVERÄNDERTEM state.js (vor dieser Runde) identisch 4/5-mal
fehl.
Davor: Runde 34 (train-v259→v260, B369-B374):
movementMap.js-Audit, ACHTE Runde -- auf Nutzerauftrag "start
movementMap.js audit" gestartet. movementMap.js (Übungsname→Bewegungs-
muster-Kategorie: MOVEMENT_MAP 218→226 Einträge, ISOLATION_EXERCISE_NAMES,
NO_BARBELL_EXERCISE_NAMES, MUSCLE_GROUP_MAP) war bisher nie als
eigenständiges Subsystem auditiert. Eigener Recon vor Fork-Dispatch fand
bereits selbst einen Bug (Push-Up/Chin-Up-Hyphen-Lücke in
NO_BARBELL_EXERCISE_NAMES) und bestätigte per Skript, dass beide
Objektliterale keine doppelt vergebenen Keys enthalten (218 bzw. 72 unique
zum Rundenstart). 2 parallele Diagnose-Agenten (interne Namens-Varianten-
Konsistenz zwischen den 3 Listen + MUSCLE_GROUP_MAP-Plausibilität,
projektweite Aufrufstellen-Konsistenz + exerciseAlternatives.js) fanden
5 bestätigte Bugs + 1 Verdachtsfall. Ergebnis in
`Diagnose & Sprints/diagnose-movementmap-audit-2026-08-18.txt`. Nutzer
wählte "Alle 5 fixen + V1 teilweise" -> B369-B374 umgesetzt. Root Cause
aller 5 Bugs (B369-B373) identisch: die drei Namens-Listen sind unabhängig,
inkrementell über viele Sprints gewachsen -- Synonyme (Bindestrich vs.
Leerzeichen, Singular vs. Plural) wurden dabei jeweils nur in EINE Liste
eingetragen statt konsistent in alle betroffenen (z.B. "Push-Up" nur in
MOVEMENT_MAP, "Push Up" nur in NO_BARBELL_EXERCISE_NAMES -- beide Listen
kannten jeweils nur die halbe Wahrheit). B374 (Verdachtsfall) nur
teilweise umgesetzt: die eindeutigen Fälle (Burpees, Box/Broad Jumps,
Battle Ropes) ergänzt, der Rest (Crunch, Situps, Ab-Wheel, Russian
Twists, Hollow Hold) bewusst dokumentiert statt geraten, analog zum
etablierten Konsolidierungs-Muster (B346/B355/B360/B361). Der zweite
Diagnose-Fork bestätigte call-site-seitig eine saubere Architektur: keine
direkten MOVEMENT_MAP-Bypässe im Projekt, exerciseAlternatives.js ist
bewusst unabhängig (keine Divergenz), alle ~24 isCompoundExercise()-
Aufrufstellen bauen categoryMap frisch, defaultShowPlates() wird nie beim
Rendern erneut aufgerufen. 6 neue Tests (movementmap_audit_fixes.spec.js,
reine Node-Unit-Tests ohne Browser) + 1 bestehender Test
(movement_map_expansion.spec.js) auf die neue Key-Anzahl (226) angepasst.
Volle Regressionssuite (111 Spec-Dateien, gebatcht) grün, 1 vorbestehendes
Flake (trainingstab_audit_fixes.spec.js Phantom-PR, seit Runde 26 in
jeder Runde beobachtet und bestätigt unabhängig) auf Retry grün.
Davor: Runde 33 (train-v258→v259, B365-B368):
ui.js-Dispatch-Handler-Audit, SIEBTE Runde -- auf Nutzerauftrag "start
ui.js dispatch audit" gestartet. Der zentrale Event-Dispatch-Mechanismus
`_handleClick()` (ui.js, ~2130 Zeilen, 162 `case`-Zweige auf `data-action`)
war bisher nie als eigenständiges Subsystem auditiert, nur indirekt über
Tab-Audits berührt. 2 parallele Diagnose-Agenten (Outside-Click-Preamble +
strukturelle switch-Health, inhaltliche Case-Body-Korrektheit) fanden 2
bestätigte + 2 Verdachtsfälle. Ergebnis in
`Diagnose & Sprints/diagnose-uijs-dispatch-audit-2026-08-18.txt`. Nutzer
wählte "alle 4 fixen" -> B365-B368 umgesetzt. Größter struktureller Fund
der gesamten bisherigen Audit-Reihe (B368): SIEBEN destruktive/
hochriskante Bestätigungs-Panels (Übung archivieren/entfernen, Tag
entfernen, Alle Daten löschen, Woche/Template zurücksetzen, Vorlage
speichern) hatten -- anders als ALLE anderen Popover im selben Dispatch-
Mechanismus -- keinen Outside-Click-Handler; am gravierendsten beim
irreversibelsten Button der App ("Alle Daten löschen"), dessen scharfer
Button beliebig lange sichtbar blieb, bis explizit "Abbrechen" gedrückt
wurde. Beim Umsetzen von B367 (2 weitere UTC-Datumsstellen im Dispatch-
Switch) zusätzlich entdeckt: ein in Runde 28 (B331) bereits diagnostizierter,
aber NIE tatsächlich umgesetzter Fund (`_finish()`s ONBOARDING_SEED-
Startdatum) sowie 2 weitere unabhängige Instanzen desselben Musters
(`nextMonday()`, `measuredWeekStart`) -- alle in dieser Runde nachgeholt,
Gesamtsumme dieser Runde damit 6 Datums-Fixes statt der ursprünglich 2
diagnostizierten. 3 neue Tests (uijs_dispatch_audit_fixes.spec.js). Volle
Regressionssuite (110 Spec-Dateien, gebatcht) grün, 1 vorbestehendes
Flake (trainingstab_audit_fixes.spec.js Phantom-PR, seit Runde 26 in
jeder Runde beobachtet und bestätigt unabhängig) auf Retry grün.
Davor: Runde 32 (train-v257→v258, B360-B364):
sessionCoach.js-Audit, SECHSTE Runde -- auf Nutzerauftrag "start
sessionCoach.js audit" gestartet (Nutzer hatte diese Datei als eine von
mehreren offenen Kandidaten genannt bekommen, nachdem die ursprüngliche
Vier-Runden-Serie plus weightRecommendation.js/Runde 31 abgeschlossen
waren). sessionCoach.js (Intra-Session-Coach: RPE-/Wdh-Differenz-
Entscheidungsmatrix für Satz-zu-Satz-Feedback, Pausenzeiten, Abschluss-
Nachricht) war bisher nie als eigenständiges Subsystem auditiert. 2
parallele Diagnose-Agenten (Kernlogik in sessionCoach.js, Aufrufstellen-
Konsistenz in ui.js/state.js) fanden 1 bestätigten Bug + 4 Verdachtsfälle.
Ergebnis in `Diagnose & Sprints/diagnose-sessioncoach-audit-2026-08-18.txt`.
Nutzer wählte "Bug + sinnvolle Verdachtsfälle fixen" -> B360-B364
umgesetzt (3 per Code-Änderung, 2 bewusst nur dokumentiert). Wichtigster
Fund (B364): `buildLastSetMessage()` hatte kein Compound/Isolation-
Bewusstsein -- eine Isolationsübung bei RPE 8 konnte "Perfekt
abgeschlossen ✓" zeigen, direkt neben einem `nextWeekText`, der (seit
B358/Runde 31 korrekt) bereits "gleiches Gewicht" zeigte, dieselbe
Compound/Isolation-Bewusstseins-Lücke wie B121/B358. Bemerkenswert sauberer
Befund im Aufrufstellen-Cluster: alle 7 `buildSetFeedback()`-Aufrufstellen
waren bereits korrekt, und die ursprünglich vermutete `reduced_mild`-Scope-
Lücke (B361) erwies sich als durch eine externe Invariante bereits
abgesichert (nur dokumentiert). B360 (Granularitäts-Asymmetrie zwischen den
4 Matrix-Gruppen) wurde ebenfalls bewusst nur dokumentiert -- eine reine
Produktentscheidung ohne eindeutige DECISIONS.md-Spezifikation für die
betroffenen Gruppen, analog zu B346/B355. 4 neue Tests
(sessioncoach_audit_fixes.spec.js, reine Node-Unit-Tests ohne Browser).
Volle Regressionssuite (109 Spec-Dateien, gebatcht) grün, 2 vorbestehende
Flakes (delete_all_data.spec.js -- neu beobachtet, aber bei 6/6
Wiederholungen sauber, sowie das altbekannte trainingstab_audit_fixes.spec.js
Phantom-PR) jeweils unabhängig als umgebungsbedingt bestätigt.
Davor: Runde 31 (train-v256→v257, B353-B359):
weightRecommendation.js-Audit, FÜNFTE Runde nach Abschluss der ursprünglich
angekündigten Vier-Runden-Serie -- auf Nutzerfrage "is there something
else to audit" empfohlen und auf Zustimmung hin gestartet: der zentrale
RPE-/Erfolgsquoten-Algorithmus hinter praktisch jeder "nächste Woche:
Xkg"-Anzeige im Projekt war bisher nie als eigenständiges Subsystem
auditiert worden, nur als Konsument/Nebenfund an anderer Stelle erwähnt.
2 parallele Diagnose-Agenten (Kernalgorithmus in weightRecommendation.js
selbst, Aufrufstellen-Konsistenz projektweit) fanden 3 bestätigte + 4
Verdachtsfälle. Ergebnis in
`Diagnose & Sprints/diagnose-weightrecommendation-audit-2026-08-17.txt`.
Nutzer wählte "alle 7 fixen" -> B353-B359 umgesetzt (6 per Code-Änderung,
1 bewusst nur dokumentiert). Wichtigste Fixes: `substituteFor` wurde in
keiner der drei weekSets-Konstruktionen berücksichtigt -- vierte
unabhängige Fundstelle derselben Fehlerklasse wie B335 (Runde 29), hier
unmittelbar sichtbar als fehlende statt nur verzerrte Empfehlung nach
einer "Heute anders"-Substitution (B359); insightEngine.js Toast-Insights
A-01/A-01b/A-02 hatten `isCompound` fest auf `true` gesetzt statt berechnet
-- ein direkt sichtbarer Widerspruch zwischen Coach-Tab und Toast für
dieselbe Isolationsübung bei RPE 8 (B358). Eine vermutete Bulk+Isolation-
Kollaps-Lücke (aus der ersten Recon-Hypothese) stellte sich als
beabsichtigtes Design heraus und wurde NICHT gefixt. B355
(Fenstergröße-Inkonsistenz 4 vs. 3 Wochen) wurde bewusst nur dokumentiert,
nicht verändert -- beide Fenstergrößen beantworten unterschiedliche
Fragen, eine Vereinheitlichung ohne klare Bug-Evidenz wäre ein unnötiges
Verhaltensrisiko gewesen (analog zur B346-Entscheidung aus Runde 30). 5
neue Tests (weightrecommendation_audit_fixes.spec.js, davon 4 als reine
Node-Unit-Tests ohne Browser). Volle Regressionssuite (108 Spec-Dateien,
gebatcht) grün, 1 vorbestehendes Flake (trainingstab_audit_fixes.spec.js
Phantom-PR, bereits aus mehreren vorherigen Runden bekannt) auf Retry grün.
Davor: Runde 30 (train-v255→v256, B344-B352):
PWA/Service-Worker + Backup/Restore-Audit, VIERTE und letzte der
angekündigten Folgerunden nach Fortschritt-Tab (Runde 27), Onboarding-Flow
(Runde 28) und Utility-Schicht (Runde 29) -- damit ist der Auftrag "audit
all things listed" komplett abgearbeitet. 2 parallele Diagnose-Agenten
(sw.js+registerSW.js, backup.js) fanden 4 bestätigte + 5 Verdachtsfälle.
Ergebnis in `Diagnose & Sprints/diagnose-pwa-backup-audit-2026-08-17.txt`.
Nutzer wählte "alle 9 fixen" -> B344-B352 umgesetzt. Anders als in den
drei vorherigen Runden dominierte hier NICHT die isSeedWeek-Fehlerklasse
(nur B349) -- PWA/Backup ist strukturell anderer Bereich (Browser-
Lifecycle-APIs, Dateiformat-Export). Wichtigste Fixes: `install`-Handler
(sw.js) behandelte ein fehlgeschlagenes `cache.addAll()` bisher SILENT als
Erfolg -- ein einziger fehlgeschlagener Download hätte den neuen Worker mit
komplett leerem Precache aktivieren können (B351); `cacheFirstWithRefresh()`s
Hintergrund-Cache-Refresh war nicht durch `event.waitUntil()` geschützt und
konnte dadurch praktisch nie zuverlässig fertig laufen (B350); eine echte
CSV-Formula-Injection-Sicherheitslücke in `cell()` (B352, erste
sicherheitsrelevante Fundstelle dieser gesamten Audit-Reihe). B346
(Versionswechsel-Toast nur einmalig geprüft) wurde bewusst NICHT im Code
gefixt -- ein testweise ergänzter `controllerchange`-Listener verursachte
eine neue, empirisch bestätigte Flakiness in der bestehenden SW-Test-Suite
(5/5 grün ohne den Listener, flaky mit ihm) und wurde wieder verworfen, da
die Auswirkung des ursprünglichen Verdachtsfalls gering war -- ein Beispiel
dafür, dass nicht jeder diagnostizierte Verdachtsfall eine risikofreie
Korrektur hat. 4 neue Tests (pwa_backup_audit_fixes.spec.js, deckt die
backup.js-Fixes ab; sw.js/registerSW.js-Fixes sind durch die bestehende
sw_update_and_version.spec.js/sw_silent_update_toast.spec.js-Suite
weiterhin abgedeckt, unverändert grün). Volle Regressionssuite (107
Spec-Dateien, gebatcht) grün, 2 vorbestehende Flakes (plate_calculator.spec.js,
trainingstab_audit_fixes.spec.js Phantom-PR) auf Retry/Isolation grün,
beide unabhängig bestätigt (u.a. durch Vergleich mit einer temporär
zurückgesetzten Version von registerSW.js).
Davor: Runde 29 (train-v254→v255, B332-B343):
Geteilte-Utility-Schicht-Audit, dritte von vier angekündigten Folgerunden
nach Fortschritt-Tab (Runde 27) und Onboarding-Flow (Runde 28). 3 parallele
Diagnose-Agenten (insightEngine.js Kernfunktionen, insightEngine.js
INSIGHTS-Toast-Array, plateauDetector.js+consistencyUtils.js) fanden 8
bestätigte + 4 Verdachtsfälle. weekReview.js/sessionSummary.js (bereits in
Runde 27 vollständig geprüft) und weeklyFocus.js (Kernschwerpunkt Runde 24)
wurden bewusst nicht erneut vollständig auditiert, um Doppelarbeit zu
vermeiden. Ergebnis in
`Diagnose & Sprints/diagnose-utility-schicht-audit-2026-08-17.txt`. Nutzer
wählte "alle 12 fixen" -> B332-B343 umgesetzt. Wichtigster Fund (B343): das
komplette INSIGHTS-Toast-System (~22 Insight-Definitionen, nie zuvor als
eigenständiges Subsystem auditiert) hatte eine systemische isSeedWeek-
Filterlücke -- K-01 zählte die Startwerte-Woche in der Streak mit, K-03
("Beste Woche") und M-01 ("Bestes Jahr") konnten durch die künstlich
perfekte Seed-Woche dauerhaft unterdrückt werden. Neuer gemeinsamer
`_realWeeks()`-Helper statt 22 einzelner Inline-Filter. plateauDetector.js
zeigte gleich drei aus früheren Runden bekannte Fehlerklassen (pending-
Sätze im Nenner wie B269, archivierte Übungen wie B272, B337/B336) PLUS
einen neuen Bug: `exNames`-Filter blacklistete einen Übungsnamen dauerhaft,
sobald er jemals als Substitutions-Ziel auftrat -- auch für seine eigenen,
nicht-substituierten Wochen (B338). B340 deckte zwei unabhängige,
methodisch verschiedene Schlaf-Korrelations-Implementierungen auf (dritte
Fundstelle der "widersprüchliche Parallel-Implementierungen"-Fehlerklasse
nach B293/B317) -- bewusst nicht zusammengeführt, nur die inkonsistente
Deload-/Urlaub-Filterung angeglichen. 6 neue Tests
(utility_layer_audit_fixes.spec.js, davon 3 als reine Node-Unit-Tests ohne
Browser für plateauDetector.js). Volle Regressionssuite (106 Spec-Dateien,
gebatcht) komplett grün -- erstmals seit mehreren Runden ohne jedes Flake.
Davor: Runde 28 (train-v253→v254, B327-B331):
Onboarding-Flow-Audit, zweite von vier angekündigten Folgerunden nach
Fortschritt-Tab (Runde 27). 2 parallele Diagnose-Agenten (Onboarding-
Overlay-UI in ui.js, zugehörige Reducer in state.js) fanden 5 bestätigte
Bugs -- deutlich kleinerer Fund-Umfang als bei den Tab-Audits, passend zur
kleineren Codebasis. Ergebnis in
`Diagnose & Sprints/diagnose-onboarding-flow-audit-2026-08-17.txt`. Nutzer
wählte "alle 5 fixen" -> B327-B331 umgesetzt. Wichtigste Fixes: FÜNF
unabhängige UTC-statt-lokal-Datum-Stellen (_applyTpl/_applyBlank/_finish in
ui.js, _nextMonday/_currentMonday in state.js -- B331); _appendDefaultWeek()
als FÜNFTE unabhängige Klon-Reset-Kopie mit denselben Lücken wie B288/B308,
jetzt auf _resetClonedDays() vereinheitlicht (B330); verwaiste Startwerte
aus einer verworfenen Vorlagen-Auswahl landeten trotzdem in der Seed-Woche
(B329); fehlende Obergrenze bei Startwerte-Eingaben, gleiche Fehlerklasse
wie B304 (B328). Nebenbei ein vergessener Debug-console.log entfernt
(B327, einziger in ganz ui.js). 4 neue Tests
(onboarding_flow_audit_fixes.spec.js). Volle Regressionssuite
(105 Spec-Dateien, gebatcht) grün, 1 vorbestehendes Flake
(trainingstab_audit_fixes.spec.js Phantom-PR-Test, bereits aus Runde 26/27
bekannt) auf Retry grün.
Davor: Runde 27 (train-v252→v253, B311-B326):
Fortschritt-Tab-Audit auf Nutzeranfrage ("audit all things listed, beginn
with fortschritt tab und dann weiter mit dem Rest"), erste von vier
angekündigten Folgerunden (Onboarding-Flow, geteilte Utility-Schicht, PWA/
Service-Worker+Backup/Restore folgen als eigene Runden). 4 parallele
Diagnose-Agenten (ui.js-Aggregationsschicht/renderProgressTab,
progressChart.js+Chart-Wrapper, weekReview.js/weekReviewModal.js,
progressInsights.js/overallPerformance.js/sessionSummary.js) fanden 10
bestätigte + 6 Verdachtsfälle -- Ergebnis in
`Diagnose & Sprints/diagnose-fortschritt-tab-audit-2026-08-17.txt`. Nutzer
wählte "alle 17 fixen" (16 tatsächliche Funde, davon 1 reiner Cleanup-Fund
ohne Bug) -> B311-B326 umgesetzt. Wichtigster Fund (B326): die
Startwerte-Woche war an DREI unabhängigen Stellen als "reviewbare" Woche
wählbar (reviewableWeeks/_updateInlineReview im Fortschritt-Tab,
_runAutoWeekFlow, open-new-week-Handler) -- ein brandneuer Nutzer konnte
direkt nach dem Onboarding einen fabrizierten Wochenrückblick mit
erfundenen "Neuer PR"-Meldungen sehen, inklusive funktionierendem
Share-Button. Zweithäufigstes Muster: dieselbe isSeedWeek-Filterlücke wie
in allen 3 vorherigen Audit-Runden, hier an 9 weiteren unabhängigen Stellen
reproduziert -- darunter auch eine Korrektur zu Runde 25 selbst (B325,
`_updateExChart()`s Hauptchart "Übungsfortschritt" war fälschlich als
Fortschritt-Tab-fremd eingestuft und blieb ungefixt). B317 ist die zweite
Fundstelle der "mehrere Absätze derselben Karte filtern uneinheitlich"-
Fehlerklasse nach B293 (Runde 25). Nebenbei ~65 Zeilen toten Code entfernt
(`_drawHeatmap()`/`drawLineChart()`, Überbleibsel vor der SVG-Chart-
Umstellung). 7 neue Tests (fortschritt_tab_audit_fixes.spec.js). Volle
Regressionssuite (104 Spec-Dateien, gebatcht) grün, 1 vorbestehendes Flake
(trainingstab_audit_fixes.spec.js Phantom-PR-Test, bereits aus Runde 26
bekannt) auf Retry grün.
Davor: Runde 26 (train-v251→v252, B297-B310):
Körper-Tab + Einstellungen-Audit auf Nutzeranfrage ("mach auch Körper-Tab und
Einstellungen"), analog zu Coach-Tab (Runde 24) und Trainings-Tab (Runde 25).
4 parallele Diagnose-Agenten (Körpergewicht/BMI, Relative-Stärke/Schlaf-
Korrelation, Settings-Reducer/Custom-Exercises/Backup, Template-Editor)
fanden 5 bestätigte + 9 Verdachtsfälle -- Ergebnis in
`Diagnose & Sprints/diagnose-koerper-einstellungen-audit-2026-08-17.txt`.
Nutzer wählte "alle 14 fixen" und, für den BMI-Fund, explizit "Datenfelder
entfernen" statt der empfohlenen Fertigstellung. Wichtigster Fund (B310):
Korrektur zu Runde 25 -- `_weeklyP4PSeries()`/`_allTimePRSeries()` wurden
dort fälschlich als Fortschritt-Tab-Code eingestuft, sind aber tatsächlich
Körper-Tab-Code ("Relative Stärke"-Karte); die Startwerte-Woche konnte dort
als synthetischer erster Datenpunkt erscheinen. Zweithäufigstes Muster:
`WEEK_RESET_TO_TPL` (B308) ist die VIERTE unabhängige Wochen-Klon-Reset-Kopie
mit denselben Lücken wie B288, jetzt auf `_resetClonedDays()` vereinheitlicht;
`CUSTOM_EX_UPDATE` (B309) ist eine zweite unabhängige "Übung umbenennen"-
Implementierung mit denselben Lücken wie B291 (`EX_MERGE_NAMES`), fehlte u.a.
die Migration von `state.prs`/`plateauActions`/`exerciseNotes`/
`customAlternatives`. Produktentscheidung: BMI-Datenfelder (`heightCm`/
`showBmi`) waren nie angebunden (keine Berechnung/Anzeige irgendwo in ui.js)
-- komplett aus Schema/Migration entfernt statt fertiggestellt (B306). 5 neue
Tests (koerper_einstellungen_audit_fixes.spec.js). Volle Regressionssuite
(103 Spec-Dateien, gebatcht) grün, 2 vorbestehende Flakes (plate_calculator.spec.js,
trainingstab_audit_fixes.spec.js Phantom-PR-Test) auf Retry/Isolation grün,
beide unabhängig von diesen Änderungen.
Davor: Runde 25 (train-v250→v251, B284-B296,
B283 übersprungen siehe BUGS.md-Hinweis): Vollständiger Trainings-Tab-Audit
auf Nutzeranfrage ("mache einen total audit für trainingstab identifiziere
fehler inkonsistenzen und bugs"), analog zum Coach-Tab-Audit direkt zuvor.
5 parallele Diagnose-Agenten (Satz-Ebene, Übungs-Ebene/Reducer, Tag/Session/
Timer, Wochen-Ebene, ui.js-Rendering-Schicht) fanden 5 bestätigte + 8
Verdachtsfälle -- Ergebnis in
`Diagnose & Sprints/diagnose-trainings-tab-audit-2026-08-17.txt`. Nutzer
wählte "alle 13 fixen" -> B284-B296 umgesetzt (beim Testschreiben zusätzlich
eine DRITTE unabhängige Kopie des skipReason-Klon-Bugs in WEEK_COPY_PREV
gefunden und mitgefixt, in B288 zusammengefasst). Wichtigster Fund (B284):
das manuelle ✓/✗-Icon (toggle-done, laut Code-Kommentar im Handler selbst
vermutlich der meistgenutzte Bewertungspfad) startete den Pausentimer nie
automatisch -- derselbe Bug-Typ wie B242/B249, hier aber im Hauptpfad nie
gefixt. Zweithäufigstes Muster (B285-B286): wieder die isSeedWeek/archived-
Filterlücken-Fehlerklasse aus Runde 24, hier in ui.js (4-fach duplizierter
calcWeeks-Filter für Gewichtsempfehlungen) und state.js (`_dayEvalCounts()`,
gemeinsame Basis für Trainings-Tab-Streak UND Coach-Tab-Konsistenz-Quote).
B292 (Phantom-PR) führt eine neue `_recomputePrFromHistory()`-Funktion ein,
die bei einer Korrektur an einem bereits bewerteten PR-Satz die komplette
Historie neu scannt (bewusst nur bei dieser Korrektur ausgelöst, nicht bei
jedem Satz-Update). 6 neue Tests (trainingstab_audit_fixes.spec.js). Volle
Regressionssuite (102 Spec-Dateien, gebatcht) grün, 1 vorbestehendes Flake
(share_image.spec.js, bereits aus Runde 23 bekannt) auf Retry grün.
Davor: Runde 24 (train-v249→v250, B269-B282):
Vollständiger Coach-Tab-Berechnungs-Audit auf Nutzeranfrage ("prüfe jede
Berechnung des Coaching Tabs auf weitere Fehler"), ausgelöst durch den
B267-Zufallsfund in Runde 23. 5 parallele read-only Diagnose-Agenten haben
je einen Funktionscluster geprüft (Recovery/Overload, Preventive-Deload/
Fatigue/Pre-Plateau, Konsistenz/Plateau/Progression, Struktursignale/
Decisional-Balance, ui.js-Aggregationsschicht) — Ergebnis in
`Diagnose & Sprints/diagnose-coach-tab-audit-2026-08-17.txt`. 14 Funde (7
bestätigt + 7 Verdacht), Nutzer wählte "alle fixen" -> B269-B282
umgesetzt. Wichtigster Fund (B269): `_completionRate()` (weeklyFocus.js)
zählte `pending`-Sätze im Nenner mit -- da die aktuell laufende, nur
teilweise trainierte Woche praktisch immer im 3-Wochen-Vergleichsfenster
liegt, drückten deren offene Sätze die Quote systematisch nach unten und
erklären vermutlich direkt das vom Nutzer gemeldete "Erfolgsquote gesunken
obwohl es nicht stimmt". Zweithäufigstes Muster (B270-B274, B276-B277):
dieselbe isSeedWeek-Fehlerklasse wie B267, aber in UNABHÄNGIGEN "alle
Wochen holen"-Kopien über mehrere Dateien verstreut (plateauDetector.js,
consistencyUtils.js/insightEngine.js, ui.js-lokale sorted-Arrays) --
bewusst NICHT zentral in der geteilten `getSortedWeeks()` (insightEngine.js)
gefixt, da diese an anderer Stelle als PR-/Gewichts-Kaltstart-Baseline
gebraucht wird (nur an den jeweiligen Konsumenten gefixt). B275: adaptive
Pre-Plateau-Rückfrage bekam ein `exerciseName`-Feld (state.coachQuestion),
um Antworten nicht mehr der falschen Übung zuzuordnen. 11 neue Tests
(weeklyfocus_audit_fixes.spec.js, Erweiterung von
weeklyfocus_seedweek_exclusion.spec.js). Volle Suite (101 Spec-Dateien,
gebatcht) grün, 2 eigene Vorrunden-Tests mussten wegen einer unrealistischen
4-Wochen-Kalenderlücke im Test-Fixture selbst angepasst werden (durch die
neue Kontinuitätsprüfung B280 aufgedeckt, keine Regression).
Davor: Runde 23 (train-v248→v249, B266-B268):
3 punktuelle Nutzer-Rückmeldungen direkt im Chat (kein Solotest-Dokument
diesmal). (1) Update-Banner "Später" -> Hinweis kam beim nächsten App-Öffnen
nicht wieder: kein echter Bug, sondern fehlende Rückmeldung -- ein wartender
Service Worker aktiviert sich automatisch (Browser-Standard), sobald die
App komplett geschlossen+neu geöffnet wird; jetzt ein einmaliger "im
Hintergrund aktualisiert"-Toast bei Versionsabweichung (registerSW.js,
B266). (2) Coach-Tab behauptete teils fälschlich "Erfolgsquote gesunken":
weeklyFocus.js hatte eine EIGENE, von der state.js-Kopie unabhängige
_sortedWeeks()-Funktion, die die Startwerte-Woche (isSeedWeek) nicht
ausschloss -- derselbe Bug-Typ wie B246 (Runde 22), aber unabhängig
übersehen, mit weitem Blast-Radius (praktisch jedes Coach-Signal in dieser
Datei). Zentral in _sortedWeeks() gefixt (B267). (3) Wochenrückblick auf
Wunsch von 2/2 auf bis zu 3/3 Highlights/Lowlights erweitert, mit
Favoriten-Priorität bei der Auswahl (_withFavoritesFirst()-Muster: erst nur
Favoriten versuchen, bei leerem Ergebnis auf alle Übungen ausweichen);
neues drittes Highlight "saubere Ausführung" (100% Erfolgsquote einer
Übung, min. 3 Sätze), da vorher nur PR+Steigerung als Highlight-Quellen
existierten (B268). 8 neue Tests (sw_silent_update_toast.spec.js,
weeklyfocus_seedweek_exclusion.spec.js, weekreview_favorites_and_3plus3.spec.js).
Gezielte Regressionssuiten (Coach-Tab/weeklyFocus, Wochenrückblick, Share-
Image, SW-Update — nicht die volle 97-Datei-Suite) grün.
Davor: Runde 22 (train-v247→v248, B246-B265):
Solotest-Feedback-Sammelrunde. Nutzer testete die App eigenständig anhand der
`TRAIN-Solotest-Checkliste.md` und trug ~40 Rohpunkte (Bugs, UX-Fragen,
Produktfragen) direkt in die Checkliste ein; 7 parallele Diagnose-Agenten
clusterten die Punkte (A: Onboarding/Startwerte-Woche, B: Session-Coach/Pause-
Timer, C: Bodyweight-RPE, D: Heute-anders, E: Fortschritt/Wochenrückblick,
F: Settings/Sonstiges, G: PWA/Kategorie-Anzeige). 20 Fixes umgesetzt (B246-B265,
siehe BUGS.md für Details je Eintrag). Wichtigste architektonische Erkenntnis:
die synthetische Startwerte-Woche (`ONBOARDING_SEED`/`isSeedWeek`) fehlte
komplett in der Streak-/Wochennavigations-Ausschlussliste, was mehrere
scheinbar unabhängige Nutzerbeschwerden erklärte (B246). Zweite größere
Erkenntnis: der Auto-Eval-Blur-Pfad (Einstellung "Automatische Satz-
Bewertung") feuerte nie das `train:set-done`-Event aus Runde 20/B242, wodurch
der Pausentimer für automatisch bewertete Sätze nie startete (B249) — dieser
Default wurde in derselben Runde zusätzlich von AUS auf AN gedreht (B260,
Produktentscheidung: manuelles Bestätigen jedes Satzes wurde im Solotest als
Reibung empfunden). Neue `defaultShowPlates()`-Ausschlussliste (movementMap.js)
für stangenlose Übungen (B252). Zwei von Hand gebaute Backup-JSON-Fixtures
(`Diagnose & Sprints/simtest-*.json`) für zwei nie im Solotest ausgelöste
Features (Verletzungs-Erinnerung, Pre-Plateau-Rückfrage) zum manuellen
Nachtesten. Volle Regressionssuite (97 Spec-Dateien, gebatcht wegen EMFILE)
grün — 3 vorbestehende Tests an die bewusst geänderten Defaults/Dedupe
angepasst (`migration_matrix.spec.js`, `session_coach_decision_matrix_v2.spec.js`,
`weekreview_deload_pr_filter.spec.js`), 1 Flake in `share_image.spec.js`
bestätigt unabhängig (isoliert grün). Bewusst zurückgestellt/nicht Teil dieser
Runde: Superset-Feature-Konzept (nur als Vorschlag skizziert, nicht
implementiert), Settings-Tab-Reorganisation, vollständiger Schlaf-Korrelation-
Redesign (nur Fallback-Meldung ergänzt), Onboarding-Tutorial-Slideshow.
Davor: Runde 21 (train-v246→v247, B245): Kurzartikel-
Feature (Ersatz für die von Cowork/Nutzer abgelehnte In-App-Spiel-Idee aus Runde 20/
Befund 9, siehe DECISIONS.md/TRAIN-Launch-Roadmap.md Phase H) — kurze, kategorie-
gebundene Trainings-Tipps im Pause-Overlay (Push/Pull/Squat/Hinge/Carry/Core +
generischer Fallback, `pauseTips.js`), Explore-Agent lieferte Bauplan, Nutzer
bestätigte im Plan-Mode: Übungs-/Signal-Bindung statt des empfohlenen generischen
Pools (höherer Pflegeaufwand pro Kategorie bewusst in Kauf genommen). Setting-Default
direkt danach vom Nutzer von AN auf AUS/Opt-in korrigiert (DECISIONS.md 2026-08-15:
ein Lesetext ist ein aktiver Aufmerksamkeitsanspruch genau in dem Moment, der bei
"einfach nur trainieren, nicht mehr nachdenken" bewusst frei bleiben soll). Befüllt
ausschließlich im `train:set-done`-Handler, nicht im `train:pause-restart`-
Handler (Runde 20/B242) — Tipp-Text bleibt bei nachträglicher RPE-Korrektur stabil.
Neuer additiver Settings-Key `showPauseTips` (Training-Gruppe). Nebenfund bei der
Umsetzung: die durch den Tipp höhere Pause-Overlay-Pille kollidierte mit dem
Toast-Anhebungs-Offset (A2, fest auf 168px kalibriert) — auf 240px erhöht, per Test
verifiziert (`tests/mobile_feedback_scroll.spec.js`). Cluster 2 (Backlog-Dokumentation
Chatbot-Idee, Befund 10) ohne Diagnose direkt erledigt: neue `BACKLOG.md` angelegt.
6 neue Tests (`tests/pause_tips.spec.js`). Volle Regressionssuite (475+ Tests, gebatcht)
grün. Redaktion echter Artikeltexte bewusst NICHT Teil dieser Runde (nur 8
Platzhalter-Einträge, 1 pro Kategorie + 2 generisch). Davor: Runde 20 (Betatest-/Live-Feedback-Sammelrunde,
15 Rohpunkte, siehe `Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde20.md` +
`diagnose-runde20-betatest-feedback-2026-08-15.txt` + `sprint-ergebnis-runde20-2026-08-15.txt`):
8 Fixes/Features umgesetzt, train-v246 (B237-B244). Pre-Session-Gewichtsreduktion
braucht jetzt Bestätigung statt automatisch zu greifen (B237, nutzt den bereits
bestehenden "Gewichte heute anpassen"-Button, vormals nur Catch-up). Schlaf-Coach-
Text jetzt begründet statt behauptet (B238). Onboarding-Startgewichte werden in die
geladene Vorlage übernommen (B239, keine Überschneidung mit B212). Toast bei jedem
Wochenwechsel — Swipe wirkte auf einen Beta-Tester wie Datenverlust, da der
Wochen-Indikator nicht sticky ist (B240). Steigerungsrate im In-Session-Coach
sichtbarer (Akzentfarbe) + einmaliger Erstnutzer-Tip über beide Bewertungspfade
(B241). Pausentimer reagiert jetzt auf nachträgliche RPE-Eingabe (RPE-Nudge/
Popover/Autofill) — neues `train:pause-restart`-Event mit Satz-Key-Absicherung
gegen falsches Zurückdrehen eines bereits laufenden späteren Satz-Timers (B242).
Update-Erkennung repariert: eine echte, per Live-Nutzung über Wochen aufgedeckte
Regression aus B62 — `_ensureSessionStart()` feuerte den SW-Registrierungs-Trigger
nur EINMAL PRO TAG, ein Nutzer der öffnet ohne zu trainieren bekam nie eine neue
Update-Prüfung. SW-Registrierung läuft jetzt zusätzlich Idle-verzögert bei jedem
App-Start, B62s eigentlicher Kern (kein Install-Prompt-Zwang, reduzierter
Precache-Scope) bleibt unangetastet — siehe DECISIONS.md 2026-08-15 für die
bewusste Teil-Revision. Zusätzlich neues "mehr Details"-Aufklapp-Feld im
Update-Banner, fragt den wartenden Worker per MessageChannel nach
`CHANGELOG_ENTRIES` (sw.js, neu gepflegt bei jeder CACHE_VERSION-Erhöhung) (B243).
Neues Feature "Kraftzuwachs letzte X Wochen" im Übungsfortschritt-Chart —
`computeStrengthGain()` (progressInsights.js) vergleicht besten geschätzten 1RM
(Epley, identische Formel/Filterlogik wie das bestehende `_renderAnalysis1RM()`)
der ältesten gegen die neueste Woche im wählbaren Zeitraum (4/8/12/26 Wochen) (B244).
Zwei Punkte bewusst NICHT code-seitig gelöst (siehe DECISIONS.md): ob Trainingsfokus
(goal) die Steigerungs-Schwellen beeinflussen soll, ist eine offene Produktfrage
für Cowork, nicht im Vorbeigehen entschieden; die gemeldete RPE-7-Inkonsistenz
zwischen Übungen ist erwartungsgemäßes Verhalten (Erfolgsquote/Konfidenz/
nutritionPhase-abhängig), Begründung wird über `_recSubline()` bereits sichtbar
gerendert. Drei Punkte sind reine Produkt-/Strategiefragen bzw. Backlog-Notizen,
kein Code (In-App-Spiel/Artikel während Pause, Chatbot mit vordefinierten Fragen,
USP-Botschaft) — für Cowork/später. QR-Code+WhatsApp-Frage fürs Event im Chat
beantwortet (wa.me-Link statt vCard-Umweg empfohlen), kein TRAIN-Code-Bestandteil.
11 neue/erweiterte Testdateien. Volle Regressionssuite (475 Tests, 96 Spec-Dateien,
gebatcht wegen der dokumentierten Windows-EMFILE-Grenze — ein ungebatchter Lauf
bestätigte das bekannte Muster erneut, `npx serve` brach mit EMFILE ab, kein neuer
Bug) durchgehend grün, keine Fehlschläge, keine neuen Flakes. Davor: Launch-Roadmap
Phase G (Betatest): Ausführungsplan erstellt (`Diagnose & Sprints/TRAIN-Phase-G-Betatest-Plan.md`, gitignored, keine Code-Änderung) — Auswahlkriterien (gezielt gegen die zwei vom Council benannten Blindspots: anderer Trainingsstil als der Entwickler + echtes iOS-Gerät), Feedback-Fragenkatalog, Einladungs-Entwurf. Ausführung (Testpersonen finden/einladen) ist echte menschliche Kontaktaufnahme, liegt beim Nutzer. Empfehlung im Plan: Phase F (eigenes Gerät, 4 Punkte laut `TRAIN-Pre-Launch-Checkliste.md`, ~15-20 Min) zuerst. Davor: WISSENSCHAFTS-AUDIT.md-Handlungskandidaten umgesetzt, train-v245 (B234-B236), 4 von 5 erledigt. Nutzer-Entscheidungen: Reentry >56 Tage → RPE-autoregulierter Wiedereinstieg statt reiner Zahlen-Änderung (B235, Faktor 0.25→0.5 als Startwert, Popup erklärt Session-Coach-Übernahme); Deload-Mechanismus → sofort fixen nach Diagnose (B234); Deload-Trigger → auf 6 Wochen senken (B236); NO-CONSENSUS-Werte → Code-Kommentare ergänzt. Diagnose (eigener Fork) fand einen echten, bisher unbemerkten Bug: Coach-Tab-Deload-Plan reduzierte gleichzeitig Volumen UND Gewicht (widersprach der bereits dokumentierten DECISIONS.md-Entscheidung "Sprint C2 Teil B"), das manuelle "Deload-Woche" im Wochen-Menü tat das GEGENTEIL (nur Gewicht) — beide jetzt auf denselben Satz-Reduktions-Mechanismus vereinheitlicht, `deloadFactor`-Setting umbenannt ("Gewichtsreduktion bei Dauer-Fehlschlag", betrifft Deload-Wochen nicht mehr). Einziger noch offener Kandidat: Konfidenz-Einstufungs-Logik (Domäne A, stützt sich auf am wenigsten zuverlässige RPE-Selbstangaben) — Kandidat für eine künftige Runde. 2 neue Tests in `tests/deload_volumen.spec.js`, `tests/reentry_faktoren.spec.js` erweitert. Volle Suite (95 Dateien, gebatcht) grün. Davor: Wissenschaftliches Grundlagen-Dokument erstellt (`WISSENSCHAFTS-AUDIT.md`, keine Code-Änderung): 5 parallele Recherche-Durchläufe (RPE/Autoregulation, Deload/Periodisierung, Aufwärmen, Wiedereinstieg nach Pause, Volumen-/Frequenz-Verteilung), 19 Coach-Schwellenwerte gegen aktuellen Sportwissenschafts-Konsens geprüft. 5 konkrete Handlungskandidaten identifiziert, wichtigster: Wiedereinstiegs-Reduktion bei >56 Tagen Pause (aktuell −25%) liegt deutlich unter dem Konsens (~−50%). Auch ein codeseitiger (nicht wissenschaftlicher) Nebenfund: zwei koexistierende, unterschiedliche Deload-Mechanismen (Gewichts- vs. Satz-Reduktion). Ein Rechercheversuch fing sich selbst beim Zitieren eines nicht existenten NSCA-Positionspapiers ab (KI-Suchzusammenfassung, gegen Originalquelle verifiziert und verworfen) — Beleg für den Wert der Verifikations-Methode selbst. Freigabe der 5 Handlungskandidaten durch den Nutzer steht noch aus, siehe Zusammenfassung in `WISSENSCHAFTS-AUDIT.md`. Davor: Cluster 8 (Runde 19s zurückgestellter Punkt) abgeschlossen, aufgeteilt: Teil 1 umgesetzt (Tage-Übersicht Kacheln → volle-Breite-Zeilen, B233, train-v244), Teil 2 (Übersicht als Startbildschirm) nach echtem Umsetzungsversuch bewusst zurückgestellt — brach bereits bei einer 3-Datei-Stichprobe den Kern-Smoke-Test + Großteil von `session_coach.spec.js`, da praktisch jeder Tages-Interaktionsablauf voraussetzt, dass ein Tag beim Laden automatisch offen ist; Änderung sofort revertiert, siehe DECISIONS.md-Eintrag 2026-08-09 für volle Begründung + Nutzer-Entscheidung (aktuelles Verhalten bleibt, Idee bei Bedarf später als eigene gescopte Runde). Neuer Test `tests/day_overview_rows.spec.js` (kein bestehender Test deckte den manuellen Übersicht-Toggle vorher ab). Volle Suite (94 Dateien, gebatcht) grün. Davor: Runde 19 (UI-/UX-Fix-Sammelrunde, Basis: dieselbe Live-Nutzerfeedback-Sammlung wie Runde 18, siehe `Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde19.md`; 4 file-disjunkte parallele Bundles A/B/C/E nach UI-Region statt nach Datei gruppiert, da fast jeder Cluster ui.js betraf — Cluster 8 Home-Screen-Redesign bewusst zurückgestellt, noch offen): 12 Fixes, train-v243 (B221-B232). Session-Coach "Übernehmen"-Textpille → Haken/X-Icons mit 44px-Touch-Target (B221); Pausenzeit-Automatik bei Default-Einstellung, manuelle Übungs-Pausenzeit overrult weiterhin (B222); "Ton nach Pause" war seit Runde 17 ein echter, unbemerkter Bug (Key fehlte in Settings-Defaults/migrate(), kein Browser-Limit wie beim analogen Vibrations-Fall) (B223). CSV-Export-Duplikat entfernt (B224); Bestleistungen zeigt jetzt Wdh-PR für gewichtslose Übungen + Sätze/Wdh/Datum-Detailebene (B225); Übungsfortschritt startet auf Favorit statt alphabetisch (B226); Erkenntnisse-Scroll-Jump-Bug diesmal wirklich behoben (ein früherer Fixversuch "Fix 4b" hatte es nicht vollständig gelöst) (B227); Körpergewicht-Chart zeigt relative Zeitangaben statt KW + Label-Overlap-Fix in allen 3 Chart-Funktionen (B228). Gamification-Reste (Streak-Punkte-Kette + Abzeichen-Galerie) endgültig entfernt, train-v150s Cleanup zu Ende geführt (B229); Wochenrückblick-Share bietet jetzt "beste Übung" ODER "Zusammenfassung" (B230). Coach-Tab: Wochen-Stempel ergänzt, bereits vorhandene aber ungetestete onTrack-Formulierungsrotation jetzt mit Tests abgesichert (B231). Eigener Nebenfund bei der Verifikation (nicht ursprünglich Teil der 12 Cluster): Backup-Reminder-Toast hing an document.body statt #app — da #app `position:fixed` hat (erzeugt IMMER einen eigenen Stacking-Context), konnte der Toast über JEDEM offenen Modal rendern und dessen Buttons blockieren; B230s höheres Wochenrückblick-Modal machte diesen bereits länger bestehenden Bug zuverlässig reproduzierbar (vorher der Grund für den dokumentierten `deload_volumen.spec.js`-Flake) — jetzt an #app gehängt + z-index gesenkt, behebt beide Fälle dauerhaft (B232). Volle Regressionssuite (93 Spec-Dateien, gebatcht) grün bis auf den bereits bekannten, dokumentierten `share_image.spec.js`-Download-Timing-Flake und die bereits dokumentierte Batch-Parallel-Timing-Flakiness von `settings_combination_smoke.spec.js` Szenario 20 (beide unabhängig von diesem Sprint, in Isolation/Retry grün). Zwei Tests aus Bundle A/C hatten anfangs eigene Testcode-Bugs (fehlendes `page.goto()` vor `seed()`, falscher Tab-Switch-Selektor, CSS-`text-transform:uppercase` bei case-sensitivem Textvergleich) — bei der Konsolidierung gefunden und gefixt, keine App-Regressionen. Davor: Runde 18 (Vertrauens- & Datenintegritäts-Bugcluster, Basis: externes Advisor-Feedback ChatGPT/Gemini/Council + neues Live-Nutzerfeedback, diagnostiziert von 5 parallelen Diagnose-Durchläufen, siehe `Diagnose & Sprints/diagnose-runde18-vertrauensbugs-2026-08-08.txt`, umgesetzt von 3 file-disjunkten Implementierungs-Durchläufen): 8 Fixes, train-v242 (B213-B220). Wochenrückblick: KW-Label-Konsolidierung, UTC-Rollover-Bug bei Tage-Zähler/"verpasste Tage" behoben (Wiederauftreten eines bereits zweimal gepatchten Antimusters), widersprüchliche Zwei-Signal-Empfehlungen zur selben Übung werden jetzt verschmolzen (B213-B215). Timer startet nicht mehr lautlos durch bloßes Antippen des Aufwärmfelds ohne echte Eingabe (B216). Auto-Steigerung: Confirmed-Flag wird jetzt auf ALLE Tages-Instanzen einer mehrfach pro Woche vorkommenden Übung geschrieben, nicht nur die erste (B217; die im selben Cluster diagnostizierte Substitutions-Historien-Verknüpfung wurde per Nutzer-Entscheidung bewusst NICHT gebaut, Histories bleiben pro Übungsname getrennt). Decision Logging feuert jetzt auch bei hoher Konfidenz-Progression (vorher nur mittel), bestehender Track-Record-Satz aus dem Coach-Tab-Collapse in eine dauerhaft sichtbare Zeile verschoben (B218). "Heute anders" setzt jetzt automatisch skipReason=substituted, verhindert wiederholte Nachfrage nach bereits ersetzten Übungen — andere Skip-Gründe (Verletzung/Müdigkeit/Zeit) fragen bewusst weiterhin jede Woche nach (B219). Schlaf/Energie-Doppelabfrage nach Sessionende entfernt, wenn Pre-Session-Check-in bereits beantwortet wurde (Ableitung numerischer Werte aus der kategorialen Antwort); die vorgeschlagene neue "Energie verändert?"-Frage wurde bewusst NICHT gebaut (redundant zum bestehenden `detectSessionFatigue()`-Signal) (B220). Volle Regressionssuite (89 Spec-Dateien, gebatcht wegen der dokumentierten Windows-EMFILE-Grenze) grün bis auf den bereits bekannten, dokumentierten `share_image.spec.js`-Download-Timing-Flake (grün bei Retry, wie immer). Davor: Externes Produkt-Briefing (`Diagnose & Sprints/TRAIN-Produkt-Briefing-Extern.txt`, gitignored) für eine unabhängige Einschätzung außerhalb des TRAIN-eigenen LLM-Council-Setups erstellt — keine Code-Änderung, siehe eigener Abschnitt unten, 2026-08-04. Davor: Runde 17 (vier unabhängige Live-Nutzerfeedback-Punkte): "Plain Mode"-Preset (6 Settings auf einen Klick), Vibrations-Bug als strukturelle Browser-Einschränkung eingeordnet + neue Sound-Alternative ("Ton nach Pause"), Plate-Settings (Stangengewicht/Größte Hantelscheibe) nebeneinander statt untereinander, Onboarding-Plan wird automatisch zur Standard-Vorlage, train-v241 (siehe eigener Abschnitt unten, B209-B212). Davor: Runde 16 (Launch-Roadmap Phase C, Umsetzung): Settings-Restrukturierung (Ziele-Karte, 3 native Dialoge auf In-App-Panels umgestellt, Datenschutz/Impressum-Collapse vereinheitlicht), 2 seit Runde 6 tote Funktionen wiederhergestellt (edit-day-field, autofill-rpe) inkl. Entfernung einer dabei entdeckten neuen Redundanz (day-rename), 6 tote Case-Handler entfernt, train-v240 (B206-B208). Davor: Launch-Roadmap Phase C, Inventar-Teil (UX-/Feature-Bestandsaufnahme, keine Umsetzung) + kleine AGENTS.md-Testkonvention-Ergänzung, train-v239. Davor: Launch-Roadmap Phase B (Stabilitäts-Baseline), train-v239. Davor: Launch-Roadmap Phase A (Verifikation), train-v238. Davor: Runde 15 (Nutzerfeedback: Tag löschen, Plate-Setting, Körper-Tab), train-v237. Davor: Runde 14 (Coach-Signal-Governance), train-v236. Davor: Runde 13 (Council-Umsetzung B62+B140), train-v235. Davor: Runde 12 (Backlog-Aufräumrunde), train-v234 (B41/B42/B58/B139-Nebenfund/B179-Nebenfund abgeschlossen). Davor: Runde 11, train-v233 (B199, Update-Banner "Später"-Button). Davor: Runde 10 komplett (Teil 1 + Teil 2), train-v232 (B191-B198, B141/B176-Abschluss). Davor: Runde-9-Audit-Folgerunde, train-v230 (B185-B190, siehe AUDIT-BERECHNUNGEN.md). Davor: Runde-8-Datenkonsistenz-Sprint, train-v229. Davor: Runde-7-Coaching-Qualitäts-Sprint, train-v228. Davor: Runde-6-Nutzerfeedback-Fix-Sprint, train-v227. Davor: Runde-5-Fix-Sprint, train-v226. Ältere Sprints siehe SESSION_LOG.md.*
*Nächster Schritt: Product Manual (`Diagnose & Sprints/TRAIN-Product-Manual.md`,
2026-08-15) UND Solotest-Checkliste (`Diagnose & Sprints/TRAIN-Solotest-Checkliste.md`,
2026-08-16, train-v247-Stand nach Runde 20+21) sind fertig. Nutzer arbeitet die
Checkliste jetzt manuell ab (11 Abschnitte, inkl. gezielter Regressions-Punkte zu
B237-B245 und Verweis auf die 4 Geräte-only-Punkte in `TRAIN-Pre-Launch-Checkliste.md`).
Erst nach diesem Solotest Betatest-Personen-Akquise (Phase G). Phase G selbst
wartet weiterhin auf den Nutzer (Testpersonen gemäß `TRAIN-Phase-G-Betatest-Plan.md`
finden + einladen, idealerweise nach einem kurzen Phase-F-Gerätetest). Trainingsidentität-Epos-Scoping folgt erst NACH dem Betatest-Feedback (das Feedback könnte den Scope ohnehin verschieben, siehe Advisor-Feedback-Synthese Tier 2C) — inkl. der offenen Produktfragen "sind alle Entscheidungen abgedeckt"/"welche Erkenntnisse fehlen" aus dem Runde-18/19-Live-Feedback. `WISSENSCHAFTS-AUDIT.md`-Handlungskandidaten sind bis auf einen abgeschlossen (#2 Konfidenz-Einstufungs-Logik bleibt offen, Kandidat für eine künftige Runde, keine Eile). Externes Produkt-Briefing wartet weiterhin auf Rückmeldung von der externen Einschätzung (Cowork/anderer Reviewer) — danach ggf. weitere Sprint-Punkte aus den beantworteten 5 Fragen. **Launch-Roadmap Phase C + Phase D sind laut `Diagnose & Sprints/TRAIN-Launch-Roadmap.md` vollständig abgeschlossen** (Phase D von Cowork als durch Runde 16s eigene Verifikation abgedeckt markiert — Runde 17 ist reines neues Live-Feedback, keiner Roadmap-Phase zugeordnet). Aus Runde 13 weiterhin offen: zwei NICHT code-seitig lösbare B62-Punkte (Rechts-Check vor Release zu Service-Worker-Caching; PWA-Installierbarkeit auf echtem Android-Gerät nach nächstem Release manuell verifizieren, siehe DECISIONS.md). Danach: B55 Impressum bleibt der einzige echte Blocker (wartet weiterhin auf echte Name-/Adress-/E-Mail-Angaben des Betreibers, siehe LEGAL.md). Aus dem Backlog-Review weiterhin offen (siehe `backlog-review-2026-08-03.txt`): B43 (CUSTOM_EX_DELETE räumt Kategorie nicht auf), B27 (Touch-Drag auf echtem Gerät), B66 (Toast nicht reproduzierbar, Observability wartet auf nächste Beobachtung), B173-Nebenfund (Wochen-Rec-Chip ohne Wdh-Reduzierung), VACATION_PLANS-Nebenfund aus B184 (Urlaubstage ohne Muskelgruppen-Tags), B176 (Portal-Refactor, zuletzt in Runde 10 bestätigt zurückgestellt). Bestätigte Infra-Grenze (Runde 20/2026-08-15 erneut reproduziert, nachdem sie seit Runde 13 nicht mehr auftrat): volle Playwright-Suite (475 Tests) lässt `npx serve` zuverlässig mit `EMFILE` beim Öffnen von `dragdrop.js` abstürzen, kaskadiert danach zu `ERR_CONNECTION_REFUSED` über den Großteil der restlichen Tests — Workaround ist der Batch-Lauf (9 Batches à 10 Dateien liefen in Runde 20 durchgehend stabil), bei Verdacht auf Massenausfall in Isolation nachprüfen. Bekannte, wiederholt bestätigte Timing-Flakes (unabhängig von jeglichem Sprint-Code, alle bei Retry/Isolation grün): `share_image.spec.js`/`share_image_v3.spec.js` (Download-Event-Timing), `plate_calculator.spec.js` (Live-Vorschau erster Tastendruck), `settings_combination_smoke.spec.js` Szenario 20 (Timing unter Batch-Parallel-Last, in Isolation bestätigt grün). `deload_volumen.spec.js`s Backup-Reminder-Toast-Overlap-Flake seit Runde 19/B232 KEIN Flake mehr — echte Root Cause (Stacking-Context-Bug) gefunden und behoben, aus dieser Liste entfernt. Nicht committet: `Research/`, alle `context-exports/`-Updates + `Diagnose & Sprints/`-Exports (beide gitignored).*

---

## Externes Produkt-Briefing (2026-08-04, keine Code-Änderung)

Basis: `Diagnose & Sprints/TRAIN-Externes-Produkt-Briefing-Auftrag.md`.
Eigenständig lesbares Briefing-Dokument für eine unabhängige Einschätzung
zu Konzept, Umsetzung und Retention/Nutzenmaximierung — Zielgruppe kennt
das Projekt noch nicht, kein internes Prozessdokument (keine Bug-Nummern,
kein AGENTS.md-Bezug, kein Quellcode-Dump).

Abschnitte 1/3/4/9/10 wörtlich von Cowork übernommen. Abschnitt 2
(Zielgruppe) gegen den echten Onboarding-Code geprüft und um eine
Präzisierung ergänzt (Erfahrungslevel "Anfänger" ist onboardbar, der
Kernwert der App setzt aber typischerweise einige Wochen Trainings-
Historie voraus). Abschnitte 5-8 vollständig aus der echten Codebasis
befüllt, nicht aus der Diagnose-Historie geraten: vollständige
Feature-Übersicht pro Tab (inkl. aller 7 Coach-Struktursignale und der
8-stufigen Fokus-der-Woche-Kaskade, exakt aus weeklyFocus.js), explizite
Retention-Mechanismen-Liste (inkl. des Nebenfunds, dass die automatische
Abzeichen-Vergabe im Code vollständig vorhanden, aber seit einem früheren
Cleanup-Sprint bewusst eingefroren ist — kein aktiver Retention-Hebel mehr,
für die externe Einschätzung relevant), vollständige Settings-Kategorien,
aktueller Stand (Entwicklungsdauer, Testsuiten-Größe als Qualitätsindikator).

Datei: `Diagnose & Sprints/TRAIN-Produkt-Briefing-Extern.txt` (gitignored,
nicht committet). Kein CACHE_VERSION-Bump, kein BUGS.md-Eintrag (reine
Dokumentation, keine Code-Änderung).

---

## Runde 17 — Vier Live-Nutzerfeedback-Punkte (train-v241, 2026-08-04)

Basis: `Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde17.md`. Vier
unabhängige, parallelisierbare Cluster, Diagnose+Plan im Plan-Mode
präsentiert und vom Nutzer bestätigt vor der Umsetzung.

**Cluster 1 (B209) — "Plain Mode"-Preset:** neue Karte im Settings-Tab
(vor der "Training"-Gruppe), Klick dispatcht 6 bestehende Settings auf
einmal (Session Coach/RPE-Anzeige/Streak-Anzeige/Stoppuhr AUS, "Steigerungen
vorschlagen"/"Wochenrückblick zuerst zeigen" AUS) — kein neuer Modus-Flag,
Einzel-Toggles bleiben danach änderbar. Master "Automatische
Wochenerstellung" bleibt bewusst AN (nur die Subs werden deaktiviert,
siehe DECISIONS.md für die Begründung). Rein abgeleiteter "aktiv"-Indikator,
keine Persistenz.

**Cluster 2 (B210) — Vibrations-Bug + Sound-Alternative:** Root Cause
diagnostiziert und als strukturelle Browser-Einschränkung eingeordnet
(`navigator.vibrate()` feuert aus einem `requestAnimationFrame`-Loop weit
außerhalb jedes User-Activation-Fensters) — bewusst NICHT "repariert", da
technisch nicht zuverlässig lösbar. Stattdessen neue Sound-Alternative
("Ton nach Pause", additives `soundEnabled`-Setting): Web-Audio-Beep via
`_playPauseEndSound()` (timer.js), `AudioContext` wird proaktiv beim
Pausenstart (echter Klick-Kontext) unlocked statt erst beim Sound selbst —
umgeht damit genau das Aktivierungsproblem der Vibration.

**Cluster 3 (B211) — Plate-Settings nebeneinander:** "Stangengewicht" +
"Größte verfügbare Hantelscheibe" in einen gemeinsamen `.body-grid`-Wrapper
(bestehendes, bis dahin ungenutztes CSS-Muster) — ab 480px zweispaltig,
darunter weiterhin gestapelt (Platz reicht sonst nicht für die 3er-Pill-
Reihe).

**Cluster 4 (B212) — Onboarding-Autosave:** der beim Onboarding gewählte
Plan wird jetzt automatisch zur Standard-Vorlage (`A.TPL_SAVE`, NICHT
`save-named-template` — letzteres hätte nur einen zusätzlichen benannten
Eintrag angelegt, nicht die für automatische Wochenerstellung/"Woche
zurücksetzen" tatsächlich verwendete `state.customTemplate` geändert).
Bewusst NUR beim "Vorlage laden"-Pfad, nicht bei "Ohne Vorlage starten".

**Tests:** 9 neue Tests (`tests/runde17_live_feedback.spec.js`), Cluster 2/4
über echte Klick-Pfade (AGENTS.md-Realpfad-Regel), Web-Audio-API für den
Sound-Test via `page.addInitScript()` gemockt (kein echtes Audio-Hardware-
Erfordernis). Volle Regressionssuite (85 Spec-Dateien, gebatcht) grün.

CACHE_VERSION → `train-v241`. styles.css `?v=214→215`. Kein
Launch-Roadmap-Bezug (reines Live-Feedback).

---

## Runde 16 — Launch-Roadmap Phase C, Umsetzung (train-v240, 2026-08-04)

Basis: `Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde16.md`, aufbauend auf
`diagnose-phase-c-inventar-2026-08-04.txt`. Zwei bereits getroffene
Nutzer-Entscheidungen vorab: verlorene Funktionen wiederherstellen statt
entfernen; Trainingsziel/Ernährungsphase bekommen eine eigene Settings-Karte
(Option A — bewusst KEIN Coach-Tab-Duplikat).

**Kickoff-Klärung (per git blame, nicht geraten):** `toggle-day-menu`,
`day-edit-note` und der ursprüngliche `edit-day-field`-Trigger waren alle
Teil derselben, in Runde 6 (B169) entfernten `renderDayCard()`-Komponente —
die Case-Handler blieben dabei unbereinigt zurück. Cluster 2 und 3 waren
dadurch NICHT voneinander abhängig (Cluster 2 lehnt sich an den
ursprünglichen 2.3-Ansatz an, keine Wiederbelebung des alten Menüs).
Zusätzlicher Fund: die offene Tagesansicht zeigte Titel/Subtitle seit B169
gar nicht mehr an — Wiederherstellung brauchte daher einen neuen Header in
`renderDayBody()`, nicht nur einen zurückgehängten Klick-Handler.

**Cluster 1 (Settings-Restrukturierung, B206):** Trainingsziel/
Ernährungsphase in eigene "Ziele"-Karte vor der Training-Karte verschoben.
"Woche zurücksetzen"/"Original wiederherstellen"/"Als Vorlage speichern"
von nativen `confirm()`/`prompt()` auf das etablierte In-App-Inline-Panel-
Muster umgestellt (wie "Alle Daten löschen"). Datenschutz/Impressum-Collapse
von eigenem `onclick`-Toggle auf `<details>` umgestellt, analog zum
Deload-Faktor-Abschnitt.

**Cluster 2 (tote Funktionen wiederhergestellt, B207):** `edit-day-field`
(Tag-Titel/-Subtitle-Inline-Umbenennung) und `autofill-rpe` (Pendant zum
weiterhin aktiven `autofill-down`) über echte, sichtbare Trigger wieder
erreichbar gemacht — beide Reducer existierten unverändert. **Ungeplante
Redundanz entdeckt und per Rückfrage aufgelöst:** das Wochen-Menü hatte
bereits ein live funktionierendes "Tag umbenennen" (`day-rename`, natives
`prompt()`, nur Titel) — entfernt zugunsten der neuen Inline-Bearbeitung
(deckt Titel+Subtitle ab, kein natives `prompt()`), inkl. `A.DAY_RENAME`-
Reducer (state.js). Siehe DECISIONS.md, Eintrag 2026-08-04.

**Cluster 3 (toter Code entfernt, B208):** `toggle-day-menu` +
`_dayMenuOpenKey` (komplettes System, inkl. 6 defensiver Rücksetzungen in
anderen, weiterhin aktiven Case-Handlern + verwaiste CSS-Klasse
`.day-menu-wrap`), `set-session-rating` (superseded durch
Tagesabschluss-Modal), `day-edit-note` (Notizfeld bereits direkt
editierbar), `create-week-prev`/`create-week-template` (fielen bereits auf
`_createWeek()` durch), `set-rpe` ohne Suffix (abgelöst von `set-rpe-val`).

**Tests:** 9 neue Tests (`tests/runde16_phase_c_umsetzung.spec.js`) über
den echten Klick-Pfad (AGENTS.md-Realpfad-Regel — beide wiederhergestellten
Funktionen waren vorher unerreichbar). 6 bestehende Tests in
`tests/template_management.spec.js` auf die neuen Inline-Panels umgestellt,
inkl. Regressionswächter dass native Dialoge nicht mehr feuern. Volle
Regressionssuite (84 Spec-Dateien, gebatcht wegen EMFILE-Grenze) durchgehend
grün, keine Nebenwirkungen gefunden.

CACHE_VERSION → `train-v240`. styles.css `?v=213→214`. Launch-Roadmap
Phase C vollständig abgeschlossen (Status-Tabelle + Abschnitt in
`Diagnose & Sprints/TRAIN-Launch-Roadmap.md` aktualisiert).

---

## Launch-Roadmap Phase C — Inventar-Teil + AGENTS.md-Testkonvention (train-v239, 2026-08-04)

Basis: `Diagnose & Sprints/TRAIN-Phase-C-Inventar-Auftrag.md`. Zwei
unabhängige Teile, keine Code-Änderung außer AGENTS.md/DECISIONS.md.

**Teil 1 (klein):** neue dauerhafte AGENTS.md-Regel ("TEST-KONVENTION:
Echte Interaktionspfade für Validierungs-/Gatekeeper-Logik"), abgeleitet
aus B202 (Runde 15) + B205 (Phase B) — beide Bugs wurden ausschließlich
gefunden, weil ein Test den echten Interaktionspfad (echter Klick, echter
Datei-Upload) ausübte statt Daten direkt in State/localStorage zu
injizieren. Kurzer Vermerk zusätzlich in DECISIONS.md unter PROZESS.

**Teil 2 (Hauptauftrag, reine Bestandsaufnahme):** vollständiger
Ist-Zustand-Bericht in `diagnose-phase-c-inventar-2026-08-04.txt` —
explizit KEIN Redesign-Vorschlag, KEINE Umsetzung (das ist Coworks
nächster Schritt). Settings-Tab vollständig kartiert (18 Settings in
einer Karte über 4 Gruppen, plus 6 separate Karten). Die anderen 4 Tabs
auf gleicher Flughöhe kartiert. Hauptfund zur Auffindbarkeit: Übungs-
Einstellungen (⚙️) liegen zweistufig verschachtelt hinter einem
Kontextmenü (⋮-Menü → Einstellungen → "Erweitert"), bewusst so gebaut.
Systematische Redundanz-Prüfung (nicht nur bereits gemeldete Fälle, alle
`data-action`-Werte gegen alle `case`-Handler abgeglichen): keine neue
Mehrfach-Trigger-Redundanz über den bekannten "Tag löschen"-Fall (B201)
hinaus, aber 6 tote/verwaiste Case-Handler in ui.js gefunden und
klassifiziert — 3 vollständig unerreichbare Funktionen ohne Alternativpfad
(`edit-day-field`: Tag-Titel-Inline-Umbenennung; `autofill-rpe`:
RPE-Wert-Übernahme, Pendant zum weiterhin lebendigen `autofill-down`;
`toggle-day-menu`+`_dayMenuOpenKey`: komplettes totes Kontextmenü-System),
2 verwaiste Setter mit weiterhin lebendigem Alternativpfad
(`set-session-rating` → ersetzt durch die Tagesabschluss-Modal-Bewertung;
`day-edit-note` → das Notizfeld ist ohnehin direkt sichtbar/editierbar),
1 harmloses totes Case-Label-Paar (`create-week-prev`/`create-week-
template`, fallen auf dieselbe Implementierung wie das aktive
`create-week` durch). Bereinigung dieser Fundstellen bewusst NICHT Teil
dieses Auftrags.

Keine CACHE_VERSION-Bump nötig für den Inventar-Teil selbst (reine
Dokumentation) — CACHE_VERSION bleibt bei `train-v239` (letzter
Code-tragender Stand aus Phase B).

---

## Launch-Roadmap Phase B — Stabilitäts-Baseline (train-v239, 2026-08-04)

Basis: `Diagnose & Sprints/TRAIN-Phase-B-Stabilitaets-Testszenarien.md` (25
Szenarien über 7 Kategorien von Claude Cowork). Voller Bericht in
`diagnose-phase-b-stabilitaet-2026-08-04.txt`. Nicht alle 25 blind in
Tests umgesetzt (wie vorgegeben) — pro Punkt zuerst Diagnose, dann gezielt
Tests nur für echte Lücken.

**1 echter Bug gefunden + gefixt (B205):** `backup.js` `importJSON()`
lehnte sehr alte, legitime Backups (vor SCHEMA 6, ohne `meta.schemaVersion`/
`settings`) über den ECHTEN Restore-Pfad hart als "Ungültiges Backup" ab —
obwohl `state.js` `migrate()` sie längst korrekt verarbeitet (derselbe
Fixture-Inhalt migriert über den localStorage-Boot-Pfad in
`tests/migration_matrix.spec.js` bereits erfolgreich). Root Cause: eine
Verschärfung von Mitte Juni (Commit ccd22d5) ging über ihr eigentliches
Ziel hinaus; der ursprüngliche Kommentar davor lautete wörtlich "warn but
still import (migrate() will handle it)". Fix kehrt zu dieser Philosophie
zurück: fehlendes `settings` wird auf `{}` normiert, fehlende
`schemaVersion` gilt als v0. **Wichtiger methodischer Befund:** ALLE
bisherigen Migrations-Tests injizierten `localStorage` direkt und umgingen
`backup.js` komplett — der echte Restore-UI-Pfad war vor diesem Fund nur in
einem einzigen Test überhaupt geprüft. Genau die Art Blindspot, die Phase B
finden sollte.

**4 echte Test-Lücken geschlossen, kein weiterer Bug gefunden** (bestehende
Guards hielten in allen 4 Fällen):
- Mehrere Struktursignale gleichzeitig (`tests/coach_multi_signal_collision.spec.js`) — Deckelung auf max. 2 + Priorität bestätigt.
- Alle optionalen Settings gleichzeitig AUS/AN (`tests/settings_combination_smoke.spec.js`) — kein Crash, kein Interaktions-Bug.
- Negatives Gewicht (`tests/input_floor_guards.spec.js`) — B144s Reducer-Floor war nie dediziert regressionsgesichert.
- Session Coach aktuell deaktiviert, aber historische Daten (`tests/body_tab_sleep_quality_insight.spec.js`, +1 Test) — Erkenntnis bleibt korrekt sichtbar.

Restliche Szenarien (v.a. niedrige Priorität: Datenvolumen, Eingabe-
Grenzwerte, Datums-Grenzfälle) bewusst nicht vertieft geprüft — kein
Hinweis auf reales Risiko in den bestehenden Code-Pfaden gefunden.

CACHE_VERSION → `train-v239`. Volle Regressionssuite (83 Spec-Dateien,
~409 Tests) grün bis auf die bekannten Flakes (siehe Top-Absatz).
BUGS.md (B205) aktualisiert.

---

## Launch-Roadmap Phase A — Verifikation (train-v238, 2026-08-04)

Basis: `Diagnose & Sprints/TRAIN-Launch-Roadmap.md` (neues lebendes
Master-Dokument für den Weg zum Launch, 8 Phasen) +
`TRAIN-Phase-A-Verifikations-Auftrag.md`. Voller Bericht in
`diagnose-phase-a-verifikation-2026-08-04.txt`.

**Teil 1 (Prioritäts-Fund, ausnahmsweise direkt gefixt, B204):** Nutzer
meldete, das "Warum"-Aufklapp-Feld eines Coach-Struktursignals zeige
denselben Text wie der Haupttext. Bestätigt per systematischer Prüfung
ALLER 6 Struktursignale (nicht nur des gemeldeten) + `git blame`: eine
echte, aber ISOLIERTE Regression aus dem Runde-14-Commit — der
Deload-Haupttext bekam damals alle 3 Rohwerte (weeksSince/Volumentrend/
Ø-RPE) wörtlich, ohne dass die seit v215 (E1-Feature) bestehende
`evidence`-Liste angepasst wurde, die exakt dieselben 3 Werte zeigt. Fix:
`evidence` zeigt jetzt stattdessen den Auslösegrund (welche Bedingung —
Volumen und/oder RPE — den Trigger auslöste), eine echte Zusatzinfo statt
Wiederholung. Bestehendes AC7 (E1-Feature, "Disclosure muss vorhanden
sein") bewusst NICHT gebrochen — Disclosure bleibt, Inhalt wurde
korrigiert statt entfernt.

**Teil 2 (systematischer Verifikations-Pass, reiner Bericht):** alle 8
übrigen geprüften DECISIONS.md-Punkte aus Runde 13-15 bestätigt wie
dokumentiert — B62-Registrierungstrigger + Precache-Scope, B140-Beobachtungston,
B200-Cooldown-Werte (28/14/21/21) + 3-stufige Eskalation +
injury_reminder-/Plateau-Ausnahmen, B201-B203 — jeweils nicht nur per
Codelesen, sondern per aktiv laufenden Tests gegen echtes
Rendering-Verhalten gegengeprüft. Keine weiteren Abweichungen gefunden.

CACHE_VERSION → `train-v238`. Volle Regressionssuite (78 Spec-Dateien,
~402 Tests) grün bis auf den bereits mehrfach unabhängig bestätigten
`share_image.spec.js`-Flake (in Isolation sofort grün). BUGS.md (B204) /
Launch-Roadmap-Statustabelle aktualisiert.

---

## Runde 15 — Nutzerfeedback: Tag löschen, Plate-Setting, Körper-Tab (train-v237, 2026-08-04)

Basis: `Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde15.md`, drei
unabhängige Live-Nutzerfeedback-Punkte (2026-08-03). Keiner war vorab als
Bug bestätigt — alle drei zuerst diagnostiziert, Cluster 3 zusätzlich per
Rückfrage an den Nutzer entschieden (Sprint-Vorgabe: keine autonome
Entscheidung bei einer echten Datenerhaltungs-Frage).

- **Cluster 1 (B201):** "Tag löschen" war bereits EINE gemeinsame
  Implementierung (Wochen-Menü-Dropdown + Settings-Tab, beide über
  `remove-day`/`DAY_REMOVE`) — keine Konsolidierung zweier echter
  Implementierungen nötig. Der `wk.days.length<=1`-Guard ist bewusst
  korrekt. Echter Bug: Settings-Tab zeigte den Löschen-Button nur für den
  jeweils LETZTEN Tag und ließ ihn bei nur noch 1 Tag komplett
  verschwinden (statt disabled+erklärt wie im Dropdown) — genau das
  gemeldete "konnte den letzten Tag nicht löschen". Fix: Button erscheint
  jetzt bei jedem Tag, disabled+Tooltip statt Verschwinden bei 1 Tag.
- **Cluster 2 (B202):** `largestPlate`-Picker speicherte nie einen Wert.
  Root Cause per gezieltem Playwright-Repro + Kontrollvergleich gefunden:
  `case 'set-largest-plate'` lag in `_handleChange()` (reagiert nur auf
  `'change'`) statt `_handleClick()` — der Picker ist aber ein `<button>`,
  feuert nie `'change'`. Die `calcPlates()`-Filterlogik selbst war immer
  korrekt (bestehende Tests injizierten die Einstellung direkt in
  `localStorage`, übten den echten Klick-Pfad nie aus). Fix: Case-Block
  verschoben.
- **Cluster 3 (B203):** Körper-Tab "Schlaf & Energie" ist reine Anzeige
  (kein Eingabefeld — die Abfrage passiert beim Tagesabschluss). Nutzer
  wählte nach Vorlage von 2 Optionen explizit: Eingabe behalten, Anzeige
  aufwerten. Die bereits bestehende `calcSleepCorrelation()` (bisher nur
  einmalig im Session-Summary) läuft jetzt zusätzlich persistent im
  Körper-Tab, additiv neben der bestehenden Volumen-Korrelation — kein
  Datenverlust, auch nicht für Nutzer ohne aktivierten Session Coach.

**Tests:** 2 neue Tests in `tests/settings_reorg.spec.js` (Cluster 1), 1
neuer Test in `tests/plate_calculator.spec.js` (Cluster 2, echter Klick-Pfad
statt direkter State-Injektion), neue Datei
`tests/body_tab_sleep_quality_insight.spec.js` (3 Tests, Cluster 3).

CACHE_VERSION → `train-v237`. Volle Regressionssuite (80 Spec-Dateien, 400
Tests) in 8 Batches — alle grün, ein bereits bekannter
`share_image.spec.js`-Flake erholte sich im eingebauten Retry. BUGS.md
(B201-B203) / DECISIONS.md (Cluster-3-Produktentscheidung) aktualisiert.

---

## Runde 14 — Coach-Signal-Governance: Beobachtungston + generalisierter Dismiss (train-v236, 2026-08-03)

Basis: `Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde14.md` +
`TRAIN-Council-Entscheidung-Deload-Signal-2026-08-03.md`. Auslöser: Nutzer-
Feedback, dass das Deload-Signal seit Wochen unverändert ansteht und den
Coach-Tab nutzlos wirken lässt — vorab per `TRAIN-Deload-Signal-Diagnose-
Auftrag.md` (reine Faktensammlung) diagnostiziert, dann im Council
entschieden. 3 Cluster, sequenziell wie vorgegeben (Cluster 2 baut auf
Cluster-1-Infrastruktur auf, erst nach dessen Verifikation gestartet).

**Cluster 1 (Infrastruktur + Deload-Referenzumsetzung):** `weeklyFocus.js`
bekommt einen generalisierten, aber signal-spezifisch konfigurierbaren
Dismiss über das bereits bestehende `state.decisionLog` (additiv, kein
neues Datenmodell, kein SCHEMA-Bump) — `DISMISS_COOLDOWN_DAYS`-Lookup
(`preventive_deload`:28 Tage unverändert seit B131, `consistency_quality`:14,
`push_pull`:21, `recurring_fatigue`:21) + `_isDismissedRecently()`/
`_dismissTier()`. Deload-Haupttext auf reine Beobachtung umgestellt ("X
Wochen ohne Deload, Volumentrend Y / Ø-RPE Z" statt "...einplanen") — die
B140-Regel (Beobachtung als Default, Runde 13) gilt jetzt rückwirkend für
alle Struktursignale, Deload war die Abweichung, nicht die Norm. Empfehlung
wandert vollständig ins `<details>`-Aufklapp-Feld. Eskalierender
Re-Trigger-Text bei wiederholtem Dismiss (`_escalationPrefix()`, ui.js — 3
gedeckelte Stufen statt endlos wachsendem Text): das behebt den eigentlich
gemeldeten Effekt, nicht nur die fehlende Dismiss-Taste. Dismiss-Button +
Klick-Handler generisch gemacht (`item.dismissType`, `coach-signal-dismiss`
statt dem deload-exklusiven `decision-log-deload-stay`).

**Nebenentscheidung (technische Kalibrierungsfrage aus der Diagnose, vom
Council nicht explizit vorgegeben, siehe DECISIONS.md):**
`_checkPreventiveDeload()`s Volumen-Fenster von `computeVolumeTrend(state,4)`
auf `computeVolumeTrend(state,8)` verbreitert (4-vs-4 statt 2-vs-2 Wochen) —
die alte "volumeUp"-Bedingung war bei konsequent progressiv trainierenden
Nutzern strukturell fast dauerhaft erfüllt. Geprüft: `computeVolumeTrend()`
hat nur einen anderen Aufrufer (`ui.js` Fortschritt-Tab, eigenes `N`) — keine
Kollateralwirkung.

**Cluster 2 (Rollout, erst nach Cluster-1-Verifikation gestartet):**
generischer Dismiss + Eskalationstext auf `consistency_quality`,
`push_pull`, `recurring_fatigue` ausgerollt. `injury_reminder` bewusst
NICHT angefasst (Council: asymmetrisches Risiko). Plateau (Hauptkarte)
bewusst NICHT auf decisionLog umgestellt — behält sein granulareres,
selbstauflösendes `state.plateauActions`-Modell (siehe DECISIONS.md, kein
blindes Vereinheitlichen ohne Prüfung der Konsequenzen).

**Cluster 3 (Doku, parallel):** DECISIONS.md-Governance-Eintrag (Beobachtung
als Default-Ton, generalisierter Dismiss, injury_reminder-Ausnahme,
Plateau-Ausnahme, Kalibrierungs-Nebenentscheidung).

**Altbestand-Kompatibilität:** Deload nutzt weiterhin den historischen
decisionLog-`type`-Wert `'preventive_deload'` (nicht `sig.type`/
`'deload_preventive'`), damit bereits live gespeicherte B131-Dismiss-
Einträge echter Nutzer weiterhin greifen — beim ersten Implementierungs-
versuch fälschlich vereinheitlicht (Test schlug sofort fehl, da der
Dismiss-Button dann gar nicht mehr rendert), per Test aufgedeckt und
korrigiert, bevor es committet wurde.

**Tests:** `tests/coach_deload_dismissal.spec.js` um 3 Tests erweitert
(Beobachtungstext + kein "einplanen" im Haupttext, Empfehlung im Aufklapp-
Feld; Eskalations-Stufe 1; Eskalations-Stufe 2, gedeckelt) + bestehende
5 Tests an die neuen generischen Selektoren angepasst. Neuer
`tests/coach_signal_dismiss_rollout.spec.js` (7 Tests: Happy-Path +
Cooldown-Grenzfall je neu dismissbarem Signal + Regressionstest, dass
`injury_reminder` weiterhin keinen Dismiss-Button hat).

CACHE_VERSION → `train-v236`. Volle Regressionssuite (78 Spec-Dateien, 395
Tests) in 8 Batches gelaufen — alle grün bis auf den bereits seit vielen
Runden bekannten `share_image.spec.js`-Download-Event-Timing-Flake (PR-
Teilen-Button, per Stash-Vergleich gegen den Vor-Runde-14-Stand bestätigt
unabhängig von dieser Runde — schlägt identisch auf dem unveränderten
Baseline-Code fehl). BUGS.md (B200) / DECISIONS.md aktualisiert.

---

## Runde 13 — Council-Umsetzung B62 (Offline-Opt-in) + B140 (Coach-Eskalationssignal) (train-v235, 2026-08-03)

Basis: `TRAIN-Council-Entscheidung-B62-B140-2026-08-03.md` (volle LLM-Council-
Transkripte + Chairman-Entscheidungen), umgesetzt nach
`TRAIN-Sprint-Prompts-Runde13.md`. Die Produktrichtungsfrage war durch das
Council bereits geklärt — diese Runde war reine technische Umsetzung.
Diagnose bestätigte für beide Cluster state.js-Freiheit UND Disjunktheit
(Cluster 1: index.html/sw.js/timer.js; Cluster 2: weeklyFocus.js/ui.js) —
beide liefen daher ohne Solo-Vorlauf.

- **Cluster 1 (B62):** `registerServiceWorker()` wird nicht mehr
  unconditional beim Seitenaufruf ausgeführt, sondern erst wenn `timer.js`
  `_ensureSessionStart()` zum ersten Mal feuert (erste Trainingsaktion) —
  neues `train:sw-register-trigger`-Event, `index.html` als neutraler
  Vermittler (Kopplungsverbot `ui.js`↔`timer.js` bleibt gewahrt). Kurzer
  Hinweis-Toast beim ersten Auslösen ("TRAIN speichert dein Training lokal,
  damit es auch ohne Netz läuft."). Precache-Scope reduziert:
  `datenschutz.html` + 7 Badge-PNGs raus aus `sw.js`s `PRECACHE_URLS` (für
  die reine Trainingsausführung entbehrlich, werden bei Zugriff normal
  nachgecacht). **Zwei offene, nicht code-seitig lösbare Punkte in
  DECISIONS.md vermerkt** (Council-Vorgabe): Rechts-Review-Vorbehalt
  (keine gefestigte Behördenpraxis zu Service Workern) + neuer
  PWA-Installierbarkeits-Vorbehalt (Chrome-Homescreen-Kriterien könnten den
  SW-Check früh/einmalig auswerten) — beide warten auf manuelle
  Verifikation durch den Nutzer, siehe Top-Absatz.
- **Cluster 2 (B140):** neues Coach-Tab-Strukturkarten-Signal
  `recurring_fatigue` in `computeStructuralSignals()` (weeklyFocus.js),
  Priorität direkt nach `deload_preventive`. Erweitert (nicht ersetzt) das
  bereits bestehende, tagesskalierte `detectSessionFatigue()`
  (sessionSummary.js, seit B140/v222) — feuert neu, wenn dieses Muster in
  JEDER der letzten 3 konsekutiven Nicht-Deload/Nicht-Urlaub-Wochen an
  mindestens einem Tag auftritt (bewusst 3 konsekutive Wochen, nicht nur
  "irgendwann in den letzten 4", gegen Falsch-Positive). Haupttext bleibt
  reine Beobachtung ohne Ratschlag; optionaler Deload-Hinweis liegt im
  bestehenden `<details>`-Aufklapp-Feld, kein neuer Action-Handler.
  GoatCounter-Tracking der Falsch-Positiv-Rate (Council-Vorschlag) bewusst
  NICHT gebaut — als offene Zukunftsoption in DECISIONS.md vermerkt, kein
  MVP-Bedarf.

**Tests:** 2 neue Spec-Dateien (`tests/sw_deferred_registration.spec.js`,
2 Tests; `tests/recurring_fatigue_signal.spec.js`, 3 Tests — No-DOM-Unit-Test
direkt gegen `computeStructuralSignals()`), 1 bestehender Test angepasst
(`tests/sw_update_and_version.spec.js` — ein Test hing direkt an
`navigator.serviceWorker.ready` unmittelbar nach dem Laden, feuert jetzt
zusätzlich das Trigger-Event vorher). Zusätzlich ad-hoc per Playwright
verifiziert (nicht Teil der committeten Suite, reine Verifikation): App
scheitert offline VOR der ersten Trainingsaktion (kein SW registriert —
das ist jetzt das gewünschte Verhalten), funktioniert offline NACH der
ersten Trainingsaktion (SW aktiv, `navigator.serviceWorker.controller`
gesetzt, App bootet aus dem Cache).

CACHE_VERSION → `train-v235`. Volle Regressionssuite (77 Spec-Dateien,
385 Tests, 8 Batches à ~10 Dateien) — alle grün im ersten Anlauf, keiner der
sonst bekannten Timing-Flakes trat auf.

---

## Runde 12 — Backlog-Aufräumrunde (train-v234, 2026-08-03)

Basis: `backlog-review-2026-08-03.txt`. 7 Cluster, alle abgeschlossen.

- **Cluster 1 (Doku-Hygiene):** B56/B141 aus `## OFFEN` nach `## BEHOBEN`
  verschoben (waren bereits gelöst, standen aber noch als offen da); B19/B20
  als Duplikate von bereits woanders dokumentierten Entscheidungen entfernt.
- **Cluster 2 (B42, obsolet):** repo-weiter Grep bestätigt alle 3
  `lastBackupDate`-Schreibstellen (`backup.js:48/70/331`) nutzen
  konsistent `Date.now()` — die ursprüngliche Typ-Inkonsistenz existiert
  nicht mehr, geschlossen.
- **Cluster 3 (B58):** `fonts/OFL.txt` ergänzt, Copyright-Text für Bebas
  Neue + DM Sans direkt aus dem offiziellen `google/fonts`-GitHub-Repo
  geholt (`gh api`), nicht aus dem Gedächtnis rekonstruiert.
- **Cluster 4 (B179-Nebenfund):** war bereits durch B190 (Runde 9)
  vollständig gelöst — nur eine stale BUGS.md-Notiz korrigiert, kein
  Code-Fix nötig.
- **Cluster 5 (B139-Nebenfund):** `getMetricRecommendation()` (Distanz/
  Zeit-Übungen) respektierte `nutritionPhase` nicht — Signatur + Aufruf
  um `isCompound`/`nutritionPhase` ergänzt (identisches Muster wie
  `getWeightRecommendation()`), beide `ui.js`-Aufrufstellen reichen jetzt
  die bereits berechneten Werte durch. Neuer Test, Sabotage-Revert
  bestätigt.
- **Cluster 6 (B41):** die `'variation'`-Plateau-Strategie war seit
  B184/B188 tatsächlich erreichbar geworden — per echter Test-Fixture
  verifiziert (nicht nur Code gelesen), liefert sinnvollen Text, kein
  neuer Folgefehler. Neuer Regressionstest sperrt das jetzt aktive
  Verhalten fest.
- **Cluster 7 (B21, NUR Bericht):** Aufwandsschätzung Media-Session-API-
  Integration dokumentiert (Mittel, state.js-frei, 3 konkrete
  Fallstricke) — keine Umsetzung, wie vorgegeben.

CACHE_VERSION → `train-v234`. Volle Regressionssuite (75 Spec-Dateien) in
8 kleinen Batches gelaufen — alle grün bis auf die 3 bereits bekannten
Timing-Flakes (siehe Top-Absatz), keine davon durch diese Runde verursacht.

---

## Runde 11 — Update-Banner "Später"-Button (train-v233, 2026-08-03)

`Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde11.md`. Auslöser: Live-Vorfall
(Nutzer meldete App bleibt auf alter Version hängen) — konkreter Root Cause
war ein nicht gepushter Deploy, unabhängig davon aber eine echte UX-Lücke
in der Live-Diagnose gefunden.

**Diagnose bestätigte:** Banner-Persistenz war bereits korrekt (B166,
Runde 5 — `registerSW.js:32-52` prüft `registration.waiting`/`.installing`
bei JEDEM Page-Load) und state.js ist NICHT beteiligt
(`_pendingSwRegistration` ist eine reine ui.js-Modul-Variable). Die
einzige echte Lücke: kein Dismiss-Mechanismus existierte überhaupt (der
Kommentar "kein Auto-Dismiss" war wörtlich zu nehmen).

**Fix (B199):** neuer `#sw-update-later-btn` ("Später") neben dem
bestehenden Update-Button, rein DOM-lokal (`classList.remove('is-visible')`
— kein state.js, kein localStorage, kein neuer Flag). `_pendingSwRegistration`
bleibt unangetastet. Da `_buildScaffold()` bei jedem Page-Load ein frisches
Banner-DOM baut und der bestehende B166-Mechanismus es erneut sichtbar
macht, solange `registration.waiting` gesetzt ist, ist keine zusätzliche
Persistenz nötig.

**Tests:** `tests/sw_update_and_version.spec.js` um 2 Tests erweitert
(Später-Klick blendet aus; Mehrere-Deploys-Szenario — Banner erscheint
nach "Später" bei einem weiteren Update erneut, "Jetzt aktualisieren"
zielt auf den NEUESTEN wartenden Worker). Beide per Sabotage-Revert
verifiziert.

CACHE_VERSION → `train-v233`. Volle Regressionssuite (73 Spec-Dateien) in
kleineren Batches gelaufen (der bisherige 3-Datei-Batch-Workaround reichte
diesmal nicht mehr aus, EMFILE-Grenze griff auch bei ~20-25 Dateien pro
Batch — Sub-Batches von ~10 Dateien liefen durchgehend stabil). Alle grün
bis auf 2 bereits bekannte Timing-Flakes (`deload_volumen.spec.js`,
`share_image_v3.spec.js` — beide unverändert, kein Zusammenhang zu diesem
Sprint, in Isolation/Retry bestätigt grün).

**Manueller Testschritt für den Nutzer (nicht automatisierbar, siehe
`TRAIN-Manueller-Update-Test.md`):** einen echten Deploy-Zyklus über
mehrere Versionen testen — Update-Banner erscheint, "Später" klicken,
warten bis ein weiterer echter Deploy live ist, App erneut öffnen: Banner
sollte wieder erscheinen und beim Klick auf "Jetzt aktualisieren" direkt
zur neuesten Version aktualisieren.

---

## Runde 10, Teil 2 — Aufräum-Runde (train-v231, 2026-08-03)

`Diagnose & Sprints/TRAIN-Sprint-Prompts-Runde10.md`, Teil 2, 5 Cluster.
Teil 1 (Zeit/Datum-Audit) separat dokumentiert in
`diagnose-runde10-zeit-datum-audit-2026-08-03.txt`, wartet auf Freigabe —
nur Domäne D floss direkt in Cluster 4 unten ein.

- **Cluster 1 (Doku):** B141 abgeschlossen als "nicht reproduzierbar nach 3
  unabhängigen Versuchen", kein weiterer Diagnoseversuch mehr geplant.
- **Cluster 2 (Cleanup, B191):** toter Code `save-week-as-template`
  entfernt (`ui.js`-Handler, `state.js`-Action-Konstante + Reducer-Case) —
  bereits in B177 (Runde 6) als unerreichbar erkannt, jetzt tatsächlich
  entfernt. Aktives `save-named-template`-Feature unberührt.
- **Cluster 3 (Doku):** B176-Portal-Entscheidung bestätigt — kein zweiter
  Stacking-Context-Vorfall seit Runde 6, Entscheidung bleibt
  "zurückgestellt bis zweiter Vorfall".
- **Cluster 4 (Test-Fix, B193):** 3 Wall-Clock-abhängige Testdateien
  (`streak_inprogress_week`, `week_label_calendar`,
  `session_coach_active_week`) auf `page.clock.install()` mit festem
  Referenzdatum umgestellt statt echtem `new Date()` zur Testlaufzeit —
  behebt den seit Runde 6 bekannten `streak_inprogress_week`-Flake
  strukturell. **Bei der Robustheits-Verifikation (Testlauf mit einem
  anderen Referenzdatum) zunächst fälschlich als App-Bug in
  `_calcCurrentStreak()` interpretiert — per `page.clock`-Sonde korrigiert:
  der echte Fehler lag in 2 Test-Helfern selbst** (`mondayOfWeek()`/
  `seedTwoWeekState()` bauten das Datum über `setHours(0,0,0,0)` dann
  `.toISOString()` — konvertiert nach UTC, liefert in Europe/Berlin (UTC+1)
  den falschen, einen Tag zu frühen Kalendertag). Fix: wie
  `week_label_calendar.spec.js`s bereits korrektes `isoMondayOffset()` auf
  lokale Datumskomponenten (`getFullYear()`/`getMonth()`/`getDate()`)
  umgestellt. Verifiziert mit zwei unterschiedlichen Referenzdaten (Montag
  und Sonntag/Jahresgrenze) — beide liefern jetzt das korrekte Ergebnis.
- **Cluster 5 (Mini-Feature, B192):** einmaliger Hinweis-Toast für die
  B185-Konsistenz-%-Rückwirkung, über das bestehende
  `seenTips`/`MARK_TIP_SEEN`-Muster (`tip-13`) — kein neues
  Infrastruktur-Stück, keine state.js-Änderung.

CACHE_VERSION → `train-v231` (JS-Änderungen in ui.js/state.js). Kein
CSS-Versions-Bump (styles.css unverändert). Alle neuen/geänderten Tests
grün (`template_management`, die 3 Cluster-4-Dateien,
`consistency_recalc_hint` — neu, 3 Tests), keine Regression in
`fixtures.spec.js`.

---

## Runde 10, Teil 1 — Zeit/Datum-Audit-Fixes (train-v232, 2026-08-03)

Nach der reinen Diagnose (`diagnose-runde10-zeit-datum-audit-2026-08-03.txt`)
hat der Nutzer alle 7 Funde zur Umsetzung freigegeben. A2 wurde nach
Rückfrage bewusst NICHT gefixt (kein aktueller Bug, siehe DECISIONS.md).
Die übrigen 6 (A1, B1-B3, C1 + der dabei gefundene B193) sind gefixt.

- **B194 (A1):** Zwei Kalenderwochen-Formeln ("KW N") vereinheitlicht —
  `ui.js`s `wkLabel()` nutzt jetzt `_isoWeek()` direkt, `backup.js`/
  `progressChart.js`/`weekReviewModal.js`/`weekReview.js` sowie `ui.js`s
  `_rotatedErkenntnisEntries()`/`wkNum` bekamen den korrigierten
  ISO-8601-Algorithmus (dupliziert, da diese Module `_isoWeek()` nicht
  importieren). Verifiziert per Node-Rechnung + 31 bestehenden Tests
  (`week_label_calendar`, `progress_chart_svg`, `share_image_*`,
  `weekreview_*`, `autobackup_toast`) weiterhin grün.
- **B195 (B1):** `_findRecentInjurySkipExercise()` (Session-Check-in-
  Zusatzfrage, B129) reproduzierte B147s ungefixtes Muster — auf das
  etablierte `todayNoon`-Muster umgestellt. Neuer
  `tests/injury_checkin_boundary.spec.js` (exakte 14-/15-Tage-Grenze,
  Sabotage-Revert bestätigt).
- **B196 (B2):** `_backupAgeInDays()` zeigte "Heute gesichert" statt
  "Vor 1 Tag" bei einem Backup kurz vor Mitternacht. Beide Seiten auf
  Mittag des jeweiligen Kalendertags normiert. Neuer
  `tests/backup_age_calendar_day.spec.js` (Sabotage-Revert bestätigt).
- **B197 (B3):** `_detectReentryPause()`s `ongoingPauseDays` — dieselbe
  Asymmetrie-Klasse, gefixt. Niedrige Priorität, kein dedizierter neuer
  Test (keine Regression in `tests/reentry_faktoren.spec.js`).
- **B198 (C1):** `getWeightRecommendation()`/`getMetricRecommendation()`s
  gemeinsame `_recommendationCore()` filterte das "letzte 3-4 Wochen"-
  Erfolgsquoten-Fenster nicht auf Wochen mit tatsächlichen Daten (der
  `double_progression`-Zweig tat das bereits) — jetzt vereinheitlicht.
  Neuer `tests/weight_recommendation_window_filter.spec.js` (reiner
  Unit-Test ohne Browser, Sabotage-Revert bestätigt).
- **B193:** siehe Cluster 4 oben — beim Verifizieren dieser Fixes
  gefunden und korrigiert (Test-Helfer-Bug, keine App-Änderung).

CACHE_VERSION → `train-v232`. Volle Regressionssuite (73 Spec-Dateien) in
Batches gelaufen — alle grün bis auf die bereits bekannte
`share_image.spec.js`-Baseline-Flakiness (unverändert seit vorherigen
Runden, nicht Teil dieses Sprints).

---

## Migrations-Testmatrix + HANDOFF.md-Audit (Migrations-Audit-Auftrag, 2026-08-03)

Zwei unabhängige Prozessverbesserungen aus `Diagnose & Sprints/TRAIN-Migrations-Audit-Auftrag.md`, kein App-Feature, kein CACHE_VERSION-Bump. Diagnose: `Diagnose & Sprints/diagnose-migrations-audit-2026-08-03.txt`.

**Auftrag 1 — Migrations-Testmatrix:** `state.js`s `migrate()` hat 27 nummerierte `schemaVersion`-Sprünge (v0→v33) plus ~15 ungebumpte "Always-apply"-Defaults, aber `tests/fixtures.spec.js` prüfte bislang nur "0 uncaught errors" gegen 17 Fixtures, die alle schon bei schemaVersion 29/30 starten — kein Fixture deckte v0-v28 ab, keine Prüfung auf tatsächlichen Datenverlust. Neu: `tests/migration-fixtures/` (11 synthetische Fixtures an den wichtigsten historischen Sprüngen, siehe dortige README.md für die Auswahlbegründung) + `tests/migration_matrix.spec.js` (11 Tests, prüfen die RESULTIERENDE migrierte Datenstruktur, nicht nur Fehlerfreiheit). Alle 11 Tests grün, bestehende `tests/fixtures.spec.js` (17 Tests) weiterhin grün — keine Regression. `migrate()` selbst bleibt bewusst nicht exportiert (Empfehlung aus der Diagnose, optional für später: Export würde schnellere Node-Unit-Tests ohne Browser-Overhead ermöglichen).

**Auftrag 2 — HANDOFF.md-Audit:** Ergebnis "teilweise Single Source of Truth" (bewusstes Design, siehe CLAUDE.md — HANDOFF.md verweist absichtlich auf BUGS.md/DECISIONS.md statt alles zu duplizieren). Zwei echte Lücken gefunden und additiv ergänzt (siehe Top-Absatz oben): `weeklyFocus.js:737-739`s RPE-Nebenfund aus B179, zwei offene Produktfragen aus Runde 9. Commit `daabb30`.

---

## B185-B190 — Runde-9-Audit-Folgerunde: Audit vollständig abgeschlossen (train-v230, 2026-08-03)

Direkte Fortsetzung von Runde 8s 5-Domänen-Audit (`AUDIT-BERECHNUNGEN.md`).
Nutzer gab explizit alle 3 gefundenen "Verdacht auf Bug"-Fälle plus einen
Muskelgruppen-Backfill, einen Absicherungstest und 2 kosmetische Nebenfunde
zur Umsetzung frei. 6 parallele Diagnose/Design-Agents (aufbauend auf der
bereits gelaufenen Runde-8-Diagnose, keine Neu-Exploration), Plan-Mode-
Bestätigung inkl. 2 gezielter Rückfragen (Cluster 1s Rückwirkung
bestätigen; 2 zusätzliche, von den Agents gefundene Nebenfunde derselben
Fehlerklasse mitfixen). Alle 3 state.js-berührenden Cluster (1/3/4) wurden
vorab auf ihre exakte Zeilen-Region diagnostiziert und disjunkt bestätigt
— alle 6 Cluster liefen daher in EINER parallelen Runde ohne Solo-Vorlauf
(neues Muster 14 in AGENTS.md).

- **B185 (wichtigster Fund):** `_weekConsistencyRatio()` nutzte für
  reguläre Trainingstage das manipulierbare `markedDone`-Kriterium statt
  der Anti-Gaming-Definition der Streak-Berechnung (≥50% Sätze bewertet).
  Fix: neue `_dayEvalCounts()`-Export-Funktion (state.js), von
  `consistencyUtils.js` UND `weeklyFocus.js`s onTrack-Fallback-Karte
  (Bonus-Fix) genutzt. **Bestätigte Rückwirkung:** ändert die angezeigte
  Fortschritt-Tab-Konsistenz-% für die GESAMTE bisherige Historie sofort
  (keine Migration, reine Neuberechnung) — vom Nutzer vorab explizit
  bestätigt, siehe DECISIONS.md.
- **B186:** `weekReview.js` PR-/Steigerungs-Karten zeigten "Neuer PR"/
  "Stärkste Steigerung" auch während/gegen Deload-Wochen (im Gegensatz zu
  3 anderen Implementierungen im Code, die das bereits korrekt filtern).
  Deload-Filter am Aufrufer ergänzt (kein neuer Helper — etabliertes
  Inline-Muster). Bonus-Fix: `_findBestGain`s Gate um Vorwoche-Deload-
  Check erweitert.
- **B187:** `ex.targetSets` komplett entfernt (gleiche Fehlerklasse wie
  B181) — die Diagnose fand dabei eine zweite Schreibstelle in state.js
  (`ONBOARDING_SEED`), die der Runde-8-Audit übersehen hatte.
- **B188:** Muskelgruppen-Backfill für Bestandsdaten (additiver
  Migrations-Guard, kein SCHEMA_VERSION-Bump). Beim Implementieren einen
  echten Interferenz-Fall mit einer Runde-8-Testfixture gefunden+behoben
  (die neue Migration hätte eine bewusst leere Tags-Fixture stillschweigend
  befüllt, bevor der eigentliche Test-Reducer lief).
- **B189:** Absicherungstest gegen künftiges Auseinanderdriften des
  architekturbedingten ui.js/timer.js-Pausenzeit-Duplikats. Wirksamkeit
  per Sabotage-Check verifiziert (Wert testweise verändert, Test schlug
  korrekt fehl, danach vollständig zurückgesetzt — `git diff` zeigt 0
  Netto-Änderung).
- **B190:** Kosmetik — `weeklyFocus.js`/`setUtils.js`-Duplikat abgesichert
  (Absicherungstest statt Auflösung, zirkulärer Import bleibt ein echtes
  Hindernis), Konfidenz-Konstanten benannt (reiner Rename, 37 Tests
  unverändert grün).

Volle Suite (68 Spec-Dateien, 3 Batches): alle Failures aufgeklärt (ein
Batch zeigte 12 Failures durch EMFILE-Klasse Dev-Server-Kontention bei 6
gleichzeitigen Agents, in Isolation 24/24 grün bestätigt; `share_image`-
Download-Timeout bekannter Flake). CACHE_VERSION train-v229→v230, kein
CSS-Bump. AUDIT-BERECHNUNGEN.md aktualisiert (alle Funde als behoben
markiert). Sprint-Ergebnis vollständig in
`Diagnose & Sprints/sprint-ergebnis-runde9-2026-08-03.txt`.

---

## B181-B184 — Runde-8-Datenkonsistenz-Sprint: konkreter Bug + 5-Domänen-Audit + 3 Feedback-Punkte (train-v229, 2026-08-02)

Anlass: ein konkreter, reproduzierter Bug (Übung mitten in der Woche
archiviert → Soll-Satzzahl sank live korrekt von 24 auf 20, die
Zusammenfassung rechnete aber weiterhin mit 24) plus die grundsätzliche
Sorge, dass Berechnungen im Projekt zu kleinteilig/uneinheitlich geworden
sind. Leitplanke vom Nutzer wörtlich vorgegeben: "Single Source of Truth"
heißt NICHT alles auf eine Zahl zwingen — Runde 7 hat gezeigt, dass
scheinbare Duplikate oft absichtlich unterschiedliche Konzepte sind.

- **B181 (Cluster 0, Anlass des Sprints):** Root Cause war NICHT ein
  Cache-/Snapshot-Bug wie B166/B176, sondern ein simpler vergessener
  Filter — `_getDayCompletionStats()` zählte archivierte Übungen weiterhin
  mit, im Unterschied zu ~11 anderen Stellen im Code. Fix: `if
  (ex.archived) continue;` an beiden betroffenen Zählschleifen ergänzt.
  Root Cause vor dem Fix aktiv reproduziert (Guards testweise entfernt,
  Test schlug mit exakt dem gemeldeten Symptom fehl).
- **Cluster 1 (5-Domänen-Audit, NUR Diagnose in dieser Runde):** 5
  parallele, rein lesende Agents inventarisierten alle Berechnungen im
  Projekt (Satz-/Ziel-Zahlen, Gewicht/PR, Streak/Konsistenz, RPE-Schwellen,
  Pausenzeiten) und klassifizierten jeden Fund als "konsistent"/"Verdacht
  auf Bug"/"korrekt getrennt". Ergebnis in neuem `AUDIT-BERECHNUNGEN.md` —
  3 echte Verdachtsfälle gefunden (`ex.targetSets`, `weekReview.js` PR-Karte
  ohne Deload-Filter, `_weekConsistencyRatio()`s markedDone-Diskrepanz),
  bewusst NICHT in diesem Sprint gefixt (explizite Sprint-Vorgabe) — Fixes
  folgten in Runde 9 nach separater Nutzer-Freigabe.
- **B182 (Cluster 4):** Hantelscheiben-Rechner bekommt konfigurierbare
  größte Scheibe (`settings.largestPlate`, Default 25kg, Preset-Buttons
  15/20/25kg) statt fest 25kg.
- **B183 (Cluster 3):** manuelle Steigerungs-Anpassung braucht keinen
  Doppel-Tap mehr — der bereits vorhandene Picker (Chips + Freitext) wird
  jetzt per einfachem Tap geöffnet, Chip-Werte aus `getEffectiveWeightStep()`
  abgeleitet statt hartcodiert.
- **B184 (Cluster 2):** Muskelgruppen-Zuordnung für alle 72 Standard-
  Übungen ergänzt (`movementMap.js` `MUSCLE_GROUP_MAP`, per-Übung kuratiert
  — z.B. Schulterdrücken korrekt Schulter statt Brust trotz Push-Muster).
  Verdrahtet für NEU erstellte Übungen (Backfill für Bestandsdaten folgte
  in Runde 9/B188). Bonus: 2 bereits gebaute, tote Insight-Signale
  (P-04/W-03) greifen jetzt automatisch.

Volle Suite (66 Spec-Dateien, 3 Batches) grün (bekannte Flakes bestätigt
unrelated). CACHE_VERSION train-v228→v229, kein CSS-Bump. Neues
Referenzdokument `AUDIT-BERECHNUNGEN.md` angelegt. Sprint-Ergebnis
vollständig in `Diagnose & Sprints/sprint-ergebnis-runde8-2026-08-02.txt`.

---

## B178-B180 — Runde-7-Coaching-Qualitäts-Sprint (train-v228, 2026-08-02)

Baute direkt auf dem Cluster-4-Audit aus Runde 6 auf (dort nur
diagnostiziert, nicht umgesetzt) — 3 Cluster, alle state.js-frei (erster
Sprint dieser Art, keine Solo-Runde nötig, neues Muster 12 in AGENTS.md).

- **B178 (C5):** Coach-"Warum"-Texte beim Übungsabschluss nutzen jetzt den
  bereits berechneten Mehrwochen-Trend (`rec.reason` aus
  `getWeightRecommendation()`, bisher verworfen) statt eines statischen
  Texts. Von 8 geprüften Textstellen hatten nur 2 echten Mehrwert — die
  anderen 6 blieben bewusst unverändert (redundant mit dem bestehenden
  `prevRpe`-Trend). Bewusst NICHT umgesetzt: Pausenzeit-Ist-vs-Empfehlung-
  Vergleich (bräuchte eine echte state.js-Erweiterung, kein Datenfeld für
  Ist-Pausendauer vorhanden).
- **B179 (C6):** vier RPE-Schwellenwerte über 4 Dateien benannt (nicht
  konsolidiert) — Verdict: alle 3 geprüften Paare sind "unterschiedliches
  Konzept, korrekt getrennt", unterschiedliche Zeitfenster rechtfertigen
  unterschiedliche Zahlenwerte. Reiner Rename, 112 Tests unverändert grün.
- **B180 (C3):** Volumen-/Satzzahl-Progression wird jetzt als Fortschritt
  erkannt — neue Ableitungsfunktionen (`exSetCountHistory()` etc., kein
  state.js-Feld nötig) überschreiben additiv das Plateau-/Stagnations-Flag,
  wenn die Satzzahl über dasselbe Zeitfenster wächst, das bereits für
  Gewicht genutzt wird.

Volle Suite (64 Spec-Dateien, 3 Batches) grün. CACHE_VERSION
train-v227→v228, kein CSS-Bump. Sprint-Ergebnis vollständig in
`Diagnose & Sprints/sprint-ergebnis-runde7-2026-08-02.txt`.

---

## B167-B177 — Runde-6-Nutzerfeedback-Fix-Sprint (train-v227, 2026-08-02)

Größter Sprint dieser Serie: globale Steigerungs-Einstellung wirksam
machen, mehrere kleinere UX-Punkte, Testlücken schließen, plus eine
während der Verifikation gefundene echte Regression.

- **B167:** globale Einstellung "Kleinstmögliche Steigerung" war für jede
  real existierende Übung wirkungslos (`ex.weightStep` hatte in der
  Fallback-Kette immer Vorrang). Neuer zentraler Resolver
  `getEffectiveWeightStep()` (state.js), an allen 16 Lesestellen
  durchgesetzt.
- **B168:** Carry-Übungen (Distanz/Zeit) können jetzt über Gewicht
  progressieren (gekoppelt mit B167 im selben Solo-Durchgang, da beide den
  `EX_ADD`-Reducer ändern — Overlap, den das Sprint-Dokument nicht
  vorhergesehen hatte).
- **B169:** toter Code entfernt (`renderDayCard()`, `SET_AUTOFILL_DOWN`).
- **B170/B171/B172:** PR-Badge kompaktiert, Stoppuhr-Toggle, Favoriten-
  Übersicht.
- **B173:** Wdh-Reduzierung zusätzlich zu Gewichtsreduzierung (in
  sessionCoach.js, NICHT weightRecommendation.js wie ursprünglich
  angenommen — dort existiert aktuell gar keine Reduktions-Branch).
- **B174:** B141 weiterhin ungeklärt, nur dokumentiert.
- **B175:** Notiz-Feld pro Satz durch kontextuelles Auffälligkeits-Q&A
  ersetzt (RPE≥9/Wdh-Fehlbetrag/Gewichtsabweichung).
- **B176 (während der Verifikation gefunden, kein Nutzerfeedback):**
  offenes Übungsmenü konnte vom nächsten Übungs-Sticky-Header verdeckt
  werden, Klick auf "Übung löschen" traf ins Leere. Ausgelöst durch B175s
  Layout-Verkleinerung, Root Cause aber ein länger bestehender CSS-
  Stacking-Context-Fallstrick (`.ex-menu-dropdown` als Nachfahre von
  `.exercise__name-sticky`). Noch im selben Sprint gefunden UND behoben.
- **B177:** 4 neue Playwright-Tests für Testlücken aus Runde 3. Wichtige
  Korrektur: B154 hatte nur 2 von 4 Blockern tatsächlich behoben.

Runde 6 war der erste Sprint mit einem 2-Runden-Muster (state.js-Solo
zuerst für die gekoppelten Cluster 1+2/C12, danach 5 parallele Agents).
Volle Suite (63→64 Spec-Dateien) grün. CACHE_VERSION train-v226→v227,
kein CSS-Bump. Sprint-Ergebnis vollständig in
`Diagnose & Sprints/sprint-ergebnis-runde6-2026-08-02.txt`.

---

## B166 — Regression von B152: SW-Update aktiviert im echten Zwei-Versionen-Zyklus nicht (train-v226, 2026-08-02)

Runde 4 endete mit der Empfehlung, den B152-Fix aus Runde 3 (bisher nur am
simulierten Code-Pfad getestet) über einen echten Zwei-Versionen-Deploy-
Zyklus zu verifizieren. Genau dieser Test (Claude Cowork, live gegen den
deployten Build train-v223→v225) deckte auf: der Fix greift im echten
Zyklus NICHT vollständig.

**Root Cause:** `registerSW.js` erkannte einen wartenden Worker
ausschließlich über das `updatefound`-Event — das feuert laut Spec nur beim
Übergang eines Workers nach `installing`, nicht einfach weil bereits ein
Worker im `waiting`-Zustand vorliegt. Lädt die Seite in einem frischen JS-
Kontext (z.B. nach einem weiteren Reload, nachdem ein Worker bereits
wartete), feuert kein `updatefound` mehr — `ui.js`s `_pendingSwRegistration`
blieb `null`, der Klick-Handler fiel auf den `!waiting`-Fallback (Reload
ohne `SKIP_WAITING`) zurück. Der Klick-Handler selbst war die ganze Zeit
korrekt (unverändert seit Runde 3).

**Fix:** `registerSW.js` prüft jetzt direkt nach `register()`, ob
`registration.waiting`/`.installing` bereits existiert, und feuert in dem
Fall sofort `train:sw-update-ready` — löst dabei den Banner-Retry-
Nebenbefund automatisch mit. Zusätzliches Selbstheilungs-Netz im
`ui.js`-Klick-Handler (frische `getRegistration()`-Abfrage beim Klick).

**Separater Fund im selben Live-Test, KEINE Regression:** GET_VERSION
antwortete im Test nicht — stellte sich als Testmethodik-Mismatch heraus
(Live-Test nutzte MessageChannel/Ports, sw.js antwortet bewusst über
`event.source`, passend zum echten Aufrufmuster). sw.js unverändert seit
Runde 3, kein Code-Fix — Nutzerentscheidung war, dies nur zu dokumentieren.

Diagnose (1 Agent) + Implementierung (1 Agent, kein state.js involviert)
liefen ohne Parallelisierungsbedarf — sehr kleiner, fokussierter Cluster.
Verifiziert per neuem Test in `tests/sw_update_and_version.spec.js`
(simuliert exakt: `registration.waiting` bereits gesetzt, ohne dass
`updatefound` je feuert). Baseline 304/304 grün, nach dem Fix ebenfalls
304/304 grün (2 unrelated Flakes identifiziert und geprüft, siehe Notiz
oben zum Datums-Rollover bzw. dem bereits aus Runde 3 bekannten
`share_image.spec.js`-Download-Timeout). CACHE_VERSION train-v225→v226.

**Wichtig:** Dieser Fix braucht — wie B152 selbst — einen erneuten echten
Zwei-Versionen-Live-Test nach dem Push, bevor er endgültig als verifiziert
gilt (siehe "Nächster Schritt" oben). Vollständiges Sprint-Ergebnis in
`Diagnose & Sprints/sprint-ergebnis-runde5-2026-08-01.txt`.

---

## B158-B165 — Runde-4-Nutzerfeedback-Fix-Sprint: 8 von 9 Befunden behoben (train-v225, 2026-08-01)

Diagnose-vor-Fix-Sprint basierend auf gesammeltem Nutzer-/Eigenfeedback nach
dem Runde-3-Sprint, kategorisiert und priorisiert in
`Diagnose & Sprints/TRAIN-Feedback-Analyse.md` (Kategorie A: 9 sprint-reife
Bugs), ausgearbeitet in `TRAIN-Sprint-Prompts-Runde4.md`. A9 war von Anfang an
als reiner Diagnose-Auftrag markiert (Grundlage für ein separates
Konzeptgespräch zur Steigerungs-Regelmatrix, siehe Feedback-Analyse C2).

**Besonderheit dieser Runde:** 4 der 5 parallel gestarteten Phase-1-Diagnose-
Agents scheiterten sofort an einem session-weiten API-Limit. Statt zu warten,
wurden diese 4 Cluster direkt manuell diagnostiziert (Read/Grep durch Claude
selbst, kein Agent-Spawn); der 5. lief nach Wiederherstellung erfolgreich per
Agent. Keine inhaltliche Einschränkung — alle 5 Diagnosen liegen vollständig
vor, konsolidiert in `Diagnose & Sprints/diagnose-runde4-2026-08-01.txt`.

**Wichtige Abweichung von der Sprint-Vorlage:** Die Vorlage nahm an, dass
sowohl A4+A7 als auch A8 state.js als Datei ändern könnten und deshalb
sequenziell laufen müssten. Die Diagnose bestätigte: NUR A8 (Sätze
zurücksetzen) brauchte eine echte state.js-Änderung — A4/A7 waren vollständig
in ui.js lösbar. Damit lief nur A8 solo (Runde 1), alle anderen 4 Cluster
(A1+A2+A3, A5, A4+A7, A6) liefen danach in EINER parallelen Runde (4 Agents
gleichzeitig, disjunkte ui.js-Regionen, `git diff --stat` nach jeder Runde
geprüft).

- **B158-B160 (A1-A3, ein Agent):** Timer-Reset-Tag-Bug (`_clockDi`-Sync bei
  Tageswechsel — inkl. eines tieferliegenden zweiten Funds, ein
  MutationObserver hob den ersten Fix bei jedem Re-Render wieder auf),
  Toast/Pause-Overlay-Kollision + Anzeigedauer, sowie ein echter (nicht nur
  vermuteter) Gating-Unterschied zwischen zwei Bedienwegen für die
  Pausendauer (Urlaubstag/vergangene Woche).
- **B161 (A4) + B164 (A7), ein Agent (überlappende ui.js-Regionen):**
  Folgesatz-Propagation bei Straight-Sätzen (dabei eine kollaterale
  Test-Annahme in `session_coach_decision_matrix_v2.spec.js` korrigiert) +
  Undo-Staleness bei der Satz-Feedback-Übernahme-Cache (`_acceptedFeedback`).
- **B162 (A5):** Editierbares Zahlenfeld im Steigerungs-"Anpassen"-Banner —
  nutzt einen bereits bestehenden Reducer (`EX_SET_NEXT_WEEK_PLAN`), keine
  state.js-Erweiterung nötig.
- **B163 (A6):** Skip-Fragebogen ignoriert jetzt Übungen mit
  `skipReason==='substituted'` (exakter interner Wert per Test verifiziert,
  Diagnose hatte fälschlich `'replaced'` vermutet).
- **B165 (A8):** `DAY_RESET_SETS`-Reducer verengt (state.js, Solo-Runde).

**A9 (nur Diagnose, wie geplant kein Fix):** deutlich weitreichenderer Fund
als in der Feedback-Analyse vermutet — die globale Einstellung
"Kleinstmögliche Steigerung" (`settings.plateStep`) ist für JEDE real
existierende Übung faktisch tot, weil `ex.weightStep` (immer bei Erstellung
gesetzt) in der überall verwendeten `ex.weightStep ?? settings.plateStep ??
2.5`-Kette immer Vorrang hat. Die gemeldete "1,25kg trotz 2,5kg-Einstellung"
ist vermutlich die bereits bestehende, korrekte Halbzone (plateStep/2), kein
Bug. Ergebnis vollständig in der Diagnose-Datei für das C2-Konzeptgespräch.

Baseline vorab: 294/294 grün (3 Batches). Nach dem Sprint: 304/304 grün (3
Batches), 0 fehlgeschlagen. CACHE_VERSION train-v224→v225, CSS ?v=211→212 (da
styles.css für B159 geändert wurde). Sprint-Ergebnis vollständig in
`Diagnose & Sprints/sprint-ergebnis-runde4-2026-08-01.txt`.

---

## B152-B157 — Runde-3-Tiefentest-Fix-Sprint: 6 von 6 Befunden behoben (train-v224, 2026-08-01)

Diagnose-vor-Fix-Sprint nach demselben Muster wie der vorherige, basierend auf
einem Tiefentest gegen den deployten train-v223-Build
(`Diagnose & Sprints/TRAIN-Test-Uebergabe.md`, Teil 3+4). Phase 1: 3 parallele,
reine Diagnose-Agents (ein Agent pro Cluster), konsolidiert in
`Diagnose & Sprints/diagnose-runde3-2026-08-01.txt`. Phase 2: Plan-Mode-
Bestätigung inkl. 2 Produktentscheidungen (Versions-Label: Laufzeit-Abfrage
per SW-Message; Tag-Titel: neutral ohne Fokus-Zusatz).

**Wichtiger Unterschied zum letzten Sprint:** Die Diagnose bestätigte, dass
KEINER der drei Cluster `state.js` selbst ändern musste (nur unveränderte
Dispatches an bestehende Reducer) — alle drei Cluster liefen daher in EINER
Runde parallel (3 Agents gleichzeitig, disjunkte `ui.js`-Regionen), statt wie
in der Sprint-Vorlage vorsorglich sequenziell angenommen.

- **B152 (P0) + B153 (Minor):** Service-Worker-Update aktivierte nicht
  zuverlässig (SKIP_WAITING ging an den falschen/alten Worker) + hartcodiertes
  Versions-Label. Betraf **jeden künftigen Bugfix-Rollout** — kritischster Fund
  dieser Runde.
- **B154 (P1):** 3× native `confirm()` → In-App-Dialog-Pattern (repliziert von
  "Übung archivieren", keine neue generische Komponente eingeführt, wie vom
  Sprint vorgegeben). Nebenfund: `renderDayCard()` als toter Code identifiziert
  (nicht entfernt, siehe Nächster-Schritt-Notiz oben).
- **B155 (P1) + B156/B157 (Minor):** Onboarding-Button-Fix (Empfehlung setzt
  jetzt auch die echte Auswahl) + Tag-Titel-Copy-Fix + Stangengewicht-Obergrenze.

Alle 3 Agents liefen gleichzeitig ohne Kollision (disjunkte `ui.js`-Regionen,
`git diff --stat` danach geprüft). Baseline vorab: 282/282 grün (3 Batches).
Nach dem Sprint: 293/293 grün (3 Batches) + 1 bekannter, unabhängiger Flake in
`share_image.spec.js` (Download-Event-Timeout, nichts mit diesem Sprint zu tun,
grün im Retry). CACHE_VERSION train-v223→v224. Sprint-Ergebnis vollständig in
`Diagnose & Sprints/sprint-ergebnis-runde3-2026-08-01.txt`.

---

## B143-B151 — Pre-Launch-Fix-Sprint: 9 von 13 Browser-Test-Befunde behoben (train-v223, 2026-07-29)

Diagnose-vor-Fix-Sprint nach dem in `Diagnose & Sprints/TRAIN-Sprint-Prompts.md`
festgelegten Muster, basierend auf `test-results/TRAIN-Test-Uebergabe.md` (13
Befunde, Browser-Test train-v222). Phase 1: 5 parallele, reine Diagnose-Agents
(ein Agent pro Cluster, kein Code geändert). Konsolidierte Diagnose gespeichert
als `Diagnose & Sprints/diagnose-praelaunch-v222-2026-07-29.txt`. Phase 2:
Plan-Mode-Bestätigung inkl. 3 Produktentscheidungen (Plate-Rechner: beide
Fixes; Wdh-PR-Highlight: umsetzen trotz Konventionsbruch; Befund #4: als
offen in BUGS.md eintragen).

**Vorab-Reparatur (kein Teil der eigentlichen Befunde):** `tests/`-Ordner war
auf der Festplatte leer (Inhalt versehentlich nach `test-results/` verschoben,
Playwrights eigener gitignorter Output-Ordner) — vom Nutzer bestätigt und
zurückverschoben, Baseline danach 144/144 grün.

**Implementierung in 3 Runden nach AGENTS.md** (state.js zuerst und allein,
dann disjunkte Dateien/Regionen parallel):
- Runde 1 (solo): `state.js` `SET_UPDATE` (B144: Status-Neubewertung +
  negativer-Gewicht-Floor) + Plate-Rechner-Defaults/-Gating (B145).
- Runde 2 (3 parallel): `weekReview.js` (B143), `backup.js` (B150),
  `insightEngine.js` (B151).
- Runde 3a (2 parallel): `ui.js`+`weeklyFocus.js` Verletzungs-Erinnerung
  (B147), `ui.js` confirm-sub (B146).
- Runde 3b (2 parallel): `ui.js`+`sessionSummary.js` Session-Summary (B148),
  `ui.js` Check-in-Copy (B149).

**Wichtiger Fund während Phase 4 (Verifikation):** die neuen exakten
Zeitbezug-Tests aus B147 deckten einen ECHTEN, vorbestehenden Off-by-one-Tag-
Fehler in `weeklyFocus.js`s `daysSince`-Berechnung auf (volle Uhrzeit statt
12:00-Normierung, siehe BUGS.md B147) — nachträglich in derselben Runde
gefixt, danach grün. Zusätzlich bestätigte dieser Sprint erstmals konkret die
in CLAUDE.md dokumentierte EMFILE-Infra-Grenze der vollen Test-Suite (siehe
oben) — Verifikation lief daher konsequent in 3 Datei-Batches (282 Tests
gesamt, 0 fehlgeschlagen).

**Bewusst NICHT gefixt:** Befund #4 (Notiz-Icon macht Satz-Tabelle nach
Klick unsichtbar) — Root Cause trotz mehrerer gezielter Reproduktionsversuche
nicht gefunden, als B141 offen in BUGS.md dokumentiert. Befunde #8 (Onboarding-
Reihenfolge, bewusste Design-Entscheidung seit train-v132) und #13 (Streak-
Toggle bereits gebaut) waren reine Doku-Sync-Punkte, in `context-exports/`
korrigiert, kein Code-Fix nötig.

Sprint-Ergebnis vollständig dokumentiert in
`Diagnose & Sprints/sprint-ergebnis-praelaunch-v222-2026-07-29.txt`.

---

## B138/B139/B140 — Alternativübungen + Ernährungsphase + Intra-Session-Erschöpfung (train-v222, 2026-07-28)

Sequenzieller 3-Feature-Sprint (auf Nutzerwunsch, keine Parallelisierung —
Aufgabe 1+2 schreiben beide additiv in state.js, laut AGENTS.md-Grundregel
ein Kollisionsrisiko bei gleichzeitiger Bearbeitung). Technische Spec vor
Implementierung geschrieben und bestätigt (inkl. 2 Rückfragen zu
Sprint-Text-Ambiguitäten, siehe unten).

- **B138 (Alternativübungen, Option C):** neue Datei `exerciseAlternatives.js`
  (`EXERCISE_ALTERNATIVES`, 24 Übungen + `getAlternatives()`). Neue Chip-Reihe
  im "Heute anders"-Dialog — **wichtige Klärung per Rückfrage:** bewusst
  NEBEN der bereits bestehenden historienbasierten `sub-suggestions`-Liste
  (B109/D2) gestapelt, nicht ersetzend. Chip-Tap nutzt dasselbe
  Zwei-Dispatch-Muster wie `apply-sub-suggestion` (nicht das
  Ein-Dispatch-Muster von `confirm-sub` — dabei ein vorbestehendes,
  außerhalb des Sprint-Scopes liegendes Detail in der Sub-Form-Mechanik
  bemerkt, aber bewusst nicht angefasst, siehe BUGS.md B138). Neues
  additives Feld `state.customAlternatives`.
- **B139 (Ernährungsphase/kcal-Toggle):** neues additives Feld
  `settings.nutritionPhase`. **Wichtige Klärung per Rückfrage:** `cut` ist
  bewusst strikt (volle Steigerung nur bis RPE 6.0, danach IMMER halten,
  KEINE Halbzone) statt einer reinen Verschiebung des alten
  7.5er-Schwellenwerts — physiologische Begründung siehe DECISIONS.md.
  `_checkPlateau()` unterdrückt sich bei `cut` komplett. Alle 8 echten
  `getWeightRecommendation()`-Call-Sites aktualisiert (ui.js ×4,
  weeklyFocus.js ×1, insightEngine.js ×3).
- **B140 (Intra-Session-Erschöpfung, Ansatz B):** neue Funktion
  `detectSessionFatigue(day)` — bewusst in `sessionSummary.js` (nicht
  weeklyFocus.js, nicht neue Datei — architektonische Entscheidung während
  der Spec-Phase, siehe DECISIONS.md). Neuer Block im Session-Summary-Screen,
  NICHT im Coach-Tab.

**Unerwarteter Fund während der Umsetzung:** `detectSessionFatigue`-Import
in ui.js wurde vor der eigentlichen Funktion in sessionSummary.js
geschrieben (Aufgabe-3-Vorgriff während Aufgabe 1) — ein fehlender
Named-Export bricht bei ES-Modulen den kompletten App-Boot, nicht nur die
betroffene Funktion. Alle Aufgabe-1-Tests schlugen dadurch kollateral mit
"#app.is-ready nie sichtbar" fehl, bis per Diagnose-Test (`pageerror`
mitgeloggt) der echte Fehler sichtbar wurde. Lehre: bei mehreren
Aufgaben, die denselben Import-Block berühren, Imports erst hinzufügen,
wenn die exportierte Funktion auch existiert — oder sofort danach.

16 neue Tests über 3 Spec-Dateien (`exercise_alternatives.spec.js`,
`nutrition_phase.spec.js`, `session_fatigue.spec.js`) plus 1 korrigierter
bestehender Test (`heute_anders_history.spec.js` — Label-Änderung
"Ursprüngliche Übung:"→"Andere Übung:" hatte einen alten, jetzt nicht mehr
eindeutigen `.sub-form__label`-Selektor gebrochen, echte Regression,
gefixt). Volle Suite (273 Tests) grün — **aber nur in 3 Datei-Batches
verifizierbar**, ein einzelner `npx playwright test`-Lauf über alle 273
Tests lässt den lokalen Devserver mit `EMFILE` abstürzen (neue, unabhängige
Infra-Grenze, siehe CLAUDE.md "Regressions-Test" für Details/Workaround —
kein Code-Bug, 3x per Batch-Läufen 0 Fehler bestätigt). state.js/ui.js/
weightRecommendation.js/weeklyFocus.js/insightEngine.js/
sessionSummary.js/styles.css/sw.js geändert + neue Datei
exerciseAlternatives.js. CACHE_VERSION train-v221→v222, CSS ?v=210→211,
SCHEMA unverändert (33, alle neuen Felder additiv). CLAUDE.md/BUGS.md/
DECISIONS.md/AGENTS.md aktualisiert.

---

## B132 RE-DIAGNOSE 2026-07-28 (kein Code-Fix)

Nutzer bat um erneute Diagnose von B132 (Deadlift-Plateau erscheint im
Fortschritt-Tab, aber nicht im Coach-Tab), mit 3 gezielten Nachfragen zur
bereits dokumentierten Root Cause (Gating in der akuten Kaskade). Ergebnis:
weiterhin korrektes, gewolltes Verhalten, kein Bug, kein Code-Fix nötig.

1. **B131 (Deload-"Weiter wie bisher") hat keine Wirkung auf `_checkPlateau()`**
   — komplett getrennte Kaskaden (`_checkPreventiveDeload()` in
   `computeStructuralSignals()`, liest `decisionLog`; `_checkPlateau()` in
   `computeWeeklyFocus()`, liest `state.plateauActions`). Keine Code-Verbindung.
2. **`plateauActions`-Lifecycle bereits enger als der vermutete Bug:**
   `'ignored'` hebt sich spätestens nach 1 weiteren Woche automatisch auf
   (sobald `plateauWeeks` weiterzählt), `'implemented'` läuft nach exakt 14
   Tagen aus (`_isPlateauSuppressed()`, weeklyFocus.js) — beides weit unter
   4 Wochen. Ein "reset wenn >4 Wochen alt"-Fix wäre wirkungslos, da diese
   Bedingung praktisch nie eintritt. Kein Bug im `PLATEAU_ACTION`-Reducer
   (state.js) gefunden.
3. **Konkret demonstriert per Playwright-Reproduktion** (Kreuzheben, 4
   Wochen konstantes Gewicht, danach wieder entfernt — Ad-hoc-Test, nicht
   committet): ohne weiteres Signal zeigt der Coach-Tab korrekt "Plateau
   überwinden"; mit zusätzlich schlechtem Schlaf (5h) in der aktuellen
   Woche zeigt er stattdessen "🔋 Schlaf priorisieren" — der Overload-Zweig
   (Prio 3) verdrängt Plateau (Prio 4), exakt wie in weeklyFocus.js
   dokumentiert.

Kein Code geändert (weeklyFocus.js/state.js unangetastet), kein
CACHE_VERSION-Bump (Sprint-Vorgabe: nur bei Code-Änderung), nicht
committet. Details: BUGS.md B132 (Re-Diagnose-Addendum ergänzt).

---

## RE-DIAGNOSE-SPRINT 2026-07-27 (kein Code-Fix)

Nutzer brachte 4 vermeintliche Bugs (PR-Badge jedes Mal, Reorder-Pfeil verschwindet,
erster Haken gold, RPE-Hint blockiert UI) mit der ausdrücklichen Vorgabe
"Diagnose zuerst, Root Cause bestätigen, dann Fix". Diagnose (Code-Lesen +
gezielte Playwright-Läufe, kein Raten) ergab: **alle 4 waren bereits behoben**
— B134 seit train-v184 (state.js `_applyPrTracking`), B135/B136/B137 seit
train-v217 (B116/B117/B118). Bestehende Tests (`pr_badge.spec.js`,
`exercise_reorder.spec.js`) decken die exakten gemeldeten Szenarien ab und
liefen grün; volle Suite 156 passed/3 flaky-aber-grün/0 failed. Details siehe
BUGS.md B134-B137. Nutzer hat sich nach Rückfrage gegen Version-Bump/Commit/
Push entschieden, da keine funktionale Änderung vorliegt — nur dieser
Doku-Eintrag, bewusst uncommitted.

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v221 (v155 wurde nie vergeben, siehe vorherige
  Sprint-Notiz — Nummerierung folgt echten Code-Sprints, nicht der
  Sprint-Text-Nummerierung)
- CSS: ?v=210
- SCHEMA: 33 (unverändert — dieser Sprint brauchte keine neuen Felder)
- **B133 — Scheiben-Anzeige dezent zurückgebaut + Live-Update (train-v221,
  2026-07-27):** Nutzer-Feedback nach train-v220: B130s Chip/Badge-Design
  ("[25kg] [10kg]") zu klobig, zurück zu einzeiligem dezentem Text
  (`.plate-hint`, gleicher Klassenname/gleiche Optik wie die vor B130
  entfernte Komponente) — reiner CSS-Rückbau, keine Diagnose nötig. Das
  zweite Problem (kein Live-Update beim Tippen/nach "Übernehmen") brauchte
  echte Diagnose: der "Übernehmen ↗"-Button funktionierte bereits korrekt
  (voller Re-Render liest `s.weight` immer frisch aus dem State) — der
  tatsächliche Bug war reines Tippen vor Bestätigung/Blur, weil `_handleInput()`
  absichtlich leer ist (verhindert Tastatur-Schließen auf Mobile). **Unerwarteter
  Fund während der Umsetzung:** ein einfacher `.textContent`-Patch reicht nicht
  — `timer.js` hat einen eigenen, unabhängigen `input`-Listener auf `#app`
  (`_ensureSessionStart()`), der beim allerersten Tastendruck einer noch nicht
  gestarteten Session einen echten `dispatch()` auslöst und damit einen vollen
  Re-Render erzwingt, der den Patch sofort wieder überschreibt (nur beim
  ersten Tastendruck des Tages reproduzierbar). Fix: neue `_liveWeightPreview`-
  Map (`${weekId}-${di}-${ei}-${si}` → getippter Rohwert), von der
  Render-Funktion bevorzugt gegenüber dem committeten State gelesen — übersteht
  dadurch jeden Re-Render unabhängig von seiner Ursache, ohne `timer.js`
  anzufassen (außerhalb des Sprint-Scopes). `calcPlates()` selbst unverändert.
  12 Tests in `tests/plate_calculator.spec.js` (erweitert), volle Suite grün.
  Nur `ui.js`/`styles.css` geändert, CACHE_VERSION train-v220→v221, CSS
  ?v=209→210, SCHEMA unverändert. Details siehe BUGS.md B133, DECISIONS.md.
- **B130/B131/B132 — Plate Calculator neu + Coach Signal Unterdrückung
  (train-v220, 2026-07-27):** baute direkt auf der vorherigen Diagnose-
  Session auf (kein neuer Explore-Agent nötig). Bei allen drei ein wichtiger
  Fund während/vor der Umsetzung:
  - B130: der Plate Calculator (B126, v218) wurde falsch herum gebaut. Die
    Umkehr-Berechnung (Gewicht→Scheiben) existierte längst in `calcPlates()`
    — B126 komplett entfernt, `calcPlates()` liefert jetzt strukturierte
    Einzel-Platten statt eines Strings, neue prominente Chip-Anzeige +
    Fallback für nicht exakt auflegbare Gewichte (auf nächstes erreichbares
    1.25kg-Vielfaches abgerundet).
  - B131: die Deload-Strukturkarte hatte gar keinen eigenen Dismiss-Button
    — das sichtbare "Weiter wie bisher" gehörte zur unabhängigen Hauptkarte
    und loggte einen anderen `type`. Neuer eigener Button + 4-Wochen-
    Unterdrückungs-Prüfung in `_checkPreventiveDeload()` gegen den bereits
    bestehenden `decisionLog`.
  - B132: Coach-Tab- und Fortschritt-Tab-Plateau-Erkennung nutzen denselben
    `detectPlateaus()` mit identischen Schwellenwerten — keine Diskrepanz
    zum Anpassen. Divergenz liegt im Gating (akute Kaskade + `plateauActions`
    vs. keine Gates), bewusst dokumentiert statt strukturell vereinheitlicht
    (Status ⏳ in BUGS.md).
  19+ neue/erweiterte Tests, volle Suite grün (bekannte Parallel-Last-Flakes
  isoliert nachverifiziert). Nur ui.js/styles.css/weeklyFocus.js geändert,
  CACHE_VERSION train-v219→v220, CSS ?v=208→209, SCHEMA unverändert.
- **B128/B129 — Auto-Steigerung Opt-out + Skip-Grund-Abfrage (train-v219,
  2026-07-27):** Diagnose-vor-Fix über 2 sequenzielle Runden (beide berühren
  state.js, laut AGENTS.md nicht parallelisierbar). Bei beiden Aufgaben ein
  wichtiger Befund während der Diagnose/Umsetzung:
  - B128: `nextWeekPlan`-Auto-Vorauswahl existierte bereits vollständig
    (`EX_AUTO_PRESELECT_NEXT_WEEK_PLAN`, bisher nur vom "Neue Woche"-Dialog
    genutzt) — nur ein neuer Trigger (Tagesabschluss) nötig, kein neuer
    Reducer. Sprint-Vorlagen-Widerspruch gefunden (unconfirmed setzen vs.
    Banner erst bei neuer Woche — hätte den Plan lautlos verworfen) und
    zugunsten der expliziten Opt-out-Entscheidung aufgelöst: Plan wird
    sofort `confirmed=true`, neues Feld `ex.nextWeekPlanAutoReviewed`
    steuert nur die Banner-Sichtbarkeit.
  - B129: `DAY_TOGGLE_COMPLETE` setzt jeden `pending`-Satz synchron auf
    `'fail'` — Skip-Erkennung muss auf einem Snapshot VOR diesem Dispatch
    laufen, sonst ist "komplett übersprungen" nie erkennbar. Neuer
    Warteschlangen-Dialog (eine Übung nach der anderen), neues Coach-Tab-
    Signal `_checkInjuryReminder()`, bedingte Check-in-Zusatzfrage.
  52+ neue/erweiterte Tests, volle Suite grün (1 bekannter Download-Event-
  Flake in `share_image.spec.js` isoliert 2× grün nachverifiziert — keine
  Regression). state.js/ui.js/styles.css/weeklyFocus.js geändert,
  CACHE_VERSION train-v218→v219, CSS ?v=207→208, SCHEMA 32→33 (mit Migration).
- **B123-B127 — 5 Features vor Launch (train-v218, 2026-07-27):** Diagnose-vor-
  Fix über 2 Runden (Runde 1 parallel: ui.js-Such-Dialog + ui.js/styles.css
  Plate-Calculator; Runde 2 sequenziell: ein Agent für 3 state.js-berührende
  Features). Bei 2 der 5 Aufgaben war der echte Root Cause anders als
  vermutet — Details je Bug in BUGS.md:
  - B123: Such-Bug lag nicht an Case-Sensitivity, sondern daran, dass die
    Suche `MOVEMENT_MAP` nie kannte + einer Metric-Filter-Asymmetrie
    zwischen Suche und Duplikat-Check. `MOVEMENT_MAP` als dritte
    Suchquelle ergänzt, Duplikat-Check auf "bereits im Ziel-Tag" umgestellt.
  - B124: neuer Helper `_findExerciseSettingsHistory()` übernimmt
    weightStep/targetReps/pauseSec/progressionType/metric/tags beim
    Hinzufügen einer bekannten Übung (Gewicht/Sätze bleiben immer frisch).
  - B125: neue atomare Action `EXERCISE_MOVE_TO_DAY` + ⋮-Menüpunkt + Dialog
    zum Verschieben einer Übung zwischen Tagen.
  - B126: inline Hantelscheiben-Rechner (⚖-Button je Satz), wiederverwendet
    die bestehende `calcPlates()`-Konvention; Nebenfund korrigiert (der
    passive Plate-Hint nutzte nie `state.settings.barbellWeight`).
  - B127: `ex.note` war entgegen der Sprint-Annahme bisher NICHT live im
    Tages-View editierbar (nur Vorlagen-Editor) — bekommt jetzt eine echte
    Live-UI ("Heute"-Tab). Neues `state.exerciseNotes` ("Immer", permanent).
    `s.note` (pro Satz) bleibt drittes, unabhängiges Feld. Kein
    SCHEMA_VERSION-Bump (additiver Default, Präzedenzfall `substituteHistory`).
  27 neue Tests über 5 Spec-Dateien, volle Suite grün (bekannte
  Parallel-Last-Flakes isoliert nachverifiziert — 15 Tests im Vollauf,
  alle 42 isoliert grün). Nur state.js/ui.js/styles.css geändert,
  CACHE_VERSION train-v217→v218, CSS ?v=206→207, SCHEMA unverändert.
- **B114-B122 — 9 Bugs vor Launch (train-v217, 2026-07-26):** Diagnose-vor-Fix
  über 4 parallele Fork-Agents (state.js / styles.css / timer.js /
  ui.js+weeklyFocus.js+weightRecommendation.js). Bei 4 der 9 Bugs war der
  echte Root Cause anders als vermutet — Details je Bug in BUGS.md:
  - B114: "Heute anders"-Reset lief bereits korrekt bei neuer Woche, Lücke
    lag in `DAY_ADD_CLONE`/`DAY_DUPLICATE`/Save-as-Template.
  - B115: kein doppelter PR-Eintrag, sondern Gewichts-PR + Wdh-PR am
    selben Gewicht in derselben Session — jetzt max. 1 Trophy/Übung/Tag.
  - B116: `_exMenuOpenKey` folgt jetzt der verschobenen Übung, nicht der
    Zeilenposition.
  - B117: Haken-Farbe vereinheitlicht (PR bleibt über Trophy-Badge sichtbar).
  - B118: `.rpe-nudge` blockiert keine Klicks mehr außerhalb seiner Buttons.
  - B119: Pausen-Anzeige synct sofort beim Rückkehr aus dem Hintergrund.
  - B120: "Vor N Wochen" (2-8 Wochen) zurück — **revidiert B99** nach
    expliziter Rückfrage (Zielkonflikt: B99 hatte dieses Schema 2026-07
    bewusst entfernt).
  - B121: kein movementMap.js-/sessionCoach.js-Bug — `weightRecommendation.js`
    hatte kein `isCompound`-Bewusstsein, jetzt nachgerüstet.
  - B122: zwei unabhängige Fokus-Auswahl-Funktionen (Session-Briefing +
    Coach-Tab), beide bekommen Priorität favorit+compound > favorit >
    compound > bisheriger Fallback.
  27 neue/erweiterte Tests über 8 Spec-Dateien, volle Suite grün (bekannte
  Parallel-Last-Flakes unter Volllast, isoliert nachverifiziert). Nur
  state.js/ui.js/styles.css/timer.js/weeklyFocus.js/weightRecommendation.js
  geändert, CACHE_VERSION train-v216→v217, CSS ?v=205→206, SCHEMA unverändert.
- **B113 — Einstellungen restrukturiert (train-v216, 2026-07-26):** die
  bisherige einzelne "Training"-Überschrift (15 Elemente) ist jetzt in 4
  Zwischenüberschriften gegliedert: TRAINING (6 ursprünglich vorgegebene +
  Trainingsziel + Max. Sitzungsdauer, die im Sprint-Text fehlten),
  FORTSCHRITT & ANZEIGE (Streak-Anzeige), GEWICHT & STEIGERUNG
  (Kleinstmögliche Steigerung, Stangengewicht, + Deload-Faktor, ebenfalls
  im Sprint-Text fehlend), AUTOMATISIERUNG (Automatische Wochenerstellung
  + 2 Sub-Toggles). Alles bleibt EINE `.settings-section`-Karte (keine 4
  separate Karten — eine Karten-Border wäre der Trennstrich, den die
  Vorgabe "Whitespace reicht" ausschließt), neue leichtere Klasse
  `.settings-group-title` gliedert den Karteninhalt. Reine
  Positions-Umzüge bestehender Markup-Blöcke — kein `data-action`/Handler
  geändert. Sub-Toggle-Ausgraufunktion (bereits vorhanden, `disabled`-
  Attribut) unverändert. 5 neue Tests (`tests/settings_reorg.spec.js`).
  Details siehe BUGS.md B113.
- **B112/E1 — Transparenz Coach-Tab (train-v215, 2026-07-26):** jede
  Haupt- UND Strukturkarte im Coach-Tab hat jetzt eine "▾ Basis dieser
  Einschätzung"-Disclosure mit den konkreten Datenpunkten hinter der
  Einschätzung (Vorbild: Quellenangaben bei KI-Antworten). Bestehende
  `.coach-why-collapse`-Komponente wiederverwendet/umbenannt statt eines
  zweiten, redundanten Toggles — natives `<details>`, kein neuer
  JS-Toggle-State nötig. Alle 8 Kaskaden-Signale + 5 Struktursignale in
  `weeklyFocus.js` bekommen ein neues `evidence: [{label, value}]`-Feld
  (meist bereits berechnete, bisher nur in Prosa verbaute Werte
  strukturiert freigelegt — größte Lücke war `_buildOverloadResult()`,
  alle 3 Zweige verwarfen ihre Rohwerte). Neuer generischer
  `_evidenceHtml()`-Helper (ui.js) rendert Haupt- und Strukturkarten
  identisch. 6 neue Tests (`tests/coach_evidence.spec.js`). Details siehe
  BUGS.md B112.
- **B111 — movementMap.js erweitert (train-v214, 2026-07-26):** reine
  Datenergänzung, +79 Übungsvariationen/Synonyme (`MOVEMENT_MAP` 139→218
  Einträge) über Squat/Hinge/Push/Pull/Core/Carry, plus 23 neue Einträge
  in `ISOLATION_EXERCISE_NAMES` (38→62). Korrektur dabei: `Face Pulls`
  war fälschlich als Isolation gelistet — Face Pull ist Compound
  (Schulter-Außenrotation + Retraktion), entfernt, neues Singular
  `Face Pull` als Pull/Compound ergänzt. Bewusst NICHT geändert:
  `Leg Curl`/`Beinbeuger` bleiben Bewegungsmuster-Kategorie `Hinge` (die
  Compound/Isolation-Einstufung ist über `ISOLATION_EXERCISE_NAMES`
  bereits korrekt — eine Kategorie-Änderung hätte Seiteneffekte auf
  Push-Pull-Balance-Berechnungen in weeklyFocus.js, außerhalb des
  "nur Daten"-Scopes). Keine Struktur-/Logik-Änderung an
  `isCompoundExercise()`/`resolveCategory()`. 6 neue Unit-Tests
  (`tests/movement_map_expansion.spec.js`), keine Duplikate (Key-Anzahl
  programmatisch verifiziert). Nur `movementMap.js` geändert,
  CACHE_VERSION train-v213→v214, CSS/SCHEMA unverändert. Details siehe
  BUGS.md B111.
- **B110 — Streak-Badge-Fenstergrenze korrigiert (train-v213, 2026-07-26):**
  Beiläufig gefunden, als CI nach dem B109-Push rot wurde
  (`streak_inprogress_week.spec.js`, zuvor als B104 getrackt). Root Cause:
  `_calcCurrentStreak()` (state.js) behandelte das 7-Tage-Fenster der
  aktuellen, noch leeren Woche als abgelaufen, sobald der Kalendertag des
  7. Tages begann (Vergleich nutzte `_weekEndMs()` = Start + 6 Tage, das
  ist der ANFANG des 7. Tages, nicht dessen Ende) — reproduzierte
  deterministisch an jedem 7. Kalendertag einer offenen Woche (z.B.
  Sonntag bei Montags-Start), nicht nur "manchmal". Die Streak brach
  dadurch bis zu einen vollen Tag zu früh auf 0 ab, für jeden Nutzer,
  nicht nur in Tests — echter Produktionsbug. Fix direkt an der
  betroffenen Stelle (Start + 7×24h, exklusiv verglichen), `_weekEndMs()`
  selbst bewusst unverändert gelassen (wird von `_streakGapBreaks()` für
  die Lücken-Erkennung mit einer anderen, dort korrekten Bedeutung
  gebraucht). Dabei auch geklärt: der zweite ursprünglich unter B104
  vermutete Fall (`training_context_anchor.spec.js`) war nur der bereits
  bekannte Dev-Server-Verbindungsabbruch unter Parallel-Last, kein
  eigener Bug — B104 damit vollständig aufgelöst. 3 neue Tests
  (`tests/streak_week_window_boundary.spec.js`), verifiziert unter
  `TZ=UTC` (CI-Umgebung) und lokal. Nur `state.js` geändert, CACHE_VERSION
  train-v212→v213, CSS/SCHEMA unverändert. Details siehe BUGS.md B110.
- **B109/D2 — "Heute anders" merkt sich Ersatz-Übungen (train-v212, 2026-07-26):**
  Vor der Umsetzung diagnostiziert (Plan-Mode + Explore-Agent): "Heute anders"
  ist ein Zwei-Schritt-Vorgang (Umbenennen im Namensfeld, dann separat
  Original in "Heute anders" deklarieren, `EX_SET_SUBSTITUTE`-Reducer setzt
  nur `ex.substituteFor`). Nach Rückfrage bestätigt: Flow bleibt unverändert.
  Neues additives State-Feld `state.substituteHistory` (kein SCHEMA-Bump,
  gleiches Muster wie `settings.goal`) zählt `{original, substitute}`-Paare
  direkt im bestehenden Reducer (max. 5 Einträge/Übung, max. 50 global).
  "Heute anders"-Formular zeigt bis zu 3 Vorschläge (sortiert nach
  Häufigkeit) aus der History — Tap feuert die zwei bestehenden,
  unveränderten Actions (Rename + Substitute-Deklaration) hintereinander
  aus einem Klick-Handler, echter Ein-Tap-Vorgang ohne Reducer-Änderung.
  Manueller Eingabepfad unverändert. 6 neue Tests
  (`tests/heute_anders_history.spec.js`). Details siehe BUGS.md B109.
- **B105-B108 — Onboarding-Verbesserungen (train-v211, 2026-07-26):**
  Vier-Agent-Sprint aus dem vorherigen Onboarding-Audit dieser Session-
  Reihe. Zwei Explore-Agents haben den Code vor der Umsetzung verifiziert
  (Diagnose-vor-Fix-Konvention) und dabei wichtige Abweichungen vom
  Sprint-Text gefunden — alle unten korrigiert eingeplant statt blind
  übernommen. **B105** (Backup-Hinweis): der geforderte Screen existierte
  bereits fast identisch (`_obPhase === 'privacy'`, ui.js, exakt an der
  richtigen Stelle) — nach Rückfrage (`AskUserQuestion`) bestätigt: statt
  eines zweiten, redundanten Screens wurde der bestehende umformuliert
  (🔒→💾, positiverer Ton, Kerninhalt zu Datenverlust bleibt erhalten).
  **B106** (Coach-Tab-Fallback): `_fallback()` (weeklyFocus.js) zeigt in
  der Frühphase jetzt zusätzlich einen `subtext`, der klarstellt, dass
  Session Coach (Intra-Session-Feedback) schon ab dem ersten Satz
  funktioniert, auch wenn der Coach-Tab selbst erst ab Woche 2 konkrete
  Empfehlungen gibt — nur in diesem einen Kaskaden-Zweig gesetzt, daher
  automatisch weg sobald ein reales Signal greift oder genug Historie
  vorliegt. **B107** (Vorlagen-Vorschau): neue `.ob-tpl-exercises`-Zeile
  zeigt die ersten 3-5 eindeutigen Übungsnamen je Onboarding-Vorlage.
  **B108** (Deload-Erklärung): neues `?`-Info-Badge (natives `<details>`,
  kein JS-State nötig) neben dem `deload_preventive`-Struktursignal im
  Coach-Tab. Alle vier über 4 parallele Fork-Agents in 2 Runden umgesetzt
  (Runde 1: Agent 1+2 disjunkt; Runde 2: Agent 3+4 disjunkt, erst nach
  Runde 1 gestartet) — Details je Bug siehe BUGS.md B105-B108.
- **B102+B103 — diagnostiziert, kein Code-Fix (2026-07-26, CACHE_VERSION
  UNVERÄNDERT damals):** zwei gemeldete Bugs mit vorgegebenem Fix, beide über
  einen dedizierten Diagnose-Agent pro Bug geprüft, BEVOR irgendetwas
  geändert wurde (Diagnose-vor-Fix-Konvention). B102 (Intra-Session-
  Feedback zu weit unten): `.set-feedback` padding-top bereits 2px,
  `.set-row` padding-bottom 3px, kein Gap-Container dazwischen — per
  Playwright real gemessen (`getBoundingClientRect()`) über alle 3
  Render-Pfade × 2 Viewports (1280px/375px): Abstand ist überall 0px,
  reproduziert nicht. B103 (Einstellungen-Modal schließt nicht bei Tap
  außerhalb): "Einstellungen" ist gar kein Modal/Overlay in diesem Code,
  sondern ein normaler, immer sichtbarer Nav-Tab — alle echten Overlays/
  ⋮-Menüs im Code (7 `.modal-overlay`-Dialoge, Exercise-/Day-/Week-Menü,
  Übungs-Settings-Panel, alle dynamisch erzeugten Overlays außer dem
  bewusst nicht-dismissable Tagesabschluss-Check-in) schließen bereits
  bei Tap außerhalb. Beide Fix-Vorlagen passten nicht zur tatsächlichen
  Architektur — kein Blindfix, `styles.css`/`ui.js` inhaltlich
  unverändert. Einzige Änderung: neuer Regressionstest
  `tests/set_feedback_spacing.spec.js` (2/2 grün, sperrt den Ist-Zustand
  fest). Details siehe BUGS.md B102/B103.
- **B101 — Automatische Steigerung bei neuer Woche rundet jetzt auf ex.weightStep (train-v210):**
  Nutzer meldete "falsche kg-Zahl als Steigerung vorgeschlagen" mit
  vorgegebenem Fix (3 angenommene Root Causes). Vor der Umsetzung geprüft
  (technische Spec + `AskUserQuestion`): Root Cause 1 ("plateStep statt
  weightStep") traf nicht auf `_applyPlannedProgression()`/den "Neue
  Woche"-Empfehlungspfad zu — dort stand bereits überall korrekt
  `ex.weightStep || plateStep || 2.5`. Root Cause 3 (Fallback ohne
  Historie) existiert nicht im Code — ohne ≥2 Wochen wird bewusst gar
  keine Empfehlung gezeigt, kein Bug; nach Rückfrage bewusst nicht neu
  eingeführt. Echter Root Cause (Root Cause 2, bestätigt): der im Modal
  bestätigte Delta (`ex.nextWeekPlan`) wurde ungerundet angewendet
  (`_applyPlannedProgression()`, state.js) — folgenlos im Normalfall, aber
  der Recovery-Boost (`rec.delta *= 1.5` bei `isInRecoveryWindow()`, ohne
  danach neu zu runden) und ein manueller Custom-Delta konnten ein nicht
  weightStep-ausgerichtetes Delta erzeugen (Modal versprach z.B. 85kg,
  neue Woche zeigte 83.75kg). Fix: Rundung auf `ex.weightStep` direkt in
  `_applyPlannedProgression()` (eine Stelle statt vieler), Funktion
  bekommt `state` als zweiten Parameter für den `plateStep`-Fallback.
  Per Rückfrage zusätzlich Fix B: `_checkPersistentFailure()`/
  `_checkMultiExerciseFailure()` (weeklyFocus.js, Coach-Tab-
  Reduktionsvorschlag bei Dauer-Fehlschlägen) nutzten bisher immer das
  globale `plateStep` statt `ex.weightStep` — jetzt mit Vorrang für
  `ex.weightStep`, analog zu `getWeightRecommendation()`. 5 neue Tests
  (`tests/progression_rounding.spec.js`). Details siehe BUGS.md B101.
  Volle Suite 157/157 grün (5 Tests initial durch Dev-Server-Abbruch
  unter Parallel-Last fehlgeschlagen, isoliert erneut alle grün, kein
  Zusammenhang mit dieser Änderung). state.js + weeklyFocus.js geändert,
  CACHE_VERSION train-v209→v210, CSS/SCHEMA unverändert.
- **B100 — "Letzte Einheit: vor X Tagen" nutzt echten Zeitstempel (train-v209):**
  Nutzer meldete inkonsistente "vor X Tagen"-Werte je nach betrachtetem Tag.
  Diagnose vorab (separate Session): `_dayDate()`/`_trainingContextAnchor()`
  (ui.js) schätzten das Datum eines Tages rein aus `startDate + dayIndex` —
  korrekt nur bei täglichem Training in Array-Reihenfolge, falsch bei
  Splits wie Mo/Mi/Fr. Fix-Vorlage nahm eine nicht existierende Funktion
  `_daysSince()` an und schlug exakt dieselbe (bereits vorhandene, bereits
  fehlerhafte) Index-Formel als "Fix" vor — vor der Umsetzung geprüft:
  diese Formel kann die eigenen Akzeptanzkriterien AC1-5 (dichte Woche)
  und AC6 (Mo/Mi/Fr-Split) nicht gleichzeitig erfüllen, weil eine reine
  Funktion von `dayIndex` nicht wissen kann, welcher reale Wochentag ein
  Slot ist — es gab dafür keine Datenquelle (kein `day.date`/`completedAt`
  im State). Nach Rückfrage (`AskUserQuestion`): Scope-Erweiterung auf
  state.js für ein neues Feld bestätigt. Beim Umsetzen zeigte sich: nicht
  nötig — `day.sessionEndTs` (state.js, `DAY_TOGGLE_COMPLETE`) existiert
  bereits seit SCHEMA 12 und wird bei jedem Tagesabschluss auf den echten
  `Date.now()`-Zeitstempel gesetzt. Neue `_realDayDate(day, week, dayIdx)`
  (ui.js) bevorzugt `sessionEndTs`, dann `sessionStartTs` (Session
  begonnen, noch offen), erst danach die alte Index-Schätzung als
  Fallback für Alt-Daten ganz ohne Zeitstempel. Bleibt dadurch doch bei
  "Nur ui.js" — state.js unverändert. 5 neue Tests
  (`tests/training_context_anchor.spec.js`), darunter ein direkter
  Mo/Mi/Fr-Regressionstest (alt: "vor 9 Tagen" falsch → neu: "vor 2 Tagen"
  richtig). Details siehe BUGS.md B100. Volle Suite 152/152 grün (2
  unabhängige, vorbestehende Parallel-Last-Flakes bei Volllast erneut
  isoliert grün, wie bei B97 dokumentiert). Nur `ui.js` geändert,
  CACHE_VERSION train-v208→v209, CSS/SCHEMA unverändert.
- **B99 — Wochenbezeichnung folgt jetzt echtem Kalenderdatum (train-v208):**
  Nutzer meldete: im Voraus erstellte Zukunftswoche hieß fälschlich
  "Aktuelle Woche", die echte laufende Woche "Letzte Woche". Root Cause
  (Diagnose vorab, separate Session): `_relativeWeekLabel()` verglich gegen
  `getLatestWeek(weeks)` (chronologisch letzte Woche IM ARRAY), nicht gegen
  das echte heutige Datum — abweichend von der Vorlagen-Annahme, die einen
  Vergleich gegen `state.curIdx` vermutete. Zweite Diskrepanz: das
  Wochenrückblick-Dropdown (Fortschritt-Tab) hatte entgegen der Vorlagen-
  Annahme KEINEN Bug — es nutzte bereits die eigene, korrekte `_relDate()`
  gegen echtes `new Date()`. Nach Rückfrage (`AskUserQuestion`, 2 Fragen):
  Nutzer bestätigte (a) beide Funktionen trotzdem zu einer gemeinsamen
  `_weekLabel()` zu konsolidieren (DRY-Präzedenz B44/B45/B74), (b) das
  neue engere Label-Schema ("Diese/Nächste/Letzte Woche" +
  "KW N · Jahr"-Fallback) exakt wie in der Vorlage zu übernehmen, die
  alten Zwischenstufen ("Vorletzte Woche"/"Vor N Wochen"/"In N Wochen")
  fallen weg. Neue `_calendarCurrentWeek(weeks)` + `_weekLabel(week,
  weeks)` (ui.js) — lokale Datumsarithmetik (kein `toISOString()`,
  Zeitzonen-Rollover-Schutz wie im Rest der Codebasis), wiederverwendet
  die bestehende `_isoWeek()` statt einer Neuimplementierung. Beide
  Aufrufstellen (Header, Dropdown) vereinheitlicht. `_isTodayDay()`
  bewusst unverändert gelassen (B82 — Session-Coach-"heute" ist absichtlich
  kein Kalenderdatum). 4 neue Tests (`tests/week_label_calendar.spec.js`).
  Details siehe BUGS.md B99. Volle Suite 147/147 grün. Nur `ui.js`
  geändert, CACHE_VERSION train-v207→v208, CSS/SCHEMA unverändert.
- **B98 — Teilen startet auf Android Download statt Share-Dialog (train-v207):**
  Folge-Vorlage nahm zwei Root Causes an (`canShare()` nicht vor `share()`
  geprüft; `canvas.toBlob()` nicht Promise-gewrappt), die beide bereits
  korrekt im Code waren — nach Rückfrage bestätigt: nicht 1:1 umgesetzt,
  stattdessen der eigentlich diagnostizierte Root Cause (verlorener
  User-Gesten-Kontext durch zwei `await`-Schritte vor `navigator.share()`)
  adressiert, ohne die bestehende Datenschutz-Consent-Funktion (B73) zu
  entfernen. `shareImage.js`: Blob/File jetzt vor dem Consent-Await gebaut
  (ein async-Schritt weniger). `AbortError` löst keinen Download mehr aus,
  jeder andere Fehler weiterhin Download + neues anonymes GoatCounter-Event
  (`share_failed: <ErrorName>`, Observability-Muster wie B66). 3 neue Tests
  (`tests/share_error_handling.spec.js`, gemockte `navigator.share`/
  `canShare` — Zwischenfund: Mock wurde vom echten, asynchron nachladenden
  GoatCounter-Script überschrieben, Tests blockieren die externe Anfrage
  jetzt gezielt). **Nicht mit letzter Sicherheit als vollständig behoben
  bestätigt** (plattformseitige Einschränkung, kein echtes Android-Gerät
  verfügbar) — siehe BUGS.md B98. Volle Suite 143/143 grün. CACHE_VERSION
  train-v206→v207, CSS/SCHEMA unverändert.
- **B97 — Übernehmen-Button auf Mobile unsichtbar, Scroll-Fix (train-v206):**
  Diagnose widerlegte die anfängliche Flex-Wrap/CSS-Hypothese per
  Playwright-Reproduktion (360×800/375×667/412×915) — echter Root Cause
  war ein Scroll-Positions-Problem: `toggle-done` scrollte nie zum neuen
  Feedback, `confirm-set` zentrierte aktiv auf den NÄCHSTEN Satz (drängte
  das gerade gerenderte Feedback aus dem Blickfeld). Fix: `data-di/ei/si`
  auf `.set-feedback`, beide Klick-Pfade scrollen jetzt selbst zum eigenen
  Feedback (`block:'nearest'`), via `setTimeout(50)` (existierendes
  `move-ex-down`-Muster). 6 neue Tests
  (`tests/mobile_feedback_scroll.spec.js`). Details siehe BUGS.md B97.
  CACHE_VERSION train-v205→v206, CSS ?v=200→201, SCHEMA unverändert.
- Letzter Commit: B101 lokal committet, Push steht noch aus (siehe
  „Nächster Schritt" oben). Vorheriger gepushter Commit `a55cc98`
  (train-v209, B100), davor `258b9b0` (train-v208, B99), davor `dcd0656`
  (train-v207, B98), davor `923be73`
  (train-v206, B97), davor `a8e6c45`
  (train-v205, Sprint C2).
- **B96 — Gewichtsreduktion validiert (Sprint C2, train-v205):** drei
  unabhängige Teile, sportwissenschaftlich validiert (Knowles et al. 2018,
  Bell et al. 2024, Bosquet et al. 2013, Pritchard et al. 2015 — siehe
  Research/TRAIN_Parameter_Review.md und DECISIONS.md für vollständige
  Quellenangaben je Parameter).
  **Teil A (Tagesform):** `_isCumulativeSleepDeficit()` (ui.js) unterscheidet
  einmalig schlechten Schlaf (neuer Modifier `reduced_mild`, -5%, alle
  Übungen) von kumuliertem Schlafmangel/niedriger Energie (`reduced`, jetzt
  -10% NUR bei Compound-Übungen, `modifierScope`-Feld). Intra-Session-Coach
  respektiert denselben Scope (nach Rückfrage).
  **Teil B (Deload):** grundlegend umgebaut — reduziert jetzt Volumen
  (Satz-Anzahl, `s.deloadSkip`) statt Intensität (Gewicht). **Blockierende
  Diskrepanz zur Vorlage aufgedeckt:** der bestehende "Plan übernehmen"-Button
  setzte bisher nur einen Gewichts-Delta für die NÄCHSTE Woche, `wk.mode=
  'deload'` war komplett unabhängig davon (manuelles Wochen-Menü) — nach
  Rückfrage: Button öffnet jetzt eine Wahl "Diese Woche" (sofort, nur die
  heute noch offenen Tage) / "Nächste Woche" (aufgeschoben, auch bei
  automatischer Montags-Wocherstellung). Neue Woche NACH einer Deload-Woche
  klont aus der Woche VOR dem Deload (`_findPreDeloadWeek()`). Deload-Sätze
  sind gesperrt+ausgegraut mit "Deload"-Badge, zählen nicht als verpasst.
  **Teil C (Wiedereinstieg):** `_detectReentryPause()` (ui.js) — untere zwei
  Zeitfenster abgeschwächt (8-14 Tage: -10%→-5%, 15-28 Tage: -15%→-10%).
  **Korrektur:** Vorlage nahm für die oberste Stufe fälschlich -30% als
  aktuellen Wert an — real bereits -25%, keine Änderung nötig.
  16 neue Tests (`tests/tagesform_differenziert.spec.js`,
  `tests/deload_volumen.spec.js`, `tests/reentry_faktoren.spec.js`) + 3
  bestehende Tests angepasst. Volle Suite grün. CACHE_VERSION
  train-v204→v205, CSS ?v=199→200, SCHEMA unverändert.
- **B95 — Pausenzeiten nach Trainingsziel + Übungstyp (Sprint C1, train-v204):**
  Nutzer-Anfrage mit vorgegebener, sportwissenschaftlich validierter Tabelle
  (de Salles et al. 2009, Schoenfeld et al. 2016, Grgic et al. 2017/2018),
  vorab per technischer Spec abgestimmt und über 2 Rückfrage-Runden bestätigt.
  **2 blockierende Diskrepanzen zur Vorlage vor der Umsetzung aufgedeckt:**
  (1) `state.settings.goal` existierte nicht — Onboarding fragt zwar ein
  "Hauptziel" ab (`_mainGoal`, ui.js), verwarf es aber bisher; jetzt
  persistiert (kein SCHEMA-Bump, Always-apply-defaults-Muster), neue
  Settings-Zeile zum späteren Ändern. (2) Die vorgeschlagene Compound/
  Isolation-Erkennung über `resolveCategory()` (Squat/Hinge/Push/Pull=
  Compound) widersprach der eigenen Akzeptanzliste der Vorlage — Bizepscurls
  & Co. sind Isolationsübungen, stehen aber unter Push/Pull; neue, eigene
  `isCompoundExercise()` in movementMap.js statt Wiederverwendung der
  B79-Heuristik (die bewusst unverändert bleibt, siehe DECISIONS.md).
  `_pauseSecForRpe(rpe, goal, isCompound)` (sessionCoach.js) ersetzt die alte
  1-Parameter-Tabelle. `buildSetFeedback()` bekommt 2 neue Parameter, alle
  4 Call-Sites (ui.js ×3, timer.js ×1) berechnen `isCompound` selbst —
  `sessionCoach.js` bleibt importfrei (Tiefe 0). Session-Briefing zeigt neu
  "Erwartete Pause". Neue Settings-Zeile "Trainingsziel". 4 bestehende Tests
  an die jetzt korrekten (kleineren) Pausenwerte angepasst, 10 neue Tests
  (`tests/session_coach_pause_matrix.spec.js`). Volle Suite 117/117 grün.
  Details siehe BUGS.md B95, DECISIONS.md.
- **Projekt-Standort verschoben (2026-07-22, keine Code-Änderung):**
  Nutzer meldete vollen OneDrive-Cloud-Speicher. Ursache: `backups/`
  (Milestone-Snapshots, per Konvention nach jedem Sprint erzeugt) war auf
  181 Ordner/~2 GB angewachsen — `.gitignore`d, nie auf GitHub, rein
  lokale Snapshots. Schrittweise Lösung: zunächst `backups/` nach
  `Downloads\` verschoben (lokal, nicht Cloud-synchronisiert) und aus dem
  Projekt gelöscht. Nutzer entschied sich danach für eine dauerhafte
  Lösung: das GESAMTE Projekt liegt jetzt unter `C:\ClaudeProjects\TRAIN`
  (vorher `C:\Users\joojo\OneDrive\Desktop\ClaudeCode\TRAIN`) —
  `C:\ClaudeProjects\` ist bewusst kein OneDrive-Known-Folder (nicht
  Desktop/Documents/Pictures), daher nie Cloud-synchronisiert. Dabei
  außerdem entdeckt und mit verschoben: ein kleinerer, älterer Sibling-
  Backups-Ordner auf ClaudeCode-Ebene (60 Juni-Snapshots, die OneDrive
  während der Aufräumaktion unerwartet aus der Versionshistorie
  wiederhergestellt hatte — ein Sync-Artefakt, kein Datenverlust, alles
  vor dem finalen Löschen per Robocopy-Trockenlauf verifiziert) sowie ein
  verwaister, vollständig redundanter Alt-Klon (`.git`-Ordner mit 155
  Commits, alle bereits Teil der aktuellen 430-Commit-Historie).
  **Git funktioniert am neuen Ort unverändert** (Remote/Historie
  unangetastet, reine Ordner-Verschiebung). **Wichtig für künftige
  Sessions:** aus `C:\ClaudeProjects\TRAIN` starten, nicht aus dem alten
  OneDrive-Pfad (dort nur noch eine leere, ungenutzte Ordnerhülle +
  unangetastetes `.cursor`, siehe CLAUDE.md).
  **Stolperstein nach dem Umzug (gelöst):** der erste Playwright-Lauf am
  neuen Standort zeigte 107/107 rot (`TimeoutError:
  page.waitForSelector`) — keine echte Regression, sondern ein
  verwaister `http-server`-Prozess auf Port 8080 (seit 14.07.2026 gelaufen,
  servierte eine nicht mehr existierende alte Verzeichnisstruktur mit HTTP
  404), den `playwright.config.js`s `reuseExistingServer: true`
  fälschlich wiederverwendet hat statt einen neuen zu starten. Prozess
  beendet, Suite danach 106/107 grün + 1 bekannter Flake
  (`delete_all_data.spec.js`). Bei einem roten Komplettausfall nach
  Standortwechsel/langer Pause immer zuerst prüfen, ob Port 8080 noch
  belegt ist, bevor eine echte Regression vermutet wird.
- **B91-B94 — Session Coach Entscheidungsmatrix v2 + Begründung +
  dauerhafte Übernehmen-Bestätigung (train-v203):** vier zusammenhängende
  Verbesserungen an `buildSetFeedback()`/dem Intra-Session-Coach-Rendering
  in einem Sprint. B91: `_applyModifier()` (sessionCoach.js) dämpfte
  fälschlich auch eine korrekte HALTEN-Empfehlung bei reduzierter
  Tagesform (RPE 7.5 zeigte 52.5kg statt 55kg) — der B84-Fix schützte per
  `>` nur echte Steigerungen, nicht den Halten-Fall (`===`); korrigiert
  auf `>=`. B92: `buildSetFeedback()` kombiniert jetzt RPE UND
  `repDiff = targetReps - reps` (vier Gruppen: deutlich verfehlt/knapp
  verfehlt/erreicht/übertroffen, Wdh-Differenz hat Vorrang vor RPE),
  plus Satz-zu-Satz-RPE-Trend-Erkennung (Anstieg ≥1.5 → Pause ×1.5) —
  neuer `si`-Parameter (Signatur-Erweiterung, alle 3 Call-Sites in
  `ui.js`/`timer.js` angepasst). **Vor der Umsetzung aufgedeckte
  Diskrepanz:** die Sprint-Vorlage widersprach sich selbst zwischen ihrer
  Matrix-Definition und einem eigenen Akzeptanzlisten-Beispiel — nach
  Rückfrage wurde die explizite Matrix-Regel als bindend behandelt. B93:
  neuer "▾ Warum?"-Umschalter zeigt Wdh-Status + RPE-Einordnung +
  Logik-Aussage auf Tap auf (`_setFeedbackExpanded`-Set, ui.js).
  B94: die Übernehmen-Bestätigung (B89) bleibt jetzt dauerhaft sichtbar
  statt nach 2s zu verschwinden, UND bleibt (mit "(rückgängig gemacht)")
  auch nach Undo/manuellem Zurücktippen sichtbar — **bewusste Revision
  von B89, kein Bugfix**, vom Nutzer nach Rückfrage bestätigt. `_acceptedFeedback`
  (vormals `_adoptedSetFeedback`) speichert seit B94 einen vollen Snapshot
  statt nur eines Zeitstempels und ist zusätzlich `wk.id`-präfixiert
  (nicht nur `di-ei-si`) — sonst hätte ein day.id-stabiler Schlüssel
  (siehe B83) über einen Wochenwechsel hinweg bluten können, da der
  Snapshot jetzt beliebig lange bestehen bleibt statt nur 2s. Gelöscht
  bei Tagesabschluss. Alle 4 riskantesten Teile (B91-Guard,
  Undo-Persistenz, Trend-Erkennung, Reopen-Cleanup) per
  Fix-zurücknehmen/bestätigen/wiederherstellen- bzw. echtem
  Reopen-Verhaltenstest verifiziert. Verifiziert per 11 neuen Tests
  (`tests/session_coach_decision_matrix_v2.spec.js`) + 3 angepassten
  Bestandstests (Hint-Wortlaut-Änderung durch B92, korrigierte
  B91-Erwartung, ein jetzt obsoleter B89-"verschwindet nach 2s"-Test
  entfernt). Volle Suite grün. Details siehe BUGS.md B91-B94,
  DECISIONS.md.
- **B66 — erneut untersucht, weiterhin nicht reproduzierbar
  (keine Code-Änderung):** Nutzer bat, B66 erneut zu prüfen. 5 frische
  Reproduktionsversuche gegen den aktuellen Code (train-v200, gegenüber
  train-v185 beim letzten Check) — gezielt gegen alles, was seit der
  Session-Coach-Serie (B76-B85) neu dazukam (frisches Onboarding, 8+
  Wochen mit Schlaf-Korrelations-Schwelle, leeres `days`-Array, bereits
  gesetzter `sessionCheckIn` + `sessionModifier: 'reduced'`, 50 Wochen mit
  Plateau/Deload-Signalen). **Kein einziger `pageerror`/
  `unhandledrejection`** in allen 5 Szenarien. Bleibt beim Stand aus
  train-v185: nicht reproduzierbar, nächster echter Schritt ist weiterhin
  das GoatCounter-Dashboard auf `js_error:`-Events zu prüfen (seit v185
  instrumentiert) — das kann nur der Nutzer einsehen.
- **B86 — ungültiges SVG `height="auto"`-Attribut in progressChart.js
  behoben (train-v201):** Nebenfund während der B66-Reproduktionsversuche
  (kein Zusammenhang mit B66 — reine Konsolen-Warnung, keine Exception,
  kein Toast-Trigger). Drei SVG-Charts (Übungsfortschritt, Körpergewicht,
  Relative Stärke) setzten `height="auto"` als XML-Attribut — ungültig
  für SVG (nur Zahl/Prozent/Einheit erlaubt), der Browser loggte dafür
  bei jedem Rendern `Error: <svg> attribute height: Expected length,
  "auto".` in die Konsole. **Fix:** `height:auto` ins ohnehin vorhandene
  `style`-Attribut verschoben (dort ist "auto" gültiges CSS) — rein
  kosmetischer Markup-Fix, `viewBox` skaliert weiterhin identisch, keine
  visuelle Änderung. Verifiziert per neuem Test
  (`tests/progress_chart_svg.spec.js`) — bewusst mit zurückgenommenem
  Fix laufen gelassen, schlug reproduzierbar mit derselben
  Fehlermeldung fehl, danach Fix wiederhergestellt, Test grün. Volle
  Suite 87/87 grün. CACHE_VERSION train-v200→v201, CSS/SCHEMA
  unverändert.
- **B83 — _skippedCheckIn nach Woche+Tag statt nur Index geschlüsselt
  (train-v200):** Nutzer bat darum, den letzten offenen Nebenfund aus der
  B82-Diagnose-Serie zu fixen. Root Cause war bereits bekannt:
  `_skippedCheckIn` (ui.js, Modul-Set) war nach Tag-Array-Index `di`
  geschlüsselt, nicht nach Woche — ein "Überspringen" hätte den Check-in
  am gleich-indizierten Tag einer später (ohne Reload) betrachteten neuen
  Woche fälschlich mit-übersprungen. **Erster Fix-Versuch (Set nach
  `day.id` statt `di` schlüsseln) erwies sich beim Testen als
  unzureichend** — Diagnose ergab: `WEEK_CREATE` (state.js) klont Tage
  per `clone(lastWeek.days)` und übernimmt dabei bewusst dieselbe
  `day.id` in die neue Woche (repräsentiert denselben wiederkehrenden
  Wochenplan-Slot über alle Wochen hinweg) — im häufigsten Fall (neue
  Woche aus der Vorwoche geklont) wäre das Problem mit `day.id` allein
  also gar nicht gelöst gewesen. **Eigentlicher Fix:** Set jetzt nach
  `${wk.id}_${day.id}` geschlüsselt — `wk.id` wird bei jeder
  Wochenerstellung frisch vergeben und ist die einzige garantiert
  pro-Woche-eindeutige Komponente. Nur `ui.js` geändert. Neuer Test
  (`tests/session_coach.spec.js`, "B83: ...") erstellt eine neue Woche
  OHNE Seiten-Reload und bestätigt, dass der Check-in dort korrekt
  wieder erscheint — bewusst gegen BEIDE unzureichenden Zwischenstände
  (reiner Index, reine `day.id`) laufen gelassen und schlug dort jeweils
  reproduzierbar fehl, bevor der finale Fix ihn grün machte. Volle Suite
  86/86 grün. CACHE_VERSION train-v199→v200, CSS/SCHEMA unverändert.
  **Damit ist die gesamte Session-Coach-Diagnose-Serie abgeschlossen.**
- **B78 — autoStartPauseTimer jetzt auch im toggle-done-Pfad respektiert
  (train-v199):** Nutzer bat darum, den seit der B77-Umsetzung (train-v193)
  in BUGS.md dokumentierten, bewusst zurückgestellten Fund jetzt zu
  fixen. Root Cause war bereits bekannt: `timer.js` hat eine eigene,
  von ui.js unabhängige Klick-Erkennung für den manuellen ✓/✗-Button
  (`_bindAppInteractions()`, `[data-action="toggle-done"]`) — löste den
  Pause-Timer dort UNCONDITIONAL aus, ohne `settings.autoStartPauseTimer`
  zu prüfen. Der `confirm-set`-Pfad (ui.js) prüfte die Einstellung
  bereits korrekt, BEVOR überhaupt das `train:set-done`-Event gefeuert
  wurde. Wer die Einstellung deaktiviert hatte, bekam trotzdem einen
  Auto-Timer über den vermutlich häufiger genutzten manuellen Pfad.
  **Fix:** identische Gating-Bedingung im `toggle-done`-Pfad ergänzt —
  nur `timer.js` geändert, ein Zeilen-Zusatz. 2 neue Tests
  (`tests/intra_session_coach.spec.js`, "B78: ..."): Overlay bleibt bei
  deaktivierter Einstellung jetzt korrekt unsichtbar (per
  Fix-zurücknehmen/bestätigen/wiederherstellen-Zyklus bewiesen, dass der
  Test die Regression tatsächlich fängt), Pfad funktioniert bei
  aktivierter Einstellung weiterhin wie zuvor (kein Regress). Volle
  Suite 85/85 grün. CACHE_VERSION train-v198→v199, CSS/SCHEMA
  unverändert.
- **B85 — Pause-Timer-Overlay zeigt sofort korrekte Sekundenzahl
  (train-v198):** direkter Anschluss an B84 — nach dessen Push war das
  CI-Badge rot (`intra_session_coach.spec.js:139`). Per Vergleich mit
  einem früheren, rein dokumentations-basierten Commit bereits als VOR
  B84 existierend bestätigt (nicht durch B84 verursacht), aber laut
  Projektkonvention trotzdem vor dem nächsten Sprint zu fixen. **Root
  Cause:** `_startPause(seconds)` (timer.js) schrieb die berechnete
  Pausendauer nie synchron ins DOM — `#pause-ring-num` wird nur
  innerhalb von `_tickPause()` aktualisiert, die selbst erst über
  `requestAnimationFrame` (asynchron, frühestens nächster Frame) zum
  ersten Mal läuft. Das initiale Overlay-Markup enthält einen
  hartkodierten Platzhalter `90` — auf einem langsameren/anders
  getakteten CI-Runner konnte ein Auslesen zwischen "Overlay sichtbar"
  (synchron) und "erster rAF-Tick" (asynchron) noch diesen Platzhalter
  zeigen. Reines Timing-Problem, keine Logik-Frage (lokal immer korrekt,
  da der rAF-Tick dort praktisch sofort feuert). **Fix:** `_startPause()`
  schreibt die Sekundenzahl jetzt sofort synchron, bevor der Overlay
  gezeigt und der rAF-Loop gestartet wird — behebt die Race an der
  Quelle statt nur den Test anzupassen. Neuer, deterministischer Test
  (klickt und liest im selben `page.evaluate()`, keine Playwright-IPC-
  Rundreise dazwischen, dadurch unabhängig von rAF-Timing) — per
  Fix-zurücknehmen-und-wieder-herstellen bestätigt, dass er die
  Regression tatsächlich fängt (schlug ohne Fix reproduzierbar mit
  exakt `Received: "90"` fehl, identisch zum CI-Symptom). Volle Suite
  83/83 grün. CACHE_VERSION train-v197→v198, CSS/SCHEMA unverändert.
- **B84 — reduzierte Tagesform dämpft keine echte Steigerung mehr
  (train-v197):** Nutzer meldete, `nextWeight` scheine vom falschen Satz
  berechnet zu werden (Satz 1: 90kg RPE10 → korrekt 87.5kg; Satz 2: 98kg
  RPE6 → 95kg statt erwarteter ~100,5kg). Per Diagnose-zuerst-Auftrag
  untersucht — die vom Nutzer selbst vorgeschlagene Hypothese ("falscher
  Satz/falsches Gewicht wird verwendet") wurde WIDERLEGT: ein Diagnose-
  Log direkt in `buildSetFeedback()` bestätigte, Satz 2 übergibt korrekt
  `{weight: 98, rpe: 6}` — kein Index-/Verwechslungs-Fehler. Eine
  isolierte Reproduktion (bereits bewertete Sätze, kein UI-Interaktions-
  Weg) reproduzierte "95kg" exakt, aber nur mit `sessionModifier=
  'reduced'` gesetzt. **Echter Root Cause:** `_applyModifier()`
  (sessionCoach.js) dämpfte bei reduziertem Tagesstart JEDEN
  Empfehlungswert identisch über `Math.max(nextWeight*0.9, currentWeight
  -step)` — sinnvoll für Halten/Reduzieren, aber bei einer echten
  Steigerung (RPE≤6) ergab dieselbe Formel eine Zahl UNTER dem gerade
  gehobenen Gewicht (98kg → 95kg), obwohl der Hinweistext "steigern"
  zeigte. Satz 1 war korrekterweise gedämpft (Reduzieren-Zweig bei
  RPE10) — der Nutzer hatte diesen Fall fälschlich als unproblematischen
  Referenzwert eingeordnet, unterlag aber derselben (dort passenden)
  Logik. **Fix:** `_applyModifier()` dämpft nur noch wenn `nextWeight <=
  currentWeight`; eine echte Steigerung bleibt immer exakt
  `currentWeight + step`. Nur `sessionCoach.js` geändert (ui.js-Aufruf
  war bereits korrekt, Constraint eingehalten). 3 neue Tests
  (`tests/session_coach_reduced_modifier.spec.js`, in CI): Steigerung
  bei reduziertem Tagesstart jetzt korrekt 100kg (nicht mehr 95kg),
  Halten-Fall bleibt weiterhin korrekt gedämpft (kein Regress),
  Normalfall ohne Modifier unverändert. Neue DECISIONS.md-Entscheidung
  ("Reduzierte Tagesform dämpft nur Halten/Reduzieren, nie eine echte
  Steigerung"). Volle Suite 82/82 grün. CACHE_VERSION train-v196→v197,
  CSS/SCHEMA unverändert.
- **B82 — Session Coach "heute" = aktiver Tag statt kalendarisch
  (train-v196):** direkter Anschluss an die vorherige reine Diagnose-
  Session (keine Änderungen dort). Root Cause bereits vollständig
  bekannt: `_isTodayDay(wk, di)` leitete das Datum eines Tages rein aus
  seinem Array-Index ab (`wk.startDate + di Tage`) — bei einem 3x/Woche-
  Split (z.B. Mo/Mi/Fr) berechnete das für Tag-Index 2 ("Freitag"
  gemeint) immer Mittwoch, wodurch Pre-Session Check-in, Intra-Session
  Feedback UND Pause-Timer-Empfehlung (alle drei teilen sich exakt diese
  eine Gating-Funktion) nie erschienen. Nutzer gab die Produktentscheidung
  vor: "heute" bedeutet für den Session Coach nicht mehr kalendarisch,
  sondern "offener Tag in der aktuellen Trainingswoche" (siehe
  DECISIONS.md). **Abweichung von der vorgeschlagenen Umsetzung, nach
  Verifikation gegen den echten Code korrigiert:** die Vorlage schlug
  `wk.startDate === state.weeks[state.curIdx].startDate` vor — das ist
  aber eine Tautologie (an jeder Aufrufstelle IST `wk` bereits exakt
  `state.weeks[state.curIdx]`, siehe `render()` ui.js:647) und
  `WEEK_NAVIGATE` ändert `curIdx` auch beim reinen Durchblättern
  vergangener Wochen — mit der vorgeschlagenen Formel wäre Session Coach
  fälschlich auch in alten, längst abgeschlossenen Wochen wieder
  aufgetaucht, sobald der Nutzer dorthin navigiert (verifiziert per
  eigenem Playwright-Test, der dieses Szenario abdeckt). Stattdessen
  gegen `getLatestWeek(state.weeks)` verglichen — dieselbe, bereits an
  anderer Stelle etablierte Lösung für "aktuelle Woche, unabhängig von
  Navigation" (`_relativeWeekLabel()`, B72). Kein neues State-Feld,
  SCHEMA unverändert, nur `ui.js` geändert (Constraint eingehalten).
  **Nebenbefund dokumentiert, nicht gefixt (B83, Low):**
  `_skippedCheckIn` (Modul-Set, keyed nur nach Tag-Index) wird nie
  zurückgesetzt — Effekt verschwindet spätestens beim nächsten
  Seiten-Reload, daher bewusst zurückgestellt. Verifiziert per 5 neuen
  Tests (`tests/session_coach_active_week.spec.js`, in CI): Mo/Mi/Fr-
  Split-Szenario zeigt jetzt korrekt Session Coach, abgeschlossene Tage
  weiterhin nicht, eine vergangene Woche (nach Zurück-Navigation) zeigt
  weiterhin nichts (genau der Fall, den die naive Umsetzung gebrochen
  hätte), mehrere gleichzeitig offene Tage zeigen beide korrekt,
  Intra-Session-Feedback erscheint nach Satz+RPE. Volle Suite grün (1
  bekannter Flake bei `delete_all_data.spec.js` unter Parallel-Last,
  isoliert erneut grün — vorbestehend, siehe LOOPS.md, kein
  Zusammenhang mit diesem Fix). CACHE_VERSION train-v195→v196,
  CSS/SCHEMA unverändert.
- **B81 — eigener Datenschutz/Backup-Onboarding-Screen (train-v195):**
  Nutzer fragte gezielt nach, ob die in den neuen Advisor-Exports
  (for-advisor-product.txt/-ux.txt) genannte Lücke ("Vertrauens-Moment
  für kein Cloud-Backup sollte im Onboarding selbst stehen, nicht nur in
  den Einstellungen") bereits umgesetzt wurde. Antwort: teilweise — B60
  (train-v182) hatte dafür einen einzelnen Satz auf dem plattform-
  abhängigen Install-Screen ergänzt. Beim genaueren Hinsehen (Code-Fund,
  nicht nur Doku-Abgleich): dieser Install-Screen selbst läuft nur
  bedingt (`_afterPrivacy()`, ui.js) — nur bei iOS oder eingefangenem
  `beforeinstallprompt` (Android/Chrome/Edge). Desktop-Firefox-Nutzer
  oder bereits als PWA installierte Nutzer übersprangen den ganzen
  Screen und sahen den Hinweis NIE. Nutzer bat darum, das jetzt richtig
  zu lösen: ein eigener Screen statt nur ein Satz. **Umsetzung:** neuer
  `_obPhase='privacy'` (ui.js) läuft UNCONDITIONAL direkt nach der
  Vorlagen-Wahl (nach "Vorlage laden" UND nach "Ohne Vorlage starten"),
  vor dem weiterhin bedingten Install-Screen — `_afterSetup()` führt
  jetzt dorthin, die alte Install-Entscheidungslogik wanderte in eine
  neue `_afterPrivacy()`. Eigener, optisch abgesetzter Warnkasten
  (`.ob-backup-warn` — bereits seit einem früheren Onboarding-Entwurf in
  styles.css vorhanden, aber bis dahin nirgends verwendet; jetzt
  erstmals bespielt statt eine neue CSS-Klasse anzulegen, daher kein
  CSS-Versions-Bump nötig). Der redundante Einzeiler auf dem Install-
  Screen wurde entfernt (ersetzt, nicht dupliziert). Kein neues State-
  Feld, SCHEMA unverändert. Verifiziert per 2 neuen Tests
  (`tests/onboarding_privacy_screen.spec.js`, in CI): beide Pfade
  (Vorlage laden / Leer-Start) zeigen den Screen, Fortsetzen führt in
  Headless-Chromium (kein iOS, kein `beforeinstallprompt`) direkt zur
  fertigen App. Per Screenshot visuell verifiziert (Schloss-Icon, Titel
  "Deine Daten bleiben bei dir", Warnbox, Weiter-Button — konsistent zum
  bestehenden Onboarding-Stil). Volle Suite 74/74 grün. CACHE_VERSION
  train-v194→v195, CSS/SCHEMA unverändert.
- **Loops 7-11 ergänzt: Advisor-Exports für alle Perspektiven (kein
  Code-Sprint, reine Doku/Prozess-Änderung, CACHE_VERSION/CSS/SCHEMA
  unverändert):** Bisher gab es nur zwei Advisor-Export-Formen: einen
  rein technischen Code-Export (`for-advisor.txt`, Loop 5) und vier
  einmalige, nicht wiederkehrende Cross-AI-Review-Dokumente (Legal/
  Security/Produkt-UX/Business-Ethik, Stand 2026-07-18, in
  `context-exports/advisor-*.txt`). Nutzer bat um fünf neue, REGELMÄSSIG
  aktualisierte Perspektiven-Exporte in Alltagssprache (kein Code
  vorausgesetzt): `for-advisor-product.txt` (vollständig — Nordstern,
  komplette User Journey inkl. Session Coach, Coach-Kaskade in
  Alltagssprache, Feature-Status, bewusste Entscheidungen, offene
  Produktfragen), `for-advisor-market.txt` (vollständig — Positionierung
  als "Intra-Session Decision Support", 4 direkte Konkurrenten mit
  aktuellen Preisen 2026 [Hevy Pro ~2-9$/Mo, Strong Pro ~2,50-5$/Mo,
  Fitbod ~8-16$/Mo, RP Hypertrophy konzeptionell], Preispositionierung,
  Zielgruppen-Überschneidung, grobe Marktgröße, offene Marktfragen),
  `for-advisor-ux.txt` (Kurzfassung — Onboarding-Flow, bekannte
  UX-Probleme inkl. "kein Usability-Test je gemacht", was bereits gut
  funktioniert, offene UX-Fragen), `for-advisor-growth.txt` (Kurzfassung
  — aktueller Stand [0 Nutzer, B55 einziger Blocker], geplante Kanäle,
  Share-Feature als Wachstums-Hebel, Retention-Mechanismus,
  Monetarisierung-Timing, offene Growth-Fragen), sowie
  `for-advisor-consolidated.txt` (liest die vier vorigen Dateien und
  fasst sie zusammen: Produkt+Markt vollständig, UX+Growth als
  Kurzfassung ohne die reinen Flow-/Kanal-Details, plus eine
  konsolidierte, deduplizierte, in HOCH/MITTEL/NIEDRIG priorisierte
  Liste ALLER offenen Fragen aus allen vier Quellen — der empfohlene
  Startpunkt für neue externe Advisor-Chats). Neue **Loops 7-11** in
  LOOPS.md (alle AKTIV, laufen am Ende jeder Session nach Loop 5+6 in
  dieser Reihenfolge) sowie neue Datei `prompts/neuer-advisor-chat.txt`
  (Anleitung: `for-advisor-consolidated.txt` in einen neuen externen Chat
  einfügen + einen von 5 thematischen Fokus-Zusätzen ergänzen: Markt &
  Konkurrenz / UX & Onboarding / Growth & Distribution /
  Monetarisierung / Produkt-Roadmap). CLAUDE.md-Projektdokumente-Tabelle
  um die 5 neuen Dateien ergänzt. Regressionstest trivial grün (keine
  Code-Änderung in diesem Sprint).
- **GoatCounter-SRI verifiziert, Loop 6 ergänzt (kein Code-Sprint, reine
  Doku/Prozess-Änderung, CACHE_VERSION/CSS/SCHEMA unverändert):** Nutzer
  bat um einen SRI-Hash-Fix für GoatCounter (unversionierte URL ohne
  Integritätsprüfung). Vor der Umsetzung geprüft: der Fix existiert
  bereits seit train-v182/v183 (`index.html`, `<script>`-Tag mit
  `src="https://gc.zgo.at/count.v5.js"` + `integrity="sha384-..."` +
  `crossorigin="anonymous"`, echter Site-Code `train.goatcounter.com`)
  — kein neuer Fund, keine Änderung an index.html nötig. Nutzer bat
  danach um eine dauerhafte periodische Prüfung, ob GoatCounter eine
  neuere `count.js`-Version veröffentlicht hat. Reale Release-Historie
  recherchiert (v1 Dez 2020 → v2 Mär 2021 → v3 Dez 2021 → v4 Dez 2023 →
  v5 Jun 2025, kürzester Abstand 3 Monate) — auf Basis dieser Cadence
  ein 90-Tage-Intervall statt der ursprünglich vorgeschlagenen 2-4
  Wochen empfohlen (der Hash ist ohnehin bewusst gepinnt, kein
  Sicherheitsrisiko bei Veralten, daher kein Grund für eine
  hochfrequente Prüfung) — vom Nutzer bestätigt. Neuer **Loop 6** in
  LOOPS.md: liest bei jedem Sessionstart nur ein gespeichertes
  "Letzte Prüfung"-Datum (billig), macht den echten Abruf von
  `https://www.goatcounter.com/help/countjs-versions` nur wenn ≥90 Tage
  vergangen sind; bei neuerer Version wird NICHT automatisch
  umgestellt, sondern der Nutzer informiert und um Bestätigung gebeten
  (analog zur bestehenden Push-Policy für Loop 1/3). Aktueller Stand
  (2026-07-21): count.v5.js weiterhin aktuell, Hash bestätigt korrekt.
  Siehe BUGS.md B80.
- **B79 — Session Summary + Schlaf-Korrelation + Compound/Isolation-Balance
  + Deload-Plan (train-v194):** Nutzer-Anfrage ("SPRINT 3 — Session Summary
  + Schlaf-Korrelation"), vorab per technischer Spec abgestimmt und über
  eine Rückfrage-Runde bestätigt (`AskUserQuestion`, Deload-Plan-Scope).
  Vorlage enthielt 6 Diskrepanzen zum echten Code, offengelegt statt
  stillschweigend übernommen: (1) "sessionEnergyPost-Abfrage (aus Sprint 1)"
  existiert nicht — B76 hat sich explizit GEGEN dieses Feld entschieden, der
  reale Flow ist der schon lange bestehende `_showDayCompletionModal()` →
  `_finishCompletion()` → `_showCompletionScreen()`. (2) `weekSuccessCounts()`
  arbeitet auf einer Woche, nicht einem Tag — eigene Tages-Formel in
  `sessionSummary.js` geschrieben. (3) "Deload einplanen" kommt als Text
  nirgends vor — reale Strukturkarte zeigt "X Wochen ohne Deload —
  Regenerationswoche einplanen.". (4) PR-Delta lässt sich zum
  Abschlusszeitpunkt nicht aus `ex.prWeight` rekonstruieren (bereits
  überschrieben, wie B63/B70) — Delta stattdessen gegen `exWeightHistory()`
  der Vorwochen berechnet. (5) Vorlagen-Beispieltext nannte "Zielerreichung",
  die vorgegebene Berechnung liefert aber Erfolgsquote — korrekt beschriftet.
  (6) `EX_AUTO_PRESELECT_NEXT_WEEK_PLAN` existiert bereits als Batch-Action
  für den Deload-Plan — wiederverwendet statt neuer Action.
  **Umsetzung:** neues Modul `sessionSummary.js` (Tiefe 3):
  `buildSessionHighlights()` (max. 3, Priorität PR > RPE-Warnung >8.5 >
  Ziel erreicht), `buildSessionEinordnung()` (Kaskade a-f), `buildNext
  SessionPreview()`, `calcSleepCorrelation()`. Neuer Session-Summary-Screen
  (Vollbild-Overlay mit "Weiter"-Button) zwischen `_finishCompletion()` und
  dem bestehenden Tagesabschluss-Screen, Urlaubstage überspringen sie.
  Schlaf-Erkenntnis einmalig bei ≥8 echten Wochen + ≥6 Tagen mit
  `sessionCheckIn.sleep` + Diff ≥15% (`localStorage['train_sleep_insight_shown']`).
  Neues 5. Strukturkarten-Signal `_checkCompoundIsolationBalance()`
  (weeklyFocus.js, niedrigste Priorität) bei <60% Compound-Sätzen. Deload-
  Plan-Tabelle unter der `deload_preventive`-Karte (alle Übungen aller Tage
  der aktuellen Woche — Rückfrage bestätigt, Coach-Tab kennt keinen
  "aktuellen Tag"), "Plan übernehmen" dispatcht `EX_AUTO_PRESELECT_
  NEXT_WEEK_PLAN` mit den Gewichts-Deltas für alle Übungen auf einmal.
  **Test-Infrastruktur-Erkenntnis:** mehrwöchige Fixtures mit weit
  zurückliegenden, aber `markedDone:true`-Wochen lösten den bestehenden
  Wiedereinstiegs-Popup aus (2s nach App-Start) — alle B79-Tests nutzen
  seither Datums-Helper relativ zu "heute" (siehe BUGS.md Fallstricke-Tabelle).
  Verifiziert per 13 neuen Tests (`tests/session_summary.spec.js`, in CI, 2×
  hintereinander stabil grün) + 2 Screenshots. 1 bestehender Test
  (`share_image.spec.js`) um einen Klick auf den neuen "Weiter"-Button
  ergänzt. CACHE_VERSION train-v193→v194, CSS ?v=196→197, SCHEMA
  unverändert. Volle Suite 72/72 grün.
- **B77 — Intra-Session Coach (train-v193):** Nutzer-Anfrage ("SPRINT 2 —
  Intra-Session Coach"), vorab per technischer Spec abgestimmt und über 2
  Rückfrage-Runden bestätigt (`AskUserQuestion`). Vorlage enthielt mehrere
  Diskrepanzen zum echten Code, offengelegt statt stillschweigend
  übernommen: (1) RPE hat Halbschritte (6/6.5/7/7.5/8/8.5/9/9.5/10) — die
  Vorlagen-Logik prüfte nur Ganzzahlen, per Bereichsvergleichen korrigiert.
  (2) Zwei sich überschneidende `if`-Blöcke für RPE 8 in der Vorlage — durch
  `s.status` (kanonisches "Ziel-Wdh erreicht?") statt erneuter
  reps-Prüfung ersetzt. (3) Teil B (Gewicht ohne RPE) sollte laut Vorlage
  `getWeightRecommendation()` für den nächsten SATZ derselben Session
  verwenden — widerspricht der B76-Entscheidung ("nur nächste Woche") und
  liefert bei <2 Wochen Historie `null`; nach Rückfrage: eigene,
  session-lokale Logik in neuer `sessionCoach.js`, B76-Entscheidung bleibt
  unangetastet. (4) Teil C (Favoriten-RPE-Nudge) hätte eine zweite,
  parallele Nudge-Komponente neben der bereits bestehenden `.rpe-nudge`
  gebaut — nach Rückfrage: bestehende Komponente erweitert statt dupliziert.
  (5) Teil E (Aufwärm-Empfehlung) hätte denselben Namen wie das bestehende
  freie Aufwärm-Textfeld (`day.warmup`) verwendet — nach Rückfrage: eigener,
  klar anders benannter Block.
  **Zusatzfund während der Umsetzung:** `timer.js` hat eine eigene, von
  ui.js unabhängige Klick-Erkennung für `[data-action="toggle-done"]`
  (`_bindAppInteractions()`) — löst den Pause-Timer UNCONDITIONAL mit dem
  statischen `ex.pauseSec` aus (anders als der `confirm-set`-Pfad, der
  `autoStartPauseTimer` respektiert). Ohne Fix hätte die neue
  Pause-Empfehlung nur den selteneren `confirm-set`-Pfad erreicht, nicht
  den vermutlich häufigeren manuellen ✓/✗-Icon-Pfad. Gefixt: `timer.js`
  importiert neu `sessionCoach.js` (importfrei, Tiefe 0 — keine
  ui.js-Kopplung). Die vorbestehende `autoStartPauseTimer`-Inkonsistenz
  selbst NICHT mitgefixt (out of scope), als **B78** in BUGS.md dokumentiert.
  **Umsetzung:** neues Modul `sessionCoach.js` (Tiefe 0): `buildSetFeedback()`
  (Gewicht/Pause/Hint für den nächsten Satz), `buildLastSetMessage()`
  (Abschluss-Text, einziger legitimer `getWeightRecommendation()`-Aufrufer
  für die Nächste-Woche-Projektion), `buildWarmupSets()` (50/70/85%-Formel).
  Feedback-Text rein render-abhängig — erscheint identisch ob per
  `toggle-done` oder `confirm-set` bewertet. `.rpe-nudge` erweitert um
  Favoriten-Variante (Favorit + erste 4 echte Wochen + Sitzungs-/
  localStorage-Zähler-Caps, "Nie für diese Übung" persistiert). Neuer
  "📋 Aufwärm-Empfehlung"-Block, Default zugeklappt, gated wie Check-in/
  Briefing. Verifiziert per 10 neuen Tests (`tests/intra_session_coach.spec.js`,
  in CI) + 2 Screenshots. CACHE_VERSION train-v192→v193, CSS ?v=195→196,
  SCHEMA unverändert (32).
- **B76 — Pre-Session Check-in + Session Briefing (train-v192):** Nutzer-
  Anfrage, vorab per technischer Spec abgestimmt und bestätigt ("passt so,
  leg los"). Vorlage enthielt mehrere Diskrepanzen zum echten Code, per
  `AskUserQuestion` geklärt statt stillschweigend übernommen: (1)
  `day.energyLevel` existiert bereits — kein neues `sessionEnergyPost`-Feld,
  bestehendes Feld wiederverwendet. (2) `getWeightRecommendation()` betrifft
  nur die Empfehlung für die NÄCHSTE Woche, nie die bereits gesetzten
  Gewichte der laufenden Session — die -10%-Reduktion mutiert stattdessen
  `ex.sets[].weight` direkt im Reducer. (3) Kein `'in_progress'`-Satzstatus
  existiert. (4) SCHEMA stand bereits bei 31, nicht 30 — Migration daher
  v31→v32. **Umsetzung:** Zwei-Tap-Check-in (Schlaf + Energie, Button-Grid,
  `_checkInDraft` Map, automatischer Dispatch nach beiden Feldern, kein
  Zwischenstand-Persistieren) erscheint nur am heutigen, noch offenen,
  nicht-Urlaubstag, solange Settings-Toggle "Session Coach" (neu, Default
  an) aktiv ist. Danach (oder direkt bei "Überspringen") ersetzt ein
  auf-/zuklappbares Briefing (`_renderSessionBriefing()`) den Check-in:
  Nachricht je nach Schlaf/Energie-Kombination, Fokus-Übung (erste Squat/
  Hinge/Push-Übung des Tages via bestehendem movementMap.js), RPE-Ziel
  relativ zum Vorwochen-Schnitt (±1 je nach Modifier). Bei `reduced`
  (schlecht geschlafen ODER wenig Energie) reduziert der neue
  `SESSION_CHECKIN_SET`-Reducer alle noch `pending` Gewichtssätze der
  heutigen Übungen einmalig um 10%, gerundet auf die pro-Übung-
  Schrittweite. Verifiziert per 6 neuen Tests (`tests/session_coach.spec.js`,
  in CI) + 2 Screenshots (Check-in-UI, Briefing nach "gut geschlafen/hohe
  Energie"). CACHE_VERSION train-v191→v192, CSS ?v=194→195, SCHEMA 31→32.
  Volle Suite 49/49 grün.
- **B75 — Toast beim Auto-Backup, kein Trigger-Bug (train-v191):** Nutzer
  meldete, ein Auto-Backup-Download erscheine beim Klick auf "Teilen" im
  Fortschritt-Tab. Diagnose zuerst (keine Änderungen): 5 realistische
  Reproduktionen (Auto-/manuelle Wochenerstellung × Dropdown-Teilen ×
  Wochenwechsel-Modal-Teilen) zeigten in keinem Fall einen Download beim
  Teilen-Klick — `exportJSONAuto()` hat genau eine Aufrufstelle
  (`ui.js:6540`), reagiert ausschließlich auf `state.weeks.length`-Zuwachs,
  kein gemeinsamer Codepfad mit dem Share-Button. Rückfrage beim Nutzer
  (Android, immer derselbe Dropdown-Button, **nur** in Kombination mit
  kurz zuvor erstellter Woche) bestätigte: der Trigger war die ganze Zeit
  korrekt. Ursache: der Download passierte bisher unangekündigt (kein
  Toast) — fiel auf Android erst beim nächsten Tap auf und wurde
  fälschlich dem Teilen-Klick zugeschrieben. **Fix (nach Rücksprache, kein
  Trigger geändert):** `showToast('💾 Automatisches Backup gespeichert')`
  direkt an der bestehenden Auslösestelle ergänzt. 2 neue Tests
  (`tests/autobackup_toast.spec.js`, in CI). CACHE_VERSION
  train-v190→v191, CSS/SCHEMA unverändert. Volle Suite 43/43 grün.
- **B74 — Streak-Konsolidierung (train-v190):** Nutzer meldete "Streak
  zeigt 0 bei neuer Woche", mit explizitem Diagnose-zuerst-Auftrag (keine
  Änderungen). Der wörtliche Fall reproduzierte NICHT — das ist der
  bereits in B69 (train-v186) behobene Bug, Fix intakt (per frischer
  Reproduktion UND dem bestehenden `streak_inprogress_week.spec.js`
  bestätigt). **Tatsächlich gefunden:** `weekReview.js`s eigenständige
  `_calcStreak()` (nur `days.some(d => d.markedDone)`, kein Schwellenwert,
  keine Kalenderlücken-Prüfung) wich vom korrekten Training-Tab-Badge
  (`calcCurrentStreak()`, state.js) ab — speist sowohl das Wochenrückblick-
  Modal als auch das Share-Bild. Konkret nachgewiesen: Teilabschluss (1/4
  Tage) → Training-Tab 2, Wochenrückblick/Share-Bild fälschlich 3;
  Kalenderlücke (3 Wochen ausgesetzt) → Training-Tab korrekt 2,
  Wochenrückblick/Share-Bild fälschlich 4 (zählt durch die Lücke durch —
  das Share-Bild hätte eine objektiv falsche Zahl öffentlich geteilt).
  **Fix:** `_calcStreak()` delegiert jetzt an `calcCurrentStreak()` (state.js,
  analog zum bestehenden `isTrainingDay()`-Import), konsolidiert zwei
  Implementierungen auf eine (Muster wie B44/B45/B47). 2 neue Tests
  (`tests/streak_weekreview_consistency.spec.js`, in CI).
  **Zusätzlich geprüft (Share-Bild-Feinschliff aus derselben Sprint-
  Vorlage):** alle 3 angeforderten Korrekturen (Hook-Satz zentrieren,
  Leerraum unten reduzieren, Stats-Kacheln vergrößern) waren bereits
  erfüllt — keine Änderung an shareImage.js nötig, teils hätten die
  Vorlagen-Werte sogar eine Verschlechterung bedeutet (Kacheln sind
  bereits 120px, größer als die angeforderten 100px). CACHE_VERSION
  train-v189→v190, CSS/SCHEMA unverändert. Volle Suite 41/41 grün.
- **B73 — Share-Bild v3: Favoriten-Kaskade, Hook-Satz im Fallback,
  Retina-Deckelung, PR-Moment-Toast, Datenschutz-Hinweis (train-v189):**
  Nutzer bestätigte eine vorab vorgelegte technische Spec ("Bestätigung
  für alle 6 Punkte... ja"). Vorlage enthielt erneut mehrere Diskrepanzen
  zum echten Code (falsche Versionsstände train-v181/?v=195/"SCHEMA
  unverändert (30)" — real train-v188/?v=193/SCHEMA 31; bereits vergebene
  BUGS.md-IDs B61-B64; "PR-Moment-Bild fehlte" war sachlich falsch,
  existiert seit B68; `_pickBestExercise`-Signatur und PR-Erkennungslogik
  passten nicht zur echten Datenstruktur — `_findPR()` liefert nur EINEN
  PR-Highlight/Woche, favoritenblind, kein `weightDiff`-Feld; `Object.
  entries()` auf einer `Map` in der Vorlage war ein echter Bug), vor der
  Umsetzung offengelegt und korrigiert.
  **Umsetzung:** 1) Favoriten-Kaskade (`_pickBestExercise()`,
  weekReviewModal.js, 6 Prioritäten) — PR-Erkennung über direkten
  `s.prBadge`-Scan statt `highlights`. `favoriteExercises` an 3 Stellen
  in ui.js an `reviewData` angehängt. 2) Hook-Satz aus B71 gilt jetzt ab
  2 statt erst ab 3 Datenpunkten. 3) `_buildCanvas()`: DPR bei 3x
  gedeckelt. 4) Fallback bei 0/1/2 Datenpunkten differenziert. 5) Neuer
  PR-Moment-Toast direkt nach `toggle-done`/`confirm-set` bei echtem
  `s.prBadge === 'weight'`, unabhängig vom Tagesabschluss-Screen.
  `buildPrShareCanvas()` komplett neu aufgebaut (Trophäe, Name,
  Gewicht×Wdh, optional "Vorheriger Rekord"+Differenz). **Nach
  Screenshot-Prüfung erneut** (zweites Mal nach B71) einen eigenen
  Leerraum-Fehler in der PR-Bild-Neufassung gefunden und korrigiert —
  Zonen großzügiger verteilt, Footer jetzt dynamisch direkt nach dem
  Inhalt statt an fixer Position. 6) Datenschutz-Hinweis zentral in
  `shareCanvas()` (`localStorage['train_share_consent']`) — läuft für
  alle 4 Share-Einstiegspunkte durch dieselbe Implementierung. 4
  bestehende Tests mussten wegen des neuen Consent-Gates angepasst
  werden (Flag vorab gesetzt, nicht deren Testgegenstand). 10 neue Tests
  (`tests/share_image_v3.spec.js`, in CI). CACHE_VERSION
  train-v188→v189, CSS ?v=193→194. Volle Suite 39/39 grün.
- **B72 — Auto-Wochenrückblick zeigte 0/0 trotz echter Trainingshistorie,
  gefixt (train-v188):** Nutzer meldete, dass das Share-Bild teils falsche
  (leere) Daten zeigte. Erst per reiner Diagnose-Anfrage (keine Änderungen)
  untersucht: der Code arbeitet für den Normalfall korrekt (mit
  realistischen Testdaten reproduziert: exakte, richtige Werte). Root
  Cause dann gezielt gesucht und **per echter Reproduktion bestätigt**
  (nicht nur vermutet): `_runAutoWeekFlow()` (ui.js) nahm
  `sorted[sorted.length - 2]` blind als "die Vorwoche" an — bricht, wenn
  eine manuell vorausgeplante Woche mit zukünftigem `startDate` bereits
  existiert (das Datumsfeld bei "Neue Woche" erlaubt jedes Datum). Diese
  leere Zukunftswoche rutscht zwischen die echte letzte Trainingswoche und
  die soeben automatisch erstellte aktuelle Woche — die Positions-Annahme
  trifft dann die leere Woche statt der echten. Playwright-Reproduktion
  bestätigte exakt das gemeldete Symptom. **Fix:** `prevWeek` wird jetzt
  rückwärts gesucht (letzte Woche mit ≥1 `markedDone`-Tag), nicht mehr
  positional geraten. **Zusätzlich:** Teilen-Button jetzt auch im
  manuellen Wochenrückblick-Dropdown (Fortschritt-Tab) verfügbar — jede
  dort wählbare Woche hat durch den bestehenden Filter garantiert echte
  Daten, umgeht die B72-Falle also strukturell. Teilen-Logik dafür aus dem
  Modal-Handler in eine gemeinsame `shareWeekReviewImage()`
  (weekReviewModal.js) extrahiert, von beiden Einstiegspunkten genutzt.
  2 neue Tests (`tests/share_image_autoweek_fix.spec.js`, in CI) plus
  Screenshot-Verifikation über den echten Klick-Handler (3 reale Wochen,
  korrekt "+10kg in 3 Wochen 🏆", vorausgeplante leere Woche ignoriert).
  Nebenbei einen eigenen Doku-Fehler aus dem B71-Sprint gefunden und
  behoben: die DECISIONS.md-Einfügung hatte die "Gilt"-Zeile des
  scrollTop-Restore-Eintrags ans Dateiende verschoben, korrigiert.
  CACHE_VERSION train-v187→v188, CSS/SCHEMA unverändert. Volle Suite
  34/34 grün.
- **Share-Bild v2 — Sparkline-Redesign (B71, train-v187):** Nutzer
  bestätigte eine vorab vorgelegte technische Spec ("passt so, leg
  los"). Die Sprint-Vorlage enthielt mehrere Diskrepanzen zum echten
  Code, die vor der Umsetzung offengelegt statt stillschweigend
  übernommen wurden: falsche Versionsstände (Vorlage ging von
  "Share-Bild v178"/Ziel-"v179" aus — das Feature wurde tatsächlich erst
  als B68 in v186 gebaut), eine nirgends existierende
  `generateWeekImage(weekData, state)`-API mit erfundenem
  `weekData`-Objekt, `exWeightHistory()` fälschlich in
  `progressInsights.js` statt tatsächlich `insightEngine.js` verortet,
  und ein falscher Aufrufort (`ui.js` statt tatsächlich
  `weekReviewModal.js`, wo der Teilen-Button seit B68 lebt). Umsetzung
  entsprechend korrigiert: `ui.js` hängt an beiden
  `buildWeekReview()`-Aufrufstellen `allWeeks` an reviewData an (einzige
  ui.js-Änderung); `weekReviewModal.js` importiert neu
  `getSortedWeeks`/`exWeightHistory` (insightEngine.js) und ermittelt
  die Bild-Übung selbst (PR-Highlight dieser Woche > höchstes
  Wochenvolumen); `shareImage.js`s `buildWeekShareCanvas()` komplett neu
  aufgebaut (4-Zonen-Layout, Bezier-Sparkline, Gradient-Fill, Glow auf
  letztem Punkt, dynamischer Hook-Satz, Fallback bei <3 Datenpunkten).
  **Nach Screenshot-Prüfung (Canvas als data-URL geöffnet, wie von der
  Vorlage selbst gefordert)** einen eigenen Layout-Fehler gefunden und
  korrigiert: die erste Umsetzung nach den Vorlagen-Koordinaten ließ
  ca. 300px ungenutzten Leerraum am unteren Bildrand — genau das
  Problem, das dieses Redesign eigentlich beheben sollte. Vertikaler
  Rhythmus neu verteilt (Sparkline-Box 260→330px, Kacheln/Footer nach
  unten verschoben), Leerraum auf ~117px reduziert. CSS-Version bewusst
  NICHT gebumpt (kein CSS geändert, abweichend von der Vorlagen-Angabe
  "?v=193" bei fälschlicher Annahme einer CSS-Änderung). 4 neue Tests
  (`tests/share_image_sparkline.spec.js`, in CI). Volle Suite 32/32
  grün. CACHE_VERSION train-v186→v187, CSS/SCHEMA unverändert.
- **Share-Bild-Feature + 2 weitere Nutzer-Bugmeldungen (train-v186):**
  Nutzer bestätigte die Share-Bild-Spec aus dem vorherigen Sprint
  ("passt so, leg los") und meldete gleichzeitig 3 weitere mögliche
  Bugs. Diagnose vor Fix (CLAUDE.md-Regel) für jeden einzeln:
  - **Wochenrückblick öffnet sich automatisch (kein Bug):** bestätigt
    als das bereits bestehende `AUTO_WEEK_CREATE`/`_runAutoWeekFlow()`-
    Feature (Sprint C3, train-v110) — legt montags beim Öffnen
    automatisch eine neue Woche an und zeigt optional den Rückblick der
    Vorwoche (`settings.autoWeek.showReview`, per Settings abschaltbar).
    Nutzer-Verdacht war selbst schon korrekt. In BUGS.md unter "BEWUSST
    KEIN BUG" dokumentiert.
  - **B69 (gefixt) — Streak zeigt 0 trotz konsistentem Training:**
    echter Bug gefunden. `_calcCurrentStreak()` (state.js) brach die
    Zählung sofort ab, sobald die NEUESTE Woche als 'missed' bewertet
    wurde — eine frisch (montags automatisch) angelegte, noch leere
    aktuelle Woche hat 0 bewertete Sätze und fiel darunter, obwohl der
    Nutzer schlicht noch keine Chance hatte, darin zu trainieren. Fix:
    die neueste Woche bricht die Streak nur noch, wenn ihr 7-Tage-
    Fenster bereits abgelaufen ist (`_weekEndMs()`), sonst wird sie
    übersprungen und die echte Streak dahinter zählt korrekt weiter.
    Neuer Test `tests/streak_inprogress_week.spec.js` (in CI).
  - **Schrittweite zeigt 5kg, angewendet werden nur 2,5kg (kein Bug):**
    bestätigt als die bereits bestehende, mit dem Nutzer abgestimmte
    B48-Entscheidung (train-v172) — bei "guter, aber nicht
    herausragender" Form empfiehlt `getWeightRecommendation()` bewusst
    nur den halben Schritt. Die "5kg" war vermutlich die Schrittweite-
    EINSTELLUNG (korrekt, bestätigt B65 funktioniert), nicht die für
    diese konkrete Woche berechnete Empfehlung. In BUGS.md unter
    "BEWUSST KEIN BUG" dokumentiert.
  - **B68 (Feature) — Share-Bild:** neues Modul `shareImage.js` (Tiefe
    0, kein Import) erzeugt lokal ein 1080×1080-PNG per Canvas
    (Theme-Farben live über `getComputedStyle()`, Bebas Neue/DM Sans
    nach `document.fonts.ready`). Zwei Einstiegspunkte: "📤 PR teilen"
    im Tagesabschluss-Screen (nur bei echtem PR) und "📤 Teilen" im
    Wochenrückblick-Modal. Teilen über `navigator.share`/`canShare`
    (identisches, bereits verifiziertes Muster wie der JSON-Backup-
    Export in backup.js), sonst Download-Fallback — kein Server-Upload.
    **Zusatzfund (B70):** beim Bau der PR-Bild-Datenquelle auffällig
    gewordener, unabhängiger Bug in `_getDayCompletionStats()`s
    `prCount` — verglich noch live gegen `state.prs` (All-Time-Wert),
    der zum Zeitpunkt des Tagesabschlusses bereits aktualisiert ist,
    wodurch echte Rekorde am Tagesabschluss fast nie mitgezählt wurden
    (derselbe Bug-Typ wie B63, umgekehrtes Vorzeichen). Fix: nutzt
    jetzt `s.prBadge`, dieselbe Quelle wie der Satz-Pokal seit B63.
    3 neue Tests (`tests/share_image.spec.js`, in CI).
  Volle Suite 28/28 grün (1 bekannter Flake bei `delete_all_data.spec.js`
  unter Parallel-Last, im Retry grün — siehe LOOPS.md, kein neues
  Problem). CACHE_VERSION train-v185→v186, CSS ?v=192→193, SCHEMA
  unverändert 31.
- **B65/B66/B67 abgeschlossen nach Nutzer-Antworten (train-v185):**
  Nutzer beantwortete alle 3 offenen Rückfragen aus dem vorherigen
  Sprint in einer Nachricht:
  - **B65 (gefixt):** Squats standen tatsächlich beim nie geänderten
    2.5kg-Standard — Nutzer bat trotzdem um den smarten Default. Neue
    `defaultWeightStepForExercise()` (state.js) nutzt die bereits
    vorhandene movementMap.js-Kategorisierung (B46): Squat/Hinge-
    Übungen bekommen künftig 5kg statt 2.5kg, angewendet an allen 3
    Übungs-Erstellungsstellen (EX_ADD, ONBOARDING_SEED, ui.js
    `_applyTpl`). Migration SCHEMA v30→v31 hebt bestehende Squat/Hinge-
    Übungen mit unverändertem Standard rückwirkend an, respektiert
    aber bewusst vom Nutzer gesetzte andere Werte. Neuer Test
    `tests/smart_weightstep.spec.js` (in CI) verifiziert beides.
  - **B66 (nicht reproduziert, Observability verbessert):** Nutzer
    bestätigte: passiert auf allen Geräten, immer beim Öffnen. 2
    weitere Reproduktionsversuche (echte Produktions-URL frisch
    besucht, SW-Install-und-erneutes-Öffnen simuliert) — zusätzlich zu
    den 2 aus dem vorherigen Sprint, macht 4 insgesamt — fanden nichts.
    Statt zu raten: die tatsächliche Fehlermeldung wird jetzt (gekürzt,
    keine Nutzdaten) als GoatCounter-Event-Pfad mitgegeben
    (`js_error: <Meldung>`) — beim nächsten Auftreten zeigt das
    Dashboard die konkrete Ursache. Bleibt offen.
  - **B67 (gefixt):** Nutzer bestätigte den Label-Vorschlag und bat um
    eine auf einen Blick erkennbare visuelle Unterscheidung. Neues
    Label unter der großen Erfolgsquote-Zahl ("✅ Erfolgsquote — Anteil
    erfolgreicher Sätze"), die Zielerfüllungs-Zeile bekam denselben
    erklärenden Zusatz. Neue CSS-Klasse rückt das Label eng an die
    Zahl heran; die bereits bestehende Pill-Badge-Optik der
    Zielerfüllung sorgt für zusätzliche visuelle Trennung.
  Volle Suite 24/24 grün. CACHE_VERSION train-v184→v185, CSS
  ?v=191→192, SCHEMA 30→31.
- **5 Nutzer-Bugs diagnostiziert, 2 gefixt (train-v184):** Nutzer meldete
  5 Bugs aus dem echten Gebrauch. Diagnose vor Fix (CLAUDE.md-Regel) für
  jeden einzeln:
  - **B63 (gefixt) — PR-Pokal bei Altgewicht-Wiederholung:** Root Cause
    gefunden (`ex.prWeight` ist All-Time-Wert, `s.weight >= ex.prWeight`
    beim Render verglichen zeigte den Pokal erneut bei bloßer
    Wiederholung eines alten Rekords). Ein erster Fix-Versuch
    ("nur in der aktuellsten Woche zeigen") erwies sich beim Testen als
    unzureichend — per Playwright verifiziert, nicht nur angenommen.
    Eigentlicher Fix: `_applyPrTracking()` (state.js) markiert den
    rekordauslösenden Satz jetzt direkt (`s.prBadge`), statt es bei
    jedem Render neu zu berechnen. 2 neue Tests (`tests/pr_badge.spec.js`,
    in CI) bestätigen beide Richtungen (Wiederholung zeigt keinen Pokal,
    echte Steigerung weiterhin schon).
  - **B64 (gefixt) — Volle statt Zahlen-Tastatur:** 6 `<input type="number">`-
    Felder ohne `inputmode` gefunden (Körpergewicht, Zielgewicht,
    Stangengewicht, Deload-Prozentsatz, 3 Template-Editor-Zahlenfelder) —
    ergänzt, analog zum bereits etablierten B16-Muster.
  - **B65 (offen, braucht Nutzer-Antwort) — Gewichtssteigerung "immer
    noch 1,25kg bei Squats":** Empfehlungs-Logik selbst (B48) ist intakt,
    liest `ex.weightStep` überall korrekt. Aber: jede Übungs-Erstellung
    setzt `weightStep` unconditional auf 2.5 — keine automatische
    Kategorie-Erkennung trotz vorhandener movementMap.js-Kategorisierung.
    Frage an Nutzer: wurde die Schrittweite für Kniebeuge manuell auf 5
    gesetzt (dann echter Bug, weiter untersuchen) oder nie konfiguriert
    (dann Produkt-Frage: smarterer Default für Squat/Hinge)?
  - **B66 (offen, nicht reproduziert) — Fehler-Toast beim Öffnen:**
    2 realistische Szenarien per Playwright nachgestellt (Neustart ohne
    Daten, 3-Wochen-Bestand), kein Fehler in beiden gefangen. Braucht
    mehr Kontext (Gerät/Browser, Häufigkeit, Auslöser).
  - **B67 (offen, Label-Vorschlag wartet auf Bestätigung) — zwei
    Prozentzahlen beim Tages-Abschluss:** Beide Zahlen sind bewusst
    unterschiedliche, je korrekte Kennzahlen (Erfolgsquote der bewerteten
    Sätze vs. Zielerfüllung inkl. übersprungener Sätze) — direktes
    Analogon zu einem bereits bestehenden "BEWUSST KEIN BUG"-Fall.
    Vorschlag: der oberen (aktuell unbeschrifteten) Zahl ein Label
    geben, Formeln unverändert lassen — noch nicht umgesetzt, Label-
    Wortlaut braucht Nutzer-Entscheidung (Konvention in diesem Projekt:
    Formulierungen nicht ohne Rückfrage ändern).
  Volle Suite 23/23 grün.
- **Echter GoatCounter-Site-Code aktiviert (train-v183):** Nutzer hat
  einen GoatCounter-Account angelegt (Site-Code "train"). `index.html`
  Platzhalter `<SITE-CODE>` durch `train.goatcounter.com` ersetzt — die
  seit train-v182 aktive versionierte SRI-URL (`count.v5.js` + Hash)
  blieb dabei unverändert, nur der Site-Code wurde getauscht. Der
  "TODO vor Launch"-Kommentar im HTML ist damit erledigt. CSP
  (`connect-src`/`img-src` auf `https://*.goatcounter.com` als
  Wildcard) deckt die konkrete Subdomain bereits ab, keine Anpassung
  nötig. **Hinweis:** Playwright-Testläufe (lokal + CI) laden das
  Script jetzt gegen den echten Account — GoatCounter filtert
  Headless-Browser/Bot-Traffic laut eigener Dokumentation automatisch,
  nicht extra geprüft, da unkritisch (reine Analytics, kein Sicherheits-
  /Datenschutzthema). CACHE_VERSION train-v182→v183. Volle Suite 21/21
  grün.
- **Cross-AI-Review Runde 3 ausgewertet (train-v182):** Nutzer ließ die
  4 aktualisierten Advisor-Exportdokumente von Gemini und Claude Cowork
  ein drittes Mal gegenlesen. Jeder Punkt eigenständig nachverifiziert
  (Primärquellen, nicht nur Blog-Zusammenfassungen), Widersprüche
  zwischen den beiden KIs gezielt aufgelöst statt beide unkritisch
  gemischt:
  - **GoatCounter-SRI umgesetzt (Korrektur einer eigenen Fehleinschätzung
    aus Runde 2):** Runde 2 hatte SRI abgelehnt, weil angeblich keine
    versionierte GoatCounter-URL existiert — Claude Cowork fand das
    Gegenteil (`count.v5.js` + offiziell publizierter Hash), an der
    GoatCounter-Primärquelle direkt nachverifiziert (nicht nur
    übernommen) und per Playwright gegen die echte App bestätigt (keine
    Integrity-Fehler). `index.html` nutzt jetzt die versionierte URL +
    SRI-Hash.
  - **B60 umgesetzt — Streak-Anzeige-Toggle:** neuer Settings-Schalter,
    blendet den Trainings-Tab-Badge komplett aus. Beim Implementieren
    einen echten, unabhängigen Bug gefunden: `SETTING_TOGGLE` (state.js)
    toggled nur bereits existierende Settings-Keys — ohne Default-Wert
    für `hideStreakBadge` in `STATE_INIT`+`migrate()` hätte der neue
    Button beim ersten Klick still gar nichts bewirkt. Gefixt, per
    neuem Regressionstest (`tests/streak_toggle.spec.js`, in CI)
    bestätigt (beide Richtungen).
  - **Onboarding-Datenverlust-Hinweis ergänzt:** letzter
    Onboarding-Screen (Install-Schritt) zeigt jetzt zusätzlich zum
    Settings-Hinweis einen kurzen "100% lokal, Cache-Löschung =
    unwiderruflich, Backup nutzen"-Satz — von beiden KIs in Runde 2
    UND 3 unabhängig vorgeschlagen.
  - **§ 309 Nr. 9 BGB (neuer Rechts-Fund, an Primärquelle verifiziert):**
    Grenzen für AGB-Vertragsverlängerungsklauseln (max. 2 Jahre
    Erstlaufzeit, automatische Verlängerung nur auf unbestimmte Zeit mit
    max. 1 Monat Kündigungsfrist) — betrifft TRAINs künftige AGB direkt,
    in LEGAL.md als "später"-Blaupause dokumentiert.
  - **BFSG-Einschätzung NICHT weiter hochgestuft:** die beiden KIs
    widersprachen sich direkt (eine erklärte TRAIN für "glasklar
    rechtlich befreit", die andere hielt die Einordnung explizit für
    nicht bis auf Gesetzestext-Ebene geklärt) — die vorsichtigere Linie
    wird beibehalten (Muster aus Runde 2 wiederholt sich: die KI, die
    offen sagt was sie nicht geprüft hat, lag bisher öfter richtig).
  - **§ 25 TDDDG für Service-Worker-Caching:** ebenfalls ein direkter
    KI-Widerspruch (stabil vs. wahrscheinlich-aber-nicht-sauber-
    entschieden). Konstruktive Lösung dokumentiert, aber nicht gebaut:
    Offline-Modus als expliziten Opt-in-Schalter statt immer-an anbieten
    würde die Rechtsfrage durch Konstruktion lösen — echte
    Architektur-Änderung, als neuer Kandidat B62 in BUGS.md
    dokumentiert, nicht in diesem Sprint umgesetzt.
  - **Wichtigstes Gesamt-Signal beider KIs unabhängig:** Legal/Security
    sind nach 3 Runden gut durchgekaut, der eigentliche Engpass ist
    jetzt fehlendes echtes Nutzer-Feedback — beide empfehlen, die
    Rekrutierung der 20 Testnutzer zu starten statt eine 4.
    Konsultationsrunde zu drehen. Keine neue Advisor-Dokument-
    Regenerierung in diesem Sprint, bewusst.
  - CACHE_VERSION train-v181→v182. Volle Suite 21/21 grün.
- **B61 (train-v181, vorheriger Sprint):** Nutzer bat
  darum, alle .md-Dateien UND die 4 Cross-AI-Advisor-Exportdokumente für
  eine weitere (dritte) externe Beratungsrunde zu aktualisieren, per
  paralleler Subagents. Alle 4 `context-exports/advisor-*.txt`-Dateien
  neu erzeugt (in sich verständlich, Round-2-Ergebnisse eingearbeitet,
  je neue Runde-3-spezifische offene Fragen — nicht nur Runde-1-Fragen
  wiederholt). Kern-Update im Business/Ethik-Dokument: die Preisfrage
  wurde neu gerahmt — nicht "ist 8-12€ zu teuer verglichen mit Strong/
  Hevy" (falsche Vergleichsgruppe, da TRAINs Gratis-Tier bereits das
  liefert, wofür Strong/Hevy bezahlt verlangen), sondern "gibt es eine
  echte Referenzklasse für Coaching/Decision-Support-Preise, und falls
  nein: ist die Zahlungsbereitschaft der ersten 20 Testnutzer der
  einzig verlässliche Weg, den Preis zu bestimmen?" — bewusst nicht
  selbst entschieden, offene Frage für Runde 3 bzw. den echten Testlauf.
  **B61 (Nebenfund, nicht gesucht):** ein Subagent meldete beim
  Re-Lesen von `ui.js` für die Legal-Export-Aktualisierung, dass die
  Versions-Anzeige in den Einstellungen seit train-v175 unverändert
  "train-v175" zeigte — war schlicht bei keinem Sprint seither im
  Update-Ablauf enthalten (kein gemeinsamer Konstanten-Import mit
  sw.js möglich, da sw.js als Classic Script ohne ES-Modul-Unterstützung
  läuft). Korrigiert auf train-v181, UND als expliziter Punkt 5 in
  CLAUDE.md "NACH JEDEM SPRINT AKTUALISIEREN" ergänzt, damit das nicht
  wieder passiert. CACHE_VERSION train-v180→v181. Volle Suite 20/20 grün. Nutzer ließ die
  4 fertigen Advisor-Exportdokumente von zwei weiteren KIs (Claude
  Cowork, Gemini) querlesen und bat erneut um eigenständige, kritische
  Prüfung statt Übernahme. Ergebnis, jeder Punkt einzeln nachrecherchiert
  bzw. am echten Code verifiziert:
  - **Übernommen + umgesetzt:** § 25 TDDDG (vormals TTDSG) als eigene
    Rechtsgrundlage für localStorage/Service-Worker-Speicherung neben
    Art. 6 Abs. 1 lit. f DSGVO ergänzt (`ui.js`-Datenschutz-Akkordeon +
    `datenschutz.html`) — echter Fund, den keine der 3 vorherigen
    KI-Runden hatte. Prototype-Pollution-Guard in `backup.js`
    (`_stripPrototypePollutionKeys()`) — code-verifiziert am echten
    `Object.assign(state, imported)`-Merge-Muster in state.js (nicht nur
    behauptet: per direktem Test bestätigt, dass ohne Guard `state`s
    Prototype-Chain über einen `"__proto__"`-Key in der importierten
    JSON tatsächlich kapert werden kann, mit Guard nicht).
  - **Korrigiert:** BGH V ZR 210/22 zur c/o-Adresse — eine KI hatte das
    Urteil als Lockerung dargestellt, tatsächlich bestätigt es die
    bereits vorsichtige LEGAL.md-Linie (reine Weiterleitungsvollmacht
    reicht nicht) und wurde NICHT gelockert. §312k-BGB-Kündigungsbutton
    (echter neuer Fund, seit 01.07.2022 in Kraft, in keinem der 4
    Runde-1-Dokumente enthalten) als DECISIONS.md-Prinzip-Entscheidung
    festgehalten (Umsetzung über Zahlungsanbieter-Self-Service, sobald
    Payment-Sprint kommt). BFSG-Einschätzung leicht nach oben korrigiert
    (wahrscheinlich unproblematisch, nicht mehr "unklar").
  - **Abgelehnt mit technischer Begründung:** SRI-Hash für GoatCounter
    (unversionierte Script-URL würde bei Anbieter-Updates lautlos
    brechen), "zirkuläre JSON als DoS" (faktisch unmöglich, JSON kennt
    keine Referenzen), client-seitige Verschlüsselung + "silent auto
    backup" (beide von Gemini als Top-Empfehlung vorgeschlagen —
    Verschlüsselung schützt nicht gegen das genannte XSS-Szenario, da
    der Schlüssel im selben Origin liegt; Silent-Backup ist auf iOS
    Safari technisch nicht umsetzbar). Details mit Begründung in
    SECURITY.md/LEGAL.md, jeweils neuer "Kritische Prüfung Runde 2"-
    Abschnitt.
  - **Geprüft, echter Preis-Fund (noch offen):** Strong PRO $4,99/Monat,
    Hevy Pro $23,99/Jahr — TRAINs geplante 8-12€/Monat liegen deutlich
    darüber. Nicht direkt vergleichbar (TRAINs kostenloser Tier deckt
    bereits das ab, was Strong/Hevy bezahlt anbieten; die 8-12€ sind für
    Coaching, ein bei beiden Wettbewerbern nicht vorhandenes Feature),
    aber psychologisch real (Preisanker der Nutzer). **Bleibt offene
    Entscheidung — nicht code-seitig gelöst, braucht Nutzer-Input**
    (Preis senken, Jahres-Tier ergänzen, oder Coach-Wert stärker
    kommunizieren).
  - BUGS.md B60 (Streak-Anzeige optional ausblendbar) als neuer,
    niedrigpriorer Kandidat ergänzt — nicht umgesetzt.
  - CACHE_VERSION train-v179→v180. Volle Suite 20/20 grün.
- **B57 umgesetzt (train-v179) — "Alle Daten löschen"-Button:** Nutzer
  bat darum, B57 (aus dem 2026-07-14-DSGVO-Review, bis dahin offen) noch
  in denselben Sprint wie B55/B56 aufzunehmen. Neue Settings-Row
  "🗑️ Alle Daten löschen" im "Deine Daten"-Abschnitt (ui.js, neben
  Backup/Restore) — `confirm()` mit klarer Unwiderruflich-Warnung
  (gleiches Muster wie `reset-factory`), löscht bei Bestätigung
  `localStorage[STORAGE_KEY]` + `STORAGE_KEY_SHADOW` (aus state.js
  importierte Konstanten, keine hartcodierten Strings) und reloadet.
  Neuer Regressionstest `tests/delete_all_data.spec.js` (in CI
  verdrahtet) — bestätigt: alte synthetische Testdaten sind nach
  Bestätigung+Reload nachweislich weg, App startet korrekt frisch im
  Onboarding-Zustand (kein kaputter Zwischenzustand — `loadState()`
  erzeugt beim nächsten Boot automatisch wieder einen validen
  Default-State, erwartetes Verhalten). CACHE_VERSION → train-v179.
  Volle Suite 20/20 grün.
- **B55/B56 inhaltlich erweitert + LEGAL.md angelegt (train-v178):**
  direkter Anschluss an den vorherigen Sprint — Nutzer ließ den Plan
  zusätzlich von Gemini und ChatGPT gegenchecken, bat explizit um eine
  kritische Prüfung dieses Feedbacks (nicht blind übernehmen) und einen
  c/o-Adress-Workaround für die private Anschrift. Ergebnis der
  eigenständigen Nachrecherche: mehrere Punkte bestätigt, einer korrigiert
  (SW/Cache-Rechtsgrundlage: Art. 6 Abs. 1 lit. f statt lit. b DSGVO),
  einer komplett umgedreht (Link-Haftungsausschluss ist laut Rechtsprechung
  wirkungslos/kontraproduktiv — gestrichen statt nur gekürzt), einer neu
  gefunden ohne KI-Hinweis (BFSG/Barrierefreiheitsstärkungsgesetz, seit
  2025-06-28 in Kraft, als "später"-Punkt dokumentiert). Volle
  Begründung inkl. Quellen in `LEGAL.md`, nicht mehr in BUGS.md (das
  bleibt reiner Bug-Tracker, B55/B56 haben jetzt nur noch kurze
  Pointer-Zeilen dorthin).
  - `ui.js` Datenschutz-Akkordeon erweitert: Local-First-Dilemma
    (Cache-Löschung = unwiderruflicher Datenverlust), Backup-Hinweis
    (JSON-Export), Service-Worker/Cache als technische Verarbeitung
    (gleiche Rechtsgrundlage wie GoatCounter), "Was wird verarbeitet /
    nicht verarbeitet"-Transparenz-Checkliste, menschlichere Einleitung.
  - `ui.js` Impressum-Akkordeon: EIN Satz medizinischer Disclaimer
    ("keine medizinische Beratung") + EIN Satz Minderjährigen-Hinweis —
    bewusst KEIN Link-Haftungsausschluss (siehe oben).
  - Neue eigenständig aufrufbare Seite `datenschutz.html` (statisches
    HTML, kein JS nötig) — für künftige App-Store-Einreichungen (Apple/
    Google verlangen eine von außen aufrufbare Privacy-Policy-URL,
    nicht in einem Settings-Tab vergraben), in `sw.js` precached.
  - CACHE_VERSION train-v177 → v178 (bewusst beibehalten trotz
    Gegenargument aus dem KI-Feedback — Begründung in LEGAL.md).
  - Verifiziert: volle Playwright-Suite 19/19 grün, Ad-hoc-Checks für
    beide Akkordeons + die neue Standalone-Seite bestanden.
  - Nächster Schritt danach: 4 Cross-AI-Review-Exportdokumente
    (Legal/Security/Produkt-UX/Business-Ethik) für eine weitere externe
    Beratungsrunde, per Subagents erzeugt, in `context-exports/`.
- **B55/B56 strukturell vorbereitet (train-v177) — Impressum/Datenschutz:**
  direkter Anschluss an den B59-Security-Sprint, Nutzer bat darum, die
  Platzhalter mit korrektem rechtlichem Rahmentext vorzubereiten statt
  nur "TODO" stehen zu lassen. `ui.js` Settings-Tab: Impressum-Block hat
  jetzt § 5 TMG/DDG-Rahmentext mit klar markierten Platzhalter-Zeilen
  (Name/Anschrift/E-Mail in `[ECKIGEN KLAMMERN]`, `⚠️`+`--c-danger`-Farbe).
  Datenschutz-Block erweitert um Verantwortlicher-Zeile (verweist auf
  Impressum statt Daten zu duplizieren), Rechtsgrundlage (Art. 6 Abs. 1
  lit. f DSGVO), GitHub-Pages-Hosting-Hinweis (Microsoft verarbeitet
  Besucher-IPs beim Ausliefern, unabhängig von GoatCounter) mit Link zum
  GitHub Privacy Statement, Betroffenenrechte-Absatz, präzisierte
  GoatCounter-Formulierung. **Bleibt Blocker (B55):** braucht weiterhin
  echte Name+Anschrift-Angaben vom Nutzer — Code-Seite ist jetzt fertig
  vorbereitet, kann direkt eingesetzt werden sobald die Angaben da sind.
  Verifiziert: Playwright bestätigt fehlerfreies Rendern beider
  aufgeklappter Akkordeons, volle Suite 19/19 grün. CACHE_VERSION →
  train-v177 (kein SCHEMA-/CSS-Bump, reiner Text-Change).
- **B59 umgesetzt (train-v176) — Security-Bestandsaufnahme vor Public-Launch:**
  Nutzer-Anfrage nach Instagram-Beispielen gehackter "vibecoded" Apps
  (typische Themen: API-Keys, Rate Limiting, DDoS, Auth, Access Control).
  Vor der Umsetzung erst der Realitätscheck: TRAIN hat kein Backend/keine
  API-Keys/keine Accounts (verifiziert — kein `fetch()` außer Service-
  Worker, keine Secrets im Repo), daher läuft der Großteil der üblichen
  Checkliste (Rate Limiting, JWT, SQL-Injection, SSRF, IDOR) ins Leere.
  Gezielter Code-Audit fand die eine real zutreffende Lücke:
  - **XSS im Template-Editor:** `ui.js:4134` schrieb `ex.name` ohne das im
    Rest der Codebase etablierte `h()`-Escaping (ui.js:306) direkt in ein
    `value`-Attribut — sowohl beim Tippen als auch über einen präparierten
    JSON-Import (`backup.js`, geteilte Trainingspläne) ausnutzbar. Fix:
    `h(ex.name)` ergänzt.
  - **Import-Härtung:** `backup.js` prüfte beim Import bisher nur Shape
    (`weeks`-Array/`meta.schemaVersion`/`settings`-Objekt), keine Typ-/
    Längenprüfung einzelner Textfelder. Neue `_sanitizeImportedState()` als
    Defense-in-Depth (ergänzt das Escaping in ui.js, ersetzt es nicht) —
    normalisiert `name`/`note`/`title`/`subtitle` in weeks/days/exercises/
    customTemplate auf String-Typ mit Längen-Deckel, plus 5-MB-Obergrenze
    für importierte Dateien.
  - **CSP-`<meta>`-Tag** in index.html ergänzt (`default-src 'self'`,
    Skripte nur `'self'`+GoatCounter, `object-src 'none'`,
    `frame-ancestors 'none'`) als zusätzliche Absicherung — nur per
    `<meta>` möglich (GitHub Pages erlaubt keine echten HTTP-Header).
    `'unsafe-inline'` bei `script-src` bewusst beibehalten (bestehender
    Bootstrap-`<script>` + 4 inline-`onclick`-Handler ohne Build-Step nicht
    per Nonce/Hash absicherbar — als bekannte Grenze dokumentiert).
  - Alle anderen unescaped `${...}`-Stellen in ui.js geprüft (Badge-Titel,
    Onboarding-Templates) — feste Konstanten, kein Nutzertext, kein
    weiterer Fund.
  - **Neues Dokument `SECURITY.md`:** Teil 1 = heutiger Stand (siehe oben),
    Teil 2 = dokumentierte, noch NICHT gebaute Blaupause für Auth/Rate-
    Limiting/Access-Control-Matrix/API-Key-Handling, aktiviert erst sobald
    die geplante Paywall/Coaching-Funktion einen echten Server bekommt.
  - Verifiziert: neuer Regressionstest `tests/security_xss.spec.js`
    (Payload per echtem JSON-Import-UI-Flow eingeschleust, Template-Editor
    geöffnet, bestätigt `window.__xssFired` bleibt `false` und kein
    `<img src="x">` im DOM) — manuell gegen unreparierten Code laufen
    lassen zur Bestätigung, dass der Test die Lücke wirklich fängt (schlug
    erwartungsgemäß fehl, danach Fix wiederhergestellt). Volle Suite
    `npx playwright test`: 19/19 grün (10/10 regression_core, 17 fixtures,
    neuer Security-Test) — bestätigt auch, dass die neue CSP GoatCounter/
    Coach-Toasts/Tab-Navigation nicht bricht.
  - B55/B56 (Impressum/Datenschutz) bewusst NICHT Teil dieses Sprints —
    bereits als eigener Blocker getrackt, braucht echte Nutzerangaben.
- **B54 umgesetzt (train-v175) — Install-Button im Onboarding:** direkter
  Anschluss an die Pre-Launch-Checkliste — Nutzer fragte, ob sich "Zum
  Home-Bildschirm hinzufügen" im Onboarding automatisieren lässt. Technische
  Antwort zuerst gegeben (nicht direkt implementiert): Android/Chrome/Edge
  haben `beforeinstallprompt` (echter Ein-Tap-Dialog), iOS Safari hat KEINE
  solche API (Apple-Einschränkung, nicht umgehbar) — dort nur eine Anleitung
  möglich. Nutzer bestätigte "Ja, umsetzen".
  - index.html fängt `beforeinstallprompt` global ab (`preventDefault()` +
    auf `window.__trainInstallPrompt` gespeichert, unterdrückt die
    browsereigene Mini-Infobar zugunsten der eigenen UI), feuert bei
    `appinstalled` ein `train:app-installed`-Event → GoatCounter-Event
    "App installiert" (aussagekräftigeres Signal als reine Seitenaufrufe).
  - Neuer Onboarding-Screen (`_obPhase='install'`, ui.js `_showOnboarding()`)
    erscheint NACH der Vorlagen-Wahl (Best Practice: erst Wert zeigen, dann
    installieren fragen), aber NUR wenn er wirklich etwas bewirken kann:
    iOS (Anleitung) ODER ein eingefangenes `beforeinstallprompt` liegt vor.
    Sonst (Desktop-Firefox, bereits installiert — `display-mode:standalone`/
    `navigator.standalone` geprüft) wird der Screen komplett übersprungen
    statt einen wirkungslosen Button zu zeigen.
  - Reused bestehende Muster: `.ob-*`-CSS-Klassen (u.a. bisher tote Klassen
    `.ob-logo`/`.ob-sub` erstmals bespielt statt neue zu erfinden),
    `train:show-update-banner`-Event-Stil für die index.html↔ui.js-
    Kommunikation.
  - Verifiziert per Playwright in 3 Szenarien: simuliertes
    `beforeinstallprompt` → Button ruft `prompt()` auf und schließt
    Onboarding; iOS-User-Agent → Anleitung erscheint nach Tap, "Später"
    schließt; weder/noch (Desktop) → Screen wird komplett übersprungen,
    Onboarding schließt sofort. Regressionstest 10/10 grün, Playwright
    18/18 grün. CACHE_VERSION → train-v175, CSS → ?v=191 (kein SCHEMA-Bump).

- **B51+B52+B53 umgesetzt (train-v174) — Pre-Launch-Checkliste:** Nutzer
  fragte vor dem Launch an die ersten ~20 echten Nutzer, was noch geprüft
  werden sollte, um einen schlechten ersten Eindruck zu vermeiden, und ob
  es ein Branchen-Standard-Protokoll dafür gibt. Direkte Code-Recherche
  ergab zwei bis dahin unbekannte, konkrete Funde (Google-Fonts-Aufruf
  widerspricht der eigenen Datenschutz-Positionierung; kein Impressum),
  mit `/plan` sauber zu einer 7-Schritte-Checkliste durchgeplant, inkl.
  einer abgestimmten Entscheidung für die "wie viele Nutzer aktiv"-Frage
  (GoatCounter, siehe DECISIONS.md).
  - **B51 (Fonts):** Bebas Neue + DM Sans selbst gehostet (`fonts/`,
    4 woff2-Dateien) statt Live-Aufruf bei Google — App macht danach
    nachweislich NULL externe Netzwerk-Aufrufe außer dem bewusst
    gewählten GoatCounter (B52). sw.js: totes Google-Fonts-Runtime-
    Caching (`FONT_CACHE`, `staleWhileRevalidate()`) mit entfernt statt
    als toten Code stehen zu lassen.
  - **B52 (Analytics + Error-Handler):** GoatCounter-Script-Tag
    (Platzhalter-Site-Code, TODO vor Launch), Custom Events "Woche
    erstellt"/"Onboarding abgeschlossen" an bestehenden Dispatch-Punkten,
    neuer globaler `window.onerror`/`unhandledrejection`-Handler (Toast
    + anonymes `js_error`-Event) über das bestehende
    `train:show-update-banner`-Event-Muster nachgebaut. Feedback-Zeile
    (mailto, Platzhalter-Adresse) in den Einstellungen ergänzt.
  - **B53 (Impressum/Datenschutz/Icons):** Info-Sektion in den
    Einstellungen erweitert (korrekte Versionsnummer, aufklappbare
    Datenschutz-/Impressum-Zeilen über das bestehende
    `.session-note-toggle`-Akkordeon-Muster). Unabhängig beim vollen
    Lighthouse-Lauf gefunden: `manifest.json` hatte gar kein
    `icons`-Array, `icon-192.png`/`icon-512.png` existierten nirgends —
    "Zum Home-Bildschirm hinzufügen" hätte kein App-Icon gezeigt. Neue
    Platzhalter-Icons generiert (Splash-Screen-Branding: dunkler
    Hintergrund + "TRAIN"-Wortmarke in Lime), `manifest.json`/
    `<link rel="icon">`/sw.js-Precache ergänzt. Lighthouse (alle
    Kategorien, vorher nur Accessibility geprüft): Accessibility 100,
    Best-Practices 100 (vorher 96, Favicon-Fix), SEO 100, Performance
    ~57-60 unter Lighthouses simulierter Slow-4G-Drosselung — Ursache
    ist die bewusste "kein Bundler"-Architektur (viele einzelne ES-
    Module), `modulepreload`-Hints als risikofreie Optimierung ergänzt
    (Effekt innerhalb der Mess-Rauschgrenze, aber unschädlich). Ein
    Bundler wäre die einzige echte Abhilfe — bewusst NICHT umgesetzt,
    da außerhalb des Scopes dieser Checkliste (kein offenes Performance-
    Redesign). B27 (Touch-Drag) im Rahmen der Checkliste erneut geprüft
    und bewusst als Nicht-Blocker bestätigt.
  - **Offene TODOs vor echtem Launch (nicht durch Code lösbar):**
    GoatCounter-Site-Code in index.html eintragen (Account unter
    goatcounter.com), Impressum-Platzhalter in den Einstellungen mit
    echten Kontaktdaten füllen, Feedback-mailto-Adresse eintragen,
    "Nutzer-Null"-Gerätetest (Add-to-Homescreen, Onboarding, Persistenz)
    manuell auf einem echten Gerät durchführen.
  - Regressionstest 10/10 grün, Playwright 18/18 grün nach jedem Schritt.

- **B49+B50 umgesetzt (train-v173):** Anschluss an B48 — Nutzer wollte
  wissen, ob die Schrittweite pro Übung automatisch erkannt werden kann
  ("höchst individuell"), UND einen Weg, die automatische Coach-
  Empfehlung im Wochenwechsel-Modal auf einen eigenen Wert anzupassen
  (Beispiel: "App schlägt +5kg vor, ich traue mir nur +2,5kg zu"). Vor
  der Umsetzung mit `/plan` sauber durchgeplant (Explore-Agent für
  Code-Recherche, Plan-Agent für den Entwurf, 3 Design-Fragen mit
  Nutzer abgestimmt).
  - **B49 (Schrittweite-Vorschlag):** neue Muster-Erkennung
    (`detectRecurringStep()`/`exMetricHistory()`/`detectRecurringWeightStep()`
    in insightEngine.js, Schwelle 3 identische Sprünge bei ≥4 Wochen)
    zeigt einen sichtbaren Hinweis neben der Schrittweite-Einstellung
    ("du hast wiederholt um Xkg gesteigert — übernehmen?"), NIE
    automatisch angewendet (Nordstern-Prinzip: App schlägt vor, Athlet
    entscheidet). Wiederverwendet das bestehende `.target-suggestion`-
    Muster, dispatcht die bereits existierende `EX_SET_STEP`/
    `EX_SET_METRIC_STEP`-Action.
  - **B50 (anpassbarer Chip):** der Empfehlungs-Chip im "Neue Woche"-
    Modal (`_renderRecChip()`) hat jetzt zusätzlich zum bisherigen
    Ein/Aus einen "Anderer Wert"-Button (wiederverwendet das
    `.ex-kg-picker`-Muster). Bewusst KEIN festes Halbierungs-Preset
    (Begründung: Kollision mit dem internen `halfDelta`-Konzept aus
    B48, siehe DECISIONS.md).
  - **Kritisches Architektur-Risiko gefunden und gelöst:**
    `_prepNewWeekModal()` dispatcht bei jedem Re-Render erneut die
    Auto-Vorauswahl — ein Custom-Wert wäre ohne Gegenmaßnahme beim
    nächsten Re-Render stillschweigend auf den vollen Empfehlungswert
    zurückgesprungen. Neues Tracking `_userCustomStepChoice` (analog
    zu `_userDismissedAutoSelect`) verhindert das — explizit mit
    Playwright nachgestellt (Custom-Wert setzen → Re-Render erzwingen
    → Wert bleibt stabil → Woche erstellen → tatsächliches Gewicht
    stimmt mit dem Custom-Wert überein, nicht mit der vollen
    Empfehlung).
  - Details siehe BUGS.md B49/B50, DECISIONS.md (Design-Entscheidungen).
- **B48 behoben (train-v172):** Nutzer meldete, dass die automatische
  Coach-Gewichtsempfehlung "technisch funktioniert, aber nicht mit der
  gewünschten Logik" — schwere Grundübungen (Kniebeuge, Kreuzheben)
  sollen in 5kg-Schritten steigern, leichtere Übungen (Bankdrücken) in
  1.25kg-Schritten. Das Schrittweite-Feld pro Übung existierte bereits
  (vom manuellen "+kg"-Button schon korrekt genutzt), aber
  `getWeightRecommendation()` ignorierte es bei der Sprunggröße selbst —
  intern immer fest 2.5kg ("volle Steigerung")/1.25kg ("kleine
  Steigerung"), die Schrittweite wurde nur zum Runden des Ergebnisses
  benutzt. Bei größeren Schrittweiten konnte das zu einer scheinbaren
  "Steigerung" von +0kg führen. Fix: `fullDelta`/`halfDelta` werden
  jetzt aus `ex.weightStep` abgeleitet (analog zu
  `getMetricRecommendation()`, die das für Distanz/Zeit-Übungen schon
  immer so machte) — mit Nutzer abgestimmter Regel: bei bereits kleiner
  Schrittweite (≤1.25kg) bleibt "kleine Steigerung" bei 1× statt weiter
  zu halbieren. 3 Insight-Trigger-Stellen (insightEngine.js) ebenfalls
  korrigiert, die bisher denselben pauschalen Default nutzten.
  Rückwärtskompatibel: Standard-Schrittweite 2.5kg liefert weiterhin
  exakt +2.5/+1.25 wie vorher. Details siehe BUGS.md B48/DECISIONS.md.
- **B47 behoben (train-v171):** die zurückgestellte Prüfung der
  PR-Erkennung ("Fund 4" aus dem Konsolidierungs-Audit) ergab einen
  ECHTEN Bug, nicht nur Duplikations-Risiko: von den 3 unabhängigen
  PR-Tracking-Kopien in state.js (`SET_TOGGLE_DONE`, `CONFIRM_SET`,
  `AUTO_EVAL_SET`) waren die letzten beiden bit-identisch, aber
  `SET_TOGGLE_DONE` — der manuelle ✓-Button, die häufigste Eingabeart —
  hatte das `ex.oneRM`-Update komplett vergessen. Der Trainings-Tab-
  1RM-Hinweis hat zwar einen Live-Fallback, der das im laufenden Betrieb
  kaschiert, aber `ex.oneRM` ist als wochenübergreifendes historisches
  Maximum gedacht (bleibt beim Wochenwechsel bewusst erhalten) — Nutzer,
  die nur über den ✓-Button bestätigen, sahen den Hinweis in einer
  neuen, leeren Woche schlicht verschwinden statt den Vorwochen-Bestwert
  zu zeigen. Fix: neue gemeinsame `_applyPrTracking()` in state.js,
  alle 3 Reducer delegieren jetzt dorthin. Verifiziert mit echtem
  `dispatch(A.SET_TOGGLE_DONE, ...)`: `ex.oneRM` war vorher `null`, ist
  jetzt korrekt `116.7` (Epley: 100kg × (1+5/30)). Details siehe
  BUGS.md B47.
- **Konsolidierungs-Sprint (train-v170):** Nutzer bat nach der Geräte-
  Verifikation um eine systematische Prüfung des ganzen Codes auf
  Berechnungen, die an mehreren Stellen unabhängig implementiert sind und
  dadurch auseinanderlaufen können (dasselbe Muster wie B36). Ein
  gezielter Read-Only-Audit fand 4 konkrete Cluster; 3 wurden konsolidiert
  (auf Nutzer-Wunsch), der 4. (PR-Erkennung, evtl. 3. statt der
  dokumentierten 2 Kopien) wird separat noch genauer geprüft, bevor
  entschieden wird.
  - **B44 behoben:** `_reachableDays()` (weekReview.js) filterte nicht
    über `isTrainingDay()` — importiert jetzt dieselbe Funktion aus
    state.js wie consistencyUtils.js/state.js selbst.
  - **B45 behoben:** `_calcSuccessScore()` (weekReview.js) und
    `_weekSuccessScore()` (ui.js) waren zwei unabhängige Kopien derselben
    Formel, mit unterschiedlicher Archiviert-Behandlung — genau die
    Funktion hinter der verwirrenden "100% Ziel"-Zahl aus der Geräte-
    Verifikation. Neue gemeinsame `weekSuccessCounts()` in setUtils.js,
    beide Call-Sites delegieren jetzt dorthin.
  - **B46 behoben:** Kategorie-Lookup (`customCatMap ?? MOVEMENT_MAP`)
    war 2x identisch dupliziert (ui.js, weeklyFocus.js) UND fehlte
    komplett in `computeBreadthProgress()` (overallPerformance.js) —
    Kategorie-Overrides wurden dort schlicht ignoriert. Neue
    `buildCategoryMap()`/`resolveCategory()` in movementMap.js, an allen
    3 Stellen genutzt.
  - Jeder Fix einzeln mit Playwright + gezielten Node-Skripten verifiziert
    (tatsächliches Vor/Nach-Verhalten, nicht nur Regressionstest-grün).
  - Bewusst NICHT angefasst (Nutzer-Entscheidung aus vorherigem Turn):
    das "1/2 Tage"/"100% Ziel"-Label in der Wochenrückblick-Karte bleibt
    wie es ist — beide Zahlen sind jetzt korrekt, nur die Beschriftung
    könnte klarer sein.
  - AGENTS.md-Dateiabhängigkeits-Matrix aktualisiert: weekReview.js
    importiert jetzt setUtils.js + state.js (war vorher Tiefe 0, jetzt
    Tiefe 1).
- **Echte Geräte-Verifikation des Deep-Check-Audits (2026-07-14,
  kein neuer Code-Sprint):** Nutzer hat B36-B39 auf echtem Gerät via
  4 eigens gebauten Test-JSONs (`tests/TRAIN_Test_DeviceCheck_*.v1.json`,
  jeweils vorab über den ECHTEN "JSON importieren"-Weg via Playwright
  verifiziert, nicht nur per localStorage-Shortcut) nachgetestet:
  Push/Pull-Konsistenz (B36) ✓, archivierte Übung (B37) ✓, Undo nach
  Löschung (B39) ✓ — alle wie erwartet. Urlaubstag-Konsistenz (B38)
  auf den ersten Blick "nicht wie erwartet" gemeldet ("1/2 Tage" neben
  "100% Ziel" in der Wochenrückblick-Karte) — bei der Diagnose stellte
  sich heraus: kein Bug, sondern zwei unabhängige, je korrekte
  Kennzahlen (Tage-Anwesenheit vs. Erfolgsquote der bewerteten Sätze),
  siehe BUGS.md "BEWUSST KEIN BUG". Dabei einen echten technischen Fund
  gemacht: eine DRITTE unabhängige "welche Tage zählen als geplant"-
  Implementierung in weekReview.js (`_reachableDays()`), die anders als
  die beiden anderen (consistencyUtils.js/state.js) keine
  `isTrainingDay()`-Filterung hat — als B44 getrackt. Nutzer bat
  daraufhin um eine systematische Konsolidierungs-Prüfung des gesamten
  Codes auf dieses Duplikations-Muster (identisch zu B36) statt nur
  diesen einen Fall zu fixen — siehe eigener Abschnitt unten.
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
index.html                — B54: beforeinstallprompt/appinstalled global
                          abgefangen (window.__trainInstallPrompt,
                          train:app-installed-Event).
ui.js                     — B54: neue _isStandalone()/_isIOS()-Helper,
                          _showOnboarding() um _obPhase='install'-Screen
                          erweitert (_afterSetup(), neue data-ob Actions
                          install-native/install-ios-help/continue), neuer
                          train:app-installed-Listener (_gcEvent).
styles.css                — B54: .ob-ios-help/.ob-ios-help__step/__num.
index.html                — B51: Google-Fonts-Links entfernt, modulepreload-
                          Hints fuer alle ES-Module ergaenzt. B52: GoatCounter-
                          Script-Tag (Platzhalter-Site-Code), globaler
                          window.onerror/unhandledrejection-Handler. B53:
                          <link rel="icon">, CACHE_VERSION-Referenz.
sw.js                     — B51: fonts/-Dateien in PRECACHE_URLS, totes
                          Google-Fonts-Runtime-Caching (FONT_CACHE,
                          staleWhileRevalidate()) entfernt. B53: icon-192/512
                          PNG in PRECACHE_URLS. CACHE_VERSION train-v174.
styles.css                — B51: neue @font-face-Regeln fuer selbst
                          gehostete Bebas Neue/DM Sans (DM Sans als
                          Variable-Font-Range 300-600). CSS ?v=190.
ui.js                     — B52: neuer _gcEvent()-Helper, Aufrufe in
                          _createWeek() ("Woche erstellt") und Onboarding-
                          _finish() ("Onboarding abgeschlossen"), neuer
                          train:js-error-Listener (Toast + _gcEvent).
                          B53: renderSettingsTab() Info-Sektion erweitert
                          (Version korrigiert, Datenschutz-/Impressum-
                          Akkordeon ueber bestehendes .session-note-toggle-
                          Muster).
manifest.json             — B53: neues icons-Array (192/512, purpose:any).
icon-192.png / icon-512.png — B53: neu erzeugt (Platzhalter, Splash-Screen-
                          Branding), existierten vorher gar nicht trotz
                          Referenz in index.html/manifest.json.
fonts/                    — B51: neuer Ordner, 4 selbst gehostete woff2-
                          Dateien (Bebas Neue + DM Sans, latin/latin-ext).
BUGS.md/DECISIONS.md      — B51-B53 Eintraege, neue Architektur-Entscheidung
                          "Anonyme Nutzungs-Zaehlung (GoatCounter)".
insightEngine.js          — B49: neue exMetricHistory(),
                          detectRecurringStep(), detectRecurringWeightStep()
                          — Muster-Erkennung fuer Schrittweite-Vorschlag.
ui.js                     — B49: Vorschlags-UI neben Schrittweite-Buttons
                          (adopt-suggested-step/-metric-step Handler).
                          B50: _renderRecChip() komplett umgebaut (Anderer-
                          Wert-Button + Picker), neue Modul-Variablen
                          _recChipCustomOpenName/_userCustomStepChoice,
                          neue Handler rec-chip-show-custom/-custom-confirm,
                          toggle-weight-rec + _prepNewWeekModal() erweitert
                          (Auto-Preselect-Snapback-Fix), neuer Outside-Tap-
                          Handler fuer den Custom-Picker.
styles.css                — B50: .nw-weight-rec-wrap, .nw-rec-adjust-btn.
index.html / sw.js        — CACHE_VERSION train-v173, CSS ?v=189.
weightRecommendation.js   — B48: fullDelta/halfDelta in
                          getWeightRecommendation() werden jetzt aus
                          ex.weightStep abgeleitet statt fix 2.5/1.25.
                          halfDelta bleibt bei 1x wenn weightStep<=1.25.
insightEngine.js          — B48: 3 Insight-Trigger (A-01/A-01b/A-02)
                          übergeben jetzt die echte Übungs-Schrittweite
                          statt undefined an getWeightRecommendation().
index.html / sw.js        — CACHE_VERSION train-v172 (kein CSS-Bump)
state.js                  — B47: neue _applyPrTracking(state, ex, weight,
                          reps) — SET_TOGGLE_DONE/CONFIRM_SET/AUTO_EVAL_SET
                          delegieren jetzt alle dorthin. SET_TOGGLE_DONE
                          bekam dabei das fehlende ex.oneRM-Update ergänzt
                          (echter Bugfix, nicht nur Konsolidierung).
index.html / sw.js        — CACHE_VERSION train-v171 (kein CSS-Bump)
setUtils.js               — B45: neue weekSuccessCounts(week) — einzige
                          Quelle für Erfolgsquote, archiviert-bewusst.
ui.js                     — B45: _weekSuccessScore() delegiert jetzt an
                          setUtils.js. B46: customCatMap-Aufbau + Lookup
                          nutzen buildCategoryMap()/resolveCategory()
                          aus movementMap.js statt Inline-Logik.
weekReview.js             — B44: _reachableDays() filtert jetzt über
                          isTrainingDay() (neuer Import aus state.js).
                          B45: _calcSuccessScore() delegiert an
                          setUtils.js.weekSuccessCounts().
weeklyFocus.js            — B46: _checkPushPullBalance()s customCatMap-
                          Aufbau nutzt jetzt buildCategoryMap()/
                          resolveCategory() aus movementMap.js.
overallPerformance.js     — B46: computeBreadthProgress() respektiert
                          jetzt Kategorie-Overrides (vorher komplett
                          ignoriert, nur rohe MOVEMENT_MAP genutzt).
movementMap.js            — B46: neue buildCategoryMap()/resolveCategory()
                          — einzige Quelle für den Override-Lookup.
index.html / sw.js        — CACHE_VERSION train-v170 (kein CSS-Bump)
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
| Geräte-Verifikation + Konsolidierungs-Sprint: B44-B46 | — | Nutzer testete B36/B37/B39 auf echtem Gerät (alle bestätigt), B38 zunächst als unerwartet gemeldet — Diagnose ergab kein Bug, aber einen 3. duplizierten "welche Tage geplant"-Berechnungsort (B44). Nutzer bat um systematischen Konsolidierungs-Audit statt Einzelfix — Read-Only-Fork fand 4 Cluster, 3 konsolidiert (B44 isTrainingDay-Filter, B45 weekSuccessCounts() in setUtils.js ersetzt 2 unabhängige Erfolgsquote-Formeln, B46 buildCategoryMap()/resolveCategory() in movementMap.js ersetzt 2 Duplikate + schließt eine fehlende Kategorie-Override-Stelle in overallPerformance.js), 1 Fund (PR-Erkennung, evtl. 3. Kopie) zur genaueren Prüfung zurückgestellt. CACHE_VERSION → train-v170 (kein CSS-Bump) |
| B47: PR-Tracking-Konsolidierung | — | Genauere Prüfung des zurückgestellten Funds 4 — Zeile-für-Zeile-Vergleich der 3 PR-Tracking-Kopien in state.js ergab einen echten Bug: SET_TOGGLE_DONE (häufigste Eingabeart) fehlte das ex.oneRM-Update, das CONFIRM_SET/AUTO_EVAL_SET (bit-identisch zueinander) beide hatten. Neue _applyPrTracking() in state.js, alle 3 Reducer delegieren dorthin. Verifiziert mit echtem dispatch(A.SET_TOGGLE_DONE): ex.oneRM null → 116.7. CACHE_VERSION → train-v171 (kein CSS-Bump) |
| B48: Gewichtsempfehlung nutzt pro-Übung-Schrittweite | — | Nutzer meldete "technisch funktioniert, aber nicht mit gewünschter Logik" — Kniebeuge/Kreuzheben sollen 5kg-Schritte machen, Bankdrücken 1.25kg. getWeightRecommendation() hatte fullDelta/halfDelta fix auf 2.5/1.25 hartkodiert, ex.weightStep wurde nur zum Runden benutzt. Fix: fullDelta=weightStep, halfDelta=weightStep/2 (bleibt bei 1x wenn weightStep<=1.25, Nutzer-Entscheidung). 3 insightEngine.js-Stellen ebenfalls korrigiert (übergaben bisher undefined). Rückwärtskompatibel (Standard 2.5kg unverändert). CACHE_VERSION → train-v172 (kein CSS-Bump) |
| B49+B50: individuelle Steigerungslogik (mit /plan geplant) | — | Anschluss an B48. B49: Schrittweite-Vorschlag aus geloggter Historie (Muster-Erkennung, Schwelle 3 Sprünge), rein sichtbarer Hinweis, nie automatisch angewendet — Nutzer-Idee "automatisch erkennen" wurde bewusst NICHT als stille Automatik umgesetzt (Nordstern-Konflikt), sondern als Vorschlag mit Übernehmen-Button. B50: anpassbare Steigerungsmenge im Empfehlungs-Chip ("Anderer Wert" statt nur Ein/Aus), kein Halbierungs-Preset (Kollision mit B48s internem halfDelta). Kritisches Risiko gefunden+gelöst: Auto-Preselect-Snapback bei Custom-Werten (_userCustomStepChoice-Tracking). Vollständig mit /plan durchgeplant (Explore+Plan-Agent), 3 Design-Fragen mit Nutzer abgestimmt. CACHE_VERSION → train-v173, CSS → ?v=189 |
| B51+B52+B53: Pre-Launch-Checkliste (mit /plan geplant) | — | Nutzer fragte vor dem Launch an ~20 echte Nutzer, was noch geprüft werden sollte und ob es ein Branchen-Standard-Protokoll gibt. Direkte Code-Recherche fand 2 unbekannte Funde (Google-Fonts-Live-Aufruf widerspricht "kein Server"-Datenschutz-Positionierung; kein Impressum), mit `/plan` zu 7-Schritte-Checkliste durchgeplant. B51: Fonts selbst gehostet (fonts/, 4 woff2), App macht danach NULL externe Aufrufe außer GoatCounter. B52: GoatCounter-Analytics (Platzhalter-Site-Code) + Custom Events + globaler Error-Handler (Toast + anonymes Event) + Feedback-mailto-Zeile. B53: Info-Sektion erweitert (Version, Datenschutz, Impressum-Platzhalter) über bestehendes Akkordeon-Muster; unabhängig gefunden: manifest.json hatte gar kein icons-Array, icon-192/512.png existierten nirgends — neu generiert (Splash-Branding). Voller Lighthouse-Lauf: A11y 100, Best-Practices 100, SEO 100, Performance ~57-60 (Architektur-bedingt, kein Bundler — modulepreload-Hints ergänzt, Bundler bewusst außerhalb Scope). B27 erneut bestätigt als Nicht-Blocker. Offene TODOs vor echtem Launch: GoatCounter-Site-Code, Impressum-Kontaktdaten, Feedback-E-Mail, Nutzer-Null-Gerätetest (siehe STAND). CACHE_VERSION → train-v174, CSS → ?v=190 |
| B54: Install-Button im Onboarding | — | Direkter Anschluss an die Pre-Launch-Checkliste. Nutzer fragte, ob "Zum Home-Bildschirm hinzufügen" im Onboarding automatisiert werden kann. Technische Antwort zuerst gegeben statt direkt zu implementieren: Android/Chrome/Edge haben `beforeinstallprompt` (echter Ein-Tap-Dialog), iOS Safari hat KEINE solche API (Apple-Einschränkung), dort nur Anleitung möglich. Nach Bestätigung umgesetzt: index.html fängt `beforeinstallprompt` global ab (unterdrückt Browser-Mini-Infobar zugunsten eigener UI), feuert bei `appinstalled` ein Event → GoatCounter "App installiert". Neuer Onboarding-Screen erscheint NACH der Vorlagen-Wahl, aber nur wenn er etwas bewirken kann (iOS-Anleitung ODER echter Prompt vorhanden) — sonst komplett übersprungen (kein wirkungsloser Button auf Desktop/nicht unterstützten Browsern, kein erneutes Zeigen wenn bereits installiert). Reused bestehende `.ob-*`-CSS (teils bisher toter Code erstmals bespielt) und das `train:show-update-banner`-Event-Muster. Verifiziert per Playwright in 3 Szenarien (Android-simuliert/iOS-simuliert/Desktop-unsupported). CACHE_VERSION → train-v175, CSS → ?v=191 |

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
**DSGVO/Rechts-Review (2026-07-14, reine Doku-Session, kein Code geändert):**
Nutzer bat um Prüfung auf DSGVO-Verstöße/rechtliche Risiken vor weiterer
Nutzerwerbung. Ergebnis, jetzt als B55-B58 in BUGS.md getrackt:
- **B55 (Blocker):** Impressum-Platzhalter (`ui.js:4113-4118`) ist kein
  bloßes TODO mehr, sondern ein akutes Abmahnrisiko — App ist bereits live,
  Nutzerwerbung + Bezahlfunktion sind geplant, das reicht für
  Impressumspflicht nach § 5 TMG/DDG. Deckt sich mit TODO 2 unten, jetzt aber
  explizit priorisiert vor jeder weiteren Nutzerwerbung (auch vor dem
  20-Nutzer-Rekrutierungs-Schritt, strategische Priorität 1).
- **B56 (Mittel):** Datenschutz-Akkordeon ist keine vollständige
  Art.-13-Erklärung — fehlt v.a. ein GitHub-Pages-Hosting-Hinweis (IP-
  Verarbeitung durch Microsoft beim Ausliefern der Seite, unabhängig von
  GoatCounter) und Betroffenenrechte. Text-Fix, sobald B55 die
  Verantwortlicher-Angaben liefert.
- **B57/B58 (Low):** fehlende "Alle Daten löschen"-Funktion, fehlende
  OFL.txt für die selbst gehosteten Fonts — beides kein Blocker, leicht
  nachrüstbar.
Regressionstest 10/10 + Playwright 18/18 vor Session-Ende zur Kontrolle
gelaufen (kein Code geändert, daher wie erwartet unverändert grün).
**Nächster Schritt: B55 zuerst — braucht echten Namen + Kontaktanschrift
vom Nutzer, kann nicht durch Code allein gelöst werden. Danach B56
(Datenschutztext), dann zurück zu TODO 1/3/4 unten und strategischer
Priorität 1.**

**B54 umgesetzt (train-v175) — Install-Button im Onboarding:** vollständige
Umsetzung siehe STAND-Sektion oben. Direkter Anschluss an B51-B53. Damit ist
die Pre-Launch-Checkliste inhaltlich (code-seitig) vollständig abgeschlossen.
**Vier TODOs stehen weiterhin aus, bevor die App tatsächlich live an die
ersten Nutzer geht (nicht durch Code lösbar, brauchen Eingaben vom Nutzer):**
1. Kostenlosen GoatCounter-Account anlegen (goatcounter.com) und den echten
   Site-Code in `index.html` anstelle von `<SITE-CODE>` eintragen.
2. Impressum-Platzhalter in den Einstellungen (Info-Sektion, ui.js) mit
   echten Kontaktdaten füllen.
3. Feedback-mailto-Adresse in derselben Sektion eintragen.
4. "Nutzer-Null"-Gerätetest manuell auf einem echten Gerät durchführen
   (Add-to-Homescreen — jetzt per Install-Button aus dem Onboarding heraus
   testbar, Splash Screen, Onboarding, erste Übung, Neustart-Persistenz).

**Offene Entscheidung (noch nicht umgesetzt, nur besprochen):** Nutzer fand
die GitHub-Pages-URL (`777random.github.io/TRAIN`) unprofessionell und
fragte nach Alternativen. Einschätzung gegeben: für einen Testlauf mit ~20
direkt eingeladenen Nutzern nicht kritisch (kein Kaltakquise-Kontext, in dem
die Domain misstrauisch wirken würde), GoatCounters Domain-Feld ist nur ein
Label ohne technische Kopplung — kann jederzeit ohne Datenverlust geändert
werden. Falls gewünscht: eigene Domain (~10-15€/Jahr) + `CNAME`-Datei im
Repo + DNS-Eintrag beim Registrar würde "github.io" komplett aus der URL
entfernen, kein Hosting-Wechsel nötig, ~15 Min. Setup + DNS-Wartezeit. Noch
keine Entscheidung getroffen — beim nächsten Mal nachfragen, ob das gewünscht
ist, oder direkt mit der GitHub-URL in den Testlauf starten.

Danach ist die Pre-Launch-Checkliste vollständig abgeschlossen. **Nächster
Schritt danach: zurück zur strategischen Priorität 1 (20 echte Nutzer
rekrutieren) — siehe CLAUDE.md.**

**B49+B50 umgesetzt (train-v173):** Anschluss an B48, mit `/plan` durchgeplant
(Explore+Plan-Agent, 3 Design-Fragen mit Nutzer abgestimmt). B49: sichtbarer
Schrittweite-Vorschlag aus geloggter Historie (`detectRecurringStep()` in
insightEngine.js, Schwelle 3 wiederholte Sprünge), nie automatisch angewendet
— nur "Übernehmen"-Button, analog zum bestehenden `.target-suggestion`-Muster.
B50: anpassbare Steigerungsmenge im "Neue Woche"-Empfehlungs-Chip ("Anderer
Wert"-Eingabe statt nur Ein/Aus), kein Halbierungs-Preset (Kollision mit B48s
internem halfDelta). Kritisches Architektur-Risiko (Auto-Preselect-Snapback
bei Custom-Werten) in der Planungsphase gefunden und mit `_userCustomStepChoice`-
Tracking gelöst, per dediziertem Playwright-Test verifiziert. Details siehe
BUGS.md B49/B50, DECISIONS.md. Damit sind sowohl der Konsolidierungs-Audit
(B44-B47) als auch die individuelle-Steigerungslogik-Anschlussarbeit (B48-B50)
vollständig abgearbeitet. **Nächster Schritt: zurück zur strategischen
Priorität 1 (20 echte Nutzer) — siehe CLAUDE.md.**

**B48 umgesetzt (train-v172):** Coach-Gewichtsempfehlung nutzt jetzt
die pro Übung eingestellte Schrittweite für die Sprunggröße, statt
eines fixen 2.5/1.25kg-Deltas — vom Nutzer selbst gemeldetes
Logik-Problem (nicht aus einem Audit), siehe BUGS.md B48/DECISIONS.md
für die Design-Entscheidung. Damit sind sowohl der Konsolidierungs-
Audit (B44-B47) als auch dieser direkt gemeldete Fund abgearbeitet.

**Konsolidierungs-Sprint B44-B47 abgeschlossen (train-v171).** Fund 4
aus dem Audit (PR-Erkennung) wurde genauer geprüft — Zeile-für-Zeile-
Vergleich ergab: `CONFIRM_SET`/`AUTO_EVAL_SET` bit-identisch,
`SET_TOGGLE_DONE` hatte einen echten Bug (fehlendes `ex.oneRM`-Update).
Behoben als B47, siehe oben/BUGS.md. Damit sind alle 4 Funde aus dem
Konsolidierungs-Audit abgearbeitet — keine offenen Duplikations-Risiken
mehr aus dieser Prüfung bekannt. Nächster Schritt: zurück zur
strategischen Priorität 1 (20 echte Nutzer).

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
