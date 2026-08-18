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
  // movementMap.js-Audit (Runde 34, B2): Leerzeichen-Schreibweise fehlte
  // hier komplett, obwohl NO_BARBELL_EXERCISE_NAMES sie bereits kannte —
  // fiel bisher auf 'Sonstige' zurück statt 'Push'.
  'Push Up': 'Push', 'Push Ups': 'Push',
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
  // movementMap.js-Audit (Runde 34, B2): Leerzeichen-Schreibweise fehlte
  // hier komplett (siehe Push Up/Push Ups oben, gleicher Fund).
  'Pull Up': 'Pull', 'Pull Ups': 'Pull', 'Chin Up': 'Pull', 'Chin Ups': 'Pull',
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
  'Plank': 'Core', 'Planks': 'Core', 'Crunch': 'Core', 'Situps': 'Core', 'Beinheben': 'Core',
  'Ab-Wheel': 'Core', 'Cable Crunches': 'Core', 'Russian Twists': 'Core',
  'Hollow Hold': 'Core', 'Pallof Press': 'Core', 'Battle Ropes': 'Core',
  'Burpees': 'Core', 'Broad Jumps': 'Core',
  // Englische Synonyme/Schreibvarianten für bereits vorhandene Core-Übungen oben.
  // movementMap.js-Audit (Runde 34, B3/B5): 'Planks' (Plural, oben ergänzt)
  // und 'Sit Up' (Singular) fehlten, obwohl NO_BARBELL_EXERCISE_NAMES bzw.
  // die übrigen Sit-Up-Schreibvarianten sie bereits kannten/nahelegten —
  // fielen bisher auf 'Sonstige' zurück statt 'Core'.
  'Sit-Up': 'Core', 'Sit-Ups': 'Core', 'Sit Up': 'Core', 'Sit Ups': 'Core', 'Crunches': 'Core',
  'Leg Raise': 'Core', 'Leg Raises': 'Core', 'Hanging Leg Raise': 'Core',

  // Sprint "movementMap.js erweitern" (2026-07, B111) — häufig verwendete
  // Variationen + zusätzliche deutsche/englische Synonyme, damit mehr
  // reale Trainingsprogramme korrekt erkannt werden statt auf den
  // Compound-Fallback zu fallen. Keine Struktur-/Logik-Änderung, reine
  // Datenergänzung — siehe AGENTS.md "movementMap.js: reine Datenergänzung".
  'SSB Squat': 'Squat', 'Safety Bar Squat': 'Squat', 'Zercher Squat': 'Squat',
  'Box Squat': 'Squat', 'Pause Squat': 'Squat', 'Tempo Squat': 'Squat',
  'Goblet Squat': 'Squat', 'Pistol Squat': 'Squat', 'Sissy Squat': 'Squat',
  'Barbell Back Squat': 'Squat', 'High Bar Squat': 'Squat', 'Low Bar Squat': 'Squat',

  'Stiff Leg Deadlift': 'Hinge', 'Deficit Deadlift': 'Hinge',
  'Rack Pull': 'Hinge', 'Block Pull': 'Hinge',
  'Trap Bar Deadlift': 'Hinge', 'Hex Bar Deadlift': 'Hinge',
  'Single Leg RDL': 'Hinge', 'Good Morning': 'Hinge', 'Glute Bridge': 'Hinge',
  'Conventional Deadlift': 'Hinge', 'Straight Leg Deadlift': 'Hinge',

  'Close Grip Bench Press': 'Push', 'Paused Bench Press': 'Push', 'Tempo Bench Press': 'Push',
  'Floor Press': 'Push', 'Board Press': 'Push', 'Slingshot Bench': 'Push',
  'Incline Dumbbell Press': 'Push', 'Decline Bench Press': 'Push',
  'Bradford Press': 'Push', 'Z-Press': 'Push', 'OHP': 'Push', 'Strict Press': 'Push',

  // 'Pendlay Row' bleibt bewusst 'Pull' (Zeile oben) statt zusätzlich hier
  // 'Hinge' zugewiesen zu bekommen — ein Name kann in dieser Flat-Map nur
  // eine Kategorie haben, Rudern ist primär eine Zug-/Pull-Bewegung.
  'Yates Row': 'Pull', 'Chest Supported Row': 'Pull', 'Meadows Row': 'Pull',
  'Single Arm Dumbbell Row': 'Pull', 'Face Pull': 'Pull',
  'Seal Row': 'Pull', 'Helms Row': 'Pull',
  'Kreuzheben mit Untergriff': 'Pull', 'Supinated Deadlift Row': 'Pull',
  'Cable Pulldown': 'Pull',

  // Neue Isolationsübungen — Bewegungsmuster-Kategorie hier, echte
  // Compound/Isolation-Einstufung läuft über ISOLATION_EXERCISE_NAMES
  // weiter unten (dort ergänzt).
  'Preacher Curl': 'Pull', 'Scott Curl': 'Pull', 'Reverse Curl': 'Pull',
  'Cable Curl': 'Pull', 'Concentration Curl': 'Pull', 'Spider Curl': 'Pull',
  'Overhead Triceps Extension': 'Push', 'Skull Crusher': 'Push',
  'Lying Triceps Extension': 'Push', 'Cable Triceps Pushdown': 'Push', 'Rope Pushdown': 'Push',
  'Cable Lateral Raise': 'Pull', 'Lateral Raise Maschine': 'Pull',
  'Reverse Fly': 'Pull', 'Rear Delt Fly': 'Pull',
  'Pec Fly': 'Push', 'Cable Fly': 'Push',
  'Schulterzucken': 'Pull', 'Shrug': 'Pull',
  'Wrist Curl': 'Pull', 'Handgelenksbeuger': 'Pull',
  'Band Pull Apart': 'Pull',

  'Ab Wheel': 'Core', 'Ab Rollout': 'Core', 'Dragon Flag': 'Core',
  'Toes to Bar': 'Core', 'L-Sit': 'Core', 'Hollow Body Hold': 'Core',
  'Copenhagen Plank': 'Core',

  "Farmer's Walk": 'Carry', 'Farmers Walk': 'Carry',
  'Suitcase Carry': 'Carry', 'Yoke Walk': 'Carry', 'Overhead Carry': 'Carry',
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
  // movementMap.js-Audit (Runde 34, B4): categoryMap selbst konnte bisher
  // null/undefined sein und eine TypeError werfen (nur `name` war gegen
  // Nullish abgesichert) -- inkonsistent zu buildCategoryMap()s eigenem
  // `customExercises ?? []`-Fallback direkt oberhalb.
  return (categoryMap ?? {})[name] ?? MOVEMENT_MAP[name] ?? 'Sonstige';
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
  'Reverse Flys',
  'KH Shrugs', 'Shrugs', 'Dumbbell Shrugs',
  'Beinstrecker', 'Leg Extension', 'Leg Extensions',
  'Wadenheben', 'Calf Raise', 'Calf Raises',
  'Beinbeuger', 'Leg Curl', 'Leg Curls', 'Hamstring Curl',
  // Sprint "movementMap.js erweitern" (B111): 'Face Pulls' bewusst NICHT
  // mehr hier gelistet (war zuvor fälschlich als Isolation eingestuft) —
  // Face Pull ist Schulter-Außenrotation + Retraktion, zählt sportwissen-
  // schaftlich als Compound (siehe Sprint-Vorgabe), Kategorie 'Pull' oben
  // reicht dafür bereits aus.
  'Preacher Curl', 'Scott Curl', 'Reverse Curl', 'Cable Curl',
  'Concentration Curl', 'Spider Curl', 'Trizepsdips',
  'Overhead Triceps Extension', 'Skull Crusher', 'Lying Triceps Extension',
  'Cable Triceps Pushdown', 'Rope Pushdown',
  'Cable Lateral Raise', 'Lateral Raise Maschine',
  'Reverse Fly', 'Rear Delt Fly', 'Pec Fly', 'Cable Fly',
  'Schulterzucken', 'Shrug', 'Wrist Curl', 'Handgelenksbeuger',
  'Band Pull Apart',
]);

/**
 * Solotest-Feedback (2026-08-16): Übungen ohne Stange/Hantelscheiben, deren
 * "Zusatzgewicht" (falls vorhanden) über Gewichtsgurt/Kurzhantel/Weste läuft
 * — der Hantelscheiben-Rechner (showPlates-Default) ergibt hier keinen Sinn.
 * Bewusst als eigene Liste (nicht ISOLATION_EXERCISE_NAMES wiederverwendet),
 * da die beiden Kategorisierungen unabhängig sind (z.B. Klimmzüge sind
 * Compound, aber trotzdem stangenlos).
 */
const NO_BARBELL_EXERCISE_NAMES = new Set([
  'Klimmzüge', 'Pull Up', 'Pull Ups', 'Pull-Up', 'Pull-Ups', 'Chin Up', 'Chin Ups',
  // movementMap.js-Audit (Runde 34, B1): hyphenierte Push-Up/Chin-Up-Formen
  // fehlten, obwohl MOVEMENT_MAP genau diese Schreibweise als primäre Form
  // führt (Zeile oben) -- der Hantelscheiben-Rechner wurde dadurch
  // fälschlich für "Push-Up"/"Chin-Up" (mit Bindestrich) als Default gezeigt.
  'Dips', 'Bench Dips', 'Trizepsdips', 'Liegestütz', 'Push Up', 'Push Ups',
  'Push-Up', 'Push-Ups', 'Chin-Up', 'Chin-Ups',
  'Planks', 'Plank',
  // movementMap.js-Audit (Runde 34, V1 — teilweise, Nutzer-Entscheidung):
  // nur die eindeutigen "nie mit Hantelscheiben"-Fälle ergänzt. Crunch,
  // Situps, Ab-Wheel, Russian Twists, Hollow Hold bewusst NICHT ergänzt --
  // reine Boden-Core-Übungen, für die die UI den Hantelscheiben-Toggle
  // vermutlich ohnehin nie anzeigt; ohne Beleg keine Vermutung erzwingen.
  'Burpees', 'Box Jumps', 'Broad Jumps', 'Battle Ropes',
]);

/** Ob für diese Übung standardmäßig der Hantelscheiben-Rechner sinnvoll ist (Solotest-Feedback 2026-08-16). */
export function defaultShowPlates(name) {
  return !NO_BARBELL_EXERCISE_NAMES.has(name);
}

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

/**
 * Übungsname → Muskelgruppe(n) (Runde 8, Cluster 2). Eigene Taxonomie,
 * NICHT dasselbe wie MOVEMENT_MAP oben (Bewegungsmuster Push/Pull/Squat/
 * Hinge/Carry/Core) — eine Übung kann mehrere Muskelgruppen gleichzeitig
 * treffen (z.B. Bankdrücken: Brust+Trizeps+Vordere Schulter), anders als
 * die Bewegungsmuster-Zuordnung, die pro Name nur eine Kategorie kennt.
 * Werte ausschließlich aus state.js' AVAILABLE_TAGS.muskelgruppen, keine
 * neuen Tag-Namen erfinden. Bewusst NICHT mechanisch aus MOVEMENT_MAP
 * abgeleitet — z.B. ist 'Schulterdrücken' Bewegungsmuster 'Push', trifft
 * aber primär Schulter, nicht Brust; eine naive Push→Brust-Übernahme wäre
 * hier falsch. Deckt aktuell _STANDARD_EXERCISES (ui.js) ab, nicht die
 * komplette MOVEMENT_MAP-Synonymliste.
 */
export const MUSCLE_GROUP_MAP = {
  // Compound lower
  'Kniebeuge': ['Quadrizeps', 'Gluteus'],
  'Frontkniebeuge': ['Quadrizeps', 'Gluteus'],
  'Beinpresse': ['Quadrizeps', 'Gluteus'],
  'Rumänisches Kreuzheben': ['Beinbizeps', 'Gluteus', 'Unterer Rücken'],
  'Kreuzheben': ['Unterer Rücken', 'Gluteus', 'Beinbizeps', 'Rücken', 'Trapez'],
  'Sumo Kreuzheben': ['Gluteus', 'Beinbizeps', 'Unterer Rücken', 'Quadrizeps'],
  'Bulgarische Kniebeuge': ['Quadrizeps', 'Gluteus'],
  'Ausfallschritte': ['Quadrizeps', 'Gluteus'],
  'Beinbeuger': ['Beinbizeps'],
  'Beinstrecker': ['Quadrizeps'],
  'Wadenheben': ['Waden'],
  'Hip Thrust': ['Gluteus', 'Beinbizeps'],
  // Compound upper push
  'Bankdrücken': ['Brust', 'Trizeps', 'Vordere Schulter'],
  'Schrägbankdrücken': ['Brust', 'Vordere Schulter', 'Trizeps'],
  'Schrägbankdrücken tief': ['Brust', 'Trizeps'],
  'Schulterdrücken': ['Schulter', 'Vordere Schulter', 'Trizeps'],
  'Kurzhanteldrücken': ['Brust', 'Trizeps', 'Vordere Schulter'],
  'Dips': ['Brust', 'Trizeps', 'Vordere Schulter'],
  'Liegestütz': ['Brust', 'Trizeps', 'Vordere Schulter'],
  'Militärpress': ['Schulter', 'Vordere Schulter', 'Trizeps'],
  'Push Press': ['Schulter', 'Trizeps'],
  'Landmine Press': ['Schulter', 'Vordere Schulter', 'Trizeps'],
  // Compound upper pull
  'Klimmzüge': ['Latissimus', 'Rücken', 'Bizeps'],
  'Latziehen': ['Latissimus', 'Rücken', 'Bizeps'],
  'Rudern': ['Rücken', 'Latissimus', 'Bizeps', 'Hintere Schulter'],
  'Kabelrudern': ['Rücken', 'Latissimus', 'Bizeps'],
  'T-Bar Rudern': ['Rücken', 'Latissimus', 'Bizeps'],
  'Pendlay Row': ['Rücken', 'Latissimus', 'Bizeps'],
  // Isolation push
  'Trizepsdrücken': ['Trizeps'],
  'Trizepsdips': ['Trizeps'],
  'Skull Crushers': ['Trizeps'],
  'Seitheben': ['Seitliche Schulter'],
  'Frontheben': ['Vordere Schulter'],
  'Butterfly': ['Brust'],
  'Flys Kabel': ['Brust'],
  'KH Flys': ['Brust'],
  // Isolation pull
  'Bizepscurls': ['Bizeps'],
  'Hammercurls': ['Bizeps', 'Unterarme'],
  'Konzentrationscurls': ['Bizeps'],
  'Kabelbizeps': ['Bizeps'],
  'Face Pulls': ['Hintere Schulter', 'Trapez'],
  'Reverse Flys': ['Hintere Schulter'],
  'KH Rudern': ['Rücken', 'Latissimus', 'Bizeps'],
  'KH Shrugs': ['Trapez'],
  // Core
  'Plank': ['Bauch'],
  'Crunch': ['Bauch'],
  'Situps': ['Bauch'],
  'Beinheben': ['Bauch'],
  'Russian Twists': ['Bauch'],
  'Ab-Wheel': ['Bauch'],
  'Cable Crunches': ['Bauch'],
  'Pallof Press': ['Bauch'],
  'Hollow Hold': ['Bauch'],
  // Kettlebell & functional
  'KB Swings': ['Gluteus', 'Beinbizeps', 'Unterer Rücken'],
  'KB Snatch': ['Schulter', 'Gluteus', 'Beinbizeps'],
  'KB Clean': ['Schulter', 'Gluteus', 'Beinbizeps'],
  'KB Press': ['Schulter', 'Trizeps'],
  'KB Turkish Get-Up': ['Schulter', 'Bauch'],
  'KB Goblet Squat': ['Quadrizeps', 'Gluteus'],
  'KB Windmill': ['Bauch', 'Schulter'],
  'KB Carry': ['Unterarme', 'Trapez', 'Bauch'],
  // Plyometric / conditioning
  'Box Jumps': ['Quadrizeps', 'Gluteus', 'Waden'],
  'Broad Jumps': ['Quadrizeps', 'Gluteus', 'Waden'],
  'Burpees': ['Bauch', 'Quadrizeps', 'Brust'],
  'Kettlebell Swings': ['Gluteus', 'Beinbizeps', 'Unterer Rücken'],
  'Battle Ropes': ['Schulter', 'Bauch', 'Unterarme'],
  // Machine
  'Chest Press Maschine': ['Brust', 'Trizeps', 'Vordere Schulter'],
  'Shoulder Press Maschine': ['Schulter', 'Trizeps'],
  'Rudern Maschine': ['Rücken', 'Latissimus', 'Bizeps'],
  'Lat Maschine': ['Latissimus', 'Rücken', 'Bizeps'],
  'Hack Squat': ['Quadrizeps', 'Gluteus'],
  'Smith Maschine Kniebeuge': ['Quadrizeps', 'Gluteus'],
};

/** Löst die Muskelgruppe(n) einer Übung auf. Unbekannte/eigene Übungsnamen → leeres Array, kein null/undefined. */
export function resolveMuscleGroups(name) {
  return MUSCLE_GROUP_MAP[name] ?? [];
}
