/**
 * weeklyFocus.js – Coach-Tab-Signale, aufgeteilt in zwei unabhängige Ebenen
 * (Sprint "Coach-Tab Architektur"):
 *
 * 1. computeWeeklyFocus() – AKUTE Kaskade, EIN priorisiertes Signal (erstes
 *    zutreffendes gewinnt), braucht diese Woche eine konkrete Reaktion:
 *      1. Wiedereinstieg    – state.lastReentryHandled (bestehend, 1:1 wiederverwendet)
 *      2. Konsistente Fehlschläge – EINE Übung bei 0% Erfolg über 3 Wochen
 *                             (seit v160/B25) — VOR Überlastung, da eingetretenes
 *                             Totalversagen dringlicher ist als drohende Überlastung
 *      3. Überlastung       – Schlaf / RPE-Trend / Erfolgsquote (3 Zweige,
 *                             eigene Formulierung je Zweig, an S-02/S-04
 *                             angelehnte aber NICHT aus insightEngine.js
 *                             importierte Schwellenwerte)
 *      4. Plateau           – detectPlateaus() aus plateauDetector.js, 1:1
 *                             wiederverwendet. VOR Pre-Plateau (bestätigter,
 *                             stärkerer Befund hat Vorrang vor einer bloßen
 *                             Antizipation einer anderen Übung — Fix Problem 2)
 *      5. Pre-Plateau-Antizipation
 *      6. Konsistenz-Engpass – Anteil absolvierter Trainingstage über 6 Wochen,
 *                             nutzt state.js' isTrainingDay() für die Urlaubstage-
 *                             Ausschlussregel (einzige Quelle, nicht dupliziert)
 *      7. Progression       – isReadyForAutoSelect()/getWeightRecommendation()
 *                             aus weightRecommendation.js, 1:1 wiederverwendet
 *      Fallback: "Auf Kurs"
 *
 * 2. computeStructuralSignals() – STRUKTURELLE Signale, Array von 0-N
 *    gleichzeitig aktiven Hinweisen (kein "erstes gewinnt"), brauchen KEINE
 *    wöchentliche Entscheidung, bleiben über mehrere Wochen relevant:
 *      A. Mehr-Übungen-Aggregation – verteiltes Scheitern über ≥2 Übungen,
 *                               Gesamterfolgsquote ≤20% (seit v163) — Gegenstück
 *                               zu Punkt 2 oben (dort: EINE Übung bei 0%)
 *      B. Präventiver Deload  – aus _checkOverload() herausgelöst (war dort
 *                               vierter Zweig) — strukturell (8-Wochen-Horizont),
 *                               keine akute Entscheidung nötig
 *      C. Konsistenz-Qualität – hohe/stabile Frequenz bei sinkender Erfolgsquote,
 *                               nutzt computeConsistencyTrend()/computeQualityTrend()
 *                               aus overallPerformance.js, 1:1 wiederverwendet
 *      D. Push/Pull-Warnung   – deutliches muskuläres Ungleichgewicht über
 *                               erkenntnisseHorizont-Wochen, MOVEMENT_MAP-basiert
 *      E. Compound/Isolation  – Compound-Sätze (Squat/Hinge/Push/Pull) unter
 *         (seit B79)            60% der bewerteten Sätze über erkenntnisse-
 *                               Horizont-Wochen, identisches Muster zu D
 *    Maximal 2 gleichzeitig (Priorität A > B > C > D > E), Rendering in ui.js
 *    als eigene, optisch sekundäre Karte unabhängig von computeWeeklyFocus().
 *
 * Beide Funktionen sind pure, keine Seiteneffekte.
 */

import { getLatestWeek, getEffectiveWeightStep, _dayEvalCounts } from './state.js';
import { detectPlateaus } from './plateauDetector.js';
import { getWeightRecommendation, isReadyForAutoSelect, roundToPlate } from './weightRecommendation.js';
import { isFullSuccess } from './setUtils.js';
import { _consistencyEligibleWeeks } from './consistencyUtils.js';
import { computeVolumeTrend, computeConsistencyTrend, computeQualityTrend } from './overallPerformance.js';
import { buildCategoryMap, resolveCategory, isCompoundExercise } from './movementMap.js';
import { detectSessionFatigue } from './sessionSummary.js';

const DAY_MS = 86_400_000;

// Nutzer-Feedback (2026-08-17): Die synthetische Startwerte-Woche
// (ONBOARDING_SEED, isSeedWeek) ist ein PR-Kaltstart-Datenpunkt, keine
// echte Trainingswoche -- ihre Sätze sind aber IMMER status:'success'
// (per Konstruktion), was jeden Trend-/Durchschnittsvergleich verzerrt, der
// sie mit einbezieht (z.B. "Erfolgsquote gesunken", das eine künstlich
// perfekte Startwerte-Woche als Vergleichs-Baseline nutzte). Analog zur
// bereits gefixten state.js-Kopie (_weekTrainingStatus()/WEEK_NAVIGATE,
// B246) -- weeklyFocus.js hat aber eine EIGENE, unabhängige Wochenliste,
// die diesen Ausschluss bisher nicht kannte. Zentral hier, da praktisch
// jedes Signal in dieser Datei über _sortedWeeks()/_nonDeloadWeeks() geht.
function _sortedWeeks(state) {
  return [...state.weeks].filter(w => !w.isSeedWeek).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

function _nonDeloadWeeks(state) {
  return _sortedWeeks(state).filter(w => w.mode !== 'deload' && w.mode !== 'vacation');
}

// Nutzer-Feedback (2026-08-17): zählte bisher ALLE Sätze im Nenner, auch
// noch nicht bewertete ('pending') -- die kanonische Quelle im Projekt
// (setUtils.js weekSuccessCounts()) zählt success/(success+fail), pending
// UND archivierte Übungen ausgeschlossen. Da _checkDroppingCompletion()
// (unten) praktisch immer die aktuell laufende, nur teilweise trainierte
// Woche mit einbezieht, drückten deren offene 'pending'-Sätze die
// berechnete Quote künstlich nach unten -- ein systematischer
// Falsch-Positiv-Bias für "Erfolgsquote gesunken", der vermutlich die
// Hauptursache des gemeldeten Symptoms war (unabhängig vom bereits
// gefixten Seed-Wochen-Bug, B267). Jetzt identische Formel wie
// weekSuccessCounts(), nur als 0-1-Verhältnis statt gerundetem Prozentwert
// (die beiden Aufrufer unten vergleichen direkt als Fließkommazahl).
// Nutzer-Feedback (2026-08-17, Coach-Tab-Audit, Verdachtsfall): .slice(-3)
// nimmt "die letzten 3 EINTRÄGE der Liste", unabhängig davon ob dazwischen
// eine große Kalenderlücke liegt -- state.weeks enthält nur tatsächlich
// angelegte Wochen, keinen Eintrag pro realer Kalenderwoche. Nach einer
// langen Trainingspause (außerhalb des 7-Tage-Reentry-Fensters,
// REENTRY_WINDOW_DAYS oben) könnten sonst Wochen verglichen werden, die
// real Monate auseinanderliegen, als wären es 3 aufeinanderfolgende
// Wochen. Grobe Toleranz (21 Tage statt exakt 7), damit eine gelegentlich
// ausgelassene einzelne Woche nicht überreagiert.
const MAX_REALISTIC_WEEK_GAP_DAYS = 21;
function _hasRealisticWeeklySpacing(weeks) {
  for (let i = 1; i < weeks.length; i++) {
    const prevMs = new Date(weeks[i - 1].startDate + 'T12:00:00').getTime();
    const curMs  = new Date(weeks[i].startDate + 'T12:00:00').getTime();
    if (curMs - prevMs > MAX_REALISTIC_WEEK_GAP_DAYS * DAY_MS) return false;
  }
  return true;
}

function _completionRate(wk) {
  let success = 0, total = 0;
  for (const d of wk.days) for (const ex of d.exercises) {
    if (ex.archived) continue;
    for (const s of ex.sets) {
      if (s.status === 'success') { success++; total++; }
      else if (s.status === 'fail') { total++; }
    }
  }
  return total > 0 ? success / total : 0;
}

// Dauer des "Wiedereinstieg"-Fensters nach lastReentryHandled — Sprint
// "Kategorie-1-Bugfixes", Fix 7: 14 -> 7 Tage. Betrifft NUR dieses Fenster
// (wie lange die Wiedereinstiegs-Karte danach noch aktiv bleibt), NICHT den
// Auslöse-Schwellenwert für das Reentry-Popup selbst (ui.js'
// _detectReentryPause() nutzt bereits "pauseDays <= 7 -> kein Popup",
// unverändert) und NICHT die davon unabhängigen "14"-Vorkommen an anderer
// Stelle (Plateau-Aktions-Unterdrückung, Backup-Reminder, relative
// Datumslabels — alles andere Features, siehe Diagnose-Sprint).
const REENTRY_WINDOW_DAYS = 7;

// ─── Prio 1: Wiedereinstieg ─────────────────────────────────────────────────
// Extrahiert aus ui.js (vormals private _isInRecoveryWindow) — identische
// Logik, einzige Implementierung. ui.js importiert diese Funktion jetzt
// statt eine eigene Kopie zu pflegen (siehe ui.js-Diff: keine Verhaltens-
// änderung, nur Verschiebung).
export function isInRecoveryWindow(state) {
  if (!state.lastReentryHandled) return false;
  const startMs = state.lastReentryHandled;
  const endMs   = startMs + REENTRY_WINDOW_DAYS * DAY_MS;
  // Nutzer-Feedback (2026-08-17): filterte bisher rohes state.weeks statt
  // der zentralen, seit B267 isSeedWeek-ausschließenden _sortedWeeks() --
  // die Startwerte-Woche zählt dadurch bisher nicht mit (kein
  // w.startDate-Filter-Bezug zu _sortedWeeks() nötig, aber der Ausschluss
  // selbst fehlte). Praktisch selten relevant (die Seed-Woche liegt fast
  // immer weit vor jedem Wiedereinstiegsfenster), aber dieselbe Fehlerklasse
  // wie an den bereits gefixten Stellen -- der Vollständigkeit halber ergänzt.
  const relevantWeeks = state.weeks.filter(w => {
    if (w.isSeedWeek) return false;
    const ms = new Date(w.startDate + 'T00:00:00').getTime();
    return ms >= startMs && ms < endMs;
  });
  if (!relevantWeeks.length) return false;

  let succ = 0, fail = 0, rpeSum = 0, rpeCount = 0;
  for (const wk of relevantWeeks) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        for (const s of ex.sets) {
          if (s.status === 'success') {
            succ++;
            if (s.rpe != null) { rpeSum += s.rpe; rpeCount++; }
          } else if (s.status === 'fail') {
            fail++;
          }
        }
      }
    }
  }
  const total = succ + fail;
  if (total === 0) return false;
  const successRate = succ / total;
  const avgRpe = rpeCount > 0 ? rpeSum / rpeCount : null;
  return successRate > 0.85 && avgRpe != null && avgRpe < 7;
}

function _checkReentry(state) {
  if (!state.lastReentryHandled) return null;
  const daysSince = Math.floor((Date.now() - state.lastReentryHandled) / DAY_MS);
  if (daysSince < 0 || daysSince >= REENTRY_WINDOW_DAYS) return null;
  const weekNum = Math.floor(daysSince / 7) + 1;
  const inRecovery = isInRecoveryWindow(state);
  return {
    status: 'reentry',
    headline: 'Wiedereinstieg',
    reasoning: `Woche ${weekNum} nach deiner Trainingspause.`,
    recommendation: inRecovery
      ? 'Du erholst dich schnell — eine größere Steigerung wird vorgeschlagen.'
      : 'Gewichte bleiben vorerst reduziert, bis du wieder im Rhythmus bist.',
    // E1 (Transparenz Coach-Tab): lastReentryHandled ist der Zeitpunkt, an
    // dem der Wiedereinstiegs-Popup bestätigt wurde (state.js REENTRY_HANDLED),
    // nicht das Datum der letzten abgeschlossenen Einheit — Evidence-Text
    // entsprechend an die echte Bedeutung angepasst statt den ungenauen
    // Sprint-Vorlage-Wortlaut zu übernehmen.
    evidence: [
      { label: 'Wiedereinstieg erkannt', value: `vor ${daysSince} ${daysSince === 1 ? 'Tag' : 'Tagen'}` },
      { label: 'Fenster', value: `${REENTRY_WINDOW_DAYS} Tage` },
      { label: 'Erholung', value: inRecovery ? 'schnell — hohe Erfolgsquote, niedriger RPE' : 'noch nicht bestätigt' },
    ],
  };
}

// ─── Prio 2: Überlastung ────────────────────────────────────────────────────
// Eigenständige, an S-02 (RPE-Trend)/S-04 (Erfolgsquote) angelehnte aber
// NICHT importierte Schwellenwert-Logik (insightEngine.js bleibt unverändert).

// sleepHours hat zwei legitime Verwendungszwecke:
// 1. Überlastungs-Signal (hier, _checkLowSleep -> _checkOverload)
// 2. Schlaf↔Abschlussquote-Korrelation in insightEngine.js/progressInsights.js
// Beide sind framework-konform, da beide Entscheidungsrelevanz haben — keine
// Vereinheitlichung nötig, kein Duplikat.
function _checkLowSleep(state) {
  const weeks = _nonDeloadWeeks(state);
  if (!weeks.length) return null;
  const latest = weeks[weeks.length - 1];
  const sleeps = latest.days.filter(d => d.sleepHours != null).map(d => d.sleepHours);
  if (sleeps.length === 0) return null;
  const avg = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
  if (avg >= 7) return null;
  return { signal: 'sleep', value: avg };
}

// Kein eigenständiges Overload-Signal — nur Verstärker für bestehende Signale
// (RPE, Schlaf, Erfolgsquote). Mindestens 2 Tage nötig, Urlaubstage ausgeschlossen.
function _checkLowEnergy(state) {
  const weeks = _nonDeloadWeeks(state);
  if (!weeks.length) return null;
  const latest = weeks[weeks.length - 1];
  const energies = latest.days
    .filter(d => d.energyLevel != null && !d.isVacation)
    .map(d => d.energyLevel);
  if (energies.length < 2) return null;
  const avg = energies.reduce((a, b) => a + b, 0) / energies.length;
  if (avg > 2.5) return null;
  return { signal: 'energy', value: avg };
}

function _checkRisingRpe(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);
  if (!_hasRealisticWeeklySpacing(last3)) return null;
  const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];
  for (const name of exNames) {
    const weights = last3.map(wk => {
      let max = 0;
      for (const d of wk.days) for (const ex of d.exercises) if (ex.name === name)
        for (const s of ex.sets) if (s.status === 'success' && (s.weight ?? 0) > max) max = s.weight;
      return max;
    });
    if (weights.some(w => w === 0) || !weights.every(w => Math.abs(w - weights[0]) < 0.1)) continue;
    const rpes = last3.map(wk => {
      const vals = [];
      for (const d of wk.days) for (const ex of d.exercises) if (ex.name === name)
        for (const s of ex.sets) if (s.status === 'success' && s.rpe != null) vals.push(s.rpe);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    });
    if (rpes.some(r => r == null)) continue;
    if (rpes[0] < rpes[1] && rpes[1] < rpes[2]) {
      return { signal: 'rpe', exerciseName: name, values: rpes };
    }
  }
  return null;
}

function _checkDroppingCompletion(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 5) return null;
  const last3 = weeks.slice(-3);
  const prev  = weeks.slice(-8, -3);
  if (prev.length < 2) return null;
  // Prüft Kontinuität über BEIDE Fenster hinweg (inkl. der Lücke dazwischen)
  // in einem Rutsch -- ein Trendvergleich zwischen zwei zeitlich weit
  // auseinanderliegenden Blöcken wäre genauso aussagelos wie eine Lücke
  // innerhalb eines der beiden Fenster.
  if (!_hasRealisticWeeklySpacing([...prev, ...last3])) return null;
  const avg3 = last3.reduce((s, w) => s + _completionRate(w), 0) / last3.length;
  const avg8 = prev.reduce((s, w) => s + _completionRate(w), 0) / prev.length;
  if (avg3 >= avg8 - 0.1) return null;
  return { signal: 'completion', avg3, avg8 };
}

// Wochen seit dem letzten Deload — Rückwärts-Suchlauf analog zu
// insightEngine.js' E-03 ("Deload-Wirkung"), hier aber als allgemeiner
// Zähler statt einmaligem Vorher/Nachher-Vergleich. Zählt über ALLE Wochen
// (unfiltered, wie in E-03), da die Deload-Woche selbst gefunden werden muss.
// Nie ein Deload in der Historie -> gesamte Historie zählt als "seit Deload"
// (kein Sonderfall nötig: ergibt für neue Nutzer ohnehin niedrige, harmlose
// Werte unterhalb der 6-Wochen-Schwelle unten).
function _weeksSinceLastDeload(state) {
  const sorted = _sortedWeeks(state);
  if (!sorted.length) return 0;
  const deloadIdx = [...sorted.keys()].reverse().find(i => sorted[i].mode === 'deload');
  return deloadIdx == null ? sorted.length : (sorted.length - 1) - deloadIdx;
}

// Ø RPE einer Woche über ALLE Übungen (nicht pro Übung wie _exAvgRpe in
// plateauDetector.js) — eigenständig statt aus insightEngine.js importiert
// (dort existiert avgRpeWeek() bereits, aber nicht exportiert; weeklyFocus.js
// importiert bewusst nicht aus insightEngine.js, siehe Datei-Kopf).
function _avgRpeWeek(wk) {
  const rpes = [];
  for (const d of wk.days) for (const ex of d.exercises) for (const s of ex.sets)
    if (s.status === 'success' && s.rpe != null) rpes.push(s.rpe);
  return rpes.length ? rpes.reduce((a, b) => a + b, 0) / rpes.length : null;
}

// Präventiver Deload: kein Deload seit >=6 Wochen UND (Volumen steigt ODER
// Ø RPE der letzten 3 Wochen > RPE_PREVENTIVE_DELOAD_3WK_AVG). Strukturelles
// Signal (Wochen-Horizont, keine akute Wochenentscheidung) — seit Sprint
// "Coach-Tab Architektur" NICHT mehr Teil von _checkOverload(), sondern
// eigenständig in computeStructuralSignals() unten (Fix Problem 4:
// strukturelle Signale verdrängten zuvor akute/spezifischere Signale durch
// ihre Platzierung in der akuten Kaskade).
//
// Schwelle 2026-08-09 (WISSENSCHAFTS-AUDIT.md, Domäne B) von 8 auf 6 Wochen
// gesenkt: reale Praxis unter Wettkampfathleten/Coaches liegt laut Jukic et
// al. 2024 (Sports Medicine – Open, Querschnittsbefragung n=246) bei Ø
// 5.6±2.3 Wochen zwischen Deloads — 8 Wochen lag über dem typischen
// Intervall. Deskriptive Umfrage, kein RCT für einen "optimalen" Wert —
// 6 Wochen ist bewusst die konservativere Rundung Richtung Praxis-Mittel,
// kein exakt literaturabgeleiteter Wert.
//
// Schwelle bewusst NIEDRIGER als sessionCoach.js' RPE_SET_HARD_ZONE (8.5)
// und plateauDetector.js' RPE_PLATEAU_DELOAD_STRATEGY_1WK_AVG (8.5), obwohl
// alle drei "hohe Anstrengung" messen: ein 3-Wochen-Durchschnitt ist eine
// deutlich geglättetere, ausreißerresistentere Kennzahl als ein Einzelsatz
// oder ein 1-Wochen-Schnitt — ein Programm, das über 3 Wochen konstant
// >=7.5 hält, ist real stärker chronisch überlastet als eine einzelne Woche
// mit 8.5, die schon danach wieder abklingen kann. Andere Zeitfenster
// rechtfertigen hier den anderen Zahlenwert, siehe
// diagnose-runde7-2026-08-02.txt — bewusst NICHT vereinheitlicht.
const RPE_PREVENTIVE_DELOAD_3WK_AVG = 7.5;

// Runde 9 (Domäne D, Nebenfund aus Runde 7): Konfidenz-Einstufung für eine
// Steigerungs-Empfehlung in _checkProgression() unten (4-Wochen-Fenster,
// Erfolgsquote + Ø RPE kombiniert). Die Zahlenwerte 0.9/7.5/0.8/8.5
// stimmen zufällig mit RPE_PREVENTIVE_DELOAD_3WK_AVG (oben) bzw.
// sessionCoach.js' RPE_SET_HARD_ZONE / plateauDetector.js'
// RPE_PLATEAU_DELOAD_STRATEGY_1WK_AVG (beide 8.5) überein — das ist reiner
// Zufall, kein gemeinsames Konzept: hier geht es um eine 4-Wochen-
// Konfidenz-Einstufung für EINE Übungs-Empfehlung, nicht um ein
// Deload-/Hart-Satz-Signal. NICHT vereinheitlichen, siehe
// diagnose-runde9-2026-08-03.txt.
const CONF_HIGH_SUCCESS_RATE_MIN = 0.9;
const CONF_HIGH_AVG_RPE_MAX_4WK = 7.5;
const CONF_MEDIUM_SUCCESS_RATE_MIN = 0.8;
const CONF_MEDIUM_AVG_RPE_MAX_4WK = 8.5;

// Runde 14 (Council-Entscheidung, Governance Coach-Struktursignale):
// generalisierter, aber signal-spezifisch konfigurierbarer Dismiss über
// state.decisionLog. KEIN neues Datenmodell -- decisionLog trägt bereits
// {type, choice, decidedWeekStart} (siehe B131/DECISION_LOG_ADD, state.js),
// hier nur als wiederverwendbares Muster über mehrere Signal-Typen hinweg
// statt exklusiv für 'preventive_deload'. Cooldown-Dauer ist bewusst NICHT
// einheitlich -- jedes Signal bekommt ein inhaltlich begründetes eigenes
// Zeitfenster (siehe DECISIONS.md für die volle Begründung):
// - deload_preventive: 4 Wochen (unverändert seit B131).
// - consistency_quality: 2 Wochen -- Wochenqualität kann sich schneller
//   ändern als ein strukturelles Volumen-/Erschöpfungsmuster.
// - push_pull: 3 Wochen -- ein muskuläres Ungleichgewicht baut sich langsam
//   auf/ab, kürzer als Deload reicht aber, da weniger sicherheitskritisch.
// - recurring_fatigue: 3 Wochen -- an die eigene 3-Wochen-Erkennungsbasis
//   aus Runde 13 gekoppelt (ein neuer Zyklus braucht mindestens so lange).
// Plateau (Hauptkarte) ist bewusst NICHT hier gelistet -- behält sein
// eigenes, feingranulareres state.plateauActions-Modell (pro Übung,
// 'ignored' löst sich automatisch auf sobald sich plateauWeeks ändert),
// das strukturell mehr kann als ein einfacher Zeit-Cooldown und nicht ohne
// Not durch ein einfacheres Modell ersetzt werden sollte, siehe DECISIONS.md.
const DISMISS_COOLDOWN_DAYS = {
  // Schlüssel ist der historische decisionLog-'type'-Wert aus B131
  // ('preventive_deload', NICHT 'deload_preventive' wie sig.type in
  // computeStructuralSignals() -- bewusst NICHT umbenannt, damit bereits
  // live gespeicherte Dismiss-Einträge echter Nutzer weiterhin greifen).
  preventive_deload:   28,
  consistency_quality: 14,
  push_pull:           21,
  recurring_fatigue:   21,
};

// Exportiert (nicht nur intern genutzt) -- ui.js braucht die Cooldown-Dauer
// für den Dismiss-Bestätigungs-Toast-Text (z.B. "... 3 Wochen ausgeblendet").
export function _dismissCooldownDays(signalType) {
  return DISMISS_COOLDOWN_DAYS[signalType] ?? null;
}

// Nutzer-Feedback (2026-08-17): 'YYYY-MM-DD' aus LOKALEN Datumskomponenten
// statt .toISOString() (UTC) -- dasselbe, im Projekt bereits zweimal
// gefixte Antimuster wie weekReview.js' _localISODate()-Kommentar
// beschreibt: .toISOString() kann bei positiver lokaler UTC-Differenz
// (z.B. Deutschland) nahe Mitternacht auf den falschen Kalendertag rollen,
// was den Dismiss-Cooldown (verglichen als String gegen
// d.decidedWeekStart, ein lokales Wochendatum) um einen Tag verschieben
// konnte.
function _localISODateDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function _isDismissedRecently(state, signalType) {
  const days = _dismissCooldownDays(signalType);
  if (!days) return false;
  const cutoffISO = _localISODateDaysAgo(days);
  return (state.decisionLog ?? []).some(d =>
    d.type === signalType && d.choice === 'stay' && d.decidedWeekStart >= cutoffISO
  );
}

// Eskalierender Re-Trigger-Text (Council-Vorgabe: begrenzte Stufenleiter,
// 2-3 Stufen, KEIN unbegrenzt wachsender Text) -- zählt vergangene
// 'stay'-Dismissals desselben Signal-Typs (unabhängig vom Cooldown-Fenster
// selbst), gedeckelt auf Stufe 2. Text-Formatierung passiert in ui.js
// (_escalationPrefix()), hier nur die reine Stufen-Zahl.
function _dismissTier(state, signalType) {
  const count = (state.decisionLog ?? []).filter(d => d.type === signalType && d.choice === 'stay').length;
  return Math.min(count, 2);
}

function _checkPreventiveDeload(state) {
  // 'preventive_deload' ist der historische decisionLog-'type'-Wert (B131),
  // NICHT sig.type ('deload_preventive') -- siehe DISMISS_COOLDOWN_DAYS oben.
  if (_isDismissedRecently(state, 'preventive_deload')) return null;

  const weeksSince = _weeksSinceLastDeload(state);
  if (weeksSince < 6) return null;

  // Runde 14 (Council-Frage aus der Deload-Diagnose): Fenster von 4 auf 8
  // verbreitert (vergleicht jetzt die letzten 4 vs. die 4 Wochen davor,
  // statt 2-vs-2) -- die Diagnose zeigte, dass "volumeUp" bei konsequent
  // progressiv trainierenden Nutzern mit dem alten 2-vs-2-Fenster
  // strukturell fast dauerhaft erfüllt war (kurze Ausreißer reichten schon).
  // computeVolumeTrend() hat nur EINEN anderen Aufrufer (ui.js
  // _overallPerformanceParagraphs(), nutzt sein eigenes N aus
  // settings.erkenntnisseHorizont) -- diese Änderung betrifft NUR den
  // Deload-Trigger, siehe DECISIONS.md.
  const volTrend = computeVolumeTrend(state, 8);
  const volumeUp = volTrend?.direction === 'up';

  const recentRpes = _nonDeloadWeeks(state).slice(-3).map(_avgRpeWeek).filter(v => v != null);
  const avgRpe  = recentRpes.length ? recentRpes.reduce((a, b) => a + b, 0) / recentRpes.length : null;
  const rpeHigh = avgRpe != null && avgRpe > RPE_PREVENTIVE_DELOAD_3WK_AVG;

  if (!volumeUp && !rpeHigh) return null;
  return {
    signal: 'deload_preventive', weeksSince, volumeUp, avgRpe, rpeHigh,
    volTrendDirection: volTrend?.direction ?? null,
    tier: _dismissTier(state, 'preventive_deload'),
    cooldownDays: _dismissCooldownDays('preventive_deload'),
    // Phase A/Launch-Roadmap (2026-08-04, Regressionsfund): VOR Runde 14
    // enthielt der Haupttext nur weeksSince, evidence ergänzte hier 2 echte
    // Zusatzwerte (Volumen-Trend, Ø RPE). Seit Runde 14 enthält der
    // Haupttext (ui.js) bereits alle 3 Rohwerte wörtlich -- ein Evidence-
    // Feld mit denselben 3 Werten wäre jetzt reine Wiederholung der "▾
    // Basis dieser Einschätzung"-Disclosure (E1, v215). Stattdessen: EIN
    // neuer Punkt, der tatsächlich NICHT im Haupttext steht -- welche der
    // beiden Bedingungen (Volumen ODER RPE) den Trigger auslöste (beide
    // Rohwerte stehen zwar im Haupttext, aber nicht, WELCHE davon die
    // auslösende Schwelle überschritten hat).
    evidence: [
      { label: 'Auslöser', value: volumeUp && rpeHigh ? 'Volumen steigend + Ø RPE hoch' : volumeUp ? 'Volumen steigend' : 'Ø RPE hoch' },
    ],
  };
}

// B140 (Runde 13, Council-Entscheidung): reines Beobachtungssignal -- feuert,
// wenn das bereits bestehende tagesskalierte Erschöpfungsmuster aus
// detectSessionFatigue() (sessionSummary.js) in JEDER der letzten 3
// konsekutiven Nicht-Deload/Nicht-Urlaub-Wochen an mindestens einem Tag
// auftrat. Bewusst 3 KONSEKUTIVE jüngste Wochen (nicht nur "irgendwann in
// den letzten 4") -- reduziert Falsch-Positive bei Einzelvorfällen, wie vom
// Sprint gefordert. Kein automatischer Deload-Vorschlag im Haupttext (Council:
// reine Beobachtung) -- ein optionaler Hinweis wandert stattdessen ins
// `info`-Feld (ui.js '_structuralSignalHtml()', bestehendes <details>-Muster).
function _checkRecurringFatigue(state) {
  // Runde 14 (Council-Entscheidung, Governance Coach-Struktursignale):
  // generischer Dismiss über decisionLog, siehe DISMISS_COOLDOWN_DAYS oben.
  if (_isDismissedRecently(state, 'recurring_fatigue')) return null;

  const recentWeeks = _nonDeloadWeeks(state).slice(-3);
  if (recentWeeks.length < 3) return null;

  const perWeekHits = recentWeeks.map(wk => {
    for (const day of wk.days) {
      const fatigue = detectSessionFatigue(day);
      if (fatigue) return fatigue;
    }
    return null;
  });
  if (perWeekHits.some(hit => !hit)) return null;

  const last = perWeekHits[perWeekHits.length - 1];
  return {
    signal: 'recurring_fatigue',
    mostFatiguedExercise: last.mostFatiguedExercise,
    rpeDiff: last.rpeDiff,
    successDrop: last.successDrop,
    tier: _dismissTier(state, 'recurring_fatigue'),
    cooldownDays: _dismissCooldownDays('recurring_fatigue'),
    evidence: [
      { label: 'Wochen mit Muster', value: '3 von 3' },
      { label: 'Zuletzt betroffene Übung', value: last.mostFatiguedExercise },
      { label: 'RPE-Anstieg (2. Hälfte)', value: `+${last.rpeDiff}` },
      { label: 'Erfolgsquote-Rückgang', value: `${last.successDrop} pp` },
    ],
  };
}

// Eigene headline/directive pro Signal-Typ (Fix Problem 7) — vorher teilten
// sich alle drei Zweige "Erholung priorisieren"/"Diese Woche keine
// Gewichtssteigerungen", der Athlet konnte die Ursache (Schlaf vs. eine
// bestimmte Übung vs. programmweite Quote) ohne "Warum?"-Aufklappen nicht
// unterscheiden. energySignal bleibt reiner Verstärker-Text im reasoning,
// unverändert gegenüber vorher.
function _buildOverloadResult(signal, energySignal = null) {
  const hasLowEnergy = energySignal != null;
  const energySuffix = hasLowEnergy
    ? ` Dein durchschnittliches Energielevel lag diese Woche bei ${energySignal.value.toFixed(1)}/5.`
    : '';

  if (signal.signal === 'sleep') {
    const reasoning = hasLowEnergy
      ? `Sowohl Schlaf (Ø ${signal.value.toFixed(1)}h) als auch Energielevel (Ø ${energySignal.value.toFixed(1)}/5) deuten diese Woche auf Erholungsbedarf hin.`
      : signal.value < 6
        ? `Die Daten zeigen: dein Schlaf liegt im Schnitt nur bei ${signal.value.toFixed(1)}h diese Woche — deutlich unter den empfohlenen 7h.`
        : `Die Daten zeigen: dein Schlaf liegt im Schnitt bei ${signal.value.toFixed(1)}h diese Woche — etwas unter den empfohlenen 7h.`;
    return {
      status: 'overload',
      headline: 'Schlaf priorisieren',
      reasoning,
      // Runde 20 (Befund 7): Kausalität war vorher reine Behauptung ("kostet
      // Kraft") ohne Herleitung im Text -- jetzt kurz erklärt, damit die
      // Empfehlung nachvollziehbar ist statt beliebig zu wirken.
      recommendation: 'Diese Woche keine Gewichtssteigerungen — bei Schlafmangel sinkt die neuromuskuläre Leistungsfähigkeit, eine Steigerung würde jetzt vor allem das Verletzungs- und Formrisiko erhöhen statt echten Fortschritt zu bringen.',
      signalType: signal.signal,
      // E1 (Transparenz Coach-Tab): signal.value/energySignal.value waren
      // bisher nur in reasoning-Prosa verbaut, hier zusätzlich strukturiert.
      evidence: [
        { label: 'Schlaf diese Woche', value: `Ø ${signal.value.toFixed(1)}h` },
        { label: 'Schwelle', value: '< 7h' },
        ...(hasLowEnergy ? [{ label: 'Energielevel', value: `Ø ${energySignal.value.toFixed(1)}/5` }] : []),
      ],
    };
  }

  if (signal.signal === 'rpe') {
    return {
      status: 'overload',
      headline: 'Aufwand steigt',
      reasoning: `${signal.exerciseName}: die Anstrengung (RPE) steigt seit 3 Wochen bei gleichem Gewicht — ${signal.values.map(v => v.toFixed(1)).join(' → ')}.${energySuffix}`,
      recommendation: `${signal.exerciseName} wird anstrengender ohne mehr Gewicht — diese Woche halten.`,
      signalType: signal.signal,
      evidence: [
        { label: 'Übung', value: signal.exerciseName },
        { label: 'RPE-Trend', value: signal.values.map(v => v.toFixed(1)).join(' → ') },
        { label: 'Gewicht', value: 'konstant (keine Änderung über 3 Wochen)' },
        ...(hasLowEnergy ? [{ label: 'Energielevel', value: `Ø ${energySignal.value.toFixed(1)}/5` }] : []),
      ],
    };
  }

  // completion
  return {
    status: 'overload',
    headline: 'Qualität sichern',
    reasoning: `Deine Erfolgsquote ist von ${Math.round(signal.avg8 * 100)}% auf ${Math.round(signal.avg3 * 100)}% gesunken.${energySuffix}`,
    recommendation: 'Deine Erfolgsquote ist gesunken — Gewicht halten bis sie sich stabilisiert.',
    // Rohes Signal zusätzlich offengelegt (bereits oben berechnet, keine neue
    // Logik) — für die Decisional-Balance, die wissen muss WELCHES der 3
    // Signale zutraf, ohne die reasoning-Prosa zu parsen.
    signalType: signal.signal,
    evidence: [
      { label: 'Erfolgsquote diese Woche', value: `${Math.round(signal.avg3 * 100)}%` },
      { label: 'Vorwoche(n)', value: `${Math.round(signal.avg8 * 100)}%` },
      { label: 'Rückgang', value: `${Math.round((signal.avg8 - signal.avg3) * 100)} Prozentpunkte` },
      ...(hasLowEnergy ? [{ label: 'Energielevel', value: `Ø ${energySignal.value.toFixed(1)}/5` }] : []),
    ],
  };
}

function _checkOverload(state) {
  const energy = _checkLowEnergy(state);
  const sleep = _checkLowSleep(state);
  if (sleep) return _buildOverloadResult(sleep, energy);
  const rpe = _checkRisingRpe(state);
  if (rpe) return _buildOverloadResult(rpe, energy);
  const completion = _checkDroppingCompletion(state);
  if (completion) return _buildOverloadResult(completion, energy);
  return null;
}

// ─── Prio 4: Pre-Plateau-Antizipation ───────────────────────────────────────
// Feuert wenn RPE-Kosten pro kg steigen, obwohl das Gewicht noch leicht
// zunimmt — erkennt die Erschöpfungszone BEVOR die Steigerung stoppt.
// Abgrenzung zu _checkRisingRpe (Prio 2): dort ist Gewicht identisch (Plateau
// bereits eingetreten); hier steigt Gewicht noch, aber der Preis pro kg auch.
// Steht seit Fix Problem 2 NACH Plateau (Prio 3) — ein bestätigtes Plateau
// ist der stärkere Befund und hat Vorrang vor dieser bloßen Antizipation.

function _checkPrePlateau(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);
  if (!_hasRealisticWeeklySpacing(last3)) return null;
  const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];

  for (const name of exNames) {
    // Max-Gewicht (success sets) pro Woche
    const maxWeights = last3.map(wk => {
      let max = 0;
      for (const d of wk.days)
        for (const ex of d.exercises)
          if (ex.name === name)
            for (const s of ex.sets)
              if (s.status === 'success' && (s.weight ?? 0) > max) max = s.weight;
      return max;
    });

    // (a) Gewicht muss gestiegen sein — schließt _checkRisingRpe-Bereich aus
    if (maxWeights.some(w => w === 0)) continue;
    if (maxWeights[2] <= maxWeights[0]) continue;

    // (b) RPE-Kosten pro kg: avgRpe[i] / maxWeight[i] streng steigend
    const rpeCostPerKg = last3.map((wk, i) => {
      const vals = [];
      for (const d of wk.days)
        for (const ex of d.exercises)
          if (ex.name === name)
            for (const s of ex.sets)
              if (s.status === 'success' && s.rpe != null) vals.push(s.rpe);
      if (!vals.length) return null;
      const avgRpe = vals.reduce((a, b) => a + b, 0) / vals.length;
      return avgRpe / maxWeights[i];
    });

    // (d) RPE-Daten für alle 3 Wochen vorhanden
    if (rpeCostPerKg.some(r => r == null)) continue;

    // (b) Streng monoton steigend
    if (!(rpeCostPerKg[0] < rpeCostPerKg[1] && rpeCostPerKg[1] < rpeCostPerKg[2])) continue;

    // (c) Erfolgsquote ≥ 70% (kein echtes Leistungsproblem)
    let succ = 0, tot = 0;
    for (const wk of last3)
      for (const d of wk.days)
        for (const ex of d.exercises)
          if (ex.name === name)
            for (const s of ex.sets) { tot++; if (s.status === 'success') succ++; }
    if (tot === 0 || succ / tot < 0.7) continue;

    const cqWkStart = getLatestWeek(state.weeks)?.startDate;
    const cq = state.coachQuestion;
    // Nutzer-Feedback (2026-08-17): zusätzlich cq.exerciseName geprüft --
    // ohne diesen Abgleich hätte die gespeicherte Antwort bei zwei
    // unterschiedlichen, unabhängig voneinander qualifizierenden Übungen
    // fälschlich der jeweils ANDEREN Übung zugeordnet werden können (siehe
    // COACH_ANSWER-Reducer-Kommentar, state.js).
    const cqAnswer = (cq?.weekStart === cqWkStart && cq?.questionId === 'pre_plateau_subjective' && cq?.exerciseName === name && cq?.answer != null) ? cq.answer : null;
    return {
      status: 'pre_plateau',
      headline: 'Steigerung wird teurer',
      reasoning: `${name} kostet pro kg mehr Aufwand als vor 3 Wochen — ein Plateau deutet sich an.${cqAnswer === 'yes' ? ' Du bestätigst: die Übung fühlt sich deutlich anstrengender an.' : ''}`,
      recommendation: cqAnswer === 'yes'
        ? 'Plane jetzt eine Deload-Woche ein — dein Körper bestätigt den Trend.'
        : cqAnswer === 'no'
        ? 'Erhöhe die Wdh statt das Gewicht — der RPE-Trend könnte technischer Natur sein.'
        : 'Jetzt Strategie überdenken: Wdh erhöhen statt Gewicht, oder Deload einplanen bevor die Steigerung stoppt.',
      exerciseName: name,
      // E1 (Transparenz Coach-Tab): maxWeights/rpeCostPerKg/Erfolgsquote
      // wurden bereits oben berechnet (gaten das Signal), bisher aber
      // verworfen statt zurückgegeben.
      evidence: [
        { label: 'Übung', value: name },
        { label: 'Gewicht letzte 3 Wochen', value: maxWeights.map(w => `${w}kg`).join(' → ') },
        { label: 'RPE-Kosten pro kg', value: rpeCostPerKg.map(r => r.toFixed(2)).join(' → ') },
        { label: 'Erfolgsquote', value: `${Math.round((succ / tot) * 100)}%` },
      ],
    };
  }
  return null;
}

// ─── Struktur B: Konsistenz-Qualität ────────────────────────────────────────
// Feuert wenn die Trainingsfrequenz gleichbleibt/steigt, ABER die
// Satz-Erfolgsquote sinkt UND unter 75% liegt — "mehr Frequenz bringt gerade
// nichts, weil die Ausführungsqualität leidet". Abgrenzung zu
// _checkConsistencyGap (Prio 5, akute Kaskade): dort sinkt die FREQUENZ
// selbst (Tage fallen aus); hier bleibt die Frequenz intakt, nur die
// Qualität pro Satz sinkt. Strukturell (Trend über 8 Wochen) — seit Sprint
// "Coach-Tab Architektur" NICHT mehr Teil der akuten Kaskade, sondern in
// computeStructuralSignals() unten.
// Nutzt computeConsistencyTrend()/computeQualityTrend() aus
// overallPerformance.js 1:1 wiederverwendet (identische Berechnung wie im
// Fortschritt-Tab), NICHT neu implementiert.

// scoredWeeks für computeQualityTrend(): dieselbe Formel wie ui.js'
// _weekSuccessScore() (success/(success+fail), archivierte Übungen
// ausgeschlossen), hier bewusst dupliziert statt importiert — ui.js
// importiert bereits weeklyFocus.js, ein Reimport wäre zirkulär (identisches
// Muster zu _trueVol()/_weightVolume() in overallPerformance.js).
// Runde 9 (Cluster 6): `export` nur ergänzt, damit ein Test sie direkt
// gegen setUtils.js' weekSuccessCounts() auf Übereinstimmung prüfen kann
// (Absicherung gegen künftiges stilles Auseinanderlaufen) — keine
// Logikänderung, weiterhin nirgends produktiv importiert.
export function _scoreWeek(week) {
  let succ = 0, fail = 0;
  for (const d of week.days)
    for (const ex of d.exercises) {
      if (ex.archived) continue;
      for (const s of ex.sets) {
        if (s.status === 'success') succ++;
        else if (s.status === 'fail') fail++;
      }
    }
  const total = succ + fail;
  return { succ, fail, total, pct: total > 0 ? Math.round(succ / total * 100) : 0 };
}

function _checkConsistencyQuality(state) {
  // Runde 14 (Council-Entscheidung, Governance Coach-Struktursignale):
  // generischer Dismiss über decisionLog, siehe DISMISS_COOLDOWN_DAYS oben.
  if (_isDismissedRecently(state, 'consistency_quality')) return null;

  // Historie-Gate wie _checkConsistencyGap unten (min. 6 auswertbare Wochen) —
  // dieselbe Datenbasis (_consistencyEligibleWeeks), unabhängig davon ob am
  // Ende ConsistencyQuality oder ConsistencyGap zutrifft.
  const eligible = _consistencyEligibleWeeks(state);
  if (eligible.length < 6) return null;

  const consistency = computeConsistencyTrend(state, 8);
  if (!consistency || (consistency.direction !== 'up' && consistency.direction !== 'stable')) return null;
  // Fix Problem 5: verhindert Überschneidung mit _checkConsistencyGap (dort
  // Schwelle 0.7 als Ratio, hier curPct auf 0-100-Skala — daher <70, nicht
  // <0.7). 'stable' bedeutet nur "wenig Veränderung zwischen den Halbfenstern",
  // NICHT "guter Wert" — eine chronisch niedrige, aber flache Quote würde
  // sonst hier fälschlich als "Konsistenz ist stabil" durchgewunken, obwohl
  // ConsistencyGap die inhaltlich passendere Karte für einen chronisch
  // niedrigen Wert ist.
  if (consistency.curPct < 70) return null;

  const scoredWeeks = _sortedWeeks(state).map(_scoreWeek);
  const quality = computeQualityTrend(scoredWeeks, 8);
  if (!quality || quality.direction !== 'down') return null;
  if (quality.curPct >= 75) return null;

  const consistencyWord = consistency.direction === 'up' ? 'gestiegen' : 'stabil';
  return {
    status: 'consistencyQuality',
    headline: 'Qualität vor Quantität',
    reasoning: `Deine Konsistenz ist ${consistencyWord}, aber deine Satz-Erfolgsquote ist in den letzten ${quality.halfN} Wochen von ${quality.prevPct}% auf ${quality.curPct}% gesunken. Mehr Frequenz erzeugt gerade keinen Mehrwert.`,
    recommendation: 'Du trainierst regelmäßig, aber deine Erfolgsquote sinkt — weniger Einheiten, besser ausgeführt.',
    consistencyWord, prevPct: quality.prevPct, curPct: quality.curPct, halfN: quality.halfN,
    tier: _dismissTier(state, 'consistency_quality'),
    cooldownDays: _dismissCooldownDays('consistency_quality'),
    // E1 (Transparenz Coach-Tab)
    evidence: [
      { label: 'Konsistenz', value: consistencyWord },
      { label: 'Erfolgsquote', value: `${quality.prevPct}% → ${quality.curPct}% (${quality.halfN} Wochen)` },
    ],
  };
}

// ─── Prio 5 (akute Kaskade): Konsistenz-Engpass ─────────────────────────────
// Anteil absolvierter Trainingstage pro Woche — Urlaubstage-Ausschlussregel
// kommt aus state.js' isTrainingDay() (einzige Quelle, siehe Datei-Kopf).
// Ein verbleibender Urlaubstag (isVacation, aber mit Training) zählt als
// erledigt.
//
// _weekConsistencyRatio()/_consistencyEligibleWeeks() leben seit dem Sprint
// "Drei neue Coach-Signale" in consistencyUtils.js statt hier (Logik
// unverändert, nur verschoben, um den zirkulären Import mit
// overallPerformance.js zu vermeiden — siehe Datei-Kopf-Kommentar dort).

function _evaluateConsistencyWindow(windowWeeks) {
  const avg = windowWeeks.reduce((s, r) => s + r.ratio, 0) / windowWeeks.length;
  const belowCount = windowWeeks.filter(r => r.ratio < 0.7).length;
  return avg < 0.7 && belowCount >= 4;
}

function _checkConsistencyGap(state) {
  const eligible = _consistencyEligibleWeeks(state);
  if (eligible.length < 6) return null; // zu wenig Historie -> nicht auswertbar

  const last6 = eligible.slice(-6);
  if (!_evaluateConsistencyWindow(last6)) return null;

  const avgPct = Math.round((last6.reduce((s, r) => s + r.ratio, 0) / 6) * 100);

  // Varianz: war der Engpass schon im UNMITTELBAR VORHERGEHENDEN 6-Wochen-
  // Fenster (eine Woche früher) ebenfalls aktiv? Rein laufzeitberechnet,
  // keine Persistierung.
  const wasActiveBefore = eligible.length >= 7 && _evaluateConsistencyWindow(eligible.slice(-7, -1));

  const reasoning = wasActiveBefore
    ? `Der Trend hält an: du hast in den letzten 6 Wochen weiterhin nur ${avgPct}% deiner geplanten Trainingstage absolviert.`
    : `Du hast in den letzten 6 Wochen ${avgPct}% deiner geplanten Trainingstage absolviert.`;

  return {
    status: 'consistencyGap',
    headline: 'Konsistenz vor Intensität',
    reasoning,
    recommendation: 'Mehr Gewicht würde aktuell weniger bringen als mehr Regelmäßigkeit. Plane diese Woche bewusst feste Trainingszeiten.',
    // avgPct bereits oben berechnet, hier zusätzlich offengelegt für die
    // Decisional-Balance (keine neue Logik, nur Wiederverwendung).
    avgPct,
    // E1 (Transparenz Coach-Tab)
    evidence: [
      { label: 'Absolvierte Trainingstage', value: `${avgPct}%` },
      { label: 'Zeitraum', value: 'letzte 6 Wochen' },
      { label: 'Trend', value: wasActiveBefore ? 'hält an (auch im Fenster davor)' : 'neu erkannt' },
    ],
  };
}

// ─── Prio 3 (akute Kaskade): Plateau ────────────────────────────────────────
// detectPlateaus() 1:1 wiederverwendet, NICHT neu implementiert. Seit Fix
// Problem 2 VOR Pre-Plateau (Prio 4) — bestätigter Befund hat Vorrang.

/**
 * Sprint C2 (train-v109): "Ignorieren"/"Habe ich umgesetzt" unterdrücken die
 * Plateau-Karte für eine Übung, solange die Bedingung noch gilt — siehe
 * state.plateauActions. 'ignored' gilt nur für GENAU dasselbe Plateau (exakt
 * dieselbe plateauWeeks-Zahl wie beim Ignorieren) — sobald es länger dauert
 * ODER endet (neue Steigerung), ist die Unterdrückung automatisch aufgehoben.
 * 'implemented' gilt für 14 Tage ab dem Wochenstart der Aktion, danach
 * erscheint die Karte wieder falls das Plateau noch besteht.
 */
function _isPlateauSuppressed(p, action, curWeekStart) {
  if (!action) return false;
  if (action.action === 'ignored') {
    return action.plateauWeeksAtAction === p.plateauWeeks;
  }
  if (action.action === 'implemented') {
    const sinceMs = new Date(action.since + 'T00:00:00').getTime();
    const curMs   = new Date(curWeekStart + 'T00:00:00').getTime();
    return (curMs - sinceMs) < 14 * 86_400_000;
  }
  return false;
}

// B132 (Diagnose, 2026-07): _checkPlateau() und die Fortschritt-Tab-Regel
// S-06 (insightEngine.js) rufen denselben detectPlateaus() mit identischen
// Schwellenwerten auf — keine Diskrepanz in den Zahlenwerten. Der Grund, warum
// ein im Fortschritt-Tab erkanntes Plateau (z.B. Deadlift) im Coach-Tab
// trotzdem nicht erscheinen kann, liegt ausschließlich am Gating: diese
// Funktion sitzt in der akuten ??-Kaskade (computeWeeklyFocus()) hinter
// _checkReentry/_checkPersistentFailure/_checkOverload — jedes davon
// verdrängt Plateau komplett für diese Woche — und respektiert zusätzlich
// state.plateauActions (_isPlateauSuppressed, oben). S-06 hat keine der
// beiden Gates. Siehe DECISIONS.md für die vollständige Diagnose.
function _checkPlateau(state) {
  // B139: im Kaloriendefizit ist Stagnation normal/erwartbar, kein Coach-Signal.
  if (state.settings?.nutritionPhase === 'cut') return null;
  const plateaus = detectPlateaus(state.weeks, state.favoriteExercises ?? [], state.settings?.rpeEnabled ?? true);
  if (!plateaus.length) return null;
  const curWk = getLatestWeek(state.weeks);
  if (!curWk) return null;
  const actions = state.plateauActions ?? {};
  const active  = plateaus.filter(p => !_isPlateauSuppressed(p, actions[p.exerciseName], curWk.startDate));
  if (!active.length) return null;
  const longest = active.reduce((a, b) => (b.plateauWeeks > a.plateauWeeks ? b : a));
  // plateauWeeks startet bei 3 (Mindestwert für eine Erkennung) -> detectionAge=1
  // bedeutet "gerade erst erkannt", detectionAge>=3 bedeutet "seit 3+ Wochen bekannt".
  const detectionAge = longest.plateauWeeks - 2;
  const reasoning = detectionAge <= 2
    ? `${longest.exerciseName} zeigt seit ${longest.plateauWeeks} Wochen keine Steigerung.`
    : `${longest.exerciseName} stagniert weiterhin seit ${longest.plateauWeeks} Wochen — eine Anpassung könnte jetzt sinnvoll sein.`;
  const alsoAffected = active.filter(p => p !== longest);
  const alsoText = alsoAffected.length > 0
    ? ` Auch betroffen: ${alsoAffected[0].exerciseName} (${alsoAffected[0].plateauWeeks} Wochen).`
    : '';
  const cq = state.coachQuestion;
  const cqAnswer = (cq?.weekStart === curWk.startDate && cq?.questionId === 'plateau_outcome' && cq?.answer != null) ? cq.answer : null;
  const finalReasoning = reasoning + (cqAnswer === 'helped' ? ' Du berichtest Fortschritt — weiter so.' : '');
  const finalRec = cqAnswer === 'not_helped'
    ? 'Versuche eine andere Übungsvariante oder erhöhe das Volumen statt das Gewicht.'
    : longest.actionText + alsoText;
  return {
    status: 'plateau',
    headline: 'Plateau überwinden',
    reasoning: finalReasoning,
    recommendation: finalRec,
    plateau: longest,
    // E1 (Transparenz Coach-Tab): plateau-Objekt (aus detectPlateaus(),
    // plateauDetector.js) trägt bereits alle nötigen Rohwerte.
    evidence: [
      { label: 'Übung', value: longest.exerciseName },
      { label: 'Gewicht', value: `${longest.currentWeight}kg · ${longest.plateauWeeks} Wochen konstant` },
      { label: 'Erfolgsquote', value: `${Math.round(longest.avgSuccessRate * 100)}%` },
      { label: 'RPE-Trend', value: `Ø ${longest.avgRpe?.toFixed(1) ?? '–'} · stabil` },
      { label: 'Schlussfolgerung', value: 'Kapazität vorhanden, aber kein Fortschritt' },
    ],
  };
}

// ─── Prio 6 (akute Kaskade): Progression ────────────────────────────────────
// isReadyForAutoSelect()/getWeightRecommendation() 1:1 wiederverwendet.

function _qualificationStreak(name, calcWeeks, progressionMode, targetRepsMax) {
  let streak = 0;
  for (let end = calcWeeks.length; end >= 2; end--) {
    if (isReadyForAutoSelect(name, calcWeeks.slice(0, end), progressionMode, targetRepsMax)) streak++;
    else break;
  }
  return streak;
}

function _checkProgression(state) {
  const curWk = getLatestWeek(state.weeks);
  if (!curWk) return null;
  const calcWeeks = _nonDeloadWeeks(state)
    .filter(w => w.days.some(d => d.exercises.some(ex => ex.sets.some(s => s.status === 'success'))));
  if (calcWeeks.length < 2) return null;

  const seen = new Set();
  const readyCandidates = [];
  const catMap = buildCategoryMap(state.customExercises);
  const favs   = state.favoriteExercises ?? [];

  curWk.days.forEach(day => {
    (day.exercises ?? []).forEach(ex => {
      if (seen.has(ex.name)) return;
      if (ex.substituteFor) return;
      if ((ex.progressionType ?? 'weight') === 'reps') return;
      seen.add(ex.name);
      const exProgressionMode = ex.progressionMode ?? 'weight_first';
      const exTargetRepsMax   = ex.targetRepsMax ?? null;
      const plateStep = getEffectiveWeightStep(ex, state.settings, state.customExercises);
      if (!isReadyForAutoSelect(ex.name, calcWeeks, exProgressionMode, exTargetRepsMax)) return;
      const isCompound = isCompoundExercise(ex.name, catMap);
      const rec = getWeightRecommendation(ex.name, calcWeeks, plateStep, exProgressionMode, exTargetRepsMax, isCompound, state.settings?.nutritionPhase ?? 'maintenance');
      if (!rec) return;
      // B122: Priorität favorit+compound > favorit > compound > (Fallback:
      // höchstes rec.delta) statt reiner Steigerungs-Höhe.
      const isFav = favs.includes(ex.name);
      const priority = isFav && isCompound ? 3 : isFav ? 2 : isCompound ? 1 : 0;
      readyCandidates.push({ name: ex.name, rec, ex, priority });
    });
  });

  if (!readyCandidates.length) return null;
  readyCandidates.sort((a, b) => b.priority - a.priority || b.rec.delta - a.rec.delta);
  const best   = readyCandidates[0];
  const second = readyCandidates[1] ?? null;

  const streak = _qualificationStreak(best.name, calcWeeks, best.ex.progressionMode ?? 'weight_first', best.ex.targetRepsMax ?? null);
  const alreadyConfirmedSame = best.ex.nextWeekPlanConfirmed && best.ex.nextWeekPlan === best.rec.delta;
  const reasonText = (best.rec.reasons ?? []).map(r => r.text).join(' · ');
  const intro = (streak >= 2 && !alreadyConfirmedSame)
    ? `${best.name} erfüllt die Kriterien bereits seit ${streak} Wochen.`
    : `${best.name} ist bereit für eine Steigerung.`;
  const alsoReadyText = second ? ` Auch bereit für Steigerung: ${second.name}.` : '';

  // Konfidenz: successRate + avgRpe der letzten 4 Wochen für best.
  // isFullSuccess() statt rohem status==='success' (Sprint "Kategorie-1-
  // Bugfixes", Fix 5e) — identisches Muster wie getWeightRecommendation()
  // in weightRecommendation.js: ein 'success'-Satz mit weniger Wdh als
  // targetReps ist ein Teilerfolg und zählt weder als Erfolg noch als
  // Fehlschlag (ausgeklammert), sonst würde ein Teilerfolg die Konfidenz
  // derselben Empfehlung optisch nach oben ziehen, die getWeightRecommendation()
  // selbst bereits strenger (nicht als vollen Erfolg) bewertet.
  let succ = 0, fail = 0, rpeSum = 0, rpeCount = 0;
  for (const wk of calcWeeks.slice(-4))
    for (const d of wk.days)
      for (const ex of d.exercises)
        if (ex.name === best.name)
          for (const s of ex.sets) {
            if (isFullSuccess(s, ex)) { succ++; if (s.rpe != null) { rpeSum += s.rpe; rpeCount++; } }
            else if (s.status === 'fail') fail++;
          }
  const confTotal = succ + fail;
  const confSuccessRate = confTotal > 0 ? succ / confTotal : 1;
  const confAvgRpe = rpeCount > 0 ? rpeSum / rpeCount : null;
  const confidence = (confSuccessRate >= CONF_HIGH_SUCCESS_RATE_MIN && (confAvgRpe === null || confAvgRpe <= CONF_HIGH_AVG_RPE_MAX_4WK)) ? 'high'
    : (confSuccessRate >= CONF_MEDIUM_SUCCESS_RATE_MIN && (confAvgRpe === null || confAvgRpe <= CONF_MEDIUM_AVG_RPE_MAX_4WK))               ? 'medium'
    : 'low';

  const cq = state.coachQuestion;
  const cqAnswer = (cq?.weekStart === curWk.startDate && cq?.questionId === 'progression_feeling' && cq?.answer != null) ? cq.answer : null;
  const finalConfidence = cqAnswer === 'good' ? 'high' : cqAnswer === 'tired' ? 'low' : confidence;
  const finalRec = cqAnswer === 'tired'
    ? 'Gewicht diese Woche halten — dein subjektives Empfinden spricht dagegen.'
    : `+${best.rec.delta}kg bei ${best.name} testen`;
  return {
    status: 'progression',
    headline: 'Steigerung sinnvoll',
    reasoning: reasonText ? `${intro} ${reasonText} spricht aktuell dafür.${alsoReadyText}` : `${intro}${alsoReadyText}`,
    recommendation: finalRec,
    confidence: finalConfidence,
    dataWeeks: calcWeeks.length,
    exerciseName: best.name,
    suggestedDelta: best.rec.delta,
    fromWeight: best.rec.lastWeight,
    // E1 (Transparenz Coach-Tab): confSuccessRate/confAvgRpe (die Rohwerte
    // hinter dem confidence-Bucket) waren bisher nur intern verwendet.
    evidence: [
      { label: 'Übung', value: best.name },
      { label: 'Empfehlung', value: `${best.rec.lastWeight + best.rec.delta}kg (+${best.rec.delta}kg)` },
      { label: 'Konfidenz', value: `${finalConfidence.toUpperCase()} · ${Math.round(confSuccessRate * 100)}% Erfolgsquote${confAvgRpe != null ? `, Ø RPE ${confAvgRpe.toFixed(1)}` : ''}` },
      { label: 'Basis', value: `${calcWeeks.length} Wochen Daten` },
    ],
  };
}

// ─── Struktur C: Push/Pull-Warnung ──────────────────────────────────────────
// Deutliches muskuläres Ungleichgewicht (Push vs. Pull) über
// erkenntnisseHorizont-Wochen — Zeitfenster und Kategorisierung identisch zur
// bestehenden Push/Pull-Anzeige in ui.js' _renderMovementPattern() (MOVEMENT_MAP
// + customExercises-Override), dort aber NICHT importiert: ui.js importiert
// bereits weeklyFocus.js, ein Reimport wäre zirkulär (identisches Muster zu
// _scoreWeek() oben) — daher hier bewusst inline dupliziert.
// Schwelle 1.5 bewusst höher als die 1.4-Schwelle im Fortschritt-Tab — der
// Coach soll nur bei deutlichem Ungleichgewicht warnen, nicht bei leichter
// Schieflage (die dortige Anzeige bleibt informativ, ohne Handlungsdruck).
// WISSENSCHAFTS-AUDIT.md (2026-08-09, Domäne E): Engineering-Heuristik,
// NICHT literaturbelegt — die Coaching-Literatur zu Push/Pull-Verhältnissen
// ist selbst uneinig (1:1 bis 1:2 kursieren als Faustregeln), keine
// belastbare Studie validiert einen exakten Zahlenwert für Freizeit-
// Kraftsportler. 1.5 ist toleranter als die verbreiteteren Heuristiken,
// aber nicht dadurch widerlegt — bei Bedarf neu bewerten, nicht als
// wissenschaftlich hergeleitet missverstehen.
// Strukturell — seit Sprint "Coach-Tab Architektur" NICHT mehr Teil der
// akuten Kaskade (dort praktisch nie sichtbar, da Progression fast immer
// vorher zutrifft), sondern in computeStructuralSignals() unten.
function _checkPushPullBalance(state) {
  // Runde 14 (Council-Entscheidung, Governance Coach-Struktursignale):
  // generischer Dismiss über decisionLog, siehe DISMISS_COOLDOWN_DAYS oben.
  if (_isDismissedRecently(state, 'push_pull')) return null;

  const customCatMap = buildCategoryMap(state.customExercises);

  const horizont = state.settings?.erkenntnisseHorizont ?? 8;
  const lastN = _sortedWeeks(state)
    .filter(w => w.mode !== 'deload')
    .slice(-horizont);
  if (lastN.length < 4) return null; // zu wenig Historie -> nicht auswertbar

  let pushSets = 0, pullSets = 0;
  for (const wk of lastN) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.archived) continue;
        const baseName = ex.substituteFor ?? ex.name;
        const cat = resolveCategory(baseName, customCatMap);
        // B22/B32-Konvention: success+fail zählen (pending ausgeschlossen),
        // identisch zur ui.js-Zwillingsfunktion _renderMovementPattern().
        const n = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').length;
        if (cat === 'Push') pushSets += n;
        else if (cat === 'Pull') pullSets += n;
      }
    }
  }
  if (pushSets === 0 || pullSets === 0) return null; // keine Daten für eine Seite

  const ratio = Math.round(Math.max(pushSets, pullSets) / Math.min(pushSets, pullSets) * 10) / 10;
  if (ratio <= 1.5) return null;

  const dominant = pushSets >= pullSets ? 'Push' : 'Pull';
  return {
    status: 'pushPullImbalance',
    headline: 'Muskuläres Gleichgewicht',
    reasoning: `Verhältnis der letzten ${lastN.length} Wochen: ${pushSets} Push-Sätze zu ${pullSets} Pull-Sätze — ${ratio.toFixed(1)}:1, deutlich ${dominant}-lastig.`,
    recommendation: dominant === 'Push'
      ? 'Dein Training ist deutlich Push-lastig — mehr Pull-Übungen schützen langfristig deine Schultern.'
      : 'Dein Training ist deutlich Pull-lastig — mehr Push-Übungen für Balance.',
    // Zusätzlich zur Prosa offengelegt (bereits oben berechnet, keine neue
    // Logik) — für die Strukturkarte in ui.js, die den Kurztext ohne Parsen
    // von reasoning/recommendation auswählen muss.
    dominant, pushSets, pullSets, ratio, weeksN: lastN.length,
    tier: _dismissTier(state, 'push_pull'),
    cooldownDays: _dismissCooldownDays('push_pull'),
    // E1 (Transparenz Coach-Tab)
    evidence: [
      { label: 'Push-Sätze', value: `${pushSets}` },
      { label: 'Pull-Sätze', value: `${pullSets}` },
      { label: 'Verhältnis', value: `${ratio.toFixed(1)}:1 (${lastN.length} Wochen)` },
    ],
  };
}

// Compound/Isolation-Balance (B79) — identisches Muster zu
// _checkPushPullBalance oben (erkenntnisseHorizont, Nicht-Deload-Wochen,
// buildCategoryMap/resolveCategory bereits importiert). Compound: Squat/
// Hinge/Push/Pull, Isolation: alles andere (Core/Carry/unbekannt).
// Signal NUR wenn compoundPct < 60% — bewusst kein Signal bei >=60%
// (kein unnötiges Rauschen, siehe Sprint-Spec). Niedrigste Priorität der
// 5 Strukturkarten-Signale (siehe computeStructuralSignals() unten) — ein
// Compound/Isolation-Hinweis ist informativ, nie dringlich genug, um ein
// akuteres Signal (Fehlschläge/Deload/Konsistenz/Push-Pull) zu verdrängen.
// WISSENSCHAFTS-AUDIT.md (2026-08-09, Domäne E): Engineering-Heuristik,
// NICHT literaturbelegt — Hypertrophie-Volumen-Meta-Analysen finden
// vergleichbare Ganzkörper-Ergebnisse bei gematchtem Gesamtvolumen
// unabhängig vom Compound/Isolation-Split; kein Beleg für genau 60% (oder
// die >70%-Empfehlung im Text unten — beide sind Praxis-Konvention, nicht
// aus einer Studie abgeleitet).
function _checkCompoundIsolationBalance(state) {
  const customCatMap = buildCategoryMap(state.customExercises);

  const horizont = state.settings?.erkenntnisseHorizont ?? 8;
  const lastN = _sortedWeeks(state)
    .filter(w => w.mode !== 'deload')
    .slice(-horizont);
  if (lastN.length < 4) return null; // zu wenig Historie -> nicht auswertbar

  let compoundSets = 0, totalSets = 0;
  for (const wk of lastN) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.archived) continue;
        const baseName = ex.substituteFor ?? ex.name;
        const cat = resolveCategory(baseName, customCatMap);
        const n = ex.sets.filter(s => s.status === 'success' || s.status === 'fail').length;
        totalSets += n;
        if (cat === 'Squat' || cat === 'Hinge' || cat === 'Push' || cat === 'Pull') compoundSets += n;
      }
    }
  }
  if (totalSets === 0) return null;

  const compoundPct = Math.round(compoundSets / totalSets * 100);
  if (compoundPct >= 60) return null;

  return {
    status: 'compoundIsolationImbalance',
    headline: 'Mehr Grundübungen',
    reasoning: `Verhältnis der letzten ${lastN.length} Wochen: ${compoundPct}% Compound-Sätze (Squat/Hinge/Push/Pull) von ${totalSets} bewerteten Sätzen insgesamt.`,
    recommendation: `Du trainierst ${compoundPct}% Compound — für Kraftaufbau empfiehlt sich >70%.`,
    compoundPct,
    // E1 (Transparenz Coach-Tab)
    evidence: [
      { label: 'Compound-Anteil', value: `${compoundPct}%` },
      { label: 'Bewertete Sätze', value: `${totalSets} (${lastN.length} Wochen)` },
    ],
  };
}

// ─── Fallback: Auf Kurs ─────────────────────────────────────────────────────

function _fallback(state) {
  // Nur Wochen mit echten bewerteten Sätzen zählen — leere, von
  // _checkAndAutoCreateWeek() bei jedem App-Boot ohne Training angehängte
  // Auto-Wochen (nur 'pending'-Sätze) und Onboarding-Seed-Wochen dürfen die
  // Früh-Phase-Erkennung nicht verwässern. Eine Seed-Woche zählt wie eine
  // halbe echte Woche (Startwerte-Baseline vorhanden) — daher der +1-Bonus.
  const hasSeed = state.weeks.some(w => w.isSeedWeek);
  const _realWeeks = state.weeks.filter(w => !w.isSeedWeek &&
    w.days.some(d => d.exercises.some(ex => ex.sets.some(s =>
      s.status === 'success' || s.status === 'fail'
    )))
  );
  if (_realWeeks.length + (hasSeed ? 1 : 0) <= 1) {
    const seedNote = hasSeed
      ? ' Erste Analyse auf Basis deiner Startwerte möglich ab nächster Woche.'
      : '';
    return {
      status: 'onTrack',
      headline: 'Auf Kurs',
      reasoning: `Du baust gerade deine Datenbasis auf. Ab Woche 2 kann TRAIN konkrete Empfehlungen geben.${seedNote}`,
      recommendation: null,
      // Früh-Phase-Hinweis: Coach-Tab braucht Wochen-Historie, Session Coach
      // (Intra-Session-Feedback) dagegen nicht — nur in diesem Zweig gesetzt,
      // damit er ausschließlich in Woche 1 erscheint (ui.js rendert ihn nur
      // wenn das Feld vorhanden ist).
      subtext: 'Der Coach-Tab gibt ab Woche 2 konkrete Empfehlungen. Session Coach gibt dir bereits heute nach jedem Satz Echtzeit-Feedback.',
    };
  }
  const variants = [
    'Keine besonderen Auffälligkeiten diese Woche. Trainiere wie geplant weiter.',
    'Alles im grünen Bereich — mach weiter wie bisher.',
  ];
  const reasoning = variants[state.weeks.length % variants.length];
  // E1 (Transparenz Coach-Tab): für den steady-state-Fallback existierte
  // bisher keine Zahlengrundlage (kein Signal, das erklärt werden müsste) —
  // hier minimal ergänzt, damit AC6 ("on_track: Einheiten + Erfolgsquote")
  // erfüllbar ist. Nutzt bestehende _scoreWeek() (bereits oben in dieser
  // Datei für _checkConsistencyQuality verwendet), keine neue Berechnungsart.
  const recentReal = _realWeeks.slice(-4);
  const latestWk = recentReal[recentReal.length - 1] ?? null;
  // Runde 9 (Cluster 1): dieselbe Anti-Gaming-Definition wie
  // consistencyUtils.js/_weekTrainingStatus() (state.js) statt des
  // gameable markedDone-Toggles — sonst zeigt diese Karte einen anderen
  // "Tage erledigt"-Wert als der Fortschritt-Tab für dieselbe Woche.
  const daysDone  = latestWk ? latestWk.days.filter(d => {
    const { evaluated, total } = _dayEvalCounts(d);
    return total > 0 && evaluated / total >= 0.5;
  }).length : 0;
  const daysTotal = latestWk ? latestWk.days.length : 0;
  const scored = recentReal.map(_scoreWeek).filter(s => s.total > 0);
  const avgPct = scored.length ? Math.round(scored.reduce((s, w) => s + w.pct, 0) / scored.length) : null;
  // B139: Ernährungsphasen-Subtext im steady-state-Fallback — 'maintenance'
  // bewusst ohne Subtext (unverändertes Verhalten).
  const nutritionPhase = state.settings?.nutritionPhase ?? 'maintenance';
  const phaseSubtext = nutritionPhase === 'cut'
    ? 'Definitionsphase — Gewicht halten ist Erfolg'
    : nutritionPhase === 'bulk'
      ? 'Aufbauphase — Steigerung priorisieren'
      : undefined;
  return {
    status: 'onTrack',
    headline: 'Auf Kurs',
    reasoning,
    recommendation: null,
    ...(phaseSubtext ? { subtext: phaseSubtext } : {}),
    evidence: [
      { label: 'Absolvierte Einheiten', value: daysTotal > 0 ? `${daysDone}/${daysTotal} (letzte Woche)` : 'noch keine Daten' },
      { label: 'Ø Erfolgsquote', value: avgPct != null ? `${avgPct}% (letzte ${scored.length} Wochen)` : '–' },
      { label: 'Trend', value: 'stabil' },
    ],
  };
}

/**
 * Akute Kaskade — EIN priorisiertes Signal, erstes zutreffendes gewinnt.
 * Plateau steht bewusst VOR Pre-Plateau (Fix Problem 2): ein bestätigtes
 * Plateau (3+ Wochen Stagnation, ≥80% Erfolgsquote) ist ein stärkerer/
 * sichererer Befund als eine bloße Antizipation (RPE-Kosten steigen,
 * Plateau noch nicht eingetreten) einer anderen Übung — der stärkere Befund
 * hat Vorrang, auch wenn beide für unterschiedliche Übungen gleichzeitig
 * zuträfen.
 *
 * @param {Object} state
 * @returns {{ status: string, headline: string, reasoning: string,
 *             recommendation: string|null, plateau?: Object }}
 */
export function computeWeeklyFocus(state) {
  return _checkReentry(state)
    ?? _checkPersistentFailure(state)
    ?? _checkOverload(state)
    ?? _checkPlateau(state)
    ?? _checkPrePlateau(state)
    ?? _checkConsistencyGap(state)
    ?? _checkProgression(state)
    ?? _fallback(state);
}

// ─── Prio 2 (akute Kaskade): Konsistente Fehlschläge ────────────────────────
// Gefunden bei Edge-Case-Audit v159 (B25, TRAIN_Test_EdgeCase_AllesFail_
// GuterSchlaf.v1.json): ohne diesen Check fällt eine Übung, bei der über
// mehrere Wochen kein einziger Satz gelingt, durch JEDE andere Signal-
// Funktion durch (die alle auf status==='success' aufbauen, um Gewicht/
// Trend zu berechnen) bis zum Fallback "Auf Kurs" — obwohl konsequentes
// Totalversagen der eindeutigste denkbare Hinweis auf ein zu hohes Gewicht
// ist. Steht bewusst VOR _checkOverload: bereits eingetretenes
// Totalversagen ist dringlicher als ein nur drohendes Überlastungssignal
// (Schlaf/RPE-Trend/sinkende Erfolgsquote — die setzen alle noch teilweise
// erfolgreiche Sätze voraus, um überhaupt einen Trend zu berechnen).
//
// Schwelle (0% Erfolg, 3 Wochen) bewusst konservativ gewählt, um den
// gefundenen Bug direkt abzudecken, ohne bei gelegentlichen Fehlschlägen
// überzureagieren — analog zum 3-Wochen-Mindestfenster von _checkPlateau.
// WISSENSCHAFTS-AUDIT.md (2026-08-09, Domäne E): Engineering-Heuristik,
// NICHT literaturbelegt — es existiert keine Studie, die ein bestimmtes
// Mehrwochen-Fenster für die Erkennung eines echten Programmierungs-
// problems (statt normaler Streuung) validiert. Weder gestützt noch
// widerlegt, reine Rauschunterdrückung.
function _checkPersistentFailure(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);
  const exNames = [...new Set(last3.flatMap(w => w.days.flatMap(d => d.exercises.map(e => e.name))))];

  for (const name of exNames) {
    let succ = 0, fail = 0, weeksAttempted = 0, lastFailWeight = null, lastFailEx = null;
    for (const wk of last3) {
      let wkEvaluated = 0;
      // Nutzer-Feedback (2026-08-17): archivierte Übungen fehlten hier bisher
      // im Ausschluss -- anders als die strukturell fast identischen
      // Nachbarfunktionen _checkPushPullBalance()/_checkCompoundIsolationBalance()
      // (beide filtern ex.archived korrekt). Eine bewusst archivierte Übung
      // (z.B. wegen wiederholtem Scheitern) konnte so noch Wochen später
      // fälschlich "Gewicht reduzieren" vorschlagen, obwohl sie gar nicht
      // mehr trainiert wird.
      for (const d of wk.days) for (const ex of d.exercises) if (ex.name === name && !ex.archived) {
        for (const s of ex.sets) {
          if (s.status === 'success') { succ++; wkEvaluated++; }
          else if (s.status === 'fail') {
            fail++; wkEvaluated++;
            if ((s.weight ?? 0) > 0) { lastFailWeight = s.weight; lastFailEx = ex; }
          }
        }
      }
      if (wkEvaluated > 0) weeksAttempted++;
    }
    // Muss in allen 3 Wochen tatsächlich versucht + bewertet worden sein —
    // eine ausgelassene Woche soll nicht fälschlich mitzählen.
    if (weeksAttempted < 3) continue;
    if (succ === 0 && fail >= 3) {
      // B101: ex.weightStep hat Vorrang vor dem globalen settings.plateStep
      // (analog zu getWeightRecommendation()) — vorher wurde hier immer der
      // globale Hantelscheiben-Schritt gerundet, unabhängig von der pro
      // Übung eingestellten Schrittweite (z.B. 1.25kg bei Bizepscurls).
      const plateStep    = getEffectiveWeightStep(lastFailEx, state.settings, state.customExercises);
      const deloadFactor = state.settings?.deloadFactor ?? 0.75;
      const suggestedWeight = lastFailWeight != null
        ? roundToPlate(lastFailWeight * deloadFactor, plateStep)
        : null;
      return {
        status: 'persistent_failure',
        headline: 'Gewicht zu hoch',
        reasoning: `Du hast bei ${name} in den letzten 3 Wochen keinen Satz erfolgreich abgeschlossen.`,
        recommendation: suggestedWeight != null
          ? `Gewicht bei ${name} auf ~${suggestedWeight} kg reduzieren`
          : `Gewicht bei ${name} reduzieren`,
        exerciseName: name,
        // B26: currentWeight + suggestedWeight direkt mitgeben, damit
        // buildDecisionalBalance()/ui.js sie nicht redundant neu berechnen
        // müssen — beide sind bereits hier vorhanden.
        currentWeight: lastFailWeight,
        suggestedWeight,
        // E1 (Transparenz Coach-Tab)
        evidence: [
          { label: 'Übung', value: name },
          { label: 'Erfolgsquote letzte 3 Wochen', value: '0%' },
          { label: 'Bewertete Sätze', value: `${fail} von ${fail}` },
          { label: 'Schlussfolgerung', value: suggestedWeight != null ? `Gewicht auf ~${suggestedWeight}kg reduzieren` : 'Gewicht reduzieren' },
        ],
      };
    }
  }
  return null;
}

// ─── Strukturelle Signale ────────────────────────────────────────────────────
// Gegenstück zu computeWeeklyFocus(): kein "erstes Signal gewinnt", sondern
// ALLE zutreffenden strukturellen Signale gleichzeitig (0-N), da sie keine
// wöchentliche Entscheidung erzwingen und sich nicht gegenseitig ausschließen
// (Fix Problem 1/4 — vorher standen Präventiver Deload/ConsistencyQuality/
// PushPullBalance in derselben ??-Kette wie die akuten Signale und wurden
// dadurch systematisch verdrängt, PushPullBalance praktisch nie sichtbar).
// Priorität A > B > C nur für die Max.-2-Begrenzung relevant, nicht für
// gegenseitigen Ausschluss.

// ─── Mehr-Übungen-Aggregation (Design mit Nutzer besprochen) ────────────────
// Ergänzt _checkPersistentFailure() (akut, EINE Übung bei 0% über 3 Wochen):
// erkennt das Gegenstück — verteiltes Scheitern über MEHRERE Übungen, bei dem
// keine einzelne Übung die 0%-Schwelle erreicht, die Gesamterfolgsquote aber
// trotzdem alarmierend niedrig ist. War als "bekannte Grenze" in DECISIONS.md
// dokumentiert (_checkPersistentFailure prüft nur einzelne Übungen). Bewusst
// STRUKTURELL statt akut: ein andauerndes, breites Muster über viele Übungen
// ist kein einzelnes akutes Ereignis wie eine durchgehend scheiternde Übung,
// erzwingt daher keine Stay/Change-Entscheidung — reiner Informationstext
// wie die anderen 3 strukturellen Signale (kein Aktions-Button, siehe
// buildDecisionalBalance()-Docstring unten).
// Schwelle bewusst weicher als der Einzelübungs-Check (≤20% statt 0%) — sonst
// würde sich Scheitern realistisch über zu viele Übungen verteilen, um die
// Schwelle je zu erreichen. Mindestens 2 UNTERSCHIEDLICHE betroffene Übungen
// nötig, sonst ist es exakt der Fall, den _checkPersistentFailure bereits
// abdeckt (keine doppelte Meldung derselben einen Übung in zwei Karten).
// WISSENSCHAFTS-AUDIT.md (2026-08-09, Domäne E): wie beim 0%/3-Wochen-Wert
// in _checkPersistentFailure oben — Engineering-Heuristik gegen
// Rauschen/Streuung, kein literaturbelegter Schwellenwert.
function _checkMultiExerciseFailure(state) {
  const weeks = _nonDeloadWeeks(state);
  if (weeks.length < 3) return null;
  const last3 = weeks.slice(-3);

  let succ = 0, fail = 0;
  const perExercise = new Map();
  for (const wk of last3) {
    // Nutzer-Feedback (2026-08-17): siehe identischer Kommentar in
    // _checkPersistentFailure() oben -- archivierte Übungen ausgeschlossen.
    for (const d of wk.days) for (const ex of d.exercises) {
      if (ex.archived) continue;
      let entry = perExercise.get(ex.name);
      if (!entry) { entry = { succ: 0, fail: 0, lastFailWeight: null, lastFailEx: null }; perExercise.set(ex.name, entry); }
      for (const s of ex.sets) {
        if (s.status === 'success') { succ++; entry.succ++; }
        else if (s.status === 'fail') {
          fail++; entry.fail++;
          if ((s.weight ?? 0) > 0) { entry.lastFailWeight = s.weight; entry.lastFailEx = ex; }
        }
      }
    }
  }

  // Mindest-Stichprobe nötig, sonst würde z.B. 1 Satz/Woche über 3 Wochen
  // einen False Positive erzeugen — grober Richtwert: mind. 5 bewertete
  // Sätze/Woche im Schnitt (entspricht einem sehr leichten Trainingsminimum).
  const totalEvaluated = succ + fail;
  if (totalEvaluated < 15) return null;

  const rate = succ / totalEvaluated;
  if (rate > 0.20) return null;

  const deloadFactor = state.settings?.deloadFactor ?? 0.75;

  const affected = [...perExercise.entries()]
    .filter(([, v]) => (v.succ + v.fail) >= 2 && v.fail > 0)
    .map(([name, v]) => {
      // B101: ex.weightStep pro betroffener Übung hat Vorrang vor dem
      // globalen settings.plateStep — vorher wurde hier für ALLE betroffenen
      // Übungen derselbe globale Hantelscheiben-Schritt verwendet.
      const plateStep = getEffectiveWeightStep(v.lastFailEx, state.settings, state.customExercises);
      return {
        name,
        rate: v.succ / (v.succ + v.fail),
        suggestedWeight: v.lastFailWeight != null ? roundToPlate(v.lastFailWeight * deloadFactor, plateStep) : null,
      };
    });

  if (affected.length < 2) return null;

  const worst = affected.sort((a, b) => a.rate - b.rate).slice(0, 3);

  return {
    rate: Math.round(rate * 100), totalEvaluated, worst,
    // E1 (Transparenz Coach-Tab)
    evidence: [
      { label: 'Erfolgsquote insgesamt', value: `${Math.round(rate * 100)}%` },
      { label: 'Bewertete Sätze', value: `${totalEvaluated}` },
      { label: 'Betroffene Übungen', value: worst.map(w => w.name).join(', ') },
    ],
  };
}

// B129: Verletzungs-Erinnerung — wenn eine Übung innerhalb der letzten 2
// Wochen wegen Schmerzen/Verletzung übersprungen wurde (ex.skipReason ===
// 'injury', gesetzt von EX_SET_SKIP_REASON, state.js) und dieselbe Übung in
// der aktuellen (chronologisch letzten) Woche wieder auftaucht, macht dieses
// Signal darauf aufmerksam. Reine Sicherheits-Erinnerung, keine Berechnung
// einer Empfehlung.
function _checkInjuryReminder(state) {
  const weeks = _sortedWeeks(state);
  if (!weeks.length) return null;
  const currentWeek = weeks[weeks.length - 1];

  const lookback = weeks.slice(-2); // aktuelle + vorherige Woche
  // Beide Seiten der Differenz auf 12:00 normiert (statt Tageskante 00:00
  // gegen die volle aktuelle Uhrzeit) — sonst driftet daysSince je nach
  // Tageszeit um +/-1 Tag (Befund #7-Folgefix, gefunden durch die neuen
  // exakten Zeitbezug-Tests in coach_injury_reminder.spec.js). Gleiches
  // Muster wie todayNoon/_realDayDate in _trainingContextAnchor() (ui.js).
  const todayNoon = (() => { const d = new Date(); d.setHours(12, 0, 0, 0); return d; })();
  let found = null;
  for (const wk of lookback) {
    for (const day of wk.days) {
      for (const ex of day.exercises) {
        if (ex.skipReason !== 'injury' || !ex.skipDate) continue;
        const daysSince = Math.round((todayNoon - new Date(ex.skipDate + 'T12:00:00')) / DAY_MS);
        if (daysSince < 0 || daysSince > 14) continue;
        // Nutzer-Feedback (2026-08-17, Coach-Tab-Audit): matcht zusätzlich
        // gegen e.substituteFor -- eine wegen Verletzung übersprungene
        // Übung wird oft genau DESHALB per "Heute anders" auf eine andere
        // Übung substituiert (e.name zeigt dann den Ersatznamen, e.name
        // === ex.name schlägt fehl, obwohl es sich um dieselbe, weiterhin
        // verletzungsbedingt gemiedene Übung handelt).
        const stillPresent = currentWeek.days.some(d => d.exercises.some(e => e.name === ex.name || e.substituteFor === ex.name));
        if (!stillPresent) continue;
        if (!found || daysSince < found.daysSince) {
          found = { exerciseName: ex.name, skipDate: ex.skipDate, daysSince };
        }
      }
    }
  }
  if (!found) return null;

  return {
    exerciseName: found.exerciseName,
    skipDate: found.skipDate,
    daysSince: found.daysSince,
    evidence: [
      { label: 'Übersprungen', value: `${found.daysSince} ${found.daysSince === 1 ? 'Tag' : 'Tage'} her wegen Schmerzen` },
    ],
  };
}

/**
 * @param {Object} state
 * @returns {Array<Object>} 0-2 strukturelle Signale, höchstens 2 gleichzeitig
 *   (Priorität Mehr-Übungen-Aggregation > Verletzungs-Erinnerung > Präventiver
 *   Deload > Wiederkehrende Erschöpfung (B140, Runde 13) > Konsistenz-Qualität
 *   > Push/Pull bei Überzahl > Compound/Isolation-Verhältnis — die
 *   Aggregation steht zuoberst, da ein datenbasierter breiter Totalausfall
 *   der konkreteste Befund unter den strukturellen Signalen ist, analog zur
 *   Top-Priorität von _checkPersistentFailure in der akuten Kaskade; die
 *   Verletzungs-Erinnerung direkt danach, da sicherheitsrelevant;
 *   Compound/Isolation zuletzt, da rein informativ, nie dringlich — siehe
 *   Kommentar bei _checkCompoundIsolationBalance()). Jedes Objekt trägt ein
 *   `type`-Feld ('multi_exercise_failure'|'injury_reminder'|'deload_preventive'|
 *   'recurring_fatigue'|'consistency_quality'|'push_pull'|'compound_isolation')
 *   als Diskriminator fürs Rendering in ui.js, zusätzlich zu den jeweiligen
 *   Rohdaten (weeksSince/dominant/etc.) für die dortigen Kurztexte.
 */
export function computeStructuralSignals(state) {
  const signals = [];

  const multiFail = _checkMultiExerciseFailure(state);
  if (multiFail) signals.push({ type: 'multi_exercise_failure', ...multiFail });

  const injury = _checkInjuryReminder(state);
  if (injury) signals.push({ type: 'injury_reminder', ...injury });

  const deload = _checkPreventiveDeload(state);
  if (deload) signals.push({ type: 'deload_preventive', ...deload });

  const recurringFatigue = _checkRecurringFatigue(state);
  if (recurringFatigue) signals.push({ type: 'recurring_fatigue', ...recurringFatigue });

  const cq = _checkConsistencyQuality(state);
  if (cq) signals.push({ type: 'consistency_quality', ...cq });

  const pp = _checkPushPullBalance(state);
  if (pp) signals.push({ type: 'push_pull', ...pp });

  const ci = _checkCompoundIsolationBalance(state);
  if (ci) signals.push({ type: 'compound_isolation', ...ci });

  return signals.slice(0, 2);
}

// ─── Decisional Balance ─────────────────────────────────────────────────────
// Nur für Überlastung/Konsistenz-Engpass/Plateau (siehe Sprint-Spec: bei
// Wiedereinstieg ist die Lage eindeutig, Progression hat keine echte
// Gegenoption). Nutzt ausschließlich bereits in computeWeeklyFocus()
// berechnete, echte Werte — keine neue Berechnungslogik, reine
// Text-Strukturierung der vorhandenen Daten für die Gegenüberstellung.

const _OVERLOAD_SIGNAL_LABEL = {
  sleep: 'Schlafdefizit',
  rpe: 'RPE-Trend',
  completion: 'sinkender Erfolgsquote',
};
const _OVERLOAD_SIGNAL_VALUE_LABEL = {
  sleep: 'dein Schlaf',
  rpe: 'der RPE-Trend',
  completion: 'deine Erfolgsquote',
};

function _balanceForOverload(focus) {
  const signalLabel = _OVERLOAD_SIGNAL_LABEL[focus.signalType] ?? 'anhaltender Überlastung';
  const valueLabel  = _OVERLOAD_SIGNAL_VALUE_LABEL[focus.signalType] ?? 'das Signal';
  return {
    stayOption: {
      label: 'Weiter wie bisher trainieren',
      pros: ['Plan bleibt eingehalten'],
      cons: [`Verletzungsrisiko steigt bei anhaltendem ${signalLabel}`],
    },
    changeOption: {
      label: 'Diese Woche konservativer trainieren',
      pros: ['Regeneration bekommt Vorrang'],
      cons: ['Geplante Steigerung verschiebt sich'],
    },
    closing: `Die Daten sprechen für die zweite Option, solange sich ${valueLabel} nicht verbessert.`,
  };
}

function _balanceForConsistencyGap(focus) {
  return {
    stayOption: {
      label: 'Pensum/Intensität trotzdem erhöhen',
      pros: ['Schnellerer potenzieller Fortschritt'],
      cons: ['Bringt wenig, wenn Trainingstage ohnehin ausfallen'],
    },
    changeOption: {
      label: 'Erst Konsistenz stabilisieren',
      pros: ['Realistischere Grundlage für nachhaltigen Fortschritt'],
      cons: ['Fühlt sich kurzfristig "langsamer" an'],
    },
    closing: `Bei ${focus.avgPct}% absolvierten Trainingstagen über die letzten 6 Wochen bringt mehr Pensum aktuell wenig.`,
  };
}

// B26: persistent_failure bekommt — anders als Plateau — eine generische
// Decisional Balance statt einer eigenen Buttons-Familie, weil hier (im
// Unterschied zu Plateau) keine mehrdeutige Strategie-Wahl (deload/volume/
// variation) existiert, sondern nur ein einziger klarer Hebel (Gewicht
// runter) — das passt exakt in das bestehende stay/change-Muster.
function _balanceForPersistentFailure(focus) {
  return {
    stayOption: {
      label: 'Weiter wie bisher versuchen',
      pros: ['Plan bleibt eingehalten'],
      cons: [`Wiederholtes Scheitern bei ${focus.exerciseName} bleibt bestehen`],
    },
    changeOption: {
      label: 'Gewicht reduzieren (Empfehlung)',
      pros: ['Realistische Basis für neuen Fortschritt'],
      cons: ['Kurzfristig weniger Gewicht bewegt'],
    },
    closing: `Nach 3 Wochen komplettem Fehlschlag bei ${focus.exerciseName} spricht die Datenlage für eine Reduktion, nicht für "Augen zu und durch".`,
  };
}

/**
 * @param {Object} focus  Rückgabe von computeWeeklyFocus() — NICHT für Einträge
 *   aus computeStructuralSignals() gedacht (die haben in ui.js keine Decisional
 *   Balance, kein "Warum?", keinen Aktions-Button, siehe Strukturkarte).
 * @returns {{ stayOption: Object, changeOption: Object, closing: string } | null}
 *   null für reentry/plateau/progression/onTrack — keine Decisional Balance
 *   dafür. Plateau hat mit "✓ Habe ich umgesetzt"/"Ignorieren" (plateauActions)
 *   bereits ein eigenes, nicht-redundantes Entscheidungs-Paar (Sprint: Plateau-
 *   Buttons konsolidieren). persistent_failure (seit B26) hat KEINE eigene
 *   Buttons-Familie wie Plateau — nutzt bewusst die generische Balance.
 */
export function buildDecisionalBalance(focus) {
  if (focus.status === 'overload') return _balanceForOverload(focus);
  if (focus.status === 'consistencyGap') return _balanceForConsistencyGap(focus);
  if (focus.status === 'persistent_failure') return _balanceForPersistentFailure(focus);
  return null;
}
