/**
 * @fileoverview Tester för serversidans PUT-förberedelse (versionsbump från DB).
 */

import { describe, it, expect } from '@jest/globals';
import { prepare_rulefile_content_for_server_put } from '../../shared/rulefile/rulefile_server_put_prepare.js';

describe('prepare_rulefile_content_for_server_put', () => {
    it('bump:ar från befintlig DB-version när bump_version är true', () => {
        const d = new Date('2026-07-14T00:01:00+02:00');
        const out = prepare_rulefile_content_for_server_put(
            '2026.4.r1',
            {
                metadata: {
                    version: '2026.4.r1',
                    pageTypes: ['A'],
                    vocabularies: { pageTypes: ['A'] }
                },
                requirements: {}
            },
            { reference_date: d, bump_version: true }
        );
        expect(out?.metadata?.version).toBe('2026.7.r1');
        expect((out?.metadata as Record<string, unknown>)?.vocabularies).toBeUndefined();
        expect(out?.metadata?.dateModified).toBe('2026-07-13');
    });

    it('ökar r inom samma månad när DB redan har aktuell månad och bump_version är true', () => {
        const d = new Date('2026-07-14T12:00:00+02:00');
        const out = prepare_rulefile_content_for_server_put(
            '2026.7.r3',
            { metadata: { version: '2026.7.r99' }, requirements: {} },
            { reference_date: d, bump_version: true }
        );
        expect(out?.metadata?.version).toBe('2026.7.r4');
    });

    it('behåller DB-version vid utkastsparning utan bump_version', () => {
        const d = new Date('2026-07-14T12:00:00+02:00');
        const out = prepare_rulefile_content_for_server_put(
            '2026.7.r3',
            { metadata: { version: '2026.7.r9', title: 'Ny titel' }, requirements: {} },
            { reference_date: d, bump_version: false }
        );
        expect(out?.metadata?.version).toBe('2026.7.r3');
        expect(out?.metadata?.title).toBe('Ny titel');
        expect(out?.metadata?.dateModified).toBe('2026-07-14');
    });
});
