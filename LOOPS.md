# TRAIN — Automatische Session-Loops
# Claude Code führt diese Loops am
# Anfang JEDER Session aus.
# Danach erst die eigentliche Aufgabe.
# Letzte Aktualisierung: 2026-07-21 / train-v194

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

**Lokaler Pre-Check vor Push (seit train-v162):**
  npx playwright test --reporter=list
Nur pushen wenn grün. GitHub Actions (siehe
.github/workflows/test.yml) ist eine zweite,
unabhängige Sicherheitsnetz-Ebene NACH dem Push —
kein Ersatz für den lokalen Check und kein
Push-Blocker (siehe CLAUDE.md "CI-Status").
**Node.js installiert (2026-07-13, v24.18.0 LTS via winget).**
Lokaler Pre-Check läuft jetzt tatsächlich: 16/16 grün (1
Regressionstest + 15 Fixtures), ~30s. Einmalig direkt nach der
Installation trat auf DIESER Maschine ein Flake im Regressionstest
auf (Chromium-Kaltstart direkt nach dem Download, `retries:1` hat es
aufgefangen) — 4 Wiederholungen danach (warm) liefen alle sauber
durch, GitHub Actions selbst hatte nie einen Flake. Eingeordnet als
einmaliges Kaltstart-Artefakt dieser Maschine, nicht als echte Race
Condition im Test — falls es wiederkehrend auftritt, dann doch genauer
diagnostizieren (RENDER_WAIT_MS in regression_core.html ggf. zu knapp
bei langsamem Erststart).

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
  Prüfen ob CACHE_VERSION und CSS-Version
  in CLAUDE.md (erste Sektion) mit
  sw.js und index.html übereinstimmen.
  Falls nicht: CLAUDE.md aktualisieren.

Wenn veraltet:
  HANDOFF.md und/oder CLAUDE.md aktualisieren.
  git add HANDOFF.md CLAUDE.md
  git commit -m "chore: HANDOFF.md/CLAUDE.md
  auto-sync"
  Push braucht Bestätigung (siehe
  Push-Policy oben) — reine Doku-Syncs
  sind risikoarm, aber die Regel gilt
  einheitlich für alle Loops.

Stopp-Bedingung: HANDOFF.md und CLAUDE.md
  sind aktuell

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

## LOOP 5 — for-advisor.txt (AKTIV)
Priorität: Am ENDE jeder Session (nicht am Anfang — nach der
  eigentlichen Aufgabe, als letzter Schritt der Konsolidierung)

Ausführung:
  Kontext-Export generieren und speichern als:
  context-exports/for-advisor.txt
  (überschreibt vorherige Version)

  Inhalt identisch zur bestehenden for-advisor.txt-Struktur (siehe
  prompts/for-advisor.txt für die vollständige Vorlage):
  1. Aktueller Code-Stand
  2. Coach-Kaskade (vollständig)
  3. Alle Prozentzahlen im UI
  4. State-Shape Änderungen
  5. Abweichungen von CLAUDE.md
  6. Offene technische Schulden
  7. MovementMap vollständig
  8. Test-Infrastruktur

  Datum + CACHE_VERSION oben in die Datei einfügen.

  Direkt aus dem echten Code erzeugen, nicht nur aus CLAUDE.md/BUGS.md
  zusammenfassen (siehe prompts/for-advisor.txt: "direkt aus Code,
  nicht aus Dokumentation") — sonst würde der Export lediglich
  bestehende Doku-Drifts mit-exportieren statt sie aufzudecken.

SESSION_LOG.md Eintrag:
  Loop 5: for-advisor.txt aktualisiert

Stopp-Bedingung: Datei geschrieben

Hinweis: context-exports/ ist gitignored (siehe .gitignore) — diese
Datei wird nie mitgepusht, rein lokales Artefakt für externe Beratung.

---

## LOOP 6 — GoatCounter count.js Versions-Check (AKTIV)
Priorität: Nach Loop 1-3. Läuft NICHT bei jedem Sessionstart mit echtem
  Netzwerkaufruf — nur das Datum unten wird bei jedem Start billig geprüft.

Hintergrund: `index.html` bindet GoatCounter über eine versionierte URL +
SRI-Hash ein (seit train-v182, siehe BUGS.md), bewusst OHNE Auto-Update.
Ein gepinnter Hash ist kein Sicherheitsrisiko, wenn er veraltet — es fehlen
höchstens neue Features. Eine feste Prüfroutine verhindert nur, dass eine
neue Version dauerhaft unbemerkt bleibt.

Ausführung:
  1. "Letzte Prüfung"-Datum unten in diesem Abschnitt lesen.
  2. Wenn < 90 Tage seit letzter Prüfung vergangen: Loop überspringen,
     keine Netzwerkanfrage. In SESSION_LOG.md nur "übersprungen (zuletzt
     geprüft: [Datum])" vermerken.
  3. Wenn ≥ 90 Tage vergangen: https://www.goatcounter.com/help/countjs-versions
     abrufen. Aktuellste dort gelistete Version + SRI-Hash mit dem
     bestehenden `<script>`-Tag in index.html vergleichen (aktuell:
     count.v5.js, siehe Kommentar direkt über dem Tag).
  4. Bei neuerer Version: NICHT automatisch umstellen (Fremd-Script,
     bewusster Pin) — Nutzer informieren (Version, Hash, Link, welche
     Zeile in index.html betroffen wäre) und auf Bestätigung warten,
     bevor geändert wird.
  5. "Letzte Prüfung"-Datum unten in diesem Abschnitt aktualisieren —
     unabhängig vom Ergebnis (auch wenn keine neue Version gefunden wurde).

**90-Tage-Intervall statt der ursprünglich erwogenen 2-4 Wochen — Begründung:**
Reale Release-Historie von count.js (Stand 2026-07-21, https://www.goatcounter.com/help/countjs-versions):
v1 (Dez 2020) → v2 (Mär 2021, ~3 Monate) → v3 (Dez 2021, ~9 Monate) →
v4 (Dez 2023, ~24 Monate) → v5 (Jun 2025, ~18 Monate). Kürzester je
beobachteter Abstand: 3 Monate, Durchschnitt deutlich darüber. Eine
monatliche/zweiwöchentliche Prüfung würde in praktisch jedem Lauf ergebnislos
bleiben (reiner Overhead ohne Erkenntnisgewinn), und da der Hash ohnehin
bewusst gepinnt ist (kein Zeitdruck durch ein Sicherheitsrisiko), gibt es
keinen Grund für eine so hochfrequente Prüfung. 90 Tage balanciert
"nicht monatelang verpassen" gegen "nicht bei jeder Session sinnlos
nachfragen".

Letzte Prüfung: 2026-07-21 (count.v5.js bestätigt aktuell, Hash in
index.html stimmt exakt mit der offiziell publizierten SRI-Angabe überein
— `sha384-atnOLvQb9t+jTSipvd75X2yginT4PjVbqDdlJAmxMm+wYElFmeR6EmLP5bYeoRVQ`)

Stopp-Bedingung: keine (wiederkehrender Loop, läuft dauerhaft mit)

---

## LOOP 7 — for-advisor-product.txt (AKTIV)
Priorität: Am ENDE jeder Session, nach Loop 5+6

Ausführung:
  context-exports/for-advisor-product.txt erstellen/aktualisieren.
  Datum + CACHE_VERSION oben in die Datei.
  In Alltagssprache — keine Funktionsnamen ohne Erklärung, kein Code
  vorausgesetzt (Ziel-Publikum: externe Berater-KI ohne Repo-Zugriff).

  Inhalt:
  1. Was TRAIN ist (Nordstern, Zielgruppe, was TRAIN nicht ist,
     Lokal-first als USP)
  2. Vollständige User Journey (Onboarding, Vor/Während/Nach dem
     Training, wöchentlich)
  3. Coach-Logik in Alltagssprache (Hauptkarte-Situationen,
     Strukturkarte-Muster, warum der Session Coach TRAIN unverzichtbar
     macht)
  4. Feature-Status (vorhanden/nicht gebaut mit Begründung/
     zurückgestellt/Konzept)
  5. Bewusste Entscheidungen (nicht rückgängig ohne neue Entscheidung)
  6. Offene Produktfragen

Stopp-Bedingung: Datei geschrieben, alle 6 Abschnitte vorhanden

---

## LOOP 8 — for-advisor-market.txt (AKTIV)
Priorität: Am ENDE jeder Session, nach Loop 7
Nur inhaltlich aktualisieren wenn: neue Markt-Erkenntnisse oder
  Konkurrenz-Preise bekannt geworden sind (sonst nur Datum/
  CACHE_VERSION im Kopf auffrischen)

Ausführung:
  context-exports/for-advisor-market.txt erstellen/aktualisieren.
  Inhalt: Marktpositionierung, direkte Konkurrenten (aktuelle Preise +
  Stärken/Schwächen + wo TRAIN gewinnt), Preispositionierung,
  Zielgruppen-Überschneidung, Marktgröße (grob), offene Marktfragen.

Stopp-Bedingung: Datei geschrieben, alle Konkurrenten mit aktuellem
  Preisstand vorhanden

---

## LOOP 9 — for-advisor-ux.txt (AKTIV)
Priorität: Am ENDE jeder Session, nach Loop 8
Nur inhaltlich aktualisieren wenn: UX-relevante Änderungen (neues
  Onboarding, neue Session-Coach-Bausteine o.ä.) im Sprint passiert sind

Ausführung:
  context-exports/for-advisor-ux.txt erstellen/aktualisieren.
  Bewusst KOMPAKT (Kurzfassung, nicht die volle User Journey — die lebt
  in for-advisor-product.txt).
  Inhalt: aktueller Onboarding-Flow (Schritt für Schritt + was fehlt),
  bekannte UX-Probleme (inkl. "kein Usability-Test gemacht"), was
  bereits gut funktioniert, offene UX-Fragen.

Stopp-Bedingung: Datei geschrieben

---

## LOOP 10 — for-advisor-growth.txt (AKTIV)
Priorität: Am ENDE jeder Session, nach Loop 9
Nur inhaltlich aktualisieren wenn: neue Nutzer-Zahlen oder
  Kanal-Erkenntnisse vorliegen

Ausführung:
  context-exports/for-advisor-growth.txt erstellen/aktualisieren.
  Bewusst KOMPAKT.
  Inhalt: aktueller Stand (Nutzerzahl, Blocker), geplante Kanäle,
  Share-Feature als Wachstums-Hebel, Retention-Mechanismus,
  Monetarisierung-Timing, offene Growth-Fragen.

Stopp-Bedingung: Datei geschrieben

---

## LOOP 11 — for-advisor-consolidated.txt (AKTIV)
Priorität: IMMER nach Loop 7-10 (letzter Advisor-Export-Loop jeder
  Session)

Ausführung:
  context-exports/for-advisor-consolidated.txt erstellen/aktualisieren.
  WICHTIG: diese Datei hat KEINEN eigenen Inhalt — sie liest die vier
  Dateien aus Loop 7-10 und fasst sie zusammen (Teil 1 = Produkt
  vollständig, Teil 2 = Markt vollständig, Teil 3 = UX nur "bekannte
  Probleme"/"was funktioniert"/"offene Fragen" ohne den Onboarding-Flow,
  Teil 4 = Growth nur "Share-Feature"/"Monetarisierung-Timing"/"offene
  Fragen" ohne die Kanal-Details, Teil 5 = alle offenen Fragen aus allen
  vier Dateien konsolidiert, ohne Duplikate, priorisiert in HOCH/
  MITTEL/NIEDRIG).
  Diese Datei ist der empfohlene Startpunkt für neue externe
  Advisor-Chats — siehe prompts/neuer-advisor-chat.txt.

Stopp-Bedingung: Datei geschrieben, enthält alle 5 Teile

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
  Loop 6: geprüft (neue Version: [ja/nein]) / übersprungen (zuletzt: [Datum])
  Eigentliche Aufgabe: [was gemacht wurde]
  Loop 5: for-advisor.txt aktualisiert (am Ende der Session)
  Loop 7: for-advisor-product.txt aktualisiert
  Loop 8: for-advisor-market.txt aktualisiert / unverändert (keine neuen Markt-Erkenntnisse)
  Loop 9: for-advisor-ux.txt aktualisiert / unverändert
  Loop 10: for-advisor-growth.txt aktualisiert / unverändert
  Loop 11: for-advisor-consolidated.txt aktualisiert (letzter Loop der Session)

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
