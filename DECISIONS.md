# TRAIN — Produktentscheidungen
*Unveränderlich — neue Entscheidungen werden hinzugefügt, alte nicht überschrieben*

---

## ARCHITEKTUR

### 2026-06 — Vanilla JS, kein Framework, kein Build-Step
**Entscheidung:** Vanilla JS, ES Modules, lokal-first. Kein React/Vue/Svelte, kein Webpack/Vite.
**Begründung:** Maximale Kontrolle, minimale Abhängigkeiten, kein Build-Step = direktes Deployment.
**Gilt:** Permanent. Keine Frameworks einführen ohne explizite Neuentscheidung.

### 2026-06 — Lokal-first, kein Backend
**Entscheidung:** Alle Daten in localStorage, kein Backend, kein Login.
**Begründung:** Datenschutz als USP, kein Server-Overhead, PWA-tauglich.
**Gilt:** Bis Cloud-Sync explizit entschieden wird (zurückgestellt).

### 2026-07 — Anonyme Nutzungs-Zählung (GoatCounter) statt kein Tracking
**Entscheidung:** Vor Launch an echte Nutzer wurde GoatCounter (kostenlos,
Open Source, cookielos, DSGVO-konform ohne Consent-Banner) als einziger
externer Netzwerk-Aufruf der App eingeführt, um zu sehen wie viele
Personen die App öffnen/regelmäßig nutzen (Custom Events "Woche
erstellt"/"Onboarding abgeschlossen"). Zählt ausschließlich anonyme,
aggregierte Nutzungs-Events — nie Trainingsdaten, nie personenbezogene
Kennungen.
**Begründung:** Ohne jegliches Tracking ist "wie viele Nutzer sind aktiv"
auf einer rein statischen GitHub-Pages-App technisch nicht beantwortbar.
Die Alternative (gar kein Signal) wurde als schlechter bewertet als ein
bewusst minimales, privacy-first Tracking, das die "Lokal-first, kein
Backend"-Positionierung (siehe oben) für die eigentlichen Trainingsdaten
unangetastet lässt — nur Metadaten über App-Nutzung verlassen das Gerät,
nie Workout-Inhalte.
**Gilt:** Bis explizit anders entschieden. Neue Custom-Events dürfen nur
Zähl-/Kategorie-Daten übertragen, nie Nutzdaten (Gewichte, Übungsnamen,
Notizen etc.).

### 2026-07 — Progressive Overload = immer Nutzer-Entscheidung
**Entscheidung:** EX_SET_NEXT_WEEK_PLAN greift erst bei manueller WEEK_CREATE(source:'prev'). AUTO_WEEK_CREATE wendet _applyPlannedProgression bewusst NICHT an.
**Begründung:** Steigerung ist eine bewusste Entscheidung des Athleten, nie still automatisch.
**Gilt:** Permanent. Nicht ändern ohne explizite Neuentscheidung.

---

## COACH-LOGIK

### 2026-07 — isFullSuccess() nur in Analyse-Schicht
**Entscheidung:** isFullSuccess(s, ex) wird verwendet in: plateauDetector.js, weightRecommendation.js, weeklyFocus.js _checkProgression.
**Entscheidung:** isFullSuccess() wird NICHT verwendet in: _scoreWeek(), _weekSuccessScore(), _weekTrainingStatus(), Volumen-Berechnungen, Chart-Datenpunkte.
**Begründung:** _scoreWeek()/_weekTrainingStatus() messen "hat trainiert" (Anwesenheit), nicht "hat Ziel erreicht". Das ist semantisch korrekt für Streak/Konsistenz. Volumen = tatsächlich bewegtes Gewicht, kein Zielerreichungsmaß.
**Gilt:** Permanent bis gegenteilige Entscheidung.

### 2026-07 — Plateau hat Vorrang vor PrePlateau
**Entscheidung:** In der akuten Kaskade: _checkPlateau (Prio 3) vor _checkPrePlateau (Prio 4).
**Begründung:** Bestätigter Befund (Plateau: 3+ Wochen Stagnation) hat Vorrang vor antizipiertem Befund (PrePlateau: RPE-Kosten steigen, Plateau noch nicht eingetreten).
**Gilt:** Permanent.

### 2026-07 — Strukturkarte max. 2 Signale
**Entscheidung:** computeStructuralSignals() gibt max. 2 Signale zurück. Priorität: deload > consistency_quality > push_pull.
**Begründung:** 3+ Karten im Coach-Tab erzeugen zu viel kognitive Last. 2 ist die richtige Grenze.
**Gilt:** Permanent. Nicht erhöhen ohne echte Nutzerdaten.

### 2026-07 — RPE-Schwellen bewusst unterschiedlich
**Entscheidung:** Progressionsbereitschaft: avgRPE ≤ 8.0. Konfidenz HIGH: ≤ 7.5. Konfidenz MEDIUM: ≤ 8.5.
**Begründung:** Bereitschaft und Konfidenz messen verschiedene Dinge. Nicht vereinheitlichen.
**Gilt:** Bis sportwissenschaftliche Neubewertung.

### 2026-07 — Wiedereinstieg: 7 Tage Fenster
**Entscheidung:** REENTRY_WINDOW_DAYS = 7. Wiedereinstiegs-Karte erscheint 7 Tage nach lastReentryHandled.
**Begründung:** 14 Tage war zu lang — hindert echtes Coaching wenn normal weitertrainiert wird. Ein Athlet ist nach einer Woche wieder im Rhythmus.
**Gilt:** Bis Nutzerdaten anderes zeigen.

### 2026-07 — _checkPersistentFailure: Priorität 2 (zwischen Reentry und Overload)
**Entscheidung:** _checkPersistentFailure() steht in der Kaskade VOR _checkOverload(). Trigger: 0% Erfolg über 3 non-deload Wochen bei EINER Übung (alle Sätze bewertet).
**Begründung:** Eingetretenes Totalversagen ist dringlicher als drohende Überlastung. _checkOverload filtert intern auf success-Sätze — bei 0 Erfolgen liefert es null und die Kaskade würde bis Fallback durchfallen ("Auf Kurs" trotz 4 Wochen Totalversagen).
**Bekannte Grenzen:**
- Keine Decisional-Balance (**seit v161/B26 behoben** — buildDecisionalBalance() hat jetzt einen persistent_failure-Fall, siehe COACH-LOGIK-Eintrag unten)
- Prüft nur EINZELNE Übungen — wechselndes Scheitern bei verschiedenen Übungen löst kein Signal aus (**seit v163/B29 behoben** — computeStructuralSignals() hat jetzt _checkMultiExerciseFailure(), siehe COACH-LOGIK-Eintrag unten. Bewusst als eigenes STRUKTURELLES Signal, nicht als Erweiterung dieser akuten Funktion — siehe dortige Begründung)
**Gilt:** Permanent bis gegenteilige Entscheidung.

### 2026-07 — persistent_failure bekommt generische Decisional-Balance (nicht Plateau-Buttons)
**Entscheidung:** persistent_failure nutzt buildDecisionalBalance() (stay/change, wie Overload/ConsistencyGap) statt einer eigenen Buttons-Familie wie Plateau ("Habe ich umgesetzt"/"Ignorieren", plateauActions).
**Begründung:** Plateau hat mehrere konkurrierende Strategien (deload/volume/variation) — braucht deshalb eigene, differenzierte Buttons. persistent_failure hat nur einen einzigen klaren Hebel (Gewicht runter), das passt exakt in das bestehende stay/change-Muster. "Empfehlung folgen" dispatcht EX_SET_NEXT_WEEK_PLAN mit Delta `-(currentWeight * (1 - deloadFactor))`, gerundet auf weightStep — bewusst über den konfigurierbaren deloadFactor statt Plateaus eigenem hartkodierten 22.5%-Wert, damit die im Coach-Text angezeigte "~X kg"-Empfehlung exakt zum tatsächlich gesetzten Wert passt.
**Gilt:** Permanent bis gegenteilige Entscheidung.

### 2026-07 — Mehr-Übungen-Aggregation: strukturell statt akut, ≤20%-Schwelle, reiner Text
**Entscheidung:** _checkMultiExerciseFailure() (verteiltes Scheitern über ≥2 Übungen) lebt in computeStructuralSignals() (Strukturkarte), NICHT in der akuten Kaskade von computeWeeklyFocus(). Schwelle: Gesamterfolgsquote ≤20% über alle Übungen der letzten 3 Nicht-Deload-Wochen (mind. 15 bewertete Sätze, mind. 2 unterschiedliche betroffene Übungen mit je ≥2 Datenpunkten). Ausgabe: reiner Informationstext mit den 2-3 am schlechtesten performenden Übungen + je einer Gewichtsempfehlung — KEIN Aktions-Button, KEINE Decisional-Balance (buildDecisionalBalance() bleibt für Strukturkarte-Signale bewusst `null`, wie bei allen anderen 3 strukturellen Signalen).
**Begründung (3 explizit besprochene Design-Fragen):**
1. Platzierung: ein andauerndes, breites Muster über viele Übungen ist konzeptionell strukturell (wie Präventiver Deload/Konsistenz-Qualität/Push-Pull), kein einzelnes akutes Ereignis wie eine durchgehend scheiternde einzelne Übung (das deckt weiterhin _checkPersistentFailure ab, Priorität 2 in der akuten Kaskade).
2. Schwelle bewusst weicher als der Einzelübungs-Check (≤20% statt 0%) — bei echter Verteilung über mehrere Übungen würde eine 0%-Schwelle in der Praxis kaum je erreicht.
3. Kein Aktions-Button: die Strukturkarte ist laut bestehender Konvention (siehe buildDecisionalBalance()-Docstring) rein informativ, keine Karte dort hat bisher einen Button — eine Ausnahme nur für dieses eine neue Signal hätte die bestehende "Strukturkarte = keine Aktion"-Trennung durchbrochen.
Priorität innerhalb der Strukturkarte: Mehr-Übungen-Aggregation > Präventiver Deload > Konsistenz-Qualität > Push/Pull — steht zuoberst, da ein datenbasierter breiter Totalausfall der konkreteste Befund unter den strukturellen Signalen ist (analog zur Top-Priorität von persistent_failure in der akuten Kaskade). Mindestens 2 unterschiedliche betroffene Übungen als Gate verhindert, dass dasselbe Einzelübungs-Scheitern doppelt gemeldet wird (einmal akut, einmal strukturell).
**Gilt:** Permanent bis gegenteilige Entscheidung.

### 2026-07 — B18: Distanz/Zeit-Progression (metric 'm'/'sec') — Scope, Schrittweite, Schwelle
**Entscheidung:** Coach-Gewichtsempfehlung (`getWeightRecommendation()`) bekommt ein Gegenstück `getMetricRecommendation()` für Übungen mit `metric:'m'` (Distanz) UND `metric:'sec'` (Zeit) — nicht nur Distanz wie ursprünglich in BUGS.md notiert. Neues Feld `ex.metricStep` (konfigurierbar je Übung, wie `ex.weightStep`) statt fest codierter Schrittweite. Auto-Vorauswahl nutzt dieselben RPE-/Erfolgsquoten-Schwellen wie bei Gewicht (kein eigener, unbegründeter Schwellenwert).
**Begründung (3 explizit besprochene Design-Fragen):**
1. Scope beide Metriken: dieselbe Coaching-Lücke (kein Gewicht, aber trotzdem progressionsfähig) betrifft `sec` (z.B. Plank-Halten) genauso wie `m` — beide waren bereits identisch UI-verdrahtet, eine künstliche Beschränkung auf nur eine Metrik hätte keinen Mehrwert gehabt.
2. Konfigurierbares `metricStep` statt fixem Default: konsistent mit dem bestehenden `ex.weightStep`-Muster — eine Rudermaschine-Einheit hat andere sinnvolle Schrittgrößen (50m) als ein Sprint (10m) oder ein Zeit-Halten (5-10s), das lässt sich nicht sinnvoll pauschal festlegen.
3. Gleiche Auto-Vorauswahl-Schwellen: keine Datenbasis für eine eigene, speziellere Schwelle bei einer neuen, ungetesteten Progressionsart — Konsistenz mit der bestehenden, bewährten Logik ist der sicherere Default.
**Technisches Detail:** `getMetricRecommendation()` gibt bewusst dieselben Feldnamen zurück wie `getWeightRecommendation()` (`recommendedWeight`/`lastWeight`, nicht `recommendedValue`/`lastValue`) — reiner Implementierungsdetail-Kompromiss, damit ui.js's bestehender Verbrauchercode (Chip-Rendering, Recovery-Boost, Auto-Vorauswahl-Bestätigung) beide Ergebnisse identisch behandelt, ohne an jeder Stelle zwischen Gewicht und Distanz/Zeit zu unterscheiden. `ex.progressionType` bekommt bei `metric!=='reps'` neu den Default `'reps'` statt `'weight'` (bumpt `targetReps` = Ziel-Distanz/-Zeit über den bereits bestehenden `_applyPlannedProgression()`-Pfad) — Migration v29→v30 korrigiert bestehende Übungen mit dem alten, bedeutungslosen Default.
**Gilt:** Permanent bis gegenteilige Entscheidung.

### 2026-07 — B48: Gewichtsempfehlung nutzt pro-Übung-Schrittweite statt fixem 2.5/1.25-Delta
**Entscheidung:** `getWeightRecommendation()`s Sprunggröße (`fullDelta`/`halfDelta`) wird jetzt aus der pro Übung eingestellten Schrittweite (`ex.weightStep`) abgeleitet — `fullDelta = weightStep`, `halfDelta = weightStep / 2`, AUSSER `weightStep` ist selbst schon ≤1.25 kg (kleinste gängige Hantelscheibe), dann bleibt `halfDelta = weightStep` (keine weitere Halbierung).
**Begründung:** Nutzer meldete, dass schwere Grundübungen (Kniebeuge, Kreuzheben) sinnvoll in 5kg-Schritten steigern sollten, leichtere/isolierende Übungen (Bankdrücken) dagegen in 1.25kg-Schritten — das Schrittweite-Feld existierte dafür bereits pro Übung und wurde vom manuellen "+kg"-Button auch schon korrekt genutzt, aber die AUTOMATISCHE Coach-Empfehlung ignorierte es und rechnete immer mit einem fest hartkodierten 2.5/1.25-Delta, das nur am Ende auf die Schrittweite gerundet wurde — das konnte bei größeren Schrittweiten zu einer scheinbaren "Steigerung" von +0kg führen (auf die nächste große Stufe abgerundet).
**Gilt:** Permanent bis gegenteilige Entscheidung. Rückwärtskompatibel: die verbreitete Standard-Schrittweite 2.5kg liefert weiterhin exakt +2.5/+1.25 wie vor dieser Änderung.

### 2026-07 — B49/B50: Individuelle Steigerungslogik — sichtbarer Vorschlag statt Automatik, kein Halbierungs-Preset
**Entscheidung:** Zwei Anschluss-Features zu B48, beide bewusst OHNE stille Automatik:
1. Ein Vorschlag ("du hast wiederholt um Xkg gesteigert — übernehmen?") erkennt Muster in der geloggten Historie, wird aber NIE automatisch als `ex.weightStep`/`ex.metricStep` übernommen — nur ein sichtbarer Hinweis mit Button. Schwelle: mindestens 3 identische positive Wochen-Sprünge bei ≥4 dokumentierten Wochen.
2. Der Empfehlungs-Chip im "Neue Woche"-Modal erlaubt jetzt einen frei eingegebenen Wert ("Anderer Wert") zusätzlich zum bisherigen Ein/Aus — bewusst OHNE ein festes Halbierungs-Preset.
**Begründung:** Nutzer bat zunächst um automatische Erkennung der Schrittweite aus der Historie, mit der Idee "das geloggte Steigerungsgewicht der Übung nehmen". Auf Rückfrage/Analyse: reine Historien-basierte automatische Übernahme hätte Rauschen/Einzelfälle (z.B. ein zufälliger großer Sprung) unbemerkt in zukünftige Empfehlungen einfließen lassen — widerspricht dem Nordstern "Decision Support", der Athlet entscheidet, die App schlägt nur vor. Als Kompromiss: Muster sichtbar zeigen, nie automatisch anwenden (Analogie zum bereits etablierten `.target-suggestion`-Muster für targetReps). Für den Empfehlungs-Chip wurde ein festes "Hälfte"-Preset erwogen, aber verworfen: `getWeightRecommendation()` hat bereits ein internes `halfDelta`-Konzept (aus B48) — ein zusätzliches UI-Preset hätte bei einer bereits reduzierten Empfehlung zu einer zweiten, unmotivierten Halbierung geführt. Freie Eingabe deckt jeden Wunschwert ab und ist konsistent mit dem bestehenden `.ex-kg-picker`-Muster (das ebenfalls kein Halbierungs-Preset hat).
**Technisches Detail:** `_prepNewWeekModal()` dispatcht bei jedem Re-Render erneut die Auto-Vorauswahl-Logik — ein Custom-Wert im Chip hätte ohne `_userCustomStepChoice`-Tracking (analog zu `_userDismissedAutoSelect`) beim nächsten Re-Render stillschweigend wieder auf den vollen Empfehlungswert zurückspringen können. Explizit getestet und verhindert.
**Gilt:** Permanent bis gegenteilige Entscheidung.

---

## GAMIFICATION

### 2026-07 — Surprise Rewards entfernt
**Entscheidung:** surpriseRewards.js vollständig gelöscht. consistency_10-Muster war anwesenheitsbasiert, nicht leistungsbasiert.
**Begründung:** Widerspricht Framework: "TRAIN ist kein Motivations-Tool."
**Gilt:** Permanent. Nicht wieder einführen.

### 2026-07 — Streak-Freeze entfernt
**Entscheidung:** streakFreeze vollständig entfernt.
**Begründung:** Reine Gamification-Schutzfunktion ohne Entscheidungs-Mehrwert.
**Gilt:** Permanent.

### 2026-07 — Badge-Granting eingefroren
**Entscheidung:** _checkAndGrantBadges() auskommentiert. Bestehende Abzeichen bleiben in state.badges.
**Begründung:** 7 Meilensteine sind reine Anwesenheitsschwellen — "Quantität über Qualität". Einfrieren statt Entfernen um historische Daten zu erhalten.
**Gilt:** Bis vollständige Entfernung entschieden (nach echten Nutzern).

### 2026-07 — Flammen-Icon entfernt
**Entscheidung:** 🔥 aus allen Streak-Anzeigen entfernt. Ausnahme: Aufwärmen-Button (unrelated, nicht anfassen).
**Begründung:** Rein emotionales Symbol ohne Information.
**Gilt:** Permanent. 🔥 nicht wieder einführen für Streak.

### 2026-07 — PR-Badges am Satz behalten
**Entscheidung:** ✓ (Ziel erreicht) / ↑ (Wdh-PR) / 🏆 (Gewichts-PR) bleiben.
**Begründung:** Datengetrieben, direkt an Progressionsentscheidung gekoppelt — nicht Gamification.
**Gilt:** Permanent.

---

## PRODUKTSTRATEGIE

### 2026-06 — Zielgruppe: ernsthafte Kraftsportler
**Entscheidung:** Ernsthafte Kraftsportler 3–5x/Woche, intermediate+, ohne Personal Trainer. Gelegentliche Nutzer bewusst ausgeschlossen.
**Begründung:** Schärfere Positionierung, weniger Feature-Drift.
**Gilt:** Permanent.

### 2026-06 — Paywall-Linie
**Entscheidung:** Logging kostenlos. Coaching kostenpflichtig (8–12€/Monat Abo).
**Begründung:** Coach-Wert ist der USP. Tracking-Apps sind kostenlos — wir monetarisieren das was sie nicht haben.
**Gilt:** Bis Marktvalidierung.

### 2026-07 — Strukturkarte für strukturelle Signale
**Entscheidung:** Strukturelle Signale (Push/Pull, Konsistenz-Qualität, Präventiver Deload) erscheinen in separater Strukturkarte unter der Hauptkarte — nicht in der akuten Kaskade.
**Begründung:** Lineare ??-Kaskade kann nicht gleichzeitig "wichtigstes akutes Problem" und "wichtigstes strukturelles Problem" transportieren.
**Gilt:** Permanent.

---

## TECHNISCH

### 2026-07 — consistencyUtils.js als Shared Module
**Entscheidung:** _weekConsistencyRatio und _consistencyEligibleWeeks leben in consistencyUtils.js, importiert von weeklyFocus.js und overallPerformance.js.
**Begründung:** Verhindert Circular Import (overallPerformance.js ↔ weeklyFocus.js).
**Gilt:** Permanent. Nicht rückgängig machen.

### 2026-07 — < statt <= für future-days Vergleiche
**Entscheidung:** Alle "ist dieser Tag fällig?"-Vergleiche verwenden `dayISO < todayISO` (nicht <=).
**Begründung:** <= würde den laufenden heutigen Tag als bereits fällig zählen — noch bevor er abgeschlossen ist.
**Gilt:** Permanent. Bei neuen Datumsvergleichen immer < verwenden.

### 2026-07 — scrollTop-Restore statt scrollIntoView-Guard
**Entscheidung:** Stepper-Buttons merken scrollTop vor Dispatch und restoren nach Render-RAF.
**Begründung:** Kein scrollIntoView() im Stepper-Pfad — Scroll-Artefakt war Layout-Reflow. scrollTop-Restore ist die sauberste Lösung.
**Gilt:** Permanent.
