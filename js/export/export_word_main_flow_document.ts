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

    const filename = await build_report_export_filename(
        current_audit,
        isSortByRequirements,
        'docx',
        t
    );

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');
}
