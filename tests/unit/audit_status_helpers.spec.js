import {
    audit_status_allows_metadata_edit,
    audit_status_blocks_sample_and_requirement_edits,
    audit_status_blocks_requirement_navigation,
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

    test('audit_status_blocks_sample_and_requirement_edits för avslutad och arkiverad', () => {
        expect(audit_status_blocks_sample_and_requirement_edits('locked')).toBe(true);
        expect(audit_status_blocks_sample_and_requirement_edits('archived')).toBe(true);
        expect(audit_status_blocks_sample_and_requirement_edits('in_progress')).toBe(false);
        expect(audit_status_blocks_sample_and_requirement_edits('not_started')).toBe(false);
    });

    test('audit_status_blocks_requirement_navigation endast för förberedd granskning', () => {
        expect(audit_status_blocks_requirement_navigation('not_started')).toBe(true);
        expect(audit_status_blocks_requirement_navigation('in_progress')).toBe(false);
        expect(audit_status_blocks_requirement_navigation('locked')).toBe(false);
        expect(audit_status_blocks_requirement_navigation('archived')).toBe(false);
    });
});
