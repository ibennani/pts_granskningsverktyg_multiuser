/**
 * E2E: metadata bevaras vid omladdning; fel vid avbrott (mockat API).
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

function buildSessionState () {
    const rule = JSON.parse(
        readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
    );
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'in_progress',
        auditId: 'e2e-save-1',
        ruleSetId: 'e2e-rule-1',
        ruleFileContent: rule,
        auditMetadata: {
            caseNumber: 'E2E-SAVE-99',
            actorName: 'Sparaaktör',
            actorLink: '',
            auditorName: 'Sparagranskare',
            caseHandler: '',
            internalComment: ''
        },
        samples: []
    };
}

async function setupApiMocks (page) {
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
                body: JSON.stringify({ token: 'e2e-save-jwt' })
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

test.describe('Spara och omladdning (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('metadata syns efter reload; fel vid nätverksavbrott', async ({ page }) => {
        const session_state = buildSessionState();

        await page.addInitScript(
            ({ key, state_json, token }) => {
                sessionStorage.setItem(key, state_json);
                sessionStorage.setItem('gv_auth_token', token);
                sessionStorage.setItem('gv_current_user_is_admin', '0');
            },
            {
                key: 'digitalTillsynAppCentralState',
                state_json: JSON.stringify(session_state),
                token: 'e2e-save-jwt'
            }
        );

        await setupApiMocks(page);
        await page.goto('/v2/#metadata');
        await ensureSwedishAndDismissRestore(page);

        const case_input = page.locator('#caseNumber');
        await expect(case_input).toBeVisible({ timeout: 25000 });
        await expect(case_input).toHaveValue('E2E-SAVE-99');

        await page.reload();
        await ensureSwedishAndDismissRestore(page);
        await expect(page.locator('#caseNumber')).toHaveValue('E2E-SAVE-99');

        await page.unroute('**/v2/api/**');
        await page.route('**/v2/api/**', (route) => route.abort('failed'));

        const failed_urls = [];
        const on_failed = (req) => failed_urls.push(req.url());
        page.on('requestfailed', on_failed);

        await page.goto('/v2/#start');
        await ensureSwedishAndDismissRestore(page);

        expect(failed_urls.some((u) => u.includes('/v2/api/'))).toBeTruthy();
        await expect(page.locator('main')).toBeVisible();
        const body_text = await page.locator('body').innerText();
        const looks_like_error =
            /fel|misslyck|kunde inte|inte nå|offline|anslutning|ej tillgänglig|backend/i.test(
                body_text
            );
        const has_global_msg = await page
            .locator('#global-message-area .global-message-content')
            .first()
            .isVisible()
            .catch(() => false);
        expect(has_global_msg || looks_like_error).toBeTruthy();

        page.off('requestfailed', on_failed);
    });
});
