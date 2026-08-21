/**
 * Tester för save_audit_logic
 * (api/client används inte i modulen; notifiering sker via injicerad callback.)
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';

let save_audit_to_json_file;

beforeAll(async () => {
    const { ensure_initial_load } = await import('../../js/translation_logic.ts');
    await ensure_initial_load();
    const mod = await import('../../js/logic/save_audit_logic.ts');
    save_audit_to_json_file = mod.save_audit_to_json_file;
});

describe('save_audit_logic', () => {
    const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    let show_notification;
    let mock_anchor;
    let generate_audit_filename;
    let attach_export_integrity_to_audit_payload;
    let build_audit_backup_zip;
    /** @type {typeof globalThis.fetch | undefined} */
    let saved_fetch;
    let create_element_spy;
    let append_child_spy;
    let remove_child_spy;
    /** @type {typeof URL.createObjectURL | undefined} */
    let saved_url_create;
    /** @type {typeof URL.revokeObjectURL | undefined} */
    let saved_url_revoke;

    const test_deps = () => ({
        generate_audit_filename,
        attach_export_integrity_to_audit_payload,
        build_audit_backup_zip,
    });

    beforeEach(() => {
        show_notification = jest.fn();
        generate_audit_filename = jest.fn(() => 'export.json');
        attach_export_integrity_to_audit_payload = jest.fn(async (data) => ({ ...data, integrity: 'ok' }));
        build_audit_backup_zip = jest.fn(async () => ({
            blob: new Blob(['zip'], { type: 'application/zip' }),
            missing_media: [],
        }));

        saved_fetch = global.fetch;
        global.fetch = jest.fn(() => Promise.resolve({ ok: false, json: async () => ({}) }));

        mock_anchor = {
            href: '',
            download: '',
            click: jest.fn()
        };
        const original_create = document.createElement.bind(document);
        create_element_spy = jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') return mock_anchor;
            return original_create(tag);
        });

        saved_url_create = global.URL.createObjectURL;
        saved_url_revoke = global.URL.revokeObjectURL;
        global.URL.createObjectURL = jest.fn(() => 'blob:test-url');
        global.URL.revokeObjectURL = jest.fn();

        append_child_spy = jest.spyOn(document.body, 'appendChild').mockImplementation(() => mock_anchor);
        remove_child_spy = jest.spyOn(document.body, 'removeChild').mockImplementation(() => mock_anchor);

        window.DraftManager = { commitCurrentDraft: jest.fn() };
    });

    afterEach(() => {
        create_element_spy.mockRestore();
        append_child_spy.mockRestore();
        remove_child_spy.mockRestore();
        if (saved_url_create) global.URL.createObjectURL = saved_url_create;
        if (saved_url_revoke) global.URL.revokeObjectURL = saved_url_revoke;
        jest.restoreAllMocks();
        delete window.DraftManager;
        global.fetch = saved_fetch;
    });

    test('sparar inte och visar fel när auditdata saknas', async () => {
        await save_audit_to_json_file(null, t, show_notification);
        expect(show_notification).toHaveBeenCalledWith('no_audit_data_to_save', 'error');
        expect(generate_audit_filename).not.toHaveBeenCalled();
        expect(attach_export_integrity_to_audit_payload).not.toHaveBeenCalled();
    });

    test('vid fel i exportintegritet visas fel och ingen nedladdning', async () => {
        attach_export_integrity_to_audit_payload.mockRejectedValueOnce(new Error('integrity fail'));
        const audit = { id: 'a1' };
        await save_audit_to_json_file(audit, t, show_notification, undefined, test_deps());
        expect(show_notification).toHaveBeenCalledWith('error_internal', 'error');
        expect(mock_anchor.click).not.toHaveBeenCalled();
    });

    test('lyckad sparning: zip-filnamn, blob, klick och framgångsnotis', async () => {
        const audit = { auditStatus: 'in_progress', samples: [] };
        generate_audit_filename.mockReturnValueOnce('min-granskning.json');

        await save_audit_to_json_file(audit, t, show_notification, { prefix: 'p' }, test_deps());

        expect(generate_audit_filename).toHaveBeenCalledWith(
            audit,
            t,
            expect.objectContaining({
                prefix: 'p',
                datetime_str_override: expect.stringMatching(/^\d{8}_\d{6}$/)
            })
        );
        expect(attach_export_integrity_to_audit_payload).toHaveBeenCalledWith(audit);
        expect(build_audit_backup_zip).toHaveBeenCalled();
        expect(mock_anchor.download).toBe('min-granskning.zip');
        expect(mock_anchor.href).toBe('blob:test-url');
        expect(mock_anchor.click).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        expect(window.DraftManager.commitCurrentDraft).toHaveBeenCalled();
        expect(show_notification).toHaveBeenCalledWith(
            expect.stringMatching(/Granskning sparad som|Audit saved as/),
            'success'
        );
    });

    test('varnar när bilder saknas i zip-export', async () => {
        build_audit_backup_zip.mockResolvedValueOnce({
            blob: new Blob(['zip'], { type: 'application/zip' }),
            missing_media: ['a.png', 'b.png'],
        });
        await save_audit_to_json_file({ samples: [] }, t, show_notification, undefined, test_deps());
        expect(show_notification).toHaveBeenCalledWith(
            expect.stringMatching(/bilder kunde inte|images could not|bilder kunne ikke/),
            'warning'
        );
    });

    test('använder granskningens updated_at för filnamnstid i svensk tidszon när det finns', async () => {
        const audit = { id: 'a1', updated_at: '2026-04-21T08:11:12.000Z' };
        await save_audit_to_json_file(audit, t, show_notification, { prefix: 'p' }, test_deps());
        expect(generate_audit_filename).toHaveBeenCalledWith(audit, t, {
            prefix: 'p',
            datetime_str_override: '20260421_101112'
        });
    });

    test('commitCurrentDraft-fel påverkar inte lyckad notis', async () => {
        window.DraftManager.commitCurrentDraft.mockImplementation(() => {
            throw new Error('draft');
        });
        const audit = { x: 1 };
        await save_audit_to_json_file(audit, t, show_notification, undefined, test_deps());
        expect(show_notification).toHaveBeenCalledWith(
            expect.stringMatching(/Granskning sparad som|Audit saved as/),
            'success'
        );
    });

    test('show_notification kan utelämnas utan krasch', async () => {
        const audit = { y: 2 };
        await save_audit_to_json_file(audit, t, undefined, undefined, test_deps());
        expect(mock_anchor.click).toHaveBeenCalled();
    });

    test('misslyckad exportintegritet vid nätverksliknande fel visar error_internal', async () => {
        attach_export_integrity_to_audit_payload.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const audit = { id: 'a-net', auditMetadata: { actorName: 'X' } };
        await save_audit_to_json_file(audit, t, show_notification, undefined, test_deps());
        expect(show_notification).toHaveBeenCalledWith('error_internal', 'error');
        expect(mock_anchor.click).not.toHaveBeenCalled();
    });

    test('misslyckad zip-export visar error_internal', async () => {
        build_audit_backup_zip.mockRejectedValueOnce(new Error('zip fail'));
        await save_audit_to_json_file({ samples: [] }, t, show_notification, undefined, test_deps());
        expect(show_notification).toHaveBeenCalledWith('error_internal', 'error');
        expect(mock_anchor.click).not.toHaveBeenCalled();
    });

    test('sparar utan auditId i payload när metadata finns (filnamn genereras)', async () => {
        const audit = {
            auditMetadata: { actorName: 'Namn', caseNumber: '1', auditorName: 'G' },
            samples: []
        };
        generate_audit_filename.mockReturnValueOnce('fil.json');
        await save_audit_to_json_file(audit, t, show_notification, undefined, test_deps());
        expect(generate_audit_filename).toHaveBeenCalledWith(
            audit,
            t,
            expect.objectContaining({
                datetime_str_override: expect.stringMatching(/^\d{8}_\d{6}$/)
            })
        );
        expect(mock_anchor.click).toHaveBeenCalled();
        expect(mock_anchor.download).toBe('fil.zip');
    });
});
