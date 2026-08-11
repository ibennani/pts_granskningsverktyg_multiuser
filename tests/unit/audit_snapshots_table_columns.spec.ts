import { describe, test, expect, jest } from '@jest/globals';
import {
    build_audit_snapshots_table_columns,
    map_snapshot_items_to_table_rows,
    resolve_snapshot_sample_label,
} from '../../js/utils/audit_snapshots_table_columns.ts';

const base_row = {
    sampleId: 's1',
    sampleDescription: 'Gammalt namn',
    requestedUrl: 'https://example.com/page',
    pageTitle: 'Sidtitel',
    currentReady: {
        snapshotId: 'snap-1',
        capturedAt: '2026-08-10T10:00:00.000Z',
        status: 'ready' as const,
        warningCount: 0,
        sizeBytes: 1024,
    },
    pendingAttempt: null,
    rowId: 's1',
};

function make_deps(overrides: Record<string, unknown> = {}) {
    const router = jest.fn();
    return {
        Helpers: {
            create_element: (tag: string, opts: Record<string, unknown> = {}) => {
                const el = document.createElement(tag);
                if (opts.class_name) el.className = String(opts.class_name);
                if (opts.text_content) el.textContent = String(opts.text_content);
                if (opts.attributes && typeof opts.attributes === 'object') {
                    for (const [key, value] of Object.entries(opts.attributes as Record<string, string>)) {
                        el.setAttribute(key, value);
                    }
                }
                return el;
            },
            get_icon_svg: () => '',
        },
        Translation: { get_current_language_code: () => 'sv-SE' },
        t: (key: string) => key,
        getState: () => ({
            samples: [{ id: 's1', description: 'Startsida', url: 'https://example.com' }],
        }),
        router,
        ...overrides,
    };
}

describe('audit_snapshots_table_columns', () => {
    test('resolve_snapshot_sample_label använder granskningsdelens namn från state', () => {
        const label = resolve_snapshot_sample_label(
            base_row,
            [{ id: 's1', description: 'Kontaktsida' }],
            (key) => key
        );
        expect(label).toBe('Kontaktsida');
    });

    test('granskningsdel-kolumnen länkar till redigering av granskningsdel', () => {
        const deps = make_deps();
        const columns = build_audit_snapshots_table_columns(
            deps as never,
            { on_download: async () => {}, on_delete: () => {}, on_retake: () => {} },
            () => '—'
        );
        const sample_col = columns[0];
        const cell = sample_col.getContent(base_row) as HTMLAnchorElement;

        expect(cell.tagName).toBe('A');
        expect(cell.textContent).toBe('Startsida');
        expect(cell.getAttribute('href')).toContain('editSampleId=s1');

        cell.click();
        expect(deps.router).toHaveBeenCalledWith('sample_form', { editSampleId: 's1' });
    });

    test('map_snapshot_items_to_table_rows utelämnar granskningsdel utan URL', () => {
        const rows = map_snapshot_items_to_table_rows(
            [
                {
                    sampleId: 's1',
                    requestedUrl: 'https://example.com',
                    pageTitle: null,
                    currentReady: base_row.currentReady,
                    pendingAttempt: null,
                },
                {
                    sampleId: 's2',
                    requestedUrl: '',
                    pageTitle: null,
                    currentReady: {
                        ...base_row.currentReady,
                        snapshotId: 'snap-2',
                    },
                    pendingAttempt: null,
                },
            ],
            [
                { id: 's1', description: 'Med URL', url: 'https://example.com' },
                { id: 's2', description: 'Återkommande', url: '' },
            ]
        );

        expect(rows).toHaveLength(1);
        expect(rows[0].sampleId).toBe('s1');
    });

    test('tabellen har ingen URL-kolumn', () => {
        const deps = make_deps();
        const columns = build_audit_snapshots_table_columns(
            deps as never,
            { on_download: async () => {}, on_delete: () => {}, on_retake: () => {} },
            () => '—'
        );
        expect(columns.some((col) => col.columnKey === 'url')).toBe(false);
    });

    test('åtgärdskolumnen visar status med spinner när sidrapport skapas', () => {
        const deps = make_deps({
            is_sidrapport_retake_busy: () => true,
        });
        const columns = build_audit_snapshots_table_columns(
            deps as never,
            { on_download: async () => {}, on_delete: () => {}, on_retake: () => {} },
            () => '—'
        );
        const actions_col = columns.find((col) => col.columnKey === 'actions');
        const cell = actions_col?.getContent(base_row) as HTMLElement;
        const status = cell.querySelector('[role="status"]');

        expect(status).toBeTruthy();
        expect(status?.textContent).toContain('audit_sidrapport_retake_creating');
        expect(status?.querySelector('.audit-sidrapport-retake-status__spinner')).toBeTruthy();
        expect(cell.querySelector('button.button-success')).toBeNull();
        expect(cell.querySelector('button.button-danger')).toBeNull();
        expect(cell.textContent).not.toContain('audit_snapshots_download_one');
    });

    test('döljer föregående rapports datum, varningar och storlek under ny capture', () => {
        const row_with_pending = {
            ...base_row,
            currentReady: {
                ...base_row.currentReady,
                warningCount: 1,
                warnings: [{ code: 'body_unavailable', message: 'x' }],
                sizeBytes: 11_000_000,
            },
            pendingAttempt: {
                snapshotId: 'snap-2',
                status: 'capturing' as const,
                warningCount: 0,
                sizeBytes: null,
                error: null,
            },
        };
        const deps = make_deps();
        const columns = build_audit_snapshots_table_columns(
            deps as never,
            { on_download: async () => {}, on_delete: () => {}, on_retake: () => {} },
            () => '2026-08-11 16:03:49'
        );

        const captured_col = columns.find((col) => col.columnKey === 'captured');
        const status_col = columns.find((col) => col.columnKey === 'status');
        const size_col = columns.find((col) => col.columnKey === 'size');
        const actions_col = columns.find((col) => col.columnKey === 'actions');

        expect(captured_col?.getContent(row_with_pending)).toBe('—');
        expect(size_col?.getContent(row_with_pending)).toBe('—');

        const status_cell = status_col?.getContent(row_with_pending) as HTMLElement;
        expect(status_cell.textContent).toContain('audit_snapshots_status_capturing');
        expect(status_cell.textContent).not.toContain('audit_snapshots_status_ready_warnings');
        expect(status_cell.querySelector('.audit-actions-snapshots__warning-list')).toBeNull();

        const actions_cell = actions_col?.getContent(row_with_pending) as HTMLElement;
        expect(actions_cell.textContent).not.toContain('audit_snapshots_download_one');
        expect(actions_cell.querySelector('button.button-danger')).toBeNull();
    });
});
