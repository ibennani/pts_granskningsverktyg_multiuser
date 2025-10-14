import { test, expect } from '@playwright/test';

test.describe('Startsida', () => {
  test('visar knappar i rätt ordning med infotexter', async ({ page }) => {
    await page.goto('/');

    const loadButton = page.getByRole('button', {
      name: 'Ladda upp pågående granskning',
    });
    const startButton = page.getByRole('button', {
      name: 'Starta ny granskning',
    });
    const editButton = page.getByRole('button', { name: 'Redigera regelfil' });

    await expect(loadButton).toBeVisible();
    await expect(startButton).toBeVisible();
    await expect(editButton).toBeVisible();

    const orderedButtons = await page
      .locator('.upload-action-block button')
      .all();
    const orderedIds = await Promise.all(
      orderedButtons.map((button) => button.getAttribute('id'))
    );
    expect(orderedIds).toEqual([
      'load-ongoing-audit-btn',
      'start-new-audit-btn',
      'edit-rulefile-btn',
    ]);

    const loadDescriptionId = await loadButton.getAttribute('aria-describedby');
    const startDescriptionId =
      await startButton.getAttribute('aria-describedby');
    const editDescriptionId = await editButton.getAttribute('aria-describedby');

    await expect(page.locator(`#${loadDescriptionId}`)).toHaveText(
      'Återuppta en tidigare granskning genom att ladda upp den sparade filen.'
    );
    await expect(page.locator(`#${startDescriptionId}`)).toHaveText(
      'Börja en ny tillgänglighetsgranskning från början genom att ladda upp en regelfil.'
    );
    await expect(page.locator(`#${editDescriptionId}`)).toHaveText(
      'Gör ändringar i en befintlig regelfil eller skapa en ny version.'
    );
  });

  test('respekterar tabb-ordning mellan knapparna', async ({ page }) => {
    await page.goto('/');

    await page.keyboard.press('Tab');
    await expect(page.locator('#load-ongoing-audit-btn')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#start-new-audit-btn')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#edit-rulefile-btn')).toBeFocused();
  });
});
