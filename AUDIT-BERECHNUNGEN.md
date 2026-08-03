# TRAIN — Audit: Berechnungs-Konsistenz (Runde 8, Cluster 1)
*Erstellt: 2026-08-02, Basis train-v228/v229*
*Aktualisiert: 2026-08-03 (Runde 9) — die 3 "VERDACHT AUF BUG"-Funde wurden
vom Nutzer freigegeben und in Runde 9 gefixt (B185/B186/B187), siehe
BUGS.md und die Update-Vermerke unten bei den jeweiligen Domänen. Die 2
kosmetischen Nebenfunde (weeklyFocus.js-Duplikat, Konfidenz-Konstanten)
wurden ebenfalls in Runde 9 erledigt (B190). Dieses Dokument bleibt als
historisches Diagnose-Referenzdokument bestehen — der Status pro Fund ist
jetzt bei jedem "VERDACHT AUF BUG"-Eintrag unten vermerkt.*
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
| **`ex.targetSets`** (`ui.js:9701` Onboarding, `state.js` Deep-Clone über WEEK_CREATE/AUTO_WEEK_CREATE, gelesen von `ui.js:1643` "Fokus heute"-Karte) | Soll-Satzzahl EINER einzelnen Fokus-Übung vor Sessionstart | **VERDACHT AUF BUG — BEHOBEN in Runde 9 (B187).** Feld komplett entfernt (beide Schreibstellen, inkl. einer zweiten in state.js/ONBOARDING_SEED, die dieser Audit übersehen hatte), Lesestelle auf `sets.length` umgestellt. |

## Domäne B — Gewicht-/PR-Berechnungen

| Fundstelle(n) | Konzept | Klassifizierung |
|---|---|---|
| `state.js:1649` `_applyPrTracking()` | Live-PR-Erkennung | gleiche Quelle, konsistent (einzige Implementierung seit B47) |
| `insightEngine.js:50-91` `exWeightHistory()`/`exSetCountHistory()`/`exMetricHistory()` | kanonische Wochen-Zeitreihen | gleiche Quelle, konsistent (exportiert, überall wiederverwendet) |
| `getEffectiveWeightStep()` (B167) | effektive Gewichts-Schrittweite | gleiche Quelle, konsistent — ~22 Aufrufstellen geprüft, lückenlos durchgesetzt, kein übersehener Inline-Fallback gefunden |
| `sessionSummary.js:52-63,79-92` `_weeksSincePreviousIncrease()` | "+Xkg seit letztem Mal" | unterschiedliches Konzept, korrekt getrennt (dokumentierte B79-Entscheidung) |
| `ui.js:3376` `_renderAnalysis1RM()` Epley-Fallback | 1RM-Schätzung bei fehlendem `state.prs` | unterschiedliches Konzept, korrekt getrennt (deckt eine dokumentierte B31-Lücke) |
| **`weekReview.js:68-114` `_maxWeightPerExercise()`/`_findPR()`** (→ Wochenrückblick-Modal "Neuer PR"/"Stärkste Steigerung") | "hat diese Übung gerade einen echten PR?" | **VERDACHT AUF BUG — BEHOBEN in Runde 9 (B186).** Deload-Filter am Aufrufer (`buildWeekReview()`) ergänzt, exakt das etablierte Inline-Muster der anderen 3 Implementierungen. Bonus mitgefixt: `_findBestGain`s Gate prüfte auch die Vorwoche nicht auf Deload. |
| `ui.js:2929-2983` `_weeklyP4PSeries()`/`_allTimePRSeries()` | "Max. Gewicht pro Woche" fürs Relative-Stärke-Chart | VERDACHT AUF BUG (geringer) — dritter Code-Pfad für dieselbe Kernberechnung wie `exWeightHistory()`, aktuell funktional gleichwertig (filtert Deload korrekt), aber Duplikations-Risiko bei künftigen Änderungen an `exWeightHistory()`. |

## Domäne C — Streak-/Konsistenz-Berechnungen

| Fundstelle(n) | Konzept | Klassifizierung |
|---|---|---|
| `state.js` `calcCurrentStreak()`/`calcLongestStreakEver()` | Wochen-Streak | gleiche Quelle, konsistent (B74-Konsolidierung hält vollständig, keine neue parallele Reimplementierung gefunden) |
| `weeklyFocus.js:674-680` `_qualificationStreak` | Auto-Progressions-Eignung einer Übung | unterschiedliches Konzept, korrekt getrennt (gleicher Begriff "Streak", anderes Domain-Objekt) |
| `setUtils.js:41` `weekSuccessCounts()` | Wochen-Erfolgsquote | gleiche Quelle, konsistent (seit B38 einzige Quelle) |
| `plateauDetector.js`/`weightRecommendation.js` `_exSuccessRate`/`isFullSuccess` | Pro-Übung-Erfolgsquote für Plateau/Progression | unterschiedliches Konzept, korrekt getrennt (strengerer Maßstab, bewusst dokumentiert) |
| `consistencyUtils.js` `_weekConsistencyRatio()` | Tages-Konsistenz-Ratio | gleiche Quelle, konsistent untereinander (overallPerformance.js/weeklyFocus.js importieren dieselbe Funktion) |
| **`consistencyUtils.js`s "Tag erledigt" = `day.markedDone`** vs. **`state.js` `_weekTrainingStatus()`s "Tag erledigt" = ≥50% Sätze bewertet** | beide beantworten "war der Tag erledigt?" | **VERDACHT AUF BUG (wichtigster Fund dieser Runde) — BEHOBEN in Runde 9 (B185).** `_dayEvalCounts()` aus `_weekTrainingStatus()` extrahiert, `consistencyUtils.js` nutzt sie jetzt statt `markedDone` für reguläre Tage. Bonus mitgefixt: `weeklyFocus.js`s onTrack-Karte las `markedDone` ebenfalls unabhängig. **Bestätigte Rückwirkung:** ändert die angezeigte Konsistenz-% für alle Bestandswochen sofort (siehe DECISIONS.md), vom Nutzer vorab bestätigt. |
| `weeklyFocus.js` `_scoreWeek()` | dupliziert `weekSuccessCounts()` 1:1 | kleinerer Nebenfund — **BEHOBEN in Runde 9 (B190)** durch einen Absicherungstest (Deep-Equality-Vergleich), NICHT durch Auflösen der Duplikation (zirkulärer Import bleibt ein echtes Hindernis, bewusst nicht angegangen). |

## Domäne D — RPE-/Coaching-Schwellen

Baut auf dem vollständigen Runde-7-Audit auf (`diagnose-runde7-2026-08-02.txt`,
5 Stellen bereits bewertet, alle korrekt getrennt). Neuer Nebenfund aus
Runde 7 vertieft:

| Fundstelle | Konzept | Klassifizierung |
|---|---|---|
| `weeklyFocus.js:737-751` `_checkProgression()` Konfidenz-Klassifizierung | 4-Wochen-Fenster, kombiniert RPE+Erfolgsquote zu high/medium/low-Konfidenz für eine Steigerungs-Empfehlung | unterschiedliches Konzept, korrekt getrennt — 4-Wochen-Fenster einzigartig unter allen 6 Funden, Zweck (Empfehlungs-Konfidenz labeln) grundlegend anders als Deload-Erkennung. **BEHOBEN in Runde 9 (B190):** benannte Konstanten `CONF_HIGH_SUCCESS_RATE_MIN`/`CONF_HIGH_AVG_RPE_MAX_4WK`/`CONF_MEDIUM_SUCCESS_RATE_MIN`/`CONF_MEDIUM_AVG_RPE_MAX_4WK` mit Kommentar zur zufälligen Zahlen-Übereinstimmung mit den Runde-7-Konstanten. Reiner Rename. |

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

## Zusammenfassung: 3 Verdachtsfälle — ALLE in Runde 9 behoben

1. **`ex.targetSets`** (Domäne A) — gleiche Fehlerklasse wie B181, kleinerer
   Blast-Radius. **Behoben: B187 (Runde 9).**
2. **`weekReview.js` PR-Karte ohne Deload-Filter** (Domäne B) — gleiche
   Fehlerklasse wie B73/B79. **Behoben: B186 (Runde 9).**
3. **`_weekConsistencyRatio()` markedDone-Diskrepanz** (Domäne C, wichtigster
   Fund) — gleiche Fehlerklasse wie B38 (dort nur für Urlaubstage gefixt).
   **Behoben: B185 (Runde 9), mit bestätigter Rückwirkung auf
   Bestandsdaten-Anzeigen, siehe DECISIONS.md.**

Plus 2 kleinere kosmetische Nebenfunde (Domäne C: `_scoreWeek()`-Duplikat;
Domäne D: unbenannte Konfidenz-Konstanten in `weeklyFocus.js:737-751`) —
**beide behoben: B190 (Runde 9).**

**Runde 8:** kein Fix, nur Diagnose (wie vorgegeben). **Runde 9:** alle 5
Funde nach Nutzer-Freigabe umgesetzt — siehe BUGS.md B185-B190 und
`sprint-ergebnis-runde9-2026-08-03.txt` für Details.
