/**
 * Enhetstester för init av innehållstypsval med förvalda undertyper.
 */
import { describe, test, expect } from '@jest/globals';
import { init_content_type_selection } from '../../js/components/add_sample_form/content_type_accordion.ts';

const metadata = {
    contentTypes: [
        {
            id: 'innehall',
            text: 'Innehåll',
            types: [
                { id: 'headings', text: 'Rubriker', defaultSelected: true },
                { id: 'links', text: 'Länkar' },
            ],
        },
    ],
};

describe('content_type_accordion defaults', () => {
    test('init_content_type_selection förkryssar förvalda för ny granskningsdel', () => {
        const component: { content_type_selected_ids?: Set<string> } = {};
        init_content_type_selection(component, null, metadata, true);
        expect(Array.from(component.content_type_selected_ids ?? [])).toEqual(['headings']);
    });

    test('init_content_type_selection använder sparade val vid redigering', () => {
        const component: { content_type_selected_ids?: Set<string> } = {};
        init_content_type_selection(component, { selectedContentTypes: ['links'] }, metadata, false);
        expect(Array.from(component.content_type_selected_ids ?? [])).toEqual(['links']);
    });
});
