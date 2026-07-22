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

/**
 * Dämpft einen vorgeschlagenen Wert bei reduzierter Tagesform (B76-Modifier)
 * — aber NUR bei einer echten Reduzierungs-Empfehlung (nextWeight <
 * currentWeight). Weder eine Steigerung (B84) noch ein Halten (B91) dürfen
 * gedämpft werden: B84 stellte fest, dass `nextWeight > currentWeight`
 * (Steigerung) nicht gedämpft werden darf, verwendete dafür aber `>` statt
 * `>=` — das ließ den HALTEN-Fall (nextWeight === currentWeight, z.B. RPE
 * 6.5-7.9) weiterhin ungeschützt durch die Dämpfung fallen (98kg halten
 * wurde zu 95kg reduziert, obwohl der Hinweistext "Gute Intensität" keine
 * Reduzierung meint). B91 korrigiert den Vergleich auf `>=`.
 */
function _applyModifier(nextWeight, currentWeight, sessionModifier, step) {
  if (sessionModifier !== 'reduced' || nextWeight >= currentWeight) return nextWeight;
  return Math.max(nextWeight * 0.9, currentWeight - step);
}

/** RPE -> Standard-Pausendauer (Sekunden), gemeinsame Tabelle für alle
 * Matrix-Gruppen, die keinen eigenen abweichenden Wert vorschreiben. */
function _pauseSecForRpe(rpe) {
  if (rpe == null)  return null;
  if (rpe <= 6)     return 90;
  if (rpe < 8)      return 120;
  if (rpe < 9)      return 180;
  if (rpe < 10)     return 240;
  return 300;
}

/**
 * Feedback für einen NICHT-letzten Satz einer Übung — Gewichts-/Pause-
 * Vorschlag für den nächsten Satz. `s` muss bereits bewertet sein
 * (status 'success'|'fail'), sonst null.
 *
 * Seit B92 (Entscheidungsmatrix v2): RPE UND Wdh-Differenz kombiniert statt
 * nur RPE — `repDiff = targetReps - reps` hat Vorrang vor der RPE-Bewertung
 * (eine verfehlte Wiederholungszahl ist ein stärkeres Signal als die
 * subjektive Anstrengungs-Einschätzung). Gilt nur wenn RPE eingegeben wurde
 * (siehe früher Return unten) — ohne RPE bleibt die ursprüngliche, rein
 * status-basierte Logik unverändert (B92-Vorlage deckte diesen Fall nicht
 * ab, siehe DECISIONS.md).
 *
 * @param {Object} s               Der gerade bewertete Satz
 * @param {Object} ex               Die zugehörige Übung
 * @param {string|null} sessionModifier  day.sessionModifier ('reduced'|'normal'|'optimal'|null)
 * @param {number} si              Index von `s` in ex.sets — für die Satz-zu-Satz-RPE-Trend-Erkennung
 * @returns {{ nextWeight: number, pauseSec: number|null, hint: string|null, repDiff: number|null, rpe: number|null, rpeZone: string|null, reps: number, targetReps: number, unit: string } | null}
 */
export function buildSetFeedback(s, ex, sessionModifier, si) {
  if (!s || (s.status !== 'success' && s.status !== 'fail')) return null;
  const step = ex.weightStep || 2.5;
  const currentWeight = s.weight ?? 0;
  const rpe = s.rpe;
  const unit = ex.metric === 'sec' ? 'Sek' : ex.metric === 'm' ? 'm' : 'Wdh';
  const targetReps = ex.targetReps || 0;
  const reps = s.reps || 0;

  // Ohne RPE: nur die eigene, session-lokale Erfolg/Fehlschlag-Logik (kein
  // getWeightRecommendation()-Aufruf, siehe Datei-Kommentar oben) — s.status
  // spiegelt bereits "Ziel-Wdh erreicht?" (Reducer-Logik in state.js). B92s
  // Matrix (RPE + repDiff) greift bewusst erst danach — ohne RPE gibt es
  // keine RPE-Bänder, gegen die repDiff sinnvoll kombiniert werden könnte.
  if (rpe == null) {
    let nextWeight = s.status === 'success' ? currentWeight : currentWeight - step;
    nextWeight = _applyModifier(nextWeight, currentWeight, sessionModifier, step);
    return { nextWeight: _round(nextWeight, step), pauseSec: null, hint: null, repDiff: null, rpe: null, rpeZone: null, reps, targetReps, unit };
  }

  const repDiff = targetReps - reps; // positiv = Wdh verfehlt, 0 = erreicht, negativ = übertroffen

  let nextWeight, pauseSec, hint;
  if (repDiff >= 2) { // Gruppe A: Wdh deutlich verfehlt
    if (rpe >= 9) {
      nextWeight = currentWeight - (step * 2);
      hint = `Zu schwer (-${repDiff} ${unit}, RPE ${rpe}) — deutlich reduzieren`;
    } else {
      nextWeight = currentWeight - step;
      hint = `Ziel deutlich verfehlt (-${repDiff} ${unit}) — reduzieren`;
    }
    pauseSec = _pauseSecForRpe(rpe);
  } else if (repDiff === 1) { // Gruppe B: Wdh knapp verfehlt
    if (rpe <= 7) {
      nextWeight = currentWeight;
      hint = `1 ${unit} gefehlt bei RPE ${rpe} — Technik prüfen, Gewicht halten`;
    } else if (rpe < 8.5) {
      nextWeight = currentWeight;
      hint = `1 ${unit} gefehlt — Gewicht halten`;
    } else {
      nextWeight = currentWeight - step;
      hint = `1 ${unit} gefehlt bei RPE ${rpe} — reduzieren`;
    }
    pauseSec = _pauseSecForRpe(rpe);
  } else if (repDiff < 0) { // Gruppe D: Wdh übertroffen
    if (rpe <= 7) {
      nextWeight = currentWeight + step;
      hint = `Mehr als Ziel (${reps}/${targetReps} ${unit}) bei RPE ${rpe} — steigern`;
    } else if (rpe < 8.5) {
      nextWeight = currentWeight;
      hint = 'Mehr als Ziel geschafft — halten';
    } else {
      nextWeight = currentWeight;
      hint = 'Mehr Wdh aber hohe Intensität — halten';
    }
    pauseSec = _pauseSecForRpe(rpe);
  } else { // Gruppe C: repDiff === 0, Wdh erreicht
    if (rpe <= 6)        { nextWeight = currentWeight + step;        pauseSec = 90;  hint = 'Ziel erreicht, noch Luft — steigern'; }
    else if (rpe < 8)    { nextWeight = currentWeight;                pauseSec = 120; hint = 'Ziel erreicht, gute Intensität — halten'; }
    else if (rpe < 8.5)  { nextWeight = currentWeight;                pauseSec = 180; hint = 'Optimale Zone — halten'; }
    else if (rpe < 9)    { nextWeight = currentWeight;                pauseSec = 180; hint = 'Ziel erreicht aber hart — nächster Satz halten, Pause verlängern'; }
    else if (rpe < 10)   { nextWeight = currentWeight - step;         pauseSec = 240; hint = 'Sehr hart — reduzieren'; }
    else                 { nextWeight = currentWeight - (step * 2);   pauseSec = 300; hint = 'Maximum — deutlich reduzieren'; }
  }

  // Trend-Erkennung: RPE steigt gegenüber dem vorherigen bewerteten Satz
  // derselben Übung um >=1.5 -> längere Pause, zusätzlicher Hinweis.
  const prevRpe = si > 0 ? ex.sets[si - 1]?.rpe : null;
  if (prevRpe != null && rpe - prevRpe >= 1.5) {
    pauseSec = Math.round(pauseSec * 1.5);
    hint += ' · RPE steigt schnell';
  }

  const rpeZone = rpe <= 6 ? 'leicht' : rpe < 8.5 ? 'optimal' : 'hart';
  nextWeight = _applyModifier(nextWeight, currentWeight, sessionModifier, step);
  return { nextWeight: _round(nextWeight, step), pauseSec, hint, repDiff, rpe, rpeZone, reps, targetReps, unit };
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
