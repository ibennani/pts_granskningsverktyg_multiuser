/**
 * @fileoverview Enhetstester för consent-cache fil-I/O.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let temp_dir = '';

beforeEach(async () => {
    temp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'cmp-consent-cache-'));
    process.env.GV_CMP_CONSENT_CACHE_DIR = temp_dir;
    process.env.GV_CMP_CONSENT_SEED_FILE = path.join(temp_dir, 'seed.json');
});

afterEach(async () => {
    delete process.env.GV_CMP_CONSENT_CACHE_DIR;
    delete process.env.GV_CMP_CONSENT_SEED_FILE;
    await fs.rm(temp_dir, { recursive: true, force: true });
});

describe('page_screenshot_consent_cache', () => {
    test('load_consent_for_domain läser seed och auto-cache', async () => {
        await fs.writeFile(
            process.env.GV_CMP_CONSENT_SEED_FILE!,
            JSON.stringify({
                'example.com': {
                    source: 'manual',
                    updated_at: '2026-07-01T00:00:00.000Z',
                    cookies: [
                        {
                            name: 'CookieConsent',
                            value: 'seed-value',
                            domain: '.example.com',
                            path: '/',
                        },
                    ],
                    local_storage: {},
                },
            }),
            'utf8'
        );

        const { load_consent_for_domain } = await import(
            '../../server/services/page_screenshot_consent_cache.ts'
        );
        const snapshot = await load_consent_for_domain('https://www.example.com/page');
        expect(snapshot?.cookies[0]?.value).toBe('seed-value');
    });

    test('learn_consent_from_page sparar fil per domän', async () => {
        const cookies_mock = jest.fn(async () => [
            {
                name: 'CookieConsent',
                value: 'learned-value',
                domain: '.learn.test',
                path: '/',
            },
        ]);
        const evaluate_mock = jest.fn(async () => ({}));

        const page = {
            cookies: cookies_mock,
            evaluate: evaluate_mock,
        };

        const { learn_consent_from_page } = await import(
            '../../server/services/page_screenshot_consent_cache.ts'
        );
        await learn_consent_from_page(page as never, 'https://learn.test/');

        const cache_file = path.join(temp_dir, 'learn.test.json');
        const raw = await fs.readFile(cache_file, 'utf8');
        const parsed = JSON.parse(raw);
        expect(parsed.cookies[0].value).toBe('learned-value');
    });
});
