import { jest, describe, test, expect, beforeEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const spec_dir = path.dirname(fileURLToPath(import.meta.url));
const list_api_path = path.join(spec_dir, '../../js/api/audit_snapshot_api.js');
const push_path = path.join(spec_dir, '../../js/logic/list_push_service.js');

const list_mock = jest.fn();

jest.unstable_mockModule(list_api_path, () => ({
    list_audit_snapshots: list_mock,
    get_audit_snapshot_download_url: jest.fn(() => '/download'),
    get_audit_snapshots_download_all_url: jest.fn(() => '/download-all'),
}));

jest.unstable_mockModule(push_path, () => ({
    subscribe_audit_snapshots: jest.fn(() => () => {}),
}));

const { create_audit_actions_snapshots_section } = await import(
    '../../js/components/audit_actions_snapshots_section.ts'
);

function make_deps() {
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
            format_iso_to_local_datetime: (iso: string) => iso,
        },
        Translation: {
            t: (key: string) => key,
            get_current_language_code: () => 'sv-SE',
        },
        getState: () => ({ auditId: 'audit-1', samples: [] }),
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
        await section.refresh();
        expect(section.root.querySelector('table')).toBeTruthy();
        expect(section.root.textContent).toContain('Startsida');
        section.destroy();
    });
});
