/**
 * weightRecommendation.js – RPE- und Erfolgsquoten-basierte Gewichtsempfehlung.
 *
 * Pure functions, keine Seiteneffekte.
 */

import { isFullSuccess } from './setUtils.js';

/** Rounds weight to the nearest plate step (e.g. 2.5 kg or 1.25 kg). */
export function roundToPlate(weight, step = 2.5) {
  step = step || 2.5;
  return Math.round(weight / step) * step;
}

/**
 * Gemeinsame Entscheidungslogik für Gewichts- UND Distanz/Zeit-Empfehlungen
 * (B18/Meter-Wdh-Progressionstyp). Extrahiert aus der ursprünglichen
 * getWeightRecommendation(), damit getMetricRecommendation() (Distanz/Zeit
 * für metric 'm'/'sec') dieselbe RPE-/Erfolgsquoten-Kaskade nutzt, statt sie
 * zu duplizieren — der Entscheidungsbaum selbst ist komplett metrik-
 * unabhängig (Zahlen bleiben Zahlen, nur die Einheit ändert sich).
 *
 * @param {number} lastValue – letztes verwendetes Gewicht ODER letzte Distanz/Zeit
 * @param {Array}  weekSets  – { success, fail }[] pro Woche (bereits gefiltert)
 * @param {string} progressionMode
 * @param {number|null} targetRepsMax
 * @param {number} step – Rundungsschritt (plateStep für Gewicht, metricStep für Distanz/Zeit)
 * @param {number} fullDelta – Steigerung bei "Luft nach oben"/hoher Erfolgsquote.
 *   Bei Gewicht bewusst FEST 2.5 (unverändertes Originalverhalten, unabhängig
 *   von plateStep — plateStep rundet nur das Ergebnis, ändert nicht die
 *   Schrittgröße selbst). Bei Distanz/Zeit gibt es keine solche Konvention —
 *   dort ist der konfigurierte metricStep selbst die sinnvolle Schrittgröße.
 * @param {number} halfDelta – kleinere Steigerung bei "gute Form" (Standard: fullDelta/2)
 * @returns {{ recommendedValue: number, reason: string, reasons: Array, delta: number, lastValue: number }}
 */
function _recommendationCore(lastValue, weekSets, progressionMode, targetRepsMax, step, fullDelta, halfDelta) {
  // Ø RPE der letzten Einheit (nur success-Sätze mit rpe !== null)
  let lastIdx = weekSets.length - 1;
  while (lastIdx >= 0 && weekSets[lastIdx].success.length === 0) lastIdx--;
  const lastSets = lastIdx >= 0 ? weekSets[lastIdx].success : [];
  const rpeSets = lastSets.filter(s => s.rpe != null);
  const avgRpe  = rpeSets.length > 0
    ? rpeSets.reduce((sum, s) => sum + s.rpe, 0) / rpeSets.length
    : null;

  // Erfolgsquote über die letzten 3–4 Wochen (success / (success + fail))
  let successes = 0, fails = 0;
  for (const w of weekSets.slice(-4)) {
    successes += w.success.length;
    fails     += w.fail.length;
  }
  const total       = successes + fails;
  const successRate = total > 0 ? successes / total : 1;

  // ── reps_only: nie Steigerung empfehlen ─────────────────────────────────
  if (progressionMode === 'reps_only') {
    return {
      recommendedValue: roundToPlate(lastValue, step),
      reason: 'Nur Wiederholungen — Wert bleibt konstant',
      reasons: [{ icon: 'ℹ', text: 'Modus "Nur Wiederholungen" — keine Steigerung empfohlen', isRpe: false }],
      delta: 0,
      lastValue,
    };
  }

  // ── double_progression: Steigerungsempfehlung erst NACH Erreichen der
  // Wdh-Obergrenze bei guter Erfolgsquote ─────────────────────────────────
  if (progressionMode === 'double_progression') {
    const recentWithData = weekSets.filter(w => w.success.length + w.fail.length > 0).slice(-3);
    const recentReps     = recentWithData.flatMap(w => [...w.success, ...w.fail].map(s => s.reps ?? 0));
    const avgReps        = recentReps.length > 0 ? recentReps.reduce((a, b) => a + b, 0) / recentReps.length : 0;
    const recentSucc     = recentWithData.reduce((s, w) => s + w.success.length, 0);
    const recentFail     = recentWithData.reduce((s, w) => s + w.fail.length, 0);
    const recentTotal    = recentSucc + recentFail;
    const recentRate     = recentTotal > 0 ? recentSucc / recentTotal : 0;
    const ready           = targetRepsMax && avgReps >= targetRepsMax && recentRate >= 0.8;

    if (!ready) {
      return {
        recommendedValue: roundToPlate(lastValue, step),
        reason: targetRepsMax
          ? `Noch nicht bereit: Wdh erst bei Ø ${Math.round(avgReps)} von Ziel ${targetRepsMax}`
          : 'Keine Wdh-Obergrenze gesetzt — doppelte Progression inaktiv',
        reasons: [{ icon: 'ℹ', text: targetRepsMax ? `Ø ${Math.round(avgReps)} von ${targetRepsMax} Wdh` : 'Wdh-Obergrenze fehlt', isRpe: false }],
        delta: 0,
        lastValue,
      };
    }
  }

  // Entscheidungsregeln (Priorität: schlechteste Bedingung zuerst)
  let delta = 0, reason = '';
  const reasons = [];
  const srPct = Math.round(successRate * 100);

  if (successRate < 0.5) {
    delta  = 0;
    reason = 'Viele fehlgeschlagene Sätze — Technik oder Volumen prüfen';
    reasons.push({ icon: '⚠', text: `Erfolgsquote nur ${srPct}%`, isRpe: false });
    if (avgRpe !== null) reasons.push({ icon: '⚠', text: `Ø RPE ${avgRpe.toFixed(1)}`, isRpe: true });
  } else if (avgRpe !== null && avgRpe >= 9) {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Wert halten';
    reasons.push({ icon: '⚠', text: `Ø RPE ${avgRpe.toFixed(1)} — zu intensiv`, isRpe: true });
    reasons.push({ icon: 'ℹ', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (successRate < 0.7) {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Wert halten';
    reasons.push({ icon: '⚠', text: `Erfolgsquote ${srPct}%`, isRpe: false });
    if (avgRpe !== null) reasons.push({ icon: 'ℹ', text: `Ø RPE ${avgRpe.toFixed(1)}`, isRpe: true });
  } else if (avgRpe !== null && avgRpe <= 7 && successRate >= 0.9) {
    delta  = fullDelta;
    reason = 'RPE war niedrig, Steigerung möglich';
    reasons.push({ icon: '✓', text: `Ø RPE ${avgRpe.toFixed(1)} — Luft nach oben`, isRpe: true });
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (avgRpe !== null && avgRpe >= 7.5 && avgRpe <= 8.5 && successRate >= 0.8) {
    delta  = halfDelta;
    reason = 'Gute Form, kleine Steigerung';
    reasons.push({ icon: '✓', text: `Ø RPE ${avgRpe.toFixed(1)} — gute Form`, isRpe: true });
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (avgRpe === null && successRate >= 0.9) {
    delta  = fullDelta;
    reason = 'Hohe Erfolgsquote, Steigerung möglich';
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (avgRpe === null && successRate >= 0.8) {
    delta  = halfDelta;
    reason = 'Gute Erfolgsquote, kleine Steigerung';
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Wert halten';
    if (avgRpe !== null) reasons.push({ icon: '⚠', text: `Ø RPE ${avgRpe.toFixed(1)}`, isRpe: true });
    reasons.push({ icon: '⚠', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  }

  return {
    recommendedValue: roundToPlate(lastValue + delta, step),
    reason,
    reasons,
    delta,
    lastValue,
  };
}

/**
 * Berechnet eine Gewichtsempfehlung für eine Übung basierend auf den letzten
 * nicht-Deload-Wochen.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks      – Wochen-Array (nur Nicht-Deload-Wochen übergeben)
 * @param {number} plateStep  – Rundungsschritt in kg (aus settings.plateStep)
 * @param {string} progressionMode – 'weight_first' (Standard) | 'double_progression' | 'reps_only'
 *   ANDERE ACHSE als ex.progressionType (steuert nur den manuellen Plan-Button) — nicht verwechseln.
 * @param {number|null} targetRepsMax – Wdh-Obergrenze, nur bei 'double_progression' relevant.
 * @returns {{ recommendedWeight: number, reason: string, delta: number, lastWeight: number } | null}
 */
export function getWeightRecommendation(exerciseName, weeks, plateStep = 2.5, progressionMode = 'weight_first', targetRepsMax = null) {
  if (weeks.length < 2) return null;

  // Sätze pro Woche für diese Übung sammeln (success + fail getrennt).
  // isFullSuccess() statt rohem status==='success': ein 'success'-Satz mit
  // weniger Wdh als targetReps ist ein Teilerfolg und zählt hier bewusst
  // nicht als voller Erfolg (weder success noch fail — einfach ausgeklammert).
  const weekSets = weeks.map(wk => {
    const success = [], fail = [];
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === exerciseName)
          for (const s of ex.sets) {
            if (isFullSuccess(s, ex)) success.push(s);
            else if (s.status === 'fail') fail.push(s);
          }
    return { success, fail };
  });

  // Mindestens 2 Wochen mit Daten erforderlich
  if (weekSets.filter(w => w.success.length > 0).length < 2) return null;

  // Letzte Woche mit success-Sätzen finden
  let lastIdx = weekSets.length - 1;
  while (lastIdx >= 0 && weekSets[lastIdx].success.length === 0) lastIdx--;
  if (lastIdx < 0) return null;
  const lastSets = weekSets[lastIdx].success;

  // Letztes verwendetes Gewicht = max(weight) der success-Sätze
  const lastWeight = Math.max(...lastSets.map(s => s.weight ?? 0));
  if (lastWeight <= 0) return null;

  const core = _recommendationCore(lastWeight, weekSets, progressionMode, targetRepsMax, plateStep, 2.5, 1.25);
  return {
    recommendedWeight: core.recommendedValue,
    reason: core.reason,
    reasons: core.reasons,
    delta: core.delta,
    lastWeight: core.lastValue,
  };
}

/**
 * Berechnet eine Distanz/Zeit-Empfehlung für metric:'m'/'sec'-Übungen
 * (Laufen, Rudermaschine, Plank-Halten etc.) — das Gegenstück zu
 * getWeightRecommendation() für Übungen ohne Gewichtsachse (B18).
 *
 * Nutzt dieselbe RPE-/Erfolgsquoten-Kaskade wie getWeightRecommendation(),
 * liest aber s.reps (dort: Distanz in m ODER Zeit in Sekunden, je nach
 * ex.metric) statt s.weight — bei metric 'm'/'sec' ist s.weight nie gesetzt
 * (kein Gewicht getrackt), weshalb getWeightRecommendation() für diese
 * Übungen bisher immer `null` lieferte (lastWeight<=0-Guard) und Coach
 * dafür KEINE Progressionsempfehlung zeigte.
 *
 * Gibt bewusst DIESELBEN Feldnamen zurück wie getWeightRecommendation()
 * (recommendedWeight/lastWeight statt recommendedValue/lastValue) — nicht
 * weil es sich um ein Gewicht handelt, sondern damit sämtlicher bestehender
 * Verbrauchercode in ui.js (Recovery-Boost-Neuberechnung, Empfehlungs-Chip,
 * Auto-Vorauswahl-Bestätigung) beide Funktionsergebnisse identisch behandeln
 * kann, ohne an jeder Stelle zwischen "Gewicht" und "Distanz/Zeit" zu
 * unterscheiden. Nur die Chip-Anzeige selbst (ui.js _renderRecChip) muss
 * das Metrik-Feld separat kennen, um "kg" vs. "m"/"Sek" zu beschriften.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks       – Wochen-Array (nur Nicht-Deload-Wochen übergeben)
 * @param {number} metricStep  – Rundungsschritt in m bzw. Sekunden (aus ex.metricStep)
 * @param {string} progressionMode
 * @param {number|null} targetRepsMax
 * @returns {{ recommendedWeight: number, reason: string, delta: number, lastWeight: number } | null}
 */
export function getMetricRecommendation(exerciseName, weeks, metricStep = 10, progressionMode = 'weight_first', targetRepsMax = null) {
  if (weeks.length < 2) return null;

  const weekSets = weeks.map(wk => {
    const success = [], fail = [];
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === exerciseName)
          for (const s of ex.sets) {
            if (isFullSuccess(s, ex)) success.push(s);
            else if (s.status === 'fail') fail.push(s);
          }
    return { success, fail };
  });

  if (weekSets.filter(w => w.success.length > 0).length < 2) return null;

  let lastIdx = weekSets.length - 1;
  while (lastIdx >= 0 && weekSets[lastIdx].success.length === 0) lastIdx--;
  if (lastIdx < 0) return null;
  const lastSets = weekSets[lastIdx].success;

  // Letzter erreichter Wert = max(reps) der success-Sätze — reps trägt bei
  // metric 'm'/'sec' die Distanz/Zeit, nicht eine Wiederholungszahl.
  const lastValue = Math.max(...lastSets.map(s => parseFloat(s.reps) || 0));
  if (lastValue <= 0) return null;

  const core = _recommendationCore(lastValue, weekSets, progressionMode, targetRepsMax, metricStep, metricStep, metricStep / 2);
  return {
    recommendedWeight: core.recommendedValue,
    reason: core.reason,
    reasons: core.reasons,
    delta: core.delta,
    lastWeight: core.lastValue,
  };
}

/**
 * Prüft, ob eine Übung automatisch für die Steigerung vorausgewählt werden
 * soll: in den letzten 2-3 Nicht-Deload/Nicht-Urlaub-Wochen mit Daten für
 * diese Übung durchgehend 100% Erfolgsquote (keine fail-Sätze) und eine
 * Ø RPE über diese Wochen von höchstens 8. Dieser Wert (8.0, nicht 8.5) ist
 * die maßgebliche Progressionsbereitschafts-Schwelle im gesamten Projekt —
 * die separate Konfidenz-Einstufung in weeklyFocus.js (HIGH/MEDIUM/LOW) hat
 * eigene, bewusst andere RPE-Schwellen (7.5/8.5) für eine andere Frage
 * ("wie sicher ist die Empfehlung", nicht "ist die Übung bereit") — keine
 * Vereinheitlichung nötig, keine Duplikat-Drift.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks – bereits auf Nicht-Deload/Nicht-Urlaub gefilterte Wochen
 * @param {string} progressionMode – 'weight_first' (Standard) | 'double_progression' | 'reps_only'
 * @param {number|null} targetRepsMax – nur bei 'double_progression' relevant
 * @returns {boolean}
 */
export function isReadyForAutoSelect(exerciseName, weeks, progressionMode = 'weight_first', targetRepsMax = null) {
  // reps_only empfiehlt nie eine Gewichtssteigerung — also auch nie Auto-Vorauswahl.
  if (progressionMode === 'reps_only') return false;

  const weeksWithData = [];
  for (const wk of weeks) {
    const success = [], fail = [];
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === exerciseName) {
          const targetReps = parseFloat(ex.targetReps) || 0;
          for (const s of ex.sets) {
            if (s.status === 'success') {
              // Defensiv: ein als 'success' markierter Satz zählt hier nur
              // als echter Erfolg, wenn die Wdh das targetReps der Übung
              // erreichen — fängt bereits fehlerhaft markierte Altdaten ab,
              // ohne dass eine Migration nötig ist (siehe SET_TOGGLE_DONE-Fix).
              const reps = parseFloat(s.reps) || 0;
              if (targetReps > 0 && reps < targetReps) fail.push(s);
              else success.push(s);
            }
            else if (s.status === 'fail') fail.push(s);
          }
        }
    if (success.length + fail.length > 0) weeksWithData.push({ success, fail });
  }

  const lastWeeks = weeksWithData.slice(-3);
  if (lastWeeks.length < 2) return false;

  // double_progression: zusätzlich zur normalen Perfekt-Prüfung unten muss
  // die Wdh-Obergrenze erreicht sein — strengerer Maßstab als die reine
  // 80%-Schwelle in getWeightRecommendation(), bewusst, da Auto-Vorauswahl
  // ohne Rückfrage greift.
  if (progressionMode === 'double_progression') {
    if (!targetRepsMax) return false;
    const recentReps = lastWeeks.flatMap(w => [...w.success, ...w.fail].map(s => s.reps ?? 0));
    const avgReps     = recentReps.length > 0 ? recentReps.reduce((a, b) => a + b, 0) / recentReps.length : 0;
    if (avgReps < targetRepsMax) return false;
  }

  const allPerfect = lastWeeks.every(w => w.fail.length === 0 && w.success.length > 0);
  if (!allPerfect) return false;

  const rpeValues = lastWeeks.flatMap(w => w.success.filter(s => s.rpe != null).map(s => s.rpe));
  if (rpeValues.length === 0) return true;
  const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
  return avgRpe <= 8;
}
