/**
 * @fileoverview Skapar Word-dokument (docx) från färdiga paragrafer och startar nedladdning.
 */
import {
    Document,
    Packer,
    AlignmentType,
    SectionType,
    PageOrientation
} from 'docx';
import { format_local_date_for_filename } from '../utils/filename_utils.js';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.js';
import { show_global_message_internal } from './export_bootstrap.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

export async function finalize_word_export_download (options: {
    children: unknown[];
    current_audit: any;
    isSortByRequirements: boolean;
    t: ExportWordMainFlowT;
}): Promise<void> {
    const { children, current_audit, isSortByRequirements, t } = options;
    const doc = new Document({
        sections: [{
            properties: isSortByRequirements ? {} : {
                type: SectionType.NEXT_PAGE,
                page: {
                    size: {
                        orientation: PageOrientation.PORTRAIT,
                        width: 11906,
                        height: 16838
                    },
                    margin: {
                        top: 1440,
                        right: 1440,
                        bottom: 1440,
                        left: 1440
                    }
                }
            },
            children: children as never[]
        }],
        styles: {
            default: {
                document: {
                    run: {
                        font: 'Calibri',
                        size: 22
                    },
                    paragraph: {
                        alignment: isSortByRequirements ? undefined : AlignmentType.LEFT,
                        spacing: {
                            after: 60,
                            line: 240,
                            lineRule: 'auto'
                        }
                    }
                },
                heading1: {
                    run: {
                        font: 'Calibri',
                        size: 36,
                        bold: true
                    },
                    paragraph: {
                        spacing: {
                            before: 200,
                            after: 60
                        },
                        outlineLevel: isSortByRequirements ? undefined : 0
                    }
                },
                heading2: {
                    run: {
                        font: 'Calibri',
                        size: 32,
                        bold: true
                    },
                    paragraph: {
                        spacing: {
                            before: 200,
                            after: 60
                        },
                        outlineLevel: isSortByRequirements ? undefined : 1
                    }
                },
                heading3: {
                    run: {
                        font: 'Calibri',
                        size: 28,
                        bold: true
                    },
                    paragraph: {
                        spacing: {
                            before: 200,
                            after: 60
                        },
                        outlineLevel: isSortByRequirements ? undefined : 2
                    }
                },
                heading4: {
                    run: {
                        font: 'Calibri',
                        size: 24,
                        bold: true
                    },
                    paragraph: {
                        spacing: {
                            before: 200,
                            after: 60
                        },
                        outlineLevel: isSortByRequirements ? undefined : 3
                    }
                }
            }
        }
    });

    const buffer = await Packer.toBlob(doc);
    const url = URL.createObjectURL(buffer);
    const link = document.createElement('a');

    const actor_name = sanitize_filename_segment(
        current_audit.auditMetadata.actorName || t('filename_fallback_actor')
    );
    const case_number = (current_audit.auditMetadata.caseNumber || '').trim();

    const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';

    const sort_suffix = isSortByRequirements ? '_sorterat_på_krav' : '_sorterat_på_stickprov';
    const last_updated_iso = current_audit?.updated_at || null;
    const server_dt = await get_server_filename_datetime(last_updated_iso);
    const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
    const date_str = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');

    let filename: string;
    if (sanitized_case_number) {
        filename = `${sanitized_case_number}_${actor_name}_${date_str}${sort_suffix}.docx`;
    } else {
        filename = `${actor_name}_${date_str}${sort_suffix}.docx`;
    }

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
}
