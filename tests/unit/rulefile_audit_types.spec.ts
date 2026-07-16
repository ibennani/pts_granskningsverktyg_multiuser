/**
 * @file Enhetstester för granskningstyper i regelfilsmetadata.
 */
import {
    DEFAULT_AUDIT_TYPES,
    ensure_audit_types_for_edit,
    normalize_audit_types_for_persist,
    resolve_audit_types,
} from '../../shared/rulefile/rulefile_audit_types.ts';

describe('rulefile_audit_types', () => {
    test('resolve_audit_types returnerar tom lista om fält saknas', () => {
        expect(resolve_audit_types({})).toEqual([]);
        expect(resolve_audit_types({ auditTypes: null })).toEqual([]);
    });

    test('resolve_audit_types filtrerar ogiltiga rader och genererar id från etikett', () => {
        const rows = resolve_audit_types({
            auditTypes: [
                { label: 'Tillsyn', taxonomyId: 'wcag22-pour' },
                { id: 'x', label: '', taxonomyId: 'wcag22-pour' },
                { id: 'y', label: 'Ok', taxonomyId: '' },
            ],
        });
        expect(rows).toEqual([{ id: 'tillsyn', label: 'Tillsyn', taxonomyId: 'wcag22-pour' }]);
    });

    test('ensure_audit_types_for_edit seedar standardvärden', () => {
        const metadata: Record<string, unknown> = {};
        const rows = ensure_audit_types_for_edit(metadata);
        expect(rows).toHaveLength(DEFAULT_AUDIT_TYPES.length);
        expect(metadata.auditTypes).toEqual(DEFAULT_AUDIT_TYPES);
    });

    test('normalize_audit_types_for_persist trimmar och stabiliserar id', () => {
        const metadata: Record<string, unknown> = {
            auditTypes: [{ label: '  Ny typ  ', taxonomyId: 'wcag22-pour' }],
        };
        normalize_audit_types_for_persist(metadata);
        expect(metadata.auditTypes).toEqual([{ id: 'ny-typ', label: 'Ny typ', taxonomyId: 'wcag22-pour' }]);
    });
});
