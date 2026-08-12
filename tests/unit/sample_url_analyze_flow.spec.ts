import { jest } from '@jest/globals';
import { cancel_sample_url_analyze_tasks } from '../../js/components/add_sample_form/sample_url_analyze_flow.ts';
import { get_sample_url_analyze_task_ids, get_sample_url_analyze_tasks } from '../../js/components/add_sample_form/sample_url_analyze_tasks.ts';

describe('sample_url_analyze_flow', () => {
    test('cancel_sample_url_analyze_tasks ökar generation och avbryter deluppgifter', () => {
        const host = {
            url_analyze_generation: 1,
            url_page_title_generation: 0,
            url_auto_screenshot_generation: 0,
            bump_url_analyze_generation: jest.fn(() => {
                host.url_analyze_generation = 2;
                return 2;
            }),
        };

        cancel_sample_url_analyze_tasks(host as never);
        expect(host.bump_url_analyze_generation).toHaveBeenCalled();
        expect(host.url_analyze_generation).toBe(2);
        expect(host.url_page_title_generation).toBe(1);
        expect(host.url_auto_screenshot_generation).toBe(1);
    });
});

describe('sample_url_analyze_tasks', () => {
    test('get_sample_url_analyze_tasks innehåller sidtitel och skärmavbild', () => {
        const tasks = get_sample_url_analyze_tasks();
        expect(tasks.map((task) => task.id)).toEqual(['page_title', 'screenshot']);
        expect(get_sample_url_analyze_task_ids()).toEqual(['page_title', 'screenshot']);
        expect(tasks).toHaveLength(2);
    });
});
