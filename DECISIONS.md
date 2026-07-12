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
