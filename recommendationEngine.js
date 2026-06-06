/**
 * recommendationEngine.js – Generates concrete coach recommendations.
 *
 * The insight evaluators already embed recommendations inline for most cases.
 * This module provides an override layer for recommendations that need
 * runtime state or user-specific values beyond what the evaluator can access.
 */

const RECOMMENDATIONS = [
  {
    insightId: 'S-01',
    generate: (meta) =>
      `Versuche nächste Woche +${meta.weightStep ?? 2.5} kg im ersten Satz. ` +
      `Wenn du ${meta.targetReps ?? 8} Wdh schaffst, bleib dabei.`,
  },
  {
    insightId: 'Z-03',
    generate: (meta) => {
      const realistic = Math.round((meta.avgPct ?? 0.7) * (meta.targetReps ?? 10) * 1.1);
      return `Setze das Ziel auf ${meta.targetSets ?? '?'}×${realistic} – ` +
             `das liegt 10% über deinem aktuellen Durchschnitt.`;
    },
  },
  {
    insightId: 'K-02',
    generate: () =>
      'Reduziere in Woche 1 das Gewicht auf 80% und steigere erst ab Woche 2 wieder.',
  },
  {
    insightId: 'B-01',
    generate: () =>
      'Tausche eine Push-Übung gegen eine Ruder-Variation – z.B. einarmiges Kabelrudern oder Pendlay Row.',
  },
];

/**
 * Get a recommendation string for a given insight ID.
 * Falls back to the insight's own recommendation field if no override exists.
 *
 * @param {string} insightId
 * @param {object} meta – parameters from the insight result
 * @returns {string|null}
 */
export function getRecommendation(insightId, meta = {}) {
  const rec = RECOMMENDATIONS.find(r => r.insightId === insightId);
  return rec ? rec.generate(meta) : null;
}
