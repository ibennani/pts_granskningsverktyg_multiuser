import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const minimalRulefilePath = path.resolve(__dirname, 'fixtures', 'minimal-rulefile.json');
const invalidFilePath = path.resolve(__dirname, 'fixtures', 'invalid.txt');

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
        // Ingen dialog
    }
}

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

test.describe('Admin – uppladdning av fil', () => {
    test('accepterar giltig regelfil och visar lyckomeddelande', async ({ page }) => {
        await page.goto('/');
        await ensureLoggedIn(page);
        await page.goto('/#audit_rules');

        await ensureSwedishAndDismissRestore(page);

        let rulesReturned = [];
        await page.route('**/v2/api/health**', (route) =>
            route.fulfill({ status: 200, body: '{}' })
        );
        await page.route('**/v2/api/rules**', (route) => {
            if (route.request().method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(rulesReturned),
                });
            }
            return route.continue();
        });
        await page.route('**/v2/api/rules/import**', async (route) => {
            if (route.request().method() === 'POST') {
                const body = route.request().postDataJSON();
                rulesReturned = [{ id: 'e2e-rule-1', name: body?.name || 'Importerad regelfil', updated_at: new Date().toISOString() }];
                return route.fulfill({
                    status: 201,
                    contentType: 'application/json',
                    body: JSON.stringify({ id: 'e2e-rule-1', name: body?.name || 'Importerad regelfil' }),
                });
            }
            return route.continue();
        });
        await page.route('**/v2/api/audits**', (route) => {
            if (route.request().method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify([])
                });
            }
            return route.continue();
        });

        await page.waitForSelector('h2#audit-rules-heading', { timeout: 10000 });
        const uploadBtn = page.locator('button.audit-upload-btn');
        await expect(uploadBtn).toBeVisible({ timeout: 10000 });

        const fileInput = page.locator('input[type="file"].audit-hidden-file-input');
        await fileInput.setInputFiles(minimalRulefilePath);

        await expect(page.getByText('Regelfilen har laddats upp.')).toBeVisible({ timeout: 5000 });
    });

    test('visar felmeddelande vid ogiltig fil', async ({ page }) => {
        await page.goto('/');
        await ensureLoggedIn(page);
        await page.goto('/#audit_rules');

        await ensureSwedishAndDismissRestore(page);

        await page.route('**/v2/api/health**', (route) =>
            route.fulfill({ status: 200, body: '{}' })
        );
        await page.route('**/v2/api/rules**', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        );
        await page.route('**/v2/api/audits**', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        );

        await page.waitForSelector('h2#audit-rules-heading', { timeout: 10000 });
        const uploadBtn = page.locator('button.audit-upload-btn');
        await expect(uploadBtn).toBeVisible({ timeout: 10000 });

        const fileInput = page.locator('input[type="file"].audit-hidden-file-input');
        await fileInput.setInputFiles(invalidFilePath);

        await expect(page.getByText(/Filen är varken en giltig regelfil eller granskning|not valid JSON/i)).toBeVisible({ timeout: 5000 });
    });

    test('visar publicera-knapp när utkast finns', async ({ page }) => {
        await page.goto('/');
        await ensureLoggedIn(page);
        await page.goto('/#audit_rules');

        await ensureSwedishAndDismissRestore(page);

        const rules = [
            {
                id: 'e2e-rule-1',
                name: 'E2E-regelfil med utkast',
                version_display: '1.0',
                metadata_version: '1.0',
                monitoring_type_text: 'Testtyp',
                has_draft: true,
                draft_version: '1.1',
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];

        await page.route('**/v2/api/health**', (route) =>
            route.fulfill({ status: 200, body: '{}' })
        );

        await page.route('**/v2/api/rules**', (route) => {
            if (route.request().method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(rules)
                });
            }
            return route.continue();
        });
        await page.route('**/v2/api/audits**', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        );

        await page.waitForSelector('h2#audit-rules-heading', { timeout: 10000 });

        const publishBtn = page.locator('button.generic-table-publish-btn').first();
        await expect(publishBtn).toBeVisible({ timeout: 10000 });
    });

    test('kan publicera regelfil', async ({ page }) => {
        await page.goto('/');
        await ensureLoggedIn(page);
        await page.goto('/#audit_rules');

        await ensureSwedishAndDismissRestore(page);

        const rules = [
            {
                id: 'e2e-rule-1',
                name: 'E2E-regelfil med utkast',
                version_display: '1.0',
                metadata_version: '1.0',
                monitoring_type_text: 'Testtyp',
                has_draft: true,
                draft_version: '1.1',
                version: 1,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        ];

        await page.route('**/v2/api/health**', (route) =>
            route.fulfill({ status: 200, body: '{}' })
        );

        await page.route('**/v2/api/rules**', (route) => {
            if (route.request().method() === 'GET') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify(rules)
                });
            }
            return route.continue();
        });
        await page.route('**/v2/api/audits**', (route) =>
            route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        );

        await page.route('**/v2/api/rules/e2e-rule-1/publish', (route) => {
            if (route.request().method() === 'POST') {
                return route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ ...rules[0], has_draft: false, draft_version: null })
                });
            }
            return route.continue();
        });

        await page.waitForSelector('h2#audit-rules-heading', { timeout: 10000 });

        const publishBtn = page.locator('button.generic-table-publish-btn').first();
        await expect(publishBtn).toBeVisible({ timeout: 10000 });

        await publishBtn.click();

        await expect(
            page.getByText('Regelfilen har publicerats. Nya granskningar använder nu den uppdaterade versionen.')
        ).toBeVisible({ timeout: 5000 });
    });
});
