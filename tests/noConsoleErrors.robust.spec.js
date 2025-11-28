// tests/noConsoleErrors.robust.spec.js
import { test, expect } from '@playwright/test';

// Mönster för dev-brus du ev. vill ignorera
const IGNORE = [
  'Failed to load source map',         // vanligt vid dev
  'favicon.ico',                       // 404 för favicon
  'Failed to load resource',           // Generella laddningsfel (t.ex. favicon)
  'ResizeObserver loop limit exceeded' // vissa UI-bibliotek
];

function shouldIgnore(text) {
  return IGNORE.some(p => text.includes(p));
}

test('no console errors after page is fully ready', async ({ page }) => {
  const errors = [];

  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (!shouldIgnore(text)) errors.push(text);
  });

  // 1) Gå till startsidan
  await page.goto('/');

  // 2) Vänta tills sidan faktiskt är redo
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle'); // inga pending requests

  // 3) Ge eventuella sena fel chans att dyka upp
  await page.waitForTimeout(300);

  // 4) Inga fel tillåtna
  expect(errors).toEqual([]);
});
