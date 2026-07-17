# TRAIN — SECURITY.md

Stand: train-v176 (2026-07-18). Zwei Teile: (1) was für TRAINs heutige
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
3. **CSP-`<meta>`-Tag** (`index.html`) als zusätzliche Absicherung gegen
   externe Script-Injektion. Nur per `<meta>` möglich (GitHub Pages erlaubt
   keine echten HTTP-Header) — deckt daher nicht alles ab (z.B.
   `X-Frame-Options` braucht einen echten Header). `'unsafe-inline'` bei
   `script-src` ist eine bewusste Kompromisslücke für den bestehenden
   Bootstrap-`<script>` + 4 inline-`onclick`-Handler (kein Nonce/Hash ohne
   Build-Step möglich). Bei einer künftigen Build-Pipeline: diese 4 Handler
   auf das bestehende `data-action`-Event-Delegation-Muster umstellen und
   `'unsafe-inline'` aus `script-src` entfernen.
4. **Rechtliches:** Impressum/Datenschutzerklärung sind ein aktiver
   Launch-Blocker, siehe BUGS.md B55/B56 — unabhängig vom technischen Teil
   dieses Dokuments, braucht echte Angaben vom Nutzer.

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
