/**
 * @file Gemensam logik för användar-id och visningsnamn (klient + server).
 */

const USER_UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export function is_user_uuid(value) {
    const trimmed = String(value ?? '').trim();
    return Boolean(trimmed) && USER_UUID_REGEX.test(trimmed);
}

/**
 * @param {{ name?: string | null, username?: string | null } | null | undefined} user
 * @returns {string}
 */
export function resolve_account_display_name(user) {
    const name = String(user?.name ?? '').trim();
    if (name) return name;
    return String(user?.username ?? '').trim();
}

/**
 * @param {Array<{ id?: string | null, name?: string | null, username?: string | null }>} users
 * @returns {Array<{ value: string, label: string }>}
 */
export function build_account_select_options(users) {
    const rows = [];
    for (const user of users) {
        const id = user?.id != null ? String(user.id).trim() : '';
        const label = resolve_account_display_name(user);
        if (!id || !label) continue;
        rows.push({ value: id, label });
    }
    return rows.sort((a, b) => a.label.localeCompare(b.label, 'sv'));
}

/**
 * @param {string | null | undefined} user_id
 * @param {Array<{ value: string, label: string }>} options
 * @param {string} [fallback_name]
 * @returns {string}
 */
export function resolve_account_label(user_id, options, fallback_name = '') {
    const id_trimmed = String(user_id ?? '').trim();
    if (id_trimmed) {
        const hit = options.find((row) => row.value === id_trimmed);
        if (hit) return hit.label;
    }
    return String(fallback_name ?? '').trim();
}

/**
 * @param {Map<string, string> | Record<string, string> | Array<{ value: string, label: string }>} lookup
 * @param {string | null | undefined} stored_value
 * @returns {string}
 */
export function format_stored_user_reference(lookup, stored_value) {
    const raw = String(stored_value ?? '').trim();
    if (!raw) return '';
    if (!is_user_uuid(raw)) return raw;
    if (lookup instanceof Map) {
        return lookup.get(raw) || raw;
    }
    if (Array.isArray(lookup)) {
        const hit = lookup.find((row) => row.value === raw);
        return hit?.label || raw;
    }
    if (lookup && typeof lookup === 'object') {
        return String(lookup[raw] || raw);
    }
    return raw;
}
