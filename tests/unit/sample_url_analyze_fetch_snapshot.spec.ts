import {
    capture_sample_url_analyze_fetch_snapshot,
} from '../../js/components/add_sample_form/sample_url_analyze_fetch_snapshot.ts';

describe('sample_url_analyze_fetch_snapshot', () => {
    test('capture_sample_url_analyze_fetch_snapshot sparar formulärläge', () => {
        const host = {
            description_input: { value: 'Min titel' },
            previous_url_page_title: 'Gammal titel',
            sample_attached_media_filenames: ['a.png', 'b.png'],
            url_auto_screenshot_filename: 'auto.png',
            url_auto_screenshot_source_url: 'https://example.com',
        };

        const snapshot = capture_sample_url_analyze_fetch_snapshot(host as never);

        expect(snapshot).toEqual({
            description: 'Min titel',
            previous_url_page_title: 'Gammal titel',
            attached_media_filenames: ['a.png', 'b.png'],
            url_auto_screenshot_filename: 'auto.png',
            url_auto_screenshot_source_url: 'https://example.com',
        });
    });
});
