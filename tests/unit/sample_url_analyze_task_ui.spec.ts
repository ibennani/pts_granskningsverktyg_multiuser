import { create_element } from '../../js/dom/create_element.js';
import { get_icon_svg } from '../../js/ui/icons.js';
import {
    create_sample_url_analyze_task_row,
    set_sample_url_analyze_task_row_state,
} from '../../js/components/add_sample_form/sample_url_analyze_task_ui.ts';

const Helpers = { create_element, get_icon_svg };

const t = (key: string) => {
    const map: Record<string, string> = {
        sample_url_analyze_task_page_title: 'Hämta sidtitel',
        sample_url_analyze_task_status_pending: 'Väntar',
        sample_url_analyze_task_status_running: 'Pågår',
        sample_url_analyze_task_status_success: 'Klar',
        sample_url_analyze_task_status_failed: 'Misslyckades',
    };
    return map[key] ?? key;
};

describe('sample_url_analyze_task_ui', () => {
    test('create_sample_url_analyze_task_row renderar etikett och tom status', () => {
        const row = create_sample_url_analyze_task_row(
            Helpers,
            t,
            'page_title',
            'sample_url_analyze_task_page_title'
        );

        expect(row.row.getAttribute('data-task-id')).toBe('page_title');
        expect(row.row.querySelector('.sample-url-analyze-task__content .sample-url-analyze-task__label')?.textContent).toBe('Hämta sidtitel');
        expect(row.status_el.innerHTML).toBe('');
        expect(row.sr_status_el.textContent).toBe('Väntar');
    });

    test('set_sample_url_analyze_task_row_state visar spinner och bock', () => {
        const row = create_sample_url_analyze_task_row(
            Helpers,
            t,
            'screenshot',
            'sample_url_analyze_task_page_title'
        );

        set_sample_url_analyze_task_row_state(row, 'loading', Helpers, t);
        expect(row.sr_status_el.textContent).toBe('Pågår');
        expect(row.status_el.querySelector('.generic-tooltip-spinner')).not.toBeNull();

        set_sample_url_analyze_task_row_state(row, 'success', Helpers, t);
        expect(row.sr_status_el.textContent).toBe('Klar');
        expect(row.status_el.querySelector('.generic-tooltip__icon--ready')).not.toBeNull();
    });
});
