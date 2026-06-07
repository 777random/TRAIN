/**
 * insightEngine.js – Coaching insight library for TRAIN.
 *
 * Each INSIGHT is a pure object: evaluate(state, event) → result | null.
 * null means the condition is not met; the insight is irrelevant right now.
 *
 * result shape:
 *   { id, type, priority, immediate?, title, message, recommendation? }
 *
 * Types: progression | stagnation | recovery | balance | goal | consistency | warning | motivation
 * immediate: true → ui.js also shows a toast for this insight
 */

import { getWeightRecommendation } from './weightRecommendation.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getSortedWeeks(state) {
  return [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function getCompletionRate(wk) {
  let total = 0, done = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      for (const s of ex.sets) { total++; if (s.status === 'success') done++; }
  return total > 0 ? done / total : 0;
}

function getDoneDays(sortedWeeks) {
  return sortedWeeks.flatMap(w => w.days.filter(d => d.markedDone));
}

function trueVol(wk) {
  return wk.days.reduce((s, d) =>
    s + d.exercises.reduce((ss, ex) =>
      ss + ex.sets.filter(st => st.status === 'success')
               .reduce((sss, st) => sss + (st.weight ?? 0) * (st.reps ?? 0), 0), 0), 0);
}

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86_400_000);
}

// Max success-set weight per week for a named exercise (0 if absent)
function exWeightHistory(sortedWeeks, exName) {
  return sortedWeeks.map(wk => {
    let max = 0;
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === exName)
          for (const s of ex.sets)
            if (s.status === 'success' && (s.weight ?? 0) > max) max = s.weight;
    return max;
  });
}

// Average RPE of success sets for an exercise in a week, optionally at a given weight
function exAvgRpe(wk, exName, targetWeight) {
  const rpes = [];
  for (const d of wk.days)
    for (const ex of d.exercises)
      if (ex.name === exName)
        for (const s of ex.sets)
          if (s.status === 'success' && s.rpe != null)
            if (targetWeight == null || Math.abs((s.weight ?? 0) - targetWeight) < 0.5)
              rpes.push(s.rpe);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

// Average RPE across all success sets in a week
function avgRpeWeek(wk) {
  const rpes = wk.days.flatMap(d =>
    d.exercises.flatMap(ex =>
      ex.sets.filter(s => s.status === 'success' && s.rpe != null).map(s => s.rpe)
    )
  );
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

// Count success sets tagged with a specific tag in a week
function countTagSets(wk, tag) {
  let n = 0;
  for (const d of wk.days)
    for (const ex of d.exercises)
      if ((ex.tags ?? []).includes(tag))
        n += ex.sets.filter(s => s.status === 'success').length;
  return n;
}

// ─── Insight definitions ──────────────────────────────────────────────────────

export const INSIGHTS = [

  // ── P-05: New weight PR ────────────────────────────────────────────────────
  {
    id: 'P-05', priority: 1, type: 'progression',
    trigger: ['SATZ_ABGEHAKT'],
    evaluate(state, event) {
      const { di, ei, si } = event.payload;
      const wk = state.weeks[state.curIdx];
      if (!wk || wk.mode === 'deload') return null;
      const ex = wk.days[di]?.exercises[ei];
      const s  = ex?.sets[si];
      if (!s || s.status !== 'success') return null;
      const weight = parseFloat(s.weight) || 0;
      if (weight <= 0) return null;
      const pr = (state.prs ?? {})[ex.name];
      if (!pr) return null;
      const today = new Date().toISOString().split('T')[0];
      if (pr.date !== today || Math.abs(pr.maxWeight - weight) > 0.01) return null;
      return {
        id: 'P-05', type: 'progression', priority: 1, immediate: true,
        title: 'Neue Bestleistung',
        message: `${ex.name}: ${weight} kg – dein bisher schwerster Satz.`,
        recommendation: null,
      };
    },
  },

  // ── Z-01: One set remaining to hit daily target ───────────────────────────
  {
    id: 'Z-01', priority: 3, type: 'goal',
    trigger: ['SATZ_ABGEHAKT'],
    evaluate(state, event) {
      const { di, ei } = event.payload;
      const wk = state.weeks[state.curIdx];
      if (!wk) return null;
      const ex = wk.days[di]?.exercises[ei];
      if (!ex || ex.sets.length <= 1) return null;
      const done = ex.sets.filter(s => s.status === 'success').length;
      if (done !== ex.sets.length - 1) return null;
      return {
        id: 'Z-01', type: 'goal', priority: 3, immediate: true,
        title: 'Fast am Ziel',
        message: `Noch 1 Satz bis zu deinem Tagesziel bei ${ex.name}.`,
        recommendation: null,
      };
    },
  },

  // ── E-01: 3 consecutive sessions rated "exhausted" ────────────────────────
  {
    id: 'E-01', priority: 8, type: 'recovery',
    trigger: ['TAG_ABGESCHLOSSEN', 'APP_GEÖFFNET'],
    evaluate(state) {
      const doneDays = getDoneDays(getSortedWeeks(state));
      const last3 = doneDays.slice(-3);
      if (last3.length < 3 || !last3.every(d => d.sessionRating === 1)) return null;
      return {
        id: 'E-01', type: 'recovery', priority: 8, immediate: true,
        title: 'Erschöpfungs-Trend',
        message: 'Du hast die letzten 3 Einheiten als erschöpfend bewertet.',
        recommendation: 'Schau dir diese Woche Schlaf und Ernährung genauer an – manchmal erklärt das viel.',
      };
    },
  },

  // ── E-04: 3 consecutive sessions rated "strong" ───────────────────────────
  {
    id: 'E-04', priority: 12, type: 'recovery',
    trigger: ['TAG_ABGESCHLOSSEN', 'APP_GEÖFFNET'],
    evaluate(state) {
      const doneDays = getDoneDays(getSortedWeeks(state));
      const last3 = doneDays.slice(-3);
      if (last3.length < 3 || !last3.every(d => d.sessionRating === 3)) return null;
      return {
        id: 'E-04', type: 'recovery', priority: 12, immediate: true,
        title: 'Starke Form',
        message: 'Du hast die letzten 3 Einheiten als stark bewertet – offensichtlich läuft gerade alles zusammen.',
        recommendation: null,
      };
    },
  },

  // ── W-01: >30% failed sets in a completed day ──────────────────────────────
  {
    id: 'W-01', priority: 13, type: 'warning',
    trigger: ['TAG_ABGESCHLOSSEN'],
    evaluate(state, event) {
      const { di } = event.payload;
      const day = state.weeks[state.curIdx]?.days[di];
      if (!day) return null;
      const allSets = day.exercises.flatMap(ex => ex.sets);
      const total   = allSets.length;
      const failed  = allSets.filter(s => s.status === 'fail').length;
      if (total === 0 || failed / total <= 0.3) return null;
      const pct = Math.round(failed / total * 100);
      return {
        id: 'W-01', type: 'warning', priority: 13, immediate: true,
        title: 'Viele fehlgeschlagene Sätze',
        message: `Heute ${pct}% der Sätze nicht abgeschlossen – das ist ungewöhnlich für dich.`,
        recommendation: 'Kein Grund zur Sorge. Schau ob Schlaf, Stress oder Ernährung heute eine Rolle gespielt haben.',
      };
    },
  },

  // ── K-02: Return after >14-day gap ────────────────────────────────────────
  {
    id: 'K-02', priority: 2, type: 'consistency',
    trigger: ['NEUE_WOCHE_ERSTELLT', 'APP_GEÖFFNET'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 2) return null;
      const gap = daysBetween(sorted[sorted.length - 2].startDate, sorted[sorted.length - 1].startDate);
      if (gap <= 14) return null;
      const weeks = Math.round(gap / 7);
      return {
        id: 'K-02', type: 'consistency', priority: 2, immediate: true,
        title: 'Wiedereinstieg',
        message: `${weeks} Wochen Pause – willkommen zurück. Starte mit ~80% deiner letzten Gewichte.`,
        recommendation: 'Reduziere in Woche 1 das Gewicht auf 80% und steigere erst ab Woche 2 wieder.',
      };
    },
  },

  // ── P-01: Weight increase over 3+ weeks ───────────────────────────────────
  {
    id: 'P-01', priority: 5, type: 'progression',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 3) return null;
      const exNames = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      let best = null, bestDelta = 0;
      for (const name of exNames) {
        const history = exWeightHistory(sorted, name).filter(w => w > 0);
        if (history.length < 3) continue;
        const first = history[0], last = history[history.length - 1];
        if (last <= first) continue;
        const delta = Math.round((last - first) / first * 1000) / 10;
        if (delta > bestDelta) { bestDelta = delta; best = { name, first, last, delta, weeks: history.length }; }
      }
      if (!best || bestDelta < 2) return null;
      return {
        id: 'P-01', type: 'progression', priority: 5,
        title: 'Gewichtssteigerung',
        message: `Dein ${best.name} ist in den letzten ${best.weeks} Wochen von ${best.first} kg auf ${best.last} kg gestiegen – +${best.delta}%.`,
        recommendation: null,
      };
    },
  },

  // ── P-02: Rep increase at same weight ─────────────────────────────────────
  {
    id: 'P-02', priority: 7, type: 'progression',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 3) return null;
      const exNames = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      let best = null, bestGain = 0;
      for (const name of exNames) {
        const perWeek = sorted.map(wk => {
          const sets = wk.days.flatMap(d => d.exercises.filter(e => e.name === name).flatMap(e => e.sets.filter(s => s.status === 'success')));
          if (!sets.length) return null;
          return { weight: Math.max(...sets.map(s => s.weight ?? 0)), reps: Math.max(...sets.map(s => s.reps ?? 0)) };
        }).filter(Boolean);
        if (perWeek.length < 3) continue;
        // Find modal weight
        const ws = perWeek.map(d => d.weight);
        const modal = ws.sort((a, b) => ws.filter(v => v === b).length - ws.filter(v => v === a).length)[0];
        const atW = perWeek.filter(d => Math.abs(d.weight - modal) < 0.5);
        if (atW.length < 3) continue;
        const gain = atW[atW.length - 1].reps - atW[0].reps;
        if (gain > bestGain) { bestGain = gain; best = { name, weight: modal, firstReps: atW[0].reps, lastReps: atW[atW.length - 1].reps }; }
      }
      if (!best || bestGain < 2) return null;
      return {
        id: 'P-02', type: 'progression', priority: 7,
        title: 'Wiederholungssteigerung',
        message: `${best.name}: Du schaffst jetzt ${best.lastReps} Wdh mit ${best.weight} kg – vor einigen Wochen waren es ${best.firstReps}.`,
        recommendation: null,
      };
    },
  },

  // ── P-03: RPE decrease at same weight ─────────────────────────────────────
  {
    id: 'P-03', priority: 11, type: 'progression',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 3) return null;
      const exNames = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      let best = null, bestDrop = 0;
      for (const name of exNames) {
        const wHist = exWeightHistory(sorted, name).filter(w => w > 0);
        if (!wHist.length) continue;
        const refW = wHist[Math.floor(wHist.length / 2)];
        const rpeHist = sorted.map(wk => exAvgRpe(wk, name, refW)).filter(r => r != null);
        if (rpeHist.length < 3) continue;
        const drop = rpeHist[0] - rpeHist[rpeHist.length - 1];
        if (drop > bestDrop) { bestDrop = drop; best = { name, weight: refW, first: Math.round(rpeHist[0] * 10) / 10, last: Math.round(rpeHist[rpeHist.length - 1] * 10) / 10 }; }
      }
      if (!best || bestDrop < 0.5) return null;
      return {
        id: 'P-03', type: 'progression', priority: 11,
        title: 'RPE-Rückgang',
        message: `${best.name} mit ${best.weight} kg kostet dich jetzt RPE ${best.last} statt RPE ${best.first} – du wirst stärker.`,
        recommendation: null,
      };
    },
  },

  // ── P-04: Muscle-group volume PR this week ────────────────────────────────
  {
    id: 'P-04', priority: 9, type: 'progression',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 2) return null;
      const curWk  = sorted[sorted.length - 1];
      const prevWks = sorted.slice(0, -1);
      const tags = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.flatMap(ex => ex.tags ?? []))))];
      let best = null, bestPct = 0;
      for (const tag of tags) {
        const cur  = countTagSets(curWk, tag);
        if (cur === 0) continue;
        const prev = Math.max(...prevWks.map(wk => countTagSets(wk, tag)), 0);
        if (prev === 0 || cur <= prev) continue;
        const pct = Math.round((cur - prev) / prev * 100);
        if (pct > bestPct) { bestPct = pct; best = { tag, cur, prev }; }
      }
      if (!best) return null;
      return {
        id: 'P-04', type: 'progression', priority: 9,
        title: 'Volumen-Rekord',
        message: `Diese Woche hast du mehr ${best.tag}-Sätze absolviert als je zuvor: ${best.cur} Sätze.`,
        recommendation: null,
      };
    },
  },

  // ── P-06: Completion rate ≥90% for last 4 weeks ───────────────────────────
  {
    id: 'P-06', priority: 15, type: 'progression',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 4) return null;
      if (!sorted.slice(-4).every(wk => getCompletionRate(wk) >= 0.9)) return null;
      return {
        id: 'P-06', type: 'progression', priority: 15,
        title: 'Konstant stark',
        message: 'Deine Abschlussquote liegt seit 4 Wochen über 90% – du bist auf einem sehr guten Level.',
        recommendation: null,
      };
    },
  },

  // ── S-01: Same weight for 4 weeks (non-deload) ────────────────────────────
  {
    id: 'S-01', priority: 7, type: 'stagnation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 4) return null;
      const last4 = sorted.slice(-4);
      const exNames = [...new Set(last4.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      for (const name of exNames) {
        const weights = last4.map(wk => {
          const sets = wk.days.flatMap(d => d.exercises.filter(e => e.name === name).flatMap(e => e.sets.filter(s => s.status === 'success')));
          return sets.length ? Math.max(...sets.map(s => s.weight ?? 0)) : 0;
        });
        if (weights.some(w => w === 0)) continue;
        const base = weights[0];
        if (base > 0 && weights.every(w => Math.abs(w - base) < 0.1))
          return {
            id: 'S-01', type: 'stagnation', priority: 7,
            title: 'Stagnation',
            message: `${name}: Seit 4 Wochen dasselbe Gewicht (${base} kg). Bereit für den nächsten Schritt?`,
            recommendation: 'Versuche nächste Woche im ersten Satz +2,5 kg. Wenn du dein Mindestziel erreichst, bleib dabei.',
          };
      }
      return null;
    },
  },

  // ── S-02: RPE increasing at same weight over 3 weeks ─────────────────────
  {
    id: 'S-02', priority: 14, type: 'stagnation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 3) return null;
      const last3 = sorted.slice(-3);
      const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      for (const name of exNames) {
        const wh = exWeightHistory(last3, name);
        if (wh.some(w => w === 0) || !wh.every(w => Math.abs(w - wh[0]) < 0.1)) continue;
        const rpes = last3.map(wk => exAvgRpe(wk, name, wh[0]));
        if (rpes.some(r => r == null)) continue;
        if (rpes[0] < rpes[1] && rpes[1] < rpes[2])
          return {
            id: 'S-02', type: 'stagnation', priority: 14,
            title: 'Steigende Anstrengung',
            message: `Deine ${name} kostet dich mehr Kraft als vor 3 Wochen – gleiche Last, höhere RPE.`,
            recommendation: 'Schau auf Schlaf und Regeneration diese Woche – das könnte erklären warum es schwerer fällt.',
          };
      }
      return null;
    },
  },

  // ── S-03: Rep decrease at same weight over 3 weeks ───────────────────────
  {
    id: 'S-03', priority: 13, type: 'stagnation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 3) return null;
      const last3 = sorted.slice(-3);
      const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      for (const name of exNames) {
        const wh = exWeightHistory(last3, name);
        if (wh.some(w => w === 0) || !wh.every(w => Math.abs(w - wh[0]) < 0.1)) continue;
        const maxReps = last3.map(wk => {
          let max = 0;
          for (const d of wk.days)
            for (const ex of d.exercises)
              if (ex.name === name)
                for (const s of ex.sets)
                  if (s.status === 'success' && (s.reps ?? 0) > max) max = s.reps;
          return max;
        });
        if (maxReps.some(r => r === 0)) continue;
        if (maxReps[0] > maxReps[1] && maxReps[1] > maxReps[2])
          return {
            id: 'S-03', type: 'stagnation', priority: 13,
            title: 'Wiederholungsrückgang',
            message: `${name}: Du schaffst diese Woche nur noch ${maxReps[2]} Wdh statt ${maxReps[0]} vor 3 Wochen.`,
            recommendation: 'Halte das Gewicht diese Woche konstant und fokussiere dich auf vollständige Sätze.',
          };
      }
      return null;
    },
  },

  // ── S-04: Completion rate drops vs. 8-week average ───────────────────────
  {
    id: 'S-04', priority: 10, type: 'stagnation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 5) return null;
      const last3 = sorted.slice(-3);
      const prev  = sorted.slice(-8, -3);
      if (prev.length < 2) return null;
      const avg3 = last3.reduce((s, w) => s + getCompletionRate(w), 0) / last3.length;
      const avg8 = prev.reduce((s, w) => s + getCompletionRate(w), 0) / prev.length;
      if (avg3 >= avg8 - 0.1) return null;
      return {
        id: 'S-04', type: 'stagnation', priority: 10,
        title: 'Abschlussquote sinkt',
        message: `Deine Abschlussquote ist in den letzten 3 Wochen von ${Math.round(avg8*100)}% auf ${Math.round(avg3*100)}% gefallen.`,
        recommendation: 'Prüfe ob der Plan noch zu deinem Alltag passt – manchmal ist weniger mehr.',
      };
    },
  },

  // ── S-05: Hits target but no weight progress for 5 weeks ──────────────────
  {
    id: 'S-05', priority: 11, type: 'stagnation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.mode !== 'deload');
      if (sorted.length < 5) return null;
      const last5 = sorted.slice(-5);
      const exNames = [...new Set(last5.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      for (const name of exNames) {
        const allHit = last5.every(wk => {
          for (const d of wk.days)
            for (const ex of d.exercises)
              if (ex.name === name)
                return ex.sets.filter(s => s.status === 'success').length >= ex.sets.length;
          return false;
        });
        if (!allHit) continue;
        const wh = exWeightHistory(last5, name);
        if (wh.some(w => w === 0) || !wh.every(w => Math.abs(w - wh[0]) < 0.1)) continue;
        const wk = last5[4];
        for (const d of wk.days)
          for (const ex of d.exercises)
            if (ex.name === name && ex.targetReps)
              return {
                id: 'S-05', type: 'stagnation', priority: 11,
                title: 'Ziel erreicht – nächster Schritt?',
                message: `${name}: Du erreichst dein Ziel von ${ex.sets.length}×${ex.targetReps} konstant – bereit für mehr?`,
                recommendation: `Erhöhe das Ziel auf ${ex.sets.length}×${(ex.targetReps ?? 0) + 2} oder füge ein zusätzliches Set hinzu.`,
              };
      }
      return null;
    },
  },

  // ── E-02: Sleep correlates with completion rate ───────────────────────────
  {
    id: 'E-02', priority: 16, type: 'recovery',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state).filter(w => w.bodyData?.sleep != null);
      if (sorted.length < 6) return null;
      const threshold = 7;
      const withS    = sorted.filter(w => w.bodyData.sleep >= threshold);
      const withoutS = sorted.filter(w => w.bodyData.sleep < threshold);
      if (withS.length < 2 || withoutS.length < 2) return null;
      const avgWith    = withS.reduce((s, w) => s + getCompletionRate(w), 0) / withS.length;
      const avgWithout = withoutS.reduce((s, w) => s + getCompletionRate(w), 0) / withoutS.length;
      if (Math.abs(avgWith - avgWithout) < 0.1) return null;
      return {
        id: 'E-02', type: 'recovery', priority: 16,
        title: 'Schlaf & Leistung',
        message: `In Wochen mit ${threshold}h+ Schlaf lag deine Abschlussquote bei ${Math.round(avgWith*100)}%, sonst bei ${Math.round(avgWithout*100)}%.`,
        recommendation: null,
      };
    },
  },

  // ── E-03: Deload effect visible in RPE ────────────────────────────────────
  {
    id: 'E-03', priority: 17, type: 'recovery',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 3) return null;
      const deloadIdx = [...sorted.keys()].reverse().find(i => sorted[i].mode === 'deload');
      if (deloadIdx == null || deloadIdx >= sorted.length - 1) return null;
      const afterWk = sorted[deloadIdx + 1];
      if (afterWk !== sorted[sorted.length - 1]) return null;
      const beforeWks = sorted.slice(0, deloadIdx).filter(w => w.mode !== 'deload').slice(-2);
      if (!beforeWks.length) return null;
      const rpeAfter  = avgRpeWeek(afterWk);
      const rpeBefore = beforeWks.reduce((s, w) => s + (avgRpeWeek(w) ?? 0), 0) / beforeWks.length;
      if (rpeAfter == null || rpeBefore === 0) return null;
      const drop = Math.round((rpeBefore - rpeAfter) * 10) / 10;
      if (drop < 0.3) return null;
      return {
        id: 'E-03', type: 'recovery', priority: 17,
        title: 'Deload-Wirkung',
        message: `Deine RPE-Werte sind nach der Deload-Woche im Schnitt ${drop} Punkte niedriger – die Pause hat gewirkt.`,
        recommendation: null,
      };
    },
  },

  // ── B-01: Push/Pull imbalance ─────────────────────────────────────────────
  {
    id: 'B-01', priority: 9, type: 'balance',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (!sorted.length) return null;
      const curWk = sorted[sorted.length - 1];
      const push  = countTagSets(curWk, 'Push');
      const pull  = countTagSets(curWk, 'Pull');
      if (push === 0 || pull === 0) return null;
      const ratio = Math.round(push / pull * 10) / 10;
      if (ratio >= 0.5 && ratio <= 2) return null;
      return {
        id: 'B-01', type: 'balance', priority: 9,
        title: 'Push/Pull-Verhältnis',
        message: `Diese Woche: ${push} Push-Sätze, ${pull} Pull-Sätze – dein Verhältnis ist ${ratio}:1.`,
        recommendation: 'Ein ausgeglichenes Verhältnis (0,5:1 bis 2:1) reduziert Verletzungsrisiko an Schultern. Tausche eine Push-Übung gegen eine Pull-Übung.',
      };
    },
  },

  // ── B-02: No sets in a movement pattern for 4 weeks ──────────────────────
  {
    id: 'B-02', priority: 14, type: 'balance',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 4) return null;
      const last4 = sorted.slice(-4);
      for (const pattern of ['Push', 'Pull', 'Hinge', 'Squat', 'Carry']) {
        if (!last4.some(wk => countTagSets(wk, pattern) > 0))
          return {
            id: 'B-02', type: 'balance', priority: 14,
            title: 'Bewegungsmuster-Lücke',
            message: `In den letzten 4 Wochen kein einziges ${pattern}-Movement in deinem Plan.`,
            recommendation: `${pattern}-Bewegungen sind wichtig für ausgeglichene Kraft. Füge 3 Sätze hinzu.`,
          };
      }
      return null;
    },
  },

  // ── B-03: One day consistently not completed ──────────────────────────────
  {
    id: 'B-03', priority: 17, type: 'balance',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 4) return null;
      const last4  = sorted.slice(-4);
      const curWk  = sorted[sorted.length - 1];
      for (let di = 0; di < curWk.days.length; di++) {
        if (last4.every(wk => !wk.days[di]?.markedDone))
          return {
            id: 'B-03', type: 'balance', priority: 17,
            title: 'Tag wird übersprungen',
            message: `${curWk.days[di].title} wird in 4 von 4 Wochen nicht abgeschlossen – alle anderen Tage aber schon.`,
            recommendation: 'Überlege ob dieser Tag zeitlich oder inhaltlich besser zu deinem Alltag passen kann.',
          };
      }
      return null;
    },
  },

  // ── B-04: Identical exercise list for 8+ weeks ────────────────────────────
  {
    id: 'B-04', priority: 18, type: 'balance',
    trigger: ['NEUE_WOCHE_ERSTELLT'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 8) return null;
      const last8 = sorted.slice(-8);
      const sets = last8.map(wk =>
        JSON.stringify([...new Set(wk.days.flatMap(d => d.exercises.map(e => e.name)))].sort())
      );
      if (sets.some((s, i) => i > 0 && s !== sets[0])) return null;
      return {
        id: 'B-04', type: 'balance', priority: 18,
        title: 'Übungsvariation',
        message: 'Dein Plan ist seit 8 Wochen identisch – das ist Stärke für Konsistenz, aber der Körper gewöhnt sich an Reize.',
        recommendation: 'Erwäge eine Variation (z.B. Griffbreite, Tempo, Winkel) bei einer Hauptübung.',
      };
    },
  },

  // ── Z-02: Goal overachieved by >10% for 3 weeks ───────────────────────────
  {
    id: 'Z-02', priority: 6, type: 'goal',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 3) return null;
      const last3 = sorted.slice(-3);
      const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      for (const name of exNames) {
        const rates = last3.map(wk => {
          for (const d of wk.days)
            for (const ex of d.exercises)
              if (ex.name === name && ex.targetReps) {
                const target   = ex.sets.length * ex.targetReps;
                const achieved = ex.sets.filter(s => s.status === 'success').reduce((s, set) => s + (set.reps ?? 0), 0);
                return target > 0 ? achieved / target : null;
              }
          return null;
        }).filter(r => r != null);
        if (rates.length < 3 || !rates.every(r => r >= 1.1)) continue;
        const wk = last3[2];
        for (const d of wk.days)
          for (const ex of d.exercises)
            if (ex.name === name)
              return {
                id: 'Z-02', type: 'goal', priority: 6,
                title: 'Ziel konstant übererfüllt',
                message: `Du übertriffst dein ${name}-Ziel seit 3 Wochen – vielleicht Zeit das Ziel anzuheben?`,
                recommendation: `Füge einen weiteren Satz hinzu oder erhöhe das Gewicht.`,
              };
      }
      return null;
    },
  },

  // ── Z-03: Goal under 70% for 4 weeks ─────────────────────────────────────
  {
    id: 'Z-03', priority: 12, type: 'goal',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 4) return null;
      const last4 = sorted.slice(-4);
      const exNames = [...new Set(last4.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      for (const name of exNames) {
        const rates = last4.map(wk => {
          for (const d of wk.days)
            for (const ex of d.exercises)
              if (ex.name === name && ex.targetReps) {
                const target   = ex.sets.length * ex.targetReps;
                const achieved = ex.sets.filter(s => s.status === 'success').reduce((s, set) => s + (set.reps ?? 0), 0);
                return target > 0 ? achieved / target : null;
              }
          return null;
        }).filter(r => r != null);
        if (rates.length < 4 || !rates.every(r => r < 0.7)) continue;
        const avg = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 100);
        const wk  = last4[3];
        for (const d of wk.days)
          for (const ex of d.exercises)
            if (ex.name === name && ex.targetReps) {
              const realistisch = Math.round(ex.targetReps * avg / 100 * 1.1);
              return {
                id: 'Z-03', type: 'goal', priority: 12,
                title: 'Ziel außer Reichweite',
                message: `Dein Ziel bei ${name} (${ex.sets.length}×${ex.targetReps}) liegt seit 4 Wochen außer Reichweite – du erreichst im Schnitt ${avg}%.`,
                recommendation: `Setze das Ziel auf ${ex.sets.length}×${realistisch} – das liegt 10% über deinem aktuellen Durchschnitt.`,
              };
            }
      }
      return null;
    },
  },

  // ── K-01: Streak milestone (5, 10, 15, 20 …) ─────────────────────────────
  {
    id: 'K-01', priority: 4, type: 'consistency',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      let streak = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].days.some(d => d.markedDone)) streak++; else break;
      }
      if (![5, 10, 15, 20, 25, 30, 40, 50].includes(streak)) return null;
      return {
        id: 'K-01', type: 'consistency', priority: 4,
        title: 'Streak-Meilenstein',
        message: `${streak} Wochen am Stück – Konsistenz ist dein größter Fortschritt.`,
        recommendation: null,
      };
    },
  },

  // ── K-03: Best completion rate ever this session ──────────────────────────
  {
    id: 'K-03', priority: 14, type: 'consistency',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 2) return null;
      const curWk  = sorted[sorted.length - 1];
      const curRate = getCompletionRate(curWk);
      const prevMax = Math.max(...sorted.slice(0, -1).map(getCompletionRate));
      if (curRate <= prevMax || curRate < 0.9) return null;
      return {
        id: 'K-03', type: 'consistency', priority: 14,
        title: 'Beste Woche',
        message: `Das war deine bisher vollständigste Woche: ${Math.round(curRate * 100)}% aller Sätze abgehakt.`,
        recommendation: null,
      };
    },
  },

  // ── K-04: Training-day frequency drop ────────────────────────────────────
  {
    id: 'K-04', priority: 18, type: 'consistency',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 8) return null;
      const avg4 = sorted.slice(-4).reduce((s, w) => s + w.days.filter(d => d.markedDone).length, 0) / 4;
      const avg8 = sorted.slice(-8, -4).reduce((s, w) => s + w.days.filter(d => d.markedDone).length, 0) / 4;
      if (avg4 >= avg8 - 0.5) return null;
      return {
        id: 'K-04', type: 'consistency', priority: 18,
        title: 'Frequenz sinkt',
        message: `Durchschnittlich ${Math.round(avg4 * 10) / 10} Trainingstage zuletzt – davor waren es ${Math.round(avg8 * 10) / 10}.`,
        recommendation: null,
      };
    },
  },

  // ── W-02: Completion rate <60% for 5 weeks ────────────────────────────────
  {
    id: 'W-02', priority: 16, type: 'warning',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 5) return null;
      if (!sorted.slice(-5).every(wk => getCompletionRate(wk) < 0.6)) return null;
      return {
        id: 'W-02', type: 'warning', priority: 16,
        title: 'Anhaltende Unterschreitung',
        message: 'Deine Abschlussquote liegt seit 5 Wochen unter 60% – der Plan passt gerade nicht zur Realität.',
        recommendation: 'Überlege ob weniger Tage oder weniger Sätze pro Übung besser zu deinem Alltag passen.',
      };
    },
  },

  // ── W-03: Muscle group with 0 success sets for 3 weeks ───────────────────
  {
    id: 'W-03', priority: 15, type: 'warning',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 3) return null;
      const last3 = sorted.slice(-3);
      const muscle = ['Brust','Rücken','Beine','Schulter','Bizeps','Trizeps','Bauch'];
      const usedTags = new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.flatMap(ex => ex.tags ?? []))));
      for (const tag of muscle.filter(t => usedTags.has(t))) {
        if (!last3.some(wk => countTagSets(wk, tag) > 0))
          return {
            id: 'W-03', type: 'warning', priority: 15,
            title: 'Muskelgruppen-Pause',
            message: `${tag} hatte in den letzten 3 Wochen keine abgehakten Sätze – war das geplant?`,
            recommendation: null,
          };
      }
      return null;
    },
  },

  // ── M-01: Best week of the year (volume) ─────────────────────────────────
  {
    id: 'M-01', priority: 19, type: 'motivation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const year   = new Date().getFullYear().toString();
      const sorted = getSortedWeeks(state).filter(w => w.startDate.startsWith(year));
      if (sorted.length < 2) return null;
      const curWk  = sorted[sorted.length - 1];
      const curVol = trueVol(curWk);
      const prevMax = Math.max(...sorted.slice(0, -1).map(trueVol));
      if (curVol <= prevMax || curVol === 0) return null;
      const done = curWk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.filter(st => st.status === 'success').length, 0), 0);
      return {
        id: 'M-01', type: 'motivation', priority: 19,
        title: 'Bestes Jahr',
        message: `Deine beste Trainingswoche in diesem Jahr – ${done} Sätze, ${Math.round(getCompletionRate(curWk)*100)}% Quote.`,
        recommendation: null,
      };
    },
  },

  // ── M-02: Long-term progress (every 4 weeks) ──────────────────────────────
  {
    id: 'M-02', priority: 20, type: 'motivation',
    trigger: ['NEUE_WOCHE_ERSTELLT'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 12 || sorted.length % 4 !== 0) return null;
      const exNames = [...new Set(sorted.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
      let best = null, bestGain = 0;
      for (const name of exNames) {
        const history = exWeightHistory(sorted, name).filter(w => w > 0);
        if (history.length < 8) continue;
        const gain = history[history.length - 1] - history[0];
        if (gain > bestGain) { bestGain = gain; best = { name, first: history[0], last: history[history.length - 1], weeks: history.length }; }
      }
      if (!best || bestGain < 5) return null;
      const months = Math.round(best.weeks / 4);
      return {
        id: 'M-02', type: 'motivation', priority: 20,
        title: 'Dein Weg',
        message: `Vor ${months} Monaten hast du ${best.name} mit ${best.first} kg trainiert – heute mit ${best.last} kg.`,
        recommendation: null,
      };
    },
  },

  // ── M-03: Strong comeback after a bad week ────────────────────────────────
  {
    id: 'M-03', priority: 21, type: 'motivation',
    trigger: ['WOCHE_ABGESCHLOSSEN'],
    evaluate(state) {
      const sorted = getSortedWeeks(state);
      if (sorted.length < 2) return null;
      const curRate  = getCompletionRate(sorted[sorted.length - 1]);
      const prevRate = getCompletionRate(sorted[sorted.length - 2]);
      if (prevRate >= 0.7 || curRate - prevRate < 0.2) return null;
      return {
        id: 'M-03', type: 'motivation', priority: 21,
        title: 'Comeback',
        message: `Nach einer schwachen Vorwoche (${Math.round(prevRate*100)}%) hast du diese Woche ${Math.round(curRate*100)}% erreicht – starke Reaktion.`,
        recommendation: null,
      };
    },
  },

  // ── A-01: Best weight increase recommendation (top exercise) ─────────────
  {
    id: 'A-01', priority: 3, type: 'progression',
    trigger: ['NEUE_WOCHE_ERSTELLT'],
    evaluate(state) {
      const curWk = state.weeks[state.curIdx];
      if (!curWk) return null;
      const calcWeeks = state.weeks
        .filter(w => w.mode !== 'deload' && w !== curWk)
        .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
      if (calcWeeks.length < 2) return null;
      const exNames = [...new Set(curWk.days.flatMap(d => d.exercises.map(ex => ex.name)))];
      const candidates = [];
      for (const name of exNames) {
        const rec = getWeightRecommendation(name, calcWeeks);
        if (rec && rec.delta > 0) candidates.push({ name, rec });
      }
      candidates.sort((a, b) => b.rec.delta - a.rec.delta);
      const top = candidates[0];
      if (!top) return null;
      return {
        id: 'A-01', type: 'progression', priority: 3,
        title: 'Gewichtssteigerung empfohlen',
        message: `${top.name}: Nächste Woche ${top.rec.recommendedWeight} kg — ${top.rec.reason}`,
        recommendation: 'Tipp beim Erstellen der Woche übernehmen.',
      };
    },
  },

  // ── A-01b: Second-best weight increase recommendation ─────────────────────
  {
    id: 'A-01b', priority: 4, type: 'progression',
    trigger: ['NEUE_WOCHE_ERSTELLT'],
    evaluate(state) {
      const curWk = state.weeks[state.curIdx];
      if (!curWk) return null;
      const calcWeeks = state.weeks
        .filter(w => w.mode !== 'deload' && w !== curWk)
        .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
      if (calcWeeks.length < 2) return null;
      const exNames = [...new Set(curWk.days.flatMap(d => d.exercises.map(ex => ex.name)))];
      const candidates = [];
      for (const name of exNames) {
        const rec = getWeightRecommendation(name, calcWeeks);
        if (rec && rec.delta > 0) candidates.push({ name, rec });
      }
      candidates.sort((a, b) => b.rec.delta - a.rec.delta);
      const second = candidates[1];
      if (!second) return null;
      return {
        id: 'A-01b', type: 'progression', priority: 4,
        title: 'Gewichtssteigerung empfohlen',
        message: `${second.name}: Nächste Woche ${second.rec.recommendedWeight} kg — ${second.rec.reason}`,
        recommendation: 'Tipp beim Erstellen der Woche übernehmen.',
      };
    },
  },

  // ── A-02: Hold-weight recommendation (recovery type, max 1) ───────────────
  {
    id: 'A-02', priority: 8, type: 'recovery',
    trigger: ['NEUE_WOCHE_ERSTELLT'],
    evaluate(state) {
      const curWk = state.weeks[state.curIdx];
      if (!curWk) return null;
      const calcWeeks = state.weeks
        .filter(w => w.mode !== 'deload' && w !== curWk)
        .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
      if (calcWeeks.length < 2) return null;
      const exNames = [...new Set(curWk.days.flatMap(d => d.exercises.map(ex => ex.name)))];
      for (const name of exNames) {
        const rec = getWeightRecommendation(name, calcWeeks);
        if (rec && rec.delta === 0) {
          return {
            id: 'A-02', type: 'recovery', priority: 8,
            title: 'Gewicht halten',
            message: `${name}: Gewicht halten bei ${rec.lastWeight} kg — ${rec.reason}`,
            recommendation: null,
          };
        }
      }
      return null;
    },
  },
];

// ─── Suppression rules ────────────────────────────────────────────────────────

function applySuppressionRules(insights) {
  const hasStagnation = insights.some(i => i.result.type === 'stagnation');
  const seenType = {};

  return insights.filter(i => {
    const t = i.result.type;
    if (hasStagnation && t === 'motivation') return false; // stagnation suppresses motivation
    if ((t === 'warning' || t === 'motivation') && seenType[t]) return false; // max 1 each
    seenType[t] = (seenType[t] ?? 0) + 1;
    if (seenType[t] > 2) return false; // never 3× same type
    return true;
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Evaluate all insights relevant for this event.
 * Returns up to 3 results, priority-sorted, suppression rules applied.
 */
export function evaluateInsights(state, event) {
  const active = INSIGHTS
    .filter(i => i.trigger.includes(event.type))
    .map(i => ({ ...i, result: i.evaluate(state, event) }))
    .filter(i => i.result !== null)
    .sort((a, b) => a.priority - b.priority);

  return applySuppressionRules(active).slice(0, 3);
}
