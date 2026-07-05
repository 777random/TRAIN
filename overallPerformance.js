/**
 * overallPerformance.js – "Gesamtperformance"-Sektion im Fortschritt-Tab.
 *
 * Aggregiert vier Dimensionen (Qualität, Konsistenz, Volumen, Breite) über
 * ALLE Übungen als reine Feststellung (Accounting-Ebene, keine Handlungs-
 * empfehlung — die bleiben im Coach-Tab/weeklyFocus.js). Pure Funktionen,
 * keine Seiteneffekte, bei jedem Tab-Render frisch berechnet, keine
 * Persistierung.
 *
 * Wiederverwendete Bausteine (Logik dort jeweils unverändert, nur exportiert):
 *   - _weekConsistencyRatio()/_consistencyEligibleWeeks() aus consistencyUtils.js
 *     (bis Sprint "Drei neue Coach-Signale" aus weeklyFocus.js importiert —
 *     verschoben, weil weeklyFocus.js jetzt selbst computeVolumeTrend/
 *     computeConsistencyTrend/computeQualityTrend aus dieser Datei importiert;
 *     ein Rückimport hätte einen zirkulären Import erzeugt)
 *   - _exerciseRateWindow() aus progressInsights.js
 *   - getSortedWeeks()/exWeightHistory() aus insightEngine.js (bereits exportiert)
 *   - MOVEMENT_MAP aus movementMap.js (aus ui.js extrahiert, um einen
 *     zirkulären Import ui.js<->overallPerformance.js zu vermeiden)
 *   - _weekSuccessScore() aus ui.js wird NICHT importiert (ui.js importiert
 *     bereits diese Datei — ein Re-Import in die Gegenrichtung wäre
 *     zirkulär) — die Qualitäts-Funktion unten nimmt daher bereits
 *     vorberechnete Score-Objekte als Parameter entgegen, ui.js berechnet
 *     sie mit der UNVERÄNDERTEN _weekSuccessScore() und übergibt sie.
 */

import { getSortedWeeks } from './insightEngine.js';
import { _weekConsistencyRatio, _consistencyEligibleWeeks } from './consistencyUtils.js';
import { _exerciseRateWindow } from './progressInsights.js';
import { MOVEMENT_MAP } from './movementMap.js';

const RADAR_CATS = ['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core'];

function _nonDeloadVacationWeeks(state) {
  return getSortedWeeks(state).filter(w => w.mode !== 'deload' && w.mode !== 'vacation');
}

// ─── Qualität ────────────────────────────────────────────────────────────────
// scoredWeeks: Array von {succ, fail, total, pct} — von ui.js mit der
// unveränderten _weekSuccessScore() pro Woche vorberechnet (siehe Datei-
// Kopfkommentar zum zirkulären Import). Reihenfolge chronologisch.
const QUALITY_STABLE_BAND = 2; // Prozentpunkte — Sprint-Text nennt keinen exakten Wert, eigene Wahl

export function computeQualityTrend(scoredWeeks, N = 8) {
  const half = Math.max(2, Math.round(N / 2));
  const scored = scoredWeeks.filter(s => s.total > 0);
  if (scored.length < half) return null;
  const last = scored.slice(-half);
  const prev = scored.slice(-N, -half);
  const avgPct = arr => Math.round(arr.reduce((s, x) => s + x.pct, 0) / arr.length);
  const curPct = avgPct(last);
  if (prev.length === 0) return { curPct, prevPct: null, direction: null, halfN: half };
  const prevPct = avgPct(prev);
  const diff = curPct - prevPct;
  const direction = Math.abs(diff) < QUALITY_STABLE_BAND ? 'stable' : diff > 0 ? 'up' : 'down';
  return { curPct, prevPct, diff, direction, halfN: half };
}

// ─── Konsistenz ──────────────────────────────────────────────────────────────
const CONSISTENCY_STABLE_BAND = 5; // Prozentpunkte — eigene Wahl, gröberes Maß als Qualität

export function computeConsistencyTrend(state, N = 8) {
  const half = Math.max(2, Math.round(N / 2));
  const eligible = _consistencyEligibleWeeks(state);
  if (eligible.length < half) return null;
  const lastN = eligible.slice(-N);
  const avgPct = arr => Math.round(arr.reduce((s, r) => s + r.ratio, 0) / arr.length * 100);
  const curPct = avgPct(lastN);
  const prevN = eligible.slice(-2 * N, -N);
  if (prevN.length === 0) return { curPct, prevPct: null, direction: null, N };
  const prevPct = avgPct(prevN);
  const diff = curPct - prevPct;
  const direction = Math.abs(diff) < CONSISTENCY_STABLE_BAND ? 'stable' : diff > 0 ? 'up' : 'down';
  return { curPct, prevPct, diff, direction, N };
}

// ─── Volumen ─────────────────────────────────────────────────────────────────
// Gewichts-Volumen: identische Formel zu ui.js' _trueVol() (gewicht*reps,
// nur erfolgreiche Sätze) — hier separat implementiert statt importiert,
// da ui.js diese Datei importiert (zirkulärer Import wäre die Alternative).
// Bei weight=0/null trägt ein Satz ohnehin 0 zur Summe bei, daher ist kein
// zusätzlicher Filter nötig, um exakt denselben Wert wie _trueVol() zu
// erhalten.
function _weightVolume(week) {
  return week.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) =>
    ss + ex.sets.filter(s => s.status === 'success')
      .reduce((sss, s) => sss + (s.weight ?? 0) * (s.reps ?? 0), 0), 0), 0);
}
// Relatives Volumen (Körpergewicht-Übungen): Wiederholungen erfolgreicher
// Sätze OHNE Gewicht (weight 0/null), ohne Gewichtsfaktor — eigene, nicht
// mit dem Gewichts-Volumen mischbare Größe.
function _relativeVolumeReps(week) {
  let sum = 0;
  for (const d of week.days) for (const ex of d.exercises)
    for (const s of ex.sets) if (s.status === 'success' && !((s.weight ?? 0) > 0)) sum += (s.reps ?? 0);
  return sum;
}
function _relativeVolumeSetCount(week) {
  let n = 0;
  for (const d of week.days) for (const ex of d.exercises)
    for (const s of ex.sets) if (s.status === 'success' && !((s.weight ?? 0) > 0)) n++;
  return n;
}
function _hasAnySuccess(week) {
  return week.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success')));
}
const VOLUME_STABLE_BAND = 5; // Prozent — eigene Wahl

export function computeVolumeTrend(state, N = 8) {
  const half = Math.max(2, Math.round(N / 2));
  const weeks = _nonDeloadVacationWeeks(state).filter(_hasAnySuccess);
  if (weeks.length < N) return null;
  const last = weeks.slice(-half);
  const prev = weeks.slice(-N, -half);
  const sum = (arr, fn) => arr.reduce((s, w) => s + fn(w), 0);
  const curVol  = sum(last, _weightVolume);
  const prevVol = sum(prev, _weightVolume);
  let pct = null, direction = null;
  if (prevVol > 0) {
    pct = Math.round((curVol - prevVol) / prevVol * 100);
    direction = Math.abs(pct) < VOLUME_STABLE_BAND ? 'stable' : pct > 0 ? 'up' : 'down';
  }
  const relSetsAvg = Math.round(sum(last, _relativeVolumeSetCount) / last.length);
  const relRepsTotal = sum(last, _relativeVolumeReps);
  return { curVol, prevVol, pct, direction, hasRelative: relSetsAvg > 0 && relRepsTotal > 0, relSetsAvg, halfN: half };
}

// ─── Breite ──────────────────────────────────────────────────────────────────
// "Fortschritt in einer Kategorie" = mind. eine Übung dieser Kategorie hat
// eine positive histRate (gesamte verfügbare Historie) UND >=min(6,N) Wochen
// Daten (via _exerciseRateWindow(), liefert sonst null). Kategorien ganz ohne
// trainierte Übung ODER ohne irgendeine Übung mit genug Historie werden
// nicht gezeigt (deckt "Carry bei fehlenden Daten still ausblenden" ab,
// generalisiert auf alle Kategorien — kein "0 von 1").
export function computeBreadthProgress(state, N = 8) {
  const allSorted = _nonDeloadVacationWeeks(state);
  const sorted = allSorted.slice(-N);
  const exNames = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.substituteFor ?? e.name))))];

  const byCat = {};
  for (const name of exNames) {
    const cat = MOVEMENT_MAP[name];
    if (!cat || !RADAR_CATS.includes(cat)) continue;
    (byCat[cat] ??= []).push(name);
  }

  const dataCats = [];
  const progressedCats = [];
  for (const cat of RADAR_CATS) {
    const names = byCat[cat] ?? [];
    if (!names.length) continue;
    let hasEnoughData = false, hasProgress = false;
    for (const name of names) {
      const rw = _exerciseRateWindow(sorted, name, N);
      if (!rw) continue;
      hasEnoughData = true;
      if (rw.histRate > 0) hasProgress = true;
    }
    if (!hasEnoughData) continue;
    dataCats.push(cat);
    if (hasProgress) progressedCats.push(cat);
  }

  if (dataCats.length < 2) return null;
  return {
    progressedCount: progressedCats.length,
    totalCount: dataCats.length,
    progressedCats,
    otherCats: dataCats.filter(c => !progressedCats.includes(c)),
  };
}
