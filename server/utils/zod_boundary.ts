/**
 * @fileoverview Hjälpfunktioner för Zod-validering vid API- och DB-gränser.
 */

import type { Response } from 'express';
import { z, type ZodType } from 'zod';

export function format_zod_error(error: z.ZodError): string {
    const issue = error.issues[0];
    if (!issue) {
        return 'Ogiltig begäran';
    }
    return issue.message || 'Ogiltig begäran';
}

export function parse_body<T extends ZodType>(
    schema: T,
    body: unknown,
    res: Response
): z.infer<T> | null {
    const result = schema.safeParse(body ?? {});
    if (!result.success) {
        res.status(400).json({ error: format_zod_error(result.error) });
        return null;
    }
    return result.data;
}

export function parse_query<T extends ZodType>(
    schema: T,
    query: unknown,
    res: Response
): z.infer<T> | null {
    const result = schema.safeParse(query ?? {});
    if (!result.success) {
        res.status(400).json({ error: format_zod_error(result.error) });
        return null;
    }
    return result.data;
}

export function parse_db_row<T extends ZodType>(schema: T, row: unknown): z.infer<T> {
    return schema.parse(row);
}

export function safe_parse_db_row<T extends ZodType>(schema: T, row: unknown): z.infer<T> | null {
    const result = schema.safeParse(row);
    return result.success ? result.data : null;
}
