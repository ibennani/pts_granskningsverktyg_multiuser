/**
 * Bygger nedladdningsfilnamn för regelfils-säkerhetskopior: originalbas, versionsnummer och lokal tidpunkt.
 */

const UNSAFE_FILENAME_CHARS = /[<>:"/\\|?*\u0000-\u001f]/g;

/**
 * Tar bort tecken som ogiltiga i filnamn på Windows och trimmar.
 */
export function sanitize_filename_segment(segment: string): string {
    return segment.replace(UNSAFE_FILENAME_CHARS, '_').trim();
}

/**
 * Lokal datum- och tidstämpel för filnamn: YYYY-MM-DD_HH-mm-ss
 */
export function format_local_datetime_for_backup_filename(iso: string | null | undefined): string {
    if (!iso) return 'saknad-tidpunkt';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'saknad-tidpunkt';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;
}

export type RulefileBackupDownloadFilenameInput = {
    filename: string;
    metadataVersion?: string | null;
    /** `metadata.language` från regelfilen (styr ordet för "säkerhetskopia" i filnamnet). */
    metadataLanguage?: string | null;
    createdAt?: string | null;
};

/** Servern lägger vid kollision till `__` + kort hex-id före `.json` – det ska inte med i nedladdningsnamnet. */
const DISK_DUPLICATE_ID_SUFFIX = /__[0-9a-f]{6,16}$/i;

/**
 * Tar bort `__a1b2c3d4`-suffix som system_backup lägger till vid filnamnskollision.
 */
export function strip_rulefile_disk_id_suffix(base: string): string {
    const s = String(base || '').trim();
    return s.replace(DISK_DUPLICATE_ID_SUFFIX, '');
}

/**
 * Versionssträng för filnamn: `2026.3.r2` → `2026_3_r2`
 */
export function metadata_version_to_filename_part(version: string): string {
    const v = String(version || '').trim();
    if (!v) return '';
    return sanitize_filename_segment(v.replace(/\./g, '_'));
}

/**
 * Normaliserar regelfilens språktagg (t.ex. en-GB → en).
 */
export function normalize_rulefile_language_tag(raw: string | null | undefined): string {
    const s = String(raw || '').trim().toLowerCase();
    if (!s) return '';
    if (s === 'sv' || s.startsWith('sv-')) return 'sv';
    if (s === 'en' || s.startsWith('en-')) return 'en';
    if (s === 'nb' || s.startsWith('nb-') || s === 'no' || s.startsWith('no-') || s === 'nn' || s.startsWith('nn-')) {
        return 'nb';
    }
    const primary = s.split(/[-_]/)[0] || '';
    if (primary === 'sv' || primary === 'en' || primary === 'nb') return primary;
    if (primary === 'no' || primary === 'nn') return 'nb';
    return primary;
}

const BACKUP_FILENAME_WORD_BY_LANG: Record<string, string> = {
    sv: 'säkerhetskopia',
    en: 'backup',
    nb: 'sikkerhetskopi'
};

/**
 * Ord för filnamn som motsvarar regelfilens språk (metadata.language).
 * Saknas språk används svenska som standard.
 */
export function backup_word_for_rulefile_language(metadata_language: string | null | undefined): string {
    const norm = normalize_rulefile_language_tag(metadata_language);
    if (!norm) return BACKUP_FILENAME_WORD_BY_LANG.sv;
    const word = BACKUP_FILENAME_WORD_BY_LANG[norm];
    if (word) return word;
    return BACKUP_FILENAME_WORD_BY_LANG.en;
}

/**
 * Slutfilnamn: bas_{backupord}_2026_3_r2_2026-04-14_12-00-01.json
 */
export function build_rulefile_backup_download_filename(row: RulefileBackupDownloadFilenameInput): string {
    const raw = (row.filename || 'backup.json').trim();
    const base_name = sanitize_filename_segment(raw.replace(/\\/g, '/').split('/').pop() || raw);
    const last_dot = base_name.lastIndexOf('.');
    const base_raw = last_dot > 0 ? base_name.slice(0, last_dot) : base_name;
    const ext = last_dot > 0 ? base_name.slice(last_dot) : '.json';

    const human_base = strip_rulefile_disk_id_suffix(base_raw) || 'backup';
    const ver_part = metadata_version_to_filename_part((row.metadataVersion ?? '').toString());
    const dt = format_local_datetime_for_backup_filename(row.createdAt ?? null);
    const backup_word = sanitize_filename_segment(backup_word_for_rulefile_language(row.metadataLanguage ?? null));

    const middle = ver_part
        ? `_${backup_word}_${ver_part}_${dt}`
        : `_${backup_word}_${dt}`;

    return `${human_base}${middle}${ext}`;
}
