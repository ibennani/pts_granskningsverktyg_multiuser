/**
 * Enhetstester för lokala visningsnamn i grupperad granskningslista.
 */

import {
    get_audit_group_display_name,
    resolve_group_actor_display_name,
    set_audit_group_display_name
} from '../../js/logic/audit_list_group_display_names.js';
import { scope_storage_key } from '../helpers/scoped_session_storage.ts';

const STORAGE_KEY = 'gv_audit_list_group_display_names_v1';

describe('audit_list_group_display_names', () => {
    beforeEach(() => {
        sessionStorage.clear();
    });

    afterEach(() => {
        sessionStorage.clear();
    });

    test('set och get sparar trimmat namn per diarienummer', () => {
        set_audit_group_display_name('  D-100  ', '  Mitt namn  ');
        expect(get_audit_group_display_name('D-100')).toBe('Mitt namn');
        expect(JSON.parse(sessionStorage.getItem(scope_storage_key(STORAGE_KEY)) || '{}')).toEqual({
            'D-100': 'Mitt namn'
        });
    });

    test('tom sträng tar bort sparat namn', () => {
        set_audit_group_display_name('D-100', 'Första');
        set_audit_group_display_name('D-100', '   ');
        expect(get_audit_group_display_name('D-100')).toBe('');
        expect(sessionStorage.getItem(scope_storage_key(STORAGE_KEY))).toBe('{}');
    });

    test('resolve_group_actor_display_name använder sparat namn före äldsta aktör', () => {
        const audits = [
            { id: '1', created_at: '2024-01-01', metadata: { actorName: 'Äldsta aktör' } },
            { id: '2', created_at: '2024-06-01', metadata: { actorName: 'Nyare aktör' } }
        ];
        set_audit_group_display_name('D-200', 'Samlingsnamn AB');
        expect(resolve_group_actor_display_name('D-200', audits)).toBe('Samlingsnamn AB');
        expect(resolve_group_actor_display_name('D-999', audits)).toBe('Äldsta aktör');
    });
});
