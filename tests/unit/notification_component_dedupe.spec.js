/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { NotificationComponent } from '../../js/components/NotificationComponent.js';

describe('NotificationComponent – samma notis efter stäng/dölj', () => {
    let nc;
    let msg_el;

    beforeEach(() => {
        document.body.innerHTML = '';
        msg_el = document.createElement('div');
        msg_el.id = 'global-message-area';
        msg_el.setAttribute('hidden', 'true');
        document.body.appendChild(msg_el);
        window.Translation = {
            t: (key) => {
                if (key === 'global_message_dismiss_aria_label') return 'Stäng notisen';
                if (key === 'ok') return 'Ok';
                return key;
            }
        };
        nc = new NotificationComponent();
        nc.global_message_element = msg_el;
    });

    afterEach(() => {
        delete window.Translation;
    });

    test('efter clear_global_message visas inte samma meddelande och typ igen', () => {
        nc.show_global_message('Samma text', 'info');
        expect(msg_el.hidden).toBe(false);
        expect(msg_el.textContent).toContain('Samma text');

        nc.clear_global_message();
        expect(msg_el.hidden).toBe(true);

        nc.show_global_message('Samma text', 'info');
        expect(msg_el.hidden).toBe(true);
        expect(msg_el.querySelector('.global-message-text')).toBeNull();
    });

    test('efter en annan notis får samma text visas igen', () => {
        nc.show_global_message('A', 'info');
        nc.clear_global_message();

        nc.show_global_message('B', 'warning');
        expect(msg_el.hidden).toBe(false);
        expect(msg_el.textContent).toContain('B');

        nc.clear_global_message();
        nc.show_global_message('A', 'info');
        expect(msg_el.hidden).toBe(false);
        expect(msg_el.textContent).toContain('A');
    });

    test('append_global_message_areas_to flyttar felplacerad notis in i värden före vyns innehåll', () => {
        document.body.innerHTML = '';
        const main = document.createElement('main');
        main.id = 'app-main-view-root';
        const host = document.createElement('div');
        host.id = 'app-main-view-content';
        main.appendChild(host);
        document.body.appendChild(main);

        const felplacerad = document.createElement('div');
        felplacerad.id = 'global-message-area';
        felplacerad.setAttribute('hidden', 'true');
        document.body.appendChild(felplacerad);

        window.Translation = {
            t: (key) => key
        };
        const nc2 = new NotificationComponent();
        nc2.append_global_message_areas_to(null);
        delete window.Translation;

        expect(Array.from(main.children).map((n) => n.id)).toEqual(['app-main-view-content']);
        expect(felplacerad.parentElement).toBe(host);
        expect(Array.from(host.children).slice(0, 2).map((n) => n.id)).toEqual([
            'global-critical-message-area',
            'global-message-area'
        ]);
    });
});
