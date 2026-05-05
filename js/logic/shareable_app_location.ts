/**
 * Bygger kanonisk app-URL (pathname + befintlig query + hash-route) för delning och korrekta href.
 * @module js/logic/shareable_app_location
 */

import { merge_audit_id_from_state_into_params } from './router.js';
import { build_compact_hash_fragment } from './router_url_codec.js';
import { requirement_audit_sidebar_settings_to_url_params } from './requirement_audit_url_ui.js';
import {
    list_filter_settings_to_url_params_for_all_requirements,
    list_filter_settings_to_url_params_for_requirement_list
} from './requirements_list_filters_url_ui.js';

/**
 * Parametrar måste vara strängnycklar/strängvärden som i övriga hash-routing.
 *
 * @param canonical_view_name - Kanoniskt vynamn (som till router)
 * @param canonical_params - Hash-parametrar (kanoniska nycklar)
 * @param getState - Valfritt; används för att infoga auditId där routen kräver det
 */
export function build_app_location_href_for_view(
    canonical_view_name: string,
    canonical_params: Record<string, string>,
    getState?: () => unknown
): string {
    const base_params = canonical_params && typeof canonical_params === 'object' ? canonical_params : {};
    const merged = typeof getState === 'function'
        ? merge_audit_id_from_state_into_params(canonical_view_name, { ...base_params }, getState as () => Record<string, unknown> | null | undefined)
        : { ...base_params };
    const fragment = build_compact_hash_fragment(canonical_view_name, merged);
    const path = typeof window !== 'undefined' && window.location?.pathname
        ? window.location.pathname.split('?')[0].split('#')[0]
        : '/';
    const search = typeof window !== 'undefined' && window.location?.search
        ? window.location.search
        : '';
    return `${path}${search}#${fragment}`;
}

/**
 * Lägger till UI-parametrar för delning (sidomeny kravgranskning m.m.) i rutparametrarna.
 */
export function append_shareable_ui_params(
    canonical_view_name: string,
    canonical_params: Record<string, string>,
    getState?: () => unknown
): Record<string, string> {
    const out = { ...(canonical_params || {}) };
    const st = typeof getState === 'function' ? (getState() as Record<string, unknown> | null) : null;
    const ui_settings = st?.uiSettings as Record<string, unknown> | undefined;
    if (!ui_settings) {
        return out;
    }
    if (canonical_view_name === 'requirement_audit' && ui_settings.requirementAuditSidebar) {
        Object.assign(
            out,
            requirement_audit_sidebar_settings_to_url_params(ui_settings.requirementAuditSidebar as never)
        );
    }
    if (canonical_view_name === 'requirement_list' && ui_settings.requirementListFilter) {
        Object.assign(
            out,
            list_filter_settings_to_url_params_for_requirement_list(ui_settings.requirementListFilter as never)
        );
    }
    if (canonical_view_name === 'all_requirements' && ui_settings.allRequirementsFilter) {
        Object.assign(
            out,
            list_filter_settings_to_url_params_for_all_requirements(ui_settings.allRequirementsFilter as never)
        );
    }
    return out;
}

/**
 * Full absolut URL inkl. aktuella filter/sidomeny för urklipp.
 */
export function build_absolute_shareable_url(
    canonical_view_name: string,
    canonical_params: Record<string, string>,
    getState?: () => unknown
): string {
    const with_ui = append_shareable_ui_params(canonical_view_name, canonical_params, getState);
    const relative = build_app_location_href_for_view(canonical_view_name, with_ui, getState);
    if (typeof window === 'undefined' || !window.location?.origin) {
        return relative;
    }
    return `${window.location.origin}${relative}`;
}
