/**
 * shareImage.js – Canvas-basierte Share-Bilder (PR-Moment + Wochenrückblick).
 *
 * Pure functions, keine Imports, kein State-Zugriff. Erzeugt ein 1080×1080
 * PNG lokal im Browser und übergibt es an das native Share-Sheet
 * (navigator.share/canShare, identisches Muster wie backup.js) — kein
 * Server-Upload, kein Drittanbieter-Bildhost.
 */

const SIZE = 1080;

function _themeColor(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

async function _buildCanvas(draw) {
  await document.fonts.ready;
  const dpr    = window.devicePixelRatio || 1;
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  draw(ctx);
  return canvas;
}

function _footer(ctx, text2) {
  ctx.fillStyle    = text2;
  ctx.textAlign    = 'center';
  ctx.font         = '700 24px "DM Sans", sans-serif';
  ctx.letterSpacing = '2px';
  ctx.fillText('TRAIN', SIZE / 2, SIZE - 64);
  ctx.letterSpacing = '0px';
}

/**
 * @param {Array<{name:string, weight:number, reps:number, type:'weight'|'reps'}>} prs
 *   Mindestens 1 Eintrag — die per s.prBadge markierten Sätze eines Tages.
 */
export async function buildPrShareCanvas(prs) {
  const bg     = _themeColor('--c-bg', '#0E0E10');
  const accent = _themeColor('--c-accent', '#C8FF00');
  const text   = _themeColor('--c-text', '#F0F0F0');
  const text2  = _themeColor('--c-text-2', '#B0B0B8');
  const top    = prs[0];
  const valueText = top.type === 'weight' ? `${top.weight} kg` : `${top.reps} Wdh`;

  return _buildCanvas(ctx => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.font = '400 54px "DM Sans", sans-serif';
    ctx.fillText('🏆 Neuer Rekord', SIZE / 2, 400);

    ctx.fillStyle = text;
    ctx.font = '400 190px "Bebas Neue", sans-serif';
    ctx.fillText(valueText, SIZE / 2, 570);

    ctx.fillStyle = text2;
    ctx.font = '400 42px "DM Sans", sans-serif';
    ctx.fillText(top.name, SIZE / 2, 640);

    if (prs.length > 1) {
      ctx.fillStyle = accent;
      ctx.font = '400 30px "DM Sans", sans-serif';
      const n = prs.length - 1;
      ctx.fillText(`+ ${n} weitere${n === 1 ? 's' : ''} PR${n === 1 ? '' : 's'} heute`, SIZE / 2, 700);
    }

    _footer(ctx, text2);
  });
}

/**
 * @param {{kw:string, streak:number, pct:number|null, effortPct:number|null, highlightText:string|null}} data
 */
export async function buildWeekShareCanvas({ kw, streak, pct, effortPct, highlightText }) {
  const bg     = _themeColor('--c-bg', '#0E0E10');
  const accent = _themeColor('--c-accent', '#C8FF00');
  const text   = _themeColor('--c-text', '#F0F0F0');
  const text2  = _themeColor('--c-text-2', '#B0B0B8');

  return _buildCanvas(ctx => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    ctx.textAlign = 'center';
    ctx.fillStyle = text2;
    ctx.font = '400 34px "DM Sans", sans-serif';
    ctx.fillText(`KW ${kw}`, SIZE / 2, 220);

    ctx.fillStyle = accent;
    ctx.font = '400 170px "Bebas Neue", sans-serif';
    ctx.fillText(`${streak}`, SIZE / 2, 400);
    ctx.font = '400 36px "DM Sans", sans-serif';
    ctx.fillStyle = text;
    ctx.fillText(streak === 1 ? 'Woche in Folge' : 'Wochen in Folge', SIZE / 2, 450);

    const stats = [];
    if (pct !== null)       stats.push(`${pct}% Erfolgsquote`);
    if (effortPct !== null) stats.push(`${effortPct}% Zielerfüllung`);
    if (stats.length) {
      ctx.font = '400 32px "DM Sans", sans-serif';
      ctx.fillStyle = text2;
      ctx.fillText(stats.join('  ·  '), SIZE / 2, 560);
    }

    if (highlightText) {
      ctx.font = '400 30px "DM Sans", sans-serif';
      ctx.fillStyle = text;
      _wrapText(ctx, `✅ ${highlightText}`, SIZE / 2, 660, 840, 40);
    }

    _footer(ctx, text2);
  });
}

function _wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '', lines = [];
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  lines.slice(0, 3).forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
}

/** Teilt den Canvas-Inhalt als PNG — natives Share-Sheet, sonst Download-Fallback. */
export async function shareCanvas(canvas, filename, title) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (_) {
        // Nutzer hat abgebrochen oder Share fehlgeschlagen -> Download-Fallback
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 150);
}
