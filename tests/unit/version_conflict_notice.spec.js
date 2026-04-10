import { describe, test, expect } from '@jest/globals';
import { resolve_version_conflict_notice } from '../../js/logic/version_conflict_notice.js';

describe('resolve_version_conflict_notice', () => {
    test('returnerar null när senast ändrad är samma användare', () => {
        expect(resolve_version_conflict_notice({ lastUpdatedBy: 'Ada' }, 'Ada')).toBeNull();
    });

    test('ignorerar skiftläge vid jämförelse', () => {
        expect(resolve_version_conflict_notice({ lastUpdatedBy: 'ada' }, 'Ada')).toBeNull();
    });

    test('returnerar other_user när namn skiljer sig', () => {
        const r = resolve_version_conflict_notice({ lastUpdatedBy: 'Bertil' }, 'Ada');
        expect(r).toEqual({
            key: 'version_conflict_other_user',
            params: { name: 'Bertil' }
        });
    });

    test('returnerar external när lastUpdatedBy saknas eller är tom', () => {
        expect(resolve_version_conflict_notice({}, 'Ada')).toEqual({
            key: 'version_conflict_external_update'
        });
        expect(resolve_version_conflict_notice({ lastUpdatedBy: null }, 'Ada')).toEqual({
            key: 'version_conflict_external_update'
        });
        expect(resolve_version_conflict_notice({ lastUpdatedBy: '  ' }, 'Ada')).toEqual({
            key: 'version_conflict_external_update'
        });
    });

    test('visar annan användare när inloggat namn saknas men server har upphov', () => {
        const r = resolve_version_conflict_notice({ lastUpdatedBy: 'Cecilia' }, '');
        expect(r?.key).toBe('version_conflict_other_user');
        expect(r?.params?.name).toBe('Cecilia');
    });
});
