import { jest, describe, test, expect, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../js/api/audit_media_api.js', () => ({
    upload_audit_media: jest.fn(),
    fetch_audit_media_blob_url: jest.fn(),
    list_audit_media: jest.fn().mockResolvedValue([])
}));

jest.unstable_mockModule('../../js/components/media/render_audit_media_list_item.js', () => ({
    revoke_audit_media_blob_url: jest.fn(),
    set_audit_media_local_preview_blob_url: jest.fn(),
    move_audit_media_local_preview_blob_url: jest.fn()
}));

const mock_is_browser_online = jest.fn(() => true);
jest.unstable_mockModule('../../js/utils/browser_online.js', () => ({
    is_browser_online: () => mock_is_browser_online()
}));

const { upload_audit_media, fetch_audit_media_blob_url } = await import('../../js/api/audit_media_api.js');
const { create_attach_media_upload_queue } = await import(
    '../../js/components/media/attach_media_upload_queue.js'
);

function create_queue_deps(overrides = {}) {
    const working_filenames: string[] = [];
    const t = (key: string) => key;
    return {
        t,
        audit_id: 'audit-1',
        media_scope: 'requirement' as const,
        escape_html: (v: string) => v,
        get_working_filenames: () => working_filenames,
        set_working_filenames: (names: string[]) => {
            working_filenames.length = 0;
            working_filenames.push(...names);
        },
        refresh_list: jest.fn(),
        show_status: jest.fn(),
        show_duplicate_filenames_error: jest.fn(),
        persist_changes: jest.fn().mockResolvedValue(true),
        clear_pending_filenames: jest.fn(),
        ...overrides
    };
}

describe('attach_media_upload_queue offline', () => {
    beforeEach(() => {
        mock_is_browser_online.mockReturnValue(true);
        jest.mocked(upload_audit_media).mockReset();
        jest.mocked(fetch_audit_media_blob_url).mockReset();
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-preview');
        global.URL.revokeObjectURL = jest.fn();
    });

    test('skickar bilder med .png-filnamn vid uppladdning', async () => {
        jest.mocked(upload_audit_media).mockResolvedValue({
            filename: 'foto.png',
            size: 100,
            mime: 'image/png'
        });
        const deps = create_queue_deps();
        const queue = create_attach_media_upload_queue(deps);
        const file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

        queue.enqueue_files([file]);
        await new Promise((resolve) => setTimeout(resolve, 50));

        expect(upload_audit_media).toHaveBeenCalledTimes(1);
        const uploaded_file = jest.mocked(upload_audit_media).mock.calls[0]?.[1] as File;
        expect(uploaded_file.name).toBe('foto.png');
    });

    test('visar offline-meddelande när kö startar utan uppkoppling', () => {
        mock_is_browser_online.mockReturnValue(false);
        const deps = create_queue_deps();
        const queue = create_attach_media_upload_queue(deps);
        const file = new File(['x'], 'a.png', { type: 'image/png' });

        queue.enqueue_files([file]);

        expect(deps.show_status).toHaveBeenCalledWith('attach_media_upload_requires_online', 'error');
        expect(upload_audit_media).not.toHaveBeenCalled();
    });
});
