# TRAIN — MAINTENANCE.md
*Housekeeping notes that don't fit BUGS.md/DECISIONS.md/LEGAL.md. Currently: license/branding sync.*
*Stand: 2026-08-01*

---

## License — copyright holder name is tied to the app's public name

`LICENSE` (repo root) reads `Copyright (c) 2026 TRAIN. All rights reserved.` —
an all-rights-reserved proprietary notice (deliberately not an open-source
license; see LEGAL.md for the separate Impressum/DSGVO track, which concerns
the operator's legal identity, not the copyright holder name).

**"TRAIN" in `LICENSE` is the app's public/brand name, not a fixed legal
entity.** If the app is ever renamed, `LICENSE` and every other place the
name appears as branding/metadata must be updated **together, in the same
commit** — otherwise the license notice silently goes stale and no longer
matches the shipped product.

### Checklist — update all of these together on rename

- [ ] `LICENSE` — `Copyright (c) 2026 TRAIN. All rights reserved.`
- [ ] `package.json` — `"name": "train"`
- [ ] `manifest.json` — `"name": "TRAIN – Workout Tracker"`, `"short_name": "TRAIN"`
- [ ] `index.html` — `<title>TRAIN</title>` (line 26), `<meta name="apple-mobile-web-app-title" content="TRAIN">` (line 9)
- [ ] `datenschutz.html` — `<title>Datenschutzerklärung — TRAIN</title>` (line 7), meta `description` mentioning "TRAIN Kraftsport-App" (line 8), subtitle `"TRAIN — Krafttraining-App · Stand: ..."` (line 77)
- [ ] `README.md` — H1 title `# TRAIN` (line 1)
- [ ] `ui.js` — in-app nav logo/home button, `>TRAIN<` (line 8218); onboarding logo, `<div class="ob-logo">TRAIN</div>` (line 9310); Settings version-label text, `` `TRAIN ${event.data.version}` `` (line 8491)
- [ ] `sw.js` — `CACHE_VERSION = 'train-v224'` (line 19) — the `train-` prefix is itself branding, visible in DevTools → Application → Cache Storage
- [ ] `backup.js` — user-facing export filenames, `` `TRAIN_Backup_${startDate}.json` `` (line 67) and `` `TRAIN_Export_${tag}_${today()}.csv` `` (line 324)
- [ ] `shareImage.js` — "TRAIN" watermark drawn on the shared PR/week-recap PNG canvases (lines 62, 130, 190)

**Scope note:** this list covers canonical branding/metadata *declarations* —
places a rename must touch for the product to be internally consistent. It
does not enumerate every prose mention of "TRAIN" in comments, `BUGS.md`,
`DECISIONS.md`, or `datenschutz.html` body text — those are historical
records or ordinary references by name, not live branding, and don't need
to change on a rename.

**Not in scope for this checklist (separate concerns):** the GitHub repo
name/URL (`777random/TRAIN`) and the Impressum operator name in `ui.js`
(§5 DDG "Verantwortlicher" — a natural person's legal name, currently a
placeholder pending B55, see `LEGAL.md`/`BUGS.md`) are independent of the
app's brand name and are not license-holder concerns.
