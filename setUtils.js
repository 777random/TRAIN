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

/**
 * Erfolgsquote einer Woche: success / (success + fail), pending
 * ausgeschlossen, archivierte Übungen ausgeschlossen. Misst Anwesenheit/
 * Zuverlässigkeit ("hat den Satz bewertet"), NICHT Zielerreichung — siehe
 * isFullSuccess() oben für den strengeren Maßstab. Einzige Quelle dieser
 * Formel — vorher unabhängig dupliziert in ui.js (_weekSuccessScore) und
 * weekReview.js (_calcSuccessScore), beide filterten archivierte Übungen
 * unterschiedlich (ui.js schloss sie aus, weekReview.js nicht) — bei der
 * Geräte-Verifikation von B38 entdeckt (2026-07-14), siehe BUGS.md.
 *
 * @param {Object} week
 * @returns {{ succ: number, fail: number, total: number, pct: number }}
 */
export function weekSuccessCounts(week) {
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
