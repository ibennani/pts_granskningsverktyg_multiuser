/**
 * @fileoverview Ren logik för att fylla beskrivning med sidtitel från URL.
 */

export function should_apply_page_title_to_description(
    current_description: string,
    previous_url_page_title: string,
    previous_sample_type_value: string
): boolean {
    const trimmed = current_description.trim();
    if (!trimmed) return true;
    if (previous_url_page_title && trimmed === previous_url_page_title.trim()) return true;
    if (previous_sample_type_value && trimmed === previous_sample_type_value.trim()) return true;
    return false;
}

export function sanitize_page_title_for_description(page_title: string): string {
    return String(page_title || '').trim();
}
