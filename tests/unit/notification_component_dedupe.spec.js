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
});
