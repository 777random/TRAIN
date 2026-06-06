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
  getState, dispatch, subscribe, A, canUndo,
} from './state.js';
import {
  exportJSON, importJSON, exportCSV,
} from './backup.js';
import * as ic from './icons.js';

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

// ─── Exercise tags (3.12) ────────────────────────────────────────────────────
const _EXERCISE_TAGS = [
  'Brust', 'Rücken', 'Schultern', 'Bizeps', 'Trizeps', 'Beine', 'Po', 'Bauch',
  'Ganzkörper', 'Langhantel', 'Kurzhantel', 'Kettlebell', 'Maschine', 'Körpergewicht',
  'Drücken', 'Ziehen', 'Kniebeugen', 'Hinge', 'Carry',
];

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
    _swipeStartX = e.touches[0].clientX;
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

// ════════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

function renderWeekHeader(state) {
  const wk      = state.weeks[state.curIdx];
  const isDl    = wk?.mode === 'deload';
  const isFirst = state.curIdx === 0;
  const isLast  = state.curIdx === state.weeks.length - 1;

  const labelEl = document.getElementById('wk-label');
  const rangeEl = document.getElementById('wk-range');
  const prevBtn = document.getElementById('btn-prev-wk');
  const nextBtn = document.getElementById('btn-next-wk');
  const stdBtn  = document.getElementById('mode-std');
  const dlBtn   = document.getElementById('mode-dl');

  if (labelEl) {
    labelEl.textContent = wk ? wkLabel(wk.startDate) : '–';
    labelEl.className   = 'week-nav__label' + (isDl ? ' week-nav__label--deload' : '');
  }
  if (rangeEl)  rangeEl.textContent = wk ? wkRange(wk.startDate) : '';
  if (prevBtn)  prevBtn.disabled    = isFirst;
  if (nextBtn)  nextBtn.disabled    = isLast;
  if (stdBtn)   stdBtn.classList.toggle('is-active', !isDl);
  if (dlBtn)    dlBtn.classList.toggle('is-active',   isDl);

  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.disabled = !canUndo();
}

// ─── Day list ────────────────────────────────────────────────────────────────
function renderDayList(state) {
  const container = document.getElementById('days-container');
  if (!container) return;
  const wk = state.weeks[state.curIdx];
  if (!wk) { container.innerHTML = ''; return; }

  const isDl = wk.mode === 'deload';

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

  // ── Tab pills row + overview toggle ───────────────────────────────────────
  const tabsHtml = `<div class="day-tabs-row" role="tablist" aria-label="Trainingstage">
    ${wk.days.map((day, di) => {
      const done   = !!day.markedDone;
      const locked = !!day.locked;
      const isAct  = !_overviewMode && _activeDayIdx === di;
      const total  = day.exercises.reduce((s, ex) => s + ex.sets.length, 0);
      const done_s = day.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.done).length, 0);
      const dotCls = done ? 'day-card__dot day-card__dot--done'
                   : locked ? 'day-card__dot day-card__dot--locked'
                   : 'day-card__dot';
      // 3.4: compact 28×28 square with single letter from title
      const letter = day.title.replace(/[^A-Za-zÄÖÜäöüß0-9]/g, '').charAt(0) || String(di + 1);
      return `<button
        class="day-tab${isAct ? ' is-active' : ''}${done ? ' day-tab--done' : ''}${isDl ? ' day-tab--deload' : ''}"
        data-day-hdr="${di}"
        role="tab" aria-selected="${isAct}" aria-controls="day-panel-${di}"
        id="day-tab-${di}"
        title="${h(day.title)}"
        aria-label="${h(day.title)}${done_s}/${total} Sätze"
      >${letter}</button>`;
    }).join('')}
    <button
      class="day-overview-toggle${_overviewMode ? ' is-active' : ''}"
      data-action="toggle-overview"
      aria-label="${_overviewMode ? 'Einzelansicht' : 'Übersicht'}"
      aria-pressed="${_overviewMode}"
      title="${_overviewMode ? 'Einzelansicht' : 'Alle Tage anzeigen'}"
    >${ic.columns()}</button>
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

  requestAnimationFrame(() => {
    const tabsRow = container.querySelector('.day-tabs-row');
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
  const day    = wk.days[di];
  const locked = !!day.locked;
  const done   = !!day.markedDone;

  let prevBanner = '';
  if (state.curIdx > 0) {
    const prevDay = state.weeks[state.curIdx - 1]?.days?.[di];
    if (prevDay) {
      // 2.1: completion % + streak instead of kg volume
      const totalSets   = prevDay.exercises.reduce((s, ex) => s + ex.sets.length, 0);
      const doneSets    = prevDay.exercises.reduce((s, ex) => s + ex.sets.filter(st => st.status === 'success').length, 0);
      const pct         = totalSets > 0 ? Math.round(doneSets / totalSets * 100) : 0;
      const streak      = _calcStreak(state);
      const streakPart  = streak.cur >= 2 ? `&nbsp;&nbsp;🔥 ${streak.cur} Wochen` : '';
      prevBanner = `<div class="prev-banner" role="status">
        ${ic.barChart()}<span>Vorwoche: ${pct}% abgeschlossen (${doneSets}/${totalSets} Sätze)${streakPart}</span>
      </div>`;
    }
  }

  const exHtml       = day.exercises.map((ex, ei) => renderExercise(wk, di, ei, state)).join('');
  const lockBtnLabel = done ? 'Tag entsperren' : 'Tag als abgeschlossen markieren und sperren';
  const lockBtnIcon  = done ? ic.unlock() : ic.lock();

  // Session note (2.4): collapsed under warmup, icon shows state
  const noteVal    = day.sessionNote ?? '';
  const noteHasVal = noteVal.trim().length > 0;
  const noteBlock  = `
  <div class="session-note-block">
    <button
      class="session-note-toggle${noteHasVal ? ' has-note' : ''}"
      onclick="this.nextElementSibling.classList.toggle('is-open')"
      aria-expanded="false"
      aria-label="Trainingsnotiz"
    >📝 <span>${noteHasVal ? 'Notiz' : 'Trainingsnotiz hinzufügen'}</span></button>
    <div class="session-note-body">
      <textarea
        class="session-note-input"
        rows="3"
        placeholder="Was war heute besonders? (Technik, Schmerzen, Fokus …)"
        data-action="day-field" data-di="${di}" data-field="sessionNote"
        aria-label="Trainingsnotiz"
        ${locked ? 'disabled' : ''}
      >${h(noteVal)}</textarea>
    </div>
  </div>`;

  return `
    ${renderInfoBlock('warmup', '🔥 Aufwärmen', day.warmup, di, locked)}
    ${noteBlock}
    ${prevBanner}
    <div data-ex-list="${di}">${exHtml}</div>
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
    <button
      class="complete-btn${done ? ' is-done' : ''}"
      data-action="toggle-complete" data-di="${di}"
      aria-pressed="${done}"
      aria-label="${lockBtnLabel}"
    >
      ${lockBtnIcon}
      ${done ? 'Gesperrt – Tippen zum Entsperren' : 'Abgeschlossen & sperren'}
    </button>

    <!-- Fatigue indicator (3.5): shown after locking -->
    ${done ? `
    <div class="session-rating" role="group" aria-label="Wie war die Einheit?">
      <span class="session-rating__lbl">Wie war die Einheit?</span>
      ${[
        { val: 1, icon: '😴', label: 'Erschöpft' },
        { val: 2, icon: '😊', label: 'Gut' },
        { val: 3, icon: '💪', label: 'Stark' },
      ].map(r => `
      <button
        class="session-rating__btn${day.sessionRating === r.val ? ' is-selected' : ''}"
        data-action="set-session-rating" data-di="${di}" data-val="${r.val}"
        aria-pressed="${day.sessionRating === r.val}"
        aria-label="${r.label}"
      >${r.icon}</button>`).join('')}
    </div>` : ''}

    ${renderInfoBlock('cooldown', '🧘 Cooldown', day.cooldown, di, locked)}
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
  const locked = !!wk.days[di].locked;
  const isDl   = wk.mode === 'deload';
  const drag   = state.settings.drag && !locked;

  // Diese wichtige Logik hatte ich vorher komplett übersehen!
  const prevEx = state.curIdx > 0
    ? state.weeks[state.curIdx - 1]?.days?.[di]?.exercises?.[ei] ?? null
    : null;

  const setsHtml = ex.sets.map((s, si) =>
    renderSetRow(s, si, ex, di, ei, prevEx, locked, isDl)
  ).join('');

  const step = ex.weightStep ?? 2.5;
  const metric = ex.metric === 'sec' || ex.metric === 'm' ? ex.metric : 'reps';
  const metricHdr = metric === 'sec' ? 'Sek' : metric === 'm' ? 'm' : 'Wdh';

  // --- Das neue, cleane Zahnrad-Menü ---
  const cfgRow = ex._showCfg ? `
    <div class="exercise__settings">
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
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Satz-Typ">
        <span class="pause-row__label">Typ:</span>
        <div class="weight-step-opts">
          ${[['straight','Straight'],['pyramid','Pyramide']].map(([val, lbl]) => `
            <button type="button"
              class="weight-step-btn${(ex.setType ?? 'pyramid') === val ? ' is-selected' : ''}"
              data-action="set-settype" data-di="${di}" data-ei="${ei}" data-val="${val}"
              aria-pressed="${(ex.setType ?? 'pyramid') === val}"
            >${lbl}</button>`).join('')}
        </div>
        ${(ex.setType ?? 'pyramid') === 'straight'
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
      ${!locked ? `
      <div class="weight-plan-row" role="group" aria-label="Zielvorgaben">
        <span class="pause-row__label">Ziel:</span>
        <input
          class="target-input"
          type="number" inputmode="numeric" min="1" max="10"
          value="${ex.targetSets ?? ''}"
          placeholder="Sätze"
          data-action="set-targets" data-field="targetSets"
          data-di="${di}" data-ei="${ei}"
          aria-label="Ziel Sätze"
        />
        <span class="pause-row__label">×</span>
        <input
          class="target-input"
          type="number" inputmode="numeric" min="1" max="100"
          value="${ex.targetReps ?? ''}"
          placeholder="Wdh"
          data-action="set-targets" data-field="targetReps"
          data-di="${di}" data-ei="${ei}"
          aria-label="Ziel Wiederholungen"
        />
      </div>` : ''}
      <!-- Tags (3.12) -->
      <div class="weight-plan-row exercise-tags-row" role="group" aria-label="Tags">
        <span class="pause-row__label">Tags:</span>
        <div class="tag-chips">
          ${_EXERCISE_TAGS.map(tag => {
            const active = (ex.tags ?? []).includes(tag);
            return `<button
              type="button"
              class="tag-chip${active ? ' is-selected' : ''}"
              data-action="toggle-ex-tag" data-di="${di}" data-ei="${ei}" data-tag="${h(tag)}"
              aria-pressed="${active}"
            >${h(tag)}</button>`;
          }).join('')}
        </div>
      </div>
    </div>` : '';

  return `
<div class="exercise${ex._showCfg ? ' is-cfg-open' : ''}${ex.supersetId ? ' is-superset' : ''}" data-di="${di}" data-ei="${ei}" draggable="${drag}">
  ${ex.supersetId ? '<div class="ss-badge">SS</div>' : ''}
  <div class="sticky-sentinel" aria-hidden="true" style="height:1px;pointer-events:none;"></div>

  <div class="exercise__name-sticky">
    ${!locked ? `
    <div class="exercise__order-btns">
      <button class="exercise__order-btn" data-action="move-ex-up" data-di="${di}" data-ei="${ei}" aria-label="Nach oben" ${ei === 0 ? 'disabled' : ''}>▲</button>
      <button class="exercise__order-btn" data-action="move-ex-down" data-di="${di}" data-ei="${ei}" aria-label="Nach unten" ${ei === wk.days[di].exercises.length - 1 ? 'disabled' : ''}>▼</button>
    </div>` : ''}
    
    <input
      class="exercise__name-input"
      type="text"
      value="${h(ex.name)}"
      ${locked ? 'disabled' : ''}
      data-action="ex-name" data-di="${di}" data-ei="${ei}"
      aria-label="Übungsname"
      maxlength="80"
    />

    ${!locked ? `
    <button
      class="btn-inc-weight-sticky"
      data-action="inc-weight" data-di="${di}" data-ei="${ei}"
      aria-label="Gewicht um ${step} kg erhöhen"
    >＋${step}kg</button>` : ''}

    <button
      class="btn-icon${ex.nextWeekPlan ? ' is-planned' : ''}"
      data-action="toggle-cfg" data-di="${di}" data-ei="${ei}"
      aria-label="Pausenzeit einstellen"
      aria-expanded="${!!ex._showCfg}"
    >${ic.settings()}</button>
    
    ${!locked ? `
    <button
      class="exercise__remove-btn"
      data-action="remove-ex" data-di="${di}" data-ei="${ei}"
      aria-label="Übung '${h(ex.name)}' entfernen"
    >${ic.trash()}</button>` : ''}
  </div>

  ${cfgRow}

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
    <span>#</span><span>kg</span><span>${metricHdr}</span><span>RPE</span><span>✓</span><span></span>
  </div>

  <div data-set-list="${di}-${ei}" role="list" aria-label="Sätze von ${h(ex.name)}">
    ${setsHtml}
  </div>

  <!-- Soll-Ist + Fulfillment combined row (2.4): always visible, no toggle -->
  ${(() => {
    if (!ex.targetSets || !ex.targetReps) return '';
    const target   = ex.targetSets * ex.targetReps;
    const achieved = ex.sets.filter(s => s.status === 'success').reduce((sum, s) => sum + (s.reps ?? 0), 0);
    const pct      = target > 0 ? Math.min(Math.round(achieved / target * 100), 100) : 0;
    const color    = pct >= 100 ? 'var(--c-ok)' : pct >= 80 ? 'var(--c-warn)' : 'var(--c-danger)';
    return `
    <div class="fulfill-meter" aria-label="Zielerfüllung ${pct}%">
      <div class="fulfill-meter__bar-wrap">
        <div class="fulfill-meter__bar" style="width:${pct}%;background:${color}"></div>
      </div>
      <span class="fulfill-meter__label" style="color:${color}">Ziel: ${ex.targetSets}×${ex.targetReps} | Ist: ${achieved}/${target} Wdh</span>
    </div>`;
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
function renderSetRow(s, si, ex, di, ei, prevEx, locked, isDl) {
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
  const isPR  = st === 'success' && exPR && (s.weight ?? 0) > 0 && s.weight >= exPR.maxWeight;
  const doneIcon = isPR
    ? ic.trophy()
    : st === 'success' ? ic.check()
    : st === 'fail'    ? ic.xMark()
    : '';

  return `
<div class="set-row" role="listitem" data-di="${di}" data-ei="${ei}" data-si="${si}">

  <span class="set-idx" aria-hidden="true">${si + 1}</span>

  <div class="set-cell">
    <input class="num-input" type="number" inputmode="decimal"
      min="0" step="0.5" value="${dispW}"
      ${locked ? 'disabled' : ''}
      data-action="set-weight" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="Satz ${si + 1} Gewicht in kg"
    />
    <span class="prev-hint" aria-hidden="true">${prevSet ? prevSet.weight + ' kg' : ''}</span>
    ${ex.showPlates && dispW > 0 ? (() => { const pl = calcPlates(dispW); return pl ? `<span class="plate-hint" aria-hidden="true" title="Scheiben je Seite">▪ ${pl}</span>` : ''; })() : ''}
  </div>

  <div class="set-cell">
    <input class="num-input" type="number" inputmode="${repMode}"
      min="0" step="${repStep}" placeholder="${repPh}" value="${s.reps}"
      ${locked ? 'disabled' : ''}
      data-action="set-reps" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="${repAria}"
    />
    ${metricCellFooter}
  </div>

  <!-- RPE vertical buttons (1.1) – order: 10 top, – bottom -->
  <div class="set-cell set-cell--rpe">
    ${locked
      ? `<span class="rpe-static">${s.rpe ?? '–'}</span>`
      : `<div class="rpe-btns" role="group" aria-label="Satz ${si + 1} RPE"
            data-rpe-group data-di="${di}" data-ei="${ei}" data-si="${si}">
          ${[10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, '–'].map(v => {
            const isNone = v === '–';
            const cur    = s.rpe ?? null;
            const isSel  = isNone ? cur === null : cur === v;
            return `<button type="button"
              class="rpe-btn${isSel ? ' is-selected' : ''}"
              data-action="set-rpe-val"
              data-di="${di}" data-ei="${ei}" data-si="${si}"
              data-val="${isNone ? '' : v}"
              aria-pressed="${isSel}"
              aria-label="RPE ${v}"
            >${v}</button>`;
          }).join('')}
        </div>
        <span class="prev-hint" aria-hidden="true">${prevSet?.rpe ? prevSet.rpe : ''}</span>`
    }
  </div>

  <div class="set-done-wrap">
    <button
      class="set-done-btn${doneClass}${isPR ? ' is-pr' : ''}"
      ${locked ? 'disabled' : ''}
      data-action="toggle-done" data-di="${di}" data-ei="${ei}" data-si="${si}"
      aria-label="Satz ${si + 1}: ${stLabel}${isPR ? ' – Bestleistung!' : ''}. Tippen für nächsten Status (offen → erfolgreich → nicht geschafft)."
    >${doneIcon}</button>
    <span class="prev-hint" aria-hidden="true">${isPR ? '🏆' : ''}</span>
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

// ─── Analysis insights (max 2, priority-ordered) ─────────────────────────────
function _buildInsights(state, sorted) {
  const insights = [];
  const prs = state.prs ?? {};

  // Priority 1: Neue Bestleistung diese Woche
  const curWk = sorted[sorted.length - 1];
  if (curWk) {
    for (const day of curWk.days) {
      for (const ex of day.exercises) {
        const pr = prs[ex.name];
        if (!pr) continue;
        const maxW = Math.max(...ex.sets.filter(s => s.status === 'success').map(s => s.weight ?? 0));
        if (maxW > 0 && maxW >= pr.maxWeight && pr.date === new Date().toISOString().split('T')[0]) {
          insights.push(`🏆 Neue Bestleistung bei <strong>${h(ex.name)}</strong>: ${maxW} kg!`);
          if (insights.length >= 2) return insights;
        }
      }
    }
  }

  // Priority 2: Stärkstes Tatsächliches Volumen aller Zeiten
  if (sorted.length >= 2) {
    const curVol  = _trueVol(sorted[sorted.length - 1]);
    const prevMax = Math.max(...sorted.slice(0, -1).map(_trueVol));
    if (curVol > prevMax && curVol > 0) {
      insights.push(`💪 Dein bisher stärkstes <strong>Tatsächliches Volumen</strong>: ${curVol >= 1000 ? (curVol/1000).toFixed(1)+'t' : curVol+' kg'}!`);
      if (insights.length >= 2) return insights;
    }
  }

  // Priority 3: Stagnation über 3+ Wochen (Δ < 2%)
  if (sorted.length >= 4) {
    const last3 = sorted.slice(-3).map(_trueVol);
    const base  = last3[0];
    if (base > 0 && last3.every(v => Math.abs(v - base) / base < 0.02)) {
      insights.push(`📊 Dein Tatsächliches Volumen stagniert seit ${last3.length} Wochen – Zeit für Progression?`);
      if (insights.length >= 2) return insights;
    }
  }

  // Priority 4: Volumen-Trend über letzte 4 Wochen
  if (sorted.length >= 4 && insights.length < 2) {
    const last4 = sorted.slice(-4).map(_trueVol);
    const first = last4[0], last = last4[last4.length - 1];
    if (first > 0) {
      const pct = Math.round((last - first) / first * 100);
      if (Math.abs(pct) >= 5) {
        insights.push(`📈 Letzte 4 Wochen: ${pct > 0 ? '+' : ''}${pct}% Tatsächliches Volumen`);
      }
    }
  }

  return insights.slice(0, 2);
}

// ─── Analysis tab ─────────────────────────────────────────────────────────────
function renderAnalysisTab(state) {
  const container = document.getElementById('analysis-tab-content');
  if (!container) return;

  const streak   = _calcStreak(state);
  const sorted   = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last8    = sorted.slice(-8);
  // Tatsächliches Volumen: nur success-Sätze (2.1)
  const vols     = last8.map(_trueVol);
  const wkLabels = last8.map(w => wkLabel(w.startDate).split('·')[0].trim());

  const allExNames = [...new Set(
    state.weeks.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name)))
  )].sort();

  const insights = _buildInsights(state, sorted);

  const weekCards = [...sorted].reverse().map((wk, wi, arr) => {
    const tot  = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.length, 0), 0);
    const don  = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.filter(st => st.status === 'success').length, 0), 0);
    const vol  = _trueVol(wk);
    const pct  = tot > 0 ? Math.round(don / tot * 100) : 0;
    const dd   = wk.days.filter(d => !!d.markedDone).length;
    const isDl = wk.mode === 'deload';
    const prev = arr[wi + 1];
    let vd = '';
    if (prev) {
      const pv = _trueVol(prev);
      if (pv > 0) {
        const df = Math.round((vol - pv) / pv * 100);
        vd = df > 0
          ? `<span class="diff-up"> ↑${df}%</span>`
          : df < 0 ? `<span class="diff-dn"> ↓${Math.abs(df)}%</span>` : '';
      }
    }

    // Day durations from sessionLog (2.6)
    const dayDurations = wk.days.map((day, di) => {
      const logs = (wk.sessionLog ?? []).filter(l => l.dayIdx === di);
      if (!logs.length) return '';
      const mins = Math.round(logs.reduce((s, l) => s + l.duration, 0) / 60);
      return `<span class="pw-day-dur">${h(day.title)}: ${mins} min</span>`;
    }).filter(Boolean).join(' · ');

    // Average session duration
    const avgDur = wk.sessionLog?.length
      ? Math.round(wk.sessionLog.reduce((s, l) => s + l.duration, 0) / wk.sessionLog.length / 60)
      : null;

    // Target fulfillment (2.5)
    let avgFulfill = null;
    const withTargets = wk.days.flatMap(d => d.exercises.filter(ex => ex.targetSets && ex.targetReps));
    if (withTargets.length > 0) {
      const rates = withTargets.map(ex => {
        const target   = (ex.targetSets ?? 0) * (ex.targetReps ?? 0);
        const achieved = ex.sets.filter(s => s.status === 'success').reduce((sum, s) => sum + (s.reps ?? 0), 0);
        return target > 0 ? Math.min(achieved / target, 1) : 0;
      });
      avgFulfill = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 100);
    }

    return `
    <div class="pw-card${isDl ? ' pw-card--deload' : ''}">
      <div class="pw-card__top">
        <div>
          <div class="pw-card__title">
            ${wkLabel(wk.startDate)}
            ${isDl ? '<span class="deload-badge">Deload</span>' : ''}
          </div>
          <div class="pw-card__date">${wkRange(wk.startDate)}${wk.note ? ' · ' + h(wk.note) : ''}</div>
          ${dayDurations ? `<div class="pw-day-durs">${dayDurations}</div>` : ''}
        </div>
        <div class="pw-card__pct" style="color:${pct===100?'var(--c-ok)':'var(--c-text)'}">${pct}%</div>
      </div>
      <div class="pw-card__stats">
        <div><div class="pw-stat__num" style="color:${isDl?'var(--c-deload)':'var(--c-accent)'}">${dd}/${wk.days.length}</div><div class="pw-stat__lbl">Tage</div></div>
        <div><div class="pw-stat__num">${don}</div><div class="pw-stat__lbl">Sätze ✓</div></div>
        <div><div class="pw-stat__num">${vol >= 1000 ? (vol/1000).toFixed(1)+'t' : vol+'kg'}</div><div class="pw-stat__lbl">Tats. Vol.${vd}</div></div>
        ${avgDur ? `<div><div class="pw-stat__num">${avgDur}'</div><div class="pw-stat__lbl">Ø Dauer</div></div>` : ''}
        ${avgFulfill !== null ? `<div><div class="pw-stat__num" style="color:${avgFulfill>=100?'var(--c-ok)':avgFulfill>=80?'var(--c-warn)':'var(--c-danger)'}">${avgFulfill}%</div><div class="pw-stat__lbl">Ziel-Erf.</div></div>` : ''}
      </div>
      <div class="progress-bar-wrap"><div class="progress-bar" style="width:${pct}%"></div></div>
    </div>`;
  }).join('');

  const insightHtml = _showInsights && insights.length > 0
    ? insights.map(msg => `<div class="insight-card">${ic.lightbulb()}<span>${msg}</span></div>`).join('')
    : '';

  ${(() => {
    // 3.1: Ø Session + Gesamt time from sessionLog
    const allLogs  = state.weeks.flatMap(w => w.sessionLog ?? []);
    const totalMin = allLogs.length ? Math.round(allLogs.reduce((s, l) => s + l.duration, 0) / 60) : null;
    const avgMin   = allLogs.length ? Math.round(totalMin / allLogs.length) : null;
    const fmtMin   = m => m >= 60 ? `${Math.floor(m/60)}h${m%60 ? String(m%60).padStart(2,'0') : ''}` : `${m}'`;
    return `
  <div class="streak-row">
    <div class="streak-card"><div class="streak-num">${streak.cur}</div><div class="streak-lbl">Streak</div></div>
    <div class="streak-card"><div class="streak-num">${streak.best}</div><div class="streak-lbl">Best</div></div>
    <div class="streak-card"><div class="streak-num">${state.weeks.length}</div><div class="streak-lbl">Wochen</div></div>
    ${avgMin != null ? `<div class="streak-card"><div class="streak-num">${fmtMin(avgMin)}</div><div class="streak-lbl">Ø Session</div></div>` : ''}
    ${totalMin != null ? `<div class="streak-card"><div class="streak-num">${fmtMin(totalMin)}</div><div class="streak-lbl">Gesamt</div></div>` : ''}
    ${state.weeks.length >= 2 ? `
    <button class="streak-card insight-toggle${_showInsights ? ' is-active' : ''}"
      data-action="toggle-insights"
      aria-pressed="${_showInsights}"
      aria-label="Fortschritt analysieren"
      title="Zeigt automatisch erkannte Muster …"
    >${ic.lightbulb()}<div class="streak-lbl">Fortschritt 💡</div></button>` : ''}
  </div>`;
  })()}

  ${insightHtml}

  <div class="chart-card">
    <div class="chart-card__title">Tatsächliches Volumen</div>
    <div class="chart-wrap"><canvas id="chart-vol" aria-label="Volumen-Verlauf Diagramm" role="img"></canvas></div>
  </div>

  <div class="chart-card">
    <div class="chart-card__title">Gewichtsprogression</div>
    <select class="chart-select" id="chart-ex-select" aria-label="Übung für Progressionskurve wählen">
      ${allExNames.map(n => `<option value="${h(n)}">${h(n)}</option>`).join('')}
    </select>
    <div class="chart-wrap"><canvas id="chart-ex" aria-label="Gewichtsprogression Diagramm" role="img"></canvas></div>
  </div>

  <div class="chart-card">
    <div class="chart-card__title">Trainings-Heatmap</div>
    <p style="font-size:11px;color:var(--c-text-3);margin-bottom:6px">Letzte 12 Wochen</p>
    <div class="heatmap" id="heatmap" role="grid" aria-label="Trainings-Heatmap"></div>
    <div style="display:flex;gap:8px;margin-top:8px;align-items:center;font-size:10px;color:var(--c-text-3)">
      <div class="hm-cell" style="width:12px;height:12px" aria-hidden="true"></div><span>0</span>
      <div class="hm-cell hm-cell--1" style="width:12px;height:12px" aria-hidden="true"></div><span>1</span>
      <div class="hm-cell hm-cell--2" style="width:12px;height:12px" aria-hidden="true"></div><span>2</span>
      <div class="hm-cell hm-cell--3" style="width:12px;height:12px" aria-hidden="true"></div><span>3 Tage</span>
    </div>
  </div>

  ${weekCards}

  ${(() => {
    const prs = state.prs ?? {};
    const entries = Object.entries(prs).sort((a, b) => b[1].maxWeight - a[1].maxWeight);
    if (!entries.length) return '';
    return `<div class="chart-card">
      <div class="chart-card__title">${ic.trophy()} Bestleistungen</div>
      ${entries.map(([name, pr]) => `
      <div class="pr-row">
        <span class="pr-name">${h(name)}</span>
        <span class="pr-val">${pr.maxWeight} kg</span>
        ${pr.date ? `<span class="pr-date">${pr.date}</span>` : ''}
      </div>`).join('')}
    </div>`;
  })()}

  ${(() => {
    // Muscle group analysis (3.13): only shown when tags exist
    const curWk = state.weeks[state.curIdx];
    if (!curWk) return '';
    const tagCounts = {};
    for (const day of curWk.days) {
      for (const ex of day.exercises) {
        const tags = ex.tags ?? [];
        const sets = ex.sets.filter(s => s.status === 'success').length;
        if (sets === 0 || !tags.length) continue;
        for (const tag of tags) {
          tagCounts[tag] = (tagCounts[tag] ?? 0) + sets;
        }
      }
    }
    const entries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
    if (!entries.length) return '';
    const maxVal = entries[0][1];
    return `<div class="chart-card">
      <div class="chart-card__title">${ic.muscleGroup()} Muskelgruppen (Sätze ✓)</div>
      ${entries.map(([tag, count]) => `
      <div class="mg-bar-row">
        <span class="mg-bar-label">${h(tag)}</span>
        <div class="mg-bar-wrap">
          <div class="mg-bar" style="width:${Math.round(count/maxVal*100)}%"></div>
        </div>
        <span class="mg-bar-val">${count}</span>
      </div>`).join('')}
    </div>`;
  })()}`;

  requestAnimationFrame(() => {
    drawLineChart('chart-vol', wkLabels, vols, '#C8FF00');
    _updateExChart(state);
    _drawHeatmap(state);
    document.getElementById('chart-ex-select')?.addEventListener('change', () => {
      _updateExChart(getState());
    });
  });
}

function _calcStreak(state) {
  const sorted = [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  let cur = 0, best = 0, tmp = 0;
  sorted.forEach(w => {
    const done = w.days.some(d => !!d.markedDone);
    if (done) { tmp++; best = Math.max(best, tmp); }
    else tmp = 0;
  });
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].days.some(d => !!d.markedDone)) cur++;
    else break;
  }
  return { cur, best };
}

function _updateExChart(state) {
  const sel = document.getElementById('chart-ex-select');
  if (!sel) return;
  const name = sel.value;
  const labels = [], data = [];
  [...state.weeks]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .forEach(wk => {
      wk.days.forEach(d => {
        d.exercises.forEach(ex => {
          if (ex.name === name && ex.sets.length) {
            labels.push(wkLabel(wk.startDate).split('·')[0].trim());
            data.push(Math.max(0, ...ex.sets.map(s => s.weight)));
          }
        });
      });
    });
  drawLineChart('chart-ex', labels, data, '#4FC3F7');
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

  <!-- Daten -->
  <div class="settings-section">
    <div class="settings-section__title">Daten</div>
    <div class="settings-row settings-row--clickable" data-action="export-json">
      <div>
        <div class="settings-row__label">${ic.download()} Daten exportieren (JSON)</div>
        <div class="settings-row__desc">Vollständige Sicherungskopie</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
    </div>
    <label class="settings-row settings-row--clickable">
      <div>
        <div class="settings-row__label">${ic.upload()} Daten importieren (JSON)</div>
        <div class="settings-row__desc">Backup wiederherstellen</div>
      </div>
      <div class="settings-row__action">${ic.chevronRight()}</div>
      <input type="file" accept=".json" class="sr-only" data-action="import-json" aria-label="JSON-Datei wählen"/>
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

    // ── Week navigation ────────────────────────────────────────────────────
    case 'undo':
      dispatch(A.UNDO, {});
      showToast('Rückgängig gemacht ↩', 'ok');
      break;

    case 'nav-prev':
      dispatch(A.WEEK_NAVIGATE, { delta: -1 }); break;

    case 'nav-next':
      dispatch(A.WEEK_NAVIGATE, { delta: 1 }); break;

    case 'mode-std':
      dispatch(A.WEEK_SET_MODE, { mode: 'standard' }); break;

    case 'mode-dl':
      dispatch(A.WEEK_SET_MODE, { mode: 'deload' }); break;

    case 'open-new-week':
      _prepNewWeekModal();
      openModal('modal-new-week'); break;

    case 'copy-prev':
      if (!confirm('Aktuelle Woche mit der Vorwoche überschreiben?\nAlle aktuellen Einträge gehen verloren.')) break;
      dispatch(A.WEEK_COPY_PREV, {});
      showToast('Vorwoche übernommen ✓', 'ok'); break;

    case 'open-export':
      openModal('modal-export'); break;

    case 'open-delete-week':
      openModal('modal-delete-week'); break;

    case 'create-week':
    case 'create-week-prev':
    case 'create-week-template':
      _createWeek(); break;

    case 'confirm-delete-week':
      dispatch(A.WEEK_DELETE, {});
      closeModal('modal-delete-week');
      showToast('Woche gelöscht', 'info'); break;

    case 'save-week-as-template':
      dispatch(A.SAVE_WEEK_AS_TEMPLATE, {});
      showToast('Woche als Standard-Vorlage gespeichert ✓', 'ok');
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

    case 'remove-day': {
      const _di = +el.dataset.di;
      const _day = getState().weeks[getState().curIdx]?.days[_di];
      if (_day?.exercises?.length > 0) {
        if (!confirm(`"${_day.title}" wirklich entfernen? Alle Übungen gehen verloren.`)) break;
      }
      if (_activeDayIdx === _di) _activeDayIdx = null;
      else if (_activeDayIdx > _di) _activeDayIdx--;
      dispatch(A.DAY_REMOVE, { di: _di });
      showToast('Tag entfernt', 'info');
      if (_activeTab === 'settings') renderSettingsTab(getState());
      break;
    }

    case 'toggle-complete': {
      dispatch(A.DAY_TOGGLE_COMPLETE, { di: +di });
      // Read updated state to get new locked value
      const day = getState().weeks[getState().curIdx]?.days[+di];
      showToast(day?.markedDone ? 'Tag gesperrt 🔒' : 'Tag entsperrt 🔓', 'info');
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
    case 'toggle-cfg':
      dispatch(A.EX_TOGGLE_CFG, { di: +di, ei: +ei }); break;

    case 'set-pause':
      dispatch(A.EX_UPDATE, { di: +di, ei: +ei, field: 'pauseSec', value: +sec }); break;

    case 'remove-ex':
      if (confirm('Übung entfernen?')) {
        dispatch(A.EX_REMOVE, { di: +di, ei: +ei });
      }
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
      dispatch(A.EX_INC_WEIGHT, { di: +di, ei: +ei });
      const ex = getState().weeks[getState().curIdx].days[di].exercises[ei];
      
      if (ex.nextWeekPlan === 0) {
        showToast(`Planung für nächste Woche zurückgesetzt`, 'ok');
      } else {
        showToast(`+${ex.nextWeekPlan} kg für nächste Woche geplant!`, 'ok');
      }
      break;
    }

    case 'set-step': {
      const step = parseFloat(el.dataset.step);
      dispatch(A.EX_SET_STEP, { di: +di, ei: +ei, step });
      break;
    }

    case 'set-settype': {
      const _val = el.dataset.val;
      if (_val === 'straight' || _val === 'pyramid') {
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
      // Validate only when marking pending → success (not when un-doing)
      if (_s && _s.status === 'pending') {
        const _wInp = document.querySelector(`[data-action="set-weight"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
        const _rInp = document.querySelector(`[data-action="set-reps"][data-di="${di}"][data-ei="${ei}"][data-si="${si}"]`);
        const _rVal = parseFloat(_rInp?.value);
        if (!Number.isFinite(_rVal) || _rVal <= 0) {
          showToast('Bitte zuerst Wiederholungen eintragen ✋', 'warn'); break;
        }
        // Flush uncommitted input values to state before toggling
        if (_wInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'weight', value: _wInp.value });
        if (_rInp) dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'reps',   value: _rInp.value });
      }
      dispatch(A.SET_TOGGLE_DONE, { di: +di, ei: +ei, si: +si });
      break;
    }

    case 'remove-set':
      dispatch(A.SET_REMOVE, { di: +di, ei: +ei, si: +si }); break;

    case 'add-set':
      dispatch(A.SET_ADD, { di: +di, ei: +ei }); break;

    // RPE button group (3.8)
    case 'set-rpe-val': {
      const rpeVal = el.dataset.val === '' ? null : +el.dataset.val;
      dispatch(A.SET_UPDATE, { di: +di, ei: +ei, si: +si, field: 'rpe', value: rpeVal });
      // Scroll selected button into view after re-render (1.1)
      setTimeout(() => {
        const sel = document.querySelector(
          `.rpe-btns[data-di="${di}"][data-ei="${ei}"][data-si="${si}"] .rpe-btn.is-selected`
        );
        sel?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }, 50);
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
      exportJSON();
      showToast('JSON-Backup wird heruntergeladen …', 'ok'); break;

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
      importJSON(file)
        .then(() => showToast('Backup importiert ✓', 'ok'))
        .catch(err => showToast(`Fehler: ${err.message}`, 'warn'));
      el.value = '';
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

// ─── Day tab toggle ───────────────────────────────────────────────────────────
function _toggleAccordion(di) {
  _activeDayIdx = _activeDayIdx === di ? null : di;
  scheduleRender();
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
        if (!ex.targetSets || !ex.targetReps) continue;
        const successSets = ex.sets.filter(s => s.status === 'success');
        const allMetTarget = successSets.length >= ex.targetSets
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
  ${suggestHtml}`;

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
function _bindTabSwitcher() {
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      _activeTab = tab;

      document.querySelectorAll('[data-tab]').forEach(b =>
        b.classList.toggle('is-active', b.dataset.tab === tab)
      );
      document.querySelectorAll('[data-tab]').forEach(b =>
        b.setAttribute('aria-selected', b.dataset.tab === tab)
      );
      document.querySelectorAll('.page').forEach(p =>
        p.classList.toggle('is-active', p.id === `page-${tab}`)
      );

      const state = getState();
      if (tab === 'body')     renderBodyTab(state);
      if (tab === 'analysis') renderAnalysisTab(state);
      if (tab === 'settings') renderSettingsTab(state);
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════
// FULL RENDER (called by subscriber on every state change)
// ════════════════════════════════════════════════════════════════════════════

let _renderScheduled = false;

function scheduleRender() {
  if (_renderScheduled) return;
  _renderScheduled = true;
  requestAnimationFrame(() => {
    _renderScheduled = false;
    const state = getState();
    renderWeekHeader(state);
    renderDayList(state);
    if (_activeTab === 'body')     renderBodyTab(state);
    if (_activeTab === 'analysis') renderAnalysisTab(state);
    if (_activeTab === 'settings') renderSettingsTab(state);
  });
}

// ════════════════════════════════════════════════════════════════════════════
// DOM SCAFFOLD (built once in mountApp)
// ════════════════════════════════════════════════════════════════════════════

function _buildScaffold(root) {
  root.innerHTML = `
<nav class="nav" role="navigation" aria-label="Hauptnavigation">
  <span class="nav__logo" aria-hidden="true">TRAIN</span>
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
    <button class="week-nav__btn" id="btn-next-wk" data-action="nav-next"
      aria-label="Nächste Woche">${ic.chevronRight()}</button>
  </div>

  <div class="toolbar" role="toolbar" aria-label="Wochenaktionen">
    <div class="mode-pill" role="group" aria-label="Trainingsmodus">
      <button class="mode-pill__btn mode-pill__btn--std is-active"
        id="mode-std" data-action="mode-std" aria-pressed="true">Standard</button>
      <button class="mode-pill__btn mode-pill__btn--dl"
        id="mode-dl" data-action="mode-dl" aria-pressed="false">
        ${ic.zap()}&thinsp;Deload</button>
    </div>
    <span class="toolbar__spacer"></span>
    <button class="toolbar__btn" id="btn-undo" data-action="undo"
      aria-label="Rückgängig machen" disabled>${ic.undo()}</button>
    <button class="toolbar__btn toolbar__btn--accent" data-action="open-new-week"
      aria-label="Neue Trainingswoche erstellen">${ic.plus()}</button>
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
      Alle Trainingsdaten dieser Woche werden unwiderruflich gelöscht.</p>
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
    exportJSON();
    showToast('JSON-Backup wird heruntergeladen …', 'ok');
  });

  _bindEvents(root);
  _bindTabSwitcher();
  _initSwipe(root);

  subscribe(scheduleRender);

  window.addEventListener('train:storage-error', () => {
    _storageWarn?.classList.add('is-visible');
  });

  scheduleRender();

  // Auto-backup reminder (3.11): toast if >30 days since last backup
  setTimeout(() => {
    const st   = getState();
    const last = st.settings?.lastBackupDate;
    if (!last) {
      showToast('Tipp: Erstelle regelmäßig ein JSON-Backup (Einstellungen → Daten).', 'warn');
    } else {
      const daysSince = Math.floor((Date.now() - new Date(last)) / 86_400_000);
      if (daysSince > 30) {
        showToast(`Letztes Backup vor ${daysSince} Tagen – jetzt sichern!`, 'warn');
      }
    }

    // 3.3: Fatigue hint – 3 consecutive sessionRating=1 sessions
    const lastHint = st.settings?.lastFatigueHintDate;
    const daysSinceHint = lastHint ? Math.floor((Date.now() - new Date(lastHint)) / 86_400_000) : Infinity;
    if (daysSinceHint >= 7) {
      const sorted = [...st.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
      const doneDays = sorted.flatMap(w => w.days.filter(d => d.markedDone));
      const last3    = doneDays.slice(-3);
      if (last3.length === 3 && last3.every(d => d.sessionRating === 1)) {
        const today = new Date().toISOString().split('T')[0];
        dispatch(A.SETTING_SET, { key: 'lastFatigueHintDate', value: today });
        showToast(
          'In deinen letzten 3 Einheiten hast du \'Erschöpft\' gewählt – plane eine Erholungswoche ein.',
          'warn', 5000
        );
      }
    }
  }, 2000);
}
