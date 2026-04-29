// @ts-nocheck
/**
 * @fileoverview HTML-export: bygger nedladdningsbar rapportfil.
 */
import { format_local_date_for_filename } from '../utils/filename_utils.ts';
import { get_server_filename_datetime, sanitize_filename_segment } from '../utils/download_filename_utils.ts';
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

// HTML-exportfunktion (sorterar på krav)
export async function export_to_html(current_audit) {
    consoleManager.log('[ExportLogic] export_to_html called');
    const t = get_t_internal();
    if (!current_audit) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn('[ExportLogic] No audit data provided');
        show_global_message_internal(t('no_audit_data_to_save'), 'error');
        return;
    }

    try {
        consoleManager.log('[ExportLogic] Starting HTML export...');
        // Beräkna hash och timestamp för ändringsdetektering
        consoleManager.log('[ExportLogic] Calculating hash and timestamp...');
        const export_timestamp = new Date().toISOString();
        const audit_hash = await calculate_audit_hash(current_audit);
        consoleManager.log('[ExportLogic] Audit hash calculated:', audit_hash ? audit_hash.substring(0, 16) + '...' : 'null');
        
        // Bygg innehåll sorterat på krav (default)
        consoleManager.log('[ExportLogic] Building content...');
        const { sidebar_html: sidebar_html_requirement, content_html: content_html_requirement } = build_content_sorted_by_requirement(current_audit, t);
        const { sidebar_html: sidebar_html_sample, content_html: content_html_sample } = build_content_sorted_by_sample(current_audit, t);
        consoleManager.log('[ExportLogic] Content built successfully');

        // Bygg sidebar med länkar (nested structure) inklusive sorteringsalternativ
        let sidebar_html = '<nav class="html-export-sidebar" aria-label="Innehållsförteckning" role="navigation"><h2>Innehållsförteckning</h2>';
        sidebar_html += '<div class="sort-controls">';
        sidebar_html += '<div class="sort-label">Sortera på</div>';
        sidebar_html += '<div class="sort-options">';
        sidebar_html += '<label class="sort-option"><input type="radio" name="sort-by" value="requirement" checked> Krav</label>';
        sidebar_html += '<label class="sort-option"><input type="radio" name="sort-by" value="sample"> Stickprov</label>';
        sidebar_html += '</div>';
        sidebar_html += '</div>';
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
        const title_text = `Granskningsrapport - ${escape_html_internal(current_audit.auditMetadata.actorName || t('filename_fallback_actor'))}${current_audit.auditMetadata.caseNumber ? ' - ' + escape_html_internal(current_audit.auditMetadata.caseNumber) : ''}`;

        // Bygg komplett HTML-dokument
        const html_document = `<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="export-timestamp" content="${escape_html_internal(export_timestamp)}">
    ${audit_hash ? `<meta name="audit-hash" content="${escape_html_internal(audit_hash)}">` : ''}
    ${content_hash ? `<meta name="content-hash" content="${escape_html_internal(content_hash)}">` : ''}
    ${normalizedContentBase64 ? `<meta name="normalized-content" content="${escape_html_internal(normalizedContentBase64)}">` : ''}
    <title>${title_text}</title>
    <style>${HTML_EXPORT_CSS}</style>
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
${HTML_EXPORT_EMBEDDED_SCRIPT}
    </script>
</body>
</html>`;


        // Skapa blob och ladda ner
        const blob = new Blob([html_document], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const actor_name = sanitize_filename_segment(current_audit.auditMetadata.actorName || t('filename_fallback_actor'));
        const case_number = (current_audit.auditMetadata.caseNumber || '').trim();
        const sanitized_case_number = case_number ? case_number.replace(/[^a-z0-9åäöÅÄÖ-]/gi, '') : '';
        const last_updated_iso = current_audit?.updated_at || null;
        const server_dt = await get_server_filename_datetime(last_updated_iso);
        const fallback_now = server_dt ? null : await get_server_filename_datetime(null);
        const date_str = server_dt || fallback_now || format_local_date_for_filename(new Date(), '');
        
        let filename;
        if (sanitized_case_number) {
            filename = `${sanitized_case_number}_${actor_name}_${date_str}.html`;
        } else {
            filename = `${actor_name}_${date_str}.html`;
        }

        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        consoleManager.log('[ExportLogic] Triggering download:', filename);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        consoleManager.log('[ExportLogic] HTML export completed successfully');
        show_global_message_internal(t('audit_saved_as_file', { filename: filename }), 'success');

    } catch (error) {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[ExportLogic] Error exporting to HTML:", error);
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn("[ExportLogic] Error stack:", error?.stack);
        show_global_message_internal(t('error_exporting_html') + ` ${error.message}`, 'error');
    }
}
