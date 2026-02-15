// js/api/client.js

const get_base_url = () => {
    if (typeof window === 'undefined') return '/api';
    const base = window.__GV_API_BASE__ || '/v2/api';
    return base.replace(/\/$/, '');
};

export async function api_get(path) {
    const res = await fetch(`${get_base_url()}${path}`, {
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
        throw new Error(err.error || `HTTP ${res.status}`);
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

export async function get_rules() {
    return api_get('/rules');
}

export async function get_rule(id) {
    return api_get(`/rules/${id}`);
}

export async function create_rule(data) {
    return api_post('/rules', data);
}

export async function import_rule(name, content) {
    return api_post('/rules/import', { name, content });
}

export async function get_audits(status) {
    const q = status ? `?status=${encodeURIComponent(status)}` : '';
    return api_get(`/audits${q}`);
}

export async function get_audit(id) {
    return api_get(`/audits/${id}`);
}

export async function create_audit(rule_set_id) {
    return api_post('/audits', { rule_set_id });
}

export async function import_audit(audit_data) {
    return api_post('/audits/import', audit_data);
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
