import { test, expect } from '@playwright/test';

test.describe('Startsida', () => {
  test('visar knappar i rätt ordning med infotexter', async ({ page }) => {
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
        // Kort timeout - om den inte dyker upp snabbt antar vi att den inte finns
        await restoreDialogYesButton.waitFor({ state: 'visible', timeout: 2000 });
        // Om vi hittar den, klicka på NEJ för att komma till startsidan
        await page.getByRole('button', { name: 'Nej, börja om från början' }).click();
    } catch (e) {
        // Dialogen fanns inte (eller dök inte upp i tid), vi fortsätter
    }

    const loadButton = page.locator('#load-ongoing-audit-btn');
    const startButton = page.locator('#start-new-audit-btn');
    const editButton = page.locator('#edit-rulefile-btn');

    await expect(loadButton).toBeVisible();
    await expect(startButton).toBeVisible();
    await expect(editButton).toBeVisible();

    // Kontrollera texter
    await expect(loadButton).toContainText('Ladda upp pågående granskning');
    await expect(startButton).toContainText('Starta ny granskning');
    await expect(editButton).toContainText('Redigera regelfil');

    const orderedButtons = await page.locator('.upload-action-block button').all();
    const orderedIds = await Promise.all(orderedButtons.map(b => b.getAttribute('id')));
    
    expect(orderedIds).toEqual([
      'load-ongoing-audit-btn',
      'start-new-audit-btn',
      'edit-rulefile-btn'
    ]);

    const loadDescId = await loadButton.getAttribute('aria-describedby');
    const startDescId = await startButton.getAttribute('aria-describedby');
    const editDescId = await editButton.getAttribute('aria-describedby');

    await expect(page.locator(`#${loadDescId}`)).toContainText('Återuppta en tidigare granskning');
    await expect(page.locator(`#${startDescId}`)).toContainText('Börja en ny tillgänglighetsgranskning');
    await expect(page.locator(`#${editDescId}`)).toContainText('Gör ändringar i en befintlig regelfil');
  });

  test('respekterar tabb-ordning mellan knapparna', async ({ page }) => {
    await page.goto('/');
    
    // Hantera restore dialog här också för säkerhets skull
    const restoreDialogYesButton = page.getByRole('button', { name: 'Ja, fortsätt där jag slutade' });
    try {
        await restoreDialogYesButton.waitFor({ state: 'visible', timeout: 2000 });
        await page.getByRole('button', { name: 'Nej, börja om från början' }).click();
    } catch (e) {
        // Ignore
    }

    const loadButton = page.locator('#load-ongoing-audit-btn');
    await expect(loadButton).toBeVisible();

    await loadButton.focus();
    await expect(loadButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#start-new-audit-btn')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#edit-rulefile-btn')).toBeFocused();
  });
});
