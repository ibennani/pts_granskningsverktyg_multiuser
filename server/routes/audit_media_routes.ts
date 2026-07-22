/**
 * @fileoverview API för uppladdning och hantering av mediefiler per granskning.
 */

import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import type { Request, Response, RequestHandler } from 'express';
import { query } from '../db.js';
import { MEDIA_MAX_UPLOAD_BYTES } from '../../shared/constants/media_upload_limits.js';
import {
    decode_multipart_original_filename,
    is_allowed_media_mime,
    sanitize_media_filename
} from '../../shared/media/sanitize_media_filename.js';
import {
    is_upload_image_file,
    normalize_image_filename_to_png
} from '../../shared/media/image_png_upload.js';
import { ensure_audit_media_files_png } from '../services/ensure_audit_media_png.js';
import {
    convert_image_file_to_png,
    ImagePngConversionError
} from '../services/convert_image_to_png.js';
import {
    delete_audit_media_file,
    ensure_audit_media_dir,
    pick_upload_media_filename,
    resolve_audit_media_file_path
} from '../media/audit_media_storage.js';
import { single_route_param } from '../utils/route_params.js';
import { parse_body } from '../utils/zod_boundary.js';
import { AuditUrlScreenshotBodySchema } from '../schemas/audit_url_screenshot.js';
import { assert_public_http_url, SsrfUrlRejectedError } from '../utils/ssrf_url_guard.js';
import { capture_page_screenshot, fetch_page_title_from_url } from '../services/page_screenshot_service.js';
import { detect_page_content_types } from '../services/page_content_type_detection_service.js';
import { build_sample_screenshot_filename } from '../utils/sample_screenshot_filename.js';
import { UrlContentTypeDetectionBodySchema } from '../schemas/url_content_type_detection.js';
import { AuditUrlPageTitleBodySchema } from '../schemas/audit_url_page_title.js';
import { AuditMediaRenameBodySchema } from '../schemas/audit_media_rename.js';
import { resolve_media_rename_filename } from '../../shared/media/resolve_media_rename_filename.js';
import {
    list_audit_media_files,
    rename_audit_media_file
} from '../media/audit_media_storage.js';
import { resolve_audit_media_filename_on_server } from '../../shared/media/resolve_audit_media_server_filename.js';

type AuthedRequest = express.Request & {
    user?: { id: string; name: string };
    media_upload_pick?: {
        filename: string;
        renamed_due_to_conflict: boolean;
        requested_filename: string;
    };
};

async function audit_exists(audit_id: string): Promise<boolean> {
    const result = await query('SELECT id FROM audits WHERE id = $1', [audit_id]);
    return result.rows.length > 0;
}

const upload = multer({
    storage: multer.diskStorage({
        destination: (req, _file, cb) => {
            const audit_id = single_route_param((req as Request).params.id);
            ensure_audit_media_dir(audit_id)
                .then((dir) => cb(null, dir))
                .catch((err) => cb(err as Error, ''));
        },
        filename: (req, file, cb) => {
            const audit_id = single_route_param((req as Request).params.id);
            const decoded_name = decode_multipart_original_filename(file.originalname || 'fil');
            const mime = (file.mimetype || '').toLowerCase();
            const upload_name = is_upload_image_file(mime, decoded_name)
                ? normalize_image_filename_to_png(decoded_name)
                : decoded_name;
            pick_upload_media_filename(audit_id, upload_name || 'fil')
                .then((pick) => {
                    (req as AuthedRequest).media_upload_pick = pick;
                    cb(null, pick.filename);
                })
                .catch((err) => cb(err as Error, 'fil'));
        }
    }),
    limits: { fileSize: MEDIA_MAX_UPLOAD_BYTES, files: 1 }
});

function multer_single(field: string): RequestHandler {
    return (req, res, next) => {
        upload.single(field)(req, res, (err: unknown) => {
            if (err) {
                const code = err && typeof err === 'object' && 'code' in err ? String((err as { code?: string }).code) : '';
                if (code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({ error: 'Filen är för stor' });
                }
                console.error('[audit_media] multer error:', err);
                return res.status(400).json({ error: 'Uppladdning misslyckades' });
            }
            next();
        });
    };
}

/**
 * Registrerar media-routes på audits-router.
 */
export function register_audit_media_routes(router: express.Router, upload_limiter: RequestHandler): void {
    router.get('/:id/media', async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const { files, migrations } = await ensure_audit_media_files_png(id);
            const payload: Record<string, unknown> = { files };
            if (migrations.length > 0) {
                payload.filenameMigrations = migrations;
            }
            res.json(payload);
        } catch (err) {
            console.error('[audit_media] GET list error:', err);
            res.status(500).json({ error: 'Kunde inte lista mediefiler' });
        }
    });

    router.post('/:id/detect-content-types', upload_limiter, async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }

            const body = parse_body(UrlContentTypeDetectionBodySchema, req.body, res);
            if (!body) {
                return;
            }

            let safe_url: URL;
            try {
                safe_url = assert_public_http_url(body.url);
            } catch (err) {
                const message = err instanceof SsrfUrlRejectedError ? err.message : 'Ogiltig URL';
                return res.status(422).json({ error: message });
            }

            const unique_allowed = [...new Set(body.allowedContentTypeIds.map((ct_id) => ct_id.trim()).filter(Boolean))];

            let detection_result;
            try {
                detection_result = await detect_page_content_types({
                    url: safe_url.href,
                    allowed_content_type_ids: unique_allowed,
                });
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                console.error('[audit_media] detect-content-types error:', safe_url.href, detail);
                return res.status(422).json({ error: 'Kunde inte analysera sidans innehåll' });
            }

            res.json({
                detectedContentTypeIds: detection_result.detected_content_type_ids,
                triggeredSignals: detection_result.triggered_signals,
            });
        } catch (err) {
            console.error('[audit_media] detect-content-types route error:', err);
            res.status(500).json({ error: 'Kunde inte analysera sidans innehåll' });
        }
    });

    router.post('/:id/fetch-page-title', upload_limiter, async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }

            const body = parse_body(AuditUrlPageTitleBodySchema, req.body, res);
            if (!body) {
                return;
            }

            let safe_url: URL;
            try {
                safe_url = assert_public_http_url(body.url);
            } catch (err) {
                const message = err instanceof SsrfUrlRejectedError ? err.message : 'Ogiltig URL';
                return res.status(422).json({ error: message });
            }

            let title_result;
            try {
                title_result = await fetch_page_title_from_url({ url: safe_url.href });
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                console.error('[audit_media] fetch-page-title error:', safe_url.href, detail);
                return res.status(422).json({
                    error: 'Kunde inte hämta sidtitel',
                    detail,
                });
            }

            res.json({ pageTitle: title_result.page_title });
        } catch (err) {
            console.error('[audit_media] fetch-page-title route error:', err);
            res.status(500).json({ error: 'Kunde inte hämta sidtitel' });
        }
    });

    router.post('/:id/media/capture-screenshot', upload_limiter, async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }

            const body = parse_body(AuditUrlScreenshotBodySchema, req.body, res);
            if (!body) {
                return;
            }

            let safe_url: URL;
            try {
                safe_url = assert_public_http_url(body.url);
            } catch (err) {
                const message = err instanceof SsrfUrlRejectedError ? err.message : 'Ogiltig URL';
                return res.status(422).json({ error: message });
            }

            let capture_result;
            try {
                capture_result = await capture_page_screenshot({ url: safe_url.href });
            } catch (err) {
                const detail = err instanceof Error ? err.message : String(err);
                console.error('[audit_media] capture-screenshot error:', safe_url.href, detail);
                return res.status(422).json({
                    error: 'Kunde inte ta skärmdump av sidan',
                    detail,
                });
            }

            const requested_filename = build_sample_screenshot_filename(
                capture_result.page_title,
                body.filenameSuffix
            );
            const pick = await pick_upload_media_filename(id, requested_filename);
            const dir = await ensure_audit_media_dir(id);
            const full_path = path.join(dir, pick.filename);
            await fs.writeFile(full_path, capture_result.png_buffer);

            const response: Record<string, unknown> = {
                filename: pick.filename,
                pageTitle: capture_result.page_title,
                size: capture_result.png_buffer.length,
                mime: 'image/png',
            };
            if (pick.renamed_due_to_conflict) {
                response.renamedDueToConflict = true;
                response.requestedFilename = pick.requested_filename;
            }
            res.status(201).json(response);
        } catch (err) {
            console.error('[audit_media] capture-screenshot route error:', err);
            res.status(500).json({ error: 'Kunde inte spara skärmdump' });
        }
    });

    router.post('/:id/media', upload_limiter, multer_single('file'), async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const file = (req as AuthedRequest & { file?: Express.Multer.File }).file;
            if (!file) {
                return res.status(400).json({ error: 'Ingen fil mottagen' });
            }
            const mime = (file.mimetype || '').toLowerCase();
            if (!is_allowed_media_mime(mime)) {
                await fs.unlink(file.path).catch(() => {});
                return res.status(400).json({ error: 'Filtypen stöds inte' });
            }
            const pick = (req as AuthedRequest).media_upload_pick;
            let stored_size = file.size;
            let stored_mime = mime;
            if (is_upload_image_file(mime, file.filename)) {
                try {
                    const convert_result = await convert_image_file_to_png(file.path);
                    stored_size = convert_result.size;
                    stored_mime = 'image/png';
                } catch (err) {
                    await fs.unlink(file.path).catch(() => {});
                    const message =
                        err instanceof ImagePngConversionError
                            ? err.message
                            : 'Kunde inte konvertera bilden till PNG';
                    return res.status(422).json({ error: message });
                }
            }
            const response: Record<string, unknown> = {
                filename: file.filename,
                size: stored_size,
                mime: stored_mime
            };
            if (pick?.renamed_due_to_conflict) {
                response.renamedDueToConflict = true;
                response.requestedFilename = pick.requested_filename;
            }
            res.status(201).json(response);
        } catch (err) {
            console.error('[audit_media] POST error:', err);
            res.status(500).json({ error: 'Kunde inte ladda upp fil' });
        }
    });

    router.get('/:id/media/:filename', async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            const raw_filename = single_route_param(req.params.filename);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const decoded = decodeURIComponent(raw_filename);
            const sanitized = sanitize_media_filename(decoded);
            if (!sanitized) {
                return res.status(400).json({ error: 'Ogiltigt filnamn' });
            }
            const full = resolve_audit_media_file_path(id, sanitized);
            let stat;
            try {
                stat = await fs.stat(full);
            } catch {
                return res.status(404).json({ error: 'Filen hittades inte' });
            }
            if (!stat.isFile()) {
                return res.status(404).json({ error: 'Filen hittades inte' });
            }
            res.setHeader('Cache-Control', 'private, max-age=3600');
            res.sendFile(path.resolve(full));
        } catch (err) {
            console.error('[audit_media] GET file error:', err);
            res.status(500).json({ error: 'Kunde inte hämta fil' });
        }
    });

    router.patch('/:id/media/:filename', async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            const raw_filename = single_route_param(req.params.filename);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }

            const body = parse_body(AuditMediaRenameBodySchema, req.body, res);
            if (!body) {
                return;
            }

            const decoded = decodeURIComponent(raw_filename);
            const current_filename = sanitize_media_filename(decoded);
            if (!current_filename) {
                return res.status(400).json({ error: 'Ogiltigt filnamn' });
            }

            const { files: existing_files, migrations } = await ensure_audit_media_files_png(id);
            const existing_set = new Set(existing_files.map((entry) => entry.filename));
            const matched_current_filename = resolve_audit_media_filename_on_server(
                current_filename,
                existing_files.map((entry) => entry.filename),
                migrations
            );
            if (!matched_current_filename) {
                return res.status(404).json({ error: 'Filen hittades inte' });
            }

            const resolved = resolve_media_rename_filename(
                matched_current_filename,
                body.newFilename,
                existing_set
            );
            if (!resolved.ok) {
                return res.status(400).json({ error: resolved.error });
            }

            if (!resolved.unchanged) {
                await rename_audit_media_file(id, matched_current_filename, resolved.filename);
            }

            const response: Record<string, unknown> = { filename: resolved.filename };
            if (resolved.renamed_due_to_conflict) {
                response.renamedDueToConflict = true;
                response.requestedFilename = resolved.requested_filename;
            }
            res.json(response);
        } catch (err) {
            console.error('[audit_media] PATCH rename error:', err);
            res.status(500).json({ error: 'Kunde inte byta filnamn' });
        }
    });

    router.delete('/:id/media/:filename', async (req: Request, res: Response) => {
        try {
            const id = single_route_param(req.params.id);
            const raw_filename = single_route_param(req.params.filename);
            if (!(await audit_exists(id))) {
                return res.status(404).json({ error: 'Granskning hittades inte' });
            }
            const decoded = decodeURIComponent(raw_filename);
            const sanitized = sanitize_media_filename(decoded);
            if (!sanitized) {
                return res.status(400).json({ error: 'Ogiltigt filnamn' });
            }
            await delete_audit_media_file(id, sanitized);
            res.status(204).send();
        } catch (err) {
            if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
                return res.status(404).json({ error: 'Filen hittades inte' });
            }
            console.error('[audit_media] DELETE error:', err);
            res.status(500).json({ error: 'Kunde inte ta bort fil' });
        }
    });
}
