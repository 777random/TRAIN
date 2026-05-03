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
export const SCHEMA_VERSION     = 6;

// ─── Factory helpers ──────────────────────────────────────────────────────────

/** Creates a fresh set entry. */
export function mkSet(weight = 0, reps = 10) {
  return { weight, reps, rpe: null, done: false };
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
    settings: {
      swipe: true,            // touch-swipe week navigation (default: ON per Step-2 spec)
      drag: true,             // drag-and-drop exercise reorder
    },
  };
}

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
    if (raw.settings.swipe === undefined) raw.settings.swipe = true;
    if (raw.settings.drag  === undefined) raw.settings.drag  = true;
    raw.meta = {
      schemaVersion: SCHEMA_VERSION,
      savedAt:   raw.meta?.savedAt   ?? null,
      createdAt: raw.meta?.createdAt ?? new Date().toISOString(),
    };
  }

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
      // Defensive bounds check
      if (!STATE.weeks.length)             _appendDefaultWeek();
      if (STATE.curIdx >= STATE.weeks.length) STATE.curIdx = STATE.weeks.length - 1;
      if (STATE.curIdx < 0)                   STATE.curIdx = 0;
      persistState(); // re-write so both keys are in sync
      return true;
    } catch (e) {
      console.warn('[TRAIN] loadState: parse error from source, trying next.', e);
    }
  }

  // Nothing recoverable – start fresh
  STATE = buildDefaultState();
  _appendDefaultWeek();
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
  WEEK_CREATE:         'WEEK_CREATE',         // { startDate, note }
  WEEK_DELETE:         'WEEK_DELETE',         // {}
  WEEK_COPY_PREV:      'WEEK_COPY_PREV',      // {}
  WEEK_SET_MODE:       'WEEK_SET_MODE',       // { mode: 'standard'|'deload' }
  WEEK_SET_NOTE:       'WEEK_SET_NOTE',       // { note }
  // Day
  DAY_TOGGLE_COMPLETE: 'DAY_TOGGLE_COMPLETE', // { di }
  DAY_SET_FIELD:       'DAY_SET_FIELD',       // { di, field, value }
  // Exercise
  EX_ADD:              'EX_ADD',              // { di, name }
  EX_REMOVE:           'EX_REMOVE',           // { di, ei }
  EX_UPDATE:           'EX_UPDATE',           // { di, ei, field, value }
  EX_MOVE:             'EX_MOVE',             // { di, fromEi, toEi }
  EX_TOGGLE_CFG:       'EX_TOGGLE_CFG',       // { di, ei }
  EX_INC_WEIGHT:       'EX_INC_WEIGHT',
  
  // Set
  SET_ADD:             'SET_ADD',             // { di, ei }
  SET_REMOVE:          'SET_REMOVE',          // { di, ei, si }
  SET_UPDATE:          'SET_UPDATE',          // { di, ei, si, field, value }
  SET_TOGGLE_DONE:     'SET_TOGGLE_DONE',     // { di, ei, si }
  // Session log
  SESSION_START:       'SESSION_START',       // {}  – writes start timestamp into STATE (not persisted as log entry until stop)
  SESSION_STOP:        'SESSION_STOP',        // { duration, time }
  // Body data
  BODY_SET_FIELD:      'BODY_SET_FIELD',      // { field, value }
  // Template
  TPL_SAVE:            'TPL_SAVE',            // { template: DayTemplate[] }
  TPL_RESET_TO_FACTORY:'TPL_RESET_TO_FACTORY',// {}
  WEEK_RESET_TO_TPL:   'WEEK_RESET_TO_TPL',  // {}
  // Settings
  SETTING_TOGGLE:      'SETTING_TOGGLE',      // { key }
  // Backup
  STATE_IMPORT:        'STATE_IMPORT',        // { imported: StateObject }
});

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reduce(state, action) {
  // We mutate STATE in place (simpler than immutable for a single-page app
  // without a VDOM), then call persistState(). The state reference stays
  // stable so any code holding `getState()` always sees the latest version.

  const { type, payload: p } = action;

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
      const days = clone(state.customTemplate ?? FACTORY_TEMPLATE);
      
      // --- SMART PROGRESSION: Gewichte der letzten Woche automatisch übernehmen ---
      if (state.weeks.length > 0) {
        const lastWeek = state.weeks[state.weeks.length - 1];
        days.forEach((day, di) => {
          day.exercises.forEach((ex, ei) => {
            const lastEx = lastWeek.days[di]?.exercises[ei];
            // Nur übernehmen, wenn es sich um dieselbe Übung handelt
            if (lastEx && lastEx.name === ex.name) { 
              ex.sets.forEach((s, si) => {
                const lastSet = lastEx.sets[si];
                if (lastSet) {
                  s.weight = lastSet.weight;
                  s.reps = lastSet.reps;
                }
              });
            }
          });
        });
      }
      
      days.forEach(d => d.exercises.forEach(ex => ex.sets.forEach(s => s.done = false)));
      state.weeks.push({
        id: Date.now(), startDate: p.startDate, note: p.note ?? '',
        mode: 'standard', days, sessionLog: [], bodyData: {},
      });
      state.weeks.sort((a, b) => a.startDate.localeCompare(b.startDate));
      state.curIdx = state.weeks.findIndex(w => w.startDate === p.startDate);
      break;
        }
      
    case A.WEEK_DELETE: {
      if (state.weeks.length <= 1) break;
      state.weeks.splice(state.curIdx, 1);
      if (state.curIdx >= state.weeks.length) state.curIdx = state.weeks.length - 1;
      break;
    }
    case A.WEEK_COPY_PREV: {
      if (state.curIdx === 0) break;
      const d = clone(state.weeks[state.curIdx - 1].days);
      d.forEach(day => {
        day.markedDone = false; day.locked = false;
        day.exercises.forEach(ex => ex.sets.forEach(s => s.done = false));
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
    case A.DAY_TOGGLE_COMPLETE: {
      const day = _currentWeek()?.days[p.di]; if (!day) break;
      day.markedDone = !day.markedDone;
      day.locked     = day.markedDone;
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
        name: p.name, note: '', pauseSec: 90,
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
      const s = ex.sets[p.si]; if (!s) break;
      
      let v = p.value;
      if (p.field === 'weight') v = parseFloat(v) || 0;
      else if (p.field === 'reps') v = Math.max(0, parseInt(v, 10) || 0);
      else if (p.field === 'rpe')  v = (v === '' || v === null) ? null : Math.min(10, Math.max(1, +v));
      
      s[p.field] = v;

      // --- AUTO-FILL LOGIK (Straight-Sets) ---
      if (p.si === 0 && p.field === 'weight') {
        for (let i = 1; i < ex.sets.length; i++) {
          ex.sets[i].weight = v;
        }
      }
      break;
    }
    case A.EX_INC_WEIGHT: {
      const ex = _currentWeek()?.days[p.di]?.exercises[p.ei]; if (!ex) break;
      // Erhöht das Gewicht in allen Sätzen um den übergebenen Wert absolut sicher
      ex.sets.forEach(s => {
        s.weight = (parseFloat(s.weight) || 0) + p.amount;
      });
      break;
    }
    case A.SET_TOGGLE_DONE: {
      const s = _currentWeek()?.days[p.di]?.exercises[p.ei]?.sets[p.si]; if (!s) break;
      s.done = !s.done;
      break;
    }

    // ── Session log ───────────────────────────────────────────────────────────
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
      break;
    }
    case A.TPL_RESET_TO_FACTORY: {
      state.customTemplate = clone(FACTORY_TEMPLATE);
      break;
    }
    case A.WEEK_RESET_TO_TPL: {
      const wk = _currentWeek(); if (!wk) break;
      const days = clone(state.customTemplate ?? FACTORY_TEMPLATE);
      days.forEach(d => d.exercises.forEach(ex => ex.sets.forEach(s => s.done = false)));
      wk.days = days;
      break;
    }

    // ── Settings ──────────────────────────────────────────────────────────────
    case A.SETTING_TOGGLE: {
      if (p.key in state.settings) state.settings[p.key] = !state.settings[p.key];
      break;
    }

    // ── Full import ───────────────────────────────────────────────────────────
    case A.STATE_IMPORT: {
      const imported = migrate(p.imported);
      if (!Array.isArray(imported?.weeks)) break;
      // Replace everything except wipe the current object, so existing
      // references (e.g. getState()) stay valid.
      Object.assign(state, imported);
      if (!state.weeks.length) _appendDefaultWeek();
      if (state.curIdx >= state.weeks.length) state.curIdx = state.weeks.length - 1;
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
