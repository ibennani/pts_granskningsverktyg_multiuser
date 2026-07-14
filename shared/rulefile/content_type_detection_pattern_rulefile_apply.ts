/**
 * @fileoverview Tillämpar eller rensar detectionPattern i regelfil beroende på webb/PDF.
 */

import {
    resolve_web_detection_pattern_for_label,
} from './content_type_detection_pattern_web_catalog.js';

export type RulefileMonitoringKind = 'web' | 'pdf' | 'unknown';

type ContentTypeChild = {
    id?: string;
    text?: string;
    description?: string;
    detectionPattern?: string;
};

type ContentTypeGroup = {
    id?: string;
    text?: string;
    description?: string;
    types?: ContentTypeChild[];
};

/**
 * Härleder webb/pdf från regelfilens monitoringType (samma heuristik som export).
 */
export function resolve_rulefile_monitoring_kind(metadata: unknown): RulefileMonitoringKind {
    const meta = metadata as { monitoringType?: { text?: string; type?: string } } | null;
    const m = meta?.monitoringType;
    const text = typeof m?.text === 'string' ? m.text.trim() : '';
    const typ = typeof m?.type === 'string' ? m.type.trim() : '';
    const raw = (typ || text).toLowerCase();
    if (!raw) return 'unknown';
    if (raw.includes('pdf')) return 'pdf';
    if (raw === 'web' || raw.includes('webb') || raw.includes('web')) return 'web';
    return 'unknown';
}

function strip_child_detection_pattern(child: ContentTypeChild): ContentTypeChild {
    const next = { ...child };
    delete next.detectionPattern;
    return next;
}

function apply_web_pattern_to_child(child: ContentTypeChild): ContentTypeChild {
    const pattern = resolve_web_detection_pattern_for_label(child?.text);
    if (!pattern) return { ...child };
    return { ...child, detectionPattern: pattern };
}

/**
 * Sätter katalogmönster på webb-regelfilens undertyper; tar bort mönster för PDF.
 */
export function apply_detection_patterns_to_content_types(
    content_types: ContentTypeGroup[] | null | undefined,
    monitoring_kind: RulefileMonitoringKind
): ContentTypeGroup[] {
    if (!Array.isArray(content_types)) return [];

    return content_types.map((group) => {
        const types = Array.isArray(group?.types) ? group.types : [];
        const next_types =
            monitoring_kind === 'pdf'
                ? types.map(strip_child_detection_pattern)
                : monitoring_kind === 'web'
                  ? types.map(apply_web_pattern_to_child)
                  : types.map((child) => ({ ...child }));

        return { ...group, types: next_types };
    });
}

/**
 * Uppdaterar metadata.contentTypes med webb- eller PDF-regler för detectionPattern.
 */
export function apply_detection_patterns_for_rulefile_metadata(metadata: MetadataRecord): MetadataRecord {
    const monitoring_kind = resolve_rulefile_monitoring_kind(metadata);
    const content_types = Array.isArray(metadata.contentTypes)
        ? (metadata.contentTypes as ContentTypeGroup[])
        : [];

    if (monitoring_kind === 'unknown') {
        return metadata;
    }

    return {
        ...metadata,
        contentTypes: apply_detection_patterns_to_content_types(content_types, monitoring_kind),
    };
}

type MetadataRecord = Record<string, unknown>;
