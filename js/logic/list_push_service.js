// js/logic/list_push_service.js
// Singleton WebSocket för list-uppdateringar (granskningar och regelfiler). Lyssnar på
// audits:changed och rules:changed. Återanslutning med backoff, fallback till polling vid utebliven WS.

import { get_websocket_url } from '../api/client.js';

const EVENT_AUDITS_CHANGED = 'gv-audits-changed';
const EVENT_RULES_CHANGED = 'gv-rules-changed';

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

function _has_subscribers() {
    return _audits_callbacks.size > 0 || _rules_callbacks.size > 0;
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
            } else if (type === 'rules:changed') {
                _fire_rules_changed();
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
 * Event-namn för att lyssna via window.addEventListener.
 * Använd t.ex. window.addEventListener(ListPushService.EVENT_AUDITS_CHANGED, handler).
 */
export const EVENT_NAMES = {
    AUDITS_CHANGED: EVENT_AUDITS_CHANGED,
    RULES_CHANGED: EVENT_RULES_CHANGED
};

export const ListPushService = {
    subscribe_audits,
    subscribe_rules,
    EVENT_NAMES
};
