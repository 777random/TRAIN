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
  'KH Flys': 'Push', 'Flys Kabel': 'Push',
  'Klimmzüge': 'Pull', 'Latziehen': 'Pull', 'Lat Maschine': 'Pull',
  'Kabelrudern': 'Pull', 'Rudern': 'Pull', 'Rudern Maschine': 'Pull',
  'KH Rudern': 'Pull', 'T-Bar Rudern': 'Pull', 'Pendlay Row': 'Pull',
  'Kabelbizeps': 'Pull', 'Bizepscurls': 'Pull', 'Hammercurls': 'Pull',
  'Konzentrationscurls': 'Pull', 'Butterfly': 'Pull', 'Face Pulls': 'Pull',
  'Reverse Flys': 'Pull', 'Frontheben': 'Pull', 'Seitheben': 'Pull',
  'KH Shrugs': 'Pull',
  'Kniebeuge': 'Squat', 'Frontkniebeuge': 'Squat', 'Bulgarische Kniebeuge': 'Squat',
  'Beinpresse': 'Squat', 'Hack Squat': 'Squat', 'Smith Maschine Kniebeuge': 'Squat',
  'Beinstrecker': 'Squat', 'Beinbeuger': 'Squat', 'Ausfallschritte': 'Squat',
  'Box Jumps': 'Squat', 'KB Goblet Squat': 'Squat',
  'Kreuzheben': 'Hinge', 'Rumänisches Kreuzheben': 'Hinge', 'Sumo Kreuzheben': 'Hinge',
  'Hip Thrust': 'Hinge', 'KB Swings': 'Hinge', 'Kettlebell Swings': 'Hinge',
  'KB Clean': 'Hinge', 'KB Snatch': 'Hinge', 'KB Turkish Get-Up': 'Hinge',
  'KB Windmill': 'Hinge', 'Wadenheben': 'Hinge',
  'KB Carry': 'Carry',
  'Plank': 'Core', 'Crunch': 'Core', 'Situps': 'Core', 'Beinheben': 'Core',
  'Ab-Wheel': 'Core', 'Cable Crunches': 'Core', 'Russian Twists': 'Core',
  'Hollow Hold': 'Core', 'Pallof Press': 'Core', 'Battle Ropes': 'Core',
  'Burpees': 'Core', 'Broad Jumps': 'Core',
};
