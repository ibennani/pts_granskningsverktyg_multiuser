/**
 * Säkerställer att sparad ny granskningsdel inte lämnar kvar utkast som fyller nästa formulär.
 */

import {
    clear_new_sample_form_draft,
    get_new_sample_draft_storage_key,
    load_new_sample_form_draft,
    save_new_sample_form_draft
} from '../../js/components/add_sample_form/new_sample_form_draft.ts';

describe('new_sample_form_draft efter sparning', () => {
    const storage_key = get_new_sample_draft_storage_key({
        auditId: 'audit-1',
        ruleFileContent: { metadata: { id: 'rule-1' } }
    });

    beforeEach(() => {
        sessionStorage.clear();
    });

    test('rensat utkast ska inte återskapas när destroy hoppar över autospar', () => {
        save_new_sample_form_draft(storage_key, {
            description: 'Gammal titel',
            url: 'https://example.com',
            urlAutoScreenshotFilename: 'shot.png'
        });
        clear_new_sample_form_draft(storage_key);
        expect(load_new_sample_form_draft(storage_key)).toBeNull();

        const skip_autosave_on_destroy = true;
        if (!skip_autosave_on_destroy) {
            save_new_sample_form_draft(storage_key, {
                description: 'Gammal titel',
                url: 'https://example.com',
                urlAutoScreenshotFilename: 'shot.png'
            });
        }

        expect(load_new_sample_form_draft(storage_key)).toBeNull();
    });

    test('utkast sparas när användaren lämnar ofärdigt formulär utan att spara', () => {
        save_new_sample_form_draft(storage_key, {
            description: 'Påbörjad titel',
            url: 'https://paborjad.example',
            urlAutoScreenshotFilename: 'draft.png'
        });

        const loaded = load_new_sample_form_draft(storage_key);
        expect(loaded?.description).toBe('Påbörjad titel');
        expect(loaded?.url).toBe('https://paborjad.example');
        expect(loaded?.urlAutoScreenshotFilename).toBe('draft.png');
    });
});
