/**
 * @fileoverview Strukturerad konsollogg för krav-vy: knappar, fokus, synk m.m.
 * Spårar klick → logisk status → DOM → serversynk med tidsstämpel och flow_id.
 */

import { consoleManager } from '../../utils/console_manager.js';

export type KravVyKnappHandelse =
    | 'Klick'
    | 'Fokus fick'
    | 'Fokus förlorade'
    | 'Logisk statusändring'
    | 'DOM/utseende uppdaterat'
    | 'Synk start'
    | 'Synk slut'
    | 'Synk fel'
    | 'Synk hoppades över';

export type KravVyTextareaHandelse =
    | 'Autospar timer startad'
    | 'Autospar till sessionStorage (debounce)'
    | 'Autospar till sessionStorage (unload)'
    | 'Autospar till sessionStorage (flik dold)'
    | 'Autospar till sessionStorage (blur)'
    | 'Autospar hoppades över (oförändrat)';

type LogOptions = {
    critical?: boolean;
};

const STATUS_BUTTON_LABELS: Record<string, string> = {
    'set-check-complies': 'Kontrollpunkt: Stämmer',
    'set-check-not-complies': 'Kontrollpunkt: Stämmer inte',
    'set-pc-passed': 'Godkännandekriterium: Godkänt',
    'set-pc-failed': 'Godkännandekriterium: Underkänt'
};

const COMMENT_FIELD_LABELS: Record<string, string> = {
    commentToAuditor: 'Kommentar till granskare',
    commentToActor: 'Kommentar till aktör'
};

let flow_counter = 0;

/** flow_id per knappnyckel som väntar på DOM-uppdatering efter klick */
const pending_dom_flow_ids = new Map<string, string>();

/** flow_id i kö som väntar på serversynk efter statusändring */
const pending_sync_flow_ids: string[] = [];

function now_ms(): number {
    return Date.now();
}

export function log_krav_vy_knapp(
    kind: KravVyKnappHandelse,
    payload: Record<string, unknown>,
    options: LogOptions = {}
): void {
    const entry = {
        ts_ms: now_ms(),
        händelse: kind,
        ...payload
    };
    if (options.critical) {
        consoleManager.originalConsole.error('[Krav-vy knapp]', entry);
        return;
    }
    consoleManager.originalConsole.warn('[Krav-vy knapp]', entry);
}

export function start_krav_vy_knapp_flow(payload: Record<string, unknown>): string {
    const flow_id = `kvk-${now_ms()}-${++flow_counter}`;
    log_krav_vy_knapp('Klick', { flow_id, ...payload });
    return flow_id;
}

function brief_element_ref(element: Element | null | undefined): Record<string, unknown> | null {
    if (!element || !(element instanceof Element)) return null;
    const tag = element.tagName?.toLowerCase() || null;
    return {
        tag,
        id: element.id || null,
        action: element.getAttribute?.('data-action') || null
    };
}

function is_krav_vy_focus_log_target(element: EventTarget | null): element is HTMLElement {
    if (!element || !(element instanceof HTMLElement)) return false;
    const tag = element.tagName?.toLowerCase();
    if (tag === 'button' || tag === 'textarea' || tag === 'select') return true;
    if (tag === 'a' && (element.getAttribute('href') || '').trim() !== '') return true;
    if (tag === 'input') {
        const input_type = (element.getAttribute('type') || 'text').toLowerCase();
        return input_type !== 'hidden';
    }
    const tabindex = element.getAttribute('tabindex');
    return tabindex !== null && tabindex !== '-1';
}

export function build_krav_vy_focus_payload(
    element: HTMLElement,
    event?: FocusEvent | null
): Record<string, unknown> {
    const tag = element.tagName?.toLowerCase();
    const payload: Record<string, unknown> = {
        tag,
        id: element.id || null
    };

    const check_item = element.closest('.check-item[data-check-id]');
    const pc_item = element.closest('.pass-criterion-item[data-pc-id]');
    if (check_item) {
        payload.check_id = check_item.getAttribute('data-check-id');
    }
    if (pc_item) {
        payload.pc_id = pc_item.getAttribute('data-pc-id');
    }

    if (tag === 'button') {
        payload.typ = 'knapp';
        const action = element.getAttribute('data-action') || '';
        payload.action = action || null;
        payload.knapp = STATUS_BUTTON_LABELS[action]
            || (element.textContent || '').trim().slice(0, 80)
            || action
            || 'knapp';
    } else if (tag === 'textarea') {
        payload.typ = 'textarea';
        if (element.classList.contains('pc-observation-detail-textarea')) {
            payload.fält = 'Observation';
        } else if (element.id && COMMENT_FIELD_LABELS[element.id]) {
            payload.fält = COMMENT_FIELD_LABELS[element.id];
            payload.fält_id = element.id;
        } else {
            payload.fält = element.id || 'textarea';
        }
    } else if (tag === 'a') {
        payload.typ = 'länk';
        payload.href = element.getAttribute('href');
        payload.text = (element.textContent || '').trim().slice(0, 80) || null;
    } else if (tag === 'input') {
        payload.typ = 'inmatning';
        payload.input_type = element.getAttribute('type') || 'text';
        payload.name = element.getAttribute('name') || null;
    } else if (tag === 'select') {
        payload.typ = 'lista';
        payload.name = element.getAttribute('name') || null;
    } else {
        payload.typ = tag || 'element';
    }

    if (event?.relatedTarget instanceof Element) {
        payload.fokus_gick_till = brief_element_ref(event.relatedTarget);
    }

    return payload;
}

export function log_krav_vy_fokus(
    kind: 'Fokus fick' | 'Fokus förlorade',
    element: HTMLElement,
    event?: FocusEvent | null
): void {
    log_krav_vy_knapp(kind, build_krav_vy_focus_payload(element, event));
}

export function log_krav_vy_fokus_from_event(
    kind: 'Fokus fick' | 'Fokus förlorade',
    event: FocusEvent
): void {
    const target = event.target;
    if (!is_krav_vy_focus_log_target(target)) return;
    log_krav_vy_fokus(kind, target, event);
}

export function register_krav_vy_knapp_dom_watch(flow_id: string, key: string): void {
    pending_dom_flow_ids.set(key, flow_id);
}

export function consume_krav_vy_dom_flow(key: string): string | null {
    const flow_id = pending_dom_flow_ids.get(key) || null;
    if (flow_id) {
        pending_dom_flow_ids.delete(key);
    }
    return flow_id;
}

export function register_krav_vy_knapp_sync(flow_id: string | null | undefined): void {
    if (!flow_id) return;
    pending_sync_flow_ids.push(flow_id);
}

export function peek_krav_vy_sync_flow(): string | null {
    return pending_sync_flow_ids[0] || null;
}

export function consume_krav_vy_sync_flow(): string | null {
    return pending_sync_flow_ids.shift() || null;
}

export function warn_krav_vy_sync_not_available(flow_id: string | null | undefined, reason: string): void {
    if (!flow_id) return;
    consume_krav_vy_sync_flow();
    log_krav_vy_knapp('Synk hoppades över', {
        flow_id,
        anledning: reason
    }, { critical: true });
}

export function log_krav_vy_sync_start(flow_id: string, extra: Record<string, unknown> = {}): void {
    log_krav_vy_knapp('Synk start', { flow_id, ...extra });
}

export function log_krav_vy_sync_slut(flow_id: string, extra: Record<string, unknown> = {}): void {
    log_krav_vy_knapp('Synk slut', { flow_id, ...extra });
    consume_krav_vy_sync_flow();
}

export function log_krav_vy_sync_fel(flow_id: string, extra: Record<string, unknown> = {}): void {
    log_krav_vy_knapp('Synk fel', { flow_id, ...extra }, { critical: true });
    consume_krav_vy_sync_flow();
}

export function log_krav_vy_sync_skipped(flow_id: string, reason: string, extra: Record<string, unknown> = {}): void {
    log_krav_vy_knapp('Synk hoppades över', {
        flow_id,
        anledning: reason,
        ...extra
    }, { critical: true });
    consume_krav_vy_sync_flow();
}

export function log_krav_vy_textarea(
    kind: KravVyTextareaHandelse,
    payload: Record<string, unknown> = {}
): void {
    consoleManager.originalConsole.warn('[Krav-vy textarea]', {
        ts_ms: now_ms(),
        händelse: kind,
        ...payload
    });
}
