/**
 * @fileoverview Enhetstester för form host vid URL-skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import { build_sample_url_screenshot_form_host } from '../../js/components/add_sample_form/sample_url_screenshot_form_host.ts';

describe('sample_url_screenshot_form_host', () => {
    test('get_t_internally behåller översättningsfunktion från formuläret', () => {
        const form = {
            url_input: null,
            url_form_group_ref: null,
            sample_attach_media_btn: null,
            current_editing_sample_id: null,
            sample_attached_media_filenames: [] as string[],
            url_auto_screenshot_filename: null,
            url_auto_screenshot_source_url: null,
            url_auto_screenshot_generation: 0,
            sample_url_screenshot_in_progress: false,
            get_t_internally() {
                return (key: string) => `översatt:${key}`;
            },
            save_form_data_immediately: () => {},
            _persist_new_sample_draft: () => {}
        };

        const host = build_sample_url_screenshot_form_host(form);
        const t = host.get_t_internally();
        expect(t('attach_media_button')).toBe('översatt:attach_media_button');
    });
});
