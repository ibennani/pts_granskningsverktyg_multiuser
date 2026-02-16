import { test, expect } from '@playwright/test';

test.describe('Startsida', () => {
  test('visar rubrik och aktuella ärenden', async ({ page }) => {
    await page.goto('/');

    // Force language to Swedish to ensure consistent test results
    await page.evaluate(() => {
      if (window.Translation && window.Translation.set_language) {
        return window.Translation.set_language('sv-SE');
      }
    });

    // Hantera eventuell "Återställ session"-dialog
    const restoreDialogYesButton = page.getByRole('button', { name: 'Ja, fortsätt där jag slutade' });
    try {
        await restoreDialogYesButton.waitFor({ state: 'visible', timeout: 2000 });
        await page.getByRole('button', { name: 'Nej, börja om från början' }).click();
    } catch (e) {
        // Dialogen fanns inte, vi fortsätter
    }

    const h1 = page.locator('h1#main-content-heading');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Granskningsverktyget');

    const auditsHeading = page.getByRole('heading', { name: 'Aktuella ärenden' });
    await expect(auditsHeading).toBeVisible();
  });

  test('har länkar till Start och Admin i menyn', async ({ page }) => {
    await page.goto('/');

    await page.evaluate(() => {
      if (window.Translation && window.Translation.set_language) {
        return window.Translation.set_language('sv-SE');
      }
    });

    const restoreDialogYesButton = page.getByRole('button', { name: 'Ja, fortsätt där jag slutade' });
    try {
        await restoreDialogYesButton.waitFor({ state: 'visible', timeout: 2000 });
        await page.getByRole('button', { name: 'Nej, börja om från början' }).click();
    } catch (e) {
        // Ignorera
    }

    // Öppna sidomenyn
    const menuButton = page.getByRole('button', { name: /meny|menu/i });
    if (await menuButton.isVisible()) {
      await menuButton.click();
      await expect(page.getByRole('link', { name: 'Start' })).toBeVisible();
      await expect(page.getByRole('link', { name: /Regelfiler|Granskningar/i })).toBeVisible();
    }
  });
});

test.describe('Admin - Starta ny granskning', () => {
  test('visar knappen Starta ny granskning i admin-vyn', async ({ page }) => {
    await page.goto('/#admin');

    await page.evaluate(() => {
      if (window.Translation && window.Translation.set_language) {
        return window.Translation.set_language('sv-SE');
      }
    });

    // Vänta på att admin-vyn laddas (kan visa loading först)
    await page.waitForSelector('h2#admin-audits-heading, .admin-loading', { timeout: 5000 });

    const startNewAuditButton = page.getByRole('button', { name: 'Starta ny granskning' });
    await expect(startNewAuditButton).toBeVisible({ timeout: 10000 });
  });
});
