# TRAIN — LEGAL.md
*Rechts-Recherche und -Entscheidungen. Getrennt von BUGS.md gehalten (das bleibt reiner Bug-Tracker) — hier steht das Warum, dort nur ein Pointer.*
*Stand: train-v178 (Juli 2026)*

---

## Status

- **B55 (Impressum, Blocker):** strukturell vorbereitet (§5 DDG-Rahmentext in `ui.js`), wartet auf echte Name+Adresse-Angaben vom Betreiber. Siehe "c/o-Adress-Workaround" unten.
- **B56 (Datenschutz):** code-vollständig seit train-v177/v178 (Local-First-Dilemma, SW/Cache-Hinweis, Backup-Erklärung, Transparenz-Checkliste, eigenständige `datenschutz.html`).

---

## Recherchierte Fakten (2026, mit Quellen)

**1. Name — kein Workaround möglich.** Als Einzelunternehmer/Privatperson ist der vollständige bürgerliche Vor- und Nachname im Impressum Pflicht. Pseudonym/Künstlername reicht nicht, ist selbst ein Abmahngrund. ([online-impressum.de](https://online-impressum.de/muss-ich-meinen-klarnamen-im-impressum-angeben/), [it-recht-kanzlei.de](https://www.it-recht-kanzlei.de/impressum-einzelunternehmer-vorname-nachname.html))

**2. Adresse — c/o-Workaround ist legal.** Pflicht ist eine ladungsfähige Anschrift, nicht zwingend die private Wohnadresse. Ein c/o-Geschäftsadress-Service (virtuelles Büro, Coworking-Space, Impressum-Adress-Dienstleister) ist zulässig, **solange dort echte Postannahme/-weiterleitung stattfindet** — ein reines Postfach reicht laut Rechtsprechung nicht. ([e-recht24.de](https://www.e-recht24.de/impressum/13082-ladungsfaehige-anschrift.html), [zerodox.de](https://zerodox.de/ladungsfaehige-anschrift-impressum), [postflex.de](https://www.postflex.de/blog/impressum-adresse-nur-guenstig-oder-auch-rechtssicher/))
   - Optionen: kommerzielle Anbieter (~5-15€/Monat, z.B. Postflex — eigene Prüfung der Seriosität empfohlen), Coworking-Space mit Post-Service, c/o bei einem Steuerberater o.ä. mit dessen ausdrücklicher Zustimmung.
   - GmbH/UG-Gründung würde eine Firmenadresse ermöglichen, ist aber für den aktuellen Stand (Paywall laut DECISIONS.md "bis Marktvalidierung" zurückgestellt) unverhältnismäßig — nicht empfohlen.
   - **Vor dem Platzhalter-Swap:** beim gewählten Adress-Anbieter explizit bestätigen lassen, dass der Name im Format "Vorname Nachname, c/o [Anbieter]" geführt werden darf.

**3. OS-Streitschlichtung — NICHT hinzufügen.** Die EU-Plattform wurde zum **20.07.2025 abgeschaltet**. Ein Hinweis darauf (wie in vielen älteren Vorlagen) wäre jetzt selbst irreführend/abmahnfähig. TRAINs Text enthält keinen — bewusst so lassen, nicht "vervollständigen". ([ihk.de](https://www.ihk.de/lahn-dill/branchen/einstellung-os-plattform-6504948), [wbs.legal](https://www.wbs.legal/it-und-internet-recht/eu-streitbeilegungsplattform-os-plattform-eingestellt-jetzt-impressum-aktualisieren-83428/))

**4. §5 DDG greift schon jetzt.** "Geschäftsmäßig" ist weit gefasst — gilt auch vor dem ersten Euro Umsatz, wenn ein Angebot der Anbahnung eines späteren Geschäfts dient (TRAINs geplante Paywall reicht). Bußgeldrahmen bei Verstoß: bis 50.000€. ([gesetze-im-internet.de](https://www.gesetze-im-internet.de/ddg/__5.html), [rehkatsch.com](https://rehkatsch.com/media-law/impressum-law-germany/))

**5. Zweiter Kontaktweg — Entscheidung: nur E-Mail, Risiko akzeptiert.** §5 DDG verlangt "unmittelbare Kommunikation". Ein ECJ-Urteil (2008) stellt klar: eine Telefonnummer ist NICHT zwingend, wenn eine gleichwertig schnelle Alternative existiert — reine E-Mail ist rechtlich eine Grauzone, aber praktisch ein geringes Risiko bei einem kostenlosen ~20-Nutzer-Angebot ohne Umsatz. ([e-recht24.de](https://www.e-recht24.de/impressum/1023-impressum-telefonnummer.html)) Kein Kontaktformular gewählt — würde einen Drittanbieter-Formularservice erfordern (kein eigener Server), also einen neuen externen Aufruf + neuen Auftragsverarbeiter-Eintrag bedeuten, mehr Rechts-/Angriffsfläche statt weniger. **Neu bewerten, sobald die Paywall live geht** (Risiko-Kalkül ändert sich mit echtem Umsatz).

---

## Kritische Prüfung von externem KI-Feedback (Gemini/ChatGPT, 2026-07-18)

Nutzer bat um eine zweite Meinung von Gemini und ChatGPT zum ursprünglichen Plan. Jeder Punkt wurde eigenständig nachrecherchiert (nicht blind übernommen) — Ergebnis:

**Bestätigt:** Local-First-Datenschutz-Dilemma (Cache-Löschung = Datenverlust erklären, JETZT in `ui.js`/`datenschutz.html` umgesetzt) — mit Korrektur: das ist kein hartes Art.-13-DSGVO-Gebot (wie Gemini suggerierte), sondern primär Nutzer-Erwartungsmanagement/Haftungsvorsorge. Zweiter Kontaktweg (siehe Fakt 5) — eigenständig per ECJ-Urteil verifiziert, nicht nur geglaubt.

**Korrigiert:** SW/Cache-Rechtsgrundlage — Gemini schlug Art. 6 Abs. 1 lit. b DSGVO vor; recherchierte reale PWA-Datenschutzerklärungen nutzen überwiegend Art. 6 Abs. 1 lit. f (berechtigtes Interesse), passend zur bereits für GoatCounter verwendeten Grundlage — keine zweite Rechtsgrundlage nötig. Eigenständige Datenschutz-URL für App-Stores (Gemini) — ursprünglich als "später" eingestuft, dann als günstig genug für "jetzt" erkannt (`datenschutz.html`, train-v178).

**Umgedreht (KI-Aussage war unvollständig recherchiert):** Ein allgemeiner Haftungsausschluss für externe Links war ursprünglich geplant (nur gekürzt). ChatGPT nannte das "überschätzt". Eigene Recherche zeigt: der Disclaimer-Mythos geht auf ein LG-Hamburg-Urteil von 1998 zurück, das **das Gegenteil** entschied — eine pauschale Freizeichnung wirkt NICHT, Haftung entsteht erst bei tatsächlicher Kenntnis einer Rechtsverletzung + Nichtentfernung trotz Kenntnis. Ein Disclaimer kann sogar kontraproduktiv sein (suggeriert Kenntnis der verlinkten Inhalte). ([it-recht-kanzlei.de](https://www.it-recht-kanzlei.de/disclaimer-sinn-unsinn.html), [dr-dsgvo.de](https://dr-dsgvo.de/disclaimer-und-haftungsausschluss-eher-schaedlich/)) **Entscheidung: kein Link-Disclaimer, weder lang noch kurz.** Der medizinische Hinweis ("keine medizinische Beratung") ist rechtlich etwas anderes (Produkt-/Beratungshaftung, nicht Link-Haftung) und bleibt.

**Neu gefunden (von keiner KI erwähnt):** siehe "BFSG" und "dragdrop.js-Lizenz" unten.

**Nicht übernommen:** SECURITY.md als "irrelevant" verworfen — abgelehnt, ist ein internes Entwickler-Dokument wie DECISIONS.md, nie für Endnutzer gedacht, die Kritik verwechselt die Zielgruppe. CACHE_VERSION-Bump für reine Textänderungen in Frage gestellt — beibehalten: `sw.js` fährt Cache-First mit Background-Refresh (best-effort, kein garantierter Zeitpunkt); bei rechtlich relevantem Text ist garantiert-schneller Rollout wichtiger als bei kosmetischen Änderungen.

---

## Bewusst noch NICHT umgesetzt (Blaupause, aktivieren bei Bedarf)

- **AGB (Nutzungsbedingungen):** erst nötig, sobald die Paywall/Coaching-Abo tatsächlich verkauft wird (DECISIONS.md: "bis Marktvalidierung").
- **Widerrufsbelehrung:** EU-Verbraucherrecht verlangt bei digitalen Abo-Inhalten ein 14-tägiges Widerrufsrecht bzw. einen expliziten Verzichts-Checkbox-Flow beim Checkout — erst relevant sobald bezahlt wird.
- **Datenschutz-Ergänzung für Zahlungsanbieter** (z.B. Stripe/PayPal), sobald einer für die Paywall integriert wird — neuer Auftragsverarbeiter-Eintrag nötig.
- **BFSG (Barrierefreiheitsstärkungsgesetz),** seit 28.06.2025 in Kraft: digitale Dienstleistungen im elektronischen Geschäftsverkehr mit Verbrauchern sind grundsätzlich betroffen. Kleinstunternehmen-Ausnahme (< 10 Beschäftigte, ≤ 2 Mio. € Umsatz/Bilanzsumme) greift für **Dienstleistungen**, aber nicht zwingend für als "Produkt" eingestufte Software — die Einordnung einer Abo-App ist nicht auf den ersten Blick eindeutig und sollte zum Zeitpunkt des Paywall-Starts geprüft werden. TRAIN steht hier schon gut da (Lighthouse Accessibility 100, siehe CLAUDE.md). ([activemind.legal](https://www.activemind.legal/de/guides/bfsg/), [haendlerbund.de](https://ohn.haendlerbund.de/recht/rechtsfragen/kleinstunternehmen-bfsg-ausnahme))
- **Google Play "Data Safety"-Formular / Apple Privacy-Nutrition-Label:** auch ein "wir erheben nichts"-Angebot muss das Formular ausfüllen (keine automatische Befreiung) — erst relevant beim geplanten App-Store-Schritt (CLAUDE.md: "App Store nach ersten Nutzer-Signalen"). `datenschutz.html` (train-v178) deckt die "eigenständig aufrufbare URL"-Anforderung dafür bereits ab.

## Geprüft und für unbedenklich befunden (kein Handlungsbedarf)

- **`dragdrop.js`-Lizenz:** MIT-lizenziert (mobile-drag-drop 2.3.0-rc.1, Tim Ruffles), Copyright-Hinweis bereits im Dateikopf eingebettet (`/*! ... MIT License */`) — MIT verlangt Mitlieferung des Hinweises, das ist erfüllt. Anders als bei den Fonts (BUGS.md B58), wo der Lizenztext separat fehlt.
