/**
 * @fileoverview Namnrymd för localStorage/sessionStorage och BroadcastChannel per deploy-miljö
 * (/v2/ vs /test-server/) så att prod och test inte delar eller läser varandras data.
 */

import { get_deploy_base_prefix } from './app_base_path.js';

const STORAGE_KEY_PREFIX = 'gv';

/**
 * Kort id för aktuell miljö, t.ex. "v2" eller "test-server".
 */
export function get_app_storage_namespace(): string {
    const prefix = get_deploy_base_prefix();
    if (!prefix) return 'root';
    return prefix.replace(/^\//, '') || 'root';
}

/**
 * Prefixerar en logisk lagringsnyckel med miljö-id.
 */
export function scope_storage_key(base_key: string): string {
    const logical = String(base_key || '').trim();
    if (!logical) return `${STORAGE_KEY_PREFIX}:${get_app_storage_namespace()}:`;
    const ns = get_app_storage_namespace();
    const already_scoped = `${STORAGE_KEY_PREFIX}:${ns}:`;
    if (logical.startsWith(already_scoped)) return logical;
    return `${already_scoped}${logical}`;
}

/**
 * Prefixerar BroadcastChannel-namn så flikar bara synkar inom samma miljö.
 */
export function scope_broadcast_channel_name(base_name: string): string {
    const logical = String(base_name || '').trim();
    if (!logical) return logical;
    const ns = get_app_storage_namespace();
    const suffix = `:${ns}`;
    if (logical.endsWith(suffix)) return logical;
    return `${logical}${suffix}`;
}

export function session_storage_get_item(base_key: string): string | null {
    if (typeof sessionStorage === 'undefined') return null;
    try {
        return sessionStorage.getItem(scope_storage_key(base_key));
    } catch {
        return null;
    }
}

export function session_storage_set_item(base_key: string, value: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.setItem(scope_storage_key(base_key), value);
    } catch {
        /* kvot eller blockerad lagring */
    }
}

export function session_storage_remove_item(base_key: string): void {
    if (typeof sessionStorage === 'undefined') return;
    try {
        sessionStorage.removeItem(scope_storage_key(base_key));
    } catch {
        /* ignoreras */
    }
}

export function local_storage_get_item(base_key: string): string | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        return localStorage.getItem(scope_storage_key(base_key));
    } catch {
        return null;
    }
}

export function local_storage_set_item(base_key: string, value: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.setItem(scope_storage_key(base_key), value);
    } catch {
        /* kvot eller blockerad lagring */
    }
}

export function local_storage_remove_item(base_key: string): void {
    if (typeof localStorage === 'undefined') return;
    try {
        localStorage.removeItem(scope_storage_key(base_key));
    } catch {
        /* ignoreras */
    }
}

/** Draft Manager-prefix: gv:{miljö}:draft: */
export function get_draft_storage_prefix(): string {
    return `${scope_storage_key('draft')}:`;
}

export const app_session_storage = {
    getItem: session_storage_get_item,
    setItem: session_storage_set_item,
    removeItem: session_storage_remove_item
};

export const app_local_storage = {
    getItem: local_storage_get_item,
    setItem: local_storage_set_item,
    removeItem: local_storage_remove_item
};
