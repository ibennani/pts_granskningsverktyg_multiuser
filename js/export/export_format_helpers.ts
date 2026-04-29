// @ts-nocheck
/**
 * @fileoverview Delade text-/Excel-/CSV-hjälpare och bristnummer för export.
 */

import { Paragraph, TextRun } from 'docx';
import { recalculateAuditTimes } from '../audit_logic.js';

export function create_paragraphs_with_line_breaks(text, options = {}) {
    if (!text) {
        return [
            new Paragraph({
                children: [new TextRun({ text: '', ...options })]
            })
        ];
    }

    const lines = text.split('\n');
    const paragraphs = [];

    for (let i = 0; i < lines.length; i++) {
        paragraphs.push(
            new Paragraph({
                children: [new TextRun({ text: lines[i], ...options })]
            })
        );
    }

    return paragraphs;
}

export function create_text_runs_with_line_breaks(text, options = {}) {
    if (!text) {
        return [new TextRun({ text: '', ...options })];
    }

    return [new TextRun({ text: text, ...options })];
}

export function escape_for_csv(str) {
    if (str === null || str === undefined) {
        return '';
    }
    let result = String(str);
    result = result.replace(/"/g, '""');
    result = result.replace(/(\r\n|\n|\r)/gm, ' ');
    if (/[",;]/.test(result)) {
        result = `"${result}"`;
    }
    return result;
}

/**
 * Tar bort vanlig Markdown-syntax men behåller radbrytningar (för Excel-export).
 */
export function strip_markdown_for_excel(text) {
    if (text === null || text === undefined || typeof text !== 'string') {
        return text;
    }
    let s = text.replace(/\r\n/g, '\n');
    s = s.replace(/```[\w]*\n?([\s\S]*?)```/g, '$1');
    s = s.replace(/`([^`]+)`/g, '$1');
    s = s.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
    for (let i = 0; i < 6; i++) {
        s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
        s = s.replace(/\*([^*\n]+)\*/g, '$1');
        s = s.replace(/__([^_]+)__/g, '$1');
    }
    s = s.replace(/(^|\s)_([^_\n]+)_(\s|$)/g, '$1$2$3');
    s = s.replace(/^#{1,6}\s+/gm, '');
    s = s.replace(/^\s*[-*+]\s+/gm, '');
    s = s.replace(/^\s*\d+\.\s+/gm, '');
    s = s.replace(/[`*]{1,2}/g, '');
    return s;
}

export function apply_excel_cell_alignment_top_left_wrap(sheet) {
    sheet.eachRow({ includeEmpty: true }, (row) => {
        row.eachCell({ includeEmpty: true }, (cell) => {
            const prev = cell.alignment || {};
            cell.alignment = {
                ...prev,
                vertical: 'top',
                horizontal: 'left',
                wrapText: true
            };
        });
    });
}

export function get_effective_display_times_for_audit(audit) {
    if (!audit) {
        return { startTime: null, endTime: null };
    }
    const merged = recalculateAuditTimes({ ...audit });
    return {
        startTime: audit.startTime || merged?.startTime || null,
        endTime: audit.endTime || merged?.endTime || null
    };
}

export function extractDeficiencyNumber(deficiencyId) {
    if (!deficiencyId) return '';
    return deficiencyId.replace(/^B/, '');
}

export function formatDeficiencyForWord(deficiencyId) {
    if (!deficiencyId) return '';
    const number = extractDeficiencyNumber(deficiencyId);
    return `Brist\u00A0${number}`;
}

export function norm_taxonomy_string(v) {
    return String(v ?? '').trim().toLowerCase();
}

/**
 * Värden för WCAG POUR-kolumner i CSV/Excel-bristexport.
 */
export function get_wcag_pour_export_values_for_requirement(req_definition, current_audit, t) {
    const empty = {
        wcagPerceivable: '',
        wcagOperable: '',
        wcagUnderstandable: '',
        wcagRobust: ''
    };
    const meta = current_audit?.ruleFileContent?.metadata;
    const taxonomies = meta?.vocabularies?.taxonomies || meta?.taxonomies;
    if (!Array.isArray(taxonomies)) {
        return empty;
    }
    const taxonomy = taxonomies.find((tx) => norm_taxonomy_string(tx?.id) === 'wcag22-pour');
    if (!taxonomy) {
        return empty;
    }
    const classifications = Array.isArray(req_definition?.classifications) ? req_definition.classifications : [];
    const pour_ids = new Set(
        classifications
            .filter((c) => norm_taxonomy_string(c?.taxonomyId) === 'wcag22-pour' && c?.conceptId)
            .map((c) => norm_taxonomy_string(c.conceptId))
    );
    const yes = t('yes');
    const no = t('no');
    return {
        wcagPerceivable: pour_ids.has('perceivable') ? yes : no,
        wcagOperable: pour_ids.has('operable') ? yes : no,
        wcagUnderstandable: pour_ids.has('understandable') ? yes : no,
        wcagRobust: pour_ids.has('robust') ? yes : no
    };
}
