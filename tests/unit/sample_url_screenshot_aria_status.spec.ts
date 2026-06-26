/**
 * @fileoverview Enhetstester för dold aria-live-status vid URL-skärmdump.
 */
import { describe, test, expect } from '@jest/globals';
import {
    find_url_screenshot_live_region,
    set_sample_url_screenshot_live_status,
} from '../../js/components/add_sample_form/sample_url_screenshot_aria_status.ts';

describe('sample_url_screenshot_aria_status', () => {
    test('set_sample_url_screenshot_live_status skriver inte capturing till dold region', () => {
        const btn = document.createElement('button');
        const region = document.createElement('span');
        region.setAttribute('data-url-screenshot-live-status', 'true');
        btn.appendChild(region);

        const t = (key: string) => {
            if (key === 'sample_screenshot_live_capturing') return 'Tar skärmavbild';
            return key;
        };

        set_sample_url_screenshot_live_status(btn, 'capturing', t);
        expect(find_url_screenshot_live_region(btn)?.textContent).toBe('');
    });

    test('set_sample_url_screenshot_live_status sätter success i live-region', () => {
        const btn = document.createElement('button');
        const region = document.createElement('span');
        region.setAttribute('data-url-screenshot-live-status', 'true');
        btn.appendChild(region);

        const t = (key: string) => {
            if (key === 'sample_screenshot_live_success') return 'Skärmdump klar';
            return key;
        };

        set_sample_url_screenshot_live_status(btn, 'success', t);
        expect(find_url_screenshot_live_region(btn)?.textContent).toBe('Skärmdump klar');
    });

    test('set_sample_url_screenshot_live_status tömmer vid idle', () => {
        const btn = document.createElement('button');
        const region = document.createElement('span');
        region.setAttribute('data-url-screenshot-live-status', 'true');
        region.textContent = 'Gammal status';
        btn.appendChild(region);

        set_sample_url_screenshot_live_status(btn, 'idle', (key) => key);
        expect(region.textContent).toBe('');
    });
});
