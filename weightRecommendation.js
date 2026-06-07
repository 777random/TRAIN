/**
 * weightRecommendation.js – RPE- und Erfolgsquoten-basierte Gewichtsempfehlung.
 *
 * Pure function, keine Seiteneffekte, keine Importe.
 */

/**
 * Berechnet eine Gewichtsempfehlung für eine Übung basierend auf den letzten
 * nicht-Deload-Wochen.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks  – Wochen-Array (nur Nicht-Deload-Wochen übergeben)
 * @returns {{ recommendedWeight: number, reason: string, delta: number, lastWeight: number } | null}
 */
export function getWeightRecommendation(exerciseName, weeks) {
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

  if (successRate < 0.5) {
    delta  = 0;
    reason = 'Viele fehlgeschlagene Sätze — Technik oder Volumen prüfen';
  } else if (avgRpe !== null && avgRpe >= 9) {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Gewicht halten';
  } else if (successRate < 0.7) {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Gewicht halten';
  } else if (avgRpe !== null && avgRpe <= 7 && successRate >= 0.9) {
    delta  = 2.5;
    reason = 'RPE war niedrig, Steigerung möglich';
  } else if (avgRpe !== null && avgRpe >= 7.5 && avgRpe <= 8.5 && successRate >= 0.8) {
    delta  = 1.25;
    reason = 'Gute Form, kleine Steigerung';
  } else if (avgRpe === null && successRate >= 0.9) {
    delta  = 2.5;
    reason = 'Hohe Erfolgsquote, Steigerung möglich';
  } else if (avgRpe === null && successRate >= 0.8) {
    delta  = 1.25;
    reason = 'Gute Erfolgsquote, kleine Steigerung';
  } else {
    delta  = 0;
    reason = 'Letzte Einheit war intensiv, Gewicht halten';
  }

  return {
    recommendedWeight: Math.round((lastWeight + delta) * 100) / 100,
    reason,
    delta,
    lastWeight,
  };
}
