/**
 * @file Enhetstester för overlay av granskningstyper vid klientladdning.
 */
import {
    apply_audit_type_overlay_with_published,
    enrich_audit_state_with_audit_type_overlay,
} from '../../js/logic/audit_type_rule_overlay.js';
import { resolve_available_audit_types_for_audit } from '../../shared/audit/audit_type_catalog.js';

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
        ruleSetId: '4a607755-2a1d-43ea-a900-73d191bbf2a0',
    },
    requirements: { req1: { id: 'req1' } },
};

describe('audit_type_rule_overlay', () => {
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
});
