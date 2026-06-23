/**
 * @fileoverview Gemensamma Zod-byggblock för server-scheman.
 */

import { z } from 'zod';

export const UuidSchema = z.string().uuid({ message: 'Ogiltigt UUID.' });

export const AuditStatusSchema = z.enum(['not_started', 'in_progress', 'locked', 'archived']);

export const JsonValueSchema = z.unknown();

export const MetadataRecordSchema = z.record(z.string(), z.unknown());

/** Tal som krävs och måste vara ändligt (t.ex. expectedVersion). */
export const RequiredFiniteNumberSchema = z.preprocess(
    (val) => {
        if (val === undefined || val === null || val === '') {
            return undefined;
        }
        const num = Number(val);
        return Number.isFinite(num) ? num : Number.NaN;
    },
    z
        .number({
            required_error: 'expectedVersion krävs för att spara granskningen',
            invalid_type_error: 'expectedVersion måste vara ett tal'
        })
        .finite({ message: 'expectedVersion måste vara ett tal' })
);

export function is_valid_uuid(value: unknown): value is string {
    return UuidSchema.safeParse(value).success;
}
