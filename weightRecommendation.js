/**
 * weightRecommendation.js – RPE- und Erfolgsquoten-basierte Gewichtsempfehlung.
 *
 * Pure function, keine Seiteneffekte, keine Importe.
 */

/** Rounds weight to the nearest plate step (e.g. 2.5 kg or 1.25 kg). */
export function roundToPlate(weight, step = 2.5) {
  return Math.round(weight / step) * step;
}

/**
 * Berechnet eine Gewichtsempfehlung für eine Übung basierend auf den letzten
 * nicht-Deload-Wochen.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks      – Wochen-Array (nur Nicht-Deload-Wochen übergeben)
 * @param {number} plateStep  – Rundungsschritt in kg (aus settings.plateStep)
 * @returns {{ recommendedWeight: number, reason: string, delta: number, lastWeight: number } | null}
 */
export function getWeightRecommendation(exerciseName, weeks, plateStep = 2.5) {
  if (weeks.length < 2) return null;

  // Sätze pro Woche für diese Übung sammeln (success + fail getrennt)
  const weekSets = weeks.map(wk => {
    const success = [], fail = [];
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === exerciseName)
          for (const s of ex.sets) {
            if (s.status === 'success') success.push(s);
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

  // Ø RPE der letzten Einheit (nur success-Sätze mit rpe !== null)
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
    reason = 'Letzte Einheit war intensiv, Gewicht halten';
    reasons.push({ icon: '⚠', text: `Ø RPE ${avgRpe.toFixed(1)} — zu intensiv`, isRpe: true });
    reasons.push({ icon: 'ℹ', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (successRate < 0.7) {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Gewicht halten';
    reasons.push({ icon: '⚠', text: `Erfolgsquote ${srPct}%`, isRpe: false });
    if (avgRpe !== null) reasons.push({ icon: 'ℹ', text: `Ø RPE ${avgRpe.toFixed(1)}`, isRpe: true });
  } else if (avgRpe !== null && avgRpe <= 7 && successRate >= 0.9) {
    delta  = 2.5;
    reason = 'RPE war niedrig, Steigerung möglich';
    reasons.push({ icon: '✓', text: `Ø RPE ${avgRpe.toFixed(1)} — Luft nach oben`, isRpe: true });
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (avgRpe !== null && avgRpe >= 7.5 && avgRpe <= 8.5 && successRate >= 0.8) {
    delta  = 1.25;
    reason = 'Gute Form, kleine Steigerung';
    reasons.push({ icon: '✓', text: `Ø RPE ${avgRpe.toFixed(1)} — gute Form`, isRpe: true });
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (avgRpe === null && successRate >= 0.9) {
    delta  = 2.5;
    reason = 'Hohe Erfolgsquote, Steigerung möglich';
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else if (avgRpe === null && successRate >= 0.8) {
    delta  = 1.25;
    reason = 'Gute Erfolgsquote, kleine Steigerung';
    reasons.push({ icon: '✓', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  } else {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Gewicht halten';
    if (avgRpe !== null) reasons.push({ icon: '⚠', text: `Ø RPE ${avgRpe.toFixed(1)}`, isRpe: true });
    reasons.push({ icon: '⚠', text: `Erfolgsquote ${srPct}%`, isRpe: false });
  }

  return {
    recommendedWeight: roundToPlate(lastWeight + delta, plateStep),
    reason,
    reasons,
    delta,
    lastWeight,
  };
}

/**
 * Prüft, ob eine Übung automatisch für die Steigerung vorausgewählt werden
 * soll: in den letzten 2-3 Nicht-Deload/Nicht-Urlaub-Wochen mit Daten für
 * diese Übung durchgehend 100% Erfolgsquote (keine fail-Sätze) und eine
 * Ø RPE über diese Wochen von höchstens 8.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks – bereits auf Nicht-Deload/Nicht-Urlaub gefilterte Wochen
 * @returns {boolean}
 */
export function isReadyForAutoSelect(exerciseName, weeks) {
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

  const allPerfect = lastWeeks.every(w => w.fail.length === 0 && w.success.length > 0);
  if (!allPerfect) return false;

  const rpeValues = lastWeeks.flatMap(w => w.success.filter(s => s.rpe != null).map(s => s.rpe));
  if (rpeValues.length === 0) return true;
  const avgRpe = rpeValues.reduce((a, b) => a + b, 0) / rpeValues.length;
  return avgRpe <= 8;
}
