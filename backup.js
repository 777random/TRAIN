/**
 * backup.js – Data portability layer for the TRAIN app.
 *
 * Provides:
 *   exportJSON()   – downloads the full app state as a JSON backup file.
 *   importJSON()   – reads a JSON file chosen by the user and dispatches
 *                    STATE_IMPORT after validation.
 *   exportCSV()    – builds and downloads a .csv of all training data.
 *                    Zero external dependencies – native JS only.
 *
 * All functions are pure side-effect-free utilities except for the file
 * download helpers, which create a temporary <a> element to trigger the
 * browser's native download mechanism.
 */

import { getState, dispatch, A, SCHEMA_VERSION } from './state.js';

// ─── Internal file-download helper ───────────────────────────────────────────

/**
 * Triggers a browser download for the given Blob.
 * @param {Blob}   blob
 * @param {string} filename
 */
function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  // Append to body so Firefox triggers the download correctly.
  document.body.appendChild(a);
  a.click();
  // Schedule cleanup – revokeObjectURL must happen after the browser
  // has had a chance to initiate the download.
  setTimeout(() => {
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 150);
}

/**
 * Returns a YYYY-MM-DD date string for today.
 */
function today() {
  return new Date().toISOString().split('T')[0];
}

// ─── JSON Backup ──────────────────────────────────────────────────────────────

/**
 * Serialises the entire app state and downloads it as a .json file.
 * The file can later be imported via importJSON() to fully restore all data.
 */
export function exportJSON() {
  const state    = getState();
  const payload  = JSON.stringify(state, null, 2);
  const blob     = new Blob([payload], { type: 'application/json;charset=utf-8' });
  const filename = `TRAIN_Backup_${today()}.json`;
  triggerDownload(blob, filename);
}

/**
 * Opens a file-picker, reads the chosen .json, validates it, then imports
 * the state via dispatch(A.STATE_IMPORT).
 *
 * @param {File} file  – the File object from an <input type="file"> change event.
 * @returns {Promise<void>}
 */
export function importJSON(file) {
  return new Promise((resolve, reject) => {
    if (!file) { reject(new Error('No file provided.')); return; }

    const reader = new FileReader();

    reader.onload = event => {
      let parsed;
      try {
        parsed = JSON.parse(event.target.result);
      } catch {
        reject(new Error('Die Datei enthält kein gültiges JSON.'));
        return;
      }

      // Structural validation – just enough to catch obviously wrong files.
      if (!parsed || typeof parsed !== 'object') {
        reject(new Error('Ungültiges Format.')); return;
      }
      if (!Array.isArray(parsed.weeks)) {
        reject(new Error('Keine Trainingsdaten gefunden (weeks-Array fehlt).')); return;
      }

      // Version check – warn but still import (migrate() will handle it).
      const importedVersion = parsed?.meta?.schemaVersion ?? 0;
      if (importedVersion > SCHEMA_VERSION) {
        console.warn(
          `[TRAIN] Importing state from a NEWER schema version (${importedVersion} > ${SCHEMA_VERSION}). ` +
          'Some features may not work correctly.'
        );
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
// CSV layout (one row per set):
//
// Woche | Zeitraum | Modus | Tag | Schwerpunkt | Übung | Notiz | Satz | kg | Wdh | RPE | Done | Volumen_Satz | Session_Dauer_Min | Körpergewicht | Energie | Schlaf
//
// A second section (separated by two blank rows) contains the summary:
// Woche | Tage_Done | Saetze_Total | Saetze_Done | Abschluss_Pct | Volumen_Total_kg | Avg_Session_Min
//
// Deload-Wochen are flagged in the Modus column so downstream tools (Excel,
// Numbers, Google Sheets) can filter them out for clean progression analysis.

/**
 * Escapes a value for safe inclusion in a CSV cell.
 * - Wraps in double-quotes if the value contains a comma, newline, or quote.
 * - Escapes inner double-quotes by doubling them.
 * @param {*} value
 * @returns {string}
 */
function csvCell(value) {
  const str = value == null ? '' : String(value);
  if (str.includes(',') || str.includes('\n') || str.includes('"')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Joins an array of values into a CSV row string.
 * @param {Array} cells
 * @returns {string}
 */
function csvRow(...cells) {
  return cells.map(csvCell).join(',');
}

/**
 * Computes the KW label for a given YYYY-MM-DD date string.
 * e.g. '2025-04-28' → 'KW 18 · 2025'
 */
function wkLabel(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const jan = new Date(d.getFullYear(), 0, 1);
  const kw  = Math.ceil(((d - jan) / 86_400_000 + jan.getDay() + 1) / 7);
  return `KW ${String(kw).padStart(2, '0')} · ${d.getFullYear()}`;
}

/**
 * Returns the date range string for a week starting on sd.
 * e.g. '28. Apr – 04. Mai'
 */
function wkRange(sd) {
  const d   = new Date(sd + 'T12:00:00');
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const fmt = x => x.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  return `${fmt(d)} – ${fmt(end)}`;
}

/**
 * Builds and downloads a .csv file from all (or a subset of) weeks.
 *
 * @param {'all'|'current'} [scope='all']
 */
export function exportCSV(scope = 'all') {
  const state = getState();
  const weeks = scope === 'current'
    ? [state.weeks[state.curIdx]].filter(Boolean)
    : [...state.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));

  const lines = [];

  // ── Section 1: Detail (one row per set) ────────────────────────────────────

  lines.push(csvRow(
    'Woche', 'Zeitraum', 'Modus', 'Tag', 'Schwerpunkt',
    'Übung', 'Übung_Notiz', 'Satz_Nr',
    'Gewicht_kg', 'Wiederholungen', 'RPE',
    'Abgeschlossen', 'Volumen_Satz_kg',
    'Session_Dauer_Min', 'Körpergewicht_kg', 'Energie_1_5', 'Schlaf_Std',
  ));

  for (const wk of weeks) {
    const label   = wkLabel(wk.startDate);
    const range   = wkRange(wk.startDate);
    const mode    = wk.mode ?? 'standard';
    const bd      = wk.bodyData ?? {};
    const avgDur  = wk.sessionLog?.length
      ? Math.round(wk.sessionLog.reduce((s, l) => s + l.duration, 0) / wk.sessionLog.length / 60)
      : '';

    for (const day of wk.days) {
      for (const ex of day.exercises) {
        ex.sets.forEach((s, si) => {
          lines.push(csvRow(
            label,
            range,
            mode,
            day.title,
            day.subtitle ?? '',
            ex.name,
            si === 0 ? (ex.note ?? '') : '',   // note only on first set row
            si + 1,
            s.weight,
            s.reps,
            s.rpe ?? '',
            s.done ? 'Ja' : 'Nein',
            s.weight * s.reps,
            si === 0 ? avgDur : '',            // session duration on first set
            si === 0 ? (bd.weight ?? '') : '',
            si === 0 ? (bd.energy ?? '') : '',
            si === 0 ? (bd.sleep  ?? '') : '',
          ));
        });
      }
    }
  }

  // ── Section 2: Weekly summary ──────────────────────────────────────────────

  lines.push('', ''); // blank separator rows

  lines.push(csvRow(
    'Woche', 'Zeitraum', 'Modus', 'Notiz',
    'Tage_Done', 'Sätze_Total', 'Sätze_Done', 'Abschluss_Pct',
    'Volumen_Total_kg', 'Avg_Session_Min', 'Sessions_Count',
  ));

  for (const wk of weeks) {
    const label     = wkLabel(wk.startDate);
    const range     = wkRange(wk.startDate);
    const mode      = wk.mode ?? 'standard';
    const setsTotal = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.length, 0), 0);
    const setsDone  = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.filter(st => st.done).length, 0), 0);
    const vol       = wk.days.reduce((s, d) => s + d.exercises.reduce((ss, ex) => ss + ex.sets.reduce((sss, st) => sss + st.weight * st.reps, 0), 0), 0);
    const daysDone  = wk.days.filter(d => !!d.markedDone).length;
    const pct       = setsTotal > 0 ? Math.round(setsDone / setsTotal * 100) : 0;
    const log       = wk.sessionLog ?? [];
    const avgDur    = log.length ? Math.round(log.reduce((s, l) => s + l.duration, 0) / log.length / 60) : '';

    lines.push(csvRow(
      label, range, mode, wk.note ?? '',
      `${daysDone}/3`, setsTotal, setsDone, `${pct}%`,
      vol, avgDur, log.length,
    ));
  }

  // ── Section 3: Progressive Overload (Standard weeks only) ─────────────────

  lines.push('', '');
  lines.push(csvRow(
    'Übung', 'KW_Aktuell', 'Max_Gewicht_kg', 'KW_Vorher',
    'Max_Gewicht_Vorher_kg', 'Delta_kg', 'Delta_Pct', 'Empfehlung',
  ));

  // Collect per-exercise history from Standard weeks only for clean comparison.
  const exMap = new Map();
  for (const wk of weeks.filter(w => (w.mode ?? 'standard') !== 'deload')) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (!exMap.has(ex.name)) exMap.set(ex.name, []);
        exMap.get(ex.name).push({
          week:  wkLabel(wk.startDate),
          maxW:  ex.sets.reduce((m, s) => Math.max(m, s.weight), 0),
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
    const diff = cur.maxW - prev.maxW;
    const pct  = prev.maxW > 0 ? Math.round(diff / prev.maxW * 100) : 0;
    let rec;
    if      (diff > 0)                          rec = 'Gute Progression ✓';
    else if (diff === 0 && cur.done === cur.total) rec = 'Gewicht erhöhen (+2.5 kg)';
    else if (diff === 0)                          rec = 'Alle Sätze abschließen';
    else                                          rec = 'Rückgang – Technik oder Last prüfen';

    lines.push(csvRow(name, cur.week, cur.maxW, prev.week, prev.maxW, diff, `${pct}%`, rec));
  }

  // ── Build blob & download ──────────────────────────────────────────────────

  // BOM (\uFEFF) ensures Excel opens UTF-8 CSVs correctly on Windows.
  const content  = '\uFEFF' + lines.join('\r\n');
  const blob     = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const tag      = scope === 'current' ? wkLabel(weeks[0]?.startDate ?? '').replace(/\s·\s/g, '_') : 'Alle_Wochen';
  const filename = `TRAIN_${tag}_${today()}.csv`;
  triggerDownload(blob, filename);
}
