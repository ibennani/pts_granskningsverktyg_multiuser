import { describe, it, expect } from '@jest/globals';
import { handle_submit_create, handle_submit } from '../../js/logic/rulefile_metadata_submit.js';

describe('rulefile_metadata_submit', () => {
    it('exporterar handle_submit_create och handle_submit', () => {
        expect(typeof handle_submit_create).toBe('function');
        expect(typeof handle_submit).toBe('function');
    });
});
