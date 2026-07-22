/**
 * @fileoverview Gemensam logik för omdöpning av mediefiler på servern.
 */

import { ensure_audit_media_files_png } from '../services/ensure_audit_media_png.js';
import { rename_audit_media_file } from './audit_media_storage.js';
import { resolve_audit_media_filename_on_server } from '../../shared/media/resolve_audit_media_server_filename.js';
import { resolve_media_rename_filename } from '../../shared/media/resolve_media_rename_filename.js';
import { sanitize_media_filename } from '../../shared/media/sanitize_media_filename.js';

export type AuditMediaRenameSuccess = {
    filename: string;
    renamed_due_to_conflict: boolean;
    requested_filename?: string;
};

export type AuditMediaRenameFailure = {
    status: number;
    error: string;
    detail?: string;
    fromFilename?: string;
    auditId?: string;
};

function build_file_not_found_detail(
    audit_id: string,
    referenced_filename: string,
    existing_filenames: readonly string[]
): string {
    const searched = String(referenced_filename || '').trim() || '«tomt filnamn»';
    const count = existing_filenames.length;
    const file_word = count === 1 ? 'fil' : 'filer';
    return `Sökte efter «${searched}» bland ${count} ${file_word} i granskning ${audit_id}.`;
}

/**
 * Byter namn på en mediefil efter validering mot fillista och migreringar.
 */
export async function execute_audit_media_rename(
    audit_id: string,
    referenced_from_filename: string,
    new_filename_raw: string
): Promise<
    | { ok: true; result: AuditMediaRenameSuccess }
    | { ok: false; failure: AuditMediaRenameFailure }
> {
    const sanitized_from = sanitize_media_filename(referenced_from_filename);
    if (!sanitized_from) {
        return {
            ok: false,
            failure: {
                status: 400,
                error: 'Ogiltigt filnamn',
                auditId: audit_id,
                fromFilename: String(referenced_from_filename || '')
            }
        };
    }

    const { files: existing_files, migrations } = await ensure_audit_media_files_png(audit_id);
    const existing_names = existing_files.map((entry) => entry.filename);
    const existing_set = new Set(existing_names);
    const matched_current_filename = resolve_audit_media_filename_on_server(
        sanitized_from,
        existing_names,
        migrations
    );

    if (!matched_current_filename) {
        return {
            ok: false,
            failure: {
                status: 404,
                error: 'Filen hittades inte',
                detail: build_file_not_found_detail(audit_id, sanitized_from, existing_names),
                fromFilename: sanitized_from,
                auditId: audit_id
            }
        };
    }

    const resolved = resolve_media_rename_filename(
        matched_current_filename,
        new_filename_raw,
        existing_set
    );
    if (!resolved.ok) {
        return {
            ok: false,
            failure: {
                status: 400,
                error: resolved.error,
                fromFilename: matched_current_filename,
                auditId: audit_id
            }
        };
    }

    if (!resolved.unchanged) {
        await rename_audit_media_file(audit_id, matched_current_filename, resolved.filename);
    }

    return {
        ok: true,
        result: {
            filename: resolved.filename,
            renamed_due_to_conflict: resolved.renamed_due_to_conflict,
            requested_filename: resolved.renamed_due_to_conflict
                ? resolved.requested_filename
                : undefined
        }
    };
}

/**
 * Skickar JSON-svar för omdöpningsresultat.
 */
export function send_audit_media_rename_result(
    res: { status: (code: number) => { json: (body: unknown) => void }; json: (body: unknown) => void },
    outcome: Awaited<ReturnType<typeof execute_audit_media_rename>>
): void {
    if (!outcome.ok) {
        const { failure } = outcome;
        res.status(failure.status).json({
            error: failure.error,
            ...(failure.detail ? { detail: failure.detail } : {}),
            ...(failure.fromFilename ? { fromFilename: failure.fromFilename } : {}),
            ...(failure.auditId ? { auditId: failure.auditId } : {})
        });
        return;
    }

    const response: Record<string, unknown> = { filename: outcome.result.filename };
    if (outcome.result.renamed_due_to_conflict) {
        response.renamedDueToConflict = true;
        response.requestedFilename = outcome.result.requested_filename;
    }
    res.json(response);
}
