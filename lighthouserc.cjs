module.exports = {
  ci: {
    collect: {
      // startServerCommand statt eines separaten, manuell im Hintergrund
      // gestarteten CI-Steps: LHCI startet den Server selbst und wartet auf
      // Erreichbarkeit der URL, bevor es Audits fährt — ein `serve . -p 8080 &`
      // als eigener Step gibt keine Garantie, dass der Server beim nächsten
      // Step schon bereit ist (gleiche Klasse Race Condition wie beim
      // Playwright-CI-Setup, siehe BUGS.md B28 — dort mit webServer im
      // playwright.config.js gelöst, hier analog mit startServerCommand).
      startServerCommand: 'npx serve . -p 8080',
      url: ['http://localhost:8080'],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        // KEINE 'categories:pwa'-Assertion: diese Lighthouse-Version (siehe
        // package.json) hat keine eigene PWA-Kategorie mehr (seit Lighthouse
        // v9 aus den Default-Kategorien entfernt) — lokal getestet, die
        // Assertion würde IMMER mit "auditRan: 0" warnen, unabhängig von der
        // tatsächlichen PWA-Qualität der App (Manifest/SW/Icons). Reines
        // Rauschen, kein echtes Signal — bewusst weggelassen statt eine
        // Assertion zu behalten, die strukturell nie etwas Sinnvolles misst.
        // Performance
        'categories:performance': ['warn', { minScore: 0.7 }],
        // Accessibility
        'categories:accessibility': ['error', { minScore: 0.8 }],
        // Best Practices
        'categories:best-practices': ['warn', { minScore: 0.8 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
