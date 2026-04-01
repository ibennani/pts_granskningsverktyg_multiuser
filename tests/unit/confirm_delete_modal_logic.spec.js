/**
 * Tester för confirm_delete_modal_logic.js
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import {
    build_delete_warning_text,
    show_confirm_delete_modal
} from '../../js/logic/confirm_delete_modal_logic.js';

function mock_create_element(tag, opts = {}) {
    const el = document.createElement(tag);
    if (opts.class_name) {
        el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
    }
    if (opts.text_content) {
        el.textContent = opts.text_content;
    }
    return el;
}

describe('confirm_delete_modal_logic', () => {
    describe('build_delete_warning_text', () => {
        const base_state = {
            ruleFileContent: {
                requirements: {
                    req1: {
                        title: 'Krav A',
                        checks: [
                            {
                                id: 'ch1',
                                condition: 'Kolla detta',
                                passCriteria: [{ id: 'pc1', requirement: 'Kriteriumtext' }]
                            }
                        ]
                    }
                }
            }
        };

        test('returnerar null när krav saknas', () => {
            expect(
                build_delete_warning_text('requirement', { reqId: 'x' }, () => ({}), { t: (k) => k })
            ).toBeNull();
        });

        test('requirement: bygger intro, titel och varning', () => {
            const t = (k) => ({ rulefile_confirm_delete_intro: 'Intro', rulefile_confirm_delete_warning: 'Varning' }[k] || k);
            const text = build_delete_warning_text(
                'requirement',
                { reqId: 'req1' },
                () => base_state,
                { t }
            );
            expect(text).toContain('Krav A');
            expect(text).toContain('Varning');
        });

        test('check: returnerar null om check saknas', () => {
            expect(
                build_delete_warning_text('check', { reqId: 'req1', checkId: 'nope' }, () => base_state, { t: (k) => k })
            ).toBeNull();
        });

        test('check: inkluderar villkorsrad', () => {
            const t = (k) => ({ confirm_delete_check_intro: 'Radera kontroll' }[k] || k);
            const text = build_delete_warning_text(
                'check',
                { reqId: 'req1', checkId: 'ch1' },
                () => base_state,
                { t }
            );
            expect(text).toContain('Kolla detta');
        });

        test('criterion: returnerar null om kriterium saknas', () => {
            expect(
                build_delete_warning_text(
                    'criterion',
                    { reqId: 'req1', checkId: 'ch1', pcId: 'nope' },
                    () => base_state,
                    { t: (k) => k }
                )
            ).toBeNull();
        });

        test('criterion: inkluderar kriterietext', () => {
            const t = (k) => ({ confirm_delete_criterion_intro: 'Radera kriterium' }[k] || k);
            const text = build_delete_warning_text(
                'criterion',
                { reqId: 'req1', checkId: 'ch1', pcId: 'pc1' },
                () => base_state,
                { t }
            );
            expect(text).toContain('Kriteriumtext');
        });

        test('okänd typ ger null', () => {
            expect(
                build_delete_warning_text('unknown', { reqId: 'req1' }, () => base_state, { t: (k) => k })
            ).toBeNull();
        });
    });

    describe('show_confirm_delete_modal', () => {
        const orig_modal = global.window.ModalComponent;
        const orig_helpers = global.window.Helpers;
        const orig_translation = global.window.Translation;

        afterEach(() => {
            global.window.ModalComponent = orig_modal;
            global.window.Helpers = orig_helpers;
            global.window.Translation = orig_translation;
            document.body.innerHTML = '';
        });

        test('gör inget om ModalComponent eller Helpers saknas', () => {
            global.window.ModalComponent = undefined;
            global.window.Helpers = { create_element: mock_create_element };
            const btn = document.createElement('button');
            document.body.appendChild(btn);
            expect(() =>
                show_confirm_delete_modal({
                    warning_text: 'V',
                    delete_button: btn,
                    on_confirm: jest.fn()
                })
            ).not.toThrow();
        });

        test('anropar ModalComponent.show och lägger till knappar i callback', () => {
            let modal_container = null;
            const show_spy = jest.fn((config, on_render) => {
                modal_container = document.createElement('div');
                const modal = { close: jest.fn() };
                on_render(modal_container, modal);
            });
            global.window.ModalComponent = { show: show_spy };
            global.window.Helpers = { create_element: mock_create_element };
            global.window.Translation = { t: (k) => k };

            const prev = document.createElement('button');
            prev.textContent = 'Före';
            const del = document.createElement('button');
            del.textContent = 'Ta bort';
            document.body.append(prev, del);

            show_confirm_delete_modal({
                warning_text: 'Radera?',
                delete_button: del,
                on_confirm: jest.fn()
            });

            expect(show_spy).toHaveBeenCalledTimes(1);
            const first_arg = show_spy.mock.calls[0][0];
            expect(first_arg.message_text).toBe('Radera?');
            const actions = modal_container.querySelector('.modal-confirm-actions');
            expect(actions).toBeTruthy();
            expect(actions.querySelectorAll('button').length).toBe(2);
        });
    });
});
