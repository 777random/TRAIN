/**
 * ui.js – Complete UI layer for TRAIN.
 *
 * Architecture:
 *   - mountApp(root)  bootstraps the entire DOM once.
 *   - subscribe() receives every state change and calls render().
 *   - render() does a targeted diff: only re-renders the region that changed.
 *   - All user interactions call dispatch() from state.js.
 *
 * BUG FIX (v2):
 *   _handleClick previously used a split two-switch pattern with a broken
 *   guard condition for the day-header accordion.  It is now a single,
 *   linear function that uses e.target.closest() for EVERY clickable target,
 *   so clicks on any child element (pill, chevron, subtitle div, etc.) are
 *   reliably caught.  The same fix is applied to export-option divs and
 *   settings rows that previously used role="button" without data-action.
 */

import {
  getState, dispatch, subscribe, A, canUndo, BADGE_THRESHOLDS, VACATION_PLANS,
  calcCurrentStreak, calcLongestStreakEver, weekTrainingStatus, getLatestWeek,
  clearAutoWeekPending,
} from './state.js';
import {
  exportJSON, exportJSONAuto, importJSON, exportCSV,
} from './backup.js';
import * as ic from './icons.js';
import { fireTrigger } from './triggerEngine.js';
import { getWeightRecommendation, getMetricRecommendation, roundToPlate, isReadyForAutoSelect } from './weightRecommendation.js';
import { renderProgressChart, renderBodyWeightChart, renderRelativeStrengthChart } from './progressChart.js';
import { buildWeekReview }        from './weekReview.js';
import { showWeekReviewModal, renderWeekReviewHtml } from './weekReviewModal.js';
import { computeWeeklyFocus, computeStructuralSignals, isInRecoveryWindow, buildDecisionalBalance } from './weeklyFocus.js';
import { findExactDuplicates, findSimilarCandidates } from './exerciseNameCleanup.js';
import { computeErkenntnisLines, getProgressCorridorCalibration } from './progressInsights.js';
import { buildCategoryMap, resolveCategory } from './movementMap.js';
import { computeQualityTrend, computeConsistencyTrend, computeVolumeTrend, computeBreadthProgress } from './overallPerformance.js';
import { weekSuccessCounts } from './setUtils.js';
import { getSortedWeeks, exWeightHistory, exMetricHistory, detectRecurringStep } from './insightEngine.js';

// ─── Module-level UI state (transient, never persisted) ──────────────────────

/** Index of the currently-open training day (null = all closed). */
let _activeDayIdx = null;

/** When true: all days shown as collapsed overview cards instead of one active panel. */
let _overviewMode = false;

/** Currently active top-level tab id. */
let _activeTab = 'workout';

/** Insights visible in body tab (2.2). */
let _showBodyInsights = false;

/** Relative-Stärke Chart-Modus: 'woche' (Standard) | 'alltime'. Ein Switch für die ganze Sektion. */
let _p4pMode = 'woche';

/** Show custom deload input even when current factor is a preset (1.4). */
let _showCustomDeload = false;

/** Key of currently open RPE popover: `${di}-${ei}-${si}` or null. */
let _rpePopoverKey = null;

/** Id of the currently open Kennzahlen-Erklärungstooltip (Fortschritt-Tab) or null. */
let _metricTooltipKey = null;

/** Key of exercise whose confirm button is flashing green: `${di}-${ei}` or null. */
let _confirmFlashKey = null;

/** Key of the exercise with the open substitute-name form: `${di}-${ei}` or null. */
let _subFormOpenKey = null;

/** Key of the exercise with the open archive-confirm panel: `${di}-${ei}` or null. */
let _archiveConfirmKey = null;

/** Pending auto-evaluation after blur (cancelled if user manually confirms/fails before setTimeout fires). */
let _pendingAutoEval = null;

/** Key of the exercise whose ⋮ context menu is open: `${di}-${ei}` or null. */
let _exMenuOpenKey = null;

/** Index of the day whose ⋮ context menu is open: String(di) or null. */
let _dayMenuOpenKey = null;

/** Whether the week-level ⋮ menu is open. */
let _weekMenuOpen = false;

/** Key of the exercise whose settings panel (cfgRow) is open: `${di}-${ei}` or null. */
let _cfgOpenKey = null;

/** Transient 3s-Bestätigung nach Plateau-Button-Klick: { action: 'implemented'|'ignored', exerciseName } oder null. */
let _plateauActionFeedback = null;

/** War .coach-why-collapse vor dem Plateau-Button-Klick aufgeklappt? Einmalig nach der Feedback-Karte wiederhergestellt. */
let _whyWasOpen = false;

/** Key of the exercise whose +kg picker popover is open: `${di}-${ei}` or null. */
let _kgPickerKey = null;

/** When true, the custom value input is visible inside the kg picker. */
let _kgPickerCustom = false;

/** Last-tap timestamp per exercise for +kg double-tap detection: `${di}-${ei}` → ms. */
let _kgPickerLastTap = {};

/** Key of the exercise whose +Wdh reps picker is open: `${di}-${ei}` or null. */
let _repsPickerKey = null;
/** Last-tap timestamp for +Wdh double-tap detection: `${di}-${ei}` → ms. */
let _repsPickerLastTap = {};

/** Set of `${di}-${ei}` keys whose advanced cfg section is expanded. */
const _cfgAdvOpen = new Set();

/** Tracks whether the first-day auto-open has already happened. */
let _autoOpened = false;

/** Week index staged for deletion via the confirm modal. */
let _deleteWeekIdx = null;

/** Day index that triggered the completion modal flow. */
let _completionModalDi = null;

/** Day index the exercise search modal is currently adding to. */
let _exSearchDi = null;
/** Exercise create/edit form: 'create' | 'edit'. */
let _exFormMode = 'create';
/** Day index to EX_ADD into after creating (create mode only). */
let _exFormTargetDi = null;
/** Original exercise name being edited (edit mode only), for CUSTOM_EX_UPDATE lookup + rename. */
let _exFormOriginalName = null;
/** Selected metric pill in the exercise create/edit form. */
let _exFormMetric = 'reps';
/** Selected category pill in the exercise create/edit form (null = keine). */
let _exFormCategory = null;

/** Key of the confirmed set showing RPE nudge: `${di}-${ei}-${si}` or null. */
let _rpeNudgeKey = null;
/** Auto-dismiss timer for the RPE nudge. */
let _rpeNudgeTimer = null;

/** Last rendered week index – used to detect week navigation. */
let _lastRenderedCurIdx = null;

/** IntersectionObserver instance for sticky-header detection. */
let _stickyObserver = null;

/** Toast hide timer. */
let _toastTimer = null;



/** Swipe tracking. */
let _swipeStartX = null;
let _swipeStartY = null;

/** Drag-and-drop tracking. */
let _dragSrc = null; // { di, ei }

// ─── DOM references (set once in mountApp) ───────────────────────────────────
let _root        = null;
let _toast       = null;
let _storageWarn = null;

// ─── Standard exercise list (3.2) ────────────────────────────────────────────
const _STANDARD_EXERCISES = [
  // Compound lower
  'Kniebeuge','Frontkniebeuge','Beinpresse','Rumänisches Kreuzheben','Kreuzheben','Sumo Kreuzheben',
  'Bulgarische Kniebeuge','Ausfallschritte','Beinbeuger','Beinstrecker','Wadenheben','Hip Thrust',
  // Compound upper push
  'Bankdrücken','Schrägbankdrücken','Schrägbankdrücken tief','Schulterdrücken','Kurzhanteldrücken',
  'Dips','Liegestütz','Militärpress','Push Press','Landmine Press',
  // Compound upper pull
  'Klimmzüge','Latziehen','Rudern','Kabelrudern','T-Bar Rudern','Pendlay Row',
  // Isolation push
  'Trizepsdrücken','Trizepsdips','Skull Crushers','Seitheben','Frontheben','Butterfly',
  'Flys Kabel','KH Flys',
  // Isolation pull
  'Bizepscurls','Hammercurls','Konzentrationscurls','Kabelbizeps','Face Pulls',
  'Reverse Flys','KH Rudern','KH Shrugs',
  // Core
  'Plank','Crunch','Situps','Beinheben','Russian Twists','Ab-Wheel','Cable Crunches',
  'Pallof Press','Hollow Hold',
  // Kettlebell & functional
  'KB Swings','KB Snatch','KB Clean','KB Press','KB Turkish Get-Up','KB Goblet Squat',
  'KB Windmill','KB Carry',
  // Plyometric / conditioning
  'Box Jumps','Broad Jumps','Burpees','Kettlebell Swings','Battle Ropes',
  // Machine
  'Chest Press Maschine','Shoulder Press Maschine','Rudern Maschine','Lat Maschine',
  'Hack Squat','Smith Maschine Kniebeuge',
].sort();

const _ONBOARDING_TEMPLATES = [
  {
    icon: '💪', title: 'Krafttraining Einsteiger',
    meta: 'Ganzkörper · 3×/Woche · ~45 Min', sub: 'Langhantel & Maschinen',
    weekTitle: 'Ganzkörper — Woche 1',
    days: [
      {
        title: 'Tag A — Ganzkörper A',
        warmup:   '5 Min Gelenkmobilisation + leichte Aufwärmsätze (50% Gewicht)',
        cooldown: '5 Min statisches Dehnen: Brust, Rücken, Oberschenkel',
        exercises: [
          { name: 'Kniebeuge',    n: 3, tr: 8,  ps: 90,  m: 'reps'    },
          { name: 'Bankdrücken',  n: 3, tr: 8,  ps: 90,  m: 'reps'    },
          { name: 'Latziehen',    n: 3, tr: 8,  ps: 90,  m: 'reps'    },
          { name: 'Militärpress', n: 3, tr: 10, ps: 60,  m: 'reps'    },
          { name: 'Plank',        n: 3, tr: 30, ps: 60,  m: 'sec' },
        ],
      },
      {
        title: 'Tag B — Ganzkörper B',
        warmup:   '5 Min Gelenkmobilisation + leichte Aufwärmsätze',
        cooldown: '5 Min statisches Dehnen',
        exercises: [
          { name: 'Kreuzheben',        n: 3, tr: 6,  ps: 120, m: 'reps' },
          { name: 'Schrägbankdrücken', n: 3, tr: 10, ps: 90,  m: 'reps' },
          { name: 'Rudern',            n: 3, tr: 10, ps: 90,  m: 'reps' },
          { name: 'Beinpresse',        n: 3, tr: 12, ps: 90,  m: 'reps' },
          { name: 'Bizepscurls',       n: 2, tr: 12, ps: 60,  m: 'reps' },
        ],
      },
    ],
  },
  {
    icon: '🏋', title: 'Krafttraining Fortgeschritten',
    meta: 'Push/Pull/Legs · 3–6×/Woche', sub: 'Mehr Volumen & Intensität',
    weekTitle: 'Push Pull Legs — Woche 1',
    days: [
      {
        title: 'Tag Push — Brust, Schultern, Trizeps',
        warmup:   '5 Min Schulter-Mobilisation + Aufwärmsätze Bankdrücken',
        cooldown: '5 Min Brust + Schultern dehnen',
        exercises: [
          { name: 'Bankdrücken',       n: 4, tr: 6,  ps: 120, m: 'reps' },
          { name: 'Militärpress',      n: 3, tr: 8,  ps: 90,  m: 'reps' },
          { name: 'Schrägbankdrücken', n: 3, tr: 10, ps: 90,  m: 'reps' },
          { name: 'Seitheben',         n: 3, tr: 15, ps: 60,  m: 'reps' },
          { name: 'Trizepsdrücken',    n: 3, tr: 12, ps: 60,  m: 'reps' },
        ],
      },
      {
        title: 'Tag Pull — Rücken, Bizeps',
        warmup:   '5 Min Schulterblatt-Aktivierung + Aufwärmsätze Klimmzüge',
        cooldown: '5 Min Rücken + Bizeps dehnen',
        exercises: [
          { name: 'Klimmzüge',   n: 4, tr: 6,  ps: 120, m: 'reps' },
          { name: 'Rudern',      n: 4, tr: 8,  ps: 90,  m: 'reps' },
          { name: 'Face Pulls',  n: 3, tr: 15, ps: 60,  m: 'reps' },
          { name: 'Hammercurls', n: 3, tr: 12, ps: 60,  m: 'reps' },
          { name: 'Bizepscurls', n: 2, tr: 12, ps: 60,  m: 'reps' },
        ],
      },
      {
        title: 'Tag Legs — Beine, Core',
        warmup:   '5 Min Hüft-Mobilisation + Aufwärmsätze Kniebeuge',
        cooldown: '5 Min Beine + Hüfte dehnen',
        exercises: [
          { name: 'Kniebeuge',              n: 4, tr: 6,  ps: 120, m: 'reps' },
          { name: 'Rumänisches Kreuzheben', n: 3, tr: 10, ps: 90,  m: 'reps' },
          { name: 'Beinpresse',             n: 3, tr: 12, ps: 90,  m: 'reps' },
          { name: 'Beinbeuger',             n: 3, tr: 12, ps: 60,  m: 'reps' },
          { name: 'Wadenheben',             n: 3, tr: 15, ps: 60,  m: 'reps' },
          { name: 'Ab-Wheel',               n: 3, tr: 10, ps: 60,  m: 'reps' },
        ],
      },
    ],
  },
  {
    icon: '🤸', title: 'Körpergewicht',
    meta: 'Ganzkörper · 3×/Woche · ~45 Min', sub: 'Kein Equipment nötig',
    weekTitle: 'Körpergewicht — Woche 1',
    days: [
      {
        title: 'Tag A — Push + Legs',
        warmup:   '5 Min Gelenkmobilisation: Schultern, Hüfte, Knöchel',
        cooldown: '5 Min statisches Dehnen: Brust, Hüfte',
        exercises: [
          { name: 'Liegestütz',      n: 3, tr: 10, ps: 60, m: 'reps'    },
          { name: 'Kniebeuge',       n: 3, tr: 15, ps: 60, m: 'reps'    },
          { name: 'Dips',            n: 3, tr: 10, ps: 60, m: 'reps'    },
          { name: 'Ausfallschritte', n: 3, tr: 12, ps: 60, m: 'reps'    },
          { name: 'Plank',           n: 3, tr: 30, ps: 45, m: 'sec' },
        ],
      },
      {
        title: 'Tag B — Pull + Core',
        warmup:   '5 Min Schulterblatt-Mobilisation',
        cooldown: '5 Min Rücken + Hüftbeuger dehnen',
        exercises: [
          { name: 'Klimmzüge',      n: 3, tr: 6,  ps: 90, m: 'reps'    },
          { name: 'Beinheben',      n: 3, tr: 12, ps: 60, m: 'reps'    },
          { name: 'Hip Thrust',     n: 3, tr: 15, ps: 60, m: 'reps'    },
          { name: 'Russian Twists', n: 3, tr: 20, ps: 45, m: 'reps'    },
          { name: 'Hollow Hold',    n: 3, tr: 20, ps: 45, m: 'sec' },
        ],
      },
    ],
  },
];


// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Escape HTML special chars for safe innerHTML injection. */
function h(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Returns YYYY-MM-DD for the *next* Monday from today. */
function nextMonday() {
  const d   = new Date();
  const dow = d.getDay(); // 0 = Sun
  d.setDate(d.getDate() + (dow === 0 ? 1 : 8 - dow));
  return d.toISOString().split('T')[0];
}

/** Returns "KW 18 · 2025" label for a YYYY-MM-DD date string. */
function wkLabel(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  const kw  = Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
  return `KW ${String(kw).padStart(2, '0')} · ${d.getFullYear()}`;
}

/** Returns "28. Apr – 04. Mai" */
function wkRange(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = x => x.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  return `${fmt(d)} – ${fmt(end)}`;
}

/** ISO-8601 week number for a Date object. */
function _isoWeek(d) {
  if (!d || isNaN(d.getTime())) return 1;
  const t = new Date(d.getTime());
  t.setHours(12, 0, 0, 0);
  t.setDate(t.getDate() + 4 - (t.getDay() || 7));
  const yearStart = new Date(t.getFullYear(), 0, 1);
  return Math.ceil((((t - yearStart) / 86400000) + 1) / 7);
}

/** Returns "10.–16. Juni 2026" (full month name, year) for header display. */
function _wkRangeFull(sd) {
  try {
    const start = new Date(sd + 'T12:00:00');
    const end   = new Date(start);
    end.setDate(start.getDate() + 6);
    const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
    const startStr  = sameMonth
      ? `${start.getDate()}.`
      : start.toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    const endStr = end.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' });
    return `${startStr}–${endStr}`;
  } catch (_) { return wkRange(sd); }
}

/**
 * Relative Wochen-Bezeichnung (Sprint C1, train-v108) — Abstand in Wochen
 * zwischen der angezeigten Woche und der chronologisch LETZTEN Woche
 * (getLatestWeek(), nicht state.curIdx selbst, da curIdx genau die Woche
 * ist deren Label hier berechnet wird — der Vergleichsanker muss ein vom
 * Navigieren unabhängiger Fixpunkt sein). Liefert null wenn keine Wochen
 * existieren.
 */
function _relativeWeekLabel(wk, weeks) {
  const latest = getLatestWeek(weeks);
  if (!latest) return null;
  const diffMs    = new Date(wk.startDate + 'T12:00:00').getTime() - new Date(latest.startDate + 'T12:00:00').getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  if (diffWeeks === 0)  return 'Aktuelle Woche';
  if (diffWeeks === -1) return 'Letzte Woche';
  if (diffWeeks === -2) return 'Vorletzte Woche';
  if (diffWeeks < 0)    return `Vor ${-diffWeeks} Wochen`;
  return `In ${diffWeeks} Wochen`;
}

/**
 * Calculates plates per side for an Olympic bar (20 kg default).
 * Returns a compact string like "10+5+2.5" or null if not achievable.
 */
function calcPlates(totalKg, barKg = 20) {
  const perSide = Math.round((totalKg - barKg) * 100) / 100 / 2;
  if (perSide <= 0) return null;
  const available = [25, 20, 15, 10, 5, 2.5, 1.25];
  const used = [];
  let rem = perSide;
  for (const p of available) {
    while (rem >= p - 0.001) {
      used.push(p);
      rem = Math.round((rem - p) * 100) / 100;
    }
  }
  if (rem > 0.01) return null;
  // Compact: group duplicates → "2×10+2.5"
  const groups = [];
  let i = 0;
  while (i < used.length) {
    let count = 1;
    while (i + count < used.length && used[i + count] === used[i]) count++;
    groups.push(count > 1 ? `${count}×${used[i]}` : `${used[i]}`);
    i += count;
  }
  return groups.join('+');
}

/** Show a toast. type: 'ok' | 'info' | 'warn'. Optional durationMs overrides default 2600ms. */
function showToast(msg, type = 'info', durationMs = 2600) {
  if (!_toast) return;
  _toast.textContent = msg;
  _toast.className   = `toast is-visible toast--${type}`;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    _toast.classList.remove('is-visible');
  }, durationMs);
}


/**
 * Feuert ein anonymes GoatCounter-Custom-Event (nur Zählung, keine Nutzdaten
 * — reine "wie oft passiert X" Metrik, siehe Datenschutz-Hinweis in den
 * Einstellungen). window.goatcounter existiert nur wenn das Script in
 * index.html geladen wurde (kein Fehler falls Tracking blockiert/offline).
 */
function _gcEvent(name) {
  window.goatcounter?.count?.({ path: name, event: true });
}

/** Show a top-centered tip banner; auto-closes after 4 s. */
function _showTooltip(text) {
  document.getElementById('_train-micro-tooltip')?.remove();
  const tip = document.createElement('div');
  tip.id = '_train-micro-tooltip';
  tip.className = 'tip-banner';
  tip.textContent = text;
  document.body.appendChild(tip);
  const close = () => tip.remove();
  setTimeout(() => document.addEventListener('click', close, { capture: true, once: true }), 0);
}

/** Show tip once — skips if already seen, records it, then shows banner. */
function _maybeShowTip(tipId, text) {
  const st = getState();
  if ((st.seenTips ?? []).includes(tipId)) return;
  dispatch(A.MARK_TIP_SEEN, { tipId });
  _showTooltip(text);
}

/** Open a modal by id. */
function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('is-open');
  const first = el.querySelector('button, input, select, textarea, [tabindex]');
  first?.focus();
  el.addEventListener('click', _modalBackdropClose, { once: true });
}
function _modalBackdropClose(e) {
  if (e.target === e.currentTarget) closeModal(e.currentTarget.id);
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('is-open');
}

// ─── Sticky observer ─────────────────────────────────────────────────────────
function _initStickyObserver() {
  if (_stickyObserver) _stickyObserver.disconnect();
  _stickyObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const target = entry.target.nextElementSibling;
        if (target) target.classList.toggle('is-stuck', !entry.isIntersecting);
      });
    },
    { threshold: 0, rootMargin: `-52px 0px 0px 0px` }
  );
  document.querySelectorAll('.sticky-sentinel').forEach(el =>
    _stickyObserver.observe(el)
  );
}

// ─── Swipe navigation ────────────────────────────────────────────────────────
function _initSwipe(container) {
  container.addEventListener('touchstart', e => {
    if (!getState().settings.swipe) return;
    const x = e.touches[0].clientX;
    // Ignore swipes starting within 20px of either edge (iOS back/forward gesture zone)
    if (x < 20 || x > window.innerWidth - 20) return;
    _swipeStartX = x;
    _swipeStartY = e.touches[0].clientY;
  }, { passive: true });

  container.addEventListener('touchend', e => {
    if (!getState().settings.swipe || _swipeStartX === null) return;
    const dx = e.changedTouches[0].clientX - _swipeStartX;
    const dy = e.changedTouches[0].clientY - _swipeStartY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      dispatch(A.WEEK_NAVIGATE, { delta: dx < 0 ? 1 : -1 });
    }
    _swipeStartX = null;
    _swipeStartY = null;
  }, { passive: true });

  // Cancel tracking if browser cancels the touch (e.g. system gesture)
  container.addEventListener('touchcancel', () => {
    _swipeStartX = null;
    _swipeStartY = null;
  }, { passive: true });
}

// ─── Drag-and-drop ───────────────────────────────────────────────────────────
function _bindDrag(container) {
  container.addEventListener('dragstart', e => {
    const handle = e.target.closest('[data-drag-handle]');
    if (!handle) return;
    const wrap = handle.closest('[data-di][data-ei]');
    if (!wrap) return;
    _dragSrc = { di: +wrap.dataset.di, ei: +wrap.dataset.ei };
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => wrap.classList.add('dragging'));
  });

  container.addEventListener('dragover', e => {
    e.preventDefault();
    const wrap = e.target.closest('[data-di][data-ei]');
    if (!wrap || !_dragSrc) return;
    container.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    if (+wrap.dataset.di === _dragSrc.di) wrap.classList.add('drag-over');
  });

  container.addEventListener('dragleave', e => {
    e.target.closest('[data-di][data-ei]')?.classList.remove('drag-over');
  });

  container.addEventListener('drop', e => {
    e.preventDefault();
    const wrap = e.target.closest('[data-di][data-ei]');
    container.querySelectorAll('.drag-over, .dragging').forEach(el => {
      el.classList.remove('drag-over', 'dragging');
    });
    if (!wrap || !_dragSrc) return;
    const toEi = +wrap.dataset.ei;
    const di   = _dragSrc.di;
    if (+wrap.dataset.di === di && toEi !== _dragSrc.ei) {
      dispatch(A.EX_MOVE, { di, fromEi: _dragSrc.ei, toEi });
    }
    _dragSrc = null;
  });

  container.addEventListener('dragend', () => {
    container.querySelectorAll('.drag-over, .dragging').forEach(el => {
      el.classList.remove('drag-over', 'dragging');
    });
    _dragSrc = null;
  });
}

// ─── Default day index helper ─────────────────────────────────────────────────
function _getDefaultDayIndex(wk) {
  const first = wk.days.findIndex(d => !d.markedDone);
  return first >= 0 ? first : wk.days.length - 1;
}

// ════════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function renderWeekHeader(state) {
  const wk      = state.weeks[state.curIdx];
  const isDl    = wk?.mode === 'deload';
  const isVac   = wk?.mode === 'vacation';
  const isFirst = state.curIdx === 0;
  const isLast  = state.curIdx === state.weeks.length - 1;

  const labelEl = document.getElementById('wk-label');
  const rangeEl = document.getElementById('wk-range');
  const prevBtn = document.getElementById('btn-prev-wk');
  const nextBtn = document.getElementById('btn-next-wk');

  if (labelEl) {
    if (wk) {
      const kw       = _isoWeek(new Date(wk.startDate + 'T12:00:00'));
      const range    = _wkRangeFull(wk.startDate);
      const vacBadge = isVac ? ' <span class="wk-badge-vacation">🏖 Urlaub</span>' : '';
      // Bei manuell umbenannter Woche hat der Nutzer-Name Vorrang vor der
      // relativen Bezeichnung — KW+Datum bleibt in beiden Fällen sekundär.
      const primary = wk.label ? h(wk.label) : (_relativeWeekLabel(wk, state.weeks) ?? range);
      labelEl.innerHTML = `${primary}${vacBadge}`;
      if (rangeEl) rangeEl.textContent = `KW ${String(kw).padStart(2,'0')} · ${range}`;
    } else {
      labelEl.textContent = '–';
      if (rangeEl) rangeEl.textContent = '';
    }
    labelEl.className = 'week-nav__label' + (isDl ? ' week-nav__label--deload' : '') + (isVac ? ' week-nav__label--vacation' : '');
  }
  if (prevBtn)  prevBtn.disabled    = isFirst;
  if (nextBtn)  nextBtn.disabled    = isLast;

  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.disabled = !canUndo();
}

// ─── Day list ────────────────────────────────────────────────────────────────
function renderDayList(state) {
  const container = document.getElementById('days-container');
  if (!container) return;
  const wk = state.weeks[state.curIdx];
  if (!wk) {
    container.innerHTML = '';
    _showOnboarding();
    return;
  }

  const isDl  = wk.mode === 'deload';
  const isVac = wk.mode === 'vacation';

  // Week navigation: reset to first non-completed day
  if (_lastRenderedCurIdx !== null && _lastRenderedCurIdx !== state.curIdx && wk.days.length > 0) {
    _activeDayIdx = _getDefaultDayIndex(wk);
    _overviewMode = false;
    _cfgAdvOpen.clear();
    _subFormOpenKey = null;
    _scrollToFirstPending(_activeDayIdx);
  }
  _lastRenderedCurIdx = state.curIdx;

  // Initial load: auto-open first non-completed day
  if (!_autoOpened && wk.days.length > 0) {
    _autoOpened = true;
    _activeDayIdx = _getDefaultDayIndex(wk);
    _scrollToFirstPending(_activeDayIdx);
  }

  // ── Progress bar for active day ───────────────────────────────────────────
  let totalSets = 0, doneSets = 0;
  if (!_overviewMode && _activeDayIdx !== null && wk.days[_activeDayIdx]) {
    const ad = wk.days[_activeDayIdx];
    const activeExes = ad.exercises.filter(ex => !ex.archived);
    totalSets = activeExes.reduce((s, ex) => s + ex.sets.length, 0);
    doneSets  = activeExes.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
  }
  const pct = totalSets > 0 ? Math.round(doneSets / totalSets * 100) : 0;
  const progressHtml = (!_overviewMode && _activeDayIdx !== null) ? `
  <div class="training-progress" aria-label="${doneSets} von ${totalSets} Sätzen erledigt">
    <div class="training-progress__bar" style="width:${pct}%"></div>
    <span class="training-progress__label">${pct}% · ${doneSets}/${totalSets} Sätze</span>
  </div>` : '';

  // ── Unified sticky bar: toolbar row + day pills + progress bar ───────────
  const tabsHtml = `<div class="day-tab-bar" role="tablist" aria-label="Trainingstage">
  <div class="day-tab-bar__toolbar" role="toolbar" aria-label="Wochenaktionen">
    <span class="toolbar__spacer"></span>
    <span id="toolbar-session-timer" class="toolbar-timer" role="timer" aria-label="Session-Timer">00:00</span>
    <button class="toolbar__btn toolbar__btn--reset" id="btn-reset-timer" data-action="reset-timer" aria-label="Timer zurücksetzen" title="Timer zurücksetzen">↺</button>
    <button class="toolbar__btn" id="btn-undo" data-action="undo"
      aria-label="Rückgängig machen"${!canUndo() ? ' disabled' : ''}>${ic.undo()}</button>
    <div class="week-menu-wrap">
      <button class="toolbar__btn" data-action="toggle-week-menu"
        aria-label="Wochen-Menü öffnen" aria-expanded="${_weekMenuOpen}"
      >⋮</button>
      ${_weekMenuOpen ? (() => {
        const _ad = (!_overviewMode && _activeDayIdx !== null) ? wk.days[_activeDayIdx] : null;
        return `
      <div class="ex-menu-dropdown" role="menu">
        <div class="ex-menu-section-header" aria-hidden="true">Diese Woche</div>
        <button class="ex-menu-item${isDl ? ' ex-menu-item--active' : ''}" role="menuitem"
          data-action="${isDl ? 'mode-std' : 'mode-dl'}">
          ⚡ Deload-Woche${isDl ? ' ✓' : ''}
        </button>
        <button class="ex-menu-item${isVac ? ' ex-menu-item--vacation' : ''}" role="menuitem"
          data-action="${isVac ? 'mode-std' : 'mode-vac'}">
          🏖 Urlaubswoche${isVac ? ' ✓' : ''}
        </button>
        <button class="ex-menu-item" role="menuitem" data-action="rename-week">
          ✏️ Woche umbenennen
        </button>
        <button class="ex-menu-item" role="menuitem" data-action="copy-prev">
          📋 Vorwoche übernehmen
        </button>
        <button class="ex-menu-item" role="menuitem" data-action="week-menu-add-day">
          ${ic.plus()} Trainingstag hinzufügen
        </button>
        <button class="ex-menu-item ex-menu-item--danger" role="menuitem"
          data-action="open-delete-week">
          ${ic.trash()} Woche löschen
        </button>
        ${_ad ? `
        <div class="ex-menu-section-header" aria-hidden="true">Tag ${h(_ad.title)}</div>
        <button class="ex-menu-item${_ad.isVacation ? ' ex-menu-item--vacation' : ''}" role="menuitem"
          data-action="toggle-day-vacation" data-di="${_activeDayIdx}">
          🏖 Urlaubstag${_ad.isVacation ? ' ✓' : ''}
        </button>
        <button class="ex-menu-item" role="menuitem" data-action="day-rename" data-di="${_activeDayIdx}">
          ✏️ Tag umbenennen
        </button>
        <button class="ex-menu-item" role="menuitem" data-action="day-duplicate" data-di="${_activeDayIdx}">
          📋 Tag duplizieren
        </button>
        <button class="ex-menu-item" role="menuitem" data-action="day-reset-sets" data-di="${_activeDayIdx}">
          🔄 Sätze zurücksetzen
        </button>
        <button class="ex-menu-item ex-menu-item--danger" role="menuitem"
          data-action="remove-day" data-di="${_activeDayIdx}"${wk.days.length <= 1 ? ' disabled' : ''}>
          ${ic.trash()} Tag löschen
        </button>` : ''}
      </div>`;
      })() : ''}
    </div>
    <button class="toolbar__btn toolbar__btn--accent" data-action="open-new-week"
      aria-label="Neue Trainingswoche erstellen">${ic.plus()}</button>
  </div>
  <div class="day-tab-pills-row">
    <div class="day-tab-pills-scroll">
      <div class="day-tab-pills">
        <button
          class="day-overview-toggle${_overviewMode ? ' is-active' : ''}"
          data-action="toggle-overview"
          aria-label="${_overviewMode ? 'Einzelansicht' : 'Übersicht'}"
          aria-pressed="${_overviewMode}"
          title="${_overviewMode ? 'Einzelansicht' : 'Alle Tage anzeigen'}"
        >${ic.columns()}</button>
        ${wk.days.map((day, di) => {
          const done   = !!day.markedDone;
          const locked = !!day.locked;
          const isAct  = !_overviewMode && _activeDayIdx === di;
          const activeEx = day.exercises.filter(ex => !ex.archived);
          const total  = activeEx.reduce((s, ex) => s + ex.sets.length, 0);
          const done_s = activeEx.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
          return `<button
            class="day-tab${isAct ? ' is-active' : ''}${done ? ' day-tab--done' : ''}${isDl ? ' day-tab--deload' : ''}${day.isVacation ? ' day-tab--vacation' : ''}"
            data-day-hdr="${di}"
            role="tab" aria-selected="${isAct}" aria-controls="day-panel-${di}"
            id="day-tab-${di}"
            title="${h(day.title)}"
            aria-label="${h(day.title)} – ${done_s}/${total} Sätze"
          >${h(day.title)}</button>`;
        }).join('')}
      </div>
    </div>
    ${_renderStreakBadge(state)}
  </div>
  ${progressHtml}
</div>`;

  // ── Content: overview grid or single active panel ─────────────────────────
  let contentHtml = '';
  if (wk.days.length === 0) {
    // Defensiver Empty-State — greift unabhängig davon wie eine Woche ohne
    // Tage entstanden ist (Onboarding "Ohne Vorlage", manuelles Löschen
    // aller Tage, etc.). Ohne mindestens einen Tag kann _activeDayIdx nie
    // gesetzt werden, sonst bliebe der Container sonst komplett leer.
    contentHtml = `<div class="empty-state">
      <p class="empty-state__hint">Diese Woche hat noch keine Trainingstage.</p>
      <button type="button" class="btn btn--accent" data-action="add-day">${ic.plus()} Tag hinzufügen</button>
    </div>`;
  } else if (_overviewMode) {
    contentHtml = `<div class="day-overview-grid">
      ${wk.days.map((day, di) => {
        const done   = !!day.markedDone;
        const activeEx2 = day.exercises.filter(ex => !ex.archived);
        const total  = activeEx2.reduce((s, ex) => s + ex.sets.length, 0);
        const done_s = activeEx2.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
        const vol    = activeEx2.reduce((s, ex) => s + ex.sets.filter(st => st.status === 'success').reduce((ss, st) => ss + (st.weight ?? 0) * (st.reps ?? 0), 0), 0);
        const dpct   = total > 0 ? Math.round(done_s / total * 100) : 0;
        return `<div class="day-overview-card${done ? ' day-overview-card--done' : ''}${isDl ? ' day-overview-card--deload' : ''}"
          data-action="overview-open-day" data-di="${di}" role="button" tabindex="0"
          aria-label="${h(day.title)} öffnen">
          <div class="day-overview-card__title">${h(day.title)}${isDl ? '<span class="deload-badge">D</span>' : ''}</div>
          <div class="day-overview-card__sub">${h(day.subtitle ?? '')}</div>
          <div class="day-overview-card__stats">
            <span>${done_s}/${total} Sätze</span>
            ${vol > 0 ? `<span>${vol >= 1000 ? (vol/1000).toFixed(1)+'t' : vol+'kg'}</span>` : ''}
          </div>
          <div class="day-overview-card__bar"><div style="width:${dpct}%;height:3px;background:var(--c-accent);border-radius:2px"></div></div>
          ${done ? `<div class="day-overview-card__done-badge">✓</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;
  } else if (_activeDayIdx !== null && wk.days[_activeDayIdx]) {
    const di  = _activeDayIdx;
    const day = wk.days[di];
    contentHtml = `<div
      class="day-panel${day.markedDone ? ' day-card--done' : ''}${isDl ? ' day-card--deload' : ''}"
      id="day-panel-${di}" data-day-body="${di}"
      role="tabpanel" aria-labelledby="day-tab-${di}"
    >
      <div class="day-card__body-inner">${renderDayBody(wk, di, state)}</div>
    </div>`;
  }

  container.innerHTML = tabsHtml + contentHtml;

  requestAnimationFrame(() => {
    const tabsRow = container.querySelector('.day-tab-bar');
    if (tabsRow) {
      document.documentElement.style.setProperty('--tabs-h', `${tabsRow.offsetHeight}px`);
    }
    // Android Chrome: prevent sticky parent from capturing horizontal touch events
    container.querySelector('.day-tab-pills-scroll')
      ?.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
  });

  _initStickyObserver();
  if (!_overviewMode && _activeDayIdx !== null) _bindDrag(container);
}

function renderDayCard(wk, di, state) {
  const day    = wk.days[di];
  const isDl   = wk.mode === 'deload';
  const locked = !!day.locked;
  const done   = !!day.markedDone;

  const totalSets = day.exercises.reduce((s, ex) => s + ex.sets.length, 0);
  const doneSets  = day.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);

  const dotClass = done
    ? 'day-card__dot day-card__dot--done'
    : locked
      ? 'day-card__dot day-card__dot--locked'
      : 'day-card__dot';

  const cardClass = [
    'day-card',
    done ? 'day-card--done'   : '',
    isDl ? 'day-card--deload' : '',
  ].filter(Boolean).join(' ');

  return `
<article class="${cardClass}" data-di="${di}">
  <div class="sticky-sentinel" aria-hidden="true" style="height:1px;pointer-events:none;"></div>

  <button
    class="day-card__header"
    data-day-hdr="${di}"
    aria-expanded="false"
    aria-controls="day-body-${di}"
    id="day-hdr-${di}"
  >
    <div class="day-card__header-left">
      <div class="${dotClass}" aria-hidden="true"></div>
      <div class="day-card__title-wrap">
        <div class="day-card__title day-editable-wrap">
          <span class="day-editable" data-action="edit-day-field"
            data-di="${di}" data-field="title"
            aria-label="${h(day.title)} bearbeiten"
          >${h(day.title)}</span>
          ${isDl ? '<span class="deload-badge">Deload</span>' : ''}
        </div>
        <div class="day-card__subtitle day-editable-wrap">
          <span class="day-editable day-editable--sub" data-action="edit-day-field"
            data-di="${di}" data-field="subtitle"
            aria-label="${h(day.subtitle || 'Schwerpunkt')} bearbeiten"
          >${h(day.subtitle) || '<span class="day-subtitle-placeholder">Schwerpunkt …</span>'}</span>
        </div>
      </div>
    </div>
    <div class="day-card__header-right">
      <span class="day-card__pill" data-set-pill="${di}"
        aria-label="${doneSets} von ${totalSets} Sätzen erledigt">
        ${doneSets}/${totalSets}
      </span>
      <span class="day-card__chevron" aria-hidden="true">${ic.chevronDown()}</span>
    </div>
  </button>

  <div class="day-menu-wrap">
    <button class="ex-menu-btn"
      data-action="toggle-day-menu" data-di="${di}"
      aria-label="Tag-Menü öffnen"
      aria-expanded="${_dayMenuOpenKey === String(di)}"
    >⋮</button>
    ${_dayMenuOpenKey === String(di) ? `
    <div class="ex-menu-dropdown" role="menu">
      ${(day.sessionNote ?? '').trim() ? `<button class="ex-menu-item" role="menuitem" data-action="day-edit-note" data-di="${di}">📝 Notiz bearbeiten</button>` : ''}
      <button class="ex-menu-item" role="menuitem" data-action="day-rename" data-di="${di}">✏️ Tag umbenennen</button>
      <button class="ex-menu-item" role="menuitem" data-action="day-duplicate" data-di="${di}">📋 Tag duplizieren</button>
      <button class="ex-menu-item" role="menuitem" data-action="day-reset-sets" data-di="${di}">🔄 Sätze zurücksetzen</button>
      <button class="ex-menu-item" role="menuitem" data-action="toggle-day-vacation" data-di="${di}">🏖 Urlaubstag markieren</button>
      <hr style="border-color:var(--c-border);margin:0">
      <button class="ex-menu-item ex-menu-item--danger" role="menuitem" data-action="remove-day" data-di="${di}"${wk.days.length <= 1 ? ' disabled' : ''}>🗑 Tag löschen</button>
    </div>` : ''}
  </div>

  <div
    class="day-card__body"
    id="day-body-${di}"
    data-day-body="${di}"
    role="region"
    aria-labelledby="day-hdr-${di}"
  >
    <div class="day-card__body-inner">
      ${renderDayBody(wk, di, state)}
    </div>
  </div>
</article>`;
}

/** Kalenderdatum eines Tags innerhalb einer Woche — Tag-Index = Tage-Offset
 * ab week.startDate (gleiche Konvention wie _weekdayName() in progressInsights.js). */
function _dayDate(wk, dayIdx) {
  const d = new Date(wk.startDate + 'T12:00:00');
  d.setDate(d.getDate() + dayIdx);
  return d;
}

/**
 * Trainings-Ritual-Kontext: findet den chronologisch letzten Tag VOR (wk, di)
 * mit Aktivität (abgeschlossen ODER mindestens ein bewerteter Satz) — über
 * Wochengrenzen hinweg, unabhängig vom Wochenindex (NICHT dasselbe wie der
 * bestehende prevBanner-Lookup, der gezielt denselben Tag-Slot der Vorwoche
 * vergleicht). Liefert null wenn kein vorheriger aktiver Tag existiert.
 * Liefert nur noch timeText — die Erfolgsquote der letzten EINZELNEN Einheit
 * wurde in Sprint B (train-v107) durch die stabilere "Ø Erfolg (4W)"-Zeile
 * in _renderRitualAnchor() ersetzt, nicht mehr hier berechnet.
 */
function _trainingContextAnchor(state, wk, di) {
  const sortedWeeks = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const curWeekIdx = sortedWeeks.indexOf(wk);
  if (curWeekIdx === -1) return null;

  let found = null;
  for (let wi = curWeekIdx; wi >= 0 && !found; wi--) {
    const w = sortedWeeks[wi];
    const startDi = (wi === curWeekIdx) ? di - 1 : w.days.length - 1;
    for (let d = startDi; d >= 0; d--) {
      const day = w.days[d];
      if (!day) continue;
      const hasEvaluated = day.exercises.some(ex => ex.sets.some(s => s.status === 'success' || s.status === 'fail'));
      if (day.markedDone || hasEvaluated) {
        found = { week: w, dayIdx: d };
        break;
      }
    }
  }
  if (!found) return null;

  const todayNoon = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();
  const daysAgo = Math.max(0, Math.round((todayNoon - _dayDate(found.week, found.dayIdx)) / 86_400_000));
  const timeText = daysAgo === 0 ? 'heute' : daysAgo === 1 ? 'gestern' : `vor ${daysAgo} Tagen`;
  return { timeText };
}

/**
 * Ritual-Anker, 3 klar getrennte Zeilen (Sprint B, train-v107):
 *   1. Letzte Einheit (zeitlich) — _trainingContextAnchor(), unverändert
 *   2. Ø Erfolg (4W) (Athleten-Gesamtbild) — NEU, _weekSuccessScore() über
 *      die letzten 4 Wochen mit bewerteten Sätzen, stabiler als die frühere
 *      Einzel-Einheit-Erfolgsquote
 *   3. Selber Tag letzte Woche (tagesbezogen) — _prevWeekBanner(), Berechnung
 *      unverändert, nur Bezeichnung "Vorwoche:" → "Selber Tag letzte Woche:"
 * Zeile 1+2 visuell zusammen (gleiche Farbe), Zeile 3 visuell abgesetzt.
 * Komplett ausgeblendet wenn alle drei leer sind (Fallback unverändert).
 */
function _renderRitualAnchor(state, wk, di) {
  const ctx   = _trainingContextAnchor(state, wk, di);
  const line1 = ctx ? `Letzte Einheit: ${ctx.timeText}` : null;

  const sortedWeeks = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last4  = sortedWeeks.slice(-4).map(w => _weekSuccessScore(w)).filter(s => s.total > 0);
  const avgPct = last4.length > 0 ? Math.round(last4.reduce((a, s) => a + s.pct, 0) / last4.length) : null;
  const line2  = avgPct !== null ? `Ø Erfolg (4W): ${avgPct}%` : null;

  const line3Html = _prevWeekBanner(state, wk, di);

  if (!line1 && !line2 && !line3Html) return '';

  return `<div class="training-context-anchor">
    ${line1 ? `<div class="ritual-anchor__row">${h(line1)}</div>` : ''}
    ${line2 ? `<div class="ritual-anchor__row">${h(line2)}</div>` : ''}
    ${line3Html ? `<div class="ritual-anchor__day-row">${line3Html}</div>` : ''}
  </div>`;
}

/**
 * Konsistenz-Anzeige im sticky Tag-Pillen-Bereich (_calcStreak(state).cur,
 * keine neue Berechnung). Immer sichtbar sobald ein Tag aktiv ist, auch bei
 * 0 Wochen (ehrliche Darstellung, kein Sonderfall). Rein informativ seit
 * Sprint "Framework-Audit Cleanup" (Fix 2/3/4) — kein Tap-Handler mehr (der
 * frühere Streak-Freeze-Einstiegspunkt ist entfernt), kein Flammen-Icon,
 * neutrale Formulierung statt "Streak".
 */
function _renderStreakBadge(state) {
  const streakWeeks = (_calcStreak(state)?.cur ?? 0);
  const streakLabel = streakWeeks === 1 ? '1 Woche' : `${streakWeeks} Wochen`;
  return `<span class="streak-badge" aria-label="${streakLabel} konsistentes Training"><span class="streak-badge__num">${streakWeeks}</span> ${streakWeeks === 1 ? 'Woche' : 'Wochen'}</span>`;
}

/** Abzeichen-Detailansicht (D2) — nur für bereits erreichte Abzeichen, dieselbe disposable-Overlay-Konvention wie _showReentryPopup(). */
function _showBadgeDetail(thr, earned) {
  document.getElementById('badge-detail-modal')?.remove();
  const dateStr = new Date(earned.unlockedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
  const overlay = document.createElement('div');
  overlay.id = 'badge-detail-modal';
  overlay.className = 'vac-plan-modal-overlay';
  overlay.innerHTML = `
    <div class="vac-plan-modal" style="align-items:center;text-align:center">
      <img src="./badges/${thr.id}.png" alt="${thr.title}" class="badge-img" width="120" height="120" style="align-self:center">
      <div class="vac-plan-modal__title">${thr.title}</div>
      <p class="vac-plan-modal__sub">${thr.weeks} Wochen Training in Folge</p>
      <p class="vac-plan-modal__sub" style="color:var(--c-ok)">Erreicht am ${dateStr}</p>
      <button class="btn btn--ghost" data-action="close-modal" data-target="badge-detail-modal" style="width:100%;min-height:var(--touch)">Schließen</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); return; }
    if (e.target.closest('[data-action="close-modal"]')) overlay.remove();
  });
}

/**
 * "Selber Tag letzte Woche"-Zeile (Zeile 3 des Ritual-Ankers, vormals
 * "Vorwoche-Banner") — Berechnung unverändert seit der ursprünglichen
 * Auslagerung (Erfolgsquote + Sätze-Summe über alle Übungen desselben
 * Tag-Slots der Vorwoche). Lebte bis Sprint B (train-v107) im sticky
 * Bereich, jetzt Teil von _renderRitualAnchor() im scrollbaren Bereich —
 * nur Bezeichnung + Position geändert, NICHT die Berechnung. Bedingung
 * unverändert: nur ab state.curIdx>0 und wenn prevDay existiert.
 */
function _prevWeekBanner(state, wk, di) {
  if (!(state.curIdx > 0)) return '';
  const prevDay = state.weeks[state.curIdx - 1]?.days?.[di];
  if (!prevDay) return '';
  let _pbSucc = 0, _pbFail = 0;
  prevDay.exercises.forEach(ex => ex.sets.forEach(s => {
    if (s.status === 'success') _pbSucc++;
    else if (s.status === 'fail') _pbFail++;
  }));
  const _pbTotal   = _pbSucc + _pbFail;
  const _pbScore   = _pbTotal > 0 ? Math.round(_pbSucc / _pbTotal * 100) : 0;
  return `<div class="prev-banner" role="status">
    ${ic.barChart()}<span>Selber Tag letzte Woche: ${_pbScore}% · ${_pbSucc}/${_pbTotal} Sätze ✓</span>
  </div>`;
}

function renderDayBody(wk, di, state) {
  const day      = wk.days[di];
  const locked   = !!day.locked;
  const done     = !!day.markedDone;
  const isVacDay = !!day.isVacation;

  const exHtml       = day.exercises.map((ex, ei) => ex.archived ? '' : renderExercise(wk, di, ei, state)).join('');
  const lockBtnLabel = done ? 'Tag entsperren' : 'Tag als abgeschlossen markieren und sperren';
  const lockBtnIcon  = done ? ic.unlock() : ic.lock();

  const noteVal = day.sessionNote ?? '';
  // Trainingsnotiz — prominent info-block (users see it immediately)
  const noteBlock = `
<div class="info-block info-block--note">
  <span class="info-block__label">📝 Trainingsnotiz</span>
  <textarea
    rows="3"
    ${locked ? 'disabled' : ''}
    data-action="day-field"
    data-di="${di}"
    data-field="sessionNote"
    aria-label="Trainingsnotiz"
    placeholder="Was war heute besonders? (Technik, Schmerzen, Fokus …)"
  >${h(noteVal)}</textarea>
</div>`;

  // Aufwärmen — compact collapsed button with ▼/▲ indicator
  const warmupVal = day.warmup ?? '';
  const warmupHasVal = warmupVal.trim().length > 0;
  const warmupBlock = `
<div class="session-note-block">
  <button
    class="session-note-toggle${warmupHasVal ? ' has-note' : ''}"
    onclick="this.nextElementSibling.classList.toggle('is-open'); this.classList.toggle('is-expanded')"
    aria-label="Aufwärmen"
  >🔥 <span>${warmupHasVal ? 'Aufwärmen' : 'Aufwärmen hinzufügen'}</span></button>
  <div class="session-note-body">
    <textarea
      class="session-note-input"
      rows="2"
      ${locked ? 'disabled' : ''}
      data-action="day-field"
      data-di="${di}"
      data-field="warmup"
      aria-label="Aufwärmen"
    >${h(warmupVal)}</textarea>
  </div>
</div>`;

  // Cooldown — compact collapsed button with ▼/▲ indicator
  const cooldownVal = day.cooldown ?? '';
  const cooldownHasVal = cooldownVal.trim().length > 0;
  const cooldownBlock = `
<div class="session-note-block">
  <button
    class="session-note-toggle${cooldownHasVal ? ' has-note' : ''}"
    onclick="this.nextElementSibling.classList.toggle('is-open'); this.classList.toggle('is-expanded')"
    aria-label="Cooldown"
  >🧘 <span>${cooldownHasVal ? 'Cooldown' : 'Cooldown hinzufügen'}</span></button>
  <div class="session-note-body">
    <textarea
      class="session-note-input"
      rows="2"
      ${locked ? 'disabled' : ''}
      data-action="day-field"
      data-di="${di}"
      data-field="cooldown"
      aria-label="Cooldown"
    >${h(cooldownVal)}</textarea>
  </div>
</div>`;

  return `
    ${_renderRitualAnchor(state, wk, di)}
    ${isVacDay ? '<div class="day-vacation-banner">🏖 Urlaubstag — unterbricht deinen Trainingsrhythmus nicht</div>' : ''}
    ${noteBlock}
    ${warmupBlock}
    <div data-ex-list="${di}">${exHtml}</div>
    ${cooldownBlock}
    ${!locked ? `
    <div class="add-exercise-row">
      <button
        class="btn btn--accent btn--sm"
        data-action="open-ex-search" data-di="${di}"
        aria-label="Übung hinzufügen"
        style="width:100%"
      >${ic.plus()} Übung hinzufügen</button>
    </div>` : ''}

    <div class="day-actions">
      <button
        class="complete-btn${done ? ' is-done' : ''}"
        data-action="toggle-complete" data-di="${di}"
        aria-pressed="${done}"
        aria-label="${lockBtnLabel}"
      >
        ${lockBtnIcon}
        ${done ? 'Gesperrt – Tippen zum Entsperren' : 'Abgeschlossen & sperren'}
      </button>
    </div>

    <!-- Session rating: static read-only display after locking -->
    ${done && day.sessionRating != null ? `
    <div class="session-rating session-rating--static" aria-label="Einheitsbewertung">
      <span class="session-rating__lbl">Einheit:</span>
      <span class="session-rating__chosen">${[null,'😴','😊','💪'][day.sessionRating] ?? ''}</span>
      ${day.sleepHours  != null ? `<span class="session-rating__meta">🛌 ${day.sleepHours}h</span>` : ''}
      ${day.energyLevel != null ? `<span class="session-rating__meta">⚡ ${day.energyLevel}/5</span>` : ''}
    </div>` : ''}
  `;
}

function renderInfoBlock(type, label, value, di, disabled) {
  return `
<div class="info-block info-block--${type}">
  <span class="info-block__label">${label}</span>
  <textarea
    rows="2"
    ${disabled ? 'disabled' : ''}
    data-action="day-field"
    data-di="${di}"
    data-field="${type === 'warmup' ? 'warmup' : 'cooldown'}"
    aria-label="${label}"
  >${h(value ?? '')}</textarea>
</div>`;
}

/**
 * "Nächstes Ziel" — reine Anzeige bestehender Werte (targetReps, ex.nextWeekPlan,
 * Satz-Daten), keine neue Empfehlungslogik. Ersetzt das frühere freie Notizfeld.
 * Gibt null zurück wenn nichts anzuzeigen ist (kein targetReps definiert).
 */
function _nextGoalText(ex) {
  const target = parseFloat(ex.targetReps) || 0;
  if (!target) return null; // Zustand D: kein Zielwert definiert

  const unit = ex.metric === 'sec' ? 'Sek' : ex.metric === 'm' ? 'm' : 'Wdh';
  const nextOpenIdx = ex.sets.findIndex(s => s.status === 'pending');

  if (nextOpenIdx !== -1) {
    // Zustand A: noch mind. 1 offener Satz — bezieht sich auf den nächsten
    // (ersten pending) Satz, nicht auf eine Gesamtbilanz über die Woche.
    const enteredReps = parseFloat(ex.sets[nextOpenIdx].reps) || 0;
    const missing = Math.max(0, target - enteredReps);
    return missing > 0
      ? `Noch ${missing} ${unit} im aktuellen Satz`
      : 'Ziel im aktuellen Satz erreicht';
  }

  // Alle Sätze abgeschlossen (kein pending mehr) — exakt dieselbe Ist/Soll-
  // Berechnung wie die bestehende fulfill-meter-Zeile weiter unten, nicht neu erfunden.
  const nSets = ex.sets.length;
  const soll  = nSets * target;
  const ist   = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').reduce((sum, s) => sum + (parseFloat(s.reps) || 0), 0);

  if (ist < soll) {
    // Zustand A-fertig: alle Sätze durch, aber Gesamt-Soll verfehlt
    return `${ist} von ${soll} ${unit} erreicht`;
  }

  const pt = ex.progressionType ?? 'weight';
  if (!ex.nextWeekPlan) {
    const btnLabel = pt === 'reps' ? `+${unit}` : pt === 'sets' ? '+Satz' : '+kg';
    return `Ziel erreicht — Steigerung über den ${btnLabel}-Button planen`;
  }

  let newValueText;
  if (pt === 'reps') {
    newValueText = `${target + ex.nextWeekPlan} ${unit}`;
  } else if (pt === 'sets') {
    newValueText = `${ex.sets.length + ex.nextWeekPlan} Sätze`;
  } else {
    const curWeight = Math.max(...ex.sets.map(s => s.weight ?? 0));
    newValueText = `${curWeight + ex.nextWeekPlan}kg`;
  }
  const _sign = ex.nextWeekPlan >= 0 ? '+' : '';
  return `Nächste ${ex.nextWeekPlan >= 0 ? 'Steigerung' : 'Anpassung'}: ${_sign}${ex.nextWeekPlan} → ${newValueText}`;
}

// ─── Exercise ─────────────────────────────────────────────────────────────────
function renderExercise(wk, di, ei, state) {
  const ex     = wk.days[di].exercises[ei];
  const isFav  = (state.favoriteExercises ?? []).includes(ex.name);
  const locked = !!wk.days[di].locked;
  const isDl   = wk.mode === 'deload';
  const drag   = state.settings.drag && !locked;

  const _lookupName = ex.substituteFor || ex.name;
  let prevEx = null;
  for (let _wi = state.curIdx - 1; _wi >= 0; _wi--) {
    const _w = state.weeks[_wi];
    if (_w.mode === 'deload') continue;
    for (const _d of (_w.days ?? [])) {
      const _pe = (_d.exercises ?? []).find(_e => _e.name === _lookupName);
      if (_pe) { prevEx = _pe; break; }
    }
    if (prevEx) break;
  }

  const rpeEnabled = state.settings?.rpeEnabled ?? true;
  const setsHtml = ex.sets.map((s, si) =>
    renderSetRow(s, si, ex, di, ei, prevEx, locked, isDl, rpeEnabled)
  ).join('');

  const step = ex.weightStep ?? 2.5;
  const metric = ex.metric === 'sec' || ex.metric === 'm' ? ex.metric : 'reps';
  // B18: Schrittweite für Distanz/Zeit — Analogon zu ex.weightStep, aber
  // eigenes Feld (ex.metricStep), da Gewicht und Distanz/Zeit nie gleichzeitig
  // relevant sind (nie beide gleichzeitig anzeigen, siehe cfgRow unten).
  const metricStepVal = ex.metricStep ?? (metric === 'm' ? 50 : metric === 'sec' ? 10 : 2.5);
  const _exCatOverride = (state.customExercises ?? []).find(c => c.name === ex.name)?.category ?? '';

  // Vorschlag: Ø erfolgreiche Wiederholungen der gleichen Übung aus der Vorwoche
  let _suggestionHtml = '';
  if (!locked && state.curIdx > 0) {
    const prevWk = state.weeks[state.curIdx - 1];
    if (prevWk) {
      for (const d of prevWk.days) {
        const pe = d.exercises.find(e => e.name === ex.name);
        if (pe) {
          const scs = pe.sets.filter(s => s.status === 'success' && s.reps != null && s.reps > 0);
          if (scs.length > 0) {
            const avg = Math.round(scs.reduce((sum, s) => sum + (parseFloat(s.reps) || 0), 0) / scs.length);
            _suggestionHtml = `<span class="target-suggestion">Vorschlag: ${avg} (Ø letzte Woche)</span><button type="button" class="btn-adopt-target" data-action="adopt-target-reps" data-di="${di}" data-ei="${ei}" data-value="${avg}">Übernehmen</button>`;
          }
          break;
        }
      }
    }
  }

  // Vorschlag: wiederholt identischer Sprung in der geloggten Historie
  // (2026-07-14) — reiner Hinweis neben der Schrittweite-Einstellung, wird
  // NIE automatisch übernommen, nur per explizitem Tap auf "Übernehmen"
  // (dispatcht dieselbe EX_SET_STEP/EX_SET_METRIC_STEP-Action wie die
  // manuellen Schrittweite-Buttons). Gilt für Gewicht UND Distanz/Zeit.
  let _stepSuggestionHtml = '';
  if (!locked) {
    const _sortedWks    = getSortedWeeks(state);
    const _stepHistory  = metric === 'reps' ? exWeightHistory(_sortedWks, ex.name) : exMetricHistory(_sortedWks, ex.name);
    const _stepPattern  = detectRecurringStep(_stepHistory);
    const _currentStep  = metric === 'reps' ? step : metricStepVal;
    if (_stepPattern && _stepPattern.step !== _currentStep) {
      const _stepUnit   = metric === 'sec' ? 'Sek' : metric === 'm' ? 'm' : 'kg';
      const _stepAction = metric === 'reps' ? 'adopt-suggested-step' : 'adopt-suggested-metric-step';
      _stepSuggestionHtml = `<span class="target-suggestion">Du hast wiederholt um ${_stepPattern.step}${_stepUnit} gesteigert (${_stepPattern.occurrences}x) — als Schrittweite übernehmen?</span><button type="button" class="btn-adopt-target" data-action="${_stepAction}" data-di="${di}" data-ei="${ei}" data-value="${_stepPattern.step}">Übernehmen</button>`;
    }
  }
  const metricHdr = metric === 'sec' ? 'Sek' : metric === 'm' ? 'm' : 'Wdh';

  // ── Substitut-Banner + Inline-Formular ──────────────────────────────────────
  const subBannerHtml = ex.substituteFor
    ? `<div class="sub-banner" role="status" aria-label="Substitution aktiv">↔ Heute: ${h(ex.name)} (statt ${h(ex.substituteFor)})</div>`
    : '';

  const _subKey = `${di}-${ei}`;
  const subFormHtml = _subFormOpenKey === _subKey
    ? `<div class="sub-form">
    <span class="sub-form__label">Ursprüngliche Übung:</span>
    <input
      class="sub-name-input"
      type="text"
      list="sub-list-${di}-${ei}"
      placeholder="z.B. Klimmzüge …"
      data-di="${di}" data-ei="${ei}"
      autocomplete="off"
      autofocus
    />
    <datalist id="sub-list-${di}-${ei}">
      ${_STANDARD_EXERCISES.map(n => `<option value="${h(n)}">`).join('')}
    </datalist>
    <div class="sub-form__btns">
      <button class="btn btn--accent btn--sm" data-action="confirm-sub" data-di="${di}" data-ei="${ei}">Bestätigen</button>
      <button class="btn btn--ghost btn--sm" data-action="close-sub-form" data-di="${di}" data-ei="${ei}">Abbrechen</button>
    </div>
  </div>`
    : '';

  // --- Zweistufiges Zahnrad-Menü (Sprint 4) ---
  const cfgKey    = `${di}-${ei}`;
  const isAdvOpen = _cfgAdvOpen.has(cfgKey);
  const cfgRow = ex._showCfg ? `
    <div class="exercise__settings">
      <!-- Ebene 1: häufig genutzt — immer sichtbar -->
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Zielvorgaben">
        <span class="pause-row__label">Ziel:</span>
        <span class="pause-row__label">${ex.sets.length}&times;</span>
        <input
          class="target-input"
          type="number"
          inputmode="${metric === 'm' ? 'decimal' : 'numeric'}"
          min="1" max="999"
          step="${metric === 'sec' || metric === 'm' ? '5' : '1'}"
          value="${ex.targetReps ?? ''}"
          placeholder="${(() => { const avg = _avgRepsLast4(ex.name, state.weeks); return avg !== null ? String(avg) : (metric === 'sec' ? 'z.B. 30' : metric === 'm' ? 'z.B. 20' : 'z.B. 10'); })()}"
          data-action="set-targets" data-field="targetReps"
          data-di="${di}" data-ei="${ei}"
          aria-label="Ziel ${metric === 'sec' ? 'Sekunden' : metric === 'm' ? 'Meter' : 'Wiederholungen'}"
        />
        <span class="pause-row__label">${metricHdr}</span>
        ${_suggestionHtml}
      </div>` : ''}
      <div class="pause-row" role="group" aria-label="Einstellungen">
        <span class="pause-row__label">Pause:</span>
        ${[30, 60, 90, 120].map(sec => `
          <button
            class="pause-opt${ex.pauseSec === sec ? ' is-selected' : ''}"
            data-action="set-pause" data-di="${di}" data-ei="${ei}" data-sec="${sec}"
            aria-pressed="${ex.pauseSec === sec}"
          >${sec}s</button>`).join('')}
      </div>
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Leistungsmetrik">
        <span class="pause-row__label">Metrik:</span>
        <div class="weight-step-opts">
          ${[
            { id: 'reps', label: 'Wdh' },
            { id: 'sec', label: 'Sek' },
            { id: 'm', label: 'm' },
          ].map(({ id, label }) => `
            <button
              type="button"
              class="weight-step-btn${metric === id ? ' is-selected' : ''}"
              data-action="set-metric" data-di="${di}" data-ei="${ei}" data-metric="${id}"
              aria-pressed="${metric === id}"
            >${label}</button>`).join('')}
        </div>
      </div>` : ''}
      <div class="weight-plan-row" role="group" aria-label="Bewegungskategorie">
        <span class="pause-row__label">Kategorie:</span>
        <select class="chart-select" style="margin-bottom:0" data-action="set-ex-category" data-di="${di}" data-ei="${ei}" aria-label="Bewegungskategorie">
          <option value="">Keine</option>
          ${['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core'].map(c => `
            <option value="${c}" ${_exCatOverride === c ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Steigerungsart">
        <span class="pause-row__label">Steigerung:</span>
        <div class="weight-step-opts">
          ${metric === 'reps' ? `
          <button type="button"
            class="weight-step-btn${(ex.progressionType ?? 'weight') === 'weight' ? ' is-selected' : ''}"
            data-action="set-progression-type" data-di="${di}" data-ei="${ei}" data-val="weight"
            aria-pressed="${(ex.progressionType ?? 'weight') === 'weight'}"
          >Gewicht ↑</button>` : ''}
          <button type="button"
            class="weight-step-btn${(ex.progressionType ?? 'weight') === 'reps' ? ' is-selected' : ''}"
            data-action="set-progression-type" data-di="${di}" data-ei="${ei}" data-val="reps"
            aria-pressed="${(ex.progressionType ?? 'weight') === 'reps'}"
          >${metric === 'sec' ? 'Zeit ↑' : metric === 'm' ? 'Distanz ↑' : 'Wdh ↑'}</button>
          <button type="button"
            class="weight-step-btn${(ex.progressionType ?? 'weight') === 'sets' ? ' is-selected' : ''}"
            data-action="set-progression-type" data-di="${di}" data-ei="${ei}" data-val="sets"
            aria-pressed="${(ex.progressionType ?? 'weight') === 'sets'}"
          >Satz ↑</button>
        </div>
      </div>` : ''}
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Progressions-Modus">
        <span class="pause-row__label">Progressions-Modus:</span>
        <div class="weight-step-opts">
          <button type="button"
            class="weight-step-btn${(ex.progressionMode ?? 'weight_first') === 'weight_first' ? ' is-selected' : ''}"
            data-action="set-progression-mode" data-di="${di}" data-ei="${ei}" data-val="weight_first"
            aria-pressed="${(ex.progressionMode ?? 'weight_first') === 'weight_first'}"
          >Gewicht zuerst</button>
          <button type="button"
            class="weight-step-btn${ex.progressionMode === 'double_progression' ? ' is-selected' : ''}"
            data-action="set-progression-mode" data-di="${di}" data-ei="${ei}" data-val="double_progression"
            aria-pressed="${ex.progressionMode === 'double_progression'}"
          >Doppelte Progression</button>
          <button type="button"
            class="weight-step-btn${ex.progressionMode === 'reps_only' ? ' is-selected' : ''}"
            data-action="set-progression-mode" data-di="${di}" data-ei="${ei}" data-val="reps_only"
            aria-pressed="${ex.progressionMode === 'reps_only'}"
          >Nur Wiederholungen</button>
        </div>
      </div>
      ${ex.progressionMode === 'double_progression' ? `
      <div class="weight-plan-row" role="group" aria-label="Wdh-Obergrenze">
        <span class="pause-row__label">Wdh-Obergrenze:</span>
        <input
          class="target-input"
          type="number"
          inputmode="numeric"
          min="1" max="100"
          value="${ex.targetRepsMax ?? ''}"
          placeholder="z.B. 12"
          data-action="set-targets" data-field="targetRepsMax"
          data-di="${di}" data-ei="${ei}"
          aria-label="Wdh-Obergrenze für doppelte Progression"
        />
      </div>` : ''}` : ''}
      <!-- Erweitert-Toggle -->
      <button class="cfg-adv-toggle${isAdvOpen ? ' is-open' : ''}"
        data-action="toggle-cfg-adv" data-di="${di}" data-ei="${ei}"
        aria-expanded="${isAdvOpen}"
      >Erweitert ${isAdvOpen ? '▲' : '▼'}</button>
      <!-- Ebene 2: selten genutzt — hinter Erweitert -->
      ${isAdvOpen ? `
      <div class="cfg-adv-panel">
        ${!locked ? `
        <div class="weight-plan-row" role="group" aria-label="Satz-Typ">
          <span class="pause-row__label">Typ:</span>
          <div class="weight-step-opts">
            ${[['straight','Straight'],['manual','Manuell']].map(([val, lbl]) => `
              <button type="button"
                class="weight-step-btn${(ex.setType ?? 'straight') === val ? ' is-selected' : ''}"
                data-action="set-settype" data-di="${di}" data-ei="${ei}" data-val="${val}"
                aria-pressed="${(ex.setType ?? 'straight') === val}"
              >${lbl}</button>`).join('')}
          </div>
          ${(ex.setType ?? 'straight') === 'straight'
            ? '<span class="pause-row__label" style="color:var(--c-text-3);font-size:10px">Gewicht wird automatisch auf alle Sätze kopiert</span>'
            : ''}
        </div>` : ''}
        ${!locked ? `
        <div class="weight-plan-row" role="group" aria-label="Gewichtsscheiben">
          <span class="pause-row__label">Scheiben:</span>
          <button
            type="button"
            class="weight-step-btn${ex.showPlates ? ' is-selected' : ''}"
            data-action="toggle-plates" data-di="${di}" data-ei="${ei}"
            aria-pressed="${!!ex.showPlates}"
          >${ex.showPlates ? 'An' : 'Aus'}</button>
          ${ex.showPlates ? '<span class="pause-row__label" style="color:var(--c-text-3);font-size:10px">Langhantel 20 kg Basis</span>' : ''}
        </div>` : ''}
        ${!locked ? `
        <div class="weight-plan-row" role="group" aria-label="Superset">
          <span class="pause-row__label">Superset:</span>
          <button
            type="button"
            class="weight-step-btn${ex.supersetId ? ' is-selected' : ''}"
            data-action="toggle-superset" data-di="${di}" data-ei="${ei}"
            aria-pressed="${!!ex.supersetId}"
          >${ex.supersetId ? 'An (SS)' : 'Aus'}</button>
        </div>` : ''}
        ${!locked && metric === 'reps' ? `
        <div class="weight-plan-row" role="group" aria-label="Steigerungsrate">
          <span class="pause-row__label">Schrittweite:</span>
          <div class="weight-step-opts">
            ${[0, 1.25, 2, 2.5, 5, 7.5, 10].map(s => `
              <button
                class="weight-step-btn${step === s ? ' is-selected' : ''}"
                data-action="set-step" data-di="${di}" data-ei="${ei}" data-step="${s}"
                aria-pressed="${step === s}"
              >${s === 0 ? 'Reset' : s}</button>`).join('')}
          </div>
          ${_stepSuggestionHtml}
        </div>` : ''}
        ${!locked && metric !== 'reps' ? `
        <div class="weight-plan-row" role="group" aria-label="Steigerungsrate">
          <span class="pause-row__label">Schrittweite:</span>
          <div class="weight-step-opts">
            ${(metric === 'm' ? [0, 10, 25, 50, 100, 200] : [0, 5, 10, 15, 30, 60]).map(s => `
              <button
                class="weight-step-btn${metricStepVal === s ? ' is-selected' : ''}"
                data-action="set-metric-step" data-di="${di}" data-ei="${ei}" data-step="${s}"
                aria-pressed="${metricStepVal === s}"
              >${s === 0 ? 'Reset' : s}</button>`).join('')}
          </div>
          ${_stepSuggestionHtml}
        </div>` : ''}
        ${(state.customExercises ?? []).some(c => c.name === ex.name && c.metric != null) ? `
        <button type="button" class="btn btn--ghost btn--sm" data-action="edit-custom-ex" data-di="${di}" data-ei="${ei}" style="margin-top:var(--sp-2)">
          ✏️ Übung bearbeiten
        </button>` : ''}
      </div>` : ''}
    </div>` : '';

  return `
<div class="exercise${ex._showCfg ? ' is-cfg-open' : ''}${ex.supersetId ? ' is-superset' : ''}" data-di="${di}" data-ei="${ei}" draggable="${drag}">
  ${ex.supersetId ? '<div class="ss-badge">SUPER</div>' : ''}
  <div class="sticky-sentinel" aria-hidden="true" style="height:1px;pointer-events:none;"></div>

  <div class="exercise__name-sticky">
    <input
      class="exercise__name-input"
      type="text"
      value="${h(ex.name)}"
      ${locked ? 'disabled' : ''}
      data-action="ex-name" data-di="${di}" data-ei="${ei}"
      aria-label="Übungsname"
      maxlength="80"
    />

    ${!locked ? (() => {
      const _pt     = ex.progressionType ?? 'weight';
      const _isReps = _pt === 'reps';
      const _isSets = _pt === 'sets';
      const _planVal = ex.nextWeekPlanConfirmed ? (ex.nextWeekPlan ?? 0) : (ex.nextWeekPlan || (_isReps || _isSets ? 1 : 0));
      const _weightVal = ex.nextWeekPlan || 0;
      const _repsUnit = metric === 'sec' ? 'Sek' : metric === 'm' ? 'm' : 'Wdh';
      const _btnLabel = _isReps
        ? `+${_planVal} ${_repsUnit}${ex.nextWeekPlanConfirmed ? ' ✓' : ''}`
        : _isSets
          ? `+${_planVal} Satz${ex.nextWeekPlanConfirmed ? ' ✓' : ''}`
          : `${_weightVal >= 0 ? '+' : ''}${_weightVal}${ex.nextWeekPlanConfirmed ? ' ✓' : ''}`;
      return `
    <div class="ex-kg-wrap">
      <button
        class="btn-icon btn-icon--kg${ex.nextWeekPlan ? ' is-planned' : ''}${ex.nextWeekPlanConfirmed ? ' is-confirmed' : ''}"
        data-action="inc-weight" data-di="${di}" data-ei="${ei}"
        aria-label="${ex.nextWeekPlanConfirmed ? `${_btnLabel} bestätigt` : `${_btnLabel} — tippen zum Bestätigen`}"
      >${_btnLabel}</button>
      ${!_isReps && !_isSets && _kgPickerKey === `${di}-${ei}` ? `
      <div class="ex-kg-picker" role="group" aria-label="Steigerung für nächste Woche">
        ${[0, 1.25, 2, 2.5, 5, 7.5, 10, 15, 20].map(v =>
          `<button class="ex-kg-picker-btn${ex.nextWeekPlan === v ? ' is-selected' : ''}"
            data-action="kg-picker-select" data-di="${di}" data-ei="${ei}" data-value="${v}"
          >${v === 0 ? '0' : '+' + v}</button>`).join('')}
        ${_kgPickerCustom ? `
        <div class="ex-kg-picker-custom">
          <input type="number" inputmode="decimal" min="0" step="0.25"
            id="kg-picker-custom-input" class="num-input" placeholder="kg"
            data-action="kg-picker-custom-input" data-di="${di}" data-ei="${ei}"
            aria-label="Eigener Steigerungswert" autofocus
          />
          <button class="ex-kg-picker-btn" data-action="kg-picker-custom-confirm" data-di="${di}" data-ei="${ei}">OK</button>
        </div>` : `
        <button class="ex-kg-picker-btn ex-kg-picker-btn--other" data-action="kg-picker-show-custom" data-di="${di}" data-ei="${ei}">Anderer Wert</button>`}
      </div>` : ''}
      ${_isReps && _repsPickerKey === `${di}-${ei}` ? `
      <div class="ex-kg-picker" role="group" aria-label="${metric === 'reps' ? 'Wdh' : _repsUnit}-Steigerung nächste Woche">
        ${(metric === 'reps' ? [0,1,2,3,4,5] : [0, metricStepVal / 2, metricStepVal, metricStepVal * 2].filter((v, i, a) => a.indexOf(v) === i)).map(v =>
          `<button class="ex-kg-picker-btn${ex.nextWeekPlan === v ? ' is-selected' : ''}"
            data-action="reps-picker-select" data-di="${di}" data-ei="${ei}" data-value="${v}"
          >${v === 0 ? '0' : '+' + v}</button>`).join('')}
      </div>` : ''}
      ${_isSets && _repsPickerKey === `${di}-${ei}` ? `
      <div class="ex-kg-picker" role="group" aria-label="Satz-Steigerung nächste Woche">
        ${[0,1,2,3].map(v =>
          `<button class="ex-kg-picker-btn${ex.nextWeekPlan === v ? ' is-selected' : ''}"
            data-action="reps-picker-select" data-di="${di}" data-ei="${ei}" data-value="${v}"
          >${v === 0 ? '0' : '+' + v}</button>`).join('')}
      </div>` : ''}
    </div>`;
    })() : ''}

    <button
      class="btn-fav${isFav ? ' is-fav' : ''}"
      data-action="toggle-fav"
      data-name="${h(ex.name)}"
      aria-label="${isFav ? 'Favorit entfernen' : 'Als Favorit markieren'}"
      aria-pressed="${isFav}"
    >${isFav ? '⭐' : '☆'}</button>

    <div class="ex-menu-wrap">
      <button
        class="ex-menu-btn"
        data-action="toggle-ex-menu" data-di="${di}" data-ei="${ei}"
        aria-label="Übungsmenü öffnen"
        aria-expanded="${_exMenuOpenKey === `${di}-${ei}`}"
      >⋮</button>
      ${_exMenuOpenKey === `${di}-${ei}` ? `
      <div class="ex-menu-dropdown" role="menu">
        ${!locked ? `
        <button class="ex-menu-item" role="menuitem" data-action="move-ex-up" data-di="${di}" data-ei="${ei}" ${ei === 0 ? 'disabled' : ''}>▲ Nach oben</button>
        <button class="ex-menu-item" role="menuitem" data-action="move-ex-down" data-di="${di}" data-ei="${ei}" ${ei === wk.days[di].exercises.length - 1 ? 'disabled' : ''}>▼ Nach unten</button>
        ` : ''}
        <button class="ex-menu-item${ex.nextWeekPlan ? ' is-planned' : ''}" role="menuitem" data-action="toggle-cfg" data-di="${di}" data-ei="${ei}">⚙️ Einstellungen</button>
        ${!locked ? `
        ${ex.substituteFor
          ? `<button class="ex-menu-item" role="menuitem" data-action="reset-sub" data-di="${di}" data-ei="${ei}">↩ Substitution zurücksetzen</button>`
          : `<button class="ex-menu-item" role="menuitem" data-action="open-sub-form" data-di="${di}" data-ei="${ei}">↔ Heute anders</button>`}
        <button class="ex-menu-item" role="menuitem" data-action="open-archive-confirm" data-di="${di}" data-ei="${ei}">📦 Übung archivieren</button>
        <button class="ex-menu-item ex-menu-item--danger" role="menuitem" data-action="remove-ex" data-di="${di}" data-ei="${ei}">🗑️ Übung löschen</button>
        ` : ''}
      </div>` : ''}
    </div>
  </div>

  ${subBannerHtml}
  ${subFormHtml}

  ${_archiveConfirmKey === `${di}-${ei}` ? `
  <div class="sub-form" style="text-align:center;padding:var(--sp-4)">
    <p style="font-size:13px;color:var(--c-text-2);margin-bottom:var(--sp-3)">${h(ex.name)} wird aus dem Training ausgeblendet. Die bisherige Historie bleibt erhalten.</p>
    <div style="display:flex;gap:var(--sp-2);justify-content:center">
      <button class="btn btn--danger btn--sm" data-action="confirm-archive-ex" data-di="${di}" data-ei="${ei}">Archivieren</button>
      <button class="btn btn--sm" data-action="cancel-archive-ex">Abbrechen</button>
    </div>
  </div>` : ''}

  ${cfgRow}

  ${(() => {
    const goalText = _nextGoalText(ex);
    return goalText ? `<div class="exercise__next-goal">${h(goalText)}</div>` : '';
  })()}

  <!-- 1RM estimator hint (3.7) -->
  ${(() => {
    if (ex.oneRM != null && ex.oneRM > 0) {
      return `<div class="orm-hint" aria-label="Geschätztes 1RM">~${ex.oneRM.toFixed(1)} kg 1RM</div>`;
    }
    const best1RM = ex.sets
      .filter(s => s.status === 'success' && (s.reps ?? 0) > 0 && (s.reps ?? 0) <= 10 && (s.weight ?? 0) > 0)
      .map(s => s.weight * (1 + s.reps / 30))
      .reduce((max, v) => Math.max(max, v), 0);
    return best1RM > 0
      ? `<div class="orm-hint" aria-label="Geschätztes 1RM">~${best1RM.toFixed(1)} kg 1RM (Epley)</div>`
      : '';
  })()}

  <div class="set-header" aria-hidden="true">
    <span>#</span><span>kg</span><span>${metricHdr}</span><span>${rpeEnabled ? 'RPE' : ''}</span><span>✓</span><span></span>
  </div>

  <div data-set-list="${di}-${ei}" role="list" aria-label="Sätze von ${h(ex.name)}">
    ${setsHtml}
  </div>


  ${!locked ? (() => {
    const _normSt = s => (s.status === 'success' || s.status === 'fail') ? s.status : (s.done ? 'success' : 'pending');
    const allDone = ex.sets.length > 0 && ex.sets.every(s => _normSt(s) !== 'pending');
    const _nudgePrefix = `${di}-${ei}-`;
    const _nudgeSi = (_rpeNudgeKey?.startsWith(_nudgePrefix)) ? +_rpeNudgeKey.split('-')[2] : null;
    return `<div class="confirm-set-wrap">
      <button
        class="confirm-set-btn${allDone ? ' is-done' : ''}${_confirmFlashKey === `${di}-${ei}` ? ' is-flashing' : ''}"
        ${allDone ? 'disabled' : ''}
        data-action="confirm-set" data-di="${di}" data-ei="${ei}"
        aria-label="Nächsten Satz bestätigen"
      >✓ Satz bestätigen</button>
      ${_nudgeSi != null ? `
      <div class="rpe-nudge" role="group" aria-label="RPE eingeben">
        <span class="rpe-nudge__label">Wie anstrengend?</span>
        ${[7,8,9,10].map(v => `
          <button class="rpe-nudge__btn"
            data-action="rpe-nudge-select"
            data-di="${di}" data-ei="${ei}" data-si="${_nudgeSi}" data-rpe="${v}"
          >${v}</button>`).join('')}
      </div>` : ''}
    </div>`;
  })() : ''}

  <!-- Soll-Ist + Fulfillment combined row (2.4): always visible, no toggle -->
  ${(() => {
    if (!ex.targetReps) return '';
    if (ex.substituteFor && (!prevEx || prevEx.metric !== ex.metric)) return '';
    const nSets     = ex.sets.length;
    const target    = nSets * ex.targetReps;
    // success UND fail zählen (Sprint "Kategorie-1-Bugfixes", Fix 5c/8) —
    // ein fail-Satz mit z.B. 5 von 8 Ziel-Wdh war trotzdem echte Arbeit,
    // vorher fiel er komplett aus dem Zähler, obwohl sein Soll im Nenner
    // (target = nSets × targetReps, unconditional) weiterhin mitzählte.
    const achieved  = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').reduce((sum, s) => sum + (parseFloat(s.reps) || 0), 0);
    const actualPct = target > 0 ? Math.round(achieved / target * 100) : 0;
    const pct       = Math.min(actualPct, 100);
    const color     = pct >= 100 ? 'var(--c-ok)' : pct >= 80 ? 'var(--c-warn)' : 'var(--c-danger)';
    const unit      = metric === 'sec' ? 'Sek' : metric === 'm' ? 'm' : 'Wdh';
    return `
    <div class="fulfill-meter" aria-label="Zielerfüllung ${actualPct}%">
      <div class="fulfill-meter__bar-wrap">
        <div class="fulfill-meter__bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="fulfill-meter__label" style="color:${color}">Ziel: ${nSets}×${ex.targetReps} | Ist: ${achieved}/${target} ${unit}</span>
    </div>
    ${actualPct > 0 ? `<div class="effort-pct" style="color:${actualPct > 100 ? 'var(--c-accent)' : 'var(--c-text-3)'}">${actualPct > 100 ? '↑ ' : ''}${Math.min(actualPct, 100)}% Ziel</div>` : ''}`;
  })()}

  ${!locked ? `
  <button
    class="add-set-btn"
    data-action="add-set" data-di="${di}" data-ei="${ei}"
    aria-label="Satz zu '${h(ex.name)}' hinzufügen"
  >${ic.plus()}<span>Satz hinzufügen</span></button>` : ''}
</div>`;
}
// ─── Set row ─────────────────────────────────────────────────────────────────
function renderSetRow(s, si, ex, di, ei, prevEx, locked, isDl, rpeEnabled = true) {
  // B17: prevEx wird in renderExercise() bei einer Ausweichübung (substituteFor)
  // bewusst über den NAMEN DER URSPRÜNGLICHEN Übung gesucht (siehe _lookupName
  // dort) — für den Fulfill-Meter-Metrik-Check dort ist das sinnvoll, aber hier
  // würde es die "Vorwoche"-Hints (Gewicht/Wdh übernehmen) mit Werten der
  // URSPRÜNGLICHEN, nicht der heute tatsächlich ausgeführten Übung befüllen
  // (z.B. Kniebeuge-Gewicht als Vorschlag für Beinpresse). Ausweichübung hat
  // per Definition keine eigene Vorwochen-Historie — daher hier explizit kein
  // Hint statt eines aus einer anderen Übung übernommenen.
  const prevSet    = ex.substituteFor ? null : (prevEx?.sets?.[si] ?? null);
  const dlFactor   = getState().settings?.deloadFactor ?? 0.75;
  const dispW      = isDl ? Math.round(s.weight * dlFactor * 2) / 2 : s.weight;
  const metric  = ex.metric === 'sec' || ex.metric === 'm' ? ex.metric : 'reps';
  const repStep = metric === 'm' ? '0.1' : '1';
  const repMode = metric === 'm' ? 'decimal' : 'numeric';
  const repPh   = metric === 'sec' ? 'Sek' : metric === 'm' ? 'm' : 'Wdh';
  const repAria = metric === 'sec'
    ? `Satz ${si + 1} Dauer in Sekunden`
    : metric === 'm'
      ? `Satz ${si + 1} Distanz in Metern`
      : `Satz ${si + 1} Wiederholungen`;
  const prevVal = prevSet ? prevSet.reps : null;
  const prevRepHint = prevVal == null || prevVal === ''
    ? ''
    : metric === 'sec'
      ? `${prevVal}s`
      : metric === 'm'
        ? `${prevVal} m`
        : `${prevVal}×`;

  const hasAutofill = !locked && si < ex.sets.length - 1;
  const metricValLabel = metric === 'sec' ? 'Sekunden' : metric === 'm' ? 'Meter' : 'Wiederholungen';
  const autofillBtn = hasAutofill ? `
    <button
      type="button"
      class="btn-autofill"
      data-action="autofill-down" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="Gewicht und ${metricValLabel} von Satz ${si + 1} auf alle folgenden Sätze übernehmen"
    >${ic.autofillDown()}</button>` : '';
  const prevRepsAdopt = (!locked && prevVal != null && prevVal !== '')
    ? `<button type="button" class="prev-hint prev-hint--btn" data-action="adopt-prev-reps" data-di="${di}" data-ei="${ei}" data-si="${si}" data-value="${prevVal}" aria-label="Vorwoche ${prevRepHint}">${prevRepHint}</button>`
    : (prevRepHint ? `<span class="prev-hint" aria-hidden="true">${prevRepHint}</span>` : '');
  const metricCellFooter = hasAutofill
    ? `<div class="set-cell__footer">
        ${prevRepsAdopt}
        ${autofillBtn}
      </div>`
    : prevRepsAdopt;

  let st = s.status;
  if (st !== 'pending' && st !== 'success' && st !== 'fail') {
    st = s.done ? 'success' : 'pending';
  }
  const doneClass = st === 'success' ? ' is-done' : st === 'fail' ? ' is-fail' : '';
  const stLabel   = st === 'success' ? 'erfolgreich' : st === 'fail' ? 'nicht geschafft' : 'offen';

  // PR indicators: 🏆 weight PR (gold) | 🔄 reps PR (green)
  const isWeightPR = st === 'success' && ex.prWeight !== null &&
                     (s.weight ?? 0) > 0 && (s.weight ?? 0) >= ex.prWeight;
  const isRepsPRAtMax = st === 'success' && ex.prRepsAtMaxWeight != null &&
                     ex.prRepsAtMaxWeight > 0 &&
                     (s.weight ?? 0) >= (ex.prWeight ?? 0) &&
                     (s.reps ?? 0) >= ex.prRepsAtMaxWeight;
  // Wdh-Steigerung an einem submaximalen Gewicht (jenseits des persönlichen
  // Bestgewichts) würdigt denselben Badge — ex.prRepsHistory[gewicht] hält
  // pro Gewicht die beste je erreichte Wdh-Zahl.
  // >= statt > (literal Spec-Text): zum Render-Zeitpunkt hat der Reducer
  // ex.prRepsHistory[gewicht] bereits auf s.reps aktualisiert (gleiche
  // Render-nach-Write-Reihenfolge wie isWeightPR/isRepsPRAtMax oben, die
  // beide ebenfalls >= statt > nutzen) — mit > würde der Badge für genau
  // den Satz, der den Rekord aufstellt, nie erscheinen.
  const isRepsPRSubmax = st === 'success' && (s.weight ?? 0) > 0 &&
                     ex.prWeight != null && (s.weight ?? 0) < ex.prWeight &&
                     ex.prRepsHistory?.[String(s.weight)] !== undefined &&
                     (s.reps ?? 0) >= ex.prRepsHistory[String(s.weight)];
  const isRepsPR   = isRepsPRAtMax || isRepsPRSubmax;
  const isPR = isWeightPR || isRepsPR;
  const effortScore   = (st === 'success' && ex.targetReps && (ex.metric === 'reps' || !ex.metric)) ? Math.round((s.reps ?? 0) / ex.targetReps * 100) : null;
  const isEffortGoal  = effortScore !== null && effortScore >= 100;
  const doneIcon = st === 'success' ? ic.check()
               : st === 'fail'    ? ic.xMark()
               : '';

  // Prev-week weight hint with directional arrow (computed before template literal)
  let _prevWeightHint = '';
  if (prevSet) {
    const _curW = s.weight ?? 0;
    let _arr = '';
    if (_curW > 0) {
      if      (_curW > (prevSet.weight ?? 0)) _arr = '<span class="w-arrow w-arrow--up">↑</span> ';
      else if (_curW < (prevSet.weight ?? 0)) _arr = '<span class="w-arrow w-arrow--dn">↓</span> ';
      else                                    _arr = '<span class="w-arrow w-arrow--eq">→</span> ';
    }
    const _pw = prevSet.weight != null ? prevSet.weight : '–';
    if (!locked) {
      _prevWeightHint = `<button type="button" class="prev-hint prev-hint--btn" data-action="adopt-prev-weight" data-di="${di}" data-ei="${ei}" data-si="${si}" data-value="${prevSet.weight ?? 0}" aria-label="Vorwoche ${_pw} kg">${_arr}${_pw}kg</button>`;
    } else {
      _prevWeightHint = `<span class="prev-hint" aria-hidden="true">${_arr}${_pw}kg</span>`;
    }
  }

  return `
<div class="set-row" role="listitem" data-di="${di}" data-ei="${ei}" data-si="${si}">

  <span class="set-idx" aria-hidden="true">${si + 1}</span>

  <div class="set-cell">
    <input class="num-input" type="number" inputmode="decimal"
      min="0" step="0.5" value="${dispW}"
      ${locked ? 'disabled' : ''}
      data-action="set-weight" data-di="${di}" data-ei="${ei}" data-si="${si}"
      placeholder=""
      aria-label="Satz ${si + 1} Gewicht in kg"
    />
    ${isWeightPR ? `<span class="pr-badge"           aria-label="Gewichts-PR! ${s.weight} kg">🏆 ${s.weight} kg</span>` : ''}
    ${isEffortGoal ? `<span class="pr-badge pr-badge--goal" aria-label="${effortScore}% Zielerfüllung">✓ ${effortScore}% Ziel</span>` : ''}
    ${_prevWeightHint}
    ${ex.showPlates && dispW > 0 ? (() => { const pl = calcPlates(dispW); return pl ? `<span class="plate-hint" aria-hidden="true" title="Scheiben je Seite">▪ ${pl}</span>` : ''; })() : ''}
  </div>

  <div class="set-cell">
    <input class="num-input" type="number" inputmode="${repMode}"
      min="0" step="${repStep}" placeholder="${ex.targetReps ?? ''}" value="${s.reps != null && s.reps !== '' ? s.reps : ''}"
      ${locked ? 'disabled' : ''}
      data-action="set-reps" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="${repAria}"
    />
    ${isRepsPR   ? `<span class="pr-badge pr-badge--reps" aria-label="Wdh-PR! ${s.reps}×">🔄 ${s.reps}×</span>` : ''}
    ${metricCellFooter}
  </div>

  <!-- RPE popover trigger (2.2) -->
  <div class="set-cell set-cell--rpe">
    ${!rpeEnabled ? '' : locked
      ? `<span class="rpe-static">${s.rpe ?? '–'}</span>${prevSet?.rpe != null ? `<span class="prev-hint" aria-hidden="true">RPE ${prevSet.rpe}</span>` : ''}`
      : (() => {
          const cur    = s.rpe ?? null;
          const label  = cur !== null ? String(cur) : '–';
          const key    = `${di}-${ei}-${si}`;
          const isOpen = _rpePopoverKey === key;
          return `<button type="button"
            class="rpe-trigger${cur !== null ? ' has-val' : ''}"
            data-action="open-rpe-popover"
            data-di="${di}" data-ei="${ei}" data-si="${si}"
            aria-label="RPE für Satz ${si + 1}: ${label}. Tippen zum Auswählen."
            aria-expanded="${isOpen}"
          >${label}</button>
          ${isOpen ? `<div class="rpe-popover">
            <div class="rpe-popover__grid">
              ${['–', 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(v => {
                const isNone = v === '–';
                const isSel  = isNone ? cur === null : cur === v;
                return `<button type="button"
                  class="rpe-popover__btn${isSel ? ' is-selected' : ''}"
                  data-action="set-rpe-val"
                  data-di="${di}" data-ei="${ei}" data-si="${si}"
                  data-val="${isNone ? '' : v}"
                  aria-pressed="${isSel}"
                  aria-label="RPE ${v}"
                >${v}</button>`;
              }).join('')}
            </div>
          </div>` : ''}
          <span class="prev-hint" aria-hidden="true">${prevSet?.rpe != null ? 'RPE ' + prevSet.rpe : ''}</span>`;
        })()
    }
  </div>

  <div class="set-done-wrap">
    <button
      class="set-done-btn${doneClass}${isPR ? ' is-pr' : ''}"
      ${locked ? 'disabled' : ''}
      data-action="toggle-done" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="Satz ${si + 1}: ${stLabel}${isPR ? ' – Bestleistung!' : ''}. Tippen für nächsten Status (offen → erfolgreich → nicht geschafft)."
    >${doneIcon}</button>
    <span class="prev-hint" aria-hidden="true"></span>
  </div>

  <button
    class="set-remove-btn"
    ${locked ? 'disabled' : ''}
    data-action="remove-set" data-di="${di}" data-ei="${ei}" data-si="${si}"
    aria-label="Satz ${si + 1} entfernen"
  >${ic.minus()}</button>

  ${!locked ? `
  <button
    class="set-note-btn${s.note ? ' has-note' : ''}"
    data-action="toggle-set-note" data-di="${di}" data-ei="${ei}" data-si="${si}"
    aria-label="Notiz zu Satz ${si + 1}${s.note ? ' (Notiz vorhanden)' : ''}"
    aria-expanded="${!!s._showNote}"
  >${ic.noteIcon()}</button>` : ''}

</div>
${s._showNote ? `
<div class="set-note-row" data-di="${di}" data-ei="${ei}" data-si="${si}">
  <input
    class="set-note-input"
    type="text"
    value="${h(s.note ?? '')}"
    placeholder="Notiz zu Satz ${si + 1} …"
    ${locked ? 'disabled' : ''}
    data-action="set-note" data-di="${di}" data-ei="${ei}" data-si="${si}"
    aria-label="Notiz zu Satz ${si + 1}"
    maxlength="120"
  />
</div>` : ''}`;
}

// ─── Body tab ────────────────────────────────────────────────────────────────

/** Körpergewichts-Verlauf: Wochendurchschnitt aus weightLog, aufsteigend.
 *  Fallback auf bodyData.weight für alte Daten (vor v29). */
function _bodyWeightHistory(state) {
  return [...state.weeks]
    .filter(w => (w.bodyData?.weightLog?.length > 0) || w.bodyData?.weight)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .map(w => {
      const log = w.bodyData.weightLog;
      if (log?.length > 0) {
        const avg = log.reduce((s, e) => s + e.weight, 0) / log.length;
        return { startDate: w.startDate, weight: Math.round(avg * 10) / 10 };
      }
      return { startDate: w.startDate, weight: w.bodyData.weight };
    });
}

/** Gewichts-Übungen der aktuellen Woche mit bekannter Bestleistung, dedupliziert nach Name. */
function _relativeStrengthExercises(state) {
  const wk = state.weeks[state.curIdx];
  if (!wk) return [];
  const map = new Map();
  for (const day of wk.days) {
    for (const ex of day.exercises) {
      if (ex.metric !== 'reps') continue;
      if (!ex.prWeight || ex.prWeight <= 0) continue;
      const cur = map.get(ex.name);
      if (cur === undefined || ex.prWeight > cur) map.set(ex.name, ex.prWeight);
    }
  }
  return [...map.entries()].map(([name, prWeight]) => ({ name, prWeight }));
}

/**
 * Nächstgelegener Körpergewichts-Eintrag zu einem Datum, max. 30 Tage
 * Abstand (sonst null — "zu weit weg, nicht mit veraltetem Gewicht rechnen").
 */
function _nearestBodyWeight(history, dateStr, maxDays = 30) {
  if (!history.length) return null;
  const target = new Date(dateStr + 'T12:00:00').getTime();
  let best = null, bestDiff = Infinity;
  for (const h of history) {
    const diff = Math.abs(new Date(h.startDate + 'T12:00:00').getTime() - target);
    if (diff < bestDiff) { bestDiff = diff; best = h; }
  }
  if (!best || bestDiff > maxDays * 86_400_000) return null;
  return best.weight;
}

/**
 * "Woche"-Modus: pro nicht-Deload/Urlaubs-Woche mit Erfolgs-Sätzen für diese
 * Übung das höchste erfolgreiche Gewicht / nächstgelegenes Körpergewicht.
 * Wochen ohne zumutbar nahes Körpergewicht (>30 Tage) werden ausgelassen.
 * @returns {Array<{date: string, ratio: number, bodyWeight: number}>}
 */
function _weeklyP4PSeries(state, exName, bwHistory) {
  const weeks = [...state.weeks]
    .filter(w => w.mode !== 'deload' && w.mode !== 'vacation')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const series = [];
  for (const wk of weeks) {
    let maxW = 0;
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.name !== exName) continue;
        for (const s of ex.sets) {
          if (s.status === 'success' && (s.weight ?? 0) > maxW) maxW = s.weight;
        }
      }
    }
    if (maxW <= 0) continue;
    const bw = _nearestBodyWeight(bwHistory, wk.startDate);
    if (bw == null || bw <= 0) continue; // kein zumutbar nahes Körpergewicht -> Lücke
    series.push({ date: wk.startDate, ratio: maxW / bw, bodyWeight: bw });
  }
  return series;
}

/**
 * "All-Time-PR"-Modus: nur echte PR-Ereignisse (kumulatives Höchstgewicht
 * steigt) erzeugen einen Datenpunkt — rekonstruiert aus den Wochendaten
 * selbst (state.prs speichert nur den AKTUELLEN PR, keine Historie aller
 * PR-Ereignisse über Zeit). Treppenstufen-Charakter ergibt sich aus der
 * Chart-Darstellung (stepped:true), nicht aus den Datenpunkten selbst.
 * @returns {Array<{date: string, ratio: number, bodyWeight: number}>}
 */
function _allTimePRSeries(state, exName, bwHistory) {
  const weeks = [...state.weeks]
    .filter(w => w.mode !== 'deload' && w.mode !== 'vacation')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const series = [];
  let runningMax = 0;
  for (const wk of weeks) {
    let maxW = 0;
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.name !== exName) continue;
        for (const s of ex.sets) {
          if (s.status === 'success' && (s.weight ?? 0) > maxW) maxW = s.weight;
        }
      }
    }
    if (maxW <= runningMax) continue; // kein neuer PR diese Woche
    runningMax = maxW;
    const bw = _nearestBodyWeight(bwHistory, wk.startDate);
    if (bw == null || bw <= 0) continue; // PR ohne zumutbar nahes Körpergewicht -> dieses Ereignis auslassen
    series.push({ date: wk.startDate, ratio: maxW / bw, bodyWeight: bw });
  }
  return series;
}

/**
 * Dynamischer Kontext-Satz unter dem Chart — Formulierung je nach Kombination
 * aus P4P-Trend und Körpergewichts-Trend im selben Zeitraum (siehe Sprint-Spec).
 * null wenn < 2 Datenpunkte.
 */
function _p4pContextSentence(name, series) {
  if (series.length < 2) return null;
  const first = series[0], last = series[series.length - 1];
  const ratioChangePct = Math.round((last.ratio - first.ratio) / first.ratio * 1000) / 10;
  const bwChangeKg = Math.round((last.bodyWeight - first.bodyWeight) * 10) / 10;
  const days = Math.round((new Date(last.date + 'T12:00:00') - new Date(first.date + 'T12:00:00')) / 86_400_000);
  const weeks = Math.max(1, Math.round(days / 7));
  const zeitraum = `${weeks} ${weeks === 1 ? 'Woche' : 'Wochen'}`;
  const pctStr = `${ratioChangePct > 0 ? '+' : ''}${ratioChangePct}%`;

  if (ratioChangePct > 0 && bwChangeKg > 0) {
    return `Relative Stärke ${name}: ${pctStr} in ${zeitraum} — trotz +${bwChangeKg}kg Körpergewicht spricht das für echten Kraftzuwachs.`;
  }
  if (ratioChangePct < 0 && bwChangeKg > 0) {
    return `Relative Stärke ${name}: ${pctStr} in ${zeitraum} — das bewegte Gewicht stieg langsamer als das Körpergewicht.`;
  }
  return `Relative Stärke ${name}: ${pctStr} in ${zeitraum}.`;
}

function _bodyTabShowsRelativeStrength(state) {
  return _bodyWeightHistory(state).length > 0 && _relativeStrengthExercises(state).length > 0;
}

function _weekAvg(week, field) {
  const vals = (week?.days ?? []).map(d => d[field]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function renderBodyTab(state) {
  const container = document.getElementById('body-tab-content');
  if (!container) return;
  const wk = state.weeks[state.curIdx];
  const bd = wk?.bodyData ?? {};
  const targetWeight = state.settings?.targetWeight;

  // ── Tägliche Gewichtsdaten ────────────────────────────────────────────────
  const todayStr   = new Date().toISOString().slice(0, 10);
  const weightLog  = Array.isArray(bd.weightLog) ? bd.weightLog : [];
  const todayEntry = weightLog.find(e => e.date === todayStr);

  // Placeholder: letzter bekannter Wert (diese Woche oder vorherige)
  const lastLogEntry = weightLog[weightLog.length - 1];
  const prevHistory  = _bodyWeightHistory(state);
  const lastKnown    = lastLogEntry?.weight ?? prevHistory[prevHistory.length - 1]?.weight ?? null;

  // Wochendurchschnitt der aktuellen Woche
  const weekAvg = weightLog.length > 0
    ? Math.round(weightLog.reduce((s, e) => s + e.weight, 0) / weightLog.length * 10) / 10
    : null;

  // Kompakter Wochenverlauf
  const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  const weekLogLine = weightLog.length > 1
    ? weightLog.map(e => {
        const d = new Date(e.date + 'T12:00:00');
        return `${DAY_SHORT[d.getDay()]} ${e.weight}`;
      }).join(' · ')
    : null;

  // Aktuelles Gewicht für Zieldiff (heutiger Eintrag > Wochenø > Legacy)
  const currWeight = todayEntry?.weight ?? weekAvg ?? bd.weight ?? null;
  const weightDiff = targetWeight && currWeight ? (targetWeight - currWeight) : null;

  // ── Sektion 1: Körpergewicht ─────────────────────────────────────────────
  const history = _bodyWeightHistory(state);
  const chartSvg = renderBodyWeightChart(history.map(p => ({ label: wkLabel(p.startDate), weight: p.weight })));
  const first = history[0] ?? null;
  const last  = history[history.length - 1] ?? null;
  const change = first && last ? Math.round((last.weight - first.weight) * 10) / 10 : null;
  const trendPct = first && last && first.weight
    ? Math.round((last.weight - first.weight) / first.weight * 1000) / 10
    : null;

  const bodyweightSectionHtml = `
  <div class="chart-card">
    <div class="chart-card__title">Körpergewicht</div>
    <div class="body-today-row">
      <span class="body-today-row__label">Heute:</span>
      <input id="body-weight-today" class="body-input" type="number" step="0.1"
        value="${todayEntry ? todayEntry.weight : ''}"
        placeholder="${lastKnown ?? '82.5'}"
        aria-label="Körpergewicht heute in kg"
        style="width:100px"
      />
      <span style="font-size:13px;color:var(--c-text-3)">kg</span>
      <button class="btn btn--accent btn--sm" data-action="log-bodyweight">Eintragen</button>
    </div>
    ${weekLogLine ? `
    <div class="body-week-log">${h(weekLogLine)}${weekAvg !== null ? ` · <strong>Ø ${weekAvg} kg</strong>` : ''}</div>` : ''}
    ${!last ? `
    <p class="empty-state__hint" style="margin-top:var(--sp-3)">Trage dein Körpergewicht ein um deine relative Stärke zu verfolgen.</p>` : `
    ${chartSvg ? `<div style="margin-top:var(--sp-3)">${chartSvg}</div>` : ''}
    <div class="body-metrics-row">
      <div class="body-metric">
        <div class="body-metric__val">${last.weight} kg</div>
        <div class="body-metric__lbl">Aktuell (Ø)</div>
      </div>
      ${change !== null ? `
      <div class="body-metric">
        <div class="body-metric__val" style="color:${change > 0 ? 'var(--c-warn)' : change < 0 ? 'var(--c-ok)' : 'var(--c-text-3)'}">${change > 0 ? '+' : ''}${change} kg</div>
        <div class="body-metric__lbl">Veränderung seit Start</div>
      </div>` : ''}
      ${trendPct !== null ? `
      <div class="body-metric">
        <div class="body-metric__val" style="color:${trendPct > 0 ? 'var(--c-warn)' : trendPct < 0 ? 'var(--c-ok)' : 'var(--c-text-3)'}">${trendPct > 0 ? '+' : ''}${trendPct}%</div>
        <div class="body-metric__lbl">Trend seit erstem Eintrag</div>
      </div>` : ''}
    </div>`}
    <div class="body-field" style="margin-top:var(--sp-3)">
      <label for="body-target-weight">Zielgewicht (kg)</label>
      <input id="body-target-weight" class="body-input" type="number" step="0.1"
        value="${targetWeight ?? ''}" placeholder="80.0"
        data-action="set-target-weight"
        aria-label="Zielgewicht in kg"
      />
      ${weightDiff !== null ? `
      <div class="body-badge" style="color:${Math.abs(weightDiff) < 0.1 ? 'var(--c-ok)' : 'var(--c-text-3)'}">
        ${Math.abs(weightDiff) < 0.1 ? '✓ Ziel erreicht!' : weightDiff > 0 ? `noch ${weightDiff.toFixed(1)} kg` : `${Math.abs(weightDiff).toFixed(1)} kg drüber`}
      </div>` : ''}
    </div>
    <div class="body-field" style="margin-top:var(--sp-2)">
      <label for="body-note">Notiz</label>
      <input id="body-note" class="body-input" type="text"
        value="${h(bd.note ?? '')}" placeholder="z. B. leichte Verspannung …"
        data-action="body-field" data-field="note"
        aria-label="Notiz zur Woche"
      />
    </div>
  </div>`;

  // ── Sektion 2: Relative Stärke (Pound-for-Pound) ─────────────────────────
  // EIN Chart, Übung per Dropdown gewählt (analog Übungsfortschritt-Dropdown
  // im Fortschritt-Tab) — ersetzt die vorige "mehrere Charts gleichzeitig"-
  // Struktur komplett. Berechnungslogik (Woche/All-Time-PR/Kontext-Satz/
  // 30-Tage-Regel) unverändert aus dem vorigen Sprint.
  let relativeStrengthHtml = '';
  if (last) {
    const exercises = _relativeStrengthExercises(state);
    if (exercises.length > 0) {
      const currentBodyWeight = last.weight;
      const daysSinceWeight = Math.floor((Date.now() - new Date(last.startDate + 'T12:00:00').getTime()) / 86_400_000);
      const isStale = daysSinceWeight > 90;
      const favSet = new Set(state.favoriteExercises ?? []);
      const withRatio = exercises.map(e => ({ ...e, ratio: e.prWeight / currentBodyWeight }))
        .sort((a, b) => b.ratio - a.ratio);
      // Favoriten zuerst (in der Dropdown-Liste) — KEIN bestehender Mechanismus
      // hierfür gefunden (das Übungsfortschritt-Dropdown sortiert rein
      // alphabetisch, keine Favoriten-Priorisierung, keine "Standard auf ersten
      // Favoriten"-Logik — Diagnose ergab beide Annahmen aus der Spec treffen
      // auf den bestehenden Code nicht zu). Neu für dieses Dropdown gebaut;
      // da Favoriten zuerst im <select> stehen, wählt der Browser per
      // Default-Verhalten (erstes <option>) automatisch den ersten Favoriten.
      const favEntries  = withRatio.filter(e => favSet.has(e.name));
      const restEntries = withRatio.filter(e => !favSet.has(e.name));
      const orderedEntries = [...favEntries, ...restEntries];

      const exOptionsHtml = orderedEntries.map(e =>
        `<option value="${h(e.name)}">${h(e.name)}${favSet.has(e.name) ? ' ⭐' : ''}</option>`
      ).join('');

      relativeStrengthHtml = `
      <div class="chart-card">
        <div class="chart-card__title">${ic.trophy()} Relative Stärke</div>
        ${isStale ? `<div class="movement-warning">Aktualisiere dein Körpergewicht für genaue Werte.</div>` : ''}
        <select class="chart-select" id="rs-ex-select" aria-label="Übung für relative Stärke wählen">
          ${exOptionsHtml}
        </select>
        <div class="weight-step-opts" style="margin:var(--sp-3) 0">
          <button type="button" class="weight-step-btn${_p4pMode === 'woche' ? ' is-selected' : ''}"
            data-action="set-p4p-mode" data-mode="woche" aria-pressed="${_p4pMode === 'woche'}"
          >Woche</button>
          <button type="button" class="weight-step-btn${_p4pMode === 'alltime' ? ' is-selected' : ''}"
            data-action="set-p4p-mode" data-mode="alltime" aria-pressed="${_p4pMode === 'alltime'}"
          >All-Time-PR</button>
        </div>
        <div class="chart-wrap" id="rs-chart-wrap"></div>
        <div id="rs-context-wrap"></div>
      </div>`;
    }
  }

  // ── Sektion 3: Schlaf & Energie ──────────────────────────────────────────
  const avgSleep  = wk ? _weekAvg(wk, 'sleepHours')  : null;
  const avgEnergy = wk ? _weekAvg(wk, 'energyLevel') : null;

  // Schlaf/Volumen-Korrelations-Insight (2.2) — jetzt auf Basis täglicher sleepHours
  const weeksWithSleep = state.weeks.filter(w => _weekAvg(w, 'sleepHours') !== null);
  let bodyInsightHtml = '';
  if (weeksWithSleep.length >= 4) {
    const avgSleepHigh = weeksWithSleep.filter(w => _weekAvg(w, 'sleepHours') >= 7.5).map(w => _trueVol(w));
    const avgSleepLow  = weeksWithSleep.filter(w => _weekAvg(w, 'sleepHours') <  7.5).map(w => _trueVol(w));
    const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const highMean = mean(avgSleepHigh), lowMean = mean(avgSleepLow);
    let insightMsg = '';
    if (avgSleepHigh.length >= 2 && avgSleepLow.length >= 2 && highMean > 0 && lowMean > 0) {
      const diff = Math.round((highMean - lowMean) / lowMean * 100);
      if (Math.abs(diff) >= 10) {
        insightMsg = diff > 0
          ? `Bei Wochen mit ≥7,5 Std. Schlaf war dein Tatsächliches Volumen durchschnittlich ${diff}% höher.`
          : `Bei wenig Schlaf (&lt;7,5 Std.) war dein Tatsächliches Volumen ${Math.abs(diff)}% höher – du arbeitest hart auch wenn müde!`;
      }
    }
    if (insightMsg) {
      bodyInsightHtml = `
      <div style="margin-top:var(--sp-3)">
        <button class="insight-toggle${_showBodyInsights ? ' is-active' : ''}"
          data-action="toggle-body-insights"
          aria-pressed="${_showBodyInsights}"
          style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--c-text-3);background:none;border:none;cursor:pointer;padding:0"
        >
          ${ic.lightbulb()} Interessante Beobachtung
        </button>
        ${_showBodyInsights ? `<div class="insight-card" style="margin-top:var(--sp-2)">${ic.lightbulb()}<span>${insightMsg}</span></div>` : ''}
      </div>`;
    }
  }

  const sleepEnergyHtml = `
  <div class="chart-card">
    <div class="chart-card__title">Schlaf & Energie</div>
    ${avgSleep === null && avgEnergy === null ? `
    <p class="empty-state__hint">Schlaf und Energie werden beim Abschließen eines Trainingstags erfasst.</p>` : `
    <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:8px">Letzte Woche</div>
    <div class="body-metrics-row">
      ${avgSleep !== null ? `<div class="body-metric"><div class="body-metric__val">😴 Ø ${avgSleep.toFixed(1)}h</div><div class="body-metric__lbl">Schlaf</div></div>` : ''}
      ${avgEnergy !== null ? `<div class="body-metric"><div class="body-metric__val">⚡ Ø ${avgEnergy.toFixed(1)}/5</div><div class="body-metric__lbl">Energie</div></div>` : ''}
    </div>`}
    ${bodyInsightHtml}
  </div>`;

  container.innerHTML = bodyweightSectionHtml + relativeStrengthHtml + sleepEnergyHtml;

  // Synchron statt requestAnimationFrame: #rs-* Elemente existieren bereits
  // nach der innerHTML-Zuweisung, keine Layout-Messung nötig (deklaratives
  // SVG mit viewBox). Vermeidet zudem unnötige rAF-Latenz beim Modus-/
  // Dropdown-Wechsel.
  _updateP4PChart(state);
  document.getElementById('rs-ex-select')?.addEventListener('change', () => {
    _updateP4PChart(getState());
  });
}

/** Aktualisiert Chart + Kontext-Satz für die im Dropdown gewählte Übung,
 * ohne den Rest des Körper-Tabs neu zu rendern (analog _updateExChart). */
function _updateP4PChart(state) {
  const sel        = document.getElementById('rs-ex-select');
  const chartWrap  = document.getElementById('rs-chart-wrap');
  const contextWrap = document.getElementById('rs-context-wrap');
  if (!sel || !chartWrap || !contextWrap) return;
  const name = sel.value;
  const bwHistory = _bodyWeightHistory(state);
  const series = _p4pMode === 'alltime'
    ? _allTimePRSeries(state, name, bwHistory)
    : _weeklyP4PSeries(state, name, bwHistory);
  const chartSvg = renderRelativeStrengthChart(
    series.map(p => ({ label: wkLabel(p.date), ratio: p.ratio })),
    { stepped: _p4pMode === 'alltime' }
  );
  chartWrap.innerHTML = chartSvg
    ? chartSvg
    : '<p class="empty-state__hint">Noch nicht genug Datenpunkte für einen Verlauf.</p>';
  const contextSentence = _p4pContextSentence(name, series);
  contextWrap.innerHTML = contextSentence ? `<p class="rs-context">${h(contextSentence)}</p>` : '';
}

// ─── Tatsächliches Volumen helper (only success sets) ────────────────────────
function _trueVol(week) {
  return week.days.reduce((s, d) =>
    s + d.exercises.reduce((ss, ex) =>
      ss + ex.sets.filter(st => st.status === 'success').reduce((sss, st) =>
        sss + (st.weight ?? 0) * (st.reps ?? 0), 0), 0), 0);
}

// ─── Weekly Success Score: success / (success + fail), pending excluded ───────
// Delegiert an setUtils.js (Konsolidierung 2026-07-14 — war vorher hier UND
// in weekReview.js unabhängig dupliziert, siehe setUtils.js-Kommentar).
function _weekSuccessScore(week) {
  return weekSuccessCounts(week);
}


// ─── Analysis tab ─────────────────────────────────────────────────────────────

function _avgRepsLast4(exName, allWeeks) {
  const sorted = [...allWeeks]
    .filter(w => (w.mode ?? 'standard') !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const repsSum = [];
  for (const wk of sorted.slice(-4)) {
    for (const day of wk.days) {
      const ex = day.exercises.find(e => e.name === exName);
      if (!ex) continue;
      const ok = ex.sets.filter(s => s.status === 'success' && (s.reps ?? 0) > 0).map(s => parseFloat(s.reps) || 0);
      if (ok.length) repsSum.push(Math.round(ok.reduce((a, b) => a + b, 0) / ok.length));
    }
  }
  return repsSum.length ? Math.round(repsSum.reduce((a, b) => a + b) / repsSum.length) : null;
}

function _relDate(startDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(startDate + 'T00:00:00');
  const diffDays = Math.round((today - weekStart) / 86_400_000);
  if (diffDays < 7)  return 'Diese Woche';
  if (diffDays < 14) return 'Letzte Woche';
  const weeks = Math.floor(diffDays / 7);
  return `Vor ${weeks} Wochen`;
}

function _renderMovementPattern(state) {
  const RADAR_CATS = ['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core'];
  const customCatMap = buildCategoryMap(state.customExercises);

  // ── Balken: letzte 4 Wochen (ohne Deload) ────────────────────────────────
  const last4 = [...state.weeks]
    .filter(w => w.mode !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-4);
  if (!last4.length) return '';
  const catSets = {};
  let totalSets = 0;
  for (const wk of last4) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.archived) continue;
        const baseName = ex.substituteFor ?? ex.name;
        const cat = resolveCategory(baseName, customCatMap);
        // B22: success+fail zählen (pending ausgeschlossen) statt nur success —
        // fail-Sätze sollen in der Kategorie-Verteilung sichtbar bleiben statt
        // komplett zu verschwinden.
        const n = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').length;
        if (!n) continue;
        catSets[cat] = (catSets[cat] ?? 0) + n;
        totalSets += n;
      }
    }
  }
  if (!totalSets) return '';
  const catPct = {};
  for (const c of RADAR_CATS) catPct[c] = totalSets > 0 ? Math.round((catSets[c] ?? 0) / totalSets * 100) : 0;

  const maxPct = Math.max(...RADAR_CATS.map(c => catPct[c]), 1);
  const chartHtml = RADAR_CATS.map(cat => {
    const pct = catPct[cat];
    return `<div class="mg-bar-row">
      <span class="mg-bar-label">${cat}</span>
      <div class="mg-bar-wrap"><div class="mg-bar" style="width:${pct ? Math.round(pct / maxPct * 100) : 0}%"></div></div>
      <span class="mg-bar-val">${pct ? pct + '%' : '—'}</span>
    </div>`;
  }).join('');

  // ── Push/Pull-Ratio: erkenntnisseHorizont Wochen ─────────────────────────
  const horizont = state.settings?.erkenntnisseHorizont ?? 8;
  const lastN = [...state.weeks]
    .filter(w => w.mode !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-horizont);
  let pushSets = 0, pullSets = 0;
  for (const wk of lastN) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.archived) continue;
        const baseName = ex.substituteFor ?? ex.name;
        const cat = resolveCategory(baseName, customCatMap);
        const n = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').length;
        if (cat === 'Push') pushSets += n;
        else if (cat === 'Pull') pullSets += n;
      }
    }
  }

  let ratioHtml = '';
  if (pushSets > 0 && pullSets > 0) {
    const dominant  = pushSets >= pullSets ? 'Push' : 'Pull';
    const dominated = dominant === 'Push' ? 'Pull' : 'Push';
    const ratio     = Math.round(Math.max(pushSets, pullSets) / Math.min(pushSets, pullSets) * 10) / 10;
    let ratioText;
    if (ratio <= 1.1) {
      ratioText = 'Dein Push/Pull-Verhältnis ist ausgeglichen — gut für die Schultergesundheit.';
    } else if (ratio <= 1.4) {
      ratioText = `Dein Push/Pull-Verhältnis ist ${ratio.toFixed(1)}:1 — leicht ${dominant}-lastig. Für Schultergesundheit wäre ≤1:1 ideal.`;
    } else {
      ratioText = `Dein Push/Pull-Verhältnis ist ${ratio.toFixed(1)}:1 — deutlich ${dominant}-lastig. Mehr ${dominated}-Übungen könnten Dysbalancen vorbeugen.`;
    }
    ratioHtml = `<p class="erkenntnis-line" style="margin-top:var(--sp-3)">${h(ratioText)}</p>`;
  }

  return `<div class="chart-card">
    <div class="chart-card__title">Bewegungsmuster</div>
    <p style="font-size:11px;color:var(--c-text-3);margin-bottom:var(--sp-3)">Letzte 4 Wochen (ohne Deload)</p>
    ${chartHtml}
    ${ratioHtml}
  </div>`;
}

function _renderAnalysis1RM(name, state) {
  const pr = state.prs?.[name];
  if (pr?.maxEstimated1RM > 0) {
    return `<div class="orm-hint orm-hint--analysis">~${pr.maxEstimated1RM.toFixed(1)} kg geschätzter 1RM</div>`;
  }
  const allSets = state.weeks
    .filter(w => w.mode !== 'deload')
    .flatMap(w => w.days.flatMap(d =>
      d.exercises
        .filter(ex => ex.name === name || ex.substituteFor === name)
        .flatMap(ex => {
          // B31-Fix: war 'kg' (nie ein gültiger ex.metric-Wert, Bedingung
          // dadurch praktisch immer wahr → Fallback lieferte nie Daten,
          // v.a. bei Ausweichübungen leer). 1RM-Schätzung ergibt nur für
          // gewichtsgetrackte Übungen (metric 'reps') Sinn.
          if (ex.metric && ex.metric !== 'reps') return [];
          return ex.sets
            .filter(s => s.status === 'success' && (s.reps ?? 0) >= 1 && (s.reps ?? 0) <= 10 && (s.weight ?? 0) > 0)
            .map(s => ({ w: s.weight, r: s.reps, est: s.weight * (1 + s.reps / 30) }));
        })
    ));
  if (!allSets.length) return '';
  const best = allSets.reduce((mx, s) => s.est > (mx?.est ?? 0) ? s : mx, null);
  if (!best) return '';
  return `<div class="orm-hint orm-hint--analysis">~${best.est.toFixed(1)} kg geschätzter 1RM <span class="orm-hint__basis">(Epley · ${best.w} kg × ${best.r} Wdh)</span></div>`;
}

function _noAnalysisDataHtml() {
  return `
    <div class="empty-state">
      <div class="empty-state__icon">📊</div>
      <p class="empty-state__text">Noch keine Daten vorhanden.<br>Schließe deine erste Trainingswoche ab um hier Auswertungen zu sehen.</p>
    </div>`;
}

function _hasAnyTrainingData(state) {
  return state.weeks.some(w =>
    w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success' || s.status === 'fail')))
  );
}

// consistencyQuality/pushPullImbalance entfernt, Sprint "Coach-Tab
// Architektur" — beide Status können seit der Trennung Akut/Strukturell
// nicht mehr von computeWeeklyFocus() zurückgegeben werden (nur noch von
// computeStructuralSignals(), das eigene Icons je Signal-Typ nutzt, siehe
// _structuralSignalHtml() unten).
const _FOCUS_ICONS = {
  reentry:            '🔄',
  persistent_failure: '🛑',
  overload:           '🔋',
  pre_plateau:        '📈',
  consistencyGap:     '📅',
  plateau:            '⚠️',
  progression:        '💪',
  onTrack:            '✅',
};

// Icons/Kurztexte je strukturellem Signal-Typ (computeStructuralSignals()) —
// bewusst eigenständige, kurze Formulierungen statt Wiederverwendung von
// headline/reasoning/recommendation: die Strukturkarte ist optisch sekundär
// und braucht keinen "Warum?"-Collapse (siehe renderCoachTab()).
function _structuralSignalHtml(sig) {
  if (sig.type === 'multi_exercise_failure') {
    const names = sig.worst
      .map(w => w.suggestedWeight != null ? `${w.name} (~${w.suggestedWeight}kg)` : w.name)
      .join(', ');
    return { icon: '🛑', text: `Erfolgsquote insgesamt nur ${sig.rate}% — am stärksten betroffen: ${names}.` };
  }
  if (sig.type === 'deload_preventive') {
    return { icon: '🔄', text: `${sig.weeksSince} Wochen ohne Deload — Regenerationswoche einplanen.` };
  }
  if (sig.type === 'consistency_quality') {
    return { icon: '📉', text: 'Häufiger trainieren hilft gerade nicht — Qualität sinkt.' };
  }
  if (sig.type === 'push_pull') {
    return sig.dominant === 'Push'
      ? { icon: '⚖️', text: 'Push-lastig — mehr Pull-Übungen für Schultergesundheit.' }
      : { icon: '⚖️', text: 'Pull-lastig — mehr Push-Übungen für Balance.' };
  }
  return null;
}

// ─── Decision outcome check ───────────────────────────────────────────────────
// Prüft ob für offene Einträge (outcome===null) bereits ≥2 Wochen im State
// NACH decidedWeekStart vorhanden sind, und befüllt das Ergebnis.
// Wochen-basiert (nicht Systemzeit) damit die Simulation via Wochen-Anlegen
// funktioniert. Läuft in ui.js weil signalPersisted computeWeeklyFocus()
// braucht (circular dep verhindert Aufruf aus state.js).
function _checkDecisionOutcomes(state) {
  if (!Array.isArray(state.decisionLog)) return;
  const pending = state.decisionLog.filter(e => e.outcome === null);
  if (!pending.length) return;

  const currentStatus = computeWeeklyFocus(state).status;
  const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const _d = new Date();
  const _dow = _d.getDay();
  _d.setDate(_d.getDate() + (_dow === 0 ? -6 : 1 - _dow));
  const measuredWeekStart = _d.toISOString().slice(0, 10);

  const _avg = (weeks) => {
    const scored = weeks.map(w => _weekSuccessScore(w)).filter(s => s.total > 0);
    return scored.length > 0 ? Math.round(scored.reduce((a, s) => a + s.pct, 0) / scored.length) : 0;
  };

  for (const entry of pending) {
    const afterWeeks = sorted.filter(w => w.startDate > entry.decidedWeekStart);
    if (afterWeeks.length < 2) continue;

    const beforeWeeks = sorted.filter(w => w.startDate < entry.decidedWeekStart).slice(-2);

    dispatch(A.DECISION_LOG_OUTCOME, {
      id: entry.id,
      outcome: {
        measuredWeekStart,
        signalPersisted: currentStatus === entry.type,
        successRateBefore: _avg(beforeWeeks),
        successRateAfter:  _avg(afterWeeks.slice(0, 2)),
      },
    });
  }

  // ── Coach performance measurement ──────────────────────────────────────────
  const _perf = state.coachPerformance;
  if (_perf?.suggestions?.length) {
    const _pendingPerf = _perf.suggestions.filter(
      s => s.outcome === null && s.status === 'progression'
    );
    if (_pendingPerf.length) {
      const _sortedNonSeed = [...state.weeks]
        .filter(w => !w.isSeedWeek)
        .sort((a, b) => a.startDate.localeCompare(b.startDate));
      for (const _entry of _pendingPerf) {
        const _followWeek = _sortedNonSeed.find(wk => wk.startDate > _entry.weekStart);
        if (!_followWeek) continue;
        const _exSets = [];
        for (const d of _followWeek.days)
          for (const ex of d.exercises)
            if (ex.name === _entry.exerciseName)
              _exSets.push(...ex.sets);
        let _followed = null;
        let _outcome  = null;
        if (_exSets.length > 0 && _entry.fromWeight !== null && _entry.suggestedDelta !== null) {
          const _targetWeight = _entry.fromWeight + _entry.suggestedDelta;
          const _maxWeight = Math.max(..._exSets.map(s => s.weight ?? 0));
          if (_maxWeight >= _targetWeight - 0.01) {
            _followed = true;
            const _atTarget = _exSets.filter(s => (s.weight ?? 0) >= _targetWeight - 0.01);
            _outcome = _atTarget.some(s => s.status === 'success') ? 'success' : 'partial';
          } else {
            _followed = false;
            _outcome  = 'fail';
          }
        }
        dispatch(A.COACH_PERF_MEASURE, {
          id:               _entry.id,
          followed:         _followed,
          outcome:          _outcome,
          measuredWeekStart: _followWeek.startDate,
        });
      }
    }
  }

  // ── coachQuestion Outcome-Messung ───────────────────────────────────────────
  const _cq = state.coachQuestion;
  if (_cq?.answer != null && _cq.outcome === null && _cq.weekStart) {
    const _cqNonSeed = [...state.weeks]
      .filter(w => !w.isSeedWeek)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const _cqFollowWk = _cqNonSeed.find(w => w.startDate > _cq.weekStart);
    if (_cqFollowWk) {
      const _cqFakeState = {
        ...state,
        weeks: _cqNonSeed.filter(w => w.startDate <= _cqFollowWk.startDate),
      };
      let _cqFocusStatus = 'onTrack';
      try { _cqFocusStatus = computeWeeklyFocus(_cqFakeState).status; } catch {}

      let _cqOutcome = 'unclear';

      if (_cq.questionId === 'pre_plateau_subjective') {
        const _neg = _cqFocusStatus === 'plateau' || _cqFocusStatus === 'overload';
        if (_cq.answer === 'yes') _cqOutcome = _neg ? 'confirmed' : 'not_confirmed';
        else if (_cq.answer === 'no') _cqOutcome = _neg ? 'not_confirmed' : 'confirmed';

      } else if (_cq.questionId === 'progression_feeling') {
        const _prevWk = _cqNonSeed.filter(w => w.startDate < _cqFollowWk.startDate).at(-1);
        let _hadIncrease = false;
        if (_prevWk) {
          for (const _d of _cqFollowWk.days) {
            if (_hadIncrease) break;
            for (const _ex of _d.exercises) {
              const _prevEx = _prevWk.days.flatMap(dd => dd.exercises).find(e => e.name === _ex.name);
              if (!_prevEx) continue;
              const _prevMax = Math.max(0, ..._prevEx.sets.map(s => s.weight ?? 0));
              const _succMax = Math.max(0, ..._ex.sets.filter(s => s.status === 'success').map(s => s.weight ?? 0));
              if (_succMax > _prevMax) { _hadIncrease = true; break; }
            }
          }
        }
        if (_cq.answer === 'good')  _cqOutcome = _hadIncrease ? 'confirmed' : 'unclear';
        else if (_cq.answer === 'tired') _cqOutcome = _hadIncrease ? 'not_confirmed' : 'confirmed';

      } else if (_cq.questionId === 'plateau_outcome') {
        const _stillPlateau = _cqFocusStatus === 'plateau';
        if (_cq.answer === 'helped')      _cqOutcome = _stillPlateau ? 'not_confirmed' : 'confirmed';
        else if (_cq.answer === 'not_helped') _cqOutcome = _stillPlateau ? 'confirmed' : 'not_confirmed';
      }

      dispatch(A.COACH_QUESTION_OUTCOME, {
        outcome:           _cqOutcome,
        measuredWeekStart: _cqFollowWk.startDate,
      });
    }
  }
}

// ─── Decision history conclusion ──────────────────────────────────────────────
// Baut den Schlussfolgerungs-Text aus abgeschlossenen Einträgen gleichen Typs.
// entries: decisionLog-Einträge mit outcome !== null, gefiltert auf denselben Typ.
function _decisionHistoryConclusion(entries) {
  if (!entries.length) return '';
  const N = entries.length;
  if (N === 1) {
    const label = entries[0].choice === 'stay' ? 'Weiter wie bisher' : 'der Empfehlung gefolgt';
    return `Letztes Mal hast du bei diesem Signal ${label}.`;
  }
  let stayWorked = 0, stayFailed = 0, changeWorked = 0;
  for (const e of entries) {
    const o = e.outcome;
    if (e.choice === 'stay' && o.signalPersisted === false && o.successRateAfter >= o.successRateBefore) stayWorked++;
    else if (e.choice === 'stay' && (o.signalPersisted === true || o.successRateAfter < o.successRateBefore - 5)) stayFailed++;
    else if (e.choice === 'change' && o.signalPersisted === false) changeWorked++;
  }
  const majority = N / 2;
  if (N >= 3) {
    if (stayWorked > majority) return `Weitertrainieren hat bei dir ${stayWorked}-mal funktioniert — das Signal verschwand danach.`;
    if (stayFailed > majority) return `Weitertrainieren hat bei dir ${stayFailed}-mal das Signal nicht behoben.`;
    if (changeWorked > majority) return `Die Empfehlung hat bei dir ${changeWorked}-mal funktioniert.`;
  } else {
    if (stayWorked > majority) return `Bei deinen ${stayWorked} bisherigen Malen hat Weitertrainieren funktioniert — das Signal verschwand danach.`;
    if (stayFailed > majority) return `Bei deinen ${stayFailed} bisherigen Malen hat Weitertrainieren das Signal nicht behoben.`;
    if (changeWorked > majority) return `Die Empfehlung hat bei dir ${changeWorked}-mal funktioniert.`;
  }
  return `Du hast dieses Signal ${N}-mal erlebt — die Ergebnisse waren gemischt.`;
}

// ─── Coach tab: einzige Komponente ist die "Fokus der Woche"-Karte. Sie
// verdichtet Wiedereinstieg/Überlastung/Konsistenz-Engpass/Plateau/
// Progression (in dieser Priorität, siehe weeklyFocus.js) zu EINER Aussage.
// Plateau-Erkennung wird hier nicht zusätzlich/dupliziert dargestellt —
// computeWeeklyFocus() ruft detectPlateaus() 1:1 wiederverwendet auf,
// dieselbe Funktion die auch der Wochenrückblick nutzt.

function _coachPerfSummaryHtml(state) {
  const measured = (state.coachPerformance?.suggestions ?? [])
    .filter(s => s.status === 'progression' && s.outcome !== null);
  if (measured.length < 5) return '';
  const N        = measured.length;
  const succCount = measured.filter(s => s.outcome === 'success').length;
  const pct      = Math.round(succCount / N * 100);
  const text = pct > 75
    ? `🎯 Coach-Trefferquote: ${pct}% (${N} Fälle)`
    : pct >= 50
    ? `📊 Coach-Trefferquote: ${pct}% (${N} Fälle)`
    : `📊 Coach sammelt noch Daten (${N} Fälle)`;
  return `
  <div class="coach-perf-summary">
    <span class="coach-perf-summary__text">${h(text)}</span>
    <button type="button" class="coach-perf-summary__link" data-action="coach-perf-details">Details →</button>
  </div>`;
}

function _plateauActionFeedbackHtml(fb) {
  const text = fb.action === 'implemented'
    ? `✓ ${fb.exerciseName}: Strategie als umgesetzt markiert. TRAIN prüft in einer Woche ob sie geholfen hat.`
    : `Plateau bei ${fb.exerciseName} ausgeblendet. TRAIN meldet sich wieder wenn sich etwas ändert.`;
  return `
  <div class="chart-card coach-focus-card">
    <div class="chart-card__title">📋 Fokus der Woche</div>
    <p class="coach-plateau-feedback">${h(text)}</p>
  </div>`;
}

function _buildCoachQuestionCard(state, focus) {
  const curWkStart = getLatestWeek(state.weeks)?.startDate ?? null;
  const cq = state.coachQuestion;
  if (cq?.weekStart === curWkStart && cq?.answer != null) return '';

  let qid, questionText, options;

  if (focus.status === 'pre_plateau') {
    qid = 'pre_plateau_subjective';
    questionText = `Fühlt sich ${h(focus.exerciseName ?? '')} subjektiv schwerer an als noch vor ein paar Wochen?`;
    options = [
      { answer: 'yes', label: 'Ja, deutlich anstrengender' },
      { answer: 'no',  label: 'Nein, fühlt sich normal an' },
    ];
  } else if (focus.status === 'progression' && focus.confidence === 'medium') {
    qid = 'progression_feeling';
    questionText = `Wie hat sich dein letztes Training bei ${h(focus.exerciseName ?? '')} angefühlt?`;
    options = [
      { answer: 'good',  label: 'Gut — hätte mehr gehen' },
      { answer: 'okay',  label: 'Anstrengend aber okay' },
      { answer: 'tired', label: 'Erschöpfend' },
    ];
  } else if (focus.status === 'plateau') {
    const exName = focus.plateau?.exerciseName;
    if (!exName) return '';
    const action = (state.plateauActions ?? {})[exName];
    if (action?.action !== 'implemented') return '';
    const sinceMs = new Date(action.since + 'T00:00:00').getTime();
    const curMs   = curWkStart ? new Date(curWkStart + 'T00:00:00').getTime() : 0;
    if (curMs - sinceMs < 7 * 86_400_000) return '';
    qid = 'plateau_outcome';
    questionText = `Hat die Strategie bei ${h(exName)} geholfen?`;
    options = [
      { answer: 'helped',     label: 'Ja — ich konnte steigern' },
      { answer: 'needs_time', label: 'Noch nicht — brauche mehr Zeit' },
      { answer: 'not_helped', label: 'Nein — funktioniert nicht' },
    ];
  } else {
    return '';
  }

  // Show confirmation hint if last answered question with same type was confirmed
  const _cqHist  = state.coachQuestionHistory ?? [];
  const _lastSame = [..._cqHist].reverse().find(e => e.questionId === qid);
  const _confirmedHint = _lastSame?.outcome === 'confirmed'
    ? ' <span class="coach-question__hint">Letztes Mal hat diese Einschätzung gestimmt.</span>'
    : '';

  const btns = options.map(o =>
    `<button type="button" class="btn btn--ghost btn--sm coach-question__btn"
      data-action="coach-answer"
      data-qid="${h(qid)}"
      data-week="${h(curWkStart ?? '')}"
      data-answer="${h(o.answer)}">${h(o.label)}</button>`
  ).join('');

  return `
  <div class="chart-card coach-question-card">
    <div class="coach-question__text">${questionText}${_confirmedHint}</div>
    <div class="coach-question__options">${btns}</div>
  </div>`;
}

function renderCoachTab(state) {
  const container = document.getElementById('coach-tab-content');
  if (!container) return;

  if (!_hasAnyTrainingData(state)) {
    container.innerHTML = _noAnalysisDataHtml();
    return;
  }

  if (_plateauActionFeedback) {
    container.innerHTML = _plateauActionFeedbackHtml(_plateauActionFeedback);
    return;
  }

  _checkDecisionOutcomes(state);

  const focus   = computeWeeklyFocus(state);

  // Log progression suggestion if not already logged this week
  if (focus.status === 'progression' && focus.exerciseName) {
    const _logWkStart = getLatestWeek(state.weeks)?.startDate;
    const _alreadyLogged = (state.coachPerformance?.suggestions ?? [])
      .some(s => s.weekStart === _logWkStart && s.exerciseName === focus.exerciseName);
    if (_logWkStart && !_alreadyLogged) {
      dispatch(A.COACH_PERF_LOG, {
        weekStart:       _logWkStart,
        status:          focus.status,
        exerciseName:    focus.exerciseName,
        suggestedDelta:  focus.suggestedDelta ?? null,
        fromWeight:      focus.fromWeight     ?? null,
        confidenceLevel: focus.confidence     ? focus.confidence.toUpperCase() : null,
      });
    }
  }

  const icon    = _FOCUS_ICONS[focus.status] ?? _FOCUS_ICONS.onTrack;
  const balance = buildDecisionalBalance(focus);

  const _renderOption = (opt) => `
    <div class="coach-balance-option">
      <div class="coach-balance-option__label">${h(opt.label)}</div>
      ${opt.pros.map(p => `<div class="coach-balance-pro">+ ${h(p)}</div>`).join('')}
      ${opt.cons.map(c => `<div class="coach-balance-con">− ${h(c)}</div>`).join('')}
    </div>`;

  // Directive — WAS in einem Satz (erstes Inhaltselement, prominent).
  // Fällt auf focus.reasoning zurück bevor der generische Platzhalter greift
  // (z.B. onTrack/_fallback() liefert nie eine recommendation, aber immer
  // eine informative reasoning wie "Du baust gerade deine Datenbasis auf.").
  const directive = focus.recommendation ?? focus.reasoning ?? 'Trainiere wie geplant weiter.';

  // Konfidenz-Anzeige — nur bei progression (messbare Erfolgswahrscheinlichkeit)
  const confidenceHtml = focus.status === 'progression' ? (() => {
    const _CONF = {
      high:   { text: 'Erfolgswahrscheinlichkeit hoch',                               cls: 'coach-confidence--high'   },
      medium: { text: 'Erfolgswahrscheinlichkeit mittel',                              cls: 'coach-confidence--medium' },
      low:    { text: 'Erfolgswahrscheinlichkeit niedrig — Gewicht halten wäre sicherer', cls: 'coach-confidence--low' },
    };
    const conf = _CONF[focus.confidence] ?? _CONF.low;
    const dataHint = (focus.dataWeeks ?? 4) < 4
      ? `<div class="coach-data-hint">Basiert auf ${focus.dataWeeks} Wochen Daten</div>` : '';
    return `<div class="coach-confidence ${h(conf.cls)}">● ${h(conf.text)}</div>${dataHint}`;
  })() : '';

  // Aktive Entscheidung aus decisionLog (Button-Zustand + Hinweis)
  const activeDecision = balance ? (state.decisionLog ?? [])
    .filter(e => e.type === focus.status && e.outcome === null)
    .at(-1) : null;
  const stayClass   = activeDecision?.choice === 'stay'   ? ' is-selected' : activeDecision ? ' is-dimmed' : '';
  const changeClass = activeDecision?.choice === 'change' ? ' is-selected' : activeDecision ? ' is-dimmed' : '';
  const hintHtml = activeDecision ? (() => {
    const dateStr = new Date(activeDecision.decidedWeekStart + 'T00:00:00')
      .toLocaleDateString('de-DE', { day: 'numeric', month: 'long' });
    return `<p class="coach-decision-hint">Entscheidung vom ${h(dateStr)} gespeichert — Ergebnis wird nach 2 weiteren Wochen gemessen.</p>`;
  })() : '';

  // Aktions-Buttons AUSSERHALB von <details> — immer sichtbar wenn balance vorhanden
  // B26: persistent_failure bekommt eigene Button-Beschriftung (exakte
  // Formulierung aus der Sprint-Spec), ohne die generische Beschriftung für
  // overload/consistencyGap anzufassen — sonst hätte ein Umstieg auf
  // balance.stayOption.label/changeOption.label die Buttons dort unbeabsichtigt
  // mitgeändert (deren label-Texte sind länger/anders formuliert als die
  // bisherige Button-Beschriftung, siehe _balanceForOverload/ConsistencyGap).
  const _stayBtnLabel   = focus.status === 'persistent_failure' ? 'Weiter wie bisher versuchen'   : 'Weiter wie bisher';
  const _changeBtnLabel = focus.status === 'persistent_failure' ? 'Gewicht reduzieren (Empfehlung)' : 'Empfehlung folgen';
  const decisionBtnsHtml = balance ? `
  <div class="coach-decision-btns">
    <button type="button" class="btn btn--ghost btn--sm${stayClass}"
      data-action="decision-log-stay"
      data-type="${h(focus.status)}"
      data-signal="${h(focus.reasoning)}">${h(_stayBtnLabel)}</button>
    <button type="button" class="btn btn--ghost btn--sm${changeClass}"
      data-action="decision-log-change"
      data-type="${h(focus.status)}"
      data-signal="${h(focus.reasoning)}">${h(_changeBtnLabel)}</button>
  </div>
  ${hintHtml}` : '';

  // "Warum?"-Collapse — bei onTrack nur wenn reasoning zusätzliche Info über
  // die bereits als directive angezeigte hinaus enthält (sonst wäre der
  // Collapse eine reine Wiederholung der Directive ohne Mehrwert).
  const whyHtml = (focus.status !== 'onTrack' || (focus.reasoning != null && focus.reasoning !== directive)) ? (() => {
    const relevantHistory = (state.decisionLog ?? [])
      .filter(e => e.type === focus.status && e.outcome !== null);
    const historyText = _decisionHistoryConclusion(relevantHistory);
    const historyHtml = historyText
      ? `<p class="coach-decision-history">${h(historyText)}</p>` : '';
    const balanceBodyHtml = balance ? `
      ${_renderOption(balance.stayOption)}
      ${_renderOption(balance.changeOption)}
      <p class="coach-balance-closing">${h(balance.closing)}</p>` : '';
    return `
    <details class="coach-why-collapse">
      <summary class="pr-collapse__summary">Warum? ▾</summary>
      <div class="pr-collapse__body">
        <p class="coach-focus-reasoning">${h(focus.reasoning)}</p>
        ${historyHtml}
        ${balanceBodyHtml}
      </div>
    </details>`;
  })() : '';

  // Plateau-Aktionen: unverändert (Sprint C2, train-v109)
  const plateauActionsHtml = focus.status === 'plateau' ? `
    <div class="coach-plateau-actions">
      <button type="button" class="btn btn--ghost btn--sm" data-action="plateau-implemented" data-ex="${h(focus.plateau.exerciseName)}" data-pw="${focus.plateau.plateauWeeks}">
        ✓ Habe ich umgesetzt
      </button>
      <button type="button" class="btn btn--ghost btn--sm" data-action="plateau-ignore" data-ex="${h(focus.plateau.exerciseName)}" data-pw="${focus.plateau.plateauWeeks}">
        Ignorieren
      </button>
    </div>` : '';

  // Strukturkarte: unabhängig von focus/Hauptkarte — computeStructuralSignals()
  // liefert 0-2 Signale, die parallel zur Hauptkarte relevant sind (kein
  // "erstes gewinnt" wie bei computeWeeklyFocus(), siehe weeklyFocus.js).
  // Dezent, kein "Warum?"-Collapse, kein Aktions-Button — strukturelle
  // Hinweise brauchen keine wöchentliche Entscheidung.
  const structuralSignals = computeStructuralSignals(state);
  const structuralCardHtml = structuralSignals.length ? `
  <div class="coach-structural-card">
    ${structuralSignals.map(sig => {
      const item = _structuralSignalHtml(sig);
      if (!item) return '';
      return `<div class="coach-structural-item">
        <span class="coach-structural-icon">${item.icon}</span>
        <span class="coach-structural-text">${h(item.text)}</span>
      </div>`;
    }).join('')}
  </div>` : '';

  const questionCardHtml  = _buildCoachQuestionCard(state, focus);
  const perfSummaryHtml   = _coachPerfSummaryHtml(state);
  container.innerHTML = `
  <div class="chart-card coach-focus-card">
    <div class="chart-card__title">📋 Fokus der Woche</div>
    <div class="coach-focus-status">${icon} ${h(focus.headline)}</div>
    <p class="coach-focus-directive">${h(directive)}</p>
    ${confidenceHtml}
    ${decisionBtnsHtml}
    ${whyHtml}
    ${plateauActionsHtml}
  </div>
  ${structuralCardHtml}
  ${perfSummaryHtml}
  ${questionCardHtml}`;

  if (_whyWasOpen) {
    const whyElAfter = document.querySelector('.coach-why-collapse');
    if (whyElAfter) whyElAfter.open = true;
    _whyWasOpen = false;
  }
}

/**
 * Vier Dimensionen (Qualität, Konsistenz, Volumen, Breite) als reine
 * Feststellung über ALLE Übungen — keine Handlungsempfehlung (die bleibt
 * im Coach-Tab). Berechnungslogik in overallPerformance.js (pure, kein
 * State, keine Persistierung) UNVERÄNDERT seit dem Gesamtperformance-
 * Sprint — diese Funktion liefert seit dem Erkenntnisse-Zusammenführungs-
 * Sprint nur noch die reinen Absatz-Texte (Array), keinen eigenen
 * <div class="chart-card">-Wrapper mehr, da die Karte jetzt von der
 * gemeinsamen Erkenntnisse-Sektion gestellt wird.
 * @returns {string[]}
 */
function _erkenntnisseHorizontLabel(N) {
  const months = Math.round(N / 4.33);
  const approx = months === 1 ? '~1 Monat'
    : months === 3 ? '~1 Quartal'
    : months === 6 ? '~6 Monate'
    : months === 12 ? '~1 Jahr'
    : `~${months} Monate`;
  return `Letzte ${N} Wochen (${approx})`;
}

function _overallPerformanceParagraphs(state, N = 8) {
  const sortedWeeks = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const scoredWeeks = sortedWeeks.map(w => _weekSuccessScore(w));

  const quality     = computeQualityTrend(scoredWeeks, N);
  const consistency = computeConsistencyTrend(state, N);
  const volume      = computeVolumeTrend(state, N);
  const breadth     = computeBreadthProgress(state, N);

  const paragraphs = [];

  // 1. Qualität
  if (quality) {
    const dir = quality.direction === 'up' ? 'gestiegen' : quality.direction === 'down' ? 'gesunken' : 'stabil geblieben';
    paragraphs.push(quality.prevPct === null
      ? `Deine Erfolgsquote über alle Übungen liegt aktuell bei ${quality.curPct}%.`
      : `Deine Erfolgsquote über alle Übungen ist in den letzten ${quality.halfN} Wochen von ${quality.prevPct}% auf ${quality.curPct}% ${dir}.`);
  }

  // 2. Konsistenz
  if (consistency) {
    let line = `Du hast in den letzten ${consistency.N} Wochen ${consistency.curPct}% deiner geplanten Trainingstage absolviert.`;
    if (consistency.direction !== null) {
      const dir = consistency.direction === 'up' ? 'steigend' : consistency.direction === 'down' ? 'sinkend' : 'stabil';
      line += ` Der Trend ist ${dir}.`;
    }
    paragraphs.push(line);
  }

  // 3. Volumen
  if (volume) {
    let line;
    if (volume.pct === null) {
      line = `Dein Gesamtvolumen liegt aktuell bei ${Math.round(volume.curVol).toLocaleString('de-DE')}kg pro ${volume.halfN}-Wochen-Block.`;
    } else {
      const dir  = volume.direction === 'up' ? 'gestiegen' : volume.direction === 'down' ? 'gesunken' : 'stabil geblieben';
      const sign = volume.pct > 0 ? '+' : '';
      line = `Dein Gesamtvolumen ist in den letzten ${volume.halfN} Wochen um ${sign}${volume.pct}% ${dir}.`;
    }
    if (volume.hasRelative) {
      line += ` Dazu kommen ${volume.relSetsAvg} Sätze ohne Zusatzgewicht pro Woche im Schnitt.`;
    }
    paragraphs.push(line);
  }

  // 4. Breite
  if (breadth) {
    let line = `Du hast in ${breadth.progressedCount} von ${breadth.totalCount} Muskelgruppen messbare Fortschritte erzielt${breadth.progressedCats.length ? ` (${breadth.progressedCats.join(', ')})` : ''}.`;
    if (breadth.otherCats.length) {
      line += ` Noch ohne erkennbaren Fortschritt: ${breadth.otherCats.join(', ')}.`;
    }
    paragraphs.push(line);
  }

  return paragraphs;
}

const _ERKENNTNIS_CATEGORY_ORDER = ['sleep', 'exWeekday', 'trend'];

/**
 * Rotiert die Reihenfolge der Beobachtungen wöchentlich, basierend auf der
 * Kalenderwoche von HEUTE (KW % 3) — pragmatische, persistenzfreie
 * Annäherung an "zuletzt neu aufgetreten", da die Beobachtungen zur
 * Laufzeit aus den Wochendaten neu berechnet werden und es keine
 * gespeicherte Historie ihrer früheren Kernaussagen gibt. Gleiche KW-
 * Berechnung wie wkLabel()/_kw() in progressChart.js, hier auf das
 * heutige Datum statt einen Wochenstart angewendet.
 */
function _rotatedErkenntnisEntries(state, N = 8) {
  const entries = computeErkenntnisLines(state, N);
  const today = new Date();
  const jan   = new Date(today.getFullYear(), 0, 1);
  const todayKW = Math.ceil(((today - jan) / 86_400_000 + jan.getDay() + 1) / 7);
  const rotation = todayKW % 3;
  const order = [
    _ERKENNTNIS_CATEGORY_ORDER[rotation],
    _ERKENNTNIS_CATEGORY_ORDER[(rotation + 1) % 3],
    _ERKENNTNIS_CATEGORY_ORDER[(rotation + 2) % 3],
  ];
  return [...entries].sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category));
}

/**
 * "Erkenntnisse"-Sektion (vormals zwei getrennte Sektionen "Beobachtungen"
 * und "Gesamtperformance", jetzt zusammengeführt, Variante A): gemeinsamer
 * Header, oben Gesamtperformance (immer sichtbar), Trennlinie, darunter
 * Beobachtungen (beste zuerst sichtbar, Rest einklappbar via natives
 * <details>, gleicher Mechanismus wie die Decisional-Balance-Erweiterung).
 * Liefert '' wenn WEDER Gesamtperformance NOCH Beobachtungen Daten haben.
 */
function _renderErkenntnisseSection(state) {
  const N = Math.max(4, Math.min(52, state.settings?.erkenntnisseHorizont ?? 8));
  // effectiveN: gegen die tatsächlich vorhandene (Nicht-Seed-)Wochenzahl
  // geclampt (Sprint "Kategorie-1-Bugfixes", Fix 4) — verhindert dass der
  // Hinweistext "Letzte 13 Wochen" behauptet, obwohl die App erst 8 echte
  // Wochen alt ist.
  const realWeekCount = state.weeks.filter(w => !w.isSeedWeek).length;
  const effectiveN = realWeekCount > 0 ? Math.min(N, realWeekCount) : N;
  const perfParagraphs = _overallPerformanceParagraphs(state, effectiveN);
  const obsEntries     = _rotatedErkenntnisEntries(state, effectiveN);
  const insights       = state.insights ?? [];

  if (!perfParagraphs.length && !obsEntries.length && !insights.length) return '';

  // Stepper-Anzeige + Grenzen ZUSÄTZLICH gegen die echte Wochenzahl geclampt
  // (Sprint "Fix3 + Fix4 Nachbessern", Fix 4a) — nur beim Rendern, NICHT in
  // state.settings geschrieben: der Nutzer behält seinen gespeicherten
  // Wunschwert (state.settings.erkenntnisseHorizont bleibt unverändert),
  // stepperN zieht automatisch nach, sobald mehr echte Wochen existieren.
  // stepperMax hat immer mindestens den Boden 4 (nie < MIN), auch wenn
  // realWeekCount selbst < 4 ist — sonst würde der Stepper bei einer ganz
  // neuen App in einen unsinnigen leeren [MIN>MAX]-Bereich fallen.
  const stepperMax = realWeekCount > 0 ? Math.max(4, Math.min(52, realWeekCount)) : 52;
  const stepperN   = Math.max(4, Math.min(stepperMax, N));

  const stepperHtml = `
  <div class="erkenntnis-stepper">
    <button type="button" class="btn btn--ghost btn--sm erkenntnis-stepper__btn"
      data-action="erkenntnisse-horizont-dec"${stepperN <= 4 ? ' disabled' : ''}>−</button>
    <span class="erkenntnis-stepper__label">${stepperN} Wochen</span>
    <button type="button" class="btn btn--ghost btn--sm erkenntnis-stepper__btn"
      data-action="erkenntnisse-horizont-inc"${stepperN >= stepperMax ? ' disabled' : ''}>+</button>
  </div>
  <p class="erkenntnis-stepper__hint">${h(_erkenntnisseHorizontLabel(effectiveN))}</p>`;

  const perfHtml = perfParagraphs.map(p => `<p class="erkenntnis-line">${h(p)}</p>`).join('');

  let obsHtml = '';
  if (obsEntries.length > 0) {
    const [first, ...rest] = obsEntries;
    obsHtml = `<p class="erkenntnis-line">${h(first.text)}</p>`;
    if (rest.length > 0) {
      obsHtml += `
      <details class="pr-collapse">
        <summary class="pr-collapse__summary">Weitere Beobachtungen ▾</summary>
        <div class="pr-collapse__body">${rest.map(e => `<p class="erkenntnis-line">${h(e.text)}</p>`).join('')}</div>
      </details>`;
    }
  }

  // Insights (insightEngine.js, event-getrieben) als zusätzliche Zeilen,
  // gleicher Stil wie Beobachtungen, kein eigenes Toggle mehr (ehemals
  // separater Insights-Button — Positions-Entkopplung Button↔Inhalt
  // machte den Button de facto wirkungslos).
  const insightsHtml = insights.length > 0
    ? insights.map(ins => {
        const line = ins.recommendation ? `${ins.title}: ${ins.message} ${ins.recommendation}` : `${ins.title}: ${ins.message}`;
        return `<p class="erkenntnis-line">${h(line)}</p>`;
      }).join('')
    : '';

  const dividerTop    = (perfHtml && obsHtml) ? `<hr class="erkenntnisse-divider">` : '';
  const dividerBottom = ((perfHtml || obsHtml) && insightsHtml) ? `<hr class="erkenntnisse-divider">` : '';

  return `
  <div class="chart-card">
    <div class="chart-card__title">📊 Erkenntnisse</div>
    ${stepperHtml}
    ${perfHtml}
    ${dividerTop}
    ${obsHtml}
    ${dividerBottom}
    ${insightsHtml}
  </div>`;
}

// ─── Coach-Bilanz: Trefferquote der Progressions-Empfehlungen ──────────────────
function _coachBilanzHtml(state) {
  // ── Progressions-Block ─────────────────────────────────────────────────────
  const measured  = (state.coachPerformance?.suggestions ?? [])
    .filter(s => s.status === 'progression' && s.outcome !== null);
  let progressionsHtml = '';
  if (measured.length >= 5) {
    const N        = measured.length;
    const succCount = measured.filter(s => s.outcome === 'success').length;
    const pct      = Math.round(succCount / N * 100);
    const highSugg = measured.filter(s => s.confidenceLevel === 'HIGH');
    const medSugg  = measured.filter(s => s.confidenceLevel === 'MEDIUM');
    const highSucc = highSugg.filter(s => s.outcome === 'success').length;
    const medSucc  = medSugg.filter(s => s.outcome === 'success').length;
    const highPct  = highSugg.length > 0 ? Math.round(highSucc / highSugg.length * 100) : null;
    const medPct   = medSugg.length  > 0 ? Math.round(medSucc  / medSugg.length  * 100) : null;
    const conclusion = pct > 75
      ? `Der Coach trifft in ${succCount} von ${N} Fällen — du kannst seinen Empfehlungen vertrauen.`
      : pct >= 50
      ? `Der Coach trifft in ${succCount} von ${N} Fällen — die HIGH-Empfehlungen sind zuverlässiger als MEDIUM.`
      : `Der Coach sammelt noch Daten über dein Training — die Empfehlungen werden präziser.`;
    const confLines = [
      highPct !== null ? `<div class="coach-bilanz-row"><span>HIGH-Empfehlungen: ${highSugg.length}</span><span>${highPct}% erfolgreich</span></div>` : '',
      medPct  !== null ? `<div class="coach-bilanz-row"><span>MEDIUM-Empfehlungen: ${medSugg.length}</span><span>${medPct}% erfolgreich</span></div>` : '',
    ].filter(Boolean).join('');
    progressionsHtml = `
    <div class="coach-bilanz-row"><span>Progressions-Empfehlungen</span><span>${N}</span></div>
    <div class="coach-bilanz-row"><span>Erfolgreich umgesetzt</span><span>${succCount} (${pct}%)</span></div>
    ${confLines ? `<div class="coach-bilanz-divider"></div>${confLines}` : ''}
    <p class="coach-bilanz-conclusion">${h(conclusion)}</p>`;
  }

  // ── Coach-Fragen-Block ─────────────────────────────────────────────────────
  const _cqMeasured = (state.coachQuestionHistory ?? [])
    .filter(e => e.outcome === 'confirmed' || e.outcome === 'not_confirmed');
  let fragenHtml = '';
  if (_cqMeasured.length >= 3) {
    const qN    = _cqMeasured.length;
    const qSucc = _cqMeasured.filter(e => e.outcome === 'confirmed').length;
    const qPct  = Math.round(qSucc / qN * 100);
    const qConc = qPct > 70
      ? `TRAIN's Nachfragen treffen in ${qSucc} von ${qN} Fällen — die Einschätzungen sind verlässlich.`
      : `TRAIN lernt noch dein Muster — die Nachfragen werden präziser.`;
    fragenHtml = `
    <div class="coach-bilanz-subtitle">Coach-Fragen Bilanz</div>
    <div class="coach-bilanz-row"><span>Fragen gestellt</span><span>${qN}</span></div>
    <div class="coach-bilanz-row"><span>Einschätzung bestätigt</span><span>${qSucc} (${qPct}%)</span></div>
    <p class="coach-bilanz-conclusion">${h(qConc)}</p>`;
  }

  if (!progressionsHtml && !fragenHtml) return '';

  const divider = progressionsHtml && fragenHtml ? '<div class="coach-bilanz-divider"></div>' : '';

  return `
  <div class="chart-card coach-bilanz-card coach-bilanz">
    <div class="chart-card__title">📊 Coach-Bilanz</div>
    ${progressionsHtml}
    ${divider}
    ${fragenHtml}
  </div>`;
}

// ─── Fortschritt tab: Wochenrückblick, Erkenntnisse, Übungsfortschritt, Bestleistungen, Bewegungsmuster, Streak+Abzeichen ──
function renderProgressTab(state) {
  const container = document.getElementById('progress-tab-content');
  if (!container) return;

  if (!_hasAnyTrainingData(state)) {
    container.innerHTML = _noAnalysisDataHtml();
    return;
  }

  const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  // ── Wochenrückblick-Auswahl ───────────────────────────────────────────────
  const reviewableWeeks = [...sorted].filter(w => w.days.some(d => d.markedDone)).reverse();
  const weekReviewHtml = reviewableWeeks.length ? (() => {
    const opts = reviewableWeeks.map((wk, i) => {
      const lbl = `${_relDate(wk.startDate)} · ${wkRange(wk.startDate)}${wk.note ? ' · ' + wk.note : ''}`;
      return `<option value="${i}">${h(lbl)}</option>`;
    }).join('');
    return `<div class="chart-card" id="week-review-card">
      <div class="chart-card__title">📋 Wochenrückblick</div>
      <select class="chart-select" id="week-review-select" aria-label="Woche für Rückblick auswählen">${opts}</select>
      <div id="week-review-inline" style="margin-top:var(--sp-3)"></div>
    </div>`;
  })() : '';

  // ── Erkenntnisse (Gesamtperformance + Beobachtungen zusammengeführt) ────
  // Dauerhafte Sektion, bei jedem Render frisch berechnet (nicht event-
  // getrieben wie state.insights/Toast-System). Berechnungslogik beider
  // vormals getrennten Sektionen unverändert, nur Darstellung/Position
  // geändert (siehe _renderErkenntnisseSection()).
  const erkenntnisseHtml = _renderErkenntnisseSection(state);
  const coachBilanzHtml  = _coachBilanzHtml(state);

  const streak     = _calcStreak(state);
  const _scoreList = state.weeks.map(w => _weekSuccessScore(w)).filter(s => s.total > 0).map(s => s.pct);
  const avgScore   = _scoreList.length > 0 ? Math.round(_scoreList.reduce((a, b) => a + b, 0) / _scoreList.length) : null;
  const archivedNames = new Set(
    state.weeks.flatMap(w => w.days.flatMap(d => d.exercises.filter(e => e.archived).map(e => e.name)))
  );
  const allExNames = [...new Set(
    state.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name)))
  )].sort();

  // ── Bestleistungen ──────────────────────────────────────────────────────────
  const bestleistungenHtml = (() => {
    const prs = state.prs ?? {};
    const favSet = new Set(state.favoriteExercises ?? []);
    const entries = Object.entries(prs).sort((a, b) => b[1].maxWeight - a[1].maxWeight);
    if (!entries.length) return '';
    const favEntries  = entries.filter(([nm]) => favSet.has(nm));
    const restEntries = entries.filter(([nm]) => !favSet.has(nm));
    const renderRow = ([nm, pr], isFav) => `
      <div class="pr-row${isFav ? ' pr-row--fav' : ''}">
        <span class="pr-name">${isFav ? '⭐ ' : ''}${h(nm)}</span>
        <span class="pr-val">${pr.maxWeight} kg</span>
        ${pr.date ? `<span class="pr-date">${pr.date}</span>` : ''}
      </div>`;
    const restHtml = restEntries.length ? `
      <details class="pr-collapse">
        <summary class="pr-collapse__summary">Alle Übungen (${restEntries.length}) ▼</summary>
        <div class="pr-collapse__body">${restEntries.map(e => renderRow(e, false)).join('')}</div>
      </details>` : '';
    return `<div class="chart-card">
      <div class="chart-card__title">${ic.trophy()} Bestleistungen</div>
      ${favEntries.map(e => renderRow(e, true)).join('')}
      ${restHtml}
    </div>`;
  })();

  container.innerHTML = `
  ${weekReviewHtml}

  ${erkenntnisseHtml}

  ${coachBilanzHtml}

  <div class="chart-card">
    <div class="chart-card__title">Übungsfortschritt</div>
    <select class="chart-select" id="chart-ex-select" aria-label="Übung für Progressionskurve wählen">
      ${allExNames.map(n => `<option value="${h(n)}">${h(n)}${archivedNames.has(n) ? ' (archiviert)' : ''}</option>`).join('')}
    </select>
    <div class="chart-wrap" id="chart-ex-wrap"></div>
    <div id="chart-archive-hint"></div>
    <div id="chart-1rm-hint"></div>
    <div id="chart-last4-wrap"></div>
  </div>

  ${bestleistungenHtml}

  ${_renderMovementPattern(state)}

  <div class="chart-card">
    ${_renderStreakChain(state)}
    ${(() => {
      const allLogs  = state.weeks.flatMap(w => w.sessionLog ?? []);
      const totalMin = allLogs.length ? Math.round(allLogs.reduce((s, l) => s + l.duration, 0) / 60) : null;
      const avgMin   = allLogs.length ? Math.round(totalMin / allLogs.length) : null;
      const fmtMin   = m => m >= 60 ? `${Math.floor(m/60)}h${m%60 ? String(m%60).padStart(2,'0') : ''}` : `${m}'`;
      return `
    <div class="streak-row">
      <div class="streak-card"><div class="streak-num">${streak.cur}</div><div class="streak-lbl">Wochen</div></div>
      <div class="streak-card"><div class="streak-num">${streak.best}</div><div class="streak-lbl">Längste</div></div>
      <div class="streak-card"><div class="streak-num">${state.weeks.length}</div><div class="streak-lbl">Wochen</div></div>
      ${avgScore !== null ? `
      <button type="button" class="streak-card" data-action="toggle-metric-tooltip" data-metric="avg-score" aria-expanded="${_metricTooltipKey === 'avg-score'}" aria-label="Ø Erfolg erklären">
        <div class="streak-num" style="color:${avgScore>=90?'var(--c-ok)':avgScore>=70?'var(--c-warn)':'var(--c-danger)'}">${avgScore}%</div>
        <div class="streak-lbl">Ø Erfolg</div>
      </button>` : ''}
      ${avgMin != null ? `<div class="streak-card"><div class="streak-num">${fmtMin(avgMin)}</div><div class="streak-lbl">Ø Session</div></div>` : ''}
      ${totalMin != null ? `<div class="streak-card"><div class="streak-num">${fmtMin(totalMin)}</div><div class="streak-lbl">Gesamt</div></div>` : ''}
    </div>
    ${_metricTooltipKey === 'avg-score' ? `
    <div class="metric-tooltip">Anteil der Sätze bei denen du dein Wdh-Ziel erreicht hast — gemittelt über alle bisherigen Wochen. Pending-Sätze werden nicht gezählt.</div>` : ''}`;
    })()}
    ${_renderBadgeGallery(state)}
  </div>`;

  requestAnimationFrame(() => {
    _updateExChart(state);
    _attachStreakChainTooltips();
    document.getElementById('chart-ex-select')?.addEventListener('change', () => {
      _updateExChart(getState());
    });
    _updateInlineReview(getState());
    document.getElementById('week-review-select')?.addEventListener('change', () => {
      _updateInlineReview(getState());
    });
  });
}

function _updateInlineReview(state) {
  const sel  = document.getElementById('week-review-select');
  const wrap = document.getElementById('week-review-inline');
  if (!sel || !wrap) return;
  const reviewable = [...state.weeks]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .filter(w => w.days.some(d => d.markedDone))
    .reverse();
  const wk = reviewable[+sel.value];
  if (!wk) { wrap.innerHTML = ''; return; }
  const review = buildWeekReview(wk, state.weeks, state.favoriteExercises ?? []);
  wrap.innerHTML = renderWeekReviewHtml(review);
}

function _calcStreak(state) {
  // Defensiver Fallback: cur/best müssen IMMER eine Zahl sein, nie null/
  // undefined — sonst zeigt die Streak-Badge "null Tage" statt "0 Tage" (siehe
  // Fix 1, train-v106).
  const cur  = calcCurrentStreak(state.weeks) ?? 0;
  const best = Math.max(state.longestStreakEver ?? 0, calcLongestStreakEver(state.weeks) ?? 0);
  return { cur, best };
}

function _renderStreakChain(state) {
  const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last8  = sorted.slice(-8);
  if (last8.length < 2) return '';
  const R = 6, GAP = 32, PAD = 12;
  const W = PAD * 2 + (last8.length - 1) * GAP;
  const H = 28;
  const cy = H / 2;
  const dots = last8.map((wk, i) => {
    const cx       = PAD + i * GAP;
    const score    = _weekSuccessScore(wk);
    const streakStatus = weekTrainingStatus(wk); // 'completed' | 'attended' | 'missed'
    const isRestOnly = streakStatus === 'attended';
    const done     = streakStatus === 'completed';
    const ss       = score.total > 0 ? score.pct : 0;
    const wkNum = (() => {
      const d = new Date(wk.startDate);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    })();
    return { cx, done, isRestOnly, ss, wkNum, startDate: wk.startDate };
  });
  const lines = dots.slice(0, -1).map((d, i) => {
    const next  = dots[i + 1];
    const color = d.done && next.done ? '#C8FF00' : '#2E2E35';
    const dash  = d.done && next.done ? '' : 'stroke-dasharray="4 3"';
    return `<line x1="${d.cx}" y1="${cy}" x2="${next.cx}" y2="${cy}" stroke="${color}" stroke-width="2" ${dash}/>`;
  });
  const circles = dots.map(d => {
    const fill   = d.isRestOnly ? '#2E2E35' : d.done ? '#C8FF00' : '#1A1A2E';
    const stroke = d.isRestOnly ? '#444'    : d.done ? '#C8FF00' : '#2E2E35';
    const tip    = d.isRestOnly ? `KW ${d.wkNum} · Anwesend` : `KW ${d.wkNum} · ${d.ss}% Erfolg`;
    return `<circle cx="${d.cx}" cy="${cy}" r="${R}" fill="${fill}" stroke="${stroke}" stroke-width="2" data-streak-tip="${tip}" style="cursor:pointer"/>`;
  });
  return `<div class="streak-chain-wrap">
    <svg class="streak-chain" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
      ${lines.join('')}
      ${circles.join('')}
    </svg>
    <div id="streak-chain-tooltip" style="display:none;position:absolute;background:#1A1A2E;border:1px solid #2E2E35;color:#E0E0E8;font-size:11px;padding:4px 8px;border-radius:6px;pointer-events:none;z-index:50;white-space:nowrap"></div>
  </div>`;
}

function _attachStreakChainTooltips() {
  const wrap    = document.querySelector('.streak-chain-wrap');
  const tooltip = document.getElementById('streak-chain-tooltip');
  if (!wrap || !tooltip) return;
  const show = (e) => {
    const t = e.target.closest('[data-streak-tip]');
    if (!t) return;
    const rect    = t.getBoundingClientRect();
    const wrapR   = wrap.getBoundingClientRect();
    tooltip.textContent = t.dataset.streakTip;
    tooltip.style.display = 'block';
    tooltip.style.left = `${rect.left - wrapR.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
    tooltip.style.top  = `${rect.top - wrapR.top - tooltip.offsetHeight - 6}px`;
  };
  const hide = () => { tooltip.style.display = 'none'; };
  wrap.addEventListener('mouseover', show);
  wrap.addEventListener('mouseout',  hide);
  wrap.addEventListener('touchstart', e => { show(e.touches[0] ?? e); }, { passive: true });
  wrap.addEventListener('touchend',   hide, { passive: true });
}

/** Tooltip-Handler für data-tip-Kreise im SVG-Chart. */
function _attachChartTooltips(container) {
  let tip = document.getElementById('_train-chart-tip');
  if (!tip) {
    tip = document.createElement('div');
    tip.id = '_train-chart-tip';
    tip.style.cssText = 'position:fixed;background:#1C1C1F;color:#F0F0F0;border:1px solid #2E2E35;border-radius:6px;padding:5px 10px;font-size:12px;font-family:DM Sans,sans-serif;pointer-events:none;opacity:0;transition:opacity .15s;z-index:9000;white-space:nowrap';
    document.body.appendChild(tip);
  }
  container.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', e => {
      tip.textContent = el.dataset.tip;
      tip.style.opacity = '1';
      tip.style.left = (e.clientX + 10) + 'px';
      tip.style.top  = (e.clientY - 36) + 'px';
    });
    el.addEventListener('mousemove', e => {
      tip.style.left = (e.clientX + 10) + 'px';
      tip.style.top  = (e.clientY - 36) + 'px';
    });
    el.addEventListener('mouseleave', () => { tip.style.opacity = '0'; });
    el.addEventListener('click', e => {
      tip.textContent = el.dataset.tip;
      tip.style.opacity = '1';
      tip.style.left = (e.clientX + 10) + 'px';
      tip.style.top  = (e.clientY - 36) + 'px';
      setTimeout(() => { tip.style.opacity = '0'; }, 2500);
    });
  });
}

/**
 * Korridor-Kalibrierung für eine Übung im Übungsfortschritt-Chart — gleiche
 * Wochen-Filterung (kein Deload, kein Urlaub) wie progressTrendOutlier()'s
 * _relevantWeeks(state), bewusst NICHT auf 16 Wochen gecappt (Korridor-
 * Kalibrierung soll die gesamte verfügbare Historie für die Rate nutzen,
 * unabhängig vom Anzeige-Cap des Charts). Wird bei jedem Aufruf neu
 * berechnet, kein gespeicherter Zustand.
 */
function _corridorFor(state, exName) {
  const sortedWeeks = [...state.weeks]
    .filter(w => w.mode !== 'deload' && w.mode !== 'vacation')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  return getProgressCorridorCalibration(sortedWeeks, exName);
}

// Sprint "Kategorie-1-Bugfixes", Fix 6: getProgressCorridorCalibration()
// unterscheidet jetzt "zu wenig Daten" (null, kein Hinweis) von "genug
// Daten, aber kein positiver Trend" ({noTrend:true}) — dezenter Hinweis
// statt kommentarlosem Verschwinden des ganzen Korridor-Bereichs.
function _corridorHintHtml(corridor) {
  if (!corridor) return '';
  if (corridor.noTrend) {
    return '<p class="chart-corridor-hint chart-corridor-hint--flat">Kein klarer Trend erkennbar — dein Gewicht war zuletzt stabil.</p>';
  }
  return '<p class="chart-corridor-hint">Schattierter Bereich: erwartete Entwicklung basierend auf deiner Steigerungsrate der letzten Wochen.</p>';
}

function _updateExChart(state) {
  const sel  = document.getElementById('chart-ex-select');
  const wrap = document.getElementById('chart-ex-wrap');
  if (!sel || !wrap) return;
  const name = sel.value;
  const calcWeeks = [...state.weeks]
    .filter(w => w.mode !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-16);
  const corridor = _corridorFor(state, name);
  // Nur ein Objekt MIT calibrationRate (also noTrend===false) darf an den
  // Chart weitergereicht werden — der {noTrend:true}-Marker hat keine
  // calibrationRate/startWeight-Kombination, die renderProgressChart()
  // sinnvoll zeichnen könnte. Der Hinweistext unten nutzt trotzdem das
  // ungefilterte `corridor`, um zwischen "kein Trend" und "keine Daten"
  // unterscheiden zu können.
  const chartCorridor = corridor && !corridor.noTrend ? corridor : null;
  const svg = renderProgressChart(name, calcWeeks, { compact: false, corridor: chartCorridor });
  if (svg) {
    wrap.innerHTML = svg + _corridorHintHtml(corridor);
    _attachChartTooltips(wrap);
  } else {
    wrap.innerHTML = '<p class="empty-state__hint">Wähle eine Übung und trainiere mindestens 2 Wochen um den Verlauf zu sehen.</p>';
  }
  const archiveWrap = document.getElementById('chart-archive-hint');
  if (archiveWrap) {
    const isArchived = state.weeks.some(w => w.days.some(d => d.exercises.some(ex => ex.name === name && ex.archived)));
    archiveWrap.innerHTML = isArchived
      ? `<p class="erkenntnis-line" style="margin-top:var(--sp-2)">Diese Übung ist archiviert. <button class="btn btn--sm" data-action="unarchive-ex" data-name="${h(name)}" style="margin-left:var(--sp-2)">Reaktivieren</button></p>`
      : '';
  }
  const ormWrap = document.getElementById('chart-1rm-hint');
  if (ormWrap) ormWrap.innerHTML = _renderAnalysis1RM(name, state);
  const last4Wrap = document.getElementById('chart-last4-wrap');
  if (last4Wrap) last4Wrap.innerHTML = _renderLast4Units(name, state);
}

function _renderLast4Units(name, state) {
  const rpeEnabled = state.settings?.rpeEnabled ?? true;
  const weeksWithEx = [];
  const sorted = [...state.weeks].sort((a, b) => b.startDate.localeCompare(a.startDate));
  for (const wk of sorted) {
    if (wk.mode === 'deload') continue;
    const found = wk.days.flatMap(d => d.exercises ?? [])
      .find(ex => ex.name === name || ex.substituteFor === name);
    if (found?.sets?.length) weeksWithEx.push({ wk, ex: found });
    if (weeksWithEx.length >= 4) break;
  }
  if (!weeksWithEx.length) return '';

  const sections = weeksWithEx.map(({ wk, ex }) => {
    const d  = new Date(wk.startDate + 'T12:00:00');
    const kw = _isoWeek(d);
    const dd = `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
    const hdr = `KW ${String(kw).padStart(2,'0')} · ${dd}`;
    const rows = (ex.sets ?? []).map((s, si) => {
      const sc  = s.status === 'success' ? ' class="l4-ok"' : s.status === 'fail' ? ' class="l4-fail"' : '';
      const ico = s.status === 'success' ? '✓' : s.status === 'fail' ? '✗' : '–';
      return `<div class="l4-row" role="row">
        <span role="cell">${si + 1}</span>
        <span role="cell">${s.weight ?? '–'}</span>
        <span role="cell">${s.reps ?? '–'}</span>
        ${rpeEnabled ? `<span role="cell">${s.rpe ?? '–'}</span>` : ''}
        <span role="cell"${sc}>${ico}</span>
      </div>`;
    }).join('');
    return `<div class="l4-week">
      <div class="l4-week-hdr">${hdr}</div>
      <div class="l4-table${rpeEnabled ? ' l4-table--rpe' : ''}" role="table" aria-label="Sätze ${hdr}">
        <div class="l4-row l4-row--hdr" role="row">
          <span role="columnheader">#</span>
          <span role="columnheader">kg</span>
          <span role="columnheader">Wdh</span>
          ${rpeEnabled ? '<span role="columnheader">RPE</span>' : ''}
          <span role="columnheader">✓</span>
        </div>
        ${rows}
      </div>
    </div>`;
  }).join('');

  return `<details class="l4-details">
    <summary class="l4-summary">📋 Letzte 4 Einheiten</summary>
    <div class="l4-body">${sections}</div>
  </details>`;
}

function _drawHeatmap(state) {
  const hm = document.getElementById('heatmap');
  if (!hm) return;
  hm.innerHTML = '';
  [...state.weeks]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-12)
    .forEach(wk => {
      const done     = wk.days.filter(d => !!d.markedDone).length;
      const cell     = document.createElement('div');
      cell.className = 'hm-cell' + (done === 0 ? '' : ` hm-cell--${Math.min(done, 3)}`);
      const label = `${wkLabel(wk.startDate)}: ${done}/${wk.days.length} Tage`;
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute('aria-label', label);
      cell.title = label;
      hm.appendChild(cell);
    });
}

function drawLineChart(id, labels, data, color) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.offsetWidth || 300, H = 120;
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  if (!data.length || data.every(v => v === 0)) return;

  const max = Math.max(...data, 1);
  const pad = { l: 10, r: 10, t: 10, b: 20 };
  const gw  = W - pad.l - pad.r;
  const gh  = H - pad.t - pad.b;
  const x   = i => pad.l + i * (gw / (data.length - 1 || 1));
  const y   = v => pad.t + gh - (v / max) * gh;

  ctx.strokeStyle = '#2E2E35'; ctx.lineWidth = 1;
  [0, 0.5, 1].forEach(f => {
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t + gh * (1 - f));
    ctx.lineTo(pad.l + gw, pad.t + gh * (1 - f));
    ctx.stroke();
  });

  ctx.beginPath();
  data.forEach((v, i) => i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)));
  ctx.lineTo(x(data.length - 1), pad.t + gh);
  ctx.lineTo(pad.l, pad.t + gh);
  ctx.closePath();
  ctx.fillStyle = color === '#C8FF00' ? 'rgba(200,255,0,.08)' : 'rgba(79,195,247,.08)';
  ctx.fill();

  ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 2;
  data.forEach((v, i) => i === 0 ? ctx.moveTo(x(i), y(v)) : ctx.lineTo(x(i), y(v)));
  ctx.stroke();

  data.forEach((v, i) => {
    ctx.beginPath(); ctx.arc(x(i), y(v), 3, 0, Math.PI * 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.fillStyle = '#666'; ctx.font = '9px DM Sans'; ctx.textAlign = 'center';
    ctx.fillText(labels[i], x(i), H - 3);
    if (v > 0) {
      ctx.fillStyle = '#F0F0F0'; ctx.font = '10px DM Sans';
      ctx.fillText(v >= 1000 ? (v/1000).toFixed(1)+'t' : v+'kg', x(i), y(v) - 5);
    }
  });
}

// ─── Settings tab ─────────────────────────────────────────────────────────────
function _backupAgeInDays(settings) {
  const lbd = settings?.lastBackupDate;
  if (!lbd) return null;
  const ts = typeof lbd === 'number' ? lbd : new Date(lbd + 'T00:00:00').getTime();
  return Math.max(0, Math.floor((Date.now() - ts) / 86_400_000));
}

function _backupStatusHtml(settings) {
  const days = _backupAgeInDays(settings);
  if (days === null) return '<span class="bk-status bk-status--warn">⚠️ Noch nie gesichert</span>';
  if (days === 0)    return '<span class="bk-status bk-status--ok">✓ Heute gesichert</span>';
  if (days <= 14)    return `<span class="bk-status bk-status--ok">✓ Vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}</span>`;
  return `<span class="bk-status bk-status--warn">⚠️ Vor ${days} Tagen — zu alt</span>`;
}

// ─── Wiedereinstieg nach Pause ───────────────────────────────────────────────

/** End of a week's 7-day span, as a timestamp. */
function _reentryWeekEndMs(wk) {
  return new Date(wk.startDate + 'T00:00:00').getTime() + 6 * 86_400_000;
}

/**
 * Detects an unmarked training pause > 7 days and computes the suggested
 * reduction factor. Returns null when no pause is detected or it was
 * already handled (state.lastReentryHandled is more recent than the pause
 * start, i.e. the user already decided Ja/Nein for this specific gap).
 *
 * Covers two cases:
 *  - the pause is still ongoing (no training since the last active week)
 *  - the user already resumed (marked a day done this week) before the app
 *    ever got a chance to surface the popup — without this, the gap that
 *    led up to that resumption would silently vanish forever once any day
 *    in the new week gets marked done.
 */
function _detectReentryPause(state) {
  if (!state.weeks?.length) return null;
  const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  let lastActiveWk = null, prevActiveWk = null;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (!sorted[i].days.some(d => d.markedDone || d.isVacation)) continue;
    if (!lastActiveWk) { lastActiveWk = sorted[i]; continue; }
    prevActiveWk = sorted[i];
    break;
  }
  if (!lastActiveWk) return null;

  const lastActiveStartMs = new Date(lastActiveWk.startDate + 'T00:00:00').getTime();

  const ongoingPauseDays    = Math.floor((Date.now() - _reentryWeekEndMs(lastActiveWk)) / 86_400_000);
  const resumptionPauseDays = prevActiveWk
    ? Math.floor((lastActiveStartMs - _reentryWeekEndMs(prevActiveWk)) / 86_400_000)
    : -Infinity;
  const pauseDays = Math.max(ongoingPauseDays, resumptionPauseDays);
  if (pauseDays <= 7) return null;

  const alreadyHandled = state.lastReentryHandled != null
    && state.lastReentryHandled > lastActiveStartMs;
  if (alreadyHandled) return null;

  const activeDays = lastActiveWk.days.filter(d => d.markedDone || d.isVacation);
  const vacTrainingDays = activeDays.filter(d => d.isVacation && d.vacationPlan !== 'rest' && d.vacationPlan !== null);
  const isVacationOverride = vacTrainingDays.length > activeDays.length / 2;

  let factor;
  if (isVacationOverride)    factor = 0.05;
  else if (pauseDays <= 14)  factor = 0.10;
  else if (pauseDays <= 28)  factor = 0.15;
  else if (pauseDays <= 56)  factor = 0.20;
  else                       factor = 0.25;

  return { pauseDays, factor };
}

function _showReentryPopup(pauseDays, factor) {
  document.getElementById('reentry-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'reentry-modal';
  overlay.className = 'vac-plan-modal-overlay';
  const pct = Math.round(factor * 100);
  overlay.innerHTML = `
    <div class="vac-plan-modal">
      <div class="vac-plan-modal__title">🔄 Willkommen zurück</div>
      <p class="vac-plan-modal__sub">Du warst ${pauseDays} Tage weg.<br>TRAIN empfiehlt einen sanften Wiedereinstieg: -${pct}%</p>
      <button class="btn btn--accent" data-reentry="adjust" style="width:100%;min-height:var(--touch)">Ja, angepasst starten</button>
      <button class="btn btn--ghost" data-reentry="full" style="width:100%;min-height:var(--touch)">Nein, volles Gewicht</button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) return; // require explicit choice, no backdrop-dismiss
    const btn = e.target.closest('[data-reentry]');
    if (!btn) return;
    if (btn.dataset.reentry === 'adjust') {
      dispatch(A.EX_APPLY_REENTRY_REDUCTION, { factor });
      showToast(`Wiedereinstieg angepasst: -${pct}% ✓`, 'ok');
    } else {
      showToast('Volles Gewicht — viel Erfolg!', 'ok');
    }
    dispatch(A.REENTRY_HANDLED, {});
    overlay.remove();
  });
}

function _shouldShowBackupReminder(state) {
  const s = state.settings ?? {};
  if (s.backupReminderSnoozed && (Date.now() - s.backupReminderSnoozed) < 7 * 86_400_000) return false;
  const days = _backupAgeInDays(s);
  if (days === null) return state.weeks.length >= 2;
  return days > 14;
}

function _renderMergeGroupCard(variants, { hint, mergeAttrs, extraButton } = {}) {
  return `
  <div class="name-dup-card">
    ${variants.map(v => `<div class="name-dup-variant">"${h(v.name)}" (${v.setCount} ${v.setCount === 1 ? 'Satz' : 'Sätze'})</div>`).join('')}
    ${hint ? `<div class="name-dup-hint">${hint}</div>` : ''}
    <div class="name-dup-merge-row">
      <span class="name-dup-merge-label">Zusammenführen zu:</span>
      <select class="form-input name-dup-select">
        ${variants.map((v, i) => `<option value="${h(v.name)}"${i === 0 ? ' selected' : ''}>${h(v.name)}</option>`).join('')}
      </select>
    </div>
    <div class="name-dup-actions">
      <button type="button" class="btn btn--accent btn--sm" data-action="merge-ex-names" ${mergeAttrs}>Zusammenführen</button>
      ${extraButton ?? ''}
    </div>
  </div>`;
}

function _renderNameCleanupSections(state) {
  const dupGroups  = findExactDuplicates(state);
  const candidates = findSimilarCandidates(state);

  const dupHtml = dupGroups.length > 0 ? `
  <div class="name-dup-section">
    <div class="name-dup-section__title">⚠️ Mögliche Duplikate gefunden</div>
    ${dupGroups.map(g => _renderMergeGroupCard(g.variants, {
      mergeAttrs: `data-merge-key="${h(g.key)}"`,
    })).join('')}
  </div>` : '';

  const candHtml = candidates.length > 0 ? `
  <div class="name-dup-section">
    <div class="name-dup-section__title">💡 Mögliche Tippfehler</div>
    ${candidates.map(c => _renderMergeGroupCard(
      [{ name: c.a, setCount: c.setCountA }, { name: c.b, setCount: c.setCountB }]
        .sort((x, y) => y.setCount - x.setCount),
      {
        hint: '→ Gleiche Übung, Tippfehler?',
        mergeAttrs: `data-merge-a="${h(c.a)}" data-merge-b="${h(c.b)}"`,
        extraButton: `<button type="button" class="btn btn--ghost btn--sm" data-action="dismiss-name-pair" data-a="${h(c.a)}" data-b="${h(c.b)}">Sind unterschiedliche Übungen</button>`,
      }
    )).join('')}
  </div>` : '';

  return dupHtml + candHtml;
}

function renderSettingsTab(state) {
  const container = document.getElementById('settings-tab-content');
  if (!container) return;
  const wk  = state.weeks[state.curIdx] ?? null;
  const s   = state.settings ?? {};

  const tog = (key, label, desc) => `
  <div class="settings-row">
    <div><div class="settings-row__label">${label}</div><div class="settings-row__desc">${desc}</div></div>
    <button
      class="toggle${s[key] ? ' is-on' : ''}"
      data-action="toggle-setting" data-key="${key}"
      role="switch" aria-checked="${!!s[key]}"
      aria-label="${label}"
    ></button>
  </div>`;

  // Deload factor pill options
  const dlFactor   = s.deloadFactor ?? 0.75;
  const dlCustom   = s.deloadFactorCustom;
  const dlPresets  = [0.5, 0.6, 0.7, 0.75, 0.8];
  const isCustomDl = !dlPresets.includes(dlFactor) || _showCustomDeload;

  // Max session duration pill options (in ms)
  const msOpts    = [3600000, 5400000, 7200000, 10800000, 14400000];
  const msLabels  = { 3600000: '1h', 5400000: '1,5h', 7200000: '2h', 10800000: '3h', 14400000: '4h' };
  const curMaxMs  = s.maxSessionMs ?? 10800000;

  container.innerHTML = `
  <!-- Training -->
  <div class="settings-section">
    <div class="settings-section__title">Training</div>
    ${tog('swipe', 'Swipe-Navigation', 'Wischen zum Wochenwechsel')}
    ${tog('vibrationEnabled', 'Vibration nach Pause', 'Funktioniert nur auf Android — iOS unterstützt Vibration in PWAs technisch nicht.')}
    ${tog('autoStartPauseTimer', 'Pausentimer automatisch', 'Timer startet automatisch nach jedem bestätigten Satz (außer dem letzten)')}
    ${tog('rpeEnabled', 'RPE anzeigen', 'Rate of Perceived Exertion — Anstrengungsgrad pro Satz')}
    ${tog('autoEval', 'Automatische Satz-Bewertung', 'Satz wird bewertet sobald du die Wdh-Zahl einträgst und das Feld verlässt.')}
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
      <div>
        <div class="settings-row__label">Kleinstmögliche Steigerung</div>
        <div class="settings-row__desc">Rundung für KI-Gewichtsempfehlungen</div>
      </div>
      <div class="weight-step-opts">
        ${[1.25, 2.5, 5].map(ps => `
          <button type="button"
            class="weight-step-btn${(s.plateStep ?? 2.5) === ps ? ' is-selected' : ''}"
            data-action="set-plate-step" data-step="${ps}"
            aria-pressed="${(s.plateStep ?? 2.5) === ps}"
          >${String(ps).replace('.', ',')} kg</button>`).join('')}
      </div>
    </div>
    ${(() => {
      const autoWeek = s.autoWeek ?? { enabled: false, suggestProgress: true, showReview: true };
      const subDisabled = !autoWeek.enabled;
      return `
    <div class="settings-row">
      <div>
        <div class="settings-row__label">Automatische Wochenerstellung</div>
        <div class="settings-row__desc">Legt beim App-Öffnen automatisch eine neue Woche an, sobald die aktuelle Kalenderwoche noch fehlt</div>
      </div>
      <button
        class="toggle${autoWeek.enabled ? ' is-on' : ''}"
        data-action="toggle-autoweek-enabled"
        role="switch" aria-checked="${!!autoWeek.enabled}"
        aria-label="Automatische Wochenerstellung"
      ></button>
    </div>
    <div class="settings-row autoweek-sub${subDisabled ? ' is-disabled' : ''}">
      <div>
        <div class="settings-row__label">Steigerungen vorschlagen</div>
        <div class="settings-row__desc">Zeigt das Steigerungs-Modal beim ersten Öffnen der neuen Woche</div>
      </div>
      <button
        class="toggle${autoWeek.suggestProgress ? ' is-on' : ''}"
        data-action="toggle-autoweek-sub" data-key="suggestProgress"
        role="switch" aria-checked="${!!autoWeek.suggestProgress}"
        aria-label="Steigerungen vorschlagen" ${subDisabled ? 'disabled' : ''}
      ></button>
    </div>
    <div class="settings-row autoweek-sub${subDisabled ? ' is-disabled' : ''}">
      <div>
        <div class="settings-row__label">Wochenrückblick zuerst zeigen</div>
        <div class="settings-row__desc">Zeigt den Rückblick der Vorwoche, bevor das Steigerungs-Modal erscheint</div>
      </div>
      <button
        class="toggle${autoWeek.showReview ? ' is-on' : ''}"
        data-action="toggle-autoweek-sub" data-key="showReview"
        role="switch" aria-checked="${!!autoWeek.showReview}"
        aria-label="Wochenrückblick zuerst zeigen" ${subDisabled ? 'disabled' : ''}
      ></button>
    </div>`;
    })()}
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-1)">
      <div class="settings-row__label">Stangengewicht (kg)</div>
      <input class="body-input" type="number" step="0.5" min="5" max="50"
        value="${s.barbellWeight ?? 20}" placeholder="20"
        data-action="set-barbell-weight"
        style="margin-top:var(--sp-1);width:120px"
        aria-label="Stangengewicht in kg"
      />
    </div>
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
      <div>
        <div class="settings-row__label">Deload-Faktor</div>
        <div class="settings-row__desc">Aktuelle Einstellung: <strong>${Math.round((s.deloadFactor ?? 0.75) * 100)}%</strong></div>
      </div>
      <details class="deload-details">
        <summary class="deload-details__summary">Erweiterte Einstellungen</summary>
        <div class="deload-details__body">
          <div class="weight-step-opts" style="margin-top:var(--sp-2)">
            ${dlPresets.map(f => `
              <button type="button"
                class="weight-step-btn${dlFactor === f && !isCustomDl ? ' is-selected' : ''}"
                data-action="set-deload-factor" data-factor="${f}"
                aria-pressed="${dlFactor === f && !isCustomDl}"
              >${Math.round(f*100)}%</button>`).join('')}
            <button type="button"
              class="weight-step-btn${isCustomDl ? ' is-selected' : ''}"
              data-action="set-deload-factor-custom"
              aria-pressed="${isCustomDl}"
            >Individuell</button>
          </div>
          ${isCustomDl ? `
          <div style="margin-top:var(--sp-2);display:flex;align-items:center;gap:var(--sp-2)">
            <input class="body-input" type="number" min="1" max="99" step="1"
              value="${dlCustom != null ? Math.round(dlCustom * 100) : Math.round(dlFactor * 100)}"
              data-action="set-deload-factor-value"
              style="width:80px"
              aria-label="Deload-Faktor in Prozent"
            />
            <span style="font-size:12px;color:var(--c-text-3)">%</span>
          </div>` : ''}
        </div>
      </details>
    </div>
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
      <div>
        <div class="settings-row__label">Max. Sitzungsdauer</div>
        <div class="settings-row__desc">Session-Timer stoppt bei Erreichen des Limits</div>
      </div>
      <div class="weight-step-opts">
        ${msOpts.map(ms => `
          <button type="button"
            class="weight-step-btn${curMaxMs === ms ? ' is-selected' : ''}"
            data-action="set-max-session" data-ms="${ms}"
            aria-pressed="${curMaxMs === ms}"
          >${msLabels[ms]}</button>`).join('')}
      </div>
    </div>
  </div>

  <!-- Deine Daten -->
  <div class="settings-section">
    <div class="settings-section__title">Deine Daten</div>
    <div class="settings-row settings-row--clickable" data-action="export-json">
      <div>
        <div class="settings-row__label">💾 Backup erstellen</div>
        <div class="settings-row__desc backup-status-line">${_backupStatusHtml(s)}</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <label class="settings-row settings-row--clickable">
      <div>
        <div class="settings-row__label">📂 Backup wiederherstellen</div>
        <div class="settings-row__desc">Aktuelle Daten werden ersetzt</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
      <input type="file" accept=".json" class="sr-only" data-action="import-json" aria-label="JSON-Backup-Datei wählen"/>
    </label>
  </div>

  <!-- Trainingstage -->
  <div class="settings-section">
    <div class="settings-section__title">Trainingstage verwalten</div>
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
      <div style="display:flex;justify-content:space-between;width:100%;align-items:center">
        <div class="settings-row__desc">Aktuelle Woche · max. 7 Tage</div>
        ${wk && wk.days.length < 7 ? `<button class="btn btn--ghost btn--sm" data-action="add-day">${ic.plus()} Tag hinzufügen</button>` : ''}
      </div>
      ${wk ? wk.days.map((day, di) => `
      <div style="display:flex;align-items:center;justify-content:space-between;width:100%;gap:var(--sp-2)">
        <span style="font-size:13px;font-weight:600;color:var(--c-accent);font-family:var(--font-display);letter-spacing:.08em">${h(day.title)}</span>
        <span style="font-size:11px;color:var(--c-text-3)">${day.exercises.length} Übungen</span>
        ${di === wk.days.length - 1 && wk.days.length > 1 ? `
        <button class="btn btn--sm" style="border-color:var(--c-danger);color:var(--c-danger);padding:0 var(--sp-2)"
          data-action="remove-day" data-di="${di}"
          aria-label="${h(day.title)} entfernen"
        >${ic.minus()}</button>` : '<div style="width:52px"></div>'}
      </div>`).join('') : ''}
    </div>
  </div>

  <!-- Template -->
  <div class="settings-section">
    <div class="settings-section__title">Vorlagen</div>
    <div class="settings-row settings-row--clickable" data-action="open-tpl">
      <div>
        <div class="settings-row__label">📋 Standard-Template bearbeiten</div>
        <div class="settings-row__desc">Vorlage für neue Wochen anpassen</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <div class="settings-row settings-row--clickable" data-action="reset-to-tpl">
      <div>
        <div class="settings-row__label">🔄 Woche zurücksetzen</div>
        <div class="settings-row__desc">Aktuelle Woche mit Standard-Template überschreiben</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <div class="settings-row settings-row--clickable" data-action="save-named-template">
      <div>
        <div class="settings-row__label">${ic.plus()} Aktuelle Woche als Vorlage speichern</div>
        <div class="settings-row__desc">Benannte Vorlage aus der aktuellen Woche erstellen</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    ${(state.templates ?? []).length > 0 ? `
    <div class="settings-row__label" style="padding:8px 16px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--c-text-3)">Gespeicherte Vorlagen</div>
    ${state.templates.map((t, i) => `
    <div class="settings-row" style="display:flex;justify-content:space-between;align-items:center">
      <span class="settings-row__label">${h(t.name ?? `Vorlage ${i+1}`)}</span>
      <button class="btn btn--ghost btn--sm" data-action="delete-named-template" data-tpl-id="${t.id}"
        aria-label="Vorlage '${h(t.name ?? '')}' löschen"
      >${ic.trash()}</button>
    </div>`).join('')}` : ''}
    <div class="settings-row settings-row--clickable" data-action="reset-factory">
      <div>
        <div class="settings-row__label" style="color:var(--c-danger)">↺ Original wiederherstellen</div>
        <div class="settings-row__desc">Custom-Template auf Werkseinstellung zurücksetzen</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
  </div>

  <!-- CSV-Export (Erweitert) -->
  <div class="settings-section">
    <div class="settings-row settings-row--clickable" data-action="open-export">
      <div>
        <div class="settings-row__label">${ic.download()} Woche exportieren (CSV)</div>
        <div class="settings-row__desc">Trainingsdaten herunterladen</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
  </div>

  <!-- Meine Übungen -->
  <div class="settings-section">
    <div class="settings-section__title">Meine Übungen</div>
    ${_renderNameCleanupSections(state)}
    ${(() => {
      const realCustomEx = (state.customExercises ?? []).filter(ce => ce.metric != null);
      return realCustomEx.length === 0 ? `
    <p class="settings-row__desc">Noch keine eigenen Übungen — beim Hinzufügen einer Übung über "+ anlegen" erstellt.</p>` : realCustomEx.map(ce => `
    <div class="custom-ex-row">
      <div class="custom-ex-row__main" data-action="edit-custom-ex-settings" data-name="${h(ce.name)}">
        <span class="custom-ex-row__name">${h(ce.name)}</span>
        <span class="custom-ex-row__meta">${ce.category ? h(ce.category) + ' · ' : ''}${ce.metric === 'sec' ? 'Sek' : ce.metric === 'm' ? 'm' : 'Wdh'}</span>
      </div>
      <button class="btn btn--ghost btn--sm" data-action="delete-custom-ex" data-name="${h(ce.name)}" aria-label="Übung '${h(ce.name)}' löschen">✕</button>
    </div>`).join('');
    })()}
  </div>

  <!-- Info -->
  <div class="settings-section">
    <div class="settings-section__title">Info</div>
    <div class="settings-row">
      <div><div class="settings-row__label">Version</div><div class="settings-row__desc">TRAIN train-v174</div></div>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row__label">Zuletzt gespeichert</div>
        <div class="settings-row__desc">${state.meta.savedAt ? new Date(state.meta.savedAt).toLocaleString('de-DE') : '–'}</div>
      </div>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row__label">Feedback</div>
        <div class="settings-row__desc">Bug gefunden oder Idee? <a href="mailto:DEINE-EMAIL@beispiel.de?subject=TRAIN%20Feedback" style="color:var(--c-accent)">Schreib mir</a></div>
      </div>
    </div>
    <div class="session-note-block">
      <button class="session-note-toggle" onclick="this.nextElementSibling.classList.toggle('is-open'); this.classList.toggle('is-expanded')">
        <span>Datenschutz</span>
      </button>
      <div class="session-note-body">
        <div class="settings-row__desc" style="padding:var(--sp-2) 0">
          Deine Trainingsdaten bleiben ausschließlich lokal auf diesem Gerät
          gespeichert (Browser-Storage) — kein Konto, kein Server, keine
          Übertragung deiner Workout-Daten an Dritte. Für anonyme Nutzungs-
          Zählung (wie viele Personen die App öffnen) wird GoatCounter
          eingesetzt — cookielos, ohne personenbezogene Daten, ohne
          Werbe-Tracking. Schriftarten werden selbst gehostet, es findet kein
          Aufruf bei Google statt.
        </div>
      </div>
    </div>
    <div class="session-note-block">
      <button class="session-note-toggle" onclick="this.nextElementSibling.classList.toggle('is-open'); this.classList.toggle('is-expanded')">
        <span>Impressum</span>
      </button>
      <div class="session-note-body">
        <div class="settings-row__desc" style="padding:var(--sp-2) 0">
          TODO: vor Veröffentlichung ausfüllen — Name und Kontaktmöglichkeit
          (z.B. E-Mail oder Anschrift) des Betreibers.
        </div>
      </div>
    </div>
  </div>`;
}

// ─── Template editor ──────────────────────────────────────────────────────────
function renderTemplateEditor(state) {
  const container = document.getElementById('tpl-editor-body');
  if (!container) return;

  container.innerHTML = state.customTemplate.map((day, di) => `
  <div class="tpl-day-section">
    <div class="tpl-day-title">${h(day.title)} — ${h(day.subtitle)}</div>
    ${day.exercises.map((ex, ei) => `
    <div class="tpl-exercise">
      <div class="tpl-ex-top">
        <input class="tpl-name-input" type="text" value="${ex.name}"
          data-tpl-di="${di}" data-tpl-ei="${ei}" data-tpl-field="name"
          aria-label="Übungsname" maxlength="80"
        />
        <button class="exercise__remove-btn" data-tpl-action="rm-ex"
          data-tpl-di="${di}" data-tpl-ei="${ei}"
          aria-label="Übung aus Template entfernen"
        >${ic.trash()}</button>
      </div>
      <input class="tpl-note-input" type="text" value="${h(ex.note ?? '')}"
        placeholder="Notiz …"
        data-tpl-di="${di}" data-tpl-ei="${ei}" data-tpl-field="note"
        aria-label="Notiz"
      />
      <div class="tpl-sets-row">
        <span>Sätze:</span>
        <input class="tpl-num" type="number" min="1" max="8" value="${ex.sets.length}"
          data-tpl-di="${di}" data-tpl-ei="${ei}" data-tpl-field="setsCount"
          aria-label="Anzahl Sätze"
        />
        <span>Wdh:</span>
        <input class="tpl-num" type="number" min="1" value="${ex.sets[0]?.reps ?? 10}"
          data-tpl-di="${di}" data-tpl-ei="${ei}" data-tpl-field="reps"
          aria-label="Standard-Wiederholungen"
        />
        <span>kg:</span>
        <input class="tpl-num" type="number" min="0" step="0.5" value="${ex.sets[0]?.weight ?? 0}"
          data-tpl-di="${di}" data-tpl-ei="${ei}" data-tpl-field="weight"
          aria-label="Standard-Gewicht"
        />
      </div>
    </div>`).join('')}
    <button class="btn btn--ghost btn--sm" data-tpl-action="add-ex" data-tpl-di="${di}"
      style="margin-top:4px" aria-label="Übung hinzufügen">
      ${ic.plus()} Übung hinzufügen
    </button>
  </div>`).join('');
}

// ════════════════════════════════════════════════════════════════════════════
// EVENT DELEGATION  ← FIXED: single clean function, closest() everywhere
// ════════════════════════════════════════════════════════════════════════════

function _bindEvents(root) {
  root.addEventListener('click',   _handleClick);
  root.addEventListener('change',  _handleChange);
  root.addEventListener('input',   _handleInput);
  root.addEventListener('keydown', _handleKeydown);
  root.addEventListener('blur',    _handleBlur, { capture: true });
}

/**
 * Single click handler for the entire app.
 *
 * Every branch uses e.target.closest() to walk up the DOM from the actual
 * clicked element to the intended target.  This means clicking on a child
 * element (SVG icon, span, pill, subtitle div) works exactly the same as
 * clicking the parent button/div.
 *
 * Order of precedence (most-specific first):
 *   1. Inputs / textareas inside day-card__header  → absorbed, do nothing
 *   2. Day-card header (accordion toggle)          → uses closest('.day-card__header')
 *   3. Elements with [data-action]                 → uses closest('[data-action]')
 *   4. Template editor actions [data-tpl-action]   → uses closest('[data-tpl-action]')
 */
function _handleClick(e) {

  // Close Kennzahlen-Erklärungstooltip when clicking outside it (D2)
  if (_metricTooltipKey !== null
      && !e.target.closest('.metric-tooltip')
      && !e.target.closest('[data-action="toggle-metric-tooltip"]')) {
    _metricTooltipKey = null;
    scheduleRender();
  }

  // Close RPE popover when clicking outside it (2.2)
  if (_rpePopoverKey !== null
      && !e.target.closest('.rpe-popover')
      && !e.target.closest('[data-action="open-rpe-popover"]')) {
    _rpePopoverKey = null;
    scheduleRender();
  }

  // Close exercise ⋮ menu when clicking outside the toggle button
  if (_exMenuOpenKey !== null && !e.target.closest('[data-action="toggle-ex-menu"]')) {
    _exMenuOpenKey = null;
    scheduleRender();
  }

  // Close day ⋮ menu when clicking outside the toggle button
  if (_dayMenuOpenKey !== null && !e.target.closest('[data-action="toggle-day-menu"]')) {
    _dayMenuOpenKey = null;
    scheduleRender();
  }

  // Close week ⋮ menu (Timer-Höhe, day-tab-bar__toolbar) when clicking
  // outside the toggle button — Fix 3, train-v106. Selecting an item also
  // closes it via this same check, same pattern as the ex-/day-menu above.
  if (_weekMenuOpen && !e.target.closest('[data-action="toggle-week-menu"]')) {
    _weekMenuOpen = false;
    scheduleRender();
  }

  // Close exercise settings panel on outside tap
  if (_cfgOpenKey !== null) {
    const _inSettings = !!e.target.closest('.exercise__settings');
    const [_ckdi, _ckei] = _cfgOpenKey.split('-');
    const _onSameCfg = !!e.target.closest(`[data-action="toggle-cfg"][data-di="${_ckdi}"][data-ei="${_ckei}"]`);
    if (!_inSettings && !_onSameCfg) {
      const _cdi = +_ckdi, _cei = +_ckei;
      _cfgOpenKey = null;
      dispatch(A.EX_TOGGLE_CFG, { di: _cdi, ei: _cei });
    }
  }

  // Dismiss RPE nudge on outside tap
  if (_rpeNudgeKey !== null && !e.target.closest('.rpe-nudge') && !e.target.closest('[data-action="confirm-set"]')) {
    clearTimeout(_rpeNudgeTimer);
    _rpeNudgeKey  = null;
    _rpeNudgeTimer = null;
    scheduleRender();
  }

  // Close +kg / +Wdh picker on outside tap
  if ((_kgPickerKey !== null || _repsPickerKey !== null) && !e.target.closest('.ex-kg-wrap')) {
    _kgPickerKey    = null;
    _kgPickerCustom = false;
    _repsPickerKey  = null;
    scheduleRender();
  }

  // Feature B (2026-07-14): "Anderer Wert"-Picker im Neue-Woche-Modal auf
  // Außerhalb-Tap schließen — eigener Re-Render-Aufruf nötig (_prepNewWeekModal(),
  // nicht scheduleRender()), da das Modal einen eigenen Render-Pfad hat.
  if (_recChipCustomOpenName !== null && !e.target.closest('.nw-weight-rec-wrap')) {
    _recChipCustomOpenName = null;
    _prepNewWeekModal();
  }

  // Close confirm-set no-target popup on outside tap
  document.querySelectorAll('.confirm-set-no-target').forEach(el => {
    if (!el.contains(e.target)) { clearTimeout(el._timer); el.remove(); }
  });

  // ── 1. Day tab button ────────────────────────────────────────────────────
  const hdr = e.target.closest('.day-tab');
  if (hdr) {
    const di = hdr.dataset.dayHdr;
    if (di !== undefined) _toggleAccordion(+di);
    return;
  }

  // ── 2. Elements with [data-action] ──────────────────────────────────────
  const el = e.target.closest('[data-action]');
  if (!el) {
    // ── 3. Template editor actions ─────────────────────────────────────────
    const tplEl = e.target.closest('[data-tpl-action]');
    if (tplEl) _handleTplAction(tplEl);
    return;
  }

  const action             = el.dataset.action;
  const { di, ei, si, field, key, val, sec } = el.dataset;

  switch (action) {

    case 'show-badge-detail': {
      const thr = BADGE_THRESHOLDS.find(t => t.id === el.dataset.badgeId);
      const earned = (getState().badges ?? []).find(b => b.id === el.dataset.badgeId);
      if (thr && earned) _showBadgeDetail(thr, earned);
      break;
    }

    // ── Overview mode ─────────────────────────────────────────────────────
    case 'toggle-overview':
      _overviewMode = !_overviewMode;
      scheduleRender();
      break;

    // ── Body correlation insight toggle (2.2) ──────────────────────────────
    case 'toggle-body-insights':
      _showBodyInsights = !_showBodyInsights;
      scheduleRender();
      break;

    // ── Kennzahlen-Erklärung (Fortschritt-Tab, D2) ─────────────────────────
    case 'toggle-metric-tooltip': {
      const _mKey = el.dataset.metric;
      _metricTooltipKey = _metricTooltipKey === _mKey ? null : _mKey;
      scheduleRender();
      break;
    }

    // ── Session rating / fatigue indicator (3.5) ───────────────────────────
    case 'set-session-rating': {
      const cur = getState().weeks[getState().curIdx]?.days?.[+el.dataset.di]?.sessionRating;
      const val = +el.dataset.val;
      // Toggle off if clicking the already-selected rating
      dispatch(A.DAY_SET_FIELD, { di: +el.dataset.di, field: 'sessionRating', value: cur === val ? null : val });
      break;
    }

    case 'overview-open-day': {
      _overviewMode  = false;
      _activeDayIdx  = +el.dataset.di;
      scheduleRender();
      break;
    }

    // ── TRAIN logo home button (5.1) ───────────────────────────────────────
    case 'go-home':
      _switchToTab('workout');
      break;

    // ── Week navigation ────────────────────────────────────────────────────
    case 'undo':
      dispatch(A.UNDO, {});
      showToast('Rückgängig gemacht ↩', 'ok');
      break;

    case 'reset-timer': {
      const _rst = getState();
      const _rwk = _rst.weeks[_rst.curIdx];
      if (!_rwk) break;
      const _rdi = _activeDayIdx !== null
        ? _activeDayIdx
        : _rwk.days.findIndex(d => d.sessionStartTs && !d.sessionEndTs);
      const _rday = _rdi >= 0 ? _rwk.days[_rdi] : null;
      if (!_rday?.sessionStartTs) break;
      if (!confirm('Timer zurücksetzen?')) break;
      dispatch(A.SESSION_RESET, { di: _rdi });
      break;
    }

    case 'nav-prev':
      dispatch(A.WEEK_NAVIGATE, { delta: -1 }); break;

    case 'nav-next':
      dispatch(A.WEEK_NAVIGATE, { delta: 1 }); break;

    case 'toggle-week-menu': {
      _weekMenuOpen = !_weekMenuOpen;
      scheduleRender();
      break;
    }

    case 'mode-std':
      _weekMenuOpen = false;
      dispatch(A.WEEK_SET_MODE, { mode: 'standard' }); break;

    case 'mode-dl':
      _weekMenuOpen = false;
      _maybeShowTip('tip-08', 'Deload-Woche: reduziertes Training zur Erholung. TRAIN schließt diese Woche aus der Fortschrittsanalyse aus — kein Einfluss auf Steigerungsempfehlungen.');
      dispatch(A.WEEK_SET_MODE, { mode: 'deload' }); break;

    case 'mode-vac': {
      _weekMenuOpen = false;
      _showVacationWeekPopup();
      break;
    }

    case 'toggle-day-vacation': {
      const _di  = +di;
      const _day = getState().weeks[getState().curIdx]?.days[_di];
      if (_day?.isVacation) {
        _dayMenuOpenKey = null;
        _weekMenuOpen = false;
        dispatch(A.DAY_TOGGLE_VACATION, { di: _di });
      } else {
        _maybeShowTip('tip-09', 'Urlaubstage unterbrechen deinen Trainingsrhythmus nicht. Markiere sie damit TRAIN deine Analyse korrekt berechnet.');
        _dayMenuOpenKey = null;
        _weekMenuOpen = false;
        scheduleRender();
        _showVacationPlanModal(_di);
      }
      break;
    }

    case 'open-new-week': {
      const _st = getState();
      const _lastWk = getLatestWeek(_st.weeks);
      const _hasCompleted = _lastWk?.days.some(d => d.markedDone);
      _moreRecsOpen = false;
      _userDismissedAutoSelect = new Set();
      _userCustomStepChoice = new Map();
      _recChipCustomOpenName = null;
      if (_hasCompleted) {
        const _review = buildWeekReview(_lastWk, _st.weeks, _st.favoriteExercises ?? []);
        showWeekReviewModal(_review, () => { _prepNewWeekModal(); openModal('modal-new-week'); });
      } else {
        _prepNewWeekModal();
        openModal('modal-new-week');
      }
      break;
    }

    case 'rename-week': {
      _weekMenuOpen = false;
      const _wkNow = getState().weeks[getState().curIdx];
      const _curLabel = _wkNow?.label ?? '';
      const _newLabel = prompt('Woche umbenennen (leer lassen = Datum anzeigen):', _curLabel);
      if (_newLabel === null) break;
      dispatch(A.WEEK_SET_LABEL, { label: _newLabel.trim().slice(0, 40) });
      break;
    }

    case 'copy-prev':
      _weekMenuOpen = false;
      if (!confirm('Aktuelle Woche mit der Vorwoche überschreiben?\nAlle aktuellen Einträge gehen verloren.')) break;
      dispatch(A.WEEK_COPY_PREV, {});
      showToast('Vorwoche übernommen ✓', 'ok'); break;

    case 'open-export':
      openModal('modal-export'); break;

    case 'open-delete-week': {
      const _wIdx = el.dataset.weekIdx !== undefined ? +el.dataset.weekIdx : getState().curIdx;
      _deleteWeekIdx = _wIdx;
      openModal('modal-delete-week');
      break;
    }

    case 'create-week':
    case 'create-week-prev':
    case 'create-week-template':
      _createWeek(); break;

    case 'confirm-delete-week':
      dispatch(A.WEEK_DELETE, { weekIdx: _deleteWeekIdx ?? undefined });
      _deleteWeekIdx = null;
      closeModal('modal-delete-week');
      showToast('Woche gelöscht', 'info'); break;

    case 'save-week-as-template':
      dispatch(A.SAVE_WEEK_AS_TEMPLATE, {});
      showToast('Woche als Standard-Vorlage gespeichert ✓', 'ok');
      break;

    // ── KI-Gewichtsempfehlung übernehmen/ablehnen (Modal-Chip) ─────────────
    case 'toggle-weight-rec': {
      const recName  = el.dataset.name;
      const recDelta = parseFloat(el.dataset.delta ?? '0');
      const _recSt   = getState();
      const _recWk   = getLatestWeek(_recSt.weeks);
      if (!_recWk) break;
      const _recWkIdx = _recSt.weeks.indexOf(_recWk);
      // Feature B (2026-07-14): wenn ein Custom-Wert bestätigt ist, muss der
      // Klick auf den Chip selbst GEGEN den Custom-Wert prüfen (nicht gegen
      // recDelta) — sonst würde ein Tap auf einen bereits mit Custom-Wert
      // bestätigten Chip diesen fälschlich auf den vollen Empfehlungswert
      // überschreiben statt ihn abzuwählen.
      const _expectedValue = _userCustomStepChoice.has(recName) ? _userCustomStepChoice.get(recName) : recDelta;
      (_recWk.days ?? []).forEach((day, _rdi) => {
        (day.exercises ?? []).forEach((ex, _rei) => {
          if (ex.name !== recName) return;
          const wasConfirmed = ex.nextWeekPlanConfirmed && ex.nextWeekPlan === _expectedValue;
          if (wasConfirmed) {
            // Nutzer wählt GERADE ab — merken, bevor der Re-Render unten die
            // Auto-Vorauswahl-Berechnung erneut ausführt (sonst snapt der
            // Chip im selben Klick sofort wieder zurück, siehe Diagnose).
            _userDismissedAutoSelect.add(recName);
            _userCustomStepChoice.delete(recName); // Custom-Wahl verwerfen bei Abwahl
            dispatch(A.EX_TOGGLE_NEXT_WEEK_CONFIRMED, { di: _rdi, ei: _rei, weekIdx: _recWkIdx });
          } else {
            dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: _rdi, ei: _rei, value: recDelta, weekIdx: _recWkIdx });
          }
        });
      });
      _prepNewWeekModal(); // full re-render: name prefix, action text, subline all stay in sync
      break;
    }

    // Feature B (2026-07-14): öffnet den "Anderer Wert"-Eingabemodus für den
    // Empfehlungs-Chip im "Neue Woche"-Modal — reine UI-State-Änderung,
    // kein Dispatch.
    case 'rec-chip-show-custom': {
      _recChipCustomOpenName = el.dataset.name;
      _prepNewWeekModal();
      setTimeout(() => document.getElementById('rec-chip-custom-input')?.focus(), 50);
      break;
    }

    case 'rec-chip-custom-confirm': {
      const _recName      = el.dataset.name;
      const _customInput  = document.getElementById('rec-chip-custom-input');
      const _customVal    = parseFloat(_customInput?.value);
      if (!Number.isFinite(_customVal) || _customVal < 0) break;

      const _recSt2   = getState();
      const _recWk2   = getLatestWeek(_recSt2.weeks);
      if (!_recWk2) break;
      const _recWkIdx2 = _recSt2.weeks.indexOf(_recWk2);
      let _recUnit = 'kg';
      (_recWk2.days ?? []).forEach((day, _rdi) => {
        (day.exercises ?? []).forEach((ex, _rei) => {
          if (ex.name !== _recName) return;
          _recUnit = ex.metric === 'sec' ? 'Sek' : ex.metric === 'm' ? 'm' : 'kg';
          dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: _rdi, ei: _rei, value: _customVal, weekIdx: _recWkIdx2 });
        });
      });
      // Markiert den Custom-Wert EXPLIZIT — verhindert, dass die nächste
      // _prepNewWeekModal()-Auswertung ihn stillschweigend auf den vollen
      // rec.delta zurücksetzt (siehe _prepNewWeekModal()-Kommentar unten).
      _userCustomStepChoice.set(_recName, _customVal);
      _recChipCustomOpenName = null;
      showToast(`+${_customVal}${_recUnit} nächste Woche bestätigt (angepasst)`, 'ok');
      _prepNewWeekModal();
      break;
    }

    // ── "Weitere Übungen anzeigen" Toggle (KI-Empfehlungen) ────────────────
    case 'toggle-more-recs':
      _moreRecsOpen = !_moreRecsOpen;
      _prepNewWeekModal();
      break;

    // ── Export options (previously role=button without data-action) ────────
    case 'export-current':
      exportCSV('current');
      closeModal('modal-export');
      showToast('CSV wird heruntergeladen …', 'ok'); break;

    case 'export-all':
      exportCSV('all');
      closeModal('modal-export');
      showToast('CSV wird heruntergeladen …', 'ok'); break;

    // ── Day ────────────────────────────────────────────────────────────────
    case 'add-day': {
      // 2.2: show clone dialog instead of directly adding empty day
      const wkDays = getState().weeks[getState().curIdx]?.days ?? [];
      const opts   = document.getElementById('add-day-options');
      if (opts) {
        opts.innerHTML = [
          `<label class="nw-source nw-source--check">
            <input type="radio" name="add-day-src" value="empty" checked />
            <span>Leerer Tag</span>
          </label>`,
          ...wkDays.map((d, i) => `
          <label class="nw-source nw-source--check">
            <input type="radio" name="add-day-src" value="${i}" />
            <span>${h(d.title)}${d.subtitle ? ` – ${h(d.subtitle)}` : ''} klonen</span>
          </label>`),
        ].join('');
      }
      openModal('modal-add-day');
      break;
    }
    case 'confirm-add-day': {
      const sel     = document.querySelector('input[name="add-day-src"]:checked');
      const srcVal  = sel?.value ?? 'empty';
      const sourceDi = srcVal === 'empty' ? null : +srcVal;
      dispatch(A.DAY_ADD_CLONE, { sourceDi });
      closeModal('modal-add-day');
      showToast('Neuer Trainingstag hinzugefügt', 'ok');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    // Wochen-Menü-Eintrag (Fix 5, train-v106): kein Modal nötig — direkte
    // Aktion, fügt sofort einen leeren Tag an (gleicher Reducer wie
    // confirm-add-day mit sourceDi:null, nur ohne den Klon-Auswahl-Dialog).
    case 'week-menu-add-day': {
      dispatch(A.DAY_ADD_CLONE, { sourceDi: null });
      _weekMenuOpen = false;
      showToast('Neuer Trainingstag hinzugefügt', 'ok');
      break;
    }

    // Plateau-Aktionen im Coach-Tab (Sprint C2, train-v109) — "since" ist der
    // Wochenstart der chronologisch letzten Woche, dieselbe Anker-Konvention
    // wie _isPlateauSuppressed()/_relativeWeekLabel() (nicht state.curIdx,
    // das kann beim Navigieren auf eine andere Woche zeigen).
    case 'coach-answer': {
      dispatch(A.COACH_ANSWER, {
        weekStart:  el.dataset.week,
        questionId: el.dataset.qid,
        answer:     el.dataset.answer,
      });
      showToast('Antwort gespeichert', 'ok');
      break;
    }

    case 'coach-perf-details': {
      _switchToTab('progress');
      setTimeout(() => {
        const bilanzEl = document.querySelector('.coach-bilanz');
        if (bilanzEl) bilanzEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
      break;
    }

    case 'plateau-implemented':
    case 'plateau-ignore': {
      const _plSt = getState();
      const curWk = getLatestWeek(_plSt.weeks);
      if (!curWk) break;
      const isImplemented = action === 'plateau-implemented';

      // Aufgeklappt-Zustand von "Warum?" merken — die Feedback-Karte ersetzt
      // das <details>-Element für 3s durch ein neues (DOM-Rebuild verliert
      // den open-State), danach wird er wiederhergestellt (renderCoachTab()).
      const whyEl = document.querySelector('.coach-why-collapse');
      _whyWasOpen = whyEl?.open ?? false;

      // Plateau-Details (strategy/currentWeight) VOR dem PLATEAU_ACTION-Dispatch
      // lesen — danach ist genau dieses Plateau sofort unterdrückt und
      // computeWeeklyFocus() liefert es nicht mehr.
      const _plFocus = computeWeeklyFocus(_plSt);
      const plateau = (_plFocus.status === 'plateau' && _plFocus.plateau.exerciseName === el.dataset.ex)
        ? _plFocus.plateau : null;

      // _plateauActionFeedback VOR den Dispatches setzen: jeder dispatch()
      // löst über subscribe(scheduleRender) einen Re-Render aus — der muss
      // bereits die Feedback-Karte zeigen (sonst würde ein Zwischen-Render mit
      // der normalen Fokus-Karte den einmaligen _whyWasOpen-Restore vorzeitig
      // verbrauchen, bevor die Feedback-Phase überhaupt sichtbar war).
      _plateauActionFeedback = { action: isImplemented ? 'implemented' : 'ignored', exerciseName: el.dataset.ex };
      setTimeout(() => {
        _plateauActionFeedback = null;
        scheduleRender();
      }, 3000);

      dispatch(A.PLATEAU_ACTION, {
        exerciseName: el.dataset.ex,
        action: isImplemented ? 'implemented' : 'ignored',
        since: curWk.startDate,
        plateauWeeksAtAction: +el.dataset.pw,
      });

      // Automatische Konsequenz — nur bei "Habe ich umgesetzt", nur für
      // 'deload'/'volume' (numerisch eindeutig). 'variation' hat zwei
      // konkurrierende Stellschrauben (-5kg ODER +3 Wdh) und bleibt manuell.
      if (isImplemented && plateau && (plateau.strategy === 'deload' || plateau.strategy === 'volume')) {
        const weekIdx = _plSt.weeks.indexOf(curWk);
        for (let di = 0; di < curWk.days.length; di++) {
          const ei = curWk.days[di].exercises.findIndex(ex => ex.name === plateau.exerciseName);
          if (ei === -1) continue;
          if (plateau.strategy === 'deload') {
            const ex = curWk.days[di].exercises[ei];
            const weightStep = ex.weightStep || 2.5;
            const rawDelta = -(plateau.currentWeight * 0.225);
            // Auf weightStep runden — bei sehr leichten Gewichten kann das auf 0
            // runden (_applyPlannedProgression behandelt plan=0 als "kein Plan"
            // und wendet nichts an); dann mindestens einen weightStep abziehen,
            // damit "Habe ich umgesetzt" nie ein stiller No-Op wird.
            const delta = Math.round(rawDelta / weightStep) * weightStep || -weightStep;
            dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di, ei, value: delta, weekIdx });
          } else {
            // Ein einzelner Dispatch (statt EX_UPDATE + EX_SET_NEXT_WEEK_PLAN
            // getrennt) — sonst landen zwei Undo-Stack-Einträge für eine
            // logisch atomare Aktion, und ein Undo würde nur nextWeekPlan
            // zurücksetzen, progressionType='sets' aber stehen lassen.
            dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di, ei, value: 1, weekIdx, progressionType: 'sets' });
          }
          break;
        }
      }

      showToast(isImplemented ? '✓ Als umgesetzt markiert' : 'Plateau-Hinweis ausgeblendet', 'ok');
      break;
    }

    // Abwägungs-Entscheidungen loggen (Sprint: decision log)
    case 'decision-log-stay':
    case 'decision-log-change': {
      // Guard: nur loggen wenn der aktuelle Fokus überhaupt eine Decisional
      // Balance hat (z.B. nicht mehr bei 'plateau' — siehe plateauActions).
      const _dlState = getState();
      const _dlFocus = computeWeeklyFocus(_dlState);
      if (!buildDecisionalBalance(_dlFocus)) break;
      const _d = new Date();
      const _dow = _d.getDay();
      _d.setDate(_d.getDate() + (_dow === 0 ? -6 : 1 - _dow));
      const decidedWeekStart = _d.toISOString().slice(0, 10);
      dispatch(A.DECISION_LOG_ADD, {
        type: el.dataset.type,
        signal: el.dataset.signal,
        choice: action === 'decision-log-stay' ? 'stay' : 'change',
        decidedWeekStart,
      });

      // B26: persistent_failure "Empfehlung folgen" setzt zusätzlich direkt
      // einen EX_SET_NEXT_WEEK_PLAN für die betroffene Übung — identisches
      // Dispatch-Muster wie die Plateau-deload-Strategie (di/ei per Name in
      // der aktuellen Woche suchen, weekIdx mitgeben), aber mit dem bereits
      // in _checkPersistentFailure() berechneten deloadFactor-Delta statt
      // Plateaus eigenem hartkodierten 22.5%-Wert (bewusste Abweichung —
      // sonst würde die im Coach-Text angezeigte "~X kg"-Empfehlung nicht
      // zum tatsächlich gesetzten Wert passen).
      if (_dlFocus.status === 'persistent_failure' && action === 'decision-log-change') {
        const curWk = getLatestWeek(_dlState.weeks);
        let _applied = false;
        if (curWk && _dlFocus.currentWeight != null) {
          const weekIdx = _dlState.weeks.indexOf(curWk);
          for (let di = 0; di < curWk.days.length; di++) {
            const ei = curWk.days[di].exercises.findIndex(ex => ex.name === _dlFocus.exerciseName);
            if (ei === -1) continue;
            const ex = curWk.days[di].exercises[ei];
            const weightStep = ex.weightStep || 2.5;
            const deloadFactor = _dlState.settings?.deloadFactor ?? 0.75;
            const rawDelta = -(_dlFocus.currentWeight * (1 - deloadFactor));
            const delta = Math.round(rawDelta / weightStep) * weightStep || -weightStep;
            dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di, ei, value: delta, weekIdx });
            _applied = true;
            break;
          }
        }
        const _targetKg = _dlFocus.suggestedWeight ?? null;
        showToast(_applied && _targetKg != null
          ? `Gewicht für ${_dlFocus.exerciseName} nächste Woche auf ~${_targetKg} kg reduziert.`
          : `Gewicht für ${_dlFocus.exerciseName} nächste Woche reduziert.`, 'ok');
      } else if (_dlFocus.status === 'persistent_failure' && action === 'decision-log-stay') {
        showToast('Entscheidung notiert — TRAIN beobachtet weiter.', 'ok');
      } else {
        showToast('Entscheidung gespeichert', 'ok');
      }
      _checkDecisionOutcomes(getState());
      break;
    }

    // Fix 4a ("Fix3 + Fix4 Nachbessern"): oberes Ende zusätzlich gegen die
    // echte (Nicht-Seed-)Wochenzahl geclampt — identisch zu stepperMax in
    // _renderErkenntnisseSection(), damit +/- konsistent zu dem rechnet,
    // was der Stepper gerade ANZEIGT (nicht gegen einen ggf. höheren, aber
    // unsichtbaren Rohwert in state.settings). Fix 4b: scrollTop von #app
    // wird vor dem Dispatch gesichert und nach dem darauffolgenden Render
    // wiederhergestellt — kein scrollIntoView()/focus() existiert in diesem
    // Pfad; der beobachtete "Sprung" ist ein Layout-Reflow-Artefakt (die
    // Erkenntnisse-Karte kann durch den neuen Horizont ihre Höhe ändern,
    // wodurch die direkt darunterliegende Übungsfortschritt-Karte an die
    // fixe Scroll-Position rutscht). Zweiter rAF (nach dem von
    // scheduleRender() registrierten) läuft garantiert NACH dessen Render,
    // da rAF-Callbacks in Registrierungsreihenfolge abgearbeitet werden.
    case 'erkenntnisse-horizont-dec': {
      const _realWeeks   = getState().weeks.filter(w => !w.isSeedWeek).length;
      const _stepperMax  = _realWeeks > 0 ? Math.max(4, Math.min(52, _realWeeks)) : 52;
      const _curN = Math.max(4, Math.min(_stepperMax, getState().settings?.erkenntnisseHorizont ?? 8));
      if (_curN > 4) {
        const _appEl = document.getElementById('app');
        const _scrollTop = _appEl?.scrollTop ?? 0;
        dispatch(A.SET_ERKENNTNISSE_HORIZONT, { value: _curN - 1 });
        requestAnimationFrame(() => { if (_appEl) _appEl.scrollTop = _scrollTop; });
      }
      break;
    }
    case 'erkenntnisse-horizont-inc': {
      const _realWeeks   = getState().weeks.filter(w => !w.isSeedWeek).length;
      const _stepperMax  = _realWeeks > 0 ? Math.max(4, Math.min(52, _realWeeks)) : 52;
      const _curN = Math.max(4, Math.min(_stepperMax, getState().settings?.erkenntnisseHorizont ?? 8));
      if (_curN < _stepperMax) {
        const _appEl = document.getElementById('app');
        const _scrollTop = _appEl?.scrollTop ?? 0;
        dispatch(A.SET_ERKENNTNISSE_HORIZONT, { value: _curN + 1 });
        requestAnimationFrame(() => { if (_appEl) _appEl.scrollTop = _scrollTop; });
      }
      break;
    }

    case 'remove-day': {
      const _di = +el.dataset.di;
      const _day = getState().weeks[getState().curIdx]?.days[_di];
      if (!confirm(`"${_day?.title ?? 'Tag'}" löschen? Alle Einträge dieses Tags werden entfernt.`)) break;
      if (_activeDayIdx === _di) _activeDayIdx = null;
      else if (_activeDayIdx > _di) _activeDayIdx--;
      _dayMenuOpenKey = null;
      _weekMenuOpen = false;
      dispatch(A.DAY_REMOVE, { di: _di });
      showToast('Tag gelöscht — Undo möglich', 'info');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    case 'toggle-complete': {
      const stBefore  = getState();
      const dayBefore = stBefore.weeks[stBefore.curIdx]?.days[+di];
      if (dayBefore?.markedDone) {
        dispatch(A.DAY_TOGGLE_COMPLETE, { di: +di });
        showToast('Tag entsperrt 🔓', 'info');
      } else if (dayBefore?.vacationPlan === 'rest') {
        dispatch(A.DAY_TOGGLE_COMPLETE, { di: +di });
      } else {
        _showDayCompletionModal(+di);
      }
      break;
    }

    case 'edit-day-field': {
      // 2.3: inline-edit day title / subtitle
      e.stopPropagation();
      const field   = el.dataset.field;
      const curVal  = getState().weeks[getState().curIdx]?.days[+di]?.[field] ?? '';
      const inp     = document.createElement('input');
      inp.type      = 'text';
      inp.value     = curVal;
      inp.className = field === 'title' ? 'day-inline-edit day-inline-edit--title' : 'day-inline-edit day-inline-edit--sub';
      inp.maxLength = 60;
      inp.setAttribute('aria-label', field === 'title' ? 'Tag-Titel bearbeiten' : 'Tag-Schwerpunkt bearbeiten');
      el.replaceWith(inp);
      inp.focus();
      inp.select();
      const _save = () => {
        const val = inp.value.trim();
        dispatch(A.DAY_SET_FIELD, { di: +di, field, value: val });
      };
      inp.addEventListener('blur', _save, { once: true });
      inp.addEventListener('keydown', ev => {
        if (ev.key === 'Enter') { ev.preventDefault(); inp.blur(); }
        if (ev.key === 'Escape') {
          inp.removeEventListener('blur', _save);
          inp.blur();
        }
      });
      break;
    }

    case 'open-ex-search': {
      _openExSearchModal(+di);
      break;
    }

    case 'ex-search-pick': {
      const name = el.dataset.name;
      const customMatch = (getState().customExercises ?? []).find(c => c.name === name);
      dispatch(A.EX_ADD, { di: _exSearchDi, name, metric: customMatch?.metric ?? 'reps' });
      closeModal('modal-ex-search');
      showToast(`"${name}" hinzugefügt`, 'ok');
      break;
    }

    case 'ex-search-create': {
      const query = document.getElementById('ex-search-input')?.value.trim() ?? '';
      closeModal('modal-ex-search');
      _openExFormModal({ mode: 'create', di: _exSearchDi, name: query });
      break;
    }

    case 'ex-form-set-metric': {
      _exFormMetric = el.dataset.metric;
      _renderExFormModal(document.getElementById('ex-form-name')?.value ?? '');
      break;
    }

    case 'ex-form-set-category': {
      const cat = el.dataset.cat;
      _exFormCategory = _exFormCategory === cat ? null : cat;
      _renderExFormModal(document.getElementById('ex-form-name')?.value ?? '');
      break;
    }

    case 'ex-form-submit': {
      const nameInp = document.getElementById('ex-form-name');
      const errEl   = document.getElementById('ex-form-error');
      const name    = nameInp?.value.trim() ?? '';
      if (errEl) errEl.textContent = '';
      if (!name) {
        if (errEl) errEl.textContent = 'Name darf nicht leer sein.';
        nameInp?.focus();
        break;
      }
      const lcName = name.toLowerCase();
      const isDup = _STANDARD_EXERCISES.some(n => n.trim().toLowerCase() === lcName) ||
        (getState().customExercises ?? []).some(c =>
          c.name.trim().toLowerCase() === lcName &&
          c.name.trim().toLowerCase() !== (_exFormOriginalName ?? '').trim().toLowerCase()
        );
      if (isDup) {
        if (errEl) errEl.textContent = 'Diese Übung existiert bereits.';
        break;
      }
      if (_exFormMode === 'edit') {
        dispatch(A.CUSTOM_EX_UPDATE, {
          oldName: _exFormOriginalName, name, metric: _exFormMetric, category: _exFormCategory,
        });
        showToast('Übung aktualisiert ✓', 'ok');
      } else {
        dispatch(A.CUSTOM_EX_ADD, { name, metric: _exFormMetric, category: _exFormCategory });
        if (_exFormTargetDi !== null) {
          dispatch(A.EX_ADD, { di: _exFormTargetDi, name, metric: _exFormMetric });
        }
        showToast(`"${name}" hinzugefügt`, 'ok');
      }
      closeModal('modal-ex-form');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    // ── Exercise ───────────────────────────────────────────────────────────
    case 'toggle-cfg': {
      dispatch(A.EX_TOGGLE_CFG, { di: +di, ei: +ei });
      const _cfgEx = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      _cfgOpenKey = _cfgEx?._showCfg ? `${di}-${ei}` : null;
      break;
    }

    case 'toggle-cfg-adv': {
      const _advKey = `${di}-${ei}`;
      if (_cfgAdvOpen.has(_advKey)) _cfgAdvOpen.delete(_advKey);
      else _cfgAdvOpen.add(_advKey);
      scheduleRender();
      break;
    }

    case 'edit-custom-ex': {
      const exToEdit = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      if (!exToEdit) break;
      const ce = (getState().customExercises ?? []).find(c => c.name === exToEdit.name && c.metric != null);
      if (!ce) break;
      _openExFormModal({ mode: 'edit', name: ce.name, metric: ce.metric, category: ce.category, originalName: ce.name });
      break;
    }

    case 'toggle-fav': {
      const favName = el.dataset.name;
      const curFavs = getState().favoriteExercises ?? [];
      if (!curFavs.includes(favName) && curFavs.length >= 5) {
        showToast('Max. 5 Favoriten möglich. Entferne zuerst einen anderen.', 'warn');
        break;
      }
      dispatch(A.TOGGLE_FAVORITE, { name: favName });
      break;
    }

    case 'set-pause':
      dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'pauseSec', value: +sec }); break;

    case 'remove-ex':
      if (confirm('Übung entfernen?')) {
        dispatch(A.EX_REMOVE, { di: +di, ei: +ei });
      }
      break;

    case 'open-archive-confirm':
      _archiveConfirmKey = `${di}-${ei}`;
      _exMenuOpenKey = null;
      renderDayList(getState());
      break;

    case 'confirm-archive-ex':
      dispatch(A.EX_ARCHIVE, { di: +di, ei: +ei, weekIdx: getState().curIdx });
      _archiveConfirmKey = null;
      break;

    case 'cancel-archive-ex':
      _archiveConfirmKey = null;
      renderDayList(getState());
      break;

    case 'unarchive-ex':
      dispatch(A.EX_UNARCHIVE, { name: el.dataset.name });
      break;

    case 'toggle-ex-menu': {
      const _menuKey = `${di}-${ei}`;
      _exMenuOpenKey = _exMenuOpenKey === _menuKey ? null : _menuKey;
      scheduleRender();
      break;
    }

    case 'toggle-day-menu': {
      _dayMenuOpenKey = _dayMenuOpenKey === di ? null : di;
      scheduleRender();
      break;
    }

    case 'day-rename': {
      const _rDay = getState().weeks[getState().curIdx]?.days[+di];
      const _newTitle = prompt('Tag umbenennen (max. 20 Zeichen):', _rDay?.title ?? '');
      if (_newTitle === null) break;
      const _trimmed = _newTitle.trim().slice(0, 20);
      if (!_trimmed) break;
      dispatch(A.DAY_RENAME, { di: +di, title: _trimmed });
      _dayMenuOpenKey = null;
      _weekMenuOpen = false;
      break;
    }

    case 'day-duplicate': {
      dispatch(A.DAY_DUPLICATE, { di: +di });
      _dayMenuOpenKey = null;
      _weekMenuOpen = false;
      showToast('Tag dupliziert — Undo möglich', 'info');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    case 'day-reset-sets': {
      const _rsDay = getState().weeks[getState().curIdx]?.days[+di];
      if (!confirm(`Alle Sätze von "${_rsDay?.title ?? 'Tag'}" zurücksetzen? Eingetragene Werte gehen verloren.`)) break;
      dispatch(A.DAY_RESET_SETS, { di: +di });
      _dayMenuOpenKey = null;
      _weekMenuOpen = false;
      showToast('Sätze zurückgesetzt — Undo möglich', 'info');
      break;
    }

    case 'day-edit-note': {
      _dayMenuOpenKey = null;
      _activeDayIdx = +di;
      scheduleRender();
      setTimeout(() => {
        const _noteArea = document.querySelector(`[data-action="day-field"][data-di="${di}"][data-field="sessionNote"]`);
        _noteArea?.focus();
        _noteArea?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 80);
      break;
    }

    case 'open-sub-form':
      _maybeShowTip('tip-11', 'Ersetzt diese Übung nur für heute. Nächste Woche kehrt TRAIN automatisch zur Originalübung zurück.');
      _subFormOpenKey = `${di}-${ei}`;
      scheduleRender();
      break;

    case 'close-sub-form':
      _subFormOpenKey = null;
      scheduleRender();
      break;

    case 'confirm-sub': {
      const _subInp = document.querySelector(`.sub-name-input[data-di="${di}"][data-ei="${ei}"]`);
      const _subName = _subInp?.value.trim();
      if (!_subName) { _subInp?.focus(); break; }
      dispatch(A.EX_SET_SUBSTITUTE, { di: +di, ei: +ei, substituteFor: _subName });
      _subFormOpenKey = null;
      break;
    }

    case 'reset-sub':
      dispatch(A.EX_SET_SUBSTITUTE, { di: +di, ei: +ei, substituteFor: null });
      break;

        case 'move-ex-up': {
      const toEi = +ei - 1;
      if (toEi >= 0) {
        dispatch(A.EX_MOVE, { di: +di, fromEi: +ei, toEi });
        // Wartet kurz das Neuladen ab und scrollt den Pfeil dann in die Mitte
        setTimeout(() => {
          const newBtn = document.querySelector(`[data-action="move-ex-up"][data-di="${di}"][data-ei="${toEi}"]`);
          if (newBtn) newBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
      break;
    }
      
    case 'inc-weight': {
      _maybeShowTip('tip-01', 'Plane deine Steigerung für nächste Woche. Einmal tippen = bestätigen · zweimal tippen = Wert wählen.');
      const _iwEx    = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      const _isRepsM = (_iwEx?.progressionType ?? 'weight') === 'reps' || (_iwEx?.progressionType ?? 'weight') === 'sets';
      const _tapKey  = `${di}-${ei}`;
      const _now     = Date.now();
      if (_isRepsM) {
        const _last = _repsPickerLastTap[_tapKey] || 0;
        if (_now - _last < 400) {
          _repsPickerLastTap[_tapKey] = 0;
          _repsPickerKey = _repsPickerKey === _tapKey ? null : _tapKey;
          _kgPickerKey   = null;
          scheduleRender();
        } else {
          _repsPickerLastTap[_tapKey] = _now;
          setTimeout(() => {
            if (_repsPickerLastTap[_tapKey] === _now) {
              _repsPickerLastTap[_tapKey] = 0;
              dispatch(A.EX_TOGGLE_NEXT_WEEK_CONFIRMED, { di: +di, ei: +ei });
            }
          }, 400);
        }
      } else {
        const _last = _kgPickerLastTap[_tapKey] || 0;
        if (_now - _last < 400) {
          _kgPickerLastTap[_tapKey] = 0;
          _kgPickerKey    = _kgPickerKey === _tapKey ? null : _tapKey;
          _kgPickerCustom = false;
          _repsPickerKey  = null;
          scheduleRender();
        } else {
          _kgPickerLastTap[_tapKey] = _now;
          setTimeout(() => {
            if (_kgPickerLastTap[_tapKey] === _now) {
              _kgPickerLastTap[_tapKey] = 0;
              dispatch(A.EX_TOGGLE_NEXT_WEEK_CONFIRMED, { di: +di, ei: +ei });
            }
          }, 400);
        }
      }
      break;
    }

    case 'kg-picker-select': {
      const _pkVal = parseFloat(el.dataset.value);
      dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: +di, ei: +ei, value: _pkVal });
      if (_pkVal === 0) {
        showToast('Keine Steigerung nächste Woche (bestätigt)', 'ok');
      } else {
        showToast(`+${_pkVal} kg nächste Woche bestätigt ✓`, 'ok');
      }
      _kgPickerKey    = null;
      _kgPickerCustom = false;
      scheduleRender();
      break;
    }

    case 'kg-picker-show-custom': {
      _kgPickerCustom = true;
      scheduleRender();
      setTimeout(() => document.getElementById('kg-picker-custom-input')?.focus(), 50);
      break;
    }

    case 'kg-picker-custom-confirm': {
      const _customInput = document.getElementById('kg-picker-custom-input');
      const _customVal   = parseFloat(_customInput?.value);
      if (Number.isFinite(_customVal) && _customVal >= 0) {
        dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: +di, ei: +ei, value: _customVal });
        showToast(`+${_customVal} kg nächste Woche bestätigt ✓`, 'ok');
      }
      _kgPickerKey    = null;
      _kgPickerCustom = false;
      scheduleRender();
      break;
    }

    case 'reps-picker-select': {
      const _rpVal = +el.dataset.value;
      dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: +di, ei: +ei, value: _rpVal });
      const _rpEx    = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      const _rpLabel = (_rpEx?.progressionType ?? 'reps') === 'sets'
        ? 'Satz'
        : _rpEx?.metric === 'sec' ? 'Sek' : _rpEx?.metric === 'm' ? 'm' : 'Wdh';
      showToast(`+${_rpVal} ${_rpLabel} nächste Woche bestätigt ✓`, 'ok');
      _repsPickerKey = null;
      scheduleRender();
      break;
    }

    case 'set-progression-type': {
      dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'progressionType', value: el.dataset.val });
      // Reset plan when switching modes to avoid stale kg value being used as reps
      dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: +di, ei: +ei, value: 0 });
      _kgPickerKey   = null;
      _repsPickerKey = null;
      scheduleRender();
      break;
    }

    case 'set-progression-mode': {
      // EX_SET_TARGETS (nicht EX_UPDATE) — löscht targetRepsMax automatisch
      // wenn der Modus weg von double_progression wechselt.
      dispatch(A.EX_SET_TARGETS, { di: +di, ei: +ei, progressionMode: el.dataset.val });
      break;
    }

    case 'set-step': {
      const step = parseFloat(el.dataset.step);
      dispatch(A.EX_SET_STEP, { di: +di, ei: +ei, step, weekIdx: getState().curIdx });
      break;
    }

    case 'set-metric-step': {
      const step = parseFloat(el.dataset.step);
      dispatch(A.EX_SET_METRIC_STEP, { di: +di, ei: +ei, step, weekIdx: getState().curIdx });
      break;
    }

    // Übernimmt den Historie-Vorschlag (2026-07-14) — dispatcht dieselbe
    // Action wie die manuellen Schrittweite-Buttons, kein Sonderpfad.
    case 'adopt-suggested-step': {
      const step = parseFloat(el.dataset.value);
      dispatch(A.EX_SET_STEP, { di: +di, ei: +ei, step, weekIdx: getState().curIdx });
      break;
    }

    case 'adopt-suggested-metric-step': {
      const step = parseFloat(el.dataset.value);
      dispatch(A.EX_SET_METRIC_STEP, { di: +di, ei: +ei, step, weekIdx: getState().curIdx });
      break;
    }

    case 'set-settype': {
      const _val = el.dataset.val;
      if (_val === 'straight' || _val === 'manual') {
        dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'setType', value: _val });
      }
      break;
    }

    case 'toggle-plates': {
      const _ex = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      if (_ex) dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'showPlates', value: !_ex.showPlates });
      break;
    }

    case 'toggle-superset': {
      const _exSS = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      if (_exSS) {
        const newId = _exSS.supersetId ? null : Date.now();
        dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'supersetId', value: newId });
      }
      break;
    }

    case 'set-metric': {
      const m = el.dataset.metric;
      if (m === 'reps' || m === 'sec' || m === 'm') {
        dispatch(A.EX_SET_METRIC, { di: +di, ei: +ei, metric: m });
      }
      break;
    }

    case 'adopt-target-reps': {
      dispatch(A.EX_SET_TARGETS, {
        di: +el.dataset.di,
        ei: +el.dataset.ei,
        targetReps: +el.dataset.value,
      });
      break;
    }

    case 'move-ex-down': {
      const maxEi = getState().weeks[getState().curIdx].days[+di].exercises.length - 1;
      const toEi = +ei + 1;
      if (toEi <= maxEi) {
        dispatch(A.EX_MOVE, { di: +di, fromEi: +ei, toEi });
        // Wartet kurz das Neuladen ab und scrollt den Pfeil dann in die Mitte
        setTimeout(() => {
          const newBtn = document.querySelector(`[data-action="move-ex-down"][data-di="${di}"][data-ei="${toEi}"]`);
          if (newBtn) newBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 50);
      }
      break;
    }
      
      

    // ── Set ────────────────────────────────────────────────────────────────
    case 'toggle-set-note': {
      const wk  = getState().weeks[getState().curIdx];
      const s   = wk?.days[+di]?.exercises[+ei]?.sets[+si];
      if (s) { s._showNote = !s._showNote; scheduleRender(); }
      break;
    }
    case 'toggle-done': {
      _pendingAutoEval = null;
      const _s = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei]?.sets[+si];
      if (_s && _s.status === 'pending') {
        const _wInp = document.querySelector(`[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
        const _rInp = document.querySelector(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
        const _rVal = parseFloat(_rInp?.value ?? _s.reps);
        const _wVal = parseFloat(_wInp?.value ?? _s.weight);
        const canSuccess = Number.isFinite(_rVal) && _rVal > 0;
        if (!canSuccess) {
          // Fail is always allowed — go directly to fail when success criteria not met
          dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'status', value: 'fail' });
          break;
        }
        // Flush uncommitted input values to state before marking success
        if (_wInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'weight', value: _wInp.value });
        if (_rInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'reps',   value: _rInp.value });
      }
      dispatch(A.SET_TOGGLE_DONE, { di: +di, ei: +ei, si: +si });
      // Fire insight trigger when set is checked success
      {
        const afterSt  = getState();
        const afterSet = afterSt.weeks[afterSt.curIdx]?.days[+di]?.exercises[+ei]?.sets[+si];
        if (afterSet?.status === 'success') {
          const triggered = fireTrigger('SATZ_ABGEHAKT', { di: +di, ei: +ei, si: +si });
          for (const ins of triggered) {
            if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', ins.id === 'P-05' ? 4000 : 3000);
          }
        }
      }
      break;
    }

    case 'confirm-set': {
      _pendingAutoEval = null;
      const _cst = getState();
      const _cwk = _cst.weeks[_cst.curIdx];
      const _cex = _cwk?.days[+di]?.exercises[+ei];
      if (!_cex) break;
      const _csi = _cex.sets.findIndex(s => {
        const st = s.status;
        return st === 'pending' || (st !== 'success' && st !== 'fail' && !s.done);
      });
      if (_csi === -1) break;

      if (!_cex.targetReps) {
        // No target defined — show explanatory popup near the button
        document.querySelectorAll('.confirm-set-no-target').forEach(el => { clearTimeout(el._timer); el.remove(); });
        const _btn = e.target.closest('[data-action="confirm-set"]');
        if (_btn) {
          const _popup = document.createElement('div');
          _popup.className = 'confirm-set-no-target';
          _popup.textContent = 'Kein Zielwert definiert. Trage zuerst eine Ziel-Wdh ein (⚙️ Übungseinstellungen) um diese Funktion zu nutzen.';
          _btn.insertAdjacentElement('afterend', _popup);
          _popup._timer = setTimeout(() => _popup.remove(), 3000);
        }
        break;
      }

      // Has targetReps — confirm the next pending set
      const _wInp = document.querySelector(`[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${_csi}"]`);
      if (_wInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: _csi, field: 'weight', value: _wInp.value });

      // Echte eingetragene Wdh verwenden, NICHT targetReps — sonst überschreibt
      // dieser Button stillschweigend die tatsächliche Nutzereingabe und der
      // Reducer kann nie canSuccess korrekt gegen das Ziel prüfen (siehe Diagnose).
      // Ausnahme: ein wirklich LEERES Feld (kein Zeichen, auch keine "0") löst
      // den ursprünglichen Komfort-Schnellweg aus — targetReps eintragen statt
      // einen leeren Satz als 'fail' zu werten. "0" zählt bewusst NICHT als
      // leer (sonst genau der ursprüngliche Überschreib-Bug erneut).
      const _rInp   = document.querySelector(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${_csi}"]`);
      const _rawVal = _rInp?.value ?? '';
      let _repsVal;
      if (_rawVal === '') {
        _repsVal = String(_cex.targetReps);
        if (_rInp) _rInp.value = _repsVal; // Feld visuell mit dem gespeicherten Wert synchron halten
      } else {
        _repsVal = _rawVal;
      }

      // Set flash key before dispatch so the re-render includes the class
      _confirmFlashKey = `${di}-${ei}`;
      dispatch(A.CONFIRM_SET, { di: +di, ei: +ei, si: _csi, reps: _repsVal });
      setTimeout(() => { _confirmFlashKey = null; scheduleRender(); }, 350);

      const _aft = getState();
      const _aftSet = _aft.weeks[_aft.curIdx]?.days[+di]?.exercises[+ei]?.sets[_csi];
      if (_aftSet?.status === 'success') {
        const triggered = fireTrigger('SATZ_ABGEHAKT', { di: +di, ei: +ei, si: _csi });
        for (const ins of triggered) {
          if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', ins.id === 'P-05' ? 4000 : 3000);
        }
        // RPE nudge — only if rpeEnabled
        if (_aft.settings?.rpeEnabled !== false && _aftSet.rpe == null) {
          clearTimeout(_rpeNudgeTimer);
          _rpeNudgeKey  = `${di}-${ei}-${_csi}`;
          scheduleRender();
          _rpeNudgeTimer = setTimeout(() => { _rpeNudgeKey = null; _rpeNudgeTimer = null; scheduleRender(); }, 4000);
          _maybeShowTip('tip-02', 'RPE = wie anstrengend war der Satz? 7 = leicht · 8 = moderat · 9 = schwer · 10 = Maximum');
        }
      }
      const _aftEx = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      if (_aftEx?.targetReps) {
        const _doneSets = (_aftEx.sets ?? []).filter(s => s.status === 'success');
        const _totalAch = _doneSets.reduce((sum, s) => sum + (parseFloat(s.reps) || 0), 0);
        const _totalTgt = (_aftEx.sets?.length ?? 0) * _aftEx.targetReps;
        if (_totalTgt > 0 && _totalAch > 0) {
          _maybeShowTip('tip-03', 'Effort-Score: wie viel % deines Ziels du erreicht hast. Über 100% = mehr als geplant.');
        }
      }
      const isLastSet = _csi === (_aftEx?.sets?.length ?? 0) - 1;
      if (!isLastSet && _aft.settings?.autoStartPauseTimer) {
        window.dispatchEvent(new CustomEvent('train:set-done', { detail: { pauseSec: _cex.pauseSec ?? 90, di: +di } }));
      }
      const nextPending = (_aftEx?.sets ?? []).findIndex(s => s.status === 'pending');
      if (nextPending !== -1) {
        const nextRow = document.querySelector(`[data-action="toggle-done"][data-di="${di}"][data-ei="${ei}"][data-si="${nextPending}"]`)
          ?.closest('.set-row');
        nextRow?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      break;
    }

    case 'remove-set':
      dispatch(A.SET_REMOVE, { di: +di, ei: +ei, si: +si }); break;

    case 'add-set':
      dispatch(A.SET_ADD, { di: +di, ei: +ei }); break;

    // RPE popover (2.2)
    case 'open-rpe-popover': {
      const key = `${di}-${ei}-${si}`;
      _rpePopoverKey = _rpePopoverKey === key ? null : key;
      scheduleRender();
      break;
    }

    case 'set-rpe-val': {
      const rpeVal = el.dataset.val === '' ? null : +el.dataset.val;
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'rpe', value: rpeVal });
      _rpePopoverKey = null;
      break;
    }

    case 'rpe-nudge-select': {
      clearTimeout(_rpeNudgeTimer);
      dispatch(A.SET_RPE, { di: +di, ei: +ei, si: +si, rpe: +el.dataset.rpe });
      _rpeNudgeKey   = null;
      _rpeNudgeTimer = null;
      scheduleRender();
      break;
    }

    case 'autofill-rpe': {
      dispatch(A.SET_AUTOFILL_RPE, { di: +di, ei: +ei, si: +si });
      showToast('RPE auf nächsten Satz übernommen', 'ok');
      break;
    }
    case 'autofill-down': {
      const _rInp = document.querySelector(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
      const repsVal = _rInp?.value ?? '';
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si + 1, field: 'reps', value: repsVal });
      showToast('Wdh in nächsten Satz übernommen', 'ok');
      break;
    }

    case 'log-bodyweight': {
      const input = document.getElementById('body-weight-today');
      const w     = parseFloat(input?.value);
      if (!Number.isFinite(w) || w <= 0) break;
      const todayDate = new Date().toISOString().slice(0, 10);
      dispatch(A.BODY_LOG_WEIGHT, { date: todayDate, weight: w });
      showToast('Körpergewicht eingetragen ✓', 'ok');
      break;
    }

    case 'set-p4p-mode':
      _p4pMode = el.dataset.mode === 'alltime' ? 'alltime' : 'woche';
      // Nur die Switch-Buttons + den Chart aktualisieren (nicht den ganzen
      // Tab neu rendern) — sonst würde die Dropdown-Auswahl beim Umschalten
      // auf die erste Option zurückspringen.
      document.querySelectorAll('.weight-step-btn[data-action="set-p4p-mode"]').forEach(btn => {
        const isSel = btn.dataset.mode === _p4pMode;
        btn.classList.toggle('is-selected', isSel);
        btn.setAttribute('aria-pressed', String(isSel));
      });
      _updateP4PChart(getState());
      break;

    // ── Settings rows (previously role=button, now data-action on the div) ─
    case 'toggle-setting':
      dispatch(A.SETTING_TOGGLE, { key }); break;

    case 'toggle-autoweek-enabled': {
      const cur = getState().settings?.autoWeek?.enabled ?? false;
      dispatch(A.AUTOWEEK_SET, { key: 'enabled', value: !cur });
      break;
    }
    case 'toggle-autoweek-sub': {
      const subKey = el.dataset.key;
      const cur = getState().settings?.autoWeek?.[subKey] ?? false;
      dispatch(A.AUTOWEEK_SET, { key: subKey, value: !cur });
      break;
    }

    case 'set-deload-factor': {
      const factor = parseFloat(el.dataset.factor);
      if (Number.isFinite(factor)) {
        _showCustomDeload = false;
        dispatch(A.SETTING_SET, { key: 'deloadFactor', value: factor });
        dispatch(A.SETTING_SET, { key: 'deloadFactorCustom', value: null });
        if (_activeTab === 'settings') renderSettingsTab(getState());
      }
      break;
    }
    case 'set-deload-factor-custom': {
      _showCustomDeload = true;
      if (_activeTab === 'settings') renderSettingsTab(getState());
      setTimeout(() => {
        const inp = document.querySelector('[data-action="set-deload-factor-value"]');
        inp?.focus();
      }, 30);
      break;
    }

    case 'open-tpl':
      renderTemplateEditor(getState());
      openModal('modal-template'); break;

    case 'reset-to-tpl':
      if (confirm('Aktuelle Woche mit Custom-Template überschreiben?')) {
        dispatch(A.WEEK_RESET_TO_TPL, {});
        showToast('Woche zurückgesetzt ✓', 'ok');
      }
      break;

    case 'reset-factory':
      if (confirm('Custom-Template auf Werkseinstellung zurücksetzen?')) {
        dispatch(A.TPL_RESET_TO_FACTORY, {});
        showToast('Original-Template wiederhergestellt ✓', 'ok');
      }
      break;

    // Named templates (3.4)
    case 'save-named-template': {
      const name = prompt('Name für diese Vorlage:');
      if (!name?.trim()) break;
      const wk = getState().weeks[getState().curIdx];
      if (!wk) break;
      dispatch(A.TEMPLATE_ADD, { name: name.trim(), days: wk.days });
      showToast(`Vorlage "${name.trim()}" gespeichert ✓`, 'ok');
      break;
    }

    case 'delete-named-template': {
      const id = +el.dataset.tplId;
      if (confirm('Vorlage löschen?')) {
        dispatch(A.TEMPLATE_DELETE, { id });
        showToast('Vorlage gelöscht', 'info');
      }
      break;
    }

    case 'edit-custom-ex-settings': {
      const ce = (getState().customExercises ?? []).find(c => c.name === el.dataset.name);
      if (!ce) break;
      _openExFormModal({ mode: 'edit', name: ce.name, metric: ce.metric, category: ce.category, originalName: ce.name });
      break;
    }

    case 'delete-custom-ex': {
      const name = el.dataset.name;
      if (confirm(`"${name}" löschen? Bereits hinzugefügte Übungen in Wochen bleiben erhalten.`)) {
        dispatch(A.CUSTOM_EX_DELETE, { name });
        showToast('Übung gelöscht', 'info');
        if (_activeTab === 'settings') renderSettingsTab(getState());
      }
      break;
    }

    // ── Übungsnamen-Bereinigung ──────────────────────────────────────────────
    case 'merge-ex-names': {
      const card = el.closest('.name-dup-card');
      const finalName = card?.querySelector('.name-dup-select')?.value;
      if (!finalName) break;

      let variantNames;
      if (el.dataset.mergeKey != null) {
        const group = findExactDuplicates(getState()).find(g => g.key === el.dataset.mergeKey);
        variantNames = group?.variants.map(v => v.name) ?? [];
      } else {
        variantNames = [el.dataset.mergeA, el.dataset.mergeB].filter(Boolean);
      }
      if (variantNames.length === 0) break;

      const setCount = variantNames.reduce((sum, name) => {
        for (const wk of getState().weeks) for (const day of wk.days) for (const ex of day.exercises)
          if (ex.name === name) sum += ex.sets.length;
        return sum;
      }, 0);

      dispatch(A.EX_MERGE_NAMES, { variantNames, finalName });
      showToast(`✓ Zusammengeführt zu "${finalName}" — ${setCount} ${setCount === 1 ? 'Satz' : 'Sätze'} betroffen`, 'ok');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    case 'dismiss-name-pair': {
      dispatch(A.DISMISS_NAME_PAIR, { a: el.dataset.a, b: el.dataset.b });
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    case 'export-json':
      exportJSON(() => showToast('✓ Backup gespeichert', 'ok', 2000));
      break;

    case 'save-tpl':
      _saveTemplate(); break;

    // ── Modal close ────────────────────────────────────────────────────────
    case 'close-modal': {
      const modalId = el.closest('.modal-overlay')?.id;
      if (modalId) closeModal(modalId);
      break;
    }

    // ── Import JSON (file input change bubbles as click on label) ──────────
    // Handled in _handleChange; nothing to do on click.
    case 'import-json': break;

    case 'set-plate-step': {
      const ps = parseFloat(el.dataset.step);
      dispatch(A.SETTING_SET, { key: 'plateStep', value: Number.isFinite(ps) ? ps : 2.5 });
      break;
    }

    case 'set-max-session': {
      const ms = parseInt(el.dataset.ms, 10);
      dispatch(A.SETTING_SET, { key: 'maxSessionMs', value: Number.isFinite(ms) && ms > 0 ? ms : 10800000 });
      break;
    }

    case 'adopt-prev-weight': {
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'weight', value: +el.dataset.value });
      break;
    }

    case 'adopt-prev-reps': {
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'reps', value: +el.dataset.value });
      break;
    }

    default:
      // Unknown action – ignore silently
      break;
  }

  // Template editor actions (can coexist with data-action on same element)
  const tplEl = e.target.closest('[data-tpl-action]');
  if (tplEl) _handleTplAction(tplEl);
}

function _handleChange(e) {
  const el     = e.target;
  const action = el.dataset.action;
  const { di, ei, si, field } = el.dataset;

  // Hier wird jetzt ALLES gespeichert, aber erst wenn das Tippen beendet ist ("change")
  switch (action) {
    case 'ex-name':
      dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'name', value: el.value }); break;
    case 'day-field':
      dispatch(A.DAY_SET_FIELD, { di: +di, field, value: el.value }); break;
    case 'set-weight':
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'weight', value: el.value }); break;
    case 'set-reps':
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'reps',   value: el.value }); break;
    case 'set-rpe':
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'rpe',    value: el.value }); break;
    case 'set-note':   dispatch(A.SET_UPDATE, { di:+di, ei:+ei, si:+si, field:'note',   value: el.value }); break;
    case 'set-targets': {
      const tField = el.dataset.field;
      dispatch(A.EX_SET_TARGETS, {
        di: +el.dataset.di,
        ei: +el.dataset.ei,
        [tField]: +el.value || 0,
      });
      break;
    }
    case 'set-target-weight': {
      const tw = parseFloat(el.value);
      dispatch(A.SETTING_SET, { key: 'targetWeight', value: Number.isFinite(tw) && tw > 0 ? tw : null });
      break;
    }
    case 'set-barbell-weight': {
      const bw = parseFloat(el.value);
      dispatch(A.SETTING_SET, { key: 'barbellWeight', value: Number.isFinite(bw) && bw > 0 ? bw : 20 });
      break;
    }
    case 'set-deload-factor-value': {
      const pct = parseFloat(el.value);
      if (Number.isFinite(pct) && pct >= 1 && pct <= 99) {
        const f = Math.round(pct) / 100;
        _showCustomDeload = false;
        dispatch(A.SETTING_SET, { key: 'deloadFactor',       value: f });
        dispatch(A.SETTING_SET, { key: 'deloadFactorCustom', value: f });
      }
      break;
    }
    case 'body-field':
      dispatch(A.BODY_SET_FIELD, {
        field,
        value: el.type === 'text' || isNaN(+el.value) ? el.value : +el.value,
      }); break;
    case 'set-ex-category': {
      const exName = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei]?.name;
      if (!exName) break;
      const newCat = el.value || null;
      const ce = (getState().customExercises ?? []).find(c => c.name === exName);
      if (ce && ce.metric != null) {
        dispatch(A.CUSTOM_EX_UPDATE, { oldName: exName, name: exName, metric: ce.metric, category: newCat });
      } else {
        dispatch(A.EX_SET_CATEGORY_OVERRIDE, { name: exName, category: newCat });
      }
      break;
    }
    case 'import-json': {
      const file = el.files?.[0];
      if (!file) break;
      const confirmed = confirm(
        'Aktuelle Trainingsdaten werden durch das Backup ersetzt.\nNicht rückgängig machbar.'
      );
      if (!confirmed) { el.value = ''; break; }
      el.value = '';
      importJSON(file)
        .then(() => {
          const weeks = getState().weeks.length;
          showToast(`✓ ${weeks} Wochen Trainingsdaten wiederhergestellt`, 'ok', 3000);
        })
        .catch(() => _showInvalidBackupDialog(el));
      break;
    }
  }
}

function _handleInput(e) {
  // Absichtlich komplett leer gelassen!
  // Das verhindert, dass bei jedem einzelnen Tastendruck das Layout neu lädt
  // und dir die Tastatur vor der Nase zuschlägt.
}

function _handleBlur(e) {
  if (!getState().settings?.autoEval) return;
  const el = e.target;
  if (!el.matches('[data-action="set-reps"]')) return;
  const { di, ei, si } = el.dataset;
  const val = parseFloat(el.value);
  _pendingAutoEval = { di: +di, ei: +ei, si: +si, reps: val };
  setTimeout(() => {
    if (!_pendingAutoEval) return;
    if (document.activeElement === el) { _pendingAutoEval = null; return; }
    const { di: _di, ei: _ei, si: _si, reps } = _pendingAutoEval;
    _pendingAutoEval = null;
    // reps===0 MUSS auto-eval auslösen (0 Wdh = nicht geschafft = fail, siehe
    // AUTO_EVAL_SET-Reducer) — vorher blockierte "reps <= 0" das explizit,
    // ein Satz mit eingetragener 0 blieb für immer 'pending'. "< 0" statt
    // "<= 0" reicht: leeres Feld -> parseFloat('') -> NaN -> von
    // Number.isFinite() bereits abgefangen, kein Extra-Guard nötig.
    if (!Number.isFinite(reps) || reps < 0) return;
    dispatch(A.AUTO_EVAL_SET, { di: _di, ei: _ei, si: _si, reps });
    // RPE-Nudge nach erfolgreicher Auto-Bewertung (identisch zu confirm-set)
    const aft    = getState();
    const aftSet = aft.weeks[aft.curIdx]?.days[_di]?.exercises[_ei]?.sets[_si];
    if (aftSet?.status === 'success' && aft.settings?.rpeEnabled !== false && aftSet.rpe == null) {
      clearTimeout(_rpeNudgeTimer);
      _rpeNudgeKey   = `${_di}-${_ei}-${_si}`;
      scheduleRender();
      _rpeNudgeTimer = setTimeout(() => { _rpeNudgeKey = null; _rpeNudgeTimer = null; scheduleRender(); }, 4000);
    }
  }, 0);
}

function _handleKeydown(e) {
  if (e.key === 'Enter') {
    const inp    = e.target;
    const action = inp.dataset.action;
    const { di, ei, si } = inp.dataset;

    // Substitute-name input → confirm substitution
    if (inp.classList.contains('sub-name-input')) {
      const name = inp.value.trim();
      if (name) {
        dispatch(A.EX_SET_SUBSTITUTE, { di: +inp.dataset.di, ei: +inp.dataset.ei, substituteFor: name });
        _subFormOpenKey = null;
      } else {
        inp.focus();
      }
      return;
    }

    // Set inputs: weight → reps → rpe → next set weight
    if (action === 'set-weight') {
      e.preventDefault();
      document.querySelector(
        `[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`
      )?.focus();
      return;
    }
    if (action === 'set-reps') {
      e.preventDefault();
      const nextWeight = document.querySelector(
        `[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${+si + 1}"]`
      );
      if (nextWeight) nextWeight.focus();
      else document.activeElement?.blur();
      return;
    }
  }

  // Keyboard activation for elements with role="button" that aren't <button>
  if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('role') === 'button') {
    e.preventDefault();
    e.target.click();
  }
}

// ─── Auto-scroll to first pending exercise ───────────────────────────────────
function _scrollToFirstPending(di) {
  requestAnimationFrame(() => {
    const state = getState();
    const wk    = state.weeks[state.curIdx];
    const day   = wk?.days[di ?? _activeDayIdx];
    if (!day) return;
    // Nur scrollen wenn der Tag bereits mindestens einen bewerteten Satz hat
    // (echte Fortsetzung) — bei komplett unbearbeitetem Tag (alle pending)
    // bleibt die Ansicht oben, damit Tag-Pillen + Fortschrittsbalken +
    // Ritual-Anker beim allerersten Öffnen sichtbar bleiben statt sofort
    // verdeckt zu werden.
    const hasEvaluatedSet = day.exercises.some(ex => ex.sets.some(s => s.status === 'success' || s.status === 'fail'));
    if (!hasEvaluatedSet) return;
    const exIdx = day.exercises.findIndex(ex =>
      ex.sets.some(s => (s.status === 'pending') || (s.status !== 'success' && s.status !== 'fail' && !s.done))
    );
    if (exIdx === -1) return;
    const dii = di ?? _activeDayIdx;
    const target = document.querySelector(`[data-di="${dii}"][data-ei="${exIdx}"].exercise`);
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

// ─── Day tab toggle ───────────────────────────────────────────────────────────
function _toggleAccordion(di) {
  if (_activeDayIdx === di) return; // already the only open day — keep it open
  _activeDayIdx = di;
  scheduleRender();
  _scrollToFirstPending(di);
}

// ─── Exercise search modal ──────────────────────────────────────────────────
function _openExSearchModal(di) {
  _exSearchDi = di;
  openModal('modal-ex-search');
  const inp = document.getElementById('ex-search-input');
  if (inp) {
    inp.value = '';
    inp.oninput = () => _renderExSearchResults();
    setTimeout(() => inp.focus(), 30);
  }
  _renderExSearchResults();
}

function _renderExSearchResults() {
  const container = document.getElementById('ex-search-results');
  if (!container) return;
  const query = (document.getElementById('ex-search-input')?.value ?? '').trim();
  const q = query.toLowerCase();

  const existingNames = new Set();
  const wk = getState().weeks[getState().curIdx];
  if (wk && _exSearchDi !== null) {
    (wk.days[_exSearchDi]?.exercises ?? []).forEach(ex => existingNames.add(ex.name));
  }

  const std = _STANDARD_EXERCISES
    .filter(n => !q || n.toLowerCase().includes(q))
    .slice(0, 8);
  const custom = (getState().customExercises ?? [])
    .filter(c => c.metric != null)
    .map(c => c.name)
    .filter(n => !q || n.toLowerCase().includes(q))
    .slice(0, 8);

  const renderItem = name => `
    <button type="button" class="ex-search-item" data-action="ex-search-pick" data-name="${h(name)}">
      ${h(name)}${existingNames.has(name) ? ' <span style="color:var(--c-text-3);font-size:11px">(bereits im Tag)</span>' : ''}
    </button>`;

  const stdHtml = std.length ? `<div class="ex-search-group-title">Standardübungen</div>${std.map(renderItem).join('')}` : '';
  const customHtml = custom.length ? `<div class="ex-search-group-title">Meine Übungen</div>${custom.map(renderItem).join('')}` : '';

  const allNames = new Set([..._STANDARD_EXERCISES, ...(getState().customExercises ?? []).map(c => c.name)].map(n => n.toLowerCase()));
  const createHtml = query && !allNames.has(q)
    ? `<button type="button" class="ex-search-item ex-search-item--create" data-action="ex-search-create">+ "${h(query)}" anlegen →</button>`
    : '';

  const emptyHtml = (!std.length && !custom.length && !query)
    ? `<p class="ex-search-empty">Tippe um Übungen zu durchsuchen.</p>` : '';

  container.innerHTML = stdHtml + customHtml + emptyHtml + createHtml;
}

// ─── Exercise create/edit modal ──────────────────────────────────────────────
function _openExFormModal({ mode, di = null, name = '', metric = 'reps', category = null, originalName = null }) {
  _exFormMode         = mode;
  _exFormTargetDi     = di;
  _exFormMetric       = metric;
  _exFormCategory     = category;
  _exFormOriginalName = originalName;
  _renderExFormModal(name);
  openModal('modal-ex-form');
  setTimeout(() => document.getElementById('ex-form-name')?.focus(), 30);
}

function _renderExFormModal(name) {
  const titleEl = document.getElementById('ex-form-title');
  const bodyEl  = document.getElementById('ex-form-body');
  if (!titleEl || !bodyEl) return;
  titleEl.textContent = _exFormMode === 'edit' ? 'Übung bearbeiten' : 'Neue Übung';

  const metrics = [{ id: 'reps', label: 'Wdh' }, { id: 'sec', label: 'Sek' }, { id: 'm', label: 'm' }];
  const cats = ['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core'];

  bodyEl.innerHTML = `
    <div class="body-field">
      <label for="ex-form-name">Name</label>
      <input id="ex-form-name" class="body-input" type="text" maxlength="80"
        value="${h(name ?? '')}" placeholder="z. B. Pendulum Squat" aria-label="Übungsname" />
      <div class="ex-form-error" id="ex-form-error"></div>
    </div>
    <div class="body-field" style="margin-top:var(--sp-3)">
      <label>Metrik</label>
      <div class="weight-step-opts">
        ${metrics.map(m => `
          <button type="button"
            class="weight-step-btn${_exFormMetric === m.id ? ' is-selected' : ''}"
            data-action="ex-form-set-metric" data-metric="${m.id}"
            aria-pressed="${_exFormMetric === m.id}"
          >${m.label}</button>`).join('')}
      </div>
    </div>
    <div class="body-field" style="margin-top:var(--sp-3)">
      <label>Kategorie (optional)</label>
      <div class="weight-step-opts">
        ${cats.map(c => `
          <button type="button"
            class="weight-step-btn${_exFormCategory === c ? ' is-selected' : ''}"
            data-action="ex-form-set-category" data-cat="${c}"
            aria-pressed="${_exFormCategory === c}"
          >${c}</button>`).join('')}
      </div>
    </div>
    <div class="modal__actions">
      <button class="btn btn--accent" data-action="ex-form-submit" style="width:100%">
        ${_exFormMode === 'edit' ? 'Speichern' : 'Übung anlegen'}</button>
    </div>`;
}

// ─── New week modal (2.3) ─────────────────────────────────────────────────────
let _moreRecsOpen = false; // collapsible "weitere Übungen" state, reset on modal open
// Übungsnamen, die der Nutzer in DIESER Modal-Sitzung manuell abgewählt hat.
// Verhindert dass die Auto-Vorauswahl-Berechnung in _prepNewWeekModal() einen
// gerade abgewählten Chip im selben Klick (re-render via toggle-weight-rec)
// sofort wieder bestätigt. Reset bei jedem frischen Öffnen des Modals (siehe
// 'open-new-week'), NICHT bei jedem _prepNewWeekModal()-Aufruf, da diese
// Funktion auch für In-Session-Re-Renders (toggle-weight-rec, toggle-more-recs)
// genutzt wird.
let _userDismissedAutoSelect = new Set();

// Feature B (2026-07-14): Übungsname, dessen Empfehlungs-Chip im
// "Neue Woche"-Modal gerade den "Anderer Wert"-Eingabemodus zeigt. Nur einer
// gleichzeitig offen — eigene Variable, unabhängig vom In-Session-
// "+kg"-Picker (_kgPickerKey), da beide in verschiedenen Modals leben.
let _recChipCustomOpenName = null;

// Feature B (2026-07-14): Übungsnamen, bei denen der Nutzer in DIESER
// Modal-Sitzung explizit einen eigenen (von rec.delta abweichenden) Wert
// bestätigt hat — Map exName -> gewählter Delta-Wert. Verhindert, dass
// _prepNewWeekModal()'s Auto-Vorauswahl-Berechnung den Custom-Wert bei
// jedem Re-Render stillschweigend wieder auf den vollen Empfehlungswert
// zurücksetzt (Analogon zu _userDismissedAutoSelect, gleicher Reset-
// Zeitpunkt bei 'open-new-week').
let _userCustomStepChoice = new Map();

/**
 * Extracts the numeric RPE/Erfolgsquote values from rec.reasons[] (already
 * formatted text from getWeightRecommendation) for the compact subline —
 * without touching the recommendation logic itself.
 */
function _recSubline(r, rpeEnabled) {
  const reasons    = (r.rec.reasons ?? []).filter(rs => !rs.isRpe || rpeEnabled);
  const rpeReason   = reasons.find(rs => rs.isRpe);
  const rateReason  = reasons.find(rs => !rs.isRpe);
  const rpeMatch    = rpeReason?.text.match(/RPE\s+([\d.]+)/);
  const rateMatch   = rateReason?.text.match(/(\d+)%/);
  const rpeIntense  = rpeReason?.text.includes('zu intensiv');
  const hasWarn     = rpeReason?.icon === '⚠' || rateReason?.icon === '⚠';

  const statusText = r.autoSelected
    ? 'Automatisch vorausgewählt'
    : r.confirmed
      ? 'Übernommen — Tap zum Ändern'
      : 'Tap zum Bestätigen';

  const parts = [statusText];
  if (rpeMatch)  parts.push(`RPE ${rpeMatch[1]}${rpeIntense ? ' zu intensiv' : ''}`);
  if (rateMatch) parts.push(`${rateMatch[1]}%`);

  return `${hasWarn ? '⚠ ' : ''}${parts.join(' · ')}`;
}

function _renderRecChip(r, rpeEnabled) {
  // B18: Einheit + Halten-Text metrikabhängig — r.rec.recommendedWeight/
  // r.rec.delta tragen bei metric 'm'/'sec' bewusst Distanz/Zeit-Werte
  // (siehe getMetricRecommendation()-Docstring, gleiche Feldnamen wie
  // Gewicht, nur die Anzeige-Einheit unterscheidet sich hier).
  const unit    = r.metric === 'sec' ? 'Sek' : r.metric === 'm' ? 'm' : 'kg';
  const holdTxt = r.metric === 'sec' || r.metric === 'm' ? 'Wert halten' : 'Gewicht halten';

  // Feature B (2026-07-14): ein vom Nutzer explizit gewählter Wert (statt
  // "voller Vorschlag" oder "gar nicht") überschreibt nur die ANZEIGE/den
  // Bestätigungs-Zustand — die eigentliche Empfehlung (r.rec.delta) bleibt
  // unverändert, damit "was der Coach empfohlen hätte" weiterhin sichtbar/
  // nachvollziehbar bleibt (_recSubline zeigt weiterhin die Original-
  // Begründung). nextWeekPlan ist immer ein DELTA, kein Zielwert — der
  // angezeigte Zielwert bei Custom-Delta ist daher lastWeight + effectiveDelta,
  // mit lastWeight = recommendedWeight - rec.delta (siehe state.js
  // _applyPlannedProgression()).
  const customValue    = _userCustomStepChoice.get(r.name);
  const effectiveDelta = customValue !== undefined ? customValue : r.rec.delta;
  const isCustom        = customValue !== undefined && customValue !== r.rec.delta;
  const lastValue        = r.rec.recommendedWeight - r.rec.delta;
  const effectiveTarget  = lastValue + effectiveDelta;

  const actionText = r.rec.delta > 0
    ? (r.confirmed ? `+${effectiveDelta}${unit} → ${effectiveTarget}${unit}${isCustom ? ' (angepasst)' : ''}` : `+${r.rec.delta}${unit} empfohlen`)
    : `${holdTxt} (${r.rec.recommendedWeight}${unit})`;

  const isPickerOpen = _recChipCustomOpenName === r.name;

  return `
    <div class="nw-weight-rec-wrap">
      <button type="button" class="nw-weight-rec-chip${r.confirmed ? ' nw-weight-rec-chip--confirmed' : ''}"
        data-action="toggle-weight-rec"
        data-name="${h(r.name)}"
        data-weight="${r.rec.recommendedWeight}"
        data-delta="${r.rec.delta}"
        aria-pressed="${r.confirmed}"
        aria-label="Empfehlung für ${h(r.name)} übernehmen">
        <div class="nw-rec-top">
          <span class="nw-rec-name">${r.confirmed ? '✓ ' : ''}${h(r.name)}</span>
          <span class="nw-rec-action">${h(actionText)}</span>
        </div>
        <div class="nw-rec-subline">${h(_recSubline(r, rpeEnabled))}</div>
      </button>
      ${r.rec.delta > 0 ? `
      <button type="button" class="nw-rec-adjust-btn" data-action="rec-chip-show-custom" data-name="${h(r.name)}"
        aria-label="Anderen Wert für ${h(r.name)} eingeben" aria-expanded="${isPickerOpen}"
      >Anderer Wert</button>` : ''}
      ${isPickerOpen ? `
      <div class="ex-kg-picker" role="group" aria-label="Eigene Steigerung für ${h(r.name)}">
        <div class="ex-kg-picker-custom">
          <input type="number" inputmode="decimal" min="0" step="0.25"
            id="rec-chip-custom-input" class="num-input" placeholder="${unit}"
            value="${isCustom ? effectiveDelta : ''}"
            aria-label="Eigener Steigerungswert"
          />
          <button type="button" class="ex-kg-picker-btn" data-action="rec-chip-custom-confirm" data-name="${h(r.name)}">OK</button>
        </div>
      </div>` : ''}
    </div>`;
}

function _prepNewWeekModal() {
  const state = getState();
  const body  = document.getElementById('new-week-modal-body');
  if (!body) return;

  // Uses the chronologically latest week — the one WEEK_CREATE(source='prev')
  // will actually clone — NOT state.curIdx, which can point elsewhere (e.g.
  // after navigating to an older week, or once future-dated weeks exist).
  const curWk    = getLatestWeek(state.weeks);
  const curWkIdx = curWk ? state.weeks.indexOf(curWk) : -1;

  // KI-Gewichtsempfehlungen (basierend auf RPE + Erfolgsquote)
  // curWk wird bewusst NICHT ausgeschlossen: sobald der Nutzer die Sätze der
  // aktuellen (curWk) Woche bestätigt hat, ist das die zuletzt trainierte
  // Woche und MUSS als Basis für die nächste Empfehlung zählen — sonst hinkt
  // die Empfehlung systematisch eine Woche hinterher (zeigt "+2.5kg" auf ein
  // Gewicht, das schon in curWk erreicht wurde). Eine frisch erstellte, noch
  // nicht trainierte curWk hat ohnehin keine success-Sätze und wird durch
  // den zweiten Filter unten automatisch ausgeschlossen.
  const aiRecs = [];
  const inRecoveryWindow = isInRecoveryWindow(state);
  if (curWk) {
    const calcWeeks = state.weeks
      .filter(w => w.mode !== 'deload' && w.mode !== 'vacation')
      .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
    if (calcWeeks.length >= 2) {
      const seen = new Set();
      const _autoSelections = [];
      curWk.days.forEach((day, di) => {
        (day.exercises ?? []).forEach((ex, ei) => {
          if (seen.has(ex.name)) return;
          if (ex.substituteFor) return;
          const exMetric = ex.metric === 'sec' || ex.metric === 'm' ? ex.metric : 'reps';
          // Bodyweight-Übungen mit progressionType='reps' (klassische "Wdh
          // statt Gewicht steigern"-Wahl) bekommen bewusst keine Empfehlung
          // — unverändertes Originalverhalten. Bei Distanz/Zeit-Übungen
          // (metric 'm'/'sec') bedeutet progressionType='reps' dagegen
          // "Distanz/Zeit steigern" (B18-Default, siehe state.js EX_ADD) —
          // dafür gibt es unten jetzt eine eigene Empfehlung, kein Skip.
          if (exMetric === 'reps' && (ex.progressionType ?? 'weight') === 'reps') return;
          seen.add(ex.name);
          const exProgressionMode = ex.progressionMode ?? 'weight_first';
          const exTargetRepsMax   = ex.targetRepsMax ?? null;
          const step = exMetric === 'reps'
            ? (ex.weightStep || state.settings?.plateStep || 2.5)
            : (ex.metricStep || (exMetric === 'm' ? 50 : 10));
          const rec = exMetric === 'reps'
            ? getWeightRecommendation(ex.name, calcWeeks, step, exProgressionMode, exTargetRepsMax)
            : getMetricRecommendation(ex.name, calcWeeks, step, exProgressionMode, exTargetRepsMax);
          if (rec) {
            if (inRecoveryWindow && rec.delta > 0) {
              rec.delta = rec.delta * 1.5;
              rec.recommendedWeight = roundToPlate(rec.lastWeight + rec.delta, step);
              rec.boosted = true;
            }
            // Vom Nutzer in dieser Sitzung bereits abgewählte Übungen werden
            // nicht erneut als autoSelected gewertet — sonst zeigt der Chip
            // trotz state.nextWeekPlanConfirmed===false einen "bestätigt"-
            // Zustand (visueller Mismatch) und _autoSelections würde sie
            // ohnehin sofort wieder bestätigen (der eigentliche Snap-Back-Bug).
            // Feature B (2026-07-14): dasselbe gilt jetzt für einen explizit
            // gewählten Custom-Wert (_userCustomStepChoice) — ohne diese
            // Prüfung würde JEDER Re-Render (z.B. durch "Weitere anzeigen")
            // den Custom-Wert stillschweigend wieder auf den vollen
            // Empfehlungswert zurücksetzen.
            const hasCustomChoice = _userCustomStepChoice.has(ex.name);
            const autoSelected = !_userDismissedAutoSelect.has(ex.name)
              && !hasCustomChoice
              && rec.delta > 0 && isReadyForAutoSelect(ex.name, calcWeeks, exProgressionMode, exTargetRepsMax);
            const customMatch = hasCustomChoice && ex.nextWeekPlanConfirmed
              && ex.nextWeekPlan === _userCustomStepChoice.get(ex.name);
            const alreadyConfirmedSame = customMatch
              || (ex.nextWeekPlanConfirmed && ex.nextWeekPlan === rec.delta);
            if (autoSelected && !alreadyConfirmedSame) {
              _autoSelections.push({ di, ei, value: rec.delta });
            }
            aiRecs.push({ name: ex.name, rec, metric: exMetric, autoSelected, confirmed: autoSelected || alreadyConfirmedSame });
          }
        });
      });
      if (_autoSelections.length > 0) {
        dispatch(A.EX_AUTO_PRESELECT_NEXT_WEEK_PLAN, { selections: _autoSelections, weekIdx: curWkIdx });
      }
    }
  }

  // Section 1: automatisch vorausgewählte Übungen — IMMER alle sichtbar, nie
  // eingeklappt (der Nutzer muss sofort sehen, was ohne Tap geändert wurde).
  const _autoRecs  = aiRecs.filter(r => r.autoSelected);
  const _otherRecs = aiRecs.filter(r => !r.autoSelected);

  // Section 2 "Weitere Empfehlungen": Favoriten mit Empfehlung immer sichtbar
  // oben, Rest aufklappbar (eingeklappt by default). Ohne Favoriten: Top 3
  // nach Delta direkt sichtbar, Rest aufklappbar.
  const _favSet     = new Set(state.favoriteExercises ?? []);
  const _favRecs    = _otherRecs.filter(r => _favSet.has(r.name)).sort((a, b) => b.rec.delta - a.rec.delta);
  const _nonFavRecs = _otherRecs.filter(r => !_favSet.has(r.name)).sort((a, b) => b.rec.delta - a.rec.delta);
  const _alwaysVisible = _favRecs.length > 0 ? _favRecs : _nonFavRecs.slice(0, 3);
  const _collapsible   = _favRecs.length > 0 ? _nonFavRecs : _nonFavRecs.slice(3);

  const _rpeEnabled = state.settings?.rpeEnabled ?? true;
  const _anyBoosted = aiRecs.some(r => r.rec.boosted);
  const aiRecHtml = aiRecs.length > 0 ? `
  <div class="nw-weight-recs">
    ${_anyBoosted ? `<div class="movement-warning" style="background:rgba(200,255,0,.1);border-color:rgba(200,255,0,.3);color:var(--c-accent)">Du erholst dich schnell — TRAIN empfiehlt eine größere Steigerung als üblich.</div>` : ''}
    ${_autoRecs.length > 0 ? `
    <div class="nw-rec-section-header">Automatisch vorausgewählt (${_autoRecs.length})</div>
    ${_autoRecs.map(r => _renderRecChip(r, _rpeEnabled)).join('')}` : ''}
    ${_otherRecs.length > 0 ? `
    <div class="nw-rec-section-header">Weitere Empfehlungen</div>
    ${_alwaysVisible.map(r => _renderRecChip(r, _rpeEnabled)).join('')}
    ${_collapsible.length > 0 ? `
    <button type="button" class="nw-more-recs-toggle" data-action="toggle-more-recs" aria-expanded="${_moreRecsOpen}">
      ${_moreRecsOpen ? 'Weniger anzeigen' : `Weitere ${_collapsible.length} Übungen anzeigen`} ${_moreRecsOpen ? '▲' : '▼'}
    </button>
    <div class="nw-more-recs"${_moreRecsOpen ? '' : ' style="display:none"'}>
      ${_collapsible.map(r => _renderRecChip(r, _rpeEnabled)).join('')}
    </div>` : ''}` : ''}
  </div>` : '';

  // Named templates from state.templates[]
  const templates = state.templates ?? [];
  const templateOptions = templates.length > 0
    ? templates.map((t, i) => `<option value="tpl-${i}">${h(t.name ?? `Vorlage ${i+1}`)}</option>`).join('')
    : '<option value="custom">Standard-Vorlage</option>';

  body.innerHTML = `
  <div class="form-group">
    <label class="form-label" for="new-week-date">Wochenstart (Montag)</label>
    <input type="date" class="form-input" id="new-week-date" aria-required="true" value="${nextMonday()}"/>
  </div>
  <div class="form-group">
    <label class="form-label" for="new-week-note">Notiz</label>
    <input type="text" class="form-input" id="new-week-note"
      placeholder="z. B. Deload, Urlaub …" maxlength="80"/>
  </div>
  <div class="form-group">
    <label class="nw-source nw-source--check">
      <input type="checkbox" id="nw-copy-prev" checked />
      <span>Vorwoche als Vorlage übernehmen</span>
    </label>
  </div>
  <div class="form-group" id="nw-template-group">
    <label class="form-label" for="nw-template-select">Vorlage</label>
    <select class="form-input" id="nw-template-select">${templateOptions}</select>
  </div>
  ${aiRecHtml}`;

  if (aiRecs.length > 0) {
    _maybeShowTip('tip-04', 'TRAIN empfiehlt basierend auf deinen letzten Wochen. Tippe zum Bestätigen oder ignoriere den Vorschlag.');
  }

  // Show/hide template select based on checkbox
  const cb     = body.querySelector('#nw-copy-prev');
  const tplGrp = body.querySelector('#nw-template-group');
  const toggle = () => { tplGrp.style.display = cb.checked ? 'none' : ''; };
  toggle();
  cb.addEventListener('change', toggle);
}

function _createWeek() {
  const date     = document.getElementById('new-week-date')?.value;
  const note     = document.getElementById('new-week-note')?.value ?? '';
  const copyPrev = document.getElementById('nw-copy-prev')?.checked ?? true;
  if (!date) { showToast('Bitte Datum wählen', 'warn'); return; }
  const source = copyPrev ? 'prev' : 'template';
  // WEEK_CREATE dedupet still (state.js: bricht ab wenn startDate schon
  // existiert) — der Reducer gibt aber keinen Erfolgs-Indikator zurück.
  // weeks.length davor/danach vergleichen statt blind Erfolg zu melden
  // (Sprint "Kategorie-1-Bugfixes", Fix 2 — Ursache der gemeldeten
  // Unzuverlässigkeit: Datumskollision quittierte bisher trotzdem "✓").
  const beforeCount = getState().weeks.length;
  dispatch(A.WEEK_CREATE, { startDate: date, note, source });
  if (getState().weeks.length === beforeCount) {
    showToast('Für dieses Datum existiert bereits eine Woche', 'warn');
    return;
  }
  closeModal('modal-new-week');
  showToast(source === 'template' ? 'Neue Woche aus Vorlage erstellt ✓' : 'Neue Woche aus Vorwoche erstellt ✓', 'ok');
  _gcEvent('Woche erstellt');
  const triggered = fireTrigger('NEUE_WOCHE_ERSTELLT', {});
  for (const ins of triggered) {
    if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', 5000);
  }
}

/**
 * Sprint C3 (train-v110): die Woche wurde bereits in state.js'
 * _checkAndAutoCreateWeek()/AUTO_WEEK_CREATE automatisch angelegt (vor
 * mountApp, beim loadState()) — hier läuft nur noch der optionale Modal-
 * Flow (Wochenrückblick der Vorwoche, dann Steigerungsvorschläge), exakt
 * dieselben Funktionen wie im manuellen "open-new-week"-Flow
 * (showWeekReviewModal()/_prepNewWeekModal()) — kein neues Modal.
 */
function _runAutoWeekFlow() {
  const state = getState();
  if (!state.autoWeekPending) return;
  const autoWeek = state.settings?.autoWeek ?? {};
  const sorted   = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const prevWeek = sorted[sorted.length - 2] ?? null; // die soeben auto-erstellte Woche ist die letzte

  const step2 = () => {
    if (autoWeek.suggestProgress) {
      _prepNewWeekModal();
      openModal('modal-new-week');
    }
    clearAutoWeekPending();
  };

  if (autoWeek.showReview && prevWeek) {
    const review = buildWeekReview(prevWeek, state.weeks, state.favoriteExercises ?? []);
    showWeekReviewModal(review, step2);
  } else {
    step2();
  }
}

// ─── Template save ────────────────────────────────────────────────────────────
function _saveTemplate() {
  const tpl = JSON.parse(JSON.stringify(getState().customTemplate));

  document.querySelectorAll('[data-tpl-di][data-tpl-field]').forEach(inp => {
    const di    = +inp.dataset.tplDi;
    const ei    = +inp.dataset.tplEi;
    const field = inp.dataset.tplField;
    const ex    = tpl[di]?.exercises[ei];
    if (!ex) return;

    if      (field === 'name')      ex.name = inp.value;
    else if (field === 'note')      ex.note = inp.value;
    else if (field === 'setsCount') {
      const n = Math.max(1, Math.min(8, +inp.value || 1));
      while (ex.sets.length < n)
        ex.sets.push({ weight: ex.sets[0]?.weight ?? 0, reps: parseFloat(ex.sets[0]?.reps) || 10, rpe: null, done: false });
      if (ex.sets.length > n) ex.sets = ex.sets.slice(0, n);
    }
    else if (field === 'reps')   ex.sets.forEach(s => s.reps   = +inp.value || 10);
    else if (field === 'weight') ex.sets.forEach(s => s.weight = +inp.value || 0);
  });

  dispatch(A.TPL_SAVE, { template: tpl });
  closeModal('modal-template');
  showToast('Template gespeichert ✓', 'ok');
}

function _handleTplAction(el) {
  const action = el.dataset.tplAction;
  const di     = +el.dataset.tplDi;
  const ei     = el.dataset.tplEi !== undefined ? +el.dataset.tplEi : null;
  const tpl    = JSON.parse(JSON.stringify(getState().customTemplate));

  if (action === 'rm-ex' && ei !== null) {
    tpl[di].exercises.splice(ei, 1);
    dispatch(A.TPL_SAVE, { template: tpl });
    renderTemplateEditor(getState());
  } else if (action === 'add-ex') {
    tpl[di].exercises.push({
      name: 'Neue Übung', note: '', pauseSec: 90, metric: 'reps',
      sets: [{ weight: 0, reps: 10, rpe: null, status: 'pending', done: false }],
    });
    dispatch(A.TPL_SAVE, { template: tpl });
    renderTemplateEditor(getState());
  }
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function _switchToTab(tab) {
  _activeTab = tab;
  document.querySelectorAll('[data-tab]').forEach(b => {
    b.classList.toggle('is-active', b.dataset.tab === tab);
    b.setAttribute('aria-selected', b.dataset.tab === tab);
  });
  document.querySelectorAll('.page').forEach(p =>
    p.classList.toggle('is-active', p.id === `page-${tab}`)
  );
  const state = getState();
  if (tab === 'body') {
    renderBodyTab(state);
    if (_bodyTabShowsRelativeStrength(state)) {
      _maybeShowTip('tip-12', '1× = dein Körpergewicht. Je höher, desto stärker bist du relativ zu deinem Gewicht.');
    }
  }
  if (tab === 'coach') {
    document.getElementById('app').scrollTop = 0;
    renderCoachTab(state);
  }
  if (tab === 'progress') {
    document.getElementById('app').scrollTop = 0;
    renderProgressTab(state);
    const _completedWks = state.weeks.filter(w => w.days?.some(d => d.markedDone)).length;
    if (_completedWks >= 2) {
      _maybeShowTip('tip-05', 'Jeder Punkt = eine Woche. Blau = Training · Amber = Urlaub · Grau = Pause.');
    }
    // tip-07 entfernt (Sprint "Framework-Audit Cleanup", Fix 5) — versprach
    // "4 Wochen Streak = erstes Abzeichen", aber die Abzeichen-Vergabe ist
    // eingefroren (siehe state.js' _checkAndGrantBadges()). Ein Tipp, der ein
    // nie eintretendes Ereignis ankündigt, wäre irreführend.
  }
  if (tab === 'settings') renderSettingsTab(state);
}

function _bindTabSwitcher() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => _switchToTab(btn.dataset.tab));
  });
}

// ════════════════════════════════════════════════════════════════════════════
// FULL RENDER (called by subscriber on every state change)
// ════════════════════════════════════════════════════════════════════════════

let _renderScheduled  = false;
let _onboardingActive = false; // true while onboarding overlay is mounted
let _knownWeekCount   = -1;   // -1 = not yet initialised; used to detect new-week events

// Reposition fixed floating elements (⋮ dropdown, +kg picker) after render
function _positionFloating() {
  if (_exMenuOpenKey) {
    const [dii, eii] = _exMenuOpenKey.split('-');
    const btn = document.querySelector(`[data-action="toggle-ex-menu"][data-di="${dii}"][data-ei="${eii}"]`);
    const dropdown = btn?.closest('.ex-menu-wrap')?.querySelector('.ex-menu-dropdown');
    if (btn && dropdown) {
      const r = btn.getBoundingClientRect();
      dropdown.style.top   = `${r.bottom + 2}px`;
      dropdown.style.right = `${window.innerWidth - r.right}px`;
    }
  }
  if (_dayMenuOpenKey !== null) {
    const btn = document.querySelector(`[data-action="toggle-day-menu"][data-di="${_dayMenuOpenKey}"]`);
    const dropdown = btn?.closest('.day-menu-wrap')?.querySelector('.ex-menu-dropdown');
    if (btn && dropdown) {
      const r = btn.getBoundingClientRect();
      dropdown.style.top   = `${r.bottom + 2}px`;
      dropdown.style.right = `${window.innerWidth - r.right}px`;
    }
  }
  if (_weekMenuOpen) {
    const btn = document.querySelector('[data-action="toggle-week-menu"]');
    const dropdown = btn?.closest('.week-menu-wrap')?.querySelector('.ex-menu-dropdown');
    if (btn && dropdown) {
      const r = btn.getBoundingClientRect();
      dropdown.style.top   = `${r.bottom + 2}px`;
      dropdown.style.right = `${window.innerWidth - r.right}px`;
    }
  }
}

function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    if (_onboardingActive) return;
    const state = getState();

    // Auto-backup: silently download JSON when a new week is created
    const newWeekCount = state.weeks?.length ?? 0;
    if (_knownWeekCount >= 0 && newWeekCount > _knownWeekCount && newWeekCount >= 2) {
      const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const completedWeek = sorted[sorted.length - 2];
      if (completedWeek?.startDate && !completedWeek.isSeedWeek) {
        exportJSONAuto(completedWeek.startDate);
      }
    }
    _knownWeekCount = newWeekCount;

    renderWeekHeader(state);
    renderDayList(state);
    if (_activeTab === 'body')     renderBodyTab(state);
    if (_activeTab === 'coach')    renderCoachTab(state);
    if (_activeTab === 'progress') renderProgressTab(state);
    if (_activeTab === 'settings') renderSettingsTab(state);
    _positionFloating();
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DOM SCAFFOLD (built once in mountApp)
// ════════════════════════════════════════════════════════════════════════════

function _buildScaffold(root) {
  root.innerHTML = `
<nav class="nav" role="navigation" aria-label="Hauptnavigation">
  <button class="nav__logo" data-action="go-home" aria-label="Zur Trainingsübersicht">TRAIN</button>
  <div class="nav__tabs" role="tablist" aria-label="App-Bereiche">
    <button class="nav__tab is-active" role="tab" data-tab="workout"
      aria-selected="true" aria-controls="page-workout" aria-label="Training">
      ${ic.dumbbell()}
    </button>
    <button class="nav__tab" role="tab" data-tab="coach"
      aria-selected="false" aria-controls="page-coach" aria-label="Coach">
      ${ic.compass()}
    </button>
    <button class="nav__tab" role="tab" data-tab="progress"
      aria-selected="false" aria-controls="page-progress" aria-label="Fortschritt">
      ${ic.barChart()}
    </button>
    <button class="nav__tab" role="tab" data-tab="body"
      aria-selected="false" aria-controls="page-body" aria-label="Körper">
      ${ic.person()}
    </button>
    <button class="nav__tab" role="tab" data-tab="settings"
      aria-selected="false" aria-controls="page-settings" aria-label="Einstellungen">
      ${ic.settings()}
    </button>
  </div>
</nav>

<section id="page-workout" class="page is-active" role="tabpanel" aria-label="Training">
  <div class="week-nav" aria-label="Wochennavigation">
    <button class="week-nav__btn" id="btn-prev-wk" data-action="nav-prev"
      aria-label="Vorherige Woche">${ic.chevronLeft()}</button>
    <div class="week-nav__info" aria-live="polite">
      <div id="wk-label" class="week-nav__label">–</div>
      <div id="wk-range" class="week-nav__range"></div>
    </div>
    <button class="week-nav__btn" id="btn-next-wk" data-action="nav-next"
      aria-label="Nächste Woche">${ic.chevronRight()}</button>
  </div>

  <div id="days-container" role="region" aria-label="Trainingstage"></div>
</section>

<section id="page-coach" class="page" role="tabpanel" aria-label="Coach">
  <h1 class="page-title">Coach</h1>
  <p class="page-subtitle">Dein wöchentlicher Fokus</p>
  <div id="coach-tab-content"></div>
</section>

<section id="page-progress" class="page" role="tabpanel" aria-label="Fortschrittsanalyse">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
    <div>
      <h1 class="page-title">Fortschritt</h1>
      <p class="page-subtitle">Wochenrückblick, Beobachtungen & Muster</p>
    </div>
    <button class="btn btn--accent btn--sm" data-action="open-export"
      aria-label="Daten exportieren">${ic.download()} Export</button>
  </div>
  <div id="progress-tab-content"></div>
</section>

<section id="page-body" class="page" role="tabpanel" aria-label="Körper und Wohlbefinden">
  <h1 class="page-title">Körper</h1>
  <p class="page-subtitle">Optional · Fließt in CSV-Analyse ein</p>
  <div id="body-tab-content"></div>
</section>

<section id="page-settings" class="page" role="tabpanel" aria-label="Einstellungen">
  <h1 class="page-title">Einstellungen</h1>
  <div id="settings-tab-content"></div>
</section>

<!-- Modal: Neue Woche -->
<div class="modal-overlay" id="modal-new-week" role="dialog"
  aria-modal="true" aria-labelledby="modal-nw-title">
  <div class="modal">
    <h2 class="modal__title" id="modal-nw-title">Neue Woche</h2>
    <div id="new-week-modal-body"><!-- filled by _prepNewWeekModal() --></div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Abbrechen</button>
      <button class="btn btn--accent" data-action="create-week">
        ${ic.plus()} Erstellen</button>
    </div>
  </div>
</div>

<!-- Modal: Woche löschen -->
<div class="modal-overlay" id="modal-delete-week" role="dialog"
  aria-modal="true" aria-labelledby="modal-dw-title">
  <div class="modal">
    <h2 class="modal__title" id="modal-dw-title">Woche löschen?</h2>
    <p style="color:var(--c-text-2);font-size:14px;margin-bottom:var(--sp-2)">
      Alle Trainingsdaten dieser Woche werden <strong>unwiderruflich gelöscht</strong>. Rückgängig ist nicht möglich.</p>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Abbrechen</button>
      <button class="btn btn--danger" data-action="confirm-delete-week">
        ${ic.trash()} Löschen</button>
    </div>
  </div>
</div>

<!-- Modal: Export -->
<div class="modal-overlay" id="modal-export" role="dialog"
  aria-modal="true" aria-labelledby="modal-exp-title">
  <div class="modal">
    <h2 class="modal__title" id="modal-exp-title">Daten exportieren</h2>
    <p style="color:var(--c-text-2);font-size:13px;margin-bottom:var(--sp-3)">
      CSV-Format · 3 Sektionen: Detail, Wochenübersicht, Progressive Overload</p>
    <div class="export-option" data-action="export-current" role="button" tabindex="0"
      aria-label="Nur aktuelle Woche exportieren">
      ${ic.download()}
      <div>
        <div class="export-option__title">Aktuelle Woche</div>
        <div class="export-option__desc">Nur die aktuell angezeigte Woche</div>
      </div>
    </div>
    <div class="export-option" data-action="export-all" role="button" tabindex="0"
      aria-label="Alle Wochen exportieren">
      ${ic.barChart()}
      <div>
        <div class="export-option__title">Alle Wochen</div>
        <div class="export-option__desc">Komplette Trainingshistorie</div>
      </div>
    </div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Schließen</button>
    </div>
  </div>
</div>

<!-- Modal: Template -->
<div class="modal-overlay" id="modal-template" role="dialog"
  aria-modal="true" aria-labelledby="modal-tpl-title">
  <div class="modal">
    <h2 class="modal__title" id="modal-tpl-title">Template bearbeiten</h2>
    <p style="color:var(--c-text-2);font-size:12px;margin-bottom:var(--sp-3)">
      Vorlage für neue Wochen. Bestehende Wochen bleiben unverändert.</p>
    <div id="tpl-editor-body"></div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Schließen</button>
      <button class="btn btn--accent" data-action="save-tpl">
        ${ic.save()} Speichern</button>
    </div>
  </div>
</div>

<!-- Modal: Tag hinzufügen / klonen (2.2) -->
<div class="modal-overlay" id="modal-add-day" role="dialog"
  aria-modal="true" aria-labelledby="modal-add-day-title">
  <div class="modal">
    <h2 class="modal__title" id="modal-add-day-title">Neuer Trainingstag</h2>
    <div id="add-day-options" style="display:flex;flex-direction:column;gap:var(--sp-2);margin-bottom:var(--sp-4)"></div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal" data-target="modal-add-day">Abbrechen</button>
      <button class="btn btn--accent" data-action="confirm-add-day">Hinzufügen</button>
    </div>
  </div>
</div>

<!-- Modal: Übung suchen -->
<div class="modal-overlay modal-overlay--search" id="modal-ex-search" role="dialog"
  aria-modal="true" aria-labelledby="modal-exsearch-title">
  <div class="modal">
    <h2 class="modal__title" id="modal-exsearch-title">Übung suchen</h2>
    <input id="ex-search-input" class="body-input" type="text" autocomplete="off"
      placeholder="🔍 Übung suchen …" aria-label="Übung suchen" />
    <div id="ex-search-results"></div>
    <div class="modal__actions">
      <button class="btn btn--ghost" data-action="close-modal">Abbrechen</button>
    </div>
  </div>
</div>

<!-- Modal: Übung anlegen / bearbeiten -->
<div class="modal-overlay" id="modal-ex-form" role="dialog"
  aria-modal="true" aria-labelledby="ex-form-title">
  <div class="modal">
    <h2 class="modal__title" id="ex-form-title">Neue Übung</h2>
    <div id="ex-form-body"></div>
  </div>
</div>

<div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>

<div class="storage-warning" id="storage-warning" role="alert">
  <span>⚠ Speicher voll! Bitte Backup herunterladen.</span>
  <button class="btn" id="storage-warn-btn">
    ${ic.download()} JSON-Backup</button>
</div>

<div class="sw-update-banner" id="sw-update-banner" role="alert">
  <span>🔄 Update verfügbar</span>
  <button class="btn" id="sw-update-btn">Jetzt aktualisieren</button>
</div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// MOUNT – public entry point
// ════════════════════════════════════════════════════════════════════════════

export function mountApp(root) {
  _root = root;

  _buildScaffold(root);

  _toast       = document.getElementById('toast');
  _storageWarn = document.getElementById('storage-warning');

  document.getElementById('storage-warn-btn')?.addEventListener('click', () => {
    exportJSON(() => showToast('✓ Backup gespeichert', 'ok', 2000));
  });

  document.getElementById('sw-update-btn')?.addEventListener('click', (e) => {
    // Bewusste Nutzer-Aktion — sw.js aktiviert den wartenden Worker NIE von
    // selbst (siehe 'install' dort). localStorage bleibt über den Reload
    // hinweg erhalten (unabhängig vom Service-Worker-Cache).
    e.target.disabled = true;
    if (!navigator.serviceWorker?.controller) { window.location.reload(); return; }
    let reloaded = false;
    const doReload = () => { if (!reloaded) { reloaded = true; window.location.reload(); } };
    navigator.serviceWorker.addEventListener('controllerchange', doReload, { once: true });
    navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
    setTimeout(doReload, 3000); // Sicherheitsnetz falls controllerchange ausbleibt
  });

  _bindEvents(root);
  _bindTabSwitcher();
  _initSwipe(root);

  // Close floating menus/pickers when user scrolls the day panel
  root.addEventListener('scroll', () => {
    if (_exMenuOpenKey || _dayMenuOpenKey || _kgPickerKey || _repsPickerKey) {
      _exMenuOpenKey  = null;
      _dayMenuOpenKey = null;
      _kgPickerKey    = null;
      _repsPickerKey  = null;
      scheduleRender();
    }
  }, { passive: true, capture: true });

  subscribe(scheduleRender);

  window.addEventListener('train:storage-error', () => {
    _storageWarn?.classList.add('is-visible');
  });

  // Von index.html gefeuert sobald ein neuer Service Worker installiert ist
  // und wartet (train:sw-update-ready -> train:show-update-banner). Bleibt
  // sichtbar bis Klick auf "Jetzt aktualisieren" — kein Auto-Dismiss.
  window.addEventListener('train:show-update-banner', () => {
    document.getElementById('sw-update-banner')?.classList.add('is-visible');
  });

  window.addEventListener('train:badge-earned', e => {
    (e.detail ?? []).forEach((badge, i) => {
      setTimeout(() => _showBadgeOverlay(badge), i * 5500);
    });
  });

  // Von index.html gefeuert bei window.onerror/unhandledrejection (Pre-Launch-
  // Checkliste) — Nutzer bekommt einen Hinweis statt einer stillen Fehler-
  // fläche, zusätzlich anonymes GoatCounter-Zähl-Event (keine Nutzdaten).
  window.addEventListener('train:js-error', () => {
    showToast('Etwas ist schiefgelaufen — bitte kurz neu laden.', 'warn', 4000);
    _gcEvent('js_error');
  });

  scheduleRender();
  _showOnboarding();

  // Fire APP_GEÖFFNET and show 4-week backup reminder if due
  setTimeout(() => {
    const triggered = fireTrigger('APP_GEÖFFNET', {});
    for (const ins of triggered) {
      if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', 5000);
    }

    _runAutoWeekFlow();

    const st = getState();
    const pause = _detectReentryPause(st);
    if (pause) {
      _showReentryPopup(pause.pauseDays, pause.factor);
    } else if (_shouldShowBackupReminder(st)) {
      _showBackupReminderToast();
    }

    _checkDecisionOutcomes(st);
  }, 2000);
}

function _getDayCompletionStats(di) {
  const state = getState();
  const day   = state.weeks[state.curIdx]?.days[di];
  if (!day) return { successSets: 0, totalSets: 0, prCount: 0, pct: null, quote: '' };
  let successSets = 0, failSets = 0, totalSets = 0, prCount = 0;
  for (const ex of day.exercises ?? []) {
    const exPR = state.prs?.[ex.name];
    for (const s of ex.sets ?? []) {
      totalSets++;
      if (s.status === 'success') {
        successSets++;
        if (exPR && (s.weight ?? 0) > 0 && (
          s.weight > exPR.maxWeight ||
          (s.weight === exPR.maxWeight && (s.reps ?? 0) > (exPR.maxRepsAtMaxWeight ?? 0))
        )) prCount++;
      } else if (s.status === 'fail') {
        failSets++;
      }
    }
  }
  // B22: success / (success+fail), pending ausgeschlossen — identische Semantik
  // zu _weekSuccessScore(). Vorher successSets/totalSets, wo totalSets auch
  // pending-Sätze enthielt und den Wert verwässerte. null statt 0 wenn noch
  // keine Sätze bewertet wurden (kein Wert ist ehrlicher als eine falsche 0%).
  const evaluatedSets = successSets + failSets;
  const pct = evaluatedSets > 0 ? Math.round(successSets / evaluatedSets * 100) : null;
  // effortTarget: Summe ALLER targetReps über alle Sätze der Übung, unabhängig
  // vom Satz-Status (identisch zum "target = nSets × targetReps"-Muster im
  // Fulfill-Meter, renderExercise()) — nicht nur der bewerteten Sätze wie
  // vorher, sonst zieht ein noch offener (pending) Satz sein Soll nicht mit.
  // effortAchieved: success UND fail zählen (Sprint "Kategorie-1-Bugfixes",
  // Fix 5c/8) — ein fail-Satz mit z.B. 5 von 8 Ziel-Wdh war trotzdem echte
  // Arbeit und darf nicht komplett verschwinden.
  let effortAchieved = 0, effortTarget = 0;
  for (const ex of day.exercises ?? []) {
    if (!ex.targetReps) continue;
    const targetReps = parseFloat(ex.targetReps) || 0;
    for (const s of ex.sets ?? []) {
      effortTarget += targetReps;
      if (s.status === 'success' || s.status === 'fail') {
        effortAchieved += parseFloat(s.reps) || 0;
      }
    }
  }
  const effortPct = effortTarget > 0 ? Math.round(effortAchieved / effortTarget * 100) : null;
  const quotes = [
    'Kein Fortschritt ohne Konsequenz.',
    'Du hast heute gewonnen.',
    'Die Arbeit ist gemacht – dein Körper dankt es dir.',
    'Stark heute, stärker morgen.',
    'Jeder Satz zählt.',
    'Das war kein Zufall – das war Wille.',
    'Erschöpfung ist der Preis des Wachstums.',
    'Jede Wiederholung bringt dich weiter.',
    'Du kommst wieder. Das macht den Unterschied.',
    'Erholung ist Teil des Plans.',
  ];
  const isVacation = !!(day.isVacation);
  return { successSets, totalSets, prCount, pct, effortPct, isVacation, quote: quotes[Math.floor(Math.random() * quotes.length)] };
}

function _finishCompletion(di, rating, sleepHours, energyLevel) {
  document.getElementById('day-completion-modal')?.remove();
  _completionModalDi = null;

  const stats = _getDayCompletionStats(di);

  dispatch(A.DAY_TOGGLE_COMPLETE, { di });
  if (rating      != null) dispatch(A.DAY_SET_FIELD, { di, field: 'sessionRating', value: rating });
  if (sleepHours  != null) dispatch(A.DAY_SET_FIELD, { di, field: 'sleepHours',    value: sleepHours });
  if (energyLevel != null) dispatch(A.DAY_SET_FIELD, { di, field: 'energyLevel',   value: energyLevel });

  showToast('Tag gesperrt 🔒', 'info');

  const afterSt   = getState();
  const lockedDay = afterSt.weeks[afterSt.curIdx]?.days[di];
  if (lockedDay?.markedDone) {
    const allDone   = afterSt.weeks[afterSt.curIdx]?.days.every(d => d.markedDone);
    const trigger   = allDone ? 'WOCHE_ABGESCHLOSSEN' : 'TAG_ABGESCHLOSSEN';
    const triggered = fireTrigger(trigger, { di });
    for (const ins of triggered) {
      if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', 5000);
    }
    if (allDone && _shouldShowBackupReminder(afterSt)) {
      setTimeout(_showBackupReminderToast, 4500);
    }
  }

  setTimeout(() => _showCompletionScreen(stats), 300);
}

function _showVacationWeekPopup() {
  document.getElementById('vac-plan-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'vac-plan-modal';
  overlay.className = 'vac-plan-modal-overlay';

  const screen1 = () => `
    <div class="vac-plan-modal">
      <div class="vac-plan-modal__title">🏖 Urlaubswoche</div>
      <p class="vac-plan-modal__sub">Was möchtest du diese Woche trainieren?</p>
      <button class="vac-plan-option" data-vac="normal">✓ Normaler Plan</button>
      <button class="vac-plan-option" data-vac="equipment">🏋 Equipment wählen</button>
      <button class="vac-plan-option" data-vac="custom">📝 Eigene Übungen</button>
      <button class="vac-plan-option" data-vac="rest">😴 Ruhetag — kein Training</button>
    </div>`;

  const screen2 = () => `
    <div class="vac-plan-modal">
      <div class="vac-plan-modal__title">🏋 Equipment</div>
      <p class="vac-plan-modal__sub">Welches Equipment hast du?</p>
      <button class="vac-plan-option" data-vac="bodyweight">🤸 Kein Equipment</button>
      <button class="vac-plan-option" data-vac="light_kb">🏋 Leichte KH (bis 15 kg)</button>
      <button class="vac-plan-option" data-vac="heavy_kb">💪 Schwere KH (15 kg+)</button>
      <button class="vac-plan-option" data-vac="hotel_gym">🏢 Hotel-Gym / Maschinen</button>
    </div>`;

  overlay.innerHTML = screen1();
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); return; }
    const btn = e.target.closest('[data-vac]');
    if (!btn) return;
    const vac = btn.dataset.vac;
    if (vac === 'normal') {
      dispatch(A.WEEK_SET_MODE, { mode: 'vacation' });
      overlay.remove();
    } else if (vac === 'equipment') {
      overlay.innerHTML = screen2();
    } else if (vac === 'custom') {
      dispatch(A.WEEK_LOAD_VACATION_PLAN, { plan: 'custom' });
      overlay.remove();
    } else if (vac === 'rest') {
      dispatch(A.WEEK_LOAD_VACATION_PLAN, { plan: 'rest' });
      overlay.remove();
    } else if (VACATION_PLANS[vac]) {
      dispatch(A.WEEK_LOAD_VACATION_PLAN, { plan: vac });
      overlay.remove();
    }
  });
}

function _showVacationPlanModal(di) {
  document.getElementById('vac-plan-modal')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'vac-plan-modal';
  overlay.className = 'vac-plan-modal-overlay';

  const screen1 = () => `
    <div class="vac-plan-modal">
      <div class="vac-plan-modal__title">🏖 Urlaubstag</div>
      <p class="vac-plan-modal__sub">Was möchtest du heute trainieren?</p>
      <button class="vac-plan-option" data-vac="normal">✓ Normaler Plan</button>
      <button class="vac-plan-option" data-vac="equipment">🏋 Equipment wählen</button>
      <button class="vac-plan-option" data-vac="custom">📝 Eigene Übungen</button>
      <button class="vac-plan-option" data-vac="rest">😴 Ruhetag — kein Training</button>
    </div>`;

  const screen2 = () => `
    <div class="vac-plan-modal">
      <div class="vac-plan-modal__title">🏋 Equipment</div>
      <p class="vac-plan-modal__sub">Welches Equipment hast du?</p>
      <button class="vac-plan-option" data-vac="bodyweight">🤸 Kein Equipment</button>
      <button class="vac-plan-option" data-vac="light_kb">🏋 Leichte KH (bis 15 kg)</button>
      <button class="vac-plan-option" data-vac="heavy_kb">💪 Schwere KH (15 kg+)</button>
      <button class="vac-plan-option" data-vac="hotel_gym">🏢 Hotel-Gym / Maschinen</button>
    </div>`;

  overlay.innerHTML = screen1();
  document.body.appendChild(overlay);

  overlay.addEventListener('click', e => {
    if (e.target === overlay) { overlay.remove(); return; }
    const btn = e.target.closest('[data-vac]');
    if (!btn) return;
    const vac = btn.dataset.vac;
    if (vac === 'normal') {
      dispatch(A.DAY_TOGGLE_VACATION, { di });
      overlay.remove();
    } else if (vac === 'equipment') {
      overlay.innerHTML = screen2();
    } else if (vac === 'custom') {
      dispatch(A.DAY_LOAD_VACATION_PLAN, { di, plan: 'custom' });
      overlay.remove();
    } else if (vac === 'rest') {
      dispatch(A.DAY_LOAD_VACATION_PLAN, { di, plan: 'rest' });
      overlay.remove();
    } else if (VACATION_PLANS[vac]) {
      dispatch(A.DAY_LOAD_VACATION_PLAN, { di, plan: vac });
      overlay.remove();
    }
  });
}

function _showDayCompletionModal(di) {
  _completionModalDi = di;
  document.getElementById('day-completion-modal')?.remove();

  const overlay = document.createElement('div');
  overlay.id        = 'day-completion-modal';
  overlay.className = 'completion-modal-overlay';
  overlay.innerHTML = `
    <div class="completion-modal">
      <h3 class="completion-modal__title">Wie war die Einheit?</h3>
      <div class="completion-modal__ratings">
        <button class="completion-modal__rate-btn" data-val="1" aria-label="Erschöpft">😴</button>
        <button class="completion-modal__rate-btn" data-val="2" aria-label="Gut">😊</button>
        <button class="completion-modal__rate-btn" data-val="3" aria-label="Stark">💪</button>
      </div>
      <button class="completion-modal__skip">Überspringen</button>
    </div>`;
  document.body.appendChild(overlay);
  _maybeShowTip('tip-06', 'Schlaf und Energie beeinflussen deine Leistung. TRAIN erkennt Muster und passt Empfehlungen an.');

  overlay.querySelectorAll('.completion-modal__rate-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rating    = +btn.dataset.val;
      const st        = getState();
      const day       = st.weeks[st.curIdx]?.days[di];
      const initSleep  = day?.sleepHours  ?? 7;
      const initEnergy = day?.energyLevel ?? 3;

      overlay.innerHTML = `
        <div class="completion-modal">
          <h3 class="completion-modal__title">Erholung heute</h3>
          <div class="completion-modal__slider-row">
            <span class="completion-modal__label">🛌 Schlaf</span>
            <input type="range" id="cm-sleep" class="completion-modal__slider"
              min="3" max="10" step="0.5" value="${initSleep}">
            <span class="completion-modal__val" id="cm-sleep-val">${initSleep}h</span>
          </div>
          <div class="completion-modal__slider-row">
            <span class="completion-modal__label">⚡ Energie</span>
            <input type="range" id="cm-energy" class="completion-modal__slider"
              min="1" max="5" step="1" value="${initEnergy}">
            <span class="completion-modal__val" id="cm-energy-val">${initEnergy}/5</span>
          </div>
          <button class="completion-modal__confirm">Fertig</button>
          <button class="completion-modal__skip">Überspringen</button>
        </div>`;

      const sleepIn    = overlay.querySelector('#cm-sleep');
      const energyIn   = overlay.querySelector('#cm-energy');
      const sleepDisp  = overlay.querySelector('#cm-sleep-val');
      const energyDisp = overlay.querySelector('#cm-energy-val');

      sleepIn.addEventListener('input',  () => { sleepDisp.textContent  = `${sleepIn.value}h`; });
      energyIn.addEventListener('input', () => { energyDisp.textContent = `${energyIn.value}/5`; });

      overlay.querySelector('.completion-modal__confirm').addEventListener('click', () => {
        _finishCompletion(di, rating, +sleepIn.value, +energyIn.value);
      });
      overlay.querySelector('.completion-modal__skip').addEventListener('click', () => {
        _finishCompletion(di, rating, null, null);
      });
    });
  });

  overlay.querySelector('.completion-modal__skip').addEventListener('click', () => {
    _finishCompletion(di, null, null, null);
  });
}

function _showCompletionScreen(stats) {
  const { successSets, totalSets, prCount, pct, effortPct, isVacation, quote } = stats;
  const vacQuotes = [
    'Kein Gym? Kein Problem.',
    'Urlaub vom Alltag, nicht vom Training.',
    'Überall wo du bist, kannst du trainieren.',
    'Stark bleiben, egal wo.',
  ];
  const displayQuote = isVacation
    ? vacQuotes[Math.floor(Math.random() * vacQuotes.length)]
    : quote;
  document.getElementById('day-completion-screen')?.remove();
  const el = document.createElement('div');
  el.id        = 'day-completion-screen';
  el.className = 'day-completion-screen';
  el.innerHTML = `
    <div class="day-completion-screen__inner">
      <div class="day-completion-screen__icon">💪</div>
      ${isVacation
        ? `<div class="day-completion-screen__pct" style="font-size:20px">🏖 Stark! Auch im Urlaub trainiert.</div>`
        : pct !== null ? `<div class="day-completion-screen__pct">${pct}%</div>` : ''}
      ${successSets > 0 ? `<div class="day-completion-screen__sets">${successSets}/${totalSets} Sätze erfolgreich</div>` : ''}
      ${prCount > 0 ? `<div class="day-completion-screen__pr">🏆 ${prCount} neues PR${prCount > 1 ? 's' : ''}!</div>` : ''}
      ${!isVacation && effortPct !== null ? `<div class="day-completion-screen__effort">🎯 ${effortPct}% Zielerfüllung</div>` : ''}
      <div class="day-completion-screen__quote">"${displayQuote}"</div>
    </div>`;
  document.body.appendChild(el);
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  const timer   = setTimeout(dismiss, 4000);
  el.addEventListener('click', dismiss, { once: true });
}

function _showBadgeOverlay(badge) {
  const existing = document.getElementById('badge-earned-overlay');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id        = 'badge-earned-overlay';
  el.className = 'badge-earned-overlay';
  el.innerHTML = `
    <div class="badge-earned-overlay__inner">
      <div class="badge-earned-overlay__header">Abzeichen freigeschaltet!</div>
      <img src="./badges/${badge.id}.png" alt="${badge.title}" class="badge-img" width="160" height="160">
      <div class="badge-earned-overlay__title">${badge.title}</div>
      <div class="badge-earned-overlay__sub">nach ${badge.weeks * 7} Tagen konsequentem Training</div>
    </div>`;
  document.body.appendChild(el);
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  const timer   = setTimeout(dismiss, 5000);
  el.addEventListener('click', dismiss, { once: true });
}

// weeksLeft-Countdown ("noch X Tage") für nicht erreichte Abzeichen entfernt
// (Sprint "Framework-Audit Cleanup", Fix 5) — seit die Abzeichen-Vergabe
// eingefroren ist (_checkAndGrantBadges() in state.js), wäre ein Countdown
// bis zu einem Unlock, der nie kommt, irreführend. Grau/transparent allein
// kommuniziert bereits "nicht erreicht", ohne ein Versprechen zu machen.
function _renderBadgeGallery(state) {
  const badges  = state.badges ?? [];
  const items = BADGE_THRESHOLDS.map(thr => {
    const earned = badges.find(b => b.id === thr.id);
    if (earned) {
      const dateStr = new Date(earned.unlockedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return `<button type="button" class="badge-item badge-item--earned" data-action="show-badge-detail" data-badge-id="${thr.id}" aria-label="${thr.title} — Details">
        <img src="./badges/${thr.id}.png" alt="${thr.title}" class="badge-img" width="80" height="80">
        <div class="badge-item__title">${thr.title}</div>
        <div class="badge-item__sub badge-item__date">${dateStr}</div>
      </button>`;
    }
    return `<div class="badge-item">
      <img src="./badges/${thr.id}.png" alt="${thr.title}" class="badge-img" width="80" height="80" style="filter:grayscale(100%) opacity(0.3)">
      <div class="badge-item__title">${thr.title}</div>
    </div>`;
  });
  return `<div class="section-label" style="margin-top:var(--sp-5)">Abzeichen</div>
    <div class="badge-gallery">${items.join('')}</div>`;
}

function _showInvalidBackupDialog(fileInput) {
  const existing = document.getElementById('invalid-backup-dialog');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'invalid-backup-dialog';
  el.className = 'modal-overlay is-open';
  el.innerHTML = `
    <div class="modal" role="alertdialog" aria-modal="true" aria-labelledby="ibdlg-title">
      <div class="modal__title" id="ibdlg-title">Ungültiges Backup</div>
      <p style="font-size:14px;color:var(--c-text-2);margin-bottom:var(--sp-4)">Diese Datei ist kein gültiges TRAIN-Backup.</p>
      <div class="modal__actions">
        <button class="btn btn--ghost" id="ibdlg-cancel">Abbrechen</button>
        <button class="btn btn--accent" id="ibdlg-retry">📂 Andere Datei wählen</button>
      </div>
    </div>`;
  document.body.appendChild(el);
  const dismiss = () => el.remove();
  document.getElementById('ibdlg-cancel').addEventListener('click', dismiss);
  document.getElementById('ibdlg-retry').addEventListener('click', () => {
    dismiss();
    fileInput.click();
  });
  el.addEventListener('click', e => { if (e.target === el) dismiss(); });
}

function _showBackupReminderToast() {
  const existing = document.getElementById('backup-reminder-toast');
  if (existing) return;
  const div = document.createElement('div');
  div.id = 'backup-reminder-toast';
  div.className = 'backup-reminder';
  div.innerHTML = `<span>💾 Zeit für ein Backup — sichere deine Trainingsdaten</span>
    <div class="backup-reminder__btns">
      <button id="backup-now-btn" class="btn btn--accent btn--sm">Jetzt sichern</button>
      <button id="backup-later-btn" class="btn btn--ghost btn--sm">Später</button>
    </div>`;
  document.body.appendChild(div);
  document.getElementById('backup-now-btn')?.addEventListener('click', () => {
    div.remove();
    exportJSON(() => showToast('✓ Backup gespeichert', 'ok', 2000));
  });
  document.getElementById('backup-later-btn')?.addEventListener('click', () => {
    dispatch(A.SETTING_SET, { key: 'backupReminderSnoozed', value: Date.now() });
    div.remove();
  });
}

function _showOnboarding() {
  const st = getState();
  console.log('[TRAIN] _showOnboarding called — weeks:', st.weeks.length, 'onboardingDone:', st.onboardingDone);
  if (st.weeks.length > 0 || st.onboardingDone === true) return;
  if (document.getElementById('onboarding')) return;
  _onboardingActive = true;

  let _selTpl          = null;
  let _expLevel        = null;    // 'anfaenger' | 'fortgeschritten' | 'erfahren' | null
  let _mainGoal        = null;    // 'kraftaufbau' | 'muskelaufbau' | 'fitness' | null
  let _optionalOpen    = false;   // <details> state — survives innerHTML rebuilds
  let _startwerteOpen  = false;   // <details> state for startwerte section
  let _startwerte      = {};      // { [exerciseName]: { weight, reps, rpe } }

  const el = document.createElement('div');
  el.id = 'onboarding';
  el.className = 'onboarding';
  el.style.cssText = [
    'position:fixed!important',
    'top:0!important',
    'left:0!important',
    'width:100vw!important',
    'height:100vh!important',
    'z-index:9999!important',
    'background:#0d0d0d!important',
    'display:flex!important',
    'flex-direction:column!important',
    'align-items:center!important',
    'justify-content:center!important',
    'overflow-y:auto!important',
  ].join(';');
  document.body.appendChild(el);

  function _render() {
    // Empfehlung-Logik (Sprint C1, train-v108): Fitness > Anfänger > Muskelaufbau > sonst
    const _recommendedIdx = (!_expLevel && !_mainGoal) ? null
      : _mainGoal === 'fitness'      ? 2
      : _expLevel === 'anfaenger'    ? 0
      : _mainGoal === 'muskelaufbau' ? 1
      : 1;

    const _expOptions  = [['anfaenger', 'Anfänger'], ['fortgeschritten', 'Fortgeschritten'], ['erfahren', 'Erfahren']];
    const _goalOptions = [
      ['kraftaufbau',  'Stärker werden'],
      ['muskelaufbau', 'Mehr Muskeln'],
      ['fitness',      'Fitter werden'],
    ];

    const cards = _ONBOARDING_TEMPLATES.map((t, i) => `
      <div class="ob-tpl-card${_selTpl === i ? ' is-selected' : ''}${_recommendedIdx === i ? ' ob-tpl-card--recommended' : ''}" data-ob="select" data-tpl="${i}">
        <span class="ob-tpl-icon">${t.icon}</span>
        <div class="ob-tpl-info">
          <div class="ob-tpl-title">${t.title}</div>
          <div class="ob-tpl-meta">${t.meta}</div>
          <div class="ob-tpl-sub">${t.sub}</div>
          ${_recommendedIdx === i ? '<div class="ob-tpl-recommended">✓ Empfohlen für dich</div>' : ''}
        </div>
      </div>`).join('');

    // Exercises for the selected template (reps-metric only, max 5)
    const tplExercises = _selTpl !== null
      ? _ONBOARDING_TEMPLATES[_selTpl].days.flatMap(d => d.exercises).filter(ex => ex.m === 'reps').slice(0, 5)
      : [];

    const startwerteHtml = tplExercises.length > 0 ? `
        <details class="ob-optional ob-startwerte">
          <summary class="ob-optional__summary">Startwerte eingeben (optional) ▾</summary>
          <div class="ob-optional__body">
            <p class="ob-startwerte__hint">Gib deine aktuellen Arbeitsgewichte ein — TRAIN kann so ab der ersten Woche bessere Empfehlungen geben.</p>
            ${tplExercises.map(ex => `
            <div class="ob-startwert-row">
              <div class="ob-startwert-name">${h(ex.name)}</div>
              <div class="ob-startwert-inputs">
                <input type="number" inputmode="decimal" class="ob-startwert-input" placeholder="kg" min="0" step="2.5"
                  data-sw-field="weight" data-sw-name="${h(ex.name)}">
                <input type="number" inputmode="numeric" class="ob-startwert-input ob-startwert-input--sm" placeholder="Wdh" min="1"
                  data-sw-field="reps" data-sw-name="${h(ex.name)}">
                <input type="number" inputmode="decimal" class="ob-startwert-input ob-startwert-input--sm" placeholder="RPE" min="1" max="10" step="0.5"
                  data-sw-field="rpe" data-sw-name="${h(ex.name)}">
              </div>
            </div>`).join('')}
          </div>
        </details>` : '';

    el.innerHTML = `
      <div class="ob-screen">
        <h2 class="ob-title ob-title--sm">Womit möchtest du starten?</h2>
        <div class="ob-tpl-list">${cards}</div>
        <button class="btn btn--accent ob-btn" data-ob="load"${_selTpl === null ? ' disabled' : ''}>Vorlage laden →</button>
        <details class="ob-optional">
          <summary class="ob-optional__summary">Optional: Vorlage anpassen ▾</summary>
          <div class="ob-optional__body">
            <div class="ob-choice-block">
              <div class="ob-choice-label">Erfahrung</div>
              <div class="ob-choice-row">
                ${_expOptions.map(([val, label]) => `
                  <button type="button" class="ob-choice-btn${_expLevel === val ? ' is-selected' : ''}"
                    data-ob="select-exp" data-exp="${val}">${label}</button>`).join('')}
              </div>
            </div>
            <div class="ob-choice-block">
              <div class="ob-choice-label">Hauptziel</div>
              <div class="ob-choice-row">
                ${_goalOptions.map(([val, label]) => `
                  <button type="button" class="ob-choice-btn${_mainGoal === val ? ' is-selected' : ''}"
                    data-ob="select-goal" data-goal="${val}">${label}</button>`).join('')}
              </div>
            </div>
          </div>
        </details>
        ${startwerteHtml}
        <button class="btn btn--ghost ob-btn ob-btn--sm" data-ob="skip">Ohne Vorlage starten</button>
      </div>`;

    // <details>-Zustände nach innerHTML-Rebuild wiederherstellen + Toggle tracken
    const detEl = el.querySelector('.ob-optional:not(.ob-startwerte)');
    if (detEl) {
      if (_optionalOpen) detEl.open = true;
      detEl.addEventListener('toggle', () => { _optionalOpen = detEl.open; });
    }
    const swDetEl = el.querySelector('.ob-startwerte');
    if (swDetEl) {
      if (_startwerteOpen) swDetEl.open = true;
      swDetEl.addEventListener('toggle', () => { _startwerteOpen = swDetEl.open; });
      // Restore input values preserved across rebuilds
      el.querySelectorAll('[data-sw-field][data-sw-name]').forEach(inp => {
        const sw = _startwerte[inp.dataset.swName];
        const val = sw?.[inp.dataset.swField];
        if (val != null) inp.value = val;
      });
    }
  }

  el.addEventListener('input', e => {
    const inp = e.target;
    const name  = inp.dataset?.swName;
    const field = inp.dataset?.swField;
    if (!name || !field) return;
    if (!_startwerte[name]) _startwerte[name] = {};
    const raw = inp.value.trim();
    _startwerte[name][field] = raw === '' ? null : +raw;
  });

  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-ob]');
    if (!btn) return;
    switch (btn.dataset.ob) {
      case 'select':
        _selTpl = +btn.dataset.tpl; _render(); break;
      case 'select-exp':
        _expLevel = _expLevel === btn.dataset.exp ? null : btn.dataset.exp;
        _optionalOpen = true;
        _render(); break;
      case 'select-goal':
        _mainGoal = _mainGoal === btn.dataset.goal ? null : btn.dataset.goal;
        _optionalOpen = true;
        _render(); break;
      case 'load':
        if (_selTpl !== null) _applyTpl(_selTpl);
        _finish(); break;
      case 'skip':
        _applyBlank(); _finish(); break;
    }
  });

  // Laufzeit-Anpassung von Sätzen/Pause nach gewählter Erfahrungsstufe.
  // _ONBOARDING_TEMPLATES selbst bleibt unverändert — nur die beim Erstellen
  // tatsächlich übernommenen Werte (n, ps) werden hier situativ modifiziert.
  // Fortgeschritten: keine Anpassung (implizite Referenz-Stufe). targetReps
  // wird in KEINEM Fall verändert (Technik-Fokus, siehe Sprint-Spec).
  function _adjustedSetsAndPause(ex) {
    if (_expLevel === 'anfaenger') {
      return { n: Math.max(2, ex.n - 1), ps: ex.ps + 15 };
    }
    if (_expLevel === 'erfahren') {
      return { n: ex.n <= 3 ? ex.n + 1 : ex.n, ps: ex.ps };
    }
    return { n: ex.n, ps: ex.ps };
  }

  // Wdh-Ziel-Anpassung nach Hauptziel (Sprint C1, train-v108) — läuft NACH
  // der Erfahrungs-Anpassung oben (Sätze/Pause), ändert NUR targetReps, NUR
  // bei Gewichts-Übungen (metric==='reps'). Körpergewicht-Übungen in
  // Sekunden/Metern (z.B. Plank) bleiben unverändert. _ONBOARDING_TEMPLATES
  // selbst bleibt unverändert, nur der beim Erstellen übernommene Wert.
  function _adjustedTargetReps(tr, metric) {
    if (metric !== 'reps') return tr;
    if (_mainGoal === 'kraftaufbau')  return tr > 6 ? 5 : tr;
    if (_mainGoal === 'muskelaufbau') return tr < 8 ? 8 : tr > 12 ? 10 : tr;
    if (_mainGoal === 'fitness')      return tr < 10 ? 12 : tr;
    return tr;
  }

  function _applyTpl(idx) {
    const tpl = _ONBOARDING_TEMPLATES[idx];
    const d   = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    const startDate = d.toISOString().slice(0, 10);
    const days = tpl.days.map((ds, di) => ({
      id: Date.now() + di,
      title: ds.title, subtitle: '',
      warmup: ds.warmup, cooldown: ds.cooldown,
      locked: false, markedDone: false,
      exercises: ds.exercises.map(ex => {
        const { n, ps } = _adjustedSetsAndPause(ex);
        const tr = _adjustedTargetReps(ex.tr, ex.m);
        return {
          name: ex.name, note: '', pauseSec: ps, metric: ex.m,
          sets: Array.from({ length: n }, () => ({
            weight: 0, reps: tr, rpe: null, status: 'pending', done: false, note: '',
          })),
          weightStep: 2.5, nextWeekPlan: 0, nextWeekPlanConfirmed: false,
          metricStep: ex.m === 'm' ? 50 : ex.m === 'sec' ? 10 : undefined,
          targetSets: n, targetReps: tr,
          _showCfg: false, setType: 'standard',
          tags: [], showPlates: false,
          progressionType: (ex.m ?? 'reps') === 'reps' ? 'weight' : 'reps',
          substituteFor: null,
          progressionMode: 'weight_first', targetRepsMax: null, prRepsHistory: {},
        };
      }),
    }));
    dispatch(A.ONBOARDING_WEEK_CREATE, { startDate, days, note: tpl.weekTitle });
  }

  // Seedet einen leeren Starttag statt days:[] — sonst kann _activeDayIdx
  // nie gesetzt werden (es greift nur bei wk.days.length > 0) und weder
  // "+Tag"- noch "+Übung"-Button können je gerendert werden (Dead-End).
  // Tag-Form identisch zu DAY_ADD_CLONE's "Leerer Tag"-Zweig (state.js).
  function _applyBlank() {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    const startDate = d.toISOString().slice(0, 10);
    const days = [{
      id: Date.now(), title: 'Tag A', subtitle: '', warmup: '', cooldown: '',
      locked: false, markedDone: false, isVacation: false,
      sleepHours: null, energyLevel: null, exercises: [],
    }];
    dispatch(A.ONBOARDING_WEEK_CREATE, { startDate, days, note: '' });
  }

  function _finish() {
    // Seed week: dispatch before ONBOARDING_DONE so week exists when Coach renders
    const seedExs = Object.entries(_startwerte)
      .filter(([, sw]) => sw?.weight != null && sw.weight > 0)
      .map(([name, sw]) => ({ name, weight: sw.weight, reps: sw.reps, rpe: sw.rpe }));
    if (seedExs.length > 0) {
      const _d = new Date();
      const _dow = _d.getDay();
      _d.setDate(_d.getDate() + (_dow === 0 ? -6 : 1 - _dow) - 7); // last Monday
      dispatch(A.ONBOARDING_SEED, { startDate: _d.toISOString().slice(0, 10), exercises: seedExs });
    }
    _onboardingActive = false;
    dispatch(A.ONBOARDING_DONE, {});
    _gcEvent('Onboarding abgeschlossen');
    el.remove();
  }

  _render();
}
