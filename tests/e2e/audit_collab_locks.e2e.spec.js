/**
 * E2E: fältlås (lease) + del-sparning för granskningens textareor.
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

function buildFixtureRuleWithChecks() {
    const rf = JSON.parse(JSON.stringify(fixture_rule_base));
    // Minimal check+pc så vi får observations-textarea.
    const first_req_key = Object.keys(rf.requirements || {})[0];
    rf.requirements[first_req_key].checks = [{
        id: 'c1',
        condition: 'Villkor',
        passCriteria: [{ id: 'p1', requirement: 'Kravtext' }]
    }];
    return rf;
}

function buildAuditState({ user_name }) {
    const fixture_rule = buildFixtureRuleWithChecks();
    return {
        ...JSON.parse(JSON.stringify(initial_state)),
        auditStatus: 'in_progress',
        auditId: 'audit-lock-1',
        ruleSetId: 'rule-a1',
        version: 1,
        ruleFileContent: JSON.parse(JSON.stringify(fixture_rule)),
        auditMetadata: { actorName: user_name },
        samples: [{
            id: 's1',
            description: 'Sida 1',
            requirementResults: {
                req1: {
                    status: 'not_audited',
                    commentToAuditor: '',
                    commentToActor: '',
                    stuckProblemDescription: '',
                    checkResults: {
                        c1: { overallStatus: 'passed', passCriteria: { p1: { status: 'failed', observationDetail: '' } } }
                    }
                }
            }
        }]
    };
}

test.describe('Granskning: fältlås och del-sparning (mockat API)', () => {
    test.use({ viewport: { width: 1280, height: 900 } });

    test('bara en får textarea för samma fält', async ({ browser }) => {
        test.setTimeout(60000);
        const context1 = await browser.newContext();
        const context2 = await browser.newContext();
        const page1 = await context1.newPage();
        const page2 = await context2.newPage();

        let current_version = 1;
        let current_lock = null; // { part_key, user_name }

        const setupMocks = async (page, user_name) => {
            await page.route('**/v2/api/**', async (route) => {
                const url = route.request().url();
                const method = route.request().method();

                if (url.includes('/health')) return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
                if (url.includes('/auth/refresh') && method === 'POST') {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'e2e-audit-jwt' }) });
                }
                if (url.includes('/users/me')) {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: user_name, is_admin: false, language_preference: 'sv-SE' }) });
                }

                if (/\/audits\/[^/]+\/locks$/.test(url) && method === 'GET') {
                    const locks = current_lock ? [{
                        audit_id: 'audit-lock-1',
                        part_key: current_lock.part_key,
                        user_name: current_lock.user_name,
                        user_id: 'u',
                        client_lock_id: 'c',
                        lease_until: new Date(Date.now() + 30000).toISOString(),
                        updated_at: new Date().toISOString()
                    }] : [];
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ auditId: 'audit-lock-1', locks }) });
                }

                if (/\/audits\/[^/]+\/locks$/.test(url) && method === 'POST') {
                    const body = route.request().postDataJSON();
                    const part_key = body?.part_key;
                    if (!current_lock) {
                        current_lock = { part_key, user_name };
                        return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ lock: { audit_id: 'audit-lock-1', part_key, user_name } }) });
                    }
                    return route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Fältet är redan låst', lock: { part_key: current_lock.part_key, user_name: current_lock.user_name } }) });
                }

                if (/\/audits\/[^/]+\/locks\/.*\/heartbeat/.test(url) && method === 'POST') {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
                }

                if (/\/audits\/[^/]+\/locks\/.*/.test(url) && method === 'DELETE') {
                    current_lock = null;
                    return route.fulfill({ status: 204, body: '' });
                }

                if (/\/audits\/[^/]+\/content-part/.test(url) && method === 'PATCH') {
                    current_version += 1;
                    const audit_state = buildAuditState({ user_name });
                    audit_state.version = current_version;
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(audit_state) });
                }

                if (/\/audits\/[^/]+\/version/.test(url) && method === 'GET') {
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ version: current_version, updated_at: new Date().toISOString() }) });
                }

                if (/\/audits\/[^/]+$/.test(url) && method === 'GET') {
                    const audit_state = buildAuditState({ user_name });
                    audit_state.version = current_version;
                    // API:n returnerar audit utan regelfil ibland; men i testet sätter vi redan ruleFileContent i state.
                    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(audit_state) });
                }

                if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
                return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
            });
        };

        const state1 = buildAuditState({ user_name: 'Användare 1' });
        const state2 = buildAuditState({ user_name: 'Användare 2' });

        await page1.addInitScript(({ key, state_json, token }) => {
            sessionStorage.setItem(key, state_json);
            sessionStorage.setItem('gv_auth_token', token);
            sessionStorage.setItem('gv_current_user_is_admin', '0');
        }, { key: 'digitalTillsynAppCentralState', state_json: JSON.stringify(state1), token: 'e2e-audit-jwt' });

        await page2.addInitScript(({ key, state_json, token }) => {
            sessionStorage.setItem(key, state_json);
            sessionStorage.setItem('gv_auth_token', token);
            sessionStorage.setItem('gv_current_user_is_admin', '0');
        }, { key: 'digitalTillsynAppCentralState', state_json: JSON.stringify(state2), token: 'e2e-audit-jwt' });

        await setupMocks(page1, 'Användare 1');
        await setupMocks(page2, 'Användare 2');

        await page1.goto('/v2/#requirement_audit?sampleId=s1&requirementId=req1', { waitUntil: 'domcontentloaded' });
        const obs1 = page1.locator('textarea.pc-observation-detail-textarea').first();
        await expect(obs1).toBeVisible({ timeout: 25000 });
        await obs1.click();
        await obs1.type('Test');

        await page2.goto('/v2/#requirement_audit?sampleId=s1&requirementId=req1', { waitUntil: 'domcontentloaded' });
        await expect(page2.locator('.info-block-locked-message')).toContainText('Användare 1');

        await context1.close();
        await context2.close();
    });
});

