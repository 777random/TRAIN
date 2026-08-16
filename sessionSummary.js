/**
 * sessionSummary.js – Session Summary + Schlaf-Korrelation (B79).
 *
 * Reine Berechnungsfunktionen für die Einordnung eines abgeschlossenen
 * Trainingstages (Highlights, Text-Einordnung, Vorschau, Schlaf-Korrelation).
 * Importiert insightEngine.js (getSortedWeeks/exWeightHistory, bereits
 * etablierte Quelle für Wochen-Zeitreihen, z.B. weekReviewModal.js) und
 * setUtils.js (isFullSuccess). Die Fokus-Übung für buildNextSessionPreview()
 * wird seit dem Solotest-Feedback (2026-08-16) vom Aufrufer (ui.js) übergeben
 * statt hier erneut (und leicht abweichend) hergeleitet — kein eigener
 * movementMap.js-Import mehr nötig.
 */

import { exWeightHistory } from './insightEngine.js';
import { isFullSuccess } from './setUtils.js';

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
    // B141: Wdh-PR (prBadge:'reps') wird gleichrangig zum Gewichts-PR erkannt
    // (vorher NUR 'weight' — siehe DECISIONS.md, bewusster Bruch von B73/B79).
    const prSet = (ex.sets ?? []).find(s => s.status === 'success' && (s.prBadge === 'weight' || s.prBadge === 'reps'));
    if (prSet) {
      if (prSet.prBadge === 'weight') {
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
      } else {
        // Wdh-PR: eigener Text (kein Gewichts-Delta — mehr Wdh bei GLEICHEM
        // Gewicht, nicht mehr Gewicht), bewusst unterscheidbar vom Gewichts-Text.
        rows.push({ prio: 0, text: `${ex.name}: Neue Wdh-Bestleistung ↑` });
      }
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
  // B141: Wdh-PR gleichrangig zum Gewichts-PR erkannt (vorher NUR 'weight'),
  // aber mit eigenem Text — siehe DECISIONS.md.
  const weightPrEx = exercises.find(ex => (ex.sets ?? []).some(s => s.status === 'success' && s.prBadge === 'weight'));
  const repsPrEx = exercises.find(ex => (ex.sets ?? []).some(s => s.status === 'success' && s.prBadge === 'reps'));
  const avgRpe = _dayAvgRpe(day);
  const fullSuccess = exercises.length > 0 && exercises.every(_exerciseFullySuccessful);
  const anyFullSuccess = exercises.some(_exerciseFullySuccessful);
  const anyRated = exercises.some(ex => (ex.sets ?? []).some(s => s.status === 'success' || s.status === 'fail'));

  // a) Gewichts-PR diese Session
  if (weightPrEx) {
    const weeksSince = curWeekIdx != null ? _weeksSincePreviousIncrease(sortedWeeks, weightPrEx.name, curWeekIdx) : null;
    return weeksSince != null
      ? `Neuer Rekord heute — das war dein bestes Training seit ${weeksSince} ${weeksSince === 1 ? 'Woche' : 'Wochen'}.`
      : 'Neuer Rekord heute — dein bisher stärkstes Training.';
  }
  // a2) Wdh-PR diese Session (kein Gewichts-PR) — eigener Text, kein
  // "seit X Wochen"-Vergleich (der basiert auf exWeightHistory, für einen
  // reinen Wdh-PR nicht aussagekräftig).
  if (repsPrEx) {
    return `Neue Wdh-Bestleistung heute — mehr Wiederholungen bei ${repsPrEx.name} als je zuvor bei diesem Gewicht.`;
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

/**
 * "Nächstes Training: [Name] → [Gewicht]kg" für die erste Compound-Übung
 * des Tages. `focusEx` UND `nextWeekWeight` kommen beide vom Aufrufer
 * (ui.js, via getWeightRecommendation() — echte "nächste Woche"-Projektion,
 * der einzige legitime Gebrauch dieser Funktion, siehe DECISIONS.md).
 * Solotest-Feedback (2026-08-16): vorher leitete diese Funktion die
 * Fokus-Übung über ein eigenes (leicht abweichendes) Kategorie-Duplikat
 * erneut her, statt die von ui.js für nextWeekWeight bereits ermittelte
 * focusEx zu übernehmen -- bei einer heute substituierten Übung konnte das
 * einen ANDEREN Namen anzeigen als das Gewicht, zu dem es berechnet wurde
 * (ui.js löst die Kategorie über ex.substituteFor ?? ex.name auf, das
 * Duplikat hier nur über ex.name). Jetzt ein einziger Ermittlungsort.
 * Null wenn keine Compound-Übung im Tag oder keine Empfehlung vorliegt.
 */
export function buildNextSessionPreview(focusEx, nextWeekWeight) {
  if (!focusEx || nextWeekWeight == null) return null;
  return `Nächstes Training: ${focusEx.name} → ${nextWeekWeight}kg`;
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

/**
 * B140 (Sprint 2026-07, Ansatz B): erkennt Intra-Session-Erschöpfung — wenn
 * die letzten Übungen eines Tages deutlich schlechter performen (höheres
 * RPE, sinkende Erfolgsquote) als die ersten, ist das ein Signal für
 * Erschöpfung INNERHALB der Session, nicht für ein wochenübergreifendes
 * Plateau. Bewusst hier (tagesskaliert, sessionSummary.js) statt in
 * weeklyFocus.js (wochenskaliert) — siehe DECISIONS.md "Getrennte Logik für
 * Wochen-Empfehlung vs. Intra-Session-Feedback".
 *
 * @param {Object} day
 * @returns {{ rpeDiff: number, firstAvg: number, secondAvg: number,
 *   mostFatiguedExercise: string, successDrop: number } | null}
 */
export function detectSessionFatigue(day) {
  // Nur bewertete Übungen (mindestens 1 success/fail-Satz mit RPE)
  const scoredExercises = (day.exercises ?? []).filter(ex =>
    (ex.sets ?? []).some(s => s.status !== 'pending' && s.rpe !== null));

  // Mindestens 3 Übungen mit RPE — sonst zu wenig Daten
  if (scoredExercises.length < 3) return null;

  const avgRpePerEx = scoredExercises.map(ex => {
    const rpes = ex.sets
      .filter(s => s.rpe !== null && s.status !== 'pending')
      .map(s => s.rpe);
    const evaluated = ex.sets.filter(s => s.status !== 'pending');
    return {
      name: ex.name,
      avgRpe: rpes.reduce((a, b) => a + b, 0) / rpes.length,
      successRate: evaluated.filter(s => s.status === 'success').length / evaluated.length,
    };
  });

  // Erste Hälfte vs. zweite Hälfte
  const half = Math.floor(avgRpePerEx.length / 2);
  const firstHalf  = avgRpePerEx.slice(0, half);
  const secondHalf = avgRpePerEx.slice(half);

  const firstAvg  = firstHalf.reduce((a, b) => a + b.avgRpe, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b.avgRpe, 0) / secondHalf.length;

  // Trigger: RPE-Anstieg >= 1.5 UND Erfolgsquote sinkt >= 10 Prozentpunkte
  const rpeDiff = secondAvg - firstAvg;
  const successDrop =
    firstHalf.reduce((a, b) => a + b.successRate, 0) / firstHalf.length -
    secondHalf.reduce((a, b) => a + b.successRate, 0) / secondHalf.length;

  if (rpeDiff < 1.5 || successDrop < 0.1) return null;

  // Erschöpfteste Übung (höchstes RPE, zweite Hälfte)
  const mostFatigued = secondHalf.slice().sort((a, b) => b.avgRpe - a.avgRpe)[0];

  return {
    rpeDiff: Math.round(rpeDiff * 10) / 10,
    firstAvg: Math.round(firstAvg * 10) / 10,
    secondAvg: Math.round(secondAvg * 10) / 10,
    mostFatiguedExercise: mostFatigued.name,
    successDrop: Math.round(successDrop * 100),
  };
}
