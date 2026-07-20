/**
 * weekReviewModal.js – DOM-Darstellung des Wochenrückblicks.
 * Exportiert showWeekReviewModal() und renderWeekReviewHtml().
 */

import { buildWeekShareCanvas, shareCanvas } from './shareImage.js';
import { getSortedWeeks, exWeightHistory } from './insightEngine.js';

const _h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function _kw(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
}

const _MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
function _monthYear(sd) {
  const d = new Date(sd + 'T12:00:00');
  return `${_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Trainingsvolumen (Σ weight×reps über success-Sätze) je Übung in dieser Woche. */
function _weekVolumeByExercise(week) {
  const vol = new Map();
  for (const d of week.days ?? [])
    for (const ex of d.exercises ?? [])
      for (const s of ex.sets ?? [])
        if (s.status === 'success') {
          const v = (s.weight ?? 0) * (s.reps ?? 0);
          vol.set(ex.name, (vol.get(ex.name) ?? 0) + v);
        }
  return vol;
}

/** Alle Übungen, die in dieser Woche einen echten Gewichts-PR erzielt haben. */
function _weekPrExerciseNames(week) {
  const names = new Set();
  for (const d of week.days ?? [])
    for (const ex of d.exercises ?? [])
      for (const s of ex.sets ?? [])
        if (s.prBadge === 'weight') names.add(ex.name);
  return [...names];
}

/**
 * Übung fürs Share-Bild (B71, Favoriten-Kaskade seit B73). 6 Prioritäten,
 * Favorit immer vor Nicht-Favorit:
 *   1. Favorit + echter Gewichts-PR diese Woche
 *   2. Favorit + Steigerung ggü. Vorwoche
 *   3. Favorit mit den meisten Datenpunkten (≥2)
 *   4. Nicht-Favorit + PR
 *   5. Nicht-Favorit mit höchstem Wochenvolumen
 *   6. Übung mit den meisten Datenpunkten insgesamt (garantiert eine
 *      Sparkline, sofern irgendeine Übung ≥2 Punkte hat)
 *
 * PR-Erkennung bewusst über `s.prBadge` direkt an den Sätzen, NICHT über
 * `reviewData.highlights` — `_findPR()` (weekReview.js) liefert maximal
 * EINEN `type:'pr'`-Highlight pro Woche (den mit dem größten Delta über
 * alle Übungen, favoritenblind) und kein `weightDiff`-Feld. Ein direkter
 * Sätze-Scan liefert dagegen ALLE PRs der Woche, unabhängig davon, ob es
 * der insgesamt größte war — nötig, um "Favorit hat auch (irgend)einen PR"
 * zuverlässig zu erkennen.
 *
 * @param {Object} reviewData  Rückgabe von buildWeekReview() + allWeeks
 * @param {Array}  sorted      state.weeks, chronologisch sortiert (getSortedWeeks())
 * @param {Array}  favs        state.favoriteExercises
 */
function _pickBestExercise(reviewData, sorted, favs) {
  const { week } = reviewData;
  const prNames = _weekPrExerciseNames(week);

  const favPr = favs.find(f => prNames.includes(f));
  if (favPr) return { name: favPr, isPr: true };

  const hasGainThisWeek = (name) => {
    const h = exWeightHistory(sorted, name).filter(w => w > 0);
    return h.length >= 2 && h[h.length - 1] > h[h.length - 2];
  };
  const favGain = favs.find(f => hasGainThisWeek(f));
  if (favGain) return { name: favGain, isPr: false };

  const favHistory = favs
    .map(f => ({ name: f, pts: exWeightHistory(sorted, f).filter(w => w > 0).length }))
    .filter(f => f.pts >= 2)
    .sort((a, b) => b.pts - a.pts)[0];
  if (favHistory) return { name: favHistory.name, isPr: false };

  if (prNames.length) return { name: prNames[0], isPr: true };

  const vol = _weekVolumeByExercise(week);
  const topVol = [...vol.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topVol) return { name: topVol[0], isPr: false };

  const allNames = [...new Set((week.days ?? []).flatMap(d => (d.exercises ?? []).map(e => e.name)))];
  const mostHistory = allNames
    .map(n => ({ name: n, pts: exWeightHistory(sorted, n).filter(w => w > 0).length }))
    .sort((a, b) => b.pts - a.pts)[0];
  if (mostHistory?.pts >= 2) return { name: mostHistory.name, isPr: false };

  return null;
}

/**
 * Erzeugt und teilt das Wochenrückblick-Share-Bild (B71/B72). Reused vom
 * Wochenwechsel-Modal (`#wr-btn-share`) UND vom manuellen Wochenrückblick-
 * Dropdown im Fortschritt-Tab (ui.js `_updateInlineReview()`) — eine
 * Implementierung statt zwei, damit beide Einstiegspunkte identisch
 * korrekt bleiben.
 *
 * @param {Object} reviewData  Rückgabe von buildWeekReview(), MUSS zusätzlich
 *   `allWeeks` (das komplette state.weeks-Array) tragen — sonst bleibt die
 *   Sparkline leer (kein Absturz, nur Fallback-Anzeige).
 */
export async function shareWeekReviewImage(reviewData) {
  const { summary, week } = reviewData;
  const kw = String(_kw(week.startDate)).padStart(2, '0');
  try {
    const sorted = reviewData.allWeeks ? getSortedWeeks({ weeks: reviewData.allWeeks }) : [week];
    const favs   = reviewData.favoriteExercises ?? [];
    const best   = _pickBestExercise(reviewData, sorted, favs);
    const weights = best ? exWeightHistory(sorted, best.name).slice(-8).filter(w => w > 0) : [];
    const canvas = await buildWeekShareCanvas({
      kw, monthYear: _monthYear(week.startDate),
      streak: summary.streak ?? 0,
      doneDays: summary.completedDays ?? 0, totalDays: summary.plannedDays ?? 0,
      successPct: summary.goalFulfillment ?? null,
      bestExercise: best?.name ?? null, weights, isPr: best?.isPr ?? false,
    });
    await shareCanvas(canvas, 'train-woche.png', `Wochenrückblick KW ${kw} — TRAIN`);
  } catch (_) { /* Canvas/Share fehlgeschlagen -> stiller Abbruch, kein Crash */ }
}

function _fmtVol(v) {
  return v >= 1000 ? (v / 1000).toFixed(1) + 't' : v + ' kg';
}

function _summaryRow({ streak, totalSets, completedDays, plannedDays, avgSessionDuration, goalFulfillment }) {
  const goalColor = goalFulfillment != null
    ? (goalFulfillment >= 90 ? 'var(--c-ok)' : goalFulfillment >= 70 ? 'var(--c-warn)' : 'var(--c-danger)')
    : '';
  const items = [
    `${streak ?? 0} Wochen`,
    `✓ ${totalSets} Sätze`,
    `${completedDays}/${plannedDays} Tage`,
    avgSessionDuration != null ? `${avgSessionDuration}′ Ø Session` : '— Ø Session',
    `<span${goalColor ? ` style="color:${goalColor}"` : ''}>${goalFulfillment != null ? `${goalFulfillment}%` : '—'} Ziel</span>`,
  ];
  return `<div class="wr-metrics-row">
    ${items.map(i => `<span class="wr-metric">${i}</span>`).join('<span class="wr-metric-sep">·</span>')}
  </div>`;
}

function _cards(items, mod) {
  return items.map(item => `
  <div class="wr-card wr-card--${mod}">
    ${item.label ? `<div class="wr-card__lbl">${_h(item.label)}</div>` : ''}
    <div class="wr-card__txt">${_h(item.text)}</div>
  </div>`).join('');
}

/**
 * Gibt den inneren HTML-String des Rückblicks zurück — ohne Modal-Chrome.
 * Wird sowohl vom Modal als auch vom Analyse-Tab genutzt.
 */
export function renderWeekReviewHtml(reviewData) {
  const { summary, highlights, lowlights, recommendations, isDeload, isVacation, week } = reviewData;
  const kw = String(_kw(week.startDate)).padStart(2, '0');

  return `
  ${isVacation ? '<div class="wr-vacation-banner">🏖 Urlaubswoche — unterbricht deinen Trainingsrhythmus nicht</div>' : ''}
  ${isDeload ? '<div class="wr-deload-banner">Deload-Woche — reduziertes Volumen erwartet</div>' : ''}
  <div class="wr-kw-row">
    <span class="wr-kw">KW ${kw}</span>
    ${week.note ? `<span class="wr-note">${_h(week.note)}</span>` : ''}
  </div>

  <div class="wr-section-title">Zusammenfassung</div>
  ${_summaryRow(summary)}

  ${highlights.length ? `
  <div class="wr-section-title">✅ Was gut lief</div>
  ${_cards(highlights, 'ok')}` : ''}

  ${lowlights.length ? `
  <div class="wr-section-title">⚠️ Was nicht gut lief</div>
  ${_cards(lowlights, 'warn')}` : ''}

  <div class="wr-section-title">💡 Nächste Woche</div>
  ${_cards(recommendations, 'info')}`;
}

/**
 * Zeigt das Vollbild-Wochenrückblick-Modal.
 *
 * @param {Object}   reviewData  Rückgabe von buildWeekReview()
 * @param {Function} onContinue  Callback wenn "Weiter →" geklickt
 */
export function showWeekReviewModal(reviewData, onContinue) {
  const MODAL_ID = 'modal-week-review';
  let overlay = document.getElementById(MODAL_ID);

  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = MODAL_ID;
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'wr-modal-title');
    (document.getElementById('app') ?? document.body).appendChild(overlay);
  }

  const { week } = reviewData;
  const kw = String(_kw(week.startDate)).padStart(2, '0');

  overlay.innerHTML = `
  <div class="modal wr-modal">
    <div class="wr-modal-header">
      <span class="wr-modal-icon" aria-hidden="true">📋</span>
      <div>
        <div class="modal__title" id="wr-modal-title">Wochenrückblick</div>
        <div class="wr-modal-sub">KW ${kw}${week.note ? ' · ' + _h(week.note) : ''}</div>
      </div>
    </div>
    ${renderWeekReviewHtml(reviewData)}
    <div class="wr-continue">
      <button class="btn btn--ghost wr-share__btn" id="wr-btn-share">📤 Teilen</button>
      <button class="btn btn--accent wr-continue__btn" id="wr-btn-continue">Weiter →</button>
    </div>
  </div>`;

  overlay.classList.add('is-open');

  // Kein Backdrop-Close — nur über "Weiter →"
  overlay.addEventListener('click', e => { e.stopPropagation(); });

  overlay.querySelector('#wr-btn-continue')
    ?.addEventListener('click', () => {
      overlay.classList.remove('is-open');
      onContinue();
    }, { once: true });

  overlay.querySelector('#wr-btn-share')
    ?.addEventListener('click', () => shareWeekReviewImage(reviewData));
}
