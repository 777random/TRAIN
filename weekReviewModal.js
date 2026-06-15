/**
 * weekReviewModal.js – DOM-Darstellung des Wochenrückblicks.
 * Exportiert showWeekReviewModal() und renderWeekReviewHtml().
 */

const _h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function _kw(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
}

function _fmtVol(v) {
  return v >= 1000 ? (v / 1000).toFixed(1) + 't' : v + ' kg';
}

function _summaryGrid({ totalVolume, totalSets, completedDays, plannedDays, avgSessionDuration, volumeVsPrevWeek }) {
  const sign   = volumeVsPrevWeek !== null && volumeVsPrevWeek >= 0 ? '+' : '';
  const pctEl  = volumeVsPrevWeek !== null
    ? `<span class="wr-vol-pct${volumeVsPrevWeek >= 0 ? ' wr-vol-pct--up' : ' wr-vol-pct--dn'}">${sign}${volumeVsPrevWeek}%</span>`
    : '';
  const tiles = [
    { num: _fmtVol(totalVolume), sub: pctEl,  label: 'Volumen' },
    { num: totalSets,            sub: '',      label: 'Sätze ✓' },
    { num: `${completedDays}/${plannedDays}`, sub: '', label: 'Tage' },
    { num: avgSessionDuration != null ? `${avgSessionDuration}′` : '—', sub: '', label: 'Ø Session' },
  ];
  return `<div class="wr-grid">
    ${tiles.map(t => `<div class="wr-tile"><div class="wr-tile__num">${t.num}${t.sub}</div><div class="wr-tile__lbl">${t.label}</div></div>`).join('')}
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
  ${isVacation ? '<div class="wr-vacation-banner">🏖 Urlaubswoche — Streak läuft weiter</div>' : ''}
  ${isDeload ? '<div class="wr-deload-banner">Deload-Woche — reduziertes Volumen erwartet</div>' : ''}
  <div class="wr-kw-row">
    <span class="wr-kw">KW ${kw}</span>
    ${week.note ? `<span class="wr-note">${_h(week.note)}</span>` : ''}
  </div>

  <div class="wr-section-title">Zusammenfassung</div>
  ${_summaryGrid(summary)}

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
}
