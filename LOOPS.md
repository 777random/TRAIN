# TRAIN — Automatische Session-Loops
# Claude Code führt diese Loops am
# Anfang JEDER Session aus.
# Danach erst die eigentliche Aufgabe.
# Letzte Aktualisierung: 2026-07-12 / train-v157

---

## WICHTIGER HINWEIS ZUM MECHANISMUS (zuerst lesen)

Es gibt keinen technischen Session-Start-Hook, der diese Datei
automatisch ausführt. Der einzige Mechanismus, der tatsächlich bei
jeder Session greift, ist: `CLAUDE.md` wird vom Werkzeug automatisch
in den Kontext geladen, verweist auf `LOOPS.md` (siehe Projektdokumente-
Tabelle), und Claude Code liest/befolgt diese Datei deshalb zuverlässig
zu Sessionbeginn — genau wie bei `HANDOFF.md`/`BUGS.md`/`DECISIONS.md`/
`AGENTS.md`. "Automatisch" heißt hier also: durch gelebte Konvention +
Verweiskette, nicht durch einen Cron-Job oder Editor-Hook. Wenn diese
Datei jemals nicht gelesen wird, ist das ein Hinweis, dass die
Verweiskette (CLAUDE.md → LOOPS.md) unterbrochen ist, nicht dass ein
"Loop" ausgefallen ist.

**Push-Policy (bewusste Abweichung von der ursprünglichen Sprint-Vorlage):**
Loop 1 und Loop 3 dürfen bei einem gefundenen Bug automatisch fixen und
lokal committen (`git add -A && git commit`), aber **`git push` erfolgt
NICHT automatisch** — das Repo deployt direkt von `main` auf GitHub
Pages (production, siehe CLAUDE.md), ein automatischer Push eines
selbst-diagnostizierten Fixes ohne jede menschliche Prüfung geht damit
sofort live. Push braucht einmal pro Session eine kurze Bestätigung des
Nutzers, nachdem Diff und Testergebnis gezeigt wurden. Alles vor dem
Push (Diagnose, Fix, Commit, Regressionstest) läuft ohne Rückfrage.

---

## ANWEISUNG AN CLAUDE CODE

Beim Start jeder Session:
1. Diese Datei lesen
2. Alle AKTIVEN Loops der Reihe nach
   ausführen
3. Ergebnisse in SESSION_LOG.md
   dokumentieren
4. Erst dann mit der eigentlichen
   Aufgabe beginnen

---

## LOOP 1 — Regressions-Test (AKTIV)
Priorität: IMMER, vor allem anderen

Ausführung:
  tests/regression_core.html headless
  in Chrome ausführen.

Erwartung: 10/10 grün, 0 uncaught errors.

Wenn NICHT 10/10:
  1. Fehler identifizieren
  2. Root Cause in SESSION_LOG.md
     dokumentieren
  3. Fix implementieren
  4. Nochmal testen
  5. Wiederholen bis 10/10 grün
  6. Fix lokal committen (ohne Rückfrage):
     git add -A
     git commit -m "fix: regression
     loop auto-fix [beschreibung]"
  7. Push braucht Bestätigung: dem
     Nutzer Diff + Testergebnis zeigen,
     erst nach "ja" `git push` ausführen.

Stopp-Bedingung: 10/10 grün (Push kann
  unabhängig davon noch ausstehen)

---

## LOOP 2 — HANDOFF.md Aktualität (AKTIV)
Priorität: Nach Loop 1

Ausführung:
  HANDOFF.md lesen.
  Prüfen ob CACHE_VERSION in HANDOFF.md
  mit sw.js übereinstimmt.
  Prüfen ob "Letzter Commit" korrekt ist.
  Prüfen ob "Nächster Schritt" noch
  aktuell ist (nicht bereits erledigt).

Wenn veraltet:
  HANDOFF.md aktualisieren.
  git add HANDOFF.md
  git commit -m "chore: HANDOFF.md
  auto-sync"
  Push braucht Bestätigung (siehe
  Push-Policy oben) — reine Doku-Syncs
  sind risikoarm, aber die Regel gilt
  einheitlich für alle Loops.

Stopp-Bedingung: HANDOFF.md ist aktuell

---

## LOOP 3 — Edge-Case-Audit (AKTIV)
Priorität: Nach Loop 1+2, nur wenn
  keine dringenden Bugs offen (BUGS.md
  hat keine UX-Hoch Einträge)

Ausführung:
  1. tests/fixtures/ lesen —
     wie viele Edge-Case JSONs existieren?
  2. Wenn weniger als 15:
     Einen neuen Edge-Case JSON erstellen
     der noch nicht existiert.
     Kategorien die noch fehlen:
     - Extremwerte (500kg, 0kg, 9999 Wdh)
     - Leere Strukturen (0 Übungen,
       0 Sätze, 0 Wochen)
     - Grenzwerte (genau 2 Wochen für
       Plateau, genau 8 Wochen für Deload)
     - Inkonsistente Daten (status='success'
       aber done:false)
     - Sehr alte Daten (startDate 2020)
     - Sehr viele Wochen (100 Wochen)
  3. JSON headless testen:
     App laden, JSON importieren,
     prüfen ob App abstürzt oder
     uncaught errors produziert
  4. Ergebnis dokumentieren:
     tests/fixtures/README.md updaten
     BUGS.md updaten wenn Bug gefunden
  5. Wenn Bug gefunden: sofort fixen
     bevor nächster Edge Case, lokal
     committen (ohne Rückfrage), Push
     braucht Bestätigung (siehe
     Push-Policy oben)

Stopp-Bedingung: 15 Edge-Case JSONs
  in tests/fixtures/ ODER UX-Hoch Bug
  gefunden (dann Loop stoppen,
  Bug priorisieren)

WICHTIGER HINWEIS zu Schritt 3: Ein neu erstelltes JSON per Headless-
Chrome tatsächlich zu IMPORTIEREN (Klick auf "JSON importieren", Datei
auswählen) ist nicht dasselbe wie es nur `JSON.parse()`-syntaktisch zu
validieren — siehe die Erfahrung aus dem tests/fixtures/-Sprint
(train-v157), wo die 5 Fixtures nur schema-validiert, aber nie real
importiert wurden. Schritt 3 hier ist explizit als ECHTER Import-Test
gemeint, nicht als reiner JSON-Syntax-Check.

---

## LOOP 4 — Diagnose offener Bugs (INAKTIV)
# Aktivieren wenn: alle UX-Hoch Bugs
# behoben und Edge-Case-Audit abgeschlossen

Ausführung:
  BUGS.md lesen.
  Ersten offenen Bug ohne Root Cause
  nehmen.
  Vollständige Diagnose durchführen
  (Code lesen, nicht raten).
  Root Cause in BUGS.md eintragen.
  context-exports/diagnose-[ID].txt
  erstellen für externe Beratung.

Stopp-Bedingung: Alle offenen Bugs
  haben dokumentierten Root Cause

Um zu aktivieren: "INAKTIV" → "AKTIV"
ändern in dieser Datei.

(Diagnose-only, kein Fix/Commit/Push — Push-Policy oben ist hier
irrelevant, solange Loop 4 nur liest und in BUGS.md/context-exports/
schreibt.)

---

## SESSION_LOG.md FORMAT

Nach jedem Session-Start:
Eintrag in SESSION_LOG.md hinzufügen:

  ## [Datum] [Version]
  Loop 1: 10/10 grün ✓ / X/10 → Fix: [beschreibung] (Push: erledigt/ausstehend)
  Loop 2: aktuell ✓ / aktualisiert: [was] (Push: erledigt/ausstehend)
  Loop 3: [N] Edge Cases, neu: [dateiname] / übersprungen
  Loop 4: [Bug-ID] diagnostiziert / übersprungen
  Eigentliche Aufgabe: [was gemacht wurde]

---

## LOOPS VERWALTEN

Loop aktivieren:
  "INAKTIV" → "AKTIV" ändern

Loop deaktivieren:
  "AKTIV" → "INAKTIV" ändern

Neuen Loop hinzufügen:
  Nächste freie Nummer verwenden,
  Format beibehalten.

Claude Code aktualisiert diese Datei
wenn neue Loops sinnvoll werden —
z.B. wenn ein neuer Regressions-Test
hinzukommt oder ein wiederkehrendes
Problem erkannt wird.
