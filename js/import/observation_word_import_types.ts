/**
 * @fileoverview Typer för import av handläggar-Word med observationstexter.
 */

export type ParsedHandlingBlock = {
    id_number: string;
    observation_markdown: string;
};

export type ObservationWordImportParseResult = {
    ok: boolean;
    blocks: ParsedHandlingBlock[];
    error_key?: string;
};

export type DeficiencyLocation = {
    deficiency_id: string;
    sample_id: string;
    requirement_id: string;
    check_id: string;
    pc_id: string;
};

export type ObservationWordDiffItemStatus =
    | 'unchanged'
    | 'changed'
    | 'missing_in_word'
    | 'unknown_in_word';

export type ObservationWordDiffItem = {
    id_number: string;
    deficiency_id?: string;
    status: ObservationWordDiffItemStatus;
    audit_text?: string;
    word_text?: string;
};

export type ObservationWordImportDiffResult = {
    parse_ok: boolean;
    can_import: boolean;
    summary: {
        total_in_audit: number;
        total_in_word: number;
        unchanged_count: number;
        changed_count: number;
        missing_in_word_count: number;
        unknown_in_word_count: number;
    };
    items: ObservationWordDiffItem[];
    parse_error_key?: string;
};

export type ObservationWordImportChange = {
    sample_id: string;
    requirement_id: string;
    check_id: string;
    pc_id: string;
    action: 'update_text' | 'clear_deficiency';
    observation_detail?: string;
};

export type ObservationWordImportApplyPayload = {
    changes: ObservationWordImportChange[];
};
