/**
 * @fileoverview Word-export av Bilaga 1 enligt PTS-struktur.
 */
import { Paragraph, TextRun, TabStopType, ExternalHyperlink } from 'docx';
import {
    apply_appendix1_placeholders,
    build_appendix1_placeholder_context,
    build_appendix1_toc_entries,
    read_rulefile_appendix1_grouping_taxonomy_id,
    resolve_appendix1_sections_list,
    type Appendix1SectionDefinition,
} from '../logic/appendix1_sections.js';
import { collect_deficiency_types_grouped_by_taxonomy } from './export_deficiency_types_collect.js';
import { render_markdown_to_html } from './export_html_build_primitives.js';
import { html_to_word_paragraphs } from './export_html_to_word_paragraphs.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

function append_heading_paragraph(
    children: Array<InstanceType<typeof Paragraph>>,
    text: string,
    level: 1 | 2
): void {
    children.push(
        new Paragraph({
            children: [new TextRun({ text, bold: true })],
            heading: level === 1 ? 'Heading1' : 'Heading2',
        })
    );
}

function append_markdown_content_paragraphs(
    children: Array<InstanceType<typeof Paragraph>>,
    section: Appendix1SectionDefinition,
    context: ReturnType<typeof build_appendix1_placeholder_context>
): void {
    const resolved = apply_appendix1_placeholders(section.content, context).trim();
    if (!resolved) return;
    if (section.format === 'list') {
        const items = resolved
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => line.replace(/^[-*]\s+/, ''));
        for (const item of items) {
            children.push(
                new Paragraph({
                    children: [new TextRun({ text: '•\t' }), new TextRun({ text: item })],
                    indent: { left: 227, hanging: 227 },
                    tabStops: [{ position: 227, type: TabStopType.LEFT }],
                })
            );
        }
        return;
    }
    const paragraphs = html_to_word_paragraphs(render_markdown_to_html(resolved), { include_h1: false });
    children.push(...paragraphs);
}

function append_deficiency_bullets(
    children: Array<InstanceType<typeof Paragraph>>,
    types: Array<{ primary: string; secondary: string }>
): void {
    for (const entry of types) {
        const runs = [new TextRun({ text: '•\t' }), new TextRun({ text: entry.primary, bold: true })];
        if (entry.secondary) runs.push(new TextRun({ text: ` ${entry.secondary}` }));
        children.push(
            new Paragraph({
                children: runs,
                indent: { left: 227, hanging: 227 },
                tabStops: [{ position: 227, type: TabStopType.LEFT }],
            })
        );
    }
}

export function append_word_appendix1_pts_paragraphs(
    children: unknown[],
    current_audit: Record<string, unknown>,
    t: ExportWordMainFlowT
): void {
    const c = children as Array<InstanceType<typeof Paragraph>>;
    const context = build_appendix1_placeholder_context(current_audit);
    const sections = resolve_appendix1_sections_list(current_audit);

    append_heading_paragraph(c, t('export_appendix1_cover_title'), 1);
    c.push(new Paragraph({ children: [new TextRun({ text: t('export_appendix1_cover_subtitle') })] }));
    c.push(new Paragraph({ children: [new TextRun({ text: '' })] }));

    append_heading_paragraph(c, t('export_appendix1_audit_info_heading'), 1);
    const info_rows: Array<[string, string]> = [
        [t('case_number'), context.caseNumber || '—'],
        [t('export_appendix1_audited_service_label'), `${t('export_appendix1_service_prefix')} ${context.actorName}`.trim()],
        [t('export_appendix1_audit_started_label'), context.startDate || '—'],
        [t('export_appendix1_audit_ended_label'), context.endDate || '—'],
        [t('export_appendix1_case_handler_label'), context.caseHandler || '—'],
        [t('export_appendix1_investigator_label'), context.auditorName || '—'],
    ];
    for (const [label, value] of info_rows) {
        c.push(new Paragraph({ children: [new TextRun({ text: label, bold: true })] }));
        c.push(new Paragraph({ children: [new TextRun({ text: value })] }));
    }
    if (context.actorLink) {
        c.push(new Paragraph({ children: [new TextRun({ text: t('export_appendix1_service_link_label'), bold: true })] }));
        c.push(
            new Paragraph({
                children: [
                    new ExternalHyperlink({
                        children: [new TextRun({ text: context.actorLink, style: 'Hyperlink' })],
                        link: context.actorLink,
                    }),
                ],
            })
        );
    }
    for (const line of [
        t('export_appendix1_pts_name'),
        t('export_appendix1_pts_address_line1'),
        t('export_appendix1_pts_address_line2'),
        t('export_appendix1_pts_phone'),
        'pts@pts.se',
        'www.pts.se',
    ]) {
        c.push(new Paragraph({ children: [new TextRun({ text: line })] }));
    }

    append_heading_paragraph(c, t('export_appendix1_toc_heading'), 1);
    for (const entry of build_appendix1_toc_entries(sections, t)) {
        c.push(
            new Paragraph({
                children: [new TextRun({ text: entry.title })],
                indent: entry.heading_level === 2 ? { left: 720 } : undefined,
            })
        );
    }

    const rule_file = current_audit.ruleFileContent as Record<string, unknown> | undefined;
    const taxonomy_id = read_rulefile_appendix1_grouping_taxonomy_id(rule_file);
    const deficiency_groups = collect_deficiency_types_grouped_by_taxonomy(current_audit, taxonomy_id, t);
    const deficiency_by_concept = new Map(
        deficiency_groups.map((group) => [group.concept_id, group.types])
    );

    for (const section of sections) {
        const title = apply_appendix1_placeholders(section.title, context);
        append_heading_paragraph(c, title, section.headingLevel);
        append_markdown_content_paragraphs(c, section, context);
        if (section.kind === 'deficiency_group' && section.conceptId) {
            append_deficiency_bullets(c, deficiency_by_concept.get(section.conceptId) ?? []);
        }
    }
}
