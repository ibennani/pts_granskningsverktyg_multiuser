import { describe, test, expect } from '@jest/globals';
import {
    format_nonzero_percent_suffix,
    format_overview_distribution_percent_suffix
} from '../../js/logic/audit_status_stack_labels.js';

function mock_format(n, lang) {
    return new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(n);
}

describe('format_nonzero_percent_suffix', () => {
    test('returnerar null vid noll antal eller total', () => {
        expect(format_nonzero_percent_suffix(0, 10, mock_format, 'sv-SE')).toBeNull();
        expect(format_nonzero_percent_suffix(5, 0, mock_format, 'sv-SE')).toBeNull();
        expect(format_nonzero_percent_suffix(-1, 10, mock_format, 'sv-SE')).toBeNull();
    });

    test('returnerar suffix när procent är större än noll', () => {
        const s = format_nonzero_percent_suffix(1, 4, mock_format, 'sv-SE');
        expect(s).not.toBeNull();
        expect(s).toContain('%');
    });

    test('returnerar null om formaterat tal blir noll', () => {
        const always_zero = () => '0,0';
        expect(format_nonzero_percent_suffix(1, 10000, always_zero, 'sv-SE')).toBeNull();
    });
});

describe('format_overview_distribution_percent_suffix', () => {
    test('returnerar tom sträng vid total 0', () => {
        expect(format_overview_distribution_percent_suffix(0, 0, mock_format, 'sv-SE')).toBe('');
        expect(format_overview_distribution_percent_suffix(3, 0, mock_format, 'sv-SE')).toBe('');
    });

    test('visar procent även när antal är 0', () => {
        const s = format_overview_distribution_percent_suffix(0, 10, mock_format, 'sv-SE');
        expect(s).toContain('%');
        expect(s).toMatch(/0/);
    });

    test('visar procent när antal är positivt', () => {
        const s = format_overview_distribution_percent_suffix(1, 4, mock_format, 'sv-SE');
        expect(s).toContain('%');
    });
});
