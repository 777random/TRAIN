# Test-Fixtures

JSON-Testszenarien für TRAIN. Jede Datei simuliert einen spezifischen App-Zustand.

## Namenskonvention
`TRAIN_Test_[Szenario].[vN].json`

## Beim Import testen
Settings → JSON importieren → Datei auswählen → Erwartung prüfen

## Aktuelle Szenarien

| Datei | Zweck | Erwartung |
|-------|-------|-----------|
| TRAIN_Test_iOS_Zoom.v1.json | Training-Tab mit Gewichts-Picker öffnen, Doppeltipp auf Picker-Feld testen (B16) | Kein Browser-Zoom bei Doppeltipp — aktuell FEHLSCHLÄGT dieser Test (B16 ist offen), font-size < 16px in Picker-Feldern löst Zoom aus |
| TRAIN_Test_HeuteAnders.v1.json | "Heute anders" (Ausweichübung) öffnen (B17) | Ausweichübung sollte frisches/leeres Template zeigen — aktuell FEHLSCHLÄGT: erbt Vorwoche-Daten (B17 offen) |
| TRAIN_Test_EdgeCase_LeerWoche.v1.json | Woche ohne jegliche Übungen öffnen | App darf nicht abstürzen, sollte Empty-State zeigen (siehe ui.js empty-state Handling) |
| TRAIN_Test_EdgeCase_AllesFail.v1.json | 4 Wochen mit ausschließlich fail-Sätzen — Coach-Tab öffnen | Coach sollte NICHT "Steigerung sinnvoll" zeigen — erwartet ehestens Overload- oder Konsistenz-Signal, keine Progression |
| TRAIN_Test_EdgeCase_MaxGewicht.v1.json | Übung mit 500kg Gewicht, Fortschritt-Tab / 1RM-Schätzung öffnen | Kein NaN/Infinity/Overflow in 1RM-Anzeige oder Chart-Skalierung |

## Bekannte Konstruktionsregeln (aus BUGS.md, gilt für alle neuen Szenarien)
- `weight=0` bei einer Übung → `_checkRisingRpe` überspringt diese Übung (Guard `weights.some(w=>w===0)`)
- `lastReentryHandled` muss `null` sein, sonst feuert `_checkReentry` immer zuerst (höchste Priorität)
- Für Push/Pull-Balance-Tests: max. 7 Wochen (ab 8 Wochen greift präventiver Deload zuerst)
- Für `_checkConsistencyQuality`: echte fail-Sätze nötig, `reps < targetReps` allein reicht nicht
- Übungsnamen müssen in `movementMap.js` (MOVEMENT_MAP) bekannt sein, sonst greift der Push/Pull-Guard nicht korrekt
