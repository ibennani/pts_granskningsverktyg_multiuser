/**
 * E2E: export på åtgärdssidan med förifylld session och mockade API-anrop.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { initial_state } from '../../js/state/initialState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function setupExportApiMocks(page) {
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
                body: JSON.stringify({ name: 'E2E', is_admin: false, language_preference: 'sv-SE' })
            });
        }
        if (url.includes('/auth/refresh') && method === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-export-jwt' })
            });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

test.describe('Export (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test('exportsektion finns och CSV-export triggar nedladdning', async ({ page }) => {
        const rule = JSON.parse(
            readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
        );
        const session_state = {
            ...JSON.parse(JSON.stringify(initial_state)),
            auditStatus: 'locked',
            ruleFileContent: rule,
            auditMetadata: {
                caseNumber: 'E2E-EXP',
                actorName: 'Exportaktör',
                actorLink: '',
                auditorName: 'Exportgranskare',
                caseHandler: '',
                internalComment: ''
            },
            samples: [
                {
                    id: 's-exp-1',
                    description: 'Exportprov',
                    url: 'https://example.com',
                    sampleCategory: 'cat1',
                    sampleType: 'stype1',
                    selectedContentTypes: ['plain'],
                    requirementResults: {}
                }
            ]
        };

        await page.addInitScript(
            ({ key, state_json, token }) => {
                sessionStorage.setItem(key, state_json);
                sessionStorage.setItem('gv_auth_token', token);
                sessionStorage.setItem('gv_current_user_is_admin', '0');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(session_state),
                token: 'e2e-export-jwt'
            }
        );

        await setupExportApiMocks(page);
        await page.goto('/v2/#audit_actions');
        await ensureSwedishAndDismissRestore(page);

        await expect(page.getByRole('heading', { name: 'Export' })).toBeVisible();

        const download_promise = page.waitForEvent('download');
        await page.locator('#audit-action-btn-export-csv').click();
        const download = await download_promise;
        expect(download.suggestedFilename()).toMatch(/\.csv$/i);
    });
});
