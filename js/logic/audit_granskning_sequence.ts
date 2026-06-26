/**
 * @fileoverview Granskningsnummer (WEBB_1 / PDF_2) för exportfilnamn baserat på ärendenummer och skapandedatum.
 */

import { t_for_language } from '../translation_logic.js';

export type AuditExportType = 'webb' | 'pdf';

export type AuditListRowForSequence = {
    id?: string;
    metadata?: { caseNumber?: string };
    audit_type?: string | null;
    created_at?: string | null;
};

const MAX_GRANSKNING_SEQUENCE = 9;
const DEFAULT_RULEFILE_LANGUAGE_FOR_EXPORT = 'sv-SE';

const EXPORT_TYPE_ABBREV_I18N_KEY: Record<AuditExportType, string> = {
    webb: 'export_media_audit_type_abbrev_webb',
    pdf: 'export_media_audit_type_abbrev_pdf'
};

const EXPORT_TYPE_ABBREV_FALLBACK: Record<AuditExportType, string> = {
    webb: 'WEB',
    pdf: 'PDF'
};

/**
 * Härleder webb/pdf från regelfilens monitoringType (samma heuristik som servern).
 */
export function resolve_audit_type_for_export(rule_file_content: unknown): AuditExportType | null {
    const content = rule_file_content as { metadata?: { monitoringType?: { text?: string; type?: string } } } | null;
    const m = content?.metadata?.monitoringType;
    const text = typeof m?.text === 'string' ? m.text.trim() : '';
    const typ = typeof m?.type === 'string' ? m.type.trim() : '';
    const raw = (typ || text).toLowerCase();
    if (!raw) return null;
    if (raw.includes('pdf')) return 'pdf';
    if (raw === 'web' || raw.includes('webb') || raw.includes('web')) return 'webb';
    return null;
}

function resolve_rulefile_language_for_export(rule_file_content: unknown): string {
    const content = rule_file_content as { metadata?: { language?: string } } | null;
    const lang = typeof content?.metadata?.language === 'string' ? content.metadata.language.trim() : '';
    return lang || DEFAULT_RULEFILE_LANGUAGE_FOR_EXPORT;
}

/** Sanerar typförkortning för filnamn: versaler, alfanumeriskt, max 8 tecken. */
export function sanitize_export_type_abbrev(value: unknown): string {
    const raw = String(value ?? '')
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
    if (!raw) return '';
    return raw.slice(0, 8);
}

function is_missing_translation_value(value: string, key: string): boolean {
    return value === `**${key}**`;
}

/**
 * Filnamnsförkortning (WEBB/WEB/PDF) baserat på regelfilens språk och översättningsnycklar.
 */
export function resolve_audit_export_type_abbrev(
    audit_type: AuditExportType | null,
    rule_file_content: unknown
): string | null {
    if (!audit_type) return null;

    const language_tag = resolve_rulefile_language_for_export(rule_file_content);
    const key = EXPORT_TYPE_ABBREV_I18N_KEY[audit_type];
    const translated = t_for_language(key, language_tag);
    if (!is_missing_translation_value(translated, key)) {
        const sanitized = sanitize_export_type_abbrev(translated);
        if (sanitized) return sanitized;
    }

    return EXPORT_TYPE_ABBREV_FALLBACK[audit_type];
}

function normalize_case_number(value: unknown): string {
    return String(value ?? '').trim();
}

function normalize_list_audit_type(value: unknown): AuditExportType | null {
    const raw = String(value ?? '').trim().toLowerCase();
    if (raw === 'webb' || raw === 'web') return 'webb';
    if (raw === 'pdf') return 'pdf';
    return null;
}

function parse_created_at(value: unknown): number {
    if (typeof value !== 'string' || !value.trim()) return 0;
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Returnerar 1–9: ordning bland granskningar med samma diarienummer och typ, sorterat på created_at.
 */
export function resolve_granskning_sequence_number(
    audits: AuditListRowForSequence[],
    options: {
        audit_id: string | null | undefined;
        case_number: string | null | undefined;
        audit_type: AuditExportType | null;
    }
): number {
    const case_number = normalize_case_number(options.case_number);
    const audit_id = String(options.audit_id ?? '').trim();
    const audit_type = options.audit_type;

    if (!case_number || !audit_type || !audit_id) {
        return 1;
    }

    const matching = (audits || [])
        .filter((row) => normalize_case_number(row.metadata?.caseNumber) === case_number)
        .filter((row) => normalize_list_audit_type(row.audit_type) === audit_type)
        .sort((a, b) => {
            const diff = parse_created_at(a.created_at) - parse_created_at(b.created_at);
            if (diff !== 0) return diff;
            return String(a.id ?? '').localeCompare(String(b.id ?? ''));
        });

    const index = matching.findIndex((row) => String(row.id ?? '') === audit_id);
    if (index < 0) {
        return 1;
    }

    const sequence = index + 1;
    if (sequence > MAX_GRANSKNING_SEQUENCE) {
        const w = globalThis as { ConsoleManager?: { warn?: (...args: unknown[]) => void } };
        w.ConsoleManager?.warn?.(
            `[export] Granskningsnummer ${sequence} överstiger max ${MAX_GRANSKNING_SEQUENCE} för ärende ${case_number}`
        );
        return MAX_GRANSKNING_SEQUENCE;
    }

    return sequence;
}

export type SampleListRowForSequence = {
    id?: string;
};

/**
 * Returnerar 1-baserad ordning för granskningsdel enligt samples-arrayens ordning.
 */
export function resolve_sample_sequence_number(
    samples: SampleListRowForSequence[] | null | undefined,
    sample_id: string | null | undefined
): number {
    const id = String(sample_id ?? '').trim();
    if (!id) {
        return 1;
    }

    const index = (samples || []).findIndex((row) => String(row.id ?? '') === id);
    if (index < 0) {
        return 1;
    }

    return index + 1;
}
