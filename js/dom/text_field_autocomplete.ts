/**
 * @fileoverview Styr autocomplete för textinmatningsfält skapade via create_element.
 */

const TEXT_INPUT_TYPES_WITHOUT_AUTOCOMPLETE = new Set([
    'text',
    'search',
    'url',
    'email',
    'tel',
    'number',
]);

/** Sant för input/textarea där webbläsarens autocomplete ska vara av. */
export function should_disable_text_field_autocomplete(
    tag_name: string,
    type_attr?: string | null
): boolean {
    const tag = String(tag_name ?? '').toLowerCase();
    if (tag === 'textarea') return true;
    if (tag !== 'input') return false;
    const type = String(type_attr ?? 'text').toLowerCase();
    return TEXT_INPUT_TYPES_WITHOUT_AUTOCOMPLETE.has(type);
}
