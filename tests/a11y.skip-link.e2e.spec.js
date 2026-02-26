import { test, expect } from '@playwright/test';

test.describe('WCAG – skiplänk och huvudrubrik', () => {
    test('skiplänken hoppar till huvudinnehållet och sätter fokus på h1', async ({ page }) => {
        await page.goto('/');

        // Säkerställ svenska texter för stabila selektorer
        await page.evaluate(() => {
            if (window.Translation && window.Translation.set_language) {
                return window.Translation.set_language('sv-SE');
            }
        });

        // Hitta skiplänken
        const skipLink = page.getByRole('link', { name: 'Hoppa till innehållet' });
        await expect(skipLink).toBeVisible();

        // Aktivera skiplänken (tangentbord eller klick spelar ingen roll i testet)
        await skipLink.click();

        // Huvudrubrik ska finnas och få fokus
        const mainHeading = page.locator('h1#main-content-heading');
        await expect(mainHeading).toBeVisible();
        await expect(mainHeading).toBeFocused();

        // Säkerställ att det bara finns en h1 på sidan (viktig strukturregel)
        const allH1s = page.locator('h1');
        await expect(allH1s).toHaveCount(1);
    });
});

