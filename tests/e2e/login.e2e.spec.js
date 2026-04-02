/**
 * E2E: inloggning, utloggning och skyddade rutter med mockade API-anrop.
 */
import { test, expect } from '@playwright/test';

async function ensureSwedishAndDismissRestore(page) {
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
        /* ingen dialog */
    }
}

/**
 * Mockar API: hälsa, inloggning, användarprofil och generiska svar.
 */
async function setupLoginApiMocks(page) {
    await page.route('**/v2/api/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        if (url.includes('/health')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        if (url.includes('/auth/login') && method === 'POST') {
            let body = {};
            try {
                body = route.request().postDataJSON();
            } catch {
                body = {};
            }
            if (body.password === 'wrong-password') {
                return route.fulfill({
                    status: 401,
                    contentType: 'application/json',
                    body: JSON.stringify({ error: 'Fel användarnamn eller lösenord' })
                });
            }
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-fake-jwt-token' })
            });
        }
        if (url.includes('/users/me')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'E2E-användare',
                    is_admin: false,
                    language_preference: 'sv-SE'
                })
            });
        }
        if (url.includes('/auth/admin-contacts')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (url.includes('/audits') && method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (url.includes('/rules') && method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

test.describe('Inloggning (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 720 } });

    test.beforeEach(async ({ context }) => {
        await context.clearCookies();
    });

    test('lyckad inloggning leder till startsidan', async ({ page }) => {
        await page.addInitScript(() => {
            try {
                sessionStorage.clear();
            } catch {
                /* ignorerar */
            }
        });
        await setupLoginApiMocks(page);
        await page.goto('/');
        await ensureSwedishAndDismissRestore(page);

        await page.locator('#login-user-input').fill('testuser');
        await page.locator('#login-password-input').fill('secret123');
        await page.getByRole('button', { name: 'Logga in', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'Hantera granskningar' })).toBeVisible();
    });

    test('felaktiga uppgifter visar felmeddelande', async ({ page }) => {
        await page.addInitScript(() => {
            try {
                sessionStorage.clear();
            } catch {
                /* ignorerar */
            }
        });
        await setupLoginApiMocks(page);
        await page.goto('/');
        await ensureSwedishAndDismissRestore(page);

        await page.locator('#login-user-input').fill('testuser');
        await page.locator('#login-password-input').fill('wrong-password');
        await page.getByRole('button', { name: 'Logga in', exact: true }).click();

        await expect(page.locator('#login-inline-error')).toContainText(/Fel|lösenord|inloggning/i);
    });

    test('utloggning visar inloggningssidan', async ({ page }) => {
        await page.addInitScript(() => {
            try {
                sessionStorage.clear();
            } catch {
                /* ignorerar */
            }
        });
        await setupLoginApiMocks(page);
        await page.goto('/');
        await ensureSwedishAndDismissRestore(page);

        await page.locator('#login-user-input').fill('testuser');
        await page.locator('#login-password-input').fill('secret123');
        await page.getByRole('button', { name: 'Logga in', exact: true }).click();
        await expect(page.getByRole('heading', { name: 'Hantera granskningar' })).toBeVisible();
        await ensureSwedishAndDismissRestore(page);

        const logout_link = page.locator('nav#side-menu-nav a').filter({ hasText: /^Logga ut$/ });
        await logout_link.waitFor({ state: 'attached', timeout: 15000 });
        await logout_link.click({ force: true });

        await expect(page.getByRole('heading', { name: 'Logga in', level: 2 })).toBeVisible();
    });

    test('skyddad vy utan token visar inloggning', async ({ page }) => {
        await page.addInitScript(() => {
            try {
                sessionStorage.clear();
            } catch {
                /* ignorerar */
            }
        });
        await setupLoginApiMocks(page);
        await page.goto('/#manage_users');
        await ensureSwedishAndDismissRestore(page);

        await expect(page.getByRole('heading', { name: 'Logga in', level: 2 })).toBeVisible();
    });
});
