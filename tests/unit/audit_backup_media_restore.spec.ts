/**
 * @fileoverview Enhetstester för återställning av media vid import.
 */

import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';

const upload_audit_media = jest.fn();

jest.unstable_mockModule('../../js/api/audit_media_api.js', () => ({
    upload_audit_media,
}));

const { restore_audit_backup_media } = await import('../../js/logic/audit_backup_media_restore.ts');

describe('restore_audit_backup_media', () => {
    beforeEach(() => {
        upload_audit_media.mockReset();
        upload_audit_media.mockResolvedValue({ filename: 'bild.png' });
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('laddar bara upp refererad media', async () => {
        const audit_json = {
            samples: [{ id: 's1', attachedMediaFilenames: ['bild.png'] }],
        };
        const blob = new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' });
        const result = await restore_audit_backup_media('audit-1', audit_json, [
            { filename: 'bild.png', blob },
            { filename: 'ej_refererad.png', blob },
        ]);
        expect(upload_audit_media).toHaveBeenCalledTimes(1);
        expect(result.uploaded_count).toBe(1);
        expect(result.skipped_count).toBe(1);
    });
});
