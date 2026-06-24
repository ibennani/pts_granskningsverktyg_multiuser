import {
    audit_status_allows_metadata_edit,
    audit_status_is_fully_readonly
} from '../../js/utils/audit_status_helpers.js';

describe('audit_status_helpers metadata', () => {
    test('audit_status_allows_metadata_edit för pågående och avslutad', () => {
        expect(audit_status_allows_metadata_edit('in_progress')).toBe(true);
        expect(audit_status_allows_metadata_edit('locked')).toBe(true);
        expect(audit_status_allows_metadata_edit('archived')).toBe(false);
        expect(audit_status_allows_metadata_edit('not_started')).toBe(false);
    });

    test('audit_status_is_fully_readonly endast för arkiverad', () => {
        expect(audit_status_is_fully_readonly('archived')).toBe(true);
        expect(audit_status_is_fully_readonly('locked')).toBe(false);
    });
});
