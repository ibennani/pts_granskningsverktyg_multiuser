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

test.describe('Offline-indikering', () => {
    test('visar meddelande när webbläsaren går offline', async ({ page, context }) => {
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
        } catch {
            /* ingen dialog */
        }

        await context.setOffline(true);

        const area = page.locator('#global-message-area');
        await expect(area).toBeVisible();
        await expect(area).toContainText(/Ingen uppkoppling/i);

        await context.setOffline(false);
    });
});
