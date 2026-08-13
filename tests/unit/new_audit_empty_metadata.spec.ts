/**
 * @fileoverview Tester för tom metadata vid ny granskning.
 */
import { describe, expect, test } from '@jest/globals';
import {
    build_empty_new_audit_metadata_form_data,
    new_audit_metadata_differs_from_empty_form,
    new_audit_metadata_differs_from_reference_form
} from '../../js/logic/new_audit_empty_metadata.js';
import { reduce_update_metadata } from '../../js/state/metadataHandlers.ts';

describe('new_audit_empty_metadata', () => {
    test('build_empty_new_audit_metadata_form_data fyller bara granskare', () => {
        expect(build_empty_new_audit_metadata_form_data('Anna')).toMatchObject({
            caseNumber: '',
            actorName: '',
            actorLink: '',
            auditorName: 'Anna',
            caseHandler: '',
            internalComment: '',
            auditTypeId: '',
            auditTypeLabel: '',
        });
    });

    test('new_audit_metadata_differs_from_reference_form upptäcker avvikelse mot tom referens', () => {
        const reference = build_empty_new_audit_metadata_form_data('Anna');
        expect(new_audit_metadata_differs_from_reference_form({ actorName: 'AB' }, reference)).toBe(true);
        expect(new_audit_metadata_differs_from_reference_form({ auditorName: 'Anna' }, reference)).toBe(false);
    });

    test('new_audit_metadata_differs_from_empty_form upptäcker gammal metadata', () => {
        expect(
            new_audit_metadata_differs_from_empty_form(
                { caseNumber: '2024-1', auditorName: 'Anna' },
                'Anna'
            )
        ).toBe(true);
        expect(
            new_audit_metadata_differs_from_empty_form(
                { auditorName: 'Anna' },
                'Anna'
            )
        ).toBe(false);
    });
});

describe('reduce_update_metadata freshNewAuditMetadata', () => {
    test('behåller freshNewAuditMetadata vid preserve_fresh_new_audit_metadata', () => {
        const next = reduce_update_metadata(
            {
                auditStatus: 'not_started',
                freshNewAuditMetadata: true,
                auditMetadata: { caseNumber: 'gammalt', auditorName: 'Anna' }
            },
            {
                payload: {
                    caseNumber: '',
                    auditorName: 'Anna',
                    skip_render: true,
                    skip_server_sync: true,
                    preserve_fresh_new_audit_metadata: true
                }
            }
        );
        expect(next.freshNewAuditMetadata).toBe(true);
        expect(next.auditMetadata.caseNumber).toBe('');
    });

    test('rensar freshNewAuditMetadata vid vanlig metadatauppdatering', () => {
        const next = reduce_update_metadata(
            {
                auditStatus: 'not_started',
                freshNewAuditMetadata: true,
                auditMetadata: { auditorName: 'Anna' }
            },
            {
                payload: {
                    actorName: 'Aktör AB',
                    skip_render: true
                }
            }
        );
        expect(next.freshNewAuditMetadata).toBe(false);
        expect(next.auditMetadata.actorName).toBe('Aktör AB');
    });
});
