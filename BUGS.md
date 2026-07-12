# TRAIN — Bug-Tracking
*Wird nach jedem Sprint aktualisiert*
*Stand: Juli 2026 / train-v154*

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

---

## OFFEN

| ID | Beschreibung | Priorität | Notizen |
|----|-------------|-----------|---------|
| B16 | iOS Doppelklick-Zoom beim Picker | UX-Hoch | font-size < 16px → Browser-Zoom. Fix: touch-action oder font-size ≥ 16px |
| B17 | Heute anders — kein frisches Template | UX-Mittel | Ausweichübung erbt Vorwoche-Daten statt leeres Template |
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
