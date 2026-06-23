/**
 * @fileoverview Enhetstester för server-Zod-scheman och gränsvalidering.
 */

import { describe, expect, test } from '@jest/globals';
import { AuditLockBodySchema } from '../../server/schemas/audit_lock.ts';
import { CreateAuditBodySchema } from '../../server/schemas/audit_create.ts';
import { AuditPatchBodySchema } from '../../server/schemas/audit_patch.ts';
import {
    AuditImportBodySchema,
    validate_replace_existing_audit_id
} from '../../server/schemas/audit_import.ts';
import { AuditRowSchema } from '../../server/schemas/audit_db_rows.ts';
import { format_zod_error } from '../../server/utils/zod_boundary.ts';

describe('server Zod-scheman', () => {
    test('AuditLockBodySchema accepterar giltig kropp', () => {
        const parsed = AuditLockBodySchema.safeParse({
            part_key: 'audit:abc:sample:1',
            client_lock_id: '550e8400-e29b-41d4-a716-446655440000',
            ttl_seconds: 30
        });
        expect(parsed.success).toBe(true);
    });

    test('AuditLockBodySchema avvisar saknad part_key', () => {
        const parsed = AuditLockBodySchema.safeParse({
            client_lock_id: '550e8400-e29b-41d4-a716-446655440000'
        });
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(format_zod_error(parsed.error)).toBe('part_key krävs');
        }
    });

    test('CreateAuditBodySchema kräver rule_set_id', () => {
        const parsed = CreateAuditBodySchema.safeParse({});
        expect(parsed.success).toBe(false);
        if (!parsed.success) {
            expect(format_zod_error(parsed.error)).toBe('rule_set_id krävs');
        }
    });

    test('AuditPatchBodySchema kräver expectedVersion och minst ett fält', () => {
        const missing_version = AuditPatchBodySchema.safeParse({ status: 'locked' });
        expect(missing_version.success).toBe(false);
        if (!missing_version.success) {
            expect(format_zod_error(missing_version.error)).toBe('expectedVersion krävs för att spara granskningen');
        }

        const empty_patch = AuditPatchBodySchema.safeParse({ expectedVersion: 1 });
        expect(empty_patch.success).toBe(false);
        if (!empty_patch.success) {
            expect(format_zod_error(empty_patch.error)).toBe('Ingen data att uppdatera');
        }

        const valid = AuditPatchBodySchema.safeParse({ expectedVersion: 2, metadata: { caseNumber: '1' } });
        expect(valid.success).toBe(true);
    });

    test('AuditImportBodySchema tillåter extra fält via passthrough', () => {
        const parsed = AuditImportBodySchema.safeParse({
            saveFileVersion: '2.1.0',
            ruleFileContent: { metadata: {}, requirements: {} },
            auditMetadata: {},
            auditStatus: 'not_started',
            samples: []
        });
        expect(parsed.success).toBe(true);
    });

    test('validate_replace_existing_audit_id avvisar ogiltigt uuid', () => {
        expect(validate_replace_existing_audit_id('inte-uuid')).toBeNull();
        expect(validate_replace_existing_audit_id('550e8400-e29b-41d4-a716-446655440000')).toBe(
            '550e8400-e29b-41d4-a716-446655440000'
        );
        expect(validate_replace_existing_audit_id('')).toBeNull();
    });

    test('AuditRowSchema accepterar jsonb som sträng eller objekt', () => {
        const as_object = AuditRowSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            metadata: { caseNumber: '1' },
            samples: '[]',
            version: 1
        });
        expect(as_object.success).toBe(true);

        const as_string_metadata = AuditRowSchema.safeParse({
            id: '550e8400-e29b-41d4-a716-446655440000',
            metadata: '{"caseNumber":"1"}',
            samples: [],
            version: '2'
        });
        expect(as_string_metadata.success).toBe(true);
        if (as_string_metadata.success) {
            expect(as_string_metadata.data.version).toBe(2);
        }
    });
});
