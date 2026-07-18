/**
 * @fileoverview Enhetstester för publicerade regelfilers övervakningstyp-alternativ.
 */

import { describe, expect, test } from '@jest/globals';
import {
    build_published_monitoring_rule_options,
    find_monitoring_option_by_key,
    find_monitoring_option_by_rule_id,
    is_published_rule_row,
    monitoring_option_label_for_rule_row,
    resolve_monitoring_kind_from_rule_row,
    resolve_selected_monitoring_key
} from '../../js/logic/published_monitoring_rule_options.ts';

const t = (key: string) => {
    const map: Record<string, string> = {
        audit_type_filter_webb: 'Webb',
        audit_type_filter_pdf: 'PDF'
    };
    return map[key] ?? key;
};

const version_greater_than = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true }) > 0;

describe('published_monitoring_rule_options', () => {
    test('is_published_rule_row skiljer publicerade från arbetskopior', () => {
        expect(is_published_rule_row({ id: '1', is_published: true, list_as_arbetskopia: false })).toBe(true);
        expect(is_published_rule_row({ id: '2', list_as_arbetskopia: true })).toBe(false);
    });

    test('resolve_monitoring_kind_from_rule_row härleder webb och pdf', () => {
        expect(resolve_monitoring_kind_from_rule_row({ id: 'w', monitoring_type_text: 'Webbplats' })).toBe('web');
        expect(resolve_monitoring_kind_from_rule_row({ id: 'p', monitoring_type_text: 'PDF-dokument' })).toBe('pdf');
    });

    test('monitoring_option_label_for_rule_row använder översatta etiketter för webb/pdf', () => {
        expect(monitoring_option_label_for_rule_row({ id: 'w', monitoring_type_text: 'Webb' }, t)).toBe('Webb');
        expect(monitoring_option_label_for_rule_row({ id: 'p', monitoring_type_text: 'PDF' }, t)).toBe('PDF');
        expect(
            monitoring_option_label_for_rule_row({ id: 'x', monitoring_type_text: 'Annan typ' }, t)
        ).toBe('Annan typ');
    });

    test('build_published_monitoring_rule_options deduplicerar och sorterar', () => {
        const options = build_published_monitoring_rule_options(
            [
                { id: 'old', monitoring_type_text: 'Webb', metadata_version: '1.0', is_published: true },
                { id: 'new', monitoring_type_text: 'Webb', metadata_version: '2.0', is_published: true },
                { id: 'pdf', monitoring_type_text: 'PDF', metadata_version: '1.0', is_published: true },
                { id: 'draft', monitoring_type_text: 'Webb', list_as_arbetskopia: true }
            ],
            version_greater_than,
            t
        );
        expect(options).toHaveLength(2);
        expect(options[0].label).toBe('PDF');
        expect(options[1].label).toBe('Webb');
        expect(find_monitoring_option_by_rule_id(options, 'new')?.rule_id).toBe('new');
        expect(find_monitoring_option_by_key(options, options[1].key)?.rule_id).toBe('new');
        expect(resolve_selected_monitoring_key(options, 'pdf')).toBe(options[0].key);
    });
});
