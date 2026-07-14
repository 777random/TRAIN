/**
 * weeklyFocus.js – Coach-Tab-Signale, aufgeteilt in zwei unabhängige Ebenen
 * (Sprint "Coach-Tab Architektur"):
 *
 * 1. computeWeeklyFocus() – AKUTE Kaskade, EIN priorisiertes Signal (erstes
 *    zutreffendes gewinnt), braucht diese Woche eine konkrete Reaktion:
 *      1. Wiedereinstieg    – state.lastReentryHandled (bestehend, 1:1 wiederverwendet)
 *      2. Konsistente Fehlschläge – EINE Übung bei 0% Erfolg über 3 Wochen
 *                             (seit v160/B25) — VOR Überlastung, da eingetretenes
 *                             Totalversagen dringlicher ist als drohende Überlastung
 *      3. Überlastung       – Schlaf / RPE-Trend / Erfolgsquote (3 Zweige,
 *                             eigene Formulierung je Zweig, an S-02/S-04
 *                             angelehnte aber NICHT aus insightEngine.js
 *                             importierte Schwellenwerte)
 *      4. Plateau           – detectPlateaus() aus plateauDetector.js, 1:1
 *                             wiederverwendet. VOR Pre-Plateau (bestätigter,
 *                             stärkerer Befund hat Vorrang vor einer bloßen
 *                             Antizipation einer anderen Übung — Fix Problem 2)
 *      5. Pre-Plateau-Antizipation
 *      6. Konsistenz-Engpass – Anteil absolvierter Trainingstage über 6 Wochen,
 *                             nutzt state.js' isTrainingDay() für die Urlaubstage-
 *                             Ausschlussregel (einzige Quelle, nicht dupliziert)
 *      7. Progression       – isReadyForAutoSelect()/getWeightRecommendation()
 *                             aus weightRecommendation.js, 1:1 wiederverwendet
 *      Fallback: "Auf Kurs"
 *
 * 2. computeStructuralSignals() – STRUKTURELLE Signale, Array von 0-N
 *    gleichzeitig aktiven Hinweisen (kein "erstes gewinnt"), brauchen KEINE
 *    wöchentliche Entscheidung, bleiben über mehrere Wochen relevant:
 *      A. Mehr-Übungen-Aggregation – verteiltes Scheitern über ≥2 Übungen,
 *                               Gesamterfolgsquote ≤20% (seit v163) — Gegenstück
 *                               zu Punkt 2 oben (dort: EINE Übung bei 0%)
 *      B. Präventiver Deload  – aus _checkOverload() herausgelöst (war dort
 *                               vierter Zweig) — strukturell (8-Wochen-Horizont),
 *                               keine akute Entscheidung nötig
 *      C. Konsistenz-Qualität – hohe/stabile Frequenz bei sinkender Erfolgsquote,
 *                               nutzt computeConsistencyTrend()/computeQualityTrend()
 *                               aus overallPerformance.js, 1:1 wiederverwendet
 *      D. Push/Pull-Warnung   – deutliches muskuläres Ungleichgewicht über
 *                               erkenntnisseHorizont-Wochen, MOVEMENT_MAP-basiert
 *    Maximal 2 gleichzeitig (Priorität A > B > C > D), Rendering in ui.js als
 *    eigene, optisch sekundäre Karte unabhängig von computeWeeklyFocus().
 *
 * Beide Funktionen sind pure, keine Seiteneffekte.
 */

import { getLatestWeek } from './state.js';
import { detectPlateaus } from './plateauDetector.js';
import { getWeightRecommendation, isReadyForAutoSelect, roundToPlate } from './weightRecommendation.js';
import { isFullSuccess } from './setUtils.js';
import { _consistencyEligibleWeeks } from './consistencyUtils.js';
import { computeVolumeTrend, computeConsistencyTrend, computeQualityTrend } from './overallPerformance.js';
import { buildCategoryMap, resolveCategory } from './movementMap.js';

const DAY_MS = 86_400_000;

function _sortedWeeks(state) {
  return [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function _nonDeloadWeeks(state) {
  return _sortedWeeks(state).filter(w => w.mode !== 'deload' && w.mode !== 'vacation');
}

function _completionRate(wk) {
  let success = 0, total = 0;
  for (const d of wk.days) for (const ex of d.exercises) for (const s of ex.sets) {
    total++;
    if (s.status === 'success') success++;
  }
  return total > 0 ? success / total : 0;
}

// Dauer des "Wiedereinstieg"-Fensters nach lastReentryHandled — Sprint
// "Kategorie-1-Bugfixes", Fix 7: 14 -> 7 Tage. Betrifft NUR dieses Fenster
// (wie lange die Wiedereinstiegs-Karte danach noch aktiv bleibt), NICHT den
// Auslöse-Schwellenwert für das Reentry-Popup selbst (ui.js'
// _detectReentryPause() nutzt bereits "pauseDays <= 7 -> kein Popup",
// unverändert) und NICHT die davon unabhängigen "14"-Vorkommen an anderer
// Stelle (Plateau-Aktions-Unterdrückung, Backup-Reminder, relative
// Datumslabels — alles andere Features, siehe Diagnose-Sprint).
const REENTRY_WINDOW_DAYS = 7;

// ─── Prio 1: Wiedereinstieg ─────────────────────────────────────────────────
// Extrahiert aus ui.js (vormals private _isInRecoveryWindow) — identische
// Logik, einzige Implementierung. ui.js importiert diese Funktion jetzt
// statt eine eigene Kopie zu pflegen (siehe ui.js-Diff: keine Verhaltens-
// änderung, nur Verschiebung).
export function isInRecoveryWindow(state) {
  if (!state.lastReentryHandled) return false;
  const startMs = state.lastReentryHandled;
  const endMs   = startMs + REENTRY_WINDOW_DAYS * DAY_MS;
  const relevantWeeks = state.weeks.filter(w => {
    const ms = new Date(w.startDate + 'T00:00:00').getTime();
    return ms >= startMs && ms < endMs;
  });
  if (!relevantWeeks.length) return false;

  let succ = 0, fail = 0, rpeSum = 0, rpeCount = 0;
  for (const wk of relevantWeeks) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        for (const s of ex.sets) {
          if (s.status === 'success') {
            succ++;
            if (s.rpe != null) { rpeSum += s.rpe; rpeCount++; }
          } else if (s.status === 'fail') {
            fail++;
          }
        }
      }
    }
  }
  const total = succ + fail;
  if (total === 0) return false;
  const successRate = succ / total;
  const avgRpe = rpeCount > 0 ? rpeSum / rpeCount : null;
  return successRate > 0.85 && avgRpe != null && avgRpe < 7;
}

function _checkReentry(state) {
  if (!state.lastReentryHandled) return null;
  const daysSince = Math.floor((Date.now() - state.lastReentryHandled) / DAY_MS);
  if (daysSince < 0 || daysSince >= REENTRY_WINDOW_DAYS) return null;
  const weekNum = Math.floor(daysSince / 7) + 1;
  const inRecovery = isInRecoveryWindow(state);
  return {
    status: 'reentry',
    headline: 'Wiedereinstieg',
    reasoning: `Woche ${weekNum} nach deiner Trainingspause.`,
    recommendation: inRecovery
      ? 'Du erholst dich schnell — eine größere Steigerung wird vorgeschlagen.'
      : 'Gewichte bleiben vorerst reduziert, bis du wieder im Rhythmus bist.',
  };
}

// ─── Prio 2: Überlastung ────────────────────────────────────────────────────
// Eigenständige, an S-02 (RPE-Trend)/S-04 (Erfolgsquote) angelehnte aber
// NICHT importierte Schwellenwert-Logik (insightEngine.js bleibt unverändert).

// sleepHours hat zwei legitime Verwendungszwecke:
// 1. Überlastungs-Signal (hier, _checkLowSleep -> _checkOverload)
// 2. Schlaf↔Abschlussquote-Korrelation in insightEngine.js/progressInsights.js
// Beide sind framework-konform, da beide Entscheidungsrelevanz haben — keine
// Vereinheitlichung nötig, kein Duplikat.
function _checkLowSleep(state) {
  const weeks = _nonDeloadWeeks(state);
  if (!weeks.length) return null;
  const latest = weeks[weeks.length - 1];
  const sleeps = latest.days.filter(d => d.sleepHours != null).map(d => d.sleepHours);
  if (sleeps.length === 0) return null;
  const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
  if (avg >= 7) return null;
  return { signal: 'sleep', value: avg };
}

// Kein eigenständiges Overload-Signal — nur Verstärker für bestehende Signale
// (RPE, Schlaf, Erfolgsquote). Mindestens 2 Tage nötig, Urlaubstage ausgeschlossen.
function _checkLowEnergy(state) {
  const weeks = _nonDeloadWeeks(state);
  if (!weeks.length) return null;
  const latest = weeks[weeks.length - 1];
  const energies = latest.days
    .filter(d => d.energyLevel != null && !d.isVacation)
    .map(d => d.energyLevel);
  if (energies.length < 2) return null;
  const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
  if (avg > 2.5) return null;
  return { signal: 'energy', value: avg };
}

function _checkRisingRpe(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);
  const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
  for (const name of exNames) {
    const weights = last3.map(wk => {
      let max = 0;
      for (const d of wk.days) for (const ex of d.exercises) if (ex.name === name)
        for (const s of ex.sets) if (s.status === 'success' && (s.weight ?? 0) > max) max = s.weight;
      return max;
    });
    if (weights.some(w => w === 0) || !weights.every(w => Math.abs(w - weights[0]) < 0.1)) continue;
    const rpes = last3.map(wk => {
      const vals = [];
      for (const d of wk.days) for (const ex of d.exercises) if (ex.name === name)
        for (const s of ex.sets) if (s.status === 'success' && s.rpe != null) vals.push(s.rpe);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    if (rpes.some(r => r == null)) continue;
    if (rpes[0] < rpes[1] && rpes[1] < rpes[2]) {
      return { signal: 'rpe', exerciseName: name, values: rpes };
    }
  }
  return null;
}

function _checkDroppingCompletion(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 5) return null;
  const last3 = weeks.slice(-3);
  const prev  = weeks.slice(-8, -3);
  if (prev.length < 2) return null;
  const avg3 = last3.reduce((s, w) => s + _completionRate(w), 0) / last3.length;
  const avg8 = prev.reduce((s, w) => s + _completionRate(w), 0) / prev.length;
  if (avg3 >= avg8 - 0.1) return null;
  return { signal: 'completion', avg3, avg8 };
}

// Wochen seit dem letzten Deload — Rückwärts-Suchlauf analog zu
// insightEngine.js' E-03 ("Deload-Wirkung"), hier aber als allgemeiner
// Zähler statt einmaligem Vorher/Nachher-Vergleich. Zählt über ALLE Wochen
// (unfiltered, wie in E-03), da die Deload-Woche selbst gefunden werden muss.
// Nie ein Deload in der Historie -> gesamte Historie zählt als "seit Deload"
// (kein Sonderfall nötig: ergibt für neue Nutzer ohnehin niedrige, harmlose
// Werte unterhalb der 8-Wochen-Schwelle unten).
function _weeksSinceLastDeload(state) {
  const sorted = _sortedWeeks(state);
  if (!sorted.length) return 0;
  const deloadIdx = [...sorted.keys()].reverse().find(i => sorted[i].mode === 'deload');
  return deloadIdx == null ? sorted.length : (sorted.length - 1) - deloadIdx;
}

// Ø RPE einer Woche über ALLE Übungen (nicht pro Übung wie _exAvgRpe in
// plateauDetector.js) — eigenständig statt aus insightEngine.js importiert
// (dort existiert avgRpeWeek() bereits, aber nicht exportiert; weeklyFocus.js
// importiert bewusst nicht aus insightEngine.js, siehe Datei-Kopf).
function _avgRpeWeek(wk) {
  const rpes = [];
  for (const d of wk.days) for (const ex of d.exercises) for (const s of ex.sets)
    if (s.status === 'success' && s.rpe != null) rpes.push(s.rpe);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

// Präventiver Deload: kein Deload seit >=8 Wochen UND (Volumen steigt ODER
// Ø RPE der letzten 3 Wochen > 7.5). Strukturelles Signal (8-Wochen-Horizont,
// keine akute Wochenentscheidung) — seit Sprint "Coach-Tab Architektur" NICHT
// mehr Teil von _checkOverload(), sondern eigenständig in
// computeStructuralSignals() unten (Fix Problem 4: strukturelle Signale
// verdrängten zuvor akute/spezifischere Signale durch ihre Platzierung in
// der akuten Kaskade).
function _checkPreventiveDeload(state) {
  const weeksSince = _weeksSinceLastDeload(state);
  if (weeksSince < 8) return null;

  const volTrend = computeVolumeTrend(state, 4);
  const volumeUp = volTrend?.direction === 'up';

  const recentRpes = _nonDeloadWeeks(state).slice(-3).map(_avgRpeWeek).filter(v => v != null);
  const avgRpe  = recentRpes.length ? recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length : null;
  const rpeHigh = avgRpe != null && avgRpe > 7.5;

  if (!volumeUp && !rpeHigh) return null;
  return { signal: 'deload_preventive', weeksSince, volumeUp, avgRpe };
}

// Eigene headline/directive pro Signal-Typ (Fix Problem 7) — vorher teilten
// sich alle drei Zweige "Erholung priorisieren"/"Diese Woche keine
// Gewichtssteigerungen", der Athlet konnte die Ursache (Schlaf vs. eine
// bestimmte Übung vs. programmweite Quote) ohne "Warum?"-Aufklappen nicht
// unterscheiden. energySignal bleibt reiner Verstärker-Text im reasoning,
// unverändert gegenüber vorher.
function _buildOverloadResult(signal, energySignal = null) {
  const hasLowEnergy = energySignal != null;
  const energySuffix = hasLowEnergy
    ? ` Dein durchschnittliches Energielevel lag diese Woche bei ${energySignal.value.toFixed(1)}/5.`
    : '';

  if (signal.signal === 'sleep') {
    const reasoning = hasLowEnergy
      ? `Sowohl Schlaf (Ø ${signal.value.toFixed(1)}h) als auch Energielevel (Ø ${energySignal.value.toFixed(1)}/5) deuten diese Woche auf Erholungsbedarf hin.`
      : signal.value < 6
        ? `Die Daten zeigen: dein Schlaf liegt im Schnitt nur bei ${signal.value.toFixed(1)}h diese Woche — deutlich unter den empfohlenen 7h.`
        : `Die Daten zeigen: dein Schlaf liegt im Schnitt bei ${signal.value.toFixed(1)}h diese Woche — etwas unter den empfohlenen 7h.`;
    return {
      status: 'overload',
      headline: 'Schlaf priorisieren',
      reasoning,
      recommendation: 'Diese Woche keine Gewichtssteigerungen — dein Schlaf kostet Kraft.',
      signalType: signal.signal,
    };
  }

  if (signal.signal === 'rpe') {
    return {
      status: 'overload',
      headline: 'Aufwand steigt',
      reasoning: `${signal.exerciseName}: die Anstrengung (RPE) steigt seit 3 Wochen bei gleichem Gewicht — ${signal.values.map(v => v.toFixed(1)).join(' → ')}.${energySuffix}`,
      recommendation: `${signal.exerciseName} wird anstrengender ohne mehr Gewicht — diese Woche halten.`,
      signalType: signal.signal,
    };
  }

  // completion
  return {
    status: 'overload',
    headline: 'Qualität sichern',
    reasoning: `Deine Erfolgsquote ist von ${Math.round(signal.avg8 * 100)}% auf ${Math.round(signal.avg3 * 100)}% gesunken.${energySuffix}`,
    recommendation: 'Deine Erfolgsquote ist gesunken — Gewicht halten bis sie sich stabilisiert.',
    // Rohes Signal zusätzlich offengelegt (bereits oben berechnet, keine neue
    // Logik) — für die Decisional-Balance, die wissen muss WELCHES der 3
    // Signale zutraf, ohne die reasoning-Prosa zu parsen.
    signalType: signal.signal,
  };
}

function _checkOverload(state) {
  const energy = _checkLowEnergy(state);
  const sleep = _checkLowSleep(state);
  if (sleep) return _buildOverloadResult(sleep, energy);
  const rpe = _checkRisingRpe(state);
  if (rpe) return _buildOverloadResult(rpe, energy);
  const completion = _checkDroppingCompletion(state);
  if (completion) return _buildOverloadResult(completion, energy);
  return null;
}

// ─── Prio 4: Pre-Plateau-Antizipation ───────────────────────────────────────
// Feuert wenn RPE-Kosten pro kg steigen, obwohl das Gewicht noch leicht
// zunimmt — erkennt die Erschöpfungszone BEVOR die Steigerung stoppt.
// Abgrenzung zu _checkRisingRpe (Prio 2): dort ist Gewicht identisch (Plateau
// bereits eingetreten); hier steigt Gewicht noch, aber der Preis pro kg auch.
// Steht seit Fix Problem 2 NACH Plateau (Prio 3) — ein bestätigtes Plateau
// ist der stärkere Befund und hat Vorrang vor dieser bloßen Antizipation.

function _checkPrePlateau(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);
  const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];

  for (const name of exNames) {
    // Max-Gewicht (success sets) pro Woche
    const maxWeights = last3.map(wk => {
      let max = 0;
      for (const d of wk.days)
        for (const ex of d.exercises)
          if (ex.name === name)
            for (const s of ex.sets)
              if (s.status === 'success' && (s.weight ?? 0) > max) max = s.weight;
      return max;
    });

    // (a) Gewicht muss gestiegen sein — schließt _checkRisingRpe-Bereich aus
    if (maxWeights.some(w => w === 0)) continue;
    if (maxWeights[2] <= maxWeights[0]) continue;

    // (b) RPE-Kosten pro kg: avgRpe[i] / maxWeight[i] streng steigend
    const rpeCostPerKg = last3.map((wk, i) => {
      const vals = [];
      for (const d of wk.days)
        for (const ex of d.exercises)
          if (ex.name === name)
            for (const s of ex.sets)
              if (s.status === 'success' && s.rpe != null) vals.push(s.rpe);
      if (!vals.length) return null;
      const avgRpe = vals.reduce((a, b) => a + b, 0) / vals.length;
      return avgRpe / maxWeights[i];
    });

    // (d) RPE-Daten für alle 3 Wochen vorhanden
    if (rpeCostPerKg.some(r => r == null)) continue;

    // (b) Streng monoton steigend
    if (!(rpeCostPerKg[0] < rpeCostPerKg[1] && rpeCostPerKg[1] < rpeCostPerKg[2])) continue;

    // (c) Erfolgsquote ≥ 70% (kein echtes Leistungsproblem)
    let succ = 0, tot = 0;
    for (const wk of last3)
      for (const d of wk.days)
        for (const ex of d.exercises)
          if (ex.name === name)
            for (const s of ex.sets) { tot++; if (s.status === 'success') succ++; }
    if (tot === 0 || succ / tot < 0.7) continue;

    const cqWkStart = getLatestWeek(state.weeks)?.startDate;
    const cq = state.coachQuestion;
    const cqAnswer = (cq?.weekStart === cqWkStart && cq?.questionId === 'pre_plateau_subjective' && cq?.answer != null) ? cq.answer : null;
    return {
      status: 'pre_plateau',
      headline: 'Steigerung wird teurer',
      reasoning: `${name} kostet pro kg mehr Aufwand als vor 3 Wochen — ein Plateau deutet sich an.${cqAnswer === 'yes' ? ' Du bestätigst: die Übung fühlt sich deutlich anstrengender an.' : ''}`,
      recommendation: cqAnswer === 'yes'
        ? 'Plane jetzt eine Deload-Woche ein — dein Körper bestätigt den Trend.'
        : cqAnswer === 'no'
        ? 'Erhöhe die Wdh statt das Gewicht — der RPE-Trend könnte technischer Natur sein.'
        : 'Jetzt Strategie überdenken: Wdh erhöhen statt Gewicht, oder Deload einplanen bevor die Steigerung stoppt.',
      exerciseName: name,
    };
  }
  return null;
}

// ─── Struktur B: Konsistenz-Qualität ────────────────────────────────────────
// Feuert wenn die Trainingsfrequenz gleichbleibt/steigt, ABER die
// Satz-Erfolgsquote sinkt UND unter 75% liegt — "mehr Frequenz bringt gerade
// nichts, weil die Ausführungsqualität leidet". Abgrenzung zu
// _checkConsistencyGap (Prio 5, akute Kaskade): dort sinkt die FREQUENZ
// selbst (Tage fallen aus); hier bleibt die Frequenz intakt, nur die
// Qualität pro Satz sinkt. Strukturell (Trend über 8 Wochen) — seit Sprint
// "Coach-Tab Architektur" NICHT mehr Teil der akuten Kaskade, sondern in
// computeStructuralSignals() unten.
// Nutzt computeConsistencyTrend()/computeQualityTrend() aus
// overallPerformance.js 1:1 wiederverwendet (identische Berechnung wie im
// Fortschritt-Tab), NICHT neu implementiert.

// scoredWeeks für computeQualityTrend(): dieselbe Formel wie ui.js'
// _weekSuccessScore() (success/(success+fail), archivierte Übungen
// ausgeschlossen), hier bewusst dupliziert statt importiert — ui.js
// importiert bereits weeklyFocus.js, ein Reimport wäre zirkulär (identisches
// Muster zu _trueVol()/_weightVolume() in overallPerformance.js).
function _scoreWeek(week) {
  let succ = 0, fail = 0;
  for (const d of week.days)
    for (const ex of d.exercises) {
      if (ex.archived) continue;
      for (const s of ex.sets) {
        if (s.status === 'success') succ++;
        else if (s.status === 'fail') fail++;
      }
    }
  const total = succ + fail;
  return { succ, fail, total, pct: total > 0 ? Math.round(succ / total * 100) : 0 };
}

function _checkConsistencyQuality(state) {
  // Historie-Gate wie _checkConsistencyGap unten (min. 6 auswertbare Wochen) —
  // dieselbe Datenbasis (_consistencyEligibleWeeks), unabhängig davon ob am
  // Ende ConsistencyQuality oder ConsistencyGap zutrifft.
  const eligible = _consistencyEligibleWeeks(state);
  if (eligible.length < 6) return null;

  const consistency = computeConsistencyTrend(state, 8);
  if (!consistency || (consistency.direction !== 'up' && consistency.direction !== 'stable')) return null;
  // Fix Problem 5: verhindert Überschneidung mit _checkConsistencyGap (dort
  // Schwelle 0.7 als Ratio, hier curPct auf 0-100-Skala — daher <70, nicht
  // <0.7). 'stable' bedeutet nur "wenig Veränderung zwischen den Halbfenstern",
  // NICHT "guter Wert" — eine chronisch niedrige, aber flache Quote würde
  // sonst hier fälschlich als "Konsistenz ist stabil" durchgewunken, obwohl
  // ConsistencyGap die inhaltlich passendere Karte für einen chronisch
  // niedrigen Wert ist.
  if (consistency.curPct < 70) return null;

  const scoredWeeks = _sortedWeeks(state).map(_scoreWeek);
  const quality = computeQualityTrend(scoredWeeks, 8);
  if (!quality || quality.direction !== 'down') return null;
  if (quality.curPct >= 75) return null;

  const consistencyWord = consistency.direction === 'up' ? 'gestiegen' : 'stabil';
  return {
    status: 'consistencyQuality',
    headline: 'Qualität vor Quantität',
    reasoning: `Deine Konsistenz ist ${consistencyWord}, aber deine Satz-Erfolgsquote ist in den letzten ${quality.halfN} Wochen von ${quality.prevPct}% auf ${quality.curPct}% gesunken. Mehr Frequenz erzeugt gerade keinen Mehrwert.`,
    recommendation: 'Du trainierst regelmäßig, aber deine Erfolgsquote sinkt — weniger Einheiten, besser ausgeführt.',
  };
}

// ─── Prio 5 (akute Kaskade): Konsistenz-Engpass ─────────────────────────────
// Anteil absolvierter Trainingstage pro Woche — Urlaubstage-Ausschlussregel
// kommt aus state.js' isTrainingDay() (einzige Quelle, siehe Datei-Kopf).
// Ein verbleibender Urlaubstag (isVacation, aber mit Training) zählt als
// erledigt.
//
// _weekConsistencyRatio()/_consistencyEligibleWeeks() leben seit dem Sprint
// "Drei neue Coach-Signale" in consistencyUtils.js statt hier (Logik
// unverändert, nur verschoben, um den zirkulären Import mit
// overallPerformance.js zu vermeiden — siehe Datei-Kopf-Kommentar dort).

function _evaluateConsistencyWindow(windowWeeks) {
  const avg = windowWeeks.reduce((s, r) => s + r.ratio, 0) / windowWeeks.length;
  const belowCount = windowWeeks.filter(r => r.ratio < 0.7).length;
  return avg < 0.7 && belowCount >= 4;
}

function _checkConsistencyGap(state) {
  const eligible = _consistencyEligibleWeeks(state);
  if (eligible.length < 6) return null; // zu wenig Historie -> nicht auswertbar

  const last6 = eligible.slice(-6);
  if (!_evaluateConsistencyWindow(last6)) return null;

  const avgPct = Math.round((last6.reduce((s, r) => s + r.ratio, 0) / 6) * 100);

  // Varianz: war der Engpass schon im UNMITTELBAR VORHERGEHENDEN 6-Wochen-
  // Fenster (eine Woche früher) ebenfalls aktiv? Rein laufzeitberechnet,
  // keine Persistierung.
  const wasActiveBefore = eligible.length >= 7 && _evaluateConsistencyWindow(eligible.slice(-7, -1));

  const reasoning = wasActiveBefore
    ? `Der Trend hält an: du hast in den letzten 6 Wochen weiterhin nur ${avgPct}% deiner geplanten Trainingstage absolviert.`
    : `Du hast in den letzten 6 Wochen ${avgPct}% deiner geplanten Trainingstage absolviert.`;

  return {
    status: 'consistencyGap',
    headline: 'Konsistenz vor Intensität',
    reasoning,
    recommendation: 'Mehr Gewicht würde aktuell weniger bringen als mehr Regelmäßigkeit. Plane diese Woche bewusst feste Trainingszeiten.',
    // avgPct bereits oben berechnet, hier zusätzlich offengelegt für die
    // Decisional-Balance (keine neue Logik, nur Wiederverwendung).
    avgPct,
  };
}

// ─── Prio 3 (akute Kaskade): Plateau ────────────────────────────────────────
// detectPlateaus() 1:1 wiederverwendet, NICHT neu implementiert. Seit Fix
// Problem 2 VOR Pre-Plateau (Prio 4) — bestätigter Befund hat Vorrang.

/**
 * Sprint C2 (train-v109): "Ignorieren"/"Habe ich umgesetzt" unterdrücken die
 * Plateau-Karte für eine Übung, solange die Bedingung noch gilt — siehe
 * state.plateauActions. 'ignored' gilt nur für GENAU dasselbe Plateau (exakt
 * dieselbe plateauWeeks-Zahl wie beim Ignorieren) — sobald es länger dauert
 * ODER endet (neue Steigerung), ist die Unterdrückung automatisch aufgehoben.
 * 'implemented' gilt für 14 Tage ab dem Wochenstart der Aktion, danach
 * erscheint die Karte wieder falls das Plateau noch besteht.
 */
function _isPlateauSuppressed(p, action, curWeekStart) {
  if (!action) return false;
  if (action.action === 'ignored') {
    return action.plateauWeeksAtAction === p.plateauWeeks;
  }
  if (action.action === 'implemented') {
    const sinceMs = new Date(action.since + 'T00:00:00').getTime();
    const curMs   = new Date(curWeekStart + 'T00:00:00').getTime();
    return (curMs - sinceMs) < 14 * 86_400_000;
  }
  return false;
}

function _checkPlateau(state) {
  const plateaus = detectPlateaus(state.weeks, state.favoriteExercises ?? [], state.settings?.rpeEnabled ?? true);
  if (!plateaus.length) return null;
  const curWk = getLatestWeek(state.weeks);
  if (!curWk) return null;
  const actions = state.plateauActions ?? {};
  const active  = plateaus.filter(p => !_isPlateauSuppressed(p, actions[p.exerciseName], curWk.startDate));
  if (!active.length) return null;
  const longest = active.reduce((a, b) => (b.plateauWeeks > a.plateauWeeks ? b : a));
  // plateauWeeks startet bei 3 (Mindestwert für eine Erkennung) -> detectionAge=1
  // bedeutet "gerade erst erkannt", detectionAge>=3 bedeutet "seit 3+ Wochen bekannt".
  const detectionAge = longest.plateauWeeks - 2;
  const reasoning = detectionAge <= 2
    ? `${longest.exerciseName} zeigt seit ${longest.plateauWeeks} Wochen keine Steigerung.`
    : `${longest.exerciseName} stagniert weiterhin seit ${longest.plateauWeeks} Wochen — eine Anpassung könnte jetzt sinnvoll sein.`;
  const alsoAffected = active.filter(p => p !== longest);
  const alsoText = alsoAffected.length > 0
    ? ` Auch betroffen: ${alsoAffected[0].exerciseName} (${alsoAffected[0].plateauWeeks} Wochen).`
    : '';
  const cq = state.coachQuestion;
  const cqAnswer = (cq?.weekStart === curWk.startDate && cq?.questionId === 'plateau_outcome' && cq?.answer != null) ? cq.answer : null;
  const finalReasoning = reasoning + (cqAnswer === 'helped' ? ' Du berichtest Fortschritt — weiter so.' : '');
  const finalRec = cqAnswer === 'not_helped'
    ? 'Versuche eine andere Übungsvariante oder erhöhe das Volumen statt das Gewicht.'
    : longest.actionText + alsoText;
  return {
    status: 'plateau',
    headline: 'Plateau überwinden',
    reasoning: finalReasoning,
    recommendation: finalRec,
    plateau: longest,
  };
}

// ─── Prio 6 (akute Kaskade): Progression ────────────────────────────────────
// isReadyForAutoSelect()/getWeightRecommendation() 1:1 wiederverwendet.

function _qualificationStreak(name, calcWeeks, progressionMode, targetRepsMax) {
  let streak = 0;
  for (let end = calcWeeks.length; end >= 2; end--) {
    if (isReadyForAutoSelect(name, calcWeeks.slice(0, end), progressionMode, targetRepsMax)) streak++;
    else break;
  }
  return streak;
}

function _checkProgression(state) {
  const curWk = getLatestWeek(state.weeks);
  if (!curWk) return null;
  const calcWeeks = _nonDeloadWeeks(state)
    .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
  if (calcWeeks.length < 2) return null;

  const seen = new Set();
  const readyCandidates = [];

  curWk.days.forEach(day => {
    (day.exercises ?? []).forEach(ex => {
      if (seen.has(ex.name)) return;
      if (ex.substituteFor) return;
      if ((ex.progressionType ?? 'weight') === 'reps') return;
      seen.add(ex.name);
      const exProgressionMode = ex.progressionMode ?? 'weight_first';
      const exTargetRepsMax   = ex.targetRepsMax ?? null;
      const plateStep = ex.weightStep ?? state.settings?.plateStep ?? 2.5;
      if (!isReadyForAutoSelect(ex.name, calcWeeks, exProgressionMode, exTargetRepsMax)) return;
      const rec = getWeightRecommendation(ex.name, calcWeeks, plateStep, exProgressionMode, exTargetRepsMax);
      if (!rec) return;
      readyCandidates.push({ name: ex.name, rec, ex });
    });
  });

  if (!readyCandidates.length) return null;
  readyCandidates.sort((a, b) => b.rec.delta - a.rec.delta);
  const best   = readyCandidates[0];
  const second = readyCandidates[1] ?? null;

  const streak = _qualificationStreak(best.name, calcWeeks, best.ex.progressionMode ?? 'weight_first', best.ex.targetRepsMax ?? null);
  const alreadyConfirmedSame = best.ex.nextWeekPlanConfirmed && best.ex.nextWeekPlan === best.rec.delta;
  const reasonText = (best.rec.reasons ?? []).map(r => r.text).join(' · ');
  const intro = (streak >= 2 && !alreadyConfirmedSame)
    ? `${best.name} erfüllt die Kriterien bereits seit ${streak} Wochen.`
    : `${best.name} ist bereit für eine Steigerung.`;
  const alsoReadyText = second ? ` Auch bereit für Steigerung: ${second.name}.` : '';

  // Konfidenz: successRate + avgRpe der letzten 4 Wochen für best.
  // isFullSuccess() statt rohem status==='success' (Sprint "Kategorie-1-
  // Bugfixes", Fix 5e) — identisches Muster wie getWeightRecommendation()
  // in weightRecommendation.js: ein 'success'-Satz mit weniger Wdh als
  // targetReps ist ein Teilerfolg und zählt weder als Erfolg noch als
  // Fehlschlag (ausgeklammert), sonst würde ein Teilerfolg die Konfidenz
  // derselben Empfehlung optisch nach oben ziehen, die getWeightRecommendation()
  // selbst bereits strenger (nicht als vollen Erfolg) bewertet.
  let succ = 0, fail = 0, rpeSum = 0, rpeCount = 0;
  for (const wk of calcWeeks.slice(-4))
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === best.name)
          for (const s of ex.sets) {
            if (isFullSuccess(s, ex)) { succ++; if (s.rpe != null) { rpeSum += s.rpe; rpeCount++; } }
            else if (s.status === 'fail') fail++;
          }
  const confTotal = succ + fail;
  const confSuccessRate = confTotal > 0 ? succ / confTotal : 1;
  const confAvgRpe = rpeCount > 0 ? rpeSum / rpeCount : null;
  const confidence = (confSuccessRate >= 0.9 && (confAvgRpe === null || confAvgRpe <= 7.5)) ? 'high'
    : (confSuccessRate >= 0.8 && (confAvgRpe === null || confAvgRpe <= 8.5))               ? 'medium'
    : 'low';

  const cq = state.coachQuestion;
  const cqAnswer = (cq?.weekStart === curWk.startDate && cq?.questionId === 'progression_feeling' && cq?.answer != null) ? cq.answer : null;
  const finalConfidence = cqAnswer === 'good' ? 'high' : cqAnswer === 'tired' ? 'low' : confidence;
  const finalRec = cqAnswer === 'tired'
    ? 'Gewicht diese Woche halten — dein subjektives Empfinden spricht dagegen.'
    : `+${best.rec.delta}kg bei ${best.name} testen`;
  return {
    status: 'progression',
    headline: 'Steigerung sinnvoll',
    reasoning: reasonText ? `${intro} ${reasonText} spricht aktuell dafür.${alsoReadyText}` : `${intro}${alsoReadyText}`,
    recommendation: finalRec,
    confidence: finalConfidence,
    dataWeeks: calcWeeks.length,
    exerciseName: best.name,
    suggestedDelta: best.rec.delta,
    fromWeight: best.rec.lastWeight,
  };
}

// ─── Struktur C: Push/Pull-Warnung ──────────────────────────────────────────
// Deutliches muskuläres Ungleichgewicht (Push vs. Pull) über
// erkenntnisseHorizont-Wochen — Zeitfenster und Kategorisierung identisch zur
// bestehenden Push/Pull-Anzeige in ui.js' _renderMovementPattern() (MOVEMENT_MAP
// + customExercises-Override), dort aber NICHT importiert: ui.js importiert
// bereits weeklyFocus.js, ein Reimport wäre zirkulär (identisches Muster zu
// _scoreWeek() oben) — daher hier bewusst inline dupliziert.
// Schwelle 1.5 bewusst höher als die 1.4-Schwelle im Fortschritt-Tab — der
// Coach soll nur bei deutlichem Ungleichgewicht warnen, nicht bei leichter
// Schieflage (die dortige Anzeige bleibt informativ, ohne Handlungsdruck).
// Strukturell — seit Sprint "Coach-Tab Architektur" NICHT mehr Teil der
// akuten Kaskade (dort praktisch nie sichtbar, da Progression fast immer
// vorher zutrifft), sondern in computeStructuralSignals() unten.
function _checkPushPullBalance(state) {
  const customCatMap = buildCategoryMap(state.customExercises);

  const horizont = state.settings?.erkenntnisseHorizont ?? 8;
  const lastN = _sortedWeeks(state)
    .filter(w => w.mode !== 'deload')
    .slice(-horizont);
  if (lastN.length < 4) return null; // zu wenig Historie -> nicht auswertbar

  let pushSets = 0, pullSets = 0;
  for (const wk of lastN) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.archived) continue;
        const baseName = ex.substituteFor ?? ex.name;
        const cat = resolveCategory(baseName, customCatMap);
        // B22/B32-Konvention: success+fail zählen (pending ausgeschlossen),
        // identisch zur ui.js-Zwillingsfunktion _renderMovementPattern().
        const n = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').length;
        if (cat === 'Push') pushSets += n;
        else if (cat === 'Pull') pullSets += n;
      }
    }
  }
  if (pushSets === 0 || pullSets === 0) return null; // keine Daten für eine Seite

  const ratio = Math.round(Math.max(pushSets, pullSets) / Math.min(pushSets, pullSets) * 10) / 10;
  if (ratio <= 1.5) return null;

  const dominant = pushSets >= pullSets ? 'Push' : 'Pull';
  return {
    status: 'pushPullImbalance',
    headline: 'Muskuläres Gleichgewicht',
    reasoning: `Verhältnis der letzten ${lastN.length} Wochen: ${pushSets} Push-Sätze zu ${pullSets} Pull-Sätze — ${ratio.toFixed(1)}:1, deutlich ${dominant}-lastig.`,
    recommendation: dominant === 'Push'
      ? 'Dein Training ist deutlich Push-lastig — mehr Pull-Übungen schützen langfristig deine Schultern.'
      : 'Dein Training ist deutlich Pull-lastig — mehr Push-Übungen für Balance.',
    // Zusätzlich zur Prosa offengelegt (bereits oben berechnet, keine neue
    // Logik) — für die Strukturkarte in ui.js, die den Kurztext ohne Parsen
    // von reasoning/recommendation auswählen muss.
    dominant,
  };
}

// ─── Fallback: Auf Kurs ─────────────────────────────────────────────────────

function _fallback(state) {
  // Nur Wochen mit echten bewerteten Sätzen zählen — leere, von
  // _checkAndAutoCreateWeek() bei jedem App-Boot ohne Training angehängte
  // Auto-Wochen (nur 'pending'-Sätze) und Onboarding-Seed-Wochen dürfen die
  // Früh-Phase-Erkennung nicht verwässern. Eine Seed-Woche zählt wie eine
  // halbe echte Woche (Startwerte-Baseline vorhanden) — daher der +1-Bonus.
  const hasSeed = state.weeks.some(w => w.isSeedWeek);
  const _realWeeks = state.weeks.filter(w => !w.isSeedWeek &&
    w.days.some(d => d.exercises.some(ex => ex.sets.some(s =>
      s.status === 'success' || s.status === 'fail'
    )))
  );
  if (_realWeeks.length + (hasSeed ? 1 : 0) <= 1) {
    const seedNote = hasSeed
      ? ' Erste Analyse auf Basis deiner Startwerte möglich ab nächster Woche.'
      : '';
    return {
      status: 'onTrack',
      headline: 'Auf Kurs',
      reasoning: `Du baust gerade deine Datenbasis auf. Ab Woche 2 kann TRAIN konkrete Empfehlungen geben.${seedNote}`,
      recommendation: null,
    };
  }
  const variants = [
    'Keine besonderen Auffälligkeiten diese Woche. Trainiere wie geplant weiter.',
    'Alles im grünen Bereich — mach weiter wie bisher.',
  ];
  const reasoning = variants[state.weeks.length % variants.length];
  return { status: 'onTrack', headline: 'Auf Kurs', reasoning, recommendation: null };
}

/**
 * Akute Kaskade — EIN priorisiertes Signal, erstes zutreffendes gewinnt.
 * Plateau steht bewusst VOR Pre-Plateau (Fix Problem 2): ein bestätigtes
 * Plateau (3+ Wochen Stagnation, ≥80% Erfolgsquote) ist ein stärkerer/
 * sichererer Befund als eine bloße Antizipation (RPE-Kosten steigen,
 * Plateau noch nicht eingetreten) einer anderen Übung — der stärkere Befund
 * hat Vorrang, auch wenn beide für unterschiedliche Übungen gleichzeitig
 * zuträfen.
 *
 * @param {Object} state
 * @returns {{ status: string, headline: string, reasoning: string,
 *             recommendation: string|null, plateau?: Object }}
 */
export function computeWeeklyFocus(state) {
  return _checkReentry(state)
    ?? _checkPersistentFailure(state)
    ?? _checkOverload(state)
    ?? _checkPlateau(state)
    ?? _checkPrePlateau(state)
    ?? _checkConsistencyGap(state)
    ?? _checkProgression(state)
    ?? _fallback(state);
}

// ─── Prio 2 (akute Kaskade): Konsistente Fehlschläge ────────────────────────
// Gefunden bei Edge-Case-Audit v159 (B25, TRAIN_Test_EdgeCase_AllesFail_
// GuterSchlaf.v1.json): ohne diesen Check fällt eine Übung, bei der über
// mehrere Wochen kein einziger Satz gelingt, durch JEDE andere Signal-
// Funktion durch (die alle auf status==='success' aufbauen, um Gewicht/
// Trend zu berechnen) bis zum Fallback "Auf Kurs" — obwohl konsequentes
// Totalversagen der eindeutigste denkbare Hinweis auf ein zu hohes Gewicht
// ist. Steht bewusst VOR _checkOverload: bereits eingetretenes
// Totalversagen ist dringlicher als ein nur drohendes Überlastungssignal
// (Schlaf/RPE-Trend/sinkende Erfolgsquote — die setzen alle noch teilweise
// erfolgreiche Sätze voraus, um überhaupt einen Trend zu berechnen).
//
// Schwelle (0% Erfolg, 3 Wochen) bewusst konservativ gewählt, um den
// gefundenen Bug direkt abzudecken, ohne bei gelegentlichen Fehlschlägen
// überzureagieren — analog zum 3-Wochen-Mindestfenster von _checkPlateau.
function _checkPersistentFailure(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);
  const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];

  for (const name of exNames) {
    let succ = 0, fail = 0, weeksAttempted = 0, lastFailWeight = null;
    for (const wk of last3) {
      let wkEvaluated = 0;
      for (const d of wk.days) for (const ex of d.exercises) if (ex.name === name) {
        for (const s of ex.sets) {
          if (s.status === 'success') { succ++; wkEvaluated++; }
          else if (s.status === 'fail') {
            fail++; wkEvaluated++;
            if ((s.weight ?? 0) > 0) lastFailWeight = s.weight;
          }
        }
      }
      if (wkEvaluated > 0) weeksAttempted++;
    }
    // Muss in allen 3 Wochen tatsächlich versucht + bewertet worden sein —
    // eine ausgelassene Woche soll nicht fälschlich mitzählen.
    if (weeksAttempted < 3) continue;
    if (succ === 0 && fail >= 3) {
      const plateStep    = state.settings?.plateStep ?? 2.5;
      const deloadFactor = state.settings?.deloadFactor ?? 0.75;
      const suggestedWeight = lastFailWeight != null
        ? roundToPlate(lastFailWeight * deloadFactor, plateStep)
        : null;
      return {
        status: 'persistent_failure',
        headline: 'Gewicht zu hoch',
        reasoning: `Du hast bei ${name} in den letzten 3 Wochen keinen Satz erfolgreich abgeschlossen.`,
        recommendation: suggestedWeight != null
          ? `Gewicht bei ${name} auf ~${suggestedWeight} kg reduzieren`
          : `Gewicht bei ${name} reduzieren`,
        exerciseName: name,
        // B26: currentWeight + suggestedWeight direkt mitgeben, damit
        // buildDecisionalBalance()/ui.js sie nicht redundant neu berechnen
        // müssen — beide sind bereits hier vorhanden.
        currentWeight: lastFailWeight,
        suggestedWeight,
      };
    }
  }
  return null;
}

// ─── Strukturelle Signale ────────────────────────────────────────────────────
// Gegenstück zu computeWeeklyFocus(): kein "erstes Signal gewinnt", sondern
// ALLE zutreffenden strukturellen Signale gleichzeitig (0-N), da sie keine
// wöchentliche Entscheidung erzwingen und sich nicht gegenseitig ausschließen
// (Fix Problem 1/4 — vorher standen Präventiver Deload/ConsistencyQuality/
// PushPullBalance in derselben ??-Kette wie die akuten Signale und wurden
// dadurch systematisch verdrängt, PushPullBalance praktisch nie sichtbar).
// Priorität A > B > C nur für die Max.-2-Begrenzung relevant, nicht für
// gegenseitigen Ausschluss.

// ─── Mehr-Übungen-Aggregation (Design mit Nutzer besprochen) ────────────────
// Ergänzt _checkPersistentFailure() (akut, EINE Übung bei 0% über 3 Wochen):
// erkennt das Gegenstück — verteiltes Scheitern über MEHRERE Übungen, bei dem
// keine einzelne Übung die 0%-Schwelle erreicht, die Gesamterfolgsquote aber
// trotzdem alarmierend niedrig ist. War als "bekannte Grenze" in DECISIONS.md
// dokumentiert (_checkPersistentFailure prüft nur einzelne Übungen). Bewusst
// STRUKTURELL statt akut: ein andauerndes, breites Muster über viele Übungen
// ist kein einzelnes akutes Ereignis wie eine durchgehend scheiternde Übung,
// erzwingt daher keine Stay/Change-Entscheidung — reiner Informationstext
// wie die anderen 3 strukturellen Signale (kein Aktions-Button, siehe
// buildDecisionalBalance()-Docstring unten).
// Schwelle bewusst weicher als der Einzelübungs-Check (≤20% statt 0%) — sonst
// würde sich Scheitern realistisch über zu viele Übungen verteilen, um die
// Schwelle je zu erreichen. Mindestens 2 UNTERSCHIEDLICHE betroffene Übungen
// nötig, sonst ist es exakt der Fall, den _checkPersistentFailure bereits
// abdeckt (keine doppelte Meldung derselben einen Übung in zwei Karten).
function _checkMultiExerciseFailure(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);

  let succ = 0, fail = 0;
  const perExercise = new Map();
  for (const wk of last3) {
    for (const d of wk.days) for (const ex of d.exercises) {
      let entry = perExercise.get(ex.name);
      if (!entry) { entry = { succ: 0, fail: 0, lastFailWeight: null }; perExercise.set(ex.name, entry); }
      for (const s of ex.sets) {
        if (s.status === 'success') { succ++; entry.succ++; }
        else if (s.status === 'fail') {
          fail++; entry.fail++;
          if ((s.weight ?? 0) > 0) entry.lastFailWeight = s.weight;
        }
      }
    }
  }

  // Mindest-Stichprobe nötig, sonst würde z.B. 1 Satz/Woche über 3 Wochen
  // einen False Positive erzeugen — grober Richtwert: mind. 5 bewertete
  // Sätze/Woche im Schnitt (entspricht einem sehr leichten Trainingsminimum).
  const totalEvaluated = succ + fail;
  if (totalEvaluated < 15) return null;

  const rate = succ / totalEvaluated;
  if (rate > 0.20) return null;

  const plateStep    = state.settings?.plateStep ?? 2.5;
  const deloadFactor = state.settings?.deloadFactor ?? 0.75;

  const affected = [...perExercise.entries()]
    .filter(([, v]) => (v.succ + v.fail) >= 2 && v.fail > 0)
    .map(([name, v]) => ({
      name,
      rate: v.succ / (v.succ + v.fail),
      suggestedWeight: v.lastFailWeight != null ? roundToPlate(v.lastFailWeight * deloadFactor, plateStep) : null,
    }));

  if (affected.length < 2) return null;

  const worst = affected.sort((a, b) => a.rate - b.rate).slice(0, 3);

  return { rate: Math.round(rate * 100), totalEvaluated, worst };
}

/**
 * @param {Object} state
 * @returns {Array<Object>} 0-2 strukturelle Signale, höchstens 2 gleichzeitig
 *   (Priorität Mehr-Übungen-Aggregation > Präventiver Deload >
 *   Konsistenz-Qualität > Push/Pull bei Überzahl — die Aggregation steht
 *   zuoberst, da ein datenbasierter breiter Totalausfall der konkreteste
 *   Befund unter den strukturellen Signalen ist, analog zur Top-Priorität von
 *   _checkPersistentFailure in der akuten Kaskade). Jedes Objekt trägt ein
 *   `type`-Feld ('multi_exercise_failure'|'deload_preventive'|
 *   'consistency_quality'|'push_pull') als Diskriminator fürs Rendering in
 *   ui.js, zusätzlich zu den jeweiligen Rohdaten (weeksSince/dominant/etc.)
 *   für die dortigen Kurztexte.
 */
export function computeStructuralSignals(state) {
  const signals = [];

  const multiFail = _checkMultiExerciseFailure(state);
  if (multiFail) signals.push({ type: 'multi_exercise_failure', ...multiFail });

  const deload = _checkPreventiveDeload(state);
  if (deload) signals.push({ type: 'deload_preventive', ...deload });

  const cq = _checkConsistencyQuality(state);
  if (cq) signals.push({ type: 'consistency_quality', ...cq });

  const pp = _checkPushPullBalance(state);
  if (pp) signals.push({ type: 'push_pull', ...pp });

  return signals.slice(0, 2);
}

// ─── Decisional Balance ─────────────────────────────────────────────────────
// Nur für Überlastung/Konsistenz-Engpass/Plateau (siehe Sprint-Spec: bei
// Wiedereinstieg ist die Lage eindeutig, Progression hat keine echte
// Gegenoption). Nutzt ausschließlich bereits in computeWeeklyFocus()
// berechnete, echte Werte — keine neue Berechnungslogik, reine
// Text-Strukturierung der vorhandenen Daten für die Gegenüberstellung.

const _OVERLOAD_SIGNAL_LABEL = {
  sleep: 'Schlafdefizit',
  rpe: 'RPE-Trend',
  completion: 'sinkender Erfolgsquote',
};
const _OVERLOAD_SIGNAL_VALUE_LABEL = {
  sleep: 'dein Schlaf',
  rpe: 'der RPE-Trend',
  completion: 'deine Erfolgsquote',
};

function _balanceForOverload(focus) {
  const signalLabel = _OVERLOAD_SIGNAL_LABEL[focus.signalType] ?? 'anhaltender Überlastung';
  const valueLabel  = _OVERLOAD_SIGNAL_VALUE_LABEL[focus.signalType] ?? 'das Signal';
  return {
    stayOption: {
      label: 'Weiter wie bisher trainieren',
      pros: ['Plan bleibt eingehalten'],
      cons: [`Verletzungsrisiko steigt bei anhaltendem ${signalLabel}`],
    },
    changeOption: {
      label: 'Diese Woche konservativer trainieren',
      pros: ['Regeneration bekommt Vorrang'],
      cons: ['Geplante Steigerung verschiebt sich'],
    },
    closing: `Die Daten sprechen für die zweite Option, solange sich ${valueLabel} nicht verbessert.`,
  };
}

function _balanceForConsistencyGap(focus) {
  return {
    stayOption: {
      label: 'Pensum/Intensität trotzdem erhöhen',
      pros: ['Schnellerer potenzieller Fortschritt'],
      cons: ['Bringt wenig, wenn Trainingstage ohnehin ausfallen'],
    },
    changeOption: {
      label: 'Erst Konsistenz stabilisieren',
      pros: ['Realistischere Grundlage für nachhaltigen Fortschritt'],
      cons: ['Fühlt sich kurzfristig "langsamer" an'],
    },
    closing: `Bei ${focus.avgPct}% absolvierten Trainingstagen über die letzten 6 Wochen bringt mehr Pensum aktuell wenig.`,
  };
}

// B26: persistent_failure bekommt — anders als Plateau — eine generische
// Decisional Balance statt einer eigenen Buttons-Familie, weil hier (im
// Unterschied zu Plateau) keine mehrdeutige Strategie-Wahl (deload/volume/
// variation) existiert, sondern nur ein einziger klarer Hebel (Gewicht
// runter) — das passt exakt in das bestehende stay/change-Muster.
function _balanceForPersistentFailure(focus) {
  return {
    stayOption: {
      label: 'Weiter wie bisher versuchen',
      pros: ['Plan bleibt eingehalten'],
      cons: [`Wiederholtes Scheitern bei ${focus.exerciseName} bleibt bestehen`],
    },
    changeOption: {
      label: 'Gewicht reduzieren (Empfehlung)',
      pros: ['Realistische Basis für neuen Fortschritt'],
      cons: ['Kurzfristig weniger Gewicht bewegt'],
    },
    closing: `Nach 3 Wochen komplettem Fehlschlag bei ${focus.exerciseName} spricht die Datenlage für eine Reduktion, nicht für "Augen zu und durch".`,
  };
}

/**
 * @param {Object} focus  Rückgabe von computeWeeklyFocus() — NICHT für Einträge
 *   aus computeStructuralSignals() gedacht (die haben in ui.js keine Decisional
 *   Balance, kein "Warum?", keinen Aktions-Button, siehe Strukturkarte).
 * @returns {{ stayOption: Object, changeOption: Object, closing: string } | null}
 *   null für reentry/plateau/progression/onTrack — keine Decisional Balance
 *   dafür. Plateau hat mit "✓ Habe ich umgesetzt"/"Ignorieren" (plateauActions)
 *   bereits ein eigenes, nicht-redundantes Entscheidungs-Paar (Sprint: Plateau-
 *   Buttons konsolidieren). persistent_failure (seit B26) hat KEINE eigene
 *   Buttons-Familie wie Plateau — nutzt bewusst die generische Balance.
 */
export function buildDecisionalBalance(focus) {
  if (focus.status === 'overload') return _balanceForOverload(focus);
  if (focus.status === 'consistencyGap') return _balanceForConsistencyGap(focus);
  if (focus.status === 'persistent_failure') return _balanceForPersistentFailure(focus);
  return null;
}
