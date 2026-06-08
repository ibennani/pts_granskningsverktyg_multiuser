/**
 * Enhetstester för sessionStorage-utkast vid nytt stickprov.
 */

import {
    clear_new_sample_form_draft,
    get_new_sample_draft_storage_key,
    load_new_sample_form_draft,
    save_new_sample_form_draft
} from '../../js/components/add_sample_form/new_sample_form_draft.ts';

describe('new_sample_form_draft', () => {
    const storage_key = 'gv_new_sample_form_draft_test';

    beforeEach(() => {
        sessionStorage.clear();
    });

    test('get_new_sample_draft_storage_key använder auditId när den finns', () => {
        expect(get_new_sample_draft_storage_key({ auditId: 'a1', ruleFileContent: { metadata: { id: 'r1' } } }))
            .toBe('gv_new_sample_form_draft_audit_a1');
    });

    test('sparar och laddar utkast', () => {
        save_new_sample_form_draft(storage_key, {
            sampleCategory: 'cat1',
            description: 'Test',
            selectedContentTypes: ['ct1']
        });
        const loaded = load_new_sample_form_draft(storage_key);
        expect(loaded?.sampleCategory).toBe('cat1');
        expect(loaded?.description).toBe('Test');
        expect(loaded?.selectedContentTypes).toEqual(['ct1']);
    });

    test('clear tar bort utkast', () => {
        save_new_sample_form_draft(storage_key, { description: 'X' });
        clear_new_sample_form_draft(storage_key);
        expect(load_new_sample_form_draft(storage_key)).toBeNull();
    });
});
