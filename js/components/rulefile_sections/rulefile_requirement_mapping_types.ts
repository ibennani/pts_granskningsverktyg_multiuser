/**
 * @fileoverview Delade typer för kravkopplings-UI.
 */

export type MappingCtx = {
    Helpers: {
        create_element: (tag: string, opts?: Record<string, unknown>) => HTMLElement;
        escape_html?: (value: string) => string;
    };
    Translation: { t: (key: string, opts?: Record<string, unknown>) => string };
};

export type ConceptEntry = { id: string; label: string };
export type TaxonomyRow = { id?: string; label?: string };
export type RequirementRow = {
    key: string;
    display_label: string;
    requirement: Record<string, unknown>;
};

export type CheckboxRefs = { matrix?: HTMLInputElement; card?: HTMLInputElement };

export type MappingViewHandles = {
    matrix_row_elements: HTMLElement[];
    card_elements: HTMLElement[];
};

export type SetConceptChecked = (
    req_key: string,
    concept_id: string,
    checked: boolean,
    source?: HTMLInputElement
) => void;
