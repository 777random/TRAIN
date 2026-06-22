/**
 * surpriseRewards.js – Variable Überraschungs-Belohnungen.
 *
 * 5 Muster werden geprüft; pure Funktionen, keine Seiteneffekte. ui.js ruft
 * checkSurpriseRewards(state) beim App-Öffnen auf, zeigt höchstens einen
 * dezenten Banner und dispatcht danach RECORD_SURPRISE_SHOWN.
 *
 * Wiederverwendete Bausteine (Logik unverändert):
 *   - getSortedWeeks()/exWeightHistory() aus insightEngine.js
 *   - _weekConsistencyRatio()/_consistencyEligibleWeeks()/isInRecoveryWindow()
 *     aus weeklyFocus.js
 *   - "letzte abgeschlossene Woche" = state.weeks[state.curIdx - 1], dieselbe
 *     Konvention wie das bestehende Vorwoche-Banner in ui.js
 *
 * _weekSuccessScorePct() unten ist eine bewusste Mini-Duplizierung von
 * ui.js' _weekSuccessScore() (gleiche Formel: success/(success+fail)×100,
 * pending ausgeschlossen) — ui.js importiert bereits insightEngine.js und
 * weeklyFocus.js, ein Re-Import in die Gegenrichtung wäre zirkulär (gleiches
 * Muster wie overallPerformance.js' _trueVol()).
 */

import { getSortedWeeks, exWeightHistory } from './insightEngine.js';
import { _consistencyEligibleWeeks } from './weeklyFocus.js';

export const SURPRISE_PRIORITY = [
  'strength_double', 'triple_pr', 'consistency_10', 'breadth_week', 'reentry_strong',
];

function _weekSuccessScorePct(week) {
  let succ = 0, fail = 0;
  for (const d of week.days)
    for (const ex of d.exercises)
      for (const s of ex.sets) {
        if (s.status === 'success') succ++;
        else if (s.status === 'fail') fail++;
      }
  const total = succ + fail;
  return total > 0 ? Math.round(succ / total * 100) : 0;
}

function _exerciseNamesInWeek(wk) {
  return [...new Set(wk.days.flatMap(d => d.exercises.map(e => e.name)))];
}

// ─── 1. triple_pr — "Spitzen-Woche" ────────────────────────────────────────
function _checkTriplePr(sorted, lastCompletedWeek) {
  if (!lastCompletedWeek) return null;
  const idx = sorted.findIndex(w => w.id === lastCompletedWeek.id);
  if (idx < 0) return null;
  let prCount = 0;
  for (const name of _exerciseNamesInWeek(lastCompletedWeek)) {
    const history  = exWeightHistory(sorted.slice(0, idx + 1), name);
    const weekMax  = history[history.length - 1];
    const priorMax = Math.max(0, ...history.slice(0, -1));
    if (weekMax > 0 && weekMax > priorMax) prCount++;
  }
  if (prCount < 3) return null;
  return { musterId: 'triple_pr', message: `🏆 Spitzen-Woche — ${prCount} neue Bestleistungen in einer Woche.` };
}

// ─── 2. reentry_strong — "Starker Wiedereinstieg" ──────────────────────────
function _checkReentryStrong(state, sorted) {
  const handledAt = state.lastReentryHandled;
  if (!handledAt || (Date.now() - handledAt) > 14 * 86_400_000) return null;
  const wk = sorted.find(w => handledAt >= new Date(w.startDate + 'T00:00:00').getTime()
    && handledAt < new Date(w.startDate + 'T00:00:00').getTime() + 7 * 86_400_000)
    ?? sorted[sorted.length - 1];
  if (!wk) return null;
  if (_weekSuccessScorePct(wk) < 85) return null;
  return { musterId: 'reentry_strong', message: '💪 Starker Wiedereinstieg — direkt wieder auf Kurs.' };
}

// ─── 3. consistency_10 — "10 Wochen Konsistenz" ────────────────────────────
function _checkConsistency10(state) {
  const eligible = _consistencyEligibleWeeks(state);
  if (eligible.length < 10) return null;
  const last10 = eligible.slice(-10);
  if (!last10.every(r => r.ratio >= 0.7)) return null;
  return { musterId: 'consistency_10', message: '📅 10 Wochen in Folge konsequent — das ist Disziplin.' };
}

// ─── 4. strength_double — "Kraft verdoppelt" ───────────────────────────────
function _checkStrengthDouble(sorted) {
  const exNames = [...new Set(sorted.flatMap(_exerciseNamesInWeek))];
  for (const name of exNames) {
    const history = exWeightHistory(sorted, name);
    const firstWeight = history.find(w => w > 0);
    if (!firstWeight) continue;
    const currentWeight = Math.max(0, ...history);
    if (currentWeight >= 2 * firstWeight) {
      return { musterId: 'strength_double', message: `⚡ ${name} — doppeltes Startgewicht erreicht.` };
    }
  }
  return null;
}

// ─── 5. breadth_week — "Breiten-Woche" ─────────────────────────────────────
function _checkBreadthWeek(sorted, lastCompletedWeek) {
  if (!lastCompletedWeek) return null;
  const idx = sorted.findIndex(w => w.id === lastCompletedWeek.id);
  if (idx < 1) return null;
  const prevWeek = sorted[idx - 1];
  let count = 0;
  for (const name of _exerciseNamesInWeek(lastCompletedWeek)) {
    const weekMax = exWeightHistory([lastCompletedWeek], name)[0];
    const prevMax = exWeightHistory([prevWeek], name)[0];
    if (weekMax > 0 && prevMax > 0 && weekMax > prevMax) count++;
  }
  if (count < 5) return null;
  return { musterId: 'breadth_week', message: `🌟 Breiten-Woche — ${count} Übungen gleichzeitig gesteigert.` };
}

/**
 * Prüft alle 5 Muster, filtert bereits diesen Monat gezeigte (surpriseLog),
 * und gibt höchstens EIN Ergebnis zurück (Priorität: strength_double >
 * triple_pr > consistency_10 > breadth_week > reentry_strong).
 */
export function checkSurpriseRewards(state) {
  const curMonth = new Date().toISOString().slice(0, 7);
  const sorted = getSortedWeeks(state);
  const lastCompletedWeek = state.curIdx > 0 ? state.weeks[state.curIdx - 1] : null;

  const results = {
    triple_pr:        _checkTriplePr(sorted, lastCompletedWeek),
    reentry_strong:   _checkReentryStrong(state, sorted),
    consistency_10:   _checkConsistency10(state),
    strength_double:  _checkStrengthDouble(sorted),
    breadth_week:     _checkBreadthWeek(sorted, lastCompletedWeek),
  };

  for (const id of SURPRISE_PRIORITY) {
    const r = results[id];
    if (!r) continue;
    if ((state.surpriseLog ?? {})[id] === curMonth) continue;
    return r;
  }
  return null;
}
