/**
 * Underhållsskript: extraherar HTML-export från en FULL export_logic.ts till js/export/.
 * VARNING: Skriver över js/export_logic.ts med en tunn fasad. Kör endast mot en backup
 * av monolitfilen (t.ex. git show HEAD:js/export_logic.ts > tmp.ts och peka SOURCE).
 * Kör: node scripts/extract_html_export.cjs
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePath = process.env.EXPORT_LOGIC_SOURCE || path.join(root, 'js', 'export_logic.ts');
const logicPath = path.join(root, 'js', 'export_logic.ts');
const L = fs.readFileSync(sourcePath, 'utf8').replace(/\r\n/g, '\n').split('\n');

function emitChunkedConst(name, str, chunkSize) {
    const chunks = [];
    for (let i = 0; i < str.length; i += chunkSize) {
        chunks.push(JSON.stringify(str.slice(i, i + chunkSize)));
    }
    return (
        `// @ts-nocheck\n/* eslint-disable max-len */\n/** Autogenererad – ${name}. */\nexport const ${name} =\n    ` +
        chunks.join('\n    + ') +
        ';\n'
    );
}

// --- export_html_build.ts ---
const buildBody = L.slice(21, 401)
    .join('\n')
    .replace(/^function /gm, 'export function ');
const buildHead = `// @ts-nocheck
/**
 * @fileoverview HTML-export: escape, metadata, observationer och sidebar/innehåll.
 */
import { marked } from '../utils/markdown.js';
import * as Helpers from '../utils/helpers.js';
import { extractDeficiencyNumber } from './export_format_helpers.js';
import { get_export_requirement_result } from './export_bootstrap.js';
import {
    natural_sort,
    get_requirements_with_deficiencies,
    get_samples_with_deficiencies_for_requirement,
    get_deficiencies_for_sample
} from './export_word_deficiency_queries.js';
import { extract_reference_number } from './export_word_requirement_sections.js';

`;
fs.writeFileSync(path.join(root, 'js', 'export', 'export_html_build.ts'), buildHead + buildBody + '\n');

// --- export_html_audit_hash.ts ---
const hashBody = L.slice(403, 443)
    .join('\n')
    .replace(/^async function calculate_audit_hash/, 'export async function calculate_audit_hash');
const hashHead = `// @ts-nocheck
/**
 * @fileoverview SHA-256 av normaliserad audit för HTML-exportmetadata.
 */

`;
fs.writeFileSync(path.join(root, 'js', 'export', 'export_html_audit_hash.ts'), hashHead + hashBody + '\n');

// CSS: rader 529–918 (index 528–917)
const cssRaw = L.slice(528, 918).join('\n');
fs.writeFileSync(
    path.join(root, 'js', 'export', 'export_html_styles_generated.ts'),
    emitChunkedConst('HTML_EXPORT_CSS', cssRaw, 4000)
);

// Inbäddat skript: rader 950–1600 (index 949–1599)
const scriptRaw = L.slice(949, 1600).join('\n');
fs.writeFileSync(
    path.join(root, 'js', 'export', 'export_html_script_generated.ts'),
    emitChunkedConst('HTML_EXPORT_EMBEDDED_SCRIPT', scriptRaw, 4000)
);

// --- export_html_export.ts (orkestrering + HTML-mall utan CSS/skript) ---
const orchestration = L.slice(443, 527)
    .join('\n')
    .replace(/^async function export_to_html/m, 'export async function export_to_html');
const tail = L.slice(1603, 1640).join('\n');

const exportTs = `// @ts-nocheck
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

${orchestration}

        // Skapa titeltext för banner och title
        const title_text = \`Granskningsrapport - \${escape_html_internal(current_audit.auditMetadata.actorName || t('filename_fallback_actor'))}\${current_audit.auditMetadata.caseNumber ? ' - ' + escape_html_internal(current_audit.auditMetadata.caseNumber) : ''}\`;

        // Bygg komplett HTML-dokument
        const html_document = \`<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="export-timestamp" content="\${escape_html_internal(export_timestamp)}">
    \${audit_hash ? \`<meta name="audit-hash" content="\${escape_html_internal(audit_hash)}">\` : ''}
    \${content_hash ? \`<meta name="content-hash" content="\${escape_html_internal(content_hash)}">\` : ''}
    \${normalizedContentBase64 ? \`<meta name="normalized-content" content="\${escape_html_internal(normalizedContentBase64)}">\` : ''}
    <title>\${title_text}</title>
    <style>\${HTML_EXPORT_CSS}</style>
</head>
<body>
    <div class="html-export-container">
        <div class="html-export-banner">
            \${title_text}
        </div>
        <div class="html-export-warning-banner" id="change-warning-banner">
            <strong>⚠️ Varning:</strong> Detta dokument har ändrats sedan det exporterades. Innehållet kan vara föråldrat.
            <button class="html-export-warning-banner-close" id="warning-close-btn" aria-label="Stäng varning">×</button>
        </div>
        \${sidebar_html}
        \${content_html}
    </div>
    <script>
\${HTML_EXPORT_EMBEDDED_SCRIPT}
    </script>
</body>
</html>\`;

${tail}
`;

fs.writeFileSync(path.join(root, 'js', 'export', 'export_html_export.ts'), exportTs);

// --- Tunn export_logic.ts ---
const facade = `// @ts-nocheck
// js/export_logic.ts – tunn fasad för export (Word/HTML/CSV/Excel).

import { export_to_csv } from './export/export_csv.js';
import { export_to_excel } from './export/export_excel.js';
import { export_to_word_criterias, export_to_word_samples } from './export/export_word_main_flow.js';
import { export_to_html } from './export/export_html_export.js';

const public_api = {
    export_to_csv,
    export_to_excel,
    export_to_word_criterias,
    export_to_word_samples,
    export_to_html
};

export { public_api };

window.ExportLogic = public_api;
`;
fs.writeFileSync(logicPath, facade);

for (const fn of ['export_html_script_generated.ts', 'export_html_styles_generated.ts']) {
    const p = path.join(root, 'js', 'export', fn);
    let s = fs.readFileSync(p, 'utf8');
    s = s.replace(/\\r\\n/g, '\\n');
    fs.writeFileSync(p, s);
}

console.log('Klar: export_html_*.ts genererade och export_logic.ts ersatt med fasad.');
