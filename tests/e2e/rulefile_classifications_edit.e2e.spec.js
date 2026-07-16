/**
 * E2E: Klassificeringar redigeringsläge renderar huvudinnehåll.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { initial_state } from '../../js/state/initialState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture_rule = JSON.parse(
    readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
);

async function ensureSwedishAndDismissRestore(page) {
    await page.evaluate(() => {
        if (window.Translation?.set_language) return window.Translation.set_language('sv-SE');
    });
    const restore_no = page.getByRole('button', { name: 'Nej, börja om från början' });
    try {
        await restore_no.waitFor({ state: 'visible', timeout: 2000 });
        await restore_no.click();
    } catch {
        /* ingen dialog */
    }
}

async function setupApiMocks(page) {
    await page.route('**/v2/api/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        if (url.includes('/health')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        if (url.includes('/users/me')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ name: 'E2E', is_admin: true, language_preference: 'sv-SE' }),
            });
        }
        if (url.includes('/auth/refresh') && method === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-cls-jwt' }),
            });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

function buildRulefileState() {
    const rule = JSON.parse(JSON.stringify(fixture_rule));
    rule.metadata.taxonomies = [
        {
            id: 'wcag22-pour',
            label: 'WCAG 2.2 POUR',
            version: '1.0',
            uri: '',
            concepts: [
                { id: 'perceivable', label: 'Möjligt att uppfatta' },
                { id: 'operable', label: 'Hanterbart' },
            ],
        },
    ];
    rule.metadata.primaryGroupingTaxonomyId = 'wcag22-pour';
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'rulefile_editing',
        auditId: 'e2e-classifications-1',
        ruleSetId: 'rule-cls-1',
        ruleFileServerVersion: 1,
        ruleFileContent: rule,
        auditMetadata: {
            caseNumber: 'CLS-1',
            actorName: 'e2e',
            actorLink: '',
            auditorName: 'e2e',
            caseHandler: '',
            internalComment: '',
        },
        samples: [],
    };
}

test.describe('Regelfil: Klassificeringar redigering', () => {
    test('Redigera-knapp visar taxonomiformulär i main', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await page.addInitScript(
            ({ key, state_json, token }) => {
                sessionStorage.setItem(key, state_json);
                sessionStorage.setItem('gv_auth_token', token);
                sessionStorage.setItem('gv_current_user_name', 'e2e-test-user');
                sessionStorage.setItem('gv_current_user_is_admin', '1');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(buildRulefileState()),
                token: 'e2e-cls-jwt',
            }
        );

        await setupApiMocks(page);
        await page.goto('/v2/#rulefile_sections?section=classifications');
        await ensureSwedishAndDismissRestore(page);

        await expect(page.locator('#app-main-view-root')).toContainText('Klassificeringar');

        const edit_button = page.getByRole('button', { name: /Redigera klassificeringar/i });
        await expect(edit_button).toBeVisible();
        await edit_button.click();

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.rulefile-classifications-edit-form')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.taxonomies-editor')).toBeVisible();
        await expect(main.getByRole('tab', { name: 'Taxonomier' })).toBeVisible();

        const mapping_tab = main.getByRole('tab', { name: 'Kravkoppling' });
        await expect(mapping_tab).toBeVisible();
        await mapping_tab.click();

        await expect(main.locator('.requirement-mapping-matrix-wrapper')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.requirement-mapping-table')).toBeVisible();
        await expect(main.locator('.requirement-mapping-cards')).toBeAttached();
        await expect(main.locator('.requirement-mapping-matrix-wrapper input[type="checkbox"]').first()).toBeVisible();

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Kravkoppling visar kortlayout på smal skärm', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() !== 'error') return;
            const text = msg.text();
            if (/ResizeObserver/i.test(text)) return;
            if (/insertBefore/i.test(text)) return;
            console_errors.push(text);
        });
        page.on('pageerror', (err) => {
            const text = String(err);
            if (/insertBefore/i.test(text)) return;
            if (/can not be found here/i.test(text)) return;
            if (/ResizeObserver/i.test(text)) return;
            console_errors.push(text);
        });

        await page.addInitScript(
            ({ key, state_json, token }) => {
                sessionStorage.setItem(key, state_json);
                sessionStorage.setItem('gv_auth_token', token);
                sessionStorage.setItem('gv_current_user_name', 'e2e-test-user');
                sessionStorage.setItem('gv_current_user_is_admin', '1');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(buildRulefileState()),
                token: 'e2e-cls-jwt',
            }
        );

        await setupApiMocks(page);
        await page.goto('/v2/#rulefile_sections?section=classifications');
        await ensureSwedishAndDismissRestore(page);

        await expect(page.locator('#app-main-view-root')).toContainText('Klassificeringar');

        const edit_button = page.getByRole('button', { name: /Redigera klassificeringar/i });
        await expect(edit_button).toBeVisible();
        await edit_button.click();

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.rulefile-classifications-edit-form').first()).toBeVisible({ timeout: 5000 });

        const mapping_tab = main.getByRole('tab', { name: 'Kravkoppling' });
        await expect(mapping_tab).toBeVisible();
        await mapping_tab.click();
        await expect(main.locator('.requirement-mapping-cards')).toBeAttached({ timeout: 5000 });

        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);

        await expect(main.locator('.requirement-mapping-cards')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.requirement-mapping-card').first()).toBeVisible();
        await expect(main.locator('.requirement-mapping-card-label').first()).toBeVisible();

        const matrix_display = await main.locator('.requirement-mapping-matrix-wrapper').evaluate(
            (el) => window.getComputedStyle(el).display
        );
        expect(matrix_display).toBe('none');

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });
});
