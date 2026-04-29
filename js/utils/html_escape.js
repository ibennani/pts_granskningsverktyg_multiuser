export function escape_html(unsafe_input) {
    const safe_string = String(unsafe_input || '');
    if (safe_string === '[object Object]') {
        if (window.ConsoleManager?.warn) window.ConsoleManager.warn(`[Helpers.escape_html] Received an object that could not be converted to a meaningful string. Input was:`, unsafe_input);
        return '';
    }
    return safe_string
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

