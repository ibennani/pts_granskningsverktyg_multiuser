import { should_skip_draft_restore_for_view } from '../../js/logic/draft_restore_policy.ts';

describe('should_skip_draft_restore_for_view', () => {
    test('hoppar över utkast för ny granskning med freshNewAuditMetadata', () => {
        expect(
            should_skip_draft_restore_for_view('metadata', {
                auditStatus: 'not_started',
                freshNewAuditMetadata: true,
            })
        ).toBe(true);
    });

    test('återställer utkast för pågående granskning', () => {
        expect(
            should_skip_draft_restore_for_view('metadata', {
                auditStatus: 'in_progress',
                freshNewAuditMetadata: true,
            })
        ).toBe(false);
    });

    test('återställer utkast när freshNewAuditMetadata är false', () => {
        expect(
            should_skip_draft_restore_for_view('metadata', {
                auditStatus: 'not_started',
                freshNewAuditMetadata: false,
            })
        ).toBe(false);
    });

    test('gäller inte andra vyer', () => {
        expect(
            should_skip_draft_restore_for_view('audit_overview', {
                auditStatus: 'not_started',
                freshNewAuditMetadata: true,
            })
        ).toBe(false);
    });
});
