import { test, expect } from '@playwright/test';

// regression_core.html schreibt sein Ergebnis als Klartext in
// <pre id="result">, NICHT als einzelne DOM-Elemente mit .pass/.fail-
// Klassen — siehe Kopfkommentar der Datei ("Ergebnis steht im
// <pre id="result"> im gedumpten DOM"). Playwright fährt hier einen
// echten Chromium-Tab (kein --dump-dom-Snapshot), rAF feuert also
// normal — bewusst OHNE ?raf=sync aufgerufen, das ist laut Datei der
// korrekte Default für eine echte Browser-Sitzung.
test('regression_core.html: 10/10 grün, 0 uncaught errors', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  await page.goto('/tests/regression_core.html');

  await page.waitForFunction(() => {
    const el = document.getElementById('result');
    return !!el && el.textContent.includes('ERGEBNIS:');
  }, { timeout: 15000 });

  const resultText = await page.locator('#result').textContent();

  expect(resultText, resultText ?? '').toContain('bestanden');
  expect(resultText, resultText ?? '').not.toContain('fehlgeschlagen');
  expect(resultText, resultText ?? '').toContain('Gesamt uncaught errors während des Laufs: 0');
  expect(pageErrors, pageErrors.join('; ')).toHaveLength(0);
});
