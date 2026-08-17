/**
 * plateauDetector.js – Pure plateau detection. No DOM, no state access.
 *
 * A plateau is detected when ALL three conditions hold over the last ≥3
 * consecutive non-deload weeks that contain success sets for the exercise:
 *   1. Max success-set weight has not increased (delta ≤ 0) from first to last week.
 *   2. Average success rate across those weeks ≥ 0.8 (it's not too hard — potential exists).
 *   3. At least 3 such weeks exist.
 *
 * Deload/vacation weeks and the synthetic ONBOARDING_SEED "Startwerte" week
 * (week.isSeedWeek) are completely excluded from counting.
 *
 * "Success" here means isFullSuccess() (status='success' AND reps>=targetReps
 * when a target is set) — a 'success' set with fewer reps than the target is
 * a partial success and does not count, same strict standard as
 * isReadyForAutoSelect() in weightRecommendation.js.
 */

import { isFullSuccess } from './setUtils.js';

/**
 * Deload-Strategie-Weiche: EIN Wochendurchschnitt pro Übung (letzte
 * abgeschlossene Woche), ausgewertet erst NACHDEM ein Plateau bereits
 * erkannt wurde (siehe detectPlateaus oben) — entscheidet nur, OB die
 * Ursache Ermüdung ist (dann "deload") oder eher Stagnation/fehlende
 * Reizvariation (dann "variation"/"volume"). Selber Zahlenwert wie
 * sessionCoach.js' RPE_SET_HARD_ZONE, aber andere Bedeutung (1-Wochen-
 * Durchschnitt pro Übung statt Einzelsatz) und andere Verwendungsstelle
 * (Strategie-Wahl nach Plateau statt Satz-Zonen-Label) — bewusst NICHT
 * zusammengelegt, siehe diagnose-runde7-2026-08-02.txt.
 */
const RPE_PLATEAU_DELOAD_STRATEGY_1WK_AVG = 8.5;

// Utility-Schicht-Audit (Runde 29): jede der vier Helferfunktionen unten
// schließt jetzt `ex.archived` (dritte unabhängige Fundstelle derselben
// Fehlerklasse wie B272) UND `ex.substituteFor` (nur die eigentliche
// Übung, nicht ihre Rolle als "Heute anders"-Ersatz einer ANDEREN Übung
// zählt für ihre eigene Plateau-Historie) aus. Der bisherige `exNames`-
// Filter (siehe detectPlateaus() unten) blacklistete einen Übungsnamen
// dagegen KOMPLETT und DAUERHAFT, sobald er irgendwann als Substitutions-
// Ziel auftrat -- auch für alle seine eigenen, nicht-substituierten
// Wochen. Der per-Instanz-Ausschluss hier ist die korrekte Granularität.
function _exMaxWeight(wk, exName) {
  let max = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName && !ex.archived && !ex.substituteFor)
        for (const s of ex.sets)
          if (isFullSuccess(s, ex) && (s.weight ?? 0) > max) max = s.weight;
  return max;
}

function _exSuccessRate(wk, exName) {
  let total = 0, success = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName && !ex.archived && !ex.substituteFor)
        for (const s of ex.sets) {
          // Utility-Schicht-Audit (Runde 29): pending-Sätze nicht mehr im
          // Nenner gezählt -- dritte unabhängige Fundstelle derselben
          // Fehlerklasse wie B269 (weeklyFocus.js _completionRate()).
          if (s.status !== 'success' && s.status !== 'fail') continue;
          total++;
          if (isFullSuccess(s, ex)) success++;
        }
  return total > 0 ? success / total : 0;
}

// Success-set count for one week (Runde 7, C3) — Analogon zu _exMaxWeight(),
// zählt Sätze statt Gewicht. Wird als Volumen-/Satzzahl-Progressions-
// Override genutzt: steigt die Satzzahl über dasselbe 3-Wochen-Fenster, das
// bereits für den Gewichts-Check verwendet wird, gilt das als echter
// Fortschritt, auch wenn das Gewicht flach blieb.
function _exSuccessSetCount(wk, exName) {
  let count = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName && !ex.archived && !ex.substituteFor)
        for (const s of ex.sets)
          if (isFullSuccess(s, ex)) count++;
  return count;
}

// Utility-Schicht-Audit (Runde 29): isFullSuccess() statt rohem
// status==='success' -- der Datei-Kopfkommentar dokumentiert isFullSuccess()
// als einheitlichen Standard für "Erfolg" in dieser Datei, diese Funktion
// wich bisher davon ab.
function _exAvgRpe(wk, exName) {
  const rpes = [];
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName && !ex.archived && !ex.substituteFor)
        for (const s of ex.sets)
          if (isFullSuccess(s, ex) && s.rpe != null)
            rpes.push(s.rpe);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

// Returns true if any day in the recent weeks has this exercise plus ≥2 others sharing a tag.
function _hasSharedMuscleGroupDay(allWeeks, exName) {
  // Utility-Schicht-Audit (Runde 29): isSeedWeek/deload/vacation ergänzt --
  // betrifft nur die Deload-vs-Variation-vs-Volumen-Strategiewahl (nicht ob
  // überhaupt ein Plateau erkannt wird), aber die Startwerte-Woche (oft
  // mehrere Übungen an einem Tag mit überlappenden Tags) konnte die
  // Strategie fälschlich auf 'variation' statt 'volume' kippen.
  const recent = [...allWeeks]
    .filter(w => !w.isSeedWeek && w.mode !== 'deload' && w.mode !== 'vacation')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-4);
  for (const wk of recent) {
    for (const day of wk.days) {
      const targetEx = day.exercises.find(e => e.name === exName);
      if (!targetEx) continue;
      const targetTags = targetEx.tags ?? [];
      if (!targetTags.length) continue;
      const sameTagCount = day.exercises.filter(e =>
        e.name !== exName && (e.tags ?? []).some(tag => targetTags.includes(tag))
      ).length;
      if (sameTagCount >= 2) return true;
    }
  }
  return false;
}

function _buildTexts(exName, plateauWeeks, strategy) {
  const w = plateauWeeks;
  if (strategy === 'deload') {
    return {
      insightText: `${exName} stagniert seit ${w} Wochen — ein kurzer Deload kann helfen, danach wieder Fortschritte zu machen.`,
      actionText:  `Nächste Woche: 75–80% des aktuellen Gewichts.`,
    };
  }
  if (strategy === 'variation') {
    return {
      insightText: `${exName} stagniert seit ${w} Wochen. Versuch eine Woche eine Variation oder erhöhe die Wiederholungen bei weniger Gewicht (z.B. -5 kg, +3 Wdh).`,
      actionText:  `Variation versuchen: –5 kg, +3 Wdh oder ähnliche Übung.`,
    };
  }
  return {
    insightText: `${exName} stagniert seit ${w} Wochen — füge einen Satz hinzu. Mehr Volumen kann den Reiz geben, den dein Körper braucht.`,
    actionText:  `Füge einen weiteren Satz hinzu.`,
  };
}

/**
 * Detect plateau exercises across all provided weeks.
 *
 * @param {Array}  allWeeks           All weeks from state.
 * @param {Array}  [favoriteExercises=[]]  Exercise name strings.
 * @returns {Array} Up to 3 plateau objects, favorites first then longest stagnation.
 */
export function detectPlateaus(allWeeks, favoriteExercises = [], rpeEnabled = true) {
  const favs = favoriteExercises ?? [];
  // Nutzer-Feedback (2026-08-17, Coach-Tab-Audit): isSeedWeek-Ausschluss
  // ergänzt -- die synthetische Startwerte-Woche (ONBOARDING_SEED) hat
  // typischerweise nur 1 Satz pro Übung bei unverändertem Gewicht ggü. dem
  // Startwert, konnte dadurch bei Nutzern mit erst 2 echten Trainingswochen
  // fälschlich als "3. stagnierende Woche" mitzählen -- ein falsches
  // Plateau-Signal direkt zu Beginn, wenn ein Neueinsteiger es am wenigsten
  // erwartet. Beide Aufrufer (insightEngine.js, weeklyFocus.js) übergeben
  // ungefiltertes state.weeks -- zentral hier gefixt statt an jeder
  // Aufrufstelle einzeln.
  const sortedNonDeload = [...allWeeks]
    .filter(w => w.mode !== 'deload' && w.mode !== 'vacation' && !w.isSeedWeek)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (sortedNonDeload.length < 3) return [];

  // Utility-Schicht-Audit (Runde 29): die vorherige substituteNames-
  // Blacklist entfernte einen Übungsnamen KOMPLETT aus der Plateau-Prüfung,
  // sobald er irgendwann als Substitutions-ZIEL auftrat -- auch für seine
  // eigenen, nie substituierten Wochen. Der korrekte Ausschluss geschieht
  // jetzt granular pro Instanz in den _ex*()-Helferfunktionen oben
  // (ex.substituteFor) UND im exWeeks-Filter direkt unten.
  const exNames = [...new Set(
    sortedNonDeload.flatMap(w => w.days.flatMap(d => d.exercises
      .filter(ex => !ex.archived && !ex.substituteFor)
      .map(e => e.name)))
  )];

  const plateaus = [];

  for (const exName of exNames) {
    // Only weeks where this exercise has at least one success set
    const exWeeks = sortedNonDeload.filter(wk =>
      wk.days.some(d => d.exercises.some(ex =>
        ex.name === exName && !ex.archived && !ex.substituteFor && ex.sets.some(s => s.status === 'success')
      ))
    );

    if (exWeeks.length < 3) continue;

    const last3 = exWeeks.slice(-3);

    // Condition 1: max weight has not increased
    const maxW0  = _exMaxWeight(last3[0], exName);
    const maxWLast = _exMaxWeight(last3[2], exName);
    if (maxWLast <= 0) continue;        // no weight logged
    if (maxWLast - maxW0 > 0) continue; // weight did increase → no plateau

    // Volume-progression override (Runde 7, C3): Gewicht blieb flach, aber
    // die Satzzahl ist über dasselbe 3-Wochen-Fenster monoton nicht-fallend
    // um mindestens 1 gestiegen -- klassische Volumen-Progression (z.B.
    // 3->4 Sätze bei gleichem Gewicht/Wdh). Zählt als Fortschritt, kein
    // Plateau. Endpunkt-UND-Zwischenwert-Prüfung, damit eine einzelne
    // Ausreißer-Woche (z.B. ein Satz mittendrin ausgelassen) das Ergebnis
    // nicht verfälscht.
    const setCount0 = _exSuccessSetCount(last3[0], exName);
    const setCount1 = _exSuccessSetCount(last3[1], exName);
    const setCount2 = _exSuccessSetCount(last3[2], exName);
    if (setCount2 - setCount0 >= 1 && setCount1 >= setCount0 && setCount2 >= setCount1) continue;

    // Condition 2: avg success rate ≥ 0.8
    const avgSuccessRate = (
      _exSuccessRate(last3[0], exName) +
      _exSuccessRate(last3[1], exName) +
      _exSuccessRate(last3[2], exName)
    ) / 3;
    if (avgSuccessRate < 0.8) continue;

    // Count consecutive plateau weeks going further back
    let plateauWeeks = 3;
    for (let i = exWeeks.length - 4; i >= 0; i--) {
      const olderMax  = _exMaxWeight(exWeeks[i], exName);
      const olderRate = _exSuccessRate(exWeeks[i], exName);
      if (Math.abs(olderMax - maxWLast) < 0.1 && olderRate >= 0.8) plateauWeeks++;
      else break;
    }

    const mostRecentWk = last3[2];
    const avgRpeVal    = _exAvgRpe(mostRecentWk, exName);
    const avgRpe       = avgRpeVal != null ? Math.round(avgRpeVal * 10) / 10 : 0;
    const trainingDays = mostRecentWk.days.filter(d => d.markedDone).length;

    let strategy;
    if ((rpeEnabled && avgRpe >= RPE_PLATEAU_DELOAD_STRATEGY_1WK_AVG) || trainingDays >= 4) {
      strategy = 'deload';
    } else if (_hasSharedMuscleGroupDay(allWeeks, exName)) {
      strategy = 'variation';
    } else {
      strategy = 'volume';
    }

    const { insightText, actionText } = _buildTexts(exName, plateauWeeks, strategy);

    plateaus.push({
      exerciseName:   exName,
      isFavorite:     favs.includes(exName),
      plateauWeeks,
      currentWeight:  maxWLast,
      avgSuccessRate: Math.round(avgSuccessRate * 100) / 100,
      avgRpe,
      strategy,
      insightText,
      actionText,
    });
  }

  // Favorites first, then longest stagnation
  plateaus.sort((a, b) => {
    if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
    return b.plateauWeeks - a.plateauWeeks;
  });

  return plateaus.slice(0, 3);
}
