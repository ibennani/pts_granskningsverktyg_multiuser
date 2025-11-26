import { test, expect } from '@playwright/test';

test.describe('Startsida', () => {
  test('visar knappar i rätt ordning med infotexter', async ({ page }) => {
    await page.goto('/');

    // Force language to Swedish to ensure consistent test results regardless of browser defaults
    await page.evaluate(() => {
      if (window.Translation && window.Translation.set_language) {
        return window.Translation.set_language('sv-SE');
      }
    });

    // Vänta på att innehållet laddas
    const loadButton = page.locator('#load-ongoing-audit-btn');
    const startButton = page.locator('#start-new-audit-btn');
    const editButton = page.locator('#edit-rulefile-btn');

    await expect(loadButton).toBeVisible();
    await expect(startButton).toBeVisible();
    await expect(editButton).toBeVisible();

    // Kontrollera texter med regex för att undvika encoding-problem om de kvarstår, men vi försöker med exakt text först
    await expect(loadButton).toContainText('Ladda upp pågående granskning');
    await expect(startButton).toContainText('Starta ny granskning');
    await expect(editButton).toContainText('Redigera regelfil');

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
    
    // Se till att första knappen är synlig innan vi börjar tabba
    const firstButton = page.locator('#load-ongoing-audit-btn');
    await expect(firstButton).toBeVisible();

    // Tvinga fokus till body först för att nollställa tabb-ordningen
    await page.locator('body').focus();
    
    // Beroende på webbläsare kan första tabben gå till adressfältet eller första elementet.
    // Vi klickar på body för att vara säkra på att vi är i dokumentet, men det sätter inte alltid fokus rätt för "nästa tabb".
    
    // Enklast är att manuellt fokusera det element som ligger precis INNAN knapparna, 
    // eller helt enkelt fokusera den första knappen och testa relationen därifrån.
    
    // Alternativ 1: Fokusera första knappen manuellt och tabba vidare
    await firstButton.focus();
    await expect(firstButton).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#start-new-audit-btn')).toBeFocused();

    await page.keyboard.press('Tab');
    await expect(page.locator('#edit-rulefile-btn')).toBeFocused();
  });
});
