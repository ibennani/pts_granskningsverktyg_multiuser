/**
 * @fileoverview Ren logik för automatisk URL-skärmdump (testbar utan DOM/API).
 */

export function normalize_url_for_screenshot(raw: string, add_protocol?: (url: string) => string): string {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return '';
    return add_protocol ? add_protocol(trimmed) : trimmed;
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
    auto_filename: string | null
): boolean {
    return Boolean(normalized_url && normalized_url === last_captured_url && auto_filename);
}

/** Vid blur: ta inte auto-skärmdump om stickprovet redan har bifogade bilder. */
export function should_skip_url_screenshot_when_attached_media_exists(filenames: string[]): boolean {
    return filenames.length > 0;
}

export function sync_sample_auto_screenshot_state_from_data(
    component: {
        url_auto_screenshot_filename: string | null;
        url_auto_screenshot_source_url: string | null;
    },
    effective_sample_data: {
        url?: string | null;
        urlAutoScreenshotFilename?: string | null;
    } | null | undefined
): void {
    const auto_filename = effective_sample_data?.urlAutoScreenshotFilename;
    component.url_auto_screenshot_filename =
        typeof auto_filename === 'string' && auto_filename.trim() ? auto_filename.trim() : null;
    const sample_url = normalize_url_for_screenshot(String(effective_sample_data?.url || ''));
    component.url_auto_screenshot_source_url =
        component.url_auto_screenshot_filename && sample_url ? sample_url : null;
}

export function on_sample_attach_media_saved(
    component: { url_auto_screenshot_filename: string | null; url_auto_screenshot_source_url: string | null },
    filenames: string[]
): void {
    const auto_filename = component.url_auto_screenshot_filename;
    if (auto_filename && !filenames.includes(auto_filename)) {
        component.url_auto_screenshot_filename = null;
        component.url_auto_screenshot_source_url = null;
    }
}
