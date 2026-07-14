/**
 * Tester för parse av handläggar-Word (röda celler).
 */
import { describe, test, expect } from '@jest/globals';
import { parse_document_xml } from '../../js/import/parse_observation_word_handling_docx.ts';

const SAMPLE_DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:tbl>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcBorders>
              <w:top w:val="single" w:sz="6" w:color="CC0000"/>
              <w:bottom w:val="single" w:sz="6" w:color="CC0000"/>
              <w:left w:val="single" w:sz="6" w:color="CC0000"/>
              <w:right w:val="single" w:sz="6" w:color="CC0000"/>
            </w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:pPr><w:pStyle w:val="Heading4"/></w:pPr>
            <w:r><w:t>Brist-id 3</w:t></w:r>
          </w:p>
          <w:p>
            <w:r><w:t>NY text</w:t></w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
  </w:body>
</w:document>`;

describe('parse_observation_word_handling_docx', () => {
    test('läser brist-id och brödtext från röd cell', () => {
        const blocks = parse_document_xml(SAMPLE_DOCUMENT_XML, new Map());
        expect(blocks).toHaveLength(1);
        expect(blocks[0].id_number).toBe('3');
        expect(blocks[0].observation_markdown).toBe('NY text');
    });
});
