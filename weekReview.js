/**
 * weekReview.js – Pure function, kein DOM, kein State-Zugriff.
 * Berechnet strukturierten Wochenrückblick aus einer Woche + allen Wochen.
 */

function _kw(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
}

function _sumVolume(week) {
  let v = 0;
  for (const d of week.days)
    for (const ex of d.exercises)
      for (const s of ex.sets)
        if (s.status === 'success') v += (s.weight ?? 0) * (s.reps ?? 0);
  return Math.round(v);
}

function _countSuccessSets(week) {
  let n = 0;
  for (const d of week.days)
    for (const ex of d.exercises)
      for (const s of ex.sets)
        if (s.status === 'success') n++;
  return n;
}

function _maxWeightPerExercise(week) {
  const map = new Map();
  for (const d of week.days)
    for (const ex of d.exercises) {
      const successW = ex.sets
        .filter(s => s.status === 'success' && (s.weight ?? 0) > 0)
        .map(s => s.weight);
      if (!successW.length) continue;
      const maxW = Math.max(...successW);
      if (!map.has(ex.name) || map.get(ex.name) < maxW) map.set(ex.name, maxW);
    }
  return map;
}

function _findPR(week, prevWeeks) {
  const thisMax = _maxWeightPerExercise(week);
  const histMax = new Map();
  for (const wk of prevWeeks)
    _maxWeightPerExercise(wk).forEach((w, name) => {
      if (!histMax.has(name) || histMax.get(name) < w) histMax.set(name, w);
    });

  let best = null, bestDelta = 0;
  thisMax.forEach((w, name) => {
    const prev  = histMax.get(name) ?? 0;
    const delta = w - prev;
    if (delta > bestDelta) { bestDelta = delta; best = { name, weight: w, prev }; }
  });
  if (!best) return null;
  const text = best.prev > 0
    ? `${best.name} ${best.weight} kg (+${best.weight - best.prev} kg)`
    : `${best.name} ${best.weight} kg`;
  return { type: 'pr', label: 'Neuer PR', text, exName: best.name };
}

function _findBestGain(week, prevWeek) {
  const thisMax = _maxWeightPerExercise(week);
  const prevMax = _maxWeightPerExercise(prevWeek);
  let best = null, bestDelta = 0;
  thisMax.forEach((w, name) => {
    const prev  = prevMax.get(name) ?? 0;
    const delta = w - prev;
    if (prev > 0 && delta > bestDelta) { bestDelta = delta; best = { name, delta }; }
  });
  if (!best) return null;
  return { type: 'gain', label: 'Stärkste Steigerung', text: `${best.name} +${best.delta} kg ggü. Vorwoche`, exName: best.name };
}

function _calcStreak(sortedWeeks, week) {
  const idx = sortedWeeks.findIndex(w => w === week || w.startDate === week.startDate);
  if (idx < 0) return 0;
  let streak = 0;
  for (let i = idx; i >= 0; i--) {
    if (sortedWeeks[i].days.some(d => d.markedDone)) streak++;
    else break;
  }
  return streak;
}

function _findFailHighlight(week) {
  let worstName = null, worstCount = 0;
  for (const d of week.days)
    for (const ex of d.exercises) {
      const n = ex.sets.filter(s => s.status === 'fail').length;
      if (n > worstCount) { worstCount = n; worstName = ex.name; }
    }
  if (!worstName) return null;
  return {
    type: 'fails', label: 'Fehlgeschlagene Sätze',
    text: `${worstName}: ${worstCount} ${worstCount === 1 ? 'fehlgeschlagener Satz' : 'fehlgeschlagene Sätze'}`,
    exName: worstName,
  };
}

function _findFatigueHighlight(week) {
  let worst = null, worstRpe = 0;
  for (const d of week.days)
    for (const ex of d.exercises) {
      const rpeSets = ex.sets.filter(s => s.rpe != null && s.status === 'success');
      if (!rpeSets.length) continue;
      const avg = rpeSets.reduce((sum, s) => sum + s.rpe, 0) / rpeSets.length;
      if (avg >= 8.5 && avg > worstRpe) { worstRpe = avg; worst = { name: ex.name, rpe: Math.round(avg * 10) / 10 }; }
    }
  if (!worst) return null;
  return { type: 'fatigue', label: 'Hohe Belastung', text: `${worst.name}: Ø RPE ${worst.rpe}`, exName: worst.name };
}

function _buildRecommendations(highlights, lowlights, completedDays, plannedDays, isDeload) {
  if (isDeload) {
    return [
      { text: 'Deload-Woche erfolgreich abgeschlossen — nächste Woche wieder Vollgas.' },
      { text: 'Nutze die Erholungsphase, schlafe ausreichend und erhöhe dann schrittweise die Intensität.' },
    ];
  }

  const recs = [];

  // Rec 1: bestes Highlight
  const h1 = highlights[0];
  if (h1?.type === 'pr') {
    recs.push({ text: 'Du hast einen neuen PR aufgestellt — halte dieses Gewicht und steigere nächste Woche das Volumen.' });
  } else if (h1?.type === 'gain') {
    const name = h1.text.split(' +')[0];
    recs.push({ text: `${name} war dein stärkster Lift — halte den Trend und plane eine weitere kleine Steigerung.` });
  } else if (h1?.type === 'streak') {
    const n = parseInt(h1.text, 10);
    recs.push({ text: `Dein ${n}-Wochen-Streak zeigt Konstanz — weiter so und achte auf Überbelastungszeichen.` });
  } else {
    recs.push({ text: 'Konsistenz ist der Schlüssel — halte das Tempo bei und fokussiere dich auf saubere Technik.' });
  }

  // Rec 2: schlimmstes Lowlight
  const l1 = lowlights[0];
  if (l1?.type === 'fails') {
    const name = l1.text.split(':')[0];
    recs.push({ text: `Fehlgeschlagene Sätze bei ${name} — reduziere das Gewicht um 5 % oder das Volumen um einen Satz.` });
  } else if (l1?.type === 'missed') {
    const missed = plannedDays - completedDays;
    recs.push({ text: `${missed} ${missed === 1 ? 'Tag' : 'Tage'} verpasst — plane die Sessions kürzer oder lege sie früher im Tag.` });
  } else if (l1?.type === 'fatigue') {
    const name = l1.text.split(':')[0];
    recs.push({ text: `Hohe RPE-Werte bei ${name} — plane für diese Übung nächste Woche eine leichtere Einheit ein.` });
  } else {
    recs.push({ text: 'Alles nach Plan — nächste Woche weiter so und beobachte, ob du das Volumen leicht steigern kannst.' });
  }

  return recs;
}

/**
 * Berechnet einen strukturierten Wochenrückblick.
 *
 * @param {Object} week               Die zu reviewende Woche
 * @param {Array}  allWeeks           Alle Wochen (für PR-Vergleich und Streak)
 * @param {Array}  [favoriteExercises=[]]  Favorisierte Übungsnamen
 * @param {Array}  [plateaus=[]]      Plateau-Objekte aus detectPlateaus()
 * @returns {{ summary, highlights, lowlights, recommendations, isDeload, week }}
 */
export function buildWeekReview(week, allWeeks, favoriteExercises = [], plateaus = []) {
  const isDeload = week.mode === 'deload';
  const sorted   = [...allWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const weekIdx  = sorted.findIndex(w => w === week || w.startDate === week.startDate);
  const prevWeek = weekIdx > 0 ? sorted[weekIdx - 1] : null;

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalVolume      = _sumVolume(week);
  const totalSets        = _countSuccessSets(week);
  const completedDays    = week.days.filter(d => d.markedDone).length;
  const plannedDays      = week.days.length;
  const sessionDurs      = (week.sessionLog ?? []).map(l => l.duration);
  const avgSessionDuration = sessionDurs.length
    ? Math.round(sessionDurs.reduce((a, b) => a + b, 0) / sessionDurs.length / 60)
    : null;
  let volumeVsPrevWeek = null;
  if (prevWeek) {
    const pv = _sumVolume(prevWeek);
    if (pv > 0) volumeVsPrevWeek = Math.round((totalVolume - pv) / pv * 100);
  }
  const summary = { totalVolume, totalSets, completedDays, plannedDays, avgSessionDuration, volumeVsPrevWeek };

  // ── Highlights ────────────────────────────────────────────────────────────────
  const highlights  = [];
  const prevWeeks   = weekIdx > 0 ? sorted.slice(0, weekIdx) : [];
  const prH         = _findPR(week, prevWeeks);
  if (prH) highlights.push(prH);
  if (!isDeload && prevWeek) {
    const gainH = _findBestGain(week, prevWeek);
    if (gainH && highlights.length < 3) highlights.push(gainH);
  }
  const streak = _calcStreak(sorted, week);
  if (streak >= 2 && highlights.length < 3)
    highlights.push({ type: 'streak', label: 'Streak', text: `${streak} Wochen in Folge` });

  // ── Lowlights ─────────────────────────────────────────────────────────────────
  const lowlights = [];
  const failH = _findFailHighlight(week);
  if (failH) lowlights.push(failH);
  if (completedDays < plannedDays && lowlights.length < 2)
    lowlights.push({
      type: 'missed', label: 'Verpasste Tage',
      text: `${plannedDays - completedDays} von ${plannedDays} ${plannedDays === 1 ? 'Tag' : 'Tagen'} nicht abgeschlossen`,
    });
  if (lowlights.length < 2) {
    const fatigueH = _findFatigueHighlight(week);
    if (fatigueH) lowlights.push(fatigueH);
  }

  // ── Plateau-Lowlight einfügen ─────────────────────────────────────────────────
  if (plateaus.length > 0) {
    const p = plateaus[0];
    lowlights.push({
      type:   'plateau',
      label:  'Plateau erkannt',
      text:   `${p.exerciseName} — ${p.plateauWeeks} Wochen ohne Steigerung`,
      exName: p.exerciseName,
    });
  }

  // ── Favoriten zuerst in highlights + lowlights ───────────────────────────────
  if (favoriteExercises.length > 0) {
    const _fav = name => favoriteExercises.includes(name) ? 0 : 1;
    highlights.sort((a, b) => _fav(a.exName) - _fav(b.exName));
    lowlights.sort((a, b)  => _fav(a.exName) - _fav(b.exName));
  }

  // ── Recommendations ───────────────────────────────────────────────────────────
  const recommendations = _buildRecommendations(highlights, lowlights, completedDays, plannedDays, isDeload);

  // Replace rec[1] with plateau action when a plateau lowlight is present
  const hasPlateau = lowlights.some(l => l.type === 'plateau');
  if (hasPlateau && plateaus.length > 0 && recommendations.length >= 2) {
    recommendations[1] = { text: plateaus[0].actionText };
  }

  return { summary, highlights, lowlights, recommendations, isDeload, week };
}
