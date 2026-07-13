/**
 * @fileoverview Ren logik för automatisk URL-skärmdump (testbar utan DOM/API).
 */

function looks_like_dangerous_url_scheme(raw: string): boolean {
    return /^(javascript|data|vbscript):/i.test(String(raw || '').trim());
}

/**
 * Returnerar kanonisk http(s)-URL om råvärdet är en accepterad adress (protokoll valfritt).
 */
export function canonical_http_sample_url(
    raw: string,
    add_protocol?: (url: string) => string
): string | null {
    const trimmed = String(raw || '').trim();
    if (!trimmed || looks_like_dangerous_url_scheme(trimmed)) return null;
    const href = add_protocol ? add_protocol(trimmed) : trimmed;
    try {
        const u = new URL(href);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
        if (!u.hostname) return null;
        if (u.pathname === '/' && !u.search && !u.hash) {
            return u.origin;
        }
        return u.href;
    } catch {
        return null;
    }
}

export function is_accepted_sample_url(raw: string, add_protocol?: (url: string) => string): boolean {
    return canonical_http_sample_url(raw, add_protocol) !== null;
}

export function normalize_url_for_screenshot(raw: string, add_protocol?: (url: string) => string): string {
    return canonical_http_sample_url(raw, add_protocol) ?? '';
}

export function remove_filename_from_list(filenames: string[], filename: string | null | undefined): string[] {
    if (!filename) return [...filenames];
    return filenames.filter((name) => name !== filename);
}

export function replace_auto_screenshot_filename(
    filenames: string[],
    old_filename: string | null | undefined,
    new_filename: string
): string[] {
    const without_old = remove_filename_from_list(filenames, old_filename);
    if (without_old.includes(new_filename)) {
        return without_old;
    }
    return [...without_old, new_filename];
}

export function should_skip_url_screenshot_capture(
    normalized_url: string,
    last_captured_url: string | null,
    auto_filename: string | null,
    attached_filenames: string[] = []
): boolean {
    if (!normalized_url || !auto_filename || normalized_url !== last_captured_url) {
        return false;
    }
    return attached_filenames.includes(auto_filename);
}

/** Vid blur: ta inte auto-skärmdump om granskningsdelen har manuellt bifogade bilder (ej enbart auto-skärmdump). */
export function should_skip_url_screenshot_when_attached_media_exists(
    filenames: string[],
    auto_filename: string | null = null
): boolean {
    const manual_filenames = auto_filename
        ? filenames.filter((name) => name !== auto_filename)
        : [...filenames];
    return manual_filenames.length > 0;
}

export function is_url_form_group_visible(
    url_form_group_ref: HTMLElement | null,
    url_input: HTMLInputElement | null
): boolean {
    if (!url_form_group_ref || !url_input) return false;
    if (url_form_group_ref.style.display === 'none' || url_form_group_ref.hidden) return false;
    return url_form_group_ref.getClientRects().length > 0;
}

function read_attached_filenames_from_sample_data(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.map((filename) => String(filename).trim()).filter(Boolean);
}

export function sync_sample_auto_screenshot_state_from_data(
    component: {
        url_auto_screenshot_filename: string | null;
        url_auto_screenshot_source_url: string | null;
    },
    effective_sample_data: {
        url?: string | null;
        urlAutoScreenshotFilename?: string | null;
        attachedMediaFilenames?: unknown;
    } | null | undefined
): void {
    const attached_filenames = read_attached_filenames_from_sample_data(
        effective_sample_data?.attachedMediaFilenames
    );
    const raw_auto_filename = effective_sample_data?.urlAutoScreenshotFilename;
    let auto_filename =
        typeof raw_auto_filename === 'string' && raw_auto_filename.trim() ? raw_auto_filename.trim() : null;
    if (auto_filename && !attached_filenames.includes(auto_filename)) {
        auto_filename = null;
    }
    component.url_auto_screenshot_filename = auto_filename;
    const sample_url = normalize_url_for_screenshot(String(effective_sample_data?.url || ''));
    component.url_auto_screenshot_source_url = auto_filename && sample_url ? sample_url : null;
}

export function on_sample_attach_media_saved(
    component: {
        get_url_auto_screenshot_filename: () => string | null;
        set_url_auto_screenshot_tracking: (filename: string | null, source_url: string | null) => void;
    },
    filenames: string[]
): void {
    const auto_filename = component.get_url_auto_screenshot_filename();
    if (auto_filename && !filenames.includes(auto_filename)) {
        component.set_url_auto_screenshot_tracking(null, null);
    }
}
