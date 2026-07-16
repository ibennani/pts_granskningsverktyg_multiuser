/**
 * @fileoverview Visningsnamn för krav: referensnummer följt av kravtitel.
 */

function extract_reference_number(ref_text: string): string {
    const trimmed = ref_text.trim();
    if (!trimmed) return '';
    const match = trimmed.match(/^(\d+(?:\.\d+)*)/);
    return match ? match[1] : '';
}

function get_requirement_name(requirement: Record<string, unknown>): string {
    const top_title = requirement.title;
    if (typeof top_title === 'string' && top_title.trim()) return top_title.trim();
    const metadata = requirement.metadata as Record<string, unknown> | undefined;
    const meta_title = metadata?.title;
    if (typeof meta_title === 'string' && meta_title.trim()) return meta_title.trim();
    const standard_ref = requirement.standardReference as Record<string, unknown> | undefined;
    const ref_text = standard_ref?.text;
    if (typeof ref_text === 'string' && ref_text.trim()) {
        const ref_number = extract_reference_number(ref_text);
        let remainder = ref_text.trim();
        if (ref_number) {
            remainder = remainder.slice(ref_number.length).replace(/^[-–—:.,\s]+/, '').trim();
        }
        if (remainder) return remainder;
    }
    const id = requirement.id ?? requirement.key;
    return id ? String(id) : '';
}

/**
 * Visningsetikett i format "1.1.1 Kravtitel" när referens och titel finns.
 */
export function get_requirement_display_label(requirement: Record<string, unknown>): string {
    const standard_ref = requirement.standardReference as Record<string, unknown> | undefined;
    const ref_text = typeof standard_ref?.text === 'string' ? standard_ref.text.trim() : '';
    const ref_number = extract_reference_number(ref_text);
    const name = get_requirement_name(requirement);
    if (ref_number && name) {
        const normalized_name = name.toLowerCase();
        const normalized_ref = ref_number.toLowerCase();
        if (normalized_name === normalized_ref || normalized_name.startsWith(`${normalized_ref} `)) {
            return name;
        }
        return `${ref_number} ${name}`;
    }
    if (name) return name;
    if (ref_text) return ref_text;
    const id = requirement.id ?? requirement.key;
    return id ? String(id) : '';
}
