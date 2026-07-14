/**
 * @fileoverview Dold ärendemarkering i handläggar-Word (.docx custom properties).
 * Sätter auditId, diarienummer och aktörsnamn vid export och läses vid import.
 */
import JSZip from 'jszip';

export const OBSERVATION_WORD_MARKER_VERSION = '1';

export const OBSERVATION_WORD_MARKER_PROPERTY_AUDIT_ID = 'LeffeObservationWordAuditId';
export const OBSERVATION_WORD_MARKER_PROPERTY_CASE_NUMBER = 'LeffeObservationWordCaseNumber';
export const OBSERVATION_WORD_MARKER_PROPERTY_ACTOR_NAME = 'LeffeObservationWordActorName';
export const OBSERVATION_WORD_MARKER_PROPERTY_VERSION = 'LeffeObservationWordMarkerVersion';

const CUSTOM_PROPERTIES_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/custom-properties';
const VT_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes';
const CUSTOM_PROPERTY_FMTID = '{D5CDD505-2E9C-101B-9397-0800202C6019}';
const CUSTOM_XML_CONTENT_TYPE =
    'application/vnd.openxmlformats-officedocument.custom-properties+xml';
const CUSTOM_REL_TYPE =
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties';

export type ObservationWordAuditMarker = {
    version: string;
    audit_id: string;
    case_number: string;
    actor_name: string;
};

export type ObservationWordAuditMarkerValidation =
    | { ok: true }
    | { ok: false; error_key: string; params?: Record<string, string> };

function escape_xml(text: string): string {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function normalize_marker_text(value: string): string {
    return String(value || '').trim().toLowerCase();
}

/**
 * Bygger markering från aktuell granskning i state.
 */
export function build_observation_word_audit_marker_from_audit(
    audit: Record<string, unknown>
): ObservationWordAuditMarker {
    const metadata = audit.auditMetadata as {
        caseNumber?: string;
        actorName?: string;
    } | undefined;

    return {
        version: OBSERVATION_WORD_MARKER_VERSION,
        audit_id: String(audit.auditId ?? '').trim(),
        case_number: String(metadata?.caseNumber ?? '').trim(),
        actor_name: String(metadata?.actorName ?? '').trim(),
    };
}

function build_custom_properties_xml(marker: ObservationWordAuditMarker): string {
    const entries: Array<{ pid: number; name: string; value: string }> = [
        { pid: 2, name: OBSERVATION_WORD_MARKER_PROPERTY_VERSION, value: marker.version },
        { pid: 3, name: OBSERVATION_WORD_MARKER_PROPERTY_AUDIT_ID, value: marker.audit_id },
        { pid: 4, name: OBSERVATION_WORD_MARKER_PROPERTY_CASE_NUMBER, value: marker.case_number },
        { pid: 5, name: OBSERVATION_WORD_MARKER_PROPERTY_ACTOR_NAME, value: marker.actor_name },
    ];

    const property_xml = entries
        .map(
            (entry) =>
                `<property fmtid="${CUSTOM_PROPERTY_FMTID}" pid="${entry.pid}" name="${escape_xml(entry.name)}">` +
                `<vt:lpwstr>${escape_xml(entry.value)}</vt:lpwstr></property>`
        )
        .join('');

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        `<Properties xmlns="${CUSTOM_PROPERTIES_NS}" xmlns:vt="${VT_NS}">` +
        property_xml +
        '</Properties>'
    );
}

function ensure_custom_xml_registered(content_types_xml: string): string {
    if (content_types_xml.includes('/docProps/custom.xml')) {
        return content_types_xml;
    }
    const override =
        `<Override PartName="/docProps/custom.xml" ContentType="${CUSTOM_XML_CONTENT_TYPE}"/>`;
    return content_types_xml.replace('</Types>', `${override}</Types>`);
}

function ensure_custom_relationship(package_rels_xml: string): string {
    if (package_rels_xml.includes('docProps/custom.xml')) {
        return package_rels_xml;
    }

    const ids = [...package_rels_xml.matchAll(/Id="rId(\d+)"/g)].map((match) =>
        parseInt(match[1], 10)
    );
    const next_id = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
    const relationship =
        `<Relationship Id="rId${next_id}" Type="${CUSTOM_REL_TYPE}" Target="docProps/custom.xml"/>`;

    return package_rels_xml.replace('</Relationships>', `${relationship}</Relationships>`);
}

/**
 * Bäddar in dolda custom properties i en färdig .docx-buffer.
 */
export async function embed_observation_word_audit_marker_in_docx(
    file_bytes: ArrayBuffer | Uint8Array,
    marker: ObservationWordAuditMarker
): Promise<ArrayBuffer> {
    const zip = await JSZip.loadAsync(file_bytes);
    zip.file('docProps/custom.xml', build_custom_properties_xml(marker));

    const content_types_entry = zip.file('[Content_Types].xml');
    if (content_types_entry) {
        const content_types_xml = await content_types_entry.async('string');
        zip.file('[Content_Types].xml', ensure_custom_xml_registered(content_types_xml));
    }

    const package_rels_entry = zip.file('_rels/.rels');
    if (package_rels_entry) {
        const package_rels_xml = await package_rels_entry.async('string');
        zip.file('_rels/.rels', ensure_custom_relationship(package_rels_xml));
    }

    return zip.generateAsync({ type: 'arraybuffer' });
}

function read_property_map(custom_xml: string): Map<string, string> {
    const map = new Map<string, string>();
    const parser = new DOMParser();
    const doc = parser.parseFromString(custom_xml, 'application/xml');
    for (const property of Array.from(doc.getElementsByTagName('property'))) {
        const name = property.getAttribute('name');
        const value_el =
            property.getElementsByTagNameNS(VT_NS, 'lpwstr')[0]
            || property.getElementsByTagName('vt:lpwstr')[0]
            || property.getElementsByTagName('lpwstr')[0];
        if (!name || !value_el) continue;
        map.set(name, value_el.textContent || '');
    }
    return map;
}

/**
 * Läser ärendemarkering från .docx, eller null om den saknas.
 */
export async function read_observation_word_audit_marker_from_docx(
    file_bytes: ArrayBuffer | Uint8Array
): Promise<ObservationWordAuditMarker | null> {
    const zip = await JSZip.loadAsync(file_bytes);
    const custom_entry = zip.file('docProps/custom.xml');
    if (!custom_entry) return null;

    const custom_xml = await custom_entry.async('string');
    const properties = read_property_map(custom_xml);

    const audit_id = properties.get(OBSERVATION_WORD_MARKER_PROPERTY_AUDIT_ID) ?? '';
    const case_number = properties.get(OBSERVATION_WORD_MARKER_PROPERTY_CASE_NUMBER) ?? '';
    const actor_name = properties.get(OBSERVATION_WORD_MARKER_PROPERTY_ACTOR_NAME) ?? '';
    const version = properties.get(OBSERVATION_WORD_MARKER_PROPERTY_VERSION) ?? '';

    if (!audit_id && !case_number && !actor_name && !version) {
        return null;
    }

    return {
        version: version || OBSERVATION_WORD_MARKER_VERSION,
        audit_id,
        case_number,
        actor_name,
    };
}

function marker_has_identity(marker: ObservationWordAuditMarker): boolean {
    return Boolean(marker.audit_id || marker.case_number || marker.actor_name);
}

/**
 * Kontrollerar att Word-filen hör till samma granskning som användaren laddar upp till.
 */
export function validate_observation_word_audit_marker(
    audit: unknown,
    marker: ObservationWordAuditMarker | null | undefined
): ObservationWordAuditMarkerValidation {
    const expected = build_observation_word_audit_marker_from_audit(
        audit as Record<string, unknown>
    );

    if (!marker || !marker_has_identity(marker)) {
        return {
            ok: false,
            error_key: 'observation_word_import_error_wrong_audit',
            params: {
                audit_case: expected.case_number || '',
                audit_actor: expected.actor_name || '',
            },
        };
    }

    if (expected.audit_id && marker.audit_id && expected.audit_id === marker.audit_id) {
        return { ok: true };
    }

    const case_matches =
        normalize_marker_text(expected.case_number) === normalize_marker_text(marker.case_number);
    const actor_matches =
        normalize_marker_text(expected.actor_name) === normalize_marker_text(marker.actor_name);

    if (case_matches && actor_matches && (expected.case_number || expected.actor_name)) {
        return { ok: true };
    }

    return {
        ok: false,
        error_key: 'observation_word_import_error_wrong_audit',
        params: {
            audit_case: expected.case_number || '',
            audit_actor: expected.actor_name || '',
        },
    };
}
