# TRAIN — Audit: Wissenschaftliche Grundlage der Coach-Schwellenwerte

*Erstellt: 2026-08-09, Basis train-v244*
*Anlass: Nutzer-Auftrag — "Was ist die Grundlage jeder Empfehlung, die wir
geben? Ich will ein Dokument, in dem jede Entscheidung mit aktuellstem
Konsens der Wissenschaft belegt wird. Nicht Confirmation Bias — wenn
aktuell eingebaute Fakten nicht der Wissenschaft entsprechen, dann
aktualisieren statt Studien suchen, die die falsche/veraltete Information
bestätigen."*

**Methode:** 5 unabhängige Recherche-Durchläufe (je ein Themenbereich),
jeder explizit angewiesen, aktiv nach widersprechender Evidenz zu suchen
statt nur Bestätigung — Zitate wurden, wo möglich, gegen die
Originalquelle verifiziert statt aus Suchmaschinen-Zusammenfassungen
übernommen (ein Fund unten zeigt, warum das nötig ist — siehe
Domäne C, Fußnote).

**Klassifizierung pro Schwellenwert:**
- **MATCHES** — deckt sich mit aktuellem wissenschaftlichem Konsens.
- **DEFENSIBLE** — plausibel, in die richtige Richtung, aber nicht durch
  eine spezifische Studie auf genau diesen Wert validiert.
- **NO CONSENSUS** — die Wissenschaft adressiert diese genaue Granularität
  schlicht nicht; reine Ingenieurs-/Praxis-Entscheidung, weder bestätigt
  noch widerlegt. Das ist ein legitimes, erwartetes Ergebnis für einen
  großen Teil dieses Audits — angewandte Trainingssteuerung auf
  Wochen-/Satz-Ebene ist an vielen Stellen schlicht dünn erforscht.
- **CONTRADICTS** — steht im Widerspruch zu belastbarer aktueller
  Evidenz — konkreter Handlungskandidat.

**WICHTIG:** Dieses Dokument ist reine Diagnose. Keiner der unten
genannten CONTRADICTS-Funde wurde bereits umgesetzt — Freigabe durch den
Nutzer steht noch aus (siehe Zusammenfassung am Ende).

---

## Domäne A — RPE-/Autoregulations-Schwellenwerte

*Quellen: Zourdos et al. 2016 (RIR-basierte RPE-Skala), Halperin et al.
2022 (Meta-Analyse RIR-Schätzgenauigkeit), Steele et al. 2017,
Pareja-Blanco/González-Badillo (Velocity-Loss-Literatur), systematisches
Review/Netzwerk-Meta-Analyse Autoregulation 2025 (ScienceDirect).*

| Schwellenwert | Fundstelle | Wert | Verdikt |
|---|---|---|---|
| `RPE_SET_HARD_ZONE` | sessionCoach.js:29 | 8.5 (Einzelsatz) | DEFENSIBLE — liegt im plausiblen Bereich (~1.5 RIR), aber die Literatur stützt eher eine Zone (VL20-40%, ~RPE 7-9) als einen exakten Cutoff. |
| `CONF_HIGH_AVG_RPE_MAX_4WK` + Erfolgsquote ≥90% | weeklyFocus.js:280 | ≤7.5 | **CONTRADICTS** (konzeptionell) — siehe Fund unten. |
| `CONF_MEDIUM_AVG_RPE_MAX_4WK` + Erfolgsquote ≥80% | weeklyFocus.js:282 | ≤8.5 | Gleicher Fund, abgeschwächt. |
| `RPE_PLATEAU_DELOAD_STRATEGY_1WK_AVG` | plateauDetector.js:31 | 8.5 (1-Wochen-Ø) | NO CONSENSUS — Zeitfenster-Wahl nicht literaturgestützt, aber auch nicht widerlegt. |
| `RPE_PREVENTIVE_DELOAD_3WK_AVG` | weeklyFocus.js:267 | 7.5 (3-Wochen-Ø) | NO CONSENSUS, gleiche Begründung. |
| Progressions-Leiter (Erfolgsquote 50/70/80/90%-Stufen) | weightRecommendation.js | s. Code | NO CONSENSUS — die generelle Autoregulations-*Philosophie* ist gut belegt (2025-Review: autoreguliert ≥ fixe Last für Kraftzuwachs), die exakten Prozentzahlen sind Original-Engineering, nicht aus einer Studie abgeleitet. |

**Konkreter Fund (CONTRADICTS, konzeptionell):** RIR/RPE-Selbsteinschätzung
ist nachweislich **ungenauer, je weiter man von der muskulären Erschöpfung
entfernt ist** (Halperin et al. 2022, n=414: mittlerer Fehler ~1.2 Wdh bei
5 RIR vs. ~0.46 Wdh bei 1 RIR; Steele et al. 2017: Anfänger unterschätzen
um 4-5 Wdh bei niedrigem RPE, Fortgeschrittene um 1-2). TRAINs
HIGH-Konfidenz-Stufe verlangt aber genau das — den NIEDRIGSTEN Ø-RPE
(≤7.5) — und vergibt dafür die HÖCHSTE Konfidenz. Das ist der Logik nach
rückwärts: die Konfidenz-Einstufung stützt sich an ihrem eigenen oberen
Ende auf die am wenigsten zuverlässigen RPE-Angaben. Betrifft nicht
zwingend das Ergebnis (niedriger RPE + hohe Erfolgsquote deutet trotzdem
meist auf einen guten Trainingsverlauf hin), aber die Begründung "hohe
Konfidenz, weil wir sicher wissen X" trägt an dieser Stelle nicht.

---

## Domäne B — Deload-Timing & -Umfang

*Quelle: Jukic et al. 2024, Sports Medicine – Open, "Deloading Practices
in Strength and Physique Sports" (Querschnittsbefragung, n=246
Wettkampfathleten/Coaches) — bestes verfügbares Datenmaterial, deskriptiv,
keine RCT.*

| Schwellenwert | Fundstelle | Wert | Verdikt |
|---|---|---|---|
| Präventiver Deload-Trigger | weeklyFocus.js | ≥8 Wochen seit letztem Deload | DEFENSIBLE, tendenziell zu konservativ — reale Praxis liegt bei Ø 5.6±2.3 Wochen (Jukic et al. 2024). TRAINs 8-Wochen-Trigger liegt über dem typischen Intervall. |
| Deload-Umfang (`deloadFactor`) | state.js:224 | 0.75 (−25%) | NO CONSENSUS zur exakten Zahl — plausibel, nicht spezifisch validiert. |
| Plateau-Definition | plateauDetector.js | ≥3 Wochen stagnierendes Gewicht, ≥80% Erfolgsquote | NO CONSENSUS — verbreitete Coaching-Heuristik, keine akademische Validierung dieser genauen Fensterlänge gefunden. |

**Eigenständiger Code-Fund (kein Wissenschafts-, sondern ein
Konsistenz-Problem):** TRAIN hat **zwei koexistierende, unterschiedliche
Deload-Mechanismen**: (1) `settings.deloadFactor` wird in der
Tagesansicht UND beim Dauer-Fehlschlag-Vorschlag direkt auf das GEWICHT
angewendet (ui.js:2718, 6369) — Intensitäts-Reduktion. (2) Der separate
Coach-Tab-Deload-Plan (`deloadSkip`) reduziert stattdessen die
SATZ-ANZAHL — Volumen-Reduktion, so wie es CLAUDE.md als "die"
Deload-Logik beschreibt. Das ist keine Wissenschaftsfrage, sondern eine
echte interne Inkonsistenz zwischen zwei Pfaden — unabhängig vom
Recherche-Ergebnis wert, in einer künftigen Runde vereinheitlicht zu
werden. Die Evidenz-Richtung (siehe Jukic et al.) spricht eher für
Volumen- statt Intensitäts-Reduktion als primären Hebel — würde also für
eine Angleichung von (1) an das Modell von (2) sprechen, nicht umgekehrt.

---

## Domäne C — Aufwärm-Protokoll

*Quelle: Barroso et al., "The Role of Specific Warm-up during Bench Press
and Squat Exercises: A Novel Approach" (PMC7558980).*

| Schwellenwert | Fundstelle | Wert | Verdikt |
|---|---|---|---|
| Aufwärm-Rampe | sessionCoach.js:263-271 `buildWarmupSets()` | 50%×5, 70%×3, 85%×1 | DEFENSIBLE — die generelle Form (progressive Mehrsatz-Rampe) ist für Bankdrücken literaturgestützt überlegen gegenüber Einzelsatz-Aufwärmen. Die exakten Prozentzahlen selbst sind nicht direkt studienbelegt, aber eine verbreitete, plausible Konvention. |

**Fund, uneinheitliche Anwendung:** dieselbe Quelle fand für Kniebeugen
(anders als Bankdrücken), dass ein EINZELNER höher-intensiver
Aufwärmsatz (80%) genauso gut oder besser abschnitt als die
Mehrsatz-Rampe — die Überlegenheit der Progressiv-Rampe war
bankdrücken-spezifisch, nicht universell. TRAIN wendet dieselbe 3-Stufen-
Rampe unterschiedslos auf jede Übung an (schwere Grundübung, leichte
Isolationsübung, alles gleich) — nicht widerlegt, aber auch nicht
spezifisch gestützt für Isolationsübungen; niedrige Priorität.

**Methodischer Fund, wichtig für dieses Dokument selbst:** eine erste
KI-Suchzusammenfassung behauptete, ein "NSCA-Positionspapier 2017 (Fradkin
et al.)" empfehle eine 30/50/70/85%-Rampe. Bei direkter Verifikation
stellte sich heraus: Fradkin, Zazryn & Smoliga (2010, *JSCR*) ist real,
aber ein allgemeines Aufwärm-Review (1966-2008), KEIN
resistance-training-spezifisches NSCA-Positionspapier von 2017 und sagt
NICHT das Behauptete. Das Zitat wurde verworfen, statt es unverifiziert
zu übernehmen — genau die Art Fehler, die dieses Dokument vermeiden soll,
und ein Beleg dafür, warum Zitate gegen die Originalquelle statt gegen
KI-Zusammenfassungen geprüft werden müssen.

---

## Domäne D — Trainingspause & Wiedereinstieg

*Quelle: Bosquet et al. 2013, Scandinavian Journal of Medicine & Science
in Sports (Meta-Analyse) — **verifiziert real und korrekt zitiert**
(anders als der Fund in Domäne C). Ergänzend: Stronger by Science
(evidenzbasierte Auswertung), BarBend, PowerliftingTechnique.com.*

| Pause-Dauer | TRAINs Reduktion | Fundstelle | Verdikt |
|---|---|---|---|
| ≤14 Tage | −5% | ui.js:5033 | MATCHES |
| ≤28 Tage | −10% | ui.js:5034 | DEFENSIBLE, eher zu vorsichtig — Bosquet et al. + Stronger by Science deuten darauf hin, dass Kraft bei 28 Tagen noch nahezu vollständig erhalten ist. |
| ≤56 Tage | −20% | ui.js:5035 | MATCHES (Praxis-Konsens liegt bei ~80-85% Erhalt = −15 bis −20%). |
| >56 Tage | −25% | ui.js:5036 | **CONTRADICTS** — mehrere unabhängige Quellen (Stronger by Science, PowerliftingTechnique, BarBend) nennen für 8+ Wochen Pause eher ~50% Reduktion, nicht 25% — ungefähr das Doppelte von TRAINs aktuellem Wert. |

**Wichtigster konkreter Fund des gesamten Audits:** der Bosquet-2013-Zitat-
Kommentar im Code ist echt und korrekt charakterisiert — beschreibt aber
nur die zeitliche FORM des Kraftverlusts, nicht die konkreten
Prozentzahlen (die sind Entwickler-Interpretation, nicht direkt aus der
Studie). Für die oberste Stufe (>56 Tage) weicht TRAINs Wert deutlich vom
breiteren Konsens ab. Stronger by Science geht noch einen Schritt weiter:
jenseits von ~12 Wochen sei ein fixer Prozentsatz vom alten
Trainingsgewicht methodisch fragwürdig — sinnvoller sei ein
RPE-autoregulierter Wiedereinstieg (die Grundbausteine dafür — RPE-
basierte Steuerung — existieren in TRAIN bereits im Session Coach).

---

## Domäne E — Volumen-/Frequenz-Verteilung

*Quelle: gemischt — Coaching-Literatur zu Push/Pull uneinig (1:1 bis 1:2
kursieren, keine belastbare RCT für einen exakten Wert gefunden);
Detraining-Meta-Analysen (PMC9657634, PMC4748325) für das
Konsistenz-Fenster; Hypertrophie-Volumen-Reviews (PMC5684266) für
Compound/Isolation.*

| Schwellenwert | Fundstelle | Wert | Verdikt |
|---|---|---|---|
| Push/Pull-Ratio | weeklyFocus.js:960 | >1.5 löst Signal aus | NO CONSENSUS — TRAINs Schwelle ist toleranter (mehr Push erlaubt) als die verbreiteteren 1:1/1:2-Heuristiken, aber keine dieser Zahlen ist eigentlich belastbar validiert. |
| Compound-Anteil | weeklyFocus.js | <60% löst Signal aus | NO CONSENSUS — Meta-Analysen finden vergleichbare Ganzkörper-Hypertrophie bei gematchtem Volumen unabhängig vom Compound/Isolation-Split; kein Beleg für genau 60%. |
| Konsistenz-/Streak-Fenster | diverse | 7 Tage Toleranz | **MATCHES** — liegt genau an der Grenze, wo laut Detraining-Forschung erste (aber noch nicht kraftrelevante) Veränderungen beginnen. |
| Mehr-Übungen-Fehlschlag | weeklyFocus.js | ≤20% Erfolg, ≥2 Übungen, 3 Wochen | NO CONSENSUS — reine Engineering-Heuristik gegen Rauschen, von der Literatur weder gestützt noch widerlegt. |
| Dauer-Fehlschlag (1 Übung) | weeklyFocus.js | 0% Erfolg, 3 Wochen | NO CONSENSUS, gleiche Begründung. |

---

## Zusammenfassung — was tatsächlich handlungsrelevant ist

Von 19 geprüften Schwellenwerten/Mechanismen: **1 klarer CONTRADICTS-Fund
mit konkretem Zahlenvorschlag**, **1 konzeptioneller Logik-Fund** (Konfidenz-
Einstufung), **1 echte Code-Inkonsistenz** (zwei Deload-Mechanismen), der
Rest überwiegend NO CONSENSUS (erwartbar — angewandte Trainingssteuerung
auf dieser Granularität ist an vielen Stellen schlicht dünn erforscht,
das ist kein Versagen dieses Audits, sondern der ehrliche Stand der
Wissenschaft) oder DEFENSIBLE/MATCHES.

**Konkrete Handlungskandidaten (Freigabe steht aus):**

1. **Wiedereinstiegs-Reduktion bei >56 Tagen Pause** (Domäne D): aktuell
   −25%, Konsens deutet auf ~−50% oder — methodisch sauberer — einen
   RPE-autoregulierten Wiedereinstieg statt eines festen Prozentsatzes
   für diese oberste Stufe.
2. **Konfidenz-Einstufungs-Logik** (Domäne A): HIGH-Konfidenz stützt sich
   auf die am wenigsten zuverlässigen RPE-Selbstangaben (niedrigster
   RPE-Bereich) — Umformulierung oder Neugewichtung der Logik erwägen,
   nicht zwingend eine reine Zahlen-Änderung.
3. **Deload-Mechanismus-Inkonsistenz** (Domäne B): zwei koexistierende,
   unterschiedliche Deload-Modelle (Gewichts- vs. Satz-Reduktion) —
   unabhängig von der Wissenschaftsfrage vereinheitlichungswürdig,
   Evidenz-Richtung spricht für das bereits bestehende
   Satz-Reduktions-Modell als Vorbild.
4. **Präventiver Deload-Trigger** (Domäne B): 8 Wochen liegt über dem
   Ø-Praxis-Intervall (5.6±2.3 Wochen) — Erwägung, den Trigger auf ~6
   Wochen zu senken oder als bewusst konservative Obergrenze zu
   kennzeichnen.
5. **Code-Kommentare bei NO-CONSENSUS-Werten**: mehrere Schwellenwerte
   (Push/Pull 1.5, Compound 60%, Fehlschlag-Fenster) sollten im Code
   explizit als "Engineering-Heuristik, nicht literaturbelegt" markiert
   werden, um künftiger Verwechslung mit tatsächlich validierten Werten
   (wie z.B. dem Bosquet-Zitat) vorzubeugen.

Alle 5 vollständigen Recherche-Berichte (inkl. aller Quellenangaben) sind
im Sitzungsverlauf dieser Runde dokumentiert; dieses Dokument fasst sie
zusammen. Nächster Schritt laut vereinbarter Reihenfolge: Nutzer-Freigabe
für die 4 konkreten Änderungskandidaten oben, danach Umsetzung als eigene
kleine Runde (Diagnose bereits abgeschlossen, direkt Fix-fähig für #1/#3,
#2/#4 brauchen noch eine kurze Konzept-Entscheidung).
