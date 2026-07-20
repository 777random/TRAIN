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

/**
 * Übung fürs Share-Bild (B71): 1. echter PR diese Woche (aus dem bereits
 * von buildWeekReview() ermittelten highlights-Eintrag `type:'pr'`),
 * 2. sonst höchstes Trainingsvolumen dieser Woche.
 */
function _pickBestExercise(reviewData) {
  const prHit = reviewData.highlights?.find(h => h.type === 'pr');
  if (prHit?.exName) return { name: prHit.exName, isPr: true };
  const vol = _weekVolumeByExercise(reviewData.week);
  let best = null, bestVol = 0;
  vol.forEach((v, name) => { if (v > bestVol) { bestVol = v; best = name; } });
  return best ? { name: best, isPr: false } : null;
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
    ?.addEventListener('click', async () => {
      const { summary } = reviewData;
      try {
        const best = _pickBestExercise(reviewData);
        let weights = [];
        if (best && reviewData.allWeeks) {
          const sorted = getSortedWeeks({ weeks: reviewData.allWeeks });
          weights = exWeightHistory(sorted, best.name).slice(-8).filter(w => w > 0);
        }
        const canvas = await buildWeekShareCanvas({
          kw, monthYear: _monthYear(week.startDate),
          streak: summary.streak ?? 0,
          doneDays: summary.completedDays ?? 0, totalDays: summary.plannedDays ?? 0,
          successPct: summary.goalFulfillment ?? null,
          bestExercise: best?.name ?? null, weights, isPr: best?.isPr ?? false,
        });
        await shareCanvas(canvas, 'train-woche.png', `Wochenrückblick KW ${kw} — TRAIN`);
      } catch (_) { /* Canvas/Share fehlgeschlagen -> stiller Abbruch, kein Crash */ }
    });
}
