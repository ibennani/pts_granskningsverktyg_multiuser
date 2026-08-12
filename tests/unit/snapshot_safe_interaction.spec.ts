/**
 * @fileoverview Enhetstester för säker interaktionspolicy.
 */
import { describe, test, expect } from '@jest/globals';
import {
    classify_safe_interaction,
    is_write_method,
} from '../../server/snapshots/analysis/snapshot_safe_interaction.ts';

describe('classify_safe_interaction', () => {
    test('skippar vanlig länk', () => {
        const v = classify_safe_interaction({
            tagName: 'a',
            href: 'https://example.com',
        });
        expect(v.safe).toBe(false);
        expect(v.reason).toBe('link-navigation');
    });

    test('skippar submit', () => {
        expect(
            classify_safe_interaction({ tagName: 'button', type: 'submit' }).safe
        ).toBe(false);
        expect(
            classify_safe_interaction({ tagName: 'input', type: 'submit' }).safe
        ).toBe(false);
    });

    test('tillåter aria-expanded', () => {
        expect(
            classify_safe_interaction({
                tagName: 'button',
                ariaExpanded: 'false',
            }).safe
        ).toBe(true);
    });

    test('tillåter summary', () => {
        expect(
            classify_safe_interaction({ tagName: 'summary', isSummary: true }).safe
        ).toBe(true);
    });

    test('skippar destruktiv knapp', () => {
        expect(
            classify_safe_interaction({
                tagName: 'button',
                text: 'Delete account',
            }).safe
        ).toBe(false);
    });

    test('skippar osäker kontroll', () => {
        expect(
            classify_safe_interaction({ tagName: 'div' }).safe
        ).toBe(false);
        expect(
            classify_safe_interaction({ tagName: 'div' }).reason
        ).toBe('uncertain');
    });
});

describe('is_write_method', () => {
    test('identifierar POST som write', () => {
        expect(is_write_method('POST')).toBe(true);
    });
    test('GET är inte write', () => {
        expect(is_write_method('GET')).toBe(false);
    });
});
