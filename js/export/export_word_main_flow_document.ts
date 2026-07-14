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
import { show_global_message_internal } from './export_bootstrap.js';
import { build_report_export_filename } from './export_report_filename.js';
import { trigger_browser_blob_download } from '../utils/download_filename_utils.js';
import {
    REPORT_EXPORT_FONT_FAMILY,
    REPORT_EXPORT_FONT_SIZES_PT,
    report_export_font_size_half_points,
} from './export_report_typography.js';
import type { ExportWordMainFlowT } from './export_word_main_flow_children.js';

export async function finalize_word_export_download (options: {
    children: unknown[];
    current_audit: any;
    isSortByRequirements: boolean;
    t: ExportWordMainFlowT;
    filename?: string;
    transform_blob?: (buffer: ArrayBuffer) => Promise<ArrayBuffer>;
}): Promise<void> {
    const {
        children,
        current_audit,
        isSortByRequirements,
        t,
        filename: filename_override,
        transform_blob,
    } = options;
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
                        font: REPORT_EXPORT_FONT_FAMILY,
                        size: report_export_font_size_half_points(REPORT_EXPORT_FONT_SIZES_PT.body)
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
                        font: REPORT_EXPORT_FONT_FAMILY,
                        size: report_export_font_size_half_points(REPORT_EXPORT_FONT_SIZES_PT.heading1),
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
                        font: REPORT_EXPORT_FONT_FAMILY,
                        size: report_export_font_size_half_points(REPORT_EXPORT_FONT_SIZES_PT.heading2),
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
                        font: REPORT_EXPORT_FONT_FAMILY,
                        size: report_export_font_size_half_points(REPORT_EXPORT_FONT_SIZES_PT.heading3),
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
                        font: REPORT_EXPORT_FONT_FAMILY,
                        size: report_export_font_size_half_points(REPORT_EXPORT_FONT_SIZES_PT.heading4),
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

    let buffer = await Packer.toBlob(doc);
    if (transform_blob) {
        const transformed = await transform_blob(await buffer.arrayBuffer());
        buffer = new Blob([transformed], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        });
    }

    const filename =
        filename_override ??
        build_report_export_filename(current_audit, isSortByRequirements, 'docx', t);

    trigger_browser_blob_download(buffer, filename);
    show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
}
