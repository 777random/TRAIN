# Test-Fixtures

JSON-Testszenarien für TRAIN. Jede Datei simuliert einen spezifischen App-Zustand.

## Namenskonvention
`TRAIN_Test_[Szenario].[vN].json`

## Beim Import testen
Settings → JSON importieren → Datei auswählen → Erwartung prüfen

## Aktuelle Szenarien

Alle 5 Szenarien wurden am 2026-07-12 (train-v158) erstmals ECHT importiert
und headless verifiziert (nicht nur `JSON.parse()`-Syntax-Check). Ergebnisse
unten je Datei unter "Real-Test-Ergebnis".

| Datei | Zweck | Erwartung | Real-Test-Ergebnis (v158) |
|-------|-------|-----------|---------------------------|
| TRAIN_Test_iOS_Zoom.v1.json | Training-Tab mit Gewichts-Picker öffnen, Doppeltipp auf Picker-Feld testen (B16) | Kein Browser-Zoom bei Doppeltipp | B16 wurde in v158 behoben (touch-action + font-size≥16px, siehe BUGS.md). App lädt fehlerfrei mit dieser Fixture (0 uncaught errors). Das eigentliche Zoom-Verhalten selbst bleibt headless nicht testbar — braucht echtes Touch-Gerät. |
| TRAIN_Test_HeuteAnders.v1.json | "Heute anders" (Ausweichübung) öffnen (B17) | Ausweichübung sollte frisches/leeres Template zeigen | **v158:** Feld selbst leer (kein Auto-Fill), aber "Vorwoche"-Hint-Button zeigte Gewicht/Wdh der URSPRÜNGLICHEN Übung (Kniebeuge: 100kg/5×) als Vorschlag für die Ausweichübung (Beinpresse) — `renderExercise()` sucht `prevEx` bei Substitution bewusst über `ex.substituteFor`, nicht `ex.name` (ui.js:1217). **v159: behoben** — `renderSetRow()` unterdrückt die Adopt-Hints jetzt explizit wenn `ex.substituteFor` gesetzt ist (ui.js:1667), `prevEx` selbst bleibt für den unabhängigen Fulfill-Meter-Metrik-Check (ui.js:1635) unverändert. Re-verifiziert: `adopt-prev-weight`/`adopt-prev-reps`-Buttons erscheinen nicht mehr, Sub-Banner weiterhin korrekt, 0 uncaught errors. |
| TRAIN_Test_EdgeCase_LeerWoche.v1.json | Tag ohne jegliche Übungen öffnen | App darf nicht abstürzen, sollte Empty-State zeigen | Kein Crash, 0 uncaught errors. Kein dediziertes "Empty State"-Element (`.empty-state` ist nur für "Woche ohne Tage" reserviert) — stattdessen wird direkt der leere `data-ex-list` + "Übung hinzufügen"-Button gezeigt. Funktional gleichwertig, nur andere Umsetzung als ursprünglich angenommen. |
| TRAIN_Test_EdgeCase_AllesFail.v1.json | 4 Wochen mit ausschließlich fail-Sätzen — Coach-Tab öffnen | Coach sollte NICHT "Steigerung sinnvoll" zeigen | Bestätigt: Coach zeigt "🔋 Schlaf priorisieren" (Overload-Signal), keine Progression. Achtung: Diese Fixture hat auch durchgehend niedrige `sleepHours` (4.5-5.5h) — das Schlaf-Signal überlagert möglicherweise, was eigentlich getestet werden sollte (Reaktion auf reine Fail-Sätze ohne Schlaf-Störfaktor). Für eine schärfere Prüfung bräuchte es eine Variante mit normalem Schlaf. 0 uncaught errors. |
| TRAIN_Test_EdgeCase_MaxGewicht.v1.json | Übung mit 500kg Gewicht, Fortschritt-Tab / 1RM-Schätzung öffnen | Kein NaN/Infinity/Overflow in 1RM-Anzeige oder Chart-Skalierung | Bestätigt: 1RM-Hint zeigt "~550.0 kg 1RM (Epley)" — korrekte, plausible Berechnung (500kg × 3 Wdh via Epley). Kein NaN, kein Infinity im gesamten Fortschritt-Tab. 0 uncaught errors. |

## Bekannte Konstruktionsregeln (aus BUGS.md, gilt für alle neuen Szenarien)
- `weight=0` bei einer Übung → `_checkRisingRpe` überspringt diese Übung (Guard `weights.some(w=>w===0)`)
- `lastReentryHandled` muss `null` sein, sonst feuert `_checkReentry` immer zuerst (höchste Priorität)
- Für Push/Pull-Balance-Tests: max. 7 Wochen (ab 8 Wochen greift präventiver Deload zuerst)
- Für `_checkConsistencyQuality`: echte fail-Sätze nötig, `reps < targetReps` allein reicht nicht
- Übungsnamen müssen in `movementMap.js` (MOVEMENT_MAP) bekannt sein, sonst greift der Push/Pull-Guard nicht korrekt
