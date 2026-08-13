/**
 * @fileoverview Innehållstyper vid bulkimport: läsning från sidrapport och sammanslagning.
 */

type ContentTypeResultRow = {
    contentTypeId?: string;
    detected?: boolean;
};

type ContentTypesEnvelope = {
    data?: {
        detectedContentTypeIds?: unknown;
        results?: ContentTypeResultRow[];
    };
    results?: ContentTypeResultRow[];
    detectedContentTypeIds?: unknown;
};

function ids_from_results(results: ContentTypeResultRow[] | undefined): string[] {
    if (!Array.isArray(results)) return [];
    return results
        .filter((row) => row.detected && row.contentTypeId)
        .map((row) => String(row.contentTypeId));
}

/**
 * Läser detekterade innehållstyp-id från analysis-summary (envelope eller platt format).
 */
export function extract_detected_content_type_ids_from_summary(summary: unknown): string[] {
    const envelope = (summary as { contentTypes?: ContentTypesEnvelope } | null)?.contentTypes;
    if (!envelope || typeof envelope !== 'object') return [];

    const data = envelope.data;
    if (data && typeof data === 'object') {
        if (Array.isArray(data.detectedContentTypeIds)) {
            return data.detectedContentTypeIds.map((id) => String(id)).filter(Boolean);
        }
        const from_results = ids_from_results(data.results);
        if (from_results.length > 0) return from_results;
    }

    if (Array.isArray(envelope.detectedContentTypeIds)) {
        return envelope.detectedContentTypeIds.map((id) => String(id)).filter(Boolean);
    }

    return ids_from_results(envelope.results);
}

/**
 * Slår ihop befintligt val (t.ex. förval från regelfilen) med detekterade typer.
 */
export function merge_bulk_import_content_type_ids(
    selected_ids: string[],
    detected_ids: string[]
): string[] {
    if (detected_ids.length === 0) return [...selected_ids];
    return [...new Set([...selected_ids, ...detected_ids])];
}

type SidrapportRowLike = {
    selected_content_type_ids: string[];
    suggested_sample_type_id: string | null;
    suggested_sample_type_confidence: number;
};

type SidrapportSummaryLike = {
    pageTypeClassification?: {
        suggestedTypeId?: string | null;
        confidence?: number;
    } | null;
};

/**
 * Bygger fält för andra UPDATE_SAMPLE efter klar sidrapport.
 */
export function build_bulk_import_sidrapport_sample_patch(
    row: SidrapportRowLike,
    summary: SidrapportSummaryLike
): {
    selected_content_type_ids: string[];
    detected_content_type_ids: string[];
    sampleType: string;
    suggestedSampleTypeId: string | undefined;
    suggestedSampleTypeConfidence: number;
} {
    const detected = extract_detected_content_type_ids_from_summary(summary);
    const merged_types = merge_bulk_import_content_type_ids(
        row.selected_content_type_ids,
        detected
    );
    const refined_type_id =
        summary.pageTypeClassification?.suggestedTypeId || row.suggested_sample_type_id || '';
    const confidence =
        summary.pageTypeClassification?.confidence ?? row.suggested_sample_type_confidence;

    return {
        selected_content_type_ids: merged_types,
        detected_content_type_ids: detected,
        sampleType: refined_type_id,
        suggestedSampleTypeId: refined_type_id || undefined,
        suggestedSampleTypeConfidence: confidence,
    };
}
