/**
 * progressInsights.js – "Deine Erkenntnisse"-Sektion im Analyse-Tab.
 *
 * Anders als insightEngine.js (event-getriebene Toasts + state.insights):
 * diese Funktionen werden bei jedem Rendern des Analyse-Tabs frisch neu
 * berechnet, nicht event-getrieben, nicht persistiert. Pure Funktionen,
 * keine Seiteneffekte.
 *
 * Schlaf-Korrelation wird bewusst NICHT hier neu berechnet, sondern aus
 * insightEngine.js importiert (computeSleepCorrelation) — eine einzige
 * Implementierung dieser Formel für Toast-System UND diese Sektion.
 */

import { getSortedWeeks, getCompletionRate, exWeightHistory, computeSleepCorrelation } from './insightEngine.js';

const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

function _relevantWeeks(state) {
  return getSortedWeeks(state).filter(w => w.mode !== 'deload' && w.mode !== 'vacation');
}

function _weekdayName(wk, di) {
  const d = new Date(wk.startDate + 'T12:00:00');
  d.setDate(d.getDate() + di);
  return WEEKDAY_NAMES[(d.getDay() + 6) % 7]; // getDay(): 0=So → Montag-first Index
}

/**
 * Kategorie 2a: Übung mit der höchsten Erfolgsquote, deutlich über dem
 * Durchschnitt aller ausreichend belegten Übungen.
 * @returns {{ name: string, rate: number, avgAll: number, diff: number } | null}
 */
export function mostSuccessfulExercise(state) {
  const sorted = _relevantWeeks(state);
  const stats = new Map(); // name -> { success, total, weeks: Set<startDate> }

  for (const wk of sorted) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.sets.length === 0) continue;
        const e = stats.get(ex.name) ?? { success: 0, total: 0, weeks: new Set() };
        for (const s of ex.sets) { e.total++; if (s.status === 'success') e.success++; }
        e.weeks.add(wk.startDate);
        stats.set(ex.name, e);
      }
    }
  }

  const entries = [...stats.entries()]
    .map(([name, e]) => ({ name, rate: e.total > 0 ? e.success / e.total : 0, weeks: e.weeks.size, total: e.total }))
    .filter(e => e.weeks >= 3 && e.total >= 6);
  if (entries.length === 0) return null;

  const avgAll = entries.reduce((s, e) => s + e.rate, 0) / entries.length;
  const best = entries.reduce((a, b) => (b.rate > a.rate ? b : a));
  if (best.rate < 0.85) return null;
  const diff = best.rate - avgAll;
  if (diff < 0.01) return null;

  return { name: best.name, rate: best.rate, avgAll, diff };
}

/**
 * Kategorie 2b: Wochentag mit der höchsten Erfolgsquote, deutlich über dem
 * Durchschnitt aller Wochentage mit ausreichend Datenpunkten.
 * @returns {{ name: string, rate: number, avgAll: number, diff: number } | null}
 */
export function mostSuccessfulWeekday(state) {
  const sorted = _relevantWeeks(state);
  const stats = new Map(); // weekdayName -> { success, total, count }

  for (const wk of sorted) {
    wk.days.forEach((day, di) => {
      const attempted = day.exercises.some(ex => ex.sets.some(s => s.status === 'success' || s.status === 'fail'));
      if (!attempted) return; // unbearbeiteter/leerer Tag ist kein Datenpunkt
      let success = 0, total = 0;
      for (const ex of day.exercises) for (const s of ex.sets) { total++; if (s.status === 'success') success++; }
      const name = _weekdayName(wk, di);
      const e = stats.get(name) ?? { success: 0, total: 0, count: 0 };
      e.success += success; e.total += total; e.count += 1;
      stats.set(name, e);
    });
  }

  const entries = [...stats.entries()]
    .map(([name, e]) => ({ name, rate: e.total > 0 ? e.success / e.total : 0, count: e.count }))
    .filter(e => e.count >= 4);
  if (entries.length === 0) return null;

  const avgAll = entries.reduce((s, e) => s + e.rate, 0) / entries.length;
  const best = entries.reduce((a, b) => (b.rate > a.rate ? b : a));
  const diff = best.rate - avgAll;
  if (diff < 0.05) return null;

  return { name: best.name, rate: best.rate, avgAll, diff };
}

/**
 * Kategorie 3: Übung deren Gewichts-Steigerungsrate der letzten 4 Wochen
 * deutlich (≥1.5x) über ihrer eigenen historischen Durchschnittsrate liegt.
 * @returns {{ name: string, curRate: number, histRate: number, diff: number } | null}
 */
/**
 * Geteilte Basis für progressTrendOutlier() UND die Korridor-Kalibrierung im
 * Übungsfortschritt-Chart (siehe getProgressCorridorCalibration() unten) —
 * gleiche Mindest-Historie (6 Wochen mit Gewichtsdaten) und gleiche
 * Fensterlogik (Ø-Delta letzte 4 Wochen vs. Ø-Delta Gesamt-Historie).
 * Jetzt zusätzlich exportiert für overallPerformance.js (Breite-Dimension
 * der Gesamtperformance-Sektion) — Logik unverändert.
 * @returns {{ history: number[], histRate: number, curRate: number, lastWeight: number } | null}
 */
export function _exerciseRateWindow(sortedWeeks, exName) {
  const history = exWeightHistory(sortedWeeks, exName).filter(w => w > 0); // chronologisch, nur Wochen mit Gewichtsdaten
  if (history.length < 6) return null;

  const deltas = [];
  for (let i = 1; i < history.length; i++) deltas.push((history[i] - history[i - 1]) / history[i - 1]);
  if (deltas.length < 5) return null;

  const histRate = deltas.reduce((a, b) => a + b, 0) / deltas.length;
  const recentDeltas = deltas.slice(-4);
  const curRate = recentDeltas.reduce((a, b) => a + b, 0) / recentDeltas.length;

  return { history, histRate, curRate, lastWeight: history[history.length - 1] };
}

export function progressTrendOutlier(state) {
  const sorted = _relevantWeeks(state);
  const exNames = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];

  let best = null;
  for (const name of exNames) {
    const rw = _exerciseRateWindow(sorted, name);
    if (!rw) continue;
    if (rw.histRate <= 0) continue; // nur sinnvoll bei grundsätzlich positivem historischem Trend
    if (rw.curRate <= rw.histRate * 1.5) continue;

    const diff = rw.curRate - rw.histRate;
    if (!best || diff > best.diff) best = { name, curRate: rw.curRate, histRate: rw.histRate, diff };
  }
  return best;
}

/**
 * Kalibrierungs-Basis für den Zielkorridor im Übungsfortschritt-Chart.
 * Kalibrierungs-Rate = Ø-Delta der letzten 4 Wochen (identisch zu curRate in
 * progressTrendOutlier() — bewusst NICHT histRate, da der Korridor sich an
 * der jüngsten, nicht der gesamten historischen Rate orientieren soll).
 * Liefert null wenn < 6 Wochen Historie ODER Kalibrierungs-Rate <= 0 — in
 * beiden Fällen zeigt der Chart keinen Korridor (siehe AC1/AC3).
 * @returns {{ calibrationRate: number, startWeight: number } | null}
 */
export function getProgressCorridorCalibration(sortedWeeks, exName) {
  const rw = _exerciseRateWindow(sortedWeeks, exName);
  if (!rw) return null;
  if (rw.curRate <= 0) return null;
  return { calibrationRate: rw.curRate, startWeight: rw.lastWeight };
}

/**
 * Baut bis zu 3 Erkenntnis-Zeilen für die Analyse-Tab-Karte. Reihenfolge:
 * Schlaf, Erfolgreichste/r (Übung ODER Wochentag, nie beide), Trend.
 * @returns {string[]}
 */
export function computeErkenntnisLines(state) {
  const lines = [];

  const sleep = computeSleepCorrelation(state);
  if (sleep) {
    const diffPp = Math.round((sleep.avgWith - sleep.avgWithout) * 100);
    lines.push(`An Tagen mit ${sleep.threshold}h+ Schlaf erreichst du ${diffPp}% mehr deiner Trainingsziele.`);
  }

  const ex = mostSuccessfulExercise(state);
  const wd = mostSuccessfulWeekday(state);
  if (ex || wd) {
    const useEx = !!ex && (!wd || ex.diff >= wd.diff);
    if (useEx) {
      lines.push(`${ex.name} läuft bei dir am konstantesten — ${Math.round(ex.rate * 100)}% Erfolgsquote gegenüber ${Math.round(ex.avgAll * 100)}% im Durchschnitt.`);
    } else {
      lines.push(`${wd.name}s trainierst du am konstantesten — ${Math.round(wd.rate * 100)}% Erfolgsquote gegenüber ${Math.round(wd.avgAll * 100)}% im Durchschnitt.`);
    }
  }

  const trend = progressTrendOutlier(state);
  if (trend) {
    lines.push(`Deine ${trend.name} steigt aktuell schneller als sonst — +${Math.round(trend.curRate * 100)}% in den letzten 4 Wochen statt der üblichen +${Math.round(trend.histRate * 100)}%.`);
  }

  return lines;
}
