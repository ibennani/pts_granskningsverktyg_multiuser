/**
 * @jest-environment jsdom
 */
import { describe, test, expect } from '@jest/globals';
import { clear_main_view_content_except_global_notifications } from '../../js/logic/app_dom.js';

describe('clear_main_view_content_except_global_notifications', () => {
    test('behåller båda notisnoderna och tar bort övriga barn', () => {
        const host = document.createElement('div');
        host.id = 'app-main-view-content';

        const crit = document.createElement('div');
        crit.id = 'global-critical-message-area';
        const reg = document.createElement('div');
        reg.id = 'global-message-area';
        const plate = document.createElement('div');
        plate.className = 'content-plate';
        plate.innerHTML = '<h1>Rubrik</h1>';

        host.appendChild(crit);
        host.appendChild(reg);
        host.appendChild(plate);
        document.body.appendChild(host);

        clear_main_view_content_except_global_notifications(host);

        expect(host.querySelector('.content-plate')).toBeNull();
        expect(crit.parentElement).toBe(host);
        expect(reg.parentElement).toBe(host);
        expect(Array.from(host.children).map((n) => n.id)).toEqual([
            'global-critical-message-area',
            'global-message-area'
        ]);
    });
});
