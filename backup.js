/**
 * backup.js – Data portability layer for the TRAIN app.
 */

import { getState, dispatch, A, SCHEMA_VERSION } from './state.js';

// ─── Download helper ──────────────────────────────────────────────────────────

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); document.body.removeChild(a); }, 150);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── JSON Backup ──────────────────────────────────────────────────────────────

export function exportJSON() {
  const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json;charset=utf-8' });
  triggerDownload(blob, `TRAIN_Backup_${today()}.json`);
}

export function importJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file provided.')); return; }
    const reader = new FileReader();
    reader.onload = event => {
      let parsed;
      try { parsed = JSON.parse(event.target.result); }
      catch { reject(new Error('Die Datei enthält kein gültiges JSON.')); return; }
      if (!parsed || !Array.isArray(parsed.weeks)) {
        reject(new Error('Keine Trainingsdaten gefunden (weeks-Array fehlt).')); return;
      }
      const importedVersion = parsed?.meta?.schemaVersion ?? 0;
      if (importedVersion > SCHEMA_VERSION) {
        console.warn(`[TRAIN] Importing from newer schema (${importedVersion} > ${SCHEMA_VERSION}).`);
      }
      dispatch(A.STATE_IMPORT, { imported: parsed });
      resolve();
    };
    reader.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'));
    reader.readAsText(file);
  });
}

// ─── CSV Export ───────────────────────────────────────────────────────────────
//
// Delimiter: semicolon (;) — German Excel uses comma as decimal separator,
// so semicolon is the standard field separator for German locales.
// BOM at start ensures Excel opens UTF-8 without manual configuration.

function cell(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(';') || str.includes('\n') || str.includes('"')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function row(...cells) { return cells.map(cell).join(';'); }

function sectionHeader(title) { return ['\r\n' + title, '']; }

function fmtDate(sd) {
  if (!sd) return '';
  const [y, m, d] = sd.split('-');
  return `${d}.${m}.${y}`;
}

function wkLabel(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  const kw  = Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
  return `KW ${String(kw).padStart(2, '0')} / ${d.getFullYear()}`;
}

function wkDates(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const end = new Date(d); end.setDate(d.getDate() + 6);
  return [fmtDate(sd), fmtDate(end.toISOString().split('T')[0])];
}

export function exportCSV(scope = 'all') {
  const state = getState();
  const weeks = scope === 'current'
    ? [state.weeks[state.curIdx]].filter(Boolean)
    : [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const lines = [];

  // ── 1. Trainingsdetails ───────────────────────────────────────────────────
  lines.push(...sectionHeader('TRAININGSDETAILS  (eine Zeile pro Satz)'));
  lines.push(row(
    'Kalenderwoche', 'Datum von', 'Datum bis', 'Modus',
    'Trainingstag', 'Schwerpunkt', 'Übung', 'Hinweis',
    'Satz', 'Gewicht (kg)', 'Wdh / Sek / m', 'RPE',
    'Erledigt', 'Volumen Satz (kg)',
    'Körpergewicht (kg)', 'Energie (1-5)', 'Schlaf (Std)',
  ));

  for (const wk of weeks) {
    const kw         = wkLabel(wk.startDate);
    const [von, bis] = wkDates(wk.startDate);
    const modus      = wk.mode === 'deload' ? 'Deload' : 'Standard';
    const bd         = wk.bodyData ?? {};

    for (const day of wk.days) {
      for (const ex of day.exercises) {
        ex.sets.forEach((s, si) => {
          const first = si === 0;
          lines.push(row(
            kw, von, bis, modus,
            day.title, day.subtitle ?? '', ex.name,
            first ? (ex.note ?? '') : '',
            si + 1,
            s.weight ?? 0, s.reps ?? '', s.rpe ?? '',
            s.done ? 'Ja' : 'Nein',
            (s.weight ?? 0) * (s.reps ?? 0),
            first ? (bd.weight ?? '') : '',
            first ? (bd.energy ?? '') : '',
            first ? (bd.sleep  ?? '') : '',
          ));
        });
      }
    }
  }

  // ── 2. Wochenübersicht ────────────────────────────────────────────────────
  lines.push(...sectionHeader('WOCHENÜBERSICHT'));
  lines.push(row(
    'Kalenderwoche', 'Datum von', 'Datum bis', 'Modus', 'Notiz',
    'Tage abgeschlossen', 'Sätze gesamt', 'Sätze erledigt', 'Abschluss %',
    'Gesamtvolumen (kg)', 'Ø Session (Min)', 'Sessions',
    'Körpergewicht (kg)', 'Schlaf (Std)', 'Energie (1-5)',
  ));

  for (const wk of weeks) {
    const kw         = wkLabel(wk.startDate);
    const [von, bis] = wkDates(wk.startDate);
    const modus      = wk.mode === 'deload' ? 'Deload' : 'Standard';
    const bd         = wk.bodyData ?? {};
    const tot  = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.length, 0), 0);
    const done = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.filter(st => st.done).length, 0), 0);
    const vol  = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.reduce((sss, st) => sss + (st.weight ?? 0) * (st.reps ?? 0), 0), 0), 0);
    const dd   = wk.days.filter(d => !!d.markedDone).length;
    const pct  = tot > 0 ? Math.round(done / tot * 100) : 0;
    const log  = wk.sessionLog ?? [];
    const avg  = log.length ? Math.round(log.reduce((s, l) => s + l.duration, 0) / log.length / 60) : '';

    lines.push(row(
      kw, von, bis, modus, wk.note ?? '',
      `${dd}/${wk.days.length}`, tot, done, `${pct}%`,
      vol, avg, log.length,
      bd.weight ?? '', bd.sleep ?? '', bd.energy ?? '',
    ));
  }

  // ── 3. Progression pro Übung (nur Standard-Wochen) ────────────────────────
  lines.push(...sectionHeader('PROGRESSION PRO ÜBUNG  (nur Standard-Wochen, Vergleich letzte zwei Einheiten)'));
  lines.push(row(
    'Übung',
    'Aktuelle KW', 'Max. Gewicht aktuell (kg)',
    'Vorherige KW', 'Max. Gewicht vorher (kg)',
    'Veränderung (kg)', 'Veränderung (%)', 'Empfehlung',
  ));

  const exMap = new Map();
  for (const wk of weeks.filter(w => (w.mode ?? 'standard') !== 'deload')) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (!exMap.has(ex.name)) exMap.set(ex.name, []);
        exMap.get(ex.name).push({
          kw:    wkLabel(wk.startDate),
          maxW:  ex.sets.reduce((m, s) => Math.max(m, s.weight ?? 0), 0),
          done:  ex.sets.filter(s => s.done).length,
          total: ex.sets.length,
        });
      }
    }
  }

  for (const [name, entries] of exMap) {
    if (entries.length < 2) continue;
    const cur  = entries[entries.length - 1];
    const prev = entries[entries.length - 2];
    const diff = +(cur.maxW - prev.maxW).toFixed(2);
    const pct  = prev.maxW > 0 ? Math.round(diff / prev.maxW * 100) : 0;
    const rec  = diff > 0                           ? 'Gute Progression ✓'
               : diff === 0 && cur.done === cur.total ? 'Gewicht erhöhen (+2.5 kg)'
               : diff === 0                           ? 'Alle Sätze abschließen'
               :                                        'Rückgang – Technik oder Last prüfen';
    lines.push(row(name, cur.kw, cur.maxW, prev.kw, prev.maxW, diff, `${pct}%`, rec));
  }

  // ── Download ───────────────────────────────────────────────────────────────
  const bom     = '﻿';
  const content = bom + lines.join('\r\n');
  const blob    = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const tag     = scope === 'current'
    ? wkLabel(weeks[0]?.startDate ?? '').replace(/\s\/\s/g, '-').replace(/\s/g, '')
    : 'Alle_Wochen';
  triggerDownload(blob, `TRAIN_Export_${tag}_${today()}.csv`);
}
