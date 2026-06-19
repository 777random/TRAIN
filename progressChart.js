/**
 * progressChart.js – Inline-SVG Gewichtsprogressions-Chart.
 *
 * Pure function, keine Seiteneffekte, keine Importe.
 */

/** KW-Berechnung identisch mit wkLabel() in ui.js */
function _kw(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
}

/**
 * Rendert einen SVG-Inline-Chart für die Gewichtsentwicklung einer Übung.
 *
 * @param {string} exerciseName
 * @param {Array}  weeks   Bereits gefiltert (kein Deload, max 16, aufsteigend sortiert)
 * @param {Object} [options]
 * @param {boolean} [options.compact=false]  true → viewBox 400×120 (Training), false → 400×180 (Analyse)
 * @returns {string|null}  SVG-Markup-String oder null wenn < 2 Datenpunkte
 */
export function renderProgressChart(exerciseName, weeks, options = {}) {
  // ── Datenpunkte sammeln ──────────────────────────────────────────────────────
  const points = [];
  for (const wk of weeks) {
    const weights = [];
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === exerciseName)
          for (const s of ex.sets)
            if (s.status === 'success' && (s.weight ?? 0) > 0)
              weights.push(s.weight);
    if (weights.length === 0) continue;
    const maxW = Math.max(...weights);
    const avgW = Math.round(weights.reduce((a, b) => a + b, 0) / weights.length * 10) / 10;
    const kw   = _kw(wk.startDate);
    points.push({ kw, maxW, avgW });
  }

  if (points.length < 2) return null;

  // ── Layout ───────────────────────────────────────────────────────────────────
  const compact = options.compact ?? false;
  const VBW = 400, VBH = compact ? 120 : 180;
  const pad = { l: 40, r: 16, t: 14, b: compact ? 26 : 32 };
  const gW  = VBW - pad.l - pad.r;
  const gH  = VBH - pad.t - pad.b;

  // ── Skalierung ───────────────────────────────────────────────────────────────
  const allW   = points.flatMap(p => [p.maxW, p.avgW]);
  const rawMin = Math.min(...allW);
  const rawMax = Math.max(...allW);
  const margin = (rawMax - rawMin) * 0.12 || rawMax * 0.06 || 5;
  const yMin   = Math.max(0, rawMin - margin);
  const yMax   = rawMax + margin;
  const yRange = yMax - yMin || 1;

  const n    = points.length;
  const xOf  = i => pad.l + (n === 1 ? gW / 2 : i * gW / (n - 1));
  const yOf  = v => pad.t + gH - ((v - yMin) / yRange) * gH;

  // ── Pfade ────────────────────────────────────────────────────────────────────
  const pathD = pts =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  const maxPts = points.map((p, i) => [xOf(i), yOf(p.maxW)]);
  const avgPts = points.map((p, i) => [xOf(i), yOf(p.avgW)]);

  // ── Y-Achse Beschriftung (3 Werte) ───────────────────────────────────────────
  const yLbls = [0, 0.5, 1].map(f => ({
    v: Math.round((yMin + yRange * f) * 10) / 10,
    y: (pad.t + gH * (1 - f)).toFixed(1),
  }));

  // ── X-Achse Beschriftung (max 6 Labels) ──────────────────────────────────────
  const maxXLabels = 6;
  const xStep = Math.max(1, Math.ceil(n / maxXLabels));
  const xIdxs = points.reduce((acc, _, i) => {
    if (i % xStep === 0 || i === n - 1) acc.push(i);
    return acc;
  }, []);

  // ── Grid ─────────────────────────────────────────────────────────────────────
  const gridLines = [0, 0.5, 1].map(f => {
    const gy = (pad.t + gH * f).toFixed(1);
    return `<line x1="${pad.l}" y1="${gy}" x2="${pad.l + gW}" y2="${gy}" stroke="#2E2E35" stroke-width="1"/>`;
  }).join('');

  // ── Y-Labels ─────────────────────────────────────────────────────────────────
  const yLabels = yLbls.map(lbl =>
    `<text x="${pad.l - 4}" y="${(+lbl.y + 4).toFixed(0)}" text-anchor="end" font-size="10" fill="#6B7280">${lbl.v}</text>`
  ).join('');

  // ── Linien ───────────────────────────────────────────────────────────────────
  const avgPath = `<path d="${pathD(avgPts)}" fill="none" stroke="#6B7280" stroke-width="1.5" stroke-dasharray="5,3" stroke-linecap="round" stroke-linejoin="round"/>`;
  const maxPath = `<path d="${pathD(maxPts)}" fill="none" stroke="#1A73E8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  // ── Punkte ───────────────────────────────────────────────────────────────────
  const avgDots = points.map((p, i) =>
    `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.avgW).toFixed(1)}" r="2.5" fill="#6B7280"/>`
  ).join('');

  const maxDots = points.map((p, i) =>
    `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.maxW).toFixed(1)}" r="4" fill="#1A73E8" data-tip="KW ${p.kw}: Max ${p.maxW} kg / Ø ${p.avgW} kg" style="cursor:pointer"><title>KW ${p.kw}: Max ${p.maxW} kg / Ø ${p.avgW} kg</title></circle>`
  ).join('');

  // ── X-Labels ─────────────────────────────────────────────────────────────────
  const xLabels = xIdxs.map(i => {
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    return `<text x="${xOf(i).toFixed(1)}" y="${VBH - 4}" text-anchor="${anchor}" font-size="10" fill="#6B7280">KW ${points[i].kw}</text>`;
  }).join('');

  // ── Legende ──────────────────────────────────────────────────────────────────
  const legX = VBW - 68;
  const legY = pad.t + 4;
  const legend = `
    <line x1="${legX}" y1="${legY + 4}" x2="${legX + 18}" y2="${legY + 4}" stroke="#1A73E8" stroke-width="2"/>
    <text x="${legX + 22}" y="${legY + 8}" font-size="10" fill="#9CA3AF">Max</text>
    <line x1="${legX}" y1="${legY + 18}" x2="${legX + 18}" y2="${legY + 18}" stroke="#6B7280" stroke-width="1.5" stroke-dasharray="5,3"/>
    <text x="${legX + 22}" y="${legY + 22}" font-size="10" fill="#9CA3AF">Ø</text>`;

  return `<svg viewBox="0 0 ${VBW} ${VBH}" width="100%" height="auto" role="img" aria-label="Gewichtsprogression ${exerciseName}" style="display:block;overflow:visible">
  ${gridLines}
  ${yLabels}
  ${avgPath}
  ${maxPath}
  ${avgDots}
  ${maxDots}
  ${xLabels}
  ${legend}
</svg>`;
}

/**
 * Rendert einen einfachen SVG-Liniechart für die Körpergewichtsentwicklung.
 *
 * @param {Array<{label: string, weight: number}>} points  aufsteigend sortiert
 * @returns {string|null}  SVG-Markup-String oder null wenn < 2 Datenpunkte
 */
export function renderBodyWeightChart(points) {
  if (points.length < 2) return null;

  const VBW = 400, VBH = 140;
  const pad = { l: 40, r: 16, t: 14, b: 26 };
  const gW  = VBW - pad.l - pad.r;
  const gH  = VBH - pad.t - pad.b;

  const weights = points.map(p => p.weight);
  const rawMin  = Math.min(...weights);
  const rawMax  = Math.max(...weights);
  const margin  = (rawMax - rawMin) * 0.12 || rawMax * 0.06 || 2;
  const yMin    = Math.max(0, rawMin - margin);
  const yMax    = rawMax + margin;
  const yRange  = yMax - yMin || 1;

  const n   = points.length;
  const xOf = i => pad.l + (n === 1 ? gW / 2 : i * gW / (n - 1));
  const yOf = v => pad.t + gH - ((v - yMin) / yRange) * gH;

  const pathD = pts => pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const linePts = points.map((p, i) => [xOf(i), yOf(p.weight)]);

  const yLbls = [0, 0.5, 1].map(f => ({
    v: Math.round((yMin + yRange * f) * 10) / 10,
    y: (pad.t + gH * (1 - f)).toFixed(1),
  }));

  const maxXLabels = 6;
  const xStep = Math.max(1, Math.ceil(n / maxXLabels));
  const xIdxs = points.reduce((acc, _, i) => {
    if (i % xStep === 0 || i === n - 1) acc.push(i);
    return acc;
  }, []);

  const gridLines = [0, 0.5, 1].map(f => {
    const gy = (pad.t + gH * f).toFixed(1);
    return `<line x1="${pad.l}" y1="${gy}" x2="${pad.l + gW}" y2="${gy}" stroke="#2E2E35" stroke-width="1"/>`;
  }).join('');

  const yLabels = yLbls.map(lbl =>
    `<text x="${pad.l - 4}" y="${(+lbl.y + 4).toFixed(0)}" text-anchor="end" font-size="10" fill="#6B7280">${lbl.v}</text>`
  ).join('');

  const linePath = `<path d="${pathD(linePts)}" fill="none" stroke="#C8FF00" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const dots = points.map((p, i) =>
    `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.weight).toFixed(1)}" r="3" fill="#C8FF00"><title>${h(p.label)}: ${p.weight} kg</title></circle>`
  ).join('');

  const xLabels = xIdxs.map(i => {
    const anchor = i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle';
    return `<text x="${xOf(i).toFixed(1)}" y="${VBH - 4}" text-anchor="${anchor}" font-size="10" fill="#6B7280">${h(points[i].label)}</text>`;
  }).join('');

  return `<svg viewBox="0 0 ${VBW} ${VBH}" width="100%" height="auto" role="img" aria-label="Körpergewichtsverlauf" style="display:block;overflow:visible">
  ${gridLines}
  ${yLabels}
  ${linePath}
  ${dots}
  ${xLabels}
</svg>`;
}

function h(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
