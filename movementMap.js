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
