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
 *     – User actually types into the warmup textarea (triggers
 *       'train:warmup-input' on the textarea's 'input' event)
 *     – User checks a set done (triggers 'train:set-done')
 *     – User edits any set field (triggers 'train:set-input')
 *   NOT started by merely opening/closing an accordion, or by tapping/
 *   focusing/scrolling the warmup textarea without typing anything —
 *   both are "just browsing the plan" interactions. (Runde 18, Cluster 3:
 *   a bare click on the warmup field used to start the clock, which
 *   silently inflated the session duration for anyone who opened the app
 *   hours before actually training.)
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

import { dispatch, subscribe, getState, A, getLatestWeek, getEffectiveWeightStep } from './state.js';
import { buildSetFeedback } from './sessionCoach.js';
import { buildCategoryMap, isCompoundExercise, resolveCategory } from './movementMap.js';
import { PAUSE_TIPS_BY_CATEGORY } from './pauseTips.js';

// ─── Wake Lock ────────────────────────────────────────────────────────────────

let _wakeLock = null;

async function _acquireWakeLock() {
  if (!('wakeLock' in navigator) || _wakeLock) return;
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    // Re-acquire automatically if the page becomes visible again
    _wakeLock.addEventListener('release', () => { _wakeLock = null; });
  } catch (_) { /* not supported or permission denied — silent fail */ }
}

function _releaseWakeLock() {
  _wakeLock?.release().catch(() => {});
  _wakeLock = null;
}

// Re-acquire after tab becomes visible (wake lock drops on visibility change).
// B119: rAF is suspended while backgrounded, so the pause display freezes on
// its last-painted value; force an immediate resync (instead of waiting for
// the next natural frame) so the countdown — or the "done" transition, if the
// pause already elapsed while hidden — catches up right away.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && _pauseEnd) {
    _acquireWakeLock();
    cancelAnimationFrame(_pauseRAF);
    _tickPause();
  }
});

// Fallback when settings.maxSessionMs is unset — 3h, mirrors the settings
// default. Kept as a shared constant so _updateClockDisplay() and
// _stopSession() can't drift apart (Runde 38, F2).
const DEFAULT_MAX_SESSION_MS = 10800000;

// ─── Module state ─────────────────────────────────────────────────────────────

let _sessInterval = null;   // setInterval handle for clock display (display-only)
let _clockDi      = null;   // active day index (which day's sessionStartTs we're watching)
let _pauseEnd     = null;   // Date.now() + pauseMs when pause started
let _pauseRAF     = null;   // rAF handle for pause countdown
let _pauseSec     = 90;     // current pause duration in seconds
let _goTimer      = null;   // setTimeout handle for "WEITER!" popup auto-hide
let _lastWeekIdx  = null;   // detect week navigation to reset clock
// Runde 20 (Befund 11): welcher Satz (`${di}-${ei}-${si}`) die aktuell
// laufende Pause ausgelöst hat -- train:pause-restart darf den Timer nur
// neu starten, wenn er noch zu GENAU diesem Satz gehört (verhindert, dass
// eine nachträgliche RPE-Korrektur an einem älteren Satz den Timer eines
// inzwischen schon laufenden späteren Satzes zurückdreht).
let _pauseSetKey  = null;

// Runde 17 (Cluster 2, soundEnabled): einziger AudioContext der App, lazy
// erzeugt. Absichtlich erst beim Pausenstart (echter Klick-Kontext) erzeugt/
// resumed statt beim Sound selbst (Timer-Callback) -- siehe _unlockAudioContext().
let _audioCtx     = null;

// ─── DOM element references (set in mountTimer) ───────────────────────────────

let _clockEl      = null;   // <button> displaying "00:00" in toolbar
let _pauseOverlay = null;   // floating pause pill
let _pauseNumEl   = null;   // number inside pause ring
let _pauseRingEl  = null;   // SVG circle for countdown ring
let _pauseTipEl   = null;   // Runde 21: kategorie-gebundener Trainings-Tipp
let _lastPauseTipTitle = null; // verhindert unmittelbare Wiederholung, rein modul-lokal
let _goPopup      = null;   // "WEITER!" full-screen popup

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _pad(n) { return String(n).padStart(2, '0'); }

function _fmt(totalSeconds) {
  if (totalSeconds >= 3600) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h}:${_pad(m)}:${_pad(s)}`;
  }
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${_pad(m)}:${_pad(s)}`;
}

// ─── Session clock (timestamp-based, D1) ─────────────────────────────────────

function _getActiveDay() {
  const st  = getState();
  const wk  = st.weeks[st.curIdx];
  if (!wk) return null;
  if (_clockDi !== null && wk.days[_clockDi]) return wk.days[_clockDi];
  // Fallback: first day with a running session (started but not ended)
  return wk.days.find(d => d.sessionStartTs && !d.sessionEndTs) ?? null;
}

function _updateClockDisplay() {
  if (!_clockEl) return;
  const day = _getActiveDay();
  const maxMs = (getState().settings?.maxSessionMs ?? DEFAULT_MAX_SESSION_MS);
  if (!day?.sessionStartTs || day.sessionEndTs) {
    if (_sessInterval) { clearInterval(_sessInterval); _sessInterval = null; }
    if (day?.sessionStartTs && day.sessionEndTs) {
      // Freeze at elapsed duration when session ended
      const elapsed = Math.min(day.sessionEndTs - day.sessionStartTs, maxMs);
      _clockEl.textContent = _fmt(Math.floor(elapsed / 1000));
    } else {
      _clockEl.textContent = '00:00';
    }
    _clockEl.classList.remove('toolbar-timer--running');
    return;
  }
  const elapsed = Math.min(Date.now() - day.sessionStartTs, maxMs);
  const seconds = Math.floor(elapsed / 1000);
  _clockEl.textContent = '● ' + _fmt(seconds);
  _clockEl.classList.add('toolbar-timer--running');
  if (elapsed >= maxMs && _sessInterval) {
    clearInterval(_sessInterval);
    _sessInterval = null;
  }
}

function _ensureSessionStart(di) {
  const st  = getState();
  const wk  = st.weeks[st.curIdx];
  const day = wk?.days[di];
  if (!day || day.sessionStartTs || day.markedDone) return;
  _clockDi = di;
  dispatch(A.SESSION_START, { di, ts: Date.now() });
  // B62 (Runde 13): ursprünglich der EINZIGE SW-Registrierungs-Trigger, seit
  // Runde 20 (Befund 4) nur noch ein zusätzlicher, redundanter Trigger --
  // der eigentliche Trigger läuft jetzt Idle-verzögert bei jedem App-Start
  // (mountTimer(), timer.js), unabhängig von einer Trainingsaktion. Bleibt
  // hier bestehen als Fallback (z.B. falls requestIdleCallback ungewöhnlich
  // spät feuert) -- harmlos dank { once: true } in index.html.
  // index.html hört dieses Event ab (timer.js darf ui.js nicht importieren).
  window.dispatchEvent(new CustomEvent('train:sw-register-trigger'));
  if (!_sessInterval) {
    _sessInterval = setInterval(_updateClockDisplay, 1000);
  }
  _updateClockDisplay();
}

function _stopSession() {
  const day = _getActiveDay();
  if (!day?.sessionStartTs || day.sessionEndTs) return;
  // Solotest-Feedback (2026-08-16): analog zur bereits gedeckelten
  // Live-Anzeige (_updateClockDisplay() unten) -- vorher wurde hier die
  // ungedeckelte Wanduhr-Differenz persistiert, eine nie sauber beendete
  // Session konnte den Ø-Session-Wert im Fortschritt-Tab massiv verzerren.
  const maxMs    = getState().settings?.maxSessionMs ?? DEFAULT_MAX_SESSION_MS;
  const duration = Math.min(Math.round((Date.now() - day.sessionStartTs) / 1000), Math.round(maxMs / 1000));
  const time     = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  dispatch(A.SESSION_STOP, { duration, time });
  if (_sessInterval) { clearInterval(_sessInterval); _sessInterval = null; }
  if (_clockEl) {
    _clockEl.textContent = '00:00';
    _clockEl.classList.remove('toolbar-timer--running');
  }
  // F1 (Runde 38): siehe _dismissPause() -- gleiche Lücke, falls die Uhr
  // manuell exakt im 3s-"WEITER!"-Fenster gestoppt wird.
  clearTimeout(_goTimer);
  _goPopup?.classList?.remove('go-popup--visible');
}

/** Called when user taps the clock element in the toolbar. */
function _manualToggle() {
  const day = _getActiveDay();
  if (day?.sessionStartTs && !day.sessionEndTs) _stopSession();
  else if (_clockDi !== null) _ensureSessionStart(_clockDi);
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
    _releaseWakeLock();
    const _st = getState();
    if (_st.settings.vibrationEnabled && navigator.vibrate) {
      navigator.vibrate([200, 100, 200]);
    }
    if (_st.settings.soundEnabled) _playPauseEndSound();
    _showGoPopup();
    return;
  }

  _pauseRAF = requestAnimationFrame(_tickPause);
}

// Runde 17 (Cluster 2, B209): Vibration nach Pause scheiterte auf manchen
// Android-Geräten strukturell -- navigator.vibrate() feuert aus _tickPause()
// (ein rAF-Loop), Sekunden bis Minuten nach der letzten echten Nutzer-Geste;
// moderne Chrome-Versionen verlangen dafür noch aktive ("transiente")
// User-Activation, die längst abgelaufen ist. Kein Implementierungsfehler,
// keine zuverlässige Reparatur möglich (siehe BUGS.md B209). Web Audios
// Autoplay-Policy basiert dagegen auf "sticky activation" (hält für die
// gesamte Seiten-Session) -- deshalb hier proaktiv beim Pausenstart
// (garantiert noch im Aktivierungsfenster des Klicks, der die Pause
// ausgelöst hat) erzeugt/resumed, nicht erst beim eigentlichen Sound.
function _unlockAudioContext() {
  if (!_audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    _audioCtx = new Ctx();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume().catch(() => {});
}

// Kurzer Zwei-Ton-Beep als Vibrations-Alternative -- kein neues Audio-Asset
// (kein Service-Worker-Precache-Eintrag nötig), reine Web-Audio-Synthese.
// Bekannte, nicht umgehbare Einschränkung: Browser können den System-
// Stumm-Modus (z.B. iOS-Stummschalter) nicht zuverlässig erkennen: der Ton
// kann lautlos "spielen", ohne dass die App das erkennen könnte.
function _playPauseEndSound() {
  if (!_audioCtx || _audioCtx.state !== 'running') return;
  const now = _audioCtx.currentTime;
  [0, 0.18].forEach(offset => {
    const osc  = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, now + offset);
    gain.gain.linearRampToValueAtTime(0.2, now + offset + 0.01);
    gain.gain.linearRampToValueAtTime(0, now + offset + 0.15);
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.start(now + offset);
    osc.stop(now + offset + 0.16);
  });
}

function _startPause(seconds) {
  // Cancel any existing pause
  cancelAnimationFrame(_pauseRAF);
  clearTimeout(_goTimer);
  _goPopup?.classList?.remove('go-popup--visible');
  if (getState().settings.soundEnabled) _unlockAudioContext();

  _pauseSec = seconds;
  _pauseEnd = Date.now() + seconds * 1000;

  // Reset ring
  if (_pauseRingEl && _pauseRingEl.style) {
    _pauseRingEl.style.strokeDashoffset = RING_CIRCUMF;
  }

  // B85: die echte Sekundenzahl SOFORT synchron schreiben, nicht erst beim
  // ersten requestAnimationFrame-Tick von _tickPause() -- sonst bleibt kurz
  // (bis zum nächsten Frame) der statische Platzhalter "90" aus dem
  // initialen Overlay-Markup sichtbar (_buildOverlayDOM()) bzw. bei einem
  // erneuten Start ohne kompletten Ablauf der zuvor angezeigte Countdown-
  // Rest. Auf einem langsameren/anders getakteten Client (CI-Runner,
  // gedrosseltes Gerät) kann diese Lücke groß genug sein, dass sie
  // tatsächlich wahrgenommen bzw. von einem Test ausgelesen wird, bevor
  // der rAF-Tick den korrekten Wert einträgt.
  if (_pauseNumEl) _pauseNumEl.textContent = seconds;

  _showPauseOverlay();
  _pauseRAF = requestAnimationFrame(_tickPause);
  _acquireWakeLock();
}

function _dismissPause() {
  cancelAnimationFrame(_pauseRAF);
  _pauseEnd = null;
  _pauseSetKey = null;
  _hidePauseOverlay();
  _releaseWakeLock();
  // F1 (Runde 38): auch ein bereits laufendes "WEITER!"-Popup mit aufräumen --
  // sonst blinkt es (bezogen auf die verlassene Pause) noch bis zu 3s auf der
  // neu angezeigten Woche weiter (selbstheilend, aber sichtbar inkonsistent).
  clearTimeout(_goTimer);
  _goPopup?.classList?.remove('go-popup--visible');
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
    // Week changed – clear local tracking; do NOT stop the old session
    // (it stays in state for that week, timer just stops ticking here)
    if (_sessInterval) { clearInterval(_sessInterval); _sessInterval = null; }
    _clockDi = null;
    if (_clockEl) {
      _clockEl.textContent = '00:00';
      _clockEl.classList.remove('toolbar-timer--running');
    }
    _dismissPause();
    // Check if the new week already has a running session to resume
    const wk  = state.weeks[state.curIdx];
    const day = wk?.days.find(d => d.sessionStartTs && !d.sessionEndTs);
    if (day) {
      _clockDi = wk.days.indexOf(day);
      _sessInterval = setInterval(_updateClockDisplay, 1000);
      _updateClockDisplay();
    }
  }
  _prevCurIdx = state.curIdx;
  // Keep display in sync when day is locked (session ended via DAY_TOGGLE_COMPLETE)
  _updateClockDisplay();
}

// ─── Custom event listeners wired from ui.js ──────────────────────────────────
//
// ui.js doesn't import timer.js directly (avoids circular dependency).
// Instead it fires custom DOM events on window, and timer.js listens here.

/**
 * Runde 21 (Kurzartikel-Feature): rendert einen kategorie-gebundenen
 * Trainings-Tipp ins Pause-Overlay. `key` ist dieselbe "${di}-${ei}-${si}"-
 * Kennung wie `_pauseSetKey` -- daraus wird die gerade trainierte Übung
 * nachgeschlagen, ihre Bewegungskategorie aufgelöst (movementMap.js) und
 * ein Tipp aus dem passenden Pool gewählt (Fallback `_generic`). Bewusst
 * NUR hier aufgerufen (train:set-done), NICHT im train:pause-restart-
 * Handler -- sonst würde eine nachträgliche RPE-Korrektur den Tipp mitten
 * in der laufenden Pause wechseln (siehe B242-Kommentar dort). Rotation
 * ist rein modul-lokal, kein state.js-Feld nötig.
 */
function _renderPauseTip(key) {
  if (!_pauseTipEl) return;
  const state = getState();
  if (state.settings?.showPauseTips === false) {
    _pauseTipEl.hidden = true;
    return;
  }
  const [di, ei] = (key ?? '').split('-');
  const ex = state.weeks[state.curIdx]?.days?.[+di]?.exercises?.[+ei];
  const category = ex ? resolveCategory(ex.name, buildCategoryMap(state.customExercises)) : null;
  const pool = (category && PAUSE_TIPS_BY_CATEGORY[category]?.length ? PAUSE_TIPS_BY_CATEGORY[category] : PAUSE_TIPS_BY_CATEGORY._generic);
  let tip = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && tip.title === _lastPauseTipTitle) {
    tip = pool[(pool.indexOf(tip) + 1) % pool.length];
  }
  _lastPauseTipTitle = tip.title;
  _pauseTipEl.innerHTML = `<span class="pause-overlay__tip-title">${tip.title}</span>${tip.body}`;
  _pauseTipEl.hidden = false;
}

function _bindCustomEvents() {
  // Fired by ui.js when user marks a set as done
  window.addEventListener('train:set-done', e => {
    const { pauseSec, di, key } = e.detail ?? {};
    if (di !== undefined) _ensureSessionStart(di);
    if (typeof pauseSec === 'number' && pauseSec > 0) {
      _pauseSetKey = key ?? null;
      _startPause(pauseSec);
      _renderPauseTip(key);
    }
  });

  // Runde 20 (Befund 11): fired by ui.js nach einer nachträglichen RPE-
  // Eingabe (RPE-Nudge/Popover/Autofill) -- der beim Bestätigen gestartete
  // Timer lief bis dahin mit dem generischen Fallback-Wert, weil RPE zu dem
  // Zeitpunkt noch fehlte. Nur anwenden, wenn der Timer noch zu GENAU dem
  // Satz gehört, der gerade das RPE bekommen hat (_pauseSetKey-Vergleich).
  window.addEventListener('train:pause-restart', e => {
    const { pauseSec, key } = e.detail ?? {};
    if (!key || key !== _pauseSetKey) return;
    if (typeof pauseSec === 'number' && pauseSec > 0) {
      _startPause(pauseSec);
    }
  });

  // Fired by ui.js on any set input (weight/reps/rpe change)
  window.addEventListener('train:set-input', e => {
    const { di } = e.detail ?? {};
    if (di !== undefined) _ensureSessionStart(di);
  });

  // Fired when the user actually TYPES into the warmup textarea (not on
  // mere click/focus — Runde 18, Cluster 3, see header comment above)
  window.addEventListener('train:warmup-input', e => {
    const { di } = e.detail ?? {};
    if (di !== undefined) _ensureSessionStart(di);
  });

  // A1: Fired by ui.js whenever the user switches the active/open day WITHIN
  // the same week (day-tab click, overview day card). _clockDi previously
  // only resynced on a WEEK change (_onStateChange below) — a pure day
  // switch left it pointing at whichever day last called
  // _ensureSessionStart(), so _getActiveDay() (and therefore the toolbar
  // clock display AND "Timer zurücksetzen") kept tracking the OLD day even
  // after the user switched to a different day that has its own,
  // independently-running session. Only resync if the NEWLY active day
  // itself actually has a running session (started, not ended) — otherwise
  // leave _clockDi alone so a session still running on another day (that
  // the user is just glancing away from) keeps ticking on the toolbar, same
  // as before this fix.
  window.addEventListener('train:active-day-change', e => {
    const { di } = e.detail ?? {};
    if (di === undefined || di === null) return;
    const st  = getState();
    const wk  = st.weeks[st.curIdx];
    const day = wk?.days[di];
    if (day?.sessionStartTs && !day.sessionEndTs) {
      _clockDi = di;
      if (!_sessInterval) _sessInterval = setInterval(_updateClockDisplay, 1000);
      _updateClockDisplay();
    }
  });

  // Fired by ui.js when the "Abgeschlossen & sperren" button is tapped
  window.addEventListener('train:day-complete', () => {
    // Session is ended by DAY_TOGGLE_COMPLETE writing sessionEndTs
    // We just stop the interval display here
    if (_sessInterval) { clearInterval(_sessInterval); _sessInterval = null; }
    _updateClockDisplay();
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
    <div class="pause-overlay__row">
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
        <span aria-live="polite">Tippen zum Beenden</span>
      </div>
    </div>
    <div class="pause-overlay__tip" id="pause-tip" hidden></div>
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
  /* ── Session timer in toolbar ────────────────────────── */
  .toolbar-timer {
    font-family: var(--font-display);
    font-size: 16px;
    letter-spacing: .06em;
    color: var(--c-text-3);
    cursor: pointer;
    padding: 0 var(--sp-2);
    min-height: var(--touch);
    display: inline-flex;
    align-items: center;
    line-height: 1;
    white-space: nowrap;
    transition: color var(--t-fast);
    user-select: none;
  }
  .toolbar-timer:hover { color: var(--c-text-2); }
  .toolbar-timer--running {
    color: var(--c-accent);
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
    flex-direction: column;
    align-items: stretch;
    background: var(--c-surface);
    border: 1px solid var(--c-accent);
    border-radius: var(--r-lg);
    padding: 10px 16px 10px 10px;
    box-shadow: var(--shadow-lg);
    opacity: 0;
    transform: translateY(8px) scale(.96);
    pointer-events: none;
    min-width: 220px;
    max-width: 280px;
    transition:
      opacity 200ms var(--ease),
      transform 200ms var(--ease);
  }
  .pause-overlay__row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  /* Runde 21 (Kurzartikel-Feature): kurzer, kategorie-gebundener
     Trainings-Tipp, nur sichtbar solange die Pause läuft. */
  .pause-overlay__tip {
    font-size: 11px;
    line-height: 1.4;
    color: var(--c-text-3);
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--c-border);
  }
  .pause-overlay__tip[hidden] { display: none; }
  .pause-overlay__tip-title { color: var(--c-text-2); font-weight: 600; display: block; margin-bottom: 2px; }
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
    min-width: 120px;
  }
  .pause-overlay__label span { white-space: nowrap; }
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
//
// Protection against accidental taps: the dismiss button requires two taps
// within 2 seconds. The first tap shows a "tap again" hint; the second confirms.

let _dismissTapAt = 0;

function _bindOverlayEvents(overlay) {
  const btn = document.getElementById('pause-dismiss-btn');
  if (!btn) return;

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const now = Date.now();
    if (now - _dismissTapAt < 2000) {
      // Second tap within 2 s → dismiss
      _dismissTapAt = 0;
      _dismissPause();
    } else {
      // First tap → show confirmation hint
      _dismissTapAt = now;
      const hint = overlay.querySelector('.pause-overlay__label span');
      if (hint) {
        const original = hint.textContent;
        hint.textContent = 'Nochmal tippen ✓';
        hint.style.color = 'var(--c-accent)';
        setTimeout(() => {
          hint.textContent  = original;
          hint.style.color  = '';
          _dismissTapAt = 0;
        }, 2000);
      }
    }
  });
  // Intentionally no overlay-level click handler — only the button dismisses.
}

// ─── Wire clock into toolbar ──────────────────────────────────────────────────
//
// The toolbar is rendered by ui.js inside #app.  We wait for it with a
// MutationObserver rather than polling, so we don't miss a fast render.

function _attachClockToToolbar() {
  const tryAttach = () => {
    const el = document.getElementById('toolbar-session-timer');
    if (!el || el === _clockEl) return;
    el.removeEventListener('click', _manualToggle);
    el.addEventListener('click', _manualToggle);
    _clockEl = el;
    // Restore visual state from persisted state (survives app-close/reopen).
    // A1: this callback re-fires on EVERY re-render that recreates the
    // toolbar DOM node (MutationObserver on #app — far more often than an
    // actual app reopen), so it must NOT unconditionally re-derive _clockDi
    // via the "first day with a running session" fallback every time --
    // that clobbered the more specific resyncs above (day-tab switch,
    // 'train:active-day-change') on the very next render, since it doesn't
    // know a specific day was just deliberately selected/reset. Only fall
    // back to that array-order guess if _clockDi isn't already pointing at
    // an existing day — same precedence _getActiveDay() itself uses.
    const st  = getState();
    const wk  = st.weeks[st.curIdx];
    if (_clockDi === null || !wk?.days[_clockDi]) {
      const day = wk?.days.find(d => d.sessionStartTs && !d.sessionEndTs);
      if (day) _clockDi = wk.days.indexOf(day);
    }
    const activeDay = _clockDi !== null ? wk?.days[_clockDi] : null;
    if (activeDay?.sessionStartTs && !activeDay.sessionEndTs && !_sessInterval) {
      _sessInterval = setInterval(_updateClockDisplay, 1000);
    }
    _updateClockDisplay();
  };

  tryAttach();
  const observer = new MutationObserver(tryAttach);
  observer.observe(document.getElementById('app') ?? document.body, {
    childList: true, subtree: true,
  });
}

// ─── Wire training interactions from ui.js ────────────────────────────────────
//
// ui.js fires DOM events on `window` at the right moments.
// We re-dispatch them to our handler functions here.
//
// Additionally, we patch the ui.js event delegation by hooking into the
// existing #app click listener via a capturing listener. This avoids
// any import cycle: timer.js imports state.js only, not ui.js.

// A3: mirrors ui.js' _isTodayDay()+isVacation gating (renderSetRow's
// showIntraCoach, confirm-set's pauseSec source) — a coach-computed
// (RPE-based) pause duration is only ever DISPLAYED to the user for the
// current/latest week's non-vacation, not-yet-completed day. Without this
// check, this toggle-done path (the manual ✓/✗ button) could apply an
// RPE-based pause duration in a case (vacation day, or editing a past/non-
// latest week) where the confirm-set path — and the feedback text itself —
// would never show anything but the exercise's static pauseSec, i.e. the
// exact same physical "mark set done" action could silently start a
// different pause duration depending on which of the two entry points was
// used. Keeping both paths under the same eligibility condition avoids that.
function _isCoachEligibleDay(state, wk, day) {
  if (!wk || !day || day.markedDone || day.isVacation) return false;
  const latest = getLatestWeek(state.weeks);
  return !!latest && wk.startDate === latest.startDate;
}

function _bindAppInteractions() {
  const app = document.getElementById('app');
  if (!app) return;

  app.addEventListener('click', e => {
    // Set done button
    const doneBtn = e.target.closest('[data-action="toggle-done"]');
    if (doneBtn) {
      const state = getState();
      const di  = +doneBtn.dataset.di;
      const ei  = +doneBtn.dataset.ei;
      const ex  = state.weeks[state.curIdx]?.days?.[di]?.exercises?.[ei];
      _ensureSessionStart(di);
      queueMicrotask(() => {
        const newState  = getState();
        const newDay    = newState.weeks[newState.curIdx]?.days?.[di];
        const newEx     = newDay?.exercises?.[ei];
        const newSet    = newEx?.sets?.[+doneBtn.dataset.si];
        const isLastSet = +doneBtn.dataset.si === (newEx?.sets?.length ?? 0) - 1;
        // B78: dieser toggle-done-Pfad löste den Pause-Timer bisher UNCONDITIONAL
        // aus, ohne die Einstellung zu prüfen — der confirm-set-Pfad (ui.js)
        // respektiert `autoStartPauseTimer` bereits korrekt. Wer die Einstellung
        // deaktiviert hatte, bekam trotzdem einen Auto-Timer über den manuellen
        // ✓/✗-Button (vermutlich der häufiger genutzte Pfad). Gleiche Gating-
        // Bedingung wie ui.js jetzt auch hier ergänzt.
        if (newSet?.done && !isLastSet && newState.settings?.autoStartPauseTimer) {
          // B77: Intra-Session Coach — die berechnete Pause-Empfehlung
          // ersetzt den bisher statischen ex.pauseSec, wenn eine existiert
          // (sessionModifier vom Tag, dieselbe Logik wie in ui.js' confirm-
          // set-Pfad). timer.js importiert dafür sessionCoach.js — ein
          // reines, importfreies Berechnungsmodul (Tiefe 0), keine
          // ui.js-Kopplung.
          let pauseSec = ex?.pauseSec ?? 90;
          // A3: nur auf die coach-berechnete Pause zurückgreifen, wenn dieser
          // Tag auch tatsächlich für Intra-Session-Coach-Feedback in Frage
          // käme (siehe _isCoachEligibleDay() oben) — sonst identisches
          // Verhalten zum confirm-set-Pfad (ui.js) sicherstellen.
          const newWk = newState.weeks[newState.curIdx];
          if (newState.settings?.sessionCoach !== false && _isCoachEligibleDay(newState, newWk, newDay)) {
            const isCompound = newEx ? isCompoundExercise(newEx.name, buildCategoryMap(newState.customExercises)) : true;
            const fb = buildSetFeedback(newSet, newEx, newDay?.sessionModifier ?? null, +doneBtn.dataset.si, newState.settings?.goal ?? null, isCompound, newDay?.sessionModifierScope ?? 'all', newEx ? getEffectiveWeightStep(newEx, newState.settings, newState.customExercises) : null);
            if (fb?.pauseSec) pauseSec = fb.pauseSec;
          }
          window.dispatchEvent(new CustomEvent('train:set-done', {
            detail: { pauseSec, di, key: `${di}-${ei}-${doneBtn.dataset.si}` },
          }));
        }
      });
    }

    // Day complete button – stop session
    const completeBtn = e.target.closest('[data-action="toggle-complete"]');
    if (completeBtn) {
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
    if (action === 'set-weight' || action === 'set-reps' || action === 'set-rpe') {
      const di = +(inputEl.dataset.di ?? 0);
      window.dispatchEvent(new CustomEvent('train:set-input', { detail: { di } }));
    }
    // Warmup textarea – start session only on an actual EDIT (typing),
    // not on a bare click/focus/tap (Runde 18, Cluster 3 — same bar as
    // the numeric fields above, see header comment).
    if (action === 'day-field' && inputEl.dataset.field === 'warmup') {
      const di = +(inputEl.dataset.di ?? 0);
      window.dispatchEvent(new CustomEvent('train:warmup-input', { detail: { di } }));
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
  _pauseTipEl   = document.getElementById('pause-tip');

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

  // 7b. Runde 20 (Befund 4): B62 koppelte die SW-Registrierung (+ den
  // Erstlade-Hinweis-Toast) bewusst an die erste ECHTE Trainingsaktion statt
  // an den bloßen Seitenaufruf. Diagnose ergab eine Regression daraus: da
  // _ensureSessionStart() den Trigger nur EINMAL PRO TAG feuert (Guard:
  // `day.sessionStartTs` bereits gesetzt), bekam ein Nutzer, der die App nur
  // öffnet ohne sofort zu trainieren (oder sie mehrfach am selben Tag neu
  // öffnet), nie eine neue SW-Registrierung in diesem JS-Kontext -- und
  // damit auch keinen updatefound-Listener, der ein zwischenzeitliches
  // Deployment erkennen könnte (vor B62 lief das bei JEDEM Seitenaufruf).
  // Fix: zusätzlich bei jedem App-Start ein Idle-verzögerter Trigger, NICHT
  // mehr an einen Trainingsstart gekoppelt -- der bestehende { once: true }
  // Listener in index.html verhindert weiterhin eine doppelte Registrierung,
  // falls _ensureSessionStart() im selben Seitenaufruf zusätzlich feuert.
  const _idleCb = window.requestIdleCallback || (cb => setTimeout(cb, 1500));
  _idleCb(() => window.dispatchEvent(new CustomEvent('train:sw-register-trigger')));

  // 8. Return control API for tests / external use
  return {
    stopSession:   _stopSession,
    startPause:    _startPause,
    dismissPause:  _dismissPause,
    /** Returns elapsed session seconds for the active day, or null if no session. */
    getElapsed: () => {
      const day = _getActiveDay();
      if (!day?.sessionStartTs || day.sessionEndTs) return null;
      return Math.floor((Date.now() - day.sessionStartTs) / 1000);
    },
    /** Returns remaining pause seconds, or null if no pause running. */
    getPauseRemaining: () => _pauseEnd !== null
      ? Math.max(0, Math.ceil((_pauseEnd - Date.now()) / 1000))
      : null,
  };
}
