/**
 * @fileoverview Elementidentitet för snapshot-analys.
 */
import type { ElementIdentity } from './snapshot_analysis_types.js';

export type FocusedElementInfo = {
    tagName: string;
    type: string | null;
    role: string | null;
    accessibleName: string | null;
    id: string | null;
    name: string | null;
    href: string | null;
    tabIndex: number | null;
    disabled: boolean;
    ariaDisabled: boolean;
    ariaHidden: boolean;
    boundingBox: { x: number; y: number; width: number; height: number } | null;
    identity: ElementIdentity;
};

/** Bygger identitet från browser-side elementdata. */
export function build_element_identity_from_eval(data: {
    id?: string | null;
    tagName?: string | null;
    role?: string | null;
    name?: string | null;
    domPath?: string | null;
    backendNodeId?: number | null;
}): ElementIdentity {
    const id = data.id?.trim() || null;
    const tag = (data.tagName || '').toLowerCase() || null;
    let selector: string | null = null;
    if (id) {
        selector = `#${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
    } else if (tag && data.name) {
        selector = `${tag}[name="${String(data.name).slice(0, 80)}"]`;
    }
    return {
        backendNodeId: data.backendNodeId ?? null,
        id,
        selector,
        tagName: tag,
        domPath: data.domPath ?? null,
    };
}

export function identity_key(identity: ElementIdentity): string {
    if (identity.backendNodeId != null) return `bn:${identity.backendNodeId}`;
    if (identity.id) return `id:${identity.id}`;
    if (identity.selector) return `sel:${identity.selector}`;
    return `path:${identity.domPath ?? 'unknown'}`;
}

export function sanitize_href(href: string | null | undefined): string | null {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed || trimmed.startsWith('javascript:')) return null;
    return trimmed.slice(0, 500);
}

/** Escapar id för användning i #id-selektor (Node.js, utan CSS global). */
export function escape_element_id_for_selector(id: string): string {
    return id.replace(/\\/g, '\\\\').replace(/([!"#$%&'()*+,./:;<=>?@[\]^`{|}~])/g, '\\$1');
}

export function selector_from_element_id(id: string | null | undefined): string | null {
    if (!id?.trim()) return null;
    return `#${escape_element_id_for_selector(id.trim())}`;
}
