/**
 * Tester för save_audit_logic.js
 * (api/client används inte i modulen; notifiering sker via injicerad callback.)
 */
import { jest, describe, test, expect, beforeAll, beforeEach, afterEach } from '@jest/globals';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filename_utils_path = path.join(__dirname, '../../js/utils/filename_utils.js');
const export_integrity_path = path.join(__dirname, '../../js/utils/export_integrity.js');

const generate_audit_filename = jest.fn(() => 'export.json');
const attach_export_integrity_to_audit_payload = jest.fn(async (data) => ({ ...data, integrity: 'ok' }));

jest.unstable_mockModule(filename_utils_path, () => ({
    generate_audit_filename
}));

jest.unstable_mockModule(export_integrity_path, () => ({
    attach_export_integrity_to_audit_payload
}));

let save_audit_to_json_file;

beforeAll(async () => {
    const mod = await import('../../js/logic/save_audit_logic.js');
    save_audit_to_json_file = mod.save_audit_to_json_file;
});

describe('save_audit_logic', () => {
    const t = (key, vars) => (vars ? `${key}:${JSON.stringify(vars)}` : key);
    let show_notification;
    let mock_anchor;
    let create_object_url_spy;
    let revoke_spy;

    beforeEach(() => {
        show_notification = jest.fn();
        generate_audit_filename.mockClear();
        attach_export_integrity_to_audit_payload.mockClear();
        attach_export_integrity_to_audit_payload.mockImplementation(async (data) => ({ ...data, integrity: 'ok' }));

        mock_anchor = {
            href: '',
            download: '',
            click: jest.fn()
        };
        const original_create = document.createElement.bind(document);
        jest.spyOn(document, 'createElement').mockImplementation((tag) => {
            if (tag === 'a') return mock_anchor;
            return original_create(tag);
        });

        // jsdom har ofta ingen URL.createObjectURL på URL-objektet
        create_object_url_spy = jest.fn(() => 'blob:test-url');
        revoke_spy = jest.fn();
        global.URL.createObjectURL = create_object_url_spy;
        global.URL.revokeObjectURL = revoke_spy;

        jest.spyOn(document.body, 'appendChild').mockImplementation(() => mock_anchor);
        jest.spyOn(document.body, 'removeChild').mockImplementation(() => mock_anchor);

        window.DraftManager = { commitCurrentDraft: jest.fn() };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        delete window.DraftManager;
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
        await save_audit_to_json_file(audit, t, show_notification);
        expect(show_notification).toHaveBeenCalledWith('error_internal', 'error');
        expect(mock_anchor.click).not.toHaveBeenCalled();
    });

    test('lyckad sparning: filnamn, blob, klick och framgångsnotis', async () => {
        const audit = { auditStatus: 'in_progress', samples: [] };
        generate_audit_filename.mockReturnValueOnce('min-granskning.json');

        await save_audit_to_json_file(audit, t, show_notification, { prefix: 'p' });

        expect(generate_audit_filename).toHaveBeenCalledWith(audit, t, { prefix: 'p' });
        expect(attach_export_integrity_to_audit_payload).toHaveBeenCalledWith(audit);
        expect(mock_anchor.download).toBe('min-granskning.json');
        expect(mock_anchor.href).toBe('blob:test-url');
        expect(mock_anchor.click).toHaveBeenCalledTimes(1);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test-url');
        expect(window.DraftManager.commitCurrentDraft).toHaveBeenCalled();
        expect(show_notification).toHaveBeenCalledWith(
            expect.stringContaining('audit_saved_as_file'),
            'success'
        );
    });

    test('commitCurrentDraft-fel påverkar inte lyckad notis', async () => {
        window.DraftManager.commitCurrentDraft.mockImplementation(() => {
            throw new Error('draft');
        });
        const audit = { x: 1 };
        await save_audit_to_json_file(audit, t, show_notification);
        expect(show_notification).toHaveBeenCalledWith(
            expect.stringContaining('audit_saved_as_file'),
            'success'
        );
    });

    test('show_notification kan utelämnas utan krasch', async () => {
        const audit = { y: 2 };
        await save_audit_to_json_file(audit, t, undefined);
        expect(mock_anchor.click).toHaveBeenCalled();
    });

    test('misslyckad exportintegritet vid nätverksliknande fel visar error_internal', async () => {
        attach_export_integrity_to_audit_payload.mockRejectedValueOnce(new TypeError('Failed to fetch'));
        const audit = { id: 'a-net', auditMetadata: { actorName: 'X' } };
        await save_audit_to_json_file(audit, t, show_notification);
        expect(show_notification).toHaveBeenCalledWith('error_internal', 'error');
        expect(mock_anchor.click).not.toHaveBeenCalled();
    });

    test('misslyckad exportintegritet vid serverfel (500-liknande) visar error_internal', async () => {
        attach_export_integrity_to_audit_payload.mockRejectedValueOnce(new Error('HTTP 500'));
        const audit = { id: 'a-500' };
        await save_audit_to_json_file(audit, t, show_notification);
        expect(show_notification).toHaveBeenCalledWith('error_internal', 'error');
    });

    test('sparar utan auditId i payload när metadata finns (filnamn genereras)', async () => {
        const audit = {
            auditMetadata: { actorName: 'Namn', caseNumber: '1', auditorName: 'G' },
            samples: []
        };
        generate_audit_filename.mockReturnValueOnce('fil.json');
        await save_audit_to_json_file(audit, t, show_notification);
        expect(generate_audit_filename).toHaveBeenCalledWith(audit, t, {});
        expect(mock_anchor.click).toHaveBeenCalled();
    });
});
