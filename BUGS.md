# TRAIN — Bug-Tracking
*Wird nach jedem Sprint aktualisiert*
*Stand: Juli 2026 / train-v160*

---

## BEHOBEN

| ID | Beschreibung | Version | Commit | Root Cause |
|----|-------------|---------|--------|-----------|
| B01 | Auto-Eval bei 0 Wdh → Satz bleibt pending | v151 | f1d4f54 | Guard `reps <= 0` in _handleBlur → geändert zu `reps < 0` |
| B02 | Wochenerstellung: Erfolgs-Toast obwohl nichts erstellt | v151 | f1d4f54 | before/after weeks.length Check fehlte im _createWeek() Handler |
| B03 | Verpasste Einheiten in laufender Woche | v152 | 66c034d | _reachableDays(): `<=` statt `<` — heutiger Tag galt als bereits fällig |
| B04 | Zeitbezug zeigt "13 Wochen" obwohl App jünger | v151 | f1d4f54 | effectiveN nicht gegen realWeeks geclampt |
| B05 | Fulfill-Meter zählt fail-Sätze nicht | v151 | f1d4f54 | Filter nur success, fail-Sätze wurden ignoriert |
| B06 | Wiedereinstieg feuerte 14 Tage → zu lang | v151 | f1d4f54 | REENTRY_WINDOW_DAYS = 14 → 7 |
| B07 | _weekConsistencyRatio zählt future-Tage | v153 | ab33633 | `<=` statt `<` — identischer Off-by-one wie B03 |
| B08 | ui.js:1183 Live-Hinweis inkonsistent zu Fulfill-Meter | v154 | 8686458 | 1183 nur success, 1642 success+fail seit v151 |
| B09 | Prozentzahlen: s.reps als String → Milliarden-% | v143 | — | s.reps wurde als String gespeichert, parseFloat fehlte |
| B10 | weightStep=0 → NaN in Gewichtsempfehlung | v143 | — | `?? 2.5` statt `|| 2.5` — 0 ist falsy für ?? nicht |
| B11 | Erkenntnisse-Stepper springt zum Übungsfortschritt | v152 | 66c034d | Layout-Reflow nach innerHTML-Replace, scrollTop-Restore fix |
| B12 | Erkenntnisse-Stepper: Plus über echte Wochen hinaus | v152 | 66c034d | Kein stepperMax gegen realWeeks |
| B13 | barbell Row nicht als Pull erkannt | v149 | 8143086 | "Barbell Row" fehlte in movementMap.js |
| B14 | Pull Ups (weight=0) triggert _checkRisingRpe nicht | — | — | Guard weights.some(w=>w===0) — by design, kein Bug |
| B15 | isSeedWeek als Vorlage für neue Woche | v151 | f1d4f54 | _templateWeekForNewWeek() überspringt isSeedWeek |
| B24 | dragdrop.js nie aktiviert → Touch-Drag defekt auf iOS/Android | v156 | a3752f8 | Polyfill in index.html verdrahtet — `<script src="./dragdrop.js">` + `MobileDragDrop.polyfill()` vor dem Module-Script. Abweichung von der Sprint-Vorlage: touchmove-preventDefault() nur während aktivem Drag (Flag über dragstart/dragend/drop), nicht global — eine bedingungslose preventDefault() hätte jegliches Scrollen auf Touch-Geräten dauerhaft blockiert. Touch-Verhalten selbst NICHT auf echtem Gerät verifiziert (siehe HANDOFF.md) — nur headless bestätigt: Skript lädt fehlerfrei, kein Uncaught-Error, `#app` erreicht `is-ready`. |
| B22 | Erfolgsquote inkonsistent (3 verschiedene Formeln im UI) | v157 | e0b0f01 | success/(success+fail) vereinheitlicht, pending ausgeschlossen — als einzig korrekte Semantik (identisch zu `_weekSuccessScore()`) festgelegt. `_getDayCompletionStats()` (ui.js:6419): vorher `successSets/totalSets` (totalSets inkl. pending) → jetzt `successSets/(successSets+failSets)`, `pct:null` statt `0` wenn noch nichts bewertet. `_renderMovementPattern()` (ui.js:2302): Kategorie-Balken zählten vorher nur success-Sätze in Zähler UND Nenner (fail unsichtbar) → jetzt success+fail. `_weekSuccessScore()` bewusst unverändert gelassen (war bereits korrekt). Bewusst NICHT angefasst: Push/Pull-Ratio-Block in `_renderMovementPattern()` zählt weiterhin nur success — out of scope für diesen Sprint, potenzieller Folge-Fund. |
| B23 | Beinbeuger (+ englische Synonyme) unter Squat statt Hinge | v157 | e0b0f01 | movementMap.js korrigiert: `'Beinbeuger'`, `'Leg Curl'`, `'Leg Curls'`, `'Hamstring Curl'` von Squat → Hinge (Hamstring-Curl ist hüftdominant, nicht kniedominant). Zusätzlicher Fund bei der Gelegenheit (nicht angefordert, aber eindeutig): `'Butterfly'` stand unter Pull, korrigiert zu Push — Widerspruch zu den bereits korrekt als Push klassifizierten `'KH Flys'`/`'Flys Kabel'` (Brust-Fly-Bewegung, nicht zu verwechseln mit `'Reverse Flys'`, korrekt unter Pull für hintere Schulter). Geprüfte, bewusst nicht geänderte Grenzfälle (Ausfallschritte/Lunges als Squat, Wadenheben als Hinge, Front/Lateral Raise als Pull, Battle Ropes/Burpees als Core) siehe Sprint-Notiz in HANDOFF.md. |
| B16 | iOS Doppelklick-Zoom beim Picker | v158 | e312751 | **Diagnose korrigiert/erweitert** — die ursprüngliche Notiz "font-size < 16px → Browser-Zoom" beschreibt tatsächlich ein anderes Phänomen (iOS' Zoom-bei-Fokus, ein Einzeltipp-Effekt) als der Bugname nahelegt (Doppeltipp-Zoom). Zwei unabhängige, echte Ursachen gefunden und beide behoben: (1) Der "+kg"/"+Wdh"-Button (`data-action="inc-weight"`, ui.js:1494) hat eine selbstgebaute 400ms-Doppeltipp-Erkennung (ui.js:4877-4917: einmal tippen = Steigerung bestätigen, zweimal tippen = Werte-Picker öffnen), aber kein `touch-action`, wodurch iOS' natives Doppeltipp-Zoom-Gesture gleichzeitig feuern kann — Fix: `touch-action: manipulation` auf `.btn-icon--kg` (styles.css). (2) `.num-input` (Basis-Klasse für alle Gewicht/Wdh/RPE-Sätze, vorher 14px) und `.ex-kg-picker-custom .num-input` (Custom-Wert-Feld im Picker-Popover, vorher 13px, Override entfernt) lagen unter 16px → Fix: 16px. Grid-Layout-Regression durch die Font-Size-Erhöhung geprüft und ausgeschlossen (A/B-Screenshot bei 390px-Breite, 14px vs. 16px identisch abgeschnitten am rechten Rand — vorbestehend, nicht neu). Regressionstest 10/10 grün nach beiden Fixes. Touch-Verhalten selbst NICHT auf echtem Gerät verifiziert (headless kann keine echten Touch-Events auslösen) — nur Layout und Code-Korrektheit bestätigt. |
| B25 | Coach zeigt "Auf Kurs" trotz mehrwöchigem komplettem Fail | v160 | 668b00a | Gefunden bei Edge-Case-Audit v159 (TRAIN_Test_EdgeCase_AllesFail_GuterSchlaf.v1.json). Root Cause: JEDE Funktion in der computeWeeklyFocus()-Kaskade filterte auf `status === 'success'`, bevor sie ein Signal berechnete — bei 0 Erfolgen fiel alles bis zum Fallback "Auf Kurs" durch. Produktentscheidung getroffen (Design-Diskussion mit Nutzer): neue Funktion `_checkPersistentFailure()` (weeklyFocus.js), Priorität 2 direkt nach `_checkReentry` und VOR `_checkOverload` (eingetretenes Totalversagen dringlicher als drohende Überlastung), Schwelle 0% Erfolg über 3 Wochen (analog zum 3-Wochen-Fenster von `_checkPlateau`), muss in allen 3 Wochen tatsächlich versucht+bewertet worden sein. Empfehlung berechnet konkretes Gewicht via bestehendem `deloadFactor`+`roundToPlate()` (z.B. "Gewicht bei Bankdrücken auf ~60 kg reduzieren" statt nur Text). Neues Icon 🛑 (`persistent_failure`) in ui.js `_FOCUS_ICONS` ergänzt. Bewusst OHNE Decisional-Balance (buildDecisionalBalance() unterstützt nur 'overload'/'consistencyGap') — UI zeigt in dem Fall einfach keine Stay/Change-Buttons, das ist bereits das bestehende Fallback-Verhalten für Status ohne Balance (z.B. plateau/progression). Verifiziert: beide AllesFail-Fixtures zeigen jetzt korrekt "🛑 Gewicht zu hoch" statt "Auf Kurs" bzw. statt "Schlaf priorisieren" (persistent_failure hat jetzt Vorrang, wie entschieden). Regressionstest 10/10 grün. |
| B17 | Heute anders — kein frisches Template | v159 | 6e1a203 | Root Cause (Korrektur einer eigenen Fehldiagnose vom Edge-Case-Audit v158, die "positionsbasiert" behauptet hatte — tatsächlich namensbasiert, aber auf den FALSCHEN Namen): `renderExercise()` sucht `prevEx` bei einer Ausweichübung bewusst über `ex.substituteFor` statt `ex.name` (ui.js:1217, für den Fulfill-Meter-Metrik-Check bei Zeile 1635 sinnvoll) — dieser `prevEx` wurde aber auch für die "Vorwoche"-Adopt-Hints in `renderSetRow()` verwendet und zeigte dadurch Gewicht/Wdh der URSPRÜNGLICHEN Übung (z.B. Kniebeuge: 100kg) als Vorschlag für die tatsächlich heute ausgeführte Ausweichübung (z.B. Beinpresse, die noch nie trainiert wurde) — potenziell irreführend, da unterschiedliche Übungen meist sehr unterschiedliche Gewichtsbereiche haben. Fix: in `renderSetRow()` wird `prevSet` jetzt explizit auf `null` gesetzt wenn `ex.substituteFor` gesetzt ist (ui.js:1667) — unterdrückt nur die Adopt-Hints, lässt `prevEx` für den unabhängigen Fulfill-Meter-Guard unangetastet. Verifiziert mit TRAIN_Test_HeuteAnders.v1.json: `adopt-prev-weight`/`adopt-prev-reps`-Buttons erscheinen jetzt korrekt nicht mehr für die Ausweichübung, Sub-Banner weiterhin korrekt. Regressionstest 10/10 grün. |

---

## OFFEN

| ID | Beschreibung | Priorität | Notizen |
|----|-------------|-----------|---------|
| B18 | Meter statt Wdh fehlt als Progressionstyp | UX-Mittel | metric:'distance' für Übungen wie Laufen, Rudermaschine |
| B19 | Outlook/Prognose bei konstantem Gewicht | Low | curRate ≤ 0 → kein Korridor. "Kein klarer Trend" erscheint korrekt (by design) |
| B20 | getCompletionRate()/_scoreWeek() isFullSuccess | Low | Verwandter Bug-Typ. Bewusst zurückgestellt (Semantik: Anwesenheit, nicht Ziel) |
| B21 | Sperrbildschirm-Integration | UX-komplex | Media Session API + Service Worker. Nach echten Nutzern |

---

## BEWUSST KEIN BUG (by design)

| Beschreibung | Begründung |
|-------------|-----------|
| Pull Ups (weight=0) löst _checkRisingRpe nicht aus | Guard ist korrekt — Körpergewicht-Übungen haben kein messbares Gewicht für den Overload-Check |
| _scoreWeek() nutzt kein isFullSuccess() | Misst Anwesenheit ("hat trainiert"), nicht Zielerreichung. Semantisch korrekt für Streak/Konsistenz |
| Prognose fehlt bei stagnierenden Übungen | curRate ≤ 0 → kein Trend → keine Prognose. "Kein klarer Trend" ist die korrekte Aussage |
| Konfidenz HIGH/MEDIUM/LOW und Progressionsbereitschaft haben unterschiedliche RPE-Schwellen | Messen verschiedene Dinge — nicht vereinheitlichen |

---

## BEKANNTE FALLSTRICKE (für Test-JSON-Konstruktion)

| Fallstrick | Wirkung | Lösung |
|-----------|---------|--------|
| weight=0 in Übung | _checkRisingRpe überspringt Übung | Echtes Gewicht > 0 verwenden |
| lastReentryHandled gesetzt | _checkReentry feuert immer (Prio 1) | null setzen |
| Zu viele Wochen (>8) | Präventiver Deload feuert vor Push/Pull | Max 7 Wochen für Push/Pull-Tests |
| fail-Sätze fehlen | _checkConsistencyQuality feuert nicht | Echte fail-Sätze nötig (reps<targetReps reicht nicht) |
| Gewicht steigt konstant | Plateau-Signal verdrängt Push/Pull | Konstantes Gewicht ODER <3 Wochen für Plateau-Bedingung |
| Übungsname nicht in movementMap | pullSets=0 → Push/Pull-Guard greift | Bekannten Namen verwenden (z.B. "Rudern" statt "Barbell Row") |
| curPct < 0.7 als Guard | Totes Code — Scale ist 0-100 | curPct < 70 verwenden |
| Genau 2 Wochen identisches Gewicht | Kein Plateau (braucht 3+, verifiziert v160) | 3+ Wochen für Plateau-Tests verwenden |
| Genau 8 Wochen ohne Deload | Präventiver Deload feuert (Schwelle ≥8, verifiziert v160) | Für Push/Pull-Tests weiterhin max. 7 Wochen (siehe oben) |
