/**
 * movementMap.js – Übungsname → Bewegungsmuster-Kategorie.
 *
 * Aus ui.js extrahiert (war dort eine private Konstante) in eine eigene,
 * import-freie Datei — wird jetzt sowohl von ui.js (Bewegungsmuster-Radar)
 * als auch von overallPerformance.js (Breite-Dimension) gebraucht. Eine
 * Datei, die von BEIDEN importiert wird, statt ui.js importiert
 * overallPerformance.js UND umgekehrt (zirkulärer Import). Inhalt
 * unverändert übernommen, keine Verhaltensänderung.
 */
export const MOVEMENT_MAP = {
  'Bankdrücken': 'Push', 'Schrägbankdrücken': 'Push', 'Schrägbankdrücken tief': 'Push',
  'Schulterdrücken': 'Push', 'Militärpress': 'Push', 'Kurzhanteldrücken': 'Push',
  'Dips': 'Push', 'Liegestütz': 'Push', 'KB Press': 'Push', 'Push Press': 'Push',
  'Landmine Press': 'Push', 'Chest Press Maschine': 'Push', 'Shoulder Press Maschine': 'Push',
  'Trizepsdips': 'Push', 'Trizepsdrücken': 'Push', 'Skull Crushers': 'Push',
  'KH Flys': 'Push', 'Flys Kabel': 'Push', 'Butterfly': 'Push',
  // Englische Synonyme für bereits vorhandene Push-Übungen oben (Sprint
  // "movementMap.js: fehlende Übungsnamen ergänzen") — reine Zusatz-
  // Schlüssel, keine neue Kategorie.
  'Bench Press': 'Push', 'Incline Bench Press': 'Push', 'Overhead Press': 'Push',
  'Military Press': 'Push', 'Dumbbell Press': 'Push',
  'Push-Up': 'Push', 'Push-Ups': 'Push',
  'Tricep Pushdown': 'Push', 'Triceps Pushdown': 'Push', 'Bench Dips': 'Push',
  'Klimmzüge': 'Pull', 'Latziehen': 'Pull', 'Lat Maschine': 'Pull',
  'Kabelrudern': 'Pull', 'Rudern': 'Pull', 'Rudern Maschine': 'Pull',
  'KH Rudern': 'Pull', 'T-Bar Rudern': 'Pull', 'Pendlay Row': 'Pull',
  'Kabelbizeps': 'Pull', 'Bizepscurls': 'Pull', 'Hammercurls': 'Pull',
  'Konzentrationscurls': 'Pull', 'Face Pulls': 'Pull',
  'Reverse Flys': 'Pull', 'Frontheben': 'Pull', 'Seitheben': 'Pull',
  'KH Shrugs': 'Pull',
  // Englische Synonyme für bereits vorhandene Pull-Übungen oben.
  'Pull-Up': 'Pull', 'Pull-Ups': 'Pull', 'Chin-Up': 'Pull', 'Chin-Ups': 'Pull',
  'Lat Pulldown': 'Pull',
  'Barbell Row': 'Pull', 'BB Row': 'Pull', 'Bent Over Row': 'Pull', 'Bent-Over Row': 'Pull',
  'Cable Row': 'Pull', 'Seated Row': 'Pull',
  'Dumbbell Row': 'Pull', 'DB Row': 'Pull', 'One Arm Row': 'Pull',
  'Bicep Curl': 'Pull', 'Bicep Curls': 'Pull', 'Biceps Curl': 'Pull',
  'Hammer Curl': 'Pull', 'Hammer Curls': 'Pull',
  'Front Raise': 'Pull', 'Front Raises': 'Pull',
  'Lateral Raise': 'Pull', 'Lateral Raises': 'Pull', 'Side Raise': 'Pull',
  'Shrugs': 'Pull', 'Dumbbell Shrugs': 'Pull',
  'Kniebeuge': 'Squat', 'Frontkniebeuge': 'Squat', 'Bulgarische Kniebeuge': 'Squat',
  'Beinpresse': 'Squat', 'Hack Squat': 'Squat', 'Smith Maschine Kniebeuge': 'Squat',
  'Beinstrecker': 'Squat', 'Ausfallschritte': 'Squat',
  'Box Jumps': 'Squat', 'KB Goblet Squat': 'Squat',
  // Englische Synonyme für bereits vorhandene Squat-Übungen oben.
  'Squat': 'Squat', 'Back Squat': 'Squat', 'Barbell Squat': 'Squat', 'Front Squat': 'Squat',
  'Bulgarian Split Squat': 'Squat', 'Split Squat': 'Squat',
  'Leg Press': 'Squat', 'Leg Extension': 'Squat', 'Leg Extensions': 'Squat',
  'Lunge': 'Squat', 'Lunges': 'Squat', 'Walking Lunges': 'Squat',
  'Kreuzheben': 'Hinge', 'Rumänisches Kreuzheben': 'Hinge', 'Sumo Kreuzheben': 'Hinge',
  'Hip Thrust': 'Hinge', 'KB Swings': 'Hinge', 'Kettlebell Swings': 'Hinge',
  'KB Clean': 'Hinge', 'KB Snatch': 'Hinge', 'KB Turkish Get-Up': 'Hinge',
  'KB Windmill': 'Hinge', 'Wadenheben': 'Hinge', 'Beinbeuger': 'Hinge',
  // Englische Synonyme für bereits vorhandene Hinge-Übungen oben.
  'Deadlift': 'Hinge', 'Romanian Deadlift': 'Hinge', 'RDL': 'Hinge', 'Sumo Deadlift': 'Hinge',
  'Calf Raise': 'Hinge', 'Calf Raises': 'Hinge',
  'Leg Curl': 'Hinge', 'Leg Curls': 'Hinge', 'Hamstring Curl': 'Hinge',
  'KB Carry': 'Carry',
  // Englische Synonyme für bereits vorhandene Carry-Übungen oben.
  'Farmer Carry': 'Carry', 'Farmers Carry': 'Carry', 'Kettlebell Carry': 'Carry',
  'Plank': 'Core', 'Crunch': 'Core', 'Situps': 'Core', 'Beinheben': 'Core',
  'Ab-Wheel': 'Core', 'Cable Crunches': 'Core', 'Russian Twists': 'Core',
  'Hollow Hold': 'Core', 'Pallof Press': 'Core', 'Battle Ropes': 'Core',
  'Burpees': 'Core', 'Broad Jumps': 'Core',
  // Englische Synonyme/Schreibvarianten für bereits vorhandene Core-Übungen oben.
  'Sit-Up': 'Core', 'Sit-Ups': 'Core', 'Sit Ups': 'Core', 'Crunches': 'Core',
  'Leg Raise': 'Core', 'Leg Raises': 'Core', 'Hanging Leg Raise': 'Core',
};

/**
 * Baut eine Name→Kategorie-Map aus state.customExercises (nur Einträge mit
 * gesetztem category-Feld — reine Kategorie-Overrides UND vollwertige
 * eigene Übungen mit Kategorie, siehe EX_SET_CATEGORY_OVERRIDE in
 * state.js). Einmal pro Render bauen, dann per resolveCategory() O(1)
 * nachschlagen — nicht pro Übung neu aufbauen.
 *
 * Konsolidierung 2026-07-14: war vorher als identischer 3-Zeilen-Block
 * unabhängig in ui.js UND weeklyFocus.js dupliziert, UND fehlte komplett
 * in overallPerformance.js's computeBreadthProgress() (Kategorie-
 * Overrides wurden dort schlicht ignoriert) — siehe BUGS.md.
 */
export function buildCategoryMap(customExercises) {
  const map = {};
  for (const ce of customExercises ?? []) {
    if (ce.category) map[ce.name] = ce.category;
  }
  return map;
}

/** Löst die Bewegungskategorie einer Übung auf: Override zuerst, dann MOVEMENT_MAP, sonst 'Sonstige'. */
export function resolveCategory(name, categoryMap) {
  return categoryMap[name] ?? MOVEMENT_MAP[name] ?? 'Sonstige';
}

/**
 * Explizite Isolationsübungen (Sprint C1, train-v204) — MOVEMENT_MAP
 * kategorisiert nach BewegungsMUSTER (Push/Pull/Squat/Hinge), nicht nach
 * Compound/Isolation. Viele klassische Isolationsübungen stehen dort unter
 * Push/Pull/Squat/Hinge (z.B. Bizepscurls unter 'Pull', da Zug-Bewegung) —
 * für die Pausenzeiten-Empfehlung (isCompoundExercise() unten) reicht die
 * Kategorie allein daher nicht, diese Liste überschreibt sie gezielt für
 * bekannte Isolationsübungen. Bewusst getrennt von MOVEMENT_MAP (dessen
 * Push/Pull/Squat/Hinge-Semantik von anderer Stelle bereits genutzt wird,
 * z.B. weeklyFocus.js _checkCompoundIsolationBalance() — die bleibt
 * unverändert auf der reinen Kategorie-Heuristik, siehe DECISIONS.md).
 */
const ISOLATION_EXERCISE_NAMES = new Set([
  'Kabelbizeps', 'Bizepscurls', 'Hammercurls', 'Konzentrationscurls',
  'Bicep Curl', 'Bicep Curls', 'Biceps Curl', 'Hammer Curl', 'Hammer Curls',
  'Trizepsdrücken', 'Skull Crushers', 'Tricep Pushdown', 'Triceps Pushdown',
  'KH Flys', 'Flys Kabel', 'Butterfly',
  'Frontheben', 'Seitheben', 'Front Raise', 'Front Raises',
  'Lateral Raise', 'Lateral Raises', 'Side Raise',
  'Face Pulls', 'Reverse Flys',
  'KH Shrugs', 'Shrugs', 'Dumbbell Shrugs',
  'Beinstrecker', 'Leg Extension', 'Leg Extensions',
  'Wadenheben', 'Calf Raise', 'Calf Raises',
  'Beinbeuger', 'Leg Curl', 'Leg Curls', 'Hamstring Curl',
]);

/**
 * Compound (mehrgelenkig) vs. Isolation (eingelenkig) für die Pausenzeiten-
 * Empfehlung (Sprint C1). Prüft zuerst die explizite Isolationsliste oben,
 * fällt sonst auf die Bewegungskategorie zurück: Core/Carry = Isolation,
 * alles andere (inkl. unbekannte Übungen, category 'Sonstige') = Compound
 * — sicherer Fallback laut Sprint-Vorgabe (unbekannt eher zu lang als zu
 * kurz pausieren).
 */
export function isCompoundExercise(name, categoryMap) {
  if (ISOLATION_EXERCISE_NAMES.has(name)) return false;
  const cat = resolveCategory(name, categoryMap);
  return cat !== 'Core' && cat !== 'Carry';
}
