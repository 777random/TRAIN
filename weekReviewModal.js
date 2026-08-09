/**
 * weekReviewModal.js – DOM-Darstellung des Wochenrückblicks.
 * Exportiert showWeekReviewModal() und renderWeekReviewHtml().
 */

import { buildWeekShareCanvas, buildWeekSummaryShareCanvas, shareCanvas } from './shareImage.js';
import { getSortedWeeks, exWeightHistory } from './insightEngine.js';

const _h = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// Echter ISO-8601-Algorithmus (Donnerstag-Verschiebung), B194
// (Runde 10, Domäne A): die vorherige Näherungsformel wich an
// Jahresgrenzen ab — vereinheitlicht mit ui.js' wkLabel()/_isoWeek().
// Bewusst weiterhin genutzt für das SHARE-BILD (shareWeekReviewImage) —
// ein geteiltes Bild braucht einen absoluten Zeitanker ("KW 32"), nicht
// "Diese Woche", das außerhalb des Teilzeitpunkts seinen Sinn verliert.
function _kw(sd) {
  const d = new Date(sd + 'T12:00:00');
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
}

// 'YYYY-MM-DD' aus lokalen Datumskomponenten (kein toISOString()/UTC-
// Rollover) — Duplikat von ui.js' _localISODate().
function _localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Findet die Woche, deren Datumsbereich das echte heutige Kalenderdatum
// enthält — Duplikat von ui.js' _calendarCurrentWeek() (Import aus ui.js
// wäre zirkulär, da ui.js bereits weekReviewModal.js importiert).
function _calendarCurrentWeek(weeks) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return weeks.find(w => {
    const start = new Date(w.startDate + 'T00:00:00');
    const end   = new Date(start);
    end.setDate(end.getDate() + 7);
    return start <= today && today < end;
  }) ?? null;
}

// Runde 18 (Cluster 2.1): Duplikat von ui.js' _weekLabel() — die
// Wochenrückblick-Modal zeigte im Dropdown bereits "Diese Woche"/"Letzte
// Woche" (über ui.js' eigene _weekLabel()-Nutzung), aber im Modal-Text
// selbst weiterhin die rohe "KW XX"-Nummer über das lokale _kw() — zwei
// unterschiedliche Bezeichnungen für dieselbe Woche an zwei Stellen. Diese
// Datei kann _weekLabel() nicht aus ui.js importieren (zirkulär, ui.js
// importiert bereits weekReviewModal.js), daher dieselbe intentionale
// Duplikation wie bei _kw()/_dayISODate() an anderer Stelle im Projekt.
// Liefert immer einen String (nie null), Fallback: KW-Anzeige.
function _weekLabel(week, weeks) {
  const currentWeek = _calendarCurrentWeek(weeks);
  if (currentWeek) {
    if (week.startDate === currentWeek.startDate) return 'Diese Woche';

    const nextMonday = new Date(currentWeek.startDate + 'T00:00:00');
    nextMonday.setDate(nextMonday.getDate() + 7);
    if (week.startDate === _localISODate(nextMonday)) return 'Nächste Woche';

    const lastMonday = new Date(currentWeek.startDate + 'T00:00:00');
    lastMonday.setDate(lastMonday.getDate() - 7);
    if (week.startDate === _localISODate(lastMonday)) return 'Letzte Woche';

    const weekStart = new Date(week.startDate + 'T00:00:00');
    const curStart = new Date(currentWeek.startDate + 'T00:00:00');
    const weeksAgo = Math.round((curStart - weekStart) / (7 * 24 * 60 * 60 * 1000));
    if (weeksAgo >= 2 && weeksAgo <= 8) return `Vor ${weeksAgo} Wochen`;
  }
  const d = new Date(week.startDate + 'T12:00:00');
  return `KW ${_kw(week.startDate)} · ${d.getFullYear()}`;
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
 * @param {'best'|'summary'} [variant='best']  Runde 19, Cluster 11 — 'best'
 *   ist das bisherige Beste-Übung-Sparkline-Layout (Default, unverändert),
 *   'summary' die neue "was gut lief"-Zusammenfassungs-Variante
 *   (buildWeekSummaryShareCanvas(), nutzt reviewData.highlights direkt).
 */
export async function shareWeekReviewImage(reviewData, variant = 'best') {
  const { summary, week, highlights } = reviewData;
  const kw = String(_kw(week.startDate)).padStart(2, '0');
  try {
    let canvas;
    if (variant === 'summary') {
      canvas = await buildWeekSummaryShareCanvas({
        kw, monthYear: _monthYear(week.startDate),
        streak: summary.streak ?? 0,
        doneDays: summary.completedDays ?? 0, totalDays: summary.plannedDays ?? 0,
        successPct: summary.goalFulfillment ?? null,
        highlights: (highlights ?? []).map(h => ({ label: h.label, text: h.text })),
      });
    } else {
      const sorted = reviewData.allWeeks ? getSortedWeeks({ weeks: reviewData.allWeeks }) : [week];
      const favs   = reviewData.favoriteExercises ?? [];
      const best   = _pickBestExercise(reviewData, sorted, favs);
      const weights = best ? exWeightHistory(sorted, best.name).slice(-8).filter(w => w > 0) : [];
      canvas = await buildWeekShareCanvas({
        kw, monthYear: _monthYear(week.startDate),
        streak: summary.streak ?? 0,
        doneDays: summary.completedDays ?? 0, totalDays: summary.plannedDays ?? 0,
        successPct: summary.goalFulfillment ?? null,
        bestExercise: best?.name ?? null, weights, isPr: best?.isPr ?? false,
      });
    }
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
  const weekLabel = _weekLabel(week, reviewData.allWeeks ?? [week]);

  return `
  ${isVacation ? '<div class="wr-vacation-banner">🏖 Urlaubswoche — unterbricht deinen Trainingsrhythmus nicht</div>' : ''}
  ${isDeload ? '<div class="wr-deload-banner">Deload-Woche — reduziertes Volumen erwartet</div>' : ''}
  <div class="wr-kw-row">
    <span class="wr-kw">${_h(weekLabel)}</span>
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
  const weekLabel = _weekLabel(week, reviewData.allWeeks ?? [week]);

  overlay.innerHTML = `
  <div class="modal wr-modal">
    <div class="wr-modal-header">
      <span class="wr-modal-icon" aria-hidden="true">📋</span>
      <div>
        <div class="modal__title" id="wr-modal-title">Wochenrückblick</div>
        <div class="wr-modal-sub">${_h(weekLabel)}${week.note ? ' · ' + _h(week.note) : ''}</div>
      </div>
    </div>
    ${renderWeekReviewHtml(reviewData)}
    <div class="wr-continue">
      <button class="btn btn--ghost wr-share__btn" id="wr-btn-share" title="Beste Übung teilen">📤 Beste Übung</button>
      <button class="btn btn--ghost wr-share__btn" id="wr-btn-share-summary" title="Zusammenfassung der Woche teilen">🗒 Zusammenfassung</button>
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
    ?.addEventListener('click', () => shareWeekReviewImage(reviewData, 'best'));
  overlay.querySelector('#wr-btn-share-summary')
    ?.addEventListener('click', () => shareWeekReviewImage(reviewData, 'summary'));
}
