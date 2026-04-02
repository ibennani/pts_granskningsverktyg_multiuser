/**
 * E2E: nätverksavbrott och återhämtning (mockat API).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { initial_state } from '../../js/state/initialState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function ensureSwedishAndDismissRestore (page) {
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

function buildState () {
    const rule = JSON.parse(
        readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
    );
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'in_progress',
        auditId: 'e2e-off-1',
        ruleSetId: 'e2e-rule-1',
        ruleFileContent: rule,
        auditMetadata: {
            caseNumber: 'OFF-1',
            actorName: 'A',
            actorLink: '',
            auditorName: 'B',
            caseHandler: '',
            internalComment: ''
        },
        samples: []
    };
}

async function setupOkMocks (page) {
    await page.route('**/v2/api/**', async (route) => {
        const url = route.request().url();
        const method = route.request().method();
        if (url.includes('/health')) {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
        }
        if (url.includes('/auth/refresh') && method === 'POST') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ token: 'e2e-off-jwt' })
            });
        }
        if (url.includes('/users/me')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    name: 'E2E',
                    is_admin: false,
                    language_preference: 'sv-SE'
                })
            });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

test.describe('Offline / nätverk (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('avbrott visar fel eller misslyckad begäran; återställning fungerar', async ({ page }) => {
        const session_state = buildState();

        await page.addInitScript(
            ({ key, state_json, token }) => {
                sessionStorage.setItem(key, state_json);
                sessionStorage.setItem('gv_auth_token', token);
                sessionStorage.setItem('gv_current_user_is_admin', '0');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(session_state),
                token: 'e2e-off-jwt'
            }
        );

        await setupOkMocks(page);
        await page.goto('/v2/#metadata');
        await ensureSwedishAndDismissRestore(page);
        await expect(page.locator('#caseNumber')).toBeVisible({ timeout: 25000 });

        await page.unroute('**/v2/api/**');
        await page.route('**/v2/api/**', (route) => route.abort('failed'));

        const failed = [];
        page.on('requestfailed', (req) => failed.push(req.url()));

        await page.goto('/v2/#start');
        await ensureSwedishAndDismissRestore(page);

        expect(failed.some((u) => u.includes('/v2/api/'))).toBeTruthy();
        await expect(page.locator('main')).toBeVisible();

        await page.unroute('**/v2/api/**');
        await setupOkMocks(page);
        page.removeAllListeners('requestfailed');

        await page.goto('/v2/#metadata');
        await ensureSwedishAndDismissRestore(page);
        await expect(page.locator('#caseNumber')).toHaveValue('OFF-1', { timeout: 20000 });
    });
});
