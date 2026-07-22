# TRAIN — Session Handoff
*Letzte Aktualisierung: 2026-07-22, B91-B94 Session Coach Entscheidungsmatrix v2 + Begründung + dauerhafte Übernehmen-Bestätigung (train-v203, SCHEMA 32 unverändert)*
*Nächster Schritt: B55 bleibt der letzte echte Launch-Blocker (Impressum-Platzhalter, siehe LEGAL.md) — braucht Name+Adresse+E-Mail vom Nutzer. B66 (Fehler-Toast) bleibt offen bis zum nächsten Auftreten — weiterhin blockiert auf echte GoatCounter-Telemetrie (`js_error:`-Events im Dashboard prüfen). Aktuell keine weiteren offenen Bugs außer B55/B66. Loops 7-11 aktiv: Advisor-Exports werden am Ende jeder Session automatisch aktualisiert. for-advisor-consolidated.txt = Startpunkt für neue externe Chats.*

---

## ZIEL
Decision Support System für Krafttraining — nicht Workout-Tracker.
Aktuelle Priorität: UX-Bugs beheben → Edge-Case-Audit → 20 echte Nutzer rekrutieren.

---

## STAND
- CACHE_VERSION: train-v203 (v155 wurde nie vergeben, siehe vorherige
  Sprint-Notiz — Nummerierung folgt echten Code-Sprints, nicht der
  Sprint-Text-Nummerierung)
- CSS: ?v=199 (neue `.set-feedback__why-toggle`/`__why-body`,
  `.set-feedback__line--reverted`)
- SCHEMA: 32 (unverändert — B91-B94 fügen keine neuen State-Felder hinzu,
  reine sessionCoach.js/ui.js-Logik- und Rendering-Änderungen)
- Letzter Commit: siehe `git log` (dieser Sprint noch nicht gepusht,
  siehe Sprint-Ende-Workflow).
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
