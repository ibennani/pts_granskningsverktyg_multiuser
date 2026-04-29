/**
 * @file Administratörskontakter för stöd / kontaktvägar (publikt API).
 */

import { fetch_ordered_admin_contacts } from '../repositories/user_repository.js';

/**
 * @returns {Promise<Array<{ id: string, name: string }>>}
 */
export async function get_admin_contacts_for_api() {
    const result = await fetch_ordered_admin_contacts();
    return result.rows.map((row) => ({
        id: row.id,
        name: (row.name && String(row.name).trim()) || (row.username && String(row.username).trim()) || ''
    }));
}
