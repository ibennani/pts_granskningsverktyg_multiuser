import {
    classify_sample_edit_change,
    compute_sample_edit_field_diff,
    sample_edit_analysis_has_content_type_changes
} from '../../js/logic/sample_edit_diff.ts';

describe('compute_sample_edit_field_diff', () => {
    test('ger diff för ändrade fält och innehållstyper', () => {
        const out = compute_sample_edit_field_diff({
            old_sample: {
                sampleCategory: 'cat1',
                sampleType: 'type1',
                description: 'Gammal',
                url: '',
                selectedContentTypes: ['a', 'b']
            },
            new_sample: {
                sampleCategory: 'cat2',
                sampleType: 'type1',
                description: 'Ny',
                url: 'https://exempel.se',
                selectedContentTypes: ['b', 'c']
            },
            resolve_sample_category_label: (id) => `Kategori:${id}`,
            resolve_sample_type_label: (id) => `Typ:${id}`,
            resolve_content_type_label: (id) => `CT:${id}`
        });

        expect(out.changed_fields).toEqual([
            { key: 'sampleCategory', oldValue: 'Kategori:cat1', newValue: 'Kategori:cat2' },
            { key: 'description', oldValue: 'Gammal', newValue: 'Ny' },
            { key: 'url', oldValue: '', newValue: 'https://exempel.se' }
        ]);

        expect(out.content_types_diff).toEqual({
            added: ['CT:c'],
            removed: ['CT:a']
        });
    });

    test('tomma värden normaliseras och ger inte extra diff', () => {
        const out = compute_sample_edit_field_diff({
            old_sample: { description: null, url: undefined, selectedContentTypes: null },
            new_sample: { description: '', url: '', selectedContentTypes: [] },
            resolve_sample_category_label: (id) => id,
            resolve_sample_type_label: (id) => id,
            resolve_content_type_label: (id) => id
        });

        expect(out.changed_fields).toEqual([]);
        expect(out.content_types_diff).toEqual({ added: [], removed: [] });
    });
});

describe('classify_sample_edit_change', () => {
    const baseline = {
        sampleCategory: 'cat1',
        sampleType: 'type1',
        description: 'Beskrivning',
        url: 'https://exempel.se',
        selectedContentTypes: ['a', 'b'],
        attachedMediaFilenames: ['old.png']
    };

    test('returnerar none när inget ändrats', () => {
        expect(classify_sample_edit_change(baseline, { ...baseline })).toBe('none');
    });

    test('returnerar media_only när enbart bifogade filer ändrats', () => {
        expect(classify_sample_edit_change(baseline, {
            ...baseline,
            attachedMediaFilenames: ['old.png', 'new.png']
        })).toBe('media_only');
    });

    test('returnerar other när innehållstyper ändrats', () => {
        expect(classify_sample_edit_change(baseline, {
            ...baseline,
            selectedContentTypes: ['a']
        })).toBe('other');
    });
});

describe('sample_edit_analysis_has_content_type_changes', () => {
    test('returnerar false utan tillagda eller borttagna typer', () => {
        expect(sample_edit_analysis_has_content_type_changes({
            content_types_diff: { added: [], removed: [] }
        })).toBe(false);
    });

    test('returnerar true när innehållstyper lagts till', () => {
        expect(sample_edit_analysis_has_content_type_changes({
            content_types_diff: { added: ['Text'], removed: [] }
        })).toBe(true);
    });
});

