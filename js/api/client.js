// js/api/client.js

const AUTH_TOKEN_KEY = 'gv_auth_token';
const AUTH_USER_IS_ADMIN_KEY = 'gv_current_user_is_admin';
const AUTH_REQUIRED_EVENT = 'gv-auth-required';

export function is_current_user_admin() {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(AUTH_USER_IS_ADMIN_KEY) === '1';
}

export function set_current_user_admin(is_admin) {
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(AUTH_USER_IS_ADMIN_KEY, is_admin ? '1' : '0');
    }
}

export const get_base_url = () => {
    if (typeof window === 'undefined') return '/api';
    const base = window.__GV_API_BASE__ || '/v2/api';
    return base.replace(/\/$/, '');
};

export function get_auth_token() {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function set_auth_token(token) {
    if (typeof window !== 'undefined' && token) {
        sessionStorage.setItem(AUTH_TOKEN_KEY, token);
    }
}

export function clear_auth_token() {
    if (typeof window !== 'undefined') {
        sessionStorage.removeItem(AUTH_TOKEN_KEY);
        sessionStorage.removeItem(AUTH_USER_IS_ADMIN_KEY);
    }
}

function handle_unauthorized_response(res) {
    if (!res || res.status !== 401) return false;
    try {
        clear_auth_token();
    } catch (_) {}
    try {
        if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('gv_current_user_name');
            sessionStorage.removeItem(AUTH_USER_IS_ADMIN_KEY);
        }
    } catch (_) {}
    try {
        delete window.__GV_CURRENT_USER_NAME__;
    } catch (_) {}
    try {
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
        }
    } catch (_) {}
    return true;
}

async function parse_error_payload(res) {
    if (!res) return { error: 'Okänt fel' };
    return res.json().catch(() => ({ error: res.statusText || `HTTP ${res.status}` }));
}

export function get_auth_headers() {
    const headers = { 'Content-Type': 'application/json' };
    const token = typeof window !== 'undefined' ? get_auth_token() : null;
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Returnerar WebSocket-URL för realtidssynkronisering.
 * Använder samma host som API, path /v2/ws (eller /ws om API är /api).
 */
export function get_websocket_url() {
    if (typeof window === 'undefined') return 'ws://localhost:3000/ws';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const base = window.__GV_API_BASE__ || '/v2/api';
    const ws_path = base.replace(/\/api\/?$/, '/ws').replace(/\/$/, '') || '/v2/ws';
    return `${protocol}//${host}${ws_path}`;
}

export async function api_get(path) {
    const url = `${get_base_url()}${path}`;
    let res;
    try {
        res = await fetch(url, {
            cache: 'no-store',
            headers: get_auth_headers()
        });
    } catch (fetchErr) {
        throw fetchErr;
    }
    if (handle_unauthorized_response(res)) {
        const e = new Error('Inloggning krävs');
        e.status = 401;
        throw e;
    }
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const e = new Error(err.error || `HTTP ${res.status}`);
        e.status = res.status;
        throw e;
    }
    try {
        return await res.json();
    } catch (jsonErr) {
        throw jsonErr;
    }
}

export async function api_post(path, body) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'POST',
        headers: get_auth_headers(),
        body: JSON.stringify(body)
    });
    if (path !== '/auth/login' && handle_unauthorized_response(res)) {
        const e = new Error('Inloggning krävs');
        e.status = 401;
        throw e;
    }
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const e = new Error(err.error || `HTTP ${res.status}`);
        e.status = res.status;
        e.existingAuditId = err.existingAuditId;
        if (err.existingAuditSummary !== undefined && err.existingAuditSummary !== null) {
            e.existingAuditSummary = err.existingAuditSummary;
        }
        throw e;
    }
    return res.json();
}

export async function api_put(path, body) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'PUT',
        headers: get_auth_headers(),
        body: JSON.stringify(body)
    });
    if (handle_unauthorized_response(res)) {
        const e = new Error('Inloggning krävs');
        e.status = 401;
        throw e;
    }
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const msg = err.detail ? `${err.error || res.statusText}: ${err.detail}` : (err.error || `HTTP ${res.status}`);
        const e = new Error(msg);
        e.status = res.status;
        throw e;
    }
    return res.json();
}

export async function api_delete(path) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'DELETE',
        headers: get_auth_headers()
    });
    if (handle_unauthorized_response(res)) {
        const e = new Error('Inloggning krävs');
        e.status = 401;
        throw e;
    }
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const msg = err?.error || `HTTP ${res.status}`;
        const e = new Error(msg);
        e.status = res.status;
        if (err && typeof err === 'object') e.responseBody = err;
        throw e;
    }
    if (res.status === 204) return null;
    return res.json();
}

export async function api_patch(path, body) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'PATCH',
        headers: get_auth_headers(),
        body: JSON.stringify(body)
    });
    if (handle_unauthorized_response(res)) {
        const e = new Error('Inloggning krävs');
        e.status = 401;
        throw e;
    }
    if (!res.ok) {
        const err = await parse_error_payload(res);
        const e = new Error(err.error || `HTTP ${res.status}`);
        e.status = res.status;
        if (err.serverVersion !== undefined && err.serverVersion !== null) {
            e.serverVersion = err.serverVersion;
        }
        if (err.existingAuditId !== undefined) {
            e.existingAuditId = err.existingAuditId;
        }
        throw e;
    }
    return res.json();
}

export async function login(username, password) {
    const res = await fetch(`${get_base_url()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const e = new Error(data.error || 'Inloggning misslyckades');
        e.status = res.status;
        throw e;
    }
    return data;
}

export async function reset_password_with_code(code, password) {
    const res = await fetch(`${get_base_url()}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const e = new Error(data.error || 'Återställning av lösenord misslyckades');
        e.status = res.status;
        throw e;
    }
    return data;
}

/**
 * Byter lösenord för inloggad användare. Användaren behöver inte ange nuvarande lösenord.
 * Använder egen fetch så att 401 inte triggar utloggning via handle_unauthorized_response.
 * @param {string} new_password - Nytt lösenord
 */
export async function change_my_password(new_password) {
    const base = get_base_url();
    const res = await fetch(`${base}/auth/change-password`, {
        method: 'POST',
        headers: get_auth_headers(),
        body: JSON.stringify({ new_password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const e = new Error(data.error || data.message || `HTTP ${res.status}`);
        e.status = res.status;
        throw e;
    }
    return data;
}

/**
 * Hämtar administratörer för t.ex. "kontakta admin"-modalen.
 * @returns {{ list: Array<{id?, name?, username?}>, fetched: boolean }} fetched=true om anropet lyckades (även vid tom lista)
 */
export async function get_admin_contacts() {
    const public_result = await _fetch_admin_contacts_public();
    if (public_result.success) return { list: public_result.list, fetched: true };
    try {
        const data = await api_get('/users/admin-contacts');
        const list = Array.isArray(data) ? data : (data && Array.isArray(data.admins) ? data.admins : []);
        return { list, fetched: true };
    } catch (_) {
        return { list: [], fetched: false };
    }
}

async function _fetch_admin_contacts_public() {
    const url = `${get_base_url()}/auth/admin-contacts`;
    try {
        const res = await fetch(url, {
            method: 'GET',
            cache: 'no-store',
            headers: { 'Content-Type': 'application/json' }
        });
        const raw = await res.json().catch(() => null);
        if (!res.ok) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[get_admin_contacts] Publikt anrop misslyckades:', res.status, url, raw);
            }
            return { success: false, list: [] };
        }
        const list = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.admins) ? raw.admins : []);
        return { success: true, list };
    } catch (err) {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[get_admin_contacts] Publikt anrop fel:', url, err?.message || err);
        }
        return { success: false, list: [] };
    }
}

export async function get_users() {
    return api_get('/users');
}

export async function get_current_user_preferences() {
    return api_get('/users/me');
}

export async function update_current_user_preferences(prefs) {
    return api_patch('/users/me', prefs);
}

export async function get_rules() {
    return api_get('/rules');
}

export async function get_rule(id) {
    return api_get(`/rules/${id}`);
}

export async function get_rule_version(id) {
    return api_get(`/rules/${id}/version`);
}

export async function create_rule(data) {
    return api_post('/rules', data);
}

export async function import_rule(name, content) {
    return api_post('/rules/import', { name, content });
}

export async function create_production_rule(data) {
    return api_post('/rules/production', data);
}

export async function update_rule(id, body) {
    return api_put(`/rules/${id}`, body);
}

export async function delete_rule(id) {
    return api_delete(`/rules/${id}`);
}

export async function publish_rule(id) {
    return api_post(`/rules/${id}/publish`, {});
}

export async function copy_rule(id) {
    return api_post(`/rules/${id}/copy`, {});
}

export async function publish_production_rule(id) {
    return api_post(`/rules/${id}/publish_production`, {});
}

/**
 * Hämtar regelfil för nedladdning (samma data som export-endpointen returnerar).
 * Returnerar { id, name, content, version } för att skapa blob och filnamn i UI.
 */
export async function export_rule(id) {
    return api_get(`/rules/${id}/export`);
}

// Backup-API
export async function get_backup_overview() {
    return api_get('/backup/list');
}

export async function get_backups_for_audit(audit_id) {
    return api_get(`/backup/${encodeURIComponent(audit_id)}`);
}

export async function run_backup_now() {
    return api_post('/backup/run', {});
}

export async function save_audit_backup_on_server(audit_id) {
    return api_post('/backup/save-audit', { auditId: audit_id });
}

export async function get_backup_settings() {
    return api_get('/backup/settings');
}

export async function create_password_reset_code(user_id, expires_in_minutes) {
    return api_post(`/users/${encodeURIComponent(user_id)}/password-reset-codes`, { expires_in_minutes });
}

export async function create_user(body) {
    return api_post('/users', body);
}

export async function update_user(id, body) {
    return api_put(`/users/${encodeURIComponent(id)}`, body);
}

export async function delete_user(id) {
    return api_delete(`/users/${encodeURIComponent(id)}`);
}

export async function get_user_audit_count(id) {
    return api_get(`/users/${encodeURIComponent(id)}/audit-count`);
}

export async function update_backup_settings(body) {
    return api_put('/backup/settings', body);
}

export async function get_audits(status) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return api_get(`/audits${q}`);
}

export async function get_audit(id) {
    return api_get(`/audits/${id}`);
}

export async function get_audit_version(id) {
    return api_get(`/audits/${id}/version`);
}

/**
 * Hämtar granskning med regelfil. Om svaret saknar ruleFileContent men har ruleSetId,
 * hämtas regelfilen separat via rules-API och slås ihop. Regelfilen läggs inte till separat.
 */
export async function load_audit_with_rule_file(id) {
    const audit_data = await get_audit(id);
    if (audit_data.ruleFileContent) {
        return audit_data;
    }
    const rule_set_id = audit_data.ruleSetId ?? audit_data.rule_set_id;
    if (!rule_set_id) {
        return audit_data;
    }
    const rule = await get_rule(rule_set_id);
    // Använd alltid publicerad regelfil som källa för granskningar.
    const rule_content = rule?.published_content ?? rule?.content;
    if (rule_content) {
        return { ...audit_data, ruleFileContent: rule_content };
    }
    return audit_data;
}

export async function create_audit(rule_set_id) {
    return api_post('/audits', { rule_set_id });
}

/**
 * @param {object} audit_data - Granskningspayload (sparad JSON-struktur)
 * @param {{ replace_existing_audit_id?: string }} [options] - Vid överskrivning: befintligt gransknings-id
 */
export async function import_audit(audit_data, options = {}) {
    const body = { ...audit_data };
    if (options.replace_existing_audit_id) {
        body.replaceExistingAuditId = options.replace_existing_audit_id;
    }
    return api_post('/audits/import', body);
}

export async function delete_audit(id) {
    return api_delete(`/audits/${id}`);
}

export async function update_audit(id, data) {
    return api_patch(`/audits/${id}`, data);
}

export async function patch_requirement_result(audit_id, sample_id, requirement_id, version, result) {
    return api_patch(`/audits/${audit_id}/results/${sample_id}/${requirement_id}`, { version, result });
}

export async function check_api_available() {
    try {
        const res = await fetch(`${get_base_url()}/health`, { method: 'GET' });
        return res.ok;
    } catch {
        return false;
    }
}
