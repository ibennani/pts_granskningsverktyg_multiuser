import { describe, test, expect } from '@jest/globals';
import {
    extract_sample_url_analyze_fetch_error_detail,
    get_sample_url_analyze_fetch_error_message,
} from '../../js/components/add_sample_form/sample_url_analyze_capture_errors.ts';

const t = (key: string) => key;

describe('sample_url_analyze_capture_errors', () => {
    test('get_sample_url_analyze_fetch_error_message returnerar rätt nyckel per orsak', () => {
        expect(get_sample_url_analyze_fetch_error_message(t, 'not_logged_in')).toBe(
            'sample_url_analyze_error_not_logged_in'
        );
        expect(get_sample_url_analyze_fetch_error_message(t, 'no_audit_id')).toBe(
            'sample_url_analyze_error_no_audit_id'
        );
        expect(get_sample_url_analyze_fetch_error_message(t, 'invalid_url')).toBe(
            'sample_url_analyze_error_invalid_url'
        );
    });

    test('extract_sample_url_analyze_fetch_error_detail plockar Error.message', () => {
        expect(extract_sample_url_analyze_fetch_error_detail(new Error('Navigation timeout'))).toBe(
            'Navigation timeout'
        );
    });

    test('extract_sample_url_analyze_fetch_error_detail hanterar okänt fel', () => {
        expect(extract_sample_url_analyze_fetch_error_detail(null)).toBe('Okänt fel');
    });
});
