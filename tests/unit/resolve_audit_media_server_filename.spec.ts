/**
 * @fileoverview Enhetstester för serverfilnamnslösning vid PATCH och fetch.
 */

import { describe, expect, it } from '@jest/globals';
import {
    find_server_media_filename_match,
    resolve_audit_media_filename_on_server,
    resolve_server_media_fetch_filename
} from '../../shared/media/resolve_audit_media_server_filename.ts';
import { build_audit_media_filename_migration_map } from '../../shared/media/audit_media_filename_migrations.ts';

describe('resolve_server_media_fetch_filename', () => {
    const server = new Set(['foto.png', 'Översikt över menyn.png']);
    const migration_map = build_audit_media_filename_migration_map([{ from: 'foto.jpg', to: 'foto.png' }]);

    it('matchar migrerat filnamn mot serverfil', () => {
        expect(resolve_server_media_fetch_filename('foto.jpg', server, migration_map)).toBe('foto.png');
    });

    it('matchar skiftlägesvariant mot serverfil', () => {
        expect(resolve_server_media_fetch_filename('översikt över menyn.png', server, migration_map)).toBe(
            'Översikt över menyn.png'
        );
    });

    it('returnerar migrerat namn om serverindex saknas', () => {
        expect(resolve_server_media_fetch_filename('foto.jpg', null, migration_map)).toBe('foto.png');
    });

    it('returnerar original utan falsk migration när serverindex är tomt', () => {
        expect(resolve_server_media_fetch_filename('foto.jpg', new Set(), migration_map)).toBe('foto.jpg');
    });
});

describe('resolve_audit_media_filename_on_server', () => {
    it('löser gammalt jpg-namn till png efter migrering', () => {
        expect(resolve_audit_media_filename_on_server('bild.jpg', ['bild.png'], [{ from: 'bild.jpg', to: 'bild.png' }])).toBe(
            'bild.png'
        );
    });

    it('matchar skiftlägesvariant i PATCH-lösning', () => {
        expect(resolve_audit_media_filename_on_server('meny.png', ['Meny.png'], [])).toBe('Meny.png');
    });

    it('returnerar null när fil saknas på servern', () => {
        expect(resolve_audit_media_filename_on_server('saknas.png', ['finns.png'], [])).toBeNull();
    });
});

describe('find_server_media_filename_match', () => {
    it('matchar exakt filnamn i array', () => {
        expect(find_server_media_filename_match('a.png', ['a.png', 'b.png'])).toBe('a.png');
    });
});
