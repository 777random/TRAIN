/**
 * state.js – Single source of truth for the entire TRAIN app.
 *
 * Architecture:
 *   - One frozen FACTORY_TEMPLATE (never mutated).
 *   - One mutable STATE object, always a deep clone of a valid shape.
 *   - All writes go through `dispatch(action)`, which mutates STATE,
 *     then immediately calls `persistState()`.
 *   - Consumers subscribe via `subscribe(listener)` and are notified
 *     synchronously after every dispatch.
 *
 * Persistence strategy (defence-in-depth):
 *   1. Primary   – localStorage key 'train_v6'
 *   2. Secondary – localStorage key 'train_v6_shadow' written 500 ms
 *                  after every primary write (catches tab-crash window)
 *   3. Versioned – STATE.meta.savedAt timestamp so the import dialog
 *                  can show the user when a backup was made.
 *
 * NO side-effects outside this module except localStorage reads/writes
 * and console.warn for non-fatal errors.
 */

import { buildCategoryMap, resolveCategory, resolveMuscleGroups, defaultShowPlates } from './movementMap.js';

// ─── Constants ────────────────────────────────────────────────────────────────

export const STORAGE_KEY        = 'train_v6';
export const STORAGE_KEY_SHADOW = 'train_v6_shadow';
export const SCHEMA_VERSION     = 33;

// B65: Squat/Hinge sind die schweren Grundübungs-Kategorien (Kniebeuge/
// Kreuzheben-Varianten), bei denen 2.5kg-Schritte in der Praxis zu klein
// sind — Nutzer bestätigte, dass die pauschale 2.5kg-Vorgabe (B48) genau
// dort als "die automatische Steigerung ist kaputt" wahrgenommen wurde,
// obwohl die Empfehlungs-Logik selbst korrekt war. Bewusst NUR diese zwei
// Kategorien (nicht Push/Pull — die reichen von schweren Bankdrücken-
// Varianten bis zu leichten Bizeps-Curls, keine sinnvolle Pauschale).
export function defaultWeightStepForExercise(name, customExercises) {
  const categoryMap = buildCategoryMap(customExercises ?? []);
  const category = resolveCategory(name, categoryMap);
  return (category === 'Squat' || category === 'Hinge') ? 5 : 2.5;
}

// Runde 6 (A9-Folgefix): zentraler Resolver für die tatsächlich wirksame
// Schrittweite einer Übung. ex.weightStep wird seit Runde 6 NICHT mehr bei
// EX_ADD hart gesetzt (siehe dort) — bleibt also für die meisten Übungen
// undefined, bis der Nutzer EX_SET_STEP explizit auslöst. Dadurch greift
// hier die globale Einstellung settings.plateStep, wo sie vorher durch den
// immer gesetzten Default nie zum Zug kam.
// Truthy-Check (nicht ??): der Schrittweite-Picker (ui.js, data-action=
// "set-step") nutzt ex.weightStep === 0 als expliziten "Reset"-Sentinel
// ("keine individuelle Anpassung") — 0 muss daher wie undefined behandelt
// werden und auf die globale Einstellung zurückfallen, nicht wörtlich als
// Schrittweite 0 gelesen werden.
export function getEffectiveWeightStep(ex, settings, customExercises) {
  if (ex?.weightStep) return ex.weightStep;
  if (settings?.plateStep) return settings.plateStep;
  return defaultWeightStepForExercise(ex?.name, customExercises);
}

export const BADGE_THRESHOLDS = [
  { id: 'badge_4',   weeks: 4,   title: 'Erster Schritt' },
  { id: 'badge_8',   weeks: 8,   title: 'Fundament'      },
  { id: 'badge_12',  weeks: 12,  title: 'Quartal'        },
  { id: 'badge_26',  weeks: 26,  title: 'Halbjahr'       },
  { id: 'badge_52',  weeks: 52,  title: 'Jahreskraft'    },
  { id: 'badge_104', weeks: 104, title: '2 Jahre'        },
  { id: 'badge_260', weeks: 260, title: '5 Jahre'        },
];

// 4.1: Canonical tag taxonomy
export const AVAILABLE_TAGS = {
  muskelgruppen:   ['Brust','Rücken','Latissimus','Trapez','Unterer Rücken','Beine','Quadrizeps','Beinbizeps','Gluteus','Waden','Bauch','Schulter','Vordere Schulter','Seitliche Schulter','Hintere Schulter','Bizeps','Trizeps','Unterarme'],
  trainingsziel:   ['Hypertrophie','Maximalkraft','Schnellkraft','Athletik','Mobilität','Stabilität','Rotation'],
  uebungsstil:     ['Langhantel','Kurzhantel','Kabelzug','Maschine','Kettlebell','Eigengewicht'],
  bewegungsmuster: ['Push','Pull','Hinge','Squat','Carry'],
  kontext:         ['Wettkampf','Reha','Home-Workout'],
};

/** Flat list of all tags (used as default for activeTags). */
export const ALL_TAGS_FLAT = Object.values(AVAILABLE_TAGS).flat();

/** Predefined vacation training plans. Each entry: { name, sets, reps, metric }. */
export const VACATION_PLANS = {
  bodyweight: [
    { name: 'Liegestütz',      sets: 3, reps: 10, metric: 'reps' },
    { name: 'Kniebeuge',       sets: 3, reps: 15, metric: 'reps' },
    { name: 'Dips',            sets: 3, reps: 10, metric: 'reps' },
    { name: 'Ausfallschritte', sets: 3, reps: 12, metric: 'reps' },
    { name: 'Plank',           sets: 3, reps: 30, metric: 'sec'  },
  ],
  light_kb: [
    { name: 'KH Rudern',         sets: 4, reps: 12, metric: 'reps' },
    { name: 'Kurzhanteldrücken', sets: 3, reps: 10, metric: 'reps' },
    { name: 'Bizepscurls',       sets: 3, reps: 12, metric: 'reps' },
    { name: 'Seitheben',         sets: 3, reps: 15, metric: 'reps' },
    { name: 'Hip Thrust',        sets: 3, reps: 15, metric: 'reps' },
  ],
  heavy_kb: [
    { name: 'Rumänisches KH',    sets: 4, reps: 8,  metric: 'reps' },
    { name: 'Kurzhanteldrücken', sets: 4, reps: 8,  metric: 'reps' },
    { name: 'KH Rudern',         sets: 4, reps: 8,  metric: 'reps' },
    { name: 'Ausfallschritte',   sets: 3, reps: 10, metric: 'reps' },
    { name: 'Hammercurls',       sets: 3, reps: 10, metric: 'reps' },
  ],
  hotel_gym: [
    { name: 'Rudern Maschine',         sets: 4, reps: 10, metric: 'reps' },
    { name: 'Chest Press Maschine',    sets: 4, reps: 10, metric: 'reps' },
    { name: 'Lat Maschine',            sets: 4, reps: 10, metric: 'reps' },
    { name: 'Beinpresse',              sets: 4, reps: 12, metric: 'reps' },
    { name: 'Shoulder Press Maschine', sets: 3, reps: 12, metric: 'reps' },
  ],
};

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Creates a fresh set entry. */
export function mkSet(weight = 0, reps = 10) {
  return { weight, reps, rpe: null, status: 'pending', done: false, note: '' };
}

/** Deep-clone anything JSON-serialisable. */
export function clone(x) {
  return JSON.parse(JSON.stringify(x));
}

// ─── Factory template (READONLY baseline) ────────────────────────────────────
//
// Object.freeze only shallow-freezes; the nested arrays/objects are cloned
// every time via clone() before use, so mutation safety is guaranteed.

export const FACTORY_TEMPLATE = Object.freeze([
  {
    id: 'A',
    title: 'Tag A',
    subtitle: 'Ganzkörper · Schwerpunkt Zug',
    warmup:   'A-Skip · Ankle Circles · BWS-Rotation · YTW 2×10 · Crocodile Breathing',
    cooldown: 'Box Breathing 4-4-4-4 (5 Min) · Hip Flexor · Pigeon Pose · Lat-Stretch',
    exercises: [
      { name: 'Box Jumps',             note: 'Max Effort – volle Pause',          pauseSec: 120, sets: [mkSet(0,6),   mkSet(0,6),   mkSet(0,6)]   },
      { name: 'KB Swings',             note: 'Hüftstreckung – kein Squat',        pauseSec: 90,  sets: [mkSet(16,15), mkSet(16,15), mkSet(16,15), mkSet(16,15)] },
      { name: 'Klimmzüge',             note: 'Schulterblätter zuerst',            pauseSec: 90,  sets: [mkSet(0,6),   mkSet(0,6),   mkSet(0,6),   mkSet(0,6)]  },
      { name: 'KH-Rudern (einseitig)', note: '8 pro Seite – abgestützt',          pauseSec: 90,  sets: [mkSet(20,8),  mkSet(20,8),  mkSet(20,8),  mkSet(20,8)] },
      { name: 'Suitcase Deadlift',     note: '8 pro Seite',                       pauseSec: 90,  sets: [mkSet(20,8),  mkSet(20,8),  mkSet(20,8)]  },
      { name: 'Goblet Squat',          note: 'Tiefe Position halten',             pauseSec: 90,  sets: [mkSet(16,12), mkSet(16,12), mkSet(16,12), mkSet(16,12)] },
      { name: 'Einbeinige RDL',        note: '8 pro Seite – langsame Exzentrik',  pauseSec: 60,  sets: [mkSet(16,8),  mkSet(16,8),  mkSet(16,8)]  },
      { name: 'Suitcase Carry',        note: '20 m pro Seite',                    pauseSec: 60,  sets: [mkSet(16,20), mkSet(16,20), mkSet(16,20)] },
    ],
  },
  {
    id: 'B',
    title: 'Tag B',
    subtitle: 'Ganzkörper · Schwerpunkt Drücken',
    warmup:   'A-Skip · Ankle Circles · BWS-Rotation · YTW 2×10 · Crocodile Breathing',
    cooldown: "Box Breathing 4-4-4-4 (5 Min) · Brustdehnung · Child's Pose · Waden-Dehnung",
    exercises: [
      { name: 'Box Jumps',                 note: 'Max Effort',                  pauseSec: 120, sets: [mkSet(0,6),   mkSet(0,6),   mkSet(0,6)]   },
      { name: 'KB Swings',                 note: 'Explosiv – Posterior Chain',  pauseSec: 90,  sets: [mkSet(16,15), mkSet(16,15), mkSet(16,15)] },
      { name: 'KB Overhead Press kniend',  note: 'Einseitig – Rumpf aktiv',     pauseSec: 90,  sets: [mkSet(12,8),  mkSet(12,8),  mkSet(12,8),  mkSet(12,8)] },
      { name: 'Gorilla Rows',              note: 'Explosiver Zug',              pauseSec: 90,  sets: [mkSet(20,8),  mkSet(20,8),  mkSet(20,8),  mkSet(20,8)] },
      { name: 'Schrägbankdrücken KH',      note: 'Obere Brust + Schulter',      pauseSec: 90,  sets: [mkSet(16,10), mkSet(16,10), mkSet(16,10), mkSet(16,10)] },
      { name: 'Push-Ups',                  note: 'Standard → Archer → Pike',    pauseSec: 60,  sets: [mkSet(0,15),  mkSet(0,15),  mkSet(0,15)]  },
      { name: 'Reverse Lunges',            note: '10 pro Seite',                pauseSec: 60,  sets: [mkSet(0,10),  mkSet(0,10),  mkSet(0,10)]  },
      { name: 'Plank Drag',                note: '8 pro Seite – Hüfte ruhig',   pauseSec: 60,  sets: [mkSet(0,8),   mkSet(0,8),   mkSet(0,8)]   },
      { name: 'Woodchop KB',               note: '10 pro Seite',                pauseSec: 60,  sets: [mkSet(12,10), mkSet(12,10), mkSet(12,10)] },
    ],
  },
  {
    id: 'C',
    title: 'Tag C',
    subtitle: 'Ganzkörper · Schwerpunkt Power & Mobility',
    warmup:   'A-Skip · Ankle Circles · BWS-Rotation · YTW 2×10 · Crocodile Breathing',
    cooldown: 'Box Breathing 4-4-4-4 (5 Min) · Hüftbeuger · Pigeon Pose · Thorax-Rotation',
    exercises: [
      { name: 'Broad Jumps',               note: 'Max Weite – reaktive Landung',       pauseSec: 120, sets: [mkSet(0,5),   mkSet(0,5),   mkSet(0,5),   mkSet(0,5)]  },
      { name: 'KB Swings',                 note: 'Explosiv – direkt nach Jumps',       pauseSec: 90,  sets: [mkSet(20,15), mkSet(20,15), mkSet(20,15)] },
      { name: 'KB Overhead Press kniend',  note: 'Einseitig – technisch sauber',       pauseSec: 90,  sets: [mkSet(12,8),  mkSet(12,8),  mkSet(12,8)]  },
      { name: 'Goblet Squat',              note: '3 Sek runter – Mobility',            pauseSec: 90,  sets: [mkSet(20,8),  mkSet(20,8),  mkSet(20,8)]  },
      { name: 'KH-Rudern (einseitig)',     note: '8 pro Seite – schwerer als Tag A',   pauseSec: 90,  sets: [mkSet(22,8),  mkSet(22,8),  mkSet(22,8),  mkSet(22,8)] },
      { name: 'Gorilla Rows',              note: 'Explosiv',                           pauseSec: 90,  sets: [mkSet(20,8),  mkSet(20,8),  mkSet(20,8)]  },
      { name: 'KB Windmill',               note: '5 pro Seite – langsam',              pauseSec: 60,  sets: [mkSet(12,5),  mkSet(12,5),  mkSet(12,5)]  },
      { name: 'Woodchop KB',               note: '10 pro Seite – explosiv',            pauseSec: 60,  sets: [mkSet(12,10), mkSet(12,10), mkSet(12,10)] },
      { name: "Farmer's Carry",            note: '30 m – Schultern zurück',            pauseSec: 60,  sets: [mkSet(20,30), mkSet(20,30), mkSet(20,30)] },
    ],
  },
]);

// ─── Default STATE shape ─────────────────────────────────────────────────────

function buildDefaultState() {
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      savedAt: null,          // ISO string, written on every persist
      createdAt: new Date().toISOString(),
    },
    curIdx: 0,
    weeks: [],                // Week[]
    customTemplate: clone(FACTORY_TEMPLATE),
    templates: [],            // { id, name, days[] }[]  – named templates (v9)
    prs: {},                  // { [exerciseName]: { maxWeight, maxVolume, maxEstimated1RM, date } }
    insights: [],             // Insight[] – populated by triggerEngine, transient coaching feedback
    favoriteExercises: [],    // String[] – Übungsnamen, max 5
    customExercises: [],      // { name, metric: 'reps'|'sec'|'m', category: 'Push'|'Pull'|'Squat'|'Hinge'|'Carry'|'Core'|null }[]
    lastReentryHandled: null, // Timestamp | null — set once the Wiedereinstieg popup decision is made
    longestStreakEver: 0,     // Number — historical max streak (weeks), survives deletion of old weeks
    badges: [],               // { id, unlockedAt }[] – earned badges
    onboardingDone: false,    // true after first-run flow completed
    seenTips: [],             // string[] – tip IDs the user has already seen
    plateauActions: {},       // { [exerciseName]: { action: 'ignored'|'implemented', since, plateauWeeksAtAction } }
    decisionLog: [],          // { id, type, signal, choice, decidedWeekStart, outcome } – Abwägungs-Entscheidungen
    coachQuestion: { weekStart: null, questionId: null, answer: null, outcome: null, measuredWeekStart: null }, // adaptive Nachfrage — eine Frage pro Woche
    coachQuestionHistory: [], // abgeschlossene Fragen mit Outcome: [{ weekStart, questionId, answer, outcome, measuredWeekStart }]
    coachPerformance: { suggestions: [] }, // Logging + Messung von Progressions-Empfehlungen
    substituteHistory: {}, // { [originalExerciseName]: { name, count, lastUsed }[] } — D2, siehe _recordSubstitution()
    exerciseNotes: {}, // { [exerciseName]: string } — B127: permanente, übungsweite Notiz (Rack-Höhe, Griffbreite etc.), überlebt Wochen-Klone; NICHT zu verwechseln mit ex.note (tagesspezifisch) oder s.note (pro Satz)
    customAlternatives: {}, // { [exerciseName]: string[] } — B138: nutzerdefinierte Alternativübungen, siehe exerciseAlternatives.js getAlternatives()
    settings: {
      swipe:              true,
      drag:               true,
      targetWeight:       null,
      deloadFactor:       0.75,
      deloadFactorCustom: null,
      barbellWeight:      20,
      plateStep:          2.5,
      largestPlate:       25, // Runde 8/Cluster 4: schwerste verfügbare Hantelscheibe (Hantelscheiben-Rechner-Obergrenze)
      lastBackupDate:                 null,
      activeTags:                     ALL_TAGS_FLAT,
      vibrationEnabled:               true,
      // Runde 19/Cluster 3: war seit Runde 17/B210 im Settings-Tab
      // renderbar (tog('soundEnabled', ...)), aber NIE hier bzw. in migrate()
      // (siehe vibrationEnabled direkt darüber) ergänzt worden -- SETTING_TOGGLE
      // (state.js) flippt einen Key nur, wenn er BEREITS in state.settings
      // existiert ('key in state.settings'-Guard), war also für jeden echten
      // Nutzer dauerhaft ein No-Op. Kein Browser-Limit wie bei der Vibration
      // selbst (B210) -- echter, simpler Bug. Default false (Opt-in, wie im
      // Sprint beschrieben, nicht rückwirkend beide Signale gleichzeitig an).
      soundEnabled:                   false,
      showPauseTips:                  false, // Runde 21: kategorie-gebundener Trainings-Tipp im Pause-Overlay (timer.js/pauseTips.js) — Opt-in: ein Lesetext ist ein aktiver Aufmerksamkeitsanspruch genau in dem Moment, der bei "einfach nur trainieren, nicht mehr nachdenken" bewusst frei bleiben soll
      rpeEnabled:                     true,
      weeksSinceLastBackupReminder:   0,
      maxSessionMs:                   10800000, // 3h default
      autoStartPauseTimer:            true,
      // Solotest-Feedback (2026-08-16): war zuvor NUR in migrate() (Fallback
      // für Bestandsnutzer) gesetzt, in buildDefaultState() (neue Nutzer)
      // dagegen komplett unerwähnt (effektiv undefined -> falsy -> aus).
      // Default jetzt bewusst an (Opt-out statt Opt-in) -- siehe migrate()
      // für die Begründung des Runde-2026-08-16-Defaultwechsels.
      autoEval:                       true,
      hideStreakBadge:                false, // B60: Streak-Badge im Trainings-Tab optional ausblendbar
      hideStopwatch:                  false, // Runde 6/B4: Session-Stoppuhr in der Toolbar optional ausblendbar
      sessionCoach:                   true,  // B76: Pre-Session Check-in + Briefing
      goal:                           null,  // Sprint C1: 'kraftaufbau'|'muskelaufbau'|'fitness'|null — für Pausenzeiten-Empfehlung
      nutritionPhase:                 'maintenance', // B139: 'bulk'|'maintenance'|'cut' — beeinflusst Steigerungs-Empfehlung + Coach-Signale
      dismissedNamePairs:             [], // [nameA, nameB][] – sortiert, getrimmt, lowercase
      autoWeek: {
        enabled:          false, // Hauptschalter automatische Wochenerstellung
        suggestProgress:  true,  // Steigerungs-Modal beim ersten Öffnen zeigen?
        showReview:       true,  // Wochenrückblick der Vorwoche zuerst zeigen?
      },
      erkenntnisseHorizont: 8,  // Zeithorizont in Wochen (4–52)
    },
  };
}

// ─── Undo stack ───────────────────────────────────────────────────────────────

const _undoStack = [];
const _MAX_UNDO  = 20;

// Actions that are pure navigation or external events — not worth undoing.
const _NO_UNDO = new Set([
  'UNDO', 'WEEK_NAVIGATE', 'STATE_IMPORT', 'SESSION_START', 'SESSION_RESET', 'SESSION_STOP',
  'INSIGHTS_SET', 'ONBOARDING_DONE', 'ONBOARDING_SEED', 'MARK_TIP_SEEN', 'REENTRY_HANDLED',
  'EX_AUTO_PRESELECT_NEXT_WEEK_PLAN',
  'PLATEAU_ACTION', 'DECISION_LOG_ADD', 'DECISION_LOG_OUTCOME',
  'SET_ERKENNTNISSE_HORIZONT', 'COACH_ANSWER', 'COACH_PERF_LOG', 'COACH_PERF_MEASURE', 'COACH_QUESTION_OUTCOME',
  // Reine Einstellungs-Umschalter — sollen den einzigen globalen Undo-Slot
  // nicht belegen, sonst kann ein versehentlicher Tap auf einen Schalter
  // (z.B. Vibration an/aus) eine kurz zuvor eigentlich noch rückgängig
  // machbare echte Löschung (Übung/Tag/Woche) endgültig unerreichbar machen.
  'SETTING_TOGGLE', 'SETTING_SET', 'AUTOWEEK_SET', 'TOGGLE_FAVORITE',
]);

/** Returns true when there is at least one undo snapshot available. */
export function canUndo() { return _undoStack.length > 0; }

/**
 * Public wrapper: gap-aware current streak (in weeks) across the given
 * weeks array. Streak-Freeze entfernt (Sprint "Framework-Audit Cleanup",
 * Fix 2) — die Berechnung berücksichtigt keinen Schutzmechanismus mehr,
 * ein 'missed' bricht die Zählung immer.
 */
export function calcCurrentStreak(weeks) { return _calcCurrentStreak(weeks); }
/** Public wrapper: gap-aware longest-ever streak (in weeks) across the given weeks array. */
export function calcLongestStreakEver(weeks) { return _calcLongestStreakEver(weeks); }
/** Public wrapper: per-week training status — 'completed' | 'attended' | 'missed'. See _weekTrainingStatus(). */
export function weekTrainingStatus(w) { return _weekTrainingStatus(w); }

// ─── Internal STATE + subscriber registry ────────────────────────────────────

let STATE = buildDefaultState();
const _subscribers = new Set();

// ─── Shadow-write debounce ────────────────────────────────────────────────────

let _shadowTimer = null;

function scheduleShadowWrite(serialised) {
  clearTimeout(_shadowTimer);
  _shadowTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SHADOW, serialised);
    } catch (_) { /* quota – shadow write is best-effort */ }
  }, 500);
}

// ─── Persist (called after EVERY mutation) ───────────────────────────────────

function persistState() {
  STATE.meta.savedAt = new Date().toISOString();
  const serialised = JSON.stringify(STATE);
  try {
    localStorage.setItem(STORAGE_KEY, serialised);
  } catch (e) {
    // Storage quota exceeded – notify UI layer via a custom event.
    // The shadow write is skipped too; no point trying.
    window.dispatchEvent(new CustomEvent('train:storage-error', { detail: e }));
    return;
  }
  scheduleShadowWrite(serialised);
}

// ─── Migration helpers ────────────────────────────────────────────────────────

/** Canonical set status: pending | success | fail. Keeps legacy `done` in sync. */
function _normalizeSetRecord(s) {
  const ok = st => st === 'pending' || st === 'success' || st === 'fail';
  if (ok(s.status)) {
    s.done = s.status === 'success';
    if (s.failed !== undefined) delete s.failed;
    return;
  }
  if (s.failed === true) {
    s.status = 'fail';
    s.done = false;
    delete s.failed;
    return;
  }
  if (s.done === true) s.status = 'success';
  else s.status = 'pending';
  s.done = s.status === 'success';
}

function _walkTemplateDays(days, fn) {
  (days ?? []).forEach(day => {
    (day.exercises ?? []).forEach(ex => {
      (ex.sets ?? []).forEach(fn);
    });
  });
}

/** v6→v7: training-set status tri-state + backward-compatible `done`. */
function _normalizeAllTrainingSets(raw) {
  (raw.weeks ?? []).forEach(wk => _walkTemplateDays(wk.days, _normalizeSetRecord));
  _walkTemplateDays(raw.customTemplate, _normalizeSetRecord);
}

/** Exercise metric: reps | sec | m (default reps). */
function _normalizeExerciseMetric(ex) {
  if (ex.metric !== 'reps' && ex.metric !== 'sec' && ex.metric !== 'm') ex.metric = 'reps';
}

function _normalizeAllExerciseMetrics(raw) {
  (raw.weeks ?? []).forEach(wk => {
    (wk.days ?? []).forEach(day => {
      (day.exercises ?? []).forEach(_normalizeExerciseMetric);
    });
  });
  (raw.customTemplate ?? []).forEach(day => {
    (day.exercises ?? []).forEach(_normalizeExerciseMetric);
  });
}

/**
 * Shared Urlaubstag-Ausschlussregel: ein Tag mit isVacation && vacationPlan
 * 'rest' ist kein Trainingstag und fliegt aus jedem Tage-Nenner raus.
 * Einzige Quelle dieser Regel — weeklyFocus.js' _weekConsistencyRatio()
 * importiert sie ebenfalls, statt sie zu duplizieren.
 */
export function isTrainingDay(d) {
  return !(d.isVacation && d.vacationPlan === 'rest');
}

/**
 * Zwei-Klassen-Modell (eigentlich drei: 'completed' | 'attended' | 'missed')
 * ersetzt die alte binäre markedDone-Prüfung — verhindert "Streak-Faking"
 * durch bloßes Abschließen ohne tatsächlich bewertete Sätze.
 *
 *   'completed': ≥70% der Trainingstage haben ≥50% ihrer Sätze bewertet
 *                (success/fail, pending ausgeschlossen) → Streak +1
 *   'attended':  mindestens 1 bewerteter Satz irgendwo in der Woche, aber
 *                'completed'-Schwelle nicht erreicht → Streak hält, kein +1
 *   'missed':    0 bewertete Sätze in der ganzen Woche → Streak bricht
 *
 * Urlaubs- und Deload-Wochen sind immer 'attended' (neutral, wie zuvor).
 */
/**
 * Runde 9 (Cluster 1): extrahiert aus _weekTrainingStatus()'s Inline-Zähl-
 * schleife, damit consistencyUtils.js/weeklyFocus.js dieselbe Anti-Gaming-
 * Definition ("Tag erledigt" = >=50% der Sätze bewertet, nicht markedDone)
 * wiederverwenden können, statt sie unabhängig zu duplizieren.
 */
// Trainings-Tab-Audit (2026-08-17): ex.archived ausgeschlossen -- anders
// als die kanonische Schwesterfunktion weekSuccessCounts() (setUtils.js)
// zählte diese Funktion archivierte Übungen bisher mit. Geteilte Quelle für
// _weekTrainingStatus() (Streak, unten) UND _weekConsistencyRatio()
// (Coach-Tab-Konsistenz-Quote, consistencyUtils.js importiert sie direkt) --
// ein Tag mit einer archivierten, noch pending-Sätze enthaltenden Übung
// (EX_ARCHIVE löscht keine Sätze) konnte so fälschlich unter die
// 50%-Schwelle rutschen und die Streak trotz vollständig erledigtem,
// relevantem Training brechen lassen.
export function _dayEvalCounts(day) {
  let evaluated = 0, total = 0;
  for (const ex of day.exercises) {
    if (ex.archived) continue;
    for (const s of ex.sets) {
      total++;
      if (s.status === 'success' || s.status === 'fail') evaluated++;
    }
  }
  return { evaluated, total };
}

function _weekTrainingStatus(wk) {
  // Solotest-Feedback (2026-08-16): ONBOARDING_SEED-Wochen (isSeedWeek) sind
  // ein synthetischer PR-Kaltstart-Datenpunkt, keine echte Trainingswoche --
  // zählten bisher fälschlich als 'completed' (Satz-Status success), was die
  // Streak direkt nach dem Onboarding auf 1 sprang, obwohl noch nie trainiert
  // wurde. 'attended' (wie Deload/Urlaub) verhält sich neutral: zählt nicht
  // mit, bricht aber auch nichts.
  if (wk.isSeedWeek) return 'attended';
  if (wk.mode === 'deload') return 'attended';
  if (wk.mode === 'vacation' || (wk.days.length > 0 && wk.days.every(d => d.isVacation))) return 'attended';

  const trainingDays = wk.days.filter(isTrainingDay);
  if (trainingDays.length === 0) return 'missed';

  let daysDone = 0, anyEvaluated = false;
  for (const day of trainingDays) {
    const { evaluated, total } = _dayEvalCounts(day);
    if (evaluated > 0) anyEvaluated = true;
    if (total > 0 && evaluated / total >= 0.5) daysDone++;
  }
  if (daysDone / trainingDays.length >= 0.7) return 'completed';
  if (daysDone > 0 || anyEvaluated) return 'attended';
  return 'missed';
}

/** End of a week's 7-day span, as a timestamp. */
function _weekEndMs(wk) {
  return new Date(wk.startDate + 'T00:00:00').getTime() + 6 * 86_400_000;
}

/**
 * True when more than 7 untracked days lie between the end of `prevWk`
 * (chronologically earlier, already-counted week) and the start of `wk`
 * (chronologically later week being evaluated). An unmarked pause this
 * long breaks the streak even if both weeks are individually "done".
 *
 * Streak-Freeze entfernt (Sprint "Framework-Audit Cleanup", Fix 2) — kein
 * `freeze`-Parameter mehr, ein Lücken-Bruch ist immer endgültig.
 */
function _streakGapBreaks(wk, prevWk) {
  if (!prevWk) return false;
  const gapDays = (new Date(wk.startDate + 'T00:00:00').getTime() - _weekEndMs(prevWk)) / 86_400_000;
  // Malformes startDate (korrupte/hand-editierte Daten) -> gapDays wird NaN.
  // NaN <= 7 ist false, würde also fälschlich in die Break-Logik durchfallen
  // -> NaN explizit als "kein Break" behandeln (defensiver Fallback).
  if (!Number.isFinite(gapDays) || gapDays <= 7) return false;
  return true;
}

/**
 * `lastWk` tracks the last week PROCESSED (completed OR attended) purely
 * for gap-detection — both are real, present week records, so a calendar
 * gap must be measured against whichever is chronologically closest, not
 * only against the last 'completed' week. Only 'cur' itself is gated to
 * 'completed' weeks.
 */
function _calcCurrentStreak(weeks) {
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let cur = 0;
  let lastWk = null;
  const nowMs = Date.now();
  for (let i = sorted.length - 1; i >= 0; i--) {
    const wk     = sorted[i];
    const status = _weekTrainingStatus(wk);
    if (status === 'missed') {
      // Die neueste Woche läuft noch (ihr 7-Tage-Fenster ist noch nicht
      // vorbei) und hat schlicht noch keine bewerteten Sätze — das ist
      // "noch nicht dran gewesen", kein Versäumnis. Ohne diesen Sonderfall
      // brach die Streak sofort auf 0 ab, sobald AUTO_WEEK_CREATE (z.B.
      // montags beim Öffnen) eine neue, leere Woche anlegt — noch bevor der
      // Nutzer überhaupt die Chance hatte, darin zu trainieren (B69).
      // Eine bereits abgelaufene, leer gebliebene Woche bricht die Streak
      // weiterhin wie zuvor.
      //
      // B110: bewusst NICHT _weekEndMs(wk) wiederverwendet — dessen Wert
      // (startDate + 6 Tage) ist der Anfang des 7. Tages, nicht dessen Ende,
      // und wird von _streakGapBreaks() genau mit dieser Bedeutung für die
      // Lücken-Arithmetik gebraucht (eine Änderung dort hätte "eine volle
      // übersprungene Woche" fälschlich nicht mehr als Lücke erkannt). Das
      // 7-Tage-Fenster selbst braucht hier den echten Tagesende-Zeitpunkt
      // (startDate + 7 Tage, exklusiv) — sonst gilt das Fenster am 7.
      // Kalendertag (z.B. Sonntag bei Montags-Start) schon ab Mitternacht
      // UTC als abgelaufen, obwohl der Tag gerade erst begonnen hat, und die
      // Streak bricht einen vollen Tag zu früh auf 0 ab.
      const weekWindowEndMs = new Date(wk.startDate + 'T00:00:00').getTime() + 7 * 86_400_000;
      if (i === sorted.length - 1 && nowMs < weekWindowEndMs) continue;
      break;
    }
    if (lastWk && _streakGapBreaks(lastWk, wk)) break;
    if (status === 'completed') cur++;
    lastWk = wk;
  }
  return cur;
}

/** Longest streak ever achieved anywhere in the week history (gap-aware). */
function _calcLongestStreakEver(weeks) {
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let best = 0, run = 0, lastWk = null;
  for (const wk of sorted) {
    const status = _weekTrainingStatus(wk);
    if (status === 'missed') { run = 0; lastWk = null; continue; }
    if (lastWk && _streakGapBreaks(wk, lastWk)) run = 0;
    if (status === 'completed') {
      run++;
      best = Math.max(best, run);
    }
    lastWk = wk;
  }
  return best;
}

// Badge-Vergabe eingefroren (Sprint "Framework-Audit Cleanup", Fix 5) — Code
// bewusst nur auskommentiert, nicht gelöscht: BADGE_THRESHOLDS, state.badges
// und die Galerie-Anzeige bleiben vollständig funktionsfähig, nur das
// automatische Freischalten NEUER Abzeichen ist abgeschaltet. Bereits
// vergebene Abzeichen (state.badges) bleiben unangetastet und weiterhin
// sichtbar. longestStreakEver wird weiterhin fortgeschrieben — das ist Teil
// der Streak-WERT-Ermittlung (Constraint: "Streak-Wert unverändert"), nicht
// der Gamification-Präsentation.
function _checkAndGrantBadges(state) {
  state.longestStreakEver = Math.max(state.longestStreakEver ?? 0, _calcLongestStreakEver(state.weeks));

  // const streak  = _calcCurrentStreak(state.weeks);
  // const now     = new Date().toISOString();
  // const newOnes = [];
  // for (const thr of BADGE_THRESHOLDS) {
  //   if (streak >= thr.weeks && !state.badges.some(b => b.id === thr.id)) {
  //     state.badges.push({ id: thr.id, unlockedAt: now });
  //     newOnes.push({ ...thr, unlockedAt: now });
  //   }
  // }
  // if (newOnes.length > 0) {
  //   setTimeout(() => {
  //     window.dispatchEvent(new CustomEvent('train:badge-earned', { detail: newOnes }));
  //   }, 0);
  // }
}

// Trägt einen Satz in die prMap ein. Extrahiert um "Heute anders"-Doppelbuchung
// (Original-Slot + Ersatz-Übung) ohne Code-Duplizierung zu ermöglichen.
function _addToPrMap(map, name, weight, reps) {
  if (!map[name]) map[name] = { prWeight: null, prReps: null, repsHistory: {} };
  const m = map[name];
  if (m.prWeight === null || weight > m.prWeight) {
    m.prWeight = weight; m.prReps = reps;
  } else if (weight === m.prWeight && reps > (m.prReps ?? 0)) {
    m.prReps = reps;
  }
  const w = String(weight);
  if (reps > (m.repsHistory[w] ?? 0)) m.repsHistory[w] = reps;
}

function _recalcExercisePRs(state) {
  const curWk = state.weeks[state.curIdx];
  if (!curWk) return;
  // Build name → {prWeight, prReps, repsHistory} from all completed sets.
  // "Heute anders"-Sessions (substituteFor gesetzt) buchen doppelt:
  // unter dem Original-Slot (Slot-Kontinuität) UND unter der Ersatz-Übung
  // (damit sie eine eigene PR-Historie aufbaut wenn sie zur Hauptübung wird).
  const prMap = {};
  state.weeks.forEach(wk => {
    if (wk.mode === 'deload') return;
    wk.days.forEach(day => {
      day.exercises.forEach(ex => {
        ex.sets.forEach(s => {
          if (s.status !== 'success') return;
          const reps   = parseFloat(s.reps)   || 0;
          if (reps === 0) return;
          const weight = parseFloat(s.weight) || 0;
          const primaryName = ex.substituteFor || ex.name;
          if (!primaryName) return;
          _addToPrMap(prMap, primaryName, weight, reps);
          // Doppelbuchung: Ersatz-Übung bekommt eigene Einträge
          if (ex.substituteFor && ex.name && ex.name !== ex.substituteFor) {
            _addToPrMap(prMap, ex.name, weight, reps);
          }
        });
      });
    });
  });
  // Apply to current week exercises where prWeight is still null/undefined.
  // Loose != (not strict !==): exercises created before the v20→v21 PR-field
  // migration, or via a creation site that omitted the field, can have
  // prWeight===undefined rather than null — undefined !== null is true, so
  // a strict check would silently skip them forever.
  curWk.days.forEach(day => {
    day.exercises.forEach(ex => {
      if (ex.prWeight != null) return;
      const name = ex.substituteFor || ex.name;
      const m = prMap[name];
      if (m) {
        ex.prWeight = m.prWeight; ex.prRepsAtMaxWeight = m.prReps;
        ex.prRepsHistory = Object.fromEntries(
          Object.entries(m.repsHistory).filter(([w]) => +w < m.prWeight)
        );
      }
    });
  });
}

/**
 * Ensures a loaded state object conforms to the current schema.
 * Add a new `case` for every future schema bump.
 */
function migrate(raw) {
  const v = raw?.meta?.schemaVersion ?? 0;

  // v0-v5 → v6: normalise weeks array entries
  if (v < 6) {
    (raw.weeks ?? []).forEach(wk => {
      if (!wk.mode)       wk.mode       = 'standard';
      if (!wk.sessionLog) wk.sessionLog = [];
      if (!wk.bodyData)   wk.bodyData   = {};
      if (!wk.id)         wk.id         = Date.now() + Math.random();
      (wk.days ?? []).forEach(day => {
        if (day.locked === undefined) day.locked = false;
        if (day.markedDone === undefined) day.markedDone = false;
        day.exercises.forEach(ex => {
          if (!ex.pauseSec) ex.pauseSec = 90;
          ex.sets.forEach(s => {
            if (s.rpe === undefined) s.rpe = null;
          });
        });
      });
    });
    if (!raw.customTemplate) raw.customTemplate = clone(FACTORY_TEMPLATE);
    if (!raw.settings)       raw.settings = { swipe: true, drag: true };
    // Ensure swipe is explicitly true for users upgrading from pre-Step-2 state
    // (where swipe was false by default). drag keeps its persisted value.
    if (raw.settings.swipe        === undefined) raw.settings.swipe        = true;
    if (raw.settings.drag         === undefined) raw.settings.drag         = true;
    if (raw.settings.targetWeight === undefined) raw.settings.targetWeight = null;
    raw.meta = {
      schemaVersion: 6,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v6 → v7: set status tri-state (import / localStorage stays compatible)
  if ((raw.meta?.schemaVersion ?? 0) < 7) {
    _normalizeAllTrainingSets(raw);
    raw.meta = {
      ...raw.meta,
      schemaVersion: 7,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v7 → v8: exercise.metric (reps | sec | m)
  if ((raw.meta?.schemaVersion ?? 0) < 8) {
    _normalizeAllExerciseMetrics(raw);
    raw.meta = {
      ...raw.meta,
      schemaVersion: 8,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v8 → v9: new settings fields, prs, templates, per-week restDays,
  //           per-day sessionNote/sessionRating, per-exercise tags/supersetId
  if ((raw.meta?.schemaVersion ?? 0) < 9) {
    const s = raw.settings ?? {};
    if (s.deloadFactor       === undefined) s.deloadFactor       = 0.75;
    if (s.deloadFactorCustom === undefined) s.deloadFactorCustom = null;
    if (s.barbellWeight      === undefined) s.barbellWeight      = 20;
    if (s.plateStep          === undefined) s.plateStep          = 2.5;
    if (s.lastBackupDate     === undefined) s.lastBackupDate     = null;
    raw.settings = s;

    if (!raw.prs)       raw.prs       = {};
    if (!raw.templates) raw.templates = [];

    const normDay = day => {
      if (day.sessionNote   === undefined) day.sessionNote   = '';
      if (day.sessionRating === undefined) day.sessionRating = null;
      (day.exercises ?? []).forEach(ex => {
        if (!Array.isArray(ex.tags)) ex.tags = [];
        if (ex.supersetId === undefined) ex.supersetId = null;
      });
    };
    const normWeek = wk => {
      if (!Array.isArray(wk.restDays)) wk.restDays = [];
      (wk.days ?? []).forEach(normDay);
    };
    (raw.weeks ?? []).forEach(normWeek);
    (raw.customTemplate ?? []).forEach(normDay);

    raw.meta = {
      ...raw.meta,
      schemaVersion: 9,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v9 → v10: remove targetSets from all exercises (replaced by ex.sets.length)
  if ((raw.meta?.schemaVersion ?? 0) < 10) {
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day =>
        (day.exercises ?? []).forEach(ex => { delete ex.targetSets; })
      )
    );
    (raw.customTemplate ?? []).forEach(day =>
      (day.exercises ?? []).forEach(ex => { delete ex.targetSets; })
    );
    raw.meta = {
      ...raw.meta,
      schemaVersion: 10,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v10 → v11: add nextWeekPlanConfirmed to all exercises
  if ((raw.meta?.schemaVersion ?? 0) < 11) {
    const _addConfirmed = ex => { if (ex.nextWeekPlanConfirmed === undefined) ex.nextWeekPlanConfirmed = false; };
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_addConfirmed))
    );
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_addConfirmed));
    raw.meta = {
      ...raw.meta,
      schemaVersion: 11,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v11 → v12: add sessionStartTs/sessionEndTs to all days + backup reminder counter
  if ((raw.meta?.schemaVersion ?? 0) < 12) {
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => {
        if (day.sessionStartTs === undefined) day.sessionStartTs = null;
        if (day.sessionEndTs   === undefined) day.sessionEndTs   = null;
      })
    );
    if (raw.settings.weeksSinceLastBackupReminder === undefined) raw.settings.weeksSinceLastBackupReminder = 0;
    if (raw.settings.maxSessionMs                 === undefined) raw.settings.maxSessionMs                 = 10800000;
    raw.meta = {
      ...raw.meta,
      schemaVersion: 12,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

  // v12 → v13: add sleepHours/energyLevel to all days
  if ((raw.meta?.schemaVersion ?? 0) < 13) {
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => {
        if (day.sleepHours  === undefined) day.sleepHours  = null;
        if (day.energyLevel === undefined) day.energyLevel = null;
      })
    );
    raw.meta = { ...raw.meta, schemaVersion: 13 };
  }

  // v13 → v14: add progressionType to all exercises
  if ((raw.meta?.schemaVersion ?? 0) < 14) {
    const _addPT = ex => { if (ex.progressionType === undefined) ex.progressionType = 'weight'; };
    (raw.weeks ?? []).forEach(wk => (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_addPT)));
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_addPT));
    raw.meta = { ...raw.meta, schemaVersion: 14 };
  }

  // v14 → v15: add badges array, retroactively grant earned badges
  if ((raw.meta?.schemaVersion ?? 0) < 15) {
    if (!Array.isArray(raw.badges)) raw.badges = [];
    const streak = _calcCurrentStreak(raw.weeks ?? []);
    const now    = new Date().toISOString();
    for (const thr of BADGE_THRESHOLDS) {
      if (streak >= thr.weeks && !raw.badges.some(b => b.id === thr.id)) {
        raw.badges.push({ id: thr.id, unlockedAt: now });
      }
    }
    raw.meta = { ...raw.meta, schemaVersion: 15 };
  }

  // v15 → v17: ensure all weeks have a mode field (vacation mode introduced)
  if ((raw.meta?.schemaVersion ?? 0) < 17) {
    (raw.weeks ?? []).forEach(wk => {
      if (!wk.mode) wk.mode = 'standard';
    });
    raw.meta = { ...raw.meta, schemaVersion: 17 };
  }

  // v17 → v18: add isVacation to all days
  if ((raw.meta?.schemaVersion ?? 0) < 18) {
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => {
        if (day.isVacation === undefined) day.isVacation = false;
      })
    );
    (raw.customTemplate ?? []).forEach(day => {
      if (day.isVacation === undefined) day.isVacation = false;
    });
    raw.meta = { ...raw.meta, schemaVersion: 18 };
  }

  // v18 → v19: add vacationPlan to all days
  if ((raw.meta?.schemaVersion ?? 0) < 19) {
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => {
        if (day.vacationPlan === undefined) day.vacationPlan = null;
      })
    );
    (raw.customTemplate ?? []).forEach(day => {
      if (day.vacationPlan === undefined) day.vacationPlan = null;
    });
    raw.meta = { ...raw.meta, schemaVersion: 19 };
  }

  // v19 → v20: add ex.oneRM to all exercises
  if ((raw.meta?.schemaVersion ?? 0) < 20) {
    const _addOneRM = ex => { if (ex.oneRM === undefined) ex.oneRM = null; };
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_addOneRM))
    );
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_addOneRM));
    raw.meta = { ...raw.meta, schemaVersion: 20 };
  }

  // v20 → v21: add ex.prWeight + ex.prRepsAtMaxWeight to all exercises
  if ((raw.meta?.schemaVersion ?? 0) < 21) {
    const _addPR = ex => {
      if (ex.prWeight           === undefined) ex.prWeight           = null;
      if (ex.prRepsAtMaxWeight  === undefined) ex.prRepsAtMaxWeight  = null;
    };
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_addPR))
    );
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_addPR));
    raw.meta = { ...raw.meta, schemaVersion: 21 };
  }

  // v21 → v22: add state.customExercises[]
  if ((raw.meta?.schemaVersion ?? 0) < 22) {
    if (!Array.isArray(raw.customExercises)) raw.customExercises = [];
    raw.meta = { ...raw.meta, schemaVersion: 22 };
  }

  // v22 → v23: add state.lastReentryHandled + state.longestStreakEver
  if ((raw.meta?.schemaVersion ?? 0) < 23) {
    if (raw.lastReentryHandled === undefined) raw.lastReentryHandled = null;
    raw.longestStreakEver = _calcLongestStreakEver(raw.weeks ?? []);
    raw.meta = { ...raw.meta, schemaVersion: 23 };
  }

  // v23 → v24: add state.settings.dismissedNamePairs
  if ((raw.meta?.schemaVersion ?? 0) < 24) {
    if (!Array.isArray(raw.settings.dismissedNamePairs)) raw.settings.dismissedNamePairs = [];
    raw.meta = { ...raw.meta, schemaVersion: 24 };
  }

  // v24 → v25: add state.streakFreeze + state.surpriseLog
  if ((raw.meta?.schemaVersion ?? 0) < 25) {
    if (!raw.streakFreeze || typeof raw.streakFreeze !== 'object') {
      raw.streakFreeze = { activeUntilWeekStart: null, lastUsedMonth: null };
    } else {
      if (raw.streakFreeze.activeUntilWeekStart === undefined) raw.streakFreeze.activeUntilWeekStart = null;
      if (raw.streakFreeze.lastUsedMonth === undefined) raw.streakFreeze.lastUsedMonth = null;
    }
    if (!raw.surpriseLog || typeof raw.surpriseLog !== 'object') raw.surpriseLog = {};
    raw.meta = { ...raw.meta, schemaVersion: 25 };
  }

  // v25 → v26: add ex.progressionMode + ex.targetRepsMax + ex.prRepsHistory
  // to all exercises. progressionMode is a SEPARATE axis from the existing
  // progressionType ('weight'|'reps'|'sets', controls the manual next-week
  // plan button) — do not confuse the two.
  if ((raw.meta?.schemaVersion ?? 0) < 26) {
    const _addProgressionMode = ex => {
      if (ex.progressionMode === undefined) ex.progressionMode = 'weight_first';
      if (ex.targetRepsMax   === undefined) ex.targetRepsMax   = null;
      if (ex.prRepsHistory   === undefined) ex.prRepsHistory   = {};
    };
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_addProgressionMode))
    );
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_addProgressionMode));
    raw.meta = { ...raw.meta, schemaVersion: 26 };
  }

  // v26 → v27: add state.plateauActions (Sprint C2, train-v109)
  if ((raw.meta?.schemaVersion ?? 0) < 27) {
    if (!raw.plateauActions || typeof raw.plateauActions !== 'object') raw.plateauActions = {};
    raw.meta = { ...raw.meta, schemaVersion: 27 };
  }

  // v27 → v28: add state.settings.autoWeek (Sprint C3, train-v110)
  if ((raw.meta?.schemaVersion ?? 0) < 28) {
    if (!raw.settings.autoWeek || typeof raw.settings.autoWeek !== 'object') {
      raw.settings.autoWeek = { enabled: false, suggestProgress: true, showReview: true };
    } else {
      if (raw.settings.autoWeek.enabled         === undefined) raw.settings.autoWeek.enabled         = false;
      if (raw.settings.autoWeek.suggestProgress === undefined) raw.settings.autoWeek.suggestProgress = true;
      if (raw.settings.autoWeek.showReview      === undefined) raw.settings.autoWeek.showReview      = true;
    }
    raw.meta = { ...raw.meta, schemaVersion: 28 };
  }

  // v28 → v29: bodyData.weightLog — tägliche Gewichtseinträge pro Woche
  if ((raw.meta?.schemaVersion ?? 0) < 29) {
    (raw.weeks ?? []).forEach(wk => {
      if (!wk.bodyData) wk.bodyData = {};
      if (!Array.isArray(wk.bodyData.weightLog)) {
        wk.bodyData.weightLog = wk.bodyData.weight != null
          ? [{ date: wk.startDate, weight: wk.bodyData.weight }]
          : [];
      }
    });
    raw.meta = { ...raw.meta, schemaVersion: 29 };
  }

  // v29 → v30 (B18): ex.metricStep für Distanz/Zeit-Übungen (metric 'm'/'sec')
  // ergänzen, Analogon zu ex.weightStep. Zusätzlich: bei bestehenden Übungen
  // mit metric 'm'/'sec' und progressionType noch auf dem unveränderten
  // Default 'weight' — dort ist 'weight' bedeutungslos (kein Gewicht
  // getrackt), 'reps' ist der sinnvolle Default (bumpt targetReps = Ziel-
  // Distanz/-Zeit). NUR der unveränderte Default wird korrigiert — eine
  // Übung, bei der der Nutzer bereits bewusst 'sets' gewählt hat, bleibt
  // unangetastet.
  if ((raw.meta?.schemaVersion ?? 0) < 30) {
    const _fixMetricProgression = ex => {
      if (ex.metric === 'm' && ex.metricStep === undefined) ex.metricStep = 50;
      else if (ex.metric === 'sec' && ex.metricStep === undefined) ex.metricStep = 10;
      if ((ex.metric === 'm' || ex.metric === 'sec') && ex.progressionType === 'weight') {
        ex.progressionType = 'reps';
      }
    };
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_fixMetricProgression))
    );
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_fixMetricProgression));
    raw.meta = { ...raw.meta, schemaVersion: 30 };
  }

  // v30 → v31 (B65): Squat/Hinge-Übungen (Kniebeuge/Kreuzheben-Varianten)
  // bekommen automatisch eine größere Schrittweite (5kg statt 2.5kg) —
  // Nutzer meldete, die automatische Gewichtssteigerung wirke bei Squats
  // "immer noch 1,25kg", obwohl die Empfehlungs-Logik selbst (B48) bereits
  // korrekt ex.weightStep respektiert. Root Cause war das Fehlen eines
  // kategorie-bewussten Defaults bei der Übungs-Erstellung, nicht die
  // Empfehlungs-Logik. NUR Übungen, deren Schrittweite noch auf dem nie
  // angefassten Standard steht (undefined ODER exakt 2.5), werden
  // angehoben — eine bereits bewusst vom Nutzer gewählte andere
  // Schrittweite (z.B. 1.25 für eine leichte Squat-Variante) bleibt
  // unangetastet.
  if ((raw.meta?.schemaVersion ?? 0) < 31) {
    const _catMap = buildCategoryMap(raw.customExercises ?? []);
    const _bumpSquatHingeStep = ex => {
      if (ex.weightStep !== undefined && ex.weightStep !== 2.5) return;
      const cat = resolveCategory(ex.name, _catMap);
      if (cat === 'Squat' || cat === 'Hinge') ex.weightStep = 5;
    };
    (raw.weeks ?? []).forEach(wk =>
      (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_bumpSquatHingeStep))
    );
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_bumpSquatHingeStep));
    raw.meta = { ...raw.meta, schemaVersion: 31 };
  }

  // v31 → v32 (B76): Pre-Session Check-in + Briefing — bestehende Tage
  // bekommen sessionCheckIn/sessionModifier als null, kein Verhaltensunterschied
  // bis der Nutzer das erste Mal einen aktuellen, noch offenen Tag öffnet.
  if ((raw.meta?.schemaVersion ?? 0) < 32) {
    (raw.weeks ?? []).forEach(wk => (wk.days ?? []).forEach(day => {
      if (day.sessionCheckIn === undefined)  day.sessionCheckIn  = null;
      if (day.sessionModifier === undefined) day.sessionModifier = null;
    }));
    raw.meta = { ...raw.meta, schemaVersion: 32 };
  }

  // v32 → v33 (B129): skipReason/skipDate (Skip-Grund-Abfrage bei komplett
  // übersprungenen Übungen) + nextWeekPlanAutoReviewed (B128, war seit der
  // vorherigen Runde nur als In-Memory-Default an Erstellungsstellen gesetzt,
  // bestehende gespeicherte Übungen brauchen einen echten Backfill).
  if ((raw.meta?.schemaVersion ?? 0) < 33) {
    const _normExSkip = ex => {
      if (ex.skipReason === undefined) ex.skipReason = null;
      if (ex.skipDate === undefined) ex.skipDate = null;
      if (ex.nextWeekPlanAutoReviewed === undefined) ex.nextWeekPlanAutoReviewed = true;
    };
    (raw.weeks ?? []).forEach(wk => (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_normExSkip)));
    (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_normExSkip));
    raw.meta = { ...raw.meta, schemaVersion: 33 };
  }

  // Always-apply defaults for settings added in later versions
  if (raw.settings.vibrationEnabled               === undefined) raw.settings.vibrationEnabled               = true;
  // Runde 19/Cluster 3: fehlte hier bisher komplett (B210/Runde 17 hatte nur
  // die UI ergänzt) -- SETTING_TOGGLE toggled nur Keys, die bereits in
  // state.settings existieren, war für Bestandsnutzer dauerhaft ein No-Op.
  if (raw.settings.soundEnabled                   === undefined) raw.settings.soundEnabled                   = false;
  if (raw.settings.showPauseTips                  === undefined) raw.settings.showPauseTips                  = false;
  if (raw.settings.rpeEnabled                     === undefined) raw.settings.rpeEnabled                     = true;
  // Solotest-Feedback (2026-08-16): Default false->true (Opt-out statt
  // Opt-in) -- die manuelle Bestätigung jedes einzelnen Satzes wurde im
  // Solotest als unnötige Reibung empfunden; automatische Bewertung bei
  // Blur ist der erwartete Normalfall, manuelles Bestätigen bleibt über den
  // Schalter weiterhin für Nutzer verfügbar, die es explizit wollen.
  if (raw.settings.autoEval                       === undefined) raw.settings.autoEval                       = true;
  if (raw.settings.weeksSinceLastBackupReminder   === undefined) raw.settings.weeksSinceLastBackupReminder   = 0;
  if (raw.settings.maxSessionMs                   === undefined) raw.settings.maxSessionMs                   = 10800000;
  if (raw.settings.autoStartPauseTimer            === undefined) raw.settings.autoStartPauseTimer            = true;
  if (raw.settings.hideStreakBadge                === undefined) raw.settings.hideStreakBadge                = false;
  if (raw.settings.hideStopwatch                  === undefined) raw.settings.hideStopwatch                  = false;
  if (raw.settings.largestPlate                   === undefined) raw.settings.largestPlate                   = 25;
  if (raw.settings.sessionCoach                   === undefined) raw.settings.sessionCoach                   = true;
  if (raw.settings.goal                           === undefined) raw.settings.goal                           = null;
  if (raw.settings.nutritionPhase                 === undefined) raw.settings.nutritionPhase                 = 'maintenance';
  if (!Array.isArray(raw.settings.dismissedNamePairs)) raw.settings.dismissedNamePairs = [];
  if (!raw.coachQuestion || typeof raw.coachQuestion !== 'object') {
    raw.coachQuestion = { weekStart: null, questionId: null, answer: null, outcome: null, measuredWeekStart: null };
  }
  if (raw.coachQuestion.outcome           === undefined) raw.coachQuestion.outcome           = null;
  if (raw.coachQuestion.measuredWeekStart === undefined) raw.coachQuestion.measuredWeekStart = null;
  if (!Array.isArray(raw.coachQuestionHistory)) raw.coachQuestionHistory = [];
  if (!raw.coachPerformance || typeof raw.coachPerformance !== 'object') {
    raw.coachPerformance = { suggestions: [] };
  }
  if (!Array.isArray(raw.coachPerformance.suggestions)) {
    raw.coachPerformance.suggestions = [];
  }
  if (!raw.substituteHistory || typeof raw.substituteHistory !== 'object') {
    raw.substituteHistory = {};
  }
  if (!raw.exerciseNotes || typeof raw.exerciseNotes !== 'object') {
    raw.exerciseNotes = {}; // B127: additiver Default, kein SCHEMA_VERSION-Bump (Präzedenzfall substituteHistory)
  }
  if (!raw.customAlternatives || typeof raw.customAlternatives !== 'object') {
    raw.customAlternatives = {}; // B138: additiver Default, kein SCHEMA_VERSION-Bump (Präzedenzfall substituteHistory/exerciseNotes)
  }

  // Always-apply: week label (optional user-set name, no schema bump needed)
  (raw.weeks ?? []).forEach(wk => { if (!('label' in wk)) wk.label = ''; });

  // isSeedWeek: additive flag for synthetic onboarding seed weeks
  (raw.weeks ?? []).forEach(wk => { if (wk.isSeedWeek === undefined) wk.isSeedWeek = false; });

  // Backward compat: rename legacy setType 'pyramid' → 'manual'
  const _normSetType = ex => { if (ex.setType === 'pyramid') ex.setType = 'manual'; };
  (raw.weeks ?? []).forEach(wk => (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_normSetType)));
  (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_normSetType));

  // Runde 9 (Cluster 4): Muskelgruppen-Backfill für Bestandsdaten — B184
  // (Runde 8) hat resolveMuscleGroups() nur für NEU erstellte Übungen
  // verdrahtet. Additiver Default, kein SCHEMA_VERSION-Bump (Präzedenzfall
  // exerciseNotes/customAlternatives) — ex.tags existiert als Feld bereits
  // seit einer älteren Migration, hier wird nur ein bereits leeres Feld
  // befüllt, keine neue Form eingeführt. Bewusst schlank: nur exakte
  // Namenstreffer in der B184-Kuration, individuell umbenannte/eigene
  // Übungen bleiben unangetastet (akzeptierte Lücke, wie in B184 entschieden).
  // Idempotent: einmal befüllte tags sind nicht mehr leer, Guard no-opt danach.
  const _backfillMuscleGroupTags = ex => {
    if (!Array.isArray(ex.tags) || ex.tags.length) return;
    const resolved = resolveMuscleGroups(ex.name);
    if (resolved.length) ex.tags = resolved;
  };
  (raw.weeks ?? []).forEach(wk => (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_backfillMuscleGroupTags)));
  (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_backfillMuscleGroupTags));

  // Always-apply, rein subtraktiv (Sprint "Framework-Audit Cleanup", Fix 1+2):
  // streakFreeze (Fix 2) und surpriseLog (Fix 1) entfernt — kein neuer
  // Schema-Bump, da nur Löschung, keine neue Struktur. Absichtlich NICHT im
  // historischen v24→v25-Block angefasst (bleibt als Aufzeichnung, was diese
  // Version damals einführte).
  if ('streakFreeze' in raw) delete raw.streakFreeze;
  if ('surpriseLog'  in raw) delete raw.surpriseLog;

  return raw;
}

// ─── Load from localStorage ───────────────────────────────────────────────────

export function loadState() {
  const sources = [
    () => localStorage.getItem(STORAGE_KEY),
    () => localStorage.getItem(STORAGE_KEY_SHADOW), // fallback
  ];

  for (const source of sources) {
    try {
      const raw = source();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed?.weeks)) continue;
      STATE = migrate(parsed);
      if (!Array.isArray(STATE.favoriteExercises)) STATE.favoriteExercises = [];
      if (!Array.isArray(STATE.customExercises))   STATE.customExercises   = [];
      if (!Array.isArray(STATE.decisionLog))        STATE.decisionLog       = [];
      if (STATE.settings.erkenntnisseHorizont === undefined) STATE.settings.erkenntnisseHorizont = 8;
      if (STATE.lastReentryHandled === undefined)  STATE.lastReentryHandled = null;
      // _showNote is transient UI state — never survive a reload
      STATE.weeks.forEach(w => w.days.forEach(d => d.exercises.forEach(ex =>
        ex.sets.forEach(s => { delete s._showNote; })
      )));
      if (typeof STATE.longestStreakEver !== 'number') STATE.longestStreakEver = _calcLongestStreakEver(STATE.weeks);
      if (!Array.isArray(STATE.badges))            STATE.badges = [];
      if (!Array.isArray(STATE.seenTips))          STATE.seenTips = [];
      if (STATE.onboardingDone === undefined)       STATE.onboardingDone = false;
      // Defensive bounds check — only restore missing week when onboarding is already done
      if (!STATE.weeks.length && STATE.onboardingDone) _appendDefaultWeek();
      // Persisted data may predate the sort invariant (or be hand-edited/imported
      // out of order) — enforce it on every load, keeping curIdx on the same week.
      if (STATE.curIdx < 0 || STATE.curIdx >= STATE.weeks.length) STATE.curIdx = 0;
      _resortWeeksKeepingCurrent(STATE, STATE.weeks[STATE.curIdx]);
      _recalcExercisePRs(STATE);
      _checkAndGrantBadges(STATE);
      console.log('[TRAIN] streak:', _calcCurrentStreak(STATE.weeks), 'badges:', STATE.badges);
      // In-Memory-only — nie persistiert (siehe persistState() unten, läuft
      // VOR diesem Reset). Explizit auf false erzwingen, falls ein früherer
      // Build es doch einmal mitserialisiert hat: ein stehengebliebenes
      // "true" aus einer alten Session dürfte sonst beim nächsten
      // Training-Tab-Öffnen fälschlich den Modal-Flow erneut anstoßen.
      STATE.autoWeekPending = false;
      _checkAndAutoCreateWeek(STATE);
      persistState(); // re-write so both keys are in sync
      return true;
    } catch (e) {
      console.warn('[TRAIN] loadState: parse error from source, trying next.', e);
    }
  }

  // Nothing recoverable – start fresh; onboarding will create the first week
  console.log('[TRAIN] loadState: fresh start — no saved data');
  STATE = buildDefaultState();
  STATE.autoWeekPending = false;
  persistState();
  return false;
}

// ─── Subscription ─────────────────────────────────────────────────────────────

/**
 * Register a listener that is called with the current state after every
 * dispatch. Returns an unsubscribe function.
 *
 * @param {function(state: object): void} listener
 * @returns {function(): void} unsubscribe
 */
export function subscribe(listener) {
  _subscribers.add(listener);
  return () => _subscribers.delete(listener);
}

function _notify() {
  for (const listener of _subscribers) {
    try { listener(STATE); } catch (e) { console.error('[TRAIN] subscriber threw', e); }
  }
}

// ─── Read-only state accessor ────────────────────────────────────────────────

/** Returns a read-only view of the current state. Never mutate this directly. */
export function getState() {
  return STATE; // UI reads only; all writes go through dispatch()
}

/**
 * Resets the in-memory-only autoWeekPending flow flag (Sprint C3,
 * train-v110) once the review/suggestion modal sequence is done.
 * Deliberately bypasses dispatch()/persistState() — this flag must NEVER
 * be written to localStorage, only loadState() may set it true again.
 */
export function clearAutoWeekPending() {
  STATE.autoWeekPending = false;
}

// ─── Week helpers (used inside reducers) ─────────────────────────────────────

function _currentWeek() {
  return STATE.weeks[STATE.curIdx] ?? null;
}

const _exNameKey = name => String(name ?? '').trim().toLowerCase();

/**
 * B124: sucht Einstellungen (weightStep/targetReps/pauseSec/progressionType/
 * metric/tags) einer bereits existierenden Übung mit demselben Namen
 * (case-insensitive), damit EX_ADD sie statt Default-Werten übernehmen kann.
 * Suchreihenfolge, erster Treffer gewinnt:
 *   1. aktueller Tag, andere Position
 *   2. andere Tage dieser Woche
 *   3. letzte Woche (curIdx-1)
 *   4. ältere Wochen, neueste zuerst (curIdx-2 abwärts)
 * `weight`/`sets` sind bewusst NICHT Teil des Rückgabewerts — die bleiben
 * immer frisch (siehe EX_ADD).
 */
function _findExerciseSettingsHistory(state, name, di) {
  const key = _exNameKey(name);
  if (!key) return null;
  // Trainings-Tab-Audit (2026-08-17): showPlates/metricStep ergänzt -- ein
  // bewusst ausgeschalteter Hantelscheiben-Rechner oder eine individuelle
  // Distanz-/Zeit-Schrittweite ging bisher beim Entfernen+Neu-Hinzufügen
  // (oder erstmaligem Hinzufügen in einer neuen Woche mit History) verloren,
  // während alle anderen Einstellungen erhalten blieben.
  const pick = ex => ({
    weightStep: ex.weightStep, targetReps: ex.targetReps, pauseSec: ex.pauseSec,
    progressionType: ex.progressionType, metric: ex.metric,
    tags: Array.isArray(ex.tags) ? [...ex.tags] : [],
    showPlates: ex.showPlates, metricStep: ex.metricStep,
  });
  const wk = state.weeks[state.curIdx];
  if (!wk) return null;

  // 1. aktueller Tag, andere Position
  const curDay = wk.days[di];
  if (curDay) {
    const hit = curDay.exercises.find(ex => _exNameKey(ex.name) === key);
    if (hit) return pick(hit);
  }
  // 2. andere Tage dieser Woche
  for (let i = 0; i < wk.days.length; i++) {
    if (i === di) continue;
    const hit = wk.days[i].exercises.find(ex => _exNameKey(ex.name) === key);
    if (hit) return pick(hit);
  }
  // 3. letzte Woche, 4. ältere Wochen (neueste zuerst)
  // state.js-Audit (Runde 35, B5): isSeedWeek ausgeschlossen -- die
  // synthetische ONBOARDING_SEED-"Startwerte"-Woche setzt tags: [] für
  // JEDE Seed-Übung hart, was den korrekt über resolveMuscleGroups()
  // berechneten Default sonst überschrieben hätte (weightStep/targetReps/
  // etc. aus der Seed-Woche bleiben unproblematisch und werden weiterhin
  // übernommen).
  for (let wi = state.curIdx - 1; wi >= 0; wi--) {
    const w = state.weeks[wi]; if (!w || w.isSeedWeek) continue;
    for (const day of w.days) {
      const hit = day.exercises.find(ex => _exNameKey(ex.name) === key);
      if (hit) return pick(hit);
    }
  }
  return null;
}

const SUBSTITUTE_HISTORY_MAX_PER_EXERCISE = 5;
const SUBSTITUTE_HISTORY_MAX_TOTAL        = 50;

/**
 * D2: merkt sich, dass `originalName` heute durch `substituteName` ersetzt
 * wurde — aufgerufen aus dem EX_SET_SUBSTITUTE-Reducer, NUR wenn beide
 * Namen bekannt und unterschiedlich sind (ein Selbstverweis entsteht, wenn
 * "Heute anders" bestätigt wird BEVOR die Übung im Namensfeld umbenannt
 * wurde — siehe Diagnose im Sprint-Plan, kein Fehler, nur kein sinnvoller
 * Eintrag). Pro Original max. 5 Einträge (älteste nach lastUsed zuerst
 * entfernt), global max. 50 Einträge über alle Originale hinweg.
 */
function _recordSubstitution(state, originalName, substituteName) {
  if (!originalName || !substituteName || originalName === substituteName) return;
  if (!state.substituteHistory || typeof state.substituteHistory !== 'object') state.substituteHistory = {};
  const hist = state.substituteHistory;
  const list = hist[originalName] ?? (hist[originalName] = []);
  // state.js-Audit (Runde 35, B1): UTC-Datum statt lokaler Datumskomponenten
  // -- dasselbe, im Projekt bereits mehrfach gefixte Antimuster.
  const today = _localISODateToday();
  const existing = list.find(e => e.name === substituteName);
  if (existing) {
    existing.count += 1;
    existing.lastUsed = today;
  } else {
    list.push({ name: substituteName, count: 1, lastUsed: today });
  }
  if (list.length > SUBSTITUTE_HISTORY_MAX_PER_EXERCISE) {
    list.sort((a, b) => a.lastUsed < b.lastUsed ? 1 : -1);
    list.length = SUBSTITUTE_HISTORY_MAX_PER_EXERCISE;
  }
  const totalEntries = Object.values(hist).reduce((sum, l) => sum + l.length, 0);
  if (totalEntries > SUBSTITUTE_HISTORY_MAX_TOTAL) {
    const flat = [];
    for (const [origName, entries] of Object.entries(hist)) {
      entries.forEach(e => flat.push({ origName, entry: e }));
    }
    flat.sort((a, b) => a.entry.lastUsed < b.entry.lastUsed ? 1 : -1);
    flat.slice(SUBSTITUTE_HISTORY_MAX_TOTAL).forEach(({ origName, entry }) => {
      const arr = hist[origName];
      const idx = arr.indexOf(entry);
      if (idx !== -1) arr.splice(idx, 1);
      if (arr.length === 0) delete hist[origName];
    });
  }
}

/**
 * Chronologically latest week by startDate — NOT curIdx (the week being
 * viewed) and NOT weeks[weeks.length-1] (array order, which can drift from
 * chronological order once future-dated test/placeholder weeks exist).
 * Used throughout for "the current/most recent week" (Plateau/Progression-
 * Checks, KI-Empfehlungen im Neue-Woche-Modal, etc.). NICHT mehr die Woche,
 * die WEEK_CREATE/AUTO_WEEK_CREATE als Vorlage klont, wenn diese eine
 * Seed-Woche ist — siehe _templateWeekForNewWeek() unten (Sprint
 * "Kategorie-1-Bugfixes", Fix 2).
 */
export function getLatestWeek(weeks) {
  if (!weeks?.length) return null;
  return [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate))[weeks.length - 1];
}

/**
 * Vorlagen-Woche für WEEK_CREATE(source='prev')/AUTO_WEEK_CREATE: die
 * chronologisch letzte ECHTE (nicht-Seed) Woche. Seed-Wochen sind
 * synthetische Onboarding-Platzhalter (Startwerte-Baseline, keine echten
 * Trainingsdaten) — als Klon-Vorlage für eine neue Trainingswoche
 * ungeeignet (Sprint "Kategorie-1-Bugfixes", Fix 2a). Fällt auf die
 * chronologisch letzte Woche insgesamt zurück, falls ALLE Wochen Seed-
 * Wochen sind (kann nicht "keine Vorlage" liefern, solange weeks.length>0).
 */
function _templateWeekForNewWeek(weeks) {
  const sorted = [...weeks].sort((a, b) => b.startDate.localeCompare(a.startDate));
  return sorted.find(w => !w.isSeedWeek) ?? sorted[0] ?? null;
}

/**
 * Sprint C2 (Teil B): reduziert die Satz-Anzahl jeder nicht-archivierten
 * Übung der übergebenen Tage auf 60% (min. 2 Sätze) — überzählige Sätze
 * werden per `s.deloadSkip = true` markiert, NICHT gelöscht (der Athlet
 * soll sehen was wegfällt). Gewicht bleibt unangetastet (Intensität halten,
 * Volumen reduzieren, siehe DECISIONS.md/Pritchard et al. 2015). Idempotent:
 * rekonstruiert deloadSkip immer neu aus ex.sets.length, ein erneuter Aufruf
 * auf denselben Tagen produziert dasselbe Ergebnis (kein Doppel-Reduzieren).
 */
function _applyDeloadReduction(days) {
  for (const day of days) {
    for (const ex of day.exercises ?? []) {
      if (ex.archived) continue;
      const total = ex.sets.length;
      const target = Math.min(total, Math.max(2, Math.round(total * 0.6)));
      ex.sets.forEach((s, si) => { s.deloadSkip = si >= target; });
    }
  }
}

/** Letzte Woche vor einer Deload-Woche (rückwärts, schließt Deload/Urlaub/Seed-Wochen aus) — für den Restore nach der Deload-Woche (Sprint C2 Teil B). */
function _findPreDeloadWeek(weeks) {
  const sorted = _sortWeeksChrono(weeks);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const w = sorted[i];
    if (w.mode !== 'deload' && w.mode !== 'vacation' && !w.isSeedWeek) return w;
  }
  return null;
}

/**
 * Gemeinsame Klon-Quellen-Auflösung für WEEK_CREATE(source:'prev') UND
 * AUTO_WEEK_CREATE (Sprint C2 Teil B) — ein einziger Ort statt zweier
 * Kopien, die sonst auseinanderdriften könnten. War die Vorlagen-Woche
 * selbst eine Deload-Woche, wird stattdessen aus der Woche VOR dem Deload
 * geklont (originale Satz-Anzahl/Gewichte, siehe DECISIONS.md) statt aus
 * der reduzierten Deload-Woche selbst.
 */
function _resolveWeekCloneSource(weeks) {
  const templateWeek = _templateWeekForNewWeek(weeks);
  const pendingDeload = !!templateWeek?.deloadPlannedForNext;
  const cloneSourceWeek = templateWeek?.mode === 'deload'
    ? (_findPreDeloadWeek(weeks) ?? templateWeek)
    : templateWeek;
  return { templateWeek, cloneSourceWeek, pendingDeload };
}

/**
 * INVARIANT: state.weeks must always be sorted chronologically by startDate.
 * Every piece of code that does "curIdx - 1" / "curIdx + 1" / "weeks.length-1"
 * to mean "the previous/next/latest week" (WEEK_COPY_PREV, the Next-button
 * disable check, prevDay/prevEx/prevWk lookups, etc.) relies on array
 * position == chronological position. Any reducer case that pushes,
 * splices, or replaces state.weeks MUST call _resortWeeksKeepingCurrent()
 * (or _sortWeeksChrono() directly for read-only helpers) immediately after,
 * or this invariant silently breaks and those lookups return wrong weeks.
 */
function _sortWeeksChrono(weeks) {
  return [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/**
 * Sorts state.weeks chronologically and re-points state.curIdx at the same
 * logical week (by object reference) it pointed to before the mutation —
 * sorting must never silently shift "the week being viewed" to a different
 * one. If refWeek is no longer present (e.g. it was just deleted), falls
 * back to clamping curIdx within bounds.
 */
function _resortWeeksKeepingCurrent(state, refWeek) {
  state.weeks = _sortWeeksChrono(state.weeks);
  if (refWeek) {
    const idx = state.weeks.indexOf(refWeek);
    if (idx >= 0) { state.curIdx = idx; return; }
  }
  if (state.curIdx >= state.weeks.length) state.curIdx = Math.max(0, state.weeks.length - 1);
}

function _appendDefaultWeek(startDate) {
  const days = clone(STATE.customTemplate ?? FACTORY_TEMPLATE);
  // Onboarding-Flow-Audit (Runde 28): _resetClonedDays() statt der
  // unvollständigen manuellen _resetExerciseSubstitution()-Nur-Kopie --
  // fünfte unabhängige Klon-Reset-Fundstelle mit denselben Lücken wie
  // B288/B308 (locked/markedDone/isVacation, alle Session-Felder,
  // skipReason/skipDate, Satz-Bewertungen blieben bisher stehen).
  // customTemplate kann aus einer echten, bereits bespielten Woche stammen
  // ("Woche als Vorlage speichern") -- relevant für beide Aufrufer dieser
  // Funktion: den ONBOARDING_DONE-Fallback und den BACKUP_IMPORT-Fallback.
  _resetClonedDays(days);
  const newWk = {
    id:         Date.now(),
    startDate:  startDate ?? _nextMonday(),
    note:       '',
    mode:       'standard',
    days,
    sessionLog: [],
    bodyData:   {},
    restDays:   [],
  };
  STATE.weeks.push(newWk);
  _resortWeeksKeepingCurrent(STATE, newWk);
}

// Onboarding-Flow-Audit (Runde 28): lokales Datum statt .toISOString()
// (UTC) -- dasselbe, im Projekt bereits mehrfach gefixte Antimuster
// (_localISODateToday() oben, weekReview.js _localISODate() u.a.).
function _nextMonday() {
  const d   = new Date();
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Monday of THIS (current) calendar week, as an ISO date — same calc as
 * ui.js' onboarding _applyBlank(), deliberately NOT _nextMonday() above
 * (which computes the UPCOMING Monday, one week later). Used by the
 * Sprint C3 (train-v110) auto-week-creation trigger.
 */
function _currentMonday() {
  const d   = new Date();
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  // Onboarding-Flow-Audit (Runde 28): lokales Datum statt .toISOString()
  // (UTC), gleicher Grund wie bei _nextMonday() oben.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Sprint C3 (train-v110): prüft beim App-Öffnen ob die aktuelle Kalender-
 * woche automatisch angelegt werden soll. Reine Bedingungsprüfung + Dispatch
 * — der eigentliche Modal-Flow (Wochenrückblick/Steigerungsvorschläge) lebt
 * in ui.js und reagiert auf state.autoWeekPending.
 */
function _checkAndAutoCreateWeek(state) {
  if (!state.settings?.autoWeek?.enabled) return;
  if (!state.weeks.length) return; // Bedingung b: braucht eine Vorwoche als Vorlage
  const startDate = _currentMonday();
  if (state.weeks.find(w => w.startDate === startDate)) return; // Bedingung c: existiert schon
  dispatch(A.AUTO_WEEK_CREATE, { startDate });
}

// ─── Action type catalogue ────────────────────────────────────────────────────

export const A = Object.freeze({
  // Navigation
  WEEK_NAVIGATE:       'WEEK_NAVIGATE',       // { delta: ±1 }
  // Week CRUD
  WEEK_CREATE:         'WEEK_CREATE',         // { startDate, note, source?: 'prev'|'template' }
  AUTO_WEEK_CREATE:    'AUTO_WEEK_CREATE',    // { startDate } – automatische Wochenerstellung beim App-Öffnen, Steigerungen NIE still angewendet
  WEEK_DELETE:         'WEEK_DELETE',         // { weekIdx?: number }  — omit to delete curIdx
  WEEK_COPY_PREV:      'WEEK_COPY_PREV',      // {}
  // Trainings-Tab-Audit (2026-08-17): mode:'deload' setzt HIER nur das Flag,
  // reduziert KEIN Volumen/Gewicht (das übernimmt ausschließlich
  // DELOAD_APPLY, siehe dort) -- die UI dispatcht WEEK_SET_MODE inzwischen
  // auch nur noch mit 'standard'/'vacation'. Für einen tatsächlich
  // wirksamen Deload-Wechsel DELOAD_APPLY nutzen, nicht diese Action.
  WEEK_SET_MODE:       'WEEK_SET_MODE',       // { mode: 'standard'|'vacation' } — für 'deload' siehe DELOAD_APPLY
  DELOAD_APPLY:        'DELOAD_APPLY',        // { weekIdx?, when: 'now'|'next' } – Sprint C2 Teil B: Volumen-Deload (Sätze reduzieren, Gewicht unverändert)
  WEEK_SET_NOTE:       'WEEK_SET_NOTE',       // { note }
  WEEK_SET_LABEL:      'WEEK_SET_LABEL',      // { label: string }
  // Day
  DAY_ADD:             'DAY_ADD',             // {}
  DAY_ADD_CLONE:       'DAY_ADD_CLONE',       // { sourceDi: number|null } – null = empty
  DAY_REMOVE:          'DAY_REMOVE',          // { di }
  DAY_DUPLICATE:       'DAY_DUPLICATE',       // { di }
  DAY_RESET_SETS:      'DAY_RESET_SETS',      // { di }
  DAY_TOGGLE_COMPLETE:       'DAY_TOGGLE_COMPLETE',       // { di }
  DAY_TOGGLE_VACATION:       'DAY_TOGGLE_VACATION',       // { di }
  DAY_LOAD_VACATION_PLAN:    'DAY_LOAD_VACATION_PLAN',    // { di, plan: 'bodyweight'|'light_kb'|'heavy_kb'|'hotel_gym'|'custom'|'rest' }
  WEEK_LOAD_VACATION_PLAN:   'WEEK_LOAD_VACATION_PLAN',   // { plan: 'bodyweight'|'light_kb'|'heavy_kb'|'hotel_gym'|'custom'|'rest' }
  DAY_SET_FIELD:             'DAY_SET_FIELD',             // { di, field, value }
  SESSION_CHECKIN_SET:       'SESSION_CHECKIN_SET',       // { di, sleep, energyPre, modifier, injuryFollowUp? } — B76 Pre-Session Check-in (injuryFollowUp seit B129)
  DAY_REDUCE_PENDING_WEIGHTS: 'DAY_REDUCE_PENDING_WEIGHTS', // { di } — B87 Fix 3: manueller Catch-up für die -10%-Reduktion (ein Dispatch für den ganzen Tag, nicht pro Satz, damit Undo den ganzen Klick in einem Schritt rückgängig macht)
  // Exercise
  EX_ADD:              'EX_ADD',              // { di, name, metric? }
  CUSTOM_EX_ADD:        'CUSTOM_EX_ADD',        // { name, metric, category }
  CUSTOM_EX_UPDATE:     'CUSTOM_EX_UPDATE',     // { oldName, name, metric, category }
  CUSTOM_EX_DELETE:     'CUSTOM_EX_DELETE',     // { name }
  EX_SET_CATEGORY_OVERRIDE: 'EX_SET_CATEGORY_OVERRIDE', // { name, category } – Bewegungskategorie-Override für Standardübungen (kein vollwertiger customExercises-Eintrag, kein metric-Feld)
  EX_MERGE_NAMES:       'EX_MERGE_NAMES',       // { variantNames: string[], finalName } – Übungsnamen-Bereinigung
  DISMISS_NAME_PAIR:    'DISMISS_NAME_PAIR',    // { a, b } – Ähnlichkeits-Kandidat dauerhaft verwerfen
  REENTRY_HANDLED:      'REENTRY_HANDLED',      // {} – marks current pause as handled (Ja/Nein)
  PLATEAU_ACTION:         'PLATEAU_ACTION',         // { exerciseName, action: 'ignored'|'implemented', since, plateauWeeksAtAction }
  EX_APPLY_REENTRY_REDUCTION: 'EX_APPLY_REENTRY_REDUCTION', // { factor } – reduces weights/targets in current week
  EX_REMOVE:           'EX_REMOVE',           // { di, ei }
  EX_ARCHIVE:          'EX_ARCHIVE',          // { di, ei, weekIdx } — blendet aus, löscht nicht
  EX_UNARCHIVE:        'EX_UNARCHIVE',        // { name: string } — reaktiviert in allen Wochen
  EX_UPDATE:           'EX_UPDATE',           // { di, ei, field, value }
  EX_MOVE:             'EX_MOVE',             // { di, fromEi, toEi }
  EXERCISE_MOVE_TO_DAY: 'EXERCISE_MOVE_TO_DAY', // { fromDi, toDi, ei } — B125: Übung in einen anderen Tag derselben Woche verschieben, atomar (Settings bleiben, Sätze werden frisch/pending)
  EX_TOGGLE_CFG:       'EX_TOGGLE_CFG',       // { di, ei }
  EX_INC_WEIGHT:       'EX_INC_WEIGHT',       // { di, ei, amount } – erhöht alle Sätze sofort
  EX_SET_NEXT_WEEK_PLAN:'EX_SET_NEXT_WEEK_PLAN',// { di, ei, value, weekIdx?, progressionType? } – setzt nextWeekPlan + confirmed=true (+ optional progressionType, atomar); weekIdx default = curIdx
  EX_TOGGLE_NEXT_WEEK_CONFIRMED: 'EX_TOGGLE_NEXT_WEEK_CONFIRMED', // { di, ei, weekIdx? } – toggelt confirmed; weekIdx default = curIdx
  EX_AUTO_PRESELECT_NEXT_WEEK_PLAN: 'EX_AUTO_PRESELECT_NEXT_WEEK_PLAN', // { selections: [{di, ei, value}], weekIdx? } – Coach-Chip Vorauswahl, kein User-Tap; weekIdx default = curIdx
  EX_MARK_AUTOPLAN_UNREVIEWED: 'EX_MARK_AUTOPLAN_UNREVIEWED', // { selections: [{di, ei}], weekIdx? } – B128: markiert einen bei Tagesabschluss automatisch gesetzten Plan als "noch nicht vom Nutzer gesehen" (Banner-Trigger); weekIdx default = curIdx
  EX_MARK_AUTOPLAN_REVIEWED: 'EX_MARK_AUTOPLAN_REVIEWED', // { selections: [{di, ei}], reject?: boolean, weekIdx? } – B128: Banner-Aktion "Übernehmen"/"Alle übernehmen" (reject=false, Plan bleibt) oder "Ablehnen" (reject=true, Plan wird zurückgesetzt); weekIdx default = curIdx
  EX_SET_SKIP_REASON:  'EX_SET_SKIP_REASON',  // { di, ei, reason: null|'injury'|'time'|'fatigue'|'substituted' } – B129: Grund für eine komplett übersprungene Übung (kein einziger bewerteter Satz)
  EX_SET_STEP:         'EX_SET_STEP',         // { di, ei, step }  – speichert Steigerungsrate (Gewicht, kg)
  EX_SET_METRIC_STEP:  'EX_SET_METRIC_STEP',  // { di, ei, step }  – speichert Steigerungsrate für Distanz/Zeit (metric 'm'/'sec', B18)
  EX_SET_TARGETS:      'EX_SET_TARGETS',      // { di, ei, targetReps?, progressionMode?, targetRepsMax? }
  EX_SET_METRIC:       'EX_SET_METRIC',       // { di, ei, metric: 'reps'|'sec'|'m' }
  // Set
  SET_ADD:             'SET_ADD',             // { di, ei }
  SET_REMOVE:          'SET_REMOVE',          // { di, ei, si }
  SET_UPDATE:          'SET_UPDATE',          // { di, ei, si, field, value }
  SET_TOGGLE_DONE:     'SET_TOGGLE_DONE',     // { di, ei, si }
  SET_AUTOFILL_RPE:    'SET_AUTOFILL_RPE',    // { di, ei, si } — rpe → next set only
  CONFIRM_SET:         'CONFIRM_SET',          // { di, ei, si, reps } — quick-confirm next pending set
  AUTO_EVAL_SET:       'AUTO_EVAL_SET',        // { di, ei, si, reps } — auto-evaluation on blur (autoEval setting)
  SET_RPE:             'SET_RPE',             // { di, ei, si, rpe: number }
  EX_SET_SUBSTITUTE:   'EX_SET_SUBSTITUTE',   // { di, ei, substituteFor: string|null }
  EXERCISE_NOTE_SET:   'EXERCISE_NOTE_SET',   // { name, value } — B127: schreibt state.exerciseNotes[name], permanent, keyed by exaktem Übungsnamen (wie state.prs/state.substituteHistory)
  CUSTOM_ALTERNATIVE_ADD: 'CUSTOM_ALTERNATIVE_ADD', // { exerciseName, alternative } — B138: schreibt state.customAlternatives[exerciseName], permanent, keyed wie exerciseNotes
  // Session log
  SESSION_START:       'SESSION_START',       // { di, ts }  – persists day.sessionStartTs
  SESSION_RESET:       'SESSION_RESET',       // { di }  – clears sessionStartTs so timer can restart
  SESSION_STOP:        'SESSION_STOP',        // { duration, time }
  // Body data
  BODY_SET_FIELD:      'BODY_SET_FIELD',      // { field, value }
  BODY_LOG_WEIGHT:     'BODY_LOG_WEIGHT',     // { date: 'YYYY-MM-DD', weight: number }
  // Template
  TPL_SAVE:            'TPL_SAVE',            // { template: DayTemplate[] }
  TPL_RESET_TO_FACTORY:'TPL_RESET_TO_FACTORY',// {}
  WEEK_RESET_TO_TPL:   'WEEK_RESET_TO_TPL',  // {}
  // Settings
  SETTING_TOGGLE:      'SETTING_TOGGLE',      // { key }
  SETTING_SET:         'SETTING_SET',         // { key, value }
  AUTOWEEK_SET:        'AUTOWEEK_SET',        // { key: 'enabled'|'suggestProgress'|'showReview', value: boolean }
  // Backup
  STATE_IMPORT:        'STATE_IMPORT',        // { imported: StateObject }
  // Undo
  UNDO:                'UNDO',               // {}
  // Insights (triggerEngine)
  INSIGHTS_SET:        'INSIGHTS_SET',        // { insights: Insight[] }
  // Templates (v9)
  TEMPLATE_ADD:        'TEMPLATE_ADD',        // { name, days? }
  TEMPLATE_UPDATE:     'TEMPLATE_UPDATE',     // { id, name?, days? }
  TEMPLATE_DELETE:     'TEMPLATE_DELETE',     // { id }
  // Rest days (v9)
  WEEK_ADD_REST_DAY:   'WEEK_ADD_REST_DAY',  // { date, note? }
  WEEK_REMOVE_REST_DAY:'WEEK_REMOVE_REST_DAY',// { date }
  // Favorites
  TOGGLE_FAVORITE:          'TOGGLE_FAVORITE',          // { name: string }
  // Onboarding
  ONBOARDING_WEEK_CREATE:   'ONBOARDING_WEEK_CREATE',   // { startDate, days[], note? }
  ONBOARDING_DONE:          'ONBOARDING_DONE',          // {}
  MARK_TIP_SEEN:            'MARK_TIP_SEEN',            // { tipId: string }
  // Decision log (Sprint: Abwägungs-Entscheidungen)
  DECISION_LOG_ADD:         'DECISION_LOG_ADD',         // { type, signal, choice: 'stay'|'change', decidedWeekStart }
  DECISION_LOG_OUTCOME:     'DECISION_LOG_OUTCOME',     // { id, outcome: { measuredWeekStart, signalPersisted, successRateBefore, successRateAfter } }
  COACH_ANSWER:             'COACH_ANSWER',             // { weekStart, questionId, answer, exerciseName? }
  ONBOARDING_SEED:          'ONBOARDING_SEED',          // { startDate, exercises: [{ name, weight, reps?, rpe? }] }
  COACH_PERF_LOG:           'COACH_PERF_LOG',           // { weekStart, status, exerciseName, suggestedDelta, fromWeight, confidenceLevel }
  COACH_PERF_MEASURE:       'COACH_PERF_MEASURE',       // { id, followed, outcome, measuredWeekStart }
  COACH_QUESTION_OUTCOME:   'COACH_QUESTION_OUTCOME',   // { outcome: 'confirmed'|'not_confirmed'|'unclear', measuredWeekStart }
  SET_ERKENNTNISSE_HORIZONT: 'SET_ERKENNTNISSE_HORIZONT', // { value: number } — 4..52
});

// ─── Reducer ──────────────────────────────────────────────────────────────────

/**
 * Reduziert alle noch `pending` Sätze mit Gewicht>0 eines Tages um 10%,
 * gerundet auf die pro-Übung-Schrittweite. Gemeinsam genutzt von
 * SESSION_CHECKIN_SET (automatisch, bei Check-in-Abgabe mit modifier=
 * 'reduced'/'reduced_mild') und DAY_REDUCE_PENDING_WEIGHTS (manueller
 * Catch-up-Button, B87 Fix 3) — identische Formel, ein einziger Ort.
 *
 * Seit Sprint C2 (Teil A): -5% statt -10% bei 'reduced_mild' (einmalig
 * schlechter Schlaf), sowie optionaler Compound-Scope für 'reduced'
 * (kumulierter Schlafmangel/niedrige Energie — nur Compound-Übungen, siehe
 * DECISIONS.md). `compoundNames` kommt vom Aufrufer (ui.js, bereits
 * movementMap.js importiert) als Liste von Übungsnamen — state.js bleibt
 * dadurch importfrei (Muster wie Sprint C1).
 */
function _reducePendingWeights(day, modifier, scope, compoundNames, settings, customExercises) {
  const pct = modifier === 'reduced_mild' ? 0.95 : 0.9;
  const compoundSet = new Set(compoundNames ?? []);
  for (const ex of day.exercises ?? []) {
    if (ex.archived) continue;
    if (scope === 'compound' && !compoundSet.has(ex.name)) continue;
    const step = getEffectiveWeightStep(ex, settings, customExercises);
    for (const s of ex.sets ?? []) {
      if (s.status === 'pending' && (s.weight ?? 0) > 0) {
        s.weight = Math.round((s.weight * pct) / step) * step;
      }
    }
  }
}

// B114: "Heute anders"-Substitution darf nie in einen geklonten/gespeicherten
// Tag übernommen werden — jede Stelle, die Übungen kopiert (neue Woche, Tag
// duplizieren/klonen, als Vorlage speichern), muss diese Funktion aufrufen.
// B127: ex.note (die neue, tagesspezifische "Heute"-Notiz) läuft aus demselben
// Grund über dieselbe Funktion mit — sonst wäre sie trotz "tagesspezifisch"
// nicht wirklich tagesspezifisch. state.exerciseNotes (permanent) bleibt
// bewusst unberührt, das ist ja der Sinn der zweiten Notiz-Art.
function _resetExerciseSubstitution(ex) {
  if (ex.substituteFor) ex.name = ex.substituteFor;
  ex.substituteFor = null;
  ex.note = '';
}

function _resetClonedDays(days) {
  days.forEach(day => {
    day.locked          = false;
    day.markedDone      = false;
    day.isVacation      = false;
    day.vacationPlan    = null;
    day.sessionNote     = '';
    day.sessionRating   = null;
    day.sessionStartTs  = null;
    day.sessionEndTs    = null;
    day.sleepHours      = null;
    day.energyLevel     = null;
    day.sessionCheckIn  = null; // B76: Vorwoche-Check-in darf nicht mitgeklont werden
    day.sessionModifier = null;
    day.sessionModifierScope = null; // Sprint C2 Teil A
    (day.exercises ?? []).forEach(ex => {
      if (ex._showCfg) ex._showCfg = false;
      _resetExerciseSubstitution(ex);
      // Trainings-Tab-Audit (2026-08-17): skipReason/skipDate wurden hier
      // bisher NIE zurückgesetzt, entgegen der dokumentierten Absicht (siehe
      // ui.js "A6-Fix"-Kommentar: NUR 'substituted' ist strukturell dauerhaft
      // gemeint, alle anderen Gründe (injury/time/fatigue/kein Grund) sollen
      // "jede Woche neu gefragt werden"). Eine als "Verletzung" übersprungene
      // Übung blieb dadurch über beliebig viele Folgewochen markiert --
      // weekReview.js blendet skipReason==='injury' bewusst aus "Was nicht
      // gut lief" aus (B129); trainierte der Nutzer die Übung später wieder
      // normal, aber mit echten Fehlschlägen, wurden diese durch das
      // veraltete Flag weiterhin stillschweigend unterdrückt.
      if (ex.skipReason !== 'substituted') {
        ex.skipReason = null;
        ex.skipDate   = null;
      }
      (ex.sets ?? []).forEach(s => {
        s.status = 'pending';
        s.done   = false;
        s.reps   = null;
        s.rpe    = null;
        s.deloadSkip = false; // Sprint C2 Teil B — nie aus einer geklonten Vorwoche übernehmen (Normalfall: cloneSourceWeek ist ohnehin nie die Deload-Woche selbst, siehe _resolveWeekCloneSource; dies ist der Fallback-Schutz, falls keine Vor-Deload-Woche gefunden wird)
      });
    });
  });
}

/**
 * B101: ex.nextWeekPlan ist ein bereits im "Neue Woche"-Modal bestätigter
 * Delta (kg/Wdh/Sätze) — normalerweise bereits weightStep-ausgerichtet
 * (getWeightRecommendation()'s fullDelta/halfDelta = ex.weightStep bzw.
 * dessen Hälfte), AUSSER bei zwei Wegen, die einen nicht ausgerichteten
 * Delta erzeugen können: dem Recovery-Boost (ui.js, `rec.delta *= 1.5` bei
 * aktivem isInRecoveryWindow(), OHNE dass danach neu gerundet wird) und dem
 * manuell im "Anderer Wert"-Feld eingetragenen Custom-Delta (beliebige
 * Nutzereingabe). Ohne Rundung HIER wich das tatsächlich in der neuen Woche
 * gesetzte Gewicht vom im Modal angezeigten `recommendedWeight` ab (Bug-
 * Report: Modal versprach z.B. 85kg, neue Woche zeigte 83.75kg). Rundung
 * an dieser einzigen Stelle (statt an jeder Delta-Berechnungsstelle
 * einzeln) fängt beide Fälle ab, ohne die Delta-Speicherung selbst
 * anzufassen.
 */
function _applyPlannedProgression(days, state) {
  days.forEach(day => {
    (day.exercises ?? []).forEach(ex => {
      const plan = ex.nextWeekPlan || 0;
      if (plan && ex.nextWeekPlanConfirmed) {
        const pt = ex.progressionType ?? 'weight';
        if (pt === 'reps') {
          ex.targetReps = (ex.targetReps ?? 0) + plan;
        } else if (pt === 'sets') {
          const toAdd = Math.max(0, Math.round(plan));
          console.log(`[TRAIN] sets-progression: "${ex.name}" +${toAdd} Satz (vorher: ${ex.sets.length})`);
          const last  = ex.sets[ex.sets.length - 1];
          for (let i = 0; i < toAdd; i++) {
            ex.sets.push(mkSet(last?.weight ?? 0, last?.reps ?? ex.targetReps ?? 10));
          }
          console.log(`[TRAIN] sets-progression: "${ex.name}" nachher: ${ex.sets.length} Sätze`);
        } else {
          const step = getEffectiveWeightStep(ex, state?.settings, state?.customExercises);
          (ex.sets ?? []).forEach(s => {
            const raw = (parseFloat(s.weight) || 0) + plan;
            s.weight = Math.round(raw / step) * step;
          });
        }
      }
      ex.nextWeekPlan = 0;
      ex.nextWeekPlanConfirmed = false;
    });
  });
}

/**
 * Aktualisiert PR-Tracking (state.prs, ex.oneRM, ex.prWeight/
 * prRepsAtMaxWeight, ex.prRepsHistory) nachdem ein Satz gerade neu als
 * 'success' bewertet wurde. Aufrufer prüfen VORHER bereits: Satz wurde
 * gerade success, Woche ist nicht Deload, reps > 0 — diese Funktion selbst
 * prüft nur noch weight > 0 (state.prs/oneRM sind ohne Gewicht bedeutungs-
 * los) und aktualisiert prWeight/prRepsAtMaxWeight/prRepsHistory
 * bedingungslos (auch bei weight===0, für Körpergewichts-Übungen —
 * Original-Verhalten aller 3 vorherigen Kopien beibehalten).
 *
 * Konsolidierung 2026-07-14 (B47): ersetzt 3 unabhängige Kopien in
 * SET_TOGGLE_DONE/CONFIRM_SET/AUTO_EVAL_SET. SET_TOGGLE_DONE hatte dabei
 * das ex.oneRM-Update VERGESSEN — ein echter Bug, nicht nur Duplikations-
 * Risiko: der 1RM-Bestwert wurde nie geschrieben, wenn ein Satz nur über
 * den manuellen ✓-Button bestätigt wurde (die häufigste Eingabeart). Der
 * Trainings-Tab-1RM-Hinweis (ui.js:1606) hat zwar einen Live-Fallback, der
 * das kaschierte — aber der Fallback rechnet nur aus den Sätzen der
 * AKTUELLEN Woche, während ex.oneRM als wochenübergreifendes historisches
 * Maximum gedacht ist (bleibt beim Wochenwechsel erhalten, siehe
 * _resetClonedDays() — rührt ex.oneRM bewusst nicht an). Betroffene Nutzer
 * sahen den Hinweis in der neuen, noch leeren Woche schlicht verschwinden.
 */
// Trainings-Tab-Audit (2026-08-17): 'YYYY-MM-DD' aus LOKALEN
// Datumskomponenten statt .toISOString() (UTC) -- dasselbe, im Projekt
// bereits mehrfach gefixte Antimuster (weekReview.js _localISODate(),
// weeklyFocus.js/consistencyUtils.js, B278 u.a.). Genutzt für das
// gespeicherte PR-Datum UND die Trophy-Badge-Tagessperre unten -- beide
// konnten nahe lokaler Mitternacht um einen Tag daneben liegen.
function _localISODateToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Trainings-Tab-Audit (2026-08-17): _applyPrTracking() aktualisiert PRs nur
// nach oben (Math.max) -- wird ein Satz, der aktuell den PR trägt,
// nachträglich korrigiert (Gewicht/Wdh runter oder Status weg von
// 'success'), blieb der alte PR-Wert bisher als "Phantom-PR" stehen, obwohl
// ihn kein Satz mehr stützt. Scannt die komplette Historie neu (nur bei
// einer Korrektur an einem bereits bewerteten Satz ausgelöst, siehe
// SET_UPDATE/SET_TOGGLE_DONE unten -- nicht bei jedem normalen Satz-Update).
// ex.prWeight/ex.prRepsAtMaxWeight liegen pro Wochen-Klon auf dem jeweiligen
// Übungs-Objekt (überleben Wochen-Klone unverändert, siehe
// _resetClonedDays()) -- werden hier deshalb auf JEDER Instanz über alle
// Wochen aktualisiert, nicht nur der aktuellen.
function _recomputePrFromHistory(state, exName) {
  let maxWeight = 0, maxVolume = 0, maxEst1RM = 0, maxRepsAtMaxWeight = 0;
  for (const wk of state.weeks) {
    if (wk.mode === 'deload') continue;
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        // state.js-Audit (Runde 35, B3): auch ex.substituteFor berücksichtigen
        // -- ohne diesen Fix durchsuchte eine Korrektur an einer aktuell
        // substituierten Übung (aufgerufen mit dem ORIGINAL-Namen, siehe
        // Aufrufstellen unten) die falschen Sätze, dieselbe Fehlerklasse wie
        // in weightRecommendation.js (Runde 31, B359).
        if (ex.name !== exName && ex.substituteFor !== exName) continue;
        for (const s of ex.sets) {
          if (s.status !== 'success') continue;
          const w = parseFloat(s.weight) || 0;
          const r = parseFloat(s.reps) || 0;
          if (w <= 0 || r <= 0) continue;
          if (w > maxWeight) { maxWeight = w; maxRepsAtMaxWeight = r; }
          else if (w === maxWeight && r > maxRepsAtMaxWeight) { maxRepsAtMaxWeight = r; }
          maxVolume = Math.max(maxVolume, w * r);
          maxEst1RM = Math.max(maxEst1RM, r <= 10 ? w * (1 + r / 30) : 0);
        }
      }
    }
  }
  if (state.prs) {
    if (maxWeight === 0 && maxVolume === 0 && maxEst1RM === 0) delete state.prs[exName];
    else state.prs[exName] = { maxWeight, maxVolume, maxEstimated1RM: maxEst1RM, maxRepsAtMaxWeight, date: state.prs[exName]?.date ?? null };
  }
  for (const wk of state.weeks) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.name === exName || ex.substituteFor === exName) {
          ex.prWeight           = maxWeight > 0 ? maxWeight : null;
          ex.prRepsAtMaxWeight  = maxRepsAtMaxWeight > 0 ? maxRepsAtMaxWeight : null;
        }
      }
    }
  }
}

function _applyPrTracking(state, ex, s, weight, reps) {
  if (weight > 0) {
    const volume  = weight * reps;
    const est1RM  = reps <= 10 ? weight * (1 + reps / 30) : 0;
    // state.js-Audit (Runde 35, B4): ex.substituteFor berücksichtigen, sonst
    // landet ein PR während aktiver Substitution unter dem temporären
    // Substitut-Namen statt der eigentlichen Übung -- ex.prWeight/
    // ex.prRepsAtMaxWeight (objektgebunden, siehe Kommentar oben) sind davon
    // nicht betroffen, nur die globale state.prs[]-Map.
    const name    = ex.substituteFor || ex.name;
    if (!state.prs) state.prs = {};
    const prev    = state.prs[name] ?? { maxWeight: 0, maxVolume: 0, maxEstimated1RM: 0, maxRepsAtMaxWeight: 0, date: null };
    const newMaxW   = Math.max(prev.maxWeight,       weight);
    const newMaxV   = Math.max(prev.maxVolume,       volume);
    const newMaxE   = Math.max(prev.maxEstimated1RM, est1RM);
    const newMaxRMW = weight > prev.maxWeight
      ? reps
      : (weight === prev.maxWeight ? Math.max(prev.maxRepsAtMaxWeight ?? 0, reps) : prev.maxRepsAtMaxWeight ?? 0);
    if (newMaxW > prev.maxWeight || newMaxV > prev.maxVolume || newMaxE > prev.maxEstimated1RM) {
      state.prs[name] = { maxWeight: newMaxW, maxVolume: newMaxV, maxEstimated1RM: newMaxE, maxRepsAtMaxWeight: newMaxRMW, date: _localISODateToday() };
    }
    if (est1RM > 0 && (ex.oneRM == null || est1RM > ex.oneRM)) {
      ex.oneRM = Math.round(est1RM * 10) / 10;
    }
  }
  // s.prBadge markiert, ob DIESER Satz konkret einen Rekord ausgelöst hat —
  // am Satz selbst gespeichert (nicht am Render-Zeitpunkt gegen den
  // all-time ex.prWeight verglichen), damit ein späteres bloßes Wiederholen
  // desselben Gewichts/derselben Wdh-Zahl in einer künftigen Woche nicht
  // erneut als "neuer PR" erscheint — nur der Satz, der den Rekord beim
  // Schreiben tatsächlich erhöht hat, behält das Badge dauerhaft.
  // B115: pro Übung nur EIN Trophy-Badge pro Kalendertag — ohne diese Sperre
  // würde z.B. ein Gewichts-PR auf Satz 1 und ein Wdh-PR auf Satz 3 beim
  // selben Gewicht zwei Trophy-Icons in derselben Session zeigen. Echtes
  // Kalenderdatum statt day.id, weil day.id beim Wochen-Klonen unverändert
  // mitkopiert wird (siehe _resetClonedDays) und sich sonst über Wochen
  // hinweg fälschlich "gleich" anfühlen würde.
  const today = _localISODateToday();
  const alreadyShownToday = ex._prBadgeShownOn === today;
  if (ex.prWeight === null || weight > ex.prWeight) {
    if (!alreadyShownToday) { s.prBadge = 'weight'; ex._prBadgeShownOn = today; }
    ex.prWeight = weight; ex.prRepsAtMaxWeight = reps;
  } else if (weight >= ex.prWeight && reps > (ex.prRepsAtMaxWeight ?? 0)) {
    if (!alreadyShownToday) { s.prBadge = 'reps'; ex._prBadgeShownOn = today; }
    ex.prRepsAtMaxWeight = reps;
  }
  if (!ex.prRepsHistory) ex.prRepsHistory = {};
  if (weight < ex.prWeight) {
    const w = String(weight);
    if (reps > (ex.prRepsHistory[w] ?? 0)) {
      if (!alreadyShownToday) { s.prBadge = 'reps'; ex._prBadgeShownOn = today; }
      ex.prRepsHistory[w] = reps;
    }
  }
}

/**
 * Zentrale "canSuccess"-Logik + Status/Done-Zuweisung für einen Satz —
 * konsolidiert aus 3 unabhängigen Kopien in SET_TOGGLE_DONE/CONFIRM_SET/
 * AUTO_EVAL_SET (Befund #2, train-vXXX). Regel überall identisch: ein Satz
 * gilt nur dann als 'success', wenn die Wdh das targetReps-Ziel erreichen
 * (>=) — ohne definiertes targetReps reicht reps > 0 (kein Blockieren).
 * Setzt s.status auf 'success'/'fail' und s.done passend dazu und gibt den
 * ermittelten canSuccess-Boolean zurück. SET_TOGGLE_DONE hat eine eigene
 * Statuszyklus-Logik (pending→success→fail→pending) und nutzt daher nur den
 * Rückgabewert als Entscheidungsgrundlage — sein finales s.status/s.done
 * wird von der Zyklus-Logik selbst gesetzt (überschreibt den Nebeneffekt
 * dieser Funktion, siehe dort). CONFIRM_SET/AUTO_EVAL_SET sowie SET_UPDATE
 * (Neubewertung nach nachträglicher Wdh-/Gewichts-Korrektur) übernehmen
 * Status/Done direkt von hier.
 */
function _evaluateSetStatus(ex, s) {
  const targetReps = parseFloat(ex?.targetReps) || 0;
  const repsVal     = parseFloat(s?.reps) || 0;
  const canSuccess  = targetReps > 0 ? repsVal >= targetReps : repsVal > 0;
  s.status = canSuccess ? 'success' : 'fail';
  s.done   = canSuccess;
  return canSuccess;
}

/**
 * state.js-Audit (Runde 35, B7/V1/V2): gemeinsame Helper-Funktion für
 * DAY_LOAD_VACATION_PLAN/WEEK_LOAD_VACATION_PLAN, die zuvor unabhängig je
 * ein eigenes ~20-zeiliges Übungs-Objekt-Literal bauten (dieselbe
 * Fragilitäts-Klasse, die das Projekt für Tag-/Wochen-Reset-Logik bereits
 * einmal konsolidiert hat, siehe WEEK_RESET_TO_TPL) UND dabei prWeight/
 * prRepsAtMaxWeight (B7 -- ohne die beiden Felder blieb _applyPrTracking()s
 * strikte `=== null`-Prüfung wirkungslos, ein echter PR auf einer
 * Urlaubsplan-Übung wurde während der laufenden Sitzung nicht erkannt) sowie
 * showPlates (V2) vergaßen. WEEK_LOAD_VACATION_PLAN fehlten zusätzlich
 * progressionMode/targetRepsMax/prRepsHistory, die DAY_LOAD_VACATION_PLAN
 * bereits hatte -- Feldsatz jetzt für beide identisch und analog zur
 * EX_ADD-Referenz-Implementierung.
 */
function _buildVacationExercise(t) {
  const m = t.metric ?? 'reps';
  return {
    name:                     t.name,
    note:                     '',
    pauseSec:                 90,
    metric:                   m,
    progressionType:          m === 'reps' ? 'weight' : 'reps',
    metricStep:               m === 'm' ? 50 : m === 'sec' ? 10 : undefined,
    progressionMode:          'weight_first',
    targetRepsMax:            null,
    prRepsHistory:            {},
    prWeight:                 null,
    prRepsAtMaxWeight:        null,
    setType:                  'straight',
    targetReps:               t.reps,
    nextWeekPlan:             0,
    nextWeekPlanConfirmed:    false,
    nextWeekPlanAutoReviewed: true,
    skipReason:               null,
    skipDate:                 null,
    tags:                     [],
    showPlates:               m === 'reps' && defaultShowPlates(t.name),
    supersetId:               null,
    sets: Array.from({ length: t.sets }, () => ({
      weight: null, reps: null, rpe: null,
      status: 'pending', done: false, note: '',
    })),
  };
}

function reduce(state, action) {
  const { type, payload: p } = action;

  // Snapshot before every undoable mutation
  if (!_NO_UNDO.has(type)) {
    _undoStack.push(clone({
      curIdx:            state.curIdx,
      weeks:             state.weeks,
      customTemplate:    state.customTemplate,
      settings:          state.settings,
      favoriteExercises: state.favoriteExercises ?? [],
      customExercises:   state.customExercises ?? [],
    }));
    if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
  }

  switch (type) {

    // ── Navigation ───────────────────────────────────────────────────────────
    case A.WEEK_NAVIGATE: {
      // Solotest-Feedback (2026-08-16): ONBOARDING_SEED-Wochen sind kein
      // echtes Navigationsziel -- überspringen, sonst landet der Nutzer auf
      // der synthetischen "Startwerte"-Woche und hält sie für eine reale
      // Trainingswoche (Diagnose Cluster A, Punkt 6/7).
      let next = state.curIdx + p.delta;
      while (next >= 0 && next < state.weeks.length && state.weeks[next].isSeedWeek) {
        next += p.delta;
      }
      if (next >= 0 && next < state.weeks.length) state.curIdx = next;
      break;
    }

    // ── Week CRUD ────────────────────────────────────────────────────────────
    case A.WEEK_CREATE: {
      if (!p.startDate) break;
      if (state.weeks.find(w => w.startDate === p.startDate)) break; // dedupe
      const source = p.source === 'template' ? 'template' : 'prev';

      let days;
      let templateWeek = null, pendingDeload = false;
      if (source === 'prev' && state.weeks.length > 0) {
        // Sprint C2 (Teil B): war die Vorlagen-Woche eine Deload-Woche, wird
        // stattdessen aus der Woche VOR dem Deload geklont (originale
        // Satz-Anzahl/Gewichte, siehe DECISIONS.md) statt aus der reduzierten
        // Deload-Woche selbst.
        const resolved = _resolveWeekCloneSource(state.weeks);
        templateWeek = resolved.templateWeek;
        pendingDeload = resolved.pendingDeload;
        days = clone(resolved.cloneSourceWeek.days);
        _applyPlannedProgression(days, state);
      } else {
        // Explicit restart: load global template as-is (no auto-progression mapping)
        days = clone(state.customTemplate ?? FACTORY_TEMPLATE);
        // Make sure templates never carry "planned" UI state forward
        days.forEach(d => (d.exercises ?? []).forEach(ex => { ex.nextWeekPlan = 0; ex.nextWeekPlanConfirmed = false; ex._showCfg = false; }));
      }

      _resetClonedDays(days);

      let newMode = 'standard';
      if (pendingDeload) {
        _applyDeloadReduction(days);
        newMode = 'deload';
        templateWeek.deloadPlannedForNext = false; // Marker konsumiert -- verhindert Stale-Re-Trigger nach WEEK_DELETE
      }

      const newWeek = {
        id: Date.now(), startDate: p.startDate, note: p.note ?? '',
        mode: newMode, days, sessionLog: [], bodyData: {}, restDays: [],
      };
      state.weeks.push(newWeek);
      _resortWeeksKeepingCurrent(state, newWeek);
      _checkAndGrantBadges(state);
      if (state.coachQuestion?.weekStart && state.coachQuestion.weekStart !== p.startDate) {
        const _pendingMeasure = state.coachQuestion.answer !== null && state.coachQuestion.outcome === null;
        if (!_pendingMeasure) {
          state.coachQuestion = { weekStart: null, questionId: null, answer: null, outcome: null, measuredWeekStart: null };
        }
      }
      break;
    }
    // Sprint C3 (train-v110): automatische Wochenerstellung beim App-Öffnen.
    // Identisch zum WEEK_CREATE('prev')-Pfad, ABER bewusst OHNE
    // _applyPlannedProgression() — Steigerungen dürfen nie still angewendet
    // werden (Progressive-Overload-Kernprinzip), sie bleiben nur als
    // Vorschlag fürs Modal erhalten. nextWeekPlan/-Confirmed werden trotzdem
    // zurückgesetzt, sonst würde eine in der Vorwoche bereits bestätigte
    // Steigerung optisch "bestätigt" wirken, ohne angewendet worden zu sein.
    case A.AUTO_WEEK_CREATE: {
      if (!p.startDate) break;
      if (state.weeks.find(w => w.startDate === p.startDate)) break; // dedupe
      if (!state.weeks.length) break; // braucht eine Vorwoche als Vorlage
      // Sprint C2 (Teil B): dieselbe Klon-Quellen-Auflösung wie WEEK_CREATE
      // (source:'prev') — eine für "Nächste Woche" geplante Deload-Reduktion
      // greift bewusst auch hier (die Entscheidung wurde bereits beim Klick
      // auf "Nächste Woche" getroffen, anders als eine automatische
      // GEWICHTSSTEIGERUNG, die hier nie still angewendet wird — siehe
      // DECISIONS.md).
      const { templateWeek, cloneSourceWeek, pendingDeload } = _resolveWeekCloneSource(state.weeks);
      const days = clone(cloneSourceWeek.days);
      days.forEach(d => (d.exercises ?? []).forEach(ex => {
        ex.nextWeekPlan = 0;
        ex.nextWeekPlanConfirmed = false;
      }));
      _resetClonedDays(days);

      let newMode = 'standard';
      if (pendingDeload) {
        _applyDeloadReduction(days);
        newMode = 'deload';
        templateWeek.deloadPlannedForNext = false;
      }

      const newWeek = {
        id: Date.now(), startDate: p.startDate, note: '',
        mode: newMode, days, sessionLog: [], bodyData: {}, restDays: [],
      };
      state.weeks.push(newWeek);
      _resortWeeksKeepingCurrent(state, newWeek);
      _checkAndGrantBadges(state);
      if (state.coachQuestion?.weekStart && state.coachQuestion.weekStart !== p.startDate) {
        const _pendingMeasure = state.coachQuestion.answer !== null && state.coachQuestion.outcome === null;
        if (!_pendingMeasure) {
          state.coachQuestion = { weekStart: null, questionId: null, answer: null, outcome: null, measuredWeekStart: null };
        }
      }
      state.autoWeekPending = true;
      break;
    }
    case A.WEEK_DELETE: {
      if (state.weeks.length <= 1) break;
      const _delIdx = (p.weekIdx !== undefined && p.weekIdx >= 0 && p.weekIdx < state.weeks.length)
        ? p.weekIdx
        : state.curIdx;
      // Capture the currently-viewed week by reference BEFORE splicing — if an
      // earlier week is deleted (not the one curIdx points to), curIdx must
      // still resolve to the SAME logical week after indices shift, not
      // silently drift to whatever week now occupies the old numeric index.
      const _curWeekRef = state.weeks[state.curIdx];
      state.weeks.splice(_delIdx, 1);
      _resortWeeksKeepingCurrent(state, _curWeekRef);
      break;
    }
    case A.WEEK_COPY_PREV: {
      if (state.curIdx === 0) break;
      const d = clone(state.weeks[state.curIdx - 1].days);
      d.forEach(day => {
        day.markedDone = false; day.locked = false; day.isVacation = false; day.vacationPlan = null;
        day.exercises.forEach(ex => {
          if (ex.substituteFor) ex.name = ex.substituteFor;
          ex.substituteFor = null;
          // Trainings-Tab-Audit (2026-08-17): dritte, unabhängige Kopie
          // derselben skipReason/skipDate-Lücke wie _resetClonedDays()/
          // DAY_ADD_CLONE -- beim Schreiben eines Tests für den dortigen Fix
          // gefunden. Gleiche Ausnahme: nur 'substituted' bleibt.
          if (ex.skipReason !== 'substituted') {
            ex.skipReason = null;
            ex.skipDate   = null;
          }
          ex.sets.forEach(s => {
            s.status = 'pending';
            s.done = false;
          });
        });
      });
      state.weeks[state.curIdx].days = d;
      break;
    }
    case A.WEEK_SET_MODE: {
      const wk = _currentWeek(); if (!wk) break;
      const wasVacation = wk.mode === 'vacation';
      wk.mode = p.mode;
      if (p.mode === 'vacation') {
        wk.days.forEach(d => { d.isVacation = true; });
      } else if (wasVacation && p.mode === 'standard') {
        wk.days.forEach(d => { d.isVacation = false; });
      }
      break;
    }
    // Sprint C2 (Teil B, Pritchard et al. 2015): Deload reduziert Volumen
    // (Satz-Anzahl), nicht Intensität (Gewicht) — evidenzbasiert wirksamer
    // für Krafterhalt. `when:'now'` reduziert sofort die heute noch offenen
    // (nicht markedDone) Tage der aktuellen Woche und markiert die Woche als
    // Deload; `when:'next'` merkt den Wunsch nur vor, angewendet erst bei der
    // nächsten Wochenerstellung (WEEK_CREATE/AUTO_WEEK_CREATE, siehe dort).
    case A.DELOAD_APPLY: {
      const idx = p.weekIdx ?? state.curIdx;
      const wk = state.weeks[idx]; if (!wk) break;
      if (p.when === 'next') { wk.deloadPlannedForNext = true; break; }
      const openDays = wk.days.filter(d => !d.markedDone);
      _applyDeloadReduction(openDays);
      wk.mode = 'deload';
      break;
    }
    case A.WEEK_SET_NOTE: {
      const wk = _currentWeek(); if (!wk) break;
      wk.note = p.note;
      break;
    }
    case A.WEEK_SET_LABEL: {
      const wk = _currentWeek(); if (!wk) break;
      wk.label = p.label;
      break;
    }

    // ── Day ──────────────────────────────────────────────────────────────────
    case A.DAY_ADD: {
      const wk = _currentWeek(); if (!wk) break;
      const labels = ['A','B','C','D','E','F','G'];
      const label  = labels[wk.days.length] ?? String(wk.days.length + 1);
      wk.days.push({
        id:             Date.now(),
        title:          `Tag ${label}`,
        subtitle:       '',
        warmup:         '',
        cooldown:       '',
        locked:         false,
        markedDone:     false,
        isVacation:     false,
        vacationPlan:   null,
        sessionStartTs: null,
        sessionEndTs:   null,
        sleepHours:     null,
        energyLevel:    null,
        sessionCheckIn:  null,
        sessionModifier: null,
        sessionModifierScope: null,
        exercises:      [],
      });
      break;
    }
    case A.DAY_ADD_CLONE: {
      const wk = _currentWeek(); if (!wk) break;
      const labels  = ['A','B','C','D','E','F','G'];
      const label   = labels[wk.days.length] ?? String(wk.days.length + 1);
      const srcDay  = p.sourceDi != null ? wk.days[p.sourceDi] : null;
      const newDay = {
        id:             Date.now(),
        title:          `Tag ${label}`,
        subtitle:       srcDay?.subtitle ?? '',
        warmup:         srcDay?.warmup   ?? '',
        cooldown:       srcDay?.cooldown ?? '',
        locked:         false,
        markedDone:     false,
        isVacation:     false,
        sleepHours:     null,
        energyLevel:    null,
        sessionCheckIn:  null,
        sessionModifier: null,
        sessionModifierScope: null,
        exercises:  srcDay ? srcDay.exercises.map(ex => {
          const clonedEx = {
            ...JSON.parse(JSON.stringify(ex)),
            // Trainings-Tab-Audit (2026-08-17): reps/rpe ergänzt -- diese
            // unabhängige Klon-Kopie (nicht über _resetClonedDays()) ließ
            // bisher die Wdh/RPE-Werte des Quell-Satzes an einem eigentlich
            // 'pending' Satz stehen, anders als das etablierte Muster.
            sets: ex.sets.map(s => ({ ...s, status: 'pending', done: false, reps: null, rpe: null, deloadSkip: false })),
          };
          _resetExerciseSubstitution(clonedEx);
          // Trainings-Tab-Audit (2026-08-17): skipReason/skipDate ergänzt --
          // identischer Fix wie _resetClonedDays() (siehe dortiger
          // Kommentar): nur 'substituted' ist strukturell dauerhaft gemeint,
          // alle anderen Gründe sollen jede Woche neu abgefragt werden.
          if (clonedEx.skipReason !== 'substituted') {
            clonedEx.skipReason = null;
            clonedEx.skipDate   = null;
          }
          return clonedEx;
        }) : [],
      };
      wk.days.push(newDay);
      break;
    }
    case A.DAY_REMOVE: {
      const wk = _currentWeek(); if (!wk) break;
      if (wk.days.length <= 1) break;
      wk.days.splice(p.di, 1);
      break;
    }
    case A.DAY_DUPLICATE: {
      const wk = _currentWeek(); if (!wk) break;
      const src = wk.days[p.di]; if (!src) break;
      const clone = JSON.parse(JSON.stringify(src));
      clone.id            = Date.now();
      clone.title         = `${src.title} (Kopie)`;
      clone.locked        = false;
      clone.markedDone    = false;
      clone.sessionStartTs = null;
      clone.sessionEndTs   = null;
      clone.sleepHours     = null;
      clone.energyLevel    = null;
      clone.sessionNote    = '';
      clone.sessionRating  = null;
      for (const ex of clone.exercises) {
        _resetExerciseSubstitution(ex);
        for (const s of ex.sets) {
          s.status = 'pending';
          s.done   = false;
          s.weight = null;
          s.reps   = null;
          s.rpe    = null;
        }
      }
      wk.days.push(clone);
      break;
    }
    case A.DAY_RESET_SETS: {
      const wk = _currentWeek(); if (!wk) break;
      const day = wk.days[p.di]; if (!day) break;
      for (const ex of day.exercises) {
        for (const s of ex.sets) {
          s.status = 'pending';
          s.done   = false;
          s.reps   = null;
          s.rpe    = null;
          // s.weight bewusst NICHT zurückgesetzt (B-A8): "Sätze zurücksetzen"
          // soll nur die Satz-BEWERTUNG zurücksetzen, nicht das eingetragene
          // Gewicht — beim erneuten Trainieren behält der Nutzer meist
          // dasselbe Gewicht. Tag-Ebene-Felder (markedDone/locked/
          // sessionStartTs/sessionRating/sleepHours/energyLevel) werden
          // hier bewusst NICHT mehr angefasst — die gehören zu einem
          // kompletten Tag-Reset, nicht zu "Sätze zurücksetzen", und ihr
          // vorheriges Mitreißen war Ursache für den fälschlich als
          // "Streak gelöscht" gemeldeten Seiteneffekt (B-A8).
        }
      }
      break;
    }
    case A.DAY_TOGGLE_COMPLETE: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      const becomingDone = !day.markedDone;
      if (becomingDone) {
        for (const ex of day.exercises ?? []) {
          if (ex.archived) continue;
          for (const s of ex.sets ?? []) {
            if (s.status === 'pending') { s.status = 'fail'; s.done = false; }
          }
        }
        day.sessionEndTs = Date.now();
      } else {
        day.sessionEndTs = null;
      }
      day.markedDone = becomingDone;
      day.locked     = becomingDone;
      if (becomingDone) _checkAndGrantBadges(state);
      break;
    }
    case A.DAY_TOGGLE_VACATION: {
      const wk = _currentWeek(); if (!wk) break;
      const day = wk.days[p.di]; if (!day) break;
      day.isVacation = !day.isVacation;
      const allVac = wk.days.every(d => d.isVacation);
      if (allVac) {
        wk.mode = 'vacation';
      } else if (wk.mode === 'vacation') {
        wk.mode = 'standard';
      }
      _checkAndGrantBadges(state);
      break;
    }
    case A.DAY_LOAD_VACATION_PLAN: {
      const wk  = _currentWeek(); if (!wk) break;
      const day = wk.days[p.di]; if (!day) break;
      day.isVacation   = true;
      day.vacationPlan = p.plan;
      if (p.plan === 'rest' || p.plan === 'custom') {
        day.exercises = [];
      } else {
        const tpl = VACATION_PLANS[p.plan];
        if (!tpl) break;
        day.exercises = tpl.map(_buildVacationExercise);
      }
      const allVac = wk.days.every(d => d.isVacation);
      if (allVac) wk.mode = 'vacation';
      _checkAndGrantBadges(state);
      break;
    }
    case A.WEEK_LOAD_VACATION_PLAN: {
      const wk = _currentWeek(); if (!wk) break;
      wk.mode = 'vacation';
      wk.days.forEach(day => {
        day.isVacation   = true;
        day.vacationPlan = p.plan;
        if (p.plan === 'rest' || p.plan === 'custom') {
          day.exercises = [];
        } else {
          const tpl = VACATION_PLANS[p.plan];
          if (tpl) {
            day.exercises = tpl.map(_buildVacationExercise);
          }
        }
      });
      _checkAndGrantBadges(state);
      break;
    }

    case A.DAY_SET_FIELD: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day[p.field] = p.value;
      break;
    }

    // B76: Pre-Session Check-in — der Reducer entscheidet NICHT selbst über
    // den Modifier (Schlaf/Energie → 'reduced'/'reduced_mild'/'normal'/
    // 'optimal'), das passiert bereits in ui.js' _buildSessionBriefing() und
    // wird hier nur mechanisch angewendet. Bei 'reduced'/'reduced_mild'
    // werden die noch nicht bewerteten ('pending') Gewichtssätze der
    // heutigen Übungen einmalig reduziert und auf die pro Übung eingestellte
    // Schrittweite gerundet — bewusst NICHT über getWeightRecommendation()
    // (die betrifft nur die Steigerungsempfehlung für die NÄCHSTE Woche,
    // nicht die bereits gesetzten Gewichte der laufenden Session). Seit
    // Sprint C2 (Teil A): modifierScope ('compound'|'all') + compoundExer-
    // ciseNames (von ui.js berechnet, siehe DECISIONS.md) steuern, ob nur
    // Compound-Übungen oder alle betroffen sind.
    case A.SESSION_CHECKIN_SET: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day.sessionCheckIn = {
        sleep: p.sleep ?? null,
        energyPre: p.energyPre ?? null,
        injuryFollowUp: p.injuryFollowUp ?? null, // B129: nur gestellt wenn eine Übung im Tag kürzlich wegen Verletzung übersprungen wurde
        timestamp: Date.now(),
      };
      day.sessionModifier = p.modifier ?? 'normal';
      day.sessionModifierScope = p.modifierScope ?? 'all';
      // Runde 20 (Befund 1): keine automatische Reduktion mehr beim Check-in
      // selbst -- der Nutzer soll die Empfehlung erst bestätigen (siehe
      // "Gewichte heute anpassen"-Button, ui.js _renderSessionBriefing).
      // DAY_REDUCE_PENDING_WEIGHTS ist jetzt der EINZIGE Weg, wie tatsächlich
      // reduziert wird (vorher: automatisch hier + zusätzlich als Catch-up-
      // Button für später hinzugefügte Übungen).
      break;
    }

    // B87 Fix 3: manueller Catch-up für die Tagesform-Reduktion, z.B. für
    // eine Übung die ERST NACH der Check-in-Abgabe zum Tag hinzugefügt wurde
    // (die automatische Reduktion oben lief zu diesem Zeitpunkt schon und
    // sah sie nie). Ein einziger Dispatch für den ganzen Tag (nicht pro
    // Satz) — sonst würde Rückgängig nur den zuletzt geänderten Satz
    // zurückdrehen, nicht den ganzen Klick. ui.js prüft per localStorage-
    // Flag, dass dieser Dispatch nur einmal pro Tag ausgelöst wird. Seit
    // Sprint C2: nutzt denselben Modifier/Scope wie der ursprüngliche
    // Check-in (day.sessionModifier/sessionModifierScope), nicht mehr
    // hartcodiert -10%/alle Übungen.
    case A.DAY_REDUCE_PENDING_WEIGHTS: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      _reducePendingWeights(day, day.sessionModifier, day.sessionModifierScope ?? 'all', p.compoundExerciseNames, state.settings, state.customExercises);
      break;
    }

    // ── Exercise ─────────────────────────────────────────────────────────────
    case A.EX_ADD: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      const m = p.metric ?? 'reps';
      // metricStep analog zu weightStep, je Metrik unterschiedlich sinnvoll
      // (50m-Schritte vs. 10s-Schritte). Siehe unten (progressionType) für
      // die B18/C12-Logik zur Gewichtsachse bei Distanz/Zeit-Übungen.
      // B124: bekannte Einstellungen derselben Übung (case-insensitive)
      // übernehmen statt Default-Werten — Gewicht/Sätze bleiben immer frisch.
      const history = _findExerciseSettingsHistory(state, p.name, p.di);
      // Runde 6 (A9-Folgefix): ex.weightStep wird hier NICHT mehr hart
      // gesetzt (weder Kategorie-Default noch ein anderer Wert) — bleibt
      // also undefined, solange der Nutzer nichts individuell anpasst
      // (EX_SET_STEP) oder history unten einen zuvor customized Wert liefert.
      // Die tatsächlich wirksame Schrittweite wird erst zur Lesezeit über
      // getEffectiveWeightStep() aufgelöst (ex.weightStep ?? settings.
      // plateStep ?? Kategorie-Default) — das macht settings.plateStep
      // endlich wirksam, ohne bestehende Customization anzutasten.
      const carryCategory = resolveCategory(p.name, buildCategoryMap(state.customExercises ?? [])) === 'Carry';
      const newEx = {
        name: p.name, note: '', pauseSec: 90, metric: m,
        // B18/C12: bei Distanz/Zeit-Übungen (metric 'm'/'sec') bleibt
        // 'reps' (hier: Ziel-Distanz/-Zeit) weiterhin der sinnvolle Default
        // — AUSSER die Übung ist als 'Carry' klassifiziert (z.B. Farmer's
        // Walk): dort ist eine Gewichtssteigerung bei fixer/sekundärer
        // Distanz die naheliegendere Progressionsform, deshalb bleibt
        // 'weight' dort wählbar. Bestehende Datensätze sind davon nicht
        // betroffen (die v29->v30-Migration bleibt unverändert).
        progressionType: (m === 'reps' || carryCategory) ? 'weight' : 'reps',
        metricStep: m === 'm' ? 50 : m === 'sec' ? 10 : undefined,
        progressionMode: 'weight_first', targetRepsMax: null, prRepsHistory: {},
        prWeight: null, prRepsAtMaxWeight: null,
        nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
        skipReason: null, skipDate: null,
        // Runde 8 (Cluster 2): Muskelgruppen-Zuordnung nur als Default für
        // eine wirklich NEUE Übung ohne History — ein evtl. vorhandener
        // history.tags-Wert (auch ein bewusst geleertes []) hat unten
        // weiterhin Vorrang, siehe AGENTS.md-Diskussion zu B41.
        tags: resolveMuscleGroups(p.name),
        // Solotest-Feedback (2026-08-16): showPlates war hier bisher gar
        // nicht gesetzt (immer undefined/aus) -- analog zu den bereits
        // gefixten ONBOARDING_SEED- und _applyTpl()-Kopien (movementMap.js
        // defaultShowPlates()) jetzt auch beim manuellen "+Übung" gesetzt.
        showPlates: m === 'reps' && defaultShowPlates(p.name),
        sets: [mkSet(), mkSet(), mkSet()],
      };
      if (history) {
        newEx.weightStep       = history.weightStep;
        newEx.targetReps       = history.targetReps;
        newEx.pauseSec         = history.pauseSec;
        newEx.progressionType  = history.progressionType;
        newEx.metric           = history.metric;
        newEx.tags             = history.tags;
        // Trainings-Tab-Audit (2026-08-17): showPlates/metricStep ergänzt
        // (siehe _findExerciseSettingsHistory()-Kommentar) -- nur
        // übernehmen, wenn die History-Übung den Wert überhaupt trägt
        // (undefined bei nie individuell gesetzt), sonst würde ein
        // gültiger, gerade oben berechneter Default überschrieben.
        if (history.showPlates !== undefined) newEx.showPlates = history.showPlates;
        if (history.metricStep !== undefined) newEx.metricStep = history.metricStep;
      }
      day.exercises.push(newEx);
      break;
    }
    case A.EX_REMOVE: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day.exercises.splice(p.ei, 1);
      break;
    }
    case A.EX_ARCHIVE: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek();
      const ex = wk?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.archived = true;
      break;
    }
    case A.EX_UNARCHIVE: {
      for (const wk of state.weeks)
        for (const day of wk.days)
          for (const ex of day.exercises)
            if (ex.name === p.name) ex.archived = false;
      break;
    }
    case A.EX_UPDATE: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      // Trainings-Tab-Audit (2026-08-17): field==='name' während einer
      // aktiven Substitution (ex.substituteFor gesetzt) löscht substituteFor
      // mit -- ohne diesen Guard konnte eine direkte Umbenennung über das
      // Namensfeld (data-action="ex-name", immer editierbar, auch bei
      // substituierten Übungen) den Anzeigenamen ändern, während
      // substituteFor weiter auf den ALTEN Original-Namen zeigte. Ein
      // späteres "Substitution zurücksetzen" hätte dann fälschlich den
      // Original-Namen wiederhergestellt und die manuelle Umbenennung
      // verworfen. Der "Heute anders"-Flow selbst dispatcht direkt danach
      // EX_SET_SUBSTITUTE mit dem korrekten Original-Namen -- diese Zeile
      // hier ist für ihn ein harmloser Zwischenschritt, keine Verhaltensänderung.
      if (p.field === 'name' && ex.substituteFor) ex.substituteFor = null;
      ex[p.field] = p.value;
      break;
    }
    case A.EX_MOVE: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      const exs = day.exercises;
      if (p.fromEi === p.toEi) break;
      if (p.fromEi < 0 || p.fromEi >= exs.length) break;
      if (p.toEi   < 0 || p.toEi   >= exs.length) break;
      const [moved] = exs.splice(p.fromEi, 1);
      exs.splice(p.toEi, 0, moved);
      break;
    }
    case A.EXERCISE_MOVE_TO_DAY: {
      // B125: Übung atomar in einen anderen Tag derselben Woche verschieben —
      // Einstellungen bleiben, Sätze werden frisch/pending (gleiche Anzahl
      // wie zuvor). Duplikat-Check (Ziel-Tag hat die Übung schon) läuft
      // bewusst VORHER in der UI, nicht hier — der Reducer geht von einem
      // bereits geprüften, gültigen Aufruf aus.
      const wk = _currentWeek(); if (!wk) break;
      const fromDay = wk.days[p.fromDi]; const toDay = wk.days[p.toDi];
      if (!fromDay || !toDay) break;
      if (p.ei < 0 || p.ei >= fromDay.exercises.length) break;
      const [moved] = fromDay.exercises.splice(p.ei, 1);
      moved.sets = moved.sets.map(() => mkSet());
      // Trainings-Tab-Audit (2026-08-17): skipReason/skipDate ergänzt --
      // bezog sich auf ein Skip-Ereignis am ALTEN Tag-Slot; die Übung startet
      // am neuen Tag mit frischen 'pending'-Sätzen, wurde dort noch gar nicht
      // übersprungen. Gleiche Ausnahme wie bei _resetClonedDays(): nur
      // 'substituted' ist strukturell dauerhaft gemeint.
      if (moved.skipReason !== 'substituted') {
        moved.skipReason = null;
        moved.skipDate   = null;
      }
      toDay.exercises.push(moved);
      break;
    }
    case A.EX_TOGGLE_CFG: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex._showCfg = !ex._showCfg;
      break;
    }
    case A.EX_INC_WEIGHT: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const step = p.amount ?? getEffectiveWeightStep(ex, state.settings, state.customExercises);
      
      if (step === 0) {
        // Wenn 0 gewählt ist, setzen wir die gesamte Planung für nächste Woche zurück
        ex.nextWeekPlan = 0;
      } else {
        // Ansonsten addieren wir den Schritt zur Planung
        ex.nextWeekPlan = (ex.nextWeekPlan || 0) + step;
      }
      break;
    }
    case A.EX_SET_NEXT_WEEK_PLAN: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek();
      const ex = wk?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.nextWeekPlan = p.value ?? 0;
      ex.nextWeekPlanConfirmed = true;
      if (p.progressionType) ex.progressionType = p.progressionType;
      break;
    }
    case A.EX_TOGGLE_NEXT_WEEK_CONFIRMED: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek();
      const ex = wk?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.nextWeekPlanConfirmed = !ex.nextWeekPlanConfirmed;
      break;
    }
    case A.EX_AUTO_PRESELECT_NEXT_WEEK_PLAN: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek(); if (!wk) break;
      for (const sel of p.selections ?? []) {
        const ex = wk.days[sel.di]?.exercises[sel.ei]; if (!ex) continue;
        ex.nextWeekPlan = sel.value;
        ex.nextWeekPlanConfirmed = true;
      }
      break;
    }
    case A.EX_MARK_AUTOPLAN_UNREVIEWED: {
      // B128: Tagesabschluss-Trigger — Plan ist bereits aktiv (EX_AUTO_PRESELECT_
      // NEXT_WEEK_PLAN lief unmittelbar davor), dieses Flag steuert nur, ob das
      // Banner ihn noch als "ungeprüft" zeigt.
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek(); if (!wk) break;
      for (const sel of p.selections ?? []) {
        const ex = wk.days[sel.di]?.exercises[sel.ei]; if (!ex) continue;
        ex.nextWeekPlanAutoReviewed = false;
      }
      break;
    }
    case A.EX_MARK_AUTOPLAN_REVIEWED: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek(); if (!wk) break;
      for (const sel of p.selections ?? []) {
        const ex = wk.days[sel.di]?.exercises[sel.ei]; if (!ex) continue;
        ex.nextWeekPlanAutoReviewed = true;
        if (p.reject) {
          ex.nextWeekPlan = 0;
          ex.nextWeekPlanConfirmed = false;
        }
      }
      break;
    }
    case A.EX_SET_SKIP_REASON: {
      // B129: nur 'injury' hat einen datumsbezogenen Coach-Folgeeffekt
      // (_checkInjuryReminder(), weeklyFocus.js) — die anderen Gründe werden
      // nur zur Erfassung gespeichert, ohne skipDate.
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.skipReason = p.reason ?? null;
      // state.js-Audit (Runde 35, B2): UTC-Datum statt der bereits im File
      // vorhandenen _localISODateToday()-Helper-Funktion -- dasselbe,
      // bereits mehrfach gefixte Antimuster.
      ex.skipDate = p.reason === 'injury' ? _localISODateToday() : null;
      break;
    }
    case A.EX_SET_TARGETS: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      if (p.targetReps !== undefined) ex.targetReps = Math.max(1, Math.min(100, +p.targetReps || 0));
      if (p.progressionMode !== undefined && ['weight_first', 'double_progression', 'reps_only'].includes(p.progressionMode)) {
        ex.progressionMode = p.progressionMode;
        // targetRepsMax ist nur bei double_progression relevant — bei jedem
        // anderen Modus zurücksetzen, kein veralteter Wert bleibt stehen.
        if (ex.progressionMode !== 'double_progression') ex.targetRepsMax = null;
      }
      if (p.targetRepsMax !== undefined) {
        ex.targetRepsMax = p.targetRepsMax === null ? null : Math.max(1, Math.min(100, +p.targetRepsMax || 0));
      }
      break;
    }
    case A.EX_SET_STEP: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek();
      const ex = wk?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.weightStep = p.step;
      break;
    }
    case A.EX_SET_METRIC_STEP: {
      const wk = p.weekIdx != null ? state.weeks[p.weekIdx] : _currentWeek();
      const ex = wk?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.metricStep = p.step;
      break;
    }
    case A.EX_SET_METRIC: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const m = p.metric;
      if (m === 'reps' || m === 'sec' || m === 'm') ex.metric = m;
      break;
    }
    case A.EX_SET_SUBSTITUTE: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      // Solotest-Feedback (2026-08-16): der manuelle Reset ("Substitution
      // zurücksetzen") setzte bisher nur substituteFor auf null, ließ aber
      // ex.name auf dem Ersatznamen stehen -- die Originalübung kam nie
      // zurück, UND der nächste Wochenklon (_resetExerciseSubstitution())
      // fand `substituteFor` schon leer vor und übernahm den Ersatznamen
      // fälschlich als "Original". Namen zuerst restaurieren, dann erst
      // substituteFor löschen -- zentral hier statt nur im UI-Handler, damit
      // jeder künftige Aufrufer mit substituteFor:null automatisch korrekt ist.
      if (p.substituteFor == null && ex.substituteFor) {
        ex.name = ex.substituteFor;
      }
      ex.substituteFor = p.substituteFor ?? null;
      if (ex.substituteFor) {
        _recordSubstitution(STATE, ex.substituteFor, ex.name);
        // Runde 18 (Cluster 5): "Heute anders" setzt ab sofort denselben
        // skipReason wie die manuelle "🔄 Durch andere ersetzt"-Auswahl im
        // Skip-Grund-Picker (EX_SET_SKIP_REASON) — sonst wird der Nutzer
        // beim Tagesabschluss trotzdem noch gefragt, obwohl er die Übung
        // bereits per "Heute anders" ersetzt hat. Andere Skip-Gründe
        // (injury/fatigue/time) bleiben bewusst unverändert erneut fragbar,
        // siehe EX_SET_SKIP_REASON — nur 'substituted' unterdrückt dauerhaft.
        ex.skipReason = 'substituted';
        ex.skipDate = null;
      }
      break;
    }
    case A.EXERCISE_NOTE_SET: {
      // B127: permanente, übungsweite Notiz — exakter Name als Key (wie
      // state.prs/state.substituteHistory), NICHT case-insensitive.
      if (!state.exerciseNotes || typeof state.exerciseNotes !== 'object') state.exerciseNotes = {};
      state.exerciseNotes[p.name] = p.value;
      break;
    }
    case A.CUSTOM_ALTERNATIVE_ADD: {
      // B138: exakter Name als Key (wie exerciseNotes/substituteHistory), NICHT
      // case-insensitive. Kein Duplikat-Eintrag bei erneutem Speichern derselben
      // Alternative.
      const name = (p.alternative ?? '').trim();
      if (!p.exerciseName || !name) break;
      if (!state.customAlternatives || typeof state.customAlternatives !== 'object') state.customAlternatives = {};
      if (!Array.isArray(state.customAlternatives[p.exerciseName])) state.customAlternatives[p.exerciseName] = [];
      if (!state.customAlternatives[p.exerciseName].includes(name)) {
        state.customAlternatives[p.exerciseName].push(name);
      }
      break;
    }

    // ── Set ───────────────────────────────────────────────────────────────────
    case A.SET_ADD: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const last = ex.sets[ex.sets.length - 1] ?? { weight: 0, reps: 10 };
      ex.sets.push(mkSet(last.weight, last.reps));
      break;
    }
    case A.SET_REMOVE: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.sets.splice(p.si, 1);
      break;
    }
    case A.SET_UPDATE: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const s  = ex.sets[p.si]; if (!s) break;
      let v = p.value;
      if      (p.field === 'weight') v = Math.max(0, parseFloat(v) || 0);
      else if (p.field === 'reps') {
        // Leeres Feld bleibt leer (null), wird NICHT auf 0 normalisiert —
        // sonst liest "Satz bestätigen" eine 0 und wertet fälschlich als
        // fail, obwohl der Nutzer das Feld nur absichtlich geleert hat.
        if (v === '' || v === null || v === undefined) v = null;
        else {
          const n = parseFloat(v);
          v = Math.max(0, Number.isFinite(n) ? n : 0);
        }
      }
      else if (p.field === 'rpe')  v = (v === '' || v === null) ? null : Math.min(10, Math.max(1, +v));
      else if (p.field === 'note') v = String(v ?? '').slice(0, 120);
      // Trainings-Tab-Audit (2026-08-17): Phantom-PR-Fix -- eine Korrektur
      // an einem bereits ERFOLGREICHEN Satzes' Gewicht/Wdh kann den bisher
      // gespeicherten PR ungültig machen (z.B. Gewicht nachträglich nach
      // unten korrigiert). Snapshot VOR der Feldänderung, Recompute danach.
      const _wasSuccessForPr = s.status === 'success' && (p.field === 'weight' || p.field === 'reps');
      s[p.field] = v;
      // Straight sets: auto-propagate weight from set 0 to all following pending sets
      if (p.si === 0 && p.field === 'weight' && (ex.setType ?? 'straight') === 'straight') {
        for (let j = 1; j < ex.sets.length; j++) {
          if (ex.sets[j].status === 'pending')
            ex.sets[j].weight = v;
        }
      }
      // Befund #2: eine Wdh-/Gewichts-Korrektur an einem bereits bewerteten
      // Satz (status !== 'pending') soll den Status neu bewerten statt ihn
      // einzufrieren — z.B. Wdh-Korrektur nach einem Fehlschlag soll das
      // Status-Icon automatisch auf ✓ aktualisieren, wenn das Ziel jetzt
      // erreicht ist (und umgekehrt). Pending Sätze bleiben unangetastet
      // (die werden ohnehin erst über SET_TOGGLE_DONE/CONFIRM_SET/
      // AUTO_EVAL_SET erstmalig bewertet).
      if ((p.field === 'reps' || p.field === 'weight') && s.status !== 'pending') {
        _evaluateSetStatus(ex, s);
      }
      if (_wasSuccessForPr) _recomputePrFromHistory(state, ex.substituteFor || ex.name);
      break;
    }
    case A.SET_TOGGLE_DONE: {
      const exForToggle = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!exForToggle) break;
      const s = exForToggle.sets[p.si]; if (!s) break;
      const _wasSuccessForPrToggle = s.status === 'success';
      const order = ['pending', 'success', 'fail'];
      let cur = s.status;
      if (cur !== 'pending' && cur !== 'success' && cur !== 'fail') {
        cur = s.done ? 'success' : 'pending';
      }
      const i = Math.max(0, order.indexOf(cur));
      // canSuccess via zentralen Helper (_evaluateSetStatus) — setzt
      // s.status/s.done als Nebeneffekt bereits vorläufig auf success/fail,
      // wird unten von der eigentlichen Zyklus-Logik (next) aber ohnehin
      // überschrieben. Nur der Rückgabewert wird hier gebraucht.
      const canSuccess = _evaluateSetStatus(exForToggle, s);
      let next = order[(i + 1) % 3];
      if (next === 'success' && !canSuccess) next = 'fail';
      s.status = next;
      s.done   = next === 'success';

      // Update PRs when a set is newly marked success in a non-deload week
      if (next === 'success' && _currentWeek()?.mode !== 'deload') {
        const ex     = exForToggle;
        const weight = parseFloat(s.weight) || 0;
        const reps   = parseFloat(s.reps)   || 0;
        if (ex && reps > 0) {
          _applyPrTracking(state, ex, s, weight, reps);
        }
      } else if (_wasSuccessForPrToggle && next !== 'success') {
        // Trainings-Tab-Audit (2026-08-17): Phantom-PR-Fix -- siehe
        // Kommentar bei _recomputePrFromHistory(). Ein Satz, der einen PR
        // getragen hat, wird hier zurück auf 'pending'/'fail' zyklisiert.
        _recomputePrFromHistory(state, exForToggle.substituteFor || exForToggle.name);
      }
      break;
    }
    case A.SET_AUTOFILL_RPE: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const sets = ex.sets;
      const si   = p.si;
      if (si < 0 || si >= sets.length - 1) break;
      const src = sets[si]; if (!src || src.rpe == null) break;
      sets[si + 1].rpe = src.rpe;
      break;
    }
    case A.CONFIRM_SET: {
      const wk = _currentWeek(); if (!wk) break;
      const ex = wk.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const s  = ex.sets[p.si];
      if (!s || s.status === 'success') break;
      if (p.reps != null) s.reps = parseFloat(p.reps) || 0;
      // canSuccess/status/done über zentralen Helper (_evaluateSetStatus,
      // Befund #2-Konsolidierung) — gleiche Logik wie SET_TOGGLE_DONE/
      // AUTO_EVAL_SET.
      const canSuccess = _evaluateSetStatus(ex, s);
      if (canSuccess && wk.mode !== 'deload') {
        const weight = parseFloat(s.weight) || 0;
        const reps   = parseFloat(s.reps)   || 0;
        if (reps > 0) {
          _applyPrTracking(state, ex, s, weight, reps);
        }
      }
      break;
    }

    case A.AUTO_EVAL_SET: {
      const wk = _currentWeek(); if (!wk) break;
      const ex = wk.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const s  = ex.sets[p.si]; if (!s) break;
      if (s.status !== 'pending') break;
      s.reps = parseFloat(p.reps) || 0;
      // canSuccess/status/done über zentralen Helper (_evaluateSetStatus,
      // Befund #2-Konsolidierung) — gleiche Logik wie SET_TOGGLE_DONE/
      // CONFIRM_SET.
      const canSuccess = _evaluateSetStatus(ex, s);
      if (canSuccess && wk.mode !== 'deload') {
        const weight = parseFloat(s.weight) || 0;
        const reps   = parseFloat(s.reps)   || 0;
        if (reps > 0) {
          _applyPrTracking(state, ex, s, weight, reps);
        }
      }
      break;
    }

    case A.SET_RPE: {
      const s = _currentWeek()?.days[p.di]?.exercises[p.ei]?.sets[p.si]; if (!s) break;
      s.rpe = p.rpe;
      break;
    }

    // ── Session timestamps ────────────────────────────────────────────────────
    case A.SESSION_START: {
      const wk = _currentWeek(); if (!wk) break;
      const day = wk.days[p.di]; if (!day) break;
      if (!day.sessionStartTs) day.sessionStartTs = p.ts ?? Date.now();
      break;
    }
    case A.SESSION_RESET: {
      const wk = _currentWeek(); if (!wk) break;
      const day = wk.days[p.di]; if (!day) break;
      day.sessionStartTs = null;
      break;
    }
    case A.SESSION_STOP: {
      const wk = _currentWeek(); if (!wk) break;
      if (!wk.sessionLog) wk.sessionLog = [];
      // Solotest-Feedback (2026-08-16): defensive Deckelung gegen das
      // Session-Timeout, zusätzlich zur bereits gedeckelten Anzeige in
      // timer.js _updateClockDisplay() — verhindert, dass eine nie sauber
      // beendete Session (App im Hintergrund vergessen, erst Stunden/Tage
      // später manuell gestoppt) eine überzogene Dauer in den sessionLog
      // schreibt und den Ø-Session-Wert im Fortschritt-Tab verzerrt.
      const maxSec = Math.round((state.settings?.maxSessionMs ?? 10800000) / 1000);
      wk.sessionLog.push({
        date:     new Date().toISOString(),
        duration: Math.min(p.duration, maxSec),
        time:     p.time,
      });
      break;
    }

    // ── Body data ─────────────────────────────────────────────────────────────
    case A.BODY_SET_FIELD: {
      const wk = _currentWeek(); if (!wk) break;
      if (!wk.bodyData) wk.bodyData = {};
      wk.bodyData[p.field] = p.value;
      break;
    }
    case A.BODY_LOG_WEIGHT: {
      const wk = _currentWeek(); if (!wk) break;
      if (!wk.bodyData) wk.bodyData = {};
      if (!Array.isArray(wk.bodyData.weightLog)) wk.bodyData.weightLog = [];
      const idx = wk.bodyData.weightLog.findIndex(e => e.date === p.date);
      if (idx >= 0) {
        wk.bodyData.weightLog[idx].weight = p.weight;
      } else {
        wk.bodyData.weightLog.push({ date: p.date, weight: p.weight });
        wk.bodyData.weightLog.sort((a, b) => a.date.localeCompare(b.date));
      }
      break;
    }

    // ── Template ──────────────────────────────────────────────────────────────
    case A.TPL_SAVE: {
      state.customTemplate = p.template;
      _walkTemplateDays(state.customTemplate, _normalizeSetRecord);
      _normalizeAllExerciseMetrics(state);
      break;
    }
    case A.TPL_RESET_TO_FACTORY: {
      state.customTemplate = clone(FACTORY_TEMPLATE);
      _normalizeAllExerciseMetrics(state);
      break;
    }
    case A.WEEK_RESET_TO_TPL: {
      const wk = _currentWeek(); if (!wk) break;
      const days = clone(state.customTemplate ?? FACTORY_TEMPLATE);
      days.forEach(d => (d.exercises ?? []).forEach(ex => {
        ex.nextWeekPlan = 0;
        ex.nextWeekPlanConfirmed = false;
        ex._showCfg = false;
      }));
      // Körper-Tab/Einstellungen-Audit (2026-08-17): nutzt jetzt dieselbe
      // zentrale _resetClonedDays()-Funktion wie WEEK_CREATE/AUTO_WEEK_CREATE
      // statt einer eigenen, unvollständigen Kopie -- die vorherige Inline-
      // Logik setzte nur sets.status/done + day.locked/markedDone zurück,
      // ließ aber skipReason/skipDate, substituteFor, sets.reps/rpe UND alle
      // Tag-Session-Felder (sessionCheckIn/sessionModifier/sleepHours/
      // energyLevel/sessionStartTs/sessionEndTs) unangetastet stehen. Das
      // war bereits die VIERTE unabhängige Klon-Reset-Kopie mit denselben
      // Lücken wie die drei in Runde 25 (B288) gefixten Stellen.
      _resetClonedDays(days);
      wk.days = days;
      break;
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    // Körper-Tab/Einstellungen-Audit (2026-08-17): Warnhinweis -- der
    // `key in state.settings`-Guard bedeutet, dass ein Toggle-Key, der
    // (noch) NICHT in buildDefaultState()'s settings-Objekt existiert, hier
    // stillschweigend zum No-op wird, OHNE Fehlermeldung. Historisches
    // Beispiel: soundEnabled (B210/Runde 19) war genau deshalb für
    // Bestandsnutzer dauerhaft wirkungslos. Beim Hinzufügen eines neuen
    // Settings-Tab-Toggles (`tog()` in renderSettingsTab, ui.js) IMMER
    // zuerst den Key in buildDefaultState() UND der "Always-apply
    // defaults"-Sektion in migrate() ergänzen.
    case A.SETTING_TOGGLE: {
      if (p.key in state.settings) state.settings[p.key] = !state.settings[p.key];
      break;
    }
    case A.SETTING_SET: {
      state.settings[p.key] = p.value;
      break;
    }
    case A.AUTOWEEK_SET: {
      if (!state.settings.autoWeek) state.settings.autoWeek = { enabled: false, suggestProgress: true, showReview: true };
      if (['enabled', 'suggestProgress', 'showReview'].includes(p.key)) {
        state.settings.autoWeek[p.key] = !!p.value;
      }
      break;
    }

    // ── Full import ───────────────────────────────────────────────────────────
    case A.STATE_IMPORT: {
      const imported = migrate(p.imported);
      if (!Array.isArray(imported?.weeks)) break;
      // Capture the week the IMPORTED curIdx points to (in imported.weeks'
      // own, possibly-unsorted order) before Object.assign + resort — an
      // external JSON import is not guaranteed to already be chronological.
      const _importRefWeek = imported.weeks[imported.curIdx];
      Object.assign(state, imported);
      if (!state.prs)                        state.prs       = {};
      if (!state.templates)                  state.templates = [];
      if (!Array.isArray(state.badges))      state.badges    = [];
      if (!state.weeks.length) _appendDefaultWeek();
      _resortWeeksKeepingCurrent(state, _importRefWeek);
      _checkAndGrantBadges(state);
      console.log('[TRAIN] Post-import streak:', _calcCurrentStreak(state.weeks), 'badges:', state.badges);
      break;
    }

    // ── Undo ──────────────────────────────────────────────────────────────────
    case A.UNDO: {
      const prev = _undoStack.pop();
      if (!prev) return; // nothing to undo — skip persist+notify
      const _undoRefWeek      = prev.weeks[prev.curIdx];
      state.weeks             = prev.weeks;
      state.customTemplate    = prev.customTemplate;
      state.settings          = prev.settings;
      state.favoriteExercises = prev.favoriteExercises ?? [];
      state.customExercises   = prev.customExercises ?? [];
      _resortWeeksKeepingCurrent(state, _undoRefWeek);
      break;
    }

    // ── Named templates (v9) ─────────────────────────────────────────────────
    case A.TEMPLATE_ADD: {
      if (!Array.isArray(state.templates)) state.templates = [];
      // Körper-Tab/Einstellungen-Audit (2026-08-17): Namens-Duplikate
      // automatisch disambiguiert (" (2)", " (3)", ...) -- vorher waren
      // zwei benannte Vorlagen mit identischem Namen möglich (keine
      // Datenkorruption, aber eine verwirrende Auswahl-Liste beim Laden,
      // da nicht unterscheidbar).
      let baseName = String(p.name ?? 'Neues Template').trim() || 'Neues Template';
      let finalName = baseName;
      let n = 2;
      while (state.templates.some(t => t.name === finalName)) {
        finalName = `${baseName} (${n})`;
        n++;
      }
      state.templates.push({
        id:   Date.now() + Math.random(),
        name: finalName,
        days: p.days ? clone(p.days) : clone(state.customTemplate ?? FACTORY_TEMPLATE),
      });
      break;
    }
    case A.TEMPLATE_UPDATE: {
      const tIdx = (state.templates ?? []).findIndex(t => t.id === p.id);
      if (tIdx !== -1) {
        if (p.name !== undefined) state.templates[tIdx].name = p.name;
        if (p.days !== undefined) state.templates[tIdx].days = clone(p.days);
      }
      break;
    }
    case A.TEMPLATE_DELETE: {
      state.templates = (state.templates ?? []).filter(t => t.id !== p.id);
      break;
    }

    // ── Rest days (v9) ───────────────────────────────────────────────────────
    case A.WEEK_ADD_REST_DAY: {
      const wk = _currentWeek(); if (!wk) break;
      if (!Array.isArray(wk.restDays)) wk.restDays = [];
      if (!wk.restDays.find(r => r.date === p.date)) {
        wk.restDays.push({ date: p.date, note: p.note ?? '' });
      }
      break;
    }
    case A.WEEK_REMOVE_REST_DAY: {
      const wk = _currentWeek(); if (!wk) break;
      wk.restDays = (wk.restDays ?? []).filter(r => r.date !== p.date);
      break;
    }

    // ── Insights ──────────────────────────────────────────────────────────────
    case A.INSIGHTS_SET: {
      state.insights = p.insights ?? [];
      break;
    }

    // ── Custom exercises ──────────────────────────────────────────────────────
    case A.CUSTOM_EX_ADD: {
      if (!Array.isArray(state.customExercises)) state.customExercises = [];
      state.customExercises.push({
        name: p.name, metric: p.metric ?? 'reps', category: p.category ?? null,
      });
      break;
    }
    case A.CUSTOM_EX_UPDATE: {
      if (!Array.isArray(state.customExercises)) state.customExercises = [];
      const ce = state.customExercises.find(c => c.name === p.oldName);
      if (!ce) break;
      ce.name = p.name; ce.metric = p.metric ?? 'reps'; ce.category = p.category ?? null;
      if (p.oldName !== p.name) {
        state.weeks.forEach(wk => wk.days.forEach(day => day.exercises.forEach(ex => {
          if (ex.name === p.oldName) ex.name = p.name;
          // Körper-Tab/Einstellungen-Audit (2026-08-17): substituteFor
          // ergänzt -- dieselbe Fehlerklasse wie B291 (EX_MERGE_NAMES),
          // hier eine unabhängige zweite Fundstelle.
          if (ex.substituteFor === p.oldName) ex.substituteFor = p.name;
        })));
        state.customTemplate.forEach(day => day.exercises.forEach(ex => {
          if (ex.name === p.oldName) ex.name = p.name;
        }));
        const fi = (state.favoriteExercises ?? []).indexOf(p.oldName);
        if (fi >= 0) state.favoriteExercises[fi] = p.name;
        // Körper-Tab/Einstellungen-Audit (2026-08-17): vier namensbasierte
        // State-Maps ergänzt, die bisher NICHT migriert wurden -- wurden
        // beim Umbenennen zu Waisen-Einträgen unter dem alten Namen (PR
        // erschien für die umbenannte Übung fälschlich als "nie erreicht",
        // ein bereits bearbeitetes Plateau wurde erneut gemeldet, die
        // dauerhafte Notiz (B127) und gespeicherte Alternativ-Vorschläge
        // (B138) gingen verloren).
        if (state.prs && Object.prototype.hasOwnProperty.call(state.prs, p.oldName)) {
          state.prs[p.name] = state.prs[p.oldName];
          delete state.prs[p.oldName];
        }
        if (state.plateauActions && Object.prototype.hasOwnProperty.call(state.plateauActions, p.oldName)) {
          state.plateauActions[p.name] = state.plateauActions[p.oldName];
          delete state.plateauActions[p.oldName];
        }
        if (state.exerciseNotes && Object.prototype.hasOwnProperty.call(state.exerciseNotes, p.oldName)) {
          state.exerciseNotes[p.name] = state.exerciseNotes[p.oldName];
          delete state.exerciseNotes[p.oldName];
        }
        if (state.customAlternatives && Object.prototype.hasOwnProperty.call(state.customAlternatives, p.oldName)) {
          state.customAlternatives[p.name] = state.customAlternatives[p.oldName];
          delete state.customAlternatives[p.oldName];
        }
      }
      break;
    }
    case A.CUSTOM_EX_DELETE: {
      state.customExercises = (state.customExercises ?? []).filter(c => c.name !== p.name);
      break;
    }
    // Nur für Übungen ohne vollwertigen customExercises-Eintrag (Standardübungen) —
    // echte eigene Übungen laufen über CUSTOM_EX_UPDATE (Aufrufer in ui.js entscheidet).
    case A.EX_SET_CATEGORY_OVERRIDE: {
      if (!Array.isArray(state.customExercises)) state.customExercises = [];
      const idx = state.customExercises.findIndex(c => c.name === p.name);
      if (p.category) {
        if (idx >= 0) state.customExercises[idx].category = p.category;
        else state.customExercises.push({ name: p.name, category: p.category });
      } else if (idx >= 0) {
        state.customExercises.splice(idx, 1);
      }
      break;
    }
    case A.EX_MERGE_NAMES: {
      const variantNames = p.variantNames ?? [];
      const finalName    = String(p.finalName ?? '').trim();
      if (!finalName || variantNames.length === 0) break;
      const variantSet = new Set(variantNames);

      state.weeks.forEach(wk => wk.days.forEach(day => day.exercises.forEach(ex => {
        if (variantSet.has(ex.name)) ex.name = finalName;
        // Trainings-Tab-Audit (2026-08-17): substituteFor-Referenzen
        // ebenfalls aktualisiert -- ohne diesen Fix konnte eine
        // substituteFor-Referenz auf einen jetzt zusammengeführten,
        // "verschwundenen" Namen zeigen. Ein Zurücksetzen der Substitution
        // (EX_SET_SUBSTITUTE) hätte diesen Geister-Namen dann fälschlich
        // als "Original" wiederhergestellt.
        if (ex.substituteFor && variantSet.has(ex.substituteFor)) ex.substituteFor = finalName;
      })));
      state.customTemplate.forEach(day => day.exercises.forEach(ex => {
        if (variantSet.has(ex.name)) ex.name = finalName;
      }));
      state.favoriteExercises = [...new Set(
        (state.favoriteExercises ?? []).map(fav => variantSet.has(fav) ? finalName : fav)
      )];

      // Mehrere customExercises-Einträge derselben Übung zu einem zusammenführen.
      if (Array.isArray(state.customExercises)) {
        const matches = state.customExercises.filter(c => variantSet.has(c.name));
        if (matches.length > 0) {
          const keep = matches.find(c => c.name === finalName) ?? matches[0];
          keep.name = finalName;
          state.customExercises = state.customExercises.filter(c => !variantSet.has(c.name) || c === keep);
        }
      }
      // state.js-Audit (Runde 35, B6): vier namensbasierte State-Maps
      // ergänzt, die bisher NICHT beim Zusammenführen migriert wurden --
      // dieselbe Fehlerklasse und derselbe Fix wie bei CUSTOM_EX_UPDATE
      // oben (PR erschien fälschlich als "nie erreicht", ein bereits
      // bearbeitetes Plateau wurde erneut gemeldet, dauerhafte Notiz
      // (B127) und gespeicherte Alternativ-Vorschläge (B138) gingen
      // verloren) -- EX_MERGE_NAMES hatte diese Behandlung nie erhalten,
      // obwohl es dieselbe Art von Umbenennung ist (mehrere alte Namen ->
      // ein neuer Name statt nur einem).
      for (const oldName of variantNames) {
        if (oldName === finalName) continue;
        if (state.prs && Object.prototype.hasOwnProperty.call(state.prs, oldName)) {
          if (!Object.prototype.hasOwnProperty.call(state.prs, finalName)) state.prs[finalName] = state.prs[oldName];
          delete state.prs[oldName];
        }
        if (state.plateauActions && Object.prototype.hasOwnProperty.call(state.plateauActions, oldName)) {
          if (!Object.prototype.hasOwnProperty.call(state.plateauActions, finalName)) state.plateauActions[finalName] = state.plateauActions[oldName];
          delete state.plateauActions[oldName];
        }
        if (state.exerciseNotes && Object.prototype.hasOwnProperty.call(state.exerciseNotes, oldName)) {
          if (!Object.prototype.hasOwnProperty.call(state.exerciseNotes, finalName)) state.exerciseNotes[finalName] = state.exerciseNotes[oldName];
          delete state.exerciseNotes[oldName];
        }
        if (state.customAlternatives && Object.prototype.hasOwnProperty.call(state.customAlternatives, oldName)) {
          if (!Object.prototype.hasOwnProperty.call(state.customAlternatives, finalName)) state.customAlternatives[finalName] = state.customAlternatives[oldName];
          delete state.customAlternatives[oldName];
        }
      }
      break;
    }
    case A.DISMISS_NAME_PAIR: {
      if (!Array.isArray(state.settings.dismissedNamePairs)) state.settings.dismissedNamePairs = [];
      const key = [String(p.a ?? '').trim().toLowerCase(), String(p.b ?? '').trim().toLowerCase()].sort();
      const exists = state.settings.dismissedNamePairs.some(pair => pair[0] === key[0] && pair[1] === key[1]);
      if (!exists) state.settings.dismissedNamePairs.push(key);
      break;
    }

    // ── Wiedereinstieg nach Pause ────────────────────────────────────────────
    case A.REENTRY_HANDLED: {
      state.lastReentryHandled = Date.now();
      break;
    }
    case A.PLATEAU_ACTION: {
      if (!p.exerciseName || !p.action) break;
      if (!state.plateauActions) state.plateauActions = {};
      // Überschreibt immer — letzte Aktion für diese Übung gewinnt.
      state.plateauActions[p.exerciseName] = {
        action: p.action,
        since: p.since,
        plateauWeeksAtAction: p.plateauWeeksAtAction,
      };
      break;
    }
    case A.EX_APPLY_REENTRY_REDUCTION: {
      const wk = _currentWeek(); if (!wk) break;
      const factor = p.factor ?? 0;
      if (factor <= 0) break;
      wk.days.forEach(day => (day.exercises ?? []).forEach(ex => {
        const hasWeight = ex.metric === 'reps' && ex.sets.some(s => (s.weight ?? 0) > 0);
        if (hasWeight) {
          const step = getEffectiveWeightStep(ex, state.settings, state.customExercises);
          ex.sets.forEach(s => {
            if ((s.weight ?? 0) > 0) s.weight = Math.round((s.weight * (1 - factor)) / step) * step;
          });
        } else if (ex.targetReps) {
          ex.targetReps = Math.max(1, Math.round(ex.targetReps * (1 - factor)));
        }
      }));
      break;
    }

    // ── Favorites ─────────────────────────────────────────────────────────────
    case A.TOGGLE_FAVORITE: {
      const favs = state.favoriteExercises ?? [];
      const idx  = favs.indexOf(p.name);
      if (idx >= 0) {
        state.favoriteExercises = favs.filter((_, i) => i !== idx);
      } else if (favs.length < 5) {
        state.favoriteExercises = [...favs, p.name];
      }
      // If already 5 favorites: no-op — UI shows toast before dispatching
      break;
    }

    // ── Onboarding ────────────────────────────────────────────────────────────
    case A.ONBOARDING_WEEK_CREATE: {
      if (!p.startDate || !Array.isArray(p.days)) break;
      if (state.weeks.find(w => w.startDate === p.startDate)) break;
      const _obNewWeek = {
        id: Date.now(), startDate: p.startDate, note: p.note ?? '',
        mode: 'standard', days: p.days, sessionLog: [], bodyData: {}, restDays: [],
      };
      state.weeks.push(_obNewWeek);
      _resortWeeksKeepingCurrent(state, _obNewWeek);
      _checkAndGrantBadges(state);
      break;
    }

    case A.ONBOARDING_DONE: {
      state.onboardingDone = true;
      if (state.weeks.length === 0) _appendDefaultWeek();
      break;
    }

    case A.ONBOARDING_SEED: {
      if (!p.startDate || !Array.isArray(p.exercises) || !p.exercises.length) break;
      if (state.weeks.find(w => w.startDate === p.startDate)) break; // dedupe
      const _seedExercises = p.exercises.map((sw, i) => ({
        id: Date.now() - 1000 + i,
        name: sw.name, note: '', pauseSec: 90, metric: 'reps',
        sets: [{ weight: sw.weight, reps: sw.reps ?? 5, rpe: sw.rpe ?? null, status: 'success', done: true }],
        weightStep: defaultWeightStepForExercise(sw.name, state.customExercises), nextWeekPlan: 0, nextWeekPlanConfirmed: false, nextWeekPlanAutoReviewed: true,
        skipReason: null, skipDate: null,
        targetReps: sw.reps ?? 5,
        // Befund #3: Hantelscheiben-Rechner-Default an, außer bei bekannten
        // stangenlosen Übungen (Solotest-Feedback 2026-08-16, siehe
        // defaultShowPlates()/NO_BARBELL_EXERCISE_NAMES, movementMap.js).
        _showCfg: false, setType: 'straight', tags: [], showPlates: defaultShowPlates(sw.name),
        progressionType: 'weight', substituteFor: null,
        progressionMode: 'weight_first', targetRepsMax: null, prRepsHistory: {},
      }));
      const _seedWeek = {
        id: Date.now() - 1000,
        startDate: p.startDate, note: 'Startwerte',
        mode: 'standard', isSeedWeek: true,
        days: [{
          id: Date.now() - 999, title: 'Startwerte', subtitle: '',
          warmup: '', cooldown: '', locked: true, markedDone: true,
          isVacation: false, exercises: _seedExercises,
        }],
        sessionLog: [], bodyData: {}, restDays: [],
      };
      state.weeks.push(_seedWeek);
      _resortWeeksKeepingCurrent(state, state.weeks[state.curIdx]);
      _recalcExercisePRs(state);
      break;
    }

    case A.MARK_TIP_SEEN: {
      if (!Array.isArray(state.seenTips)) state.seenTips = [];
      if (!state.seenTips.includes(p.tipId)) state.seenTips.push(p.tipId);
      break;
    }

    // ── Decision log ──────────────────────────────────────────────────────────
    case A.DECISION_LOG_ADD: {
      if (!Array.isArray(state.decisionLog)) state.decisionLog = [];
      state.decisionLog.push({
        id: Date.now(),
        type: p.type,
        signal: p.signal,
        choice: p.choice,
        decidedWeekStart: p.decidedWeekStart,
        outcome: null,
      });
      if (state.decisionLog.length > 50) state.decisionLog.splice(0, state.decisionLog.length - 50);
      break;
    }
    case A.DECISION_LOG_OUTCOME: {
      if (!Array.isArray(state.decisionLog)) break;
      const entry = state.decisionLog.find(e => e.id === p.id);
      if (entry && entry.outcome === null) entry.outcome = p.outcome;
      break;
    }
    case A.COACH_ANSWER: {
      // Nutzer-Feedback (2026-08-17, Coach-Tab-Audit): exerciseName ergänzt --
      // ohne dieses Feld matchte _checkPrePlateau() (weeklyFocus.js) eine
      // gespeicherte Antwort nur über weekStart+questionId, nicht über die
      // konkrete Übung. Erfüllten in derselben Woche zwei unterschiedliche
      // Übungen unabhängig voneinander die Pre-Plateau-Bedingung, konnte die
      // Antwort des Nutzers (bezogen auf Übung A) fälschlich auf Übung B
      // angewendet werden.
      state.coachQuestion = {
        weekStart:         p.weekStart,
        questionId:        p.questionId,
        answer:            p.answer,
        exerciseName:      p.exerciseName ?? null,
        outcome:           null,
        measuredWeekStart: null,
      };
      break;
    }
    case A.COACH_QUESTION_OUTCOME: {
      if (!state.coachQuestion?.answer || state.coachQuestion.outcome !== null) break;
      state.coachQuestion.outcome           = p.outcome;
      state.coachQuestion.measuredWeekStart = p.measuredWeekStart;
      if (!Array.isArray(state.coachQuestionHistory)) state.coachQuestionHistory = [];
      state.coachQuestionHistory.push({
        weekStart:         state.coachQuestion.weekStart,
        questionId:        state.coachQuestion.questionId,
        answer:            state.coachQuestion.answer,
        exerciseName:      state.coachQuestion.exerciseName ?? null,
        outcome:           p.outcome,
        measuredWeekStart: p.measuredWeekStart,
      });
      if (state.coachQuestionHistory.length > 50) {
        state.coachQuestionHistory.splice(0, state.coachQuestionHistory.length - 50);
      }
      break;
    }
    case A.COACH_PERF_LOG: {
      if (!p.weekStart || !p.exerciseName) break;
      if (!Array.isArray(state.coachPerformance?.suggestions)) {
        state.coachPerformance = { suggestions: [] };
      }
      const _alreadyLogged = state.coachPerformance.suggestions.some(
        s => s.weekStart === p.weekStart && s.exerciseName === p.exerciseName
      );
      if (_alreadyLogged) break;
      state.coachPerformance.suggestions.push({
        id:             Date.now(),
        weekStart:      p.weekStart,
        status:         p.status,
        exerciseName:   p.exerciseName,
        suggestedDelta: p.suggestedDelta ?? null,
        fromWeight:     p.fromWeight     ?? null,
        confidenceLevel: p.confidenceLevel ?? null,
        followed:        null,
        outcome:         null,
        measuredWeekStart: null,
      });
      if (state.coachPerformance.suggestions.length > 100) {
        state.coachPerformance.suggestions.splice(0, state.coachPerformance.suggestions.length - 100);
      }
      break;
    }
    case A.COACH_PERF_MEASURE: {
      const _entry = state.coachPerformance?.suggestions?.find(s => s.id === p.id);
      if (!_entry || _entry.outcome !== null) break;
      _entry.followed          = p.followed;
      _entry.outcome           = p.outcome;
      _entry.measuredWeekStart = p.measuredWeekStart;
      break;
    }
    case A.SET_ERKENNTNISSE_HORIZONT: {
      const v = Math.round(Number(p.value));
      if (!isNaN(v)) state.settings.erkenntnisseHorizont = Math.max(4, Math.min(52, v));
      break;
    }
    default:
      console.warn('[TRAIN] Unknown action type:', type);
      return; // Don't persist unknown actions
  }

  persistState();
  _notify();
}

// ─── Public dispatch ─────────────────────────────────────────────────────────

/**
 * Dispatch an action to mutate state.
 *
 * @param {string} type  – one of the A.* constants
 * @param {object} [payload={}]
 */
export function dispatch(type, payload = {}) {
  reduce(STATE, { type, payload });
}
