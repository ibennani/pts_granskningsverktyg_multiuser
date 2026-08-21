/**
 * @fileoverview Enhetstester för borttagning av NonStruct i PDF-taggträdet.
 */
import { describe, test, expect } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import {
    count_nonstruct_markers,
    remove_nonstruct_wrappers_from_pdf,
} from '../../shared/pdf/pdf_remove_nonstruct_wrappers.ts';
import { read_object_dictionary_at } from '../../shared/pdf/pdf_incremental_object_replace.ts';
import { parse_struct_elem_dict } from '../../shared/pdf/pdf_struct_elem.ts';

const sample_pdf_path = path.join(process.cwd(), '.cursor', '_tmp_appendix1_struct.pdf');

describe('pdf_remove_nonstruct_wrappers', () => {
    test('tar bort NonStruct och lyfter semantiska taggar direkt under Document', () => {
        if (!fs.existsSync(sample_pdf_path)) {
            return;
        }

        const original = fs.readFileSync(sample_pdf_path);
        expect(count_nonstruct_markers(original)).toBeGreaterThan(0);

        const updated = remove_nonstruct_wrappers_from_pdf(original);
        expect(count_nonstruct_markers(updated)).toBe(0);
        expect(updated.includes(Buffer.from('StructTreeRoot'))).toBe(true);

        const document_dict = read_object_dictionary_at(updated, 13);
        const document_node = parse_struct_elem_dict(13, document_dict);
        expect(document_node?.struct_type).toBe('Document');
        expect(document_node?.k_entries.map((entry) => (entry.kind === 'ref' ? entry.object_number : null))).toEqual([
            16, 18, 25, 28,
        ]);
    });
});
