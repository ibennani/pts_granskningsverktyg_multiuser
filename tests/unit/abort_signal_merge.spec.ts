/**
 * @jest-environment node
 */
import { describe, test, expect } from '@jest/globals';
import { merge_abort_signals } from '../../server/services/abort_signal_merge.ts';

describe('abort_signal_merge', () => {
    test('merge_abort_signals blir avbruten när en ingående signal avbryts', () => {
        const controller = new AbortController();
        const merged = merge_abort_signals([controller.signal, AbortSignal.timeout(60_000)]);
        controller.abort();
        expect(merged.aborted).toBe(true);
    });
});
