/**
 * @jest-environment jsdom
 */
import { get_field_key, DraftManager } from '../../js/draft_manager.js';

describe('get_field_key', () => {
    test('ger unika nycklar för flera kryssrutor med samma name och olika value', () => {
        const a = document.createElement('input');
        a.type = 'checkbox';
        a.name = 'selectedContentTypes';
        a.value = 'typ-a';

        const b = document.createElement('input');
        b.type = 'checkbox';
        b.name = 'selectedContentTypes';
        b.value = 'typ-b';

        expect(get_field_key(a)).toBe('checkbox:selectedContentTypes:typ-a');
        expect(get_field_key(b)).toBe('checkbox:selectedContentTypes:typ-b');
        expect(get_field_key(a)).not.toBe(get_field_key(b));
    });

    test('föräldrekryssruta utan name använder id', () => {
        const p = document.createElement('input');
        p.type = 'checkbox';
        p.id = 'ct-parent-web';
        expect(get_field_key(p)).toBe('ct-parent-web');
    });
});

describe('DraftManager.restoreIntoDom med flera selectedContentTypes', () => {
    beforeEach(() => {
        DraftManager.init({
            getRouteKey: () => 'test_route',
            getScopeKey: () => 'test_scope'
        });
        sessionStorage.clear();
    });

    test('återställer varje kryssruta enligt eget utkastfält', () => {
        const root = document.createElement('div');
        const c1 = document.createElement('input');
        c1.type = 'checkbox';
        c1.name = 'selectedContentTypes';
        c1.value = 'x';
        const c2 = document.createElement('input');
        c2.type = 'checkbox';
        c2.name = 'selectedContentTypes';
        c2.value = 'y';
        root.append(c1, c2);

        const draft_key = 'test_route::test_scope';
        const payload = {
            schemaVersion: 1,
            draftKey: draft_key,
            routeKey: 'test_route',
            scopeKey: 'test_scope',
            tabId: 't1',
            updatedAt: Date.now(),
            fields: {
                'checkbox:selectedContentTypes:x': { type: 'checkbox', value: true, extra: {} },
                'checkbox:selectedContentTypes:y': { type: 'checkbox', value: false, extra: {} }
            }
        };
        sessionStorage.setItem(`draft:${draft_key}`, JSON.stringify(payload));

        expect(c1.checked).toBe(false);
        expect(c2.checked).toBe(false);

        DraftManager.restoreIntoDom(root);

        expect(c1.checked).toBe(true);
        expect(c2.checked).toBe(false);
    });
});
