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
  getState, dispatch, subscribe, A, canUndo, AVAILABLE_TAGS, ALL_TAGS_FLAT, BADGE_THRESHOLDS, VACATION_PLANS,
} from './state.js';
import {
  exportJSON, importJSON, exportCSV,
} from './backup.js';
import * as ic from './icons.js';
import { fireTrigger } from './triggerEngine.js';
import { getWeightRecommendation } from './weightRecommendation.js';
import { renderProgressChart }    from './progressChart.js';
import { buildWeekReview }        from './weekReview.js';
import { showWeekReviewModal, renderWeekReviewHtml } from './weekReviewModal.js';
import { detectPlateaus }         from './plateauDetector.js';

// ─── Module-level UI state (transient, never persisted) ──────────────────────

/** Index of the currently-open training day (null = all closed). */
let _activeDayIdx = null;

/** When true: all days shown as collapsed overview cards instead of one active panel. */
let _overviewMode = false;

/** Currently active top-level tab id. */
let _activeTab = 'workout';

/** Insights visible in analysis tab (2.1). */
let _showInsights = false;


/** Whether insights tooltip has been shown (3.2). */
let _insightsTooltipShown = false;

/** Insights visible in body tab (2.2). */
let _showBodyInsights = false;

/** Show custom deload input even when current factor is a preset (1.4). */
let _showCustomDeload = false;

/** Key of currently open RPE popover: `${di}-${ei}-${si}` or null. */
let _rpePopoverKey = null;

/** Key of exercise whose confirm button is flashing green: `${di}-${ei}` or null. */
let _confirmFlashKey = null;

/** Key of the exercise with the open substitute-name form: `${di}-${ei}` or null. */
let _subFormOpenKey = null;

/** Key of the exercise whose ⋮ context menu is open: `${di}-${ei}` or null. */
let _exMenuOpenKey = null;

/** Index of the day whose ⋮ context menu is open: String(di) or null. */
let _dayMenuOpenKey = null;

/** Whether the week-level ⋮ menu is open. */
let _weekMenuOpen = false;

/** Key of the exercise whose settings panel (cfgRow) is open: `${di}-${ei}` or null. */
let _cfgOpenKey = null;

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



/** Übungen mit offenem Fortschritts-Chart im Training: Set von "${di}-${ei}" Keys. */
const _exChartOpen = new Set();

/** Swipe tracking. */
let _swipeStartX = null;
let _swipeStartY = null;

/** Drag-and-drop tracking. */
let _dragSrc = null; // { di, ei }

// ─── DOM references (set once in mountApp) ───────────────────────────────────
let _root        = null;
let _toast       = null;
let _storageWarn = null;

// _EXERCISE_TAGS removed in 4.1 – use AVAILABLE_TAGS / settings.activeTags instead

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

/** True when today falls within the 7-day span starting at sd. */
function _isCurrentWeek(sd) {
  try {
    const now   = new Date(); now.setHours(12, 0, 0, 0);
    const start = new Date(sd + 'T12:00:00');
    const end   = new Date(start); end.setDate(start.getDate() + 6);
    return now >= start && now <= end;
  } catch (_) { return false; }
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

  const labelEl    = document.getElementById('wk-label');
  const rangeEl    = document.getElementById('wk-range');
  const prevBtn    = document.getElementById('btn-prev-wk');
  const nextBtn    = document.getElementById('btn-next-wk');
  const wkMenuBtn  = document.getElementById('btn-week-menu');
  const wkMenuDrop = document.getElementById('week-menu-dropdown');

  if (labelEl) {
    if (wk) {
      const kw      = _isoWeek(new Date(wk.startDate + 'T12:00:00'));
      const range   = _wkRangeFull(wk.startDate);
      const badge    = _isCurrentWeek(wk.startDate) ? ' <span class="wk-badge-current">Aktuell</span>' : '';
      const vacBadge = isVac ? ' <span class="wk-badge-vacation">🏖 Urlaub</span>' : '';
      labelEl.innerHTML = `KW ${String(kw).padStart(2,'0')} · ${range}${badge}${vacBadge}`;
    } else {
      labelEl.textContent = '–';
    }
    labelEl.className = 'week-nav__label' + (isDl ? ' week-nav__label--deload' : '') + (isVac ? ' week-nav__label--vacation' : '');
  }
  if (rangeEl)  rangeEl.textContent = '';
  if (prevBtn)  prevBtn.disabled    = isFirst;
  if (nextBtn)  nextBtn.disabled    = isLast;
  if (wkMenuBtn)  wkMenuBtn.setAttribute('aria-expanded', String(_weekMenuOpen));
  if (wkMenuDrop) {
    if (_weekMenuOpen) {
      wkMenuDrop.className = 'ex-menu-dropdown';
      wkMenuDrop.setAttribute('role', 'menu');
      wkMenuDrop.innerHTML = `
        <button class="ex-menu-item${isDl ? ' ex-menu-item--active' : ''}" role="menuitem"
          data-action="${isDl ? 'mode-std' : 'mode-dl'}">
          ⚡ Deload-Woche${isDl ? ' ✓' : ''}
        </button>
        <button class="ex-menu-item${isVac ? ' ex-menu-item--active' : ''}" role="menuitem"
          data-action="${isVac ? 'mode-std' : 'mode-vac'}">
          🏖 Urlaubswoche${isVac ? ' ✓' : ''}
        </button>
        <hr style="border-color:var(--c-border);margin:0">
        <button class="ex-menu-item ex-menu-item--danger" role="menuitem"
          data-action="open-delete-week">
          ${ic.trash()} Woche löschen
        </button>`;
    } else {
      wkMenuDrop.className = '';
      wkMenuDrop.removeAttribute('role');
      wkMenuDrop.innerHTML = '';
    }
  }

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
    _exChartOpen.clear();
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
    totalSets = ad.exercises.reduce((s, ex) => s + ex.sets.length, 0);
    doneSets  = ad.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
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
    ${!_overviewMode && _activeDayIdx !== null && wk.days[_activeDayIdx] ? `
    <div class="day-menu-wrap">
      <button class="toolbar__btn" data-action="toggle-day-menu" data-di="${_activeDayIdx}"
        aria-label="${h(wk.days[_activeDayIdx].title)}-Menü öffnen"
        aria-expanded="${_dayMenuOpenKey === String(_activeDayIdx)}"
      >⋮</button>
      ${_dayMenuOpenKey === String(_activeDayIdx) ? `
      <div class="ex-menu-dropdown" role="menu">
        <button class="ex-menu-item" role="menuitem" data-action="day-rename" data-di="${_activeDayIdx}">✏️ Tag umbenennen</button>
        <button class="ex-menu-item" role="menuitem" data-action="day-duplicate" data-di="${_activeDayIdx}">📋 Tag duplizieren</button>
        <button class="ex-menu-item" role="menuitem" data-action="day-reset-sets" data-di="${_activeDayIdx}">🔄 Sätze zurücksetzen</button>
        <button class="ex-menu-item" role="menuitem" data-action="toggle-day-vacation" data-di="${_activeDayIdx}">🏖 Urlaubstag markieren</button>
        <hr style="border-color:var(--c-border);margin:0">
        <button class="ex-menu-item ex-menu-item--danger" role="menuitem" data-action="remove-day" data-di="${_activeDayIdx}"${wk.days.length <= 1 ? ' disabled' : ''}>🗑 Tag löschen</button>
      </div>` : ''}
    </div>` : ''}
    <button class="toolbar__btn toolbar__btn--accent" data-action="open-new-week"
      aria-label="Neue Trainingswoche erstellen">${ic.plus()}</button>
  </div>
  <div class="day-tab-pills${wk.days.length >= 4 ? ' is-scrollable' : ''}">
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
      const total  = day.exercises.reduce((s, ex) => s + ex.sets.length, 0);
      const done_s = day.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
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
  ${progressHtml}
</div>`;

  // ── Content: overview grid or single active panel ─────────────────────────
  let contentHtml = '';
  if (_overviewMode) {
    contentHtml = `<div class="day-overview-grid">
      ${wk.days.map((day, di) => {
        const done   = !!day.markedDone;
        const total  = day.exercises.reduce((s, ex) => s + ex.sets.length, 0);
        const done_s = day.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
        const vol    = day.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.status === 'success').reduce((ss, st) => ss + (st.weight ?? 0) * (st.reps ?? 0), 0), 0);
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

  _insertOpenCharts(state);

  requestAnimationFrame(() => {
    const tabsRow = container.querySelector('.day-tab-bar');
    if (tabsRow) {
      document.documentElement.style.setProperty('--tabs-h', `${tabsRow.offsetHeight}px`);
    }
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

function renderDayBody(wk, di, state) {
  const day      = wk.days[di];
  const locked   = !!day.locked;
  const done     = !!day.markedDone;
  const isVacDay = !!day.isVacation;

  let prevBanner = '';
  if (state.curIdx > 0) {
    const prevDay = state.weeks[state.curIdx - 1]?.days?.[di];
    if (prevDay) {
      let _pbSucc = 0, _pbFail = 0;
      prevDay.exercises.forEach(ex => ex.sets.forEach(s => {
        if (s.status === 'success') _pbSucc++;
        else if (s.status === 'fail') _pbFail++;
      }));
      const _pbTotal    = _pbSucc + _pbFail;
      const _pbScore    = _pbTotal > 0 ? Math.round(_pbSucc / _pbTotal * 100) : 0;
      const streak      = _calcStreak(state);
      const streakPart  = streak.cur >= 2 ? `&nbsp;&nbsp;🔥 ${streak.cur} Wochen` : '';
      prevBanner = `<div class="prev-banner" role="status">
        ${ic.barChart()}<span>Vorwoche: ${_pbScore}% · ${_pbSucc}/${_pbTotal} Sätze ✓${streakPart}</span>
      </div>`;
    }
  }

  const exHtml       = day.exercises.map((ex, ei) => renderExercise(wk, di, ei, state)).join('');
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
    ${isVacDay ? '<div class="day-vacation-banner">🏖 Urlaubstag — Streak läuft weiter</div>' : ''}
    ${prevBanner}
    ${noteBlock}
    ${warmupBlock}
    <div data-ex-list="${di}">${exHtml}</div>
    ${cooldownBlock}
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

    ${!locked ? `
    <datalist id="ex-list-${di}">
      ${_STANDARD_EXERCISES.map(n => `<option value="${h(n)}">`).join('')}
    </datalist>
    <div class="add-exercise-row">
      <input
        class="add-exercise-input"
        id="add-ex-input-${di}"
        type="text"
        list="ex-list-${di}"
        placeholder="Übung hinzufügen …"
        aria-label="Name der neuen Übung"
        maxlength="80"
        data-di="${di}"
        autocomplete="off"
      />
      <button
        class="btn btn--accent btn--sm"
        data-action="add-ex" data-di="${di}"
        aria-label="Übung hinzufügen"
      >${ic.plus()}${ic.srOnly('Hinzufügen')}</button>
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
            const avg = Math.round(scs.reduce((sum, s) => sum + s.reps, 0) / scs.length);
            _suggestionHtml = `<span class="target-suggestion">Vorschlag: ${avg} (Ø letzte Woche)</span><button type="button" class="btn-adopt-target" data-action="adopt-target-reps" data-di="${di}" data-ei="${ei}" data-value="${avg}">Übernehmen</button>`;
          }
          break;
        }
      }
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
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Steigerungsart">
        <span class="pause-row__label">Steigerung:</span>
        <div class="weight-step-opts">
          <button type="button"
            class="weight-step-btn${(ex.progressionType ?? 'weight') === 'weight' ? ' is-selected' : ''}"
            data-action="set-progression-type" data-di="${di}" data-ei="${ei}" data-val="weight"
            aria-pressed="${(ex.progressionType ?? 'weight') === 'weight'}"
          >Gewicht ↑</button>
          <button type="button"
            class="weight-step-btn${(ex.progressionType ?? 'weight') === 'reps' ? ' is-selected' : ''}"
            data-action="set-progression-type" data-di="${di}" data-ei="${ei}" data-val="reps"
            aria-pressed="${(ex.progressionType ?? 'weight') === 'reps'}"
          >Wdh ↑</button>
          <button type="button"
            class="weight-step-btn${(ex.progressionType ?? 'weight') === 'sets' ? ' is-selected' : ''}"
            data-action="set-progression-type" data-di="${di}" data-ei="${ei}" data-val="sets"
            aria-pressed="${(ex.progressionType ?? 'weight') === 'sets'}"
          >Satz ↑</button>
        </div>
      </div>` : ''}
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
        <!-- Tags (3.12) -->
        <div class="weight-plan-row exercise-tags-row" role="group" aria-label="Tags">
          <span class="pause-row__label">Tags:</span>
          <div class="tag-chips">
            ${(state.settings?.activeTags ?? ALL_TAGS_FLAT).map(tag => {
              const active = (ex.tags ?? []).includes(tag);
              return `<button
                type="button"
                class="tag-chip${active ? ' is-selected' : ''}"
                data-action="toggle-ex-tag" data-di="${di}" data-ei="${ei}" data-tag="${h(tag)}"
                aria-pressed="${active}"
              >${h(tag)}</button>`;
            }).join('')}
          </div>
          <div style="font-size:11px;color:var(--c-text-3);margin-top:2px">Nur aktivierte Tags erscheinen hier.</div>
        </div>
        ${!locked ? `
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
        </div>` : ''}
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

    <button
      class="btn-icon btn-icon--chart${_exChartOpen.has(`${di}-${ei}`) ? ' is-active' : ''}"
      data-action="toggle-ex-chart" data-di="${di}" data-ei="${ei}"
      aria-label="Fortschritts-Chart"
      aria-expanded="${_exChartOpen.has(`${di}-${ei}`)}"
    >📈</button>

    ${!locked ? (() => {
      const _pt     = ex.progressionType ?? 'weight';
      const _isReps = _pt === 'reps';
      const _isSets = _pt === 'sets';
      const _planVal = ex.nextWeekPlanConfirmed ? (ex.nextWeekPlan ?? 0) : (ex.nextWeekPlan || (_isReps || _isSets ? 1 : 0));
      const _btnLabel = _isReps
        ? `+${_planVal} Wdh${ex.nextWeekPlanConfirmed ? ' ✓' : ''}`
        : _isSets
          ? `+${_planVal} Satz${ex.nextWeekPlanConfirmed ? ' ✓' : ''}`
          : `+${ex.nextWeekPlan || 0}${ex.nextWeekPlanConfirmed ? ' ✓' : ''}`;
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
      <div class="ex-kg-picker" role="group" aria-label="Wdh-Steigerung nächste Woche">
        ${[0,1,2,3,4,5].map(v =>
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
        <button class="ex-menu-item ex-menu-item--danger" role="menuitem" data-action="remove-ex" data-di="${di}" data-ei="${ei}">🗑️ Übung löschen</button>
        ` : ''}
      </div>` : ''}
    </div>
  </div>

  ${subBannerHtml}
  ${subFormHtml}

  ${cfgRow}

  <div class="ex-chart-wrap" data-chart-di="${di}" data-chart-ei="${ei}"></div>

  <input
    class="exercise__note"
    type="text"
    value="${h(ex.note ?? '')}"
    placeholder="Notiz …"
    ${locked ? 'disabled' : ''}
    data-action="ex-note" data-di="${di}" data-ei="${ei}"
    aria-label="Notiz zu ${h(ex.name)}"
    maxlength="120"
  />

  <!-- 1RM estimator hint (3.7) -->
  ${(() => {
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
    const achieved  = ex.sets.filter(s => s.status === 'success').reduce((sum, s) => sum + (s.reps ?? 0), 0);
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
    ${actualPct > 0 ? `<div class="effort-pct" style="color:${actualPct > 100 ? 'var(--c-accent)' : 'var(--c-text-3)'}">${actualPct > 100 ? '↑ ' : ''}${actualPct}% Ziel</div>` : ''}`;
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
  const prevSet    = prevEx?.sets?.[si] ?? null;
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
  const metricCellFooter = hasAutofill
    ? `<div class="set-cell__footer">
        <span class="prev-hint" aria-hidden="true">${prevRepHint}</span>
        ${autofillBtn}
      </div>`
    : `<span class="prev-hint" aria-hidden="true">${prevRepHint}</span>`;

  let st = s.status;
  if (st !== 'pending' && st !== 'success' && st !== 'fail') {
    st = s.done ? 'success' : 'pending';
  }
  const doneClass = st === 'success' ? ' is-done' : st === 'fail' ? ' is-fail' : '';
  const stLabel   = st === 'success' ? 'erfolgreich' : st === 'fail' ? 'nicht geschafft' : 'offen';

  // PR indicator (3.1): trophy when this set's weight matches the current all-time PR
  const prs   = getState().prs ?? {};
  const exPR  = prs[ex.name];
  const isPR  = st === 'success' && exPR && (s.weight ?? 0) > 0 && (
    s.weight > exPR.maxWeight ||
    (s.weight === exPR.maxWeight && (s.reps ?? 0) > (exPR.maxRepsAtMaxWeight ?? 0))
  );
  const effortScore   = (st === 'success' && ex.targetReps) ? Math.round((s.reps ?? 0) / ex.targetReps * 100) : null;
  const isEffortGoal  = effortScore !== null && effortScore >= 100;
  const doneIcon = st === 'success' ? ic.check()
               : st === 'fail'    ? ic.xMark()
               : '';

  // Prev-week weight hint with directional arrow (computed before template literal)
  let _prevWeightHint = '<span class="prev-hint" aria-hidden="true"></span>';
  if (prevSet) {
    const _curW = s.weight ?? 0;
    let _arr = '';
    if (_curW > 0) {
      if      (_curW > (prevSet.weight ?? 0)) _arr = '<span class="w-arrow w-arrow--up">↑</span> ';
      else if (_curW < (prevSet.weight ?? 0)) _arr = '<span class="w-arrow w-arrow--dn">↓</span> ';
      else                                    _arr = '<span class="w-arrow w-arrow--eq">→</span> ';
    }
    const _pw = prevSet.weight != null ? prevSet.weight : '–';
    _prevWeightHint = `<span class="prev-hint" aria-hidden="true">${_arr}${_pw}kg</span>`;
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
    ${isPR ? `<span class="pr-badge" aria-label="Bestleistung! ${s.weight} kg">${ic.trophy()} ${s.weight} kg</span>` : ''}
    ${isEffortGoal ? `<span class="pr-badge pr-badge--goal" aria-label="${effortScore}% Zielerfüllung">✓ ${effortScore}% Ziel</span>` : ''}
    ${_prevWeightHint}
    ${ex.showPlates && dispW > 0 ? (() => { const pl = calcPlates(dispW); return pl ? `<span class="plate-hint" aria-hidden="true" title="Scheiben je Seite">▪ ${pl}</span>` : ''; })() : ''}
  </div>

  <div class="set-cell">
    <input class="num-input" type="number" inputmode="${repMode}"
      min="0" step="${repStep}" placeholder="${ex.targetReps ?? ''}" value="${s.reps}"
      ${locked ? 'disabled' : ''}
      data-action="set-reps" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="${repAria}"
    />
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
    autofocus
  />
</div>` : ''}`;
}

// ─── Body tab ────────────────────────────────────────────────────────────────
function renderBodyTab(state) {
  const container = document.getElementById('body-tab-content');
  if (!container) return;
  const wk = state.weeks[state.curIdx];
  const bd = wk?.bodyData ?? {};
  const heightCm     = state.settings?.heightCm;
  const targetWeight = state.settings?.targetWeight;
  const bmi = heightCm && bd.weight
    ? (bd.weight / Math.pow(heightCm / 100, 2)).toFixed(1)
    : null;
  const bmiLabel = bmi
    ? (+bmi < 18.5 ? 'Untergewicht' : +bmi < 25 ? 'Normalgewicht' : +bmi < 30 ? 'Übergewicht' : 'Adipositas')
    : null;
  const weightDiff = targetWeight && bd.weight
    ? (targetWeight - bd.weight)
    : null;

  const histRows = [...state.weeks]
    .slice().reverse().slice(0, 8)
    .filter(w => w.bodyData && (w.bodyData.weight || w.bodyData.energy || w.bodyData.sleep))
    .map(w => {
      const b = w.bodyData;
      return `
      <div style="background:var(--c-surface);border:1px solid var(--c-border);
        border-radius:var(--r-md);padding:var(--sp-2) var(--sp-4);margin-bottom:var(--sp-2);
        display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:13px;font-weight:600">${wkLabel(w.startDate)}</div>
          <div style="font-size:11px;color:var(--c-text-3)">${wkRange(w.startDate)}</div>
        </div>
        <div style="display:flex;gap:16px;text-align:center">
          ${b.weight ? `<div><div style="font-family:var(--font-display);font-size:18px">${b.weight}</div><div style="font-size:9px;color:var(--c-text-3)">KG</div></div>` : ''}
          ${b.sleep  ? `<div><div style="font-family:var(--font-display);font-size:18px">${b.sleep}</div><div style="font-size:9px;color:var(--c-text-3)">STD</div></div>` : ''}
          ${b.energy ? `<div><div style="font-family:var(--font-display);font-size:18px;color:var(--c-accent)">${b.energy}/5</div><div style="font-size:9px;color:var(--c-text-3)">ENERGIE</div></div>` : ''}
        </div>
      </div>`;
    }).join('');

  // Body correlation insight (2.2): only if ≥4 weeks have sleep data
  const weeksWithSleep = state.weeks.filter(w => w.bodyData?.sleep);
  let bodyInsightHtml = '';
  if (weeksWithSleep.length >= 4) {
    const avgSleepHigh = weeksWithSleep
      .filter(w => (w.bodyData.sleep ?? 0) >= 7.5)
      .map(w => _trueVol(w));
    const avgSleepLow  = weeksWithSleep
      .filter(w => (w.bodyData.sleep ?? 0) < 7.5)
      .map(w => _trueVol(w));
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
      <div style="margin-bottom:var(--sp-3)">
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

  const scale = (field, label) => {
    const cur = bd[field];
    return `
    <div class="body-field" style="margin-bottom:var(--sp-3)">
      <label>${label} (1–5)</label>
      <div class="scale-row" role="group" aria-label="${label}">
        ${[1,2,3,4,5].map(n => {
          const isSel = cur === n;
          const mod   = n <= 2 ? ' is-low' : n === 3 ? ' is-mid' : '';
          return `<button
            class="scale-btn${isSel ? ' is-selected' + mod : ''}"
            data-action="body-scale" data-field="${field}" data-val="${n}"
            aria-pressed="${isSel}"
            aria-label="${label}: ${n}"
          >${n}</button>`;
        }).join('')}
      </div>
    </div>`;
  };

  container.innerHTML = `
  <div class="body-section">
    <button class="body-section__header" aria-expanded="true"
      onclick="this.setAttribute('aria-expanded',
        this.getAttribute('aria-expanded')==='true'?'false':'true');
        this.nextElementSibling.classList.toggle('is-open')">
      <span class="body-section__title">${wk ? wkLabel(wk.startDate) : '–'}</span>
      <span aria-hidden="true">${ic.chevronDown()}</span>
    </button>
    <div class="body-section__body is-open">
      <div class="body-section__body-inner">
        <div class="body-grid">
          <div class="body-field">
            <label for="body-weight">Körpergewicht (kg)</label>
            <input id="body-weight" class="body-input" type="number" step="0.1"
              value="${bd.weight ?? ''}" placeholder="78.5"
              data-action="body-field" data-field="weight"
              aria-label="Körpergewicht in kg"
            />
          </div>
        </div>
        ${state.settings?.showBmi && bmi ? `
        <div class="bmi-badge" style="margin-bottom:var(--sp-3)">
          BMI ${bmi} <span>${bmiLabel}</span>
        </div>` : ''}
        <div class="body-grid">
          <div class="body-field">
            <label for="body-sleep">Schlaf (Std)</label>
            <input id="body-sleep" class="body-input" type="number" step="0.5"
              value="${bd.sleep ?? ''}" placeholder="7.5"
              data-action="body-field" data-field="sleep"
              aria-label="Schlafdauer in Stunden"
            />
          </div>
          <div class="body-field">
            <label for="body-target-weight">Zielgewicht (kg)</label>
            <input id="body-target-weight" class="body-input" type="number" step="0.1"
              value="${targetWeight ?? ''}" placeholder="80.0"
              data-action="set-target-weight"
              aria-label="Zielgewicht in kg"
            />
            ${weightDiff !== null ? `
            <div class="bmi-badge" style="color:${Math.abs(weightDiff) < 0.1 ? 'var(--c-ok)' : 'var(--c-text-3)'}">
              ${Math.abs(weightDiff) < 0.1 ? '✓ Ziel erreicht!' : weightDiff > 0 ? `noch ${weightDiff.toFixed(1)} kg` : `${Math.abs(weightDiff).toFixed(1)} kg drüber`}
            </div>` : ''}
          </div>
        </div>
        ${scale('energy',   'Energielevel')}
        ${scale('wellbeing','Wohlbefinden')}
        <div class="body-field">
          <label for="body-note">Notiz</label>
          <input id="body-note" class="body-input" type="text"
            value="${h(bd.note ?? '')}" placeholder="z. B. leichte Verspannung …"
            data-action="body-field" data-field="note"
            aria-label="Notiz zur Woche"
          />
        </div>
      </div>
    </div>
  </div>
  ${bodyInsightHtml}
  ${!histRows && !bd.weight && !bd.sleep ? `
  <p class="empty-state__hint" style="margin-top:var(--sp-3)">Trage dein Körpergewicht ein um langfristige Entwicklungen zu verfolgen.</p>` : ''}
  ${histRows ? `
  <div style="font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--c-text-3);margin-bottom:8px">Verlauf</div>
  ${histRows}` : ''}`;
}

// ─── Tatsächliches Volumen helper (only success sets) ────────────────────────
function _trueVol(week) {
  return week.days.reduce((s, d) =>
    s + d.exercises.reduce((ss, ex) =>
      ss + ex.sets.filter(st => st.status === 'success').reduce((sss, st) =>
        sss + (st.weight ?? 0) * (st.reps ?? 0), 0), 0), 0);
}

// ─── Weekly Success Score: success / (success + fail), pending excluded ───────
function _weekSuccessScore(week) {
  let succ = 0, fail = 0;
  for (const d of week.days)
    for (const ex of d.exercises)
      for (const s of ex.sets) {
        if (s.status === 'success') succ++;
        else if (s.status === 'fail') fail++;
      }
  const total = succ + fail;
  return { succ, fail, total, pct: total > 0 ? Math.round(succ / total * 100) : 0 };
}


// ─── Analysis tab ─────────────────────────────────────────────────────────────

const MOVEMENT_MAP = {
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

function _avgRepsLast4(exName, allWeeks) {
  const sorted = [...allWeeks]
    .filter(w => (w.mode ?? 'standard') !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const repsSum = [];
  for (const wk of sorted.slice(-4)) {
    for (const day of wk.days) {
      const ex = day.exercises.find(e => e.name === exName);
      if (!ex) continue;
      const ok = ex.sets.filter(s => s.status === 'success' && (s.reps ?? 0) > 0).map(s => s.reps);
      if (ok.length) repsSum.push(Math.round(ok.reduce((a, b) => a + b) / ok.length));
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

function _renderRadarSVG(catPct) {
  const AXES = ['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core'];
  const cx = 100, cy = 110, r = 70;
  const ang = i => -Math.PI / 2 + i * (2 * Math.PI / AXES.length);
  const pt  = (i, f) => [
    +(cx + f * r * Math.cos(ang(i))).toFixed(1),
    +(cy + f * r * Math.sin(ang(i))).toFixed(1),
  ];
  const rings = [1, 0.75, 0.5, 0.25].map(f => {
    const pts = AXES.map((_, i) => pt(i, f).join(',')).join(' ');
    return `<polygon points="${pts}" fill="none" stroke="#2E2E35" stroke-width="1"/>`;
  }).join('');
  const axisLines = AXES.map((_, i) => {
    const [x2, y2] = pt(i, 1);
    return `<line x1="${cx}" y1="${cy}" x2="${x2}" y2="${y2}" stroke="#2E2E35" stroke-width="1"/>`;
  }).join('');
  const dataPts = AXES.map((nm, i) => pt(i, Math.min((catPct[nm] ?? 0) / 100, 1)).join(',')).join(' ');
  const polygon = `<polygon points="${dataPts}" fill="rgba(200,255,0,.18)" stroke="#C8FF00" stroke-width="2" stroke-linejoin="round"/>`;
  const dots = AXES.map((nm, i) => {
    if (!(catPct[nm] ?? 0)) return '';
    const [dx, dy] = pt(i, Math.min((catPct[nm] ?? 0) / 100, 1));
    return `<circle cx="${dx}" cy="${dy}" r="3" fill="#C8FF00"/>`;
  }).join('');
  const labels = AXES.map((nm, i) => {
    const [lx, ly] = pt(i, 1.32);
    const anchor = lx < cx - 5 ? 'end' : lx > cx + 5 ? 'start' : 'middle';
    return `<text x="${lx}" y="${ly}" text-anchor="${anchor}" dominant-baseline="middle" font-size="10" fill="#AAA" font-family="system-ui,sans-serif">${nm}</text>
      <text x="${lx}" y="${ly + 13}" text-anchor="${anchor}" dominant-baseline="middle" font-size="9" fill="#C8FF00" font-family="system-ui,sans-serif">${catPct[nm] ?? 0}%</text>`;
  }).join('');
  return `<svg viewBox="0 0 200 225" width="100%" style="max-width:220px;display:block;margin:0 auto" role="img" aria-label="Radar-Diagramm Bewegungsmuster">${rings}${axisLines}${polygon}${dots}${labels}</svg>`;
}

function _renderMovementPattern(state) {
  const RADAR_CATS = ['Push', 'Pull', 'Squat', 'Hinge', 'Carry', 'Core'];
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
        const baseName = ex.substituteFor ?? ex.name;
        const cat = MOVEMENT_MAP[baseName] ?? 'Sonstige';
        const n = ex.sets.filter(s => s.status === 'success').length;
        if (!n) continue;
        catSets[cat] = (catSets[cat] ?? 0) + n;
        totalSets += n;
      }
    }
  }
  if (!totalSets) return '';
  const catPct = {};
  for (const c of RADAR_CATS) catPct[c] = totalSets > 0 ? Math.round((catSets[c] ?? 0) / totalSets * 100) : 0;
  const catsWithData = RADAR_CATS.filter(c => (catSets[c] ?? 0) > 0);

  const warnings = [];
  const pp = [catPct['Push'], catPct['Pull']];
  const sh = [catPct['Squat'], catPct['Hinge']];
  if (pp[0] > 0 && pp[1] > 0) {
    if (pp[0] > pp[1] * 2) warnings.push('Push überwiegt Pull — Ungleichgewicht möglich.');
    else if (pp[1] > pp[0] * 2) warnings.push('Pull überwiegt Push — Ungleichgewicht möglich.');
  }
  if (sh[0] > 0 && sh[1] > 0) {
    if (sh[0] > sh[1] * 2) warnings.push('Squat überwiegt Hinge — Ungleichgewicht möglich.');
    else if (sh[1] > sh[0] * 2) warnings.push('Hinge überwiegt Squat — Ungleichgewicht möglich.');
  }
  const warningsHtml = warnings.map(w => `<div class="movement-warning">⚠ ${h(w)}</div>`).join('');

  let chartHtml;
  if (catsWithData.length >= 4) {
    chartHtml = _renderRadarSVG(catPct);
  } else {
    const maxPct = Math.max(...RADAR_CATS.map(c => catPct[c]), 1);
    chartHtml = RADAR_CATS.map(cat => {
      const pct = catPct[cat];
      return `<div class="mg-bar-row">
        <span class="mg-bar-label">${cat}</span>
        <div class="mg-bar-wrap"><div class="mg-bar" style="width:${pct ? Math.round(pct / maxPct * 100) : 0}%"></div></div>
        <span class="mg-bar-val">${pct ? pct + '%' : '—'}</span>
      </div>`;
    }).join('');
  }

  return `<div class="chart-card">
    <div class="chart-card__title">Bewegungsmuster</div>
    <p style="font-size:11px;color:var(--c-text-3);margin-bottom:var(--sp-3)">Letzte 4 Wochen (ohne Deload)</p>
    ${chartHtml}
    ${warningsHtml}
  </div>`;
}

function _renderAnalysis1RM(name, state) {
  const allSets = state.weeks
    .filter(w => w.mode !== 'deload')
    .flatMap(w => w.days.flatMap(d =>
      d.exercises
        .filter(ex => ex.name === name || ex.substituteFor === name)
        .flatMap(ex => {
          if (ex.metric && ex.metric !== 'kg') return [];
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

function renderAnalysisTab(state) {
  const container = document.getElementById('analysis-tab-content');
  if (!container) return;

  const hasTrainingData = state.weeks.some(w =>
    w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success' || s.status === 'fail')))
  );
  if (!hasTrainingData) {
    container.innerHTML = `
    <div class="empty-state">
      <div class="empty-state__icon">📊</div>
      <p class="empty-state__text">Noch keine Daten vorhanden.<br>Schließe deine erste Trainingswoche ab um hier Auswertungen zu sehen.</p>
    </div>`;
    return;
  }

  const streak     = _calcStreak(state);
  const sorted     = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const _scoreList = state.weeks.map(w => _weekSuccessScore(w)).filter(s => s.total > 0).map(s => s.pct);
  const avgScore   = _scoreList.length > 0 ? Math.round(_scoreList.reduce((a, b) => a + b, 0) / _scoreList.length) : null;
  const allExNames = [...new Set(
    state.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name)))
  )].sort();
  const insights = state.insights ?? [];

  // ── 1. Wochenrückblick-Auswahl ─────────────────────────────────────────────
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

  // ── 3. Bestleistungen ──────────────────────────────────────────────────────
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

  // ── Insights ────────────────────────────────────────────────────────────────
  const _typeColor = { progression:'var(--c-accent)', stagnation:'var(--c-warn)', recovery:'var(--c-blue)', balance:'var(--c-deload)', goal:'var(--c-accent)', consistency:'var(--c-ok)', warning:'var(--c-danger)', motivation:'var(--c-accent)' };
  const insightHtml = _showInsights && insights.length > 0
    ? insights.map(ins => `
      <div class="insight-card insight-card--${h(ins.type ?? 'info')}">
        <div class="insight-card__hdr">
          <span class="insight-card__badge" style="color:${_typeColor[ins.type] ?? 'var(--c-accent)'}">${h(ins.title)}</span>
          <span class="insight-card__id">${h(ins.id)}</span>
        </div>
        <p class="insight-card__msg">${h(ins.message)}</p>
        ${ins.recommendation ? `<p class="insight-card__rec">${h(ins.recommendation)}</p>` : ''}
      </div>`).join('')
    : '';

  container.innerHTML = `
  ${insightHtml}

  ${weekReviewHtml}

  <div class="chart-card">
    <div class="chart-card__title">Übungsfortschritt</div>
    <select class="chart-select" id="chart-ex-select" aria-label="Übung für Progressionskurve wählen">
      ${allExNames.map(n => `<option value="${h(n)}">${h(n)}</option>`).join('')}
    </select>
    <div class="chart-wrap" id="chart-ex-wrap"></div>
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
      <div class="streak-card"><div class="streak-num">${streak.cur}</div><div class="streak-lbl">Streak</div></div>
      <div class="streak-card"><div class="streak-num">${streak.best}</div><div class="streak-lbl">Best</div></div>
      <div class="streak-card"><div class="streak-num">${state.weeks.length}</div><div class="streak-lbl">Wochen</div></div>
      ${avgScore !== null ? `<div class="streak-card"><div class="streak-num" style="color:${avgScore>=90?'var(--c-ok)':avgScore>=70?'var(--c-warn)':'var(--c-danger)'}">${avgScore}%</div><div class="streak-lbl">Ø Erfolg</div></div>` : ''}
      ${avgMin != null ? `<div class="streak-card"><div class="streak-num">${fmtMin(avgMin)}</div><div class="streak-lbl">Ø Session</div></div>` : ''}
      ${totalMin != null ? `<div class="streak-card"><div class="streak-num">${fmtMin(totalMin)}</div><div class="streak-lbl">Gesamt</div></div>` : ''}
      ${state.weeks.length >= 2 ? `
      <button class="streak-card insight-toggle${_showInsights ? ' is-active' : ''}${insights.length > 0 ? ' has-insights' : ''}"
        data-action="toggle-insights"
        aria-pressed="${_showInsights}"
        aria-label="Coach-Insights anzeigen"
      >${ic.lightbulb()}<div class="streak-lbl">Coach${insights.length > 0 ? ` (${insights.length})` : ''}</div></button>` : ''}
    </div>`;
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
  const plateaus = detectPlateaus(state.weeks, state.favoriteExercises ?? []);
  const review = buildWeekReview(wk, state.weeks, state.favoriteExercises ?? [], plateaus);
  wrap.innerHTML = renderWeekReviewHtml(review);
}

function _calcStreak(state) {
  const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let cur = 0, best = 0, tmp = 0;
  sorted.forEach(w => {
    const active = w.days.some(d => !!d.markedDone) || w.days.some(d => !!d.isVacation) || w.mode === 'vacation';
    if (active) { tmp++; best = Math.max(best, tmp); }
    else tmp = 0;
  });
  for (let i = sorted.length - 1; i >= 0; i--) {
    const w = sorted[i];
    const active = w.days.some(d => !!d.markedDone) || w.days.some(d => !!d.isVacation) || w.mode === 'vacation';
    if (active) cur++;
    else break;
  }
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
    const isVac    = wk.mode === 'vacation';
    const done     = isVac || (score.total > 0 && score.pct >= 50);
    const ss       = score.total > 0 ? score.pct : 0;
    const wkNum = (() => {
      const d = new Date(wk.startDate);
      const jan1 = new Date(d.getFullYear(), 0, 1);
      return Math.ceil(((d - jan1) / 86400000 + jan1.getDay() + 1) / 7);
    })();
    return { cx, done, isVac, ss, wkNum, startDate: wk.startDate };
  });
  const lines = dots.slice(0, -1).map((d, i) => {
    const next  = dots[i + 1];
    const color = d.done && next.done ? '#C8FF00' : '#2E2E35';
    const dash  = d.done && next.done ? '' : 'stroke-dasharray="4 3"';
    return `<line x1="${d.cx}" y1="${cy}" x2="${next.cx}" y2="${cy}" stroke="${color}" stroke-width="2" ${dash}/>`;
  });
  const circles = dots.map(d => {
    const fill   = d.isVac ? '#D97706' : d.done ? '#C8FF00' : '#1A1A2E';
    const stroke = d.isVac ? '#D97706' : d.done ? '#C8FF00' : '#2E2E35';
    const tip    = d.isVac ? `KW ${d.wkNum} · 🏖 Urlaub` : `KW ${d.wkNum} · ${d.ss}% Erfolg`;
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

/** Baut offene Fortschritts-Charts nach jedem re-render der Day-Liste neu auf. */
function _insertOpenCharts(state) {
  if (_exChartOpen.size === 0) return;
  const wk = state.weeks[state.curIdx];
  if (!wk) return;
  const calcWeeks = [...state.weeks]
    .filter(w => w.mode !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-16);
  _exChartOpen.forEach(key => {
    const [di, ei] = key.split('-').map(Number);
    const ex = wk.days[di]?.exercises[ei];
    if (!ex) return;
    const wrap = document.querySelector(`[data-chart-di="${di}"][data-chart-ei="${ei}"]`);
    if (!wrap) return;
    const svg = renderProgressChart(ex.name, calcWeeks, { compact: true });
    if (svg) {
      wrap.innerHTML = svg;
      _attachChartTooltips(wrap);
    }
  });
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

function _updateExChart(state) {
  const sel  = document.getElementById('chart-ex-select');
  const wrap = document.getElementById('chart-ex-wrap');
  if (!sel || !wrap) return;
  const name = sel.value;
  const calcWeeks = [...state.weeks]
    .filter(w => w.mode !== 'deload')
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(-16);
  const svg = renderProgressChart(name, calcWeeks, { compact: false });
  if (svg) {
    wrap.innerHTML = svg;
    _attachChartTooltips(wrap);
  } else {
    wrap.innerHTML = '<p class="empty-state__hint">Wähle eine Übung und trainiere mindestens 2 Wochen um den Verlauf zu sehen.</p>';
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
      const hasRest  = (wk.restDays ?? []).length > 0;
      const cell     = document.createElement('div');
      // Rest day = dark gray, training days use accent intensity (3.3)
      cell.className = hasRest && done === 0
        ? 'hm-cell hm-cell--rest'
        : 'hm-cell' + (done === 0 ? '' : ` hm-cell--${Math.min(done, 3)}`);
      const label = hasRest ? `${wkLabel(wk.startDate)}: Ruhetag` : `${wkLabel(wk.startDate)}: ${done}/${wk.days.length} Tage`;
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
  return Math.floor((Date.now() - ts) / 86_400_000);
}

function _backupStatusHtml(settings) {
  const days = _backupAgeInDays(settings);
  if (days === null) return '<span class="bk-status bk-status--warn">⚠️ Noch nie gesichert</span>';
  if (days === 0)    return '<span class="bk-status bk-status--ok">✓ Heute gesichert</span>';
  if (days <= 14)    return `<span class="bk-status bk-status--ok">✓ Vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}</span>`;
  return `<span class="bk-status bk-status--warn">⚠️ Vor ${days} Tagen — zu alt</span>`;
}

function _shouldShowBackupReminder(state) {
  const s = state.settings ?? {};
  if (s.backupReminderSnoozed && (Date.now() - s.backupReminderSnoozed) < 7 * 86_400_000) return false;
  const days = _backupAgeInDays(s);
  if (days === null) return state.weeks.length >= 2;
  return days > 14;
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

  container.innerHTML = `
  <div class="settings-section">
    ${tog('swipe', 'Swipe-Navigation', 'Wischen zum Wochenwechsel')}
    ${tog('drag',  'Drag & Drop',      'Übungen per Griff verschieben')}
    ${tog('vibrationEnabled', 'Vibration nach Pause', 'Funktioniert nur auf Android — iOS unterstützt Vibration in PWAs technisch nicht.')}
    ${tog('rpeEnabled', 'RPE anzeigen', 'Rate of Perceived Exertion — Anstrengungsgrad pro Satz')}
  </div>

  <!-- Körper & BMI -->
  <div class="settings-section">
    <div class="settings-section__title">Körper</div>
    ${tog('showBmi', 'BMI anzeigen', 'Zeigt BMI im Körper-Tab unterhalb des Gewichts')}
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-1)">
      <div class="settings-row__label">Körpergröße (cm)</div>
      <div class="settings-row__desc">Wird für die BMI-Berechnung benötigt</div>
      <input class="body-input" type="number" step="1" min="100" max="250"
        value="${s.heightCm ?? ''}" placeholder="178"
        data-action="set-height"
        style="margin-top:var(--sp-1);width:120px"
        aria-label="Körpergröße in cm"
      />
    </div>
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-1)">
      <div class="settings-row__label">Stangengewicht Langhantel (kg)</div>
      <input class="body-input" type="number" step="0.5" min="5" max="50"
        value="${s.barbellWeight ?? 20}" placeholder="20"
        data-action="set-barbell-weight"
        style="margin-top:var(--sp-1);width:120px"
        aria-label="Stangengewicht in kg"
      />
    </div>
    <div class="settings-row" style="flex-direction:column;align-items:flex-start;gap:var(--sp-2)">
      <div>
        <div class="settings-row__label">Kleinstmögliche Steigerung</div>
        <div class="settings-row__desc">Rundung für KI-Gewichtsempfehlungen</div>
      </div>
      <div class="weight-step-opts">
        ${[1.25, 2.5].map(ps => `
          <button type="button"
            class="weight-step-btn${(s.plateStep ?? 2.5) === ps ? ' is-selected' : ''}"
            data-action="set-plate-step" data-step="${ps}"
            aria-pressed="${(s.plateStep ?? 2.5) === ps}"
          >${String(ps).replace('.', ',')} kg</button>`).join('')}
      </div>
    </div>
  </div>

  <!-- Deload -->
  <div class="settings-section">
    <div class="settings-section__title">Deload</div>
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

  <!-- Wochen-Management -->
  <div class="settings-section">
    <div class="settings-section__title">Wochen-Management</div>
    <div class="settings-row settings-row--clickable" data-action="copy-prev">
      <div>
        <div class="settings-row__label">${ic.copy()} Vorwoche übernehmen</div>
        <div class="settings-row__desc">Aktuelle Woche mit der Vorwoche überschreiben</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <div class="settings-row settings-row--clickable" data-action="save-week-as-template">
      <div>
        <div class="settings-row__label">${ic.save()} Als Template speichern</div>
        <div class="settings-row__desc">Aktuelle Woche als Standard-Vorlage sichern</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <div class="settings-row settings-row--clickable" data-action="open-export">
      <div>
        <div class="settings-row__label">${ic.download()} Woche exportieren (CSV)</div>
        <div class="settings-row__desc">Trainingsdaten herunterladen</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <div class="settings-row settings-row--clickable" data-action="open-delete-week"
      style="color:var(--c-danger)">
      <div>
        <div class="settings-row__label" style="color:var(--c-danger)">${ic.trash()} Aktuelle Woche löschen</div>
        <div class="settings-row__desc">Wird unwiderruflich entfernt</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
  </div>

  <!-- Template -->
  <div class="settings-section">
    <div class="settings-section__title">Vorlagen (3.4)</div>
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

  <!-- Favoriten -->
  <div class="settings-section">
    <div class="settings-section__title">⭐ Meine Favoriten</div>
    <div class="settings-row__desc" style="padding:0 0 var(--sp-2)">Bis zu 5 Übungen — Empfehlungen fokussieren sich darauf.</div>
    ${(() => {
      const favs = state.favoriteExercises ?? [];
      if (!favs.length) return '<p class="settings-row__desc" style="padding:var(--sp-2) 0">Noch keine Favoriten — tippe ☆ bei einer Übung.</p>';
      return favs.map(name => `
      <div class="settings-row" style="justify-content:space-between">
        <span class="settings-row__label">⭐ ${h(name)}</span>
        <button class="btn btn--ghost btn--sm" data-action="remove-fav" data-name="${h(name)}"
          aria-label="Favorit '${h(name)}' entfernen">✕</button>
      </div>`).join('');
    })()}
  </div>

  <!-- Tags verwalten (4.1) -->
  <div class="settings-section">
    <div class="settings-section__title">Tags verwalten</div>
    <div class="settings-row__desc" style="padding:0 0 8px">Nur aktivierte Tags erscheinen bei der Übungs-Einstellung.</div>
    ${Object.entries(AVAILABLE_TAGS).map(([cat, tags]) => {
      const catLabel = { muskelgruppen:'Muskelgruppen', trainingsziel:'Trainingsziel', uebungsstil:'Übungsstil', bewegungsmuster:'Bewegungsmuster', kontext:'Kontext' }[cat] ?? cat;
      const active   = s.activeTags ?? ALL_TAGS_FLAT;
      return `
      <details class="deload-details" style="margin-bottom:4px">
        <summary class="deload-details__summary" style="padding-left:var(--sp-4)">${catLabel}</summary>
        <div class="deload-details__body" style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 0">
          ${tags.map(tag => `
          <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:12px;padding-left:var(--sp-4)">
            <input type="checkbox"
              data-action="toggle-active-tag"
              data-tag="${h(tag)}"
              ${active.includes(tag) ? 'checked' : ''}
            />
            ${h(tag)}
          </label>`).join('')}
        </div>
      </details>`;
    }).join('')}
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

  <div class="settings-section">
    <div class="settings-row">
      <div><div class="settings-row__label">Version</div><div class="settings-row__desc">TRAIN v9.0</div></div>
    </div>
    <div class="settings-row">
      <div>
        <div class="settings-row__label">Zuletzt gespeichert</div>
        <div class="settings-row__desc">${state.meta.savedAt ? new Date(state.meta.savedAt).toLocaleString('de-DE') : '–'}</div>
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

    // ── Overview mode ─────────────────────────────────────────────────────
    case 'toggle-overview':
      _overviewMode = !_overviewMode;
      scheduleRender();
      break;

    // ── Analysis insights toggle (3.2) ─────────────────────────────────────
    case 'toggle-insights':
      if (!_insightsTooltipShown) {
        _insightsTooltipShown = true;
        showToast('Zeigt automatisch erkannte Muster in deinen Trainingsdaten', 'info', 4000);
        _showInsights = true;
      } else {
        _showInsights = !_showInsights;
      }
      if (_showInsights && getState().insights.some(i => i.id === 'S-06')) {
        _maybeShowTip('tip-10', 'TRAIN hat erkannt dass du seit 3 Wochen keine Steigerung mehr machst. Scrolle nach unten für konkrete Strategien.');
      }
      scheduleRender();
      break;

    // ── Body correlation insight toggle (2.2) ──────────────────────────────
    case 'toggle-body-insights':
      _showBodyInsights = !_showBodyInsights;
      scheduleRender();
      break;

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
      renderWeekHeader(getState());
      _positionFloating();
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
      renderWeekHeader(getState());
      _showVacationWeekPopup();
      break;
    }

    case 'toggle-day-vacation': {
      const _di  = +di;
      const _day = getState().weeks[getState().curIdx]?.days[_di];
      if (_day?.isVacation) {
        dispatch(A.DAY_TOGGLE_VACATION, { di: _di });
      } else {
        _maybeShowTip('tip-09', 'Urlaubstage unterbrechen deinen Streak nicht. Markiere sie damit TRAIN deine Analyse korrekt berechnet.');
        _dayMenuOpenKey = null;
        scheduleRender();
        _showVacationPlanModal(_di);
      }
      break;
    }

    case 'open-new-week': {
      const _st = getState();
      const _sortedWks = [..._st.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const _lastWk = _sortedWks[_sortedWks.length - 1];
      const _hasCompleted = _lastWk?.days.some(d => d.markedDone);
      if (_hasCompleted) {
        const _plateaus = detectPlateaus(_st.weeks, _st.favoriteExercises ?? []);
        const _review = buildWeekReview(_lastWk, _st.weeks, _st.favoriteExercises ?? [], _plateaus);
        showWeekReviewModal(_review, () => { _prepNewWeekModal(); openModal('modal-new-week'); });
      } else {
        _prepNewWeekModal();
        openModal('modal-new-week');
      }
      break;
    }

    case 'copy-prev':
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

    // ── KI-Gewichtsempfehlung übernehmen (Modal-Chip) ─────────────────────
    case 'toggle-weight-rec': {
      const recName  = el.dataset.name;
      const recDelta = parseFloat(el.dataset.delta ?? '0');
      const _recSt   = getState();
      const _recWk   = _recSt.weeks[_recSt.curIdx];
      if (!_recWk) break;
      (_recWk.days ?? []).forEach((day, _rdi) => {
        (day.exercises ?? []).forEach((ex, _rei) => {
          if (ex.name === recName) {
            dispatch(A.EX_SET_NEXT_WEEK_PLAN, { di: _rdi, ei: _rei, value: recDelta });
          }
        });
      });
      el.classList.add('is-adopted');
      el.setAttribute('aria-pressed', 'true');
      break;
    }

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

    case 'remove-day': {
      const _di = +el.dataset.di;
      const _day = getState().weeks[getState().curIdx]?.days[_di];
      if (!confirm(`"${_day?.title ?? 'Tag'}" löschen? Alle Einträge dieses Tags werden entfernt.`)) break;
      if (_activeDayIdx === _di) _activeDayIdx = null;
      else if (_activeDayIdx > _di) _activeDayIdx--;
      _dayMenuOpenKey = null;
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

    case 'add-ex': {
      const inp  = document.getElementById(`add-ex-input-${di}`);
      const name = inp?.value.trim();
      if (!name) { inp?.focus(); break; }
      dispatch(A.EX_ADD, { di: +di, name });
      if (inp) inp.value = '';
      showToast(`"${name}" hinzugefügt`, 'ok');
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

    case 'toggle-ex-chart': {
      const chartKey = `${di}-${ei}`;
      const wrap = document.querySelector(`[data-chart-di="${di}"][data-chart-ei="${ei}"]`);
      if (_exChartOpen.has(chartKey)) {
        _exChartOpen.delete(chartKey);
        el.classList.remove('is-active');
        el.setAttribute('aria-expanded', 'false');
        if (wrap) wrap.innerHTML = '';
      } else {
        _exChartOpen.add(chartKey);
        el.classList.add('is-active');
        el.setAttribute('aria-expanded', 'true');
        if (wrap) {
          const wk = getState().weeks[getState().curIdx];
          const calcWeeks = [...getState().weeks]
            .filter(w => w.mode !== 'deload')
            .sort((a, b) => a.startDate.localeCompare(b.startDate))
            .slice(-16);
          const exName = wk?.days[+di]?.exercises[+ei]?.name;
          const svg = exName ? renderProgressChart(exName, calcWeeks, { compact: true }) : null;
          if (svg) { wrap.innerHTML = svg; _attachChartTooltips(wrap); }
          else wrap.innerHTML = '<p style="font-size:12px;color:var(--c-text-3);padding:8px 0">Noch zu wenig Daten — ab 2 Trainingswochen sichtbar.</p>';
        }
      }
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

    case 'remove-fav': {
      dispatch(A.TOGGLE_FAVORITE, { name: el.dataset.name });
      break;
    }

    case 'set-pause':
      dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'pauseSec', value: +sec }); break;

    case 'remove-ex':
      if (confirm('Übung entfernen?')) {
        dispatch(A.EX_REMOVE, { di: +di, ei: +ei });
      }
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
      break;
    }

    case 'day-duplicate': {
      dispatch(A.DAY_DUPLICATE, { di: +di });
      _dayMenuOpenKey = null;
      showToast('Tag dupliziert — Undo möglich', 'info');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    case 'day-reset-sets': {
      const _rsDay = getState().weeks[getState().curIdx]?.days[+di];
      if (!confirm(`Alle Sätze von "${_rsDay?.title ?? 'Tag'}" zurücksetzen? Eingetragene Werte gehen verloren.`)) break;
      dispatch(A.DAY_RESET_SETS, { di: +di });
      _dayMenuOpenKey = null;
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
      const _rpLabel = (_rpEx?.progressionType ?? 'reps') === 'sets' ? 'Satz' : 'Wdh';
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

    case 'set-step': {
      const step = parseFloat(el.dataset.step);
      dispatch(A.EX_SET_STEP, { di: +di, ei: +ei, step });
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

    // Exercise tags (3.12)
    case 'toggle-ex-tag': {
      const _exTag = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei];
      if (_exTag) {
        const tag  = el.dataset.tag;
        const tags = Array.isArray(_exTag.tags) ? [..._exTag.tags] : [];
        const idx  = tags.indexOf(tag);
        if (idx >= 0) tags.splice(idx, 1); else tags.push(tag);
        dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'tags', value: tags });
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
      const _s = getState().weeks[getState().curIdx]?.days[+di]?.exercises[+ei]?.sets[+si];
      if (_s && _s.status === 'pending') {
        const _wInp = document.querySelector(`[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
        const _rInp = document.querySelector(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
        const _rVal = parseFloat(_rInp?.value ?? _s.reps);
        const _wVal = parseFloat(_wInp?.value ?? _s.weight);
        const canSuccess = Number.isFinite(_wVal) && _wVal > 0 && Number.isFinite(_rVal) && _rVal > 0;
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

      // Set flash key before dispatch so the re-render includes the class
      _confirmFlashKey = `${di}-${ei}`;
      dispatch(A.CONFIRM_SET, { di: +di, ei: +ei, si: _csi, reps: _cex.targetReps });
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
        const _totalAch = _doneSets.reduce((sum, s) => sum + (s.reps ?? 0), 0);
        const _totalTgt = (_aftEx.sets?.length ?? 0) * _aftEx.targetReps;
        if (_totalTgt > 0 && _totalAch > 0) {
          _maybeShowTip('tip-03', 'Effort-Score: wie viel % deines Ziels du erreicht hast. Über 100% = mehr als geplant.');
        }
      }
      const isLastSet = _csi === (_aftEx?.sets?.length ?? 0) - 1;
      if (!isLastSet) {
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
      // Flush uncommitted weight/reps inputs before autofilling (1.3: RPE is buttons, no flush needed)
      const _wInp = document.querySelector(`[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
      const _rInp = document.querySelector(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
      if (_wInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'weight', value: _wInp.value });
      if (_rInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'reps',   value: _rInp.value });
      dispatch(A.SET_AUTOFILL_DOWN, { di: +di, ei: +ei, si: +si });
      showToast('In folgende Sätze übernommen', 'ok');
      break;
    }

    // ── Body scale buttons ─────────────────────────────────────────────────
    case 'body-scale':
      dispatch(A.BODY_SET_FIELD, { field, value: +val }); break;

    // ── Settings rows (previously role=button, now data-action on the div) ─
    case 'toggle-setting':
      dispatch(A.SETTING_TOGGLE, { key }); break;

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
    case 'ex-note':
      dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'note', value: el.value }); break;
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
    case 'set-height': {
      const hv = parseFloat(el.value);
      dispatch(A.SETTING_SET, { key: 'heightCm', value: Number.isFinite(hv) && hv > 0 ? hv : null });
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
    case 'set-plate-step': {
      const ps = parseFloat(el.dataset.step);
      dispatch(A.SETTING_SET, { key: 'plateStep', value: Number.isFinite(ps) ? ps : 2.5 });
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
    case 'import-json': {
      const file = el.files?.[0];
      if (!file) break;
      const confirmed = confirm(
        'Aktuelle Trainingsdaten werden durch das Backup ersetzt.\nNicht rückgängig machbar.'
      );
      if (!confirmed) { el.value = ''; break; }
      importJSON(file)
        .then(() => {
          const weeks = getState().weeks.length;
          showToast(`✓ ${weeks} Wochen Trainingsdaten wiederhergestellt`, 'ok', 3000);
        })
        .catch(() => showToast('⚠️ Ungültige Backup-Datei', 'warn', 3000));
      el.value = '';
      break;
    }
    case 'toggle-active-tag': {
      // 4.1: toggle a tag in settings.activeTags without re-rendering (checkbox handles own state)
      const tag    = el.dataset.tag;
      const cur    = getState().settings?.activeTags ?? ALL_TAGS_FLAT;
      const next   = el.checked ? [...cur, tag] : cur.filter(t => t !== tag);
      dispatch(A.SETTING_SET, { key: 'activeTags', value: next });
      break;
    }
  }
}

function _handleInput(e) {
  // Absichtlich komplett leer gelassen! 
  // Das verhindert, dass bei jedem einzelnen Tastendruck das Layout neu lädt 
  // und dir die Tastatur vor der Nase zuschlägt.
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

    // Add-exercise input → add the exercise
    if (inp.classList.contains('add-exercise-input')) {
      const name = inp.value.trim();
      if (di !== undefined && name) {
        dispatch(A.EX_ADD, { di: +di, name });
        inp.value = '';
        showToast(`"${name}" hinzugefügt`, 'ok');
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
      const nextSi = +si + 1;
      const nextWeight = document.querySelector(
        `[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${nextSi}"]`
      );
      if (nextWeight) nextWeight.focus();
      else {
        inp.blur();
        // Focus the add-set button when on the last set (1.2)
        document.querySelector(
          `[data-action="add-set"][data-di="${di}"][data-ei="${ei}"]`
        )?.focus();
      }
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

// ─── New week modal (2.3) ─────────────────────────────────────────────────────
function _prepNewWeekModal() {
  const state = getState();
  const body  = document.getElementById('new-week-modal-body');
  if (!body) return;

  // Progression suggestions: which exercises are ready for weight increase?
  const curWk   = state.weeks[state.curIdx];
  const suggestions = [];
  if (curWk) {
    for (const day of curWk.days) {
      for (const ex of day.exercises) {
        if (!ex.targetReps) continue;
        const successSets = ex.sets.filter(s => s.status === 'success');
        const allMetTarget = successSets.length >= ex.sets.length
          && successSets.every(s => (s.reps ?? 0) >= ex.targetReps);
        if (allMetTarget && successSets.length > 0) {
          const maxW = Math.max(...successSets.map(s => s.weight ?? 0));
          const step = ex.weightStep ?? 2.5;
          suggestions.push({ name: ex.name, from: maxW, to: maxW + step });
        }
      }
    }
  }

  const suggestHtml = suggestions.length > 0 ? `
  <div class="nw-suggestions">
    <div class="nw-suggestions__title">Empfohlene Steigerungen</div>
    ${suggestions.map(s =>
      `<div class="nw-suggestion-row">
        <span>${h(s.name)}</span>
        <span class="nw-sug-weight">${s.from} → <strong>${s.to} kg</strong></span>
      </div>`).join('')}
  </div>` : '';

  // KI-Gewichtsempfehlungen (basierend auf RPE + Erfolgsquote)
  const aiRecs = [];
  if (curWk) {
    const calcWeeks = state.weeks
      .filter(w => w.mode !== 'deload' && w.mode !== 'vacation' && w !== curWk)
      .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
    if (calcWeeks.length >= 2) {
      const seen = new Set();
      for (const day of curWk.days) {
        for (const ex of day.exercises) {
          if (seen.has(ex.name)) continue;
          if (ex.substituteFor) continue;
          if ((ex.progressionType ?? 'weight') === 'reps') continue;
          seen.add(ex.name);
          const rec = getWeightRecommendation(ex.name, calcWeeks, state.settings?.plateStep ?? 2.5);
          if (rec) aiRecs.push({ name: ex.name, rec });
        }
      }
    }
  }

  // Favoriten zuerst, dann delta absteigend; max. 5 Chips
  const _favSet = new Set(state.favoriteExercises ?? []);
  aiRecs.sort((a, b) => {
    const af = _favSet.has(a.name) ? 0 : 1;
    const bf = _favSet.has(b.name) ? 0 : 1;
    if (af !== bf) return af - bf;
    return b.rec.delta - a.rec.delta;
  });
  const _displayRecs = aiRecs.slice(0, 5);

  const _rpeEnabled = state.settings?.rpeEnabled ?? true;
  const aiRecHtml = _displayRecs.length > 0 ? `
  <div class="nw-weight-recs">
    <div class="nw-weight-recs__title" style="display:flex;align-items:center;gap:6px">💡 KI-Empfehlung</div>
    ${_displayRecs.map(r => {
      const _filtReasons = (r.rec.reasons ?? []).filter(rs => !rs.isRpe || _rpeEnabled).slice(0, 2);
      const _action = r.rec.delta > 0
        ? `💡 +${r.rec.delta} kg empfohlen`
        : `💡 Gewicht halten (${r.rec.recommendedWeight} kg)`;
      return `
    <button type="button" class="nw-weight-rec-chip"
      data-action="toggle-weight-rec"
      data-name="${h(r.name)}"
      data-weight="${r.rec.recommendedWeight}"
      data-delta="${r.rec.delta}"
      aria-label="Empfehlung für ${h(r.name)} übernehmen">
      <div class="nw-rec-top">
        <span class="nw-rec-name">${h(r.name)}</span>
        <span class="nw-rec-action">${_action}</span>
      </div>
      ${_filtReasons.length > 0 ? `<div class="nw-rec-reasons">${_filtReasons.map(rs => `<div class="nw-rec-reason-row">${rs.icon} ${h(rs.text)}</div>`).join('')}</div>` : ''}
      <div class="nw-rec-tap">→ Tap zum Bestätigen</div>
    </button>`;
    }).join('')}
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
  ${suggestHtml}
  ${aiRecHtml}`;

  if (_displayRecs.length > 0) {
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
  dispatch(A.WEEK_CREATE, { startDate: date, note, source });
  closeModal('modal-new-week');
  showToast(source === 'template' ? 'Neue Woche aus Vorlage erstellt ✓' : 'Neue Woche aus Vorwoche erstellt ✓', 'ok');
  const triggered = fireTrigger('NEUE_WOCHE_ERSTELLT', {});
  for (const ins of triggered) {
    if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', 5000);
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
        ex.sets.push({ weight: ex.sets[0]?.weight ?? 0, reps: ex.sets[0]?.reps ?? 10, rpe: null, done: false });
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
  if (tab === 'body')     renderBodyTab(state);
  if (tab === 'analysis') {
    document.getElementById('app').scrollTop = 0;
    renderAnalysisTab(state);
    const _completedWks = state.weeks.filter(w => w.days?.some(d => d.markedDone)).length;
    if (_completedWks >= 2) {
      _maybeShowTip('tip-05', 'Jeder Punkt = eine Woche. Blau = Training · Amber = Urlaub · Grau = Pause.');
      setTimeout(() => _maybeShowTip('tip-07', 'Abzeichen verdienst du durch konsequentes Training. 4 Wochen Streak = erstes Abzeichen.'), 4200);
    } else {
      _maybeShowTip('tip-07', 'Abzeichen verdienst du durch konsequentes Training. 4 Wochen Streak = erstes Abzeichen.');
    }
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
    const btn = document.getElementById('btn-week-menu');
    const dropdown = document.getElementById('week-menu-dropdown');
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
    renderWeekHeader(state);
    renderDayList(state);
    if (_activeTab === 'body')     renderBodyTab(state);
    if (_activeTab === 'analysis') renderAnalysisTab(state);
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
      aria-selected="true" aria-controls="page-workout">
      ${ic.dumbbell()}<span class="sr-only">Training</span><span aria-hidden="true">Training</span>
    </button>
    <button class="nav__tab" role="tab" data-tab="body"
      aria-selected="false" aria-controls="page-body">
      ${ic.person()}<span class="sr-only">Körper</span><span aria-hidden="true">Körper</span>
    </button>
    <button class="nav__tab" role="tab" data-tab="analysis"
      aria-selected="false" aria-controls="page-analysis">
      ${ic.barChart()}<span class="sr-only">Analyse</span><span aria-hidden="true">Analyse</span>
    </button>
    <button class="nav__tab" role="tab" data-tab="settings"
      aria-selected="false" aria-controls="page-settings">
      ${ic.settings()}<span class="sr-only">Einstellungen</span>
    </button>
  </div>
</nav>

<main id="page-workout" class="page is-active" role="tabpanel" aria-label="Training">
  <div class="week-nav" aria-label="Wochennavigation">
    <button class="week-nav__btn" id="btn-prev-wk" data-action="nav-prev"
      aria-label="Vorherige Woche">${ic.chevronLeft()}</button>
    <div class="week-nav__info" aria-live="polite">
      <div id="wk-label" class="week-nav__label">–</div>
      <div id="wk-range" class="week-nav__range"></div>
    </div>
    <div class="week-menu-wrap">
      <button class="week-nav__btn" id="btn-week-menu" data-action="toggle-week-menu"
        aria-label="Wochen-Menü" aria-expanded="false">⋮</button>
      <div id="week-menu-dropdown"></div>
    </div>
    <button class="week-nav__btn" id="btn-next-wk" data-action="nav-next"
      aria-label="Nächste Woche">${ic.chevronRight()}</button>
  </div>

  <div id="days-container" aria-label="Trainingstage"></div>
</main>

<section id="page-body" class="page" role="tabpanel" aria-label="Körper und Wohlbefinden">
  <h1 class="page-title">Körper</h1>
  <p class="page-subtitle">Optional · Fließt in CSV-Analyse ein</p>
  <div id="body-tab-content"></div>
</section>

<section id="page-analysis" class="page" role="tabpanel" aria-label="Fortschrittsanalyse">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--sp-4)">
    <div>
      <h1 class="page-title">Analyse</h1>
      <p class="page-subtitle">Fortschritt & Statistiken</p>
    </div>
    <button class="btn btn--accent btn--sm" data-action="open-export"
      aria-label="Daten exportieren">${ic.download()} Export</button>
  </div>
  <div id="analysis-tab-content"></div>
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

<div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"></div>

<div class="storage-warning" id="storage-warning" role="alert">
  <span>⚠ Speicher voll! Bitte Backup herunterladen.</span>
  <button class="btn" id="storage-warn-btn">
    ${ic.download()} JSON-Backup</button>
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

  window.addEventListener('train:badge-earned', e => {
    (e.detail ?? []).forEach((badge, i) => {
      setTimeout(() => _showBadgeOverlay(badge), i * 5500);
    });
  });

  scheduleRender();
  _showOnboarding();

  // Fire APP_GEÖFFNET and show 4-week backup reminder if due
  setTimeout(() => {
    const triggered = fireTrigger('APP_GEÖFFNET', {});
    for (const ins of triggered) {
      if (ins.immediate) showToast(ins.message, ins.type === 'warning' ? 'warn' : 'ok', 5000);
    }

    const st = getState();
    if (_shouldShowBackupReminder(st)) {
      _showBackupReminderToast();
    }
  }, 2000);
}

function _getDayCompletionStats(di) {
  const state = getState();
  const day   = state.weeks[state.curIdx]?.days[di];
  if (!day) return { successSets: 0, totalSets: 0, prCount: 0, pct: 0, quote: '' };
  let successSets = 0, totalSets = 0, prCount = 0;
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
      }
    }
  }
  const pct = totalSets > 0 ? Math.round(successSets / totalSets * 100) : 0;
  let effortAchieved = 0, effortTarget = 0;
  for (const ex of day.exercises ?? []) {
    if (!ex.targetReps) continue;
    for (const s of ex.sets ?? []) {
      if (s.status === 'success') {
        effortAchieved += s.reps ?? 0;
        effortTarget   += ex.targetReps;
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
        : `<div class="day-completion-screen__pct">${pct}%</div>`}
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
      <div class="badge-earned-overlay__sub">nach ${badge.weeks} Wochen Streak</div>
    </div>`;
  document.body.appendChild(el);
  const dismiss = () => { clearTimeout(timer); el.remove(); };
  const timer   = setTimeout(dismiss, 5000);
  el.addEventListener('click', dismiss, { once: true });
}

function _renderBadgeGallery(state) {
  const badges  = state.badges ?? [];
  const streak  = (() => {
    const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
    let cur = 0;
    for (let i = sorted.length - 1; i >= 0; i--) {
      const w = sorted[i];
      if (w.days.some(d => !!d.markedDone) || w.days.some(d => !!d.isVacation) || w.mode === 'vacation') cur++;
      else break;
    }
    return cur;
  })();
  const items = BADGE_THRESHOLDS.map(thr => {
    const earned = badges.find(b => b.id === thr.id);
    if (earned) {
      const dateStr = new Date(earned.unlockedAt).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
      return `<div class="badge-item badge-item--earned">
        <img src="./badges/${thr.id}.png" alt="${thr.title}" class="badge-img" width="80" height="80">
        <div class="badge-item__title">${thr.title}</div>
        <div class="badge-item__sub badge-item__date">${dateStr}</div>
      </div>`;
    }
    const weeksLeft = thr.weeks - streak;
    return `<div class="badge-item">
      <img src="./badges/${thr.id}.png" alt="${thr.title}" class="badge-img" width="80" height="80" style="filter:grayscale(100%) opacity(0.3)">
      <div class="badge-item__title">${thr.title}</div>
      <div class="badge-item__sub">noch ${weeksLeft} Wo.</div>
    </div>`;
  });
  return `<div class="section-label" style="margin-top:var(--sp-5)">Abzeichen</div>
    <div class="badge-gallery">${items.join('')}</div>`;
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
  if (document.getElementById('onboarding')) return; // already mounted
  _onboardingActive = true;

  let _step   = 1;
  let _selTpl = null;

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

  const _isInstalled = () =>
    navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;

  const _dots = () => [1, 2, 3]
    .map(i => `<span class="ob-dot${i === _step ? ' ob-dot--active' : ''}"></span>`)
    .join('');

  function _render() {
    if (_step === 1) {
      el.innerHTML = `
        <div class="ob-screen">
          <div class="ob-indicator">${_dots()}</div>
          <h1 class="ob-title">Jede Woche ein bisschen besser.</h1>
          <p class="ob-sub">Du trainierst. TRAIN erkennt, wann mehr möglich ist.</p>
          <button class="btn btn--accent ob-btn" data-ob="next">Weiter →</button>
        </div>`;
    } else if (_step === 2) {
      const cards = _ONBOARDING_TEMPLATES.map((t, i) => `
        <div class="ob-tpl-card${_selTpl === i ? ' is-selected' : ''}" data-ob="select" data-tpl="${i}">
          <span class="ob-tpl-icon">${t.icon}</span>
          <div class="ob-tpl-info">
            <div class="ob-tpl-title">${t.title}</div>
            <div class="ob-tpl-meta">${t.meta}</div>
            <div class="ob-tpl-sub">${t.sub}</div>
          </div>
        </div>`).join('');
      el.innerHTML = `
        <div class="ob-screen">
          <div class="ob-indicator">${_dots()}</div>
          <h2 class="ob-title ob-title--sm">Womit möchtest du starten?</h2>
          <div class="ob-tpl-list">${cards}</div>
          <button class="btn btn--accent ob-btn" data-ob="load"${_selTpl === null ? ' disabled' : ''}>Vorlage laden →</button>
          <button class="btn btn--ghost ob-btn ob-btn--sm" data-ob="skip">Ohne Vorlage starten</button>
        </div>`;
    } else {
      const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      const hint  = isIos
        ? '<strong>Wichtig:</strong> iOS löscht App-Daten automatisch nach 7 Tagen wenn die App nicht auf dem Homescreen installiert ist.<br><br>Tippe auf <strong>Teilen ↑</strong> → <strong>„Zum Home-Bildschirm hinzufügen"</strong> um deine Trainingsdaten dauerhaft zu sichern.'
        : 'Tippe auf <strong>Menü ⋮</strong> → <strong>„App installieren"</strong> um TRAIN auf deinem Startbildschirm zu speichern und Datenverlust zu vermeiden.';
      el.innerHTML = `
        <div class="ob-screen">
          <div class="ob-indicator">${_dots()}</div>
          <div class="ob-logo" style="font-size:56px">📲</div>
          <h2 class="ob-title ob-title--sm">Für zuverlässige Datenspeicherung</h2>
          <p class="ob-sub">${hint}</p>
          <div class="ob-backup-warn">
            ⚠️ Browser-Daten löschen = Trainingsdaten verloren.<br>
            Erstelle regelmäßig ein Backup unter<br>
            <strong>Einstellungen → Backup erstellen</strong>.
          </div>
          <button class="btn btn--accent ob-btn" data-ob="done">Verstanden</button>
        </div>`;
    }
  }

  el.addEventListener('click', e => {
    const btn = e.target.closest('[data-ob]');
    if (!btn) return;
    switch (btn.dataset.ob) {
      case 'next':   _step = 2; _render(); break;
      case 'select': _selTpl = +btn.dataset.tpl; _render(); break;
      case 'load':   if (_selTpl !== null) _applyTpl(_selTpl); _advance(); break;
      case 'skip':   _applyBlank(); _advance(); break;
      case 'done':   _finish(); break;
    }
  });

  function _advance() {
    if (_isInstalled()) { _finish(); return; }
    _step = 3;
    _render();
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
      exercises: ds.exercises.map(ex => ({
        name: ex.name, note: '', pauseSec: ex.ps, metric: ex.m,
        sets: Array.from({ length: ex.n }, () => ({
          weight: 0, reps: ex.tr, rpe: null, status: 'pending', done: false, note: '',
        })),
        weightStep: 2.5, nextWeekPlan: 0, nextWeekPlanConfirmed: false,
        targetSets: ex.n, targetReps: ex.tr,
        _showCfg: false, setType: 'standard',
        tags: [], showPlates: false, progressionType: 'weight', substituteFor: null,
      })),
    }));
    dispatch(A.ONBOARDING_WEEK_CREATE, { startDate, days, note: tpl.weekTitle });
  }

  function _applyBlank() {
    const d = new Date();
    const dow = d.getDay();
    d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
    const startDate = d.toISOString().slice(0, 10);
    dispatch(A.ONBOARDING_WEEK_CREATE, { startDate, days: [], note: '' });
  }

  function _finish() {
    _onboardingActive = false;
    dispatch(A.ONBOARDING_DONE, {});
    el.remove();
  }

  _render();
}
