/**
 * @fileoverview HTML-export: bygger nedladdningsbar rapportfil.
 */
import { get_audit_export_filename_datetime_segment } from './export_report_filename.js';
import { sanitize_filename_segment, trigger_browser_blob_download } from '../utils/download_filename_utils.js';
import { consoleManager } from '../utils/console_manager.js';
import { get_t_internal, show_global_message_internal } from './export_bootstrap.js';
import {
    build_content_sorted_by_requirement,
    build_content_sorted_by_sample,
    escape_html_internal,
    extract_text_content
} from './export_html_build.js';
import { calculate_audit_hash } from './export_html_audit_hash.js';
import { HTML_EXPORT_CSS } from './export_html_styles_generated.js';
import { HTML_EXPORT_EMBEDDED_SCRIPT } from './export_html_script_generated.js';
import { build_export_media_filename_context } from './export_media_filename_context.js';
import { collect_html_export_zip_entries, build_html_export_zip } from './export_html_media.js';
import {
    build_html_export_sidebar_controls,
    HTML_EXPORT_THEME_CSS,
    resolve_html_export_initial_theme,
    resolve_html_export_document_theme
} from './export_html_themes.js';
import { HTML_EXPORT_SIDEBAR_SCRIPT } from './export_html_sidebar_script.js';
import { finalize_export_catch } from './export_error_handling.js';

// HTML-exportfunktion (sorterar på krav)
export async function export_to_html(current_audit: Record<string, unknown> | null | undefined): Promise<void> {
    consoleManager.log('[ExportLogic] export_to_html called');
    const t = get_t_internal() as (key: string, opts?: Record<string, unknown>) => string;
    if (!current_audit) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] No audit data provided');
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        consoleManager.log('[ExportLogic] Starting HTML export...');
        const audit = current_audit as Record<string, unknown> & {
            auditMetadata?: Record<string, unknown>;
            updated_at?: string | null;
        };
        // Beräkna hash och timestamp för ändringsdetektering
        consoleManager.log('[ExportLogic] Calculating hash and timestamp...');
        const export_timestamp = new Date().toISOString();
        const audit_hash = await calculate_audit_hash(audit);
        consoleManager.log('[ExportLogic] Audit hash calculated:', audit_hash ? audit_hash.substring(0, 16) + '...' : 'null');

        const media_context = await build_export_media_filename_context(audit);
        const initial_theme = resolve_html_export_initial_theme();
        
        // Bygg innehåll sorterat på krav (default)
        consoleManager.log('[ExportLogic] Building content...');
        const { sidebar_html: sidebar_html_requirement, content_html: content_html_requirement } =
            build_content_sorted_by_requirement(audit, t as (key: string, opts?: Record<string, unknown>) => string, media_context);
        const { sidebar_html: sidebar_html_sample, content_html: content_html_sample } = build_content_sorted_by_sample(
            audit,
            t as (key: string, opts?: Record<string, unknown>) => string,
            media_context
        );
        consoleManager.log('[ExportLogic] Content built successfully');

        // Bygg sidebar med länkar (nested structure) inklusive sorteringsalternativ
        let sidebar_html = '<nav class="html-export-sidebar" aria-label="Innehållsförteckning" role="navigation"><h2>Innehållsförteckning</h2>';
        sidebar_html += build_html_export_sidebar_controls(t, initial_theme);
        sidebar_html += '<div class="sidebar-content" data-sort-type="requirement">';
        sidebar_html += sidebar_html_requirement;
        sidebar_html += '</div>';
        sidebar_html += '<div class="sidebar-content" data-sort-type="sample" style="display: none;">';
        sidebar_html += sidebar_html_sample;
        sidebar_html += '</div>';
        sidebar_html += '</nav>';

        // Bygg huvudinnehåll med båda versionerna
        let content_html = '<main class="html-export-content">';
        content_html += '<div class="content-section" data-sort-type="requirement">';
        content_html += content_html_requirement;
        content_html += '</div>';
        content_html += '<div class="content-section" data-sort-type="sample" style="display: none;">';
        content_html += content_html_sample;
        content_html += '</div>';
        content_html += '</main>';

        // Extrahera endast textinnehåll från HTML för ändringsdetektering
        // Detta är mer robust än att jämföra HTML-struktur eftersom webbläsarens parsing inte påverkar texten
        const content_for_text_extraction = content_html_requirement + content_html_sample;
        const text_content = extract_text_content(content_for_text_extraction);
        consoleManager.log('[ExportLogic] Text content extracted (first 200 chars):', text_content.substring(0, 200));
        consoleManager.log('[ExportLogic] Text content length:', text_content.length);
        
        // Beräkna hash av textinnehållet
        let content_hash = null;
        if (window.crypto && window.crypto.subtle) {
            const encoder = new TextEncoder();
            const content_data = encoder.encode(text_content);
            const content_hash_buffer = await window.crypto.subtle.digest('SHA-256', content_data);
            const content_hash_array = Array.from(new Uint8Array(content_hash_buffer));
            content_hash = content_hash_array.map(b => b.toString(16).padStart(2, '0')).join('');
        } else {
            // Fallback hash
            let hash = 0;
            for (let i = 0; i < text_content.length; i++) {
                const char = text_content.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            content_hash = Math.abs(hash).toString(16);
        }
        consoleManager.log('[ExportLogic] Content hash calculated:', content_hash ? content_hash.substring(0, 16) + '...' : 'null');
        consoleManager.log('[ExportLogic] Full hash:', content_hash);
        
        // Bädda in textinnehållet i filen för jämförelse vid laddning
        // Detta undviker CORS-problem och säkerställer att vi jämför exakt samma innehåll
        const normalizedContentBase64 = btoa(unescape(encodeURIComponent(text_content)));

        // CSS med variabler från appens style.css

        // Skapa titeltext för banner och title
        const am = audit.auditMetadata ?? {};
        const actor_label = am.actorName != null && String(am.actorName).trim() !== '' ? String(am.actorName) : t('filename_fallback_actor');
        const case_num = am.caseNumber != null ? String(am.caseNumber) : '';
        const title_text = `Granskningsrapport - ${escape_html_internal(actor_label)}${case_num ? ' - ' + escape_html_internal(case_num) : ''}`;

        // Bygg komplett HTML-dokument
        const html_document = `<!DOCTYPE html>
<html lang="sv" data-theme="${escape_html_internal(resolve_html_export_document_theme(initial_theme))}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="export-timestamp" content="${escape_html_internal(export_timestamp)}">
    ${audit_hash ? `<meta name="audit-hash" content="${escape_html_internal(audit_hash)}">` : ''}
    ${content_hash ? `<meta name="content-hash" content="${escape_html_internal(content_hash)}">` : ''}
    ${normalizedContentBase64 ? `<meta name="normalized-content" content="${escape_html_internal(normalizedContentBase64)}">` : ''}
    <title>${title_text}</title>
    <style>${HTML_EXPORT_CSS}${HTML_EXPORT_THEME_CSS}</style>
</head>
<body>
    <div class="html-export-container">
        <div class="html-export-banner">
            ${title_text}
        </div>
        <div class="html-export-warning-banner" id="change-warning-banner">
            <strong>⚠️ Varning:</strong> Detta dokument har ändrats sedan det exporterades. Innehållet kan vara föråldrat.
            <button class="html-export-warning-banner-close" id="warning-close-btn" aria-label="Stäng varning">×</button>
        </div>
        ${sidebar_html}
        ${content_html}
    </div>
    <script>
${HTML_EXPORT_SIDEBAR_SCRIPT}
${HTML_EXPORT_EMBEDDED_SCRIPT}
    </script>
</body>
</html>`;


        // Skapa zip med HTML och bilder
        const actor_name = sanitize_filename_segment(actor_label);
        const case_number = case_num.trim();
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        const date_str = get_audit_export_filename_datetime_segment();
        
        let html_filename;
        if (sanitized_case_number) {
            html_filename = `${sanitized_case_number}_${actor_name}_${date_str}.html`;
        } else {
            html_filename = `${actor_name}_${date_str}.html`;
        }
        const zip_filename = html_filename.replace(/\.html$/i, '.zip');

        const zip_entries = collect_html_export_zip_entries(audit, media_context);
        const audit_id = (audit as { auditId?: string }).auditId;
        const { blob, missing_filenames } = await build_html_export_zip({
            html_document,
            html_filename,
            entries: zip_entries,
            audit_id
        });

        consoleManager.log('[ExportLogic] Triggering download:', zip_filename);
        trigger_browser_blob_download(blob, zip_filename);
        consoleManager.log('[ExportLogic] HTML export completed successfully');

        if (missing_filenames.length > 0) {
            show_global_message_internal(
                t('html_export_missing_media_warning', {
                    filename: zip_filename,
                    count: String(missing_filenames.length)
                }),
                'success'
            );
        } else {
            show_global_message_internal(t('audit_saved_as_file', { filename: zip_filename }), 'success');
        }

    } catch (error: unknown) {
        finalize_export_catch(error, (err) => {
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] Error exporting to HTML:', err);
            const error_obj = err as { stack?: string; message?: string };
            if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] Error stack:', error_obj?.stack);
            const msg = err instanceof Error ? err.message : String(err);
            show_global_message_internal(t('error_exporting_html') + ` ${msg}`, 'error');
        });
    }
}
