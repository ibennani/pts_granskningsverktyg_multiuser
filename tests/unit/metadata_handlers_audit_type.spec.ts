/**
 * @file Enhetstester för granskningstyp i reduce_update_metadata.
 */
import { reduce_update_metadata } from '../../js/state/metadataHandlers.js';

const base_state = {
    auditStatus: 'in_progress',
    auditMetadata: {
        actorName: 'Aktör',
        auditorName: 'Granskare',
        auditTypeId: '',
        auditTypeLabel: '',
    },
};

describe('reduce_update_metadata auditTypeId', () => {
    test('tillåter första valet av granskningstyp under pågående granskning', () => {
        const next = reduce_update_metadata(base_state, {
            payload: {
                auditTypeId: 'tillsyn-lptt',
                auditTypeLabel: 'Tillsyn LPTT',
            },
        });
        expect(next.auditMetadata.auditTypeId).toBe('tillsyn-lptt');
        expect(next.auditMetadata.auditTypeLabel).toBe('Tillsyn LPTT');
    });

    test('blockerar ändring när granskningstyp redan är satt', () => {
        const with_type = {
            ...base_state,
            auditMetadata: {
                ...base_state.auditMetadata,
                auditTypeId: 'tillsyn-lptt',
                auditTypeLabel: 'Tillsyn LPTT',
            },
        };
        const next = reduce_update_metadata(with_type, {
            payload: {
                auditTypeId: 'marknadskontroll-lptt',
                auditTypeLabel: 'Marknadskontroll, LPTT',
            },
        });
        expect(next.auditMetadata.auditTypeId).toBe('tillsyn-lptt');
        expect(next.auditMetadata.auditTypeLabel).toBe('Tillsyn LPTT');
    });

    test('blockerar granskningstyp i arkiverat läge även om typ saknas', () => {
        const archived = { ...base_state, auditStatus: 'archived' };
        const next = reduce_update_metadata(archived, {
            payload: {
                auditTypeId: 'tillsyn-lptt',
                auditTypeLabel: 'Tillsyn LPTT',
            },
        });
        expect(next.auditMetadata.auditTypeId).toBe('');
        expect(next.auditMetadata.auditTypeLabel).toBe('');
    });
});
