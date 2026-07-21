/**
 * sessionCoach.js – Intra-Session Coach (B77): reine Berechnungsfunktionen
 * für das Feedback direkt nach einem bewerteten Satz (Gewicht/Pause-
 * Empfehlung, Abschluss-Nachricht, Aufwärm-Sätze).
 *
 * Bewusst importfrei (Tiefe 0, wie movementMap.js/setUtils.js) — weder
 * weeklyFocus.js/Coach-Tab noch getWeightRecommendation() (weightRecommen-
 * dation.js) werden hier berührt oder wiederverwendet: die "nächste Woche"-
 * Empfehlung dort bleibt ausschließlich dafür reserviert (DECISIONS.md,
 * Sprint 1/B76). Alle Vorschläge hier sind rein session-lokal — basieren
 * nur auf dem gerade bewerteten Satz selbst, nie auf mehrwöchiger Historie.
 */

function _round(weight, step) {
  step = step || 2.5;
  return Math.round(weight / step) * step;
}

/** Dämpft einen vorgeschlagenen Wert bei reduzierter Tagesform (B76-Modifier). */
function _applyModifier(nextWeight, currentWeight, sessionModifier, step) {
  if (sessionModifier !== 'reduced') return nextWeight;
  return Math.max(nextWeight * 0.9, currentWeight - step);
}

/**
 * Feedback für einen NICHT-letzten Satz einer Übung — Gewichts-/Pause-
 * Vorschlag für den nächsten Satz. `s` muss bereits bewertet sein
 * (status 'success'|'fail'), sonst null.
 *
 * @param {Object} s               Der gerade bewertete Satz
 * @param {Object} ex               Die zugehörige Übung
 * @param {string|null} sessionModifier  day.sessionModifier ('reduced'|'normal'|'optimal'|null)
 * @returns {{ nextWeight: number, pauseSec: number|null, hint: string|null } | null}
 */
export function buildSetFeedback(s, ex, sessionModifier) {
  if (!s || (s.status !== 'success' && s.status !== 'fail')) return null;
  const step = ex.weightStep || 2.5;
  const currentWeight = s.weight ?? 0;
  const rpe = s.rpe;

  // Ohne RPE: nur die eigene, session-lokale Erfolg/Fehlschlag-Logik (kein
  // getWeightRecommendation()-Aufruf, siehe Datei-Kommentar oben) — s.status
  // spiegelt bereits "Ziel-Wdh erreicht?" (Reducer-Logik in state.js).
  if (rpe == null) {
    let nextWeight = s.status === 'success' ? currentWeight : currentWeight - step;
    nextWeight = _applyModifier(nextWeight, currentWeight, sessionModifier, step);
    return { nextWeight: _round(nextWeight, step), pauseSec: null, hint: null };
  }

  let nextWeight, pauseSec, hint;
  if (rpe <= 6) {
    nextWeight = currentWeight + step; pauseSec = 90;  hint = 'Noch Luft — steigern';
  } else if (rpe < 8) { // 6.5, 7, 7.5
    nextWeight = currentWeight;        pauseSec = 120; hint = 'Gute Intensität';
  } else if (rpe < 9) { // 8, 8.5 — Erfolg vs. Ziel-Wdh verfehlt (Reducer-Status, kein erneuter reps-Vergleich)
    if (s.status === 'fail') {
      nextWeight = currentWeight - step; pauseSec = 180; hint = 'Unter Ziel-Wdh — leicht reduzieren';
    } else {
      nextWeight = currentWeight;        pauseSec = 180; hint = 'Optimale Zone';
    }
  } else if (rpe < 10) { // 9, 9.5
    nextWeight = currentWeight - step; pauseSec = 240; hint = 'Sehr hart — reduzieren + längere Pause';
  } else { // 10
    nextWeight = currentWeight - (step * 2); pauseSec = 300; hint = 'Maximum — deutlich reduzieren';
  }

  nextWeight = _applyModifier(nextWeight, currentWeight, sessionModifier, step);
  return { nextWeight: _round(nextWeight, step), pauseSec, hint };
}

/**
 * Abschluss-Nachricht für den LETZTEN Satz einer Übung. `nextWeekWeight`
 * kommt vom Aufrufer (ui.js, via getWeightRecommendation() — das ist der
 * einzige legitime Gebrauch dieser Funktion hier: eine echte "nächste
 * Woche"-Projektion, kein Ersatz für den session-lokalen nextWeight oben).
 *
 * @returns {{ text: string, canAddSet: boolean, suggestedWeight: number|null }}
 */
export function buildLastSetMessage(s, ex, nextWeekWeight) {
  const step = ex.weightStep || 2.5;
  const rpe = s.rpe;
  const nextWeekText = nextWeekWeight != null ? `${nextWeekWeight}kg` : 'gleiches Gewicht';

  if (s.status !== 'success') {
    return { text: 'Ziel nicht erreicht — Nächste Woche: gleiches Gewicht, Technik prüfen', canAddSet: false, suggestedWeight: null };
  }
  if (rpe != null && rpe <= 6) {
    const suggestedWeight = _round((s.weight ?? 0) + step, step);
    return { text: `Du hast noch Kapazität. Optionaler Satz: ${suggestedWeight}kg?`, canAddSet: true, suggestedWeight };
  }
  if (rpe == null || rpe <= 7) {
    return { text: `Übung abgeschlossen ✓ Nächste Woche: ${nextWeekText}`, canAddSet: false, suggestedWeight: null };
  }
  if (rpe < 9) { // 8, 8.5
    return { text: `Perfekt abgeschlossen ✓ Nächste Woche: ${nextWeekText}`, canAddSet: false, suggestedWeight: null };
  }
  return { text: 'Hart aber fertig ✓ Nächste Woche: gleiches Gewicht', canAddSet: false, suggestedWeight: null };
}

/**
 * Aufwärm-Sätze für eine Compound-Übung: 50%×5, 70%×3, 85%×1 des
 * Arbeitsgewichts, jeweils auf die Übungs-Schrittweite gerundet.
 * Liefert [] wenn kein sinnvolles Arbeitsgewicht vorliegt.
 */
export function buildWarmupSets(workingWeight, weightStep) {
  const step = weightStep || 2.5;
  if (!workingWeight || workingWeight <= 0) return [];
  return [
    { weight: _round(workingWeight * 0.50, step), reps: 5 },
    { weight: _round(workingWeight * 0.70, step), reps: 3 },
    { weight: _round(workingWeight * 0.85, step), reps: 1 },
  ];
}
