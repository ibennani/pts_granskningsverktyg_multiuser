/**
 * Tester för Word-filvalidering vid import.
 */
import { describe, test, expect } from '@jest/globals';
import {
    is_word_docx_file,
    pick_single_word_docx_file,
    WORD_IMPORT_MAX_BYTES,
} from '../../shared/import/word_file_validation.ts';

describe('word_file_validation', () => {
    test('accepterar .docx-filer', () => {
        const file = new File(['x'], 'test.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        expect(is_word_docx_file(file)).toBe(true);
        expect(pick_single_word_docx_file([file])).toBe(file);
    });

    test('avvisar andra filtyper', () => {
        const file = new File(['x'], 'test.pdf', { type: 'application/pdf' });
        expect(is_word_docx_file(file)).toBe(false);
        expect(pick_single_word_docx_file([file])).toBeNull();
    });

    test('avvisar för stora filer', () => {
        const file = new File([new Uint8Array(WORD_IMPORT_MAX_BYTES + 1)], 'big.docx', {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
        expect(pick_single_word_docx_file([file])).toBeNull();
    });
});
