import { test, expect } from '@playwright/test';

async function ensureLoggedIn(page) {
  await page.evaluate(() => {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('gv_current_user_name', 'e2e-test-user');
    }
    if (typeof window !== 'undefined') {
      window.__GV_CURRENT_USER_NAME__ = 'e2e-test-user';
    }
  });
}

test.describe('Startsida', () => {
  test('visar rubrik och aktuella ärenden', async ({ page }) => {
    await page.goto('/');
    await ensureLoggedIn(page);
    await page.goto('/#start');

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

    const h1 = page.locator('h1');
    await expect(h1).toBeVisible();
    await expect(h1).toContainText('Hantera granskningar');

    const auditsHeading = page.getByRole('heading', { name: /Pågående granskningar: \d+ st/ });
    await expect(auditsHeading).toBeVisible();
  });

  test('har länkar till Start och Admin i menyn', async ({ page }) => {
    await page.goto('/');
    await ensureLoggedIn(page);
    await page.goto('/#start');

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
    await page.goto('/');
    await ensureLoggedIn(page);
    await page.goto('/#audit');

    await page.evaluate(() => {
      if (window.Translation && window.Translation.set_language) {
        return window.Translation.set_language('sv-SE');
      }
    });

    // Vänta på att vyn laddas (kan visa loading först)
    await page.waitForSelector('button.audit-start-new-audit-btn, p.audit-loading', { timeout: 10000 });

    const startNewAuditButton = page.getByRole('button', { name: 'Starta ny granskning' });
    await expect(startNewAuditButton).toBeVisible({ timeout: 10000 });
  });
});
