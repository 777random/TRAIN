/**
 * pauseTips.js — Runde 21 (Kurzartikel-Feature, Ersatz für die abgelehnte
 * In-App-Spiel-Idee, siehe DECISIONS.md/TRAIN-Launch-Roadmap.md Phase H).
 *
 * Kurze, kategorie-gebundene Trainings-Tipps, während der Pause im
 * Pause-Overlay (timer.js) angezeigt. Platzhalter-Texte — echte Redaktion
 * ist bewusst NICHT Teil dieser Runde, nur die Struktur wird validiert.
 *
 * Schlüssel entsprechen movementMap.js' resolveCategory()-Rückgabewerten
 * (Push/Pull/Squat/Hinge/Carry/Core), `_generic` deckt 'Sonstige'/unbekannte
 * Übungen ab. Importfrei, Tiefe 0 (wie movementMap.js).
 */
export const PAUSE_TIPS_BY_CATEGORY = {
  Push: [
    { title: 'Schulterblätter fixieren', body: 'Schulterblätter beim Drücken leicht zusammenziehen und unten halten — das gibt der Bewegung eine stabilere Basis und schont die Schultern.' },
  ],
  Pull: [
    { title: 'Schulterblätter zuerst', body: 'Beim Ziehen zuerst die Schulterblätter aktivieren, erst danach mit dem Arm ziehen — so übernimmt der Rücken die Arbeit, nicht nur der Bizeps.' },
  ],
  Squat: [
    { title: 'Knie-Richtung beachten', body: 'Knie in Richtung der Zehenspitzen führen, nicht nach innen fallen lassen — das schützt die Kniegelenke unter Last.' },
  ],
  Hinge: [
    { title: 'Hüfte führt die Bewegung', body: 'Die Hüfte führt die Bewegung, nicht der untere Rücken — Rücken gerade halten, aus Beinen und Hüfte strecken.' },
  ],
  Carry: [
    { title: 'Ganzkörperarbeit', body: 'Schultern tief und Rumpf angespannt halten — Tragen ist Ganzkörperarbeit, nicht nur Griffkraft.' },
  ],
  Core: [
    { title: 'Ausatmen bei Anspannung', body: 'Bei Bauchübungen bewusst ausatmen bei der Anspannung — das aktiviert die tiefe Bauchmuskulatur stärker als reines Kraftschieben.' },
  ],
  _generic: [
    { title: 'Tempo statt Hast', body: 'Konstante Wiederholungsgeschwindigkeit schlägt hastiges Tempo — kontrollierte Sätze bringen meist mehr Muskelreiz.' },
    { title: 'Trinken nicht vergessen', body: 'Ausreichend trinken zwischen den Sätzen — schon leichte Dehydrierung senkt die Kraftleistung messbar.' },
  ],
};
