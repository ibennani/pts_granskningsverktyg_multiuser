/**
 * @fileoverview API-routes för cross-page-analys av återkommande innehåll.
 */
import express, { type Request, type Response, type Router } from 'express';
import { z } from 'zod';
import { query } from '../db.js';
import { parse_body } from '../utils/zod_boundary.js';
import { single_route_param } from '../utils/route_params.js';
import { analyze_recurring_content_for_audit } from '../services/recurring_content_analysis_service.js';

const RecurringAnalyzeBodySchema = z.object({
    entries: z.array(
        z.object({
            sampleId: z.string().min(1),
            captureId: z.string().min(1),
        })
    ).min(2),
});

async function audit_exists(audit_id: string): Promise<boolean> {
    const result = await query('SELECT id FROM audits WHERE id = $1', [audit_id]);
    return result.rows.length > 0;
}

export function register_audit_recurring_routes(router: Router): void {
    router.post('/:id/recurring-content/analyze', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const body = parse_body(RecurringAnalyzeBodySchema, req.body, res);
            if (!body) return;
            const suggestions = await analyze_recurring_content_for_audit({
                audit_id,
                entries: body.entries,
            });
            return res.json({ suggestions });
        } catch (err) {
            console.error('[audit_recurring] analyze error:', err);
            return res.status(500).json({ error: 'Kunde inte analysera återkommande innehåll' });
        }
    });
}
