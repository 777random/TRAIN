/**
 * weeklyFocus.js – "Fokus der Woche"-Karte: verdichtet mehrere bestehende
 * Signale (Wiedereinstieg, Überlastung, Konsistenz, Plateau, Progression) zu
 * EINER priorisierten Aussage. Pure Funktionen, keine Seiteneffekte.
 *
 * Priorität (erstes zutreffendes Signal gewinnt):
 *   1. Wiedereinstieg   – state.lastReentryHandled (bestehend, 1:1 wiederverwendet)
 *   2. Überlastung       – Schlaf / RPE-Trend / Erfolgsquote (neue, aber an
 *                          S-02/S-04 angelehnte Schwellenwerte – keine Duplizierung
 *                          von insightEngine.js, eigenständige Implementierung)
 *   3. Konsistenz-Engpass – Anteil absolvierter Trainingstage über 6 Wochen,
 *                          nutzt state.js' isTrainingDay() für die Urlaubstage-
 *                          Ausschlussregel (einzige Quelle, nicht dupliziert)
 *   4. Plateau           – detectPlateaus() aus plateauDetector.js, 1:1 wiederverwendet
 *   5. Progression       – isReadyForAutoSelect()/getWeightRecommendation() aus
 *                          weightRecommendation.js, 1:1 wiederverwendet
 *   Fallback: "Auf Kurs"
 */

import { getLatestWeek, isTrainingDay } from './state.js';
import { detectPlateaus } from './plateauDetector.js';
import { getWeightRecommendation, isReadyForAutoSelect } from './weightRecommendation.js';

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

// ─── Prio 1: Wiedereinstieg ─────────────────────────────────────────────────
// Extrahiert aus ui.js (vormals private _isInRecoveryWindow) — identische
// Logik, einzige Implementierung. ui.js importiert diese Funktion jetzt
// statt eine eigene Kopie zu pflegen (siehe ui.js-Diff: keine Verhaltens-
// änderung, nur Verschiebung).
export function isInRecoveryWindow(state) {
  if (!state.lastReentryHandled) return false;
  const startMs = state.lastReentryHandled;
  const endMs   = startMs + 14 * DAY_MS;
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
  if (daysSince < 0 || daysSince >= 14) return null;
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

function _buildOverloadResult(signal, energySignal = null) {
  const hasLowEnergy = energySignal != null;
  let reasoning;
  if (signal.signal === 'sleep') {
    if (hasLowEnergy) {
      reasoning = `Sowohl Schlaf (Ø ${signal.value.toFixed(1)}h) als auch Energielevel (Ø ${energySignal.value.toFixed(1)}/5) deuten diese Woche auf Erholungsbedarf hin.`;
    } else {
      reasoning = signal.value < 6
        ? `Die Daten zeigen: dein Schlaf liegt im Schnitt nur bei ${signal.value.toFixed(1)}h diese Woche — deutlich unter den empfohlenen 7h.`
        : `Die Daten zeigen: dein Schlaf liegt im Schnitt bei ${signal.value.toFixed(1)}h diese Woche — etwas unter den empfohlenen 7h.`;
    }
  } else if (signal.signal === 'rpe') {
    reasoning = `${signal.exerciseName}: die Anstrengung (RPE) steigt seit 3 Wochen bei gleichem Gewicht — ${signal.values.map(v => v.toFixed(1)).join(' → ')}.`;
    if (hasLowEnergy) reasoning += ` Dein durchschnittliches Energielevel lag diese Woche bei ${energySignal.value.toFixed(1)}/5.`;
  } else {
    reasoning = `Deine Erfolgsquote ist von ${Math.round(signal.avg8 * 100)}% auf ${Math.round(signal.avg3 * 100)}% gesunken.`;
    if (hasLowEnergy) reasoning += ` Dein durchschnittliches Energielevel lag diese Woche bei ${energySignal.value.toFixed(1)}/5.`;
  }
  return {
    status: 'overload',
    headline: 'Erholung priorisieren',
    reasoning,
    recommendation: 'Diese Woche keine Gewichtssteigerungen.',
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

// ─── Prio 3: Pre-Plateau-Antizipation ───────────────────────────────────────
// Feuert wenn RPE-Kosten pro kg steigen, obwohl das Gewicht noch leicht
// zunimmt — erkennt die Erschöpfungszone BEVOR die Steigerung stoppt.
// Abgrenzung zu _checkRisingRpe (Prio 2): dort ist Gewicht identisch (Plateau
// bereits eingetreten); hier steigt Gewicht noch, aber der Preis pro kg auch.

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

    return {
      status: 'pre_plateau',
      headline: 'Steigerung wird teurer',
      reasoning: `${name} kostet pro kg mehr Aufwand als vor 3 Wochen — ein Plateau deutet sich an.`,
      recommendation: 'Jetzt Strategie überdenken: Wdh erhöhen statt Gewicht, oder Deload einplanen bevor die Steigerung stoppt.',
    };
  }
  return null;
}

// ─── Prio 4: Konsistenz-Engpass ─────────────────────────────────────────────
// Anteil absolvierter Trainingstage pro Woche — Urlaubstage-Ausschlussregel
// kommt aus state.js' isTrainingDay() (einzige Quelle, siehe Datei-Kopf).
// Ein verbleibender Urlaubstag (isVacation, aber mit Training) zählt als
// erledigt.

// Exportiert für overallPerformance.js (Konsistenz-Dimension der
// Gesamtperformance-Sektion) — Logik unverändert, nur zusätzlich von
// außerhalb dieser Datei aufrufbar. Der Engpass-Check unten
// (_checkConsistencyGap, eigenes 6-Wochen-Fenster + eigene Schwellenwerte)
// bleibt komplett unverändert.
export function _weekConsistencyRatio(wk) {
  const active = wk.days.filter(isTrainingDay);
  if (active.length === 0) return null; // reine Ruhewoche, nicht auswertbar
  const done = active.filter(d => d.markedDone || d.isVacation).length;
  return done / active.length;
}

export function _consistencyEligibleWeeks(state) {
  return _sortedWeeks(state)
    .filter(w => w.mode !== 'deload')
    .map(wk => ({ wk, ratio: _weekConsistencyRatio(wk) }))
    .filter(r => r.ratio !== null);
}

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

// ─── Prio 4: Plateau ────────────────────────────────────────────────────────
// detectPlateaus() 1:1 wiederverwendet, NICHT neu implementiert.

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
  return {
    status: 'plateau',
    headline: 'Plateau überwinden',
    reasoning,
    recommendation: longest.actionText + alsoText,
    plateau: longest,
  };
}

// ─── Prio 5: Progression ────────────────────────────────────────────────────
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

  // Konfidenz: successRate + avgRpe der letzten 4 Wochen für best
  let succ = 0, fail = 0, rpeSum = 0, rpeCount = 0;
  for (const wk of calcWeeks.slice(-4))
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === best.name)
          for (const s of ex.sets) {
            if (s.status === 'success') { succ++; if (s.rpe != null) { rpeSum += s.rpe; rpeCount++; } }
            else if (s.status === 'fail') fail++;
          }
  const confTotal = succ + fail;
  const confSuccessRate = confTotal > 0 ? succ / confTotal : 1;
  const confAvgRpe = rpeCount > 0 ? rpeSum / rpeCount : null;
  const confidence = (confSuccessRate >= 0.9 && (confAvgRpe === null || confAvgRpe <= 7.5)) ? 'high'
    : (confSuccessRate >= 0.8 && (confAvgRpe === null || confAvgRpe <= 8.5))               ? 'medium'
    : 'low';

  return {
    status: 'progression',
    headline: 'Steigerung sinnvoll',
    reasoning: reasonText ? `${intro} ${reasonText} spricht aktuell dafür.${alsoReadyText}` : `${intro}${alsoReadyText}`,
    recommendation: `+${best.rec.delta}kg bei ${best.name} testen`,
    confidence,
    dataWeeks: calcWeeks.length,
  };
}

// ─── Fallback: Auf Kurs ─────────────────────────────────────────────────────

function _fallback(state) {
  const variants = [
    'Keine besonderen Auffälligkeiten diese Woche. Trainiere wie geplant weiter.',
    'Alles im grünen Bereich — mach weiter wie bisher.',
  ];
  const reasoning = variants[state.weeks.length % variants.length];
  return { status: 'onTrack', headline: 'Auf Kurs', reasoning, recommendation: null };
}

/**
 * @param {Object} state
 * @returns {{ status: string, headline: string, reasoning: string,
 *             recommendation: string|null, plateau?: Object }}
 */
export function computeWeeklyFocus(state) {
  return _checkReentry(state)
    ?? _checkOverload(state)
    ?? _checkPrePlateau(state)
    ?? _checkConsistencyGap(state)
    ?? _checkPlateau(state)
    ?? _checkProgression(state)
    ?? _fallback(state);
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

function _balanceForPlateau(focus) {
  const p = focus.plateau;
  return {
    stayOption: {
      label: 'Weiter wie bisher (gleiche Strategie/Gewicht beibehalten)',
      pros: ['Kein Wechsel nötig, gewohnte Übung bleibt'],
      cons: ['Stagnation hält wahrscheinlich an'],
    },
    changeOption: {
      label: `Strategie wechseln: ${p.actionText}`,
      pros: ['Neuer Reiz kann das Plateau durchbrechen'],
      cons: ['Kurzfristig andere Belastung als gewohnt'],
    },
    closing: `Bei ${p.plateauWeeks} Wochen ohne Steigerung spricht mehr für einen Wechsel.`,
  };
}

/**
 * @param {Object} focus  Rückgabe von computeWeeklyFocus()
 * @returns {{ stayOption: Object, changeOption: Object, closing: string } | null}
 *   null für reentry/progression/onTrack — keine Decisional Balance dafür.
 */
export function buildDecisionalBalance(focus) {
  if (focus.status === 'overload') return _balanceForOverload(focus);
  if (focus.status === 'consistencyGap') return _balanceForConsistencyGap(focus);
  if (focus.status === 'plateau') return _balanceForPlateau(focus);
  return null;
}
