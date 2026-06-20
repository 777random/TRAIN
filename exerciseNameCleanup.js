/**
 * exerciseNameCleanup.js – Erkennung von Übungsnamen-Duplikaten und
 * Tippfehler-Kandidaten. Pure Funktionen, keine Seiteneffekte, keine Importe.
 * Führt NIEMALS selbst etwas zusammen — nur Erkennung/Vorschlag.
 */

/** Einfache eigene Levenshtein-Distanz-Implementierung (keine externe Library). */
export function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1]);
    }
    prev = cur;
  }
  return prev[n];
}

/** Zählt alle Sätze für jeden exakten (nicht normalisierten) Übungsnamen über alle Wochen. */
function _setCountsByExactName(weeks) {
  const counts = new Map();
  for (const wk of weeks ?? []) {
    for (const day of wk.days ?? []) {
      for (const ex of day.exercises ?? []) {
        counts.set(ex.name, (counts.get(ex.name) ?? 0) + (ex.sets?.length ?? 0));
      }
    }
  }
  return counts;
}

const _normKey = name => String(name ?? '').trim().toLowerCase();

/**
 * Findet Gruppen exakter Trim-Duplikate: Namen die nach .trim().toLowerCase()
 * identisch sind, aber im Original unterschiedlich geschrieben wurden.
 *
 * @returns {{ key: string, variants: { name: string, setCount: number }[], totalSets: number }[]}
 */
export function findExactDuplicates(state) {
  const counts = _setCountsByExactName(state.weeks);
  const byKey = new Map();
  for (const [name, setCount] of counts) {
    const key = _normKey(name);
    if (!key) continue;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({ name, setCount });
  }
  const groups = [];
  for (const [key, variants] of byKey) {
    const distinctSpellings = new Set(variants.map(v => v.name));
    if (distinctSpellings.size < 2) continue; // alle Vorkommen exakt gleich geschrieben
    variants.sort((a, b) => b.setCount - a.setCount);
    groups.push({ key, variants, totalSets: variants.reduce((s, v) => s + v.setCount, 0) });
  }
  return groups;
}

/**
 * Findet Paare ähnlicher (aber nicht exakt-trim-identischer) Übungsnamen mit
 * Levenshtein-Distanz 1-2, die noch nicht in dismissedNamePairs verworfen
 * wurden. Schließt Paare aus, die bereits als exaktes Trim-Duplikat erkannt
 * würden (gleicher .trim().toLowerCase()).
 *
 * @returns {{ a: string, b: string, setCountA: number, setCountB: number, distance: number }[]}
 */
export function findSimilarCandidates(state) {
  const counts = _setCountsByExactName(state.weeks);
  const names = [...counts.keys()].filter(n => _normKey(n));
  const dismissed = new Set(
    (state.settings?.dismissedNamePairs ?? []).map(pair => `${pair[0]}|${pair[1]}`)
  );

  const candidates = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i], b = names[j];
      const keyA = _normKey(a), keyB = _normKey(b);
      if (keyA === keyB) continue; // exaktes Trim-Duplikat, separat behandelt

      const dismissKey = [keyA, keyB].sort().join('|');
      if (dismissed.has(dismissKey)) continue;

      const dist = levenshtein(keyA, keyB);
      if (dist >= 1 && dist <= 2) {
        candidates.push({ a, b, setCountA: counts.get(a) ?? 0, setCountB: counts.get(b) ?? 0, distance: dist });
      }
    }
  }
  return candidates;
}
