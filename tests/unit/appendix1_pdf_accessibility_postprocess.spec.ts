/**
 * @fileoverview Enhetstester för Bilaga 1 PDF-efterbearbetning (omslag som Artifact).
 */
import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
    postprocess_appendix1_pdf_accessibility,
    read_first_page_contents_for_tests,
} from '../../shared/pdf/appendix1_pdf_accessibility_postprocess.ts';

const sample_pdf_path = path.join(process.cwd(), '.cursor', '_tmp_tagged.pdf');

describe('appendix1_pdf_accessibility_postprocess', () => {
    test('markerar första sidans contents som Artifact och behåller StructTreeRoot', () => {
        if (!fs.existsSync(sample_pdf_path)) {
            return;
        }

        const original = fs.readFileSync(sample_pdf_path);
        expect(original.includes(Buffer.from('StructTreeRoot'))).toBe(true);

        const before = read_first_page_contents_for_tests(original);
        expect(before.includes('/Artifact')).toBe(false);

        const updated = postprocess_appendix1_pdf_accessibility(original);
        expect(updated.includes(Buffer.from('StructTreeRoot'))).toBe(true);
        expect(updated.length).toBeGreaterThan(original.length);

        const after = read_first_page_contents_for_tests(updated);
        expect(after.includes('/Artifact BMC')).toBe(true);
        expect(after.includes('EMC')).toBe(true);
    });
});
