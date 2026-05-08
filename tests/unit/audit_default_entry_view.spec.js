/**
 * Tester för audit_default_entry_view.js
 */
import { describe, test, expect } from '@jest/globals';
import {
    default_view_for_loaded_audit_state,
    has_saved_audit_metadata_for_navigation
} from '../../js/logic/audit_default_entry_view.js';

describe('audit_default_entry_view', () => {
    test('has_saved_audit_metadata_for_navigation: kräver actorName och auditorName', () => {
        expect(has_saved_audit_metadata_for_navigation(null)).toBe(false);
        expect(has_saved_audit_metadata_for_navigation({ auditMetadata: {} })).toBe(false);
        expect(
            has_saved_audit_metadata_for_navigation({
                auditMetadata: { actorName: 'A', auditorName: '' }
            })
        ).toBe(false);
        expect(
            has_saved_audit_metadata_for_navigation({
                auditMetadata: { actorName: ' A ', auditorName: ' B ' }
            })
        ).toBe(true);
    });

    test('default_view: not_started med sparad metadata → sample_management även utan stickprov', () => {
        expect(
            default_view_for_loaded_audit_state({
                auditStatus: 'not_started',
                samples: [],
                auditMetadata: { actorName: 'Aktör', auditorName: 'Granskare' }
            })
        ).toBe('sample_management');
    });

    test('default_view: not_started med stickprov men utan sparad metadata → metadata', () => {
        expect(
            default_view_for_loaded_audit_state({
                auditStatus: 'not_started',
                samples: [{ id: '1' }],
                auditMetadata: { actorName: '', auditorName: '' }
            })
        ).toBe('metadata');
    });

    test('default_view: in_progress → audit_overview', () => {
        expect(
            default_view_for_loaded_audit_state({
                auditStatus: 'in_progress',
                samples: [],
                auditMetadata: { actorName: 'A', auditorName: 'B' }
            })
        ).toBe('audit_overview');
    });
});
