/**
 * @fileoverview Enhetstester för exportfilnamn för medier.
 */

import { build_requirement_media_export_filename } from '../../js/export/export_media_filename.ts';

describe('export_media_filename', () => {
    test('bygger filnamn enligt PTS-format', () => {
        expect(
            build_requirement_media_export_filename({
                deficiency_id: 'B047',
                image_index: 1,
                audit_type_label: 'WEBB',
                granskning_sequence: 1,
                capture_date: '2026-04-11',
                case_number: '26-11111',
                original_filename: 'skarm.png'
            })
        ).toBe('047_1_WEBB_1_2026-04-11_26-11111.png');
    });

    test('flera bilder per brist får ökande bildnummer', () => {
        const base = {
            deficiency_id: 'B047',
            audit_type_label: 'WEBB' as const,
            granskning_sequence: 1,
            capture_date: '2026-04-11',
            case_number: '26-11111',
            original_filename: 'a.jpg'
        };
        expect(build_requirement_media_export_filename({ ...base, image_index: 1 })).toBe(
            '047_1_WEBB_1_2026-04-11_26-11111.jpg'
        );
        expect(build_requirement_media_export_filename({ ...base, image_index: 2 })).toBe(
            '047_2_WEBB_1_2026-04-11_26-11111.jpg'
        );
    });

    test('PDF-etikett och pdf-filändelse', () => {
        expect(
            build_requirement_media_export_filename({
                deficiency_id: 'B7',
                image_index: 1,
                audit_type_label: 'PDF',
                granskning_sequence: 2,
                capture_date: '2026-03-01',
                case_number: '2024-99',
                original_filename: 'scan.PDF'
            })
        ).toBe('7_1_PDF_2_2026-03-01_2024-99.pdf');
    });

    test('WEB-förkortning för engelsk regelfil', () => {
        expect(
            build_requirement_media_export_filename({
                deficiency_id: 'B047',
                image_index: 1,
                audit_type_label: 'WEB',
                granskning_sequence: 1,
                capture_date: '2026-04-11',
                case_number: '26-11111',
                original_filename: 'skarm.png'
            })
        ).toBe('047_1_WEB_1_2026-04-11_26-11111.png');
    });
});
