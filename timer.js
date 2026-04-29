/**
 * timer.js – Step 3: all timer logic for TRAIN.
 *
 * Provides:
 *   mountTimer()         – call once after mountApp(). Injects the timer
 *                          overlay DOM and hooks into the existing #app
 *                          event delegation system via custom events.
 *
 * Session clock
 * ─────────────
 * • Starts on the FIRST real training interaction:
 *     – User clicks the warmup textarea (triggers 'train:warmup-click')
 *     – User checks a set done (triggers 'train:set-done')
 *     – User edits any set field (triggers 'train:set-input')
 *   NOT started by merely opening/closing an accordion, which is a
 *   common "just browsing the plan" interaction.
 * • Stopped (and logged to state) when the user presses the
 *   "Als abgeschlossen markieren" button (DAY_TOGGLE_COMPLETE action)
 *   OR when the user taps the clock display to manually stop/start.
 * • Displayed in the toolbar as a live "00:00" counter.
 * • On week change the clock resets automatically.
 *
 * Pause timer
 * ───────────
 * • Triggered automatically after every set is marked done.
 * • Duration comes from the exercise's `pauseSec` field (30 / 60 / 90 / 120).
 * • Shows a floating pill overlay with a countdown ring and dismiss button.
 * • When countdown reaches 0 a full-screen "WEITER! 💪" popup flashes
 *   for exactly 3 seconds then disappears on its own (no user action needed).
 * • Tapping the overlay before countdown ends dismisses the pause early.
 * • Starting a new pause (next set checked) cancels any running pause.
 *
 * Manual timer control
 * ────────────────────
 * • Tapping the "00:00" clock display in the toolbar starts the timer
 *   if not running, or stops + logs it if running.
 * • Visual feedback: clock turns accent-green when running.
 */

import { dispatch, subscribe, getState, A } from './state.js';

// ─── Module state ─────────────────────────────────────────────────────────────

let _sessStart    = null;   // Date.now() when session started, null if stopped
let _sessRAF      = null;   // requestAnimationFrame handle for clock display
let _pauseEnd     = null;   // Date.now() + pauseMs when pause started
let _pauseRAF     = null;   // rAF handle for pause countdown
let _pauseSec     = 90;     // current pause duration in seconds
let _goTimer      = null;   // setTimeout handle for "WEITER!" popup auto-hide
let _lastWeekIdx  = null;   // detect week navigation to reset clock

// ─── DOM element references (set in mountTimer) ───────────────────────────────

let _clockEl      = null;   // <button> displaying "00:00" in toolbar
let _pauseOverlay = null;   // floating pause pill
let _pauseNumEl   = null;   // number inside pause ring
let _pauseRingEl  = null;   // SVG circle for countdown ring
let _goPopup      = null;   // "WEITER!" full-screen popup

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _pad(n) { return String(n).padStart(2, '0'); }

function _fmt(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${_pad(m)}:${_pad(s)}`;
}

// ─── Session clock ────────────────────────────────────────────────────────────

function _tickClock() {
  if (!_sessStart || !_clockEl) return;
  const elapsed = Math.floor((Date.now() - _sessStart) / 1000);
  _clockEl.textContent = _fmt(elapsed);
  _sessRAF = requestAnimationFrame(_tickClock);
}

function _startSession() {
  if (_sessStart !== null) return;
  _sessStart = Date.now();
  _clockEl?.classList?.add('timer-clock--running');
  _clockEl?.setAttribute?.('aria-label', 'Session-Timer läuft – Tippen zum Stoppen');
  _sessRAF = requestAnimationFrame(_tickClock);
}

function _stopSession() {
  if (_sessStart === null) return;
  const duration = Math.round((Date.now() - _sessStart) / 1000);
  const time     = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  dispatch(A.SESSION_STOP, { duration, time });
  cancelAnimationFrame(_sessRAF);
  _sessStart = null;
  if (_clockEl) {
    if (typeof _clockEl.textContent !== 'undefined') _clockEl.textContent = '00:00';
    _clockEl.classList?.remove('timer-clock--running');
    _clockEl.setAttribute?.('aria-label', 'Session-Timer – Tippen zum Starten');
  }
}

/** Called when user taps the clock element in the toolbar. */
function _manualToggle() {
  if (_sessStart !== null) _stopSession();
  else _startSession();
}

// ─── Pause timer ──────────────────────────────────────────────────────────────

const RING_RADIUS     = 14;   // SVG circle radius
const RING_CIRCUMF    = 2 * Math.PI * RING_RADIUS;  // ≈ 87.96

function _tickPause() {
  if (!_pauseEnd || !_pauseNumEl) return;

  const remaining = Math.max(0, Math.ceil((_pauseEnd - Date.now()) / 1000));

  // Update countdown number
  _pauseNumEl.textContent = remaining;

  // Update SVG ring stroke-dashoffset (full = 0 offset, empty = full circumference)
  if (_pauseRingEl) {
    const elapsed  = _pauseSec - remaining;
    const progress = Math.min(elapsed / _pauseSec, 1);
    const offset   = RING_CIRCUMF * (1 - progress);
    _pauseRingEl.style.strokeDashoffset = offset;
  }

  if (remaining <= 0) {
    _pauseEnd = null;
    _hidePauseOverlay();
    _showGoPopup();
    return;
  }

  _pauseRAF = requestAnimationFrame(_tickPause);
}

function _startPause(seconds) {
  // Cancel any existing pause
  cancelAnimationFrame(_pauseRAF);
  clearTimeout(_goTimer);
  _goPopup?.classList?.remove('go-popup--visible');

  _pauseSec = seconds;
  _pauseEnd = Date.now() + seconds * 1000;

  // Reset ring
  if (_pauseRingEl && _pauseRingEl.style) {
    _pauseRingEl.style.strokeDashoffset = RING_CIRCUMF;
  }

  _showPauseOverlay();
  _pauseRAF = requestAnimationFrame(_tickPause);
}

function _dismissPause() {
  cancelAnimationFrame(_pauseRAF);
  _pauseEnd = null;
  _hidePauseOverlay();
}

function _showPauseOverlay() {
  _pauseOverlay?.classList?.add('pause-overlay--visible');
  _pauseOverlay?.setAttribute?.('aria-hidden', 'false');
}

function _hidePauseOverlay() {
  _pauseOverlay?.classList?.remove('pause-overlay--visible');
  _pauseOverlay?.setAttribute?.('aria-hidden', 'true');
}

function _showGoPopup() {
  if (!_goPopup) return;
  _goPopup.classList?.add('go-popup--visible');
  clearTimeout(_goTimer);
  _goTimer = setTimeout(() => {
    _goPopup.classList?.remove('go-popup--visible');
  }, 3000);
}

// ─── Subscribe to state changes ───────────────────────────────────────────────
//
// We watch for week navigation (curIdx change) to auto-reset the clock.

let _prevCurIdx = null;
function _onStateChange(state) {
  if (_prevCurIdx !== null && _prevCurIdx !== state.curIdx) {
    // Week changed – stop any running session (don't log it, it belongs to old week)
    cancelAnimationFrame(_sessRAF);
    _sessStart = null;
    if (_clockEl) {
      _clockEl.textContent = '00:00';
      _clockEl.classList.remove('timer-clock--running');
    }
    _dismissPause();
  }
  _prevCurIdx = state.curIdx;
}

// ─── Custom event listeners wired from ui.js ──────────────────────────────────
//
// ui.js doesn't import timer.js directly (avoids circular dependency).
// Instead it fires custom DOM events on window, and timer.js listens here.

function _bindCustomEvents() {
  // Fired by ui.js when user marks a set as done
  window.addEventListener('train:set-done', e => {
    _startSession();
    const { pauseSec } = e.detail ?? {};
    if (typeof pauseSec === 'number' && pauseSec > 0) {
      _startPause(pauseSec);
    }
  });

  // Fired by ui.js on any set input (weight/reps/rpe change)
  window.addEventListener('train:set-input', () => {
    _startSession();
  });

  // Fired by ui.js when user clicks inside the warmup textarea
  window.addEventListener('train:warmup-click', () => {
    _startSession();
  });

  // Fired by ui.js when the "Abgeschlossen & sperren" button is tapped
  window.addEventListener('train:day-complete', () => {
    _stopSession();
  });

  // Fired from index.html when SW has an update ready – show a toast via ui.js
  window.addEventListener('train:show-update-banner', () => {
    // Timer module just forwards this; ui.js will handle the toast if subscribed
    window.dispatchEvent(new CustomEvent('train:toast', {
      detail: { msg: 'Update verfügbar – bitte neu laden', type: 'info' },
    }));
  });
}

// ─── Build overlay DOM ────────────────────────────────────────────────────────

function _buildOverlayDOM() {
  // ── Pause overlay ──────────────────────────────────────────────────────────
  //
  // Floating pill in the bottom-right corner.
  // Structure: [ring svg] [label] [dismiss button]
  const overlay = document.createElement('div');
  overlay.id = 'pause-overlay';
  overlay.className = 'pause-overlay';
  overlay.setAttribute('role', 'timer');
  overlay.setAttribute('aria-label', 'Pausentimer');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.setAttribute('aria-live', 'off');

  overlay.innerHTML = `
    <button
      class="pause-overlay__dismiss"
      aria-label="Pause beenden"
      id="pause-dismiss-btn"
    >
      <!-- SVG countdown ring -->
      <svg
        class="pause-ring"
        viewBox="0 0 36 36"
        aria-hidden="true"
        focusable="false"
      >
        <!-- Track -->
        <circle
          class="pause-ring__track"
          cx="18" cy="18" r="${RING_RADIUS}"
          fill="none"
          stroke-width="3"
        />
        <!-- Progress arc – dashoffset animated by JS -->
        <circle
          class="pause-ring__arc"
          id="pause-ring-arc"
          cx="18" cy="18" r="${RING_RADIUS}"
          fill="none"
          stroke-width="3"
          stroke-dasharray="${RING_CIRCUMF}"
          stroke-dashoffset="${RING_CIRCUMF}"
          stroke-linecap="round"
          transform="rotate(-90 18 18)"
        />
        <!-- Countdown number inside ring -->
        <text
          class="pause-ring__num"
          id="pause-ring-num"
          x="18" y="18"
          text-anchor="middle"
          dominant-baseline="central"
        >90</text>
      </svg>
    </button>
    <div class="pause-overlay__label">
      <strong>Pause</strong>
      <span>Tippen zum Beenden</span>
    </div>
  `;

  // ── "WEITER!" go-popup ────────────────────────────────────────────────────
  const goPopup = document.createElement('div');
  goPopup.id        = 'go-popup';
  goPopup.className = 'go-popup';
  goPopup.setAttribute('role', 'alert');
  goPopup.setAttribute('aria-live', 'assertive');
  goPopup.setAttribute('aria-atomic', 'true');
  goPopup.innerHTML = `
    <span class="go-popup__text">WEITER!</span>
    <span class="go-popup__emoji" aria-hidden="true">💪</span>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(goPopup);

  return { overlay, goPopup };
}

// ─── Inject CSS ───────────────────────────────────────────────────────────────
//
// Timer-specific styles are injected here so timer.js is self-contained.
// They use the same CSS custom properties defined in styles.css.

function _injectStyles() {
  const style = document.createElement('style');
  style.textContent = `
  /* ── Session clock in toolbar ─────────────────────────── */
  .timer-clock {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--font-display);
    font-size: 18px;
    letter-spacing: .08em;
    color: var(--c-text-3);
    background: none;
    border: 1px solid transparent;
    border-radius: var(--r-md);
    padding: 0 var(--sp-2);
    min-height: var(--touch);
    cursor: pointer;
    transition: color var(--t-fast), border-color var(--t-fast);
    line-height: 1;
    white-space: nowrap;
  }
  .timer-clock svg { width: 16px; height: 16px; flex-shrink: 0; }
  .timer-clock:hover {
    color: var(--c-text-2);
    border-color: var(--c-border);
  }
  .timer-clock--running {
    color: var(--c-accent);
    border-color: color-mix(in srgb, var(--c-accent) 30%, transparent);
    animation: timer-pulse 2s ease-in-out infinite;
  }
  @keyframes timer-pulse {
    0%, 100% { opacity: 1; }
    50%       { opacity: .7; }
  }

  /* ── Pause overlay ────────────────────────────────────── */
  .pause-overlay {
    position: fixed;
    bottom: 88px;
    right: 16px;
    z-index: 450;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--c-surface);
    border: 1px solid var(--c-accent);
    border-radius: var(--r-lg);
    padding: 10px 16px 10px 10px;
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateY(8px) scale(.96);
    pointer-events: none;
    transition:
      opacity 200ms var(--ease),
      transform 200ms var(--ease);
  }
  .pause-overlay--visible {
    opacity: 1;
    transform: translateY(0) scale(1);
    pointer-events: auto;
  }
  .pause-overlay__dismiss {
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
    line-height: 0;
    /* Touch target */
    width: 44px; height: 44px;
    display: flex; align-items: center; justify-content: center;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background var(--t-fast);
  }
  .pause-overlay__dismiss:hover { background: var(--c-surface2); }

  /* SVG ring */
  .pause-ring {
    width: 40px; height: 40px;
    display: block;
  }
  .pause-ring__track { stroke: var(--c-border); }
  .pause-ring__arc   { stroke: var(--c-accent); transition: stroke-dashoffset 1s linear; }
  .pause-ring__num   {
    font-family: var(--font-display);
    font-size: 10px;
    fill: var(--c-text);
    letter-spacing: 0;
  }

  .pause-overlay__label {
    display: flex;
    flex-direction: column;
    gap: 1px;
    font-size: 12px;
    color: var(--c-text-2);
    min-width: 0;
  }
  .pause-overlay__label strong {
    font-size: 14px;
    color: var(--c-text);
    display: block;
  }

  /* ── "WEITER!" popup ────────────────────────────────────── */
  .go-popup {
    position: fixed;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%) scale(.8);
    z-index: 600;
    background: var(--c-accent);
    color: #000;
    border-radius: var(--r-xl);
    padding: 20px 40px;
    text-align: center;
    pointer-events: none;
    opacity: 0;
    transition: opacity 200ms var(--ease), transform 200ms var(--ease);
  }
  .go-popup--visible {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1);
    animation: go-pop-out 200ms var(--ease) 2.8s forwards;
  }
  @keyframes go-pop-out {
    to { opacity: 0; transform: translate(-50%, -50%) scale(.9); }
  }
  .go-popup__text {
    display: block;
    font-family: var(--font-display);
    font-size: clamp(32px, 8vw, 52px);
    letter-spacing: .15em;
    line-height: 1;
  }
  .go-popup__emoji {
    display: block;
    font-size: clamp(24px, 6vw, 36px);
    margin-top: 4px;
  }
  `;
  document.head.appendChild(style);
}

// ─── Wire pause overlay dismiss ───────────────────────────────────────────────

function _bindOverlayEvents(overlay) {
  // Dismiss button inside overlay
  document.getElementById('pause-dismiss-btn')?.addEventListener('click', e => {
    e.stopPropagation();
    _dismissPause();
  });
  // Tapping anywhere on the overlay also dismisses
  overlay.addEventListener('click', _dismissPause);
}

// ─── Wire clock into toolbar ──────────────────────────────────────────────────
//
// The toolbar is rendered by ui.js inside #app.  We wait for it with a
// MutationObserver rather than polling, so we don't miss a fast render.

function _attachClockToToolbar() {
  const tryAttach = () => {
    const toolbar = document.querySelector('.toolbar');
    if (!toolbar || document.getElementById('session-clock')) return false;

    const clockBtn = document.createElement('button');
    clockBtn.id        = 'session-clock';
    clockBtn.className = 'timer-clock';
    clockBtn.setAttribute('aria-label', 'Session-Timer – Tippen zum Starten');
    clockBtn.setAttribute('aria-live', 'off');
    clockBtn.innerHTML = `
      <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
        stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
      <span>00:00</span>
    `;
    clockBtn.addEventListener('click', _manualToggle);

    // Insert before the first toolbar__btn (after the spacer, before ＋)
    const firstBtn = toolbar.querySelector('.toolbar__btn');
    toolbar.insertBefore(clockBtn, firstBtn);

    _clockEl = clockBtn.querySelector('span');
    return true;
  };

  if (!tryAttach()) {
    const observer = new MutationObserver(() => {
      if (tryAttach()) observer.disconnect();
    });
    observer.observe(document.getElementById('app') ?? document.body, {
      childList: true, subtree: true,
    });
  }
}

// ─── Wire training interactions from ui.js ────────────────────────────────────
//
// ui.js fires DOM events on `window` at the right moments.
// We re-dispatch them to our handler functions here.
//
// Additionally, we patch the ui.js event delegation by hooking into the
// existing #app click listener via a capturing listener. This avoids
// any import cycle: timer.js imports state.js only, not ui.js.

function _bindAppInteractions() {
  const app = document.getElementById('app');
  if (!app) return;

  app.addEventListener('click', e => {
    // Set done button
    const doneBtn = e.target.closest('[data-action="toggle-done"]');
    if (doneBtn) {
      // Read the exercise's pauseSec from state
      const state = getState();
      const di  = +doneBtn.dataset.di;
      const ei  = +doneBtn.dataset.ei;
      const ex  = state.weeks[state.curIdx]?.days?.[di]?.exercises?.[ei];
      const set = ex?.sets?.[+doneBtn.dataset.si];
      // Only start pause when marking as done (not un-done).
      // The click handler in ui.js already dispatched SET_TOGGLE_DONE,
      // so we read the NEW state (set.done flipped).
      // Use a microtask so state is already updated:
      queueMicrotask(() => {
        const newState = getState();
        const newSet   = newState.weeks[newState.curIdx]?.days?.[di]?.exercises?.[ei]?.sets?.[+doneBtn.dataset.si];
        if (newSet?.done) {
          window.dispatchEvent(new CustomEvent('train:set-done', {
            detail: { pauseSec: ex?.pauseSec ?? 90 },
          }));
        }
      });
    }

    // Warmup textarea – start session on first click
    const warmupArea = e.target.closest('[data-field="warmup"]');
    if (warmupArea) {
      window.dispatchEvent(new CustomEvent('train:warmup-click'));
    }

    // Day complete button – stop session
    const completeBtn = e.target.closest('[data-action="toggle-complete"]');
    if (completeBtn) {
      // Only stop if marking as done (check new state via microtask)
      queueMicrotask(() => {
        const di  = +completeBtn.dataset.di;
        const day = getState().weeks[getState().curIdx]?.days?.[di];
        if (day?.markedDone) {
          window.dispatchEvent(new CustomEvent('train:day-complete'));
        }
      });
    }
  }, { capture: false });

  // Set inputs – start session on any number entry
  app.addEventListener('input', e => {
    const inputEl = e.target;
    const action  = inputEl.dataset.action;
    if (
      action === 'set-weight' ||
      action === 'set-reps'   ||
      action === 'set-rpe'
    ) {
      window.dispatchEvent(new CustomEvent('train:set-input'));
    }
  });
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * mountTimer() – call once, after mountApp().
 *
 * Sets up all timer DOM, styles, and event bindings.
 * Returns an object with imperative control methods for testing.
 */
export function mountTimer() {
  // 1. Inject styles
  _injectStyles();

  // 2. Build overlay elements and append to <body>
  const { overlay, goPopup } = _buildOverlayDOM();
  _pauseOverlay = overlay;
  _goPopup      = goPopup;
  _pauseNumEl   = document.getElementById('pause-ring-num');
  _pauseRingEl  = document.getElementById('pause-ring-arc');

  // 3. Bind overlay dismiss
  _bindOverlayEvents(overlay);

  // 4. Attach the session clock to the toolbar (waits for ui.js render)
  _attachClockToToolbar();

  // 5. Subscribe to state for week-change detection
  subscribe(_onStateChange);

  // 6. Bind custom events from ui.js and index.html
  _bindCustomEvents();

  // 7. Wire direct interactions from #app clicks/inputs
  _bindAppInteractions();

  // 8. Return control API for tests / external use
  return {
    startSession:  _startSession,
    stopSession:   _stopSession,
    startPause:    _startPause,
    dismissPause:  _dismissPause,
    /** Returns elapsed session seconds, or null if not running. */
    getElapsed: () => _sessStart !== null
      ? Math.floor((Date.now() - _sessStart) / 1000)
      : null,
    /** Returns remaining pause seconds, or null if no pause running. */
    getPauseRemaining: () => _pauseEnd !== null
      ? Math.max(0, Math.ceil((_pauseEnd - Date.now()) / 1000))
      : null,
  };
}
