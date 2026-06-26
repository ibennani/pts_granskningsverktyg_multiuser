/**
 * @jest-environment jsdom
 */
import { describe, test, expect, beforeEach } from '@jest/globals';
import {
    get_version_reload_prompt,
    set_version_reload_prompt,
    clear_version_reload_prompt,
    VERSION_RELOAD_PROMPT_EVENT
} from '../../js/logic/version_reload_prompt_state.js';
import { sync_version_reload_banner_in_host } from '../../js/logic/version_reload_banner_mount.js';
import {
    CRITICAL_NOTICE_BANNER_CLASS,
    VERSION_RELOAD_BANNER_ID
} from '../../js/utils/critical_notice_banner_ui.js';

describe('version_reload_prompt_state', () => {
    beforeEach(() => {
        clear_version_reload_prompt();
    });

    test('set_version_reload_prompt sparar och clear tar bort', () => {
        set_version_reload_prompt({ message: 'Ny version', on_reload: () => {} });
        expect(get_version_reload_prompt()?.message).toBe('Ny version');
        clear_version_reload_prompt();
        expect(get_version_reload_prompt()).toBeNull();
    });

    test('set_version_reload_prompt triggar custom event', () => {
        let fired = false;
        document.addEventListener(VERSION_RELOAD_PROMPT_EVENT, () => {
            fired = true;
        });
        set_version_reload_prompt({ message: 'Ny version', on_reload: () => {} });
        expect(fired).toBe(true);
    });
});

describe('sync_version_reload_banner_in_host', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
        clear_version_reload_prompt();
        window.Translation = { t: (key) => (key === 'reload_page' ? 'Ladda om sidan' : key) };
    });

    test('monterar orange banner efter h1 med samma klass som regelfilsnotis', () => {
        const host = document.createElement('div');
        host.innerHTML = '<div class="content-plate"><h1>Översikt</h1><p>Innehåll</p></div>';
        document.body.appendChild(host);

        set_version_reload_prompt({
            message: 'En ny version är tillgänglig.',
            on_reload: () => {}
        });
        sync_version_reload_banner_in_host(host);

        const banner = host.querySelector(`#${VERSION_RELOAD_BANNER_ID}`);
        expect(banner).not.toBeNull();
        expect(banner?.classList.contains(CRITICAL_NOTICE_BANNER_CLASS)).toBe(true);
        expect(banner?.textContent).toContain('En ny version är tillgänglig.');
        expect(banner?.textContent).toContain('Ladda om sidan');
        expect(host.querySelector('h1')?.nextElementSibling).toBe(banner);
    });
});
