/**
 * @fileoverview Enhetstester för gemensamt export-API för mediefilnamn.
 */

import {
    format_media_export_filenames_for_cell,
    format_media_filenames_for_export,
    format_raw_media_filenames,
    format_sample_media_filenames_for_export,
    resolve_media_export_filename,
    resolve_media_export_filenames,
    resolve_sample_media_export_filename
} from '../../js/export/export_media_naming.ts';

const sample_context = {
    audit_type_label: 'WEBB',
    granskning_sequence: 1,
    case_number: '26-11111',
    deficiency_id_part_width: 3,
    capture_dates: new Map([
        ['skarm1.png', '2026-04-11'],
        ['skarm2.png', '2026-04-12'],
        ['a.png', '2026-04-11'],
        ['stickprov.png', '2026-04-11']
    ])
};

describe('export_media_naming', () => {
    test('format_raw_media_filenames med flera filnamn', () => {
        expect(format_raw_media_filenames(['a.png', 'b.jpg'])).toBe('a.png\nb.jpg');
    });

    test('format_raw_media_filenames tom eller ogiltig', () => {
        expect(format_raw_media_filenames([])).toBe('');
        expect(format_raw_media_filenames(null)).toBe('');
        expect(format_raw_media_filenames(['  ', 'c.png'])).toBe('c.png');
    });

    test('resolve_media_export_filename bygger PTS-format', () => {
        expect(
            resolve_media_export_filename('a.png', sample_context, {
                deficiency_id: 'B047',
                image_index: 1
            })
        ).toBe('047_1_WEBB_1_2026-04-11_26-11111.png');
    });

    test('resolve_media_export_filenames ger ökande bildnummer', () => {
        expect(
            resolve_media_export_filenames(['skarm1.png', 'skarm2.png'], sample_context, {
                deficiency_id: 'B047'
            })
        ).toEqual([
            '047_1_WEBB_1_2026-04-11_26-11111.png',
            '047_2_WEBB_1_2026-04-12_26-11111.png'
        ]);
    });

    test('format_media_export_filenames_for_cell en rad per filnamn', () => {
        expect(
            format_media_export_filenames_for_cell(['a.png'], sample_context, {
                deficiency_id: 'B047'
            })
        ).toBe('047_1_WEBB_1_2026-04-11_26-11111.png');
    });

    test('format_media_filenames_for_export utan kontext ger råa filnamn', () => {
        expect(format_media_filenames_for_export(['a.png', 'b.jpg'], null, {})).toBe('a.png\nb.jpg');
    });

    test('format_media_filenames_for_export med kontext ger PTS-format', () => {
        expect(
            format_media_filenames_for_export(['a.png'], sample_context, { deficiency_id: 'B047' })
        ).toBe('047_1_WEBB_1_2026-04-11_26-11111.png');
    });

    test('format_media_filenames_for_export med engelsk förkortning i kontext', () => {
        const en_context = { ...sample_context, audit_type_label: 'WEB' };
        expect(
            format_media_filenames_for_export(['a.png'], en_context, { deficiency_id: 'B047' })
        ).toBe('047_1_WEB_1_2026-04-11_26-11111.png');
    });

    test('resolve_sample_media_export_filename använder stickprovsordning', () => {
        const samples = [{ id: 's1' }, { id: 's2' }];
        expect(
            resolve_sample_media_export_filename('stickprov.png', sample_context, { sample_id: 's2' }, samples)
        ).toBe('000_2_WEBB_1_2026-04-11_26-11111.png');
    });

    test('format_sample_media_filenames_for_export tar bara första bilden', () => {
        const samples = [{ id: 's1' }];
        expect(
            format_sample_media_filenames_for_export(
                ['a.png', 'b.png'],
                sample_context,
                { sample_id: 's1' },
                samples
            )
        ).toBe('000_1_WEBB_1_2026-04-11_26-11111.png');
    });
});
