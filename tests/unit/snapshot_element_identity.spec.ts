/**
 * @fileoverview Enhetstester för elementidentitet.
 */
import { describe, test, expect } from '@jest/globals';
import {
    build_element_identity_from_eval,
    identity_key,
    selector_from_element_id,
    escape_element_id_for_selector,
} from '../../server/snapshots/analysis/snapshot_element_identity.ts';

describe('snapshot_element_identity', () => {
    test('bygger identitet med id', () => {
        const id = build_element_identity_from_eval({
            id: 'btn1',
            tagName: 'button',
        });
        expect(id.selector).toBe('#btn1');
        expect(identity_key(id)).toBe('id:btn1');
    });

    test('escapar specialtecken i id', () => {
        const sel = selector_from_element_id('foo:bar');
        expect(sel).toContain('#');
        expect(escape_element_id_for_selector('a.b')).toBe('a\\.b');
    });
});
