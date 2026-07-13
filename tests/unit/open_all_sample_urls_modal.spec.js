/**
 * Tester för open_all_sample_urls_modal.js
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals';
import {
    canonical_http_open_href,
    collect_ordered_sample_open_hrefs,
    collect_unique_sample_open_urls,
    fill_open_all_sample_urls_modal_message,
    open_http_hrefs_via_blank_then_assign,
    fill_audit_overview_continue_modal_message,
    show_audit_overview_continue_modal,
    sample_url_raw_string,
    show_open_all_sample_urls_modal
} from '../../js/logic/open_all_sample_urls_modal.js';
import { app_runtime_refs } from '../../js/utils/app_runtime_refs.js';
import { add_protocol_if_missing } from '../../js/utils/helpers.js';

describe('open_all_sample_urls_modal', () => {
    describe('sample_url_raw_string', () => {
        test('läser URL från alternativa nycklar', () => {
            expect(sample_url_raw_string({ URL: ' https://a.test ' })).toBe('https://a.test');
            expect(sample_url_raw_string({ sampleUrl: 'b.test' })).toBe('b.test');
            expect(sample_url_raw_string({ link: 'c.test' })).toBe('c.test');
        });

        test('hanterar tal som äldre data', () => {
            expect(sample_url_raw_string({ url: 12345 })).toBe('12345');
        });
    });

    describe('canonical_http_open_href', () => {
        test('godkänner https', () => {
            expect(canonical_http_open_href('https://ex.test/path')).toBe('https://ex.test/path');
        });
        test('avvisar javascript', () => {
            expect(canonical_http_open_href('javascript:alert(1)')).toBeNull();
        });
    });

    describe('collect_ordered_sample_open_hrefs', () => {
        test('bevarar ordning och duplicerade URL:er', () => {
            const r = collect_ordered_sample_open_hrefs(
                [
                    { url: 'https://same.test/' },
                    { URL: 'https://other.test/' },
                    { sampleUrl: 'https://same.test/' }
                ],
                add_protocol_if_missing
            );
            expect(r.ordered_hrefs.length).toBe(3);
            expect(r.has_duplicate_open_urls).toBe(true);
            expect(r.ordered_hrefs[0]).toBe(r.ordered_hrefs[2]);
        });
    });

    describe('collect_unique_sample_open_urls', () => {
        test('tom lista ger inga URL:er', () => {
            const r = collect_unique_sample_open_urls([], add_protocol_if_missing);
            expect(r.unique_urls).toEqual([]);
            expect(r.samples_with_url_count).toBe(0);
            expect(r.has_duplicate_urls).toBe(false);
        });

        test('samlar en trimmad URL med protokoll', () => {
            const r = collect_unique_sample_open_urls(
                [{ url: '  example.com  ' }],
                add_protocol_if_missing
            );
            expect(r.unique_urls).toEqual(['https://example.com/']);
            expect(r.samples_with_url_count).toBe(1);
            expect(r.has_duplicate_urls).toBe(false);
        });

        test('deduplicerar samma adress efter protokoll-normalisering', () => {
            const r = collect_unique_sample_open_urls(
                [
                    { url: 'https://foo.test/a' },
                    { url: 'https://foo.test/a' }
                ],
                add_protocol_if_missing
            );
            expect(r.unique_urls).toEqual(['https://foo.test/a']);
            expect(r.samples_with_url_count).toBe(2);
            expect(r.has_duplicate_urls).toBe(true);
        });

        test('två olika URL:er bevaras', () => {
            const r = collect_unique_sample_open_urls(
                [{ url: 'a.com' }, { url: 'b.com' }],
                add_protocol_if_missing
            );
            expect(r.unique_urls).toEqual(['https://a.com/', 'https://b.com/']);
            expect(r.has_duplicate_urls).toBe(false);
        });

        test('hoppar över farligt schema i råtext', () => {
            const r = collect_unique_sample_open_urls(
                [{ url: 'javascript:alert(1)' }],
                add_protocol_if_missing
            );
            expect(r.unique_urls).toEqual([]);
            expect(r.samples_with_url_count).toBe(0);
        });

        test('unika URL:er i ordning efter första förekomst i granskningsdelslistan', () => {
            const r = collect_unique_sample_open_urls(
                [
                    { url: 'https://b.test/' },
                    { url: 'https://a.test/' },
                    { url: 'https://b.test/' }
                ],
                add_protocol_if_missing
            );
            expect(r.unique_urls).toEqual(['https://b.test/', 'https://a.test/']);
        });
    });

    describe('open_http_hrefs_via_blank_then_assign', () => {
        const orig_open = global.window.open;

        afterEach(() => {
            global.window.open = orig_open;
            jest.useRealTimers();
        });

        test('öppnar about:blank per href och sätter location efter en sekund', () => {
            jest.useFakeTimers();
            const loc1 = { href: '' };
            const loc2 = { href: '' };
            const w1 = { closed: false, location: loc1, blur: jest.fn() };
            const w2 = { closed: false, location: loc2, blur: jest.fn() };
            let call = 0;
            global.window.open = jest.fn(() => (call++ === 0 ? w1 : w2));
            const focus_spy = jest.spyOn(global.window, 'focus').mockImplementation(() => {});

            open_http_hrefs_via_blank_then_assign(['https://a.test', 'https://b.test'], 1000);

            expect(global.window.open).toHaveBeenCalledTimes(2);
            expect(global.window.open).toHaveBeenNthCalledWith(1, 'about:blank', '_blank');
            expect(global.window.open).toHaveBeenNthCalledWith(2, 'about:blank', '_blank');
            expect(w1.blur).toHaveBeenCalled();
            expect(w2.blur).toHaveBeenCalled();
            expect(focus_spy.mock.calls.length).toBeGreaterThanOrEqual(2);

            jest.advanceTimersByTime(999);
            expect(loc1.href).toBe('');
            expect(loc2.href).toBe('');

            jest.advanceTimersByTime(1);
            expect(loc1.href).toBe('https://a.test/');
            expect(loc2.href).toBe('https://b.test/');
            focus_spy.mockRestore();
        });

        test('blur anropas när window.open returnerar referens', () => {
            jest.useFakeTimers();
            const blur_spy = jest.fn();
            global.window.open = jest.fn(() => ({ closed: false, blur: blur_spy, location: { href: '' }, opener: window }));
            jest.spyOn(global.window, 'focus').mockImplementation(() => {});

            open_http_hrefs_via_blank_then_assign(['https://a.test/']);

            expect(blur_spy).toHaveBeenCalled();
            jest.useRealTimers();
        });

        test('tom lista anropar inte window.open', () => {
            const openSpy = jest.fn();
            global.window.open = openSpy;
            open_http_hrefs_via_blank_then_assign([]);
            expect(openSpy).not.toHaveBeenCalled();
        });
    });

    describe('show_audit_overview_continue_modal', () => {
        const orig_modal = app_runtime_refs.modal_component;

        afterEach(() => {
            app_runtime_refs.modal_component = orig_modal;
        });

        test('anropar inte show utan URL:er', () => {
            const show_spy = jest.fn();
            app_runtime_refs.modal_component = { show: show_spy };
            show_audit_overview_continue_modal({
                trigger_element: null,
                getState: () => ({ samples: [{ url: '' }] }),
                Helpers: { create_element: () => document.createElement('div') },
                Translation: { t: (k) => k },
                navigate_to_requirement: jest.fn()
            });
            expect(show_spy).not.toHaveBeenCalled();
        });

        test('visar modal med tre knappar och vardaglig text', () => {
            let content_callback = null;
            const show_spy = jest.fn((config, cb) => {
                expect(config.h1_text).toBe('audit_overview_continue_modal_title');
                content_callback = cb;
            });
            app_runtime_refs.modal_component = { show: show_spy };
            const navigate_spy = jest.fn();
            const t = (key, rep) => {
                if (key === 'audit_overview_continue_modal_open_many_lead' && rep?.count === 2) {
                    return `Öppna alla granskningsdelar öppnar ${rep.count} nya flikar`;
                }
                const map = {
                    audit_overview_continue_modal_lead: 'Du går tillbaka till kravet.',
                    audit_overview_continue_modal_open_tail: ' Hitta tillbaka till Leffe.',
                    audit_overview_continue_modal_only_lead: 'Fortsätt bara till kravet',
                    audit_overview_continue_modal_only_tail: ' utan extra flikar.',
                    audit_overview_continue_modal_stay_lead: 'Stanna på Granskningsöversikten',
                    audit_overview_continue_modal_stay_tail: ' stänger dialogen.',
                    open_all_sample_urls_confirm_button: 'Öppna alla granskningsdelar',
                    audit_overview_continue_requirement_only_button: 'Fortsätt bara till kravet',
                    audit_overview_continue_stay_on_overview_button: 'Stanna på Granskningsöversikten'
                };
                return map[key] || key;
            };
            const create_el = (tag, opts) => {
                const el = document.createElement(tag);
                if (opts?.class_name) {
                    el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
                }
                if (opts?.text_content != null) el.textContent = opts.text_content;
                return el;
            };
            show_audit_overview_continue_modal({
                trigger_element: null,
                getState: () => ({ samples: [{ url: 'a.com' }, { url: 'b.com' }] }),
                Helpers: { create_element: create_el },
                Translation: { t },
                navigate_to_requirement: navigate_spy
            });
            expect(show_spy).toHaveBeenCalledTimes(1);
            const container = document.createElement('div');
            const close_spy = jest.fn();
            content_callback(container, { close: close_spy });
            expect(container.querySelector('.modal-message-block strong')?.textContent).toContain('2 nya flikar');
            const buttons = container.querySelectorAll('.modal-confirm-actions button');
            expect(buttons.length).toBe(3);
            expect(buttons[0].textContent).toBe('Öppna alla granskningsdelar');
            expect(buttons[1].textContent).toBe('Fortsätt bara till kravet');
            expect(buttons[2].textContent).toBe('Stanna på Granskningsöversikten');
            buttons[2].click();
            expect(close_spy).toHaveBeenCalled();
            expect(navigate_spy).not.toHaveBeenCalled();
        });
    });

    describe('show_open_all_sample_urls_modal', () => {
        const orig_modal = app_runtime_refs.modal_component;

        afterEach(() => {
            app_runtime_refs.modal_component = orig_modal;
        });

        test('anropar inte show utan URL:er', () => {
            const show_spy = jest.fn();
            app_runtime_refs.modal_component = { show: show_spy };
            show_open_all_sample_urls_modal({
                trigger_element: null,
                getState: () => ({ samples: [{ url: '' }] }),
                Helpers: { create_element: () => document.createElement('div') },
                Translation: { t: (k) => k }
            });
            expect(show_spy).not.toHaveBeenCalled();
        });

        test('utan getState anropas inte show', () => {
            const show_spy = jest.fn();
            app_runtime_refs.modal_component = { show: show_spy };
            show_open_all_sample_urls_modal({
                trigger_element: null,
                getState: null,
                Helpers: { create_element: () => document.createElement('div') },
                Translation: { t: (k) => k }
            });
            expect(show_spy).not.toHaveBeenCalled();
        });

        test('ModalComponent.show med tomt message_text och strong med antal', () => {
            let content_callback = null;
            const show_spy = jest.fn((config, cb) => {
                expect(config.message_text).toBe('');
                content_callback = cb;
            });
            app_runtime_refs.modal_component = { show: show_spy };
            const t = (key, rep) => {
                if (key === 'open_all_sample_urls_modal_intro_many_lead' && rep?.count === 2) {
                    return `Detta öppnar ${rep.count} nya flikar`;
                }
                const map = {
                    open_all_sample_urls_modal_intro_many_tail: ', resten.'
                };
                return map[key] || key;
            };
            const create_el = (tag, opts) => {
                const el = document.createElement(tag);
                if (opts?.class_name) el.className = Array.isArray(opts.class_name) ? opts.class_name.join(' ') : opts.class_name;
                if (opts?.text_content != null) el.textContent = opts.text_content;
                return el;
            };
            const getState = () => ({
                samples: [{ url: 'x.com' }, { url: 'y.com' }]
            });
            show_open_all_sample_urls_modal({
                trigger_element: null,
                getState,
                Helpers: { create_element: create_el },
                Translation: { t }
            });
            expect(show_spy).toHaveBeenCalledTimes(1);
            expect(typeof content_callback).toBe('function');
            const container = document.createElement('div');
            const msg_p = document.createElement('p');
            msg_p.className = 'modal-message';
            container.appendChild(msg_p);
            content_callback(container, { close: jest.fn() });
            const strong = container.querySelector('.modal-message-block strong');
            expect(strong?.textContent).toBe('Detta öppnar 2 nya flikar');
        });

        test('fill_open_all_sample_urls_modal_message: singular utan delade URL', () => {
            const container = document.createElement('div');
            const create_el = (tag, opts) => {
                const el = document.createElement(tag);
                if (opts?.text_content != null) el.textContent = opts.text_content;
                return el;
            };
            const t = (key) => {
                const m = {
                    open_all_sample_urls_modal_intro_one_lead: 'Ett',
                    open_all_sample_urls_modal_intro_one_tail: ' två.',
                    open_all_sample_urls_modal_find_tab_note: 'Hitta tillbaka till fliken.'
                };
                return m[key] || key;
            };
            fill_open_all_sample_urls_modal_message(container, create_el, t, 1);
            expect(container.querySelector('strong')?.textContent).toBe('Ett');
            expect(container.textContent).toContain('Hitta tillbaka till fliken.');
        });
    });
});
