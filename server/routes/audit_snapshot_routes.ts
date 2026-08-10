/**
 * @fileoverview API-routes för tekniska audit-snapshots.
 */
import express, { type Request, type Response, type Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../db.js';
import { parse_body } from '../utils/zod_boundary.js';
import { AuditSnapshotCaptureBodySchema } from '../schemas/audit_snapshot.js';
import { assert_public_http_url, SsrfUrlRejectedError } from '../utils/ssrf_url_guard.js';
import { single_route_param } from '../utils/route_params.js';
import {
    start_snapshot_capture,
    delete_snapshot_job,
} from '../services/audit_snapshot_job_service.js';
import { build_audit_snapshot_list } from '../services/audit_snapshot_list_service.js';
import {
    get_audit_snapshot_by_id,
    list_audit_snapshots_for_audit,
} from '../repositories/audit_snapshot_repository.js';
import {
    get_snapshot_archive_path,
    ensure_audit_snapshot_dir,
} from '../snapshots/audit_snapshot_storage.js';
import { sanitize_filename_segment } from '../../js/logic/backup_download_filename.js';
import { format_filename_datetime_for_download } from '../../shared/datetime/filename_datetime.js';
import JSZip from 'jszip';

async function audit_exists(audit_id: string): Promise<boolean> {
    const result = await query('SELECT id, samples FROM audits WHERE id = $1', [audit_id]);
    return result.rows.length > 0;
}

async function get_audit_samples(audit_id: string): Promise<Array<{ id: string; description?: string; url?: string }>> {
    const result = await query('SELECT samples FROM audits WHERE id = $1', [audit_id]);
    if (result.rows.length === 0) return [];
    const samples = result.rows[0].samples;
    return Array.isArray(samples) ? samples : [];
}

function safe_user_error(err: unknown): string {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('cancelled')) return 'Capture avbruten';
    if (message.includes('SSRF') || message.includes('Ogiltig URL')) return 'Ogiltig URL';
    if (message.includes('Timeout') || message.includes('timeout')) {
        return 'Sidan svarade inte i tid';
    }
    if (message.includes('HTTP ')) {
        return 'Sidan kunde inte läsas in';
    }
    if (message.includes('webbläsare') || message.includes('Chrome') || message.includes('Chromium')) {
        return 'Kunde inte starta webbläsare på servern';
    }
    return 'Snapshot capture misslyckades';
}

function build_capture_error_payload(err: unknown): { error: string; detail: string } {
    const detail = err instanceof Error ? err.message : String(err);
    return {
        error: safe_user_error(err),
        detail: detail.trim() || 'Okänt fel',
    };
}

export function register_audit_snapshot_routes(router: Router): void {
    router.post('/:id/snapshots/capture', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }

            const body = parse_body(AuditSnapshotCaptureBodySchema, req.body, res);
            if (!body) return;

            let safe_url: URL;
            try {
                safe_url = assert_public_http_url(body.url);
            } catch (err) {
                const message = err instanceof SsrfUrlRejectedError ? err.message : 'Ogiltig URL';
                return res.status(422).json({ error: message });
            }

            const response = await start_snapshot_capture(audit_id, {
                ...body,
                url: safe_url.href,
            });
            return res.status(202).json(response);
        } catch (err) {
            const payload = build_capture_error_payload(err);
            console.error('[audit_snapshot] capture error:', payload.detail);
            return res.status(422).json(payload);
        }
    });

    router.get('/:id/snapshots/download-all', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }

            const samples = await get_audit_samples(audit_id);
            const list = await build_audit_snapshot_list(audit_id, samples);
            const ready_items = list.filter((item) => item.currentReady);

            if (ready_items.length === 0) {
                return res.status(404).json({ error: 'Inga färdiga snapshots att ladda ner' });
            }

            const zip = new JSZip();
            const index_entries = [];

            for (const item of ready_items) {
                const snap = item.currentReady!;
                const archive_path = get_snapshot_archive_path(audit_id, snap.snapshotId);
                const data = await fs.readFile(archive_path);
                const desc = sanitize_filename_segment(item.sampleDescription || item.sampleId);
                const ts = format_filename_datetime_for_download(snap.capturedAt);
                const inner_name = `${desc}_${ts}.zip`;
                zip.file(inner_name, data);
                index_entries.push({
                    snapshotId: snap.snapshotId,
                    sampleId: item.sampleId,
                    description: item.sampleDescription ?? null,
                    url: item.requestedUrl,
                    capturedAt: snap.capturedAt,
                    included: true,
                });
            }

            for (const item of list) {
                if (item.pendingAttempt && !item.currentReady) {
                    index_entries.push({
                        snapshotId: item.pendingAttempt.snapshotId,
                        sampleId: item.sampleId,
                        description: item.sampleDescription ?? null,
                        url: item.requestedUrl,
                        capturedAt: null,
                        included: false,
                        reason: item.pendingAttempt.status,
                    });
                }
            }

            zip.file('index.json', JSON.stringify({ snapshots: index_entries }, null, 2));
            const buffer = await zip.generateAsync({ type: 'nodebuffer' });
            const filename = `snapshots_all_${format_filename_datetime_for_download(new Date().toISOString())}.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.send(buffer);
        } catch (err) {
            console.error('[audit_snapshot] download-all error:', err);
            return res.status(500).json({ error: 'Kunde inte skapa samlingszip' });
        }
    });

    router.get('/:id/snapshots', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const samples = await get_audit_samples(audit_id);
            const items = await build_audit_snapshot_list(audit_id, samples);
            return res.json({ items });
        } catch (err) {
            console.error('[audit_snapshot] list error:', err);
            return res.status(500).json({ error: 'Kunde inte hämta snapshots' });
        }
    });

    router.get('/:id/snapshots/:snapshotId', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            const snapshot_id = single_route_param(req.params.snapshotId);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const row = await get_audit_snapshot_by_id(audit_id, snapshot_id);
            if (!row) return res.status(404).json({ error: 'Snapshot hittades inte' });
            return res.json({
                id: row.id,
                sampleId: row.sample_id,
                status: row.status,
                requestedUrl: row.requested_url,
                finalUrl: row.final_url,
                pageTitle: row.page_title,
                warningCount: row.warning_count,
                sizeBytes: row.size_bytes,
                error: row.error,
                createdAt: row.created_at.toISOString(),
                completedAt: row.completed_at?.toISOString() ?? null,
            });
        } catch (err) {
            console.error('[audit_snapshot] get error:', err);
            return res.status(500).json({ error: 'Kunde inte hämta snapshot' });
        }
    });

    router.get('/:id/snapshots/:snapshotId/download', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            const snapshot_id = single_route_param(req.params.snapshotId);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const row = await get_audit_snapshot_by_id(audit_id, snapshot_id);
            if (!row || row.status !== 'ready') {
                return res.status(404).json({ error: 'Snapshot är inte färdig' });
            }
            const archive_path = get_snapshot_archive_path(audit_id, snapshot_id);
            const samples = await get_audit_samples(audit_id);
            const sample = samples.find((s) => String(s.id) === row.sample_id);
            const desc = sanitize_filename_segment(sample?.description || row.sample_id);
            const ts = format_filename_datetime_for_download(
                (row.completed_at ?? row.created_at).toISOString()
            );
            const filename = `snapshot_${desc}_${ts}.zip`;
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            return res.sendFile(path.resolve(archive_path));
        } catch (err) {
            console.error('[audit_snapshot] download error:', err);
            return res.status(500).json({ error: 'Kunde inte ladda ner snapshot' });
        }
    });

    router.delete('/:id/snapshots/:snapshotId', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            const snapshot_id = single_route_param(req.params.snapshotId);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const deleted = await delete_snapshot_job(audit_id, snapshot_id);
            if (!deleted) {
                return res.status(404).json({ error: 'Snapshot kunde inte avbrytas' });
            }
            return res.status(204).send();
        } catch (err) {
            console.error('[audit_snapshot] delete error:', err);
            return res.status(500).json({ error: 'Kunde inte avbryta snapshot' });
        }
    });
}
