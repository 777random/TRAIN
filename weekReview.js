/**
 * weekReview.js – Pure function, kein DOM, kein State-Zugriff (gemeint ist:
 * kein getState()/dispatch() — der Import von isTrainingDay() aus state.js
 * ist eine reine, zustandslose Prädikat-Funktion, keine State-Kopplung).
 * Berechnet strukturierten Wochenrückblick aus einer Woche + allen Wochen.
 */

import { weekSuccessCounts } from './setUtils.js';
import { isTrainingDay, calcCurrentStreak } from './state.js';

// Echter ISO-8601-Algorithmus (Donnerstag-Verschiebung), B194
// (Runde 10, Domäne A): die vorherige Näherungsformel wich an
// Jahresgrenzen ab — vereinheitlicht mit ui.js' wkLabel()/_isoWeek().
function _kw(sd) {
  const d = new Date(sd + 'T12:00:00');
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - yearStart) / 86_400_000 + 1) / 7);
}

// 'YYYY-MM-DD' aus lokalen Datumskomponenten (kein toISOString()/UTC-
// Rollover) — Duplikat von ui.js' _localISODate() (dort nicht importiert:
// dieser Datei-Kopfkommentar sagt "kein State-Zugriff", ein Import aus
// ui.js wäre zudem zirkulär, da ui.js bereits weekReview.js importiert).
// Runde 18 (Cluster 2.2/2.3): vorher nutzten _dayISODate() UND die
// todayISO-Berechnung in _reachableDays() jeweils .toISOString(), das bei
// negativer UTC-Differenz zur Lokalzeit (z.B. Deutschland nahe Mitternacht)
// auf den VORHERIGEN Kalendertag zurückrollen kann — ein bereits zweimal
// gefixtes Antimuster in dieser Datei ("Fix 3", "Fix 3b Nachbessern"), hier
// erneut aufgetreten, weil todayISO nie auf dieselbe lokale Berechnung
// umgestellt wurde wie _dayISODate()'s Mittags-Anker.
function _localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ISO-Datum eines Tag-Slots — identische Formel zu ui.js' _dayDate().
function _dayISODate(week, dayIdx) {
  const d = new Date(week.startDate + 'T12:00:00');
  d.setDate(d.getDate() + dayIdx);
  return _localISODate(d);
}

// Tage, die weder abgeschlossen sind NOCH schon stattgefunden haben, dürfen
// nicht als "verpasst" gezählt werden — sie sind einfach noch nicht dran
// (Sprint "Kategorie-1-Bugfixes", Fix 3; Off-by-one behoben in Sprint
// "Fix3 + Fix4 Nachbessern", Fix 3b). Betrifft in der Praxis nur die
// aktuell laufende, noch nicht abgeschlossene Woche im Wochenrückblick.
//
// "<" statt "<=": der HEUTIGE Tag ist erst NACH Ablauf des Tages "erreicht"
// im Sinne von "hätte schon erledigt sein können" — mit "<=" zählte der
// laufende, noch nicht abgeschlossene heutige Tag sofort als fällig und
// damit als "verpasst", sobald er nicht schon zu Tagesbeginn markedDone
// war (bestätigt per Diagnose-Reproduktion: bei todayISO === Tag-Datum
// kippte der noch laufende Tag ohne "<"-Fix in "verpasst").
//
// isTrainingDay()-Filter ergänzt (Konsolidierung 2026-07-14, B44): reine
// Ruhe-Urlaubstage (isVacation && vacationPlan==='rest') zählten hier
// bisher trotzdem als "geplant", während consistencyUtils.js/state.js sie
// schon immer korrekt ausschließen — dieselbe Regel, dieselbe Quelle wie
// dort, keine eigene Kopie der Ausschluss-Logik.
function _reachableDays(week) {
  const todayISO = _localISODate(new Date());
  return week.days.filter((d, i) => isTrainingDay(d) && (d.markedDone || _dayISODate(week, i) < todayISO));
}

function _sumVolume(week) {
  let v = 0;
  for (const d of week.days)
    for (const ex of d.exercises)
      for (const s of ex.sets)
        if (s.status === 'success') v += (s.weight ?? 0) * (s.reps ?? 0);
  return Math.round(v);
}

function _countSuccessSets(week) {
  let n = 0;
  for (const d of week.days)
    for (const ex of d.exercises)
      for (const s of ex.sets)
        if (s.status === 'success') n++;
  return n;
}

function _maxWeightPerExercise(week) {
  const map = new Map();
  for (const d of week.days)
    for (const ex of d.exercises) {
      const successW = ex.sets
        .filter(s => s.status === 'success' && (s.weight ?? 0) > 0)
        .map(s => s.weight);
      if (!successW.length) continue;
      const maxW = Math.max(...successW);
      if (!map.has(ex.name) || map.get(ex.name) < maxW) map.set(ex.name, maxW);
    }
  return map;
}

// Nutzer-Feedback (2026-08-17): Prioritäten-System für Highlights/Lowlights
// -- Favoriten-Übungen sollen bevorzugt gemeldet werden; nur wenn UNTER den
// Favoriten nichts Passendes zu finden ist, wird auf alle Übungen
// ausgewichen. `restrictNames` (Set|null) grenzt die Suche in den einzelnen
// _find*()-Funktionen ein; `_withFavoritesFirst()` orchestriert den
// zweistufigen Versuch (erst Favoriten, dann alle) einheitlich für alle
// Finder-Funktionen unten.
function _withFavoritesFirst(finder, favoriteExercises) {
  if (favoriteExercises?.length) {
    const favResult = finder(new Set(favoriteExercises));
    if (favResult) return favResult;
  }
  return finder(null);
}

function _findPR(week, prevWeeks, restrictNames = null) {
  const thisMax = _maxWeightPerExercise(week);
  const histMax = new Map();
  for (const wk of prevWeeks)
    _maxWeightPerExercise(wk).forEach((w, name) => {
      if (!histMax.has(name) || histMax.get(name) < w) histMax.set(name, w);
    });

  let best = null, bestDelta = 0;
  thisMax.forEach((w, name) => {
    if (restrictNames && !restrictNames.has(name)) return;
    const prev  = histMax.get(name) ?? 0;
    const delta = w - prev;
    if (delta > bestDelta) { bestDelta = delta; best = { name, weight: w, prev }; }
  });
  if (!best) return null;
  const text = best.prev > 0
    ? `${best.name} ${best.weight} kg (+${best.weight - best.prev} kg)`
    : `${best.name} ${best.weight} kg`;
  return { type: 'pr', label: 'Neuer PR', text, exName: best.name };
}

function _findBestGain(week, prevWeek, restrictNames = null) {
  const thisMax = _maxWeightPerExercise(week);
  const prevMax = _maxWeightPerExercise(prevWeek);
  let best = null, bestDelta = 0;
  thisMax.forEach((w, name) => {
    if (restrictNames && !restrictNames.has(name)) return;
    const prev  = prevMax.get(name) ?? 0;
    const delta = w - prev;
    if (prev > 0 && delta > bestDelta) { bestDelta = delta; best = { name, delta }; }
  });
  if (!best) return null;
  return { type: 'gain', label: 'Stärkste Steigerung', text: `${best.name} +${best.delta} kg ggü. Vorwoche`, exName: best.name };
}

// Drittes Highlight neben PR/Steigerung: eine Übung, die diese Woche
// vollständig (100 %, mind. 3 bewertete Sätze) erfolgreich war -- ein
// eigenständiges "gutes Zeichen" (saubere Ausführung), unabhängig von
// Gewichtszahlen, damit auch ohne neuen PR/Steigerung ein drittes,
// aussagekräftiges Highlight möglich ist.
function _findPerfectExercise(week, restrictNames = null) {
  let best = null;
  for (const d of week.days)
    for (const ex of d.exercises) {
      if (restrictNames && !restrictNames.has(ex.name)) continue;
      const evaluated = ex.sets.filter(s => s.status === 'success' || s.status === 'fail');
      if (evaluated.length < 3) continue;
      const allSuccess = evaluated.every(s => s.status === 'success');
      if (allSuccess && (!best || evaluated.length > best.sets)) best = { name: ex.name, sets: evaluated.length };
    }
  if (!best) return null;
  return { type: 'perfect', label: 'Saubere Ausführung', text: `${best.name}: alle ${best.sets} Sätze erfolgreich`, exName: best.name };
}

// Delegiert an setUtils.js (Konsolidierung 2026-07-14 — war vorher hier
// UND in ui.js unabhängig dupliziert, mit unterschiedlicher Archiviert-
// Behandlung, siehe setUtils.js-Kommentar).
function _calcSuccessScore(week) {
  const { total, pct } = weekSuccessCounts(week);
  return total > 0 ? pct : null;
}

/**
 * B74: delegiert vollständig an calcCurrentStreak() (state.js) statt einer
 * eigenen, einfacheren Logik — die frühere eigenständige Implementierung
 * (nur `days.some(d => d.markedDone)`, kein Schwellenwert, keine
 * Kalenderlücken-Prüfung) wich vom Training-Tab-Badge ab: zählte
 * Teilabschlüsse unter der 70%-'completed'-Schwelle mit UND zählte durch
 * mehrwöchige Trainingspausen einfach durch (kein `_streakGapBreaks()`-
 * Äquivalent). Betraf sowohl den Wochenrückblick als auch das davon
 * gespeiste Share-Bild — Letzteres hätte dadurch eine objektiv falsche
 * Streak-Zahl öffentlich geteilt. `slice(0, idx+1)` liefert exakt "der
 * Streak-Stand zum Zeitpunkt dieser Woche", identische Semantik wie die
 * Training-Tab-Badge (inkl. B69: eine noch laufende, unvollständige
 * neueste Woche in der Slice bricht die Streak nicht sofort).
 */
function _calcStreak(sortedWeeks, week) {
  const idx = sortedWeeks.findIndex(w => w === week || w.startDate === week.startDate);
  if (idx < 0) return 0;
  return calcCurrentStreak(sortedWeeks.slice(0, idx + 1));
}

// Pre-Launch-Diagnose-Sprint 2026-07-29, Befund #1: eine Übung, die per
// Skip-Grund-Dialog (B129) explizit als "Verletzung/Schmerzen" markiert
// wurde (ex.skipReason === 'injury'), landete trotzdem ungeprüft im "Was
// nicht gut lief"-Lowlight inkl. der Empfehlung "Gewicht um 5 % reduzieren"
// (_buildRecommendations) — obwohl der Nutzer die Übung aktiv als
// verletzungsbedingt ausgesetzt gekennzeichnet hat, nicht als Trainingsfehler.
// Fix: verletzungsbedingt übersprungene Übungen werden hier ausgeschlossen.
// Bewusst NICHT in weekSuccessCounts()/_calcSuccessScore() geändert — die
// Erfolgsquoten-Kernmetrik bleibt unverändert (ein Ausfall bleibt für die
// Statistik ein Ausfall), nur die konkrete Handlungsempfehlung/Lowlight-
// Anzeige entfällt für explizit verletzungsbedingte Fälle.
function _findFailHighlight(week, restrictNames = null) {
  let worstName = null, worstCount = 0;
  for (const d of week.days)
    for (const ex of d.exercises) {
      if (ex.skipReason === 'injury') continue;
      if (restrictNames && !restrictNames.has(ex.name)) continue;
      const n = ex.sets.filter(s => s.status === 'fail').length;
      if (n > worstCount) { worstCount = n; worstName = ex.name; }
    }
  if (!worstName) return null;
  return {
    type: 'fails', label: 'Fehlgeschlagene Sätze',
    text: `${worstName}: ${worstCount} ${worstCount === 1 ? 'fehlgeschlagener Satz' : 'fehlgeschlagene Sätze'}`,
    exName: worstName,
  };
}

function _findFatigueHighlight(week, restrictNames = null) {
  let worst = null, worstRpe = 0;
  for (const d of week.days)
    for (const ex of d.exercises) {
      if (restrictNames && !restrictNames.has(ex.name)) continue;
      const rpeSets = ex.sets.filter(s => s.rpe != null && s.status === 'success');
      if (!rpeSets.length) continue;
      const avg = rpeSets.reduce((sum, s) => sum + s.rpe, 0) / rpeSets.length;
      if (avg >= 8.5 && avg > worstRpe) { worstRpe = avg; worst = { name: ex.name, rpe: Math.round(avg * 10) / 10 }; }
    }
  if (!worst) return null;
  return { type: 'fatigue', label: 'Hohe Belastung', text: `${worst.name}: Ø RPE ${worst.rpe}`, exName: worst.name };
}

// Runde 18 (Cluster 2.4): h1 (bestes Highlight) und l1 (schlimmstes
// Lowlight) wurden bisher komplett unabhängig in je eine eigene
// Empfehlungszeile übersetzt — bei identischer Übung (z.B. PR-Satz UND
// höchster-RPE-Satz derselben Woche gehören zu derselben Übung) entstanden
// zwei nebeneinanderstehende, einander widersprechende Aussagen ("halte
// Gewicht, steigere Volumen" vs. "leichtere Einheit einplanen"). Verschmilzt
// beide Informationen zu EINER Aussage statt eine stillschweigend zu
// unterdrücken.
function _mergedHighlightLowlightText(h1, l1) {
  const name = h1.exName;
  const achievement = h1.type === 'pr'
    ? `einen neuen PR bei ${name} aufgestellt`
    : h1.type === 'gain'
      ? `dich bei ${name} spürbar gesteigert`
      : `bei ${name} gut abgeschnitten`;

  if (l1.type === 'fatigue') {
    return `Du hast ${achievement}, allerdings bei hoher Anstrengung — Gewicht diese Woche halten statt weiter zu steigern.`;
  }
  if (l1.type === 'fails') {
    return `Du hast ${achievement}, aber auch fehlgeschlagene Sätze bei derselben Übung — Volumen oder Gewicht für die nächste Einheit leicht reduzieren statt direkt weiter zu steigern.`;
  }
  // 'missed' hat kein exName, kann diesen Zweig also nicht erreichen —
  // Fallback nur zur Sicherheit, falls künftig ein neuer Lowlight-Typ mit
  // exName hinzukommt.
  return `${name}: gemischtes Bild diese Woche — beobachten, bevor du weiter steigerst.`;
}

function _buildRecommendations(highlights, lowlights, completedDays, plannedDays, isDeload) {
  if (isDeload) {
    return [
      { text: 'Deload-Woche erfolgreich abgeschlossen — nächste Woche wieder Vollgas.' },
      { text: 'Nutze die Erholungsphase, schlafe ausreichend und erhöhe dann schrittweise die Intensität.' },
    ];
  }

  const recs = [];
  const h1 = highlights[0];
  const l1 = lowlights[0];

  // Gleiche Übung in Highlight UND Lowlight -> eine verschmolzene Aussage
  // statt zwei einander widersprechenden Zeilen.
  if (h1?.exName && l1?.exName && h1.exName === l1.exName) {
    recs.push({ text: _mergedHighlightLowlightText(h1, l1) });
    return recs;
  }

  // Rec 1: bestes Highlight
  if (h1?.type === 'pr') {
    recs.push({ text: 'Du hast einen neuen PR aufgestellt — halte dieses Gewicht und steigere nächste Woche das Volumen.' });
  } else if (h1?.type === 'gain') {
    const name = h1.text.split(' +')[0];
    recs.push({ text: `${name} war dein stärkster Lift — halte den Trend und plane eine weitere kleine Steigerung.` });
  } else if (h1?.type === 'streak') {
    const n = parseInt(h1.text, 10);
    recs.push({ text: `${n} Wochen konsistentes Training — weiter so und achte auf Überbelastungszeichen.` });
  } else if (h1?.type === 'perfect') {
    // Fortschritt-Tab-Audit (Runde 27): fehlender Zweig -- 'perfect'
    // (Runde 23/B268) fiel bisher in den generischen else-Fallback statt
    // wie 'pr'/'gain'/'streak' die konkrete Übung zu nennen. Die
    // verschmolzene Highlight+Lowlight-Variante (_mergedHighlightLowlightText)
    // behandelt 'perfect' bereits korrekt, hier war die Nachbarstelle
    // übersehen worden.
    recs.push({ text: `${h1.exName} lief diese Woche fehlerfrei — ein guter Kandidat für die nächste kleine Steigerung.` });
  } else {
    recs.push({ text: 'Konsistenz ist der Schlüssel — halte das Tempo bei und fokussiere dich auf saubere Technik.' });
  }

  // Rec 2: schlimmstes Lowlight
  if (l1?.type === 'fails') {
    const name = l1.text.split(':')[0];
    recs.push({ text: `Fehlgeschlagene Sätze bei ${name} — reduziere das Gewicht um 5 % oder das Volumen um einen Satz.` });
  } else if (l1?.type === 'missed') {
    const missed = plannedDays - completedDays;
    recs.push({ text: `${missed} ${missed === 1 ? 'Tag' : 'Tage'} verpasst — plane die Sessions kürzer oder lege sie früher im Tag.` });
  } else if (l1?.type === 'fatigue') {
    const name = l1.text.split(':')[0];
    recs.push({ text: `Hohe RPE-Werte bei ${name} — plane für diese Übung nächste Woche eine leichtere Einheit ein.` });
  } else {
    recs.push({ text: 'Alles nach Plan — nächste Woche weiter so und beobachte, ob du das Volumen leicht steigern kannst.' });
  }

  return recs;
}

/**
 * Berechnet einen strukturierten Wochenrückblick.
 *
 * Plateau ist NICHT mehr Teil von "Was nicht gut lief" (Sprint C2,
 * train-v109) — lebt jetzt ausschließlich im Coach-Tab (Fokus der Woche,
 * weeklyFocus.js), inkl. eigener Decisional-Balance + Ignorieren/Umgesetzt-
 * Buttons. Kein plateaus-Parameter mehr nötig.
 *
 * @param {Object} week               Die zu reviewende Woche
 * @param {Array}  allWeeks           Alle Wochen (für PR-Vergleich und Streak)
 * @param {Array}  [favoriteExercises=[]]  Favorisierte Übungsnamen
 * @returns {{ summary, highlights, lowlights, recommendations, isDeload, week }}
 */
export function buildWeekReview(week, allWeeks, favoriteExercises = []) {
  const isDeload   = week.mode === 'deload';
  const isVacation = week.mode === 'vacation';
  const sorted   = [...allWeeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const weekIdx  = sorted.findIndex(w => w === week || w.startDate === week.startDate);
  const prevWeek = weekIdx > 0 ? sorted[weekIdx - 1] : null;

  // ── Summary ──────────────────────────────────────────────────────────────────
  const totalSets        = _countSuccessSets(week);
  // Nur "erreichbare" Tage zählen (heute oder früher, oder bereits erledigt)
  // — verhindert dass Tage der laufenden Woche, die schlicht noch nicht
  // dran waren, als "verpasst" gezählt werden (Fix 3).
  const reachableDays    = _reachableDays(week);
  const completedDays    = reachableDays.filter(d => d.markedDone).length;
  const plannedDays      = reachableDays.length;
  const sessionDurs      = (week.sessionLog ?? []).map(l => l.duration);
  const avgSessionDuration = sessionDurs.length
    ? Math.round(sessionDurs.reduce((a, b) => a + b, 0) / sessionDurs.length / 60)
    : null;
  const streak         = _calcStreak(sorted, week);
  const goalFulfillment = _calcSuccessScore(week);
  const summary = { streak, totalSets, completedDays, plannedDays, avgSessionDuration, goalFulfillment };

  // ── Highlights ────────────────────────────────────────────────────────────────
  // Nutzer-Feedback (2026-08-17): jetzt bis zu 3 Highlights UND 3 Lowlights
  // (vorher 2/2), jeweils mit Favoriten-Priorität -- jede _find*()-Funktion
  // wird zuerst NUR auf favoriteExercises eingeschränkt versucht
  // (_withFavoritesFirst()); findet sich dort nichts, weicht sie auf alle
  // Übungen aus. Kein erzwungenes Auffüllen auf exakt 3 -- fehlt ein
  // drittes echtes Signal, bleibt die Liste kürzer, statt Inhalte zu
  // erfinden.
  //
  // Runde 9/Cluster 2: Deload-Wochen fließen weder als aktuelle Woche noch
  // als Vergleichs-Baseline in PR-/Steigerungs-Erkennung ein — analog zum
  // bereits etablierten Muster in insightEngine.js/ui.js/state.js (Gewicht
  // ist in einer Deload-Woche absichtlich reduziert, kein echter PR/Fortschritt).
  const highlights  = [];
  // Fortschritt-Tab-Audit (Runde 27): isSeedWeek + vacation ergänzt --
  // vorher nur Deload ausgeschlossen. Die Startwerte-Woche (selbst
  // geschätztes Gewicht, kein echtes Training) konnte so als PR-Baseline
  // einfließen, gleiche Fehlerklasse wie bei den 3 Fundstellen, an denen die
  // Seed-Woche selbst als reviewbar galt.
  const prevWeeks   = weekIdx > 0 ? sorted.slice(0, weekIdx).filter(w => w.mode !== 'deload' && w.mode !== 'vacation' && !w.isSeedWeek) : [];
  let prH = null, gainH = null;
  if (!isDeload) {
    prH = _withFavoritesFirst(names => _findPR(week, prevWeeks, names), favoriteExercises);
    if (prH) highlights.push(prH);
  }
  // Solotest-Feedback (2026-08-16): "Stärkste Steigerung" zeigte oft dieselbe
  // Übung wie "Neuer PR" nochmal an (beides aus demselben Max-Gewicht
  // abgeleitet) -- reine Redundanz ohne neue Info. Übersprungen, wenn beide
  // Highlights dieselbe Übung meinen (Option A der Diagnose).
  // Fortschritt-Tab-Audit (Runde 27): isSeedWeek + vacation ergänzt, gleicher
  // Grund wie beim prevWeeks-Filter oben.
  if (!isDeload && prevWeek && prevWeek.mode !== 'deload' && prevWeek.mode !== 'vacation' && !prevWeek.isSeedWeek) {
    gainH = _withFavoritesFirst(names => _findBestGain(week, prevWeek, names), favoriteExercises);
    if (gainH && gainH.exName !== prH?.exName && highlights.length < 3) highlights.push(gainH);
    else gainH = null;
  }
  if (!isDeload && highlights.length < 3) {
    const perfectH = _withFavoritesFirst(names => _findPerfectExercise(week, names), favoriteExercises);
    if (perfectH && perfectH.exName !== prH?.exName && perfectH.exName !== gainH?.exName) highlights.push(perfectH);
  }
  // "Konsistenz" (Streak) bewusst NICHT als Highlight-Kandidat -- der Streak
  // ist bereits dauerhaft sichtbar (Fortschritt-Tab), Wiederholung hier bot
  // laut Nutzer-Feedback keinen Mehrwert ("hat für den Athleten keinen
  // Mehrwert", Solotest-Feedback 2026-08-16).

  // ── Lowlights ─────────────────────────────────────────────────────────────────
  const lowlights = [];
  const failH = _withFavoritesFirst(names => _findFailHighlight(week, names), favoriteExercises);
  if (failH) lowlights.push(failH);
  if (completedDays < plannedDays && lowlights.length < 3)
    lowlights.push({
      type: 'missed', label: 'Verpasste Tage',
      text: `${plannedDays - completedDays} von ${plannedDays} ${plannedDays === 1 ? 'Tag' : 'Tagen'} nicht abgeschlossen`,
    });
  if (lowlights.length < 3) {
    const fatigueH = _withFavoritesFirst(names => _findFatigueHighlight(week, names), favoriteExercises);
    if (fatigueH && fatigueH.exName !== failH?.exName) lowlights.push(fatigueH);
  }

  // ── Recommendations ───────────────────────────────────────────────────────────
  const recommendations = _buildRecommendations(highlights, lowlights, completedDays, plannedDays, isDeload);

  return { summary, highlights, lowlights, recommendations, isDeload, isVacation, week };
}
