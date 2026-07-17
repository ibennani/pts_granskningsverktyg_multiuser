/**
 * E2E: Klassificeringar hub och undersidor.
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

async function bootstrapClassificationsPage(page) {
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
}

test.describe('Regelfil: Klassificeringar hub', () => {
    test('Hub visar fyra länkar utan global redigera-knapp', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        const main = page.locator('#app-main-view-root');
        await expect(main.getByRole('link', { name: /Bristtyper/i })).toBeVisible();
        await expect(main.getByRole('link', { name: /Granskningstyper/i })).toBeVisible();
        await expect(main.getByRole('link', { name: /Taxonomi/i })).toBeVisible();
        await expect(main.getByRole('link', { name: /Kravkoppling/i })).toBeVisible();
        await expect(page.getByRole('button', { name: /Redigera klassificeringar/i })).toHaveCount(0);

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Taxonomi-undersida visar intro och tabell utan redigera-knapp', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        await page.getByRole('link', { name: /Taxonomi/i }).click();
        await expect(page).toHaveURL(/part=taxonomy/);
        await expect(page).not.toHaveURL(/edit=true/);

        const main = page.locator('#app-main-view-root');
        await expect(main).toContainText('Taxonomi');
        await expect(main.locator('.view-intro-text')).toBeVisible();
        await expect(main.locator('.taxonomy-table-section-heading')).toHaveCount(0);
        await expect(main.locator('.audit-settings__back-row')).toHaveCount(0);
        await expect(main.locator('.taxonomy-table')).toBeVisible();
        await expect(main.locator('.taxonomy-table caption')).toHaveCount(0);
        await expect(page.getByRole('button', { name: /Redigera taxonomi/i })).toHaveCount(0);

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Taxonomi-detaljvy visar sammanfattning utan tillbaka-knapp', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        await page.getByRole('link', { name: /Taxonomi/i }).click();
        await expect(page).toHaveURL(/part=taxonomy/);

        const main = page.locator('#app-main-view-root');
        await main.getByRole('link', { name: /WCAG 2\.2 POUR/i }).click();
        await expect(page).toHaveURL(/part=taxonomy.*taxonomyId=wcag22-pour/);
        await expect(page).not.toHaveURL(/edit=true/);

        await expect(main.locator('.taxonomy-detail-view')).toBeVisible();
        await expect(main.getByRole('heading', { level: 1 })).toContainText('WCAG 2.2 POUR');
        await expect(main.locator('.taxonomy-detail-heading')).toHaveCount(0);
        await expect(main.locator('.taxonomy-detail-summary')).toHaveCount(0);
        await expect(main.locator('.rulefile-sections-header-row .taxonomy-detail-edit-button')).toBeVisible();
        await expect(main.locator('.taxonomy-principles-table')).toBeVisible();
        await expect(page.getByRole('button', { name: /Tillbaka till taxonomilistan/i })).toHaveCount(0);

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Kravkoppling öppnas direkt i redigeringsläge från hub-länk', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        await page.getByRole('link', { name: /Kravkoppling/i }).click();
        await expect(page).toHaveURL(/part=mapping.*edit=true/);

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.requirement-mapping-matrix-wrapper')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.requirement-mapping-table')).toBeVisible();
        await expect(main.locator('.requirement-mapping-cards')).toBeAttached();
        await expect(main.locator('.requirement-mapping-matrix-wrapper input[type="checkbox"]').first()).toBeVisible();

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Granskningstyper öppnas direkt i redigeringsläge från hub-länk', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        await page.getByRole('link', { name: /Granskningstyper/i }).click();
        await expect(page).toHaveURL(/part=audit_types.*edit=true/);

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.audit-types-table')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.audit-types-row-edit-button').first()).toBeVisible();
        await expect(main.getByRole('button', { name: /Redigera granskningstyper/i })).toHaveCount(0);

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Bristtyper öppnas direkt i redigeringsläge från hub-länk', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        await page.getByRole('link', { name: /Bristtyper/i }).click();
        await expect(page).toHaveURL(/part=deficiency_types.*edit=true/);

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.deficiency-types-table')).toBeVisible({ timeout: 5000 });
        await expect(main.getByRole('button', { name: /Redigera bristtyper/i })).toHaveCount(0);
        await expect(main.locator('.deficiency-types-row-edit-button').first()).toBeVisible();

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

        await bootstrapClassificationsPage(page);
        await page.goto('/v2/#rulefile_sections?section=classifications&part=mapping&edit=true');
        await ensureSwedishAndDismissRestore(page);

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.requirement-mapping-cards')).toBeAttached({ timeout: 5000 });

        await page.setViewportSize({ width: 375, height: 812 });
        await page.waitForTimeout(300);

        await expect(main.locator('.requirement-mapping-cards')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.requirement-mapping-card').first()).toBeVisible();

        const matrix_display = await main.locator('.requirement-mapping-matrix-wrapper').evaluate(
            (el) => window.getComputedStyle(el).display
        );
        expect(matrix_display).toBe('none');

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Hub fyller inte viewport-höjd', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);

        const hub_layout = await page.evaluate(() => {
            const app_layout = document.querySelector('#app-layout');
            const plate = document.querySelector('.rulefile-sections-main-plate');
            return {
                app_layout_min_height: app_layout
                    ? window.getComputedStyle(app_layout).minHeight
                    : '',
                plate_display: plate ? window.getComputedStyle(plate).display : '',
                has_table_edit_form: Boolean(
                    document.querySelector(
                        '.rulefile-classifications-edit-form .rulefile-classifications-table-layout'
                    )
                ),
            };
        });
        expect(hub_layout.has_table_edit_form).toBe(false);
        expect(hub_layout.app_layout_min_height).not.toContain('100dvh');
        expect(hub_layout.plate_display).not.toBe('flex');

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });

    test('Tabellredigering: scrollzon med max-höjd, inte onödig tillväxt', async ({ page }) => {
        const console_errors = [];
        page.on('console', (msg) => {
            if (msg.type() === 'error') console_errors.push(msg.text());
        });
        page.on('pageerror', (err) => console_errors.push(String(err)));

        await bootstrapClassificationsPage(page);
        await page.goto('/v2/#rulefile_sections?section=classifications&part=mapping&edit=true');
        await ensureSwedishAndDismissRestore(page);

        const main = page.locator('#app-main-view-root');
        await expect(main.locator('.rulefile-classifications-edit-form')).toBeVisible({ timeout: 5000 });
        await expect(main.locator('.requirement-mapping-matrix-wrapper')).toBeVisible();

        const layout_metrics = await page.evaluate(() => {
            const form = document.querySelector('.rulefile-classifications-edit-form');
            const scroll = form?.querySelector('.rulefile-classifications-table-scroll-wrapper');
            const table = scroll?.querySelector('table');
            const actions = form?.querySelector('.form-actions');
            if (!form || !scroll || !table || !actions) return null;
            const form_rect = form.getBoundingClientRect();
            const actions_rect = actions.getBoundingClientRect();
            const scroll_style = window.getComputedStyle(scroll);
            const scroll_rect = scroll.getBoundingClientRect();
            const table_rect = table.getBoundingClientRect();
            return {
                scroll_overflow_y: scroll_style.overflowY,
                scroll_flex_grow: scroll_style.flexGrow,
                scroll_max_height: scroll_style.maxHeight,
                gap_below_actions_px: Math.round(form_rect.bottom - actions_rect.bottom),
                wrapper_vs_table_gap_px: Math.round(scroll_rect.height - table_rect.height),
                scroll_height: scroll.scrollHeight,
                client_height: scroll.clientHeight,
            };
        });

        expect(layout_metrics).not.toBeNull();
        expect(layout_metrics.scroll_overflow_y).toBe('auto');
        expect(Number(layout_metrics.scroll_flex_grow)).toBe(0);
        expect(layout_metrics.scroll_max_height).not.toBe('none');
        expect(layout_metrics.gap_below_actions_px).toBeLessThanOrEqual(4);
        expect(layout_metrics.wrapper_vs_table_gap_px).toBeLessThanOrEqual(4);

        if (console_errors.length > 0) {
            throw new Error(`Konsolfel: ${console_errors.join(' | ')}`);
        }
    });
});
