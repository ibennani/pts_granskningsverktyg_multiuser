/**
 * @fileoverview Regressionstester: importmodal för handläggar-Word byggs utan runtime-fel.
 */

import { jest, describe, it, beforeEach, expect } from '@jest/globals';
import { setup_observation_word_import_modal_content } from '../../js/components/observation_word_import/observation_word_import_modal_setup.ts';

function create_helpers() {
    return {
        create_element(tag: string, opts: Record<string, unknown> = {}) {
            const el = document.createElement(tag);
            if (opts.class_name) {
                const classes = Array.isArray(opts.class_name) ? opts.class_name : [opts.class_name];
                el.className = classes.map(String).join(' ');
            }
            if (opts.text_content) {
                el.textContent = String(opts.text_content);
            }
            if (opts.attributes && typeof opts.attributes === 'object') {
                Object.entries(opts.attributes as Record<string, string>).forEach(([key, value]) => {
                    el.setAttribute(key, String(value));
                });
            }
            return el;
        },
        get_icon_svg() {
            return '';
        },
        escape_html(value: string) {
            return value;
        },
    };
}

function setup_modal_dom() {
    const dialog = document.createElement('dialog');
    dialog.className = 'modal-dialog';
    const container = document.createElement('div');
    container.className = 'modal-body';
    container.id = 'modal-content-container';
    document.body.appendChild(dialog);
    dialog.appendChild(container);
    return { dialog, container };
}

describe('setup_observation_word_import_modal_content', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        window.matchMedia = jest.fn().mockImplementation(() => ({
            matches: false,
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
        }));
    });

    it('bygger modal utan Analysera-knapp och med stäng utan att spara', () => {
        const { container } = setup_modal_dom();
        const t = (key: string) => key;

        expect(() => {
            setup_observation_word_import_modal_content(
                container,
                { close: () => {} },
                {
                    t,
                    Helpers: create_helpers(),
                    audit: { samples: [], ruleFileContent: { requirements: {} } },
                    dispatch: jest.fn(),
                    StoreActionTypes: { APPLY_OBSERVATION_WORD_IMPORT: 'APPLY_OBSERVATION_WORD_IMPORT' },
                }
            );
        }).not.toThrow();

        expect(container.querySelector('.observation-word-import-drop-zone')).not.toBeNull();
        expect(container.querySelector('.observation-word-import-status')).not.toBeNull();
        expect(container.querySelector('.observation-word-import-actions')).not.toBeNull();
        expect(container.textContent).toContain('observation_word_import_close_without_save_button');
        expect(container.textContent).not.toContain('observation_word_import_analyze_button');
        expect(container.textContent).not.toContain('observation_word_import_close_without_analyze_button');
    });
});
