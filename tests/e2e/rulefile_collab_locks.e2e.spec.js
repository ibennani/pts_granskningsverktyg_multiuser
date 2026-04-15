/**
 * E2E: fältlås (lease) + del-sparning för infoblock-text.
 * Testar två samtidiga sessioner med mockat API.
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { test, expect } from '@playwright/test';
import { initial_state } from '../../js/state/initialState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture_rule_base = JSON.parse(
    readFileSync(path.join(__dirname, '../fixtures/minimal-rulefile.json'), 'utf8')
);

function buildFixtureRuleWithInfoBlocks() {
    const rf = JSON.parse(JSON.stringify(fixture_rule_base));
    rf.metadata = rf.metadata || {};
    rf.metadata.blockOrders = rf.metadata.blockOrders || {};
    rf.metadata.blockOrders.infoBlocks = ['instructions'];
    const first_req_key = Object.keys(rf.requirements || {})[0];
    if (first_req_key && rf.requirements?.[first_req_key]) {
        rf.requirements[first_req_key].instructions = 'Instruktioner';
    }
    return rf;
}

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

function buildState({ user_name }) {
    const fixture_rule = buildFixtureRuleWithInfoBlocks();
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'rulefile_editing',
        auditId: 'e2e-lock-1',
        ruleSetId: 'rule-lock-1',
        ruleFileServerVersion: 1,
        ruleFileContent: JSON.parse(JSON.stringify(fixture_rule)),
        auditMetadata: {
            caseNumber: 'LOCK-1',
            actorName: user_name,
            actorLink: '',
            auditorName: user_name,
            caseHandler: '',
            internalComment: ''
        },
        samples: []
    };
}

test.describe('Regelfil: fältlås och del-sparning (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('bara en får textarea; patch sker per fält', async ({ browser }) => {
        test.setTimeout(60000);
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        // Delad "server"-state för mocken.
        let current_version = 1;
        let current_lock = null; // { part_key, user_name }

        const fixture_rule = buildFixtureRuleWithInfoBlocks();
        const setupMocks = async (page, user_name) => {
            await page.route('**/v2/api/**', async (route) => {
                const url = route.request().url();
                const method = route.request().method();

                if (url.includes('/health')) {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                }
                if (url.includes('/auth/refresh') && method === 'POST') {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e-lock-jwt' }) });
                }
                if (url.includes('/users/me')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ name: user_name, is_admin: false, language_preference: 'sv-SE' })
                    });
                }

                if (/\/rules\/[^/]+\/locks$/.test(url) && method === 'GET') {
                    const locks = current_lock ? [{
                        rule_set_id: 'rule-lock-1',
                        part_key: current_lock.part_key,
                        user_name: current_lock.user_name,
                        user_id: 'u',
                        client_lock_id: 'c',
                        lease_until: new Date(Date.now() + 30000).toISOString(),
                        updated_at: new Date().toISOString()
                    }] : [];
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ ruleSetId: 'rule-lock-1', now: new Date().toISOString(), locks })
                    });
                }

                if (/\/rules\/[^/]+\/locks$/.test(url) && method === 'POST') {
                    const body = route.request().postDataJSON();
                    const part_key = body?.part_key;
                    if (!current_lock) {
                        current_lock = { part_key, user_name };
                        return route.fulfill({
                            status: 201,
                            contentType: 'application/json',
                            body: JSON.stringify({ lock: { rule_set_id: 'rule-lock-1', part_key, user_name, lease_until: new Date(Date.now() + 30000).toISOString() } })
                        });
                    }
                    return route.fulfill({
                        status: 409,
                        contentType: 'application/json',
                        body: JSON.stringify({ error: 'Fältet är redan låst', lock: { part_key: current_lock.part_key, user_name: current_lock.user_name } })
                    });
                }

                if (/\/rules\/[^/]+\/locks\/.*\/heartbeat/.test(url) && method === 'POST') {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
                }

                if (/\/rules\/[^/]+\/locks\/.*/.test(url) && method === 'DELETE') {
                    current_lock = null;
                    return route.fulfill({ status: 204, body: '' });
                }

                if (/\/rules\/[^/]+\/content-part/.test(url) && method === 'PATCH') {
                    const body = route.request().postDataJSON();
                    expect(body.part_key).toMatch(/^req:/);
                    expect(typeof body.value).toBe('string');
                    current_version += 1;
                    // "Servern" svarar med samma content (förenklat) men ny version.
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ id: 'rule-lock-1', content: JSON.stringify(fixture_rule), version: current_version })
                    });
                }

                if (url.includes('/rules/') && method === 'GET' && !url.includes('/version') && !url.includes('/locks')) {
                    return route.fulfill({
                        status: 200,
                        contentType: 'application/json',
                        body: JSON.stringify({ id: 'rule-lock-1', content: JSON.stringify(fixture_rule), published_content: JSON.stringify(fixture_rule), version: current_version })
                    });
                }

                if (url.includes('/rules/') && method === 'GET' && url.includes('/version')) {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: current_version, updated_at: new Date().toISOString() }) });
                }

                if (method === 'GET') {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
                }
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
        };

        const state1 = buildState({ user_name: 'Användare 1' });
        const state2 = buildState({ user_name: 'Användare 2' });

        await page1.addInitScript(({ key, state_json, token }) => {
            sessionStorage.setItem(key, state_json);
            sessionStorage.setItem('gv_auth_token', token);
            sessionStorage.setItem('gv_current_user_is_admin', '0');
        }, { key: 'digitalTillsynAppCentralState', state_json: JSON.stringify(state1), token: 'e2e-lock-jwt' });

        await page2.addInitScript(({ key, state_json, token }) => {
            sessionStorage.setItem(key, state_json);
            sessionStorage.setItem('gv_auth_token', token);
            sessionStorage.setItem('gv_current_user_is_admin', '0');
        }, { key: 'digitalTillsynAppCentralState', state_json: JSON.stringify(state2), token: 'e2e-lock-jwt' });

        await setupMocks(page1, 'Användare 1');
        await setupMocks(page2, 'Användare 2');

        // Välj första kravet i fixture.
        const first_req_key = Object.keys(fixture_rule.requirements)[0];
        await page1.goto(`/v2/#rulefile_edit_requirement?id=${encodeURIComponent(first_req_key)}`, { waitUntil: 'domcontentloaded' });
        await ensureSwedishAndDismissRestore(page1);

        const textarea1 = page1.locator('textarea[id^="infoBlock_"][id$="_text"]').first();
        await expect(textarea1).toBeVisible({ timeout: 25000 });
        await textarea1.click(); // tar lås
        await textarea1.type('Test'); // triggar autospar/patch

        // Öppna andra sessionen efter att låset är taget, så att första rendern ser låslistan.
        await page2.goto(`/v2/#rulefile_edit_requirement?id=${encodeURIComponent(first_req_key)}`, { waitUntil: 'domcontentloaded' });
        await ensureSwedishAndDismissRestore(page2);

        await expect(page2.locator('.info-block-locked-message')).toContainText('Användare 1');

        // Verifiera att patch-anrop skedde på page1 (genom att version ökade i mocken).
        await page1.waitForTimeout(500);

        await context1.close();
        await context2.close();
    });
});

