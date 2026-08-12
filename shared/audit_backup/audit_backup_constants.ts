/**
 * @fileoverview Konstanter för gransknings-säkerhetskopia (ZIP med manifest).
 */

/** Aktuellt manifestformat. */
export const AUDIT_BACKUP_FORMAT_VERSION = 1 as const;

/** Manifestfil i ZIP-roten. */
export const AUDIT_BACKUP_MANIFEST_ENTRY = 'manifest.json';

/** Gransknings-JSON i ZIP-roten. */
export const AUDIT_BACKUP_JSON_ENTRY = 'granskning.json';

/** Undermapp för bifogade bilder. */
export const AUDIT_BACKUP_MEDIA_DIR = 'media';
