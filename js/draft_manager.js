const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = 'draft:';
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_AUTO_RESTORE_MS = 2 * 60 * 60 * 1000;
const FLUSH_DEBOUNCE_MS = 1000;

function generate_tab_id() {
    return `tab_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

function now_ms() {
    return Date.now();
}

function is_quota_error(error) {
    if (!error) return false;
    if (error.name === 'QuotaExceededError') return true;
    if (error.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
    if (error.code === 22 || error.code === 1014) return true;
    return false;
}

function safe_json_parse(raw) {
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function normalize_string(value) {
    if (typeof value !== 'string') return '';
    return value;
}

function get_storage_entries(storage) {
    const entries = [];
    if (!storage) return entries;
    for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
        const raw = storage.getItem(key);
        const parsed = safe_json_parse(raw);
        if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) continue;
        entries.push({ key, value: parsed });
    }
    return entries;
}

function cleanup_storage(storage, { max_age_ms = DRAFT_TTL_MS, remove_oldest_count = 0 } = {}) {
    if (!storage) return 0;
    const now = now_ms();
    let removed = 0;
    const entries = get_storage_entries(storage);

    entries.forEach(entry => {
        const updated_at = Number(entry.value?.updatedAt || 0);
        if (!updated_at || now - updated_at > max_age_ms) {
            storage.removeItem(entry.key);
            removed += 1;
        }
    });

    if (remove_oldest_count > 0) {
        const remaining = get_storage_entries(storage)
            .sort((a, b) => (a.value.updatedAt || 0) - (b.value.updatedAt || 0));
        remaining.slice(0, remove_oldest_count).forEach(entry => {
            storage.removeItem(entry.key);
            removed += 1;
        });
    }

    return removed;
}

function should_skip_element(element) {
    if (!element) return true;
    if (element.closest('[data-draft-ignore="true"]')) return true;
    if (element.getAttribute && element.getAttribute('data-draft-ignore') === 'true') return true;
    if (element.getAttribute && element.getAttribute('data-draft-sensitive') === 'true') return true;
    if (element.type === 'password') return true;
    if (element.type === 'file') return true;
    return false;
}

function get_field_key(element) {
    if (!element || !element.getAttribute) return null;
    const explicit_path = element.getAttribute('data-draft-path');
    if (explicit_path) return explicit_path;
    if (element.type === 'radio') {
        const group_name = element.getAttribute('name');
        if (group_name) return `radio:${group_name}`;
    }
    const name_attr = element.getAttribute('name');
    if (name_attr) return name_attr;
    const id_attr = element.getAttribute('id');
    if (id_attr) return id_attr;
    return generate_fallback_path(element);
}

function generate_fallback_path(element) {
    const parts = [];
    let current = element;
    let depth = 0;
    while (current && current.nodeType === 1 && depth < 4) {
        const tag = current.tagName.toLowerCase();
        if (current.id) {
            parts.unshift(`${tag}#${current.id}`);
            break;
        }
        let part = tag;
        const parent = current.parentElement;
        if (parent) {
            const siblings = Array.from(parent.children).filter(child => child.tagName === current.tagName);
            const index = siblings.indexOf(current) + 1;
            part += `:nth-of-type(${index})`;
        }
        parts.unshift(part);
        current = current.parentElement;
        depth += 1;
    }
    return parts.join('>');
}

function get_field_record(element) {
    if (!element) return null;
    if (should_skip_element(element)) return null;

    const field_key = get_field_key(element);
    if (!field_key) return null;

    if (element.isContentEditable) {
        return {
            field_key,
            type: 'contenteditable',
            value: normalize_string(element.textContent),
            extra: {}
        };
    }

    const tag = element.tagName ? element.tagName.toLowerCase() : '';
    if (tag === 'select') {
        if (element.multiple) {
            const values = Array.from(element.selectedOptions || []).map(option => option.value);
            return {
                field_key,
                type: 'select',
                value: values,
                extra: { multiple: true }
            };
        }
        return {
            field_key,
            type: 'select',
            value: element.value,
            extra: { multiple: false }
        };
    }

    if (tag === 'textarea') {
        return {
            field_key,
            type: 'text',
            value: normalize_string(element.value),
            extra: {}
        };
    }

    if (tag === 'input') {
        if (element.type === 'checkbox') {
            return {
                field_key,
                type: 'checkbox',
                value: Boolean(element.checked),
                extra: {}
            };
        }
        if (element.type === 'radio') {
            if (!element.checked) return null;
            return {
                field_key,
                type: 'radio',
                value: element.value,
                extra: {}
            };
        }
        return {
            field_key,
            type: 'text',
            value: normalize_string(element.value),
            extra: { inputType: element.type || 'text' }
        };
    }

    return null;
}

function is_empty_like(value) {
    if (value === null || value === undefined) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim() === '';
    if (typeof value === 'boolean') return value === false;
    return false;
}

export const DraftManager = {
    init({ getRouteKey, getScopeKey, rootProvider, restorePolicy = {}, onConflict } = {}) {
        this.get_route_key = getRouteKey || (() => window.location?.hash?.split('?')[0] || 'unknown');
        this.get_scope_key = getScopeKey || (() => 'default');
        this.root_provider = rootProvider || (() => document.body);
        this.restore_policy = {
            max_auto_restore_age_ms: restorePolicy.max_auto_restore_age_ms || DEFAULT_AUTO_RESTORE_MS
        };
        this.on_conflict = typeof onConflict === 'function' ? onConflict : null;
        this.tab_id = generate_tab_id();
        this.current_draft = null;
        this.flush_timer = null;
        this.memory_store = {};
        this.has_conflict_flag = false;
        this.suspend_capture = false;

        this.cleanupOldDrafts();
    },

    get_current_draft_key() {
        const route_key = this.get_route_key ? this.get_route_key() : 'unknown';
        const scope_key = this.get_scope_key ? this.get_scope_key() : 'default';
        return `${route_key}::${scope_key}`;
    },

    get_current_draft_snapshot() {
        const draft_key = this.get_current_draft_key();
        const session_value = this._read_from_storage(sessionStorage, draft_key);
        if (session_value) return session_value;
        const local_value = this._read_from_storage(localStorage, draft_key);
        if (local_value) return local_value;
        return this.memory_store[draft_key] || null;
    },

    captureFieldChange(element) {
        if (this.suspend_capture) return;
        const record = get_field_record(element);
        if (!record) return;

        const draft_key = this.get_current_draft_key();
        const route_key = this.get_route_key ? this.get_route_key() : 'unknown';
        const scope_key = this.get_scope_key ? this.get_scope_key() : 'default';

        if (!this.current_draft || this.current_draft.draftKey !== draft_key) {
            const existing = this.get_current_draft_snapshot();
            this.current_draft = existing || {
                schemaVersion: SCHEMA_VERSION,
                draftKey: draft_key,
                routeKey: route_key,
                scopeKey: scope_key,
                tabId: this.tab_id,
                updatedAt: now_ms(),
                fields: {}
            };
        }

        this.current_draft.routeKey = route_key;
        this.current_draft.scopeKey = scope_key;
        this.current_draft.tabId = this.tab_id;
        this.current_draft.updatedAt = now_ms();
        this.current_draft.fields[record.field_key] = {
            type: record.type,
            value: record.value,
            extra: record.extra || {}
        };

        this._schedule_flush();
    },

    flushNow(reason = 'manual') {
        clearTimeout(this.flush_timer);
        this.flush_timer = null;
        this._persist_current_draft(reason);
    },

    restoreIntoDom(root_el) {
        const root = root_el || (this.root_provider ? this.root_provider() : document.body);
        if (!root) return;

        const draft = this.get_current_draft_snapshot();
        if (!draft || !draft.fields) return;

        const now = now_ms();
        const age_ms = now - Number(draft.updatedAt || 0);
        const is_fresh = age_ms <= this.restore_policy.max_auto_restore_age_ms;
        const empty_only = !is_fresh;

        if (!is_fresh) {
            console.warn('[DraftManager] Utkast ar aldre an auto-restore, aterstaller endast tomma falt.');
        }

        this.suspend_capture = true;
        try {
            const field_nodes = this._collect_fields(root);
            const processed_keys = new Set();

            field_nodes.forEach(element => {
                const field_key = get_field_key(element);
                if (!field_key || processed_keys.has(field_key)) return;
                const record = draft.fields[field_key];
                if (!record) return;

                if (element.type === 'radio') {
                    if (processed_keys.has(field_key)) return;
                    processed_keys.add(field_key);
                    this._apply_radio_group(root, element, record, empty_only);
                    return;
                }

                if (!this._should_apply_to_element(element, record, empty_only)) return;
                this._apply_value_to_element(element, record);
                processed_keys.add(field_key);
            });
        } finally {
            this.suspend_capture = false;
        }
    },

    clearCurrentDraft() {
        const draft_key = this.get_current_draft_key();
        this._remove_from_storage(sessionStorage, draft_key);
        this._remove_from_storage(localStorage, draft_key);
        delete this.memory_store[draft_key];
        if (this.current_draft?.draftKey === draft_key) {
            this.current_draft = null;
        }
        this.has_conflict_flag = false;
    },

    commitCurrentDraft() {
        this.clearCurrentDraft();
    },

    cleanupOldDrafts() {
        cleanup_storage(sessionStorage, { max_age_ms: DRAFT_TTL_MS });
        cleanup_storage(localStorage, { max_age_ms: DRAFT_TTL_MS });
        const now = now_ms();
        Object.keys(this.memory_store).forEach(key => {
            const draft = this.memory_store[key];
            if (!draft?.updatedAt || now - draft.updatedAt > DRAFT_TTL_MS) {
                delete this.memory_store[key];
            }
        });
    },

    handleStorageEvent(event) {
        if (!event || !event.key || !event.key.startsWith(STORAGE_PREFIX)) return;
        const current_key = `${STORAGE_PREFIX}${this.get_current_draft_key()}`;
        if (event.key !== current_key) return;
        const incoming = safe_json_parse(event.newValue);
        if (!incoming || incoming.schemaVersion !== SCHEMA_VERSION) return;
        if (incoming.tabId === this.tab_id) return;

        const current = this.get_current_draft_snapshot();
        const incoming_time = Number(incoming.updatedAt || 0);
        const current_time = Number(current?.updatedAt || 0);
        if (incoming_time > current_time) {
            this.has_conflict_flag = true;
            console.warn('[DraftManager] Utkast uppdaterades i en annan flik.');
            if (this.on_conflict) {
                this.on_conflict(incoming);
            }
        }
    },

    hasConflict() {
        return this.has_conflict_flag;
    },

    _schedule_flush() {
        clearTimeout(this.flush_timer);
        this.flush_timer = setTimeout(() => {
            this._persist_current_draft('debounce');
        }, FLUSH_DEBOUNCE_MS);
    },

    _persist_current_draft(reason) {
        if (!this.current_draft) return;
        const draft_key = this.current_draft.draftKey;
        const storage_key = `${STORAGE_PREFIX}${draft_key}`;

        this.memory_store[draft_key] = { ...this.current_draft };

        const serialized = JSON.stringify(this.current_draft);
        const session_ok = this._write_to_storage(sessionStorage, storage_key, serialized);
        if (!session_ok) {
            console.warn('[DraftManager] Kunde inte spara utkast i sessionStorage.');
        }

        const local_payload = this._strip_sensitive_fields(this.current_draft);
        if (local_payload) {
            const local_serialized = JSON.stringify(local_payload);
            const local_ok = this._write_to_storage(localStorage, storage_key, local_serialized);
            if (!local_ok) {
                console.warn('[DraftManager] Kunde inte spara utkast i localStorage.');
            }
        }

        if (reason === 'pagehide' || reason === 'visibilitychange' || reason === 'beforeunload') {
            this.cleanupOldDrafts();
        }
    },

    _write_to_storage(storage, key, value) {
        if (!storage) return false;
        try {
            storage.setItem(key, value);
            return true;
        } catch (e) {
            if (is_quota_error(e)) {
                cleanup_storage(storage, { max_age_ms: DRAFT_TTL_MS, remove_oldest_count: 3 });
                try {
                    storage.setItem(key, value);
                    return true;
                } catch (retry_error) {
                    return false;
                }
            }
            return false;
        }
    },

    _read_from_storage(storage, draft_key) {
        if (!storage) return null;
        const raw = storage.getItem(`${STORAGE_PREFIX}${draft_key}`);
        const parsed = safe_json_parse(raw);
        if (!parsed || parsed.schemaVersion !== SCHEMA_VERSION) return null;
        if (parsed.updatedAt && now_ms() - parsed.updatedAt > DRAFT_TTL_MS) return null;
        return parsed;
    },

    _remove_from_storage(storage, draft_key) {
        if (!storage) return;
        storage.removeItem(`${STORAGE_PREFIX}${draft_key}`);
    },

    _strip_sensitive_fields(draft) {
        if (!draft || !draft.fields) return null;
        const safe_fields = {};
        Object.entries(draft.fields).forEach(([key, value]) => {
            if (!value) return;
            if (value.type === 'text' && value.extra?.inputType === 'password') return;
            safe_fields[key] = value;
        });
        if (Object.keys(safe_fields).length === 0) return null;
        return {
            ...draft,
            fields: safe_fields
        };
    },

    _collect_fields(root) {
        const nodes = [];
        if (!root) return nodes;
        const selectors = [
            'input',
            'textarea',
            'select',
            '[contenteditable="true"]'
        ];
        root.querySelectorAll(selectors.join(',')).forEach(element => {
            if (should_skip_element(element)) return;
            nodes.push(element);
        });
        return nodes;
    },

    _should_apply_to_element(element, record, empty_only) {
        if (!element || !record) return false;
        if (should_skip_element(element)) return false;

        if (record.type === 'checkbox') {
            if (empty_only) return element.checked === element.defaultChecked;
            return element.checked === element.defaultChecked || is_empty_like(element.checked);
        }
        if (record.type === 'select' && record.extra?.multiple) {
            const selected = Array.from(element.selectedOptions || []).map(opt => opt.value);
            if (empty_only) return selected.length === 0;
            return selected.length === 0 || selected.join(',') === (record.value || []).join(',');
        }
        if (record.type === 'select') {
            if (empty_only) return is_empty_like(element.value);
            return element.value === element.defaultValue || is_empty_like(element.value);
        }
        if (record.type === 'contenteditable') {
            const current = normalize_string(element.textContent);
            if (empty_only) return is_empty_like(current);
            return is_empty_like(current);
        }
        const current_value = normalize_string(element.value);
        if (empty_only) return is_empty_like(current_value);
        return current_value === element.defaultValue || is_empty_like(current_value);
    },

    _apply_value_to_element(element, record) {
        if (!element || !record) return;
        if (record.type === 'checkbox') {
            element.checked = Boolean(record.value);
            return;
        }
        if (record.type === 'select') {
            if (record.extra?.multiple && Array.isArray(record.value)) {
                const values = new Set(record.value);
                Array.from(element.options || []).forEach(opt => {
                    opt.selected = values.has(opt.value);
                });
                return;
            }
            element.value = record.value ?? '';
            return;
        }
        if (record.type === 'contenteditable') {
            element.textContent = normalize_string(record.value);
            return;
        }
        element.value = record.value ?? '';
    },

    _apply_radio_group(root, element, record, empty_only) {
        const group_name = element.getAttribute('name');
        if (!group_name) return;
        const radios = root.querySelectorAll(`input[type="radio"][name="${CSS.escape(group_name)}"]`);
        let any_checked = false;
        radios.forEach(radio => {
            if (radio.checked) any_checked = true;
        });
        if (empty_only && any_checked) return;
        radios.forEach(radio => {
            radio.checked = radio.value === record.value;
        });
    }
};
