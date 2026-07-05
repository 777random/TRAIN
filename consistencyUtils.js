/**
 * consistencyUtils.js – Wochen-Konsistenz-Ratio, gemeinsam genutzt von
 * weeklyFocus.js (Coach-Tab-Signale) und overallPerformance.js (Fortschritt-
 * Tab-Trend).
 *
 * Bis Sprint "Drei neue Coach-Signale" lebte diese Logik in weeklyFocus.js,
 * von overallPerformance.js importiert. weeklyFocus.js importiert seit
 * diesem Sprint selbst computeVolumeTrend/computeConsistencyTrend/
 * computeQualityTrend aus overallPerformance.js (Signale "Präventiver
 * Deload"/"Konsistenz-Qualität") — ein Rückimport von overallPerformance.js
 * nach weeklyFocus.js hätte einen zirkulären Import erzeugt. Extraktion in
 * diese eigene, import-arme Datei (nur state.js/insightEngine.js) löst das,
 * analog zu movementMap.js' Extraktion aus ui.js im selben Zweck.
 *
 * Logik unverändert gegenüber der vorherigen weeklyFocus.js-Version.
 */

import { isTrainingDay } from './state.js';
import { getSortedWeeks } from './insightEngine.js';

export function _weekConsistencyRatio(wk) {
  const active = wk.days.filter(isTrainingDay);
  if (active.length === 0) return null; // reine Ruhewoche, nicht auswertbar
  const done = active.filter(d => d.markedDone || d.isVacation).length;
  return done / active.length;
}

export function _consistencyEligibleWeeks(state) {
  return getSortedWeeks(state)
    .filter(w => w.mode !== 'deload')
    .map(wk => ({ wk, ratio: _weekConsistencyRatio(wk) }))
    .filter(r => r.ratio !== null);
}
