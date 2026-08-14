/**
 * E2E: Bilaga 1-redigering i regelfilens malltexter.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { initial_state } from '../../js/state/initialState.js';
import { DEFAULT_AUDIT_TYPES } from '../../shared/rulefile/rulefile_audit_types.js';

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
                body: JSON.stringify({ token: 'e2e-appendix1-jwt' }),
            });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

function buildRulefileState(options = {}) {
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
        {
            id: 'fptt-bilaga-2',
            label: 'FPTT, bilaga 2',
            version: '1.0',
            uri: '',
            concepts: [{ id: 'a', label: 'Uppfattningsbar' }],
        },
    ];
    rule.metadata.primaryGroupingTaxonomyId = 'wcag22-pour';
    if (options.with_audit_types) {
        rule.metadata.auditTypes = DEFAULT_AUDIT_TYPES.map((row) => ({ ...row }));
    }
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'rulefile_editing',
        auditId: 'e2e-appendix1-1',
        ruleSetId: 'rule-appendix1-1',
        ruleFileServerVersion: 1,
        ruleFileContent: rule,
        auditMetadata: {
            caseNumber: 'APP-1',
            actorName: 'e2e',
            actorLink: '',
            auditorName: 'e2e',
            caseHandler: '',
            internalComment: '',
        },
        samples: [],
    };
}

async function bootstrapAppendix1View(page, options = {}) {
    await page.addInitScript(({ key, state_json, token }) => {
            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

            sessionStorage.setItem(gv_scope_storage_key(key), state_json);
            sessionStorage.setItem(gv_scope_storage_key('gv_auth_token'), token);
            sessionStorage.setItem(gv_scope_storage_key('gv_current_user_name'), 'e2e-test-user');
            sessionStorage.setItem(gv_scope_storage_key('gv_current_user_is_admin'), '1');
        },
        {
            key: 'digitalTillsynAppCentralState',
            state_json: JSON.stringify(buildRulefileState(options)),
            token: 'e2e-appendix1-jwt',
        }
    );
    await setupApiMocks(page);
    await page.goto('/v2/#rulefile_sections?section=report_template&appendix=1');
    await ensureSwedishAndDismissRestore(page);
    await expect(page.locator('#app-main-view-root')).toContainText('Bilaga 1');
}

test.describe('Regelfil: Bilaga 1-redigering', () => {
    test('Visningsläge laddar hub och Bilaga 1 utan redigeringsformulär', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await page.addInitScript(({ key, state_json, token }) => {
            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

                sessionStorage.setItem(gv_scope_storage_key(key), state_json);
                sessionStorage.setItem(gv_scope_storage_key('gv_auth_token'), token);
                sessionStorage.setItem(gv_scope_storage_key('gv_current_user_name'), 'e2e-test-user');
                sessionStorage.setItem(gv_scope_storage_key('gv_current_user_is_admin'), '1');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(buildRulefileState({ with_audit_types: true })),
                token: 'e2e-appendix1-jwt',
            }
        );
        await setupApiMocks(page);
        await page.goto('/v2/#rulefile_sections?section=report_template');
        await ensureSwedishAndDismissRestore(page);

        await expect(page.locator('#app-main-view-root')).toContainText('Bilaga 1');
        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(0);

        await page.getByRole('link', { name: 'Bilaga 1' }).click();
        await expect(page).toHaveURL(/appendix=1/);
        await expect(page).not.toHaveURL(/edit=true/);
        await expect(
            page.getByRole('heading', { name: 'Bilaga 1, standardtext för sammanfattning', level: 1 })
        ).toBeVisible();
        await expect(page.getByText('Här ser du standardmallen för Bilaga 1')).toHaveCount(0);
        await expect(page.locator('.audit-settings__page-header-row .rulefile-sections-edit-button')).toHaveCount(1);
        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(0);
        expect(console_errors).toEqual([]);
    });

    test('Redigera-knappen laddar redigeringsformuläret', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapAppendix1View(page);

        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(0);

        await page.getByRole('button', { name: 'Redigera' }).click();
        await expect(page).toHaveURL(/edit=true/);
        await expect(page).toHaveURL(/appendix=1/);

        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(1);
        await expect(page.locator('#app-main-view-root')).toContainText('Spara ändringar');
        expect(console_errors).toEqual([]);
    });

    test('Redigera fungerar via hub-navigering', async ({ page }) => {
        await page.addInitScript(({ key, state_json, token }) => {
            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

                sessionStorage.setItem(gv_scope_storage_key(key), state_json);
                sessionStorage.setItem(gv_scope_storage_key('gv_auth_token'), token);
                sessionStorage.setItem(gv_scope_storage_key('gv_current_user_name'), 'e2e-test-user');
                sessionStorage.setItem(gv_scope_storage_key('gv_current_user_is_admin'), '1');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(buildRulefileState()),
                token: 'e2e-appendix1-jwt',
            }
        );
        await setupApiMocks(page);
        await page.goto('/v2/#rulefile_sections?section=report_template');
        await ensureSwedishAndDismissRestore(page);
        await page.getByRole('link', { name: 'Bilaga 1' }).click();
        await expect(page).toHaveURL(/appendix=1/);
        await page.getByRole('button', { name: 'Redigera' }).click();
        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(1);
    });

    test('Redigera fungerar med flera granskningstyper', async ({ page }) => {
        await bootstrapAppendix1View(page, { with_audit_types: true });
        await page.getByRole('button', { name: 'Redigera' }).click();
        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(1);
        await expect(page.locator('.appendix1-audit-type-select')).toHaveCount(1);
    });

    test('Direktlänk med edit=true utan appendix omdirigerar och laddar editor', async ({ page }) => {
        await page.addInitScript(({ key, state_json, token }) => {
            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

            const gv_scope_storage_key = (base_key) => {
            const ns = 'v2';
            return `gv:${ns}:${String(base_key || '').trim()}`;
        };

                sessionStorage.setItem(gv_scope_storage_key(key), state_json);
                sessionStorage.setItem(gv_scope_storage_key('gv_auth_token'), token);
                sessionStorage.setItem(gv_scope_storage_key('gv_current_user_name'), 'e2e-test-user');
                sessionStorage.setItem(gv_scope_storage_key('gv_current_user_is_admin'), '1');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(buildRulefileState()),
                token: 'e2e-appendix1-jwt',
            }
        );
        await setupApiMocks(page);
        await page.goto('/v2/#rulefile_sections?section=report_template&edit=true');
        await ensureSwedishAndDismissRestore(page);
        await expect(page).toHaveURL(/appendix=1/);
        await expect(page.locator('.appendix1-body-text-editor')).toHaveCount(1);
    });
});
