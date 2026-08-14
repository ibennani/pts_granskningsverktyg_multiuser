/**
 * @file Enhetstester för overlay av granskningstyper vid klientladdning.
 */
import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const client_path = path.join(spec_dir, '../../js/api/client.js');
const overlay_path = path.join(spec_dir, '../../js/logic/audit_type_rule_overlay.ts');

const get_rules_mock = jest.fn();
const get_rule_mock = jest.fn();

jest.unstable_mockModule(client_path, () => ({
    get_rules: get_rules_mock,
    get_rule: get_rule_mock,
}));

const {
    apply_audit_type_overlay_with_published,
    enrich_audit_state_with_audit_type_overlay,
} = await import(overlay_path);
const { resolve_available_audit_types_for_audit } = await import(
    '../../shared/audit/audit_type_catalog.js'
);

const LEGACY_RULE_SET_ID = '4a607755-2a1d-43ea-a900-73d191bbf2a0';
const WEB_RULE_SET_ID = '5d7c1c26-c07b-4a0d-ba22-ccf025033135';

const PUBLISHED = {
    metadata: {
        auditTypes: [
            { id: 'tillsyn-lptt', label: 'Tillsyn LPTT', taxonomyId: 'wcag22-pour' },
            { id: 'marknadskontroll-lptt', label: 'Marknadskontroll LPTT', taxonomyId: 'fptt-bilaga-2' },
        ],
    },
};

const LEGACY_SNAPSHOT = {
    metadata: {
        monitoringType: { text: 'Webbplats', type: 'web' },
        ruleSetId: LEGACY_RULE_SET_ID,
    },
    requirements: { req1: { id: 'req1' } },
};

describe('audit_type_rule_overlay', () => {
    beforeEach(() => {
        get_rules_mock.mockReset();
        get_rule_mock.mockReset();
    });

    test('apply_audit_type_overlay_with_published behåller krav i ögonblicksbilden', () => {
        const effective = apply_audit_type_overlay_with_published(LEGACY_SNAPSHOT, PUBLISHED) as typeof LEGACY_SNAPSHOT & {
            metadata: { auditTypes: unknown[] };
        };
        expect(effective.requirements).toEqual(LEGACY_SNAPSHOT.requirements);
        expect(effective.metadata.auditTypes).toHaveLength(2);
    });

    test('resolve_available_audit_types_for_audit efter overlay', () => {
        const effective = apply_audit_type_overlay_with_published(LEGACY_SNAPSHOT, PUBLISHED);
        expect(resolve_available_audit_types_for_audit(LEGACY_SNAPSHOT, PUBLISHED)).toHaveLength(2);
        expect(
            resolve_available_audit_types_for_audit(effective, null)
        ).toHaveLength(2);
    });

    test('enrich_audit_state_with_audit_type_overlay anropar inte get_rule för okänt legacy-id', async () => {
        get_rules_mock.mockResolvedValue([
            {
                id: WEB_RULE_SET_ID,
                name: 'PTS tillsynsregler för granskning av webbplatser',
                is_published: true,
                published_content: PUBLISHED,
            },
        ]);
        get_rule_mock.mockResolvedValue({
            id: WEB_RULE_SET_ID,
            published_content: PUBLISHED,
        });

        const result = await enrich_audit_state_with_audit_type_overlay({
            ruleSetId: null,
            ruleFileContent: LEGACY_SNAPSHOT,
        });

        expect(get_rule_mock).not.toHaveBeenCalledWith(LEGACY_RULE_SET_ID);
        expect(get_rule_mock).toHaveBeenCalledWith(WEB_RULE_SET_ID);
        expect(result.ruleSetId).toBe(WEB_RULE_SET_ID);
        expect(
            (result.ruleFileContent as { metadata: { auditTypes: unknown[] } }).metadata.auditTypes
        ).toHaveLength(2);
    });
});
