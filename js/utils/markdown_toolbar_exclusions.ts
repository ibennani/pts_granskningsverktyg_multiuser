/**
 * @file Central styrning av vilka textareor som ska ha markdown-verktygsfältet
 * (inklusive formatera-knappen). Styrs i kod, inte via användargränssnittet.
 */

/** data-attribut som markerar en enskild textarea utan verktygsfält. */
export const MARKDOWN_TOOLBAR_SKIP_DATA_ATTR = 'data-skip-markdown-toolbar';

const excluded_ids = new Set<string>();
const excluded_selectors = new Set<string>();
const excluded_predicates: Array<(textarea: HTMLTextAreaElement) => boolean> = [];

let defaults_registered = false;

function register_default_exclusions(): void {
    if (defaults_registered) {
        return;
    }
    defaults_registered = true;
    exclude_markdown_toolbar_for_selector('.manage-users-plate textarea');
    exclude_markdown_toolbar_for_selector('.markdown-preview-editor__textarea');
}

/**
 * Registrerar en textarea-id som aldrig ska få formatera-knappen.
 */
export function exclude_markdown_toolbar_for_id(id: string): void {
    const trimmed = id.trim();
    if (trimmed) {
        excluded_ids.add(trimmed);
    }
}

/**
 * Registrerar en CSS-selektor. Alla matchande textareor utesluts.
 */
export function exclude_markdown_toolbar_for_selector(selector: string): void {
    const trimmed = selector.trim();
    if (trimmed) {
        excluded_selectors.add(trimmed);
    }
}

/**
 * Registrerar ett eget villkor för uteslutning.
 */
export function exclude_markdown_toolbar_when(
    predicate: (textarea: HTMLTextAreaElement) => boolean
): void {
    excluded_predicates.push(predicate);
}

/**
 * Markerar en enskild textarea direkt i komponentkod (före den läggs i DOM).
 */
export function mark_textarea_without_markdown_toolbar(textarea: HTMLTextAreaElement): void {
    textarea.setAttribute(MARKDOWN_TOOLBAR_SKIP_DATA_ATTR, 'true');
}

/**
 * Avgör om markdown-verktygsfältet (formatera-knappen) ska hoppas över.
 */
export function is_markdown_toolbar_excluded(textarea: HTMLTextAreaElement): boolean {
    register_default_exclusions();

    if (textarea.getAttribute(MARKDOWN_TOOLBAR_SKIP_DATA_ATTR) === 'true') {
        return true;
    }

    if (textarea.id && excluded_ids.has(textarea.id)) {
        return true;
    }

    for (const selector of excluded_selectors) {
        try {
            if (textarea.matches(selector)) {
                return true;
            }
        } catch {
            // Ogiltig selektor ignoreras
        }
    }

    return excluded_predicates.some((predicate) => {
        try {
            return predicate(textarea);
        } catch {
            return false;
        }
    });
}
