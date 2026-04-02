/**
 * E2E: ny granskning, metadata, stickprov och kravlista med mockade API-anrop.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const E2E_RULE_ID = 'e2e-rule-flow-1';

const E2E_RULE_CONTENT_OBJECT = JSON.parse(
    readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
);
E2E_RULE_CONTENT_OBJECT.metadata.samples.sampleCategories = [
    {
        id: 'cat1',
        text: 'Kategori',
        categories: [{ id: 'stype1', text: 'Webbsida' }]
    }
];

const RULE_ROW = {
    id: E2E_RULE_ID,
    name: 'E2E-regel',
    is_published: true,
    list_as_arbetskopia: false,
    metadata_version: '1.0',
    monitoring_type_text: 'E2E-typ',
    version_display: '1.0',
    version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
};

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

async function setupAuditFlowApiMocks(page) {
    await page.route('**/v2/api/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        if (url.includes('/health')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        if (url.includes('/auth/login') && method === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-audit-flow-jwt' })
            });
        }
        if (url.includes('/auth/refresh') && method === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-audit-flow-jwt' })
            });
        }
        if (url.includes('/users/me')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'E2E-användare',
                    is_admin: true,
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
        if (url.includes(`/rules/${E2E_RULE_ID}`) && method === 'GET' && !url.includes('/version')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    ...RULE_ROW,
                    published_content: JSON.stringify(E2E_RULE_CONTENT_OBJECT),
                    content: JSON.stringify(E2E_RULE_CONTENT_OBJECT)
                })
            });
        }
        if (url.includes('/rules') && method === 'GET' && !url.match(/\/rules\/[^/]+/)) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([RULE_ROW])
            });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

test.describe('Granskningsflöde (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test.beforeEach(async ({ context }) => {
        await context.clearCookies();
    });

    test('ny granskning → metadata → stickprov → kravlista', async ({ page }) => {
        test.setTimeout(120000);
        await page.addInitScript(() => {
            try {
                sessionStorage.clear();
            } catch {
                /* ignorerar */
            }
        });
        await setupAuditFlowApiMocks(page);

        await page.goto('/');
        await ensureSwedishAndDismissRestore(page);

        await page.locator('#login-user-input').fill('admin');
        await page.locator('#login-password-input').fill('secret');
        await page.getByRole('button', { name: 'Logga in', exact: true }).click();

        await expect(page.getByRole('heading', { name: 'Hantera granskningar' })).toBeVisible();

        await page.goto('/v2/#audit');
        await ensureSwedishAndDismissRestore(page);

        await page.waitForSelector('button.audit-start-new-audit-btn', { timeout: 25000 });
        await page.locator('button.audit-start-new-audit-btn').first().click();
        await page.locator('.audit-rules-picker-list button').first().click();
        await expect(page.getByRole('heading', { name: 'Granskningens metadata' })).toBeVisible({ timeout: 20000 });

        await page.locator('#caseNumber').fill('E2E-123');
        await page.locator('#actorName').fill('Testaktör');
        await page.locator('#auditorName').fill('Testgranskare');

        await page.locator('#metadata-form-container-in-view form button[type="submit"]').click();

        await expect(page.getByRole('heading', { name: /Stickprov/ })).toBeVisible();

        await page.getByRole('button', { name: 'Lägg till nytt stickprov' }).click();

        await page.locator('#sampleTypeSelect').waitFor({ state: 'visible', timeout: 15000 });
        await page.locator('#sampleTypeSelect').selectOption('stype1');
        await page.locator('#sampleDescriptionInput').fill('E2E stickprov');

        const plain_cb = page.locator('#ct-child-plain');
        await plain_cb.click();

        await page.getByRole('button', { name: 'Spara stickprovet' }).click();

        await expect(page.getByText('E2E stickprov')).toBeVisible();

        await page.getByRole('button', { name: 'Starta granskning' }).click();

        await page.goto('/v2/#all_requirements');
        await ensureSwedishAndDismissRestore(page);

        await expect(page.getByRole('heading', { name: /^Krav/ })).toBeVisible({ timeout: 20000 });
    });
});
