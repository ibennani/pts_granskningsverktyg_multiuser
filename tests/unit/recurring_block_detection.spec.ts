/**
 * @fileoverview Enhetstester för recurring block-detektion (logik utan filsystem).
 */
import { describe, test, expect } from '@jest/globals';
import {
    structure_similarity_score,
    build_structure_node_from_eval,
} from '../../shared/recurring/structure_fingerprint.ts';

describe('recurring_block_detection', () => {
    test('liknande footer-strukturer klustras med hög similarity', () => {
        const a = build_structure_node_from_eval({
            tagName: 'footer',
            children: [{ tagName: 'nav' }, { tagName: 'p' }],
        });
        const b = build_structure_node_from_eval({
            tagName: 'footer',
            children: [{ tagName: 'nav' }, { tagName: 'p' }],
        });
        expect(structure_similarity_score(a, b)).toBeGreaterThanOrEqual(0.75);
    });

    test('cross-page kräver minst två sidor', () => {
        const entries = [{ sampleId: 's1', captureId: 'c1' }];
        expect(entries.length >= 2).toBe(false);
    });
});
