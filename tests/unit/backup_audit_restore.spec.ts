import {
    build_audit_import_body,
    should_recreate_deleted_audit_on_restore
} from '../../js/components/backup/backup_audit_restore.ts';

describe('backup_audit_restore', () => {
    test('build_audit_import_body inkluderar auditId vid ersättning', () => {
        const body = build_audit_import_body({
            ruleFileContent: { requirements: {} },
            auditMetadata: { actorName: 'Test' },
            samples: [{ id: 's1' }],
            auditStatus: 'in_progress'
        }, 'audit-uuid');

        expect(body.auditId).toBe('audit-uuid');
        expect(body.auditStatus).toBe('in_progress');
    });

    test('should_recreate_deleted_audit_on_restore vid saknad granskning', () => {
        expect(should_recreate_deleted_audit_on_restore({ status: 404, message: 'Granskning hittades inte' })).toBe(true);
        expect(should_recreate_deleted_audit_on_restore({ status: 400, message: 'Ingen dubblett att ersätta' })).toBe(true);
        expect(should_recreate_deleted_audit_on_restore({ status: 409, message: 'Versionskonflikt' })).toBe(false);
    });
});
