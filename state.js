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

// ─── Constants ────────────────────────────────────────────────────────────────

export const STORAGE_KEY        = 'train_v6';
export const STORAGE_KEY_SHADOW = 'train_v6_shadow';
export const SCHEMA_VERSION     = 15;

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
    badges: [],               // { id, unlockedAt }[] – earned badges
    onboardingDone: false,    // true after first-run flow completed
    settings: {
      swipe:              true,
      drag:               true,
      heightCm:           null,
      targetWeight:       null,
      showBmi:            false,
      deloadFactor:       0.75,
      deloadFactorCustom: null,
      barbellWeight:      20,
      plateStep:          2.5,
      lastBackupDate:                 null,
      activeTags:                     ALL_TAGS_FLAT,
      vibrationEnabled:               true,
      rpeEnabled:                     true,
      weeksSinceLastBackupReminder:   0,
      maxSessionMs:                   10800000, // 3h default
    },
  };
}

// ─── Undo stack ───────────────────────────────────────────────────────────────

const _undoStack = [];
const _MAX_UNDO  = 20;

// Actions that are pure navigation or external events — not worth undoing.
const _NO_UNDO = new Set([
  'UNDO', 'WEEK_NAVIGATE', 'STATE_IMPORT', 'SESSION_START', 'SESSION_RESET', 'SESSION_STOP',
  'INSIGHTS_SET', 'ONBOARDING_DONE',
]);

/** Returns true when there is at least one undo snapshot available. */
export function canUndo() { return _undoStack.length > 0; }

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

function _calcCurrentStreak(weeks) {
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let cur = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].days.some(d => !!d.markedDone)) cur++;
    else break;
  }
  return cur;
}

function _checkAndGrantBadges(state) {
  const streak  = _calcCurrentStreak(state.weeks);
  const now     = new Date().toISOString();
  const newOnes = [];
  for (const thr of BADGE_THRESHOLDS) {
    if (streak >= thr.weeks && !state.badges.some(b => b.id === thr.id)) {
      state.badges.push({ id: thr.id, unlockedAt: now });
      newOnes.push({ ...thr, unlockedAt: now });
    }
  }
  if (newOnes.length > 0) {
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('train:badge-earned', { detail: newOnes }));
    }, 0);
  }
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
    if (raw.settings.heightCm     === undefined) raw.settings.heightCm     = null;
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
    if (s.showBmi            === undefined) s.showBmi            = false;
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

  // Always-apply defaults for settings added in later versions
  if (raw.settings.vibrationEnabled               === undefined) raw.settings.vibrationEnabled               = true;
  if (raw.settings.rpeEnabled                     === undefined) raw.settings.rpeEnabled                     = true;
  if (raw.settings.weeksSinceLastBackupReminder   === undefined) raw.settings.weeksSinceLastBackupReminder   = 0;
  if (raw.settings.maxSessionMs                   === undefined) raw.settings.maxSessionMs                   = 10800000;

  // Backward compat: rename legacy setType 'pyramid' → 'manual'
  const _normSetType = ex => { if (ex.setType === 'pyramid') ex.setType = 'manual'; };
  (raw.weeks ?? []).forEach(wk => (wk.days ?? []).forEach(day => (day.exercises ?? []).forEach(_normSetType)));
  (raw.customTemplate ?? []).forEach(day => (day.exercises ?? []).forEach(_normSetType));

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
      if (!Array.isArray(STATE.badges))            STATE.badges = [];
      if (STATE.onboardingDone === undefined)       STATE.onboardingDone = false;
      // Defensive bounds check — only restore missing week when onboarding is already done
      if (!STATE.weeks.length && STATE.onboardingDone) _appendDefaultWeek();
      if (STATE.curIdx >= STATE.weeks.length) STATE.curIdx = STATE.weeks.length - 1;
      if (STATE.curIdx < 0)                   STATE.curIdx = 0;
      persistState(); // re-write so both keys are in sync
      return true;
    } catch (e) {
      console.warn('[TRAIN] loadState: parse error from source, trying next.', e);
    }
  }

  // Nothing recoverable – start fresh; onboarding will create the first week
  console.log('[TRAIN] loadState: fresh start — no saved data');
  STATE = buildDefaultState();
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

// ─── Week helpers (used inside reducers) ─────────────────────────────────────

function _currentWeek() {
  return STATE.weeks[STATE.curIdx] ?? null;
}

function _appendDefaultWeek(startDate) {
  const days = clone(STATE.customTemplate ?? FACTORY_TEMPLATE);
  STATE.weeks.push({
    id:         Date.now(),
    startDate:  startDate ?? _nextMonday(),
    note:       '',
    mode:       'standard',
    days,
    sessionLog: [],
    bodyData:   {},
    restDays:   [],
  });
  STATE.curIdx = STATE.weeks.length - 1;
}

function _nextMonday() {
  const d   = new Date();
  const dow = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
  return d.toISOString().split('T')[0];
}

// ─── Action type catalogue ────────────────────────────────────────────────────

export const A = Object.freeze({
  // Navigation
  WEEK_NAVIGATE:       'WEEK_NAVIGATE',       // { delta: ±1 }
  // Week CRUD
  WEEK_CREATE:         'WEEK_CREATE',         // { startDate, note, source?: 'prev'|'template' }
  WEEK_DELETE:         'WEEK_DELETE',         // { weekIdx?: number }  — omit to delete curIdx
  WEEK_COPY_PREV:      'WEEK_COPY_PREV',      // {}
  WEEK_SET_MODE:       'WEEK_SET_MODE',       // { mode: 'standard'|'deload' }
  WEEK_SET_NOTE:       'WEEK_SET_NOTE',       // { note }
  // Day
  DAY_ADD:             'DAY_ADD',             // {}
  DAY_ADD_CLONE:       'DAY_ADD_CLONE',       // { sourceDi: number|null } – null = empty
  DAY_REMOVE:          'DAY_REMOVE',          // { di }
  DAY_TOGGLE_COMPLETE: 'DAY_TOGGLE_COMPLETE', // { di }
  DAY_SET_FIELD:       'DAY_SET_FIELD',       // { di, field, value }
  // Exercise
  EX_ADD:              'EX_ADD',              // { di, name }
  EX_REMOVE:           'EX_REMOVE',           // { di, ei }
  EX_UPDATE:           'EX_UPDATE',           // { di, ei, field, value }
  EX_MOVE:             'EX_MOVE',             // { di, fromEi, toEi }
  EX_TOGGLE_CFG:       'EX_TOGGLE_CFG',       // { di, ei }
  EX_INC_WEIGHT:       'EX_INC_WEIGHT',       // { di, ei, amount } – erhöht alle Sätze sofort
  EX_SET_NEXT_WEEK_PLAN:'EX_SET_NEXT_WEEK_PLAN',// { di, ei, value }  – setzt nextWeekPlan + confirmed=true
  EX_TOGGLE_NEXT_WEEK_CONFIRMED: 'EX_TOGGLE_NEXT_WEEK_CONFIRMED', // { di, ei } – toggelt confirmed
  EX_SET_STEP:         'EX_SET_STEP',         // { di, ei, step }  – speichert Steigerungsrate
  EX_SET_TARGETS:      'EX_SET_TARGETS',      // { di, ei, targetReps }
  EX_SET_METRIC:       'EX_SET_METRIC',       // { di, ei, metric: 'reps'|'sec'|'m' }
  // Set
  SET_ADD:             'SET_ADD',             // { di, ei }
  SET_REMOVE:          'SET_REMOVE',          // { di, ei, si }
  SET_UPDATE:          'SET_UPDATE',          // { di, ei, si, field, value }
  SET_TOGGLE_DONE:     'SET_TOGGLE_DONE',     // { di, ei, si }
  SET_AUTOFILL_DOWN:   'SET_AUTOFILL_DOWN',   // { di, ei, si } — weight (all) + reps (next)
  SET_AUTOFILL_RPE:    'SET_AUTOFILL_RPE',    // { di, ei, si } — rpe → next set only
  CONFIRM_SET:         'CONFIRM_SET',          // { di, ei, si, reps } — quick-confirm next pending set
  SET_RPE:             'SET_RPE',             // { di, ei, si, rpe: number }
  EX_SET_SUBSTITUTE:   'EX_SET_SUBSTITUTE',   // { di, ei, substituteFor: string|null }
  // Session log
  SESSION_START:       'SESSION_START',       // { di, ts }  – persists day.sessionStartTs
  SESSION_RESET:       'SESSION_RESET',       // { di }  – clears sessionStartTs so timer can restart
  SESSION_STOP:        'SESSION_STOP',        // { duration, time }
  // Body data
  BODY_SET_FIELD:      'BODY_SET_FIELD',      // { field, value }
  // Template
  TPL_SAVE:            'TPL_SAVE',            // { template: DayTemplate[] }
  SAVE_WEEK_AS_TEMPLATE:'SAVE_WEEK_AS_TEMPLATE', // {}
  TPL_RESET_TO_FACTORY:'TPL_RESET_TO_FACTORY',// {}
  WEEK_RESET_TO_TPL:   'WEEK_RESET_TO_TPL',  // {}
  // Settings
  SETTING_TOGGLE:      'SETTING_TOGGLE',      // { key }
  SETTING_SET:         'SETTING_SET',         // { key, value }
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
});

// ─── Reducer ──────────────────────────────────────────────────────────────────

function _resetClonedDays(days) {
  days.forEach(day => {
    day.locked          = false;
    day.markedDone      = false;
    day.sessionNote     = '';
    day.sessionRating   = null;
    day.sessionStartTs  = null;
    day.sessionEndTs    = null;
    day.sleepHours      = null;
    day.energyLevel     = null;
    (day.exercises ?? []).forEach(ex => {
      if (ex._showCfg) ex._showCfg = false;
      if (ex.substituteFor) ex.name = ex.substituteFor;
      ex.substituteFor = null;
      (ex.sets ?? []).forEach(s => {
        s.status = 'pending';
        s.done   = false;
        s.reps   = null;
        s.rpe    = null;
      });
    });
  });
}

function _applyPlannedProgression(days) {
  days.forEach(day => {
    (day.exercises ?? []).forEach(ex => {
      const plan = ex.nextWeekPlan || 0;
      if (plan && ex.nextWeekPlanConfirmed) {
        if ((ex.progressionType ?? 'weight') === 'reps') {
          ex.targetReps = (ex.targetReps ?? 0) + plan;
        } else {
          (ex.sets ?? []).forEach(s => { s.weight = (parseFloat(s.weight) || 0) + plan; });
        }
      }
      ex.nextWeekPlan = 0;
      ex.nextWeekPlanConfirmed = false;
    });
  });
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
    }));
    if (_undoStack.length > _MAX_UNDO) _undoStack.shift();
  }

  switch (type) {

    // ── Navigation ───────────────────────────────────────────────────────────
    case A.WEEK_NAVIGATE: {
      const next = state.curIdx + p.delta;
      if (next >= 0 && next < state.weeks.length) state.curIdx = next;
      break;
    }

    // ── Week CRUD ────────────────────────────────────────────────────────────
    case A.WEEK_CREATE: {
      if (!p.startDate) break;
      if (state.weeks.find(w => w.startDate === p.startDate)) break; // dedupe
      const source = p.source === 'template' ? 'template' : 'prev';

      let days;
      if (source === 'prev' && state.weeks.length > 0) {
        const lastWeek = state.weeks[state.weeks.length - 1];
        days = clone(lastWeek.days);
        _applyPlannedProgression(days);
      } else {
        // Explicit restart: load global template as-is (no auto-progression mapping)
        days = clone(state.customTemplate ?? FACTORY_TEMPLATE);
        // Make sure templates never carry "planned" UI state forward
        days.forEach(d => (d.exercises ?? []).forEach(ex => { ex.nextWeekPlan = 0; ex.nextWeekPlanConfirmed = false; ex._showCfg = false; }));
      }

      _resetClonedDays(days);

      state.weeks.push({
        id: Date.now(), startDate: p.startDate, note: p.note ?? '',
        mode: 'standard', days, sessionLog: [], bodyData: {}, restDays: [],
      });
      state.weeks.sort((a, b) => a.startDate.localeCompare(b.startDate));
      state.curIdx = state.weeks.findIndex(w => w.startDate === p.startDate);
      _checkAndGrantBadges(state);
      break;
    }
    case A.WEEK_DELETE: {
      if (state.weeks.length <= 1) break;
      const _delIdx = (p.weekIdx !== undefined && p.weekIdx >= 0 && p.weekIdx < state.weeks.length)
        ? p.weekIdx
        : state.curIdx;
      state.weeks.splice(_delIdx, 1);
      if (state.curIdx >= state.weeks.length) state.curIdx = state.weeks.length - 1;
      break;
    }
    case A.WEEK_COPY_PREV: {
      if (state.curIdx === 0) break;
      const d = clone(state.weeks[state.curIdx - 1].days);
      d.forEach(day => {
        day.markedDone = false; day.locked = false;
        day.exercises.forEach(ex => {
          if (ex.substituteFor) ex.name = ex.substituteFor;
          ex.substituteFor = null;
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
      wk.mode = p.mode;
      break;
    }
    case A.WEEK_SET_NOTE: {
      const wk = _currentWeek(); if (!wk) break;
      wk.note = p.note;
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
        sessionStartTs: null,
        sessionEndTs:   null,
        sleepHours:     null,
        energyLevel:    null,
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
        sleepHours:     null,
        energyLevel:    null,
        exercises:  srcDay ? srcDay.exercises.map(ex => ({
          ...JSON.parse(JSON.stringify(ex)),
          sets: ex.sets.map(s => ({ ...s, status: 'pending', done: false })),
        })) : [],
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
    case A.DAY_TOGGLE_COMPLETE: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      const becomingDone = !day.markedDone;
      if (becomingDone) {
        for (const ex of day.exercises ?? []) {
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
    case A.DAY_SET_FIELD: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day[p.field] = p.value;
      break;
    }

    // ── Exercise ─────────────────────────────────────────────────────────────
    case A.EX_ADD: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day.exercises.push({
        name: p.name, note: '', pauseSec: 90, metric: 'reps',
        progressionType: 'weight',
        sets: [mkSet(), mkSet(), mkSet()],
      });
      break;
    }
    case A.EX_REMOVE: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day.exercises.splice(p.ei, 1);
      break;
    }
    case A.EX_UPDATE: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
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
    case A.EX_TOGGLE_CFG: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex._showCfg = !ex._showCfg;
      break;
    }
    case A.EX_INC_WEIGHT: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const step = p.amount ?? ex.weightStep ?? 2.5;
      
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
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.nextWeekPlan = p.value ?? 0;
      ex.nextWeekPlanConfirmed = true;
      break;
    }
    case A.EX_TOGGLE_NEXT_WEEK_CONFIRMED: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.nextWeekPlanConfirmed = !ex.nextWeekPlanConfirmed;
      break;
    }
    case A.EX_SET_TARGETS: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      if (p.targetReps !== undefined) ex.targetReps = Math.max(1, Math.min(100, +p.targetReps || 0));
      break;
    }
    case A.EX_SET_STEP: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      ex.weightStep = p.step;
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
      ex.substituteFor = p.substituteFor ?? null;
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
      if      (p.field === 'weight') v = parseFloat(v) || 0;
      else if (p.field === 'reps') {
        const n = parseFloat(v);
        v = Math.max(0, Number.isFinite(n) ? n : 0);
      }
      else if (p.field === 'rpe')  v = (v === '' || v === null) ? null : Math.min(10, Math.max(1, +v));
      else if (p.field === 'note') v = String(v ?? '').slice(0, 120);
      s[p.field] = v;
      // Straight sets: auto-propagate weight only to all following sets (1.3)
      if (ex.setType === 'straight' && p.field === 'weight') {
        for (let j = p.si + 1; j < ex.sets.length; j++) ex.sets[j].weight = v;
      }
      break;
    }
    case A.SET_TOGGLE_DONE: {
      const s = _currentWeek()?.days[p.di]?.exercises[p.ei]?.sets[p.si]; if (!s) break;
      const order = ['pending', 'success', 'fail'];
      let cur = s.status;
      if (cur !== 'pending' && cur !== 'success' && cur !== 'fail') {
        cur = s.done ? 'success' : 'pending';
      }
      const i = Math.max(0, order.indexOf(cur));
      const next = order[(i + 1) % 3];
      s.status = next;
      s.done   = next === 'success';

      // Update PRs when a set is newly marked success in a non-deload week (3.1)
      if (next === 'success' && _currentWeek()?.mode !== 'deload') {
        const ex     = _currentWeek()?.days[p.di]?.exercises[p.ei];
        const weight = parseFloat(s.weight) || 0;
        const reps   = parseFloat(s.reps)   || 0;
        if (ex && weight > 0 && reps > 0) {
          const volume       = weight * reps;
          const est1RM       = reps <= 10 ? weight * (1 + reps / 30) : 0;
          const name         = ex.name;
          if (!state.prs) state.prs = {};
          const prev         = state.prs[name] ?? { maxWeight: 0, maxVolume: 0, maxEstimated1RM: 0, maxRepsAtMaxWeight: 0, date: null };
          const newMaxW      = Math.max(prev.maxWeight,      weight);
          const newMaxV      = Math.max(prev.maxVolume,      volume);
          const newMaxE      = Math.max(prev.maxEstimated1RM, est1RM);
          const newMaxRMW    = weight > prev.maxWeight ? reps : (weight === prev.maxWeight ? Math.max(prev.maxRepsAtMaxWeight ?? 0, reps) : prev.maxRepsAtMaxWeight ?? 0);
          if (newMaxW > prev.maxWeight || newMaxV > prev.maxVolume || newMaxE > prev.maxEstimated1RM) {
            state.prs[name] = { maxWeight: newMaxW, maxVolume: newMaxV, maxEstimated1RM: newMaxE, maxRepsAtMaxWeight: newMaxRMW, date: new Date().toISOString().split('T')[0] };
          }
        }
      }
      break;
    }
    case A.SET_AUTOFILL_DOWN: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      const si   = p.si;
      const sets = ex.sets;
      if (si < 0 || si >= sets.length - 1) break;
      const src = sets[si]; if (!src) break;
      const w = parseFloat(src.weight) || 0;
      const r = parseFloat(src.reps)   || 0;
      // Weight → all following sets; Reps → next set only (1.3)
      for (let j = si + 1; j < sets.length; j++) {
        sets[j].weight = w;
      }
      if (sets[si + 1]) sets[si + 1].reps = r;
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
      const s = wk.days[p.di]?.exercises[p.ei]?.sets[p.si];
      if (!s || s.status === 'success') break;
      if (p.reps != null) s.reps = p.reps;
      s.status = 'success';
      s.done   = true;
      if (wk.mode !== 'deload') {
        const ex     = wk.days[p.di]?.exercises[p.ei];
        const weight = parseFloat(s.weight) || 0;
        const reps   = parseFloat(s.reps)   || 0;
        if (ex && weight > 0 && reps > 0) {
          const volume   = weight * reps;
          const est1RM   = reps <= 10 ? weight * (1 + reps / 30) : 0;
          const name     = ex.name;
          if (!state.prs) state.prs = {};
          const prev     = state.prs[name] ?? { maxWeight: 0, maxVolume: 0, maxEstimated1RM: 0, maxRepsAtMaxWeight: 0, date: null };
          const newMaxW  = Math.max(prev.maxWeight,       weight);
          const newMaxV  = Math.max(prev.maxVolume,       volume);
          const newMaxE  = Math.max(prev.maxEstimated1RM, est1RM);
          const newMaxRMW = weight > prev.maxWeight ? reps : (weight === prev.maxWeight ? Math.max(prev.maxRepsAtMaxWeight ?? 0, reps) : prev.maxRepsAtMaxWeight ?? 0);
          if (newMaxW > prev.maxWeight || newMaxV > prev.maxVolume || newMaxE > prev.maxEstimated1RM) {
            state.prs[name] = { maxWeight: newMaxW, maxVolume: newMaxV, maxEstimated1RM: newMaxE, maxRepsAtMaxWeight: newMaxRMW, date: new Date().toISOString().split('T')[0] };
          }
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
      wk.sessionLog.push({
        date:     new Date().toISOString(),
        duration: p.duration,
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
        (ex.sets ?? []).forEach(s => {
          s.status = 'pending';
          s.done = false;
        });
      }));
      days.forEach(d => { d.locked = false; d.markedDone = false; });
      wk.days = days;
      break;
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    case A.SETTING_TOGGLE: {
      if (p.key in state.settings) state.settings[p.key] = !state.settings[p.key];
      break;
    }
    case A.SETTING_SET: {
      state.settings[p.key] = p.value;
      break;
    }

    // ── Full import ───────────────────────────────────────────────────────────
    case A.STATE_IMPORT: {
      const imported = migrate(p.imported);
      if (!Array.isArray(imported?.weeks)) break;
      Object.assign(state, imported);
      if (!state.prs)                        state.prs       = {};
      if (!state.templates)                  state.templates = [];
      if (!Array.isArray(state.badges))      state.badges    = [];
      if (!state.weeks.length) _appendDefaultWeek();
      if (state.curIdx >= state.weeks.length) state.curIdx = state.weeks.length - 1;
      break;
    }

    // ── Save current week as template ─────────────────────────────────────────
    case A.SAVE_WEEK_AS_TEMPLATE: {
      const wk = _currentWeek();
      if (!wk) break;
      const tpl = clone(wk.days);
      // A template is a clean baseline: no "done", no locks, no pending plans.
      tpl.forEach(day => {
        day.locked = false;
        day.markedDone = false;
        (day.exercises ?? []).forEach(ex => {
          ex._showCfg = false;
          ex.nextWeekPlan = 0;
          ex.nextWeekPlanConfirmed = false;
          (ex.sets ?? []).forEach(s => {
            s.status = 'pending';
            s.done = false;
          });
        });
      });
      state.customTemplate = tpl;
      break;
    }

    // ── Undo ──────────────────────────────────────────────────────────────────
    case A.UNDO: {
      const prev = _undoStack.pop();
      if (!prev) return; // nothing to undo — skip persist+notify
      state.curIdx            = prev.curIdx;
      state.weeks             = prev.weeks;
      state.customTemplate    = prev.customTemplate;
      state.settings          = prev.settings;
      state.favoriteExercises = prev.favoriteExercises ?? [];
      break;
    }

    // ── Named templates (v9) ─────────────────────────────────────────────────
    case A.TEMPLATE_ADD: {
      if (!Array.isArray(state.templates)) state.templates = [];
      state.templates.push({
        id:   Date.now() + Math.random(),
        name: p.name ?? 'Neues Template',
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
      state.weeks.push({
        id: Date.now(), startDate: p.startDate, note: p.note ?? '',
        mode: 'standard', days: p.days, sessionLog: [], bodyData: {}, restDays: [],
      });
      state.weeks.sort((a, b) => a.startDate.localeCompare(b.startDate));
      state.curIdx = state.weeks.findIndex(w => w.startDate === p.startDate);
      _checkAndGrantBadges(state);
      break;
    }

    case A.ONBOARDING_DONE: {
      state.onboardingDone = true;
      if (state.weeks.length === 0) _appendDefaultWeek();
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
