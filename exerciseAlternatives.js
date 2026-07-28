/**
 * Kuratierte Alternativübungen für "Heute anders" (Option C, Sprint 2026-07).
 * Importfrei (Tiefe 0), wie movementMap.js — reine Datenquelle + ein Helper.
 * Ergänzt (nicht ersetzt) die bestehende, historienbasierte
 * state.substituteHistory-Vorschlagsliste (B109/D2, ui.js) — beide werden
 * im "Heute anders"-Dialog nebeneinander angezeigt.
 */

export const EXERCISE_ALTERNATIVES = {
  'Bankdrücken': ['Schrägbankdrücken', 'Kurzhantel-Bankdrücken', 'Dips', 'Floor Press'],
  'Kniebeuge': ['Bulgarian Split Squat', 'Goblet Squat', 'Hack Squat', 'Box Squat', 'Leg Press'],
  'Kreuzheben': ['Romanian Deadlift', 'Trap Bar Deadlift', 'Good Morning', 'Sumo Deadlift', 'Rack Pull'],
  'Klimmzüge': ['Lat Pulldown', 'Assisted Pull-Up', 'Rudern'],
  'Schulterdrücken': ['Kurzhantel-Schulterdrücken', 'Arnold Press', 'Landmine Press', 'Z-Press'],
  'Rudern': ['Kurzhantel-Rudern', 'Sitzrudern', 'T-Bar Rudern', 'Pendlay Row'],
  'Dips': ['Trizeps-Pushdown', 'Close Grip Bench Press', 'Skull Crusher'],
  'Bizepscurl': ['Hammer Curl', 'Preacher Curl', 'Cable Curl'],
  'Beinpresse': ['Kniebeuge', 'Hack Squat', 'Bulgarian Split Squat'],
  'Romanian Deadlift': ['Good Morning', 'Stiff Leg Deadlift', 'Nordic Curl'],
  'Hip Thrust': ['Glute Bridge', 'Donkey Kick'],
  'Face Pull': ['Band Pull Apart', 'Reverse Fly'],
  'Trizeps-Pushdown': ['Skull Crusher', 'Overhead Extension', 'Dips'],
  'Ausfallschritte': ['Bulgarian Split Squat', 'Step-Up', 'Reverse Lunge'],
  'Wadenheben': ['Sitzende Wadenübung', 'Einbeiniges Wadenheben'],
  'Lat Pulldown': ['Klimmzüge', 'Assisted Pull-Up'],
  'Schrägbankdrücken': ['Bankdrücken', 'Kurzhantel-Schrägbank', 'Cable Fly'],
  'Sled Push': ['Bulgarian Split Squat', 'Leg Press', 'Ausfallschritte'],
  'Plank': ['Ab Wheel', 'Hollow Body', 'Pallof Press'],
  'OHP': ['Kurzhantel-Schulterdrücken', 'Arnold Press', 'Push Press'],

  // Englische Synonyme (wichtigste):
  'Bench Press': ['Bankdrücken', 'Incline Press', 'Dips'],
  'Squat': ['Kniebeuge', 'Bulgarian Split Squat', 'Goblet Squat'],
  'Deadlift': ['Romanian Deadlift', 'Trap Bar Deadlift', 'Good Morning'],
  'Pull-Up': ['Klimmzüge', 'Lat Pulldown', 'Cable Row'],
};

/**
 * Liefert Alternativ-Vorschläge für eine Übung: nutzerdefinierte zuerst
 * (state.customAlternatives[exName]), dann vordefinierte
 * (EXERCISE_ALTERNATIVES[exName]), kombiniert und dedupliziert (exakter
 * Namensvergleich, erstes Vorkommen gewinnt).
 *
 * @param {string} exName
 * @param {Object} state
 * @returns {string[]}
 */
export function getAlternatives(exName, state) {
  const custom = state?.customAlternatives?.[exName] ?? [];
  const predefined = EXERCISE_ALTERNATIVES[exName] ?? [];
  const seen = new Set();
  const result = [];
  for (const name of [...custom, ...predefined]) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}
