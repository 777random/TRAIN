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
  // Deckel bei 3x — höhere DPR-Werte (manche Android-Geräte melden 4x)
  // bringen keinen sichtbaren Vorteil, kosten aber quadratisch mehr Speicher.
  const dpr    = Math.min(window.devicePixelRatio || 1, 3);
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE * dpr;
  canvas.height = SIZE * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  draw(ctx);
  return canvas;
}

/**
 * @param {Array<{name:string, weight:number, reps:number, type:'weight'|'reps', prevWeight?:number}>} prs
 *   Mindestens 1 Eintrag — die per s.prBadge markierten Sätze eines Tages
 *   (Tagesabschluss-Trigger) ODER ein einzelner Satz (PR-Moment-Toast,
 *   B73) — dort ist `prevWeight` bekannt (Gewicht vor diesem Satz) und
 *   wird als "Vorheriger Rekord"/Differenz-Hook angezeigt. Beim
 *   Tagesabschluss-Trigger bleibt `prevWeight` unbekannt (undefined) —
 *   die entsprechenden Zeilen werden dann einfach ausgelassen.
 * @param {string} [kw] Optional — Kalenderwoche für die Kopfzeile rechts.
 */
export async function buildPrShareCanvas(prs, kw) {
  const bg     = _themeColor('--c-bg', '#0E0E10');
  const accent = _themeColor('--c-accent', '#C8FF00');
  const text   = _themeColor('--c-text', '#F0F0F0');
  const text2  = _themeColor('--c-text-2', '#B0B0B8');
  const top    = prs[0];
  const valueText = top.type === 'weight' ? `${top.weight} KG × ${top.reps}` : `${top.reps} WDH`;
  const hasPrev = top.type === 'weight' && typeof top.prevWeight === 'number' && top.prevWeight > 0;
  const diff    = hasPrev ? Math.round((top.weight - top.prevWeight) * 100) / 100 : null;

  return _buildCanvas(ctx => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Header (TRAIN links, KW rechts falls bekannt) ─────────────────
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, SIZE, 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.font = '900 11px "DM Sans", sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('TRAIN', 32, 52);
    ctx.letterSpacing = '0px';
    if (kw) {
      ctx.textAlign = 'right';
      ctx.fillStyle = text2;
      ctx.font = '400 11px "DM Sans", sans-serif';
      ctx.fillText(`KW ${kw}`, SIZE - 32, 52);
    }

    // ── Trophäe ────────────────────────────────────────────────────────
    // Zonen bewusst großzügiger verteilt als in der ersten Umsetzung — die
    // ließ (wie schon beim Wochenbild-Redesign, B71) einen großen leeren
    // Bereich zwischen Inhalt und Footer. Divider/Footer werden unten
    // deshalb dynamisch direkt nach dem tatsächlichen Inhalt platziert,
    // nicht mehr an einer fixen Nahe-Bildunterkante-Position.
    ctx.textAlign = 'center';
    ctx.font = '400 150px "DM Sans", sans-serif';
    ctx.fillText('🏆', SIZE / 2, 320);

    // ── Übungsname ─────────────────────────────────────────────────────
    ctx.fillStyle = text;
    ctx.font = '900 60px "DM Sans", sans-serif';
    const name = top.name.toUpperCase();
    if (ctx.measureText(name).width > SIZE - 64) {
      _wrapText(ctx, name, SIZE / 2, 440, SIZE - 64, 62, 2);
    } else {
      ctx.fillText(name, SIZE / 2, 460);
    }

    // ── Gewicht × Wdh ──────────────────────────────────────────────────
    ctx.fillStyle = accent;
    ctx.font = '400 110px "Bebas Neue", sans-serif';
    ctx.fillText(valueText, SIZE / 2, 630);

    // ── Vorheriger Rekord + Differenz-Hook (nur wenn bekannt) ─────────
    let y = 700;
    if (hasPrev) {
      ctx.fillStyle = text2;
      ctx.font = '400 20px "DM Sans", sans-serif';
      ctx.fillText(`Vorheriger Rekord: ${top.prevWeight} kg`, SIZE / 2, y);
      y += 70;
      ctx.fillStyle = accent;
      ctx.font = '900 44px "DM Sans", sans-serif';
      ctx.fillText(`+${diff} kg Steigerung 🔥`, SIZE / 2, y);
      y += 60;
    }

    if (prs.length > 1) {
      ctx.fillStyle = accent;
      ctx.font = '400 26px "DM Sans", sans-serif';
      const n = prs.length - 1;
      ctx.fillText(`+ ${n} weitere${n === 1 ? 's' : ''} PR${n === 1 ? '' : 's'} heute`, SIZE / 2, y);
      y += 50;
    }

    // ── Trennlinie + Footer (dynamisch direkt nach dem Inhalt) ─────────
    const dividerY = y + 40;
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(200, dividerY);
    ctx.lineTo(SIZE - 200, dividerY);
    ctx.stroke();

    ctx.fillStyle = text2;
    ctx.textAlign = 'center';
    ctx.font = '700 24px "DM Sans", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('TRAIN', SIZE / 2, dividerY + 50);
    ctx.letterSpacing = '0px';

    ctx.fillStyle = _withAlpha(accent, 0.4);
    ctx.fillRect(0, SIZE - 3, SIZE, 3);
  });
}

function _wrapText(ctx, text, cx, y, maxWidth, lineHeight, maxLines = 3) {
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
  const shown = lines.slice(0, maxLines);
  shown.forEach((l, i) => ctx.fillText(l, cx, y + i * lineHeight));
  return shown.length;
}

/**
 * Share-Bild v2 (B71) — Übungsfortschritt-Sparkline als Herzstück statt
 * reiner Kennzahlen. 4 Zonen: Header, Sparkline-Hero, Stats-Kacheln, Footer.
 *
 * @param {{
 *   kw:string, monthYear:string, streak:number, doneDays:number,
 *   totalDays:number, successPct:number|null, bestExercise:string|null,
 *   weights:number[], isPr:boolean
 * }} data
 *   weights: exWeightHistory()-Ergebnis für bestExercise, bereits auf die
 *   letzten 8 Wochen begrenzt und auf weight>0 gefiltert (chronologisch).
 */
export async function buildWeekShareCanvas({
  kw, monthYear, streak, doneDays, totalDays, successPct,
  bestExercise, weights, isPr,
}) {
  const bg     = _themeColor('--c-bg', '#0E0E10');
  const accent = _themeColor('--c-accent', '#C8FF00');
  const text   = _themeColor('--c-text', '#F0F0F0');
  const text2  = _themeColor('--c-text-2', '#B0B0B8');
  const PAD = 32;

  return _buildCanvas(ctx => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, SIZE, SIZE);

    // ── Zone 1: Header ─────────────────────────────────────────────
    ctx.fillStyle = accent;
    ctx.fillRect(0, 0, SIZE, 3);

    ctx.textAlign = 'left';
    ctx.fillStyle = accent;
    ctx.font = '900 11px "DM Sans", sans-serif';
    ctx.letterSpacing = '4px';
    ctx.fillText('TRAIN', PAD, 52);
    ctx.letterSpacing = '0px';

    ctx.textAlign = 'right';
    ctx.fillStyle = text2;
    ctx.font = '400 11px "DM Sans", sans-serif';
    ctx.fillText(`KW ${kw} · ${monthYear}`, SIZE - PAD, 52);

    // ── Zone 2: Sparkline-Hero ──────────────────────────────────────
    const name = (bestExercise ?? '').toUpperCase();
    let nameLines = 1, nameFontSize = 52;
    ctx.textAlign = 'center';
    ctx.fillStyle = text;
    if (name) {
      nameFontSize = name.length > 20 ? 38 : 52;
      ctx.font = `900 ${nameFontSize}px "DM Sans", sans-serif`;
      if (ctx.measureText(name).width > SIZE - 2 * PAD) {
        nameLines = _wrapText(ctx, name, SIZE / 2, 140, SIZE - 2 * PAD, nameFontSize + 6, 2);
      } else {
        ctx.fillText(name, SIZE / 2, 140);
      }
    }
    // Zusätzliche Zeile schiebt Subtext + Sparkline-Box gleichmäßig nach
    // unten, damit nichts überlappt — Basiswerte gelten nur bei
    // einzeiligem Übungsnamen.
    const yShift = (nameLines - 1) * (nameFontSize + 6);

    ctx.fillStyle = text2;
    ctx.globalAlpha = 0.5;
    ctx.font = '400 11px "DM Sans", sans-serif';
    ctx.letterSpacing = '2px';
    ctx.fillText('KRAFTENTWICKLUNG · LETZTE 8 WOCHEN', SIZE / 2, 185 + yShift);
    ctx.letterSpacing = '0px';
    ctx.globalAlpha = 1;

    // Sparkline-Box bewusst größer als in der ursprünglichen Vorlage
    // (330 statt 260px Höhe, mehr Abstand zum Footer) — die erste
    // Umsetzung ließ ca. 300px ungenutzten Raum am unteren Bildrand
    // (widerspricht dem eigentlichen Redesign-Ziel "kein Leerraum"),
    // hier stattdessen gleichmäßig auf Sparkline/Kacheln/Footer verteilt.
    const chartX = PAD, chartW = SIZE - 2 * PAD;
    const chartY = 220 + yShift, chartH = 330 - yShift;
    const chartBottomBox = chartY + chartH;

    ctx.beginPath();
    ctx.moveTo(chartX + 16, chartY);
    ctx.arcTo(chartX + chartW, chartY, chartX + chartW, chartBottomBox, 16);
    ctx.arcTo(chartX + chartW, chartBottomBox, chartX, chartBottomBox, 16);
    ctx.arcTo(chartX, chartBottomBox, chartX, chartY, 16);
    ctx.arcTo(chartX, chartY, chartX + chartW, chartY, 16);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();

    const n = Array.isArray(weights) ? weights.length : 0;
    let hookY = chartBottomBox + 30;

    if (n === 0) {
      // Kein einziger Datenpunkt (z.B. Übung heute zum ersten Mal, noch
      // kein Satz bewertet) — kein Gewicht anzeigen, klarer Ausblick statt
      // eines irreführenden "—".
      ctx.fillStyle = text2;
      ctx.font = '400 28px "DM Sans", sans-serif';
      ctx.fillText('Trainiere weiter · Sparkline erscheint ab Woche 2', SIZE / 2, (chartY + chartBottomBox) / 2 + 10);
    } else if (n === 1) {
      // Ein Datenpunkt — Kurve wäre bedeutungslos (keine Tendenz erkennbar),
      // stattdessen das Gewicht selbst groß zeigen.
      ctx.fillStyle = accent;
      ctx.font = '400 100px "Bebas Neue", sans-serif';
      ctx.fillText(`${weights[0]} KG`, SIZE / 2, (chartY + chartBottomBox) / 2 + 10);
      ctx.fillStyle = text2;
      ctx.globalAlpha = 0.4;
      ctx.font = '400 18px "DM Sans", sans-serif';
      ctx.fillText('Erste Einheit · Mehr Wochen = Sparkline', SIZE / 2, (chartY + chartBottomBox) / 2 + 55);
      ctx.globalAlpha = 1;
    } else {
      // n >= 2: Linie zeichnen (Bezier ab 3 Punkten, sonst eine gerade
      // Linie zwischen den 2 Punkten — Kurven-Interpolation wäre bei nur
      // 2 Stützstellen ohnehin identisch zur Geraden), danach dieselben
      // Datenpunkte/Labels/Hook-Satz für beide Fälle.
      const inset = 40;
      const plotX0 = chartX + inset, plotW = chartW - 2 * inset;
      const plotBottom = chartBottomBox - inset;
      const yRange = (chartH - 2 * inset) * 0.7;
      const yPad   = (chartH - 2 * inset) * 0.15;
      const minW = Math.min(...weights), maxW = Math.max(...weights);
      const range = maxW - minW || 1;
      const xStep = plotW / (n - 1);
      const xs = weights.map((_, i) => plotX0 + i * xStep);
      const ys = weights.map(w => plotBottom - yPad - ((w - minW) / range) * yRange);

      ctx.beginPath();
      ctx.moveTo(xs[0], ys[0]);
      if (n >= 3) {
        for (let i = 1; i < n; i++) {
          const cpx = (xs[i - 1] + xs[i]) / 2;
          ctx.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i]);
        }
      } else {
        ctx.lineTo(xs[1], ys[1]);
      }
      ctx.strokeStyle = accent;
      ctx.lineWidth = 4;
      ctx.stroke();

      // Fill unter der Kurve (Gradient).
      const fillPath = new Path2D();
      fillPath.moveTo(xs[0], ys[0]);
      if (n >= 3) {
        for (let i = 1; i < n; i++) {
          const cpx = (xs[i - 1] + xs[i]) / 2;
          fillPath.bezierCurveTo(cpx, ys[i - 1], cpx, ys[i], xs[i], ys[i]);
        }
      } else {
        fillPath.lineTo(xs[1], ys[1]);
      }
      fillPath.lineTo(xs[n - 1], plotBottom);
      fillPath.lineTo(xs[0], plotBottom);
      fillPath.closePath();
      const grad = ctx.createLinearGradient(0, chartY, 0, plotBottom);
      grad.addColorStop(0, _withAlpha(accent, 0.15));
      grad.addColorStop(1, _withAlpha(accent, 0));
      ctx.fillStyle = grad;
      ctx.fill(fillPath);

      // Datenpunkte.
      for (let i = 0; i < n; i++) {
        if (i === n - 1) continue; // letzter Punkt separat mit Glow
        ctx.beginPath();
        ctx.arc(xs[i], ys[i], 6, 0, Math.PI * 2);
        ctx.fillStyle = bg;
        ctx.fill();
        ctx.strokeStyle = _withAlpha(accent, 0.4);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
      // Letzter Punkt: Ring + Glow.
      const lx = xs[n - 1], ly = ys[n - 1];
      ctx.beginPath();
      ctx.arc(lx, ly, 18, 0, Math.PI * 2);
      ctx.strokeStyle = _withAlpha(accent, 0.3);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = accent;
      ctx.beginPath();
      ctx.arc(lx, ly, 12, 0, Math.PI * 2);
      ctx.fillStyle = accent;
      ctx.fill();
      ctx.restore();

      // Gewichts-Labels.
      ctx.textAlign = 'left';
      ctx.fillStyle = text2;
      ctx.font = '400 11px "DM Sans", sans-serif';
      ctx.fillText(`${weights[0]} kg`, xs[0], plotBottom + 26);
      ctx.textAlign = 'right';
      ctx.fillStyle = accent;
      ctx.font = '700 13px "DM Sans", sans-serif';
      ctx.fillText(`${weights[n - 1]} kg`, xs[n - 1], Math.max(chartY + 14, ly - 24));

      // ── Hook-Satz ──────────────────────────────────────────────
      const diff = weights[n - 1] - weights[0];
      ctx.textAlign = 'center';
      if (diff > 0) {
        ctx.fillStyle = accent;
        ctx.font = '900 36px "DM Sans", sans-serif';
        ctx.fillText(`+${diff}kg in ${n} Wochen${isPr ? ' 🏆' : ''}`, SIZE / 2, hookY);
      } else if (diff === 0) {
        ctx.fillStyle = text;
        ctx.font = '900 36px "DM Sans", sans-serif';
        ctx.fillText(`${weights[n - 1]}kg · ${n} Wochen konstant`, SIZE / 2, hookY);
      } else {
        ctx.fillStyle = text2;
        ctx.font = '900 36px "DM Sans", sans-serif';
        ctx.fillText(`Kontrollierter Rückbau · ${n} Wochen`, SIZE / 2, hookY);
      }
    }

    // ── Zone 3: Stats-Kacheln ────────────────────────────────────────
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, 650);
    ctx.lineTo(SIZE, 650);
    ctx.stroke();

    const tileGap = 16, tileY = 680, tileH = 120;
    const tileW = (chartW - 2 * tileGap) / 3;
    const tiles = [
      { num: `${doneDays}/${totalDays}`, label: 'EINHEITEN DIESE WOCHE', color: text },
      { num: `${streak}`,                label: 'WOCHEN IN FOLGE',       color: text },
      { num: successPct != null ? `${successPct}%` : '—', label: 'SÄTZE AM ZIEL', color: accent },
    ];
    tiles.forEach((t, i) => {
      const tx = chartX + i * (tileW + tileGap);
      ctx.beginPath();
      ctx.moveTo(tx + 12, tileY);
      ctx.arcTo(tx + tileW, tileY, tx + tileW, tileY + tileH, 12);
      ctx.arcTo(tx + tileW, tileY + tileH, tx, tileY + tileH, 12);
      ctx.arcTo(tx, tileY + tileH, tx, tileY, 12);
      ctx.arcTo(tx, tileY, tx + tileW, tileY, 12);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.04)';
      ctx.fill();

      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.font = '900 36px "DM Sans", sans-serif';
      ctx.fillText(t.num, tx + tileW / 2, tileY + 56);
      ctx.fillStyle = text2;
      ctx.font = '400 10px "DM Sans", sans-serif';
      ctx.fillText(t.label, tx + tileW / 2, tileY + 90);
    });

    // ── Zone 4: Footer ────────────────────────────────────────────
    const footY = 860, footH = 100;
    ctx.beginPath();
    ctx.moveTo(chartX + 10, footY);
    ctx.arcTo(chartX + chartW, footY, chartX + chartW, footY + footH, 10);
    ctx.arcTo(chartX + chartW, footY + footH, chartX, footY + footH, 10);
    ctx.arcTo(chartX, footY + footH, chartX, footY, 10);
    ctx.arcTo(chartX, footY, chartX + chartW, footY, 10);
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = text2;
    ctx.font = '600 14px "DM Sans", sans-serif';
    ctx.fillText('TRAIN · KI-gestütztes Kraft-Coaching', SIZE / 2, footY + 44);
    ctx.globalAlpha = 0.3;
    ctx.font = '400 11px "DM Sans", sans-serif';
    _wrapText(ctx, 'Sagt dir was du als Nächstes tun sollst — nicht nur was du gemacht hast', SIZE / 2, footY + 68, chartW - 80, 20, 2);
    ctx.globalAlpha = 1;

    ctx.fillStyle = _withAlpha(accent, 0.4);
    ctx.fillRect(0, SIZE - 3, SIZE, 3);
  });
}

/** Fügt einer #RRGGBB- oder Farbnamen-CSS-Variable eine Alpha-Komponente hinzu. */
function _withAlpha(color, alpha) {
  if (color.startsWith('#') && color.length === 7) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color; // Fallback: unverändert (z.B. bereits rgba()/named color)
}

const SHARE_CONSENT_KEY = 'train_share_consent';

/**
 * Einmaliger Datenschutz-Hinweis vor dem allerersten Teilen (B73) — danach
 * per localStorage-Flag gemerkt, kein erneutes Nachfragen. Zentral hier
 * (nicht an jedem der 3 Aufrufer dupliziert), da shareCanvas() der einzige
 * Punkt ist, durch den JEDER Share-Weg (PR-Moment-Toast, Tagesabschluss,
 * Wochenrückblick-Modal + -Dropdown) tatsächlich läuft.
 */
function _ensureShareConsent() {
  let consented = false;
  try { consented = localStorage.getItem(SHARE_CONSENT_KEY) === 'true'; } catch (_) { /* localStorage blockiert -> jedes Mal fragen */ }
  if (consented) return Promise.resolve(true);

  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'vac-plan-modal-overlay';
    overlay.innerHTML = `
      <div class="vac-plan-modal" style="align-items:center;text-align:center">
        <div class="vac-plan-modal__title" style="font-size:18px">📤 Bild teilen?</div>
        <p class="vac-plan-modal__sub">Dieses Bild enthält deine Trainingsdaten (Übung, Gewicht, Streak). Nur du entscheidest, ob du es teilst.</p>
        <button type="button" class="btn btn--accent" id="share-consent-ok" style="width:100%;min-height:var(--touch)">Verstanden, teilen</button>
        <button type="button" class="btn btn--ghost" id="share-consent-cancel" style="width:100%;min-height:var(--touch)">Abbrechen</button>
      </div>`;
    document.body.appendChild(overlay);
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('#share-consent-ok')?.addEventListener('click', () => {
      try { localStorage.setItem(SHARE_CONSENT_KEY, 'true'); } catch (_) { /* best effort */ }
      cleanup(true);
    });
    overlay.querySelector('#share-consent-cancel')?.addEventListener('click', () => cleanup(false));
  });
}

/**
 * Teilt den Canvas-Inhalt als PNG — natives Share-Sheet, sonst Download-Fallback.
 *
 * Bugfix (Android-Report, "Teilen startet Download statt Share-Dialog"):
 * `navigator.share()` verlangt (besonders auf Android Chrome) einen noch
 * "aktiven" User-Gesten-Kontext — jeder await dazwischen (Consent-Modal-Klick,
 * canvas.toBlob() als echter Hintergrund-Task statt Microtask) kann diesen
 * Kontext verfallen lassen, wodurch navigator.share() sofort mit einem Fehler
 * abbricht, BEVOR ein natives Share-Sheet je erscheint. Blob/File werden
 * daher jetzt VOR dem Consent-Await gebaut (ein asynchroner Schritt weniger
 * zwischen letztem Klick und navigator.share() statt zwei) — behebt das
 * Problem nicht mit Sicherheit (plattformseitige Einschränkung, ohne echtes
 * Android-Gerät nicht abschließend verifizierbar), reduziert aber das Risiko.
 * `_ensureShareConsent()` (B73) bleibt unverändert erhalten.
 */
export async function shareCanvas(canvas, filename, title) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return;

  const consented = await _ensureShareConsent();
  if (!consented) return;

  if (navigator.share && navigator.canShare) {
    const file = new File([blob], filename, { type: 'image/png' });
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title });
        return;
      } catch (err) {
        // AbortError = Nutzer hat den nativen Dialog selbst geschlossen ->
        // das ist eine bewusste Entscheidung, kein Fehler und kein Download.
        if (err?.name === 'AbortError') return;
        // Jeder andere Fehler (z.B. verlorener Gesten-Kontext, siehe oben) ->
        // anonymes GoatCounter-Event (nur der Fehlername, keine Nutzdaten,
        // gleiches Muster wie der bestehende js_error-Pfad, siehe BUGS.md B66)
        // + Download-Fallback wie bisher.
        try { window.goatcounter?.count?.({ path: `share_failed: ${err?.name ?? 'unknown'}`, event: true }); } catch (_) { /* best effort */ }
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
