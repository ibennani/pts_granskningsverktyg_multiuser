/**
 * @fileoverview Filnamn för gransknings-säkerhetskopia (ZIP).
 */

/**
 * Byter filändelse från .json till .zip för nedladdningsfilnamn.
 */
export function audit_backup_download_filename(json_filename: string): string {
    if (json_filename.toLowerCase().endsWith('.json')) {
        return `${json_filename.slice(0, -5)}.zip`;
    }
    return `${json_filename}.zip`;
}
