/**
 * @file Databasåtkomst för användare (users) och relaterade frågor.
 */

import { query } from '../db.js';

/**
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function fetch_ordered_admin_contacts() {
    return query(
        'SELECT id, name, username FROM users WHERE is_admin = TRUE ORDER BY COALESCE(NULLIF(TRIM(name), \'\'), username) ASC',
        []
    );
}

/**
 * @param {string} username
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function select_user_for_login_by_username(username) {
    return query(
        'SELECT id, name, is_admin, password FROM users WHERE username = $1 LIMIT 1',
        [username]
    );
}

/**
 * @param {string} user_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function select_user_profile_by_id(user_id) {
    return query(
        'SELECT id, name, is_admin, language_preference, theme_preference, review_sort_preference, created_at FROM users WHERE id = $1 LIMIT 1',
        [user_id]
    );
}

/**
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function list_all_users_for_admin() {
    return query('SELECT id, username, name, is_admin, created_at FROM users ORDER BY username, name');
}

/**
 * @param {string} username
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function check_username_exists(username) {
    return query('SELECT 1 FROM users WHERE username = $1 LIMIT 1', [username]);
}

/**
 * @param {string} username
 * @param {string} name
 * @param {boolean} is_admin
 * @param {string|null} password_hash
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function insert_user_row(username, name, is_admin, password_hash) {
    return query(
        'INSERT INTO users (username, name, is_admin, password) VALUES ($1, $2, $3, $4) RETURNING id, username, name, is_admin, created_at',
        [username, name, is_admin, password_hash]
    );
}

/**
 * @param {string} flex
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function find_user_by_id_or_username_or_name(flex) {
    return query(
        'SELECT id, username, name FROM users WHERE id::text = $1 OR username = $1 OR name = $1 LIMIT 1',
        [flex]
    );
}

/**
 * @param {string} minutes
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function select_expires_at_from_minutes_interval(minutes) {
    return query('SELECT (NOW() + ($1 || \' minutes\')::interval) AS expires_at', [minutes]);
}

/**
 * @param {string} user_id
 * @param {string} hash
 * @param {Date|string} expires_at
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function insert_password_reset_token(user_id, hash, expires_at) {
    return query(
        `INSERT INTO password_reset_tokens (user_id, code_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user_id, hash, expires_at]
    );
}

/**
 * @param {string} user_id
 * @param {string} password_hash
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function update_user_password_by_id(user_id, password_hash) {
    return query(
        'UPDATE users SET password = $1 WHERE id = $2 RETURNING id, name, is_admin, created_at',
        [password_hash, user_id]
    );
}

/**
 * @param {string} user_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function select_user_id_name_by_id(user_id) {
    return query('SELECT id, name FROM users WHERE id = $1', [user_id]);
}

/**
 * @param {string} auditor_name
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function count_audits_by_metadata_auditor_name(auditor_name) {
    return query(
        "SELECT COUNT(*) AS count FROM audits WHERE metadata->>'auditorName' = $1",
        [auditor_name]
    );
}

/**
 * @param {string} user_id
 * @returns {Promise<import('pg').QueryResult>}
 */
export async function delete_user_by_id(user_id) {
    return query('DELETE FROM users WHERE id = $1 RETURNING id', [user_id]);
}
