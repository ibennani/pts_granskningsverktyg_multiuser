/**
 * @fileoverview API-routes för tekniska audit-snapshots.
 */
import express, { type Request, type Response, type Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { query } from '../db.js';
import { parse_body } from '../utils/zod_boundary.js';
import { AuditSnapshotCaptureBodySchema } from '../schemas/audit_snapshot.js';
import { SsrfUrlRejectedError } from '../utils/ssrf_url_guard.js';
import { single_route_param } from '../utils/route_params.js';
import {
    start_snapshot_capture,
    delete_snapshot_job,
} from '../services/audit_snapshot_job_service.js';
import {
    purge_audit_snapshot_by_id,
    purge_audit_snapshots_for_sample,
} from '../services/audit_snapshot_cleanup_service.js';
import { build_audit_snapshot_list } from '../services/audit_snapshot_list_service.js';
import {
    resolve_snapshot_capture_url_for_audit,
    SnapshotSampleMissingUrlError,
    SnapshotSampleNotFoundError,
} from '../services/audit_snapshot_capture_url.js';
import {
    get_audit_snapshot_by_id,
} from '../repositories/audit_snapshot_repository.js';
import {
    get_snapshot_archive_path,
} from '../snapshots/audit_snapshot_storage.js';
import { build_snapshot_analysis_summary } from '../services/audit_snapshot_analysis_summary_service.js';
import {
    append_snapshot_archive_to_zip,
    build_snapshot_export_folder_name,
    build_snapshots_download_all_index,
    type SnapshotsDownloadAllIndexEntry,
} from '../snapshots/audit_snapshots_download_all_bundle.js';
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

            let capture_url: string;
            try {
                const resolved = await resolve_snapshot_capture_url_for_audit(
                    audit_id,
                    body.sampleId,
                    body.url
                );
                capture_url = resolved.url;
                if (resolved.client_url_ignored) {
                    console.info(
                        `[audit_snapshot] Använder granskningsdelens URL för sample ${body.sampleId} (ignorerar avvikande klient-URL).`
                    );
                }
            } catch (err) {
                if (err instanceof SnapshotSampleNotFoundError) {
                    return res.status(404).json({ error: err.message });
                }
                if (err instanceof SnapshotSampleMissingUrlError) {
                    return res.status(422).json({ error: err.message });
                }
                const message = err instanceof SsrfUrlRejectedError ? err.message : 'Ogiltig URL';
                return res.status(422).json({ error: message });
            }

            const auth_user = (req as Request & { user?: { id?: string; name?: string } }).user;
            const response = await start_snapshot_capture(audit_id, {
                ...body,
                url: capture_url,
            }, {
                user_id: auth_user?.id ?? null,
                user_name: auth_user?.name ?? null,
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
            const index_entries: SnapshotsDownloadAllIndexEntry[] = [];

            for (const item of ready_items) {
                const snap = item.currentReady!;
                const archive_path = get_snapshot_archive_path(audit_id, snap.snapshotId);
                const data = await fs.readFile(archive_path);
                const folder = `snapshots/${build_snapshot_export_folder_name(
                    item.sampleId,
                    item.sampleDescription
                )}`;
                const files = await append_snapshot_archive_to_zip(zip, data, folder);
                index_entries.push({
                    folder,
                    snapshotId: snap.snapshotId,
                    sampleId: item.sampleId,
                    description: item.sampleDescription ?? null,
                    url: item.requestedUrl,
                    capturedAt: snap.capturedAt,
                    included: true,
                    files,
                });
            }

            for (const item of list) {
                if (item.pendingAttempt && !item.currentReady) {
                    index_entries.push({
                        folder: null,
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

            const index = build_snapshots_download_all_index(audit_id, index_entries);
            zip.file('index.json', JSON.stringify(index, null, 2));
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

    router.get('/:id/snapshots/:snapshotId/analysis-summary', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            const snapshot_id = single_route_param(req.params.snapshotId);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const summary = await build_snapshot_analysis_summary(audit_id, snapshot_id);
            if (!summary) {
                return res.status(404).json({ error: 'Snapshot-analys hittades inte' });
            }
            return res.json(summary);
        } catch (err) {
            console.error('[audit_snapshot] analysis-summary error:', err);
            return res.status(500).json({ error: 'Kunde inte hämta snapshot-analys' });
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

    router.delete('/:id/snapshots/by-sample/:sampleId', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            const sample_id = single_route_param(req.params.sampleId);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const removed = await purge_audit_snapshots_for_sample(audit_id, sample_id);
            if (removed === 0) {
                return res.status(404).json({ error: 'Ingen snapshot hittades för granskningsdelen' });
            }
            return res.status(204).send();
        } catch (err) {
            console.error('[audit_snapshot] delete-by-sample error:', err);
            return res.status(500).json({ error: 'Kunde inte ta bort snapshots' });
        }
    });

    router.get('/:id/snapshots/:snapshotId/analysis-summary', async (req: Request, res: Response) => {
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
            const summary = await build_snapshot_analysis_summary(audit_id, snapshot_id);
            if (!summary) {
                return res.status(404).json({ error: 'Analysdata hittades inte' });
            }
            return res.json(summary);
        } catch (err) {
            console.error('[audit_snapshot] analysis-summary error:', err);
            return res.status(500).json({ error: 'Kunde inte läsa analys-sammanfattning' });
        }
    });

    router.delete('/:id/snapshots/:snapshotId', async (req: Request, res: Response) => {
        try {
            const audit_id = single_route_param(req.params.id);
            const snapshot_id = single_route_param(req.params.snapshotId);
            if (!(await audit_exists(audit_id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const purged = await purge_audit_snapshot_by_id(audit_id, snapshot_id);
            if (purged) {
                return res.status(204).send();
            }
            const cancelled = await delete_snapshot_job(audit_id, snapshot_id);
            if (!cancelled) {
                return res.status(404).json({ error: 'Snapshot hittades inte' });
            }
            return res.status(204).send();
        } catch (err) {
            console.error('[audit_snapshot] delete error:', err);
            return res.status(500).json({ error: 'Kunde inte ta bort snapshot' });
        }
    });
}
