/**
 * Visuell markör när Leffe körs på testservern (/test-server/).
 * @module js/logic/test_server_indicator
 */

import { format_build_info_object } from '../utils/build_time_format.js';
import { is_test_server_instance } from '../utils/app_base_path.js';

const VIEWPORT_CLASS = 'test-server-viewport';
const BANNER_CLASS = 'test-server-banner';
const BANNER_ID = 'test-server-banner';

/** Prefix i document.title på testservern (inte dev eller /v2/). */
export const TEST_SERVER_DOCUMENT_TITLE_PREFIX = 'Testserver Leffe: ';

declare global {
    interface Window {
        BUILD_INFO?: {
            timestamp?: string | Date | number;
        };
    }
}

/** Bygger banner-text med byggtid (hh:mm utan sekunder i prod). */
export function format_test_server_banner_text(
    build_timestamp?: string | Date | number | null
): string {
    const formatted = format_build_info_object(build_timestamp ?? new Date(), {
        include_seconds: false,
    });
    return `Leffe testserver - Byggt ${formatted.date} kl ${formatted.time}`;
}

/** Sätter klass på html och infogar banner som första barn i body (icke-dockad). */
export function apply_test_server_viewport_indicator(): void {
    if (typeof document === 'undefined') return;
    if (!is_test_server_instance()) return;

    document.documentElement.classList.add(VIEWPORT_CLASS);

    if (document.getElementById(BANNER_ID)) return;

    const banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.className = BANNER_CLASS;
    banner.setAttribute('role', 'status');
    banner.textContent = format_test_server_banner_text(window.BUILD_INFO?.timestamp);

    const body = document.body;
    if (!body) return;
    body.insertBefore(banner, body.firstChild);
}

/** Lägger till testserver-prefix i sidtitel när appen körs under /test-server/. */
export function apply_test_server_document_title_prefix(title: string): string {
    const trimmed = String(title ?? '').trim();
    if (!trimmed || !is_test_server_instance()) return trimmed;
    return `${TEST_SERVER_DOCUMENT_TITLE_PREFIX}${trimmed}`;
}

/** Uppdaterar banner-text efter att build-info laddats. */
export function update_test_server_banner_text(): void {
    if (!is_test_server_instance()) return;
    const banner = document.getElementById(BANNER_ID);
    if (!banner) return;
    banner.textContent = format_test_server_banner_text(window.BUILD_INFO?.timestamp);
}
