/**
 * @fileoverview Enhetstester för stegbaserad bulkimport-status.
 */
import {
    advance_bulk_import_step_progress,
    build_bulk_import_live_status_text,
    calculate_bulk_import_total_steps,
    create_bulk_import_step_progress,
    format_bulk_import_sample_label,
} from '../../js/logic/bulk_url_import_step_progress.ts';

const t = (key: string, params: Record<string, unknown> = {}) => {
    const parts = [key];
    for (const [name, value] of Object.entries(params)) {
        parts.push(`${name}=${String(value)}`);
    }
    return parts.join('|');
};

describe('bulk_url_import_step_progress', () => {
    test('calculate_bulk_import_total_steps', () => {
        expect(calculate_bulk_import_total_steps(3)).toBe(36);
        expect(calculate_bulk_import_total_steps(1)).toBe(14);
    });

    test('format_bulk_import_sample_label prefers title', () => {
        expect(format_bulk_import_sample_label('https://nelly.com/x', 'Nelly start')).toBe('Nelly start');
    });

    test('live status follows log steps', () => {
        let state = { ...create_bulk_import_step_progress(2, t), phase: 'running' as const };
        state = advance_bulk_import_step_progress(
            state,
            t,
            'bulk_url_import_log_batch_start',
            { count: 2 },
            ''
        );
        state = advance_bulk_import_step_progress(
            state,
            t,
            'bulk_url_import_log_batch_audit',
            {},
            ''
        );
        state = advance_bulk_import_step_progress(
            state,
            t,
            'bulk_url_import_log_row_start',
            { index: 1, total: 2 },
            'nelly.com'
        );
        const text = build_bulk_import_live_status_text(t, state);
        expect(text).toContain('current=3');
        expect(text).toContain('total=25');
        expect(text).toContain('bulk_url_import_step_row_start');
    });

    test('batch_done sets current to total', () => {
        let state = create_bulk_import_step_progress(1, t);
        state = { ...state, current: 10, phase: 'running' };
        state = advance_bulk_import_step_progress(
            state,
            t,
            'bulk_url_import_log_batch_done',
            { success: 1, failed: 0 },
            ''
        );
        expect(state.current).toBe(state.total);
        expect(state.phase).toBe('done');
    });
});
