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

        // Aktivera skiplänken (evaluate klick för att undvika krav på viewport – skiplänken kan vara visuellt utanför skärmen)
        await skipLink.evaluate((el) => el.click());

        // Huvudrubrik ska finnas och få fokus
        const mainHeading = page.locator('h1#main-content-heading');
        await expect(mainHeading).toBeVisible();
        await expect(mainHeading).toBeFocused();

        // Säkerställ att det bara finns en h1 på sidan (viktig strukturregel)
        const allH1s = page.locator('h1');
        await expect(allH1s).toHaveCount(1);
    });

    test('skiplänken nås med tangentbord (Tab) och sätter fokus på h1 vid Enter', async ({ page, browserName }) => {
        // WebKit har ibland annan tab-ordning; testet körs i Chromium (och Edge)
        if (browserName === 'webkit') {
            test.skip();
        }

        await page.goto('/');

        await page.evaluate(() => {
            if (window.Translation && window.Translation.set_language) {
                return window.Translation.set_language('sv-SE');
            }
        });

        const restoreNo = page.getByRole('button', { name: 'Nej, börja om från början' });
        try {
            await restoreNo.waitFor({ state: 'visible', timeout: 2000 });
            await restoreNo.click();
        } catch {
            // Ingen dialog
        }

        const skipLink = page.getByRole('link', { name: 'Hoppa till innehållet' });
        await expect(skipLink).toBeVisible();

        await page.keyboard.press('Tab');
        const maxTabs = 40;
        for (let i = 0; i < maxTabs; i++) {
            const isSkipFocused = await skipLink.evaluate((el) => document.activeElement === el);
            if (isSkipFocused) break;
            await page.keyboard.press('Tab');
        }

        await expect(skipLink).toBeFocused();
        await page.keyboard.press('Enter');

        const mainHeading = page.locator('h1#main-content-heading');
        await expect(mainHeading).toBeVisible();
        await expect(mainHeading).toBeFocused();
    });
});

