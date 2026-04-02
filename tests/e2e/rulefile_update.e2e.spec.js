/**
 * E2E: uppdatera regelfil – varningssteg och navigering tillbaka (mockat API).
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
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'in_progress',
        auditId: 'e2e-urf-1',
        ruleSetId: 'rule-urf-1',
        ruleFileContent: JSON.parse(JSON.stringify(fixture_rule)),
        auditMetadata: {
            caseNumber: 'URF-1',
            actorName: 'A',
            actorLink: '',
            auditorName: 'B',
            caseHandler: '',
            internalComment: ''
        },
        samples: []
    };
}

async function setupMocks (page) {
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
                body: JSON.stringify({ token: 'e2e-urf-jwt' })
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
        if (url.includes('/rules/') && method === 'GET' && !url.includes('/version')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 'rule-urf-1',
                    published_content: JSON.stringify(fixture_rule),
                    content: JSON.stringify(fixture_rule)
                })
            });
        }
        if (method === 'GET') {
            return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        }
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    });
}

test.describe('Uppdatera regelfil (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('varningssteg med knappar; tillbaka till översikt', async ({ page }) => {
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
                token: 'e2e-urf-jwt'
            }
        );

        await setupMocks(page);

        await page.goto(
            '/v2/#update_rulefile?ruleId=rule-urf-1&version=2.0.0'
        );
        await ensureSwedishAndDismissRestore(page);

        await expect(
            page.getByRole('heading', { name: /Uppdatera regelfil/i })
        ).toBeVisible({ timeout: 25000 });

        await expect(
            page.getByRole('button', { name: /Spara granskning till fil/i })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Fortsätt utan säkerhetskopia/i })
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Tillbaka till granskningsöversikten/i })
        ).toBeVisible();

        await page.getByRole('button', { name: /Tillbaka till granskningsöversikten/i }).click();
        await page.waitForFunction(
            () => /audit_overview/.test(window.location.hash || ''),
            { timeout: 15000 }
        );
        await page.reload();
        await ensureSwedishAndDismissRestore(page);

        await expect(
            page.getByRole('heading', { name: 'Granskningsöversikt' })
        ).toBeVisible({ timeout: 20000 });
    });
});
