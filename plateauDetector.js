/**
 * plateauDetector.js – Pure plateau detection. No DOM, no state access.
 *
 * A plateau is detected when ALL three conditions hold over the last ≥3
 * consecutive non-deload weeks that contain success sets for the exercise:
 *   1. Max success-set weight has not increased (delta ≤ 0) from first to last week.
 *   2. Average success rate across those weeks ≥ 0.8 (it's not too hard — potential exists).
 *   3. At least 3 such weeks exist.
 *
 * Deload weeks (week.mode === 'deload') are completely excluded from counting.
 */

function _exMaxWeight(wk, exName) {
  let max = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName)
        for (const s of ex.sets)
          if (s.status === 'success' && (s.weight ?? 0) > max) max = s.weight;
  return max;
}

function _exSuccessRate(wk, exName) {
  let total = 0, success = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName)
        for (const s of ex.sets) {
          total++;
          if (s.status === 'success') success++;
        }
  return total > 0 ? success / total : 0;
}

function _exAvgRpe(wk, exName) {
  const rpes = [];
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName)
        for (const s of ex.sets)
          if (s.status === 'success' && s.rpe != null)
            rpes.push(s.rpe);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

// Returns true if any day in the recent weeks has this exercise plus ≥2 others sharing a tag.
function _hasSharedMuscleGroupDay(allWeeks, exName) {
  const recent = [...allWeeks]
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
  const sortedNonDeload = [...allWeeks]
    .filter(w => w.mode !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  if (sortedNonDeload.length < 3) return [];

  const substituteNames = new Set(
    sortedNonDeload.flatMap(w =>
      w.days.flatMap(d => d.exercises.filter(ex => ex.substituteFor).map(ex => ex.name))
    )
  );

  const exNames = [...new Set(
    sortedNonDeload.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name)))
  )].filter(name => !substituteNames.has(name));

  const plateaus = [];

  for (const exName of exNames) {
    // Only weeks where this exercise has at least one success set
    const exWeeks = sortedNonDeload.filter(wk =>
      wk.days.some(d => d.exercises.some(ex =>
        ex.name === exName && ex.sets.some(s => s.status === 'success')
      ))
    );

    if (exWeeks.length < 3) continue;

    const last3 = exWeeks.slice(-3);

    // Condition 1: max weight has not increased
    const maxW0  = _exMaxWeight(last3[0], exName);
    const maxWLast = _exMaxWeight(last3[2], exName);
    if (maxWLast <= 0) continue;        // no weight logged
    if (maxWLast - maxW0 > 0) continue; // weight did increase → no plateau

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
    if ((rpeEnabled && avgRpe >= 8.5) || trainingDays >= 4) {
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
