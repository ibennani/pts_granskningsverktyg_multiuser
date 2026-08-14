// js/logic/list_push_service.js
// Singleton WebSocket för list-uppdateringar (granskningar och regelfiler). Lyssnar på
// audits:changed och rules:changed. Återanslutning med backoff, fallback till polling vid utebliven WS.

import { get_websocket_url } from '../api/client.js';

const EVENT_AUDITS_CHANGED = 'gv-audits-changed';
const EVENT_RULES_CHANGED = 'gv-rules-changed';
const EVENT_RULE_LOCKS_CHANGED = 'gv-rule-locks-changed';
const EVENT_AUDIT_LOCKS_CHANGED = 'gv-audit-locks-changed';
const EVENT_AUDIT_UPDATED = 'gv-audit-updated';
const EVENT_AUDIT_SNAPSHOTS_CHANGED = 'gv-audit-snapshots-changed';
const EVENT_SNAPSHOT_CAPACITY_CHANGED = 'gv-snapshot-capacity-changed';

const RECONNECT_INITIAL_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const FALLBACK_POLL_INTERVAL_MS = 30000;
const FAILED_CONNECT_BEFORE_FALLBACK = 3;

let _ws = null;
let _reconnect_timer = null;
let _reconnect_delay_ms = RECONNECT_INITIAL_MS;
let _fallback_timer = null;
let _failed_connect_count = 0;

const _audits_callbacks = new Set();
const _rules_callbacks = new Set();
const _rule_locks_callbacks = new Set();
const _audit_locks_callbacks = new Set();
const _audit_update_callbacks = new Set();
const _audit_snapshots_callbacks = new Set();
const _snapshot_capacity_callbacks = new Set();

function _has_subscribers() {
    return _audits_callbacks.size > 0
        || _rules_callbacks.size > 0
        || _rule_locks_callbacks.size > 0
        || _audit_locks_callbacks.size > 0
        || _audit_update_callbacks.size > 0
        || _audit_snapshots_callbacks.size > 0
        || _snapshot_capacity_callbacks.size > 0;
}

function _fire_audits_changed() {
    _audits_callbacks.forEach((cb) => {
        try {
            cb();
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_AUDITS_CHANGED));
    }
}

function _fire_rules_changed() {
    _rules_callbacks.forEach((cb) => {
        try {
            cb();
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_RULES_CHANGED));
    }
}

function _fire_rule_locks_changed(payload) {
    _rule_locks_callbacks.forEach((cb) => {
        try {
            cb(payload);
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_RULE_LOCKS_CHANGED, { detail: payload || null }));
    }
}

function _fire_audit_locks_changed(payload) {
    _audit_locks_callbacks.forEach((cb) => {
        try {
            cb(payload);
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_AUDIT_LOCKS_CHANGED, { detail: payload || null }));
    }
}

function _fire_audit_updated(payload) {
    _audit_update_callbacks.forEach((cb) => {
        try {
            cb(payload);
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_AUDIT_UPDATED, { detail: payload || null }));
    }
}

function _fire_snapshot_capacity_changed(payload) {
    _snapshot_capacity_callbacks.forEach((cb) => {
        try {
            cb(payload);
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_SNAPSHOT_CAPACITY_CHANGED, { detail: payload || null }));
    }
}

function _fire_audit_snapshots_changed(payload) {
    _audit_snapshots_callbacks.forEach((cb) => {
        try {
            cb(payload);
        } catch {
            // tyst vid fel i callback
        }
    });
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(EVENT_AUDIT_SNAPSHOTS_CHANGED, { detail: payload || null }));
    }
}

/**
 * Triggar samma lyssnare som vid rules:changed (t.ex. efter lyckat PUT från regelfils-autospar)
 * så att öppna vyer med subscribe_rules kan hämta om listan utan att vänta på WebSocket.
 */
export function notify_rules_list_changed() {
    _fire_rules_changed();
}

function _start_fallback_polling() {
    if (_fallback_timer) return;
    _fallback_timer = setInterval(() => {
        if (!_has_subscribers()) {
            _stop_fallback_polling();
            return;
        }
        if (_ws && _ws.readyState === WebSocket.OPEN) {
            _stop_fallback_polling();
            return;
        }
        _fire_audits_changed();
        _fire_rules_changed();
        /** Tom payload = alla prenumeranter hämtar om lås (samma som vid WS-avbrott utan locks-event). */
        _fire_audit_locks_changed({});
        _fire_rule_locks_changed({});
    }, FALLBACK_POLL_INTERVAL_MS);
}

function _stop_fallback_polling() {
    if (_fallback_timer) {
        clearInterval(_fallback_timer);
        _fallback_timer = null;
    }
}

function _clear_reconnect_timer() {
    if (_reconnect_timer) {
        clearTimeout(_reconnect_timer);
        _reconnect_timer = null;
    }
}

function _schedule_reconnect() {
    if (!_has_subscribers()) return;
    _clear_reconnect_timer();
    _reconnect_timer = setTimeout(() => {
        _reconnect_timer = null;
        _ensure_ws();
    }, _reconnect_delay_ms);
    _reconnect_delay_ms = Math.min(_reconnect_delay_ms * 2, RECONNECT_MAX_MS);
}

function _connect() {
    const url = get_websocket_url();
    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
        try {
            const msg = JSON.parse(e.data);
            const type = msg?.type;
            if (type === 'audits:changed') {
                _fire_audits_changed();
                if (msg?.auditId) {
                    _fire_audit_updated({
                        auditId: String(msg.auditId),
                        version: msg?.version != null && !Number.isNaN(Number(msg.version))
                            ? Number(msg.version)
                            : null,
                        changeKind: msg?.changeKind || 'full'
                    });
                }
            } else if (type === 'rules:changed') {
                _fire_rules_changed();
            } else if (type === 'rules:locks_changed') {
                _fire_rule_locks_changed({ ruleSetId: msg?.ruleSetId || null });
            } else if (type === 'audits:locks_changed') {
                _fire_audit_locks_changed({ auditId: msg?.auditId || null });
            } else if (type === 'audit:snapshots_changed') {
                _fire_audit_snapshots_changed({
                    auditId: msg?.auditId || null,
                    snapshotId: msg?.snapshotId || null,
                    sampleId: msg?.sampleId || null,
                    status: msg?.status || null,
                });
            } else if (type === 'snapshot:capacity_changed') {
                _fire_snapshot_capacity_changed(msg);
            }
        } catch {
            // ignorera ogiltiga meddelanden
        }
    };
    ws.onopen = () => {
        _failed_connect_count = 0;
        _reconnect_delay_ms = RECONNECT_INITIAL_MS;
        _stop_fallback_polling();
    };
    ws.onclose = () => {
        _ws = null;
        _failed_connect_count += 1;
        if (_has_subscribers()) {
            _schedule_reconnect();
            if (_failed_connect_count >= FAILED_CONNECT_BEFORE_FALLBACK) {
                _start_fallback_polling();
            }
        }
    };
    ws.onerror = () => {
        // onclose anropas efter onerror, reconnection hanteras där
    };
    _ws = ws;
}

function _ensure_ws() {
    if (_ws && _ws.readyState === WebSocket.OPEN) return;
    if (_ws) {
        try {
            _ws.close();
        } catch {
            /* ignore */
        }
        _ws = null;
    }
    if (!_has_subscribers()) return;
    try {
        _connect();
    } catch {
        _failed_connect_count += 1;
        _schedule_reconnect();
        if (_failed_connect_count >= FAILED_CONNECT_BEFORE_FALLBACK) {
            _start_fallback_polling();
        }
    }
}

/**
 * Prenumerera på push när granskningslistan har ändrats.
 * Vid WebSocket-avbrott återansluts automatiskt (med backoff). Vid upprepade fel används fallback-polling (30 s).
 * @param {function(): void} callback - Anropas vid audits:changed (eller vid fallback-polling).
 * @returns {function(): void} Avprenumerera-funktion.
 */
export function subscribe_audits(callback) {
    if (typeof callback !== 'function') return () => {};
    _audits_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _audits_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Prenumerera på push när regelfilslistan har ändrats.
 * Vid WebSocket-avbrott återansluts automatiskt (med backoff). Vid upprepade fel används fallback-polling (30 s).
 * @param {function(): void} callback - Anropas vid rules:changed (eller vid fallback-polling).
 * @returns {function(): void} Avprenumerera-funktion.
 */
export function subscribe_rules(callback) {
    if (typeof callback !== 'function') return () => {};
    _rules_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _rules_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Prenumerera på push när lås i en regelfil har ändrats.
 * @param {function({ruleSetId: string|null}): void} callback
 * @returns {function(): void}
 */
export function subscribe_rule_locks(callback) {
    if (typeof callback !== 'function') return () => {};
    _rule_locks_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _rule_locks_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Prenumerera på push när lås i en granskning har ändrats.
 * @param {function({auditId: string|null}): void} callback
 * @returns {function(): void}
 */
export function subscribe_audit_locks(callback) {
    if (typeof callback !== 'function') return () => {};
    _audit_locks_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _audit_locks_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Prenumerera på push när en specifik granskning har ändrats (t.ex. status).
 * @param {function({auditId: string, version: number|null, changeKind?: string}): void} callback
 * @returns {function(): void}
 */
export function subscribe_audit_updates(callback) {
    if (typeof callback !== 'function') return () => {};
    _audit_update_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _audit_update_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Prenumerera på push när snapshot-status för en granskning ändrats.
 * @param {function({auditId: string|null, snapshotId?: string|null, sampleId?: string|null, status?: string|null}): void} callback
 * @returns {function(): void}
 */
export function subscribe_audit_snapshots(callback) {
    if (typeof callback !== 'function') return () => {};
    _audit_snapshots_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _audit_snapshots_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Prenumerera på push när global snapshot-kapacitet ändrats.
 * @param {function(object): void} callback
 * @returns {function(): void}
 */
export function subscribe_snapshot_capacity(callback) {
    if (typeof callback !== 'function') return () => {};
    _snapshot_capacity_callbacks.add(callback);
    _ensure_ws();
    return () => {
        _snapshot_capacity_callbacks.delete(callback);
        if (!_has_subscribers()) {
            _clear_reconnect_timer();
            _stop_fallback_polling();
            if (_ws) {
                try {
                    _ws.close();
                } catch {
                    /* ignore */
                }
                _ws = null;
            }
        }
    };
}

/**
 * Event-namn för att lyssna via window.addEventListener.
 * Använd t.ex. window.addEventListener(ListPushService.EVENT_AUDITS_CHANGED, handler).
 */
/**
 * Event-namn för att lyssna via window.addEventListener.
 * Använd t.ex. window.addEventListener(ListPushService.EVENT_AUDITS_CHANGED, handler).
 */
export const EVENT_NAMES = {
    AUDITS_CHANGED: EVENT_AUDITS_CHANGED,
    RULES_CHANGED: EVENT_RULES_CHANGED,
    RULE_LOCKS_CHANGED: EVENT_RULE_LOCKS_CHANGED,
    AUDIT_LOCKS_CHANGED: EVENT_AUDIT_LOCKS_CHANGED,
    AUDIT_UPDATED: EVENT_AUDIT_UPDATED,
    AUDIT_SNAPSHOTS_CHANGED: EVENT_AUDIT_SNAPSHOTS_CHANGED,
    SNAPSHOT_CAPACITY_CHANGED: EVENT_SNAPSHOT_CAPACITY_CHANGED,
};

export const ListPushService = {
    subscribe_audits,
    subscribe_rules,
    subscribe_rule_locks,
    subscribe_audit_locks,
    subscribe_audit_updates,
    subscribe_audit_snapshots,
    subscribe_snapshot_capacity,
    notify_rules_list_changed,
    EVENT_NAMES
};
