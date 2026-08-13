/**
 * @fileoverview Enhetstester för structure_fingerprint.
 */
import { describe, test, expect } from '@jest/globals';
import {
    structure_fingerprint_hash,
    structure_similarity_score,
    build_structure_node_from_eval,
    normalize_element_id_for_fingerprint,
} from '../../shared/recurring/structure_fingerprint.ts';

describe('structure_fingerprint', () => {
    test('normaliserar dynamiska id', () => {
        expect(normalize_element_id_for_fingerprint('react-aria123')).toBe('*');
        expect(normalize_element_id_for_fingerprint('site-header')).toBe('site-header');
    });

    test('samma struktur ger samma hash', () => {
        const node = build_structure_node_from_eval({
            tagName: 'header',
            role: 'banner',
            children: [{ tagName: 'nav', role: 'navigation' }],
        });
        const hash_a = structure_fingerprint_hash(node);
        const hash_b = structure_fingerprint_hash({ ...node });
        expect(hash_a).toBe(hash_b);
    });

    test('liknande barn ger hög similarity', () => {
        const a = build_structure_node_from_eval({
            tagName: 'footer',
            children: [{ tagName: 'nav' }, { tagName: 'p' }],
        });
        const b = build_structure_node_from_eval({
            tagName: 'footer',
            children: [{ tagName: 'nav' }, { tagName: 'p' }],
        });
        expect(structure_similarity_score(a, b)).toBe(1);
    });
});
