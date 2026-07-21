/**
 * sessionSummary.js – Session Summary + Schlaf-Korrelation (B79).
 *
 * Reine Berechnungsfunktionen für die Einordnung eines abgeschlossenen
 * Trainingstages (Highlights, Text-Einordnung, Vorschau, Schlaf-Korrelation).
 * Importiert insightEngine.js (getSortedWeeks/exWeightHistory, bereits
 * etablierte Quelle für Wochen-Zeitreihen, z.B. weekReviewModal.js) und
 * setUtils.js (isFullSuccess) sowie movementMap.js (Kategorie-Lookup für
 * die Fokus-Übung der nächsten Session — dupliziert bewusst denselben,
 * kleinen Kategorie-Filter wie ui.js' B77-Helper statt ui.js zu importieren,
 * gleiches Muster wie weeklyFocus.js' inline Push/Pull-Duplikation).
 */

import { exWeightHistory } from './insightEngine.js';
import { isFullSuccess } from './setUtils.js';
import { buildCategoryMap, resolveCategory } from './movementMap.js';

const RPE_WARN_THRESHOLD = 8.5;

function _dayEvaluatedSets(day) {
  let succ = 0, fail = 0;
  for (const ex of day.exercises ?? []) {
    if (ex.archived) continue;
    for (const s of ex.sets ?? []) {
      if (s.status === 'success') succ++;
      else if (s.status === 'fail') fail++;
    }
  }
  return { succ, fail, total: succ + fail };
}

function _dayAvgRpe(day) {
  const rpes = [];
  for (const ex of day.exercises ?? []) {
    if (ex.archived) continue;
    for (const s of ex.sets ?? []) {
      if ((s.status === 'success' || s.status === 'fail') && s.rpe != null) rpes.push(s.rpe);
    }
  }
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

function _exerciseFullySuccessful(ex) {
  const rated = (ex.sets ?? []).filter(s => s.status === 'success' || s.status === 'fail');
  if (rated.length === 0) return false;
  return rated.every(s => isFullSuccess(s, ex));
}

/** Wochen seit dem VORHERIGEN Gewichts-Anstieg dieser Übung (nicht seit dem
 *  All-Time-Rekord, der zum Abschlusszeitpunkt bereits überschrieben ist —
 *  siehe Datei-Kommentar). null wenn kein vorheriger Anstieg auffindbar. */
function _weeksSincePreviousIncrease(sortedWeeks, exName, curWeekIdx) {
  const hist = exWeightHistory(sortedWeeks.slice(0, curWeekIdx + 1), exName);
  let runningMax = 0;
  let prevIncreaseIdx = null;
  for (let i = 0; i < hist.length; i++) {
    if (hist[i] > runningMax) {
      if (i < curWeekIdx) prevIncreaseIdx = i;
      runningMax = hist[i];
    }
  }
  return prevIncreaseIdx == null ? null : curWeekIdx - prevIncreaseIdx;
}

/**
 * Bis zu 3 Übungs-Highlights des Tages, Priorität pro Übung PR > RPE-
 * Warnung (>8.5) > Ziel erreicht — eine Zeile pro Übung, über alle
 * Übungen hinweg nach derselben Priorität sortiert und auf 3 gekappt.
 */
export function buildSessionHighlights(day, sortedWeeks, curWeekIdx) {
  const rows = [];
  for (const ex of day.exercises ?? []) {
    if (ex.archived) continue;
    const prSet = (ex.sets ?? []).find(s => s.status === 'success' && s.prBadge === 'weight');
    if (prSet) {
      const weeksSince = curWeekIdx != null
        ? _weeksSincePreviousIncrease(sortedWeeks, ex.name, curWeekIdx)
        : null;
      const prevBest = curWeekIdx != null
        ? Math.max(0, ...exWeightHistory(sortedWeeks.slice(0, curWeekIdx), ex.name))
        : 0;
      const delta = prevBest > 0 ? Math.round((prSet.weight - prevBest) * 10) / 10 : null;
      rows.push({ prio: 0, text: delta != null && delta > 0
        ? `${ex.name}: +${delta}kg ↑`
        : `${ex.name}: Neuer Rekord ↑` });
      continue;
    }
    const hardSet = (ex.sets ?? []).find(s => (s.status === 'success' || s.status === 'fail') && s.rpe != null && s.rpe > RPE_WARN_THRESHOLD);
    if (hardSet) {
      rows.push({ prio: 1, text: `${ex.name}: RPE ${hardSet.rpe} — schwer ⚠` });
      continue;
    }
    if (_exerciseFullySuccessful(ex)) {
      rows.push({ prio: 2, text: `${ex.name}: Ziel erreicht ✓` });
    }
  }
  return rows.sort((a, b) => a.prio - b.prio).slice(0, 3).map(r => r.text);
}

/**
 * 1-2-Satz-Einordnung des Tages, Prioritätskaskade a-f (siehe Sprint-Spec),
 * erstes zutreffendes Kriterium gewinnt. Rein aus dem Tag selbst berechnet
 * (RPE-Schnitt, Ziel-Erreichung, sessionModifier) — kein State-Zugriff.
 */
export function buildSessionEinordnung(day, sortedWeeks, curWeekIdx) {
  const exercises = (day.exercises ?? []).filter(ex => !ex.archived);
  const hasPR = exercises.some(ex => (ex.sets ?? []).some(s => s.status === 'success' && s.prBadge === 'weight'));
  const avgRpe = _dayAvgRpe(day);
  const fullSuccess = exercises.length > 0 && exercises.every(_exerciseFullySuccessful);
  const anyFullSuccess = exercises.some(_exerciseFullySuccessful);
  const anyRated = exercises.some(ex => (ex.sets ?? []).some(s => s.status === 'success' || s.status === 'fail'));

  // a) PR diese Session
  if (hasPR) {
    const prEx = exercises.find(ex => (ex.sets ?? []).some(s => s.status === 'success' && s.prBadge === 'weight'));
    const weeksSince = curWeekIdx != null ? _weeksSincePreviousIncrease(sortedWeeks, prEx.name, curWeekIdx) : null;
    return weeksSince != null
      ? `Neuer Rekord heute — das war dein bestes Training seit ${weeksSince} ${weeksSince === 1 ? 'Woche' : 'Wochen'}.`
      : 'Neuer Rekord heute — dein bisher stärkstes Training.';
  }
  // b) alle Ziele erreicht, ø RPE <= 7
  if (fullSuccess && avgRpe != null && avgRpe <= 7) {
    return 'Solides Training — du hast noch Kapazität. Nächste Woche: steigern.';
  }
  // c) alle Ziele erreicht, ø RPE 7-8.5
  if (fullSuccess && avgRpe != null && avgRpe <= 8.5) {
    return 'Perfektes Training — genau die richtige Intensität.';
  }
  // e) ø RPE > 8.5 (vor d geprüft — sonst würde ein hartes, aber teilweise
  // erfolgreiches Training fälschlich als "gemischt" statt "hart" eingeordnet)
  if (avgRpe != null && avgRpe > RPE_WARN_THRESHOLD) {
    return 'Hartes Training — heute hast du alles gegeben. Erholung ist jetzt wichtig.';
  }
  // d) teilweise Ziele erreicht
  if (anyRated && anyFullSuccess && !fullSuccess) {
    const strong = exercises.find(_exerciseFullySuccessful);
    const weak   = exercises.find(ex => !_exerciseFullySuccessful(ex) && (ex.sets ?? []).some(s => s.status === 'success' || s.status === 'fail'));
    if (strong && weak) {
      return `Gemischtes Training — ${strong.name} war stark, ${weak.name} braucht noch Arbeit.`;
    }
  }
  // f) sessionModifier war 'reduced'
  if (day.sessionModifier === 'reduced') {
    return 'Gut gemacht — du bist trotz schwachem Start durchgezogen.';
  }
  return 'Training abgeschlossen.';
}

/** Duplikat des Kategorie-Filters aus ui.js' _findFirstCompoundExercise
 *  (B77) — bewusst hier erneut, kein ui.js-Import (siehe Datei-Kommentar). */
function _findFirstCompoundExercise(day, customExercises) {
  const catMap = buildCategoryMap(customExercises ?? []);
  for (const ex of day.exercises ?? []) {
    if (ex.archived) continue;
    if ((ex.metric ?? 'reps') !== 'reps') continue;
    const cat = resolveCategory(ex.name, catMap);
    if (cat === 'Squat' || cat === 'Hinge' || cat === 'Push' || cat === 'Pull') return ex;
  }
  return null;
}

/**
 * "Nächstes Training: [Name] → [Gewicht]kg" für die erste Compound-Übung
 * des Tages. `nextWeekWeight` kommt vom Aufrufer (ui.js, via
 * getWeightRecommendation() — echte "nächste Woche"-Projektion, der
 * einzige legitime Gebrauch dieser Funktion, siehe DECISIONS.md).
 * Null wenn keine Compound-Übung im Tag oder keine Empfehlung vorliegt.
 */
export function buildNextSessionPreview(day, customExercises, nextWeekWeight) {
  const ex = _findFirstCompoundExercise(day, customExercises);
  if (!ex || nextWeekWeight == null) return null;
  return `Nächstes Training: ${ex.name} → ${nextWeekWeight}kg`;
}

/**
 * Schlaf-Korrelation: gruppiert alle Trainingstage (Nicht-Deload/Nicht-
 * Urlaub-Wochen) nach sessionCheckIn.sleep in 'poor'/'medium' vs.
 * 'good'/'great', vergleicht die durchschnittliche Tages-Erfolgsquote
 * (succ/(succ+fail)*100 — bewusst NICHT weekSuccessCounts() aus
 * setUtils.js, die arbeitet auf einer Woche, nicht einem Tag).
 */
export function calcSleepCorrelation(sortedWeeks) {
  const poorPct = [], goodPct = [];
  for (const wk of sortedWeeks) {
    if (wk.mode === 'deload' || wk.mode === 'vacation') continue;
    for (const day of wk.days ?? []) {
      const sleep = day.sessionCheckIn?.sleep;
      if (!sleep) continue;
      const { succ, fail, total } = _dayEvaluatedSets(day);
      if (total === 0) continue;
      const pct = (succ / total) * 100;
      if (sleep === 'poor' || sleep === 'medium') poorPct.push(pct);
      else if (sleep === 'good' || sleep === 'great') goodPct.push(pct);
    }
  }
  const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
  const poorAvg = avg(poorPct);
  const goodAvg = avg(goodPct);
  const diff = poorAvg != null && goodAvg != null ? goodAvg - poorAvg : null;
  return {
    poorAvg: poorAvg != null ? Math.round(poorAvg) : null,
    goodAvg: goodAvg != null ? Math.round(goodAvg) : null,
    diff: diff != null ? Math.round(diff) : null,
    hasSig: diff != null && diff >= 15,
    totalDaysWithSleep: poorPct.length + goodPct.length,
  };
}
