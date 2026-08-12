/**
 * @fileoverview Identifierar uppladdad granskningsfil (JSON eller ZIP) och extraherar innehåll.
 */

import { AUDIT_BACKUP_ZIP_MAX_BYTES } from '../../shared/constants/file_size_limits.js';
import { JSON_MAX_UPLOAD_BYTES } from '../constants/json_upload_limits.js';
import { parse_audit_backup_zip, is_probably_zip_file } from './audit_backup_zip_import.js';

export type ParsedAuditUploadJson = {
    kind: 'json';
    audit_json: unknown;
    media_files: [];
};

export type ParsedAuditUploadZip = {
    kind: 'zip';
    audit_json: unknown;
    media_files: Array<{ filename: string; blob: Blob }>;
    missing_media: string[];
};

export type ParsedAuditUpload = ParsedAuditUploadJson | ParsedAuditUploadZip;

export class AuditUploadFileTooLargeError extends Error {
    max_bytes: number;

    constructor(max_bytes: number) {
        super('audit_upload_file_too_large');
        this.name = 'AuditUploadFileTooLargeError';
        this.max_bytes = max_bytes;
    }
}

function read_file_as_text(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(String(e.target?.result ?? ''));
        reader.onerror = () => reject(reader.error || new Error('read_failed'));
        reader.readAsText(file);
    });
}

function read_file_as_array_buffer(file: File): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result;
            if (result instanceof ArrayBuffer) {
                resolve(result);
                return;
            }
            reject(new Error('read_failed'));
        };
        reader.onerror = () => reject(reader.error || new Error('read_failed'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Läser vald fil och returnerar gransknings-JSON samt ev. media från ZIP.
 */
export async function parse_audit_upload_file(file: File): Promise<ParsedAuditUpload> {
    if (is_probably_zip_file(file)) {
        if (file.size > AUDIT_BACKUP_ZIP_MAX_BYTES) {
            throw new AuditUploadFileTooLargeError(AUDIT_BACKUP_ZIP_MAX_BYTES);
        }
        const buffer = await read_file_as_array_buffer(file);
        const parsed = await parse_audit_backup_zip(buffer);
        return {
            kind: 'zip',
            audit_json: parsed.audit_json,
            media_files: parsed.media_files,
            missing_media: parsed.missing_media,
        };
    }

    if (file.size > JSON_MAX_UPLOAD_BYTES) {
        throw new AuditUploadFileTooLargeError(JSON_MAX_UPLOAD_BYTES);
    }
    const text = await read_file_as_text(file);
    return { kind: 'json', audit_json: JSON.parse(text), media_files: [] };
}
