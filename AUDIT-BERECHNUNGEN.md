# TRAIN — Audit: Berechnungs-Konsistenz (Runde 8, Cluster 1)
*Erstellt: 2026-08-02, Basis train-v228/v229*
*Anlass: Nutzer-Sorge, dass Berechnungen im Projekt zu kleinteilig/uneinheitlich
geworden sind, ausgelöst durch den konkreten B181-Bug (Soll-Satzzahl nach
Übungs-Archivierung veraltet).*

**Leitplanke (wörtlich vom Nutzer vorgegeben):** "Single Source of Truth"
heißt NICHT, alles auf eine Zahl zu zwingen. Runde 7 (C6, RPE-Schwellen) hat
gezeigt, dass mehrere scheinbar doppelte Werte tatsächlich unterschiedliche
Konzepte mit unterschiedlichem Zeitfenster waren — korrekt getrennt, nicht
konsolidiert. Dieses Dokument unterscheidet daher explizit zwischen:
- **"gleiche Quelle, konsistent"** — keine Aktion nötig.
- **"gleiches Konzept, unterschiedliche Quelle/Berechnung — VERDACHT AUF BUG"**
  — echte Divergenz, potenzieller Fix-Kandidat für eine künftige Runde.
- **"unterschiedliches Konzept, korrekt getrennt"** — absichtliche
  Kontextabhängigkeit, keine Konsolidierung sinnvoll.

**WICHTIG:** Dieses Dokument ist reine Diagnose aus Runde 8. Keiner der unten
gelisteten "VERDACHT AUF BUG"-Funde wurde in Runde 8 gefixt — das war
explizite Sprint-Vorgabe. Umsetzung erfolgt erst nach separater,
expliziter Freigabe durch den Nutzer in einer künftigen Runde.

---

## Domäne A — Satz-/Ziel-/Completion-Zahlen

| Fundstelle(n) | Konzept | Klassifizierung |
|---|---|---|
| `ui.js:909-921` (Live-Progress-Bar), `ui.js:1004-1018` (Tab-Pills), `ui.js:1038-1054` (Übersichts-Karten) | "X von Y Sätzen / %" während der Session | gleiche Quelle, konsistent (3× dieselbe Formel dupliziert, aber keine Divergenz) |
| `ui.js:8688-8756` `_getDayCompletionStats()` | Erfolgsquote im Tagesabschluss-Screen | war VERDACHT AUF BUG — **in Runde 8 bereits gefixt** (B181, `ex.archived`-Filter ergänzt) |
| `ui.js:8730-8742` `effortPct` | Aufwand-Erfüllung (Wdh-Volumen vs. Soll) | unterschiedliches Konzept, korrekt getrennt |
| `weekReview.js:59-66` `_countSuccessSets()` | "✓ X Sätze" über die ganze Woche | unterschiedliches Konzept, korrekt getrennt (anderes Zeitfenster/Nenner) |
| `weekReview.js:239-260` `_reachableDays` | "Tage abgeschlossen/erreichbar" | unterschiedliches Konzept, korrekt getrennt (Tage- statt Satz-Ebene) |
| `overallPerformance.js`/`weeklyFocus.js` Trend-/Verhältnis-% | Mehrwochen-Trends, Push/Pull-Ratio etc. | unterschiedliches Konzept, korrekt getrennt |
| **`ex.targetSets`** (`ui.js:9701` Onboarding, `state.js` Deep-Clone über WEEK_CREATE/AUTO_WEEK_CREATE, gelesen von `ui.js:1643` "Fokus heute"-Karte) | Soll-Satzzahl EINER einzelnen Fokus-Übung vor Sessionstart | **VERDACHT AUF BUG** — einmalig bei Onboarding gesetzt, NIE aktualisiert bei manuellem Satz-Hinzufügen/-Entfernen (SET_ADD/SET_REMOVE ändern nur `ex.sets`, nie `ex.targetSets`). Eine v9→v10-Migration hat das Feld für Bestandsdaten bereits mit der Begründung "replaced by ex.sets.length" entfernt — der Onboarding-Pfad erzeugt es bei jedem neuen Nutzer wieder frisch. **Empfehlung:** Feld entfernen, Lesestelle auf `sets.length` umstellen (konsistent mit der bereits dokumentierten Migrations-Absicht). |

## Domäne B — Gewicht-/PR-Berechnungen

| Fundstelle(n) | Konzept | Klassifizierung |
|---|---|---|
| `state.js:1649` `_applyPrTracking()` | Live-PR-Erkennung | gleiche Quelle, konsistent (einzige Implementierung seit B47) |
| `insightEngine.js:50-91` `exWeightHistory()`/`exSetCountHistory()`/`exMetricHistory()` | kanonische Wochen-Zeitreihen | gleiche Quelle, konsistent (exportiert, überall wiederverwendet) |
| `getEffectiveWeightStep()` (B167) | effektive Gewichts-Schrittweite | gleiche Quelle, konsistent — ~22 Aufrufstellen geprüft, lückenlos durchgesetzt, kein übersehener Inline-Fallback gefunden |
| `sessionSummary.js:52-63,79-92` `_weeksSincePreviousIncrease()` | "+Xkg seit letztem Mal" | unterschiedliches Konzept, korrekt getrennt (dokumentierte B79-Entscheidung) |
| `ui.js:3376` `_renderAnalysis1RM()` Epley-Fallback | 1RM-Schätzung bei fehlendem `state.prs` | unterschiedliches Konzept, korrekt getrennt (deckt eine dokumentierte B31-Lücke) |
| **`weekReview.js:68-114` `_maxWeightPerExercise()`/`_findPR()`** (→ Wochenrückblick-Modal "Neuer PR"/"Stärkste Steigerung") | "hat diese Übung gerade einen echten PR?" | **VERDACHT AUF BUG** — dritte unabhängige Neuimplementierung, filtert im Gegensatz zu `exWeightHistory()`-Aufrufern UND `_applyPrTracking()` KEINE Deload-Wochen heraus. Könnte "Neuer PR" während/gegen eine Deload-Woche zeigen. Gleiche Bug-Klasse, die B73/B79 bereits an anderer Stelle gefixt haben. **Empfehlung:** Deload-Filter ergänzen (wie bei den anderen beiden Implementierungen), langfristig auf `exWeightHistory()` umstellen. |
| `ui.js:2929-2983` `_weeklyP4PSeries()`/`_allTimePRSeries()` | "Max. Gewicht pro Woche" fürs Relative-Stärke-Chart | VERDACHT AUF BUG (geringer) — dritter Code-Pfad für dieselbe Kernberechnung wie `exWeightHistory()`, aktuell funktional gleichwertig (filtert Deload korrekt), aber Duplikations-Risiko bei künftigen Änderungen an `exWeightHistory()`. |

## Domäne C — Streak-/Konsistenz-Berechnungen

| Fundstelle(n) | Konzept | Klassifizierung |
|---|---|---|
| `state.js` `calcCurrentStreak()`/`calcLongestStreakEver()` | Wochen-Streak | gleiche Quelle, konsistent (B74-Konsolidierung hält vollständig, keine neue parallele Reimplementierung gefunden) |
| `weeklyFocus.js:674-680` `_qualificationStreak` | Auto-Progressions-Eignung einer Übung | unterschiedliches Konzept, korrekt getrennt (gleicher Begriff "Streak", anderes Domain-Objekt) |
| `setUtils.js:41` `weekSuccessCounts()` | Wochen-Erfolgsquote | gleiche Quelle, konsistent (seit B38 einzige Quelle) |
| `plateauDetector.js`/`weightRecommendation.js` `_exSuccessRate`/`isFullSuccess` | Pro-Übung-Erfolgsquote für Plateau/Progression | unterschiedliches Konzept, korrekt getrennt (strengerer Maßstab, bewusst dokumentiert) |
| `consistencyUtils.js` `_weekConsistencyRatio()` | Tages-Konsistenz-Ratio | gleiche Quelle, konsistent untereinander (overallPerformance.js/weeklyFocus.js importieren dieselbe Funktion) |
| **`consistencyUtils.js`s "Tag erledigt" = `day.markedDone`** vs. **`state.js` `_weekTrainingStatus()`s "Tag erledigt" = ≥50% Sätze bewertet** | beide beantworten "war der Tag erledigt?" | **VERDACHT AUF BUG (wichtigster Fund dieser Runde)** — `markedDone` ist ein expliziter Nutzer-Toggle, wird NICHT automatisch gesetzt, wenn der Nutzer alle Sätze bewertet ohne den Button zu drücken. Die Streak-Basis verwendet bewusst NICHT `markedDone` (Anti-Streak-Faking, dokumentiert). B38 hat exakt diese Diskrepanz bereits für URLAUBSTAGE gefixt — der reguläre Trainingstag-Zweig von `_weekConsistencyRatio()` scheint weiterhin betroffen. Praktische Konsequenz: Trainings-Tab-Streak und Fortschritt-Tab-Konsistenz-%/Coach-Signale können denselben Tag unterschiedlich bewerten. **Empfehlung:** gleiche Fix-Formel wie B38, diesmal auf den Nicht-Urlaubs-Zweig angewendet (z.B. "erledigt" = `markedDone` ODER ≥50% Sätze bewertet). |
| `weeklyFocus.js` `_scoreWeek()` | dupliziert `weekSuccessCounts()` 1:1 | kleinerer Nebenfund — bewusst dokumentiertes Duplikat (zirkulären Import vermeiden), aktuell konsistent, aber ungeschützt vor künftigem stillen Auseinanderlaufen (gleiche Ursache wie der historische B38-Bug). |

## Domäne D — RPE-/Coaching-Schwellen

Baut auf dem vollständigen Runde-7-Audit auf (`diagnose-runde7-2026-08-02.txt`,
5 Stellen bereits bewertet, alle korrekt getrennt). Neuer Nebenfund aus
Runde 7 vertieft:

| Fundstelle | Konzept | Klassifizierung |
|---|---|---|
| `weeklyFocus.js:737-751` `_checkProgression()` Konfidenz-Klassifizierung | 4-Wochen-Fenster, kombiniert RPE+Erfolgsquote zu high/medium/low-Konfidenz für eine Steigerungs-Empfehlung | unterschiedliches Konzept, korrekt getrennt — 4-Wochen-Fenster einzigartig unter allen 6 Funden, Zweck (Empfehlungs-Konfidenz labeln) grundlegend anders als Deload-Erkennung. **Achtung:** die Werte 7.5/8.5 sind rohe Inline-Literale, NICHT Referenzen auf `RPE_PREVENTIVE_DELOAD_3WK_AVG`/`RPE_SET_HARD_ZONE` (Runde 7) — Verwechslungsrisiko. Vorschlag (kosmetisch): eigene Konstanten `CONF_HIGH_AVG_RPE_MAX_4WK`/`CONF_MEDIUM_AVG_RPE_MAX_4WK` mit Kommentar zur zufälligen Zahlen-Übereinstimmung. |

## Domäne E — Pausenzeiten-Berechnungen

| Fundstelle(n) | Konzept | Klassifizierung |
|---|---|---|
| `sessionCoach.js:75-101` `_pauseSecForRpe()` | einzige RPE-Pausentabelle | gleiche Quelle, konsistent |
| `ui.js` confirm-set-Pfad, `timer.js` toggle-done-Pfad | Auto-Start Pausentimer nach Satzbewertung | gleiche Quelle, konsistent (B78 bereits gefixt) — bleibt architekturbedingt als Code-Duplikat in 2 Dateien bestehen (ui.js↔timer.js-Import verboten), Wartungsrisiko, kein aktueller Bug |
| `ui.js` `adopt-set-feedback`-Button | "Übernehmen" setzt Pause explizit, kein Fallback auf `ex.pauseSec` | unterschiedliches Konzept, korrekt getrennt (bewusste Design-Entscheidung) |
| `ex.pauseSec`-Editierpfad, History-Vererbung, Schema-Defaults | statischer Nutzer-Default | unterschiedliches Konzept, korrekt getrennt |

**Kein Bug in dieser Domäne gefunden.** Einziger Nebenfund: veralteter
Kopfkommentar in `timer.js:26` (rein kosmetisch, keine funktionale Wirkung).

---

## Zusammenfassung: 3 Verdachtsfälle für eine künftige Runde

1. **`ex.targetSets`** (Domäne A) — gleiche Fehlerklasse wie B181, kleinerer
   Blast-Radius. Empfehlung: Feld entfernen.
2. **`weekReview.js` PR-Karte ohne Deload-Filter** (Domäne B) — gleiche
   Fehlerklasse wie B73/B79. Empfehlung: Deload-Filter ergänzen.
3. **`_weekConsistencyRatio()` markedDone-Diskrepanz** (Domäne C, wichtigster
   Fund) — gleiche Fehlerklasse wie B38 (dort nur für Urlaubstage gefixt).
   Empfehlung: dieselbe Fix-Formel auf reguläre Trainingstage anwenden.

Plus 2 kleinere kosmetische Nebenfunde (Domäne C: `_scoreWeek()`-Duplikat;
Domäne D: unbenannte Konfidenz-Konstanten in `weeklyFocus.js:737-751`).

**Kein Fix in Runde 8.** Nutzer entscheidet (ggf. mit Claude Cowork), welche
dieser Punkte in einer künftigen Runde freigegeben werden.
