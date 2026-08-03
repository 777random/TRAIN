# LLM-Council-Einbeziehung

## Hintergrund

Basiert auf Andrej Karpathys "LLM Council"-Konzept: ein mehrstufiger Prozess,
bei dem eine Frage nicht von einem einzelnen Modell direkt beantwortet
wird, sondern über mehrere unabhängige Perspektiven läuft, die sich
gegenseitig blind querprüfen, bevor ein "Chairman"-Modell die Antworten zu
einer Synthese zusammenführt.

Für TRAIN ist das konkret als eigenständiger Chat-Prompt umgesetzt (siehe
`Diagnose & Sprints/TRAIN-LLM-Council-Chat-Prompt.md` — privat, nicht im
Git-Repo, siehe "Ablage" unten), der bei jeder Frage genau diesen
dreistufigen Prozess mit fünf klar getrennten Rollen durchläuft:

1. **Contrarian** — sucht ausschließlich, was schiefgehen könnte. Findet
   den fatalen Fehler zuerst, falls einer da ist.
2. **Assumption-Ripper** — hinterfragt jede Annahme in der Frage selbst,
   reformuliert notfalls das eigentliche Problem.
3. **Expansionist** — sucht den übersehenen Vorteil/die übersehene
   Gelegenheit, die in der Frage steckt.
4. **Outsider** — kennt TRAIN nicht im Detail, stellt die naiven Fragen,
   die oft die eigentlich wichtigen sind.
5. **Executor** — interessiert sich nur dafür, was konkret als Nächstes zu
   tun ist (und was NICHT).

Danach folgt STUFE 2 (jede Rolle bewertet die Antworten der anderen vier
blind auf Schwachstellen/Widersprüche) und STUFE 3 (ein Chairman fällt aus
allem EINE klare Entscheidung, keine Sowohl-als-auch-Antwort).

Der Grund für dieses Setup: ein einzelnes Modell im normalen Plan-Mode neigt
dazu, der eigenen ersten Idee zuzustimmen, statt sie kritisch aus einer
zweiten, unabhängigen Perspektive zu hinterfragen — insbesondere bei
Entscheidungen mit mehreren technisch gleichwertigen Optionen, bei
rückwirkenden Datenänderungen oder bei größeren, schwer umkehrbaren
Architektur-Schritten. Für diese Fälle reicht die normale
Plan-Mode-Bestätigung (ein Modell schlägt vor, der Nutzer bestätigt) nicht
aus — das separate LLM-Council-Chat-Setup des Nutzers bringt stattdessen
fünf unabhängige Perspektiven vor der eigentlichen Umsetzung ein.

Für TRAIN wird das LLM-Council als **separates Chat-Setup außerhalb von
Claude Code** genutzt (der Nutzer fügt die Council-Frage manuell in den
mit obigem Prompt initialisierten Chat ein) — Claude Code selbst führt das
Council nicht autonom aus, sondern erkennt Council-würdige Entscheidungen,
flagt sie explizit im Diagnose-/Sprint-Ergebnis mit einer kopierbereiten
Council-Frage, und wartet auf eine Rückmeldung, die auf der
Council-Antwort basiert, bevor umgesetzt wird.

## Ablage: privat vs. Repo

Zwei zusammengehörige Dateien, bewusst an unterschiedlichen Orten:

- `Diagnose & Sprints/TRAIN-Claude-Code-Council-Trigger.md` — die
  Ursprungs-Spezifikation des unten übernommenen AGENTS.md-Blocks, sowie
  `Diagnose & Sprints/TRAIN-LLM-Council-Chat-Prompt.md` — der
  Start-Prompt für den eigentlichen Council-Chat. Beide liegen im privaten
  `Diagnose & Sprints/`-Ordner (per `.gitignore` ausgeschlossen, siehe
  globale Claude-Code-Anweisung und `CLAUDE.md`), landen also NICHT im
  Git-Repo.
- Dieses Dokument (`docs/LLM-COUNCIL.md`) sowie der Regel-Abschnitt in
  `AGENTS.md` sind die versionierte, im Repo nachvollziehbare Kopie der
  Prozessregel selbst (WANN/WANN NICHT/WAS TUN) — nicht des vollständigen
  Council-Chat-Prompts mit den fünf Rollen im Wortlaut, der bewusst privat
  bleibt.

## Die Regel

Siehe `AGENTS.md`, Abschnitt "LLM-Council-Einbeziehung", für die
vollständige, verbindliche Regel (WANN Council-würdig, WANN nicht, und was
zu tun ist). Dieser Abschnitt ist hier nur zur Nachvollziehbarkeit
dupliziert — die Regel selbst lebt in `AGENTS.md` als Prozessregel:

### WANN Council-würdig (mindestens eines muss zutreffen)

1. Mehrere echte, technisch gleichwertig vertretbare Optionen ohne
   klaren Gewinner.
2. Die Änderung wirkt sich rückwirkend auf bereits gespeicherte/angezeigte
   Nutzerdaten aus (nicht nur künftiges Verhalten).
3. Größerer, schwer umkehrbarer Architektur-Schritt.
4. Neues Feature mit echtem Umfang, das eine Grundsatzentscheidung zur
   Produktrichtung berührt.
5. Eine Entscheidung, die dem Kernprinzip "einfach nur trainieren, nicht
   mehr nachdenken" oder der 2-Tap-Onboarding-Regel (train-v132) möglicherweise
   widerspricht oder sie aufweicht.

### WANN NICHT Council-würdig

Reguläre Bugfixes, klar umrissene Feedback-Einzel-Fixes, Cleanup/Housekeeping,
und alles leicht Reversible — dafür reicht die normale
Plan-Mode-Bestätigung.

### Vorgehen bei Council-würdigen Punkten

Nicht selbst entscheiden. Im Diagnose-/Sprint-Ergebnis explizit als
"COUNCIL-EMPFEHLUNG" vermerken, mit Begründung (welches Kriterium zutrifft)
und einer kompakt formulierten, kopierbereiten Council-Frage. Umsetzung
erst nach einer Rückmeldung, die auf der Council-Antwort basiert (oder
nach expliziter Nutzer-Entscheidung, das Council für diesen Fall zu
überspringen).
