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

### 2026-07 — B65: Squat/Hinge-Übungen bekommen automatisch 5kg-Schrittweite statt 2.5kg
**Entscheidung:** Neue Übungen der Bewegungskategorien "Squat" und "Hinge" (Kniebeuge/Kreuzheben-Varianten, siehe movementMap.js) starten mit `weightStep: 5` statt dem bisherigen pauschalen `2.5` für alle Kategorien. Bestehende Übungen dieser Kategorien, deren Schrittweite noch auf dem nie angefassten Standard steht, werden per Migration (SCHEMA v30→v31) einmalig mit angehoben — eine bereits bewusst vom Nutzer gesetzte andere Schrittweite bleibt unangetastet. Bewusst NUR Squat/Hinge, nicht Push/Pull — die reichen von schweren Bankdrücken-/Rudern-Varianten bis zu leichten Isolationsübungen (Curls, Lateral Raises), keine sinnvolle Pauschale möglich.
**Begründung:** B48 machte die automatische Gewichtsempfehlung pro-Übung-Schrittweite-bewusst, aber jede Übungs-Erstellungsstelle setzte weiterhin unconditional `2.5` — Nutzer meldete, die "automatische Steigerung wirkt immer noch kaputt" bei Squats, obwohl die Empfehlungs-Logik selbst korrekt war. Root Cause war das Fehlen eines kategorie-bewussten Defaults, nicht die Logik. Die bereits vorhandene `movementMap.js`-Kategorisierung (seit B46) macht diesen Default ohne neue Dateneingabe möglich.
**Gilt:** Permanent bis gegenteilige Entscheidung.

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

## SICHERHEIT

### 2026-07 — Security-Checkliste erst Phase 2 (sobald Server existiert)
**Entscheidung:** Die volle Standard-Security-Checkliste (Rate Limiting, Auth/JWT/bcrypt, Access-Control-Matrix, API-Key-Handling, WAF/DDoS-Schutz, IP-Bans, SSRF, SQL-Injection) wird NICHT vorab spekulativ gebaut. Sie ist dokumentiert als Blaupause in SECURITY.md (Teil 2), wird aber erst umgesetzt, sobald die geplante Paywall/Coaching-Funktion tatsächlich einen Server/Accounts bekommt.
**Begründung:** TRAIN hat heute kein Backend, keine API-Keys, keine Accounts (verifiziert per Code-Audit, B59) — diese Angriffsklassen haben schlicht keine Angriffsfläche, gegen die sie greifen könnten. Vorab bauen wäre spekulative Komplexität ohne Nutzen, siehe "Lokal-first, kein Backend" oben. Was heute real ist (XSS beim Rendern von Nutzertext, Import-Validierung) wurde behoben, siehe unten.
**Gilt:** Bis der Server für die Paywall/Coaching-Funktion tatsächlich gebaut wird — dann SECURITY.md Teil 2 aktivieren, nicht neu recherchieren.

### 2026-07 — Kündigungsbutton-Pflicht (§ 312k BGB) wird über den Zahlungsanbieter gelöst, nicht selbst gebaut
**Entscheidung:** Sobald die Paywall/Coaching-Abo tatsächlich verkauft wird, bekommt TRAIN einen gut sichtbaren, unmittelbar wirkenden Kündigungs-Button ("Jetzt kündigen" o.ä.), der zu einer Bestätigungsseite führt. Die technische Umsetzung läuft über den Self-Service-Kündigungsflow des künftigen Zahlungsanbieters (z.B. Stripe Customer Portal), nicht über eine selbst gebaute Kündigungslogik.
**Begründung:** § 312k BGB (in Kraft seit 01.07.2022) verlangt das für jeden B2C-Online-Vertrag mit wiederkehrender Zahlungspflicht — Kündigung muss genauso leicht erreichbar sein wie der Abschluss, sonst kann jederzeit fristlos gekündigt werden. Fund aus einer externen KI-Review-Runde (2026-07-18), von keinem der vorherigen 4 Cross-AI-Exportdokumente adressiert obwohl direkt die dort schon aufgeworfene Paywall-UX-Frage betreffend — jetzt als Prinzip festgehalten, BEVOR die Payment-UI existiert, genau wie bei den Gamification-Entscheidungen (siehe GAMIFICATION-Sektion). Ein selbst gebauter Kündigungsflow müsste den Vertrag tatsächlich beenden (nicht nur eine Nachricht anzeigen) — ein etablierter Zahlungsanbieter deckt das bereits ab.
**Gilt:** Bis zum Payment-Sprint dokumentiert, dann verbindlich umzusetzen. Details/Quellen siehe LEGAL.md.

### 2026-07 — CSP `'unsafe-inline'` bei script-src bewusst akzeptiert (B59)
**Entscheidung:** Der neue CSP-`<meta>`-Tag (index.html) behält `'unsafe-inline'` in `script-src`, statt es zu entfernen.
**Begründung:** TRAIN hat keinen Build-Step (siehe "Vanilla JS, kein Build-Step" oben) und kann daher keine Nonces/Hashes pro Auslieferung generieren. Der bestehende Bootstrap-`<script>` (index.html, Drag-Polyfill-Init) sowie 4 bestehende inline-`onclick`-Handler (Notiz-Toggle, ui.js) würden ohne `'unsafe-inline'` brechen. Die CSP bleibt trotzdem wertvoll: `script-src` ist weiterhin auf `'self'` + GoatCounter begrenzt, externe Script-Injection (`<script src="https://evil.tld">`) bleibt blockiert — nur die (bereits durch h()-Escaping abgedeckte) Inline-Payload-Klasse ist nicht zusätzlich per CSP gehärtet.
**Gilt:** Bis eine Build-Pipeline existiert — dann die 4 onclick-Handler auf das bestehende `data-action`-Event-Delegation-Muster umstellen und `'unsafe-inline'` aus `script-src` entfernen.

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

### 2026-07 — Share-Bild lokal per Canvas, kein Server-Upload (B68)
**Entscheidung:** Share-Bilder (PR-Moment, Wochenrückblick) werden clientseitig per Canvas als PNG erzeugt und über `navigator.share`/`canShare` (Datei) geteilt, mit Download als Fallback — identisches Muster wie der bestehende JSON-Backup-Export. Kein Server-Upload, kein Drittanbieter-Bildhost/-Renderer.
**Begründung:** Konsistent mit der "Lokal-first, kein Backend"-Grundentscheidung und der "GoatCounter = einziger externer Call"-Positionierung (LEGAL.md/SECURITY.md) — ein Bild-Hosting-Dienst wäre ein neuer externer Aufruf und ein neuer Auftragsverarbeiter-Eintrag gewesen.
**Gilt:** Permanent für zukünftige Share-/Export-Features. Kein Server-Rendering/-Upload ohne explizite Neuentscheidung.

### 2026-07 — Share-Bild Sparkline (B71): exWeightHistory letzte 8 Wochen, Bezier-Kurve, Hook-Satz "+Xkg in Y Wochen", Fallback bei <3 Punkten
**Entscheidung:** Das Wochenrückblick-Share-Bild zeigt als Herzstück eine Bezier-geglättete Sparkline der Gewichtshistorie (`exWeightHistory()`, letzte 8 Wochen, nur weight>0) der Übung mit echtem PR diese Woche, ersatzweise der mit dem höchsten Wochenvolumen. Hook-Satz fasst die Differenz zusammen ("+Xkg in Y Wochen" bei Steigerung, "Xkg · Y Wochen konstant" bei Plateau, "Kontrollierter Rückbau" bei Rückgang). Unter 3 Datenpunkten wird keine Kurve gezeichnet, sondern nur das aktuelle Gewicht groß angezeigt.
**Begründung:** Nutzer-Feedback zu B68: reine Kennzahlen ohne visuellen Anker wirkten leer/ohne "Wow-Faktor". Eine Kurve mit <3 Punkten wäre visuell bedeutungslos/irreführend (keine erkennbare Tendenz), daher bewusster Fallback statt einer entwerteten Mini-Kurve.
**Gilt:** Permanent für dieses Feature. Bei künftigen Sparkline-artigen Visualisierungen dieselbe Mindest-Datenpunkt-Schwelle (3) und denselben Fallback-Gedanken anwenden.

### 2026-07 — "Letzte Woche mit echten Daten" per Rückwärtssuche, nicht per Array-Position (B72)
**Entscheidung:** Wo Code "die Vorwoche" oder "die zuletzt trainierte Woche" braucht, wird rückwärts durch die sortierten Wochen gesucht (erste Woche mit ≥1 `markedDone`-Tag), nicht positional aus der Wochen-Array-Länge abgeleitet (z.B. `sorted[length-2]`).
**Begründung:** `state.weeks` kann leere, in der Zukunft datierte Wochen enthalten (manuell über "Neue Woche" mit frei wählbarem Datum vorausgeplant) — eine positionale Annahme ("die vorletzte Woche ist die echte Vorwoche") bricht dann, weil die leere Zukunftswoche dazwischenrutscht (B72: `_runAutoWeekFlow()` zeigte dadurch 0/0 im Auto-Wochenrückblick trotz vorhandener Trainingshistorie).
**Gilt:** Permanent. Bei jeder künftigen "letzte reale Woche"-Logik dieses Muster verwenden, nicht Array-Indizes.

### 2026-07 — Share-Bild: Favorit immer vor Nicht-Favorit, PR-Erkennung über s.prBadge statt highlights (B73)
**Entscheidung:** `_pickBestExercise()` (weekReviewModal.js) wählt die Bild-Übung über 6 Prioritäten, Favorit immer vor Nicht-Favorit (PR > Steigerung > meiste Historie), erst danach dieselbe Kaskade für Nicht-Favoriten. PR-Erkennung scannt `s.prBadge` direkt an den Sätzen der Woche, nicht `reviewData.highlights` (liefert nur den EINEN größten PR/Woche, favoritenblind). Zusätzlich: der Hook-Satz aus B71 gilt jetzt bereits ab 2 Datenpunkten (gerade Linie statt Bezier), nicht erst ab 3 — nur bei 0/1 Punkten bleibt der reine Fallback (kein sinnvoller Trend abbildbar).
**Begründung:** Nutzer will bevorzugt seine markierten Lieblingsübungen im Share-Bild sehen, auch wenn eine andere Übung technisch den größeren PR/das größere Volumen hatte — ein geteiltes Bild soll die für den Nutzer bedeutsame Übung zeigen, nicht zwingend die statistisch "beste". `s.prBadge` ist bereits die historisch korrekte, an B63/B70 etablierte Quelle für "hat diese Übung gerade einen echten PR" — `highlights` war dafür nie als generische PR-Liste gedacht (nur als UI-Text für die Wochenrückblick-Karte).
**Gilt:** Permanent für dieses Feature.

### 2026-07 — Wochenrückblick/Share-Bild-Streak delegiert an calcCurrentStreak() statt eigener Logik (B74)
**Entscheidung:** `weekReview.js`s `_calcStreak(sortedWeeks, week)` berechnet die Streak nicht mehr selbst (nur `days.some(d => d.markedDone)`), sondern ruft `calcCurrentStreak()` (state.js) mit den bis zur betrachteten Woche abgeschnittenen, sortierten Wochen auf.
**Begründung:** Zwei unabhängige Streak-Implementierungen wichen in Edge Cases (Teilabschluss unter der 70%-Schwelle, Kalenderlücken >7 Tage) real voneinander ab — Training-Tab-Badge war korrekt (gap-aware, schwellenwert-bewusst, B69-Sonderfall), Wochenrückblick/Share-Bild war es nicht. Konkret nachgewiesen: eine 3-wöchige Trainingspause wurde im Wochenrückblick/Share-Bild einfach durchgezählt, während das Training-Tab-Badge korrekt bei der Lücke abbrach — das Share-Bild hätte eine objektiv falsche Zahl öffentlich geteilt. Gleiches Konsolidierungs-Muster wie B44/B45/B47 (eine Formel, keine Kopien).
**Gilt:** Permanent. Für "Streak zum Zeitpunkt einer bestimmten Woche" immer `calcCurrentStreak()` mit abgeschnittenem Wochen-Array verwenden, keine eigene Zähl-Logik.

### 2026-07 — Pre-Session Check-in: bestehendes energyLevel wiederverwenden statt neuem Feld (B76)
**Entscheidung:** Der Pre-Session-Check-in nutzt für den Post-Session-Vergleich das bereits vorhandene `day.energyLevel` (gesetzt im bestehenden Tagesabschluss-Flow, `_finishCompletion()`) statt eines neu vorgeschlagenen `sessionEnergyPost`-Felds mit eigener UI.
**Begründung:** Die Sprint-Vorlage hatte übersehen, dass `energyLevel` bereits genau diesen Zweck erfüllt — ein zweites, praktisch redundantes Energie-Feld hätte zwei leicht unterschiedliche Wahrheiten über denselben Tag erzeugt, ohne echten Zusatznutzen. Per `AskUserQuestion` bestätigt.
**Gilt:** Permanent für dieses Feature. Vor dem Anlegen eines neuen Day-Felds immer prüfen, ob ein bestehendes Feld (insb. sleepHours/energyLevel/sessionRating) semantisch bereits denselben Zweck erfüllt.

### 2026-07 — Pre-Session Check-in: -10%-Reduktion mutiert ex.sets[].weight direkt, nicht über getWeightRecommendation() (B76)
**Entscheidung:** Der `reduced`-Modifier des Session-Checkins reduziert die noch nicht bewerteten (`status:'pending'`) Gewichtssätze der heutigen Übungen direkt im `SESSION_CHECKIN_SET`-Reducer (state.js) um 10%, gerundet auf die pro-Übung eingestellte Schrittweite — nicht über `getWeightRecommendation()`.
**Begründung:** `getWeightRecommendation()` berechnet ausschließlich die Steigerungsempfehlung für die NÄCHSTE Woche (genutzt vom "Neue Woche"-Chip und 3 Coach-Insight-Triggern) — sie hat keinen Bezug zu bereits gesetzten Gewichten der laufenden Session und wäre für diesen Zweck semantisch falsch verwendet worden. Per `AskUserQuestion` bestätigt.
**Gilt:** Permanent. `getWeightRecommendation()` bleibt ausschließlich für "Empfehlung für die nächste Woche" reserviert — Anpassungen an den Gewichten der LAUFENDEN Session (heute) erfolgen immer als direkte Mutation der betroffenen Sätze, nie über diese Funktion.

### 2026-07 — Intra-Session-Gewichts-/Pause-Vorschläge leben in eigener sessionCoach.js-Logik, nicht in getWeightRecommendation() (B77)
**Entscheidung:** Sowohl der RPE-basierte "nächster Satz"-Vorschlag als auch der Vorschlag ohne RPE (Intra-Session Coach) werden in einer neuen, eigenen, importfreien Datei `sessionCoach.js` berechnet — rein aus dem gerade bewerteten Satz selbst (Gewicht, RPE, Status), nie aus mehrwöchiger Historie. `getWeightRecommendation()` wird dabei an genau einer Stelle aufgerufen: für die "Nächste Woche: Xkg"-Projektion am Ende einer Übung — das ist ihr einzig legitimer, bereits etablierter Anwendungsfall (siehe B76-Entscheidung oben).
**Begründung:** Die ursprüngliche Sprint-Vorlage wollte `getWeightRecommendation()` auch für den "nächster Satz ohne RPE"-Vorschlag verwenden — das hätte die B76-Entscheidung direkt revidiert UND wäre bei <2 Wochen Trainingshistorie einfach leer geblieben (die Funktion liefert dann `null`). Per Rückfrage bestätigt: eigene, session-lokale Logik statt Zweckentfremdung — funktioniert bereits ab der ersten Trainingswoche.
**Gilt:** Permanent. Die B76-Regel ("getWeightRecommendation() nur für nächste Woche") bleibt vollständig in Kraft, keine Ausnahme. Neue Intra-Session-Vorschläge (heute, laufende Übung) bekommen bei Bedarf eigene, einfache Berechnungen in sessionCoach.js statt bestehende Wochen-Empfehlungsfunktionen zweckzuentfremden.

### 2026-07 — sessionCoach.js: neues importfreies Modul, von ui.js UND timer.js genutzt (B77)
**Entscheidung:** `sessionCoach.js` (Tiefe 0, keine Imports — Muster wie `movementMap.js`/`setUtils.js`) wird sowohl von `ui.js` (Render der Intra-Session-Feedback-Texte) als auch von `timer.js` (Pause-Dauer-Berechnung für den Auto-Start-Timer) importiert. `timer.js` importierte bis B77 ausschließlich `state.js` (CLAUDE.md "Timer-Entkopplung").
**Begründung:** Beim Umsetzen wurde entdeckt, dass `timer.js` einen eigenen, von `ui.js` unabhängigen Klick-Listener für `[data-action="toggle-done"]` hat (`_bindAppInteractions()`), der den Pause-Timer direkt mit `ex.pauseSec` startet — ohne diesen zweiten Import hätte die neue Intra-Session-Pause-Empfehlung nur den selteneren `confirm-set`-Pfad erreicht, nicht den (vermutlich häufigeren) manuellen ✓/✗-Icon-Pfad. `sessionCoach.js` ist als reines Berechnungsmodul ohne eigene Imports die einzige Datei, die diese Lücke schließen kann, ohne die eigentliche "NIEMALS ui.js↔timer.js"-Kopplungsregel zu verletzen (sessionCoach.js importiert weder ui.js noch state.js noch timer.js, wird nur von beiden importiert — reiner Blatt-Knoten in der Abhängigkeits-Matrix).
**Gilt:** Permanent. Die "NIEMALS ui.js↔timer.js importieren"-Regel bleibt bestehen — Ausnahmen sind ausschließlich importfreie Tiefe-0-Module, die von beiden Seiten unabhängig genutzt werden können, nie eine direkte Kopplung der beiden Dateien selbst.

### 2026-07 — PR-Highlight-Delta gegen die Vorwoche, nicht gegen den (zum Abschlusszeitpunkt bereits überschriebenen) All-Time-Rekord (B79)
**Entscheidung:** Die "+Xkg ↑"-Highlight-Zeile in der Session Summary berechnet den Gewichts-Delta gegen `exWeightHistory()` der Wochen VOR der aktuellen Woche — nicht gegen `ex.prWeight`/`state.prs[name]`.
**Begründung:** Zum Zeitpunkt des Tagesabschlusses ist `state.prs[name]` für die heutigen Sätze bereits auf den NEUEN Wert aktualisiert (derselbe Mechanismus, der B63/B70 verursacht hat) — der alte Rekord ist zu diesem Zeitpunkt nirgends mehr im State auffindbar. `exWeightHistory()` der Vorwochen liefert stattdessen zuverlässig "wie viel mehr als beim letzten Mal trainiert" — bei einem echten PR (s.prBadge==='weight') ist das in der weit überwiegenden Mehrheit der Fälle ohnehin identisch zum tatsächlichen Rekord-Delta.
**Gilt:** Permanent für Highlight-/Rückblick-Texte, die einen "wie viel mehr als vorher"-Delta zu einem GERADE ausgelösten PR zeigen wollen. Für den PR-Betrag selbst (nicht den Delta) bleibt `s.prBadge`/das Satz-Gewicht selbst die korrekte Quelle (unverändert seit B63).

### 2026-07 — Compound/Isolation als 5. Strukturkarten-Signal, niedrigste Priorität (B79)
**Entscheidung:** `_checkCompoundIsolationBalance()` (weeklyFocus.js) ist das fünfte Signal in `computeStructuralSignals()`, mit der niedrigsten Priorität (nach Mehr-Übungen-Aggregation, Präventivem Deload, Konsistenz-Qualität, Push/Pull-Warnung). Die Karte zeigt weiterhin maximal 2 Signale gleichzeitig.
**Begründung:** Ein Compound/Isolation-Hinweis ist rein informativ (ähnlich der Push/Pull-Warnung) und in der Sprint-Vorlage nicht explizit priorisiert — als niedrigste Priorität eingeordnet, da er am wenigsten dringlich ist verglichen mit tatsächlichem Scheitern (Mehr-Übungen-Aggregation), Verletzungsrisiko (Präventiver Deload) oder sinkender Qualität (Konsistenz-Qualität).
**Gilt:** Permanent, bis explizit anders entschieden. Neue Strukturkarten-Signale werden standardmäßig an die niedrigste Priorität angehängt, sofern nicht ausdrücklich anders gefordert.

### 2026-07 — Deload-Plan nutzt EX_AUTO_PRESELECT_NEXT_WEEK_PLAN (Batch), nicht eine neue Action (B79)
**Entscheidung:** Der "Plan als Vorlage übernehmen"-Button im Deload-Plan dispatcht die bereits bestehende `EX_AUTO_PRESELECT_NEXT_WEEK_PLAN`-Action (state.js, ursprünglich für die "Neue Woche"-Chip-Automatik gebaut) mit einer `selections`-Liste für alle betroffenen Übungen auf einmal.
**Begründung:** Die Sprint-Vorlage beschrieb implizit eine neue Batch-Aktion — die existiert aber bereits, genau für diesen Zweck ("mehrere Übungen auf einmal mit nextWeekPlan vorbelegen"). `ex.nextWeekPlan` ist dabei ein DELTA (nicht Absolutwert), angewendet erst beim nächsten manuellen Wochenwechsel (`_applyPlannedProgression`) — konsistent mit der bestehenden "Progressive Overload = immer Nutzer-Entscheidung"-Regel oben, kein Sonderfall für Deload nötig.
**Gilt:** Permanent. Batch-Vorbelegungen von `nextWeekPlan` über mehrere Übungen hinweg nutzen immer `EX_AUTO_PRESELECT_NEXT_WEEK_PLAN`, nie einzelne `EX_SET_NEXT_WEEK_PLAN`-Dispatches in einer Schleife.

### 2026-07 — Session Coach "heute"-Definition: aktiv statt kalendarisch (B82)
**Entscheidung:** "Heute" im Sinne des Session Coach (Pre-Session Check-in/Briefing, Intra-Session Feedback, Pause-Timer-Empfehlung) bedeutet NICHT mehr kalendarisch heute, sondern "offener (nicht abgeschlossener) Tag in der aktuellen Trainingswoche". Das Kalenderdatum eines Tages ist irrelevant — ein Athlet, der einen Tag aufklappt und trainiert, trainiert "heute", unabhängig davon welcher Wochentag kalendarisch gerade ist.
**Begründung:** `_isTodayDay(wk, di)` leitete das Datum eines Tages bisher rein aus seinem Array-Index ab (`wk.startDate + di Tage`) — das setzt tägliches Training an aufeinanderfolgenden Tagen voraus. Ein 3x/Woche-Split (z.B. Mo/Mi/Fr) hätte für Tag-Index 2 ("Freitag" gemeint) immer Mittwoch berechnet und den Session Coach dadurch nie gezeigt (B82). Da TRAINs Vorlagen nur 2-3 "Tag"-Einträge haben (nicht 7) und kein Bezug zwischen Tag-Index und echtem Wochentag besteht, ist eine kalendarische Definition für diesen Zweck grundsätzlich falsch — nicht nur ein Bug in der Formel.
**Technisches Detail (Abweichung von der ursprünglich vorgeschlagenen Umsetzung):** "aktuelle Woche" wird über `getLatestWeek(state.weeks)` bestimmt (state.js), NICHT über `state.weeks[state.curIdx]`. `wk` ist an jeder Aufrufstelle von `_isTodayDay()` bereits exakt `state.weeks[state.curIdx]` (siehe `render()`, ui.js) — ein Vergleich dagegen wäre eine Tautologie, und `WEEK_NAVIGATE` ändert `curIdx` auch beim reinen Durchblättern vergangener Wochen. Mit der ursprünglich vorgeschlagenen Formel wäre der Session Coach fälschlich auch in längst abgeschlossenen alten Wochen wieder aufgetaucht, sobald dorthin navigiert wird — verifiziert per Playwright-Test, der genau dieses Szenario abdeckt. `getLatestWeek()` ist dieselbe, bereits etablierte Lösung für "aktuelle/letzte Woche, unabhängig von Navigation" wie bei `_relativeWeekLabel()` (siehe B72-Eintrag oben, "Letzte Woche mit echten Daten per Rückwärtssuche, nicht per Array-Position").
**Gilt:** Permanent bis gegenteilige Entscheidung. Neue "ist das der aktuell aktive Tag/Woche"-Prüfungen verwenden `getLatestWeek(state.weeks)` als Anker, niemals `state.weeks[state.curIdx]` (das ist der navigierbare Anzeige-Cursor, nicht "die aktuelle Woche").

### 2026-07 — Reduzierte Tagesform dämpft nur eine echte Reduzierung, nie Halten oder Steigern (B84, korrigiert B91)
**Entscheidung:** `_applyModifier()` (sessionCoach.js) wendet die "reduzierte Tagesform"-Dämpfung (`sessionModifier==='reduced'`, B76) nur noch an, wenn die zugrundeliegende Empfehlung selbst eine ECHTE Reduktion ist (`nextWeight < currentWeight`). Weder eine Steigerung noch ein Halten (`nextWeight >= currentWeight`) werden gedämpft.
**Begründung:** Die ursprüngliche Formel (`Math.max(nextWeight * 0.9, currentWeight - step)`) wurde für den Fall entworfen, dass eine Reduktion an einem schlechten Tag nicht zu stark ausfällt. B84 stellte fest, dass eine Steigerung (RPE≤6, `nextWeight > currentWeight`) davon fälschlich mitgedämpft wurde (98kg RPE6 zeigte "95kg" statt einer Steigerung auf ~100kg) und schützte diesen Fall — verwendete dafür aber den Vergleich `nextWeight > currentWeight`, also `>` statt `>=`. Das ließ den HALTEN-Fall (`nextWeight === currentWeight`, z.B. RPE 6.5-7.9 nach der B92-Matrix) weiterhin ungeschützt: 55kg halten bei RPE 7.5 wurde zu 52.5kg reduziert, obwohl der gleichzeitig gezeigte Hinweistext ("Gute Intensität"/"halten") keine Reduzierung meint (B91). Ein niedriges oder mittleres RPE ist kein Signal, das durch die "reduzierte Tagesform"-Einstufung des GESAMTEN Tages entwertet werden sollte — nur eine tatsächlich EMPFOHLENE Reduktion darf zusätzlich durch den Tagesform-Modifier verstärkt werden.
**Gilt:** Permanent bis gegenteilige Entscheidung. Neue Tagesform-Dämpfungslogik (falls je erweitert) prüft immer zuerst, ob die zugrundeliegende Basis-Empfehlung eine ECHTE Reduktion ist (`<`, nicht `<=`), und dämpft ausschließlich diesen Fall — Halten und Steigern bleiben beide immer ungedämpft.

### 2026-07 — Manueller Reduzierungs-Button ist Catch-up, ersetzt nicht die automatische -10%-Reduktion (B87/B88)
**Entscheidung:** Die bestehende automatische -10%-Reduktion bei Check-in-Abgabe mit `sessionModifier==='reduced'` (B76, `SESSION_CHECKIN_SET`) bleibt vollständig unverändert. Der neue manuelle Button "Gewichte heute anpassen (-10%)" im Briefing ist ausschließlich ein Catch-up für Sätze, die zum Check-in-Zeitpunkt noch nicht existierten (z.B. eine Übung, die erst danach zum Tag hinzugefügt wurde) — er dispatcht dieselbe Reduktions-Formel über eine neue Batch-Action (`DAY_REDUCE_PENDING_WEIGHTS`), nicht eine unabhängige zweite Reduktionslogik.
**Begründung:** Die Sprint-Vorlage ging von einem einzigen manuellen Reduktions-Mechanismus aus und übersah, dass B76 bereits eine automatische Version für denselben Zweck implementiert. Ein naiv als "die" Lösung gebauter Button hätte bei jedem Klick erneut reduziert (Doppel-/Mehrfach-Dämpfung) oder wäre bei bereits vollständig reduzierten Tagen wirkungslos gewesen. Drei Optionen wurden dem Nutzer vorgelegt (Catch-up-Button / Button ersetzt Automatik / Button zeigt nur Status ohne Aktion) — Option 1 (Catch-up) bestätigt.
**Gilt:** Permanent. Ein `localStorage`-Flag (`train_reduced_<weekStart>_<di>`) verhindert nur die MEHRFACH-Auslösung des Buttons selbst (nicht der Automatik) und wird bei Tagesabschluss entfernt. Batch-Reduktion über mehrere Sätze/Übungen hinweg nutzt immer einen einzigen Dispatch (hier `DAY_REDUCE_PENDING_WEIGHTS`), nie eine Schleife aus `SET_UPDATE`-Dispatches — konsistent mit der bestehenden Batch-Konvention (siehe B79-Eintrag oben, `EX_AUTO_PRESELECT_NEXT_WEEK_PLAN`), da `SET_UPDATE` nicht in `_NO_UNDO` steht und sonst pro Satz ein eigener Undo-Schritt entstünde.

### 2026-07 — "Übernehmen"-Button ist halbautomatisch, kein Auto/Halbautomatik-Toggle (B89)
**Entscheidung:** Der "Übernehmen ↗"-Button im Intra-Session Coach setzt IMMER beides in einem Tap — das Gewicht des nächsten Satzes UND den Start des Pause-Timers. Es gibt keinen Toggle oder eine Einstellung, um nur eines von beidem auszulösen. Der Button erscheint nie beim letzten Satz einer Übung und nie wenn `nextWeight === currentWeight` (Halten-Empfehlung — nichts zu übernehmen) oder ohne eingegebenes RPE.
**Begründung:** Ein getrenntes Umschalten zwischen "nur Gewicht" und "Gewicht + Timer" hätte eine zusätzliche Entscheidung pro Satz erzwungen, obwohl in der weit überwiegenden Mehrheit der Fälle ohnehin beides gewünscht ist (Gewicht für den nächsten Satz vorbereiten UND die Pause dafür einhalten) — genau der manuelle Doppel-Schritt, den der Button ersetzen soll. Läuft der Timer bereits (z.B. vom vorherigen Satz), wird er nicht neu gestartet oder verkürzt — geprüft per direkter DOM-Klassenabfrage (`#pause-overlay.pause-overlay--visible`), da `ui.js` keinen programmatischen Zugriff auf `timer.js`-internen State haben darf (Timer-Entkopplungsregel, CLAUDE.md).
**Gilt:** Permanent bis gegenteilige Entscheidung. Neue "Ein-Tap-Übernehmen"-Aktionen dieser Art bleiben bewusst untoggle-bar, wenn die zugrundeliegenden Einzelschritte in der Praxis nahezu immer gemeinsam gewünscht sind.

### 2026-07 — Entscheidungsmatrix v2: RPE + Wdh-Differenz kombiniert, Wdh-Verfehlung hat Vorrang vor RPE (B92)
**Entscheidung:** `buildSetFeedback()` (sessionCoach.js) berechnet `repDiff = targetReps - reps` und lässt diesen Wert VOR der RPE-Bewertung entscheiden, in welche der vier Gruppen ein bewerteter Satz fällt: deutlich verfehlt (`repDiff>=2`), knapp verfehlt (`repDiff===1`), erreicht (`repDiff===0`), übertroffen (`repDiff<0`). Erst innerhalb der jeweiligen Gruppe verfeinert das eingegebene RPE die Empfehlung. Gilt nur wenn ein RPE eingegeben wurde — ohne RPE bleibt die ursprüngliche, rein `s.status`-basierte Logik unverändert (repDiff-Matrix setzt RPE-Bänder voraus, die ohne RPE nicht existieren).
**Begründung:** Vor B92 bewertete `buildSetFeedback()` ausschließlich RPE — eine verfehlte Wiederholungszahl floss nur indirekt über `s.status` (Erfolg/Fehlschlag) ein, ohne Abstufung nach WIE VIEL verfehlt wurde. Eine tatsächlich objektiv gemessene Wiederholungszahl ist ein stärkeres, weniger subjektives Signal als die reine Anstrengungs-Einschätzung (RPE) und rechtfertigt daher Vorrang in der Kaskade.
**Gilt:** Permanent bis gegenteilige Entscheidung. Rückgabeobjekt von `buildSetFeedback()` enthält zusätzlich `repDiff`/`rpe`/`rpeZone`/`reps`/`targetReps`/`unit` (nicht nur `nextWeight`/`pauseSec`/`hint` wie vor B92) — für die B93-Begründungsanzeige, damit `ui.js` keine der Banding-Logik dupliziert. `rpeZone`-Schwellen: `rpe<=6` "leicht", `rpe<8.5` "optimal", sonst "hart". Pausendauer wird über einen gemeinsamen Helper `_pauseSecForRpe()` abgeleitet, wo eine Gruppe keinen eigenen Wert vorschreibt — ein einziger Pausenplan statt mehrerer, ggf. widersprüchlicher.

### 2026-07 — B94 ersetzt die B89-2-Sekunden-Ausblendung durch dauerhafte Sichtbarkeit, inkl. nach Undo (B94)
**Entscheidung:** Nach einem "Übernehmen"-Tap bleibt die Feedback-Zeile ("→ Nächster Satz: Xkg" + "✓ Übernommen") dauerhaft sichtbar, nicht mehr nur 2 Sekunden lang (B89). Wird der zugehörige Satz später wieder auf "pending" gesetzt — per Undo ODER manuellem Zurücktippen auf das ✓/✗-Icon, beides am Render-Zeitpunkt nicht unterscheidbar —, bleibt derselbe gespeicherte Snapshot sichtbar, ergänzt um "(rückgängig gemacht)".
**Begründung:** Dies ist eine bewusste PRODUKT-Revision von B89, kein Bugfix — B89s "dann weg"-Verhalten war eine explizite Design-Entscheidung des vorherigen Sprints, die sich nach echtem Nutzungsfeedback als zu knapp erwiesen hat (der Athlet konnte nicht mehr nachschauen, was er gerade entschieden hatte, sobald die 2 Sekunden verstrichen waren oder ein Undo den Satz zurücksetzte). Vom Nutzer nach expliziter Rückfrage bestätigt.
**Technisches Detail:** `_acceptedFeedback` (ui.js, vormals `_adoptedSetFeedback`) speichert seit B94 den vollständigen Feedback-Snapshot (nicht nur einen Zeitstempel) und wird per `${wk.id}-${di}-${ei}-${si}` geschlüsselt (NICHT nur `${di}-${ei}-${si}` wie das kosmetische `_setFeedbackExpanded`/`_optionalSetDismissed`) — da der Snapshot jetzt echte Daten trägt und beliebig lange bestehen bleibt, würde ein reiner Tag-Index-Schlüssel sonst über einen Wochenwechsel hinweg bluten (`day.id` bleibt über geklonte Wochen hinweg identisch, siehe B83) und einem frischen `pending`-Satz der NEUEN Woche fälschlich die alte Empfehlung samt "(rückgängig gemacht)" unterschieben. Gelöscht bei Tagesabschluss (`_finishCompletion()`, Prefix `${wk.id}-${di}-`).
**Gilt:** Permanent bis gegenteilige Entscheidung. Neue "Nutzer hat etwas explizit übernommen/bestätigt"-Zustände, die über den ursprünglichen Bewertungs-Moment hinaus sichtbar bleiben sollen, werden analog wk.id-geschlüsselt, sobald sie echte Daten (nicht nur einen Timestamp/Boolean) tragen.

### 2026-07 — Sprint C1: Trainingsziel wird persistiert (state.settings.goal, kein SCHEMA-Bump)
**Entscheidung:** Das im Onboarding bereits abgefragte "Hauptziel" (`_mainGoal`, ui.js — Werte `'kraftaufbau'|'muskelaufbau'|'fitness'`) wird ab jetzt in `state.settings.goal` persistiert (`_finish()` dispatcht `SETTING_SET`), statt nach dem Erstellen der Vorlage verworfen zu werden. Neue Settings-Tab-Zeile ("Trainingsziel") erlaubt späteres Ändern, identisches 3-Button-Muster wie im Onboarding, togglebar auf `null` (erneuter Klick auf denselben Wert). Kein SCHEMA-Bump — `goal: null` wurde wie `sessionCoach`/`hideStreakBadge` etc. im "Always-apply defaults"-Block von `migrate()` ergänzt (state.js), keine versionierte Migration nötig, da rein additiv mit sicherem Default.
**Begründung:** Die Sprint-Vorlage für die evidenzbasierte Pausenzeiten-Differenzierung (Peer-reviewed: de Salles et al. 2009, Schoenfeld et al. 2016, Grgic et al. 2017/2018) ging fälschlich davon aus, `state.settings.goal` existiere bereits — tatsächlich war das Hauptziel nur eine lokale Onboarding-Variable ohne jede Persistenz. Per Rückfrage entschieden: Trainingsziel ist ein Programm-Level-Konzept (nicht pro Satz/Übung unterschiedlich), daher ein einziges globales Setting statt einer Ableitung aus `ex.targetReps` (Alternative, aber ungenauer — ein Kraft-Athlet kann trotzdem Isolationsübungen mit 12 Wdh programmieren).
**Gilt:** Permanent bis gegenteilige Entscheidung. `goal === 'kraftaufbau'` ist die einzige Kraft-Einstufung — `'muskelaufbau'`, `'fitness'` und `null` (nicht gesetzt/Altbestand) laufen alle über den Hypertrophie-Zweig jeder künftigen goal-abhängigen Logik (konsistent mit der Pausenzeiten-Tabelle unten).

### 2026-07 — Sprint C1: Compound/Isolation-Erkennung für Pausenzeiten ist NICHT dieselbe wie die B79-Kategorie-Heuristik
**Entscheidung:** Neue `isCompoundExercise(name, categoryMap)` + `ISOLATION_EXERCISE_NAMES`-Set in `movementMap.js` (Abweichung von der ursprünglichen "movementMap.js: nur Import"-Sprint-Vorgabe, nach Rückfrage bewusst genehmigt). Prüft zuerst die explizite Isolationsliste (Bizepscurls, Frontheben/Seitheben, Trizepsdrücken, Beinstrecker, Wadenheben, Shrugs etc.), fällt sonst auf `resolveCategory()` zurück: Core/Carry = Isolation, alles andere (inkl. unbekannt/`Sonstige`) = Compound (sicherer Fallback). Aufgerufen von `ui.js`/`timer.js` (beide importieren `movementMap.js` bereits) — `sessionCoach.js` bekommt `isCompound` nur als zusätzlichen primitiven Parameter (bool) und bleibt dadurch weiterhin vollständig importfrei (Tiefe 0, siehe B77-Eintrag oben).
**Begründung:** `movementMap.js` kategorisiert nach BewegungsMUSTER (Push/Pull/Squat/Hinge), nicht nach Compound/Isolation — die bestehende B79-Logik (`_checkCompoundIsolationBalance()`, weeklyFocus.js: Squat/Hinge/Push/Pull = "Compound") stuft dadurch klassische Isolationsübungen wie Bizepscurls (Kategorie 'Pull') fälschlich als Compound ein. Für die B79-Strukturkarte war das bereits akzeptierter Stand (rein informativ, niedrigste Priorität) — für eine konkrete Pausenzeiten-EMPFEHLUNG (Sekundenwerte, die der Athlet direkt befolgt) reichte diese Ungenauigkeit nicht, deshalb eine echte, separate Klassifikation statt Wiederverwendung.
**Bewusst NICHT im selben Sprint gemacht:** `_checkCompoundIsolationBalance()` (B79) bleibt unverändert auf der alten, reinen Kategorie-Heuristik — die beiden Konzepte ("Compound" laut B79-Strukturkarte vs. "Compound" laut Sprint-C1-Pausenzeiten) sind damit bewusst inkonsistent nebeneinander im Code vorhanden. Kandidat für einen späteren eigenen Sprint (B79 auf `isCompoundExercise()` umstellen), aber out of scope hier — Vorlage/Rückfrage bezog sich ausschließlich auf die Pausenzeiten-Funktion.
**Gilt:** Bis B79 explizit auf die neue Erkennung umgestellt wird (eigene Entscheidung nötig, da eine Änderung an einer bereits getesteten, produktiven Coach-Karte).

### 2026-07 — Sprint C2 (Teil A): Tagesform-Reduktion differenziert nach kumuliertem vs. einmaligem Schlafmangel
**Entscheidung:** `_buildSessionBriefing()` (ui.js) prüft zusätzlich `_isCumulativeSleepDeficit(state)` (2 von 3 letzten abgeschlossenen Trainingstagen mit schlechtem Schlaf). Einmalig schlechter Schlaf ohne kumulierten Befund löst den neuen, milderen Modifier `'reduced_mild'` aus (-5%, alle Übungen). Kumulierter Schlafmangel ODER niedrige Energie lösen weiterhin `'reduced'` aus, jetzt aber mit `modifierScope:'compound'` (-10%, NUR Compound-Übungen — Isolationsübungen bleiben unverändert). Niedrige Energie eskaliert dabei immer zur vollen Compound-Reduktion, auch wenn Schlaf allein nur die milde Stufe ausgelöst hätte. `_reducePendingWeights()` (state.js) bekommt dafür `modifier`/`scope`/`compoundExerciseNames` als Parameter — die Namensliste wird vom Aufrufer (ui.js, importiert bereits `movementMap.js`) berechnet, `state.js` bleibt dadurch importfrei (Muster wie Sprint C1). Der Intra-Session-Coach (`_applyModifier()`, sessionCoach.js) respektiert denselben Scope, nach Rückfrage bestätigt — sonst hätte eine Isolationsübung im laufenden Training trotzdem eine gedämpfte Empfehlung gezeigt, obwohl die Briefing-Karte "Isolation unverändert" verspricht.
**Begründung:** Knowles et al. 2018 (*Journal of Science and Medicine in Sport*, DOI 10.1016/j.jsams.2018.01.012): akute (einmalige) Schlafdeprivation zeigt kaum Kraftverlust, solange die Motivation erhalten bleibt — erst kumulierte Schlafrestriktion über mehrere Nächte reduziert die Kraftleistung, und zwar spezifisch bei Mehrgelenks- (Compound-), nicht bei Isolationsübungen (siehe auch Bonnar et al. 2022, *Sports Medicine*, DOI 10.1007/s40279-022-01706-y). Die alte, undifferenzierte "-10% bei jeder schlechten Nacht"-Logik war damit für den häufigsten Fall (eine einzelne schlechte Nacht) zu aggressiv angesetzt.
**Gilt:** Permanent bis gegenteilige Entscheidung. Neue Tagesform-Modifier-Werte werden immer mit einem `modifierScope` (`'all'`|`'compound'`) eingeführt, nie als reiner Prozentwert ohne Übungstyp-Bezug.

### 2026-07 — Sprint C2 (Teil A): RPE-Ziel-Verschiebung bei 'reduced_mild' ist -0.5 (Annahme, nicht explizit vorgegeben)
**Entscheidung:** Die Briefing-Karte verschiebt das RPE-Ziel bei `'reduced_mild'` um -0.5 (zwischen `'normal'` unverändert und `'reduced'` um -1), konsistent zur 5%/10%-Relation der Gewichtsreduktion.
**Begründung:** Die Sprint-Vorlage spezifizierte keinen RPE-Ziel-Wert für die neue milde Stufe — -0.5 wurde als proportionale Interpolation gewählt (halber Schritt für halbe Reduktion), keine eigene sportwissenschaftliche Quelle dafür.
**Gilt:** Bis gegenteilige Entscheidung oder neue Evidenz zu RPE-Ziel-Verschiebungen bei mildem Schlafdefizit.

### 2026-07 — Sprint C2 (Teil B): Deload reduziert Volumen (Satz-Anzahl) statt Intensität (Gewicht)
**Entscheidung:** Der "Plan übernehmen"-Button (Coach-Tab, `deload_preventive`-Signal) öffnet jetzt eine Wahl ("Diese Woche" / "Nächste Woche", Popup-Muster wie `_showReentryPopup`) statt weiterhin einen Gewichts-Delta auf `ex.nextWeekPlan` zu setzen (der alte Mechanismus, `EX_AUTO_PRESELECT_NEXT_WEEK_PLAN`, wird für Deload nicht mehr verwendet — Gewicht ändert sich beim neuen Konzept nie). "Diese Woche" reduziert sofort die Satz-Anzahl (`Math.min(currentSets, Math.max(2, Math.round(currentSets*0.6)))`, überzählige Sätze markiert `s.deloadSkip=true`, nicht gelöscht) der heute noch OFFENEN (nicht `markedDone`) Tage der aktuellen Woche und markiert die Woche als `mode:'deload'`. "Nächste Woche" merkt den Wunsch nur vor (`wk.deloadPlannedForNext`), angewendet erst bei der nächsten Wochenerstellung (`WEEK_CREATE` UND `AUTO_WEEK_CREATE`, per Rückfrage bestätigt — eine Deload-Reduktion ist bereits eine bestätigte Entscheidung des Athleten, anders als eine automatische Gewichtssteigerung, die nie still angewendet wird). Eine neue Woche NACH einer Deload-Woche klont aus der Woche VOR dem Deload (`_findPreDeloadWeek()`, schließt Deload/Urlaub/Seed-Wochen aus) statt aus der reduzierten Deload-Woche selbst — stellt die originale Satz-Anzahl wieder her.
**Begründung:** Pritchard et al. 2015 (*Strength and Conditioning Journal*, DOI 10.1519/SSC.0000000000000125, Taper-Literatur): eine Volumenreduktion bei erhaltener Intensität ist für den Kraft-Peak-Erhalt tendenziell wirksamer als eine kombinierte Reduktion beider Parameter. Bell et al. 2024 (*Sports Medicine – Open*) und Coleman et al. 2024 (*PeerJ*, DOI 10.7717/peerj.16777) stützen zusätzlich, dass zu aggressive Volumenkürzungen ohne echten Erholungsbedarf Kraftfortschritt kosten können — die neue idempotente Satz-Reduktion (rekonstruiert `deloadSkip` immer neu aus `ex.sets.length`) verhindert zudem ein versehentliches Doppel-Reduzieren bei wiederholtem Klick, ein Problem das der alte Gewichts-Mechanismus hatte.
**Trade-off (bewusst, mit Nutzer abgestimmt):** Da Gewicht während der Deload-Woche nie verändert wird, verwirft das Klonen aus der Vor-Deload-Woche automatisch jede manuelle Gewichtsänderung, die während der Deload-Woche selbst vorgenommen wurde — akzeptabel für eine kurze Ausnahme-Woche.
**Gilt:** Permanent bis gegenteilige Entscheidung. `s.deloadSkip`/`wk.deloadPlannedForNext` sind optionale/sparse Felder ohne SCHEMA-Bump (Präzedenz: `s.prBadge`, `settings.goal` — sicherer Default bei Abwesenheit, keine Migration nötig).

### 2026-07 — Sprint C2 (Teil B): deloadSkip-Sätze sind gesperrt, nicht nur ausgegraut
**Entscheidung:** Ein `deloadSkip`-Satz (`renderSetRow`, ui.js) ist für alle Eingaben gesperrt (`rowLocked = locked || isDeloadSkip`, identisch zu einem `locked`-Tag), zeigt eine "Deload"-Badge (bestehende `.deload-badge`-Klasse wiederverwendet) und wird per `opacity:.55` optisch abgesetzt.
**Begründung:** Nach Rückfrage bestätigt — verhindert versehentliches Bewerten eines Satzes, der diese Woche strukturell nicht existieren soll, konsistent mit der Sprint-Vorgabe "nicht als verpasst gewertet".
**Gilt:** Permanent bis gegenteilige Entscheidung.

### 2026-07 — Sprint C2 (Teil C): Wiedereinstiegs-Faktoren für die unteren zwei Zeitfenster abgeschwächt
**Entscheidung:** `_detectReentryPause()` (ui.js): `pauseDays<=14` liefert jetzt `0.05` (war `0.10`), `pauseDays<=28` liefert `0.10` (war `0.15`). Die oberen zwei Stufen (`<=56`: `0.20`, `>56`: `0.25`) sowie die Urlaubs-Sonderstufe (`0.05`) bleiben unverändert.
**Begründung:** Bosquet et al. 2013 (*Scandinavian Journal of Medicine & Science in Sports*, Meta-Analyse über 103 Studien, DOI 10.1111/sms.12047): bei trainierten Personen bleibt die Maximalkraft bis zu 2-3 Wochen weitgehend erhalten, ein deutlicherer Kraftabfall zeigt sich erst ab Woche 3-4. Die alte, undifferenzierte -10%/-15%-Reduktion in den ersten beiden Zeitfenstern war für die Zielgruppe (Intermediate+, 3-5×/Woche) damit zu aggressiv angesetzt.
**Korrektur:** Die Sprint-Vorlage nahm für die oberste Stufe (`>56` Tage) fälschlich `0.30` als aktuellen Wert an — tatsächlich stand dort bereits `0.25`, bereits innerhalb des als literaturkonform bewerteten Korridors "-25 bis -30%", daher keine Änderung nötig.
**Gilt:** Permanent bis gegenteilige Entscheidung oder neue Evidenz.

### 2026-07 — B97: Intra-Session-Feedback scrollt zu sich selbst statt zum nächsten Satz zu zentrieren
**Entscheidung:** Nach einer Satzbewertung (`toggle-done` UND `confirm-set`, ui.js) scrollt die App jetzt zum soeben gerenderten `.set-feedback`-Block des GERADE bewerteten Satzes (`block:'nearest'`, minimales Scrollen). Der bisherige `confirm-set`-Pfad zentrierte stattdessen aktiv auf den NÄCHSTEN offenen Satz (`block:'center'`) — dieses Verhalten entfällt.
**Begründung:** Nutzer-Bugreport (Übernehmen-Button auf Android nicht sichtbar) — Diagnose zeigte, dass genau dieses Zentrieren auf den nächsten Satz das neu gerenderte Feedback (inkl. "Übernehmen"-Button) des gerade bewerteten Satzes auf kurzen Mobile-Viewports aktiv aus dem sichtbaren Bereich drängte. Vom Nutzer nach Rückfrage explizit bestätigt: "der Athlet hat gerade einen Satz bewertet und will sofort sehen was das System empfiehlt" — das ist die richtige Priorität, nicht das Auffinden des nächsten Satzes.
**Technisches Detail:** ein direkter, synchroner `scrollIntoView()`-Aufruf unmittelbar nach `dispatch()` traf einen DOM-Knoten, der kurz danach durch einen weiteren Render-Pass ersetzt wurde (Scroll ging verloren) — behoben durch `setTimeout(..., 50)`, identisches Muster zum bereits bestehenden `move-ex-down`-Handler (ui.js). `_renderIntraFeedback()` bekommt dafür `data-di`/`data-ei`/`data-si` auf dem `.set-feedback`-Container.
**Gilt:** Permanent bis gegenteilige Entscheidung. Neue Auto-Scroll-Logik nach einer Nutzeraktion priorisiert immer das direkt durch diese Aktion entstandene, aktionable Feedback vor sekundären Convenience-Zielen (wie "nächstes Eingabefeld zeigen").

### 2026-07 — B98: Share-Fix bleibt bei der bestehenden Consent-Funktion, entfernt sie nicht
**Entscheidung:** Die Folge-Vorlage für den Android-Share-Bug schlug eine komplette Neuimplementierung von `shareCanvas()` vor, die `_ensureShareConsent()` (B73, einmaliger Datenschutz-Hinweis vor dem ersten Teilen) ersatzlos entfernt hätte. Nach Rückfrage: die Consent-Funktion bleibt vollständig erhalten, nur die interne Reihenfolge ändert sich (Blob/File werden jetzt VOR dem Consent-Await gebaut, nicht danach).
**Begründung:** Die beiden in der Folge-Vorlage angenommenen Root Causes (`canShare()` nicht vor `share()` geprüft; `canvas.toBlob()` nicht Promise-gewrappt) stimmten beide nicht mit dem echten Code überein — er hatte beides bereits korrekt. Der eigentlich per Diagnose gefundene Root Cause (verlorener User-Gesten-Kontext durch mehrere `await`-Schritte vor `navigator.share()`) wird von der reinen Umsortierung der Vorlage nicht behoben, da die Vorlage denselben strukturellen Ablauf beibehält. Die Consent-Funktion ersatzlos zu entfernen hätte daher ein bestehendes, getestetes Feature (B73, `tests/share_image_v3.spec.js`) kaputt gemacht, ohne den eigentlichen Bug zu adressieren.
**Ehrlich offen:** ob das Vorziehen von Blob/File das Kernproblem (verlorene "transient activation") tatsächlich behebt, ist eine plattformseitige Einschränkung, die ohne echtes Android-Gerät nicht mit letzter Sicherheit verifizierbar ist. Deshalb zusätzlich ein neues anonymes GoatCounter-Event (`share_failed: <ErrorName>`) bei jedem Fehler außer `AbortError` — Observability statt Blindfix, analog zu B66.
**Gilt:** Permanent bis gegenteilige Entscheidung. Bestehende, bereits getestete Features werden bei Bugfixes nicht ohne explizite Rückfrage entfernt, auch wenn eine Vorlage das nahelegt.
