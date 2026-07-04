/**
 * setUtils.js – Shared set-evaluation helper for the Coach's pure
 * calculation modules (plateauDetector.js, weightRecommendation.js).
 *
 * Pure function, keine Seiteneffekte, keine Importe.
 */

/**
 * True only for a "full success": status === 'success' AND (kein targetReps
 * definiert, oder reps >= targetReps). Ein 'success'-Satz mit weniger Wdh
 * als das targetReps der Übung ist ein Teilerfolg — zählt hier bewusst NICHT
 * als voller Erfolg, damit Plateau-Erkennung und Gewichtsempfehlung densel-
 * ben strengen Maßstab anlegen wie isReadyForAutoSelect() (dort bereits so
 * umgesetzt, siehe weightRecommendation.js).
 *
 * @param {Object} s  Ein Satz-Objekt ({ status, reps, ... })
 * @param {Object} ex Die zugehörige Übung ({ targetReps, ... })
 * @returns {boolean}
 */
export function isFullSuccess(s, ex) {
  if (s.status !== 'success') return false;
  const target = parseFloat(ex.targetReps);
  // Kein targetReps definiert → status='success' reicht (kein Teilerfolg möglich)
  if (!target || target <= 0) return true;
  return (parseFloat(s.reps) || 0) >= target;
}
