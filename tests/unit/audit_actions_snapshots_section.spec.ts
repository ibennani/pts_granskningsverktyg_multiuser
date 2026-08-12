import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const list_api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.js');
const push_path = path.join(spec_dir, '../../js/logic/list_push_service.js');

const list_mock = jest.fn();

const retake_mock = jest.fn();

jest.unstable_mockModule(list_api_path, () => ({
    list_audit_snapshots: list_mock,
    get_audit_snapshot_download_url: jest.fn(() => '/download'),
    get_audit_snapshots_download_all_url: jest.fn(() => '/download-all'),
    delete_audit_snapshots_for_sample: jest.fn(async () => {}),
    start_audit_snapshot_capture: jest.fn(async () => ({})),
}));

const retake_path = path.join(spec_dir, '../../js/logic/audit_sidrapport_retake.js');
jest.unstable_mockModule(retake_path, () => ({
    start_sidrapport_retake_for_sample: retake_mock,
    is_sidrapport_retake_in_progress: jest.fn(() => false),
    resolve_sidrapport_capture_url: jest.fn((sample) => (sample?.url ?? '').trim()),
    resolve_retake_sample_for_row: (
        row: { sampleId: string; requestedUrl?: string },
        samples?: Array<{ id: string; url?: string }>
    ) => {
        const from_state = samples?.find((entry) => String(entry.id) === String(row.sampleId));
        if (from_state) return from_state;
        const url = (row.requestedUrl ?? '').trim();
        if (!url) return null;
        return { id: String(row.sampleId), url };
    },
}));

jest.unstable_mockModule(push_path, () => ({
    subscribe_audit_snapshots: jest.fn(() => () => {}),
}));

const confirm_modal_path = path.join(spec_dir, '../../js/logic/confirm_delete_modal_logic.js');
jest.unstable_mockModule(confirm_modal_path, () => ({
    show_confirm_delete_modal: jest.fn(),
}));

const { create_audit_actions_snapshots_section } = await import(
    '../../js/components/audit_actions_snapshots_section.ts'
);

function make_deps() {
    return {
        Helpers: {
            create_element: (tag: string, opts: Record<string, unknown> = {}) => {
                const el = document.createElement(tag);
                if (opts.class_name) {
                    el.className = Array.isArray(opts.class_name)
                        ? opts.class_name.join(' ')
                        : String(opts.class_name);
                }
                if (opts.text_content) el.textContent = String(opts.text_content);
                if (opts.attributes && typeof opts.attributes === 'object') {
                    for (const [key, value] of Object.entries(opts.attributes as Record<string, string>)) {
                        el.setAttribute(key, value);
                    }
                }
                return el;
            },
            format_iso_to_local_datetime: (iso: string) => iso,
        },
        Translation: {
            t: (key: string) => key,
            get_current_language_code: () => 'sv-SE',
        },
        getState: () => ({
            auditId: 'audit-1',
            samples: [{ id: 's1', description: 'Startsida', url: 'https://example.com' }],
        }),
        router: jest.fn(),
    };
}

describe('audit_actions_snapshots_section', () => {
    beforeEach(() => {
        list_mock.mockReset();
    });

    test('visar empty state när inga snapshots finns', async () => {
        list_mock.mockResolvedValue({ items: [] });
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();
        expect(section.root.textContent).toContain('audit_snapshots_intro_item_screenshot');
        expect(section.root.textContent).toContain('audit_snapshots_empty');
        section.destroy();
        section.root.remove();
    });

    test('renderar tabell när färdig snapshot finns', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 's1',
                    sampleDescription: 'Startsida',
                    requestedUrl: 'https://example.com',
                    pageTitle: 'Exempel',
                    currentReady: {
                        snapshotId: 'snap-1',
                        capturedAt: '2026-08-10T10:00:00.000Z',
                        status: 'ready',
                        warningCount: 0,
                        sizeBytes: 2048,
                    },
                    pendingAttempt: null,
                },
            ],
        });
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();
        expect(section.root.querySelector('.generic-table')).toBeTruthy();
        expect(section.root.textContent).toContain('Startsida');
        const sample_link = section.root.querySelector('a.generic-table-audit-link');
        expect(sample_link).toBeTruthy();
        expect(sample_link?.getAttribute('href')).toContain('editSampleId=s1');
        expect(section.root.querySelector('.audit-actions-snapshots__toolbar')).toBeTruthy();
        expect(section.root.querySelector('.audit-actions-snapshots__download-all-wrap')).toBeTruthy();
        expect(section.root.textContent).toContain('audit_sidrapport_retake_all_button');
        section.destroy();
        section.root.remove();
    });

    test('visar Skapa sidrapporter när inga färdiga sidrapporter finns', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 's1',
                    sampleDescription: 'Startsida',
                    requestedUrl: 'https://example.com',
                    pageTitle: null,
                    currentReady: null,
                    pendingAttempt: null,
                },
            ],
        });
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();
        expect(section.root.textContent).toContain('audit_sidrapport_create_all_button');
        expect(section.root.textContent).not.toContain('audit_sidrapport_retake_all_button');
        const bulk_button = section.root.querySelector('.audit-actions-snapshots__retake-all');
        expect(bulk_button?.classList.contains('button-small')).toBe(true);
        section.destroy();
        section.root.remove();
    });

    test('visar varningsram utan verktygsrad när listan inte kan hämtas', async () => {
        list_mock.mockRejectedValue(new Error('network'));
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();
        const error_el = section.root.querySelector('.audit-actions-snapshots__load-error');
        expect(error_el).toBeTruthy();
        expect(error_el?.getAttribute('role')).toBe('alert');
        expect(section.root.textContent).toContain('audit_snapshots_load_error');
        expect(section.root.querySelector('.audit-actions-snapshots__toolbar')).toBeFalsy();
        expect(section.root.querySelector('.generic-table')).toBeFalsy();
        section.destroy();
        section.root.remove();
    });

    test('döljer verktygsrad efter laddningsfel även om tabellen visades tidigare', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 's1',
                    sampleDescription: 'Startsida',
                    requestedUrl: 'https://example.com',
                    pageTitle: null,
                    currentReady: null,
                    pendingAttempt: null,
                },
            ],
        });
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();
        expect(section.root.querySelector('.audit-actions-snapshots__toolbar')).toBeTruthy();
        list_mock.mockRejectedValueOnce(new Error('network'));
        await section.refresh();
        expect(section.root.querySelector('.audit-actions-snapshots__load-error')).toBeTruthy();
        expect(section.root.querySelector('.audit-actions-snapshots__toolbar')).toBeFalsy();
        section.destroy();
        section.root.remove();
    });

    test('visar Skapa sidrapporter vid misslyckad sidrapport utan färdig', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 's1',
                    sampleDescription: 'Startsida',
                    requestedUrl: 'https://example.com',
                    pageTitle: 'Exempel',
                    currentReady: null,
                    pendingAttempt: {
                        snapshotId: 'snap-fail',
                        status: 'failed',
                        capturedAt: null,
                        warningCount: 0,
                        sizeBytes: null,
                    },
                },
            ],
        });
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();
        expect(section.root.textContent).not.toContain('audit_snapshots_download_all');
        expect(section.root.querySelector('.audit-actions-snapshots__download-all-wrap')).toBeFalsy();
        expect(section.root.textContent).toContain('audit_sidrapport_create_all_button');
        section.destroy();
        section.root.remove();
    });

    test('visar informationsruta ovanför tabellen när sidrapport skapas i bakgrunden', async () => {
        list_mock.mockResolvedValue({
            items: [
                {
                    sampleId: 's1',
                    sampleDescription: 'Startsida',
                    requestedUrl: 'https://example.com',
                    pageTitle: null,
                    currentReady: null,
                    pendingAttempt: {
                        snapshotId: 'snap-pending',
                        status: 'capturing',
                        capturedAt: null,
                        warningCount: 0,
                        sizeBytes: null,
                    },
                },
            ],
        });
        const section = create_audit_actions_snapshots_section(make_deps() as never);
        document.body.appendChild(section.root);
        await section.refresh();

        const info_el = section.root.querySelector('.global-message-content.message-warning.global-message-inline');
        const table_host = section.root.querySelector('.audit-actions-snapshots__table-host');
        expect(info_el).toBeTruthy();
        expect(table_host).toBeTruthy();
        expect(info_el?.textContent).toContain('audit_snapshots_download_all_partial_note');
        expect(info_el?.getAttribute('role')).toBe('alert');
        expect(
            info_el?.compareDocumentPosition(table_host!) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();

        section.destroy();
        section.root.remove();
    });
});
