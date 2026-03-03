// js/api/client.js

const get_base_url = () => {
    if (typeof window === 'undefined') return '/api';
    const base = window.__GV_API_BASE__ || '/v2/api';
    return base.replace(/\/$/, '');
};

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
    const res = await fetch(`${get_base_url()}${path}`, {
        cache: 'no-store',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Name': window.__GV_CURRENT_USER_NAME__ || ''
        }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function api_post(path, body) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Name': window.__GV_CURRENT_USER_NAME__ || ''
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        const e = new Error(err.error || `HTTP ${res.status}`);
        e.status = res.status;
        e.existingAuditId = err.existingAuditId;
        throw e;
    }
    return res.json();
}

export async function api_put(path, body) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Name': window.__GV_CURRENT_USER_NAME__ || ''
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
}

export async function api_delete(path) {
    const res = await fetch(`${get_base_url()}${path}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-User-Name': window.__GV_CURRENT_USER_NAME__ || ''
        }
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
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
        headers: {
            'Content-Type': 'application/json',
            'X-User-Name': window.__GV_CURRENT_USER_NAME__ || ''
        },
        body: JSON.stringify(body)
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    return res.json();
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

export async function import_audit(audit_data) {
    return api_post('/audits/import', audit_data);
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
