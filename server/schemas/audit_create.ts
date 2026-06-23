/**
 * @fileoverview Zod-schema för POST /audits (skapa granskning).
 */

import { z } from 'zod';

export const CreateAuditBodySchema = z.object({
    rule_set_id: z.string({ required_error: 'rule_set_id krävs' }).min(1, 'rule_set_id krävs')
});

export type CreateAuditBody = z.infer<typeof CreateAuditBodySchema>;
