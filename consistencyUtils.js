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
 * Logik unverändert gegenüber der vorherigen weeklyFocus.js-Version — bis
 * auf den future-Tage-Fix in _weekConsistencyRatio() (siehe dort).
 */

import { isTrainingDay, _dayEvalCounts } from './state.js';
import { getSortedWeeks } from './insightEngine.js';

// Lokale Kopie der Tag-Index→ISO-Datum-Formel — identisch zu weekReview.js'
// _dayISODate() (dort behoben in Sprint "Fix3 + Fix4 Nachbessern", Fix 3b)
// und ui.js' _dayDate(). Bewusst dupliziert statt importiert, um diese
// Datei import-arm zu halten (siehe Datei-Kopfkommentar) und keine neue
// Kreuz-Abhängigkeit einzuführen.
function _dayISODate(wk, dayIdx) {
  const d = new Date(wk.startDate + 'T12:00:00');
  d.setDate(d.getDate() + dayIdx);
  return d.toISOString().slice(0, 10);
}

/**
 * Sprint "Consistency-Ratio future-Tage-Fix": zukünftige (noch nicht
 * fällige) Tage zählen nicht mehr im Nenner mit — identischer Bug/Fix wie
 * weekReview.js' _reachableDays() (Fix 3b): "<" statt "<=", ein heute noch
 * laufender, nicht abgeschlossener Tag zählt nicht als "fällig", ein
 * bereits erledigter (auch am heutigen Tag) hingegen schon. Ohne diesen
 * Fix zog eine laufende Woche mit z.B. 2 von 4 geplanten Tagen erledigt
 * (die anderen 2 stehen erst noch an) fälschlich nur 50% statt 100%.
 * isTrainingDay()-Filter (Urlaubstage-Ausschlussregel) bleibt unverändert
 * und wird VOR der Fälligkeits-Prüfung angewendet — der ursprüngliche
 * Array-Index (für die Datumsberechnung) bleibt dabei erhalten.
 */
export function _weekConsistencyRatio(wk) {
  // Nutzer-Feedback (2026-08-17, Coach-Tab-Audit): 'YYYY-MM-DD' aus LOKALEN
  // Datumskomponenten statt .toISOString() (UTC) -- dasselbe, im Projekt
  // bereits mehrfach gefixte Antimuster (siehe weekReview.js _localISODate()).
  const _now = new Date();
  const todayISO = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
  const due = wk.days
    .map((day, di) => ({ day, di }))
    .filter(({ day }) => isTrainingDay(day))
    .filter(({ day, di }) => day.markedDone || _dayISODate(wk, di) < todayISO);
  if (due.length === 0) return null; // reine Ruhewoche ODER noch kein Tag fällig
  const done = due.filter(({ day }) => {
    // Urlaubstage zählen nur als erledigt, wenn tatsächlich bewertete Sätze
    // vorliegen — ein nie absolvierter "leichter" Urlaubstag darf nicht
    // automatisch als 100% erledigt zählen, im Widerspruch zu
    // _weekTrainingStatus() (state.js), die für denselben Tag echte
    // Aktivität (mind. 1 bewerteter Satz) verlangt.
    if (day.isVacation) {
      return day.exercises.some(ex => ex.sets.some(s => s.status === 'success' || s.status === 'fail'));
    }
    // Runde 9 (Cluster 1): reguläre Trainingstage nutzen jetzt dieselbe
    // Anti-Gaming-Definition wie _weekTrainingStatus() (state.js) — >=50%
    // der Sätze bewertet, statt des gameable markedDone-Toggles. Vorher
    // driftete diese Datei von der Streak-Basis ab (B38 hatte das nur für
    // Urlaubstage gefixt, siehe diagnose-runde8/AUDIT-BERECHNUNGEN.md).
    const { evaluated, total } = _dayEvalCounts(day);
    return total > 0 && evaluated / total >= 0.5;
  }).length;
  return done / due.length;
}

export function _consistencyEligibleWeeks(state) {
  // Nutzer-Feedback (2026-08-17, Coach-Tab-Audit): isSeedWeek-Ausschluss
  // ergänzt -- getSortedWeeks() (insightEngine.js) selbst schließt die
  // synthetische Startwerte-Woche bewusst NICHT aus (sie wird an anderer
  // Stelle als PR-/Gewichts-Kaltstart-Baseline gebraucht), hier aber nötig:
  // die Seed-Woche hat immer genau 1 Tag mit vollständig bewerteten Sätzen
  // -> _weekConsistencyRatio() liefert dafür 100%, was den berechneten
  // Konsistenz-Durchschnitt bei wenig echter Historie künstlich anhebt
  // (_checkConsistencyGap()/computeConsistencyTrend()). Bewusst NUR hier
  // gefixt, nicht zentral in getSortedWeeks() (siehe B267-Kommentar dort),
  // um die legitime Baseline-Verwendung an anderen Stellen nicht zu brechen.
  //
  // Fortschritt-Tab-Audit (Runde 27): 'vacation' ergänzt -- vorher schloss
  // dieser Filter nur Deload aus, während die geschwisterliche Volumen-/
  // Breite-Filterung (_nonDeloadVacationWeeks(), overallPerformance.js)
  // bereits Deload UND Urlaub ausschließt. Die 4 Absätze derselben
  // "Gesamtperformance"-Karte filterten dadurch uneinheitlich.
  return getSortedWeeks(state)
    .filter(w => w.mode !== 'deload' && w.mode !== 'vacation' && !w.isSeedWeek)
    .map(wk => ({ wk, ratio: _weekConsistencyRatio(wk) }))
    .filter(r => r.ratio !== null);
}
