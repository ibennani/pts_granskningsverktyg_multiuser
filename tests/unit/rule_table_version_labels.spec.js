import {
    arbetskopia_version_label,
    published_row_version_label
} from '../../js/logic/rule_table_version_labels.ts';

describe('rule_table_version_labels', () => {
    test('arbetskopia_version_label prioriterar content_metadata_version före version_display', () => {
        expect(
            arbetskopia_version_label({
                content_metadata_version: '2026.4.r12',
                version_display: '2026.4.r11'
            })
        ).toBe('2026.4.r12');
    });

    test('arbetskopia_version_label använder draft_version om content_metadata_version saknas', () => {
        expect(
            arbetskopia_version_label({
                draft_version: '2026.5.r3',
                version_display: '2026.4.r11'
            })
        ).toBe('2026.5.r3');
    });

    test('published_row_version_label visar draft_version när has_draft', () => {
        expect(
            published_row_version_label({
                has_draft: true,
                draft_version: '2026.4.r15',
                version_display: '2026.4.r11'
            })
        ).toBe('2026.4.r15');
    });

    test('published_row_version_label visar version_display utan utkast', () => {
        expect(
            published_row_version_label({
                has_draft: false,
                version_display: '2026.4.r11'
            })
        ).toBe('2026.4.r11');
    });
});
