import { describe, test, expect } from '@jest/globals';
import {
    apply_audit_media_filename_migrations,
    build_audit_media_filename_migration_map,
    resolve_migrated_media_filename
} from '../../js/logic/audit_media_filename_migrations.js';

describe('audit_media_filename_migrations', () => {
    test('apply_audit_media_filename_migrations byter ut migrerade namn', () => {
        const migrations = [{ from: 'foto.jpg', to: 'foto.png' }];
        expect(apply_audit_media_filename_migrations(['foto.jpg', 'annan.png'], migrations)).toEqual([
            'foto.png',
            'annan.png'
        ]);
    });

    test('resolve_migrated_media_filename returnerar original om ingen migration finns', () => {
        const map = build_audit_media_filename_migration_map([{ from: 'a.jpg', to: 'a.png' }]);
        expect(resolve_migrated_media_filename('b.jpg', map)).toBe('b.jpg');
        expect(resolve_migrated_media_filename('a.jpg', map)).toBe('a.png');
    });
});
