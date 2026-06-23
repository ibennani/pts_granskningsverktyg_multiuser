/**
 * @fileoverview Enhetstester för backup-läge i sessionStorage.
 */

import { jest } from '@jest/globals';
import {
    load_backup_mode_from_storage,
    save_backup_mode_to_storage
} from '../../js/components/backup/backup_mode_storage.ts';

describe('backup_mode_storage', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    it('returnerar audits som standard', () => {
        expect(load_backup_mode_from_storage()).toBe('audits');
    });

    it('läser och skriver rulefiles', () => {
        save_backup_mode_to_storage('rulefiles');
        expect(load_backup_mode_from_storage()).toBe('rulefiles');
    });

    it('ignorerar ogiltigt värde i sessionStorage', () => {
        sessionStorage.setItem('gv_backup_mode', 'invalid');
        expect(load_backup_mode_from_storage()).toBe('audits');
    });

    it('tolererar otillgänglig sessionStorage', () => {
        const get_item = jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new Error('blocked');
        });
        expect(load_backup_mode_from_storage()).toBe('audits');
        get_item.mockRestore();
    });
});
