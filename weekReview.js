/**
 * weekReview.js – Pure function, kein DOM, kein State-Zugriff (gemeint ist:
 * kein getState()/dispatch() — der Import von isTrainingDay() aus state.js
 * ist eine reine, zustandslose Prädikat-Funktion, keine State-Kopplung).
 * Berechnet strukturierten Wochenrückblick aus einer Woche + allen Wochen.
 */

import { weekSuccessCounts } from './setUtils.js';
import { isTrainingDay, calcCurrentStreak } from './state.js';

function _kw(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
}

// ISO-Datum eines Tag-Slots — identische Formel zu ui.js' _dayDate() (dort
// nicht importiert: dieser Datei-Kopfkommentar sagt "kein State-Zugriff",
// ein Import aus ui.js wäre zudem zirkulär, da ui.js bereits weekReview.js
// importiert).
function _dayISODate(week, dayIdx) {
  const d = new Date(week.startDate + 'T12:00:00');
  d.setDate(d.getDate() + dayIdx);
  return d.toISOString().slice(0, 10);
}

// Tage, die weder abgeschlossen sind NOCH schon stattgefunden haben, dürfen
// nicht als "verpasst" gezählt werden — sie sind einfach noch nicht dran
// (Sprint "Kategorie-1-Bugfixes", Fix 3; Off-by-one behoben in Sprint
// "Fix3 + Fix4 Nachbessern", Fix 3b). Betrifft in der Praxis nur die
// aktuell laufende, noch nicht abgeschlossene Woche im Wochenrückblick.
//
// "<" statt "<=": der HEUTIGE Tag ist erst NACH Ablauf des Tages "erreicht"
// im Sinne von "hätte schon erledigt sein können" — mit "<=" zählte der
// laufende, noch nicht abgeschlossene heutige Tag sofort als fällig und
// damit als "verpasst", sobald er nicht schon zu Tagesbeginn markedDone
// war (bestätigt per Diagnose-Reproduktion: bei todayISO === Tag-Datum
// kippte der noch laufende Tag ohne "<"-Fix in "verpasst").
//
// isTrainingDay()-Filter ergänzt (Konsolidierung 2026-07-14, B44): reine
// Ruhe-Urlaubstage (isVacation && vacationPlan==='rest') zählten hier
// bisher trotzdem als "geplant", während consistencyUtils.js/state.js sie
// schon immer korrekt ausschließen — dieselbe Regel, dieselbe Quelle wie
// dort, keine eigene Kopie der Ausschluss-Logik.
function _reachableDays(week) {
  const todayISO = new Date().toISOString().slice(0, 10);
  return week.days.filter((d, i) => isTrainingDay(d) && (d.markedDone || _dayISODate(week, i) < todayISO));
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

// Delegiert an setUtils.js (Konsolidierung 2026-07-14 — war vorher hier
// UND in ui.js unabhängig dupliziert, mit unterschiedlicher Archiviert-
// Behandlung, siehe setUtils.js-Kommentar).
function _calcSuccessScore(week) {
  const { total, pct } = weekSuccessCounts(week);
  return total > 0 ? pct : null;
}

/**
 * B74: delegiert vollständig an calcCurrentStreak() (state.js) statt einer
 * eigenen, einfacheren Logik — die frühere eigenständige Implementierung
 * (nur `days.some(d => d.markedDone)`, kein Schwellenwert, keine
 * Kalenderlücken-Prüfung) wich vom Training-Tab-Badge ab: zählte
 * Teilabschlüsse unter der 70%-'completed'-Schwelle mit UND zählte durch
 * mehrwöchige Trainingspausen einfach durch (kein `_streakGapBreaks()`-
 * Äquivalent). Betraf sowohl den Wochenrückblick als auch das davon
 * gespeiste Share-Bild — Letzteres hätte dadurch eine objektiv falsche
 * Streak-Zahl öffentlich geteilt. `slice(0, idx+1)` liefert exakt "der
 * Streak-Stand zum Zeitpunkt dieser Woche", identische Semantik wie die
 * Training-Tab-Badge (inkl. B69: eine noch laufende, unvollständige
 * neueste Woche in der Slice bricht die Streak nicht sofort).
 */
function _calcStreak(sortedWeeks, week) {
  const idx = sortedWeeks.findIndex(w => w === week || w.startDate === week.startDate);
  if (idx < 0) return 0;
  return calcCurrentStreak(sortedWeeks.slice(0, idx + 1));
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
    recs.push({ text: `${n} Wochen konsistentes Training — weiter so und achte auf Überbelastungszeichen.` });
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
 * Plateau ist NICHT mehr Teil von "Was nicht gut lief" (Sprint C2,
 * train-v109) — lebt jetzt ausschließlich im Coach-Tab (Fokus der Woche,
 * weeklyFocus.js), inkl. eigener Decisional-Balance + Ignorieren/Umgesetzt-
 * Buttons. Kein plateaus-Parameter mehr nötig.
 *
 * @param {Object} week               Die zu reviewende Woche
 * @param {Array}  allWeeks           Alle Wochen (für PR-Vergleich und Streak)
 * @param {Array}  [favoriteExercises=[]]  Favorisierte Übungsnamen
 * @returns {{ summary, highlights, lowlights, recommendations, isDeload, week }}
 */
export function buildWeekReview(week, allWeeks, favoriteExercises = []) {
  const isDeload   = week.mode === 'deload';
  const isVacation = week.mode === 'vacation';
  const sorted   = [...allWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const weekIdx  = sorted.findIndex(w => w === week || w.startDate === week.startDate);
  const prevWeek = weekIdx > 0 ? sorted[weekIdx - 1] : null;

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalSets        = _countSuccessSets(week);
  // Nur "erreichbare" Tage zählen (heute oder früher, oder bereits erledigt)
  // — verhindert dass Tage der laufenden Woche, die schlicht noch nicht
  // dran waren, als "verpasst" gezählt werden (Fix 3).
  const reachableDays    = _reachableDays(week);
  const completedDays    = reachableDays.filter(d => d.markedDone).length;
  const plannedDays      = reachableDays.length;
  const sessionDurs      = (week.sessionLog ?? []).map(l => l.duration);
  const avgSessionDuration = sessionDurs.length
    ? Math.round(sessionDurs.reduce((a, b) => a + b, 0) / sessionDurs.length / 60)
    : null;
  const streak         = _calcStreak(sorted, week);
  const goalFulfillment = _calcSuccessScore(week);
  const summary = { streak, totalSets, completedDays, plannedDays, avgSessionDuration, goalFulfillment };

  // ── Highlights ────────────────────────────────────────────────────────────────
  const highlights  = [];
  const prevWeeks   = weekIdx > 0 ? sorted.slice(0, weekIdx) : [];
  const prH         = _findPR(week, prevWeeks);
  if (prH) highlights.push(prH);
  if (!isDeload && prevWeek) {
    const gainH = _findBestGain(week, prevWeek);
    if (gainH && highlights.length < 3) highlights.push(gainH);
  }
  if (streak >= 2 && highlights.length < 3)
    highlights.push({ type: 'streak', label: 'Konsistenz', text: `${streak} Wochen in Folge` });

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

  // ── Favoriten zuerst in highlights + lowlights ───────────────────────────────
  if (favoriteExercises.length > 0) {
    const _fav = name => favoriteExercises.includes(name) ? 0 : 1;
    highlights.sort((a, b) => _fav(a.exName) - _fav(b.exName));
    lowlights.sort((a, b)  => _fav(a.exName) - _fav(b.exName));
  }

  // ── Recommendations ───────────────────────────────────────────────────────────
  const recommendations = _buildRecommendations(highlights, lowlights, completedDays, plannedDays, isDeload);

  return { summary, highlights, lowlights, recommendations, isDeload, isVacation, week };
}
