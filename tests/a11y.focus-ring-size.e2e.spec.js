import { test, expect } from '@playwright/test';

const THEMES = ['light', 'dark', 'winter-white', 'dark-experimental'];

async function prepare_login_page(page) {
    await page.goto('/');

    await page.evaluate(() => {
        if (window.Translation?.set_language) {
            return window.Translation.set_language('sv-SE');
        }
    });

    const login_button = page.getByRole('button', { name: 'Logga in', exact: true });
    await expect(login_button).toBeVisible({ timeout: 15000 });
    return login_button;
}

async function measure_button_box(page, selector) {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) {
            return null;
        }
        return {
            offsetWidth: el.offsetWidth,
            offsetHeight: el.offsetHeight,
            clientWidth: el.clientWidth,
            clientHeight: el.clientHeight,
        };
    }, selector);
}

test.describe('Fokusring utan layoutskift', () => {
    for (const theme of THEMES) {
        test(`knappstorlek oförändrad vid fokus (${theme})`, async ({ page }) => {
            const button = await prepare_login_page(page);

            await page.evaluate((theme_name) => {
                document.documentElement.setAttribute('data-theme', theme_name);
            }, theme);

            const selector = await button.evaluate((el) => {
                if (!el.id) {
                    el.setAttribute('data-focus-ring-test', '1');
                }
                return el.id ? `#${CSS.escape(el.id)}` : '[data-focus-ring-test="1"]';
            });

            const before = await measure_button_box(page, selector);
            expect(before).not.toBeNull();

            await button.focus();
            await expect(button).toBeFocused();

            const after = await measure_button_box(page, selector);
            expect(after).not.toBeNull();

            expect(after.offsetWidth).toBe(before.offsetWidth);
            expect(after.offsetHeight).toBe(before.offsetHeight);
            expect(after.clientWidth).toBe(before.clientWidth);
            expect(after.clientHeight).toBe(before.clientHeight);
        });
    }
});
