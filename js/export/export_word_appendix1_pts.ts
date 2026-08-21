/**

 * @fileoverview Word-export av Bilaga 1 enligt PTS-struktur.

 */

import {
    Bookmark,
    InternalHyperlink,
    PageReference,
    Paragraph,
    PositionalTab,
    PositionalTabAlignment,
    PositionalTabLeader,
    PositionalTabRelativeTo,
    TextRun,
    TabStopType,
    ExternalHyperlink,
} from 'docx';

import {

    apply_appendix1_placeholders,

    build_appendix1_placeholder_context,

    build_appendix1_toc_entries,

    get_appendix1_section_bookmark_id,

    resolve_audit_grouping_taxonomy_id,

    resolve_appendix1_sections_list,

    strip_leading_duplicate_appendix1_heading,

    type Appendix1SectionDefinition,

} from '../logic/appendix1_sections.js';

import { collect_deficiency_types_grouped_by_taxonomy } from './export_deficiency_types_collect.js';

import { render_markdown_to_html } from './export_html_build_primitives.js';

import { html_to_word_paragraphs } from './export_html_to_word_paragraphs.js';

import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';



const COMPACT_LINE_SPACING = { after: 0, before: 0, line: 240, lineRule: 'auto' as const };



function toc_dom_id_to_bookmark_id(section_dom_id: string): string {

    const raw = section_dom_id.startsWith('section-') ? section_dom_id.slice('section-'.length) : section_dom_id;

    return get_appendix1_section_bookmark_id(raw);

}



function append_heading_paragraph(
    children: Array<InstanceType<typeof Paragraph>>,
    text: string,
    level: 1 | 2,
    bookmark_id?: string,
    page_break_before = false
): void {
    const heading_run = new TextRun({ text, bold: true });
    children.push(
        new Paragraph({
            children: bookmark_id
                ? [new Bookmark({ id: bookmark_id, children: [heading_run] })]
                : [heading_run],
            heading: level === 1 ? 'Heading1' : 'Heading2',
            pageBreakBefore: page_break_before,
        })
    );
}



function append_compact_lines_paragraph(

    children: Array<InstanceType<typeof Paragraph>>,

    lines: string[]

): void {

    const runs: TextRun[] = [];

    for (let index = 0; index < lines.length; index += 1) {

        if (index > 0) {

            runs.push(new TextRun({ text: '', break: 1 }));

        }

        runs.push(new TextRun({ text: lines[index] }));

    }

    children.push(

        new Paragraph({

            children: runs,

            spacing: COMPACT_LINE_SPACING,

        })

    );

}



function append_toc_entry_paragraph(
    children: Array<InstanceType<typeof Paragraph>>,
    title: string,
    heading_level: 1 | 2,
    bookmark_id: string
): void {
    children.push(
        new Paragraph({
            children: [
                new InternalHyperlink({
                    anchor: bookmark_id,
                    children: [
                        new TextRun({ text: title, style: 'Hyperlink' }),
                        new TextRun({
                            children: [
                                new PositionalTab({
                                    alignment: PositionalTabAlignment.RIGHT,
                                    relativeTo: PositionalTabRelativeTo.MARGIN,
                                    leader: PositionalTabLeader.DOT,
                                }),
                            ],
                        }),
                        new PageReference(bookmark_id, { hyperlink: true }),
                    ],
                }),
            ],
            indent: heading_level === 2 ? { left: 720 } : undefined,
            spacing: { after: 40, before: 0, line: 240, lineRule: 'auto' },
        })
    );
}



function append_markdown_content_paragraphs(

    children: Array<InstanceType<typeof Paragraph>>,

    section: Appendix1SectionDefinition,

    context: ReturnType<typeof build_appendix1_placeholder_context>

): void {

    const title = apply_appendix1_placeholders(section.title, context);

    const resolved = apply_appendix1_placeholders(

        strip_leading_duplicate_appendix1_heading(section.content, title),

        context

    ).trim();

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



function append_deficiency_bullet_list(
    children: Array<InstanceType<typeof Paragraph>>,
    types: Array<{ primary: string; secondary: string }>
): void {
    for (const entry of types) {
        const runs = [
            new TextRun({ text: '•\t' }),
            new TextRun({ text: entry.primary, bold: true }),
        ];
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
    if (context.caseNumber) {
        c.push(new Paragraph({ children: [new TextRun({ text: context.caseNumber })] }));
    }

    append_heading_paragraph(
        c,
        t('export_appendix1_audit_info_heading'),
        1,
        toc_dom_id_to_bookmark_id('section-audit-info'),
        true
    );

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

    append_compact_lines_paragraph(c, [

        t('export_appendix1_pts_name'),

        t('export_appendix1_pts_address_line1'),

        t('export_appendix1_pts_address_line2'),

        t('export_appendix1_pts_phone'),

        'pts@pts.se',

        'www.pts.se',

    ]);



    append_heading_paragraph(c, t('export_appendix1_toc_heading'), 1, undefined, true);

    for (const entry of build_appendix1_toc_entries(sections, t)) {

        append_toc_entry_paragraph(

            c,

            entry.title,

            entry.heading_level,

            toc_dom_id_to_bookmark_id(entry.section_id)

        );

    }



    const taxonomy_id = resolve_audit_grouping_taxonomy_id(current_audit);

    const deficiency_groups = collect_deficiency_types_grouped_by_taxonomy(current_audit, taxonomy_id, t);

    const deficiency_by_concept = new Map(

        deficiency_groups.map((group) => [group.concept_id, group.types])

    );



    for (const section of sections) {

        const title = apply_appendix1_placeholders(section.title, context);

        append_heading_paragraph(

            c,

            title,

            section.headingLevel,

            get_appendix1_section_bookmark_id(section.id)

        );

        append_markdown_content_paragraphs(c, section, context);

        if (section.kind === 'deficiency_group' && section.conceptId) {

            append_deficiency_bullet_list(c, deficiency_by_concept.get(section.conceptId) ?? []);

        }

    }

}


