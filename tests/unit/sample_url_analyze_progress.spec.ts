import {
    build_sample_url_analyze_progress_message,
    build_sample_url_analyze_progress_value_text,
} from '../../js/components/add_sample_form/sample_url_analyze_progress.ts';

const t = (key: string, params?: Record<string, unknown>) => {
    const map: Record<string, string> = {
        sample_url_analyze_progress_waiting: 'Väntar {total}',
        sample_url_analyze_progress_started: 'Start {total}',
        sample_url_analyze_progress_partial: '{completed} av {total}',
        sample_url_analyze_progress_done: 'Klar',
        sample_url_analyze_progress_done_with_errors: '{failed} av {total} fel',
    };
    let text = map[key] ?? key;
    if (params) {
        for (const [name, value] of Object.entries(params)) {
            text = text.replace(`{${name}}`, String(value));
        }
    }
    return text;
};

describe('sample_url_analyze_progress', () => {
    test('build_sample_url_analyze_progress_message vid körning', () => {
        expect(
            build_sample_url_analyze_progress_message(t, {
                completed: 0,
                total: 2,
                failed: 0,
                phase: 'running',
            })
        ).toBe('Start 2');

        expect(
            build_sample_url_analyze_progress_message(t, {
                completed: 1,
                total: 2,
                failed: 0,
                phase: 'running',
            })
        ).toBe('1 av 2');
    });

    test('build_sample_url_analyze_progress_message vid klart', () => {
        expect(
            build_sample_url_analyze_progress_message(t, {
                completed: 2,
                total: 2,
                failed: 0,
                phase: 'done',
            })
        ).toBe('Klar');

        expect(
            build_sample_url_analyze_progress_message(t, {
                completed: 2,
                total: 2,
                failed: 1,
                phase: 'done',
            })
        ).toBe('1 av 2 fel');
    });

    test('build_sample_url_analyze_progress_value_text faller tillbaka till vänteläge', () => {
        expect(
            build_sample_url_analyze_progress_value_text(t, {
                completed: 0,
                total: 2,
                failed: 0,
                phase: 'idle',
            })
        ).toBe('Väntar 2');
    });
});
