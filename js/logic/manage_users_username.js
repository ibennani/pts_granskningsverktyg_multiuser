/**
 * @fileoverview Ren logik för att generera och justera 6-teckens användarnamn (a–z)
 * samt att hitta ledigt namn mot befintliga användare.
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
export function normalize_username_to_a_z(value) {
    if (value === null || value === undefined) return '';
    let str = String(value).toLowerCase();
    try {
        str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    } catch (e) {
        // Ignorera om normalize inte stöds
    }
    str = str
        .replace(/æ/g, 'ae')
        .replace(/œ/g, 'oe')
        .replace(/ð/g, 'd')
        .replace(/þ/g, 'th')
        .replace(/ß/g, 'ss');
    str = str.replace(/[^a-z]/g, '');
    return str;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
export function bump_last_character(value) {
    if (!value) return '';
    const str = String(value);
    const last_index = str.length - 1;
    const last_char = str.charAt(last_index);
    const prefix = str.slice(0, last_index);

    if (last_char >= 'a' && last_char <= 'z') {
        if (last_char === 'z') {
            return `${prefix}a`;
        }
        return `${prefix}${String.fromCharCode(last_char.charCodeAt(0) + 1)}`;
    }
    return `${str}a`;
}

/**
 * @param {unknown} first_name
 * @param {unknown} last_name
 * @returns {string}
 */
export function generate_username_from_names(first_name, last_name) {
    const first = typeof first_name === 'string' ? first_name.trim().toLowerCase() : '';
    const last = typeof last_name === 'string' ? last_name.trim().toLowerCase() : '';

    if (!first && !last) {
        return '';
    }

    const first_part = first.slice(0, 3);
    const last_part = last.slice(0, 3);
    const combined = `${first_part}${last_part}` || `${first}${last}`.slice(0, 6);

    return combined.replace(/\s+/g, '');
}

/**
 * @param {unknown} full_name
 * @returns {string}
 */
export function generate_username_from_full_name(full_name) {
    const raw = typeof full_name === 'string' ? full_name.trim() : '';
    const normalized_spaces = raw.replace(/\s+/g, ' ').trim();
    if (!normalized_spaces) return '';

    const parts = normalized_spaces.split(' ').filter(Boolean);
    const first_raw = parts[0] || '';
    const last_raw = parts.length > 1 ? parts[parts.length - 1] : '';

    const first = normalize_username_to_a_z(first_raw);
    const last = normalize_username_to_a_z(last_raw);

    if (!first && !last) return '';

    const take_up_to = (source, start, max_len) => {
        if (!source) return '';
        return source.slice(start, start + max_len);
    };

    if (!last_raw) {
        const base = take_up_to(first, 0, 6);
        if (!base) return '';
        if (base.length >= 6) return base.slice(0, 6);
        const pad_char = base.charAt(base.length - 1) || 'a';
        return (base + pad_char.repeat(6)).slice(0, 6);
    }

    let result = take_up_to(first, 0, 3) + take_up_to(last, 0, 3);

    let first_extra_index = 3;
    let last_extra_index = 3;
    while (result.length < 6 && (first_extra_index < first.length || last_extra_index < last.length)) {
        if (last_extra_index < last.length) {
            result += last.charAt(last_extra_index);
            last_extra_index += 1;
        } else if (first_extra_index < first.length) {
            result += first.charAt(first_extra_index);
            first_extra_index += 1;
        } else {
            break;
        }
    }

    if (result.length < 6) {
        const pad_char = result.charAt(result.length - 1) || 'a';
        result = (result + pad_char.repeat(6)).slice(0, 6);
    } else if (result.length > 6) {
        result = result.slice(0, 6);
    }

    return result;
}

/**
 * @param {unknown} users
 * @returns {Set<string>}
 */
export function get_existing_usernames_set(users) {
    const set = new Set();
    const list = Array.isArray(users) ? users : [];
    list.forEach((u) => {
        const username = u && u.username ? String(u.username).trim().toLowerCase() : '';
        if (username) set.add(username);
    });
    return set;
}

/**
 * @param {unknown} candidate
 * @param {unknown} existing_set
 * @returns {string}
 */
export function find_available_username(candidate, existing_set) {
    const base = typeof candidate === 'string' ? candidate.trim().toLowerCase() : '';
    if (!base) return '';
    const existing = existing_set instanceof Set ? existing_set : new Set();
    if (!existing.has(base)) return base;
    let current = base;
    for (let i = 0; i < 26; i += 1) {
        current = bump_last_character(current);
        if (!existing.has(current)) return current;
    }
    return base;
}
