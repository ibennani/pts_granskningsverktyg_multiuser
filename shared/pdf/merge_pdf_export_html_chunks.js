/**
 * @fileoverview Slår ihop flera PDF-export-HTML-delar till ett dokument (behåller taggstruktur vid Puppeteer-rendering).
 */

/**
 * Extraherar innehållet i `<main>` från en PDF-export-HTML-sträng.
 * @param {string} html
 * @returns {string}
 */
export function extract_pdf_export_html_main_inner(html) {
    const main_match = html.match(/<main[^>]*>([\s\S]*)<\/main>/i);
    if (main_match?.[1] !== undefined) {
        return main_match[1];
    }
    const body_match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
    return body_match?.[1] ?? html;
}

/**
 * Kombinerar HTML-delar (samma head/title som första delen) till ett semantiskt dokument.
 * @param {string[]} html_chunks
 * @returns {string}
 */
export function merge_pdf_export_html_chunks(html_chunks) {
    if (!Array.isArray(html_chunks) || html_chunks.length === 0) {
        throw new Error('htmlChunks får inte vara tom');
    }
    if (html_chunks.length === 1) {
        return html_chunks[0];
    }

    const first = html_chunks[0];
    const merged_body = html_chunks.map(extract_pdf_export_html_main_inner).join('\n');
    if (/<main[\s>]/i.test(first)) {
        return first.replace(/<main[^>]*>[\s\S]*<\/main>/i, `<main>${merged_body}</main>`);
    }
    const body_replaced = first.replace(/<body[^>]*>[\s\S]*<\/body>/i, `<body>${merged_body}</body>`);
    if (body_replaced === first) {
        throw new Error('Kunde inte slå ihop PDF-HTML: saknar <body>');
    }
    return body_replaced;
}
