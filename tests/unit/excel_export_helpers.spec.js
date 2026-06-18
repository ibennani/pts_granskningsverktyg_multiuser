import { jest } from '@jest/globals';
import JSZip from 'jszip';
import {
    build_excel_export_filename,
    sanitize_excel_download_filename_segment,
    sanitize_excel_table_name,
    strip_xlsx_document_metadata,
    to_wcag_yes_only_value
} from '../../js/export/excel_export_helpers.ts';

describe('excel_export_helpers', () => {
    const t_sv = (key) => {
        const map = {
            filename_fallback_actor: 'okänd_aktör',
            excel_export_filename_label: 'Granskningsprotokoll Bilaga 2'
        };
        return map[key] || key;
    };

    test('sanitize_excel_download_filename_segment behåller mellanslag', () => {
        expect(sanitize_excel_download_filename_segment('  PTS AB  ')).toBe('PTS AB');
        expect(sanitize_excel_download_filename_segment('a:b')).toBe('ab');
    });

    test('build_excel_export_filename med diarienummer', () => {
        const audit = { auditMetadata: { caseNumber: '2024-123', actorName: 'PTS AB' } };
        const export_date = new Date(2026, 5, 18);
        const filename = build_excel_export_filename(audit, t_sv, export_date);
        expect(filename).toBe('2024-123 PTS AB Granskningsprotokoll Bilaga 2 2026-06-18.xlsx');
    });

    test('build_excel_export_filename utan diarienummer', () => {
        const audit = { auditMetadata: { actorName: 'PTS AB' } };
        const export_date = new Date(2026, 5, 18);
        const filename = build_excel_export_filename(audit, t_sv, export_date);
        expect(filename).toBe('PTS AB Granskningsprotokoll Bilaga 2 2026-06-18.xlsx');
    });

    test('sanitize_excel_table_name tar bort siffror och mellanslag', () => {
        expect(sanitize_excel_table_name('Audit report')).toBe('Auditreport');
        expect(sanitize_excel_table_name('Granskningsrapport')).toBe('Granskningsrapport');
    });

    test('to_wcag_yes_only_value skriver bara ja', () => {
        expect(to_wcag_yes_only_value('Ja', 'Ja')).toBe('Ja');
        expect(to_wcag_yes_only_value('Nej', 'Ja')).toBe('');
        expect(to_wcag_yes_only_value('Yes', 'Yes')).toBe('Yes');
        expect(to_wcag_yes_only_value('No', 'Yes')).toBe('');
    });

    test('strip_xlsx_document_metadata rensar docProps', async () => {
        const zip = new JSZip();
        zip.file(
            'docProps/core.xml',
            '<?xml version="1.0"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"><dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Test Author</dc:creator></cp:coreProperties>'
        );
        zip.file(
            'docProps/app.xml',
            '<?xml version="1.0"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Excel</Application></Properties>'
        );
        zip.file('docProps/custom.xml', '<Properties/>');
        const input = await zip.generateAsync({ type: 'arraybuffer' });

        const output = await strip_xlsx_document_metadata(input);
        const out_zip = await JSZip.loadAsync(output);
        const core_xml = await out_zip.file('docProps/core.xml')?.async('string');
        const app_xml = await out_zip.file('docProps/app.xml')?.async('string');

        expect(core_xml).not.toContain('Test Author');
        expect(core_xml).not.toContain('creator');
        expect(app_xml).not.toContain('Excel');
        expect(out_zip.file('docProps/custom.xml')).toBeNull();
    });
});
