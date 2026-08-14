/**
 * @file Enhetstester för backup-behörighet.
 */
import { is_backup_admin } from '../../server/utils/backup_access.js';

describe('backup_access', () => {
    test('is_backup_admin är sant endast för admin', () => {
        expect(is_backup_admin({ id: 'u1', is_admin: true })).toBe(true);
        expect(is_backup_admin({ id: 'u1', is_admin: false })).toBe(false);
        expect(is_backup_admin(null)).toBe(false);
    });
});
